// Full Life domain (F33–F60): custody, services, economy, contact, programs, support, casework, transitions.
// Cùng clock/authority/ledger với core — không tạo game state thứ hai (02/11).
import type { Booking, BookingKind, CaseCategory, Correspondence, DecisionRecord, GameState, IncidentReview, LifeState, OrderLine, PropertyReceipt, ReceiptLine, ServiceCase, ZoneId } from './types';
import { type Ctx, addItem, adjustRel, adjustRep, awardXp, changeNeed, countItem, ledgerAdd, notify, removeItem } from './core';
import { ITEMS, ITEM_BY_ID, LIBRARY_BOOKS, PERSONAL_ITEMS_ON_ARRIVAL, STARTER_KIT } from '../content/items';
import { CASE_FACTS, CONTACTS_BY_CONTEXT, LETTER_TOPICS, POLICY_PROFILE, PROGRAMS, PROGRAM_BY_ID, SERVICES, SERVICE_BY_ID, ORIENTATION_TOPICS } from '../content/life';
import { ROLL_CALLS } from '../content/schedule';
import { NPCS } from '../content/npcs';
import { dayOf, dayOfWeek, fmtClock, fmtDayClock, fmtMoney, hm, minuteOfDay, MIN_PER_DAY, pushBounded } from './util';

export const ROOM_MOVE_DEST_BED = 'cell_7_bed_b';
export const PLAYER_START_BED = 'cell_3_bed_a';

export function createLifeState(startMinute: number, familyContext: 'family' | 'estranged' | 'none', episodeId: string): LifeState {
  const orientation: Record<string, 'unseen'> = {};
  for (const t of ORIENTATION_TOPICS) orientation[t.id] = 'unseen';
  return {
    profileRef: { id: POLICY_PROFILE.id, version: POLICY_PROFILE.version, hash: POLICY_PROFILE.hash },
    episode: {
      id: episodeId, policyProfileId: POLICY_PROFILE.id, policyVersion: POLICY_PROFILE.version, legalStatus: 'sentenced', state: 'arrived', arrivalMinute: startMinute,
      admissionSteps: { identity: false, orientation: false, property: false, support: false, housing: false }, orientation, storyMilestones: {}, familyContext, releaseEligibleDay: 7,
    },
    receipts: [], housing: [], bookings: [],
    account: { state: 'open', balance: 0, reserved: 0, entries: [], sourceKeys: ['opening:0'] },
    quotes: [], orders: [], weeklyQuota: {},
    contacts: CONTACTS_BY_CONTEXT[familyContext].map((c) => ({ id: c.id, nameKey: c.name, relation: c.relation, channels: c.channels, state: 'available' as const })),
    correspondence: [], cases: [], support: [], programs: [], incidents: [], facility: [], transitions: [],
    reintegration: { state: 'planning', goals: { housing: null, work: null, study: null, finance: null, contact: null, support: null }, knownNextSteps: [] },
    staff: { roleOnDuty: {}, lastHandoverMinute: 0 },
    attendance: [],
    issuedKit: { lastIssueDay: 0, laundryCleanDay: dayOf(startMinute), groomedDay: 0 },
    diet: 'regular', culturalOptIn: 'unset', privileges: { recreationRestrictedUntil: 0 }, sourceKeys: [],
  };
}

const life = (s: GameState) => s.life;
function once(s: GameState, key: string): boolean {
  if (s.life.sourceKeys.includes(key)) return false;
  s.life.sourceKeys.push(key);
  return true;
}
let lifeSeq = 0;
const lid = (ctx: Ctx, p: string) => `${p}_${ctx.s.tick.toString(36)}${(lifeSeq++).toString(36)}${Math.floor(ctx.rng.next() * 46656).toString(36)}`;
const changed = (ctx: Ctx, domain: string) => ctx.emit({ type: 'lifeUpdated', domain });

// ======================= F33 Admission / F36 Orientation / F34 Property / F35 Housing =======================
export type AdmissionStep = 'identity' | 'orientation' | 'property' | 'support' | 'housing';

export function admissionStep(ctx: Ctx, step: AdmissionStep, params: { familyContext?: 'family' | 'estranged' | 'none'; diet?: LifeState['diet']; needs?: string[] } = {}): { ok: boolean; message?: string } {
  const s = ctx.s;
  const ep = s.life.episode;
  if (ep.admissionSteps[step]) return { ok: true }; // idempotent resume
  const order: AdmissionStep[] = ['identity', 'orientation', 'property', 'support', 'housing'];
  const idx = order.indexOf(step);
  if (order.slice(0, idx).some((p) => !ep.admissionSteps[p])) return { ok: false, message: 'Hoàn tất bước trước trước đã.' };
  switch (step) {
    case 'identity':
      ep.state = 'orienting';
      break;
    case 'orientation':
      for (const t of ORIENTATION_TOPICS) if (ep.orientation[t.id] !== 'acknowledged') ep.orientation[t.id] = 'presented';
      break;
    case 'property': {
      if (!once(s, 'adm:property')) break;
      const lines: ReceiptLine[] = [];
      for (const p of PERSONAL_ITEMS_ON_ARRIVAL) {
        if (p.keep) { lines.push({ itemId: p.itemId, qty: 1, from: 'carried', to: 'bag', reason: 'Được phép giữ trong phòng' }); continue; }
        if (removeItem(ctx, p.itemId, 1, ['bag'])) {
          s.inventory.stored.push({ uid: `st_${p.itemId}`, itemId: p.itemId, qty: 1, provenance: 'admission' });
          lines.push({ itemId: p.itemId, qty: 1, from: 'carried', to: 'stored', reason: 'Ký gửi theo nội quy hư cấu' });
        }
      }
      addReceipt(ctx, 'deposit', 'stored', lines, 'adm_deposit');
      const issue: ReceiptLine[] = [];
      for (const [itemId, qty] of STARTER_KIT) { addItem(ctx, itemId, qty, { overflow: 'locker', provenance: 'issue', silent: true }); issue.push({ itemId, qty, from: 'issue', to: 'bag', reason: 'Cấp phát ban đầu' }); }
      addReceipt(ctx, 'issue', 'issued', issue, 'adm_issue');
      s.life.issuedKit.lastIssueDay = dayOf(s.minute);
      break;
    }
    case 'support': {
      if (params.diet) s.life.diet = params.diet;
      if (params.familyContext && params.familyContext !== ep.familyContext) {
        ep.familyContext = params.familyContext;
        s.life.contacts = CONTACTS_BY_CONTEXT[params.familyContext].map((c) => ({ id: c.id, nameKey: c.name, relation: c.relation, channels: c.channels, state: 'available' as const }));
      }
      if (params.needs && params.needs.length) setFunctionalNeeds(ctx, params.needs);
      break;
    }
    case 'housing': {
      assignHousing(ctx, PLAYER_START_BED, 'Phân chỗ ban đầu, gần lối đi chung');
      ep.state = 'admitted';
      s.flags.admission_complete = true;
      ctx.emit({ type: 'flag', key: 'admission_complete', value: true });
      notify(ctx, 'Đã hoàn tất tiếp nhận. Bạn được xếp giường 3A, khu phòng ở.', 'success', 'life');
      break;
    }
  }
  ep.admissionSteps[step] = true;
  changed(ctx, 'admission');
  return { ok: true };
}

export function skipAdmission(ctx: Ctx, defaults: { familyContext: 'family' | 'estranged' | 'none' }) {
  for (const st of ['identity', 'orientation', 'property', 'support', 'housing'] as AdmissionStep[]) admissionStep(ctx, st, st === 'support' ? { familyContext: defaults.familyContext } : {});
}

export function acknowledgeTopic(ctx: Ctx, topicId: string) {
  const o = ctx.s.life.episode.orientation;
  if (o[topicId] !== undefined) o[topicId] = 'acknowledged';
  changed(ctx, 'orientation');
}

function addReceipt(ctx: Ctx, kind: PropertyReceipt['kind'], state: PropertyReceipt['state'], lines: ReceiptLine[], sourceActionId: string, supersedes?: string): PropertyReceipt | null {
  const s = ctx.s;
  if (s.life.receipts.some((r) => r.sourceActionId === sourceActionId)) return null;
  const r: PropertyReceipt = { id: lid(ctx, 'rc'), kind, state, lines, minute: s.minute, sourceActionId, supersedes };
  s.life.receipts.push(r);
  changed(ctx, 'property');
  return r;
}
export function recordPurchaseReceipt(ctx: Ctx, lines: OrderLine[], orderId: string) {
  addReceipt(ctx, 'purchase', 'committed', lines.map((l) => ({ itemId: l.itemId, qty: l.qty, from: 'commissary', to: 'bag', reason: `Đơn ${orderId.slice(-5)}` })), `order:${orderId}`);
}

