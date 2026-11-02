// CR-VN-01 custody domain (14/16): judgment, classification, housing placement, orders, movement evaluator,
// phase cycle, chapter/release split. One clock, one state, one ledger — không tạo simulation thứ hai.
import type { ClassificationDecision, CustodyOrder, CustodyPhase, CustodyState, GameState, IncidentReview, Judgment, MovementGrant, PlacementGroup, StartSegment, ZoneId } from './types';
import { type Ctx, changeNeed, notify } from './core';
import { CUSTODY_ROOMS, CUSTODY_ROOM_BY_ID, custodyRoomAt, custodyRoomOfBed, zoneAt, type CustodyRoomDef, type PropDef } from '../content/world';
import { CUSTODY_SCHEDULE, PHASE_LABEL, PRESET_BY_ID, REASON_TEXT, VN_PROFILE, type CustodyWindow } from '../content/custody';
import { NPCS } from '../content/npcs';
import { MEALS } from '../content/schedule';
import { PROGRAM_BY_ID } from '../content/life';
import { collectOrders, currentBed, custodyHooks, sessionNow, skipAdmission } from './life';
import { dayOf, fmtClock, fmtDayClock, hm, minuteOfDay, MIN_PER_DAY, pushBounded } from './util';

export const WING_ZONES: ZoneId[] = ['L19', 'L20', 'L21', 'L22'];
export const isVN = (s: GameState) => s.experienceMode === 'vn_custody' && !!s.custody;

// ======================= Calendar (date-only, không quy tháng = 30 ngày) =======================
const pad = (n: number) => String(n).padStart(2, '0');
export function parseDate(d: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) throw new Error('Ngày không hợp lệ');
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}
const toUTC = (d: string) => { const [y, m, dd] = parseDate(d); return Date.UTC(y, m - 1, dd); };
const fromUTC = (t: number) => { const x = new Date(t); return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`; };
export function addDays(d: string, n: number): string { return fromUTC(toUTC(d) + n * 86400000); }
export function daysBetween(a: string, b: string): number { return Math.round((toUTC(b) - toUTC(a)) / 86400000); }
/** Cộng tháng theo lịch; ngày cuối tháng kẹp về ngày cuối của tháng đích (31/1 + 1 tháng = 28/29/2). */
export function addMonths(d: string, months: number): string {
  const [y, m, dd] = parseDate(d);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${pad(nm + 1)}-${pad(Math.min(dd, last))}`;
}
export function dateOfDay(j: Judgment, day: number): string { return addDays(j.calendarStart, day - 1); }
export function fmtDate(d: string): string { const [y, m, dd] = parseDate(d); return `${pad(dd)}/${pad(m)}/${y}`; }

// ======================= Sentence validation (F61) =======================
export interface SentenceSelection { presetId: string; segment: StartSegment }
export function validateSelection(sel: Partial<SentenceSelection>): { ok: true; code?: undefined } | { ok: false; code: string; message: string } {
  const p = sel.presetId ? PRESET_BY_ID[sel.presetId] : undefined;
  if (!p) return { ok: false, code: 'INVALID_SENTENCE', message: 'Hãy chọn một mức án trong danh mục.' };
  if (p.kind === 'term') {
    const m = p.months;
    if (m === null || !Number.isInteger(m) || m < 3) return { ok: false, code: 'INVALID_SENTENCE', message: 'Thời hạn phải là số tháng nguyên từ 3 tháng.' };
    if (p.basis === 'single' && m > 240) return { ok: false, code: 'INVALID_SENTENCE', message: 'Một tội: tối đa 240 tháng (20 năm).' };
    if (m > 360) return { ok: false, code: 'INVALID_SENTENCE', message: 'Tổng hợp: tối đa 360 tháng (30 năm).' };
  } else if (p.months !== null) return { ok: false, code: 'INVALID_SENTENCE', message: 'Chung thân không có thời hạn.' };
  if (!sel.segment || !p.segments.includes(sel.segment)) return { ok: false, code: 'UNSUPPORTED_SCENARIO', message: 'Điểm bắt đầu này chưa hỗ trợ cho mức án đã chọn.' };
  return { ok: true };
}
/** Custom months (U36 nâng cao) — chưa mở trên UI vì generator chưa qua QA; validator dùng chung để chặn ở domain. */
export function validateCustomMonths(months: unknown, basis: 'single' | 'aggregate'): string | null {
  if (typeof months !== 'number' || !Number.isFinite(months) || !Number.isInteger(months)) return 'Thời hạn phải là số tháng nguyên.';
  if (months < 3) return 'Tối thiểu 3 tháng.';
  if (basis === 'single' && months > 240) return 'Một tội: tối đa 240 tháng.';
  if (months > 360) return 'Tối đa 360 tháng (án tổng hợp).';
  return null;
}

// ======================= Judgment & progress (F62) =======================
export function effectiveMonths(j: Judgment): number | null {
  if (j.sentenceKind === 'life' || j.declaredTermMonths === null) return null;
  return j.declaredTermMonths - j.amendments.filter((a) => a.kind === 'reduction').reduce((t, a) => t + a.months, 0);
}
/** Ngày hết hạn dự kiến (lịch kịch bản). Mốc tính = ngày bắt đầu − thời gian đã chấp hành/tạm giam, không cộng hai lần. */
export function termEndDate(j: Judgment): string | null {
  const months = effectiveMonths(j);
  if (months === null) return null;
  const origin = addDays(j.calendarStart, -(j.servedDaysAtStart + j.creditedDays));
  return addMonths(origin, months);
}
export function releaseDay(j: Judgment): number | null {
  const end = termEndDate(j);
  return end ? daysBetween(j.calendarStart, end) + 1 : null;
}
export function progress(s: GameState) {
  const c = s.custody!;
  const j = c.judgment;
  const day = dayOf(s.minute);
  const today = dateOfDay(j, day);
  const served = j.servedDaysAtStart + j.creditedDays + (day - 1);
  const end = termEndDate(j);
  return { today, served, endDate: end, remainingDays: end ? Math.max(0, daysBetween(today, end)) : null, effectiveMonths: effectiveMonths(j) };
}
export function sentenceLabel(j: Judgment): string {
  if (j.sentenceKind === 'life') return 'Chung thân';
  const m = j.declaredTermMonths ?? 0;
  const t = m % 12 === 0 ? `${m / 12} năm` : `${m} tháng`;
  return j.basis === 'aggregate' ? `${t} (án tổng hợp)` : t;
}

