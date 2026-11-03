// CR-TIME-01: phiên chơi đi theo đồng hồ chung (dùng cùng API với controller) — ngoại tuyến không đổi.
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../src/domain/newgame';
import { GameSession, type SharedWorld } from '../src/simulation/session';
import { skipAdmission, currentBed } from '../src/domain/life';
import { PROP_BY_ID } from '../src/content/world';
import { dayOf, dayOfWeek, minuteOfDay, setWeekShift } from '../src/domain/util';
import { sharedMinuteOfDay, sharedWeekday, weatherAt } from '../src/online/sharedClock';

const DT = 1 / 30;
function setup() {
  setWeekShift(0);
  const s = createNewGame({ name: 'Thử', appearance: { body: 'slim', skin: 0, hair: 2, hairColor: 1, outfit: 2 }, familyContext: 'family', seed: 7 }, 'lin_clock');
  const g = new GameSession(s, { lightNeeds: false, autoComplete: false, dayLengthRealMin: 48 });
  g.exec((ctx) => skipAdmission(ctx, { familyContext: 'family' }));
  return g;
}
/** Đồng hồ chung giả lập điều khiển bằng tay. */
function fakeClock(start: number): SharedWorld & { now: number } {
  const w = { room: 'an-binh-1', now: start, minute: () => w.now, dayLengthMin: 48, clockVersion: 1 };
  return w;
}
const run = (g: GameSession, seconds: number) => { for (let i = 0; i < seconds * 30; i++) g.update(DT); };

describe('CR-TIME-01 — phiên chơi theo giờ chung', () => {
  it('vào phòng: chỉ tua tới, khớp giờ trong ngày, khớp thứ chung, thời tiết chung', () => {
    const g = setup();
    const before = g.s.minute;
    const clock = fakeClock(37 * 1440 + 7 * 60 + 15); // ngày chung 37, 07:15
    const r = g.attachShared(clock);
    expect(g.s.minute).toBeGreaterThan(before);
    expect(r.delta).toBeGreaterThan(0);
    expect(minuteOfDay(g.s.minute)).toBeCloseTo(sharedMinuteOfDay(clock.now), 3);
    expect(dayOfWeek(g.s.minute)).toBe(sharedWeekday(clock.now));
    expect(g.s.world.weather).toBe(weatherAt('an-binh-1', clock.now));
    expect(g.s.online).toMatchObject({ clockVersion: 1 });
  });

  it('khoảng bỏ qua tính là nghỉ nhẹ: không vắng điểm danh', () => {
    const g = setup(); // Ngày 1 ~09:00 → giờ chung 22:00 đi qua điểm danh tối 21:30
    g.attachShared(fakeClock(5 * 1440 + 22 * 60));
    expect(g.s.life.attendance.some((a) => a.outcome === 'absent')).toBe(false);
    expect(g.s.life.attendance.some((a) => a.key.startsWith('roll_pm'))).toBe(true);
  });

  it('đồng hồ đi theo giờ chung, không theo tốc độ riêng, không tua khi hành động', () => {
    const g = setup();
    const clock = fakeClock(2 * 1440 + 10 * 60);
    g.attachShared(clock);
    const m0 = g.s.minute;
    clock.now += 15; // 15 phút game (= 30 giây thực ở 48 phút/ngày)
    run(g, 30);
    expect(g.s.minute - m0).toBeCloseTo(15, 0);
    // không tiến quá giờ chung dù mô phỏng chạy thêm
    run(g, 5);
    expect(g.s.minute - m0).toBeLessThanOrEqual(15.01);
    g.skipAction(); // không có tác dụng khi trực tuyến
    expect(g.s.minute - m0).toBeLessThanOrEqual(15.01);
  });

  it('khoảng trống lớn (tab ẩn) được bù bằng syncSharedGap', () => {
    const g = setup();
    const clock = fakeClock(3 * 1440 + 8 * 60);
    g.attachShared(clock);
    const m0 = g.s.minute;
    clock.now += 180;
    expect(g.syncSharedGap()).toBeCloseTo(180, 3);
    expect(g.s.minute - m0).toBeCloseTo(180, 3);
    expect(g.syncSharedGap()).toBe(0);
  });

  it('ngủ trực tuyến (D4): không tua, hồi năng lượng gấp đôi, thức đúng giờ hoặc khi bấm', () => {
    const g = setup();
    const clock = fakeClock(4 * 1440 + 22 * 60 + 10);
    g.attachShared(clock);
    const bed = currentBed(g.s)!;
    const p = PROP_BY_ID[bed];
    g.s.player.pos = { x: p.x, y: 0, z: p.z };
    g.s.needs.energy = 20;
    const m0 = g.s.minute;
    const r = g.sleep(bed, m0 + 60);
    expect(r.ok).toBe(true);
    expect(g.s.minute).toBe(m0); // không nhảy giờ
    expect(g.sleepingOnline).toBe(true);
    clock.now += 30;
    run(g, 60);
    expect(g.s.needs.energy).toBeGreaterThan(20 + 30 * (8 / 60) * 1.9 - 1); // ~gấp đôi 8/giờ
    expect(g.sleepingOnline).toBe(true);
    clock.now += 31;
    run(g, 62);
    expect(g.sleepingOnline).toBe(false); // tự thức khi tới giờ
    expect(g.s.player.mode).toBe('grounded');
    // thức bằng tay
    g.s.player.pos = { x: p.x, y: 0, z: p.z };
    g.sleep(bed, g.s.minute + 300);
    g.wakeUp();
    expect(g.sleepingOnline).toBe(false);
  });

  it('bù giờ chia khung (QA48) và save nhanh hơn thì đứng chờ', async () => {
    const g = setup();
    const m0 = g.s.minute;
    await g.catchUpChunked(1000);
    expect(g.s.minute - m0).toBeCloseTo(1000, 3);
    const clock = fakeClock(Math.floor(g.s.minute / 1440) * 1440 + 20 * 1440 + minuteOfDay(g.s.minute) - 10); // chung chậm hơn 10 phút
    const before = g.s.minute;
    expect(g.attachShared(clock).delta).toBe(0);
    run(g, 5);
    expect(g.s.minute).toBeCloseTo(before, 3); // đứng chờ
    clock.now += 12;
    run(g, 10);
    expect(g.s.minute - before).toBeCloseTo(2, 0);
  });

  it('rời phòng: trở lại đồng hồ riêng, giữ thứ chung', () => {
    const g = setup();
    const clock = fakeClock(9 * 1440 + 15 * 60);
    g.attachShared(clock);
    const wd = dayOfWeek(g.s.minute);
    g.detachShared();
    expect(g.shared).toBeNull();
    const m0 = g.s.minute;
    run(g, 2);
    expect(g.s.minute).toBeGreaterThan(m0); // tự chạy theo tốc độ riêng
    expect(dayOfWeek(g.s.minute)).toBe(wd);
  });

  it('ngoại tuyến không đổi: ngày bắt đầu 1, tua khi hành động vẫn như cũ', () => {
    const g = setup();
    expect(g.shared).toBeNull();
    expect(dayOf(g.s.minute)).toBe(1);
    const m0 = g.s.minute;
    run(g, 2);
    expect(g.s.minute - m0).toBeCloseTo(1, 1); // 48 phút thực/ngày → 0,5 phút game mỗi giây
  });
});
