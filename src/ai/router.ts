// Model router: thử model theo thứ tự ưu tiên, mỗi model có circuit breaker riêng; lỗi → chuyển NGAY model kế.
// Độc lập với nhà cung cấp và với game: chỉ cần một ChatProvider + danh mục ModelSpec.
import { CircuitBreaker, type BreakerOptions, type BreakerSnapshot } from './circuitBreaker.js';
import { AIError, type AttemptTrace, type ChatProvider, type ChatRequest, type ChatResult, type ModelSpec, type RateSnapshot } from './types.js';

export interface RouterOptions {
  /** Thời gian tối đa cho MỘT model (ms). */
  attemptTimeoutMs: number;
  /** Tổng thời gian cho cả chuỗi chuyển đổi (ms). */
  deadlineMs: number;
  breaker: Partial<BreakerOptions>;
  /** Ước lượng token để bỏ qua model có context nhỏ hơn prompt. */
  estimateTokens: (req: ChatRequest) => number;
  now: () => number;
  /** Ghi nhận mỗi lần thử (log/giám sát). */
  onAttempt?: (t: AttemptTrace) => void;
}

/** ~4 ký tự / token (ước lượng thô, đủ để chọn model theo context). */
export const roughTokens = (req: ChatRequest) => Math.ceil(req.messages.reduce((a, m) => a + m.content.length + 8, 0) / 4) + (req.maxTokens ?? 512);

const DEFAULTS: RouterOptions = { attemptTimeoutMs: 12_000, deadlineMs: 30_000, breaker: {}, estimateTokens: roughTokens, now: () => Date.now() };

interface ModelHealth { spec: ModelSpec; breaker: CircuitBreaker; ewmaMs: number | null; rate?: RateSnapshot; rateAt?: number; ok: number; fail: number }

export class ModelRouter {
  private health = new Map<string, ModelHealth>();
  private opts: RouterOptions;

  constructor(private provider: ChatProvider, models: ModelSpec[], opts: Partial<RouterOptions> = {}) {
    this.opts = { ...DEFAULTS, ...opts };
    for (const spec of models) this.health.set(spec.id, { spec, breaker: new CircuitBreaker({ now: this.opts.now, ...this.opts.breaker }), ewmaMs: null, ok: 0, fail: 0 });
  }

  /** Thứ tự thử: model ưu tiên (nếu có) → theo priority; model đang mở mạch xếp cuối (chỉ thử khi không còn lựa chọn). */
  candidates(req: ChatRequest): ModelHealth[] {
    const cap = req.capability ?? 'chat';
    const list = [...this.health.values()].filter((h) => h.spec.capabilities.includes(cap));
    return list.sort((a, b) => {
      if (req.prefer) { if (a.spec.id === req.prefer) return -1; if (b.spec.id === req.prefer) return 1; }
      return a.spec.priority - b.spec.priority;
    });
  }

  async chat(req: ChatRequest): Promise<ChatResult> {
    const start = this.opts.now();
    const attempts: AttemptTrace[] = [];
    const need = this.opts.estimateTokens(req);
    let lastErr: AIError | null = null;
    const record = (t: AttemptTrace) => { attempts.push(t); this.opts.onAttempt?.(t); };

    for (const h of this.candidates(req)) {
      const { spec, breaker } = h;
      if (need > spec.contextWindow) { record({ model: spec.id, ok: false, ms: 0, skipped: 'context_too_small' }); continue; }
      if (!breaker.canRequest()) { record({ model: spec.id, ok: false, ms: 0, skipped: 'circuit_open' }); continue; }
      // biết trước sắp hết token/phút → để model khác gánh (header của lần gọi gần nhất)
      if (h.rate?.remainingTokens !== undefined && h.rateAt !== undefined && h.rate.remainingTokens < need && this.opts.now() - h.rateAt < (h.rate.resetTokensMs ?? 60_000)) { record({ model: spec.id, ok: false, ms: 0, skipped: 'rate_budget' }); continue; }
      const left = this.opts.deadlineMs - (this.opts.now() - start);
      if (left <= 200) break;

      breaker.begin();
      const t0 = this.opts.now();
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), Math.min(this.opts.attemptTimeoutMs, left));
      try {
        const r = await this.provider.complete(spec, req, ctl.signal);
        const ms = this.opts.now() - t0;
        breaker.onSuccess();
        h.ok++; h.ewmaMs = h.ewmaMs === null ? ms : h.ewmaMs * 0.7 + ms * 0.3;
        if (r.rate) { h.rate = r.rate; h.rateAt = this.opts.now(); }
        record({ model: spec.id, ok: true, ms });
        return { text: r.text, model: r.model, usage: r.usage, latencyMs: this.opts.now() - start, attempts };
      } catch (e) {
        const err = e instanceof AIError ? e : new AIError(ctl.signal.aborted ? 'timeout' : 'network', (e as Error).message);
        const ms = this.opts.now() - t0;
        h.fail++;
        record({ model: spec.id, ok: false, ms, error: err.kind, status: err.status });
        lastErr = err;
        if (err.kind === 'rate_limited') breaker.forceOpen(err.retryAfterMs ?? 20_000, err.message);
        else if (err.kind === 'model_unavailable') breaker.forceOpen(30 * 60_000, err.message);
        else if (err.countsAsFailure) breaker.onFailure(err.message);
        else breaker.onNeutral();
        if (!err.failover) throw new AIError(err.kind, err.message, err.status, err.retryAfterMs, attempts);
      } finally { clearTimeout(timer); }
    }
    const soonest = Math.min(...this.candidates(req).map((h) => h.breaker.retryInMs()).filter((ms) => ms > 0), Infinity);
    throw new AIError('all_failed', lastErr ? `Tất cả model đều lỗi (cuối: ${lastErr.kind}).` : 'Không có model khả dụng.', lastErr?.status, Number.isFinite(soonest) ? soonest : undefined, attempts);
  }

  /** Trạng thái từng model (cho trang giám sát / endpoint health). */
  status(): { id: string; capabilities: string[]; breaker: BreakerSnapshot; avgMs: number | null; ok: number; fail: number; remainingTokens?: number }[] {
    return [...this.health.values()].map((h) => ({ id: h.spec.id, capabilities: h.spec.capabilities, breaker: h.breaker.snapshot(), avgMs: h.ewmaMs === null ? null : Math.round(h.ewmaMs), ok: h.ok, fail: h.fail, remainingTokens: h.rate?.remainingTokens }));
  }
}