// ======================= Classification (F63, 14 §3) =======================
export function classify(j: Judgment, minute: number, hasDecision: boolean): { group: PlacementGroup; reasonCode: string } {
  if (!j || (j.sentenceKind === 'term' && (j.declaredTermMonths === null || !Number.isInteger(j.declaredTermMonths))) || (j.sentenceKind === 'life' && j.declaredTermMonths !== null)) return { group: 'review_required', reasonCode: 'POLICY_REVIEW_REQUIRED' };
  if (j.sentenceKind === 'life') return { group: 'B', reasonCode: 'LIFE_SENTENCE' };
  const reduced = j.amendments.some((a) => a.kind === 'reduction');
  const today = dateOfDay(j, dayOf(minute));
  const end = termEndDate(j)!;
  const remainingUnder15 = end < addMonths(today, 180); // "dưới 15 năm": bằng đúng 15 năm KHÔNG đạt
  if (j.dangerousRecidivism) {
    const total = daysBetween(addDays(j.calendarStart, -(j.servedDaysAtStart + j.creditedDays)), addMonths(addDays(j.calendarStart, -(j.servedDaysAtStart + j.creditedDays)), j.declaredTermMonths!));
    const served = j.servedDaysAtStart + j.creditedDays + dayOf(minute) - 1;
    if (served * 2 >= total && reduced && hasDecision) return { group: 'A', reasonCode: 'RECIDIVISM_HALF_REDUCED_DECISION' };
    return { group: 'B', reasonCode: 'DANGEROUS_RECIDIVISM' };
  }
  if (j.declaredTermMonths! > 180) {
    if (reduced && remainingUnder15 && hasDecision) return { group: 'A', reasonCode: 'REDUCED_UNDER_15_DECISION' };
    return { group: 'B', reasonCode: 'OVER_15_YEARS' };
  }
  return { group: 'A', reasonCode: 'NOT_OVER_15_YEARS' };
}
export function currentGroup(s: GameState): PlacementGroup { return s.custody?.classification[s.custody.classification.length - 1]?.group ?? 'review_required'; }

// ======================= State creation (API14) =======================
let seq = 0;
const cid = (p: string, s: GameState) => `${p}_${s.tick.toString(36)}${(seq++).toString(36)}`;

export function createCustodyState(lineageId: string, sel: SentenceSelection, startMinute: number): CustodyState {
  const v = validateSelection(sel);
  if (!v.ok) throw new Error(`${v.code}: ${v.message}`);
  const p = PRESET_BY_ID[sel.presetId];
  const servedDaysAtStart = sel.segment === 'midway' ? 2191 : 0;
  const judgment: Judgment = {
    judgmentId: `jd_${lineageId}`, version: 1, sentenceKind: p.kind, basis: p.basis, declaredTermMonths: p.months, calendarStart: VN_PROFILE.calendarStart,
    creditedDays: p.creditedDays, servedDaysAtStart, dangerousRecidivism: false, sourceEventId: `scenario:${p.id}`, amendments: [], scenarioReleaseDate: null,
  };
  judgment.scenarioReleaseDate = termEndDate(judgment);
  const cls = classify(judgment, startMinute, false);
  const decision: ClassificationDecision = { decisionId: `cd_${lineageId}_1`, group: cls.group, reasonCode: cls.reasonCode, judgmentVersion: 1, issuerRole: 'classification_board', validFromMinute: startMinute, policyRef: `${VN_PROFILE.id}@${VN_PROFILE.version}`, supersedes: null };
  // NPC cellmates: Tư ở cùng buồng người chơi; các cư dân khác lấp giường theo cohort (dữ liệu bố trí, không phải nhóm xã hội).
  const residents = NPCS.filter((n) => n.role === 'resident' && n.id !== 'tu' && n.id !== 'long');
  const playerRoom = cls.group === 'B' ? 'vnB_2' : 'vnA_2';
  const npcBeds: Record<string, string> = { tu: `${playerRoom}_bed_b` };
  let k = 0;
  for (const r of CUSTODY_ROOMS.filter((x) => x.cohort === 'A' || x.cohort === 'B')) {
    for (const bed of r.beds) {
      if (bed === `${playerRoom}_bed_a` || bed === `${playerRoom}_bed_b`) continue;
      const npc = residents[k++];
      if (npc) npcBeds[npc.id] = bed;
    }
  }
  return {
    mode: 'vn_custody', scenarioRef: { id: `${VN_PROFILE.id}:${p.id}:${sel.segment}`, version: VN_PROFILE.version, hash: VN_PROFILE.hash }, presetId: p.id, startSegment: sel.segment,
    judgment, classification: [decision], orders: [], grants: [], phase: 'intake', phaseSinceMinute: startMinute, revision: 1, journal: [], sourceKeys: [],
    chapter: { state: 'active', closedMinute: null }, releaseState: 'serving', npcBeds, disciplineHistory: [],
  };
}

// ======================= Journal (DB50) =======================
function once(c: CustodyState, key: string) { if (c.sourceKeys.includes(key)) return false; c.sourceKeys.push(key); return true; }
export function journal(ctx: Ctx, kind: string, reasonCode: string, summary: string, key?: string) {
  const c = ctx.s.custody!;
  c.revision++;
  pushBounded(c.journal, { eventId: cid('cj', ctx.s), canonicalSourceKey: key ?? `${kind}:${ctx.s.tick}`, kind, minute: ctx.s.minute, revision: c.revision, reasonCode, summary }, 120);
  ctx.emit({ type: 'lifeUpdated', domain: 'custody' });
}

