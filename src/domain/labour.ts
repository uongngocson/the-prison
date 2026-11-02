// CR-LAB-01 domain (18): phân công ca, dụng cụ, trồng rau, ao cá, cảnh quan, mộc, kiểm nhận, ghi nhận một lần.
// Nguyên tắc: validate → reserve → commit theo source key; reload/double click trả cùng kết quả; không phạt vì hệ thống.
import type { GameState, LabourAssignment, LabourBatch, LabourPatch, LabourPlot, LabourState, LabourTask, LabourTool, LabourWoodOrder, ZoneId } from './types';
import { type Ctx, awardXp, notify } from './core';
import { post } from './life';
import { PROGRAM_BY_ID } from '../content/life';
import {
  CLEAN_DIRTY_AFTER, CLEAN_SPOTS, CROP, DESTINATION, FISH, PATCH_DECAY_DAYS, PATCH_IDS, PATCH_STATE_LABEL, PLOT_GROWTH, PLOT_IDS, PLOT_STAGE_LABEL,
  POND_FEEDS_PER_DAY, POND_HARVEST_DAY, POND_STAGE_LABEL, QC_CRITERIA, SHIFT_WINDOWS, TOOL_TYPES, TRAY_PATTERN, WATER_INTERVAL, WORKS, WORK_BY_ID,
  type ShiftWindow, type WorkDef, type WorkId,
} from '../content/labour';
import { dayOf, dayOfWeek, fmtClock, hash32, MIN_PER_DAY, minuteOfDay, pushBounded } from './util';
import { activeOrder, custodyLabourHook, isVN } from './custody';
import type { PropDef } from '../content/world';

// ======================= State =======================
export function createLabourState(seedKey: string, minute: number): LabourState {
  const tools: LabourTool[] = [];
  let n = 1;
  for (const type of Object.keys(TOOL_TYPES)) for (let i = 0; i < 3; i++) tools.push({ id: `DT-${String(n++).padStart(3, '0')}`, type, status: 'available', custodian: null, assignmentId: null });
  const stages: LabourPlot['stage'][] = ['ready', 'growing', 'seedling', 'empty'];
  const plots: LabourPlot[] = PLOT_IDS.map((id, i) => ({ id, stage: stages[i], cycleId: `${id}-C1`, cycleNo: 1, stageSince: minute - 600, growthMin: i === 1 ? 900 : 0, lastWatered: minute - 300, weededDay: 0, caretaker: null }));
  const patchStates: LabourPatch['state'][] = ['need_care', 'accepted', 'need_care', 'accepted', 'need_care', 'accepted'];
  const patches: LabourPatch[] = PATCH_IDS.map((id, i) => ({ id, state: patchStates[i], since: minute }));
  const cleanSpots: Record<string, number> = {};
  for (const id of CLEAN_SPOTS) cleanSpots[id] = minute - CLEAN_DIRTY_AFTER;
  return {
    version: 1, revision: 1, assignments: [], tools, plots,
    pond: { id: 'C-01', stage: 'growing', cohortNo: 1, stockedMinute: minute - 2 * MIN_PER_DAY, feedDay: 0, feeds: 0, observedDay: 0, loggedDay: 0, careEvents: 0, lastObservation: null },
    patches, orders: [], batches: [],
    receipts: [{ id: `rc_open_${hash32(seedKey).toString(36)}`, minute, kind: 'assign', text: 'Mở sổ kho đầu kỳ: 6 gói hạt giống, 20 phần thức ăn cá, 4 khay giống.', assignmentId: null }],
    sourceKeys: [], nurseryTrays: 4, seedPacks: 6, feedStock: 20, cleanSpots, orientation: {},
  };
}
/** Save cũ thiếu module → tạo sổ đầu kỳ, không gán ca, không phát đồ cá nhân. */
export function ensureLabour(s: GameState): LabourState {
  if (!s.labour) s.labour = createLabourState(s.lineageId, s.minute);
  return s.labour;
}
const L = (s: GameState) => ensureLabour(s);
function once(l: LabourState, key: string) { if (l.sourceKeys.includes(key)) return false; l.sourceKeys.push(key); return true; }
function receipt(l: LabourState, s: GameState, kind: LabourState['receipts'][number]['kind'], text: string, assignmentId: string | null) {
  pushBounded(l.receipts, { id: `rc_${s.tick.toString(36)}_${l.receipts.length}`, minute: s.minute, kind, text, assignmentId }, 80);
}
const bump = (ctx: Ctx) => { L(ctx.s).revision++; ctx.emit({ type: 'lifeUpdated', domain: 'labour' }); };
const dayStart = (minute: number) => minute - minuteOfDay(minute);

// ======================= Queries =======================
export function activeAssignment(s: GameState): LabourAssignment | null {
  return L(s).assignments.find((a) => a.state === 'active') ?? null;
}
/** Ca đang chạy hoặc sắp tới gần nhất (để hiện trên HUD). */
export function currentAssignment(s: GameState): LabourAssignment | null {
  const live = L(s).assignments.filter((a) => (a.state === 'active' || a.state === 'assigned' || a.state === 'completed') && a.end + 30 > s.minute);
  return live.sort((a, b) => a.start - b.start)[0] ?? null;
}
export function workOf(a: LabourAssignment): WorkDef { return WORK_BY_ID[a.workId as WorkId]; }
export function windowOf(id: 'am' | 'pm'): ShiftWindow { return SHIFT_WINDOWS.find((w) => w.id === id)!; }
export const plotLabel = (p: LabourPlot) => PLOT_STAGE_LABEL[p.stage];
export const patchLabel = (p: LabourPatch) => PATCH_STATE_LABEL[p.state];
export const pondLabel = (s: GameState) => POND_STAGE_LABEL[L(s).pond.stage];
export function spotDirty(s: GameState, id: string) { return s.minute - (L(s).cleanSpots[id] ?? 0) >= CLEAN_DIRTY_AFTER; }
export function orderOf(s: GameState, a: LabourAssignment): LabourWoodOrder | null { return L(s).orders.find((o) => o.id === a.target) ?? null; }
export function stepIndex(a: LabourAssignment): number {
  if (a.state === 'settled' || a.state === 'handed_over') return 4;
  if (!a.kitIssued) return 0;
  if (a.state !== 'active' && a.state !== 'completed') return 1;
  return a.tasks.every((t) => t.done) ? 3 : 2;
}

