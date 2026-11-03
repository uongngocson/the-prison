// CR-CONFLICT-01 đợt 1: căng thẳng → ẩu đả → báo động (nằm sấp) → đội phản ứng → khống chế → áp giải SHU → điều trần.
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../src/domain/newgame';
import { GameSession } from '../src/simulation/session';
import { skipAdmission } from '../src/domain/life';
import { activeOrder, homeRoom, shuOrder } from '../src/domain/custody';
import { RESPONDER_IDS, canConflict, conflictChoose, npcConflictRole, startNpcConflict, startPlayerConflict, verdictFor } from '../src/domain/conflict';
import { NPCS } from '../src/content/npcs';
import { MIN_PER_DAY } from '../src/domain/util';
import { validateSave } from '../src/persistence/saveCodec';
import type { ConflictChoice, ExperienceMode } from '../src/domain/types';

const look = { body: 'medium' as const, skin: 1, hair: 1, hairColor: 0, outfit: 0 };
function session(mode: ExperienceMode = 'vn_custody', conflicts = true) {
  const s = createNewGame({ name: 'An', appearance: look, familyContext: 'family', seed: 5, experienceMode: mode, presetId: mode === 'vn_custody' ? 'VN-T05Y' : undefined, segment: mode === 'vn_custody' ? 'intake' : undefined }, `lin_cf_${mode}`);
  const g = new GameSession(s, { lightNeeds: false, autoComplete: false, dayLengthRealMin: 48, conflicts });
  g.exec((ctx) => skipAdmission(ctx, { familyContext: 'family' }));
  // đặt người chơi cạnh một bạn tù ở hành lang, giờ hoạt động
  g.s.minute = Math.floor(g.s.minute / MIN_PER_DAY) * MIN_PER_DAY + 9 * 60 + 10;
  const npc = NPCS.find((n) => n.id === 'kien')!;
  const rt = g.s.npcs[npc.id];
  rt.pos = { x: -10, y: 0, z: 0 }; rt.zone = 'L03'; rt.path = [];
  g.s.player.pos = { x: -9, y: 0, z: 0 }; g.s.player.zone = 'L03'; g.s.player.mode = 'grounded'; g.s.player.action = null;
  return { g, npcId: npc.id };
}
const run = (g: GameSession, seconds: number) => { for (let i = 0; i < Math.round(seconds * 30); i++) g.update(1 / 30); };
const pick = (g: GameSession, c: ConflictChoice) => g.exec((ctx) => conflictChoose(ctx, c));