// ======================= Rooms & location =======================
export function housingRoom(s: GameState): CustodyRoomDef | null { return custodyRoomOfBed(currentBed(s)); }
export function activeOrder(s: GameState, kind: CustodyOrder['kind']): CustodyOrder | null {
  return s.custody?.orders.find((o) => o.kind === kind && o.state === 'active') ?? null;
}
/** Phòng hiện tại có hiệu lực: lệnh kỷ luật/bố trí riêng có roomId ưu tiên hơn buồng ở. */
export function homeRoom(s: GameState): CustodyRoomDef | null {
  const d = activeOrder(s, 'discipline_confinement') ?? activeOrder(s, 'separation');
  if (d?.roomId) return CUSTODY_ROOM_BY_ID[d.roomId] ?? null;
  return housingRoom(s);
}
export function homeBed(s: GameState): string | null {
  const d = activeOrder(s, 'discipline_confinement') ?? activeOrder(s, 'separation');
  if (d?.roomId) return CUSTODY_ROOM_BY_ID[d.roomId]?.beds[0] ?? null;
  return currentBed(s);
}
function freeRoom(s: GameState, cohort: CustodyRoomDef['cohort']): CustodyRoomDef | null {
  for (const r of CUSTODY_ROOMS.filter((x) => x.cohort === cohort)) {
    const taken = s.custody!.orders.some((o) => o.state === 'active' && o.roomId === r.id);
    if (!taken) return r;
  }
  return null;
}
/** Giường tương thích nhóm (F63/F69) — không fallback sang cohort khác. */
export function compatibleBed(s: GameState, group: PlacementGroup, excludeRoom?: string): string | null {
  if (group !== 'A' && group !== 'B') return null;
  const used = new Set<string>([...Object.values(s.custody?.npcBeds ?? {}), ...s.life.housing.filter((h) => h.state === 'active' || h.state === 'reserved').map((h) => h.bedSlotId)]);
  const preferred = group === 'B' ? 'vnB_2' : 'vnA_2';
  const rooms = CUSTODY_ROOMS.filter((r) => r.cohort === group && r.id !== excludeRoom).sort((a, b) => (a.id === preferred ? -1 : b.id === preferred ? 1 : 0));
  for (const r of rooms) for (const b of r.beds) if (!used.has(b)) return b;
  // Giải phóng giường của một NPC cùng cohort (chuyển NPC sang cánh khác — trừu tượng) thay vì nhét người chơi sang cohort khác.
  for (const r of rooms) for (const b of r.beds) {
    const npc = Object.entries(s.custody?.npcBeds ?? {}).find(([, bed]) => bed === b && b.endsWith('_bed_a'));
    if (npc && npc[0] !== 'tu') { delete s.custody!.npcBeds[npc[0]]; return b; }
  }
  return null;
}
/** Đưa người chơi tới điểm neo buồng (chuyển trừu tượng có phép, có checkpoint) — không phải teleport tự do, không tạo vi phạm. */
export function escortToRoom(ctx: Ctx, room: CustodyRoomDef, reason: string) {
  const s = ctx.s;
  s.player.action = null;
  s.player.seatedAt = null;
  if (s.player.mode !== 'sleeping') s.player.mode = 'grounded';
  s.player.pos = { x: room.anchor.x, y: 0, z: room.anchor.z };
  s.player.lastSafe = { ...s.player.pos };
  s.player.zone = room.zone;
  s.player.yaw = room.inward === 1 ? 0 : Math.PI;
  if (!s.discoveredZones.includes(room.zone)) s.discoveredZones.push(room.zone);
  for (const g of s.custody!.grants) if (g.state === 'active' && g.purpose === 'return') g.state = 'used';
  journal(ctx, 'escort', 'TRANSITION', `${reason} → ${room.label}`);
}

// ======================= Phase & windows (F65) =======================
export function windowAt(s: GameState, minute = s.minute): CustodyWindow {
  const g = currentGroup(s) === 'B' ? 'B' : 'A';
  const m = minuteOfDay(minute);
  return CUSTODY_SCHEDULE[g].find((w) => m >= w.from && m < w.to) ?? CUSTODY_SCHEDULE[g][0];
}
export function nextWindow(s: GameState): CustodyWindow & { at: number } {
  const g = currentGroup(s) === 'B' ? 'B' : 'A';
  const m = minuteOfDay(s.minute);
  const list = CUSTODY_SCHEDULE[g];
  const cur = windowAt(s);
  const later = list.filter((w) => w.from > m && w.kind !== cur.kind)[0] ?? list.filter((w) => w.kind !== cur.kind)[0];
  const at = s.minute - m + (later.from > m ? later.from : later.from + MIN_PER_DAY);
  return { ...later, at };
}
export function computePhase(s: GameState): CustodyPhase {
  const c = s.custody!;
  if (c.releaseState === 'released' || s.life.episode.state === 'released') return 'released';
  if (s.life.episode.state !== 'admitted') return 'intake';
  if (activeOrder(s, 'discipline_confinement')) return 'disciplinary_confinement';
  if (activeOrder(s, 'separation')) return 'separate_housing';
  if (s.life.transitions.some((t) => t.kind === 'room_move' && ['staged', 'in_transit'].includes(t.state))) return 'transfer_pending';
  const w = windowAt(s);
  const care = activeGrants(s).find((g) => g.purpose === 'booking' && g.destination === 'L08');
  if (care) return 'care_transfer';
  if (w.kind === 'night') return 'night_confinement';
  if (w.kind === 'cell') {
    if (activeGrants(s).some((g) => g.purpose === 'return')) return 'returning';
    return 'in_cell';
  }
  return 'authorized_activity';
}
const CONFINED: CustodyPhase[] = ['in_cell', 'night_confinement', 'disciplinary_confinement', 'separate_housing', 'transfer_pending'];
export const isConfinedPhase = (p: CustodyPhase) => CONFINED.includes(p);

