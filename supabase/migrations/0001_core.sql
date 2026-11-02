-- Một Ngày Mới — core cloud schema (subset DB02/DB03/DB18/DB19/DB25 of blueprint 06).
-- RLS deny-by-default; client chỉ đọc hàng của mình; ghi save qua RPC save_cas (CAS + idempotency).
-- CHƯA được chạy trên dự án Supabase thật — cần review backend/security và chạy policy tests (QA02) trước khi dùng.

create extension if not exists pgcrypto;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 24),
  locale text not null default 'vi' check (locale in ('vi','en')),
  telemetry_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  accessibility jsonb not null default '{}' check (pg_column_size(accessibility) <= 16384),
  audio_preferences jsonb not null default '{}' check (pg_column_size(audio_preferences) <= 16384),
  control_preferences jsonb not null default '{}' check (pg_column_size(control_preferences) <= 16384),
  locale text not null default 'vi',
  updated_at timestamptz not null default now()
);

-- Một lineage SP (sp_untrusted) mỗi hành trình; snapshot JSONB ≤512KiB.
create table public.game_saves (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  lineage_id text not null check (char_length(lineage_id) between 4 and 80),
  slot smallint not null check (slot between 0 and 4),
  generation bigint not null default 1 check (generation > 0),
  revision bigint not null default 1 check (revision > 0),
  schema_version integer not null check (schema_version between 1 and 2),
  content_version text not null,
  trust_mode text not null default 'sp_untrusted' check (trust_mode = 'sp_untrusted'),
  snapshot jsonb not null check (pg_column_size(snapshot) <= 524288),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  meta jsonb not null default '{}' check (pg_column_size(meta) <= 4096),
  is_head boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, lineage_id, slot, generation)
);
create index game_saves_owner_updated on public.game_saves (owner_id, updated_at desc);
create unique index game_saves_one_head on public.game_saves (owner_id, lineage_id, slot) where is_head;

create table public.idempotency_records (
  owner_id uuid not null references auth.users(id) on delete cascade,
  route text not null,
  key uuid not null,
  request_hash text not null,
  response jsonb,
  expires_at timestamptz not null default now() + interval '24 hours',
  primary key (owner_id, route, key)
);
create index idempotency_expires on public.idempotency_records (expires_at);

alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.game_saves enable row level security;
alter table public.idempotency_records enable row level security;

-- R1: owner read; writes restricted
create policy profiles_select_own on public.profiles for select using (auth.uid() = user_id);
create policy profiles_update_own on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy profiles_insert_own on public.profiles for insert with check (auth.uid() = user_id);
create policy settings_rw_own on public.settings for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy saves_select_own on public.game_saves for select using (auth.uid() = owner_id);
-- Không có policy INSERT/UPDATE/DELETE cho game_saves: chỉ qua save_cas (security definer).
-- idempotency_records: không có policy → client không truy cập (R5).

revoke all on public.game_saves from anon;
revoke all on public.idempotency_records from anon, authenticated;

create view public.game_saves_head with (security_invoker = true) as
  select id, owner_id, lineage_id, slot, generation, revision, updated_at,
         (meta->>'day')::int as day, meta->>'zone' as zone, meta->>'name' as name
  from public.game_saves where is_head;

-- API04 Write SP save (CAS). Lỗi xung đột: SQLSTATE P0409, message chứa current=<rev>.
create or replace function public.save_cas(
  p_lineage_id text, p_slot smallint, p_expected_revision bigint, p_schema_version int, p_content_version text,
  p_snapshot jsonb, p_sha256 text, p_meta jsonb, p_idempotency_key uuid
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_head public.game_saves%rowtype;
  v_hash text := encode(digest(p_snapshot::text || p_slot::text || p_lineage_id, 'sha256'), 'hex');
  v_prev jsonb;
  v_new_rev bigint;
  v_id uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if pg_column_size(p_snapshot) > 524288 then raise exception 'SAVE_TOO_LARGE' using errcode = '22023'; end if;
  if (p_snapshot->>'trustMode') is distinct from 'sp_untrusted' then raise exception 'MODE_ESCALATION' using errcode = '22023'; end if;
  select response into v_prev from public.idempotency_records where owner_id = v_uid and route = 'save_cas' and key = p_idempotency_key;
  if found then return v_prev; end if;
  select * into v_head from public.game_saves where owner_id = v_uid and lineage_id = p_lineage_id and slot = p_slot and is_head for update;
  if found then
    if p_expected_revision is distinct from v_head.revision then
      raise exception 'SAVE_REVISION_CONFLICT current=%', v_head.revision using errcode = 'P0409';
    end if;
    update public.game_saves set is_head = false where id = v_head.id;
    v_new_rev := v_head.revision + 1;
  else
    if p_expected_revision is not null then raise exception 'SAVE_REVISION_CONFLICT current=0' using errcode = 'P0409'; end if;
    v_new_rev := 1;
  end if;
  insert into public.game_saves (owner_id, lineage_id, slot, generation, revision, schema_version, content_version, snapshot, sha256, meta)
  values (v_uid, p_lineage_id, p_slot, v_new_rev, v_new_rev, p_schema_version, p_content_version, p_snapshot, p_sha256, p_meta)
  returning id into v_id;
  -- giữ 2 generation gần nhất cho slot
  delete from public.game_saves where owner_id = v_uid and lineage_id = p_lineage_id and slot = p_slot and generation < v_new_rev - 1;
  insert into public.idempotency_records (owner_id, route, key, request_hash, response)
  values (v_uid, 'save_cas', p_idempotency_key, v_hash, jsonb_build_object('saveId', v_id, 'revision', v_new_rev, 'durable', true));
  return jsonb_build_object('saveId', v_id, 'revision', v_new_rev, 'durable', true);
end $$;
revoke all on function public.save_cas from public, anon;
grant execute on function public.save_cas to authenticated;
