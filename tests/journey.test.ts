// End-to-end main journey Q01→Q06 driven through the same session API the UI uses (SC01/SC24 subset).
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../src/domain/newgame';
import { GameSession } from '../src/simulation/session';
import { book, bookingSlots, enroll, readLetter, sendLetter, setPlanGoal, skipAdmission, depart } from '../src/domain/life';
import { PROP_BY_ID, ZONE_BY_ID, zoneAt } from '../src/content/world';
import { absMinuteAt, dayOf, dayOfWeek, minuteOfDay } from '../src/domain/util';
import { countItem, totalItems } from '../src/domain/core';
import type { ZoneId } from '../src/domain/types';

function setup() {
  const s = createNewGame({ name: 'Hành', appearance: { body: 'slim', skin: 0, hair: 2, hairColor: 1, outfit: 2 }, familyContext: 'family', seed: 42 }, 'lin_journey');
  const g = new GameSession(s, { lightNeeds: false, autoComplete: false, dayLengthRealMin: 48 });
  g.exec((ctx) => skipAdmission(ctx, { familyContext: 'family' }));
  return g;
}
function goProp(g: GameSession, id: string) {
  const p = PROP_BY_ID[id];
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
  const off = p.d / 2 + 0.5;
  g.s.player.pos = { x: p.x + fx * off, y: 0, z: p.z + fz * off };
  g.s.player.zone = (zoneAt(g.s.player.pos.x, g.s.player.pos.z) ?? p.zone) as ZoneId;
  g.s.player.mode = 'grounded';
}
function goZone(g: GameSession, z: ZoneId) {
  const zd = ZONE_BY_ID[z];
  g.s.player.pos = { x: (zd.x0 + zd.x1) / 2, y: 0, z: (zd.z0 + zd.z1) / 2 };
  g.s.player.zone = z;
  g.exec(() => undefined);
}
function talkThrough(g: GameSession, npc: string, prefer?: string) {
  const rt = g.s.npcs[npc];
  rt.absent = false; rt.activity = 'idle';
  rt.pos = { x: g.s.player.pos.x + 0.8, y: 0, z: g.s.player.pos.z };
  const r = g.talk(npc);
  expect(r.ok, `talk ${npc}: ${r.message}`).toBe(true);
  let guard = 0;
  while (g.dialogue && guard++ < 12) {
    const v = g.dialogueView()!;
    if (v.choices.length) g.dialogueChoose((v.choices.find((c) => c.id === prefer) ?? v.choices[0]).id);
    else g.dialogueContinue();
  }
  if (g.dialogue) g.endDialogue();
}
function act(g: GameSession, propId: string, verb: string) {
  goProp(g, propId);
  const r = g.interact(propId, verb);
  expect(r.ok, `${verb}@${propId}: ${r.message}`).toBe(true);
  if (g.s.player.action) g.skipAction();
}
function waitUntil(g: GameSession, day: number, hhmm: number) {
  const t = absMinuteAt(day, hhmm);
  if (t > g.s.minute) g.fastForward(t - g.s.minute, false);
}

