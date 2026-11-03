// Điểm vào phía SERVER: một router dùng chung cho mọi tính năng (giữ trạng thái mạch giữa các lời gọi trong cùng instance).
// Dùng: import { ai } from '../src/ai/server'; await ai().chat({ messages: [...] })
import { GROQ_MODELS } from './models.js';
import { GroqProvider } from './providers/groq.js';
import { ModelRouter } from './router.js';
import type { ChatRequest } from './types';

let router: ModelRouter | null = null;
export function ai(): ModelRouter {
  if (!router) {
    const key = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.GROQ_API_KEY ?? '';
    router = new ModelRouter(new GroqProvider(key), GROQ_MODELS, {
      onAttempt: (t) => { if (!t.ok) console.warn(`[ai] ${t.model} ${t.skipped ?? t.error}${t.status ? ` (${t.status})` : ''}`); },
    });
  }
  return router;
}

/** Điểm prompt-injection 0…1 (cao = nghi tấn công). Lỗi → null (không chặn người dùng chỉ vì bộ lọc hỏng). */
export async function injectionScore(text: string): Promise<number | null> {
  try {
    const r = await ai().chat({ capability: 'guard', messages: [{ role: 'user', content: text.slice(0, 1800) }], maxTokens: 8, temperature: 0 });
    const n = Number(r.text);
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}

// ---------- Kiểm tra đầu vào cho endpoint HTTP ----------
export const LIMITS = { maxMessages: 24, maxChars: 8000, maxTokens: 1024 };
export function validateChatRequest(raw: unknown): { ok: true; req: ChatRequest } | { ok: false; error: string } {
  const b = raw as Partial<ChatRequest> | null;
  if (!b || !Array.isArray(b.messages) || !b.messages.length) return { ok: false, error: 'messages bắt buộc.' };
  if (b.messages.length > LIMITS.maxMessages) return { ok: false, error: `Tối đa ${LIMITS.maxMessages} tin.` };
  let chars = 0;
  for (const m of b.messages) {
    if (!m || !['system', 'user', 'assistant'].includes(m.role) || typeof m.content !== 'string') return { ok: false, error: 'Tin nhắn không hợp lệ.' };
    chars += m.content.length;
  }
  if (chars > LIMITS.maxChars) return { ok: false, error: `Nội dung quá dài (tối đa ${LIMITS.maxChars} ký tự).` };
  const cap = b.capability ?? 'chat';
  if (!['chat', 'fast', 'reasoning'].includes(cap)) return { ok: false, error: 'capability không hợp lệ.' };
  return { ok: true, req: { messages: b.messages, capability: cap, maxTokens: Math.min(LIMITS.maxTokens, Math.max(16, Number(b.maxTokens) || 512)), temperature: Math.min(1.5, Math.max(0, Number(b.temperature ?? 0.7))), json: !!b.json, prefer: typeof b.prefer === 'string' ? b.prefer : undefined } };
}
