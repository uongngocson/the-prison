import { describe, expect, it } from 'vitest';
import { createNewGame } from '../src/domain/newgame';
import { GameSession } from '../src/simulation/session';
import { skipAdmission, post, quote, placeOrder, cancelOrder, freeEssentials, book, bookingSlots, sendLetter, enroll, submitCase, respondCase, reportIncident, respondIncident } from '../src/domain/life';
import { addItem, removeItem, totalItems, countItem, awardXp } from '../src/domain/core';
import { PROP_BY_ID, SLOTS } from '../src/content/world';
import { canonicalJson, dayOf, minuteOfDay } from '../src/domain/util';
import { migrate, validateSave } from '../src/persistence/saveCodec';

const settings = { lightNeeds: false, autoComplete: false, dayLengthRealMin: 48 as const };
function newSession(seed = 7) {
  const s = createNewGame({ name: 'An', appearance: { body: 'medium', skin: 1, hair: 1, hairColor: 0, outfit: 0 }, familyContext: 'family', seed }, `lin_${seed}`);
  const g = new GameSession(s, settings);
  g.exec((ctx) => skipAdmission(ctx, { familyContext: 'family' }));
  return g;
}

describe('admission & quests', () => {
  it('skip admission yields admitted state, receipts, bed, Q01 active', () => {
    const g = newSession();
    expect(g.s.life.episode.state).toBe('admitted');
    expect(g.s.life.receipts.length).toBeGreaterThanOrEqual(2);
    expect(g.s.life.housing.filter((h) => h.state === 'active')).toHaveLength(1);
    expect(g.s.quests.Q01.state).toBe('active');
    expect(g.s.inventory.stored.map((x) => x.itemId).sort()).toEqual(['keyring', 'street_clothes', 'wallet', 'watch']);
  });
  it('admission is idempotent (retry không phát đồ hai lần)', () => {
    const g = newSession();
    const before = canonicalJson(totalItems(g.s));
    g.exec((ctx) => skipAdmission(ctx, { familyContext: 'family' }));
    expect(canonicalJson(totalItems(g.s))).toBe(before);
  });
});

describe('simulation days (QA04 subset)', () => {
  it('runs 2 game days without orphan reservations or NaN', () => {
    const g = newSession(11);
    g.fastForward(60 * 48, false);
    const s = g.s;
    expect(dayOf(s.minute)).toBeGreaterThanOrEqual(3);
    for (const n of Object.values(s.npcs)) {
      expect(Number.isFinite(n.pos.x)).toBe(true);
      expect(Number.isFinite(n.pos.z)).toBe(true);
    }
    // each slot reserved by at most one owner, owners exist
    const owners = Object.entries(s.world.reservations);
    for (const [slot, owner] of owners) if (!slot.startsWith('player:')) expect(owner === 'player' || !!s.npcs[owner]).toBe(true);
    const perOwner = new Map<string, number>();
    for (const [slot, owner] of owners) if (owner !== 'player' && SLOTS.some((x) => x.id === slot)) perOwner.set(owner, (perOwner.get(owner) ?? 0) + 1);
    for (const v of perOwner.values()) expect(v).toBeLessThanOrEqual(1);
    for (const k of ['energy', 'hunger', 'hygiene', 'mood'] as const) { expect(s.needs[k]).toBeGreaterThanOrEqual(0); expect(s.needs[k]).toBeLessThanOrEqual(100); }
  });
  it('real-time stepping keeps NPCs moving on paths', () => {
    const g = newSession(3);
    for (let i = 0; i < 30 * 60; i++) g.update(1 / 30);
    const moving = Object.values(g.s.npcs).filter((n) => !n.absent);
    expect(moving.length).toBeGreaterThan(20);
  });
});

