// CR-VN-01 (17 §4): sentence/classification, placement, confinement enforcement, orders, chapter vs release, save v3.
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../src/domain/newgame';
import { GameSession } from '../src/simulation/session';
import { skipAdmission } from '../src/domain/life';
import {
  addMonths, activeOrder, chapterEligible, classify, closeChapter, constrainMove, createCustodyState, homeRoom, issueOrder, positionAllowed, progress,
  termEndDate, validateSelection,
} from '../src/domain/custody';
import { CUSTODY_ROOM_BY_ID, custodyRoomAt, custodyRoomOfBed } from '../src/content/world';
import { SENTENCE_PRESETS, VN_PROFILE } from '../src/content/custody';
import { absMinuteAt, MIN_PER_DAY } from '../src/domain/util';
import { migrate, validateSave } from '../src/persistence/saveCodec';
import type { Judgment, StartSegment } from '../src/domain/types';

const settings = { lightNeeds: false, autoComplete: false, dayLengthRealMin: 48 as const };
const look = { body: 'medium' as const, skin: 1, hair: 1, hairColor: 0, outfit: 0 };
function vnSession(presetId: string, segment: StartSegment = 'intake', seed = 21) {
  const s = createNewGame({ name: 'An', appearance: look, familyContext: 'family', seed, experienceMode: 'vn_custody', presetId, segment }, `lin_vn_${seed}`);
  const g = new GameSession(s, settings);
  if (segment === 'intake') g.exec((ctx) => skipAdmission(ctx, { familyContext: 'family' }));
  return g;
}
const J = (p: Partial<Judgment>): Judgment => ({
  judgmentId: 'j', version: 1, sentenceKind: 'term', basis: 'single', declaredTermMonths: 60, calendarStart: '2026-07-01', creditedDays: 0, servedDaysAtStart: 0,
  dangerousRecidivism: false, sourceEventId: 't', amendments: [], scenarioReleaseDate: null, ...p,
});

describe('sentence selection & calendar (F61/F62)', () => {
  it('all presets validate on their declared segments; unknown preset/segment rejected', () => {
    for (const p of SENTENCE_PRESETS) for (const sg of p.segments) expect(validateSelection({ presetId: p.id, segment: sg }).ok).toBe(true);
    expect(validateSelection({ presetId: 'VN-T06M', segment: 'midway' }).ok).toBe(false);
    expect(validateSelection({ presetId: 'VN-DEATH', segment: 'intake' }).ok).toBe(false);
  });
  it('addMonths clamps to end of month; term end subtracts credited days once', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(termEndDate(J({ declaredTermMonths: 12, creditedDays: 30 }))).toBe('2027-06-01');
  });
  it('life sentence has no end date or countdown', () => {
    const g = vnSession('VN-LIFE');
    const pr = progress(g.s);
    expect(pr.endDate).toBeNull();
    expect(pr.remainingDays).toBeNull();
  });
});

describe('classification boundaries (F63, 14 §3)', () => {
  it('exactly 15 years → A; 15 years + 1 month → B; life → B', () => {
    expect(classify(J({ declaredTermMonths: 180 }), 0, false).group).toBe('A');
    expect(classify(J({ declaredTermMonths: 181 }), 0, false).group).toBe('B');
    expect(classify(J({ sentenceKind: 'life', declaredTermMonths: null }), 0, false).group).toBe('B');
  });
  it('reduction without decision stays B; with decision and remaining < 15y → A', () => {
    const j = J({ declaredTermMonths: 240, servedDaysAtStart: 2191, amendments: [{ version: 2, minute: 0, kind: 'reduction', months: 30, decisionRef: 'd', note: '', supersedes: 1 }] });
    expect(classify(j, 0, false).group).toBe('B');
    expect(classify(j, 0, true).group).toBe('A');
  });
  it('dangerous recidivism → B unless half served + reduced + decision', () => {
    expect(classify(J({ declaredTermMonths: 60, dangerousRecidivism: true }), 0, true).group).toBe('B');
  });
});

describe('placement & confinement (F63/F64)', () => {
  it('intake places 5-year sentence in group A room, 20-year in group B room', () => {
    const a = vnSession('VN-T05Y', 'intake', 31);
    expect(homeRoom(a.s)?.cohort).toBe('A');
    const b = vnSession('VN-T20Y', 'intake', 32);
    expect(homeRoom(b.s)?.cohort).toBe('B');
    expect(createCustodyState('x', { presetId: 'VN-T20Y', segment: 'intake' }, 0).classification[0].group).toBe('B');
  });
  it('night confinement blocks real movement input out of the room', () => {
    const g = vnSession('VN-T05Y', 'intake', 33);
    g.fastForward(absMinuteAt(1, 2300) - g.s.minute, false);
    const room = homeRoom(g.s)!;
    g.s.player.pos = { x: room.anchor.x, y: 0, z: room.anchor.z };
    g.s.player.zone = room.zone;
    const dx = room.door.x - room.anchor.x, dz = room.door.z - room.anchor.z;
    const L = Math.hypot(dx, dz);
    // Đẩy tiếp ra ngoài cửa 3 giây thực tế
    g.input = { moveX: dx / L, moveZ: dz / L, run: true, crouch: false, camYaw: 0 };
    for (let i = 0; i < 90; i++) g.update(1 / 30);
    expect(custodyRoomAt(g.s.player.pos.x, g.s.player.pos.z)?.id).toBe(room.id);
    expect(g.s.custody!.phase).toBe('night_confinement');
    expect(g.s.notifications.some((n) => n.text.includes('buồng'))).toBe(true);
  });
  it('constrainMove refuses entering another cohort wing during activity', () => {
    const g = vnSession('VN-T05Y', 'intake', 34);
    g.fastForward(absMinuteAt(1, 900) + MIN_PER_DAY - g.s.minute, false);
    const other = CUSTODY_ROOM_BY_ID.vnB_1;
    expect(positionAllowed(g.s, other.anchor.x, other.anchor.z).ok).toBe(false);
    const r = constrainMove(g.s, { x: other.door.x, z: other.door.z - other.inward * 2 }, { x: other.anchor.x, z: other.anchor.z });
    expect(custodyRoomAt(r.x, r.z)?.id).not.toBe(other.id);
  });
});