// ======================= Grants (DB49) =======================
export function activeGrants(s: GameState): MovementGrant[] {
  return (s.custody?.grants ?? []).filter((g) => g.state === 'active' && s.minute >= g.validFromMinute && s.minute < g.validUntilMinute);
}
function ensureGrant(ctx: Ctx, purpose: MovementGrant['purpose'], destination: ZoneId, from: number, until: number, sourceKey: string) {
  const c = ctx.s.custody!;
  if (c.grants.some((g) => g.sourceKey === sourceKey)) return;
  c.grants.push({ grantId: cid('gr', ctx.s), purpose, destination, validFromMinute: from, validUntilMinute: until, state: 'active', sourceKey });
  c.revision++;
}
function refreshGrants(ctx: Ctx) {
  const s = ctx.s;
  const c = s.custody!;
  // booking-linked grants (care/legal/call/visit/support): chuyển có phép trong khung hẹn
  for (const b of s.life.bookings) {
    if (!['booked', 'waiting', 'active'].includes(b.state)) continue;
    if (s.minute >= b.start - 20 && s.minute < b.end) {
      if (b.kind === 'visit' && activeOrder(s, 'family_visit_restriction')) continue;
      ensureGrant(ctx, 'booking', b.zone, b.start - 20, b.end + 15, `booking:${b.id}`);
    }
  }
  // program sessions (học/làm) được phân công
  for (const e of s.life.programs) {
    if (!['enrolled', 'in_progress'].includes(e.state)) continue;
    const key = sessionNow(s, e.programId);
    if (!key) continue;
    const p = PROGRAM_BY_ID[e.programId];
    const day0 = s.minute - minuteOfDay(s.minute);
    ensureGrant(ctx, 'program', p.zone, day0 + p.from - 15, day0 + p.to + 10, `program:${key}`);
  }
  if (c.releaseState === 'release_due') {
    const day0 = s.minute - minuteOfDay(s.minute);
    ensureGrant(ctx, 'release', 'L18', day0 + hm(8), day0 + hm(17), `release:${dayOf(s.minute)}`);
  }
  for (const g of c.grants) if (g.state === 'active' && s.minute >= g.validUntilMinute) g.state = 'expired';
  if (c.grants.length > 60) c.grants = c.grants.filter((g) => g.state === 'active').concat(c.grants.filter((g) => g.state !== 'active').slice(-30));
}

// ======================= Evaluator (API15 / 16 §4) =======================
export interface Eval { ok: boolean; reasonCode?: string; method?: 'self' | 'authorized_movement' | 'at_room' | 'abstract' | 'not_available' }
export function allowedZones(s: GameState): Set<ZoneId> {
  const c = s.custody!;
  const phase = c.phase;
  const home = homeRoom(s);
  const out = new Set<ZoneId>();
  const grants = activeGrants(s).filter((g) => g.purpose !== 'escort');
  if (phase === 'released') return new Set(['L18', 'L01', 'L03']);
  if (phase === 'intake') return new Set(['L01']);
  const addGrantPath = () => { for (const g of grants) out.add(g.destination); if (grants.length) { out.add('L03'); if (home) out.add(home.zone); } };
  if (phase === 'disciplinary_confinement' || phase === 'separate_housing') { addGrantPath(); return out; }
  if (isConfinedPhase(phase)) { addGrantPath(); return out; }
  if (phase === 'returning') { out.add('L03'); if (home) out.add(home.zone); out.add(s.player.zone); return out; }
  for (const z of windowAt(s).zones) out.add(z);
  out.add('L03');
  if (home) out.add(home.zone);
  addGrantPath();
  return out;
}
export function positionAllowed(s: GameState, x: number, z: number): Eval {
  if (!isVN(s)) return { ok: true };
  const c = s.custody!;
  if (c.phase === 'released') return { ok: true };
  const room = custodyRoomAt(x, z);
  const home = homeRoom(s);
  if (room) {
    if (home && room.id === home.id) return { ok: true, method: 'self' };
    return { ok: false, reasonCode: room.cohort === 'A' || room.cohort === 'B' ? (home && room.zone === home.zone ? 'OTHER_ROOM' : 'DIFFERENT_COHORT') : 'AUTHORIZATION_REQUIRED' };
  }
  const zone = zoneAt(x, z);
  if (!zone) return { ok: true };
  const zones = allowedZones(s);
  if (zones.has(zone)) {
    if (WING_ZONES.includes(zone) && home && zone !== home.zone) return { ok: false, reasonCode: 'DIFFERENT_COHORT' };
    return { ok: true, method: c.phase === 'authorized_activity' ? 'self' : 'authorized_movement' };
  }
  if (c.phase === 'intake') return { ok: false, reasonCode: 'INTAKE_ONLY' };
  if (c.phase === 'disciplinary_confinement') return { ok: false, reasonCode: 'DISCIPLINE_ORDER_ACTIVE' };
  if (c.phase === 'separate_housing') return { ok: false, reasonCode: 'SEPARATION_ACTIVE' };
  if (c.phase === 'transfer_pending') return { ok: false, reasonCode: 'TRANSITION_PENDING' };
  if (isConfinedPhase(c.phase)) return { ok: false, reasonCode: 'ROOM_CONFINEMENT' };
  if (WING_ZONES.includes(zone)) return { ok: false, reasonCode: 'DIFFERENT_COHORT' };
  return { ok: false, reasonCode: 'AUTHORIZATION_REQUIRED' };
}
/** Movement crossing check with axis slide. Returns the accepted next position. */
export function constrainMove(s: GameState, from: { x: number; z: number }, to: { x: number; z: number }): { x: number; z: number; denied?: string } {
  if (!isVN(s)) return to;
  const a = positionAllowed(s, to.x, to.z);
  if (a.ok) return to;
  const fromOk = positionAllowed(s, from.x, from.z).ok;
  if (!fromOk) {
    // Đang ở ngoài phạm vi (vd. hết giờ hoạt động): chỉ cho đi trong khu hiện tại, hành lang và khu ở — đường về.
    const zt = zoneAt(to.x, to.z);
    const home = homeRoom(s);
    const roomT = custodyRoomAt(to.x, to.z);
    if (roomT && (!home || roomT.id !== home.id)) return { ...from, denied: 'OTHER_ROOM' };
    if (!zt || zt === s.player.zone || zt === 'L03' || (home && zt === home.zone)) return to;
    return { ...from, denied: a.reasonCode };
  }
  const xOnly = { x: to.x, z: from.z };
  if (positionAllowed(s, xOnly.x, xOnly.z).ok) return { ...xOnly, denied: a.reasonCode };
  const zOnly = { x: from.x, z: to.z };
  if (positionAllowed(s, zOnly.x, zOnly.z).ok) return { ...zOnly, denied: a.reasonCode };
  return { ...from, denied: a.reasonCode };
}
export function propAllowed(s: GameState, p: PropDef): Eval {
  if (!isVN(s)) return { ok: true };
  const room = custodyRoomAt(p.x, p.z);
  const home = homeRoom(s);
  if (room) return home && room.id === home.id ? { ok: true, method: 'self' } : { ok: false, reasonCode: 'OTHER_ROOM' };
  return positionAllowed(s, p.x, p.z);
}
export function evalService(s: GameState, kind: 'visit' | 'letter' | 'call' | 'care' | 'legal' | 'support' | 'help' | 'store'): Eval {
  if (!isVN(s)) return { ok: true };
  if (kind === 'visit' && activeOrder(s, 'family_visit_restriction')) return { ok: false, reasonCode: 'FAMILY_VISIT_RESTRICTED', method: 'not_available' };
  if (kind === 'letter' || kind === 'help' || kind === 'store') return { ok: true, method: 'at_room' };
  if (kind === 'care' || kind === 'legal' || kind === 'support') return { ok: true, method: 'authorized_movement' };
  return { ok: true, method: 'authorized_movement' };
}
export const reasonText = (code?: string) => (code ? REASON_TEXT[code] ?? code : '');

