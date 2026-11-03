// Vercel Function: POST /api/ai/bot — câu trả lời của bạn tù AI.
// Server dựng system prompt từ persona (client không gửi được prompt tùy ý), lọc prompt-injection đầu vào và nội dung đầu ra.
import { ai, injectionScore } from '../../src/ai/server.js';
import { AIError } from '../../src/ai/types.js';
import { PERSONA_BY_ID } from '../../src/bots/personas.js';
import { buildSystemPrompt, cleanReply, fallbackLine, toMessages, type Turn } from '../../src/bots/prompt.js';
import { sanitize, sanitizeName } from '../../src/online/protocol.js';

const hasKey = () => !!(globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.GROQ_API_KEY;
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
  const b = await request.json().catch(() => null) as { botId?: string; player?: string; message?: string; history?: Turn[] } | null;
  const p = b?.botId ? PERSONA_BY_ID[b.botId] : undefined;
  const message = sanitize(String(b?.message ?? ''));
  if (!p || !p.enabled || !message) return json({ error: 'bad_request' }, 400);
  const history = (Array.isArray(b?.history) ? b!.history : []).filter((t) => t && (t.from === 'player' || t.from === 'bot') && typeof t.text === 'string').slice(-10).map((t) => ({ from: t.from, text: sanitize(t.text) }));
  const seed = Date.now() % 97;
  if (!hasKey()) return json({ text: fallbackLine(p, seed), source: 'fallback' });
  // 1) chặn prompt-injection (lỗi bộ lọc → không chặn)
  const score = await injectionScore(message);
  if (score !== null && score > 0.9) return json({ text: DEFLECT[seed % DEFLECT.length], source: 'guard' });
  // 2) sinh câu trả lời theo nhân vật
  try {
    const r = await ai().chat({ messages: toMessages(buildSystemPrompt(p, sanitizeName(String(b?.player ?? 'bạn'))), history, message), capability: 'chat', prefer: 'qwen/qwen3.8-27b', maxTokens: 160, temperature: 0.85 });
    const text = sanitize(cleanReply(r.text, p));
    return json({ text: text || fallbackLine(p, seed), source: text ? 'ai' : 'fallback' });
  } catch (e) {
    const kind = e instanceof AIError ? e.kind : 'unknown';
    return json({ text: fallbackLine(p, seed), source: 'fallback', kind });
  }
}
