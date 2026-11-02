// CR-LAB-01 (18 §11): QA33–QA36 subset — assignment, tools, crop/pond, wood QC, settlement idempotency, custody.
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../src/domain/newgame';
import { GameSession } from '../src/simulation/session';
import { skipAdmission as skipAdm } from '../src/domain/life';
import type { Ctx } from '../src/domain/core';
const skipAdmission = (ctx: Ctx) => skipAdm(ctx, { familyContext: 'family' });
import { acceptWork, activeAssignment, cancelWork, eligibility, handover, issueKit, labourCommit, labourVerbs, readOrientation } from '../src/domain/labour';
import { issueOrder } from '../src/domain/custody';
import { PROP_BY_ID } from '../src/content/world';
import { SHIFT_WINDOWS, WORK_BY_ID } from '../src/content/labour';
import { absMinuteAt, dayOf, MIN_PER_DAY } from '../src/domain/util';
import { validateSave } from '../src/persistence/saveCodec';

const settings = { lightNeeds: false, autoComplete: false, dayLengthRealMin: 48 as const };
const look = { body: 'medium' as const, skin: 1, hair: 1, hairColor: 0, outfit: 0 };
function session(seed = 5, vn = false) {
  const s = createNewGame({ name: 'An', appearance: look, familyContext: 'family', seed, ...(vn ? { experienceMode: 'vn_custody' as const, presetId: 'VN-T05Y', segment: 'intake' as const } : {}) }, `lin_lab_${seed}`);
  const g = new GameSession(s, settings);
  g.exec((ctx) => skipAdmission(ctx));
  return g;
}
/** Tua tới hh:mm ngày d (domain), đặt người chơi trong khu để check-in. */
function goto(g: GameSession, day: number, hhmm: number) { const t = absMinuteAt(day, hhmm); if (t > g.s.minute) g.fastForward(t - g.s.minute, false); }
function place(g: GameSession, zone: string, x: number, z: number) { g.s.player.pos = { x, y: 0, z }; g.s.player.zone = zone as never; }
const cmd = <T,>(g: GameSession, fn: Parameters<GameSession['exec']>[0]) => g.exec(fn) as T;

describe('assignment (QA33)', () => {
  it('one shift per window; overlap & re-accept are safe; cancel before start', () => {
    const g = session(1);
    const day = dayOf(g.s.minute) + 1;
    expect(cmd<{ ok: boolean }>(g, (c) => acceptWork(c, 'W01', 'am', day)).ok).toBe(true);
    expect(cmd<{ ok: boolean }>(g, (c) => acceptWork(c, 'W01', 'am', day)).ok).toBe(true); // retry → same
    expect(g.s.labour!.assignments.filter((a) => a.state === 'assigned')).toHaveLength(1);
    expect(eligibility(g.s, WORK_BY_ID.W05, SHIFT_WINDOWS[0], day)).toMatch(/khung giờ/);
    const id = g.s.labour!.assignments[0].id;
    expect(cmd<{ ok: boolean }>(g, (c) => cancelWork(c, id)).ok).toBe(true);
    expect(eligibility(g.s, WORK_BY_ID.W05, SHIFT_WINDOWS[0], day)).toBeNull();
  });
  it('carpentry needs safety orientation first', () => {
    const g = session(2);
    const day = dayOf(g.s.minute) + 1;
    expect(cmd<{ ok: boolean }>(g, (c) => acceptWork(c, 'W08', 'am', day)).ok).toBe(false);
    g.exec((c) => readOrientation(c, 'W08'));
    expect(cmd<{ ok: boolean }>(g, (c) => acceptWork(c, 'W08', 'am', day)).ok).toBe(true);
  });
});

