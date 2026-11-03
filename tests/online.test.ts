// Chế độ Trực tuyến — giao thức: lọc nội dung, giới hạn tốc độ, lọc người nhận, kiểm tra gói mạng.
import { describe, expect, it } from 'vitest';
import { areaOf, posHz, posHzFor, AREA_DELIVERY_BUDGET, GLOBAL_DELIVERY_BUDGET, GLOBAL_SEND_BUDGET, MAX_PLAYERS_PER_ROOM, MIN_POS_HZ, ROOMS, MSG_MAX, NEAR_RADIUS, RateLimiter, sanitize, sanitizeName, shouldReceive, validChat, validPos, type ChatPacket } from '../src/online/protocol';

const pkt = (p: Partial<ChatPacket>): ChatPacket => ({ id: 'a', mid: 'm1', from: 'a', name: 'An', text: 'Xin chào', scope: 'room', x: 0, z: 0, t: 0, ...p });

describe('sanitize', () => {
  it('masks phone numbers, links, emails and profanity; keeps normal Vietnamese', () => {
    expect(sanitize('gọi mình 0912 345 678 nhé')).toBe('gọi mình [ẩn số] nhé');
    expect(sanitize('vào www.example.com xem')).toContain('[ẩn liên kết]');
    expect(sanitize('mail a@b.vn')).toBe('mail [ẩn]');
    expect(sanitize('đm thằng này')).toBe('** thằng này');
    expect(sanitize('các bạn đi buổi sáng lon nước ngủ ngon')).toBe('các bạn đi buổi sáng lon nước ngủ ngon');
  });
  it('trims, collapses spaces, strips control chars and caps length', () => {
    expect(sanitize('  a \n\t b  ')).toBe('a b');
    expect(sanitize('x'.repeat(500)).length).toBe(MSG_MAX);
    expect(sanitize('‮hi')).toBe('hi');
    expect(sanitizeName('   ')).toBe('Người chơi');
  });
});

describe('rate limiter', () => {
  it('enforces minimum gap and burst window', () => {
    const r = new RateLimiter(3, 10000, 1000);
    expect(r.check(0).ok).toBe(true);
    expect(r.check(500).ok).toBe(false);
    expect(r.check(1000).ok).toBe(true);
    expect(r.check(2000).ok).toBe(true);
    expect(r.check(3000).ok).toBe(false); // hết burst trong 10 s
    expect(r.check(10001).ok).toBe(true);
  });
});

describe('receiver filtering (không tin người gửi)', () => {
  const me = { id: 'b', x: 0, z: 0 };
  it('room messages reach everyone except blocked senders and self', () => {
    expect(shouldReceive(pkt({}), me, new Set())).toBe(true);
    expect(shouldReceive(pkt({}), me, new Set(['a']))).toBe(false);
    expect(shouldReceive(pkt({ from: 'b' }), me, new Set())).toBe(false);
  });
  it('near messages only within radius; whispers only to recipient', () => {
    expect(shouldReceive(pkt({ scope: 'near', x: NEAR_RADIUS - 1 }), me, new Set())).toBe(true);
    expect(shouldReceive(pkt({ scope: 'near', x: NEAR_RADIUS + 1 }), me, new Set())).toBe(false);
    expect(shouldReceive(pkt({ scope: 'whisper', to: 'b' }), me, new Set())).toBe(true);
    expect(shouldReceive(pkt({ scope: 'whisper', to: 'c' }), me, new Set())).toBe(false);
  });
});

describe('packet validation', () => {
  it('rejects malformed or oversized packets', () => {
    expect(validPos({ id: 'a', x: 1, z: 2, yaw: 0, zone: 'L02', pose: 'walk', t: 1 })).toBe(true);
    expect(validPos({ id: 'a', x: NaN, z: 2, yaw: 0, zone: 'L02', pose: 'walk' })).toBe(false);
    expect(validPos({ id: 'a', x: 1e6, z: 2, yaw: 0, zone: 'L02', pose: 'walk' })).toBe(false);
    expect(validChat(pkt({}))).toBe(true);
    expect(validChat(pkt({ text: 'x'.repeat(MSG_MAX + 1) }))).toBe(false);
    expect(validChat(pkt({ scope: 'admin' as never }))).toBe(false);
  });
});

