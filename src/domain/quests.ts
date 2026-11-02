// Quest engine (F07), achievements (F17), predicates. Event reducers idempotent; reward ledger unique per quest.
import type { DomainEvent, GameState, QuestProgress } from './types';
import { type Ctx, addItem, adjustRel, adjustRep, awardXp, changeNeed, countItem, ledgerAdd, notify } from './core';
import { ACHIEVEMENTS, QUESTS, QUEST_BY_ID, type Match, type PredName, type Reward } from '../content/quests';
import { LIBRARY_BOOKS } from '../content/items';
import { dayOf, dayOfWeek, minuteOfDay, hm } from './util';
import { post, releaseEligible } from './life';

export function qp(s: GameState, id: string): QuestProgress {
  return (s.quests[id] ??= { state: 'locked', stage: 0, done: {}, choices: {}, counts: {} });
}

export function evalPred(s: GameState, p: PredName): boolean {
  switch (p) {
    case 'releaseEligible': return releaseEligible(s);
    case 'hasLetterReply': return s.life.correspondence.some((c) => c.direction === 'incoming' && c.channel === 'letter' && c.read);
    case 'enrolledAny': return s.life.programs.some((e) => ['enrolled', 'in_progress', 'completed'].includes(e.state));
    case 'attendedAnySession': return !!s.flags.attended_session;
    case 'sleptWell': return !!s.flags.slept_well;
    case 'wageReceived': return !!s.flags.wage_received;
    case 'planGoals3': return Object.values(s.life.reintegration.goals).filter(Boolean).length >= 3;
    case 'faultReported': return !!s.flags.fault_reported || !!s.flags.fault_resolved;
    case 'faultResolved': return !!s.flags.fault_resolved;
    case 'hasBook': return LIBRARY_BOOKS.some((b) => countItem(s, b, ['bag', 'locker']) > 0);
    case 'admitted': return s.life.episode.state === 'admitted';
    case 'isRaining': return s.world.weather === 'rain';
    case 'notRaining': return s.world.weather !== 'rain';
    case 'hasCertificate': return ['certificate_literacy', 'certificate_carpentry', 'certificate_cooking'].some((c) => countItem(s, c, ['bag', 'locker', 'mailbox']) > 0);
    case 'callDone': return !!s.flags.call_done;
    case 'longResolved': return !!s.flags.long_resolved;
    case 'binhArrived': return dayOf(s.minute) >= 3;
    case 'cultureSessionNow': { const m = minuteOfDay(s.minute); return m >= hm(19) && m < hm(20, 30); }
    case 'readingGroupNow': { const m = minuteOfDay(s.minute); return [1, 3, 5].includes(dayOfWeek(s.minute)) && m >= hm(19) && m < hm(20, 30) && s.player.zone === 'L07'; }
  }
  return false;
}

export function startQuest(ctx: Ctx, id: string): boolean {
  const def = QUEST_BY_ID[id];
  if (!def) return false;
  const p = qp(ctx.s, id);
  if (p.state === 'active' || p.state === 'completed' || p.state === 'ready') return false;
  p.state = 'active';
  p.stage = 0;
  p.acceptedAt = ctx.s.minute;
  if (!ctx.s.trackedQuest || ctx.s.quests[ctx.s.trackedQuest]?.state !== 'active' || def.kind === 'main') ctx.s.trackedQuest = id;
  ctx.emit({ type: 'questUpdated', questId: id, state: 'active' });
  notify(ctx, `Nhiệm vụ mới: ${def.title}`, 'info', 'quest');
  // Objectives already satisfied by state are checked on next pred pass.
  return true;
}

export function currentObjective(s: GameState, id: string) {
  const def = QUEST_BY_ID[id];
  const p = s.quests[id];
  if (!def || !p || p.state !== 'active') return null;
  return def.objectives[p.stage] ?? null;
}

