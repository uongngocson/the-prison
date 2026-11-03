-- Trang quản trị (/admin): quyền admin, theo dõi người chơi (kể cả khách vãng lai), nhật ký lỗi, cấm chơi trực tuyến,
-- cấu hình bạn tù AI và thống kê. Chạy SAU 0001–0003. Chạy lại được nhiều lần (idempotent).
-- Ngày thống kê tính theo giờ Việt Nam (Asia/Ho_Chi_Minh).

-- ===================== Quyền admin =====================
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;
grant select on public.admins to authenticated;
drop policy if exists admins_self on public.admins;
create policy admins_self on public.admins for select to authenticated using (user_id = auth.uid());

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;
revoke all on function public.is_admin from public;
grant execute on function public.is_admin to anon, authenticated;

create or replace function public.vn_day(t timestamptz) returns date
language sql immutable as $$ select (t at time zone 'Asia/Ho_Chi_Minh')::date $$;

-- ===================== Người chơi (mỗi trình duyệt/thiết bị = 1 visitor) =====================
-- user_id null = khách vãng lai (chưa đăng nhập). Client không đọc/ghi trực tiếp: chỉ qua RPC track_visit.
create table if not exists public.visitors (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete set null,
  name text not null default '' check (char_length(name) <= 40),
  platform text not null default '' check (char_length(platform) <= 20),
  os text not null default '' check (char_length(os) <= 30),
  browser text not null default '' check (char_length(browser) <= 30),
  build text not null default '' check (char_length(build) <= 40),
  last_peer text not null default '' check (char_length(last_peer) <= 64),
  last_mode text not null default 'offline' check (last_mode in ('offline', 'online')),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  sessions integer not null default 0,
  minutes integer not null default 0
);
create index if not exists visitors_user_idx on public.visitors (user_id);
create index if not exists visitors_last_seen_idx on public.visitors (last_seen desc);
create index if not exists visitors_peer_idx on public.visitors (last_peer);

create table if not exists public.visitor_days (
  day date not null,
  visitor_id uuid not null references public.visitors(id) on delete cascade,
  user_id uuid,
  minutes integer not null default 0,
  online_minutes integer not null default 0,
  primary key (day, visitor_id)
);
create index if not exists visitor_days_visitor_idx on public.visitor_days (visitor_id, day desc);

-- ===================== Cấm chơi trực tuyến =====================
create table if not exists public.bans (
  id bigint generated always as identity primary key,
  visitor_id uuid references public.visitors(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 200),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  lifted_at timestamptz,
  created_by uuid default auth.uid(),
  check (visitor_id is not null or user_id is not null)
);
create index if not exists bans_visitor_idx on public.bans (visitor_id);
create index if not exists bans_user_idx on public.bans (user_id);

-- ===================== Nhật ký lỗi client =====================
create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  count integer not null default 1,
  visitor_id uuid,
  user_id uuid,
  kind text not null check (kind in ('error', 'promise', 'ui', 'fatal', 'loop', 'online', 'ai', 'save', 'other')),
  message text not null check (char_length(message) <= 500),
  stack text not null default '' check (char_length(stack) <= 4000),
  fingerprint text not null check (char_length(fingerprint) <= 64),
  url text not null default '' check (char_length(url) <= 300),
  build text not null default '' check (char_length(build) <= 40),
  platform text not null default '' check (char_length(platform) <= 20),
  ua text not null default '' check (char_length(ua) <= 300),
  context jsonb not null default '{}' check (pg_column_size(context) <= 4096),
  resolved boolean not null default false
);
create index if not exists client_errors_created_idx on public.client_errors (created_at desc);
create index if not exists client_errors_fp_idx on public.client_errors (fingerprint, created_at desc);
create index if not exists client_errors_visitor_idx on public.client_errors (visitor_id, created_at desc);