// ======================= Orders (F66/F67) =======================
export function issueOrder(ctx: Ctx, o: Omit<CustodyOrder, 'orderId' | 'state'>): CustodyOrder | null {
  const s = ctx.s;
  const c = s.custody!;
  if (o.kind === 'discipline_confinement') {
    if (o.endMinute === null || o.endMinute <= o.startMinute) return null;
    if (o.endMinute - o.startMinute > VN_PROFILE.disciplineMaxDays * MIN_PER_DAY) return null; // ≤10 ngày
    if (c.orders.some((x) => x.kind === 'discipline_confinement' && x.sourceDecisionId === o.sourceDecisionId)) return null; // không nối lén cùng sự việc
  }
  const order: CustodyOrder = { ...o, orderId: cid('od', s), state: 'active' };
  if (order.kind !== 'family_visit_restriction' && !order.roomId) {
    const room = freeRoom(s, order.kind === 'discipline_confinement' ? 'discipline' : 'separate');
    if (!room) return null;
    order.roomId = room.id;
  }
  if (order.kind !== 'family_visit_restriction') order.returnHousingRef = currentBed(s);
  c.orders.push(order);
  journal(ctx, 'order_active', order.reasonCode, `${orderKindLabel(order.kind)} có hiệu lực${order.endMinute ? ` đến ${fmtDayClock(order.endMinute)}` : ''}`, `order:${order.orderId}`);
  if (order.roomId) escortToRoom(ctx, CUSTODY_ROOM_BY_ID[order.roomId], orderKindLabel(order.kind));
  updatePhase(ctx, true);
  return order;
}
export function orderKindLabel(k: CustodyOrder['kind']) {
  return k === 'discipline_confinement' ? 'Quyết định buồng kỷ luật' : k === 'separation' ? 'Bố trí riêng' : 'Hạn chế gặp người thân';
}
function completeOrder(ctx: Ctx, o: CustodyOrder, how: 'expired' | 'revoked') {
  const s = ctx.s;
  if (o.state !== 'active' && o.state !== 'suspended') return;
  o.state = how;
  journal(ctx, `order_${how}`, how === 'expired' ? 'ORDER_EXPIRED' : 'ORDER_REVOKED', `${orderKindLabel(o.kind)} ${how === 'expired' ? 'hết hiệu lực' : 'được hủy bỏ'}`, `order_end:${o.orderId}`);
  if (o.roomId) {
    const back = homeRoom({ ...s, custody: { ...s.custody!, orders: s.custody!.orders.filter((x) => x !== o) } } as GameState) ?? housingRoom(s);
    o.state = 'completed';
    if (back) {
      const inRoom = custodyRoomAt(s.player.pos.x, s.player.pos.z);
      if (!inRoom || inRoom.id === o.roomId) escortToRoom(ctx, back, 'Trở về buồng ở');
    }
  } else o.state = 'completed';
  notify(ctx, `${orderKindLabel(o.kind)} ${how === 'expired' ? 'đã hết hiệu lực' : 'đã được hủy'}.`, 'info', 'life');
  updatePhase(ctx, true);
}
export function revokeOrdersFor(ctx: Ctx, sourceDecisionId: string) {
  for (const o of ctx.s.custody?.orders ?? []) if (o.sourceDecisionId === sourceDecisionId && o.state === 'active') completeOrder(ctx, o, 'revoked');
}

