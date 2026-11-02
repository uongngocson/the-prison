-- CR-VN-01: save schema v3 (experienceMode + custody aggregates DB45–50 trong snapshot).
-- Chạy trên Supabase TRƯỚC khi deploy bản client lưu schema v3; nếu không, upload cloud của save v3 bị từ chối (check constraint).
alter table public.game_saves drop constraint if exists game_saves_schema_version_check;
alter table public.game_saves add constraint game_saves_schema_version_check check (schema_version between 1 and 3);