/** Điều kiện tham gia — trả lý do bằng text sản phẩm (không lộ mã). */
export function eligibility(s: GameState, work: WorkDef, win: ShiftWindow, day: number): string | null {
  if (s.life.episode.state !== 'admitted') return 'Hoàn tất tiếp nhận trước khi nhận việc.';
  if (isVN(s)) {
    if (activeOrder(s, 'discipline_confinement')) return 'Đang chấp hành quyết định kỷ luật — ca được hoãn, không tính vắng.';
    if (activeOrder(s, 'separation')) return 'Đang bố trí riêng — chưa nhận ca ngoài buồng.';
  }
  const l = L(s);
  const start = (day - 1) * MIN_PER_DAY + win.from;
  if (s.minute > start + 30) return 'Ca này đã bắt đầu quá lâu.';
  if (l.assignments.some((a) => a.day === day && a.window === win.id && !['cancelled', 'expired'].includes(a.state))) return 'Đã có ca khác trong khung giờ này.';
  const dow = (day - 1) % 7;
  for (const e of s.life.programs) {
    if (!['enrolled', 'in_progress'].includes(e.state)) continue;
    const p = PROGRAM_BY_ID[e.programId];
    if (p && p.days.includes(dow) && p.from < win.to && p.to > win.from) return `Trùng giờ với “${p.name}”.`;
  }
  if (work.orientation && !l.orientation[work.id]) return 'Cần đọc hướng dẫn an toàn trước.';
  if (work.id === 'W15' && !CLEAN_SPOTS.some((id) => spotDirty(s, id))) return 'Sân đã sạch — chưa cần quét.';
  if (work.id === 'W06' && !l.patches.some((p) => p.state !== 'accepted')) return 'Các ô đã được nghiệm thu.';
  return null;
}

export interface Offer { work: WorkDef; win: ShiftWindow; day: number; reason: string | null; start: number }
export function offers(s: GameState): Offer[] {
  const today = dayOf(s.minute);
  const out: Offer[] = [];
  for (const day of [today, today + 1]) for (const win of SHIFT_WINDOWS) {
    const start = (day - 1) * MIN_PER_DAY + win.from;
    if (s.minute > start + 30) continue;
    for (const work of WORKS) out.push({ work, win, day, start, reason: eligibility(s, work, win, day) });
  }
  return out;
}

// ======================= Targets & tasks =======================
const T = (id: string, label: string): LabourTask => ({ id, label, done: false });
function claimed(s: GameState, target: string) { return L(s).assignments.some((a) => a.target === target && ['assigned', 'active'].includes(a.state)); }
function pickPlot(s: GameState): LabourPlot {
  const l = L(s);
  const free = l.plots.filter((p) => !claimed(s, p.id));
  const rank = (p: LabourPlot) => ({ ready: 0, harvested: 1, empty: 2, prepared: 3, sown: 4, seedling: 5, growing: 6 }[p.stage]);
  return (free.length ? free : l.plots).slice().sort((a, b) => rank(a) - rank(b))[0];
}
function plotTasks(p: LabourPlot): LabourTask[] {
  switch (p.stage) {
    case 'empty': return [T('prepare', `Làm đất luống ${p.id}`), T('sow', 'Gieo hạt cải xanh')];
    case 'prepared': return [T('sow', `Gieo hạt luống ${p.id}`), T('water', 'Tưới nhẹ sau gieo')];
    case 'ready': return [T('harvest', `Thu hoạch luống ${p.id}`), T('clean', 'Dọn luống sau thu')];
    case 'harvested': return [T('clean', `Dọn luống ${p.id}`), T('prepare', 'Làm đất cho vụ mới')];
    default: return [T('water', `Tưới luống ${p.id} theo nhu cầu`), T('weed', 'Nhổ cỏ, kiểm tra cây')];
  }
}
function pickPatch(s: GameState): LabourPatch {
  const l = L(s);
  const free = l.patches.filter((p) => !claimed(s, p.id) && p.state !== 'accepted' && p.state !== 'awaiting_check');
  return free[0] ?? l.patches.find((p) => p.state !== 'accepted') ?? l.patches[0];
}
function patchTasks(p: LabourPatch): LabourTask[] {
  const out: LabourTask[] = [];
  if (p.state === 'need_care') out.push(T('weed_patch', `Làm cỏ, tỉa gọn ô ${p.id}`));
  if (p.state === 'need_care' || p.state === 'weeded') out.push(T('plant', 'Trồng hoa theo mẫu'));
  out.push(T('collect', 'Gom phế liệu vào thùng'));
  return out;
}
function tasksFor(s: GameState, work: WorkDef, target: string): LabourTask[] {
  const l = L(s);
  switch (work.id) {
    case 'W01': return plotTasks(l.plots.find((p) => p.id === target)!);
    case 'W05': return l.pond.stage === 'harvest_ready' ? [T('observe', 'Quan sát ao C-01'), T('harvest_fish', 'Hỗ trợ thu hoạch theo lệnh')] : [T('observe', 'Quan sát ao C-01'), T('feed', 'Cho ăn theo kế hoạch'), T('log', 'Ghi nhật ký ao')];
    case 'W06': return patchTasks(l.patches.find((p) => p.id === target)!);
    case 'W08': return [T('measure', 'Đo & đánh dấu theo mẫu'), T('assemble', 'Ghép khay'), T('finish', 'Chà nhám hoàn thiện'), T('submit', 'Gửi kiểm nhận tại kho')];
    case 'W15': return [...CLEAN_SPOTS.filter((id) => spotDirty(s, id)).map((id) => T(`sweep:${id}`, `Quét điểm ${id}`)), T('dump', 'Đổ rác vào thùng gom')];
  }
}
function markTask(a: LabourAssignment, id: string) { const t = a.tasks.find((x) => x.id === id && !x.done); if (t) t.done = true; return !!t; }
const hasTask = (a: LabourAssignment, id: string) => a.tasks.some((t) => t.id === id && !t.done);