/** F66: VN policy ladder [D]. Allegation → decided only when life.advanceIncidents đã xác lập; không suy từ uy tín. */
function onIncidentDecided(ctx: Ctx, inc: IncidentReview): boolean {
  const s = ctx.s;
  const c = s.custody!;
  const recent = c.disciplineHistory.filter((h) => s.minute - h.minute < 30 * MIN_PER_DAY).length;
  const level: 'reprimand' | 'warning' | 'confinement' = recent === 0 ? 'reprimand' : recent === 1 ? 'warning' : 'confinement';
  c.disciplineHistory.push({ minute: s.minute, level, incidentId: inc.id });
  if (level === 'reprimand') inc.decision = 'Khiển trách (hư cấu). Không ảnh hưởng ăn uống, vệ sinh, chăm sóc, liên lạc hay quyền khiếu nại.';
  else if (level === 'warning') inc.decision = 'Cảnh cáo (hư cấu). Không chuyển buồng; quyền tối thiểu giữ nguyên.';
  else {
    const order = issueOrder(ctx, { kind: 'discipline_confinement', reasonCode: 'REPEATED_VIOLATION', issuerRole: 'facility_head', sourceDecisionId: inc.id, startMinute: s.minute, reviewAtMinute: null, endMinute: s.minute + 3 * MIN_PER_DAY, roomId: null, returnHousingRef: null, supersedes: null, note: 'Vi phạm lặp lại trong 30 ngày (trình tự rút gọn của game).' });
    if (order) {
      issueOrder(ctx, { kind: 'family_visit_restriction', reasonCode: 'IN_DISCIPLINE_CELL', issuerRole: 'facility_head', sourceDecisionId: inc.id, startMinute: s.minute, reviewAtMinute: order.endMinute, endMinute: order.endMinute! + 2 * MIN_PER_DAY, roomId: null, returnHousingRef: null, supersedes: null, note: 'Không gặp người thân khi ở buồng kỷ luật; xem xét lại sau khi hết lệnh (hư cấu).' });
      inc.decision = `Buồng kỷ luật 3 ngày (đến ${fmtDayClock(order.endMinute!)}), có dịch vụ tại buồng và quyền xin xem xét lại.`;
    } else inc.decision = 'Cảnh cáo — chưa đủ điều kiện thực hiện buồng kỷ luật (không có chỗ phù hợp).';
  }
  inc.consequence = undefined;
  journal(ctx, 'discipline_decision', level.toUpperCase(), inc.decision, `disc:${inc.id}`);
  return true;
}

// ======================= Phase update & minute tick =======================
export function updatePhase(ctx: Ctx, announce = false) {
  const s = ctx.s;
  const c = s.custody!;
  const next = computePhase(s);
  if (next === c.phase) return;
  const prev = c.phase;
  c.phase = next;
  c.phaseSinceMinute = s.minute;
  c.revision++;
  if (announce || prev !== 'intake') {
    const w = windowAt(s);
    const text = next === 'authorized_activity' ? `${PHASE_LABEL[next]}: ${w.label} (đến ${fmtClock(w.to % MIN_PER_DAY)}).` : next === 'returning' ? 'Hết giờ — hãy về buồng.' : `${PHASE_LABEL[next]}.`;
    notify(ctx, text, next === 'returning' ? 'warning' : 'info', 'life');
  }
  ctx.emit({ type: 'lifeUpdated', domain: 'custody' });
}

/** Called once per game minute by the session (and repeatedly during fast-forward) — due queue theo thứ tự ổn định. */
export function custodyTick(ctx: Ctx) {
  const s = ctx.s;
  if (!isVN(s)) return;
  const c = s.custody!;
  const day = dayOf(s.minute);
  const m = minuteOfDay(s.minute);
  // 1) decision/order changes
  for (const o of [...c.orders]) {
    if (o.state !== 'active') continue;
    if (o.endMinute !== null && s.minute >= o.endMinute) completeOrder(ctx, o, 'expired');
    else if (o.kind === 'separation' && o.reviewAtMinute !== null && s.minute >= o.reviewAtMinute) {
      journal(ctx, 'order_review', 'REVIEW_COMPLETED', 'Xem xét bố trí riêng: không còn căn cứ tiếp tục (kịch bản).', `review:${o.orderId}`);
      completeOrder(ctx, o, 'expired');
    }
  }
  scenarioEvents(ctx);
  // release projection (không do XP/goal)
  const rd = releaseDay(c.judgment);
  if (c.releaseState === 'serving' && rd !== null && day >= rd && once(c, 'release_due')) {
    c.releaseState = 'release_due';
    journal(ctx, 'release_due', 'TERM_END_REACHED', `Đến mốc hết hạn chấp hành án theo kịch bản (${fmtDate(termEndDate(c.judgment)!)}).`);
    notify(ctx, 'Đã mãn hạn! Đến khu Chuẩn bị ra (L18) để rời cơ sở.', 'success', 'life', true);
  }
  // 2) housing/movement reconciliation
  refreshGrants(ctx);
  const before = c.phase;
  const nextPhase = computePhase(s);
  const playerOk = positionAllowed({ ...s, custody: { ...c, phase: nextPhase } } as GameState, s.player.pos.x, s.player.pos.z).ok;
  if (!playerOk && s.life.episode.state === 'admitted' && (isConfinedPhase(nextPhase) || nextPhase === 'returning')) {
    const home = homeRoom(s);
    const ret = c.grants.find((g) => g.purpose === 'return' && g.state === 'active');
    if (!ret && home && nextPhase !== 'disciplinary_confinement' && nextPhase !== 'separate_housing' && before !== 'intake') {
      ensureGrant(ctx, 'return', home.zone, s.minute, s.minute + 45, `return:${day}:${m}`);
    } else if (home && (!ret || s.minute >= ret.validUntilMinute || s.player.mode === 'sleeping')) {
      escortToRoom(ctx, home, 'Cán bộ hỗ trợ về buồng (không ghi nhận vi phạm)');
      notify(ctx, 'Đã được đưa về buồng.', 'info', 'life');
    }
  } else if (playerOk) {
    for (const g of c.grants) if (g.purpose === 'return' && g.state === 'active') {
      const home = homeRoom(s);
      const inHome = home && custodyRoomAt(s.player.pos.x, s.player.pos.z)?.id === home.id;
      if (inHome || !isConfinedPhase(nextPhase)) g.state = 'used';
    }
  }
  updatePhase(ctx);
  // 3) services at room: suất ăn đưa tới buồng khi đang bị giới hạn ra khỏi buồng
  const confinedNoMeal = c.phase === 'disciplinary_confinement' || c.phase === 'separate_housing' || c.phase === 'transfer_pending';
  for (const meal of MEALS) {
    const key = `${day}:${meal.id}`;
    if (confinedNoMeal && m === meal.from + 30 && !s.mealClaims[key]) {
      s.mealClaims[key] = true;
      changeNeed(ctx, 'hunger', 35, 'Suất ăn tại buồng');
      notify(ctx, `${meal.label} được đưa tới buồng.`, 'info', 'life');
    }
  }
  // đơn hàng sẵn sàng được giao tới buồng lúc 12:00 (phương thức at_room) — không debit hai lần
  if (m === hm(12) && s.life.orders.some((o) => o.state === 'ready')) {
    const n = collectOrders(ctx);
    if (n) notify(ctx, 'Đơn hàng đã được giao tới buồng.', 'info', 'life');
  }
}

