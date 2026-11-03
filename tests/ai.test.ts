// AI gateway: circuit breaker + chuyển model (provider giả, đồng hồ giả — không gọi mạng).
import { describe, expect, it } from 'vitest';
import { CircuitBreaker } from '../src/ai/circuitBreaker';
import { ModelRouter } from '../src/ai/router';
import { classify, parseDuration } from '../src/ai/providers/groq';
import { AIError, type ChatProvider, type ModelSpec } from '../src/ai/types';
import { validateChatRequest } from '../src/ai/server';

const M = (id: string, priority: number, ctx = 131072): ModelSpec => ({ id, provider: 'groq', capabilities: ['chat'], priority, contextWindow: ctx });
const MODELS = [M('a', 1), M('b', 2), M('c', 3)];
const req = { messages: [{ role: 'user' as const, content: 'hi' }] };

/** Provider giả: kịch bản lỗi theo model. */
function fake(plan: Record<string, (() => never) | 'ok' | 'hang'>) {
  const calls: string[] = [];
  const p: ChatProvider = {
    async complete(model, _r, signal) {
      calls.push(model.id);
      const step = plan[model.id] ?? 'ok';
      if (step === 'ok') return { text: `from ${model.id}`, model: model.id };
      if (step === 'hang') return new Promise((_, rej) => signal.addEventListener('abort', () => rej(new AIError('timeout', 'timeout'))));
      return step();
    },
  };
  return { p, calls };
}
const fail = (kind: AIError['kind'], retryAfterMs?: number) => () => { throw new AIError(kind, kind, undefined, retryAfterMs); };

describe('CircuitBreaker', () => {
  it('opens after threshold, half-opens after cooldown, closes on success, backs off exponentially', () => {
    let t = 0;
    const b = new CircuitBreaker({ failureThreshold: 2, cooldownMs: 1000, now: () => t });
    b.onFailure(); expect(b.canRequest()).toBe(true);
    b.onFailure(); expect(b.snapshot().state).toBe('open'); expect(b.canRequest()).toBe(false);
    t = 1000; expect(b.snapshot().state).toBe('half_open'); expect(b.canRequest()).toBe(true);
    b.begin(); expect(b.canRequest()).toBe(false); // chỉ 1 lời gọi thử
    b.onFailure(); expect(b.retryInMs()).toBe(2000); // thử lỗi → nghỉ ×2
    t = 3000; b.begin(); b.onSuccess(); expect(b.snapshot()).toMatchObject({ state: 'closed', consecutiveOpens: 0 });
  });
  it('counts failures only inside the sliding window', () => {
    let t = 0;
    const b = new CircuitBreaker({ failureThreshold: 2, windowMs: 1000, now: () => t });
    b.onFailure(); t = 1500; b.onFailure();
    expect(b.snapshot().state).toBe('closed');
  });
  it('forceOpen honours Retry-After', () => {
    let t = 0;
    const b = new CircuitBreaker({ now: () => t });
    b.forceOpen(5000, '429'); expect(b.canRequest()).toBe(false);
    t = 5000; expect(b.canRequest()).toBe(true);
  });
});