// ======================= Commands (API18) =======================
export interface LabourResult { ok: boolean; message: string }
export function acceptWork(ctx: Ctx, workId: WorkId, winId: 'am' | 'pm', day: number): LabourResult {
  const s = ctx.s; const l = L(s);
  const work = WORK_BY_ID[workId]; const win = windowOf(winId);
  const key = `assign:${day}:${winId}`;
  const existing = l.assignments.find((a) => a.day === day && a.window === winId && !['cancelled', 'expired'].includes(a.state));
  if (existing && existing.workId === workId) return { ok: true, message: 'Đã nhận ca này.' }; // retry/double click
  const why = eligibility(s, work, win, day);
  if (why) return { ok: false, message: why };
  let target = '';
  if (workId === 'W01') target = pickPlot(s).id;
  else if (workId === 'W05') target = l.pond.id;
  else if (workId === 'W06') target = pickPatch(s).id;
  else if (workId === 'W15') target = 'L04';
  else {
    const rework = l.orders.find((o) => o.stage === 'rework' && !claimed(s, o.id));
    const order: LabourWoodOrder = rework ?? { id: `MO-${String(l.orders.length + 1).padStart(3, '0')}`, stage: 'brief', assignmentId: null, measure: null, assemble: null, failed: [], attempts: 0 };
    if (!rework) l.orders.push(order);
    target = order.id;
  }
  const a: LabourAssignment = {
    id: `as_${day}_${winId}_${l.assignments.length}`, workId, workVersion: work.version, day, window: winId, start: (day - 1) * MIN_PER_DAY + win.from, end: (day - 1) * MIN_PER_DAY + win.to,
    state: 'assigned', target, kitIssued: false, kitReturned: false, materialLeft: 0, checkInMinute: null, tasks: tasksFor(s, work, target), batchIds: [], credit: 0, createdMinute: s.minute,
  };
  if (workId === 'W08') { const o = l.orders.find((x) => x.id === target)!; o.assignmentId = a.id; if (o.stage === 'rework') a.tasks = reworkTasks(o); }
  l.sourceKeys.push(key);
  l.assignments.push(a);
  if (l.assignments.length > 40) l.assignments = l.assignments.filter((x, i) => i >= l.assignments.length - 40 || ['assigned', 'active'].includes(x.state));
  receipt(l, s, 'assign', `Nhận ca ${work.title} · ${win.label} ngày ${day} (${fmtClock(a.start)}–${fmtClock(a.end)}).`, a.id);
  notify(ctx, `Đã nhận ca ${work.title} · ${fmtClock(a.start)}. Nhận dụng cụ tại Kho & kiểm nhận.`, 'success', 'life');
  bump(ctx);
  return { ok: true, message: 'Đã nhận phân công.' };
}
function reworkTasks(o: LabourWoodOrder): LabourTask[] {
  const t: LabourTask[] = [];
  if (o.failed.includes('Đúng mẫu')) t.push(T('measure', 'Đo lại theo mẫu'));
  if (o.failed.includes('Đủ chi tiết')) t.push(T('assemble', 'Ghép lại đúng thứ tự'));
  t.push(T('finish', 'Chà nhám hoàn thiện'), T('submit', 'Gửi kiểm nhận lại'));
  return t;
}
export function cancelWork(ctx: Ctx, id: string): LabourResult {
  const s = ctx.s; const l = L(s);
  const a = l.assignments.find((x) => x.id === id);
  if (!a) return { ok: false, message: 'Không tìm thấy ca.' };
  if (a.state !== 'assigned' || a.kitIssued) return { ok: false, message: 'Ca đã bắt đầu — hãy nhờ hỗ trợ để bàn giao.' };
  a.state = 'cancelled'; a.reason = 'Yêu cầu đổi việc trước giờ ca';
  if (a.workId === 'W08') { const o = orderOf(s, a); if (o && o.stage === 'brief') o.assignmentId = null; }
  receipt(l, s, 'change', `Đổi việc: hủy ca ${workOf(a).title} trước giờ bắt đầu, không ghi vắng.`, a.id);
  bump(ctx);
  return { ok: true, message: 'Đã hủy ca. Bạn có thể chọn việc khác.' };
}
export function readOrientation(ctx: Ctx, workId: WorkId) {
  const l = L(ctx.s);
  if (!l.orientation[workId]) { l.orientation[workId] = true; receipt(l, ctx.s, 'assign', `Đã đọc hướng dẫn an toàn ${WORK_BY_ID[workId].title}.`, null); bump(ctx); }
}

/** U43: nhận bộ dụng cụ & vật tư của ca — nguyên tử, idempotent theo khóa kit. */
export function issueKit(ctx: Ctx, id: string): LabourResult {
  const s = ctx.s; const l = L(s);
  const a = l.assignments.find((x) => x.id === id);
  if (!a || !['assigned', 'active'].includes(a.state)) return { ok: false, message: 'Không có ca hợp lệ để nhận dụng cụ.' };
  if (a.kitIssued) return { ok: true, message: 'Đã nhận bộ dụng cụ của ca này.' };
  if (s.minute < a.start - 45) return { ok: false, message: `Nhận dụng cụ từ ${fmtClock(a.start - 45)}.` };
  if (s.minute >= a.end) return { ok: false, message: 'Ca đã kết thúc.' };
  const work = workOf(a);
  const picks: LabourTool[] = [];
  for (const type of work.kit) {
    const t = l.tools.find((x) => x.type === type && x.status === 'available' && !picks.includes(x));
    if (!t) return { ok: false, message: `Hết ${TOOL_TYPES[type].label} — nhờ cán bộ kiểm tra kho.` };
    picks.push(t);
  }
  if (!once(l, `kit:${a.id}`)) return { ok: true, message: 'Đã nhận bộ dụng cụ.' };
  for (const t of picks) { t.status = 'issued'; t.custodian = 'player'; t.assignmentId = a.id; }
  // vật tư theo ca (thiếu thì giữ ca, chuyển việc thay thế — không âm kho)
  if (work.id === 'W01' && hasTask(a, 'sow')) { if (l.seedPacks > 0) { l.seedPacks--; a.materialLeft = 1; } }
  if (work.id === 'W05' && hasTask(a, 'feed')) { const q = Math.min(work.material!.qty, l.feedStock); l.feedStock -= q; a.materialLeft = q; }
  if (work.id === 'W06' && hasTask(a, 'plant')) { if (l.nurseryTrays > 0) { l.nurseryTrays--; a.materialLeft = 1; } }
  if (work.id === 'W08') { const o = orderOf(s, a); if (o && o.stage === 'brief') o.stage = 'blank'; else if (o && o.stage === 'rework') o.stage = o.failed.includes(QC_CRITERIA[0]) ? 'blank' : 'marked'; a.materialLeft = 1; }
  a.kitIssued = true;
  receipt(l, s, 'kit_issue', `Cấp ${picks.map((t) => `${TOOL_TYPES[t.type].label} ${t.id}`).join(', ')}${a.materialLeft ? ` · ${work.material?.label} ×${a.materialLeft}` : ''}.`, a.id);
  bump(ctx);
  return { ok: true, message: 'Đã nhận bộ dụng cụ. Đến khu làm việc được phép.' };
}
function returnTools(l: LabourState, s: GameState, a: LabourAssignment, by: string) {
  if (!a.kitIssued || a.kitReturned) return;
  const mine = l.tools.filter((t) => t.assignmentId === a.id && t.status === 'issued');
  for (const t of mine) { t.status = 'available'; t.custodian = null; t.assignmentId = null; }
  if (a.workId === 'W05' && a.materialLeft > 0) { l.feedStock += a.materialLeft; a.materialLeft = 0; }
  if (a.workId === 'W01' && a.materialLeft > 0) { l.seedPacks += a.materialLeft; a.materialLeft = 0; }
  if (a.workId === 'W06' && a.materialLeft > 0) { l.nurseryTrays += a.materialLeft; a.materialLeft = 0; }
  a.kitReturned = true;
  receipt(l, s, 'kit_return', `${by} nhận lại ${mine.length}/${mine.length} dụng cụ (${mine.map((t) => t.id).join(', ')}).`, a.id);
}

