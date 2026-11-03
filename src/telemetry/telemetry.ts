// Theo dõi người chơi (kể cả khách vãng lai) + nhật ký lỗi → Supabase (RPC track_visit / log_client_error).
// Chỉ gửi dữ liệu kỹ thuật tối thiểu: mã trình duyệt ngẫu nhiên, tên nhân vật, loại thiết bị, số phút chơi, lỗi.
// Mọi lỗi mạng ở đây đều bị nuốt: telemetry không bao giờ được làm hỏng trò chơi.
import { create } from 'zustand';
import { version } from '../../package.json';
import { cloud } from '../persistence/cloud';
import { useDevice } from '../ui/device';
import { useUI } from '../ui/store';
import { fingerprint, ignorable, parseUA } from './fingerprint';
export { fingerprint, ignorable, parseUA };

export type ErrorKind = 'error' | 'promise' | 'ui' | 'fatal' | 'loop' | 'online' | 'ai' | 'save' | 'other';
export interface BanState { banned: boolean; reason: string; until: string | null }
export const useBan = create<BanState>(() => ({ banned: false, reason: '', until: null }));

const VISITOR_KEY = 'mnm.visitorId';
const PING_MS = 60_000;
const MAX_ERRORS_PER_SESSION = 40;

let visitor: string | null = null;
export function visitorId(): string {
  if (visitor) return visitor;
  try {
    visitor = localStorage.getItem(VISITOR_KEY);
    if (!visitor || !/^[0-9a-f-]{36}$/.test(visitor)) { visitor = crypto.randomUUID(); localStorage.setItem(VISITOR_KEY, visitor); }
  } catch { visitor ??= crypto.randomUUID(); }
  return visitor;
}

/** Ngữ cảnh hiện tại (controller cung cấp — tránh import vòng). */
export interface PlayContext { name: string; mode: 'offline' | 'online'; peer: string }
let context: () => PlayContext = () => ({ name: '', mode: 'offline', peer: '' });
export function setPlayContext(fn: () => PlayContext) { context = fn; }
let onBanChange: ((b: BanState) => void) | null = null;
export function onBan(fn: (b: BanState) => void) { onBanChange = fn; }

const sentAt = new Map<string, number>();
let sentCount = 0;
const backlog: (() => Promise<void>)[] = [];
let ready = false;

async function rpc(fn: string, args: Record<string, unknown>): Promise<unknown> {
  const c = await cloud.sb();
  const { data, error } = await c.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}

/** Ghi một lỗi (gộp trùng: mỗi dấu vân tay tối đa 1 lần/phút từ máy này). */
export function reportError(kind: ErrorKind, err: unknown, extra: Record<string, unknown> = {}) {
  try {
    if (!cloud.configured()) return;
    const e = err instanceof Error ? err : new Error(typeof err === 'string' ? err : JSON.stringify(err ?? 'unknown')?.slice(0, 300));
    const message = `${e.name && e.name !== 'Error' ? e.name + ': ' : ''}${e.message || 'Lỗi không rõ'}`.slice(0, 500);
    if (ignorable(message)) return;
    const stack = (e.stack ?? '').slice(0, 4000);
    const fp = fingerprint(kind, message, stack);
    const now = Date.now();
    if ((sentAt.get(fp) ?? 0) > now - 60_000 || sentCount >= MAX_ERRORS_PER_SESSION) return;
    sentAt.set(fp, now); sentCount++;
    const ui = useUI.getState();
    const ctx = { ...extra, screen: ui.screen, overlay: ui.overlay, mode: context().mode, w: innerWidth, h: innerHeight };
    const send = async () => {
      await rpc('log_client_error', {
        p_visitor: visitorId(), p_kind: kind, p_message: message, p_stack: stack, p_fingerprint: fp,
        p_url: location.pathname.slice(0, 300), p_build: version, p_platform: useDevice.getState().form, p_ua: navigator.userAgent.slice(0, 300), p_context: ctx,
      }).catch(() => undefined);
    };
    if (ready) void send(); else if (backlog.length < 10) backlog.push(send);
  } catch { /* không bao giờ ném lỗi từ bộ ghi lỗi */ }
}

async function track(event: 'start' | 'ping') {
  if (!cloud.configured()) return;
  const c = context();
  const { os, browser } = parseUA(navigator.userAgent);
  try {
    const r = await rpc('track_visit', { p_id: visitorId(), p_event: event, p_info: { name: c.name, mode: c.mode, peer: c.peer, platform: useDevice.getState().form, os, browser, build: version } }) as { banned?: boolean; reason?: string; until?: string | null } | null;
    const next: BanState = { banned: !!r?.banned, reason: r?.reason ?? '', until: r?.until ?? null };
    const prev = useBan.getState();
    if (next.banned !== prev.banned || next.reason !== prev.reason) { useBan.setState(next); onBanChange?.(next); }
  } catch { /* chưa chạy migration 0004 hoặc mất mạng */ }
}

/** Kiểm tra cấm ngay (trước khi vào phòng trực tuyến). */
export async function checkBan(): Promise<BanState> { await track('ping'); return useBan.getState(); }

let started = false;
export function startTelemetry() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('error', (e) => {
    if (ignorable(e.message ?? '', e.filename)) return;
    if (e.filename && !e.filename.startsWith(location.origin)) return; // script bên ngoài (tiện ích, quảng cáo)
    reportError('error', e.error ?? new Error(e.message), { src: e.filename?.replace(location.origin, ''), line: e.lineno, col: e.colno });
  });
  window.addEventListener('unhandledrejection', (e) => reportError('promise', e.reason));
  useUI.subscribe((u, prev) => { if (u.fatal && u.fatal !== prev.fatal) reportError('fatal', new Error(u.fatal.message), { code: u.fatal.code, title: u.fatal.title }); });
  // để trang tải xong trước khi mở kết nối Supabase
  setTimeout(() => {
    void track('start').finally(() => { ready = true; for (const f of backlog.splice(0)) void f(); });
    setInterval(() => { if (document.visibilityState === 'visible') void track('ping'); }, PING_MS);
  }, 2500);
}
