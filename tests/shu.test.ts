// Biệt giam kiểu Mỹ (SHU): vào khu, ở buồng 23 giờ, áp giải theo lịch, step-down 3 cấp, vi phạm hạ cấp, chung thân xét lại, save hợp lệ.
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../src/domain/newgame';
import { GameSession } from '../src/simulation/session';
import { activeOrder, homeRoom, positionAllowed, shuActivityNow, shuOrder } from '../src/domain/custody';
import { custodyRoomAt, CUSTODY_ROOM_BY_ID } from '../src/content/world';
import { SHU_LEVELS, shuTotalDays } from '../src/content/custody';
import { absMinuteAt, MIN_PER_DAY } from '../src/domain/util';
import { validateSave } from '../src/persistence/saveCodec';
import { custodyHooks } from '../src/domain/life';
import type { IncidentReview } from '../src/domain/types';

const settings = { lightNeeds: false, autoComplete: false, dayLengthRealMin: 48 as const };
const look = { body: 'medium' as const, skin: 1, hair: 1, hairColor: 0, outfit: 0 };
function shuSession(presetId = 'VN-T05Y', seed = 7) {
  const s = createNewGame({ name: 'An', appearance: look, familyContext: 'family', seed, experienceMode: 'vn_custody', presetId, segment: 'shu' }, `lin_shu_${seed}`);
  return new GameSession(s, settings);
}
const inRoom = (g: GameSession) => custodyRoomAt(g.s.player.pos.x, g.s.player.pos.z);

describe('SHU — biệt giam kiểu Mỹ', { timeout: 30000 }, () => {
  it('bắt đầu trong buồng biệt giam L28, cửa thép đóng, không gặp trực tiếp, không tự đi ra hành lang', () => {
    const g = shuSession();
    const s = g.s;
    expect(s.custody!.phase).toBe('restrictive_housing');
    expect(shuOrder(s)).not.toBeNull();
    expect(s.custody!.shu!.level).toBe(1);
    expect(activeOrder(s, 'family_visit_restriction')).not.toBeNull();
    const room = homeRoom(s)!;
    expect(room.zone).toBe('L28');
    expect(room.cohort).toBe('shu');
    expect(s.player.zone).toBe('L28');
    expect(positionAllowed(s, 0, 0).ok).toBe(false); // hành lang chính
    expect(positionAllowed(s, -110, 0).reasonCode).toBe('SHU_ACTIVE'); // sàn sinh hoạt SHU ngoài buồng
  });

  it('đi lại được trong buồng SHU, không bị kéo về "vị trí an toàn" (khu nằm ngoài biên cũ x < -107)', () => {
    const g = shuSession();
    const start = { ...g.s.player.pos };
    const room = homeRoom(g.s)!;
    g.input.moveX = 0; g.input.moveZ = -1;
    for (let i = 0; i < 30; i++) g.update(1 / 30);
    g.input.moveZ = 0; g.input.moveX = 1;
    for (let i = 0; i < 30; i++) g.update(1 / 30);
    g.input.moveX = 0;
    expect(g.s.player.mode).not.toBe('recovering');
    expect(Math.hypot(g.s.player.pos.x - start.x, g.s.player.pos.z - start.z)).toBeGreaterThan(0.5);
    expect(custodyRoomAt(g.s.player.pos.x, g.s.player.pos.z)?.id).toBe(room.id);
  });

  it('09:00 được áp giải tới cũi thể dục, 10:00 áp giải về buồng; chỉ đứng được trong cũi', () => {
    const g = shuSession();
    g.fastForward(absMinuteAt(2, 905) - g.s.minute, false);
    expect(shuActivityNow(g.s)).toBe('rec');
    expect(inRoom(g)?.cohort).toBe('shu_rec');
    const cage = inRoom(g)!;
    expect(positionAllowed(g.s, cage.rect.x1 + 0.5, (cage.rect.z0 + cage.rect.z1) / 2).ok).toBe(false);
    g.fastForward(absMinuteAt(2, 1005) - g.s.minute, false);
    expect(shuActivityNow(g.s)).toBeNull();
    expect(inRoom(g)?.cohort).toBe('shu');
  });

  it('tắm ngày lẻ; sinh hoạt nhóm trong cũi trị liệu chỉ từ cấp 2', () => {
    const g = shuSession();
    g.fastForward(absMinuteAt(3, 1405) - g.s.minute, false); // ngày 3 (lẻ) — cấp 1
    expect(shuActivityNow(g.s)).toBe('shower');
    expect(inRoom(g)?.cohort).toBe('shu_shower');
    g.fastForward(absMinuteAt(4, 1505) - g.s.minute, false); // ngày 4 (chẵn), đã đủ 3 ngày → cấp 2
    expect(g.s.custody!.shu!.level).toBe(2);
    expect(shuActivityNow(g.s)).toBe('group');
    expect(inRoom(g)?.cohort).toBe('shu_module');
  });

  it('án có thời hạn: đủ 3 cấp thì về khu thường; save vẫn hợp lệ', () => {
    const g = shuSession();
    expect(validateSave(g.s)).toBeNull();
    g.fastForward(shuTotalDays() * MIN_PER_DAY + 30, false);
    expect(shuOrder(g.s)).toBeNull();
    expect(activeOrder(g.s, 'family_visit_restriction')).toBeNull();
    expect(g.s.custody!.phase).not.toBe('restrictive_housing');
    expect(homeRoom(g.s)!.zone).not.toBe('L28');
    expect(validateSave(g.s)).toBeNull();
  });

  it('vi phạm trong SHU: về cấp 1 và kéo dài thời hạn', () => {
    const g = shuSession();
    g.fastForward(4 * MIN_PER_DAY, false);
    expect(g.s.custody!.shu!.level).toBe(2);
    const before = shuOrder(g.s)!.endMinute!;
    const inc = { id: 'inc_shu', kind: 'conduct', ruleId: 't', state: 'decided', facts: [], responses: [], decision: '', history: [], canonicalKey: 'k', minute: g.s.minute, dueMinute: g.s.minute } as unknown as IncidentReview;
    g.exec((ctx) => custodyHooks.incidentDecided?.(ctx, inc));
    expect(g.s.custody!.shu!.level).toBe(1);
    expect(g.s.custody!.shu!.setbacks).toBe(1);
    expect(shuOrder(g.s)!.endMinute!).toBeGreaterThan(before);
  });

  it('chung thân: không có ngày ra SHU cố định — chỉ chuyển khu ở lần xét lại sau khi hoàn thành cấp 3', () => {
    const g = shuSession('VN-LIFE', 9);
    const o = shuOrder(g.s)!;
    expect(o.endMinute).toBeNull();
    expect(o.reviewAtMinute).not.toBeNull();
    g.fastForward(5 * MIN_PER_DAY + 10, false); // lần xét 1: mới cấp 2 → giữ lại
    expect(shuOrder(g.s)).not.toBeNull();
    const total = SHU_LEVELS.reduce((t, l) => t + l.days, 0);
    g.fastForward((total + 6) * MIN_PER_DAY, false);
    expect(shuOrder(g.s)).toBeNull();
    expect(CUSTODY_ROOM_BY_ID[homeRoom(g.s)!.id].cohort).toBe('B');
  });
});