-- ===================== Cấu hình (đọc công khai, admin ghi) =====================
create table if not exists public.app_config (
  key text primary key check (key in ('bots', 'online')),
  value jsonb not null default '{}' check (pg_column_size(value) <= 4096),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
insert into public.app_config (key, value) values
  ('bots', '{"enabled": true, "llm": true}'),
  ('online', '{"open": true, "cap": 50}')
on conflict (key) do nothing;

-- Ghi đè hồ sơ 10 bạn tù (mặc định nằm trong code: src/bots/personas.ts). Không có hàng = dùng mặc định.
create table if not exists public.bot_overrides (
  id text primary key check (id ~ '^b[0-9]{2}$'),
  enabled boolean,
  name text check (name is null or char_length(name) between 2 and 24),
  room text check (room is null or char_length(room) <= 40),
  sociable real check (sociable is null or sociable between 0 and 1),
  personality text check (personality is null or char_length(personality) <= 200),
  style text check (style is null or char_length(style) <= 200),
  background text check (background is null or char_length(background) <= 300),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

-- Thống kê câu trả lời của bạn tù (ghi từ /api/ai/bot)
create table if not exists public.bot_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  bot_id text not null check (bot_id ~ '^b[0-9]{2}$'),
  source text not null check (source in ('ai', 'fallback', 'guard')),
  model text not null default '' check (char_length(model) <= 60),
  latency_ms integer not null default 0
);
create index if not exists bot_events_created_idx on public.bot_events (created_at desc);

-- Báo cáo trò chuyện: thêm trạng thái xử lý
alter table public.chat_reports add column if not exists status text not null default 'open';
alter table public.chat_reports add column if not exists handled_at timestamptz;
alter table public.chat_reports add column if not exists handled_by uuid;
do $$ begin
  alter table public.chat_reports add constraint chat_reports_status_check check (status in ('open', 'resolved', 'dismissed'));
exception when duplicate_object then null; end $$;

-- ===================== RLS =====================
alter table public.visitors enable row level security;
alter table public.visitor_days enable row level security;
alter table public.bans enable row level security;
alter table public.client_errors enable row level security;
alter table public.app_config enable row level security;
alter table public.bot_overrides enable row level security;
alter table public.bot_events enable row level security;

revoke all on public.visitors, public.visitor_days, public.bans, public.client_errors, public.bot_events from anon;
revoke all on public.app_config, public.bot_overrides from anon;
grant select on public.app_config, public.bot_overrides to anon;
grant select, insert, update, delete on public.visitors, public.visitor_days, public.bans, public.client_errors, public.app_config, public.bot_overrides, public.bot_events to authenticated;

drop policy if exists visitors_admin on public.visitors;
create policy visitors_admin on public.visitors for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists visitor_days_admin on public.visitor_days;
create policy visitor_days_admin on public.visitor_days for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists bans_admin on public.bans;
create policy bans_admin on public.bans for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists client_errors_admin on public.client_errors;
create policy client_errors_admin on public.client_errors for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists bot_events_admin on public.bot_events;
create policy bot_events_admin on public.bot_events for select to authenticated using (public.is_admin());

drop policy if exists app_config_read on public.app_config;
create policy app_config_read on public.app_config for select to anon, authenticated using (true);
drop policy if exists app_config_admin on public.app_config;
create policy app_config_admin on public.app_config for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists bot_overrides_read on public.bot_overrides;
create policy bot_overrides_read on public.bot_overrides for select to anon, authenticated using (true);
drop policy if exists bot_overrides_admin on public.bot_overrides;
create policy bot_overrides_admin on public.bot_overrides for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, update on public.chat_reports to authenticated;
drop policy if exists chat_reports_admin_read on public.chat_reports;
create policy chat_reports_admin_read on public.chat_reports for select to authenticated using (public.is_admin());
drop policy if exists chat_reports_admin_update on public.chat_reports;
create policy chat_reports_admin_update on public.chat_reports for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists saves_admin_select on public.game_saves;
create policy saves_admin_select on public.game_saves for select to authenticated using (public.is_admin());

-- ===================== RPC cho client game =====================
-- Ghi nhận phiên chơi ('start') hoặc nhịp mỗi phút ('ping'); trả về trạng thái cấm chơi trực tuyến.
create or replace function public.track_visit(p_id uuid, p_event text, p_info jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_prev timestamptz;
  v_user uuid;
  v_mode text := case when p_info->>'mode' = 'online' then 'online' else 'offline' end;
  v_inc integer := 0;
  v_ban public.bans%rowtype;
begin
  if p_id is null or p_event not in ('start', 'ping') then raise exception 'BAD_REQUEST' using errcode = '22023'; end if;
  select last_seen, user_id into v_prev, v_user from public.visitors where id = p_id;
  -- tối đa 1 phút chơi cho mỗi nhịp ≥50 giây (không bơm số phút)
  if p_event = 'ping' and v_prev is not null and now() - v_prev >= interval '50 seconds' then v_inc := 1; end if;
  insert into public.visitors as v (id, user_id, name, platform, os, browser, build, last_peer, last_mode, sessions)
  values (p_id, v_uid, left(coalesce(p_info->>'name', ''), 40), left(coalesce(p_info->>'platform', ''), 20), left(coalesce(p_info->>'os', ''), 30),
          left(coalesce(p_info->>'browser', ''), 30), left(coalesce(p_info->>'build', ''), 40), left(coalesce(p_info->>'peer', ''), 64), v_mode,
          case when p_event = 'start' then 1 else 0 end)
  on conflict (id) do update set
    user_id = coalesce(v_uid, v.user_id),
    name = case when excluded.name <> '' then excluded.name else v.name end,
    platform = case when excluded.platform <> '' then excluded.platform else v.platform end,
    os = case when excluded.os <> '' then excluded.os else v.os end,
    browser = case when excluded.browser <> '' then excluded.browser else v.browser end,
    build = case when excluded.build <> '' then excluded.build else v.build end,
    last_peer = case when excluded.last_peer <> '' then excluded.last_peer else v.last_peer end,
    last_mode = excluded.last_mode,
    last_seen = now(),
    sessions = v.sessions + excluded.sessions,
    minutes = v.minutes + v_inc;
  v_user := coalesce(v_uid, v_user);
  insert into public.visitor_days as d (day, visitor_id, user_id, minutes, online_minutes)
  values (public.vn_day(now()), p_id, v_user, v_inc, case when v_mode = 'online' then v_inc else 0 end)
  on conflict (day, visitor_id) do update set
    user_id = coalesce(excluded.user_id, d.user_id),
    minutes = d.minutes + excluded.minutes,
    online_minutes = d.online_minutes + excluded.online_minutes;
  select * into v_ban from public.bans b
    where b.lifted_at is null and (b.expires_at is null or b.expires_at > now())
      and (b.visitor_id = p_id or (v_user is not null and b.user_id = v_user))
    order by b.created_at desc limit 1;
  if found then return jsonb_build_object('banned', true, 'reason', v_ban.reason, 'until', v_ban.expires_at); end if;
  return jsonb_build_object('banned', false);
end $$;
revoke all on function public.track_visit from public;
grant execute on function public.track_visit to anon, authenticated;

-- Ghi lỗi client: gộp lỗi trùng (cùng fingerprint, cùng máy, 30 phút) và giới hạn 60 bản ghi/giờ/máy.
create or replace function public.log_client_error(p_visitor uuid, p_kind text, p_message text, p_stack text, p_fingerprint text,
  p_url text default '', p_build text default '', p_platform text default '', p_ua text default '', p_context jsonb default '{}')
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id bigint;
begin
  if p_visitor is null or coalesce(p_message, '') = '' or coalesce(p_fingerprint, '') = '' then return; end if;
  select id into v_id from public.client_errors
    where visitor_id = p_visitor and fingerprint = left(p_fingerprint, 64) and last_at > now() - interval '30 minutes'
    order by id desc limit 1;
  if found then update public.client_errors set count = count + 1, last_at = now() where id = v_id; return; end if;
  if (select count(*) from public.client_errors where visitor_id = p_visitor and created_at > now() - interval '1 hour') >= 60 then return; end if;
  insert into public.client_errors (visitor_id, user_id, kind, message, stack, fingerprint, url, build, platform, ua, context)
  values (p_visitor, auth.uid(),
          case when p_kind in ('error', 'promise', 'ui', 'fatal', 'loop', 'online', 'ai', 'save') then p_kind else 'other' end,
          left(p_message, 500), left(coalesce(p_stack, ''), 4000), left(p_fingerprint, 64), left(coalesce(p_url, ''), 300),
          left(coalesce(p_build, ''), 40), left(coalesce(p_platform, ''), 20), left(coalesce(p_ua, ''), 300),
          case when pg_column_size(coalesce(p_context, '{}'::jsonb)) <= 4096 then coalesce(p_context, '{}'::jsonb) else '{}'::jsonb end);
  -- dọn lỗi cũ hơn 90 ngày (thỉnh thoảng)
  if random() < 0.01 then delete from public.client_errors where last_at < now() - interval '90 days'; end if;
end $$;
revoke all on function public.log_client_error from public;
grant execute on function public.log_client_error to anon, authenticated;

-- Ghi thống kê bạn tù (gọi từ server /api/ai/bot). Giới hạn tổng 1200 bản ghi/phút.
create or replace function public.log_bot_event(p_bot text, p_source text, p_model text default '', p_latency integer default 0)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_bot !~ '^b[0-9]{2}$' or p_source not in ('ai', 'fallback', 'guard') then return; end if;
  if (select count(*) from public.bot_events where created_at > now() - interval '1 minute') >= 1200 then return; end if;
  insert into public.bot_events (bot_id, source, model, latency_ms) values (p_bot, p_source, left(coalesce(p_model, ''), 60), greatest(0, least(coalesce(p_latency, 0), 600000)));
  if random() < 0.005 then delete from public.bot_events where created_at < now() - interval '180 days'; end if;
end $$;
revoke all on function public.log_bot_event from public;
grant execute on function public.log_bot_event to anon, authenticated;

-- ===================== RPC cho trang admin =====================
create or replace function public.admin_guard() returns void
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY' using errcode = '42501'; end if;
end $$;
revoke all on function public.admin_guard from public, anon;
grant execute on function public.admin_guard to authenticated;

-- Tổng quan + chuỗi theo ngày cho biểu đồ.
create or replace function public.admin_overview(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_days integer := greatest(7, least(coalesce(p_days, 30), 180));
  v_from date := public.vn_day(now()) - (v_days - 1);
  v_today date := public.vn_day(now());
  r jsonb;
begin
  perform public.admin_guard();
  with days as (select generate_series(v_from, v_today, interval '1 day')::date as day),
  act as (
    select day,
           count(distinct user_id) filter (where user_id is not null) as dau_accounts,
           count(distinct visitor_id) filter (where user_id is null) as dau_guests,
           coalesce(sum(minutes), 0) as minutes,
           coalesce(sum(online_minutes), 0) as online_minutes
    from public.visitor_days where day >= v_from group by day),
  new_acc as (select public.vn_day(created_at) as day, count(*) as n from auth.users where public.vn_day(created_at) >= v_from group by 1),
  new_guest as (select public.vn_day(first_seen) as day, count(*) as n from public.visitors where user_id is null and public.vn_day(first_seen) >= v_from group by 1),
  errs as (select public.vn_day(created_at) as day, sum(count) as n, count(distinct visitor_id) as users from public.client_errors where public.vn_day(created_at) >= v_from group by 1),
  reps as (select public.vn_day(created_at) as day, count(*) as n from public.chat_reports where public.vn_day(created_at) >= v_from group by 1),
  bots as (
    select public.vn_day(created_at) as day,
           count(*) filter (where source = 'ai') as ai,
           count(*) filter (where source = 'fallback') as fallback,
           count(*) filter (where source = 'guard') as guard
    from public.bot_events where public.vn_day(created_at) >= v_from group by 1)
  select jsonb_build_object(
    'days', v_days,
    'series', (select jsonb_agg(jsonb_build_object(
        'day', d.day,
        'dau_accounts', coalesce(a.dau_accounts, 0), 'dau_guests', coalesce(a.dau_guests, 0),
        'minutes', coalesce(a.minutes, 0), 'online_minutes', coalesce(a.online_minutes, 0),
        'new_accounts', coalesce(na.n, 0), 'new_guests', coalesce(ng.n, 0),
        'errors', coalesce(e.n, 0), 'error_users', coalesce(e.users, 0), 'reports', coalesce(rp.n, 0),
        'bot_ai', coalesce(b.ai, 0), 'bot_fallback', coalesce(b.fallback, 0), 'bot_guard', coalesce(b.guard, 0)
      ) order by d.day)
      from days d left join act a using (day) left join new_acc na using (day) left join new_guest ng using (day)
      left join errs e using (day) left join reps rp using (day) left join bots b using (day)),
    'totals', jsonb_build_object(
      'accounts', (select count(*) from auth.users),
      'guests', (select count(*) from public.visitors where user_id is null),
      'active_today', (select count(distinct coalesce(user_id::text, visitor_id::text)) from public.visitor_days where day = v_today),
      'active_7d', (select count(distinct coalesce(user_id::text, visitor_id::text)) from public.visitor_days where day > v_today - 7),
      'active_30d', (select count(distinct coalesce(user_id::text, visitor_id::text)) from public.visitor_days where day > v_today - 30),
      'minutes_today', (select coalesce(sum(minutes), 0) from public.visitor_days where day = v_today),
      'errors_open', (select count(distinct fingerprint) from public.client_errors where not resolved),
      'errors_24h', (select coalesce(sum(count), 0) from public.client_errors where last_at > now() - interval '24 hours'),
      'reports_open', (select count(*) from public.chat_reports where status = 'open'),
      'bans_active', (select count(*) from public.bans where lifted_at is null and (expires_at is null or expires_at > now())),
      'bot_replies_today', (select count(*) from public.bot_events where public.vn_day(created_at) = v_today)
    ),
    'platforms', (select coalesce(jsonb_agg(jsonb_build_object('key', k, 'n', n) order by n desc), '[]') from (
        select coalesce(nullif(platform, ''), 'không rõ') as k, count(*) as n from public.visitors where last_seen > now() - make_interval(days => v_days) group by 1) s),
    'browsers', (select coalesce(jsonb_agg(jsonb_build_object('key', k, 'n', n) order by n desc), '[]') from (
        select coalesce(nullif(browser, ''), 'không rõ') as k, count(*) as n from public.visitors where last_seen > now() - make_interval(days => v_days) group by 1 order by 2 desc limit 6) s),
    'bots', (select coalesce(jsonb_agg(jsonb_build_object('key', bot_id, 'n', n, 'ai', ai, 'avg_ms', avg_ms) order by n desc), '[]') from (
        select bot_id, count(*) as n, count(*) filter (where source = 'ai') as ai,
               round(avg(latency_ms) filter (where source = 'ai'))::int as avg_ms
        from public.bot_events where public.vn_day(created_at) >= v_from group by bot_id) s)
  ) into r;
  return r;
end $$;
revoke all on function public.admin_overview from public, anon;
grant execute on function public.admin_overview to authenticated;

-- Danh sách người chơi: tài khoản (gộp mọi thiết bị) + khách vãng lai (mỗi thiết bị).
create or replace function public.admin_users(p_search text default '', p_kind text default 'all', p_limit integer default 50, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_q text := '%' || lower(coalesce(trim(p_search), '')) || '%';
  r jsonb;
begin
  perform public.admin_guard();
  with base as (
    select 'account' as kind, u.id::text as key, u.id as user_id, null::uuid as visitor_id, u.email::text as email,
           coalesce((select v.name from public.visitors v where v.user_id = u.id and v.name <> '' order by v.last_seen desc limit 1), '') as name,
           coalesce((select v.platform from public.visitors v where v.user_id = u.id order by v.last_seen desc limit 1), '') as platform,
           coalesce((select array_agg(v.last_peer) from public.visitors v where v.user_id = u.id and v.last_peer <> ''), '{}') as peers,
           least(u.created_at, coalesce((select min(v.first_seen) from public.visitors v where v.user_id = u.id), u.created_at)) as first_seen,
           greatest(u.last_sign_in_at, (select max(v.last_seen) from public.visitors v where v.user_id = u.id)) as last_seen,
           coalesce((select sum(v.minutes) from public.visitors v where v.user_id = u.id), 0) as minutes,
           (select count(distinct d.day) from public.visitor_days d where d.user_id = u.id) as days,
           (select count(*) from public.visitors v where v.user_id = u.id) as devices,
           (select count(*) from public.client_errors e where e.user_id = u.id or e.visitor_id in (select v.id from public.visitors v where v.user_id = u.id)) as errors,
           (select count(*) from public.game_saves s where s.owner_id = u.id and s.is_head) as saves,
           exists (select 1 from public.bans b where b.lifted_at is null and (b.expires_at is null or b.expires_at > now())
                   and (b.user_id = u.id or b.visitor_id in (select v.id from public.visitors v where v.user_id = u.id))) as banned,
           exists (select 1 from public.admins a where a.user_id = u.id) as is_admin
    from auth.users u
    union all
    select 'guest', v.id::text, null, v.id, null, v.name, v.platform,
           case when v.last_peer <> '' then array[v.last_peer] else '{}' end,
           v.first_seen, v.last_seen, v.minutes,
           (select count(*) from public.visitor_days d where d.visitor_id = v.id), 1,
           (select count(*) from public.client_errors e where e.visitor_id = v.id), 0,
           exists (select 1 from public.bans b where b.lifted_at is null and (b.expires_at is null or b.expires_at > now()) and b.visitor_id = v.id),
           false
    from public.visitors v where v.user_id is null
  ), filtered as (
    select * from base
    where (p_kind = 'all' or (p_kind = 'accounts' and kind = 'account') or (p_kind = 'guests' and kind = 'guest') or (p_kind = 'banned' and banned))
      and (v_q = '%%' or lower(coalesce(email, '')) like v_q or lower(name) like v_q or key like v_q)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'rows', coalesce((select jsonb_agg(to_jsonb(f) order by f.last_seen desc nulls last) from (
        select * from filtered order by last_seen desc nulls last limit greatest(1, least(p_limit, 200)) offset greatest(0, p_offset)) f), '[]')
  ) into r;
  return r;
end $$;
revoke all on function public.admin_users from public, anon;
grant execute on function public.admin_users to authenticated;

-- Chi tiết một người chơi (p_user cho tài khoản, p_visitor cho khách).
create or replace function public.admin_user_detail(p_user uuid default null, p_visitor uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_ids uuid[];
  r jsonb;
begin
  perform public.admin_guard();
  if p_user is null and p_visitor is null then raise exception 'BAD_REQUEST' using errcode = '22023'; end if;
  select coalesce(array_agg(id), '{}') into v_ids from public.visitors where (p_user is not null and user_id = p_user) or (p_visitor is not null and id = p_visitor);
  select jsonb_build_object(
    'account', (select jsonb_build_object('id', u.id, 'email', u.email, 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at,
                 'is_admin', exists (select 1 from public.admins a where a.user_id = u.id)) from auth.users u where u.id = p_user),
    'devices', coalesce((select jsonb_agg(to_jsonb(v) order by v.last_seen desc) from public.visitors v where v.id = any (v_ids)), '[]'),
    'days', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'minutes', m, 'online_minutes', om) order by day) from (
        select day, sum(minutes) as m, sum(online_minutes) as om from public.visitor_days
        where visitor_id = any (v_ids) and day > public.vn_day(now()) - 30 group by day) s), '[]'),
    'saves', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'slot', s.slot, 'revision', s.revision, 'updated_at', s.updated_at,
                 'day', (s.meta->>'day')::int, 'zone', s.meta->>'zone', 'name', s.meta->>'name') order by s.updated_at desc)
               from public.game_saves s where p_user is not null and s.owner_id = p_user and s.is_head), '[]'),
    'errors', coalesce((select jsonb_agg(to_jsonb(e) order by e.last_at desc) from (
        select id, created_at, last_at, count, kind, message, fingerprint, build, platform, resolved from public.client_errors
        where visitor_id = any (v_ids) or (p_user is not null and user_id = p_user) order by last_at desc limit 30) e), '[]'),
    'bans', coalesce((select jsonb_agg(to_jsonb(b) order by b.created_at desc) from public.bans b
               where b.visitor_id = any (v_ids) or (p_user is not null and b.user_id = p_user)), '[]'),
    'reports', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at desc) from (
        select id, created_at, room, reported_name, reason, excerpt, status from public.chat_reports
        where reported_peer in (select last_peer from public.visitors where id = any (v_ids) and last_peer <> '') order by created_at desc limit 20) c), '[]')
  ) into r;
  return r;
