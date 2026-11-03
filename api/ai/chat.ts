// Vercel Function: POST /api/ai/chat — gateway AI dùng chung cho mọi tính năng.
// API key chỉ nằm ở biến môi trường server GROQ_API_KEY (không bao giờ gửi về trình duyệt).
// GET /api/ai/chat → trạng thái mạch từng model (không lộ key).
import { ai, validateChatRequest } from '../../src/ai/server.js';
import { AIError } from '../../src/ai/types.js';

const hasKey = () => !!(globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.GROQ_API_KEY;

// Giới hạn đơn giản theo IP (trong một instance; chặn spam, không thay thế WAF).
const hits = new Map<string, number[]>();
function allow(ip: string, perMin = 20): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (arr.length >= perMin) { hits.set(ip, arr); return false; }
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return true;
}
const json = (data: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra } });

export async function GET(): Promise<Response> {
  if (!hasKey()) return json({ ok: false, error: 'AI chưa được cấu hình.' }, 503);
  return json({ ok: true, models: ai().status() });
}

export async function POST(request: Request): Promise<Response> {
  if (!hasKey()) return json({ error: 'AI chưa được cấu hình.' }, 503);
  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'local';
  if (!allow(ip)) return json({ error: 'Bạn gửi quá nhanh, thử lại sau ít giây.' }, 429, { 'Retry-After': '10' });
  const raw = await request.json().catch(() => null);
  const v = validateChatRequest(raw);
  if (!v.ok) return json({ error: v.error }, 400);
  try {
    const r = await ai().chat(v.req);
    return json({ text: r.text, model: r.model, usage: r.usage, latencyMs: r.latencyMs, failovers: r.attempts.filter((a) => !a.ok && !a.skipped).length });
  } catch (e) {
    const err = e instanceof AIError ? e : new AIError('all_failed', 'Lỗi không xác định.');
    const status = err.kind === 'bad_request' ? 400 : err.kind === 'auth' ? 502 : 503;
    const headers: Record<string, string> = err.retryAfterMs ? { 'Retry-After': String(Math.ceil(err.retryAfterMs / 1000)) } : {};
    return json({ error: err.kind === 'bad_request' ? err.message : 'AI tạm thời bận. Vui lòng thử lại sau.', kind: err.kind, retryAfterMs: err.retryAfterMs }, status, headers);
  }
}