describe('orders (F66/F67)', () => {
  it('discipline order ≤ 10 days, no duplicate per source; expiry returns to housing', () => {
    const g = vnSession('VN-T05Y', 'intake', 41);
    const base = { reasonCode: 'TEST', issuerRole: 'facility_head', reviewAtMinute: null, roomId: null, returnHousingRef: null, supersedes: null, note: '' } as const;
    const s0 = g.s.minute;
    expect(g.exec((ctx) => issueOrder(ctx, { ...base, kind: 'discipline_confinement', sourceDecisionId: 'inc_x', startMinute: s0, endMinute: s0 + 11 * MIN_PER_DAY }))).toBeNull();
    const o = g.exec((ctx) => issueOrder(ctx, { ...base, kind: 'discipline_confinement', sourceDecisionId: 'inc_x', startMinute: s0, endMinute: s0 + 2 * MIN_PER_DAY }));
    expect(o).not.toBeNull();
    expect(g.exec((ctx) => issueOrder(ctx, { ...base, kind: 'discipline_confinement', sourceDecisionId: 'inc_x', startMinute: s0, endMinute: s0 + MIN_PER_DAY }))).toBeNull();
    expect(homeRoom(g.s)?.cohort).toBe('discipline');
    expect(g.s.custody!.phase).toBe('disciplinary_confinement');
    g.fastForward(2 * MIN_PER_DAY + 5, false);
    expect(activeOrder(g.s, 'discipline_confinement')).toBeNull();
    expect(homeRoom(g.s)?.cohort).toBe('A');
    expect(custodyRoomOfBed(g.s.life.housing.find((h) => h.state === 'active')!.bedSlotId)?.cohort).toBe('A');
  });
  it('discipline demo segment starts confined with separate visit restriction', () => {
    const g = vnSession('VN-T03M', 'discipline_demo', 42);
    expect(activeOrder(g.s, 'discipline_confinement')).not.toBeNull();
    expect(activeOrder(g.s, 'family_visit_restriction')).not.toBeNull();
    expect(custodyRoomAt(g.s.player.pos.x, g.s.player.pos.z)?.cohort).toBe('discipline');
  });
});

describe('chapter vs release (F70)', () => {
  it('closing chapter does not release; life sentence never release_due', () => {
    const g = vnSession('VN-LIFE', 'intake', 51);
    g.s.quests.Q06 = { state: 'active', stage: 0, done: {}, choices: {}, counts: {} };
    g.fastForward(absMinuteAt(7, 1000) - g.s.minute, false);
    expect(chapterEligible(g.s)).toBe(true);
    expect(g.exec((ctx) => closeChapter(ctx)).ok).toBe(true);
    expect(g.s.life.episode.state).toBe('admitted');
    expect(g.s.custody!.releaseState).toBe('serving');
    expect(g.s.ended).toBe(false);
  });
});

describe('save v3 (F72)', () => {
  it('v3 VN save validates and round-trips; pinned policy hash mismatch rejected', () => {
    const g = vnSession('VN-T05Y', 'intake', 61);
    g.fastForward(120, false);
    const parsed = JSON.parse(JSON.stringify(g.s));
    expect(validateSave(parsed)).toBeNull();
    const bad = JSON.parse(JSON.stringify(g.s));
    bad.custody.scenarioRef.hash = 'tampered';
    expect(validateSave(bad)).not.toBeNull();
  });
  it('v2 save migrates to v3 fictional_life without assigning a sentence', () => {
    const s = createNewGame({ name: 'An', appearance: look, familyContext: 'family', seed: 3 }, 'lin_v2');
    const v2 = JSON.parse(JSON.stringify(s));
    v2.schemaVersion = 2; delete v2.experienceMode; delete v2.custody;
    expect(validateSave(v2)).toBeNull();
    const m = migrate(v2);
    expect(m.schemaVersion).toBe(3);
    expect(m.experienceMode).toBe('fictional_life');
    expect(m.custody).toBeNull();
  });
  it('policy profile is pinned in new VN state', () => {
    const g = vnSession('VN-T01Y', 'intake', 62);
    expect(g.s.custody!.scenarioRef.hash).toBe(VN_PROFILE.hash);
  });
});