/** Scenario-authored events (đoạn giữa): giảm án có quyết định + quyết định phân loại → saga chuyển khu. */
function scenarioEvents(ctx: Ctx) {
  const s = ctx.s;
  const c = s.custody!;
  if (c.startSegment !== 'midway') return;
  const day = dayOf(s.minute);
  const m = minuteOfDay(s.minute);
  if (day >= 2 && m >= hm(8) && once(c, 'midway:reduction')) {
    const j = c.judgment;
    j.amendments.push({ version: j.version + 1, minute: s.minute, kind: 'reduction', months: 30, decisionRef: 'scenario:reduction-1', note: 'Quyết định giảm thời hạn chấp hành án 30 tháng (kịch bản hư cấu).', supersedes: j.version });
    j.version++;
    journal(ctx, 'judgment_amended', 'REDUCTION', 'Có quyết định giảm 30 tháng (kịch bản). Bản án đã tuyên giữ nguyên trong hồ sơ.');
    notify(ctx, 'Bạn được giảm án! Xem trong Chế độ (G).', 'info', 'life', true);
  }
  if (day >= 2 && m >= hm(9) && c.sourceKeys.includes('midway:reduction') && once(c, 'midway:reclass')) {
    const r = classify(c.judgment, s.minute, true);
    const head = c.classification[c.classification.length - 1];
    if (r.group !== head.group) {
      c.classification.push({ decisionId: cid('cd', s), group: r.group, reasonCode: r.reasonCode, judgmentVersion: c.judgment.version, issuerRole: 'classification_board', validFromMinute: s.minute, policyRef: `${VN_PROFILE.id}@${VN_PROFILE.version}`, supersedes: head.decisionId });
      journal(ctx, 'classification', r.reasonCode, `Quyết định phân loại mới: nhóm ${r.group}.`);
      const from = currentBed(s);
      const to = compatibleBed(s, r.group);
      if (from && to) {
        s.life.transitions.push({ id: cid('tr', s), kind: 'room_move', state: 'proposed', fromAnchor: from, toAnchor: to, minute: s.minute, sourceActionId: `reclass:${head.decisionId}`, packingConfirmed: false });
        notify(ctx, `Được chuyển sang khu ${r.group}. Xác nhận ở Đời sống › Chuyển nơi.`, 'info', 'life', true);
      }
    } else journal(ctx, 'classification_review', 'NO_CHANGE', 'Xem xét phân loại: giữ nguyên nhóm hiện tại.');
  }
}

// ======================= Scenario segment init (idempotent) =======================
export function initSegment(ctx: Ctx) {
  const s = ctx.s;
  const c = s.custody;
  if (!c || c.sourceKeys.includes('segment_init')) return;
  c.sourceKeys.push('segment_init');
  journal(ctx, 'scenario_start', 'SCENARIO', `Bắt đầu: ${PRESET_BY_ID[c.presetId].label} · ${c.startSegment}`);
  if (c.startSegment === 'intake') { updatePhase(ctx); return; }
  skipAdmission(ctx, { familyContext: s.life.episode.familyContext });
  if (c.startSegment === 'discipline_demo') {
    const inc: IncidentReview = {
      id: 'inc_demo', kind: 'conduct', ruleId: 'demo_conflict', state: 'decided', facts: [{ text: 'Tranh cãi gây mất trật tự tại khu sinh hoạt (sự việc hư cấu, kịch bản minh họa)', provenance: 'Biên bản kịch bản', confidence: 0.9 }],
      responses: [], decision: 'Buồng kỷ luật 2 ngày (kịch bản minh họa).', history: [{ minute: s.minute, actorRole: 'facility_head', text: 'Quyết định kỷ luật (kịch bản minh họa).', state: 'answered' }], canonicalKey: 'demo:discipline', minute: s.minute, dueMinute: s.minute,
    };
    s.life.incidents.push(inc);
    c.disciplineHistory.push({ minute: s.minute, level: 'confinement', incidentId: inc.id });
    const o = issueOrder(ctx, { kind: 'discipline_confinement', reasonCode: 'SCENARIO_ILLUSTRATION', issuerRole: 'facility_head', sourceDecisionId: inc.id, startMinute: s.minute, reviewAtMinute: null, endMinute: s.minute + 2 * MIN_PER_DAY, roomId: null, returnHousingRef: null, supersedes: null, note: 'Kịch bản minh họa; bản án không thay đổi.' });
    if (o) issueOrder(ctx, { kind: 'family_visit_restriction', reasonCode: 'IN_DISCIPLINE_CELL', issuerRole: 'facility_head', sourceDecisionId: inc.id, startMinute: s.minute, reviewAtMinute: o.endMinute, endMinute: o.endMinute! + 2 * MIN_PER_DAY, roomId: null, returnHousingRef: null, supersedes: null, note: 'Hạn chế gặp người thân có thời hạn riêng (hư cấu).' });
  }
  if (c.startSegment === 'separation_demo') {
    issueOrder(ctx, { kind: 'separation', reasonCode: 'SUPPORT_SEPARATION', issuerRole: 'facility_head', sourceDecisionId: 'scenario:separation', startMinute: s.minute, reviewAtMinute: s.minute + 3 * MIN_PER_DAY, endMinute: null, roomId: null, returnHousingRef: null, supersedes: null, note: 'Bố trí riêng để bảo đảm an toàn (thiết kế hư cấu, không phải kỷ luật).' });
  }
  updatePhase(ctx);
}