// ======================= Station verbs (API19) =======================
export interface LabVerb { verb: string; label: string; duration: number; enabled: boolean; reason?: string; instant?: boolean; screen?: string }
const OUTDOOR: ZoneId[] = ['L23', 'L24', 'L25', 'L04'];
function shiftHere(s: GameState, workId: WorkId): LabourAssignment | null {
  const a = activeAssignment(s);
  return a && a.workId === workId ? a : null;
}
function blockReason(s: GameState, workId: WorkId): string | null {
  const a = activeAssignment(s);
  if (!a) {
    const up = currentAssignment(s);
    if (up && up.workId === workId && !up.kitIssued) return 'Nhận dụng cụ tại Kho (L27) trước.';
    if (up && up.workId === workId) return `Ca bắt đầu lúc ${fmtClock(up.start)}.`;
    return 'Chưa có ca tại đây — xem Bảng công việc (N).';
  }
  if (a.workId !== workId) return `Bạn đang làm ca ${workOf(a).title}.`;
  if (OUTDOOR.includes(workOf(a).zone) && s.world.weather === 'rain') return 'Đang mưa — chuyển việc trong nhà tại Kho (L27).';
  return null;
}
const V = (verb: string, label: string, duration: number, reason: string | null = null): LabVerb => ({ verb, label, duration, enabled: !reason, reason: reason ?? undefined });

