// Lớp dữ liệu của trang admin — mọi truy vấn đi qua Supabase (RLS: chỉ tài khoản trong bảng admins đọc/ghi được).
import type { SupabaseClient } from '@supabase/supabase-js';
import { cloud } from '../persistence/cloud';
import type { BotOverride } from '../bots/personas';

export const sb = (): Promise<SupabaseClient> => cloud.sb();

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await (await sb()).rpc(fn, args);
  if (error) throw new Error(friendly(error.message));
  return data as T;
}
function friendly(m: string): string {
  if (/ADMIN_ONLY/.test(m)) return 'Tài khoản này không có quyền admin.';
  if (/CLOCK_BACKWARD/.test(m)) return 'Giờ chung chỉ được tiến, không được lùi.';
  if (/CLOCK_INVALID/.test(m)) return 'Độ dài ngày phải trong 24–120 phút thực.';
  if (/app_config_key_check/.test(m)) return 'Chưa chạy migration mới (0005_shared_clock.sql, 0006_site_maintenance.sql) trên Supabase.';
  if (/Could not find the function|does not exist/.test(m)) return 'Chưa chạy migration 0004_admin.sql trên Supabase.';
  return m;
}
async function q<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(friendly(error.message));
  return data as T;
}

// ---------- Kiểu dữ liệu ----------
export interface DayPoint {
  day: string; dau_accounts: number; dau_guests: number; minutes: number; online_minutes: number; new_accounts: number; new_guests: number;
  errors: number; error_users: number; reports: number; bot_ai: number; bot_fallback: number; bot_guard: number;
}
export interface Overview {
  days: number; series: DayPoint[];
  totals: { accounts: number; guests: number; active_today: number; active_7d: number; active_30d: number; minutes_today: number; errors_open: number; errors_24h: number; reports_open: number; bans_active: number; bot_replies_today: number };
  platforms: { key: string; n: number }[]; browsers: { key: string; n: number }[];
  bots: { key: string; n: number; ai: number; avg_ms: number | null }[];
}
export interface UserRow {
  kind: 'account' | 'guest'; key: string; user_id: string | null; visitor_id: string | null; email: string | null; name: string; platform: string; peers: string[];
  first_seen: string; last_seen: string | null; minutes: number; days: number; devices: number; errors: number; saves: number; banned: boolean; is_admin: boolean;
}
export interface Visitor { id: string; user_id: string | null; name: string; platform: string; os: string; browser: string; build: string; last_peer: string; last_mode: string; first_seen: string; last_seen: string; sessions: number; minutes: number }
export interface Ban { id: number; visitor_id: string | null; user_id: string | null; reason: string; created_at: string; expires_at: string | null; lifted_at: string | null }
export interface ErrorRow { id: number; created_at: string; last_at: string; count: number; visitor_id: string | null; user_id: string | null; kind: string; message: string; stack: string; fingerprint: string; url: string; build: string; platform: string; ua: string; context: Record<string, unknown>; resolved: boolean }
export interface UserDetail {
  account: { id: string; email: string; created_at: string; last_sign_in_at: string | null; is_admin: boolean } | null;
  devices: Visitor[]; days: { day: string; minutes: number; online_minutes: number }[];
  saves: { id: string; slot: number; revision: number; updated_at: string; day: number | null; zone: string | null; name: string | null }[];
  errors: Pick<ErrorRow, 'id' | 'created_at' | 'last_at' | 'count' | 'kind' | 'message' | 'fingerprint' | 'build' | 'platform' | 'resolved'>[];
  bans: Ban[]; reports: Pick<Report, 'id' | 'created_at' | 'room' | 'reported_name' | 'reason' | 'excerpt' | 'status'>[];
}
export interface ErrorGroup { fingerprint: string; message: string; kind: string; total: number; users: number; first_at: string; last_at: string; resolved: boolean; build: string; platforms: string[] | null }
export interface Report { id: number; created_at: string; room: string; reported_peer: string; reported_name: string; reason: string; excerpt: string; reporter_peer: string; status: 'open' | 'resolved' | 'dismissed'; handled_at: string | null }

// ---------- Phiên đăng nhập ----------
export async function session(): Promise<{ id: string; email: string } | null> {
  const { data } = await (await sb()).auth.getSession();
  return data.session ? { id: data.session.user.id, email: data.session.user.email ?? '' } : null;
}
export const isAdmin = () => rpc<boolean>('is_admin');
export const signIn = (email: string) => cloud.signIn(email, '/admin');
export const signOut = () => cloud.signOut();
/** Đăng nhập bằng mật khẩu — không gửi email nên không bị giới hạn email của Supabase. */
export async function signInPassword(email: string, password: string): Promise<{ ok: boolean; message: string }> {
  try {
    const { error } = await (await sb()).auth.signInWithPassword({ email: email.trim(), password });
    if (!error) return { ok: true, message: '' };
    if (error.status === 429) return { ok: false, message: 'Thử sai quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.' };
    if (/invalid login credentials/i.test(error.message)) return { ok: false, message: 'Email hoặc mật khẩu không đúng (hoặc tài khoản chưa được đặt mật khẩu).' };
    if (/email not confirmed/i.test(error.message)) return { ok: false, message: 'Email chưa được xác nhận. Xác nhận tài khoản trong Supabase → Authentication → Users.' };
    return { ok: false, message: error.message };
  } catch (e) { return { ok: false, message: (e as Error).message }; }
}
export async function changePassword(password: string) {
  const { error } = await (await sb()).auth.updateUser({ password });
  if (error) throw new Error(/same/i.test(error.message) ? 'Mật khẩu mới phải khác mật khẩu cũ.' : /weak|at least/i.test(error.message) ? 'Mật khẩu quá yếu: tối thiểu 8 ký tự, nên có chữ và số.' : /reauthenticat/i.test(error.message) ? 'Supabase yêu cầu đăng nhập lại trước khi đổi mật khẩu.' : error.message);
}

