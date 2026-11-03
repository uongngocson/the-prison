// Core rules: inventory (F11/F12), needs (F22–F25), skills (F16), relationships (F08/F09), ledger (DB26), notifications.
import type { ContainerId, DomainEvent, GameState, ItemStack, NeedKey, NotificationEntry, SkillId } from './types';
import { ITEM_BY_ID } from '../content/items';
import { NPC_BY_ID } from '../content/npcs';
import { Rng, clamp, dayOf, pushBounded } from './util';

export interface SimSettings { lightNeeds: boolean; autoComplete: boolean; dayLengthRealMin: 48 | 72; /** Nội dung xung đột (ẩu đả). Thiếu = bật. */ conflicts?: boolean }
export interface Ctx { s: GameState; rng: Rng; emit: (e: DomainEvent) => void; settings: SimSettings }

// ---------- Ledger / idempotency ----------
export const ledgerHas = (s: GameState, key: string) => s.rewardLedger.includes(key);
export function ledgerAdd(s: GameState, key: string): boolean {
  if (s.rewardLedger.includes(key)) return false;
  s.rewardLedger.push(key);
  return true;
}
export function actionSeen(s: GameState, actionId: string): boolean {
  if (s.processedActions.includes(actionId)) return true;
  pushBounded(s.processedActions, actionId, 256);
  return false;
}

// ---------- Notifications (F31/U18) ----------
let notifSeq = 0;
export function notify(ctx: Ctx, text: string, severity: NotificationEntry['severity'] = 'info', group: NotificationEntry['group'] = 'system', persistent = false) {
  const entry: NotificationEntry = { id: `n${ctx.s.tick}_${notifSeq++}`, minute: ctx.s.minute, severity, group, text, persistent };
  pushBounded(ctx.s.notifications, entry, 100);
  ctx.emit({ type: 'notify', entry });
}

// ---------- Inventory ----------
export function containerSlots(s: GameState, c: ContainerId): (ItemStack | null)[] {
  if (c === 'bag') return s.inventory.bag;
  if (c === 'locker') return s.inventory.locker;
  if (c === 'mailbox') return s.inventory.mailbox;
  return s.inventory.stored;
}
export function countItem(s: GameState, itemId: string, containers: ContainerId[] = ['bag']): number {
  let n = 0;
  for (const c of containers) for (const st of containerSlots(s, c)) if (st && st.itemId === itemId) n += st.qty;
  return n;
}
export function totalItems(s: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of ['bag', 'locker', 'mailbox', 'stored'] as ContainerId[]) for (const st of containerSlots(s, c)) if (st) out[st.itemId] = (out[st.itemId] ?? 0) + st.qty;
  return out;
}
let uidSeq = 0;
function newUid(ctx: Ctx) { return `it_${ctx.s.tick.toString(36)}_${(uidSeq++).toString(36)}_${Math.floor(ctx.rng.next() * 1e6).toString(36)}`; }

/** Capacity check without mutation. */
export function canAdd(s: GameState, itemId: string, qty: number, c: 'bag' | 'locker'): number {
  const def = ITEM_BY_ID[itemId];
  if (!def) return 0;
  let room = 0;
  for (const st of containerSlots(s, c)) {
    if (!st) room += def.stack;
    else if (st.itemId === itemId) room += def.stack - st.qty;
  }
  return Math.min(room, qty);
}

/**
 * Add items atomically. Full bag → overflow 'mailbox' (reward storage, không mất) or 'locker' or fail without mutation.
 */
