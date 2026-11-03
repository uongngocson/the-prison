// Vercel Function: POST /api/ai/bot — câu trả lời của bạn tù AI.
// Server dựng system prompt từ persona (client không gửi được prompt tùy ý), lọc prompt-injection đầu vào và nội dung đầu ra.
import { ai, injectionScore } from '../../src/ai/server.js';
import { AIError } from '../../src/ai/types.js';
import { applyBotOverrides, PERSONA_BY_ID } from '../../src/bots/personas.js';
import { DEFAULT_CONFIG, fetchRemoteConfig, type RemoteConfig } from '../../src/config/remote.js';
import { buildSystemPrompt, cleanReply, fallbackLine, toMessages, validBotClock, type Turn } from '../../src/bots/prompt.js';
import { sanitize, sanitizeName } from '../../src/online/protocol.js';

const env = () => (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
const hasKey = () => !!env().GROQ_API_KEY;
const sbUrl = () => env().SUPABASE_URL ?? env().VITE_SUPABASE_URL;
const sbKey = () => env().SUPABASE_ANON_KEY ?? env().VITE_SUPABASE_ANON_KEY;

// Cấu hình admin (bật/tắt bạn tù, bật/tắt AI, hồ sơ ghi đè) — lưu đệm 30 s mỗi instance.
let cfg: RemoteConfig = DEFAULT_CONFIG;
async function remoteConfig(): Promise<RemoteConfig> {
  const url = sbUrl(), key = sbKey();
  if (!url || !key || Date.now() - cfg.loadedAt < 30_000) return cfg;
  cfg = await fetchRemoteConfig(url, key, 1500);
  applyBotOverrides(cfg.overrides);
  return cfg;
}
/** Thống kê cho trang admin (không chặn câu trả lời quá 800 ms). */
async function logEvent(bot: string, source: string, model = '', latency = 0) {
  const url = sbUrl(), key = sbKey();
  if (!url || !key) return;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 800);
  try {
    await fetch(`${url}/rest/v1/rpc/log_bot_event`, { method: 'POST', signal: ctl.signal, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_bot: bot, p_source: source, p_model: model, p_latency: Math.round(latency) }) });
  } catch { /* bỏ qua */ } finally { clearTimeout(t); }
}
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

const hits = new Map<string, number[]>();
function allow(ip: string, perMin = 40): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (arr.length >= perMin) return false;
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return true;
}
const DEFLECT = ['thôi nói chuyện khác đi', 'haha ông nói gì vậy, tui hông hiểu', 'chuyện đó bỏ qua đi, nay ăn gì rồi?'];

export async function POST(request: Request): Promise<Response> {
  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'local';
  if (!allow(ip)) return json({ error: 'busy' }, 429);
  const b = await request.json().catch(() => null) as { botId?: string; player?: string; message?: string; history?: Turn[]; clock?: unknown } | null;
  const conf = await remoteConfig();
  const p = b?.botId ? PERSONA_BY_ID[b.botId] : undefined;
  const message = sanitize(String(b?.message ?? ''));
  if (!p || !p.enabled || !conf.bots.enabled || !message) return json({ error: 'bad_request' }, 400);
  const history = (Array.isArray(b?.history) ? b!.history : []).filter((t) => t && (t.from === 'player' || t.from === 'bot') && typeof t.text === 'string').slice(-10).map((t) => ({ from: t.from, text: sanitize(t.text) }));
  const seed = Date.now() % 97;
  const reply = async (text: string, source: 'ai' | 'fallback' | 'guard', model = '', ms = 0, extra: Record<string, unknown> = {}) => {
    await logEvent(p.id, source, model, ms);
    return json({ text, source, ...extra });
  };
  if (!hasKey() || !conf.bots.llm) return reply(fallbackLine(p, seed), 'fallback');
  // 1) chặn prompt-injection (lỗi bộ lọc → không chặn)
  const score = await injectionScore(message);
  if (score !== null && score > 0.9) return reply(DEFLECT[seed % DEFLECT.length], 'guard');
  // 2) sinh câu trả lời theo nhân vật
  try {
    const r = await ai().chat({ messages: toMessages(buildSystemPrompt(p, sanitizeName(String(b?.player ?? 'bạn')), validBotClock(b?.clock)), history, message), capability: 'chat', prefer: 'qwen/qwen3.8-27b', maxTokens: 160, temperature: 0.85 });
    const text = sanitize(cleanReply(r.text, p));
    return reply(text || fallbackLine(p, seed), text ? 'ai' : 'fallback', r.model, r.latencyMs);
  } catch (e) {
    const kind = e instanceof AIError ? e.kind : 'unknown';
    return reply(fallbackLine(p, seed), 'fallback', '', 0, { kind });
  }
}