// ---------- Tổng quan / người chơi ----------
export const overview = (days: number) => rpc<Overview>('admin_overview', { p_days: days });
export const users = (search: string, kind: string, limit: number, offset: number) => rpc<{ total: number; rows: UserRow[] }>('admin_users', { p_search: search, p_kind: kind, p_limit: limit, p_offset: offset });
export const userDetail = (userId: string | null, visitorId: string | null) => rpc<UserDetail>('admin_user_detail', { p_user: userId, p_visitor: visitorId });
export async function visitorByPeer(peer: string): Promise<Visitor | null> {
  const rows = await q<Visitor[]>((await sb()).from('visitors').select('*').eq('last_peer', peer).order('last_seen', { ascending: false }).limit(1));
  return rows[0] ?? null;
}
export async function ban(target: { userId?: string | null; visitorId?: string | null }, reason: string, hours: number | null) {
  await q((await sb()).from('bans').insert({ user_id: target.userId ?? null, visitor_id: target.userId ? null : target.visitorId ?? null, reason, expires_at: hours ? new Date(Date.now() + hours * 3600_000).toISOString() : null }));
}
export async function liftBan(id: number) { await q((await sb()).from('bans').update({ lifted_at: new Date().toISOString() }).eq('id', id)); }
export async function deleteGuest(visitorId: string) { await q((await sb()).from('visitors').delete().eq('id', visitorId).is('user_id', null)); }

// ---------- Lỗi ----------
export const errorGroups = (days: number, status: string, kind: string, search: string) => rpc<ErrorGroup[]>('admin_error_groups', { p_days: days, p_status: status, p_kind: kind, p_search: search });
export async function errorsOf(fp: string): Promise<ErrorRow[]> {
  return q<ErrorRow[]>((await sb()).from('client_errors').select('*').eq('fingerprint', fp).order('last_at', { ascending: false }).limit(50));
}
export async function setResolved(fp: string, resolved: boolean) { await q((await sb()).from('client_errors').update({ resolved }).eq('fingerprint', fp)); }
export async function deleteErrors(fp: string) { await q((await sb()).from('client_errors').delete().eq('fingerprint', fp)); }

// ---------- Báo cáo ----------
export async function reports(status: string): Promise<Report[]> {
  let b = (await sb()).from('chat_reports').select('*').order('created_at', { ascending: false }).limit(200);
  if (status !== 'all') b = b.eq('status', status);
  return q<Report[]>(b);
}
export async function setReport(id: number, status: Report['status']) {
  const me = await session();
  await q((await sb()).from('chat_reports').update({ status, handled_at: status === 'open' ? null : new Date().toISOString(), handled_by: status === 'open' ? null : me?.id ?? null }).eq('id', id));
}

// ---------- Cấu hình / bạn tù ----------
export async function configRows(): Promise<{ key: string; value: Record<string, unknown>; updated_at: string }[]> {
  return q((await sb()).from('app_config').select('key,value,updated_at'));
}
export async function saveConfig(key: 'bots' | 'online' | 'clock' | 'site', value: Record<string, unknown>) {
  const me = await session();
  const rows = await q<{ key: string }[]>((await sb()).from('app_config').update({ value, updated_at: new Date().toISOString(), updated_by: me?.id ?? null }).eq('key', key).select('key'));
  if (!rows.length) throw new Error('Không lưu được cấu hình: kiểm tra quyền admin và đã chạy đủ migration 0004–0006 trên Supabase.');
}
export async function botOverrides(): Promise<(BotOverride & { updated_at: string })[]> { return q((await sb()).from('bot_overrides').select('*')); }
export async function saveBot(o: BotOverride) {
  const me = await session();
  await q((await sb()).from('bot_overrides').upsert({ ...o, updated_at: new Date().toISOString(), updated_by: me?.id ?? null }));
}
export async function resetBot(id: string) { await q((await sb()).from('bot_overrides').delete().eq('id', id)); }

/** Sức khỏe các model AI (endpoint công khai của game). */
export async function aiStatus(): Promise<{ ok: boolean; error?: string; models?: { id: string; capabilities: string[]; breaker: { state: string; failures: number; openUntil: number }; avgMs: number | null; ok: number; fail: number; remainingTokens?: number }[] }> {
  try { const r = await fetch('/api/ai/chat', { cache: 'no-store' }); return await r.json(); }
  catch (e) { return { ok: false, error: (e as Error).message }; }
}
