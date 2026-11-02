// F01/F02: character creation + journey initialization in one transaction (một lineage, idempotent theo draft key).
import { CONTENT_VERSION, SCHEMA_VERSION, type Appearance, type GameState, type NpcRuntime } from './types';
import { NPCS } from '../content/npcs';
import { ZONE_BY_ID } from '../content/world';
import { PERSONAL_ITEMS_ON_ARRIVAL } from '../content/items';
import { createLifeState } from './life';
import { absMinuteAt, hash32 } from './util';

export interface CharacterDraft { name: string; appearance: Appearance; familyContext: 'family' | 'estranged' | 'none'; seed?: number }

export function normalizeName(raw: string): string {
  return raw.normalize('NFC').replace(/\s+/g, ' ').trim();
}
export function validateName(raw: string): string | null {
  const n = normalizeName(raw);
  if ([...n].length < 2 || [...n].length > 24) return 'Tên cần từ 2 đến 24 ký tự.';
  if (/[<>{}\\]/.test(n)) return 'Tên chứa ký tự không hợp lệ.';
  return null;
}

export function createNewGame(draft: CharacterDraft, lineageId: string): GameState {
  const seed = draft.seed ?? hash32(lineageId);
  const start = absMinuteAt(1, 900); // Ngày 1, 09:00 — tiếp nhận tại L01
  const npcs: Record<string, NpcRuntime> = {};
  for (const n of NPCS) {
    npcs[n.id] = { id: n.id, pos: { x: 0, y: 0, z: 0 }, yaw: 0, zone: 'L03', path: [], pathZones: [], goalZone: 'L03', goalSlot: null, goalKey: '', activity: 'idle', blockedFor: 0, nextThink: 0, valence: 0.5, arousal: 0.4, memories: [], talkingWithPlayer: false, absent: true };
  }
  const bag: GameState['inventory']['bag'] = new Array(12).fill(null);
  PERSONAL_ITEMS_ON_ARRIVAL.forEach((p, i) => { bag[i] = { uid: `arr_${p.itemId}`, itemId: p.itemId, qty: 1, provenance: 'arrival' }; });
  const intake = ZONE_BY_ID.L01;
  const s: GameState = {
    schemaVersion: SCHEMA_VERSION,
    contentVersion: CONTENT_VERSION,
    lineageId,
    generation: 0,
    trustMode: 'sp_untrusted',
    seed,
    rngState: seed,
    tick: 0,
    minute: start,
    character: { id: `ch_${lineageId}`, name: draft.name, appearance: draft.appearance, createdAtMinute: start },
    needs: { energy: 80, hunger: 70, hygiene: 75, mood: 60 },
    needCauses: { energy: 'Khởi đầu', hunger: 'Khởi đầu', hygiene: 'Khởi đầu', mood: 'Ngày đầu tiên' },
    player: { pos: { x: (intake.x0 + intake.x1) / 2, y: 0, z: intake.z0 + 4.5 }, yaw: 0, zone: 'L01', mode: 'grounded', crouch: false, action: null, seatedAt: null, lastSafe: { x: (intake.x0 + intake.x1) / 2, y: 0, z: intake.z0 + 4.5 } },
    inventory: { bag, locker: new Array(24).fill(null), mailbox: [], stored: [] },
    equipped: { outfit: null, held: null },
    quests: {},
    trackedQuest: null,
    rewardLedger: [],
    processedActions: [],
    skills: { focus: 0, fitness: 0, communication: 0 },
    dailyXp: { day: 1, bySource: {} },
    achievements: {},
    relationships: {},
    reputation: { community: { value: 0, lastCause: '' } },
    npcs,
    flags: {},
    tutorial: { move: 'active', look: 'unseen', interact: 'unseen', schedule: 'unseen', journal: 'unseen', save: 'unseen' },
    discoveredZones: ['L01', 'L03'],
    world: { weather: 'clear', nextWeatherMinute: start + 360, doors: {}, brokenFixtures: {}, activeEvent: null, eventCooldowns: {}, reservations: {}, lastBoundary: start, stock: {}, stockResetWeek: -1 },
    notifications: [],
    mealClaims: {},
    stats: { distanceWalked: 0, mealsEaten: 0, booksSorted: 0, exercises: 0, lettersSent: 0, talks: 0, helps: 0, daysCompleted: 0, sleeps: 0, showers: 0 },
    chapter: 1,
    life: createLifeState(start, draft.familyContext, `ep_${lineageId}`),
    ended: false,
  };
  return s;
}