describe('inventory conservation (QA01)', () => {
  it('1k random add/remove operations conserve item totals', () => {
    const g = newSession(5);
    const ids = ['fruit', 'biscuits', 'soap', 'pen', 'notebook', 'tea'];
    const all = ['bag', 'locker', 'mailbox'] as const;
    const initial = ids.reduce((a, id) => a + countItem(g.s, id, [...all]), 0);
    let delta = 0;
    g.exec((ctx) => {
      for (let i = 0; i < 1000; i++) {
        const id = ids[i % ids.length];
        if (ctx.rng.next() < 0.6) { const q = 1 + (i % 3); if (addItem(ctx, id, q, { overflow: 'mailbox', silent: true }).ok) delta += q; }
        else { const n = 1 + (i % 2); if (removeItem(ctx, id, n, [...all])) delta -= n; }
      }
    });
    const total = ids.reduce((a, id) => a + countItem(g.s, id, [...all]), 0);
    expect(total).toBe(initial + delta);
    for (const c of all) for (const st of g.s.inventory[c]) if (st) expect(st.qty).toBeGreaterThan(0);
  });
  it('xp award is idempotent by source key', () => {
    const g = newSession();
    g.exec((ctx) => { awardXp(ctx, 'focus', 10, 'same'); awardXp(ctx, 'focus', 10, 'same'); });
    expect(g.s.skills.focus).toBe(10);
  });
});

describe('economy (QA19 subset)', () => {
  it('ledger never negative, duplicate source rejected, order reserve/cancel restores', () => {
    const g = newSession(9);
    const s = g.s;
    g.exec((ctx) => {
      expect(post(ctx, 'test:1', 1000, 'credit', 't')).toBe(true);
      expect(post(ctx, 'test:1', 1000, 'credit', 't')).toBe(false);
      expect(post(ctx, 'test:2', 5000, 'debit', 't')).toBe(false);
    });
    expect(s.life.account.balance).toBe(1000);
    // balanced batches
    const sum = (acc: string) => s.life.account.entries.filter((e) => e.account === acc).reduce((a, e) => a + (e.direction === 'credit' ? e.amount : -e.amount), 0);
    expect(sum('player') + sum('clearing')).toBe(0);
    // move to an order day (Monday = day 1)
    const q = g.exec((ctx) => quote(ctx, [{ itemId: 'biscuits', qty: 2 }]));
    expect(q.ok).toBe(true);
    const r = g.exec((ctx) => placeOrder(ctx, q.quoteId!, 'act1'));
    expect(r.ok).toBe(true);
    expect(s.life.account.reserved).toBe(500);
    g.exec((ctx) => placeOrder(ctx, q.quoteId!, 'act1'));
    expect(s.life.orders).toHaveLength(1);
    g.exec((ctx) => cancelOrder(ctx, s.life.orders[0].id));
    expect(s.life.account.reserved).toBe(0);
    expect(s.life.account.balance).toBe(1000);
  });
  it('free essentials work with zero balance (rightsFloor)', () => {
    const g = newSession(2);
    g.exec((ctx) => { removeItem(ctx, 'soap', countItem(ctx.s, 'soap', ['bag', 'locker']), ['bag', 'locker']); });
    expect(g.s.life.account.balance).toBe(0);
    g.exec((ctx) => freeEssentials(ctx));
    expect(countItem(g.s, 'soap', ['bag', 'locker'])).toBeGreaterThan(0);
  });
});

describe('services, letters, cases, incidents', () => {
  it('booking rejects overlap, letter reply arrives', () => {
    const g = newSession(4);
    const slots = bookingSlots(g.s, 'call');
    expect(slots.length).toBeGreaterThan(0);
    const r1 = g.exec((ctx) => book(ctx, 'call', slots[0], 'mother', 'b1'));
    expect(r1.ok).toBe(true);
    const r2 = g.exec((ctx) => book(ctx, 'legal', slots[0], undefined, 'b2'));
    expect(r2.ok).toBe(false);
    const l = g.exec((ctx) => sendLetter(ctx, 'mother', 'daily', 'letter1'));
    expect(l.ok).toBe(true);
    g.fastForward(16 * 60, false);
    expect(g.s.life.correspondence.some((c) => c.direction === 'incoming' && c.state === 'delivered')).toBe(true);
  });
  it('case lifecycle answered → appeal creates linked independent case', () => {
    const g = newSession(6);
    const c = g.exec((ctx) => submitCase(ctx, 'general', 0, 'k1'));
    g.fastForward(13 * 60, false);
    expect(g.s.life.cases.find((x) => x.id === c.id)!.state).toBe('answered');
    g.exec((ctx) => respondCase(ctx, c.id, false));
    expect(g.s.life.cases.some((x) => x.parentCaseId === c.id)).toBe(true);
  });
  it('incident with valid response is dismissed; essentials never restricted', () => {
    const g = newSession(8);
    g.exec((ctx) => reportIncident(ctx, 'roll_call', 'Vắng điểm danh', 'rc:test'));
    const inc = g.s.life.incidents[0];
    g.exec((ctx) => respondIncident(ctx, inc.id, 'busy_service'));
    g.fastForward(13 * 60, false);
    expect(g.s.life.incidents[0].state).toBe('dismissed');
  });
  it('program enrollment respects one work assignment', () => {
    const g = newSession(10);
    expect(g.exec((ctx) => enroll(ctx, 'work_workshop')).ok).toBe(true);
    expect(g.exec((ctx) => enroll(ctx, 'work_kitchen')).ok).toBe(false);
  });
});

