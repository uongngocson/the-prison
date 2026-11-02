// Dialogue runtime (F06): entry selection, conditions, atomic once-effects, token text.
import type { GameState } from './types';
import { type Ctx, addItem, adjustRel, adjustRep, awardXp, changeNeed, countItem, ledgerAdd, ledgerHas, notify, relOf, removeItem } from './core';
import { DIALOGUES, POOLS, type Cond, type DChoice, type DNode, type Effect } from '../content/dialogues';
import { NPC_BY_ID } from '../content/npcs';
import { LIBRARY_BOOKS, ITEM_BY_ID } from '../content/items';
import { MEALS } from '../content/schedule';
import { MENU } from '../content/life';
import { completeObjective, currentObjective, evalPred, qp, startQuest } from './quests';
import { freeEssentials, requestRoomMove, submitCase, acknowledgeTopic } from './life';
import { ORIENTATION_TOPICS } from '../content/life';
import { levelOf } from './core';
import { dayOf, hash32, minuteOfDay } from './util';

export interface DialogueSession { npcId: string; graphId: string; nodeId: string; history: { speaker: string; text: string }[]; pendingOpen: string | null; ended: boolean }
export interface NodeView { speaker: string; text: string; choices: { id: string; text: string; index: number }[]; canContinue: boolean }

function graphFor(npcId: string) {
  const def = NPC_BY_ID[npcId];
  return DIALOGUES[def?.dialogue] ?? (def?.role === 'staff' ? DIALOGUES.staff_residential : DIALOGUES.res_generic);
}

export function evalCond(s: GameState, npcId: string, c: Cond): boolean {
  if ('q' in c) { const st = s.quests[c.q]?.state ?? 'locked'; return Array.isArray(c.is) ? c.is.includes(st) : st === c.is; }
  if ('obj' in c) return currentObjective(s, c.obj[0])?.id === c.obj[1];
  if ('flag' in c) return c.eq === undefined ? !!s.flags[c.flag] : s.flags[c.flag] === c.eq;
  if ('noFlag' in c) return !s.flags[c.noFlag];
  if ('trust' in c) return relOf(s, npcId).trust >= c.trust;
  if ('item' in c) return countItem(s, c.item, ['bag', 'locker']) > 0;
  if ('noItem' in c) return countItem(s, c.noItem, ['bag', 'locker']) === 0;
  if ('skill' in c) return levelOf(s.skills[c.skill[0]]) >= c.skill[1];
  if ('at' in c) return Array.isArray(c.at) ? c.at.includes(s.player.zone) : s.player.zone === c.at;
  if ('day' in c) return dayOf(s.minute) >= c.day;
  if ('pred' in c) return evalPred(s, c.pred);
  if ('notPred' in c) return !evalPred(s, c.notPred);
  return false;
}
const all = (s: GameState, npc: string, cs?: Cond[]) => !cs || cs.every((c) => evalCond(s, npc, c));

export function startDialogue(ctx: Ctx, npcId: string): DialogueSession | null {
  const g = graphFor(npcId);
  if (!g) return null;
  const entry = g.entries.find((e) => all(ctx.s, npcId, e.cond));
  if (!entry) return null;
  const session: DialogueSession = { npcId, graphId: g.id, nodeId: entry.node, history: [], pendingOpen: null, ended: false };
  const r = relOf(ctx.s, npcId);
  if (!r.known) adjustRel(ctx, npcId, { familiarity: 5 }, 'Lần đầu trò chuyện');
  adjustRel(ctx, npcId, { familiarity: 2 }, 'Trò chuyện', 'talk');
  ctx.s.stats.talks++;
  ctx.emit({ type: 'talked', npcId });
  enterNode(ctx, session);
  return session;
}

function node(session: DialogueSession): DNode {
  return DIALOGUES[session.graphId].nodes[session.nodeId];
}

function enterNode(ctx: Ctx, session: DialogueSession) {
  const n = node(session);
  if (n.effects) applyEffects(ctx, session, n.effects, `dlgn:${session.npcId}:${session.graphId}:${n.id}`);
  session.history.push({ speaker: speakerName(session, n), text: resolveText(ctx.s, session.npcId, n.text) });
  if (session.history.length > 40) session.history.shift();
}