export function disputeReceipt(ctx: Ctx, receiptId: string) {
  const r = ctx.s.life.receipts.find((x) => x.id === receiptId);
  if (!r || r.state === 'disputed') return;
  r.state = 'disputed';
  submitCase(ctx, 'property', 0, `dispute:${receiptId}`, receiptId);
}

export function returnProperty(ctx: Ctx): boolean {
  const s = ctx.s;
  if (!once(s, 'property:return')) return false;
  const lines: ReceiptLine[] = [];
  for (const st of [...s.inventory.stored]) {
    lines.push({ itemId: st.itemId, qty: st.qty, from: 'stored', to: 'bag', reason: 'Hoàn trả khi rời cơ sở' });
  }
  for (const l of lines) {
    removeItem(ctx, l.itemId, l.qty, ['stored']);
    addItem(ctx, l.itemId, l.qty, { overflow: 'mailbox', provenance: 'return', silent: true });
  }
  for (const r of s.life.receipts) if (r.state === 'stored') r.state = 'returned';
  addReceipt(ctx, 'return', 'returned', lines, 'property_return');
  return true;
}

export function assignHousing(ctx: Ctx, bedSlotId: string, reason: string) {
  const s = ctx.s;
  if (s.life.housing.some((h) => h.bedSlotId === bedSlotId && (h.state === 'active' || h.state === 'reserved'))) return;
  s.life.housing.push({ id: lid(ctx, 'hs'), zone: 'L02', roomId: bedSlotId.split('_bed')[0], bedSlotId, state: 'active', startMinute: s.minute, reason });
  s.world.reservations[bedSlotId] = 'player';
}
export function currentBed(s: GameState): string | null {
  return s.life.housing.find((h) => h.state === 'active')?.bedSlotId ?? null;
}

// ======================= F58 accommodations / F50 diet / F51 culture / F46 wellbeing =======================
export function setFunctionalNeeds(ctx: Ctx, flags: string[]) {
  const s = ctx.s;
  let plan = s.life.support.find((p) => p.kind === 'functional');
  if (!plan) { plan = { kind: 'functional', state: 'active', flags: [] }; s.life.support.push(plan); }
  plan.flags = [...new Set(flags)];
  plan.state = flags.length ? 'active' : 'declined';
  changed(ctx, 'support');
}
export const hasNeed = (s: GameState, flag: string) => s.life.support.some((p) => p.kind === 'functional' && p.state === 'active' && p.flags.includes(flag));
export function setDiet(ctx: Ctx, diet: LifeState['diet']) { ctx.s.life.diet = diet; changed(ctx, 'support'); }
export function setCulture(ctx: Ctx, v: LifeState['culturalOptIn']) { ctx.s.life.culturalOptIn = v; changed(ctx, 'support'); }
export function careRestActive(s: GameState): boolean {
  return s.life.support.some((p) => p.kind === 'care' && p.state === 'active' && (p.restUntilMinute ?? 0) > s.minute);
}

// ======================= F60 Staff availability =======================
export function staffOnDuty(s: GameState, role: string): string | null {
  return s.life.staff.roleOnDuty[role] ?? null;
}
export function refreshStaff(ctx: Ctx, onDuty: Record<string, string | null>) {
  const s = ctx.s;
  const prev = s.life.staff.roleOnDuty;
  s.life.staff.roleOnDuty = onDuty;
  // Handover: reassign open cases whose actor went off duty (no orphan).
  for (const c of s.life.cases) {
    if (c.state === 'resolved' || c.state === 'withdrawn') continue;
    const now = onDuty[c.assignedRole] ?? null;
    if (c.assignedActor && c.assignedActor !== now && prev[c.assignedRole] === c.assignedActor) {
      const fromName = NPCS.find((n) => n.id === c.assignedActor)?.name ?? c.assignedActor;
      c.assignedActor = now ?? undefined;
      c.history.push({ minute: s.minute, actorRole: c.assignedRole, text: `Bàn giao ca: ${fromName} → ${now ? NPCS.find((n) => n.id === now)?.name : 'vai trò trực thay (ngoài màn hình)'}`, state: c.state });
    }
  }
  s.life.staff.lastHandoverMinute = s.minute;
}

// ======================= F38 Account & ledger (double entry) =======================
export function post(ctx: Ctx, sourceKey: string, amount: number, direction: 'credit' | 'debit', reason: string, reverses?: string): boolean {
  const s = ctx.s;
  const acc = s.life.account;
  if (!Number.isInteger(amount) || amount <= 0) return false;
  if (acc.sourceKeys.includes(sourceKey)) return false;
  if (acc.state === 'settled' && !sourceKey.startsWith('settlement')) return false;
  if (direction === 'debit' && acc.balance - amount < 0) return false;
  const batchId = lid(ctx, 'b');
  acc.entries.push({ id: lid(ctx, 'le'), batchId, account: 'player', direction, amount, reason, sourceKey, minute: s.minute, reverses });
  acc.entries.push({ id: lid(ctx, 'le'), batchId, account: 'clearing', direction: direction === 'credit' ? 'debit' : 'credit', amount, reason, sourceKey, minute: s.minute, reverses });
  acc.balance += direction === 'credit' ? amount : -amount;
  acc.sourceKeys.push(sourceKey);
  if (acc.entries.length > 400) acc.entries.splice(0, acc.entries.length - 400); // bounded history (summary kept via sourceKeys)
  changed(ctx, 'account');
  return true;
}
export const available = (s: GameState) => s.life.account.balance - s.life.account.reserved;

