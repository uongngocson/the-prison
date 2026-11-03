// Adapter Groq (OpenAI-compatible). Chỉ chạy phía SERVER — không bao giờ đưa API key vào bundle trình duyệt.
import { AIError, type ChatProvider, type ChatRequest, type ModelSpec, type RateSnapshot } from '../types.js';

const BASE = 'https://api.groq.com/openai/v1';

/** "1m30.5s" / "2.4s" / "120ms" → ms (định dạng header reset của Groq). */
export function parseDuration(v: string | null | undefined): number | undefined {
  if (!v) return undefined;
  const s = v.trim();
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(Number(s) * 1000); // Retry-After tính bằng giây
  let ms = 0, matched = false;
  for (const [, n, u] of s.matchAll(/(\d+(?:\.\d+)?)(ms|h|m|s)/g)) { matched = true; ms += Number(n) * (u === 'h' ? 3_600_000 : u === 'm' ? 60_000 : u === 's' ? 1000 : 1); }
  return matched ? Math.round(ms) : undefined;
}

function rateFrom(h: Headers): RateSnapshot {
  const num = (k: string) => { const v = h.get(k); return v === null ? undefined : Number(v); };
  return {
    remainingRequests: num('x-ratelimit-remaining-requests'), remainingTokens: num('x-ratelimit-remaining-tokens'),
    resetRequestsMs: parseDuration(h.get('x-ratelimit-reset-requests')), resetTokensMs: parseDuration(h.get('x-ratelimit-reset-tokens')),
  };
}

/** Phân loại phản hồi lỗi của Groq. */
export function classify(status: number, body: { error?: { message?: string; code?: string; type?: string } } | null, headers?: Headers): AIError {
  const msg = body?.error?.message ?? `HTTP ${status}`;
  const code = `${body?.error?.code ?? ''} ${body?.error?.type ?? ''}`.toLowerCase();
  if (status === 401 || status === 403) return new AIError('auth', 'Groq từ chối API key.', status);
  if (status === 429) return new AIError('rate_limited', msg, status, parseDuration(headers?.get('retry-after')) ?? parseDuration(headers?.get('x-ratelimit-reset-tokens')) ?? 20_000);
  if (status === 404 || code.includes('model_not_found') || code.includes('model_decommissioned')) return new AIError('model_unavailable', msg, status);
  if (status === 413 || code.includes('context_length') || /context length|too many tokens|maximum context/i.test(msg)) return new AIError('context_length', msg, status);
  if (status >= 500) return new AIError('server', msg, status);
  return new AIError('bad_request', msg, status);
}

export class GroqProvider implements ChatProvider {
  constructor(private apiKey: string, private fetchImpl: typeof fetch = fetch) {
    if (!apiKey) throw new Error('Thiếu GROQ_API_KEY.');
  }
  async complete(model: ModelSpec, req: ChatRequest, signal: AbortSignal) {
    let res: Response;
    try {
      res = await this.fetchImpl(`${BASE}/chat/completions`, {
        method: 'POST', signal,
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model.id, messages: req.messages,
          max_tokens: req.maxTokens ?? 512, temperature: req.temperature ?? 0.7,
          ...(req.json ? { response_format: { type: 'json_object' } } : {}),
          ...(model.reasoning === 'effort' ? { reasoning_effort: 'low', include_reasoning: false } : model.reasoning === 'format' ? { reasoning_format: 'hidden' } : {}),
        }),
      });
    } catch (e) {
      if (signal.aborted) throw new AIError('timeout', `Quá thời gian chờ ${model.id}.`);
      throw new AIError('network', (e as Error).message);
    }
    const rate = rateFrom(res.headers);
    const body = await res.json().catch(() => null) as { error?: { message?: string; code?: string; type?: string }; choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } } | null;
    if (!res.ok) throw classify(res.status, body, res.headers);
    const text = body?.choices?.[0]?.message?.content?.trim() ?? '';
    if (!text) throw new AIError('empty', `${model.id} trả lời rỗng.`, res.status);
    const u = body?.usage;
    return { text, model: model.id, rate, usage: u ? { promptTokens: u.prompt_tokens, completionTokens: u.completion_tokens, totalTokens: u.total_tokens } : undefined };
  }
}