export function completeObjective(ctx: Ctx, id: string, oid: string): boolean {
  const def = QUEST_BY_ID[id];
  const p = ctx.s.quests[id];
  if (!def || !p || p.state !== 'active') return false;
  const cur = def.objectives[p.stage];
  if (!cur || cur.id !== oid) return false; // out-of-order event ignored (stale choice revalidated)
  p.done[oid] = true;
  p.stage++;
  ctx.emit({ type: 'questUpdated', questId: id, state: 'active', objective: oid });
  if (p.stage >= def.objectives.length) {
    p.state = 'ready';
    claimQuest(ctx, id);
  }
  return true;
}

function applyReward(ctx: Ctx, r: Reward, key: string) {
  for (const [sk, n] of r.xp ?? []) awardXp(ctx, sk, n, `${key}:${sk}`, false);
  for (const [it, n] of r.items ?? []) addItem(ctx, it, n, { overflow: 'mailbox', provenance: key });
  for (const [npc, n] of r.trust ?? []) adjustRel(ctx, npc, { trust: n, familiarity: 5 }, 'Hoàn thành nhiệm vụ cùng nhau');
  for (const [g, n] of r.rep ?? []) adjustRep(ctx, g, n, key);
  if (r.mood) changeNeed(ctx, 'mood', r.mood, 'Hoàn thành nhiệm vụ');
  if (r.credits) post(ctx, `reward:${key}`, r.credits, 'credit', 'Ghi nhận hoàn thành kế hoạch');
  if (r.chapter && r.chapter > ctx.s.chapter) ctx.s.chapter = r.chapter; // monotonic
}

/** Atomic claim with ledger key quest:{id}:complete — retry/reload không cấp lại. */
export function claimQuest(ctx: Ctx, id: string) {
  const def = QUEST_BY_ID[id];
  const p = qp(ctx.s, id);
  if (p.state !== 'ready') return;
  const key = `quest:${id}:complete`;
  if (ledgerAdd(ctx.s, key)) {
    applyReward(ctx, def.reward, key);
    if (def.rewardByChoice) {
      const v = p.choices[def.rewardByChoice.key];
      const r = def.rewardByChoice.map[v] ?? Object.values(def.rewardByChoice.map)[0];
      applyReward(ctx, r, `${key}:${v}`);
    }
  }
  p.state = 'completed';
  p.completedAt = ctx.s.minute;
  if (ctx.s.trackedQuest === id) ctx.s.trackedQuest = nextTrackable(ctx.s);
  ctx.emit({ type: 'questUpdated', questId: id, state: 'completed' });
  notify(ctx, `Hoàn thành: ${def.title}. ${def.recap}`, 'success', 'quest');
  autoStartQuests(ctx);
}

function nextTrackable(s: GameState): string | null {
  const active = QUESTS.filter((q) => s.quests[q.id]?.state === 'active');
  return (active.find((q) => q.kind === 'main') ?? active[0])?.id ?? null;
}

export function abandonQuest(ctx: Ctx, id: string) {
  const def = QUEST_BY_ID[id];
  const p = ctx.s.quests[id];
  if (!def || !def.abandonable || !p || p.state !== 'active') return;
  p.state = 'offered';
  p.stage = 0;
  p.done = {};
  p.counts = {};
  if (ctx.s.trackedQuest === id) ctx.s.trackedQuest = nextTrackable(ctx.s);
  ctx.emit({ type: 'questUpdated', questId: id, state: 'offered' });
}

export function autoStartQuests(ctx: Ctx) {
  const s = ctx.s;
  for (const q of QUESTS) {
    const a = q.autoStart;
    if (!a) continue;
    const p = s.quests[q.id];
    if (p && p.state !== 'locked') continue;
    if (a.afterQuest && s.quests[a.afterQuest]?.state !== 'completed') continue;
    if (a.day && dayOf(s.minute) < a.day) continue;
    if (a.flag && !s.flags[a.flag]) continue;
    if (s.life.episode.state === 'released') continue;
    startQuest(ctx, q.id);
  }
}