// ======================= F39 Commissary =======================
export const CATALOG = ITEMS.filter((i) => i.price && !i.personal);
export const ORDER_DAYS = [0, 2, 4];
export function resetWeeklyStock(ctx: Ctx) {
  const s = ctx.s;
  const week = Math.floor((dayOf(s.minute) - 1) / 7);
  if (s.world.stockResetWeek === week && Object.keys(s.world.stock).length) return;
  s.world.stockResetWeek = week;
  for (const it of CATALOG) s.world.stock[it.id] = it.id === 'cardigan' ? 2 : 12;
  s.life.weeklyQuota = {};
}
export function quote(ctx: Ctx, lines: { itemId: string; qty: number }[]): { ok: boolean; quoteId?: string; total?: number; message?: string } {
  const s = ctx.s;
  if (!lines.length || lines.length > 12) return { ok: false, message: 'Giỏ hàng cần 1–12 dòng.' };
  const out: OrderLine[] = [];
  for (const l of lines) {
    const def = ITEM_BY_ID[l.itemId];
    if (!def || !def.price || !Number.isInteger(l.qty) || l.qty < 1 || l.qty > 99) return { ok: false, message: 'Mặt hàng hoặc số lượng không hợp lệ.' };
    if ((s.world.stock[l.itemId] ?? 0) < l.qty) return { ok: false, message: `${def.name}: hết hàng hoặc không đủ số lượng (còn ${s.world.stock[l.itemId] ?? 0}).` };
    if ((s.life.weeklyQuota[l.itemId] ?? 0) + l.qty > 5) return { ok: false, message: `${def.name}: vượt hạn mức 5/tuần.` };
    out.push({ itemId: l.itemId, qty: l.qty, unitPrice: def.price });
  }
  const total = out.reduce((a, l) => a + l.qty * l.unitPrice, 0);
  const q = { id: lid(ctx, 'q'), lines: out, total, expiresMinute: s.minute + 120, catalogVersion: 'cat-1' };
  s.life.quotes = s.life.quotes.filter((x) => x.expiresMinute > s.minute).slice(-5);
  s.life.quotes.push(q);
  return { ok: true, quoteId: q.id, total };
}
export function placeOrder(ctx: Ctx, quoteId: string, actionId: string): { ok: boolean; message?: string } {
  const s = ctx.s;
  if (s.life.orders.some((o) => o.sourceActionId === actionId)) return { ok: true }; // idempotent retry
  const q = s.life.quotes.find((x) => x.id === quoteId);
  if (!q) return { ok: false, message: 'Báo giá không tồn tại.' };
  if (q.expiresMinute <= s.minute) return { ok: false, message: 'Báo giá đã hết hạn — hãy tạo báo giá mới.' };
  if (!ORDER_DAYS.includes(dayOfWeek(s.minute))) return { ok: false, message: 'Hôm nay không nhận đơn. Ngày đặt hàng: Thứ Hai, Thứ Tư, Thứ Sáu.' };
  if (available(s) < q.total) return { ok: false, message: `Không đủ số dư khả dụng (${fmtMoney(available(s))}). Vật dụng thiết yếu vẫn nhận miễn phí tại quầy.` };
  for (const l of q.lines) if ((s.world.stock[l.itemId] ?? 0) < l.qty) return { ok: false, message: `${ITEM_BY_ID[l.itemId].name} vừa hết hàng.` };
  for (const l of q.lines) { s.world.stock[l.itemId] -= l.qty; s.life.weeklyQuota[l.itemId] = (s.life.weeklyQuota[l.itemId] ?? 0) + l.qty; }
  s.life.account.reserved += q.total;
  const readyDay = dayOf(s.minute) + 1;
  s.life.orders.push({ id: lid(ctx, 'od'), quoteId, lines: q.lines, total: q.total, state: 'preparing', createdMinute: s.minute, readyMinute: (readyDay - 1) * MIN_PER_DAY + hm(8), sourceActionId: actionId, history: [`${fmtDayClock(s.minute)}: Đã giữ ${fmtMoney(q.total)}, chuẩn bị hàng`] });
  s.life.quotes = s.life.quotes.filter((x) => x.id !== quoteId);
  notify(ctx, `Đặt hàng thành công. Nhận tại Quầy dịch vụ từ 08:00 ngày ${readyDay}. Chưa trừ tiền cho tới khi nhận hàng.`, 'success', 'life');
  changed(ctx, 'orders');
  return { ok: true };
}
export function cancelOrder(ctx: Ctx, orderId: string): boolean {
  const s = ctx.s;
  const o = s.life.orders.find((x) => x.id === orderId);
  if (!o || (o.state !== 'preparing' && o.state !== 'ready' && o.state !== 'reserved')) return false;
  for (const l of o.lines) s.world.stock[l.itemId] = (s.world.stock[l.itemId] ?? 0) + l.qty;
  s.life.account.reserved = Math.max(0, s.life.account.reserved - o.total);
  o.state = 'cancelled';
  o.history.push(`${fmtDayClock(s.minute)}: Đã hủy, giải phóng tiền giữ`);
  changed(ctx, 'orders');
  return true;
}
/** Pickup: atomic debit + item transfer once per order. */
export function collectOrders(ctx: Ctx): number {
  const s = ctx.s;
  let n = 0;
  for (const o of s.life.orders) {
    if (o.state !== 'ready') continue;
    if (!post(ctx, `order:${o.id}`, o.total, 'debit', `Thanh toán đơn hàng ${o.id.slice(-5)}`)) continue;
    s.life.account.reserved = Math.max(0, s.life.account.reserved - o.total);
    for (const l of o.lines) addItem(ctx, l.itemId, l.qty, { overflow: 'locker', provenance: `order:${o.id}`, silent: true });
    o.state = 'delivered';
    o.history.push(`${fmtDayClock(s.minute)}: Đã nhận hàng, trừ ${fmtMoney(o.total)}`);
    recordPurchaseReceipt(ctx, o.lines, o.id);
    n++;
  }
  if (n) notify(ctx, `Đã nhận ${n} đơn hàng.`, 'success', 'life');
  return n;
}

/** Free essentials route (rightsFloor) — không phụ thuộc số dư/uy tín/kỷ luật. Once per day. */
export function freeEssentials(ctx: Ctx): string {
  const s = ctx.s;
  const day = dayOf(s.minute);
  if (!once(s, `essentials:${day}`)) return 'Hôm nay bạn đã nhận vật dụng thiết yếu. Nếu thiếu gấp, hãy báo nhân viên.';
  const given: ReceiptLine[] = [];
  const ensure = (id: string, want: number) => {
    const have = countItem(s, id, ['bag', 'locker']);
    if (have < want) { addItem(ctx, id, want - have, { overflow: 'locker', provenance: 'free_issue', silent: true }); given.push({ itemId: id, qty: want - have, from: 'issue', to: 'bag', reason: 'Cấp phát thiết yếu miễn phí' }); }
  };
  ensure('soap', 1); ensure('towel', 1); ensure('toothbrush', 1); ensure('envelope', 1);
  if (s.needs.hunger < 40) { addItem(ctx, 'spare_meal', 1, { provenance: 'free_issue', silent: true }); given.push({ itemId: 'spare_meal', qty: 1, from: 'issue', to: 'bag', reason: 'Suất dự phòng' }); }
  if (!given.length) return 'Bạn đã có đủ vật dụng thiết yếu.';
  addReceipt(ctx, 'issue', 'issued', given, `essentials:${day}`);
  return `Đã cấp: ${given.map((g) => `${ITEM_BY_ID[g.itemId].name} ×${g.qty}`).join(', ')}.`;
}

// ======================= Services & bookings (F41/F42/F43/F45/F46) =======================
export function serviceWindows(serviceId: string, day: number): [number, number][] {
  const sv = SERVICE_BY_ID[serviceId];
  return sv.windows.map(([a, b]) => [(day - 1) * MIN_PER_DAY + a, (day - 1) * MIN_PER_DAY + b]);
}
export function bookingSlots(s: GameState, serviceId: string): number[] {
  const sv = SERVICE_BY_ID[serviceId];
  const out: number[] = [];
  const d0 = dayOf(s.minute);
  for (let d = d0; d <= d0 + 3; d++) for (const [a, b] of serviceWindows(serviceId, d)) {
    for (let t = a; t + sv.durationMin <= b; t += Math.max(30, sv.durationMin)) {
      if (t < s.minute + sv.leadMin) continue;
      const taken = s.life.bookings.filter((x) => x.serviceId === serviceId && x.start === t && ['booked', 'waiting', 'active'].includes(x.state)).length;
      const npcLoad = (t / 30) % 3 === 0 ? 1 : 0; // NPC demand abstraction
      if (taken + npcLoad < sv.capacity) out.push(t);
    }
  }
  return out.slice(0, 12);
}
export function book(ctx: Ctx, serviceId: string, start: number, participant: string | undefined, actionId: string): { ok: boolean; message?: string; bookingId?: string } {
  const s = ctx.s;
  const sv = SERVICE_BY_ID[serviceId];
  if (!sv) return { ok: false, message: 'Dịch vụ không tồn tại.' };
  const existing = s.life.bookings.find((b) => b.sourceActionId === actionId);
  if (existing) return { ok: true, bookingId: existing.id };
  if (!bookingSlots(s, serviceId).includes(start)) return { ok: false, message: 'Khung giờ không còn trống. Hãy chọn giờ khác.' };
  const end = start + sv.durationMin;
  const overlap = s.life.bookings.find((b) => ['booked', 'waiting', 'active'].includes(b.state) && b.start < end && start < b.end);
  if (overlap) return { ok: false, message: `Trùng lịch với ${SERVICE_BY_ID[overlap.serviceId]?.name ?? 'lịch khác'} lúc ${fmtClock(overlap.start)}.` };
  if (participant) {
    const c = s.life.contacts.find((x) => x.id === participant);
    if (!c || !c.channels.includes(sv.kind as never)) return { ok: false, message: 'Liên hệ này không dùng kênh đó.' };
  }
  const b: Booking = { id: lid(ctx, 'bk'), serviceId, kind: sv.kind, participant, start, end, state: 'booked', sourceActionId: actionId, zone: sv.zone };
  s.life.bookings.push(b);
  notify(ctx, `Đã đặt ${sv.name} lúc ${fmtDayClock(start)} tại ${zoneLabel(sv.zone)}.`, 'success', 'life');
  changed(ctx, 'bookings');
  return { ok: true, bookingId: b.id };
}
const zoneLabel = (z: ZoneId) => ({ L16: 'Góc liên lạc', L12: 'Phòng thăm gặp', L11: 'Hồ sơ & tư vấn', L08: 'Phòng y tế', L17: 'Phòng yên tĩnh', L13: 'Vệ sinh & giặt' } as Record<string, string>)[z] ?? z;
export function cancelBooking(ctx: Ctx, bookingId: string, reason = 'Người chơi hủy'): boolean {
  const b = ctx.s.life.bookings.find((x) => x.id === bookingId);
  if (!b || !['booked', 'waiting'].includes(b.state)) return false;
  b.state = 'cancelled';
  b.reason = reason;
  changed(ctx, 'bookings');
  return true;
}
/** Booking due now at zone for given kind (player at station). */
export function activeBookingAt(s: GameState, kind: BookingKind, zone: ZoneId, includeActive = false): Booking | null {
  return s.life.bookings.find((b) => b.kind === kind && b.zone === zone && (['booked', 'waiting'].includes(b.state) || (includeActive && b.state === 'active')) && (b.state === 'active' || (s.minute >= b.start - 10 && s.minute < b.end))) ?? null;
}
export const BOOKING_VERBS: Record<string, BookingKind> = { call: 'call', visit: 'visit', legal_meeting: 'legal', care_appointment: 'care' };
export function completeBooking(ctx: Ctx, b: Booking, outcome: string) {
  const s = ctx.s;
  if (!once(s, `booking_done:${b.id}`)) return;
  b.state = 'completed';
  b.outcome = outcome;
  if (b.kind === 'call' || b.kind === 'visit') {
    s.life.correspondence.push({ id: lid(ctx, 'cr'), contactId: b.participant ?? '', channel: b.kind, direction: 'incoming', topic: outcome, state: 'completed', minute: s.minute, bookingId: b.id, read: true });
    changeNeed(ctx, 'mood', b.kind === 'visit' ? 12 : 7, b.kind === 'visit' ? 'Thăm gặp người thân' : 'Cuộc gọi');
    if (b.kind === 'call') s.flags.call_done = true;
  }
  if (b.kind === 'legal') {
    s.life.episode.storyMilestones.legal_review = s.minute;
    s.life.reintegration.knownNextSteps = [...new Set([...s.life.reintegration.knownNextSteps, 'Mốc xem xét hồ sơ: từ Ngày 7 theo câu chuyện'])];
  }
  if (b.kind === 'care') {
    let plan = s.life.support.find((p) => p.kind === 'care');
    if (!plan) { plan = { kind: 'care', state: 'active', flags: [] }; s.life.support.push(plan); }
    plan.state = 'active';
    plan.restUntilMinute = s.minute + MIN_PER_DAY;
    plan.nextReview = s.minute + 3 * MIN_PER_DAY;
    changeNeed(ctx, 'energy', 15, 'Chăm sóc & nghỉ');
    changeNeed(ctx, 'mood', 5, 'Được chăm sóc');
    notify(ctx, 'Kế hoạch nghỉ 24 giờ: được miễn trừ ca làm/lớp học và điểm danh không bị tính vắng.', 'info', 'life');
  }
  if (b.kind === 'support' || b.kind === 'culture') changeNeed(ctx, 'mood', 8, b.kind === 'support' ? 'Trò chuyện hỗ trợ' : 'Sinh hoạt văn hóa');
  changed(ctx, 'bookings');
}