export function labourVerbs(s: GameState, p: PropDef): LabVerb[] {
  const l = L(s);
  const out: LabVerb[] = [];
  switch (p.kind) {
    case 'garden_bed': {
      const plot = l.plots.find((x) => x.id === p.meta?.plot)!;
      out.push({ verb: 'lab_view', label: `${PLOT_STAGE_LABEL[plot.stage]} · xem luống`, duration: 0, enabled: true, instant: true, screen: 'work_station' });
      const block = blockReason(s, 'W01');
      const a = shiftHere(s, 'W01');
      const mine = a && a.target === plot.id;
      const r = block ?? (mine ? null : 'Luống này do tổ khác chăm.');
      if (plot.stage === 'empty' || plot.stage === 'harvested') {
        if (plot.stage === 'harvested') out.push(V('lab_clean', 'Dọn luống sau thu', 20, r));
        else out.push(V('lab_prepare', 'Làm đất luống', 25, r));
      }
      if (plot.stage === 'prepared') out.push(V('lab_sow', 'Gieo hạt', 20, r ?? (a && a.materialLeft < 1 ? 'Chưa có hạt giống trong bộ vật tư.' : null)));
      if (['prepared', 'sown', 'seedling', 'growing'].includes(plot.stage)) {
        const moist = s.minute - plot.lastWatered < 8 * 60 && plot.stage !== 'prepared';
        out.push(V('lab_water', 'Tưới theo nhu cầu', 15, r ?? (moist && !(a && hasTask(a, 'water')) ? 'Đất còn ẩm — chưa cần tưới.' : null)));
      }
      if (['sown', 'seedling', 'growing', 'ready'].includes(plot.stage)) out.push(V('lab_weed', 'Nhổ cỏ, kiểm tra cây', 20, r ?? (plot.weededDay === dayOf(s.minute) ? 'Đã nhổ cỏ hôm nay.' : null)));
      if (plot.stage === 'ready') out.push(V('lab_harvest', 'Thu hoạch', 30, r));
      break;
    }
    case 'pond_dock': case 'pond': case 'feed_station': {
      out.push({ verb: 'lab_view', label: `Ao C-01 · ${pondLabel(s)}`, duration: 0, enabled: true, instant: true, screen: 'work_station' });
      const block = blockReason(s, 'W05');
      const a = shiftHere(s, 'W05');
      if (p.kind === 'feed_station') { out.push(V('lab_log', 'Ghi nhật ký ao', 10, block ?? (a && hasTask(a, 'log') ? null : 'Đã ghi nhật ký ca này.'))); break; }
      out.push(V('lab_observe', 'Quan sát ao', 10, block ?? (a && hasTask(a, 'observe') ? null : 'Đã quan sát trong ca này.')));
      if (l.pond.stage === 'harvest_ready') out.push(V('lab_harvest_fish', 'Hỗ trợ thu hoạch', 40, block ?? (a && hasTask(a, 'harvest_fish') ? null : 'Chưa có lệnh thu cho ca này.')));
      else out.push(V('lab_feed', 'Cho ăn theo kế hoạch', 10, block ?? (l.pond.feedDay === dayOf(s.minute) && l.pond.feeds >= POND_FEEDS_PER_DAY ? 'Đã cho ăn đủ phần hôm nay.' : a && a.materialLeft < 1 ? 'Hết phần thức ăn được cấp.' : a && !hasTask(a, 'feed') ? 'Đã cho ăn trong ca này.' : null)));
      break;
    }
    case 'flower_patch': {
      const patch = l.patches.find((x) => x.id === p.meta?.patch)!;
      out.push({ verb: 'lab_view', label: `${PATCH_STATE_LABEL[patch.state]} · xem ô`, duration: 0, enabled: true, instant: true, screen: 'work_station' });
      const block = blockReason(s, 'W06');
      const a = shiftHere(s, 'W06');
      const r = block ?? (a && a.target === patch.id ? null : 'Ô này không thuộc ca của bạn.');
      if (patch.state === 'need_care') out.push(V('lab_weed_patch', 'Làm cỏ, tỉa gọn', 25, r));
      if (patch.state === 'weeded' || patch.state === 'need_care') out.push(V('lab_plant', 'Trồng hoa theo mẫu', 25, r ?? (patch.state !== 'weeded' ? 'Làm cỏ trước khi trồng.' : a && a.materialLeft < 1 ? 'Chưa nhận khay cây giống.' : null)));
      break;
    }
    case 'waste_bin': {
      if (p.zone === 'L25') { const a = shiftHere(s, 'W06'); out.push(V('lab_collect', 'Đổ phế liệu vào thùng', 5, blockReason(s, 'W06') ?? (a && hasTask(a, 'collect') && !a.tasks.some((t) => t.id !== 'collect' && !t.done) ? null : 'Làm xong ô cảnh quan trước.'))); }
      else { const a = shiftHere(s, 'W15'); out.push(V('lab_dump', 'Đổ rác vào thùng gom', 5, blockReason(s, 'W15') ?? (a && hasTask(a, 'dump') && !a.tasks.some((t) => t.id.startsWith('sweep') && !t.done) ? null : 'Quét hết các điểm trước.'))); }
      break;
    }
    case 'nursery_bench': out.push({ verb: 'lab_view', label: `Khay giống sẵn: ${l.nurseryTrays}`, duration: 0, enabled: true, instant: true, screen: 'work_station' }); break;
    case 'wood_bench': {
      const a = shiftHere(s, 'W08');
      out.push({ verb: 'lab_wood', label: 'Mở bàn mộc', duration: 0, enabled: true, instant: true, screen: 'work_wood' });
      if (!a) out[0].label = 'Xem bàn mộc';
      break;
    }
    case 'clean_spot': {
      const id = String(p.meta?.spot);
      const a = shiftHere(s, 'W15');
      out.push(V('lab_sweep', 'Quét dọn', 15, blockReason(s, 'W15') ?? (!spotDirty(s, id) ? 'Điểm này đã sạch.' : a && hasTask(a, `sweep:${id}`) ? null : 'Không thuộc phạm vi ca.')));
      break;
    }
    case 'sort_table': {
      const a = activeAssignment(s);
      const outdoor = a && OUTDOOR.includes(workOf(a).zone);
      out.push(V('lab_sort', 'Phân loại khay giống (việc khi mưa)', 30, !a ? 'Chưa có ca.' : !outdoor ? 'Chỉ dùng khi ca ngoài trời gặp mưa.' : s.world.weather !== 'rain' ? 'Trời không mưa — làm việc tại khu được giao.' : a.rainFallback ? 'Đã làm việc thay thế.' : null));
      break;
    }
    case 'tool_counter': out.push({ verb: 'lab_tools', label: 'Nhận / trả dụng cụ', duration: 0, enabled: true, instant: true, screen: 'work_tools' }); break;
    case 'scale_station': out.push({ verb: 'lab_handover', label: 'Cân, kiểm nhận & bàn giao', duration: 0, enabled: true, instant: true, screen: 'work_handover' }); break;
    case 'stock_shelf': out.push({ verb: 'lab_view', label: 'Xem kho', duration: 0, enabled: true, instant: true, screen: 'work_handover' }); break;
  }
  return out;
}

/** U42: thao tác bàn mộc cần lựa chọn trong panel (không hiện ở prompt nhanh để không bỏ qua bước chọn). */
export function labourPanelVerbs(s: GameState, p: PropDef): LabVerb[] {
  if (p.kind !== 'wood_bench') return [];
  const a = shiftHere(s, 'W08');
  const block = blockReason(s, 'W08');
  const o = a ? orderOf(s, a) : null;
  return [
    V('lab_measure', 'Đo & đánh dấu', 20, block ?? (o?.stage !== 'blank' ? 'Chưa đến bước này.' : null)),
    V('lab_assemble', 'Ghép khay', 30, block ?? (o?.stage !== 'marked' ? 'Đo & đánh dấu trước.' : null)),
    V('lab_finish', 'Chà nhám hoàn thiện', 20, block ?? (o?.stage !== 'assembled' ? 'Ghép khay trước.' : null)),
  ];
}