end $$;
revoke all on function public.admin_user_detail from public, anon;
grant execute on function public.admin_user_detail to authenticated;

-- Lỗi gộp theo fingerprint.
create or replace function public.admin_error_groups(p_days integer default 7, p_status text default 'open', p_kind text default 'all', p_search text default '')
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_q text := '%' || lower(coalesce(trim(p_search), '')) || '%';
  r jsonb;
begin
  perform public.admin_guard();
  select coalesce(jsonb_agg(to_jsonb(g) order by g.last_at desc), '[]') into r from (
    select fingerprint, (array_agg(message order by last_at desc))[1] as message, (array_agg(kind order by last_at desc))[1] as kind,
           sum(count)::int as total, count(distinct visitor_id)::int as users, min(created_at) as first_at, max(last_at) as last_at,
           bool_and(resolved) as resolved, (array_agg(build order by last_at desc))[1] as build,
           array_agg(distinct platform) filter (where platform <> '') as platforms
    from public.client_errors
    where last_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 7), 90)))
      and (p_kind = 'all' or kind = p_kind)
      and (v_q = '%%' or lower(message) like v_q or lower(stack) like v_q)
    group by fingerprint
    having p_status = 'all' or (p_status = 'open' and not bool_and(resolved)) or (p_status = 'resolved' and bool_and(resolved))
    order by max(last_at) desc limit 200) g;
  return r;
end $$;
revoke all on function public.admin_error_groups from public, anon;
grant execute on function public.admin_error_groups to authenticated;

-- ===================== Gán quyền admin =====================
-- Đăng nhập trang /admin bằng email này ít nhất một lần (tạo tài khoản), rồi chạy lại dòng dưới nếu cần.
insert into public.admins (user_id)
select id from auth.users where lower(email) = lower('uongngocson25032003@gmail.com')
on conflict do nothing;