export function addItem(ctx: Ctx, itemId: string, qty: number, opts: { container?: 'bag' | 'locker'; overflow?: 'mailbox' | 'locker' | 'fail'; provenance?: string; silent?: boolean } = {}): { ok: boolean; mailboxed: number } {
  const def = ITEM_BY_ID[itemId];
  if (!def || qty <= 0 || !Number.isInteger(qty)) return { ok: false, mailboxed: 0 };
  const c = opts.container ?? 'bag';
  const overflow = opts.overflow ?? 'mailbox';
  const fits = canAdd(ctx.s, itemId, qty, c);
  if (fits < qty && overflow === 'fail') return { ok: false, mailboxed: 0 };
  let left = qty;
  const slots = containerSlots(ctx.s, c);
  for (const st of slots) {
    if (left <= 0) break;
    if (st && st.itemId === itemId && st.qty < def.stack) {
      const n = Math.min(left, def.stack - st.qty);
      st.qty += n;
      left -= n;
    }
  }
  for (let i = 0; i < slots.length && left > 0; i++) {
    if (!slots[i]) {
      const n = Math.min(left, def.stack);
      slots[i] = { uid: newUid(ctx), itemId, qty: n, provenance: opts.provenance };
      left -= n;
    }
  }
  if (left > 0 && overflow === 'locker' && c === 'bag') {
    const r = addItem(ctx, itemId, left, { container: 'locker', overflow: 'mailbox', provenance: opts.provenance, silent: true });
    left = 0;
    if (!opts.silent) ctx.emit({ type: 'itemAdded', itemId, qty, container: 'locker' });
    return { ok: true, mailboxed: r.mailboxed };
  }
  let mailboxed = 0;
  if (left > 0) {
    ctx.s.inventory.mailbox.push({ uid: newUid(ctx), itemId, qty: left, provenance: opts.provenance });
    mailboxed = left;
    notify(ctx, `Túi đầy — ${def.name} ×${left} được giữ ở hộp nhận đồ (mở túi đồ để lấy).`, 'warning', 'system');
  }
  if (!opts.silent) ctx.emit({ type: 'itemAdded', itemId, qty, container: c });
  return { ok: true, mailboxed };
}

export function removeItem(ctx: Ctx, itemId: string, qty: number, containers: ContainerId[] = ['bag']): boolean {
  if (qty <= 0 || countItem(ctx.s, itemId, containers) < qty) return false;
  let left = qty;
  for (const c of containers) {
    const slots = containerSlots(ctx.s, c);
    for (let i = slots.length - 1; i >= 0 && left > 0; i--) {
      const st = slots[i];
      if (!st || st.itemId !== itemId) continue;
      const n = Math.min(left, st.qty);
      st.qty -= n;
      left -= n;
      if (st.qty === 0) {
        if (ctx.s.equipped.outfit === st.uid) ctx.s.equipped.outfit = null;
        if (ctx.s.equipped.held === st.uid) ctx.s.equipped.held = null;
        if (c === 'mailbox' || c === 'stored') slots.splice(i, 1);
        else slots[i] = null;
      }
    }
  }
  ctx.emit({ type: 'itemRemoved', itemId, qty });
  return true;
}

/** Move a whole stack between containers (bag↔locker, mailbox→bag). Conservation: identity uid preserved. */
export function moveStack(ctx: Ctx, from: ContainerId, index: number, to: 'bag' | 'locker'): boolean {
  const src = containerSlots(ctx.s, from);
  const st = src[index];
  if (!st) return false;
  const dst = containerSlots(ctx.s, to);
  const def = ITEM_BY_ID[st.itemId];
  // merge first
  for (const d of dst) if (d && d.itemId === st.itemId && d.qty < def.stack) {
    const n = Math.min(st.qty, def.stack - d.qty);
    d.qty += n;
    st.qty -= n;
  }
  if (st.qty > 0) {
    const empty = dst.findIndex((x) => !x);
    if (empty < 0) {
      if (st.qty === 0) return true;
      return false; // partial merges kept; remainder stays
    }
    dst[empty] = { ...st };
  }
  if (ctx.s.equipped.outfit === st.uid && to !== 'bag') ctx.s.equipped.outfit = null;
  if (from === 'mailbox' || from === 'stored') src.splice(index, 1);
  else src[index] = null;
  return true;
}

export function bagFull(s: GameState) { return s.inventory.bag.every((x) => x); }

// ---------- Needs ----------
export const NEED_LABEL: Record<NeedKey, string> = { energy: 'Năng lượng', hunger: 'No bụng', hygiene: 'Vệ sinh', mood: 'Tâm trạng' };
export function changeNeed(ctx: Ctx, key: NeedKey, delta: number, cause?: string) {
  const s = ctx.s;
  s.needs[key] = clamp(s.needs[key] + delta, 0, 100);
  if (cause) s.needCauses[key] = cause;
}
/** Decay applied from elapsed simulated minutes (không theo FPS). */
export function decayNeeds(ctx: Ctx, dtMin: number, sleeping: boolean, extraRest = false) {
  const k = ctx.settings.lightNeeds ? 0.5 : 1;
  const s = ctx.s;
  s.needs.hunger = clamp(s.needs.hunger - (3 / 60) * dtMin * k, 0, 100);
  if (!sleeping) s.needs.energy = clamp(s.needs.energy - (2 / 60) * dtMin * k * (extraRest ? 0.7 : 1), 0, 100);
  s.needs.hygiene = clamp(s.needs.hygiene - (1.5 / 60) * dtMin * k, 0, 100);
  const m = s.needs.mood;
  const toward = 60 + (s.needs.hunger < 25 ? -10 : 0) + (s.needs.energy < 25 ? -8 : 0) + (s.needs.hygiene < 25 ? -6 : 0);
  s.needs.mood = clamp(m + Math.sign(toward - m) * Math.min(Math.abs(toward - m), (2 / 60) * dtMin), 0, 100);
}
/** Efficiency multiplier for activities (dưới 10: tối đa −15%). */
export function efficiency(s: GameState): number {
  const low = Math.min(s.needs.energy, s.needs.hunger, s.needs.hygiene);
  return low < 10 ? 0.85 : 1;
}

