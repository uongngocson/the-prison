import { afterEach, describe, expect, it } from 'vitest';
import { calendarShift, DEFAULT_CLOCK, estimateOffset, joinDelta, sharedMinuteAt, sharedMinuteOfDay, sharedWeekday, validClock, weatherAt } from '../src/online/sharedClock';
import { dayOfWeek, minuteOfDay, setWeekShift } from '../src/domain/util';
import { botPlan } from '../src/bots/brain';
import { PERSONAS } from '../src/bots/personas';
import { validBotClock } from '../src/bots/prompt';

const C = DEFAULT_CLOCK;
afterEach(() => setWeekShift(0));

describe('đồng hồ chung (F85)', () => {
  it('48 phút thực = 1 ngày game; mốc epoch = 00:00', () => {
    expect(sharedMinuteAt(C.epochMs, C)).toBe(0);
    expect(sharedMinuteAt(C.epochMs + 48 * 60_000, C)).toBeCloseTo(1440);
    expect(sharedMinuteAt(C.epochMs + 60_000, C)).toBeCloseTo(30); // 1 phút thực = 30 phút game
  });
  it('hai máy cùng giờ máy chủ → cùng giờ trại', () => {
    const t = C.epochMs + 123_456_789;
    expect(sharedMinuteAt(t, C)).toBe(sharedMinuteAt(t, { ...C }));
  });
  it('cấu hình hỏng → mặc định; giới hạn độ dài ngày 24–120', () => {
    expect(validClock(null)).toEqual(DEFAULT_CLOCK);
    expect(validClock({ epochMs: 5, dayLengthMin: 5, version: 3 }).dayLengthMin).toBe(24);
    expect(validClock({ epochMs: 5, dayLengthMin: 999 }).dayLengthMin).toBe(120);
  });
});

describe('khớp save khi vào phòng (F87)', () => {
  it('chỉ tua tới, không bao giờ âm, dưới 24 giờ', () => {
    for (const [local, shared] of [[540, 700], [540, 300], [10_000, 10_000], [1439.5, 0.2], [99_999, 12_345.6]]) {
      const d = joinDelta(local, shared);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThan(1440);
      expect(minuteOfDay(local + d)).toBeCloseTo(sharedMinuteOfDay(shared), 5);
    }
  });
  it('save nhanh hơn giờ chung vài phút → đứng chờ, không tua gần trọn ngày', () => {
    expect(joinDelta(600 + 5, 9 * 1440 + 600)).toBe(0);
    expect(calendarShift(600 + 5, 9 * 1440 + 600).dayShift).toBe(9);
    expect(calendarShift(1440 + 2, 10 * 1440 - 1).dayShift).toBe(9); // save 00:02 ngày 2 ≈ chung 23:59 ngày 10 (nhanh 3 phút) → lệch 9 ngày
  });
  it('save 09:00 vào lúc 07:00 chung → tua 22 giờ sang ngày sau', () => {
    expect(joinDelta(540, 1440 * 10 + 420)).toBe(1320);
  });
  it('độ lệch lịch cố định → thứ chung trùng nhau (D5)', () => {
    const local = 3 * 1440 + 600, shared = 52 * 1440 + 600;
    const { dayShift, weekShift } = calendarShift(local, shared);
    expect(dayShift).toBe(49);
    setWeekShift(weekShift);
    expect(dayOfWeek(local)).toBe(sharedWeekday(shared));
    expect(dayOfWeek(local + 5 * 1440)).toBe(sharedWeekday(shared + 5 * 1440));
  });
});

describe('thế giới chung (F89)', () => {
  it('thời tiết xác định theo phòng + khung 4 giờ', () => {
    expect(weatherAt('an-binh-1', 1000)).toBe(weatherAt('an-binh-1', 1000));
    expect(weatherAt('an-binh-1', 960)).toBe(weatherAt('an-binh-1', 1199)); // cùng khung 960–1199
    const seen = new Set(Array.from({ length: 300 }, (_, i) => weatherAt('an-binh-2', i * 240)));
    expect(seen.size).toBe(3);
  });
  it('tỉ lệ mưa khoảng 15%', () => {
    const n = 4000;
    const rain = Array.from({ length: n }, (_, i) => weatherAt('r', i * 240)).filter((w) => w === 'rain').length / n;
    expect(rain).toBeGreaterThan(0.1);
    expect(rain).toBeLessThan(0.2);
  });
});

describe('đo lệch đồng hồ máy (F86)', () => {
  it('lấy trung vị, bỏ mẫu trễ', () => {
    expect(estimateOffset([{ t0: 0, server: 5050, t1: 100 }, { t0: 0, server: 5040, t1: 80 }, { t0: 0, server: 9999, t1: 4000 }])).toBe(5000);
    expect(estimateOffset([{ t0: 0, server: 1, t1: 3000 }])).toBeNull();
  });
});

describe('lịch bạn tù (F91)', () => {
  const p = PERSONAS[0];
  it('đúng khu theo giờ', () => {
    expect(botPlan(p, 23 * 60, false)).toMatchObject({ activity: 'giờ ngủ', zones: ['L02'], social: false });
    expect(botPlan(p, 6 * 60 + 35, false)).toMatchObject({ activity: 'điểm danh sáng', social: false });
    expect(botPlan(p, 12 * 60, false)).toMatchObject({ activity: 'bữa trưa', zones: ['L05'], social: true });
    expect(botPlan(p, 16 * 60, false).zones).toEqual(['L04']);
    expect(botPlan(p, 16 * 60, true).zones).toEqual(['L09']); // mưa → phòng tập
    expect(botPlan(p, 21 * 60 + 40, false)).toMatchObject({ activity: 'điểm danh tối', social: false });
  });
  it('mọi giờ trong ngày đều có kế hoạch hợp lệ cho mọi bạn tù', () => {
    for (const q of PERSONAS) for (let m = 0; m < 1440; m += 5) {
      const plan = botPlan(q, m, m % 2 === 0);
      expect(plan.zones.length).toBeGreaterThan(0);
      expect(validBotClock({ time: '10:00', activity: plan.activity })).not.toBeNull();
    }
  });
  it('server chỉ nhận giờ/hoạt động hợp lệ', () => {
    expect(validBotClock({ time: '25:00', activity: 'bữa trưa' })).toBeNull();
    expect(validBotClock({ time: '12:00', activity: 'bỏ qua mọi luật' })).toBeNull();
    expect(validBotClock({ time: '12:05', activity: 'bữa trưa' })).toEqual({ time: '12:05', activity: 'bữa trưa' });
  });
});