// ======================= F40 Correspondence =======================
export function sendLetter(ctx: Ctx, contactId: string, topicId: string, actionId: string): { ok: boolean; message: string } {
  const s = ctx.s;
  const c = s.life.contacts.find((x) => x.id === contactId);
  if (!c || !c.channels.includes('letter')) return { ok: false, message: 'Liên hệ không nhận thư.' };
  if (s.life.correspondence.some((x) => x.id === actionId)) return { ok: true, message: 'Thư đã gửi.' };
  if (!removeItem(ctx, 'envelope', 1, ['bag', 'locker'])) {
    const week = Math.floor((dayOf(s.minute) - 1) / 7);
    const usedFree = s.life.sourceKeys.filter((k) => k.startsWith(`free_env:${week}:`)).length;
    if (usedFree >= 2) return { ok: false, message: 'Hết phong bì. Mua tại cửa hàng hoặc nhận cấp phát thiết yếu ở quầy dịch vụ.' };
    once(s, `free_env:${week}:${usedFree}`);
  }
  const delay = ctx.rng.next() < 0.15 ? 180 : 0;
  const due = s.minute + 240 + delay;
  s.life.correspondence.push({ id: actionId, contactId, channel: 'letter', direction: 'outgoing', topic: topicId, state: 'processing', dueMinute: due, minute: s.minute });
  s.stats.lettersSent++;
  ctx.emit({ type: 'actionCompleted', verb: 'send_letter', targetId: contactId, zone: s.player.zone, actionId });
  changed(ctx, 'letters');
  return { ok: true, message: delay ? 'Đã gửi. Thư có thể chậm hơn thường lệ do khâu xử lý (hư cấu).' : 'Đã gửi thư. Thư thường tới sau khoảng nửa ngày.' };
}
export function readLetter(ctx: Ctx, id: string) {
  const s = ctx.s;
  const l = s.life.correspondence.find((x) => x.id === id);
  if (!l || l.direction !== 'incoming') return;
  l.read = true;
  const topic = LETTER_TOPICS.find((t) => t.id === l.topic);
  if (topic && once(s, `read:${id}`)) {
    changeNeed(ctx, 'mood', topic.mood, 'Thư hồi âm');
    s.flags.letter_reply_read = true;
    if (s.life.episode.familyContext === 'family' && l.contactId === 'mother' && once(s, 'family_deposit:1')) post(ctx, 'family_deposit:1', 800, 'credit', 'Người thân gửi tiền (hư cấu)');
  }
  changed(ctx, 'letters');
}

// ======================= F44 Casework / F52 incidents / appeals =======================
export function submitCase(ctx: Ctx, factGroup: keyof typeof CASE_FACTS | CaseCategory, factIdx: number, dedupKey: string, incidentRef?: string, parentCaseId?: string): ServiceCase {
  const s = ctx.s;
  const existing = s.life.cases.find((c) => c.sourceActionId === dedupKey && !['resolved', 'withdrawn'].includes(c.state));
  if (existing) return existing;
  const fact = (CASE_FACTS[factGroup as string] ?? CASE_FACTS.general)[factIdx] ?? CASE_FACTS.general[0];
  const urgent = fact.category === 'safety' || fact.category === 'care';
  const due = s.minute + (urgent ? 30 : Math.max(1, fact.responseDays) * 720);
  const c: ServiceCase = {
    id: lid(ctx, 'cs'), category: parentCaseId ? 'discipline_review' : fact.category, facts: [fact.label], state: 'submitted', assignedRole: parentCaseId ? 'case_advisor' : fact.role,
    assignedActor: staffOnDuty(s, parentCaseId ? 'case_advisor' : fact.role) ?? undefined, dueMinute: due,
    history: [{ minute: s.minute, actorRole: 'player', text: 'Đã gửi yêu cầu — có biên nhận.', state: 'submitted' }], parentCaseId, incidentRef, sourceActionId: dedupKey, minute: s.minute,
  };
  s.life.cases.push(c);
  notify(ctx, `Đã nhận yêu cầu “${fact.label}”. Mã ${c.id.slice(-6).toUpperCase()}. Hạn phản hồi: ${fmtDayClock(due)}.`, 'info', 'life');
  changed(ctx, 'cases');
  return c;
}
export function respondCase(ctx: Ctx, caseId: string, accept: boolean) {
  const s = ctx.s;
  const c = s.life.cases.find((x) => x.id === caseId);
  if (!c || c.state !== 'answered') return;
  if (accept) {
    c.state = 'resolved';
    c.history.push({ minute: s.minute, actorRole: 'player', text: 'Chấp nhận phản hồi.', state: 'resolved' });
  } else {
    c.state = 'appealed';
    c.history.push({ minute: s.minute, actorRole: 'player', text: 'Yêu cầu xem xét lại bởi người độc lập.', state: 'appealed' });
    const ap = submitCase(ctx, 'general', 0, `appeal:${c.id}`, c.incidentRef, c.id);
    ap.facts = [`Xem xét lại: ${c.facts[0]}`];
  }
  changed(ctx, 'cases');
}
export function withdrawCase(ctx: Ctx, caseId: string) {
  const c = ctx.s.life.cases.find((x) => x.id === caseId);
  if (!c || ['resolved', 'withdrawn'].includes(c.state)) return;
  c.state = 'withdrawn';
  c.history.push({ minute: ctx.s.minute, actorRole: 'player', text: 'Rút yêu cầu (lịch sử được giữ lại).', state: 'withdrawn' });
  changed(ctx, 'cases');
}