// ---------- Skills ----------
export const SKILL_LABEL: Record<SkillId, string> = { focus: 'Tập trung', fitness: 'Thể lực', communication: 'Giao tiếp' };
export const SKILL_THRESHOLDS = [0, 100, 250, 450, 700];
export function levelOf(xp: number): number {
  let l = 1;
  for (let i = 0; i < SKILL_THRESHOLDS.length; i++) if (xp >= SKILL_THRESHOLDS[i]) l = i + 1;
  return l;
}
export function awardXp(ctx: Ctx, skill: SkillId, amount: number, sourceKey: string, softCap = true): number {
  const s = ctx.s;
  if (!ledgerAdd(s, `xp:${sourceKey}`)) return 0;
  const day = dayOf(s.minute);
  if (s.dailyXp.day !== day) s.dailyXp = { day, bySource: {} };
  const today = s.dailyXp.bySource[skill] ?? 0;
  let amt = Math.round(amount * efficiency(s));
  if (softCap && today >= 80) amt = Math.max(1, Math.round(amt * 0.4));
  s.dailyXp.bySource[skill] = today + amt;
  const before = levelOf(s.skills[skill]);
  s.skills[skill] = Math.min(1_000_000, s.skills[skill] + amt);
  const after = levelOf(s.skills[skill]);
  ctx.emit({ type: 'xp', skill, amount: amt, levelUp: after > before });
  if (after > before) notify(ctx, `${SKILL_LABEL[skill]} lên cấp ${after}!`, 'success', 'quest');
  return amt;
}

// ---------- Relationships & reputation ----------
export function relOf(s: GameState, npcId: string) {
  let r = s.relationships[npcId];
  if (!r) r = s.relationships[npcId] = { trust: 0, respect: 0, familiarity: 0, known: false, recent: [], lastDayBonus: {} };
  return r;
}
export function adjustRel(ctx: Ctx, npcId: string, d: { trust?: number; respect?: number; familiarity?: number }, cause: string, repeatKey?: string) {
  if (!NPC_BY_ID[npcId]) return;
  const s = ctx.s;
  const r = relOf(s, npcId);
  let k = 1;
  if (repeatKey) {
    const day = dayOf(s.minute);
    const last = r.lastDayBonus[repeatKey];
    if (last === day) k = 0.3; // lặp cùng ngày giảm hiệu quả
    r.lastDayBonus[repeatKey] = day;
  }
  const dt = Math.round((d.trust ?? 0) * k);
  r.trust = clamp(r.trust + dt, -100, 100);
  r.respect = clamp(r.respect + Math.round((d.respect ?? 0) * k), -100, 100);
  r.familiarity = clamp(r.familiarity + Math.round((d.familiarity ?? 0) * k), 0, 100);
  r.known = true;
  if (dt !== 0) {
    pushBounded(r.recent, { minute: s.minute, text: cause, delta: dt }, 8);
    ctx.emit({ type: 'relationship', npcId, delta: dt, cause });
  }
}
export function relTier(r: { trust: number; familiarity: number; known: boolean } | undefined): string {
  if (!r || !r.known) return 'Chưa quen';
  if (r.trust <= -25) return 'Căng thẳng';
  if (r.trust >= 50) return 'Tin cậy';
  if (r.trust >= 20 || r.familiarity >= 30) return 'Thân quen';
  return 'Đã biết';
}
export function adjustRep(ctx: Ctx, group: string, delta: number, cause: string) {
  const r = (ctx.s.reputation[group] ??= { value: 0, lastCause: '' });
  r.value = clamp(r.value + delta, -100, 100);
  r.lastCause = cause;
}
export function repTier(v: number): string {
  if (v >= 40) return 'Được tôn trọng';
  if (v >= 15) return 'Được ghi nhận';
  if (v <= -20) return 'Có lo ngại';
  return 'Trung lập';
}