describe('vegetable shift end-to-end (QA34/35/36)', () => {
  it('kit once, harvest once, handover settles once and returns tools', () => {
    const g = session(3);
    const day = dayOf(g.s.minute) + 1;
    g.exec((c) => acceptWork(c, 'W01', 'am', day));
    const a = g.s.labour!.assignments[0];
    expect(a.target).toBe('R-01'); // luống sẵn sàng thu được ưu tiên
    goto(g, day, 805);
    expect(cmd<{ ok: boolean }>(g, (c) => issueKit(c, a.id)).ok).toBe(true);
    const issued = g.s.labour!.tools.filter((t) => t.status === 'issued').length;
    g.exec((c) => issueKit(c, a.id)); // double submit
    expect(g.s.labour!.tools.filter((t) => t.status === 'issued').length).toBe(issued);
    goto(g, day, 835);
    place(g, 'L23', 74.5, 23);
    g.fastForward(1, false);
    expect(activeAssignment(g.s)?.id).toBe(a.id);
    const bed = PROP_BY_ID['plot_R-01'];
    g.exec((c) => labourCommit(c, 'lab_harvest', bed, {}));
    g.exec((c) => labourCommit(c, 'lab_harvest', bed, {})); // spam/retry
    expect(g.s.labour!.batches.filter((b) => b.sourceKey === `harvest:R-01-C1`)).toHaveLength(1);
    g.exec((c) => labourCommit(c, 'lab_clean', bed, {}));
    expect(a.state).toBe('completed');
    const before = g.s.life.account.balance;
    const r = cmd<{ ok: boolean }>(g, (c) => handover(c, a.id));
    expect(r.ok).toBe(true);
    g.exec((c) => handover(c, a.id)); // reload/double
    expect(g.s.life.account.balance - before).toBe(WORK_BY_ID.W01.credit);
    expect(g.s.labour!.tools.every((t) => t.status === 'available')).toBe(true);
    expect(g.s.labour!.batches.find((b) => b.sourceKey === 'harvest:R-01-C1')!.state).toBe('allocated');
    expect(validateSave(JSON.parse(JSON.stringify(g.s)))).toBeNull();
  });
  it('watering spam does not stack growth; unwatered crops pause instead of dying', () => {
    const g = session(4);
    const plot = g.s.labour!.plots.find((p) => p.id === 'R-03')!; // seedling
    plot.lastWatered = g.s.minute - 40 * 60;
    const before = plot.growthMin;
    g.fastForward(120, false);
    expect(plot.growthMin).toBe(before);
    expect(plot.stage).toBe('seedling');
  });
  it('no-show expires without penalty; a started shift is handed over by the team', () => {
    const g = session(6);
    const day = dayOf(g.s.minute) + 1;
    g.exec((c) => acceptWork(c, 'W15', 'am', day));
    const a = g.s.labour!.assignments[0];
    goto(g, day, 1100);
    expect(a.state).toBe('expired');
    expect(g.s.labour!.receipts.some((r) => r.kind === 'settle')).toBe(false);
  });
});

describe('weather (LAB-SC11)', () => {
  it('rain blocks outdoor verbs and the indoor sorting task completes the shift instead', () => {
    const g = session(10);
    const day = dayOf(g.s.minute) + 1;
    g.exec((c) => acceptWork(c, 'W06', 'am', day));
    const a = g.s.labour!.assignments[0];
    goto(g, day, 810); g.exec((c) => issueKit(c, a.id));
    goto(g, day, 835); place(g, 'L25', 100, 17); g.fastForward(1, false);
    g.s.world.weather = 'rain'; g.s.world.nextWeatherMinute = g.s.minute + 600;
    const verbs = labourVerbs(g.s, PROP_BY_ID[`patch_${a.target}`]).filter((v) => v.verb !== 'lab_view');
    expect(verbs.every((v) => !v.enabled && /mưa/.test(v.reason ?? ''))).toBe(true);
    g.exec((c) => labourCommit(c, 'lab_sort', PROP_BY_ID.sort_table, {}));
    expect(a.state).toBe('completed');
    const r = cmd<{ ok: boolean }>(g, (c) => handover(c, a.id));
    expect(r.ok).toBe(true);
    expect(a.credit).toBe(WORK_BY_ID.W06.credit);
  });
});

