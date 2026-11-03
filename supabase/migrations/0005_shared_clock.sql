-- CR-TIME-01: đồng hồ chung cho chế độ trực tuyến. Chạy SAU 0004. Chạy lại được nhiều lần.
-- app_config.clock = { epochMs, dayLengthMin (24–120), version }. Admin sửa được; KHÔNG cho phép làm giờ chung lùi lại.
alter table public.app_config drop constraint if exists app_config_key_check;
alter table public.app_config add constraint app_config_key_check check (key in ('bots', 'online', 'clock'));

-- 00:00 giờ Việt Nam 01/01/2026, một ngày game = 48 phút thực
insert into public.app_config (key, value) values ('clock', '{"epochMs": 1767200400000, "dayLengthMin": 48, "version": 1}')
on conflict (key) do nothing;

create or replace function public.app_config_clock_guard() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare
  now_ms double precision := extract(epoch from clock_timestamp()) * 1000;
  len double precision;
  old_min double precision;
  new_min double precision;
begin
  if new.key <> 'clock' then return new; end if;
  len := (new.value->>'dayLengthMin')::double precision;
  if len is null or len < 24 or len > 120 or (new.value->>'epochMs') is null then
    raise exception 'CLOCK_INVALID' using errcode = '22023', hint = 'dayLengthMin phải trong 24–120 và có epochMs.';
  end if;
  if tg_op = 'UPDATE' then
    old_min := (now_ms - (old.value->>'epochMs')::double precision) / 1000 * 1440 / ((old.value->>'dayLengthMin')::double precision * 60);
    new_min := (now_ms - (new.value->>'epochMs')::double precision) / 1000 * 1440 / (len * 60);
    if new_min < old_min - 1 then
      raise exception 'CLOCK_BACKWARD' using errcode = '22023', hint = 'Giờ chung chỉ được tiến, không được lùi.';
    end if;
    new.value := jsonb_set(new.value, '{version}', to_jsonb(coalesce((old.value->>'version')::int, 1) + 1));
  end if;
  return new;
end $$;

drop trigger if exists app_config_clock_guard on public.app_config;
create trigger app_config_clock_guard before insert or update on public.app_config
  for each row execute function public.app_config_clock_guard();