describe('ModelRouter failover', () => {
  it('switches immediately to the next model on server error', async () => {
    const { p, calls } = fake({ a: fail('server') });
    const r = await new ModelRouter(p, MODELS).chat(req);
    expect(r.model).toBe('b'); expect(calls).toEqual(['a', 'b']);
    expect(r.attempts.map((x) => `${x.model}:${x.ok ? 'ok' : x.error}`)).toEqual(['a:server', 'b:ok']);
  });
  it('rate limit (429) opens that model until reset; later calls skip it without calling', async () => {
    let t = 0;
    const { p, calls } = fake({ a: fail('rate_limited', 30_000) });
    const router = new ModelRouter(p, MODELS, { now: () => t });
    await router.chat(req);
    calls.length = 0;
    const r2 = await router.chat(req);
    expect(calls).toEqual(['b']); expect(r2.attempts[0]).toMatchObject({ model: 'a', skipped: 'circuit_open' });
    t = 30_000; calls.length = 0;
    await router.chat(req).catch(() => {});
    expect(calls[0]).toBe('a'); // hết hạn → thử lại (half-open)
  });
  it('timeout on a hanging model fails over within the attempt budget', async () => {
    const { p } = fake({ a: 'hang' });
    const r = await new ModelRouter(p, MODELS, { attemptTimeoutMs: 50 }).chat(req);
    expect(r.model).toBe('b'); expect(r.attempts[0].error).toBe('timeout');
  });
  it('auth error stops immediately (do not burn other models)', async () => {
    const { p, calls } = fake({ a: fail('auth') });
    await expect(new ModelRouter(p, MODELS).chat(req)).rejects.toMatchObject({ kind: 'auth' });
    expect(calls).toEqual(['a']);
  });
  it('context too long for a small model skips it without tripping its breaker', async () => {
    const { p, calls } = fake({});
    const router = new ModelRouter(p, [M('small', 1, 100), M('big', 2)]);
    const r = await router.chat({ messages: [{ role: 'user', content: 'x'.repeat(2000) }] });
    expect(r.model).toBe('big'); expect(calls).toEqual(['big']);
    expect(router.status().find((s) => s.id === 'small')!.breaker.state).toBe('closed');
  });
  it('all models failing returns all_failed with the full trace and soonest retry', async () => {
    const { p } = fake({ a: fail('server'), b: fail('rate_limited', 9000), c: fail('network') });
    const err = await new ModelRouter(p, MODELS, { now: () => 0 }).chat(req).then(() => { throw new Error('should fail'); }, (e: AIError) => e);
    expect(err.kind).toBe('all_failed'); expect(err.attempts).toHaveLength(3); expect(err.retryAfterMs).toBe(9000);
  });
  it('repeated failures open a model so the next request starts at a healthy one', async () => {
    const { p, calls } = fake({ a: fail('server') });
    const router = new ModelRouter(p, MODELS, { breaker: { failureThreshold: 2 } });
    await router.chat(req); await router.chat(req);
    calls.length = 0;
    await router.chat(req);
    expect(calls).toEqual(['b']);
  });
  it('prefer puts a healthy model first; capability filters models', async () => {
    const { p, calls } = fake({});
    const router = new ModelRouter(p, [...MODELS, { ...M('g', 1), capabilities: ['guard'] }]);
    await router.chat({ ...req, prefer: 'c' }); expect(calls).toEqual(['c']);
    calls.length = 0; await router.chat({ ...req, capability: 'guard' }); expect(calls).toEqual(['g']);
  });
});

describe('Groq adapter helpers', () => {
  it('parses Groq durations and classifies errors', () => {
    expect(parseDuration('1m30.5s')).toBe(90500); expect(parseDuration('120ms')).toBe(120); expect(parseDuration('7')).toBe(7000);
    expect(classify(429, null, new Headers({ 'retry-after': '12' }))).toMatchObject({ kind: 'rate_limited', retryAfterMs: 12000 });
    expect(classify(401, null).kind).toBe('auth');
    expect(classify(503, null).kind).toBe('server');
    expect(classify(404, { error: { code: 'model_not_found' } }).kind).toBe('model_unavailable');
    expect(classify(400, { error: { message: 'Please reduce the length: maximum context length is 8192' } }).kind).toBe('context_length');
    expect(classify(400, { error: { message: 'invalid role' } }).kind).toBe('bad_request');
  });
  it('validates and clamps endpoint input', () => {
    expect(validateChatRequest({ messages: [] }).ok).toBe(false);
    expect(validateChatRequest({ messages: [{ role: 'hacker', content: 'x' }] }).ok).toBe(false);
    const v = validateChatRequest({ messages: [{ role: 'user', content: 'x' }], maxTokens: 99999, capability: 'guard' });
    expect(v.ok).toBe(false);
    const ok = validateChatRequest({ messages: [{ role: 'user', content: 'x' }], maxTokens: 99999 });
    expect(ok.ok && ok.req.maxTokens).toBe(1024);
  });
});