function advanceCases(ctx: Ctx) {
  const s = ctx.s;
  for (const c of s.life.cases) {
    if (c.state === 'submitted' && s.minute >= c.minute + 20) {
      c.state = 'acknowledged';
      c.history.push({ minute: s.minute, actorRole: c.assignedRole, text: 'Đã tiếp nhận và phân công.', state: 'acknowledged' });
      if (!c.assignedActor) c.assignedActor = staffOnDuty(s, c.assignedRole) ?? undefined;
    } else if (c.state === 'acknowledged' && s.minute >= c.minute + 60) {
      c.state = 'in_review';
      c.history.push({ minute: s.minute, actorRole: c.assignedRole, text: 'Đang xem xét.', state: 'in_review' });
    } else if (c.state === 'in_review' && s.minute >= c.dueMinute) {
      resolveCaseOutcome(ctx, c);
    }
  }
}

function resolveCaseOutcome(ctx: Ctx, c: ServiceCase) {
  const s = ctx.s;
  const rec = (text: string): DecisionRecord => ({ minute: s.minute, actorRole: c.assignedRole, text, state: 'answered' });
  if (c.parentCaseId) {
    // Independent review of an incident decision or case answer.
    const inc = s.life.incidents.find((i) => i.id === c.incidentRef);
    if (inc && (inc.state === 'decided' || inc.state === 'appealed')) {
      const overturn = inc.responses.length > 0 || inc.facts.some((f) => f.confidence < 0.7);
      inc.state = overturn ? 'overturned' : 'decided';
      inc.history.push({ minute: s.minute, actorRole: 'reviewer', text: overturn ? 'Quyết định được hủy bỏ sau xem xét độc lập; quyền lợi được khôi phục.' : 'Quyết định được giữ nguyên; lý do đã được giải thích đầy đủ.', state: 'resolved' });
      if (overturn) s.life.privileges.recreationRestrictedUntil = 0;
      c.response = overturn ? 'Xem xét lại: hủy quyết định, khôi phục quyền lợi.' : 'Xem xét lại: giữ nguyên quyết định. Bạn có thể trao đổi thêm với cố vấn hồ sơ.';
    } else c.response = 'Đã xem xét lại bởi cán bộ độc lập. Phản hồi ban đầu được giải thích chi tiết hơn và ghi nhận ý kiến của bạn.';
    c.state = 'answered';
    c.history.push(rec(c.response));
  } else {
    const fact = Object.values(CASE_FACTS).flat().find((f) => f.label === c.facts[0]);
    c.response = fact?.answer ?? 'Đã phản hồi.';
    c.state = 'answered';
    c.history.push(rec(c.response));
    if (c.category === 'accommodation' && c.sourceActionId.startsWith('room_move')) proposeRoomMove(ctx);
    if (c.category === 'care') {
      const t = bookingSlots(s, 'care')[0];
      if (t !== undefined) book(ctx, 'care', t, undefined, `care_from_case:${c.id}`);
    }
    if (c.category === 'safety') { s.flags.long_mediation_offered = true; s.flags.long_resolved = true; }
    if (c.category === 'maintenance') {
      const f = s.life.facility.find((x) => x.canonicalKey === c.incidentRef);
      if (f && f.state !== 'resolved') { f.state = 'assigned'; f.dueMinute = Math.min(f.dueMinute, s.minute + 180); }
    }
  }
  notify(ctx, `Có phản hồi cho yêu cầu ${c.id.slice(-6).toUpperCase()}. Xem tại Đời sống › Yêu cầu.`, 'info', 'life');
  changed(ctx, 'cases');
}

/** F52: incident from observed facts. Allegation ≠ established outcome; rightsFloor validator rejects essential removal. */
export function reportIncident(ctx: Ctx, ruleId: string, fact: string, canonicalKey: string, confidence = 0.9) {
  const s = ctx.s;
  if (s.life.incidents.some((i) => i.canonicalKey === canonicalKey)) return;
  const inc: IncidentReview = {
    id: lid(ctx, 'inc'), kind: 'conduct', ruleId, state: 'notified', facts: [{ text: fact, provenance: 'Ghi nhận của cán bộ khu ở', confidence }], responses: [], history: [{ minute: s.minute, actorRole: 'residential', text: 'Thông báo ghi nhận (chưa phải kết luận).', state: 'submitted' }],
    canonicalKey, minute: s.minute, dueMinute: s.minute + 720,
  };
  s.life.incidents.push(inc);
  notify(ctx, `Thông báo ghi nhận sự việc: ${fact}. Bạn có thể trình bày trước ${fmtDayClock(inc.dueMinute)} (Đời sống › Sự việc).`, 'warning', 'life', true);
  changed(ctx, 'incidents');
}
export const RESPONSE_OPTIONS: { id: string; label: string }[] = [
  { id: 'busy_service', label: 'Tôi đang ở một dịch vụ/lịch hẹn khác' },
  { id: 'lost', label: 'Tôi không biết giờ hoặc bị lạc đường' },
  { id: 'unwell', label: 'Tôi không khỏe' },
  { id: 'accept', label: 'Tôi hiểu và sẽ chú ý hơn' },
];
export function respondIncident(ctx: Ctx, id: string, responseId: string) {
  const inc = ctx.s.life.incidents.find((i) => i.id === id);
  if (!inc || !['notified', 'in_review'].includes(inc.state)) return;
  if (!inc.responses.includes(responseId)) inc.responses.push(responseId);
  inc.state = 'in_review';
  inc.history.push({ minute: ctx.s.minute, actorRole: 'player', text: `Trình bày: ${RESPONSE_OPTIONS.find((r) => r.id === responseId)?.label}`, state: 'in_review' });
  changed(ctx, 'incidents');
}
export function appealIncident(ctx: Ctx, id: string) {
  const inc = ctx.s.life.incidents.find((i) => i.id === id);
  if (!inc || inc.state !== 'decided') return;
  inc.state = 'appealed';
  const c = submitCase(ctx, 'general', 0, `appeal_incident:${id}`, id, `incident:${id}`);
  c.facts = [`Xem xét lại quyết định: ${inc.facts[0].text}`];
  inc.appealCaseId = c.id;
  changed(ctx, 'incidents');
}
function advanceIncidents(ctx: Ctx) {
  const s = ctx.s;
  for (const inc of s.life.incidents) {
    if ((inc.state === 'notified' || inc.state === 'in_review') && s.minute >= inc.dueMinute) {
      // Pure policy adjudication: same facts → same outcome. Reputation/appearance never inputs.
      const valid = inc.responses.some((r) => r === 'busy_service' || r === 'unwell' || r === 'lost');
      if (valid || inc.facts.every((f) => f.confidence < 0.7)) {
        inc.state = 'dismissed';
        inc.decision = 'Không xử lý: có lý do hợp lệ hoặc dữ kiện chưa đủ.';
      } else {
        inc.state = 'decided';
        inc.decision = 'Nhắc nhở; tạm hạn chế đăng ký hoạt động giải trí buổi tối 1 ngày. Không ảnh hưởng ăn uống, vệ sinh, chăm sóc, liên lạc hay quyền gửi đơn.';
        inc.consequence = { privilege: 'evening_recreation', untilMinute: s.minute + MIN_PER_DAY };
        s.life.privileges.recreationRestrictedUntil = s.minute + MIN_PER_DAY;
      }
      inc.history.push({ minute: s.minute, actorRole: 'reviewer', text: inc.decision, state: 'answered' });
      notify(ctx, `Kết quả xem xét sự việc: ${inc.decision}`, inc.state === 'dismissed' ? 'success' : 'info', 'life', inc.state === 'decided');
      changed(ctx, 'incidents');
    }
    if (inc.state === 'decided' && inc.consequence && s.minute >= inc.consequence.untilMinute) inc.state = 'expired';
  }
}

