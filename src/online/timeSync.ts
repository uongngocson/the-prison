// Đo độ lệch đồng hồ máy so với máy chủ (GET /api/time) — để đồng hồ chung không phụ thuộc giờ máy người chơi.
import { config } from '../config/client';
import { estimateOffset, sharedMinuteAt } from './sharedClock';

let offset: number | null = null;
let measuredAt = 0;
let inflight: Promise<number | null> | null = null;
const REMEASURE_MS = 10 * 60_000;

async function sample(): Promise<{ t0: number; server: number; t1: number } | null> {
  try {
    const t0 = Date.now();
    const r = await fetch('/api/time', { cache: 'no-store' });
    const t1 = Date.now();
    const j = (await r.json()) as { now?: number };
    return typeof j.now === 'number' ? { t0, server: j.now, t1 } : null;
  } catch { return null; }
}

/** Đo 3 lần, lấy trung vị (bỏ lần có độ trễ > 1,5 s). Trả về độ lệch ms hoặc null nếu không đo được. */
export async function syncServerTime(force = false): Promise<number | null> {
  if (!force && offset !== null && Date.now() - measuredAt < REMEASURE_MS) return offset;
  inflight ??= (async () => {
    const out: { t0: number; server: number; t1: number }[] = [];
    for (let i = 0; i < 3; i++) { const s = await sample(); if (s) out.push(s); }
    const est = estimateOffset(out);
    if (est !== null) { offset = est; measuredAt = Date.now(); }
    return offset;
  })().finally(() => { inflight = null; });
  return inflight;
}
export const timeSynced = () => offset !== null;
export const serverNow = () => Date.now() + (offset ?? 0);
/** Phút chung hiện tại theo cấu hình admin. */
export const sharedMinuteNow = () => sharedMinuteAt(serverNow(), config().clock);

if (typeof window !== 'undefined') (window as unknown as { __mnmTime: unknown }).__mnmTime = { syncServerTime, serverNow, sharedMinuteNow, offset: () => offset };