function speakerName(session: DialogueSession, n: DNode) {
  if (n.speaker === 'player') return 'Bạn';
  if (n.speaker === 'narrator') return '';
  return NPC_BY_ID[session.npcId]?.name ?? '';
}

export function viewNode(s: GameState, session: DialogueSession): NodeView {
  const n = node(session);
  const choices = (n.choices ?? []).map((c, i) => ({ c, i })).filter(({ c }) => all(s, session.npcId, c.cond)).map(({ c, i }) => ({ id: c.id, text: c.text, index: i }));
  return { speaker: speakerName(session, n), text: resolveText(s, session.npcId, n.text), choices, canContinue: !n.choices || n.choices.length === 0 };
}

/** Advance a node without choices. */
export function continueDialogue(ctx: Ctx, session: DialogueSession) {
  const n = node(session);
  if (n.choices && n.choices.length) return;
  if (n.next) { session.nodeId = n.next; enterNode(ctx, session); } else session.ended = true;
}

/** Choose; revalidates conditions (stale choice → rejected without effects). */
export function chooseDialogue(ctx: Ctx, session: DialogueSession, choiceId: string): { ok: boolean; message?: string } {
  const n = node(session);
  const c = (n.choices ?? []).find((x) => x.id === choiceId);
  if (!c) return { ok: false, message: 'Lựa chọn không còn hợp lệ.' };
  if (!all(ctx.s, session.npcId, c.cond)) return { ok: false, message: 'Tình huống đã thay đổi — lựa chọn này không còn khả dụng.' };
  session.history.push({ speaker: 'Bạn', text: c.text });
  ctx.emit({ type: 'dialogueChoice', npcId: session.npcId, nodeId: n.id, choiceId });
  const key = `dlg:${session.npcId}:${session.graphId}:${n.id}:${c.id}${c.once === 'day' ? `:d${dayOf(ctx.s.minute)}` : ''}`;
  applyEffects(ctx, session, c.effects ?? [], key);
  if (c.next) { session.nodeId = c.next; enterNode(ctx, session); } else session.ended = true;
  return { ok: true };
}

const REWARD_EFFECTS = new Set(['give', 'take', 'trust', 'respect', 'rep', 'xp', 'mood']);
function applyEffects(ctx: Ctx, session: DialogueSession, effects: Effect[], onceKey: string) {
  if (!effects.length) return;
  const fresh = !ledgerHas(ctx.s, onceKey);
  if (fresh) ledgerAdd(ctx.s, onceKey);
  const npc = session.npcId;
  for (const e of effects) {
    const k = Object.keys(e)[0];
    if (REWARD_EFFECTS.has(k) && !fresh) continue;
    if ('flag' in e) { ctx.s.flags[e.flag[0]] = e.flag[1]; ctx.emit({ type: 'flag', key: e.flag[0], value: e.flag[1] }); }
    else if ('start' in e) startQuest(ctx, e.start);
    else if ('obj' in e) completeObjective(ctx, e.obj[0], e.obj[1]);
    else if ('choice' in e) qp(ctx.s, e.choice[0]).choices[e.choice[1]] = e.choice[2];
    else if ('give' in e) addItem(ctx, e.give[0], e.give[1], { overflow: 'mailbox', provenance: `dialogue:${npc}` });
    else if ('take' in e) removeItem(ctx, e.take[0], e.take[1], ['bag', 'locker']);
    else if ('trust' in e) adjustRel(ctx, npc, { trust: e.trust, familiarity: 2 }, 'Cuộc trò chuyện');
    else if ('respect' in e) adjustRel(ctx, npc, { respect: e.respect }, 'Cuộc trò chuyện');
    else if ('rep' in e) adjustRep(ctx, e.rep[0], e.rep[1], 'Hội thoại');
    else if ('xp' in e) awardXp(ctx, e.xp[0], e.xp[1], `${onceKey}:xp`);
    else if ('mood' in e) changeNeed(ctx, 'mood', e.mood, 'Cuộc trò chuyện');
    else if ('open' in e) session.pendingOpen = e.open;
    else if ('act' in e) runAct(ctx, session, e.act, e.arg);
  }
}