/** Commit hành động tại station (sau thanh tiến trình). Idempotent theo actionId ở tầng session. */
export function labourCommit(ctx: Ctx, verb: string, p: PropDef | null, params: Record<string, string | number | boolean>): string | null {
  const s = ctx.s; const l = L(s);
  const a = activeAssignment(s);
  if (!a || !p) return 'Ca đã kết thúc — kết quả không được ghi.';
  const today = dayOf(s.minute);
  let msg: string | null = null;
  switch (verb) {
    case 'lab_prepare': case 'lab_sow': case 'lab_water': case 'lab_weed': case 'lab_harvest': case 'lab_clean': {
      const plot = l.plots.find((x) => x.id === p.meta?.plot);
      if (!plot || a.target !== plot.id) return 'Luống không thuộc ca.';
      plot.caretaker = 'player';
      if (verb === 'lab_prepare' && plot.stage === 'empty') { setStage(plot, 'prepared', s.minute); markTask(a, 'prepare'); msg = `Đã làm đất luống ${plot.id}.`; }
      else if (verb === 'lab_clean' && plot.stage === 'harvested') { setStage(plot, 'empty', s.minute); markTask(a, 'clean'); msg = `Đã dọn luống ${plot.id}.`; }
      else if (verb === 'lab_sow' && plot.stage === 'prepared' && a.materialLeft > 0) {
        a.materialLeft--; plot.cycleNo++; plot.cycleId = `${plot.id}-C${plot.cycleNo}`; setStage(plot, 'sown', s.minute); plot.lastWatered = s.minute; markTask(a, 'sow'); msg = `Đã gieo hạt luống ${plot.id} (vụ ${plot.cycleNo}).`;
      } else if (verb === 'lab_water') {
        const due = s.minute - plot.lastWatered >= 8 * 60 || plot.stage === 'prepared';
        plot.lastWatered = s.minute; markTask(a, 'water');
        msg = due ? 'Đã tưới đủ ẩm.' : 'Đất đã đủ ẩm — không cần tưới thêm.';
      } else if (verb === 'lab_weed' && plot.weededDay !== today) { plot.weededDay = today; markTask(a, 'weed'); msg = 'Đã nhổ cỏ và kiểm tra cây.'; }
      else if (verb === 'lab_harvest' && plot.stage === 'ready' && once(l, `harvest:${plot.cycleId}`)) {
        const qty = CROP.yieldMin + (hash32(plot.cycleId + s.lineageId) % (CROP.yieldMax - CROP.yieldMin + 1));
        const b = newBatch(l, s, 'veg', Math.round(qty / 100) * 100, 'g', `harvest:${plot.cycleId}`, a.id, false);
        a.batchIds.push(b.id);
        setStage(plot, 'harvested', s.minute); markTask(a, 'harvest');
        msg = `Đã thu ${fmtQty(b)} ${CROP.label.toLowerCase()} — mang tới điểm cân tại Kho (L27).`;
      }
      break;
    }
    case 'lab_observe': {
      if (!markTask(a, 'observe')) return null;
      l.pond.observedDay = today; l.pond.careEvents++;
      l.pond.lastObservation = hash32(`${l.pond.cohortNo}:${today}`) % 7 === 0 ? 'check' : 'normal';
      msg = l.pond.lastObservation === 'normal' ? 'Nước trong, cá bơi đều — bình thường.' : 'Mặt nước hơi đục — đã ghi “cần kiểm tra” để cán bộ xem.';
      break;
    }
    case 'lab_feed': {
      if (l.pond.feedDay !== today) { l.pond.feedDay = today; l.pond.feeds = 0; }
      if (a.materialLeft < 1 || l.pond.feeds >= POND_FEEDS_PER_DAY || !markTask(a, 'feed')) return 'Không cho ăn thêm — đã đủ phần.';
      a.materialLeft--; l.pond.feeds++; l.pond.careEvents++;
      msg = 'Đã cho ăn đúng phần được cấp.';
      break;
    }
    case 'lab_log': { if (markTask(a, 'log')) { l.pond.loggedDay = today; msg = 'Đã ghi nhật ký ao trong ca.'; } break; }
    case 'lab_harvest_fish': {
      if (l.pond.stage !== 'harvest_ready' || !once(l, `fish:${l.pond.cohortNo}`)) return null;
      const qty = FISH.yieldMin + (hash32(`${s.lineageId}:${l.pond.cohortNo}`) % (FISH.yieldMax - FISH.yieldMin + 1));
      const b = newBatch(l, s, 'fish', Math.round(qty / 100) * 100, 'g', `fish:${l.pond.cohortNo}`, a.id, false);
      a.batchIds.push(b.id); l.pond.stage = 'harvest_pending_check'; markTask(a, 'harvest_fish');
      msg = `Đã hỗ trợ thu lô ${b.id} — chờ kiểm nhận tại Kho.`;
      break;
    }
    case 'lab_weed_patch': case 'lab_plant': {
      const patch = l.patches.find((x) => x.id === p.meta?.patch);
      if (!patch || a.target !== patch.id) return 'Ô không thuộc ca.';
      if (verb === 'lab_weed_patch' && patch.state === 'need_care') { patch.state = 'weeded'; patch.since = s.minute; markTask(a, 'weed_patch'); msg = `Đã làm cỏ ô ${patch.id}.`; }
      if (verb === 'lab_plant' && patch.state === 'weeded' && a.materialLeft > 0) { a.materialLeft--; patch.state = 'planted'; patch.since = s.minute; markTask(a, 'plant'); msg = `Đã trồng hoa theo mẫu ở ô ${patch.id}.`; }
      break;
    }
    case 'lab_collect': {
      if (!markTask(a, 'collect')) return null;
      const patch = l.patches.find((x) => x.id === a.target);
      if (patch && patch.state === 'planted') { patch.state = 'awaiting_check'; patch.since = s.minute; }
      msg = 'Đã gom phế liệu. Ô chờ nghiệm thu khi bàn giao.';
      break;
    }
    case 'lab_sweep': {
      const id = String(p.meta?.spot);
      if (!markTask(a, `sweep:${id}`)) return null;
      l.cleanSpots[id] = s.minute;
      msg = `Đã quét sạch điểm ${id}.`;
      break;
    }
    case 'lab_dump': { if (markTask(a, 'dump')) msg = 'Đã đổ rác đúng thùng gom.'; break; }
    case 'lab_sort': {
      if (s.world.weather !== 'rain' || a.rainFallback) return null;
      a.rainFallback = true;
      for (const t of a.tasks) t.done = true;
      msg = 'Đã phân loại khay giống trong nhà — ca được ghi nhận như việc ngoài trời.';
      break;
    }
    case 'lab_measure': case 'lab_assemble': case 'lab_finish': {
      const o = orderOf(s, a);
      if (!o) return null;
      if (verb === 'lab_measure' && o.stage === 'blank') { o.measure = String(params.choice ?? 'a'); o.stage = 'marked'; markTask(a, 'measure'); msg = 'Đã đo và đánh dấu phôi.'; }
      else if (verb === 'lab_assemble' && o.stage === 'marked') { o.assemble = String(params.choice ?? 'a'); o.stage = 'assembled'; markTask(a, 'assemble'); msg = 'Đã ghép khay.'; }
      else if (verb === 'lab_finish' && o.stage === 'assembled') { o.stage = 'finished'; markTask(a, 'finish'); msg = 'Đã chà nhám hoàn thiện. Mang khay tới điểm kiểm nhận (L27).'; }
      break;
    }
  }
  if (a.tasks.every((t) => t.done) && a.state === 'active') a.state = 'completed';
  bump(ctx);
  return msg;
}
function setStage(p: LabourPlot, stage: LabourPlot['stage'], minute: number) { p.stage = stage; p.stageSince = minute; p.growthMin = 0; }
function newBatch(l: LabourState, s: GameState, kind: LabourBatch['kind'], qty: number, unit: LabourBatch['unit'], sourceKey: string, assignmentId: string | null, team: boolean): LabourBatch {
  const code = { veg: 'RAU', fish: 'CA', tray: 'KHAY', waste: 'PL' }[kind];
  const b: LabourBatch = { id: `${code}-${String(l.batches.length + 1).padStart(3, '0')}`, kind, qty, unit, state: team ? 'allocated' : 'pending_check', destination: DESTINATION[kind], sourceKey, assignmentId, team, minute: s.minute };
  l.batches.push(b);
  if (l.batches.length > 60) l.batches.splice(0, l.batches.length - 60);
  return b;
}
export function fmtQty(b: LabourBatch) { return b.unit === 'g' ? `${(b.qty / 1000).toFixed(1).replace('.', ',')} kg` : `${b.qty} chiếc`; }

