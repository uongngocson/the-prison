// CR-CONFLICT-01 đợt 3: ẩu đả trực tuyến giữa hai người chơi (mô phỏng hai máy, chuyển gói qua hộp thư đi).
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../src/domain/newgame';
import { GameSession } from '../src/simulation/session';
import { skipAdmission } from '../src/domain/life';
import { conflictChoose, conflictOutbox, conflictRemote, startPeerConflict, type OnlineOpponent } from '../src/domain/conflict';
import { validFight, validScene } from '../src/online/protocol';
import { MIN_PER_DAY } from '../src/domain/util';
import type { ConflictChoice } from '../src/domain/types';

const look = { body: 'medium' as const, skin: 1, hair: 1, hairColor: 0, outfit: 0 };
function player(name: string, seed: number, x: number, conflicts = true) {
  const s = createNewGame({ name, appearance: look, familyContext: 'family', seed }, `lin_${name}`);
  const g = new GameSession(s, { lightNeeds: false, autoComplete: false, dayLengthRealMin: 48, conflicts });
  g.exec((ctx) => skipAdmission(ctx, { familyContext: 'family' }));
  g.s.player.pos = { x, y: 0, z: -2 }; g.s.player.zone = 'L04'; g.s.player.lastSafe = { ...g.s.player.pos };
  return g;
}
const asOpp = (id: string, g: GameSession): OnlineOpponent => ({ id, name: g.s.character.name, look, outfit: 0, x: g.s.player.pos.x, z: g.s.player.pos.z, bot: false });
/** Chuyển hết gói trong hộp thư đi từ máy `from` sang máy `to` (và trả lời nếu có). */
function deliver(from: { id: string; g: GameSession }, to: { id: string; g: GameSession }) {
  while (conflictOutbox.length) {
    const m = conflictOutbox.shift()!;
    expect(validFight({ ...m, from: from.id, x: 0, z: 0 })).toBe(true);
    const reply = to.g.exec((ctx) => conflictRemote(ctx, asOpp(from.id, from.g), m.k, m.cid, m.at));
    if (reply) from.g.exec((ctx) => conflictRemote(ctx, asOpp(to.id, to.g), reply.k, reply.cid, reply.at));
  }
}
/** Chạy cả hai máy n giây thực; mỗi khung cập nhật vị trí đối thủ như controller. */
function run(A: { id: string; g: GameSession }, B: { id: string; g: GameSession }, sec: number) {
  for (let i = 0; i < sec * 30; i++) {
    for (const [me, other] of [[A, B], [B, A]] as const) {
      const c = me.g.s.conflict;
      if (c?.peer) { c.oppPos = { x: other.g.s.player.pos.x, z: other.g.s.player.pos.z }; c.oppSeen = me.g.s.tick; }
      me.g.update(1 / 30);
    }
    deliver(A, B); deliver(B, A);
  }
}
const act = (me: { id: string; g: GameSession }, other: { id: string; g: GameSession }, ch: ConflictChoice) => { me.g.exec((ctx) => conflictChoose(ctx, ch)); deliver(me, other); };