function runAct(ctx: Ctx, session: DialogueSession, act: string, arg?: string) {
  const s = ctx.s;
  switch (act) {
    case 'borrowBook':
      if (arg && LIBRARY_BOOKS.includes(arg) && countItem(s, arg, ['bag', 'locker']) === 0) {
        const r = addItem(ctx, arg, 1, { overflow: 'fail', provenance: 'library' });
        if (r.ok) { s.flags[`borrowed:${arg}`] = dayOf(s.minute); notify(ctx, `Đã mượn ${ITEM_BY_ID[arg].name}. Hạn trả 7 ngày.`, 'info', 'system'); }
        else notify(ctx, 'Túi đầy, không thể mượn thêm sách.', 'warning', 'system');
      }
      break;
    case 'returnBooks': {
      let n = 0;
      for (const b of LIBRARY_BOOKS) { const c = countItem(s, b, ['bag', 'locker']); if (c) { removeItem(ctx, b, c, ['bag', 'locker']); delete s.flags[`borrowed:${b}`]; n += c; } }
      if (n) notify(ctx, `Đã trả ${n} cuốn sách.`, 'info', 'system');
      break;
    }
    case 'binhFollow': s.flags.binh_following = true; break;
    case 'binhStop': s.flags.binh_following = false; break;
    case 'longDecline':
      adjustRel(ctx, 'long', { trust: -3, respect: 6 }, 'Bạn từ chối dứt khoát');
      adjustRep(ctx, 'community', 2, 'Giữ ranh giới bình tĩnh');
      s.flags.long_resolved = true; s.flags.long_mediation_offered = true;
      break;
    case 'longGive':
      if (removeItem(ctx, 'biscuits', 1, ['bag', 'locker'])) adjustRel(ctx, 'long', { trust: 5 }, 'Bạn chia đồ ăn (tự nguyện)');
      s.flags.long_resolved = true;
      break;
    case 'longLeave': s.flags.long_resolved = true; s.flags.long_mediation_offered = true; break;
    case 'longHelp':
      submitCase(ctx, 'safety', 0, `safety:long:${dayOf(s.minute)}`);
      s.flags.long_help = true;
      break;
    case 'longMediate':
      s.flags.long_mediated = true;
      adjustRel(ctx, 'long', { trust: 15, respect: 5 }, 'Hòa giải');
      break;
    case 'requestRoomMove': requestRoomMove(ctx); break;
    case 'freeEssentials': notify(ctx, freeEssentials(ctx), 'info', 'life'); break;
    case 'supportSession':
      if (ledgerAdd(s, `support:${arg}:${dayOf(s.minute)}`)) {
        changeNeed(ctx, 'mood', 6, 'Được lắng nghe');
        let p = s.life.support.find((x) => x.kind === 'wellbeing');
        if (!p) { p = { kind: 'wellbeing', state: 'active', flags: [] }; s.life.support.push(p); }
        p.state = 'active';
      }
      break;
    case 'ackOrientation': for (const t of ORIENTATION_TOPICS) acknowledgeTopic(ctx, t.id); break;
    case 'issueGloves': addItem(ctx, 'work_gloves', 1, { overflow: 'locker', provenance: 'issue' }); break;
  }
}

function pick(pool: string[], seed: string): string {
  return pool[hash32(seed) % pool.length];
}

export function resolveText(s: GameState, npcId: string, text: string): string {
  const npc = NPC_BY_ID[npcId];
  const day = dayOf(s.minute);
  return text.replace(/\{(\w+)\}/g, (_, k: string) => {
    switch (k) {
      case 'name': return npc?.name ?? '';
      case 'player': return s.character.name;
      case 'weather': return s.world.weather === 'rain' ? 'mưa' : s.world.weather === 'overcast' ? 'âm u' : 'đẹp';
      case 'groupLine': return pick(POOLS[npc?.group ?? 'workshop'] ?? POOLS.workshop, `${npcId}:${day}:g`);
      case 'menu': {
        const m = minuteOfDay(s.minute);
        const meal = MEALS.find((x) => m < x.to) ?? MEALS[0];
        return `${meal.label}: ${MENU[meal.id][s.life.diet]} (theo chế độ ăn bạn đã chọn).`;
      }
      default: {
        const pool = POOLS[k];
        return pool ? resolveText(s, npcId, pick(pool, `${npcId}:${day}:${k}:${s.tick >> 8}`)) : `{${k}}`;
      }
    }
  });
}

export type { DChoice };