// ======================= U44: kiểm nhận, bàn giao, ghi nhận (API20) =======================
export interface HandoverSummary { batches: LabourBatch[]; qc: string[]; toolsBack: number; credit: number; done: number; total: number }
export function handover(ctx: Ctx, id: string): LabourResult & { summary?: HandoverSummary } {
  const s = ctx.s; const l = L(s);
  const a = l.assignments.find((x) => x.id === id);
  if (!a) return { ok: false, message: 'Không tìm thấy ca.' };
  if (a.state === 'settled') return { ok: true, message: 'Ca đã được ghi nhận.' };
  if (!['active', 'completed'].includes(a.state)) return { ok: false, message: 'Ca chưa bắt đầu.' };
  const qc: string[] = [];
  // 1) kiểm nhận lô
  for (const bid of a.batchIds) {
    const b = l.batches.find((x) => x.id === bid);
    if (!b || b.state !== 'pending_check') continue;
    b.state = 'allocated';
    qc.push(`${b.id}: đạt · ${fmtQty(b)} → ${b.destination}`);
    if (b.kind === 'fish') { l.pond.stage = 'restock_ready'; l.pond.stockedMinute = s.minute; }
  }
  if (a.workId === 'W08') {
    const o = orderOf(s, a);
    if (o && o.stage === 'finished' && hasTask(a, 'submit')) {
      o.attempts++;
      const failed: string[] = [];
      if (TRAY_PATTERN.measure.find((x) => x.id === o.measure)?.ok !== true) failed.push(QC_CRITERIA[0]);
      if (TRAY_PATTERN.assemble.find((x) => x.id === o.assemble)?.ok !== true) failed.push(QC_CRITERIA[1]);
      markTask(a, 'submit');
      if (failed.length) { o.stage = 'rework'; o.failed = failed; qc.push(`${o.id}: cần làm lại — ${failed.join(', ')}. Vật tư sửa được cấp ở ca sau.`); }
      else if (once(l, `tray:${o.id}`)) {
        o.stage = 'accepted'; o.failed = [];
        const b = newBatch(l, s, 'tray', 1, 'count', `tray:${o.id}`, a.id, false);
        b.state = 'allocated'; a.batchIds.push(b.id); l.nurseryTrays++;
        qc.push(`${o.id}: đạt 3/3 tiêu chí → ${b.destination}`);
      }
    }
  }
  if (a.workId === 'W06') {
    const patch = l.patches.find((x) => x.id === a.target);
    if (patch && patch.state === 'awaiting_check') { patch.state = 'accepted'; patch.since = s.minute; qc.push(`Ô ${patch.id}: đã nghiệm thu (trước/sau)`); }
  }
  if (a.workId === 'W15') qc.push(`Sân sinh hoạt: ${CLEAN_SPOTS.filter((x) => !spotDirty(s, x)).length}/${CLEAN_SPOTS.length} điểm sạch`);
  // 2) trả dụng cụ
  returnTools(l, s, a, 'Kho');
  // 3) ghi nhận một lần
  const summary = settle(ctx, a, 'Bàn giao tại kho');
  summary.qc = qc;
  if (qc.length) receipt(l, s, 'qc', qc.join(' · '), a.id);
  bump(ctx);
  return { ok: true, message: 'Đã bàn giao và kết ca.', summary };
}
function settle(ctx: Ctx, a: LabourAssignment, by: string): HandoverSummary {
  const s = ctx.s; const l = L(s);
  const work = workOf(a);
  const done = a.tasks.filter((t) => t.done).length;
  const total = a.tasks.length;
  const credit = done === total ? work.credit : done > 0 ? Math.round(work.credit / 2) : 0;
  if (once(l, `labour:settle:${a.id}`)) {
    a.credit = credit;
    if (credit > 0) post(ctx, `labour:settle:${a.id}`, credit, 'credit', `Ghi nhận ca ${work.title}`);
    if (done > 0) awardXp(ctx, work.xp, done === total ? 6 : 3, `labour:xp:${a.id}`);
    receipt(l, s, 'settle', `${by}: ${work.title} · ${done}/${total} việc · ghi nhận ${(credit / 100).toFixed(2).replace('.', ',')} tín chỉ.`, a.id);
    s.stats.helps += done === total ? 1 : 0;
  }
  a.state = 'settled';
  return { batches: l.batches.filter((b) => a.batchIds.includes(b.id)), qc: [], toolsBack: work.kit.length, credit: a.credit, done, total };
}