describe('bandwidth budget (đo thực tế ~500 lượt nhận/giây)', () => {
  it('position rate keeps per-area deliveries under budget', () => {
    for (const n of [2, 5, 10, 20, 30]) { const hz = posHz(n); expect(hz).toBeLessThanOrEqual(8); expect(hz).toBeGreaterThanOrEqual(MIN_POS_HZ); if (hz > MIN_POS_HZ) expect(n * hz * (n - 1)).toBeLessThanOrEqual(AREA_DELIVERY_BUDGET + 1e-6); }
    const spread = [6, 6, 6, 6, 6]; const hz = posHzFor(spread);
    expect(spread.reduce((a, n) => a + n * hz * (n - 1), 0)).toBeLessThanOrEqual(AREA_DELIVERY_BUDGET + 1e-6);
    expect(30 * hz).toBeLessThanOrEqual(80 + 1e-6);
    expect(posHz(1)).toBe(8);
  });
  it('500 người / 5 phân khu: mỗi phòng chỉ dùng phần ngân sách theo tỉ lệ người, tổng gần mức đo tải', () => {
    expect(ROOMS.length * MAX_PLAYERS_PER_ROOM).toBe(500);
    const spread = [8, 8, 8, 8, 8]; // 40 người một phòng × 5 phòng = 200 người
    const hz = posHzFor(spread, 200);
    const roomDeliveries = spread.reduce((a, n) => a + n * hz * (n - 1), 0);
    expect(hz).toBeGreaterThan(MIN_POS_HZ);
    expect(roomDeliveries * 5).toBeLessThanOrEqual(GLOBAL_DELIVERY_BUDGET + 1e-6);
    expect(40 * hz * 5).toBeLessThanOrEqual(GLOBAL_SEND_BUDGET + 1e-6);
    expect(hz).toBeLessThan(posHzFor(spread)); // đông toàn hệ thống → gửi thưa hơn
    expect(posHzFor([20, 20, 20, 20, 20], 500)).toBe(MIN_POS_HZ); // 500 người: chạm sàn tần số (vượt mức đo tải)
    expect(posHzFor([3, 0, 0, 0, 0], 3)).toBe(posHzFor([3, 0, 0, 0, 0])); // ít người: không đổi
  });
  it('areas split the map with hysteresis at boundaries', () => {
    expect(areaOf(-100)).toBe(0); expect(areaOf(118)).toBe(4);
    expect(areaOf(-57 + 0.5)).toBe(1);
    expect(areaOf(-57 + 2, 0)).toBe(0); // trong vùng trễ vẫn giữ khu cũ
    expect(areaOf(-57 + 5, 0)).toBe(1);
  });
});

import { computeQueue, ONLINE_CAP, ONLINE_CAP_DEFAULT, type GateMeta } from '../src/online/queue';
describe('global cap & queue (trần 500, mặc định 50)', () => {
  const m = (id: string, state: GateMeta['state'], since: number): GateMeta => ({ id, state, since, room: 'r', name: id });
  it('trần 500, mặc định 50; free slots admit in arrival order', () => {
    expect(ONLINE_CAP).toBe(500);
    expect(ONLINE_CAP_DEFAULT).toBe(50);
    const all = [...Array.from({ length: 49 }, (_, i) => m(`p${i}`, 'playing', i)), m('q1', 'queued', 100), m('q2', 'queued', 200)];
    expect(computeQueue(all, 'q1', 50)).toMatchObject({ playing: 49, waiting: 2, position: 1, ahead: 0, admit: true });
    expect(computeQueue(all, 'q2', 50)).toMatchObject({ position: 2, ahead: 1, admit: false });
  });
  it('full server keeps everyone waiting; F5 duplicate counts once', () => {
    const all = [...Array.from({ length: 50 }, (_, i) => m(`p${i}`, 'playing', i)), m('q1', 'queued', 100), m('p0', 'queued', 300)];
    expect(computeQueue(all, 'q1', 50)).toMatchObject({ playing: 50, waiting: 1, admit: false });
  });
  it('cap 500: người thứ 500 vào được, người thứ 501 phải chờ', () => {
    const all = [...Array.from({ length: 499 }, (_, i) => m(`p${i}`, 'playing', i)), m('q1', 'queued', 1000), m('q2', 'queued', 2000)];
    expect(computeQueue(all, 'q1', ONLINE_CAP).admit).toBe(true);
    expect(computeQueue(all, 'q2', ONLINE_CAP).admit).toBe(false);
  });
  it('cap 500: người thứ 500 vào được, người thứ 501 phải chờ', () => {
    const all = [...Array.from({ length: 499 }, (_, i) => m(`p${i}`, 'playing', i)), m('q1', 'queued', 1000), m('q2', 'queued', 2000)];
    expect(computeQueue(all, 'q1', ONLINE_CAP).admit).toBe(true);
    expect(computeQueue(all, 'q2', ONLINE_CAP).admit).toBe(false);
  });
  it('ties broken deterministically by id', () => {
    const all = [m('b', 'queued', 5), m('a', 'queued', 5)];
    expect(computeQueue(all, 'a', 1).position).toBe(1);
    expect(computeQueue(all, 'b', 1).admit).toBe(false);
  });
});