// ======================= Chapter / release (F70) =======================
export function chapterEligible(s: GameState): boolean { return isVN(s) && dayOf(s.minute) >= 7 && s.quests.Q06?.state === 'active'; }
export function closeChapter(ctx: Ctx): { ok: boolean; message: string } {
  const s = ctx.s;
  const c = s.custody;
  if (!c) return { ok: false, message: 'Không áp dụng.' };
  if (!chapterEligible(s)) return { ok: false, message: 'Chưa tới mốc kết thúc chương.' };
  if (!once(c, 'chapter:1')) return { ok: true, message: REASON_TEXT.CHAPTER_ONLY };
  c.chapter = { state: 'recap', closedMinute: s.minute };
  s.flags.chapter_closed = true;
  journal(ctx, 'chapter_end', 'CHAPTER_ONLY', 'Kết thúc chương 1 — nhân vật vẫn tiếp tục chấp hành án.');
  ctx.emit({ type: 'flag', key: 'chapter_closed', value: true });
  return { ok: true, message: REASON_TEXT.CHAPTER_ONLY };
}
export function markReleased(ctx: Ctx) {
  const c = ctx.s.custody;
  if (!c) return;
  c.releaseState = 'released';
  c.phase = 'released';
  journal(ctx, 'release', 'RELEASED', 'Rời cơ sở theo sự kiện hết hạn chấp hành án (kịch bản).');
}

// ======================= Load-time resolution (F71) =======================
/** Sau khi tải: xử lý mốc đến hạn, tính pha, đặt lại vị trí nếu không hợp lệ — không cấp quyền tự do một frame. */
export function resolveOnLoad(ctx: Ctx) {
  const s = ctx.s;
  if (!isVN(s)) return;
  initSegment(ctx);
  custodyTick(ctx);
  updatePhase(ctx);
  if (!positionAllowed(s, s.player.pos.x, s.player.pos.z).ok && s.life.episode.state === 'admitted' && s.custody!.phase !== 'returning') {
    const home = homeRoom(s);
    if (home) escortToRoom(ctx, home, 'Khôi phục vị trí hợp lệ khi tải');
  }
}

/** Cửa buồng có đóng (hiển thị)? Cửa vật lý là trình bày; quyền do evaluator quyết định. */
export function cellDoorClosed(s: GameState, roomId: string): boolean {
  if (!isVN(s)) return false;
  const r = CUSTODY_ROOM_BY_ID[roomId];
  if (!r) return false;
  const home = homeRoom(s);
  if (home?.id === roomId && activeGrants(s).some((g) => g.purpose !== 'return')) return false;
  if (r.cohort === 'discipline' || r.cohort === 'separate') return true;
  const g = r.cohort === 'B' ? 'B' : 'A';
  const mm = minuteOfDay(s.minute);
  const w = CUSTODY_SCHEDULE[g].find((x) => mm >= x.from && mm < x.to);
  return !w || w.kind !== 'activity';
}

// ======================= Life hooks registration =======================
custodyHooks.placementBed = (ctx) => {
  const s = ctx.s;
  if (!isVN(s)) return null;
  const g = currentGroup(s);
  if (g === 'review_required') return null;
  const bed = compatibleBed(s, g);
  if (!bed) return null;
  const room = custodyRoomOfBed(bed)!;
  return { bed, label: `${room.label} (nhóm ${g})`, reason: `Phân buồng theo quyết định phân loại nhóm ${g}` };
};
custodyHooks.afterHousingCommit = (ctx) => {
  const s = ctx.s;
  if (!isVN(s)) return;
  updatePhase(ctx);
  const target = homeRoom(s);
  if (target && !positionAllowed(s, s.player.pos.x, s.player.pos.z).ok) escortToRoom(ctx, target, 'Nhận buồng ở');
  else if (target && s.life.episode.state === 'admitted' && s.player.zone === 'L01') escortToRoom(ctx, target, 'Nhận buồng ở');
};
custodyHooks.incidentDecided = (ctx, inc) => (isVN(ctx.s) ? onIncidentDecided(ctx, inc) : false);
custodyHooks.incidentOverturned = (ctx, inc) => { if (isVN(ctx.s)) revokeOrdersFor(ctx, inc.id); };
custodyHooks.compatibleBed = (ctx) => (isVN(ctx.s) ? compatibleBed(ctx.s, currentGroup(ctx.s), housingRoom(ctx.s)?.id) : null);
custodyHooks.departAllowed = (s) => (isVN(s) ? s.custody!.releaseState === 'release_due' : null);
custodyHooks.onDeparted = (ctx) => { if (isVN(ctx.s)) markReleased(ctx); };
custodyHooks.serviceCheck = (s, kind) => { const e = evalService(s, kind as 'visit'); return e.ok ? null : reasonText(e.reasonCode); };