// ======================= Tick (mô phỏng theo phút game, không theo giờ thật) =======================
export function labourTick(ctx: Ctx) {
  const s = ctx.s; const l = L(s);
  const m = minuteOfDay(s.minute);
  const rain = s.world.weather === 'rain';
  let changed = false;
  // tăng trưởng luống: chỉ lớn khi còn đủ ẩm; thiếu nước thì tạm dừng (không chết)
  for (const p of l.plots) {
    if (rain && s.minute - p.lastWatered > 60) p.lastWatered = s.minute;
    const g = PLOT_GROWTH[p.stage];
    if (!g) continue;
    if (s.minute - p.lastWatered > WATER_INTERVAL) continue;
    p.growthMin++;
    if (p.growthMin >= g.minutes) { setStage(p, g.next, s.minute); changed = true; }
  }
  // ao: đến kỳ thu theo ngày nuôi
  if (l.pond.stage === 'growing' && s.minute - l.pond.stockedMinute >= POND_HARVEST_DAY * MIN_PER_DAY) { l.pond.stage = 'harvest_ready'; changed = true; }
  // tổ đội duy trì lúc 06:00 (công của tổ, không ghi cho người chơi)
  if (m === 360) { teamMaintenance(ctx); changed = true; }
  // vòng đời ca
  for (const a of l.assignments) {
    if (!['assigned', 'active', 'completed'].includes(a.state)) continue;
    const work = workOf(a);
    if (isVN(s) && (activeOrder(s, 'discipline_confinement') || activeOrder(s, 'separation'))) {
      a.reason = 'Hoãn do quyết định giam giữ — không tính vắng'; returnTools(l, s, a, 'Tổ trưởng');
      if (a.kitIssued && a.tasks.some((t) => t.done)) settle(ctx, a, 'Bàn giao do hoãn ca'); else a.state = 'excused';
      receipt(l, s, 'handover', `Ca ${work.title} được hoãn/bàn giao: ${a.reason}.`, a.id); changed = true; continue;
    }
    if (s.minute === a.start - 30 && a.state === 'assigned') notify(ctx, `Ca ${work.title} lúc ${fmtClock(a.start)} — ${a.kitIssued ? 'đến khu làm việc' : 'nhận dụng cụ tại Kho (L27)'}.`, 'info', 'life');
    if (a.state === 'assigned' && a.kitIssued && s.minute >= a.start && s.minute < a.end && s.player.zone === work.zone) {
      a.state = 'active'; a.checkInMinute = s.minute; changed = true;
      notify(ctx, `Bắt đầu ca ${work.title}. Việc đầu tiên: ${a.tasks.find((t) => !t.done)?.label ?? ''}.`, 'success', 'life');
    }
    if (s.minute === a.end && (a.state === 'active' || a.state === 'completed')) notify(ctx, 'Hết giờ ca — mang dụng cụ về Kho (L27) để bàn giao.', 'info', 'life');
    if (s.minute >= a.end + 45) {
      if (!a.kitIssued) { a.state = 'expired'; a.reason = 'Không nhận ca — không ghi vắng, không trừ quyền lợi'; }
      else {
        returnTools(l, s, a, 'Tổ trưởng');
        settle(ctx, a, 'Tổ trưởng bàn giao thay');
        receipt(l, s, 'handover', `Tổ trưởng nhận bàn giao ca ${work.title} sau giờ; lô chưa kiểm được giữ chờ kiểm.`, a.id);
        notify(ctx, `Tổ trưởng đã nhận bàn giao ca ${work.title} thay bạn. Không có hình thức xử lý nào.`, 'info', 'life');
      }
      changed = true;
    }
  }
  if (changed) bump(ctx);
}
function teamMaintenance(ctx: Ctx) {
  const s = ctx.s; const l = L(s);
  const today = dayOf(s.minute);
  for (const p of l.plots) {
    if (claimed(s, p.id)) continue;
    if (p.stage === 'harvested') setStage(p, 'empty', s.minute);
    else if (p.stage === 'empty' && l.seedPacks > 2) { l.seedPacks--; p.cycleNo++; p.cycleId = `${p.id}-C${p.cycleNo}`; setStage(p, 'sown', s.minute); p.caretaker = 'team'; }
    else if (p.stage === 'ready' && s.minute - p.stageSince > 2 * MIN_PER_DAY && once(l, `harvest:${p.cycleId}`)) {
      const qty = CROP.yieldMin + (hash32(p.cycleId + s.lineageId) % (CROP.yieldMax - CROP.yieldMin + 1));
      newBatch(l, s, 'veg', Math.round(qty / 100) * 100, 'g', `harvest:${p.cycleId}`, null, true);
      setStage(p, 'harvested', s.minute); p.caretaker = 'team';
    }
    if (['sown', 'seedling', 'growing'].includes(p.stage) && s.minute - p.lastWatered > 20 * 60) { p.lastWatered = s.minute; p.caretaker = 'team'; }
  }
  if (l.pond.stage === 'restock_ready') { l.pond.stage = 'growing'; l.pond.cohortNo++; l.pond.stockedMinute = s.minute; }
  if (l.pond.stage === 'harvest_ready' && s.minute - l.pond.stockedMinute > (POND_HARVEST_DAY + 2) * MIN_PER_DAY && once(l, `fish:${l.pond.cohortNo}`)) {
    newBatch(l, s, 'fish', FISH.yieldMin, 'g', `fish:${l.pond.cohortNo}`, null, true);
    l.pond.stage = 'restock_ready';
  }
  for (const p of l.patches) if (p.state === 'accepted' && s.minute - p.since > PATCH_DECAY_DAYS * MIN_PER_DAY) { p.state = 'need_care'; p.since = s.minute; }
  // bổ sung vật tư định kỳ cho cơ sở (không phải đồ cá nhân)
  if (dayOfWeek(s.minute) === 0 && once(l, `restock:${today}`)) { l.seedPacks += 4; l.feedStock += 14; receipt(l, s, 'assign', 'Kho nhận bổ sung: 4 gói hạt giống, 14 phần thức ăn cá.', null); }
}

// ======================= Custody (F64): quyền tới đúng nơi trong khung ca =======================
custodyLabourHook.grants = (s: GameState) => {
  const l = s.labour;
  if (!l) return [];
  const out: { destination: ZoneId; from: number; until: number; key: string }[] = [];
  for (const a of l.assignments) {
    if (!['assigned', 'active', 'completed'].includes(a.state)) continue;
    const from = a.start - 45, until = a.end + 45;
    if (s.minute < from || s.minute >= until) continue;
    out.push({ destination: 'L27', from, until, key: `labour:${a.id}:L27` });
    out.push({ destination: workOf(a).zone, from, until, key: `labour:${a.id}:work` });
  }
  return out;
};