// ======================= F37 Roll call =======================
export function rollCallResolve(ctx: Ctx, rcId: string, present: boolean, busy: boolean) {
  const s = ctx.s;
  const day = dayOf(s.minute);
  const key = `${rcId}:${day}`;
  if (s.life.attendance.some((a) => a.key === key)) return;
  const exempt = careRestActive(s) || s.life.bookings.some((b) => ['booked', 'active', 'completed'].includes(b.state) && b.start <= s.minute + 15 && b.end >= s.minute - 15);
  let outcome: 'present' | 'exempt' | 'reconciled' | 'absent' = present ? 'present' : exempt ? 'exempt' : busy ? 'reconciled' : 'absent';
  if (outcome === 'absent') {
    const weekStart = (Math.floor((day - 1) / 7)) * 7 + 1;
    const prior = s.life.attendance.filter((a) => a.outcome === 'absent' && dayOf(a.minute) >= weekStart).length;
    if (prior === 0) {
      notify(ctx, 'Bạn vắng điểm danh. Lần đầu trong tuần chỉ được nhắc. Lịch điểm danh có ở bảng lịch (K).', 'warning', 'life');
    } else {
      reportIncident(ctx, 'roll_call', `Vắng ${rcId === 'roll_am' ? 'điểm danh sáng' : 'điểm danh tối'} ngày ${day} khi không có lịch được phép`, `rollcall:${key}`, 0.9);
    }
  }
  pushBounded(s.life.attendance, { key, minute: s.minute, outcome }, 60);
  changed(ctx, 'attendance');
}

// ======================= F47/F48 Programs =======================
export function enroll(ctx: Ctx, programId: string): { ok: boolean; message: string } {
  const s = ctx.s;
  const p = PROGRAM_BY_ID[programId];
  if (!p) return { ok: false, message: 'Chương trình không tồn tại.' };
  const ex = s.life.programs.find((e) => e.programId === programId);
  if (ex && ['enrolled', 'in_progress', 'waitlisted'].includes(ex.state)) return { ok: true, message: 'Bạn đã đăng ký.' };
  const activeWork = s.life.programs.filter((e) => e.kind === 'work' && ['enrolled', 'in_progress'].includes(e.state));
  if (p.kind === 'work' && activeWork.length >= 1) return { ok: false, message: 'Mỗi người nhận tối đa một phân công lao động. Hãy rút phân công hiện tại trước.' };
  const conflict = s.life.programs.find((e) => ['enrolled', 'in_progress'].includes(e.state) && PROGRAM_BY_ID[e.programId].days.some((d) => p.days.includes(d)) && PROGRAM_BY_ID[e.programId].from < p.to && p.from < PROGRAM_BY_ID[e.programId].to);
  if (conflict) return { ok: false, message: `Trùng giờ với ${PROGRAM_BY_ID[conflict.programId].name}.` };
  if (ex) { ex.state = 'enrolled'; } else s.life.programs.push({ programId, kind: p.kind, state: 'enrolled', completedUnits: [], attendance: [], credits: 0 });
  if (p.kind === 'work' && countItem(s, 'work_gloves', ['bag', 'locker']) === 0 && p.zone === 'L10') addItem(ctx, 'work_gloves', 1, { overflow: 'locker', provenance: 'issue' });
  changed(ctx, 'programs');
  return { ok: true, message: `Đã đăng ký ${p.name}. Lịch: ${p.days.map((d) => ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][d]).join(', ')} ${fmtClock(p.from)}–${fmtClock(p.to)} tại ${p.zone}.` };
}
export function withdrawProgram(ctx: Ctx, programId: string) {
  const e = ctx.s.life.programs.find((x) => x.programId === programId);
  if (e && e.state !== 'completed') { e.state = 'withdrawn'; changed(ctx, 'programs'); }
}
export function sessionNow(s: GameState, programId: string): string | null {
  const p = PROGRAM_BY_ID[programId];
  const m = minuteOfDay(s.minute);
  if (!p.days.includes(dayOfWeek(s.minute))) return null;
  if (m < p.from - 10 || m >= p.to) return null;
  return `${programId}:${dayOf(s.minute)}`;
}
/** Activity at program station. Returns description or null if no session. */
export function attendSession(ctx: Ctx, zone: ZoneId, minutes: number): string | null {
  const s = ctx.s;
  for (const e of s.life.programs) {
    if (!['enrolled', 'in_progress'].includes(e.state)) continue;
    const p = PROGRAM_BY_ID[e.programId];
    if (p.zone !== zone) continue;
    const key = sessionNow(s, p.id);
    if (!key) continue;
    e.state = 'in_progress';
    const rec = e.attendance.find((a) => a.sessionKey === key);
    if (p.kind === 'study') {
      if (rec) return `Bạn đã hoàn thành bài của buổi này (${p.name}).`;
      pushBounded(e.attendance, { sessionKey: key, outcome: 'attended' }, 32);
      const next = p.units.find((u) => !e.completedUnits.includes(u));
      if (next) e.completedUnits.push(next);
      awardXp(ctx, p.xp, 12, `session:${key}`);
      s.flags.attended_session = true;
      let msg = `Hoàn thành bài “${next}” (${e.completedUnits.length}/${p.units.length}).`;
      if (e.completedUnits.length >= p.units.length && p.certificate && once(s, `cert:${p.id}`)) {
        e.state = 'completed';
        e.certificateMinute = s.minute;
        addItem(ctx, p.certificate, 1, { overflow: 'mailbox', provenance: `program:${p.id}` });
        notify(ctx, `Hoàn thành khóa ${p.name}! Nhận giấy ghi nhận (trong game).`, 'success', 'quest');
        msg += ' Khóa học hoàn thành!';
      }
      changed(ctx, 'programs');
      return msg;
    }
    // work: accumulate minutes into attendance record outcome partial→attended
    let r = rec;
    if (!r) { r = { sessionKey: key, outcome: 'partial' }; pushBounded(e.attendance, r, 32); }
    const mins = (s.flags[`shiftmin:${key}`] as number | undefined) ?? 0;
    s.flags[`shiftmin:${key}`] = mins + minutes;
    if (mins + minutes >= (p.to - p.from) * 0.5) r.outcome = 'attended';
    awardXp(ctx, p.xp, 6, `shift:${key}:${Math.floor(mins / 60)}`);
    s.flags.attended_session = true;
    changed(ctx, 'programs');
    return `Đã làm ${mins + minutes} phút trong ca ${p.name}.`;
  }
  return null;
}
/** Called at each minute: close finished shifts → wage once per shift key (F48). */
function settleShifts(ctx: Ctx) {
  const s = ctx.s;
  const m = minuteOfDay(s.minute);
  for (const e of s.life.programs) {
    const p = PROGRAM_BY_ID[e.programId];
    if (!['enrolled', 'in_progress'].includes(e.state) || !p.days.includes(dayOfWeek(s.minute)) || m < p.to) continue;
    const key = `${p.id}:${dayOf(s.minute)}`;
    if (!once(s, `settle:${key}`)) continue;
    const rec = e.attendance.find((a) => a.sessionKey === key);
    if (p.kind === 'work') {
      const mins = (s.flags[`shiftmin:${key}`] as number | undefined) ?? 0;
      delete s.flags[`shiftmin:${key}`];
      if (rec && rec.outcome === 'attended' && p.wagePerShift) {
        if (post(ctx, `wage:${key}`, p.wagePerShift, 'credit', `Ghi nhận ca ${p.name}`)) { e.credits += p.wagePerShift; s.flags.wage_received = true; notify(ctx, `Ca ${p.name}: ghi nhận ${fmtMoney(p.wagePerShift)}.`, 'success', 'life'); }
      } else if (rec && mins > 0 && p.wagePerShift) {
        const half = Math.floor(p.wagePerShift / 2);
        if (post(ctx, `wage:${key}`, half, 'credit', `Ghi nhận một phần ca ${p.name}`)) e.credits += half;
      } else if (!rec) {
        pushBounded(e.attendance, { sessionKey: key, outcome: careRestActive(s) ? 'excused' : 'missed' }, 32);
      }
    } else if (!rec) {
      pushBounded(e.attendance, { sessionKey: key, outcome: careRestActive(s) ? 'excused' : 'missed' }, 32);
    }
    changed(ctx, 'programs');
  }
}