describe('ẩu đả trực tuyến (người chơi ↔ người chơi)', { timeout: 30000 }, () => {
  it('A gây sự, B ra tay trước → B khởi xướng (SHU), A đỡ đòn → tự vệ; hai máy cùng kết luận', () => {
    conflictOutbox.length = 0;
    const A = { id: 'p_a', g: player('An', 11, 84) }, B = { id: 'p_b', g: player('Bảo', 12, 85) };
    expect(A.g.exec((ctx) => startPeerConflict(ctx, asOpp(B.id, B.g)))).toBe(true);
    deliver(A, B);
    expect(A.g.s.conflict?.phase).toBe('tension');
    expect(B.g.s.conflict?.phase).toBe('tension');
    expect(B.g.s.conflict?.peer?.id).toBe(A.id);
    expect(B.g.s.conflict?.provokedBy).toBe('npc'); // phía B: đối phương gây sự
    act(B, A, 'strike');
    expect(B.g.s.conflict?.initiator).toBe('player');
    expect(A.g.s.conflict?.phase).toBe('brawl');
    expect(A.g.s.conflict?.initiator).toBe('npc');
    expect(A.g.s.conflict?.npcStrikes).toBe(1);
    act(A, B, 'block');
    run(A, B, 3);
    expect(A.g.s.conflict?.alarm).toBe(true);
    expect(A.g.s.conflict?.responders.length).toBe(4);
    run(A, B, 9);
    for (const g of [A.g, B.g]) if (g.s.conflict?.phase === 'restrain') g.exec((ctx) => conflictChoose(ctx, 'comply'));
    run(A, B, 8);
    expect(A.g.s.conflict).toBeNull();
    expect(B.g.s.conflict).toBeNull();
    expect(A.g.s.hold?.roomId).toBeTruthy();
    expect(B.g.s.hold?.roomId).toBeTruthy();
    const ra = A.g.s.conflicts!.at(-1)!, rb = B.g.s.conflicts!.at(-1)!;
    expect(ra.peerName).toBe('Bảo');
    expect(rb.peerName).toBe('An');
    // điều trần sau 1 ngày
    for (const g of [A.g, B.g]) g.fastForward(MIN_PER_DAY + 5, false);
    expect(A.g.s.conflicts!.find((r) => r.id === ra.id)!.verdict).toBe('self_defense');
    expect(B.g.s.conflicts!.find((r) => r.id === rb.id)!.verdict).toBe('initiator');
    expect(A.g.s.hold).toBeNull(); // tự vệ → về khu ở
    expect(B.g.s.hold?.untilMinute).toBeGreaterThan(B.g.s.minute); // khởi xướng → giữ thêm
  });

  it('hai bên cùng ra tay: người có đòn đầu sớm hơn là khởi xướng trên cả hai máy', () => {
    conflictOutbox.length = 0;
    const A = { id: 'p_a', g: player('An', 21, 84) }, B = { id: 'p_b', g: player('Bảo', 22, 85) };
    A.g.exec((ctx) => startPeerConflict(ctx, asOpp(B.id, B.g)));
    deliver(A, B);
    // A ra tay trước nhưng gói đến B sau khi B cũng đã bấm đánh (mạng trễ)
    A.g.exec((ctx) => conflictChoose(ctx, 'strike'));
    const aMsgs = conflictOutbox.splice(0);
    aMsgs[0].at -= 400; // A bấm sớm hơn 0,4 s
    B.g.exec((ctx) => conflictChoose(ctx, 'strike'));
    deliver(B, A);
    for (const m of aMsgs) B.g.exec((ctx) => conflictRemote(ctx, asOpp(A.id, A.g), m.k, m.cid, m.at));
    expect(A.g.s.conflict?.initiator).toBe('player');
    expect(B.g.s.conflict?.initiator).toBe('npc');
  });

  it('cả hai cùng “Nói hạ nhiệt” → kết thúc êm, không biên bản; một bên rời đi → bên kia cũng kết thúc', () => {
    conflictOutbox.length = 0;
    const A = { id: 'p_a', g: player('An', 31, 84) }, B = { id: 'p_b', g: player('Bảo', 32, 85) };
    A.g.exec((ctx) => startPeerConflict(ctx, asOpp(B.id, B.g))); deliver(A, B);
    act(B, A, 'calm');
    expect(A.g.s.conflict?.calmTheirs).toBe(true);
    expect(B.g.s.conflict).not.toBeNull(); // còn chờ A đồng ý
    act(A, B, 'calm');
    expect(A.g.s.conflict).toBeNull();
    expect(B.g.s.conflict).toBeNull();
    expect(A.g.s.conflicts!.at(-1)!.verdict).toBe('deescalated');
    expect(A.g.s.life.incidents.some((i) => i.ruleId === 'fight')).toBe(false);
    // lần hai: B bỏ đi
    A.g.exec((ctx) => startPeerConflict(ctx, asOpp(B.id, B.g))); deliver(A, B);
    act(B, A, 'leave');
    expect(A.g.s.conflict).toBeNull();
    expect(B.g.s.conflict).toBeNull();
  });

  it('người bị gây sự đã tắt “Nội dung xung đột” → tự từ chối, người gây sự nhận thông báo bận', () => {
    conflictOutbox.length = 0;
    const A = { id: 'p_a', g: player('An', 41, 84) }, B = { id: 'p_b', g: player('Bảo', 42, 85, false) };
    A.g.exec((ctx) => startPeerConflict(ctx, asOpp(B.id, B.g)));
    deliver(A, B);
    expect(B.g.s.conflict ?? null).toBeNull();
    expect(A.g.s.conflict).toBeNull();
  });

  it('gói cảnh hợp lệ / sai định dạng bị loại', () => {
    const actor = { id: 'kien', look, outfit: 'res', x: 1, z: 2, yaw: 0, pose: 'fight' };
    expect(validScene({ from: 'p', cid: 'c', zone: 'L04', phase: 'brawl', alarm: true, x: 0, z: 0, actors: [actor], t: 1 })).toBe(true);
    expect(validScene({ from: 'p', cid: 'c', zone: 'L04', phase: 'brawl', alarm: true, x: 0, z: 0, actors: Array(7).fill(actor), t: 1 })).toBe(false);
    expect(validFight({ from: 'a', to: 'b', cid: 'c', k: 'explode', at: 1, x: 0, z: 0 })).toBe(false);
  });
});
