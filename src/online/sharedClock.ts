// CR-TIME-01 — Đồng hồ chung cho chế độ trực tuyến (hàm thuần, không mạng/không DOM).
// Mọi máy tự tính cùng một giờ trại từ giờ máy chủ + cấu hình (app_config.clock); không phát giờ qua mạng.
import { hash32, MIN_PER_DAY } from '../domain/util.js';

export interface ClockConfig {
  /** Mốc 00:00 Ngày chung 0 (ms, giờ máy chủ). */
  epochMs: number;
  /** Độ dài một ngày game tính bằng phút thực (admin chỉnh, 24–120). */
  dayLengthMin: number;
  /** Tăng khi admin đổi cấu hình → máy đang chơi tự đồng bộ lại. */
  version: number;
}

/** 00:00 giờ Việt Nam ngày 01/01/2026. */
export const DEFAULT_CLOCK: ClockConfig = { epochMs: Date.UTC(2025, 11, 31, 17, 0, 0), dayLengthMin: 48, version: 1 };
export const DAY_LEN_RANGE = [24, 120] as const;

export function validClock(c: Partial<ClockConfig> | null | undefined): ClockConfig {
  const epochMs = Number(c?.epochMs), len = Number(c?.dayLengthMin), version = Number(c?.version);
  return {
    epochMs: Number.isFinite(epochMs) ? epochMs : DEFAULT_CLOCK.epochMs,
    dayLengthMin: Number.isFinite(len) ? Math.max(DAY_LEN_RANGE[0], Math.min(DAY_LEN_RANGE[1], len)) : DEFAULT_CLOCK.dayLengthMin,
    version: Number.isFinite(version) && version >= 1 ? Math.floor(version) : DEFAULT_CLOCK.version,
  };
}

/** Phút game trôi qua mỗi giây thực. */
export const gameMinPerSec = (c: ClockConfig) => MIN_PER_DAY / (c.dayLengthMin * 60);
/** Phút chung tuyệt đối (số thực) tại thời điểm máy chủ `serverMs`. */
export const sharedMinuteAt = (serverMs: number, c: ClockConfig) => ((serverMs - c.epochMs) / 1000) * gameMinPerSec(c);
export const sharedDayOf = (sharedMinute: number) => Math.floor(sharedMinute / MIN_PER_DAY);
export const sharedMinuteOfDay = (sharedMinute: number) => ((sharedMinute % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY;
/** Thứ chung: 0 = Thứ Hai (cùng quy ước với dayOfWeek). */
export const sharedWeekday = (sharedMinute: number) => ((sharedDayOf(sharedMinute) % 7) + 7) % 7;

/**
 * Số phút game cần tua TỚI để giờ trong ngày của save trùng giờ chung (0 … <1440). Không bao giờ âm:
 * thời gian của save chỉ tiến (bất biến của mọi hệ thống lịch hẹn/lệnh/ca).
 */
export function joinDelta(localMinute: number, sharedMinute: number): number {
  const d = (sharedMinuteOfDay(sharedMinute) - (((localMinute % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY;
  // save đang NHANH hơn giờ chung một chút (vd. đồng hồ riêng chạy trong lúc xếp hàng) → đứng chờ, không tua gần trọn một ngày
  return MIN_PER_DAY - d < AHEAD_WAIT_MAX ? 0 : d;
}
/** Save nhanh hơn giờ chung dưới mức này (phút game, ~30 giây thực) thì đứng chờ thay vì tua sang ngày sau. */
export const AHEAD_WAIT_MAX = 15;

/** Độ lệch (ngày, thứ) giữa lịch riêng của save và lịch chung — cố định khi hai đồng hồ đã khớp giờ. */
export function calendarShift(localMinute: number, sharedMinute: number): { dayShift: number; weekShift: number } {
  // giờ trong ngày đã khớp (hoặc lệch vài phút) → làm tròn số ngày chênh, an toàn khi gần nửa đêm
  const dayShift = Math.round((sharedMinute - localMinute) / MIN_PER_DAY);
  return { dayShift, weekShift: ((dayShift % 7) + 7) % 7 };
}

export type Weather = 'clear' | 'overcast' | 'rain';
/** Thời tiết chung của phòng: khung 4 giờ game, tỉ lệ 60/25/15 như chế độ ngoại tuyến. */
export function weatherAt(room: string, sharedMinute: number): Weather {
  const slot = Math.floor(sharedMinute / 240);
  const r = (hash32(`${room}:w:${slot}`) % 10_000) / 10_000;
  return r < 0.6 ? 'clear' : r < 0.85 ? 'overcast' : 'rain';
}
/** Số ngẫu nhiên xác định theo phòng + khóa (0…1) — thay rng của save cho sự kiện chung. */
export const roomChance = (room: string, key: string) => (hash32(`${room}:${key}`) % 10_000) / 10_000;

/** Giới hạn thời gian thực của một hành động khi trực tuyến (D3): tối đa ~60 giây thực. */
export const ONLINE_ACTION_REAL_SEC = 60;
/** Bù thời gian khi tab ẩn/mất kết nối lâu hơn ngưỡng này (phút game) thì xử lý như “nghỉ nhẹ”. */
export const CATCHUP_THRESHOLD_MIN = 3;

/** Ước lượng độ lệch đồng hồ máy so với máy chủ từ các mẫu (t0 gửi, server, t1 nhận): trung vị, bỏ RTT lớn. */
export function estimateOffset(samples: { t0: number; server: number; t1: number }[], maxRttMs = 1500): number | null {
  const ok = samples.filter((s) => s.t1 >= s.t0 && s.t1 - s.t0 <= maxRttMs).map((s) => s.server - (s.t0 + s.t1) / 2).sort((a, b) => a - b);
  if (!ok.length) return null;
  return ok[Math.floor(ok.length / 2)];
}