describe('xung đột / ẩu đả — đợt 1', { timeout: 30000 }, () => {
  it('người chơi gây sự rồi ra tay trước: báo động, đội phản ứng tới trong vài giây, áp giải vào SHU chờ điều tra, điều trần → SHU', () => {
    const { g, npcId } = session();
    expect(g.exec((ctx) => startPlayerConflict(ctx, npcId))).toBe(true);
    expect(g.s.conflict!.phase).toBe('tension');
    pick(g, 'strike');
    expect(g.s.conflict!.phase).toBe('brawl');
    expect(g.s.conflict!.initiator).toBe('player');
    run(g, 1.5);
    expect(g.s.conflict!.alarm).toBe(true);
    expect(g.s.conflict!.responders.length).toBe(4);
    run(g, 3);
    // đội phản ứng đã ở hiện trường (đứng quanh, không còn chạy)
    for (const id of RESPONDER_IDS) expect(g.s.npcs[id].path.length).toBe(0);
    expect(g.s.conflict!.phase).toBe('restrain');
    pick(g, 'comply');
    run(g, 7);
    expect(g.s.conflict ?? null).toBeNull();
    expect(g.s.custody!.phase).toBe('restrictive_housing');
    expect(shuOrder(g.s)!.reasonCode).toBe('ADSEG_PENDING_INVESTIGATION');
    expect(homeRoom(g.s)!.zone).toBe('L28');
    expect(g.s.life.incidents.some((i) => i.ruleId === 'fight')).toBe(true);
    expect(validateSave(g.s)).toBeNull();
    g.fastForward(MIN_PER_DAY + 10, false);
    const rec = g.s.conflicts!.find((r) => r.incidentId)!;
    expect(rec.verdict).toBe('initiator');
    const o = shuOrder(g.s)!;
    expect(o.reasonCode).toBe('SHU_FIGHT');
    expect(o.endMinute! - g.s.minute).toBeGreaterThan(6 * MIN_PER_DAY);
    expect(validateSave(g.s)).toBeNull();
  });

  it('NPC gây sự và ra tay trước, người chơi chỉ đỡ/thoát: tự vệ → chờ điều tra 1 ngày rồi về khu thường', () => {
    const { g, npcId } = session();
    g.exec((ctx) => startNpcConflict(ctx, npcId));
    run(g, 9.5); // hết giờ căng thẳng → NPC ra tay
    expect(g.s.conflict!.phase).toBe('brawl');
    expect(g.s.conflict!.initiator).toBe('npc');
    pick(g, 'block'); pick(g, 'break_away');
    run(g, 6);
    pick(g, 'comply');
    run(g, 7);
    expect(shuOrder(g.s)).not.toBeNull();
    g.fastForward(MIN_PER_DAY + 10, false);
    expect(g.s.conflicts!.find((r) => r.incidentId)!.verdict).toBe('self_defense');
    expect(shuOrder(g.s)).toBeNull();
    expect(homeRoom(g.s)!.zone).not.toBe('L28');
    expect(g.s.npcHolds?.[npcId]).toBeDefined(); // người khởi xướng vẫn ở SHU
  });

  it('đánh trả quá mức tự vệ → ẩu đả qua lại; không chấp hành lệnh → bị xịt hơi cay', () => {
    expect(verdictFor({ initiator: 'npc', playerStrikes: 4 })).toBe('mutual');
    expect(verdictFor({ initiator: 'npc', playerStrikes: 2 })).toBe('self_defense');
    const { g, npcId } = session();
    g.exec((ctx) => startNpcConflict(ctx, npcId));
    run(g, 9.5);
    for (let i = 0; i < 4; i++) pick(g, 'strike');
    run(g, 6);
    expect(g.s.conflict!.phase).toBe('restrain');
    run(g, 5.5); // không bấm chấp hành
    expect(g.s.conflict!.sprayed).toBe(true);
    run(g, 7);
    g.fastForward(MIN_PER_DAY + 10, false);
    const rec = g.s.conflicts!.find((r) => r.incidentId)!;
    expect(rec.verdict).toBe('mutual');
    expect(rec.sprayed).toBe(true);
  });

  it('báo động: bạn tù khác trong cùng khu nằm sấp', () => {
    const { g, npcId } = session();
    const other = NPCS.find((n) => n.role === 'resident' && n.id !== npcId && n.id !== 'tu')!;
    const rt = g.s.npcs[other.id];
    rt.absent = false; rt.pos = { x: -14, y: 0, z: 0.5 }; rt.zone = 'L03';
    g.exec((ctx) => startPlayerConflict(ctx, npcId));
    pick(g, 'shove');
    run(g, 1.6);
    expect(npcConflictRole(g.s, other.id)).toBe('prone');
    expect(g.s.npcs[other.id].activity).toBe('prone');
  });

  it('hạ nhiệt: rời đi khi mình gây sự / gọi cán bộ khi bị gây sự → không biên bản cho người chơi', () => {
    const a = session();
    a.g.exec((ctx) => startPlayerConflict(ctx, a.npcId));
    pick(a.g, 'leave');
    expect(a.g.s.conflict ?? null).toBeNull();
    expect(a.g.s.life.incidents.some((i) => i.ruleId === 'fight')).toBe(false);
    const b = session();
    b.g.exec((ctx) => startNpcConflict(ctx, b.npcId));
    pick(b.g, 'call_staff');
    expect(b.g.s.conflict ?? null).toBeNull();
    expect(b.g.s.npcHolds?.[b.npcId]).toBeDefined();
    expect(b.g.s.life.incidents.some((i) => i.ruleId === 'fight')).toBe(false);
    expect(activeOrder(b.g.s, 'restrictive_housing')).toBeNull();
  });

  it('chế độ Cốt truyện: bị giữ ở buồng SHU, chỉ đi lại trong buồng, hết hạn thì về khu ở', () => {
    const { g, npcId } = session('fictional_life');
    g.exec((ctx) => startPlayerConflict(ctx, npcId));
    pick(g, 'strike');
    run(g, 6); pick(g, 'comply'); run(g, 7);
    expect(g.s.hold).toBeTruthy();
    expect(g.s.player.zone).toBe('L28');
    g.fastForward(MIN_PER_DAY + 10, false);
    expect(g.s.hold!.untilMinute).toBeGreaterThan(g.s.minute); // khởi xướng → giữ thêm
    g.fastForward(3 * MIN_PER_DAY, false);
    expect(g.s.hold ?? null).toBeNull();
    expect(g.s.player.zone).toBe('L02');
  });

  it('tắt nội dung xung đột trong Cài đặt → không thể gây sự', () => {
    const { g, npcId } = session('vn_custody', false);
    expect(canConflict(g.ctx, npcId)).toMatch(/tắt/);
    expect(g.exec((ctx) => startPlayerConflict(ctx, npcId))).toBe(false);
  });
});
