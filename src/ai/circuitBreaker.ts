// Circuit breaker tổng quát (không phụ thuộc AI): dùng được cho bất kỳ dịch vụ ngoài nào (AI, thanh toán, API bên thứ ba…).
//
//   CLOSED ──(lỗi ≥ ngưỡng trong cửa sổ)──▶ OPEN ──(hết thời gian nghỉ)──▶ HALF_OPEN
//     ▲                                       ▲                               │
//     └──────────(thử nghiệm thành công)──────┼───────(thử nghiệm lỗi: nghỉ lâu hơn ×2)
//
// - Lỗi được đếm trong cửa sổ trượt (không cộng dồn vô hạn).
// - Thời gian nghỉ tăng theo cấp số nhân khi mở lại liên tiếp, có trần.
// - forceOpen(ms): mở ngay với thời gian cụ thể (vd. 429 Retry-After, model bị gỡ).
// - Đồng hồ có thể tiêm vào để test xác định.

export type BreakerState = 'closed' | 'open' | 'half_open';

export interface BreakerOptions {
  /** Số lỗi trong cửa sổ để mở mạch. */
  failureThreshold: number;
  /** Cửa sổ đếm lỗi (ms). */
  windowMs: number;
  /** Thời gian nghỉ ban đầu khi mở (ms). */
  cooldownMs: number;
  /** Trần thời gian nghỉ (ms). */
  maxCooldownMs: number;
  /** Số lời gọi thử đồng thời tối đa ở HALF_OPEN. */
  halfOpenProbes: number;
  now: () => number;
}

export const DEFAULT_BREAKER: BreakerOptions = { failureThreshold: 3, windowMs: 60_000, cooldownMs: 15_000, maxCooldownMs: 5 * 60_000, halfOpenProbes: 1, now: () => Date.now() };

export interface BreakerSnapshot { state: BreakerState; failures: number; openUntil: number; consecutiveOpens: number; lastError?: string }

export class CircuitBreaker {
  private failures: number[] = [];
  private state: BreakerState = 'closed';
  private openUntil = 0;
  private consecutiveOpens = 0;
  private probesInFlight = 0;
  private lastError?: string;
  readonly opts: BreakerOptions;

  constructor(opts: Partial<BreakerOptions> = {}) { this.opts = { ...DEFAULT_BREAKER, ...opts }; }

  /** Có được phép gọi lúc này không. Ở HALF_OPEN chỉ cho đúng số lời gọi thử. */
  canRequest(): boolean {
    this.refresh();
    if (this.state === 'closed') return true;
    if (this.state === 'half_open') return this.probesInFlight < this.opts.halfOpenProbes;
    return false;
  }
  /** Gọi trước khi thực thi (giữ chỗ lời gọi thử ở HALF_OPEN). */
  begin(): void { this.refresh(); if (this.state === 'half_open') this.probesInFlight++; }

  onSuccess(): void {
    this.refresh();
    if (this.state === 'half_open') this.probesInFlight = Math.max(0, this.probesInFlight - 1);
    this.state = 'closed'; this.failures = []; this.consecutiveOpens = 0; this.lastError = undefined;
  }

  onFailure(reason = 'error'): void {
    this.refresh();
    const now = this.opts.now();
    this.lastError = reason;
    if (this.state === 'half_open') { this.probesInFlight = Math.max(0, this.probesInFlight - 1); this.trip(now); return; }
    this.failures = this.failures.filter((t) => now - t < this.opts.windowMs);
    this.failures.push(now);
    if (this.failures.length >= this.opts.failureThreshold) this.trip(now);
  }
  /** Lời gọi bị hủy/không liên quan sức khỏe (vd. prompt quá dài): trả chỗ thử mà không đổi trạng thái. */
  onNeutral(): void { if (this.state === 'half_open') this.probesInFlight = Math.max(0, this.probesInFlight - 1); }

  /** Mở mạch ngay trong `ms` (vd. theo Retry-After của 429). */
  forceOpen(ms: number, reason = 'forced'): void {
    const now = this.opts.now();
    this.state = 'open'; this.lastError = reason; this.probesInFlight = 0;
    this.openUntil = Math.max(this.openUntil, now + Math.max(0, ms));
  }

  snapshot(): BreakerSnapshot { this.refresh(); return { state: this.state, failures: this.failures.length, openUntil: this.openUntil, consecutiveOpens: this.consecutiveOpens, lastError: this.lastError }; }
  /** Thời gian còn lại tới khi được thử lại (ms), 0 nếu đang cho gọi. */
  retryInMs(): number { this.refresh(); return this.state === 'open' ? Math.max(0, this.openUntil - this.opts.now()) : 0; }

  private trip(now: number) {
    const cool = Math.min(this.opts.maxCooldownMs, this.opts.cooldownMs * 2 ** this.consecutiveOpens);
    this.consecutiveOpens++;
    this.state = 'open'; this.openUntil = now + cool; this.failures = []; this.probesInFlight = 0;
  }
  private refresh() {
    if (this.state === 'open' && this.opts.now() >= this.openUntil) { this.state = 'half_open'; this.probesInFlight = 0; }
  }
}
