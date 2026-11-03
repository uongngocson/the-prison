-- Chế độ Trực tuyến: báo cáo người chơi vi phạm khi trò chuyện.
-- Trò chuyện và vị trí đi qua Supabase Realtime (Broadcast/Presence), KHÔNG lưu vào database.
-- Bảng này chỉ nhận báo cáo; người chơi không đọc được báo cáo của nhau (không có policy SELECT).
create table if not exists public.chat_reports (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  room text not null check (char_length(room) between 1 and 40),
  reported_peer text not null check (char_length(reported_peer) between 1 and 64),
  reported_name text not null default '' check (char_length(reported_name) <= 40),
  reason text not null check (char_length(reason) between 1 and 200),
  excerpt text not null default '' check (char_length(excerpt) <= 800),
  reporter_peer text not null check (char_length(reporter_peer) between 1 and 64),
  reporter_user uuid default auth.uid()
);
alter table public.chat_reports enable row level security;

drop policy if exists "chat_reports_insert" on public.chat_reports;
create policy "chat_reports_insert" on public.chat_reports
  for insert to anon, authenticated
  with check (reporter_user is null or reporter_user = auth.uid());

revoke all on public.chat_reports from anon, authenticated;
grant insert (room, reported_peer, reported_name, reason, excerpt, reporter_peer) on public.chat_reports to anon, authenticated;
create index if not exists chat_reports_created_idx on public.chat_reports (created_at desc);