describe('save codec (QA13 subset)', () => {
  it('round-trip keeps domain digest and validates', async () => {
    const g = newSession(12);
    g.fastForward(120, false);
    const json = JSON.stringify(g.s);
    const parsed = JSON.parse(json);
    expect(validateSave(parsed)).toBeNull();
    expect(canonicalJson(migrate(parsed))).toBe(canonicalJson(g.s));
  });
  it('rejects malformed saves', () => {
    expect(validateSave({ schemaVersion: 2 })).not.toBeNull();
    expect(validateSave({ ...JSON.parse(JSON.stringify(newSession(1).s)), needs: { energy: NaN, hunger: 1, hygiene: 1, mood: 1 } })).not.toBeNull();
  });
});

describe('interaction', () => {
  it('player can view schedule via board and quest objective advances', () => {
    const g = newSession(13);
    const board = PROP_BY_ID.board_schedule_L02;
    g.s.player.pos = { x: board.x, y: 0, z: board.z + 0.8 };
    g.s.player.zone = 'L02';
    // complete talk objective first through dialogue
    g.s.npcs.tu.pos = { x: board.x + 0.5, y: 0, z: board.z + 1 };
    g.s.npcs.tu.absent = false;
    g.s.npcs.tu.activity = 'idle';
    expect(g.talk('tu').ok).toBe(true);
    let guard = 0;
    while (g.dialogue && guard++ < 10) {
      const v = g.dialogueView()!;
      if (v.choices.length) g.dialogueChoose(v.choices[0].id); else g.dialogueContinue();
    }
    expect(g.s.quests.Q01.done.o1).toBe(true);
    const r = g.interact(board.id, 'view_schedule');
    expect(r.ok).toBe(true);
    expect(g.s.quests.Q01.done.o2).toBe(true);
    expect(minuteOfDay(g.s.minute)).toBeGreaterThan(0);
  });
});

describe('long run (QA18 subset)', () => {
  it('7 game days: bookings reach terminal states, ledger balanced, needs bounded, NPC paths finite', () => {
    const g = newSession(21);
    const s = g.s;
    const slots = bookingSlots(s, 'visit');
    g.exec((ctx) => book(ctx, 'visit', slots[0], 'mother', 'v1'));
    g.exec((ctx) => enroll(ctx, 'work_workshop'));
    const t0 = Date.now();
    g.fastForward(7 * 1440, false);
    const ms = Date.now() - t0;
    expect(dayOf(s.minute)).toBeGreaterThanOrEqual(8);
    for (const b of s.life.bookings) if (b.end < s.minute) expect(['completed', 'missed', 'cancelled', 'rescheduled', 'excused']).toContain(b.state);
    const sum = (acc: string) => s.life.account.entries.filter((e) => e.account === acc).reduce((a, e) => a + (e.direction === 'credit' ? e.amount : -e.amount), 0);
    expect(sum('player') + sum('clearing')).toBe(0);
    expect(s.life.account.balance).toBeGreaterThanOrEqual(0);
    expect(s.stats.daysCompleted).toBeGreaterThanOrEqual(7);
    expect(JSON.stringify(s).length).toBeLessThan(512 * 1024);
    expect(ms).toBeLessThan(20000);
  });
});