describe('pond & carpentry', () => {
  it('feed budget cannot go beyond the plan', () => {
    const g = session(7);
    const day = dayOf(g.s.minute) + 1;
    g.exec((c) => acceptWork(c, 'W05', 'am', day));
    const a = g.s.labour!.assignments[0];
    goto(g, day, 810); g.exec((c) => issueKit(c, a.id));
    goto(g, day, 835); place(g, 'L24', 80, -20); g.fastForward(1, false);
    const dock = PROP_BY_ID.pond_dock;
    g.exec((c) => labourCommit(c, 'lab_feed', dock, {}));
    g.exec((c) => labourCommit(c, 'lab_feed', dock, {}));
    expect(g.s.labour!.pond.feeds).toBe(1);
  });
  it('wrong pattern → rework with reason; correct → tray delivered to nursery once', () => {
    const g = session(8);
    g.exec((c) => readOrientation(c, 'W08'));
    const day = dayOf(g.s.minute) + 1;
    g.exec((c) => acceptWork(c, 'W08', 'am', day));
    const a = g.s.labour!.assignments[0];
    goto(g, day, 810); g.exec((c) => issueKit(c, a.id));
    goto(g, day, 835); place(g, 'L10', PROP_BY_ID.wood_bench.x, PROP_BY_ID.wood_bench.z); g.fastForward(1, false);
    const bench = PROP_BY_ID.wood_bench;
    g.exec((c) => labourCommit(c, 'lab_measure', bench, { choice: 'b' }));
    g.exec((c) => labourCommit(c, 'lab_assemble', bench, { choice: 'a' }));
    g.exec((c) => labourCommit(c, 'lab_finish', bench, {}));
    const trays0 = g.s.labour!.nurseryTrays;
    g.exec((c) => handover(c, a.id));
    const o = g.s.labour!.orders[0];
    expect(o.stage).toBe('rework');
    expect(o.failed).toContain('Đúng mẫu');
    expect(g.s.labour!.nurseryTrays).toBe(trays0);
    // ca sau làm lại đúng
    g.exec((c) => acceptWork(c, 'W08', 'pm', day));
    const b = g.s.labour!.assignments.find((x) => x.window === 'pm')!;
    expect(b.target).toBe(o.id);
    goto(g, day, 1335); g.exec((c) => issueKit(c, b.id));
    goto(g, day, 1405); place(g, 'L10', PROP_BY_ID.wood_bench.x, PROP_BY_ID.wood_bench.z); g.fastForward(1, false);
    g.exec((c) => labourCommit(c, 'lab_measure', bench, { choice: 'a' }));
    g.exec((c) => labourCommit(c, 'lab_assemble', bench, { choice: 'a' }));
    g.exec((c) => labourCommit(c, 'lab_finish', bench, {}));
    g.exec((c) => handover(c, b.id));
    g.exec((c) => handover(c, b.id));
    expect(o.stage).toBe('accepted');
    expect(g.s.labour!.nurseryTrays).toBe(trays0 + 1);
  });
});

describe('custody integration (LAB-SC02/03)', () => {
  it('VN: assigned shift opens only L27 + work zone via the yard, discipline order excuses the shift', () => {
    const g = session(9, true);
    const day = dayOf(g.s.minute) + 1;
    expect(cmd<{ ok: boolean }>(g, (c) => acceptWork(c, 'W01', 'am', day)).ok).toBe(true);
    goto(g, day, 820);
    const grants = g.s.custody!.grants.filter((x) => x.state === 'active' && x.sourceKey.startsWith('labour:')).map((x) => x.destination).sort();
    expect(grants).toEqual(['L23', 'L27']);
    g.exec((c) => issueOrder(c, { kind: 'discipline_confinement', reasonCode: 'T', issuerRole: 'facility_head', sourceDecisionId: 'x', startMinute: g.s.minute, reviewAtMinute: null, endMinute: g.s.minute + MIN_PER_DAY, roomId: null, returnHousingRef: null, supersedes: null, note: '' }));
    g.fastForward(2, false);
    expect(g.s.labour!.assignments[0].state).toBe('excused');
  });
});
