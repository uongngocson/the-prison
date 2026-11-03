// Seeded RNG, clock helpers, small pure helpers.

export function mulberry32Next(state: number): [number, number] {
  let t = (state + 0x6d2b79f5) | 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  const value = ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  return [value, t];
}

export class Rng {
  constructor(public state: number) {}
  next(): number {
    const [v, s] = mulberry32Next(this.state);
    this.state = s;
    return v;
  }
  int(min: number, maxInclusive: number): number {
    return min + Math.floor(this.next() * (maxInclusive - min + 1));
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

/** Deterministic hash for strings (FNV-1a 32 bit). */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

let uidCounter = 0;
/** Deterministic-enough unique id from a seed-derived counter (domain ids, not security tokens). */
export function makeId(prefix: string, rng?: Rng): string {
  if (rng) return `${prefix}_${Math.floor(rng.next() * 0xffffffff).toString(36)}${(uidCounter++).toString(36)}`;
  return `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e9).toString(36)}${(uidCounter++).toString(36)}`;
}

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

// ---------- Game clock (F21) ----------
export const MIN_PER_DAY = 1440;
export const dayOf = (absMinute: number) => Math.floor(absMinute / MIN_PER_DAY) + 1;
export const minuteOfDay = (absMinute: number) => ((absMinute % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY;
/** CR-TIME-01 (D5): độ lệch thứ của save đang chơi so với lịch chung trực tuyến (0 nếu chưa từng vào phòng). */
let weekShift = 0;
export function setWeekShift(n: number) { weekShift = ((Math.round(n) % 7) + 7) % 7; }
export const dayOfWeek = (absMinute: number) => (dayOf(absMinute) - 1 + weekShift) % 7; // 0 = Thứ Hai hư cấu
export const absMinuteAt = (day: number, hhmm: number) => (day - 1) * MIN_PER_DAY + Math.floor(hhmm / 100) * 60 + (hhmm % 100);
export const hm = (h: number, m = 0) => h * 60 + m;

export type DayPeriod = 'night' | 'morning' | 'day' | 'evening';
export function periodOf(absMinute: number): DayPeriod {
  const m = minuteOfDay(absMinute);
  if (m < hm(5, 30) || m >= hm(21, 30)) return 'night';
  if (m < hm(11)) return 'morning';
  if (m < hm(17, 30)) return 'day';
  return 'evening';
}
export const PERIOD_LABEL: Record<DayPeriod, string> = { night: 'Đêm', morning: 'Sáng', day: 'Ban ngày', evening: 'Chiều tối' };
export const WEEKDAY_LABEL = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];

export function fmtClock(absMinute: number): string {
  const m = Math.floor(minuteOfDay(absMinute));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
export function fmtDayClock(absMinute: number): string {
  return `Ngày ${dayOf(absMinute)} · ${WEEKDAY_LABEL[dayOfWeek(absMinute)]} · ${fmtClock(absMinute)}`;
}
export function fmtDuration(min: number): string {
  min = Math.max(0, Math.round(min));
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h} giờ ${m} phút`;
  if (h) return `${h} giờ`;
  return `${m} phút`;
}
export function fmtMoney(minor: number): string {
  return `${(minor / 100).toFixed(2).replace('.', ',')} tín chỉ`;
}

export function pushBounded<T>(arr: T[], item: T, max: number): void {
  arr.push(item);
  if (arr.length > max) arr.splice(0, arr.length - max);
}

export function dist2(a: { x: number; z: number }, b: { x: number; z: number }): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

/** Canonical JSON (sorted keys) for checksums/digests — F18 checksum detects corruption, not cheating. */
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`)
    .join(',')}}`;
}
