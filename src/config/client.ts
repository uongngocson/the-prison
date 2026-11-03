// Cấu hình từ xa phía trình duyệt: tải một lần, làm mới tối đa mỗi 60 s; áp ghi đè bạn tù vào PERSONAS.
import { applyBotOverrides, PERSONAS } from '../bots/personas';
import { DEFAULT_CONFIG, fetchRemoteConfig, type RemoteConfig } from './remote';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
let current: RemoteConfig = DEFAULT_CONFIG;
let inflight: Promise<RemoteConfig> | null = null;

export const config = () => current;
export async function refreshConfig(maxAgeMs = 60_000): Promise<RemoteConfig> {
  if (!URL || !KEY) return current;
  if (Date.now() - current.loadedAt < maxAgeMs) return current;
  inflight ??= fetchRemoteConfig(URL, KEY).then((c) => { current = c; applyBotOverrides(c.overrides); return c; }).finally(() => { inflight = null; });
  return inflight;
}
/** Số bạn tù đang hoạt động (cộng vào số người trực tuyến hiển thị). */
export const activeBotCount = () => (current.bots.enabled ? PERSONAS.filter((p) => p.enabled).length : 0);
