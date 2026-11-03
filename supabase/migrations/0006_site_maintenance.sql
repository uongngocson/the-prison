-- Đóng/mở trang web (bảo trì). Chạy SAU 0005. Chạy lại được nhiều lần.
-- app_config.site = { open, title, message, reopenAt }. Đọc công khai; chỉ admin sửa (policy app_config_admin từ 0004).
alter table public.app_config drop constraint if exists app_config_key_check;
alter table public.app_config add constraint app_config_key_check check (key in ('bots', 'online', 'clock', 'site'));

insert into public.app_config (key, value) values
  ('site', '{"open": true, "title": "Đang bảo trì", "message": "Chúng tôi đang nâng cấp trò chơi. Tiến trình của bạn vẫn được giữ nguyên. Vui lòng quay lại sau.", "reopenAt": null}')
on conflict (key) do nothing;