// ======================= F55 Facility incidents =======================
export function breakFixture(ctx: Ctx, fixtureId: string, zone: ZoneId, label: string, fallback: string) {
  const s = ctx.s;
  const key = `fault:${fixtureId}:${dayOf(s.minute)}`;
  if (s.life.facility.some((f) => f.canonicalKey === key)) return;
  s.life.facility.push({ id: lid(ctx, 'fx'), zone, fixtureId, kind: 'maintenance', state: 'unavailable', affected: [label], fallback, dueMinute: s.minute + MIN_PER_DAY, canonicalKey: key, reportedByPlayer: false, minute: s.minute });
  s.world.brokenFixtures[fixtureId] = key;
  changed(ctx, 'facility');
}
export function reportFault(ctx: Ctx, fixtureId: string): string {
  const s = ctx.s;
  const key = s.world.brokenFixtures[fixtureId];
  const f = s.life.facility.find((x) => x.canonicalKey === key);
  if (!f) return 'Thiết bị đang hoạt động bình thường.';
  if (f.reportedByPlayer) return 'Đã có báo hỏng cho thiết bị này — đang chờ xử lý.';
  f.reportedByPlayer = true;
  f.state = 'assigned';
  f.dueMinute = Math.min(f.dueMinute, s.minute + 240);
  submitCase(ctx, 'maintenance', 0, `maint:${key}`, key);
  s.flags.fault_reported = true;
  changed(ctx, 'facility');
  return `Đã báo hỏng. Thợ bảo trì dự kiến xử lý trước ${fmtClock(f.dueMinute)}. Tạm thời: ${f.fallback}.`;
}
function advanceFacility(ctx: Ctx) {
  const s = ctx.s;
  for (const f of s.life.facility) {
    if (f.state !== 'resolved' && s.minute >= f.dueMinute) {
      f.state = 'resolved';
      if (f.fixtureId) delete s.world.brokenFixtures[f.fixtureId];
      s.flags.fault_resolved = true;
      notify(ctx, `Đã sửa xong: ${f.affected.join(', ')}.`, 'success', 'life');
      changed(ctx, 'facility');
    }
  }
}

// ======================= F53 Inspection =======================
export function runInspection(ctx: Ctx) {
  const s = ctx.s;
  const day = dayOf(s.minute);
  if (!once(s, `inspect:${day}`)) return;
  const lines: ReceiptLine[] = [];
  for (const c of ['bag', 'locker'] as const) {
    for (const st of s.inventory[c]) {
      if (!st) continue;
      const def = ITEM_BY_ID[st.itemId];
      if (def.personal && st.itemId !== 'photo') lines.push({ itemId: st.itemId, qty: st.qty, from: c, to: 'stored', reason: 'Đồ cá nhân cần ký gửi' });
      if (LIBRARY_BOOKS.includes(st.itemId)) {
        const borrowed = s.flags[`borrowed:${st.itemId}`] as number | undefined;
        if (borrowed !== undefined && day - borrowed > 7) lines.push({ itemId: st.itemId, qty: st.qty, from: c, to: 'library', reason: 'Sách quá hạn — đã trả hộ thư viện, không phạt' });
      }
    }
  }
  for (const l of lines) {
    removeItem(ctx, l.itemId, l.qty, [l.from as 'bag' | 'locker']);
    if (l.to === 'stored') s.inventory.stored.push({ uid: `st_${l.itemId}_${day}`, itemId: l.itemId, qty: l.qty, provenance: 'inspection' });
  }
  addReceipt(ctx, 'inspect', lines.length ? 'stored' : 'committed', lines.length ? lines : [{ itemId: 'handbook', qty: 0, from: 'cell', to: 'cell', reason: 'Kiểm tra định kỳ: không có thay đổi' }], `inspect:${day}`);
  notify(ctx, lines.length ? `Kiểm tra phòng định kỳ: ${lines.length} thay đổi, xem biên nhận tại Đời sống › Tài sản.` : 'Kiểm tra phòng định kỳ: không có thay đổi. Biên nhận đã lưu.', 'info', 'life');
}

// ======================= F56 Room move =======================
export function requestRoomMove(ctx: Ctx) {
  const s = ctx.s;
  if (s.life.transitions.some((t) => t.kind === 'room_move' && !['committed', 'cancelled'].includes(t.state))) return;
  submitCase(ctx, 'housing', 0, `room_move:${dayOf(s.minute)}`);
}
function proposeRoomMove(ctx: Ctx) {
  const s = ctx.s;
  const from = currentBed(s);
  if (!from || from === ROOM_MOVE_DEST_BED) return;
  if (s.life.transitions.some((t) => t.kind === 'room_move' && !['committed', 'cancelled'].includes(t.state))) return;
  s.life.transitions.push({ id: lid(ctx, 'tr'), kind: 'room_move', state: 'proposed', fromAnchor: from, toAnchor: ROOM_MOVE_DEST_BED, minute: s.minute, sourceActionId: `room_move_tr:${dayOf(s.minute)}`, packingConfirmed: false });
  notify(ctx, 'Có đề xuất chuyển phòng. Xem chuẩn bị tại Đời sống › Chuyển nơi.', 'info', 'life', true);
  changed(ctx, 'transitions');
}
/** Saga: confirm packing → staged (reserve dest) → commit (old ended, new active) atomically; cancel compensates. */
export function confirmTransition(ctx: Ctx, id: string): { ok: boolean; message: string } {
  const s = ctx.s;
  const t = s.life.transitions.find((x) => x.id === id);
  if (!t) return { ok: false, message: 'Không tìm thấy.' };
  if (t.state === 'committed') return { ok: true, message: 'Đã hoàn tất.' };
  if (t.kind !== 'room_move') return { ok: false, message: 'Loại chuyển này được xử lý ở kế hoạch rời cơ sở.' };
  if (s.player.mode === 'sleeping' || s.player.action) return { ok: false, message: 'Hãy hoàn tất hành động hiện tại trước.' };
  t.packingConfirmed = true;
  t.state = 'staged';
  const old = s.life.housing.find((h) => h.state === 'active');
  if (s.life.housing.some((h) => h.bedSlotId === t.toAnchor && ['reserved', 'active'].includes(h.state))) { t.state = 'cancelled'; return { ok: false, message: 'Giường đích không còn trống; yêu cầu đã được hoàn lại.' }; }
  const dest = { id: lid(ctx, 'hs'), zone: 'L02' as ZoneId, roomId: t.toAnchor.split('_bed')[0], bedSlotId: t.toAnchor, state: 'reserved' as const, startMinute: s.minute, reason: 'Chuyển phòng theo yêu cầu', transferId: t.id };
  s.life.housing.push(dest);
  if (old) old.state = 'moving';
  t.state = 'in_transit';
  // commit atomically (SP local authority)
  if (old) { old.state = 'ended'; old.endMinute = s.minute; delete s.world.reservations[old.bedSlotId]; }
  (dest as { state: string }).state = 'active';
  s.world.reservations[t.toAnchor] = 'player';
  t.state = 'committed';
  t.committedMinute = s.minute;
  addReceipt(ctx, 'transfer', 'committed', [{ itemId: 'handbook', qty: 0, from: t.fromAnchor, to: t.toAnchor, reason: 'Chuyển phòng: tủ cá nhân và đồ đạc đi theo, không mất món nào' }], `transfer:${t.id}`);
  notify(ctx, `Đã chuyển sang ${t.toAnchor.replace('cell_', 'phòng ').replace('_bed_', ' giường ').toUpperCase()}.`, 'success', 'life');
  changed(ctx, 'transitions');
  return { ok: true, message: 'Chuyển phòng hoàn tất.' };
}
export function cancelTransition(ctx: Ctx, id: string) {
  const t = ctx.s.life.transitions.find((x) => x.id === id);
  if (!t || ['committed', 'cancelled'].includes(t.state)) return;
  t.state = 'cancelled';
  changed(ctx, 'transitions');
}

// ======================= F57 Release / reintegration =======================
export function releaseEligible(s: GameState): boolean {
  return dayOf(s.minute) >= s.life.episode.releaseEligibleDay && s.quests.Q06?.state === 'active';
}
export function setPlanGoal(ctx: Ctx, key: keyof LifeState['reintegration']['goals'], value: string | null) {
  ctx.s.life.reintegration.goals[key] = value;
  const n = Object.values(ctx.s.life.reintegration.goals).filter(Boolean).length;
  if (n >= 3 && ctx.s.life.reintegration.state === 'planning') ctx.s.life.reintegration.state = 'review';
  changed(ctx, 'reintegration');
}
export function depart(ctx: Ctx): { ok: boolean; message: string } {
  const s = ctx.s;
  if (!releaseEligible(s)) return { ok: false, message: 'Chưa đến mốc xem xét theo câu chuyện.' };
  if (!once(s, 'departure')) return { ok: true, message: 'Đã rời cơ sở.' };
  for (const o of s.life.orders) if (['preparing', 'ready', 'reserved'].includes(o.state)) cancelOrder(ctx, o.id);
  for (const b of s.life.bookings) if (['booked', 'waiting'].includes(b.state)) { b.state = 'cancelled'; b.reason = 'Rời cơ sở'; }
  returnProperty(ctx);
  const bal = s.life.account.balance;
  if (bal > 0) post(ctx, 'settlement:final', bal, 'debit', 'Quyết toán khi rời cơ sở (chuyển cho người chơi trong câu chuyện)');
  s.life.account.state = 'settled';
  s.life.reintegration.settlementSourceKey = 'settlement:final';
  for (const h of s.life.housing) if (h.state === 'active') { h.state = 'ended'; h.endMinute = s.minute; }
  const goals = Object.values(s.life.reintegration.goals).filter(Boolean).length;
  s.life.reintegration.state = 'departed';
  s.life.reintegration.endingId = goals >= 3 ? 'steady' : 'partial';
  s.life.episode.state = 'released';
  s.life.episode.closedMinute = s.minute;
  s.flags.departed = true;
  s.flags.settled_amount = bal;
  ctx.emit({ type: 'flag', key: 'departed', value: true });
  changed(ctx, 'reintegration');
  return { ok: true, message: 'Rời cơ sở.' };
}

