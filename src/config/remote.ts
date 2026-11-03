// Cấu hình do admin chỉnh (Supabase: app_config + bot_overrides). Đọc qua REST bằng anon key — dùng được ở cả trình duyệt lẫn server.
import type { BotOverride } from '../bots/personas';
import { DEFAULT_CLOCK, validClock, type ClockConfig } from '../online/sharedClock.js';

export interface BotsConfig { enabled: boolean; llm: boolean }
export interface OnlineConfig { open: boolean; cap: number }
/** Đóng/mở trang web (bảo trì). */
export interface SiteConfig { open: boolean; title: string; message: string; reopenAt: string | null }
export const DEFAULT_SITE: SiteConfig = { open: true, title: 'Đang bảo trì', message: 'Đang nâng cấp trò chơi · tiến trình vẫn được giữ. Quay lại sau nhé.', reopenAt: null };
export function parseSite(v: unknown): SiteConfig {
  const o = (v ?? {}) as Record<string, unknown>;
  const str = (x: unknown, d: string, max: number) => (typeof x === 'string' && x.trim() ? x.trim().slice(0, max) : d);
  const at = typeof o.reopenAt === 'string' && !Number.isNaN(Date.parse(o.reopenAt)) ? o.reopenAt : null;
  return { open: o.open !== false, title: str(o.title, DEFAULT_SITE.title, 60), message: str(o.message, DEFAULT_SITE.message, 400), reopenAt: at };
}
export interface RemoteConfig { bots: BotsConfig; online: OnlineConfig; clock: ClockConfig; site: SiteConfig; overrides: BotOverride[]; loadedAt: number }

export const DEFAULT_CONFIG: RemoteConfig = { bots: { enabled: true, llm: true }, online: { open: true, cap: 50 }, clock: DEFAULT_CLOCK, site: DEFAULT_SITE, overrides: [], loadedAt: 0 };

export function parseConfig(rows: { key: string; value: unknown }[], overrides: BotOverride[], now = Date.now()): RemoteConfig {
  const get = (k: string) => (rows.find((r) => r.key === k)?.value ?? {}) as Record<string, unknown>;
  const b = get('bots'), o = get('online');
  const cap = Number(o.cap);
  return {
    bots: { enabled: b.enabled !== false, llm: b.llm !== false },
    online: { open: o.open !== false, cap: Number.isFinite(cap) && cap >= 1 ? Math.min(500, Math.floor(cap)) : DEFAULT_CONFIG.online.cap },
    site: parseSite(rows.find((r) => r.key === 'site')?.value),
    clock: rows.some((r) => r.key === 'clock') ? validClock(get('clock') as Partial<ClockConfig>) : DEFAULT_CLOCK,
    overrides: Array.isArray(overrides) ? overrides.filter((r) => r && /^b\d{2}$/.test(r.id)) : [],
    loadedAt: now,
  };
}

/** Lỗi mạng/chưa chạy migration → trả cấu hình mặc định (game không được hỏng vì trang admin). */
export async function fetchRemoteConfig(url: string, key: string, timeoutMs = 4000): Promise<RemoteConfig> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  try {
    const [a, b] = await Promise.all([
      fetch(`${url}/rest/v1/app_config?select=key,value`, { headers, signal: ctl.signal }),
      fetch(`${url}/rest/v1/bot_overrides?select=*`, { headers, signal: ctl.signal }),
    ]);
    if (!a.ok) return { ...DEFAULT_CONFIG, loadedAt: Date.now() };
    return parseConfig(await a.json(), b.ok ? await b.json() : []);
  } catch { return { ...DEFAULT_CONFIG, loadedAt: Date.now() }; }
  finally { clearTimeout(timer); }
}