describe('main journey', () => {
  it('completes Q01→Q06 and reaches a single settled ending', () => {
    const g = setup();
    const s = g.s;
    // Q01
    goProp(g, 'board_schedule_L02');
    talkThrough(g, 'tu', 'thanks');
    expect(countItem(s, 'handbook', ['bag', 'locker'])).toBe(1);
    act(g, 'board_schedule_L02', 'view_schedule');
    goZone(g, 'L05');
    talkThrough(g, 'hoa', 'short');
    expect(s.quests.Q01.state).toBe('completed');
    // Q02 — lunch
    waitUntil(g, 1, 1140);
    act(g, 'meal_counter', 'take_meal');
    const table = Object.values(PROP_BY_ID).find((p) => p.zone === 'L05' && p.kind === 'table')!;
    act(g, table.id, 'eat');
    talkThrough(g, 'hoa', 'yes');
    act(g, 'tray_return', 'return_tray');
    expect(s.quests.Q02.state).toBe('completed');
    // Q03 — yard
    s.world.weather = 'clear';
    waitUntil(g, 1, 1530);
    s.world.weather = 'clear';
    g.refreshDoors(true);
    goZone(g, 'L04');
    talkThrough(g, 'hoa');
    for (const t of ['track_0', 'track_1', 'track_2']) act(g, t, 'touch_track');
    talkThrough(g, 'hoa', 'ex');
    expect(s.quests.Q03.state).toBe('completed');
    expect(s.quests.Q03.choices.ending).toBe('exercise');
    // Q04 — plan: next literacy session (Mon/Wed/Fri 09:00)
    waitUntil(g, 2, 900);
    goProp(g, 'case_desk');
    talkThrough(g, 'thu');
    expect(g.exec((ctx) => enroll(ctx, 'literacy')).ok).toBe(true);
    let d = dayOf(s.minute);
    while (![0, 2, 4].includes(dayOfWeek(absMinuteAt(d, 930)))) d++;
    waitUntil(g, d, 920);
    const desk = Object.values(PROP_BY_ID).find((p) => p.zone === 'L14' && p.kind === 'desk' && p.id !== 'teacher_desk')!;
    act(g, desk.id, 'attend_class');
    expect(s.flags.attended_session).toBe(true);
    goProp(g, 'case_desk');
    talkThrough(g, 'thu');
    expect(s.quests.Q04.state).toBe('completed');
    expect(s.chapter).toBe(2);
    // Q05 — letter + call
    goProp(g, 'mail_desk');
    expect(g.exec((ctx) => sendLetter(ctx, 'mother', 'learning', 'L1')).ok).toBe(true);
    g.fastForward(16 * 60, false);
    const reply = s.life.correspondence.find((c) => c.direction === 'incoming' && c.channel === 'letter' && c.state === 'delivered');
    expect(reply).toBeTruthy();
    g.exec((ctx) => readLetter(ctx, reply!.id));
    let booked = false;
    for (let attempt = 0; attempt < 6 && !s.flags.call_done; attempt++) {
      const slots = bookingSlots(s, 'call');
      const r = g.exec((ctx) => book(ctx, 'call', slots[0], 'mother', `callbk${attempt}`));
      booked = r.ok;
      const b = s.life.bookings.find((x) => x.id === r.bookingId)!;
      g.fastForward(b.start - s.minute + 1, false);
      if (b.state !== 'booked') continue; // contact unavailable → reschedule (no penalty)
      act(g, 'phone_0', 'call');
    }
    expect(booked).toBe(true);
    expect(s.quests.Q05.state).toBe('completed');
    // Q06 — plan + release
    goProp(g, 'reintegration_desk');
    talkThrough(g, 'phong');
    g.exec((ctx) => { setPlanGoal(ctx, 'housing', 'Về ở với gia đình'); setPlanGoal(ctx, 'work', 'Phụ bếp nhà hàng'); setPlanGoal(ctx, 'study', 'Tự học qua thư viện'); });
    waitUntil(g, Math.max(7, dayOf(s.minute) + 1), 1000);
    goProp(g, 'reintegration_desk');
    const before = totalItems(s);
    const r = g.exec((ctx) => depart(ctx));
    expect(r.ok).toBe(true);
    expect(s.quests.Q06.state).toBe('completed');
    expect(s.life.episode.state).toBe('released');
    expect(s.life.account.state).toBe('settled');
    expect(s.inventory.stored).toHaveLength(0);
    // conservation: departure moves stored → bag without minting/losing
    const after = totalItems(s);
    for (const k of Object.keys(before)) expect(after[k]).toBe(before[k]);
    // idempotent: second departure does nothing
    const bal = s.life.account.entries.length;
    g.exec((ctx) => depart(ctx));
    expect(s.life.account.entries.length).toBe(bal);
    expect(s.life.receipts.filter((x) => x.kind === 'return')).toHaveLength(1);
    expect(minuteOfDay(s.minute)).toBeGreaterThanOrEqual(0);
  });
});