// ======================= Due processing (called every game minute) =======================
export function lifeTick(ctx: Ctx) {
  const s = ctx.s;
  if (s.life.episode.state === 'released' || s.life.episode.state === 'archived') return;
  const m = minuteOfDay(s.minute);
  const day = dayOf(s.minute);
  // Letters: delivery + replies
  for (const l of [...s.life.correspondence]) {
    if (l.direction === 'outgoing' && l.state === 'processing' && l.dueMinute !== undefined && s.minute >= l.dueMinute) {
      l.state = 'delivered';
      const contact = s.life.contacts.find((c) => c.id === l.contactId);
      s.life.correspondence.push({ id: `${l.id}_reply`, contactId: l.contactId, channel: 'letter', direction: 'incoming', topic: l.topic, state: 'processing', dueMinute: s.minute + 300 + Math.floor(ctx.rng.next() * 240), minute: s.minute, replyTo: l.id });
      notify(ctx, `Thư gửi ${contact?.nameKey ?? ''} đã được chuyển đi.`, 'info', 'life');
    }
    if (l.direction === 'incoming' && l.state === 'processing' && l.dueMinute !== undefined && s.minute >= l.dueMinute) {
      l.state = 'delivered';
      l.minute = s.minute;
      const contact = s.life.contacts.find((c) => c.id === l.contactId);
      notify(ctx, `Có thư hồi âm từ ${contact?.nameKey ?? 'liên hệ'}. Đọc tại Đời sống › Liên lạc.`, 'success', 'life');
      changed(ctx, 'letters');
    }
  }
  // Bookings lifecycle
  for (const b of s.life.bookings) {
    if (b.state === 'booked' && s.minute >= b.start - 30 && once(s, `remind:${b.id}`)) {
      // unavailable contact (seeded) → reschedule offer, never charge
      if ((b.kind === 'call' || b.kind === 'visit') && ctx.rng.next() < (b.kind === 'visit' ? 0.15 : 0.08)) {
        b.state = b.kind === 'visit' ? 'missed' : 'rescheduled';
        b.reason = b.kind === 'visit' ? 'Khách thăm không đến được (hư cấu). Bạn có thể đặt lại lịch hoặc viết thư.' : 'Liên hệ bận, cuộc gọi cần đổi lịch. Không mất lượt.';
        notify(ctx, b.reason, 'warning', 'life', true);
        changed(ctx, 'bookings');
        continue;
      }
      notify(ctx, `Nhắc lịch: ${SERVICE_BY_ID[b.serviceId]?.name} lúc ${fmtClock(b.start)} tại ${zoneLabel(b.zone)}.`, 'info', 'life');
    }
    if (['booked', 'waiting'].includes(b.state) && s.minute >= b.end) {
      b.state = 'missed';
      b.reason = 'Không có mặt — không bị phạt. Có thể đặt lại.';
      changed(ctx, 'bookings');
    }
  }
  // Orders ready
  for (const o of s.life.orders) if (o.state === 'preparing' && s.minute >= o.readyMinute) { o.state = 'ready'; o.history.push(`${fmtDayClock(s.minute)}: Sẵn sàng nhận tại Quầy dịch vụ`); notify(ctx, 'Đơn hàng đã sẵn sàng tại Quầy dịch vụ.', 'info', 'life'); changed(ctx, 'orders'); }
  advanceCases(ctx);
  advanceIncidents(ctx);
  advanceFacility(ctx);
  settleShifts(ctx);
  // Weekly allowance (Thứ Hai 08:00) & stock reset
  if (dayOfWeek(s.minute) === 0 && m >= hm(8)) {
    const week = Math.floor((day - 1) / 7);
    if (post(ctx, `allowance:w${week}`, 1000, 'credit', 'Trợ cấp tuần (hư cấu)')) notify(ctx, 'Đã nhận trợ cấp tuần 10,00 tín chỉ.', 'info', 'life');
  }
  if (m >= 1) resetWeeklyStock(ctx);
  // Scheduled story beats
  if (day === 2 && m >= hm(6)) breakFixture(ctx, 'sink_2', 'L13', 'Bồn rửa 3', 'dùng các bồn rửa còn lại hoặc vòi nước ở hành lang');
  if (day >= 2 && day % 7 === 5 && m >= hm(10)) runInspection(ctx);
  if (day >= 3 && m >= hm(15) && !s.flags.facility_drill_note && day % 4 === 3) {
    s.flags.facility_drill_note = true;
    notify(ctx, 'Thông báo: khu vực sân có thể đóng tạm khi thời tiết xấu. Lựa chọn thay thế: phòng tập.', 'info', 'life');
  }
  // Care plan review
  for (const p of s.life.support) if (p.kind === 'care' && p.state === 'active' && p.nextReview && s.minute >= p.nextReview) { p.state = 'review_needed'; changed(ctx, 'support'); }
  // Laundry nudge
  if (day - s.life.issuedKit.laundryCleanDay >= 3 && m === hm(7) && once(s, `laundry_nudge:${day}`)) notify(ctx, 'Đồ đã mặc vài ngày — đổi đồ giặt tại Vệ sinh & giặt.', 'info', 'life');
  if (day - s.life.issuedKit.laundryCleanDay >= 3 && once(s, `worn:${day}`) && countItem(s, 'uniform_clean', ['bag']) > 0) {
    removeItem(ctx, 'uniform_clean', 1, ['bag']);
    addItem(ctx, 'uniform_worn', 1, { silent: true });
  }
}

export function laundryExchange(ctx: Ctx): string {
  const s = ctx.s;
  const worn = countItem(s, 'uniform_worn', ['bag']);
  if (worn > 0) {
    removeItem(ctx, 'uniform_worn', worn, ['bag']);
    addItem(ctx, 'uniform_clean', worn, { overflow: 'locker', provenance: 'laundry', silent: true });
  } else if (countItem(s, 'uniform_clean', ['bag', 'locker']) === 0) {
    addItem(ctx, 'uniform_clean', 1, { overflow: 'locker', provenance: 'laundry_replace', silent: true });
  }
  s.life.issuedKit.laundryCleanDay = dayOf(s.minute);
  changeNeed(ctx, 'mood', 2, 'Đồ sạch');
  addReceipt(ctx, 'replace', 'issued', [{ itemId: 'uniform_clean', qty: Math.max(1, worn), from: 'laundry', to: 'bag', reason: 'Đổi đồ giặt' }], `laundry:${s.tick}`);
  return worn > 0 ? `Đã đổi ${worn} bộ đồ cần giặt lấy đồ sạch.` : 'Đã nhận bộ đồ sạch và khăn mới.';
}

export function lifeSummaryCounts(s: GameState) {
  return {
    unreadLetters: s.life.correspondence.filter((c) => c.direction === 'incoming' && c.state === 'delivered' && !c.read).length,
    openCases: s.life.cases.filter((c) => !['resolved', 'withdrawn'].includes(c.state)).length,
    answeredCases: s.life.cases.filter((c) => c.state === 'answered').length,
    readyOrders: s.life.orders.filter((o) => o.state === 'ready').length,
    upcoming: s.life.bookings.filter((b) => ['booked', 'waiting'].includes(b.state)).length,
    incidents: s.life.incidents.filter((i) => ['notified', 'in_review', 'decided'].includes(i.state)).length,
    transitions: s.life.transitions.filter((t) => t.state === 'proposed').length,
  };
}

export function staffForRole(role: string) { return NPCS.filter((n) => n.staffRole === role); }
export { SERVICES, PROGRAMS, adjustRel, adjustRep };
