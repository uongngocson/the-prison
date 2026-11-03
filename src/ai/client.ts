// Phía trình duyệt: gọi gateway /api/ai/chat (không chứa API key). Dùng chung cho mọi tính năng UI.
//   const r = await aiChat([{ role: 'user', content: 'Xin chào' }]);  // r.text, r.model
import type { ChatMessage, ChatRequest, ModelCapability } from './types';

export interface AIChatReply { text: string; model: string; latencyMs: number; failovers: number }
export class AIClientError extends Error { constructor(message: string, public status: number, public retryAfterMs?: number) { super(message); this.name = 'AIClientError'; } }

export async function aiChat(messages: ChatMessage[], opts: { capability?: ModelCapability; maxTokens?: number; temperature?: number; json?: boolean; signal?: AbortSignal; endpoint?: string } = {}): Promise<AIChatReply> {
  const body: ChatRequest = { messages, capability: opts.capability, maxTokens: opts.maxTokens, temperature: opts.temperature, json: opts.json };
  let res: Response;
  try {
    res = await fetch(opts.endpoint ?? '/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: opts.signal });
  } catch { throw new AIClientError('Không kết nối được máy chủ AI.', 0); }
  const data = await res.json().catch(() => ({})) as Partial<AIChatReply> & { error?: string; retryAfterMs?: number };
  if (!res.ok || !data.text) throw new AIClientError(data.error ?? `Lỗi AI (${res.status}).`, res.status, data.retryAfterMs);
  return { text: data.text, model: data.model ?? '', latencyMs: data.latencyMs ?? 0, failovers: data.failovers ?? 0 };
}