function matchEvent(s: GameState, m: Match, e: DomainEvent): boolean {
  if ('act' in m && e.type === 'actionCompleted') {
    if (e.verb !== m.act) return false;
    if (m.zone && e.zone !== m.zone) return false;
    if (m.target && e.targetId !== m.target) return false;
    return true;
  }
  if ('zone' in m && e.type === 'enteredZone') return e.zone === m.zone;
  return false;
}

function matchState(s: GameState, m: Match): boolean {
  if ('flag' in m) return !!s.flags[m.flag];
  if ('item' in m) return countItem(s, m.item, ['bag', 'locker']) > 0;
  if ('pred' in m) return evalPred(s, m.pred);
  if ('zone' in m) return s.player.zone === m.zone;
  return false;
}

/** Reducer for domain events → quest progress. */
export function questsOnEvent(ctx: Ctx, e: DomainEvent) {
  const s = ctx.s;
  for (const id of Object.keys(s.quests)) {
    const p = s.quests[id];
    if (p.state !== 'active') continue;
    const o = currentObjective(s, id);
    if (!o) continue;
    if (matchEvent(s, o.match, e)) {
      const need = 'count' in o.match && o.match.count ? o.match.count : 1;
      p.counts[o.id] = (p.counts[o.id] ?? 0) + 1;
      if (p.counts[o.id] >= need) completeObjective(ctx, id, o.id);
      else ctx.emit({ type: 'questUpdated', questId: id, state: 'active' });
    }
  }
}

/** Poll state-based objectives (flag/item/pred) — called on events and once per game minute. */
export function questsCheckState(ctx: Ctx) {
  const s = ctx.s;
  for (let guard = 0; guard < 8; guard++) {
    let progressed = false;
    for (const id of Object.keys(s.quests)) {
      const o = currentObjective(s, id);
      if (!o) continue;
      if (('flag' in o.match || 'item' in o.match || 'pred' in o.match || ('zone' in o.match)) && matchState(s, o.match)) {
        if (completeObjective(ctx, id, o.id)) progressed = true;
      }
    }
    if (!progressed) break;
  }
}

// ---------- Achievements (F17) ----------
export function achievementCounter(s: GameState, counter: string): number {
  switch (counter) {
    case 'daysCompleted': return s.stats.daysCompleted;
    case 'mealsEaten': return s.stats.mealsEaten;
    case 'reads': return (s.flags.reads as number) ?? 0;
    case 'helps': return s.stats.helps;
    case 'exercises': return s.stats.exercises;
    case 'uniqueTalks': return Object.values(s.relationships).filter((r) => r.known).length;
    case 'lettersSent': return s.stats.lettersSent;
    case 'certificates': return s.life.programs.filter((p) => p.certificateMinute !== undefined).length;
    case 'maxTrust': return Math.max(0, ...Object.values(s.relationships).map((r) => r.trust));
    case 'distanceWalked': return Math.floor(s.stats.distanceWalked);
    case 'mainDone': return s.quests.Q06?.state === 'completed' ? 1 : 0;
  }
  return 0;
}
export function checkAchievements(ctx: Ctx) {
  const s = ctx.s;
  for (const a of ACHIEVEMENTS) {
    const st = (s.achievements[a.id] ??= { counter: 0, local: true });
    if (st.unlockedAtMinute !== undefined) continue;
    st.counter = Math.min(a.target, achievementCounter(s, a.id === 'well_fed' ? 'mealsEaten' : a.counter));
    if (st.counter >= a.target && ledgerAdd(s, `ach:${a.id}`)) {
      st.unlockedAtMinute = s.minute;
      ctx.emit({ type: 'achievement', id: a.id });
      notify(ctx, `Thành tựu: ${a.title}`, 'success', 'quest');
    }
  }
}
