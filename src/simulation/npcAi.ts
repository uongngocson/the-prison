// NPC AI (F26): schedule eligibility → slot choice (reservation) → path → walk → act. Không omniscient.
import type { GameState, NpcActivity, NpcRuntime, Vec3, ZoneId } from '../domain/types';
import { NPCS, NPC_BY_ID, type NpcDef } from '../content/npcs';
import { npcBlockAt, type NpcBlock } from '../content/schedule';
import { SLOTS, SLOT_BY_ID, ZONE_BY_ID, custodyRoomOfBed, doorNodes, zoneAt, zoneCenter, type SlotDef } from '../content/world';
import type { PhysicsPort } from '../physics/physics';
import { pathToPoint, pathToSlot } from './nav';
import { dayOf, hash32, minuteOfDay, pushBounded } from '../domain/util';
import { zoneOpen } from '../domain/actions';
import type { Ctx } from '../domain/core';
import { adjustRel } from '../domain/core';

const POSE_ACTIVITY: Record<string, NpcActivity> = { sit: 'seated', stand: 'idle', lie: 'sleeping', exercise: 'exercising', work: 'working', read: 'reading' };

export class NpcAi {
  constructor(private phys: PhysicsPort) {}

  /** CR-VN-01: khu ở cũ (L02) được ánh xạ sang khu của buồng NPC trong bối cảnh VN. */
  private effectiveBlock(s: GameState, def: NpcDef): NpcBlock {
    const b = this.baseBlock(s, def);
    // CR-LAB-01: một phần tổ xưởng làm vườn/cảnh quan (tổ đội thấy được trong cảnh, công của NPC không ghi cho người chơi)
    if (b.slot === 'work' && b.zone === 'L10' && def.role === 'resident' && s.world.weather !== 'rain') {
      const k = hash32(def.id) % 3;
      if (k > 0) return { ...b, zone: k === 1 ? 'L23' : 'L25' };
    }
    if (!s.custody || b.zone !== 'L02') return b;
    const room = custodyRoomOfBed(s.custody.npcBeds[def.id] ?? null);
    return room ? { ...b, zone: room.zone } : b;
  }

  private baseBlock(s: GameState, def: NpcDef): NpcBlock {
    const m = minuteOfDay(s.minute);
    if (def.id === 'binh' && dayOf(s.minute) < 3) return { from: 0, to: 0, zone: 'L01', slot: 'absent' };
    if (def.id === 'binh' && s.flags.binh_following && s.quests.S06?.state === 'active') return { from: 0, to: 1440, zone: s.player.zone, slot: 'follow' };
    if (def.id === 'long' && s.quests.S08?.state === 'active' && s.quests.S08.stage === 0 && ['L03', 'L04', 'L05', 'L02'].includes(s.player.zone) && m > 8 * 60 && m < 21 * 60)
      return { from: 0, to: 1440, zone: s.player.zone, slot: 'follow' };
    if (s.life.episode.state === 'released') return { from: 0, to: 0, zone: 'L01', slot: 'absent' };
    // Story NPCs wait where the active objective says they are (không bắt người chơi đi tìm khắp nơi).
    const q = (id: string) => s.quests[id];
    const awake = m >= 6 * 60 + 30 && m < 21 * 60 + 30;
    const rain = s.world.weather === 'rain';
    const homeZone: ZoneId = (s.custody && custodyRoomOfBed(s.custody.npcBeds.tu ?? null)?.zone) || 'L02';
    if (awake && def.id === 'tu' && q('Q01')?.state === 'active' && q('Q01').stage === 0) return { from: 0, to: 1440, zone: homeZone, slot: 'sit' };
    if (awake && def.id === 'tu' && q('S03')?.state === 'active' && q('S03').stage === 2) return { from: 1, to: 1440, zone: 'L02', slot: 'sit' };
    if (awake && def.id === 'binh' && q('S06')?.state === 'active' && q('S06').stage === 0) return { from: 0, to: 1440, zone: 'L02', slot: 'sit' };
    if (awake && def.id === 'hoa') {
      if ((q('Q01')?.state === 'active' && q('Q01').stage >= 2) || (q('Q02')?.state === 'active' && q('Q02').stage === 2)) return { from: 0, to: 1440, zone: 'L05', slot: 'eat' };
      if (q('Q03')?.state === 'active' && (q('Q03').stage === 0 || q('Q03').stage === 4) && m < 19 * 60) return { from: 2, to: 1440, zone: rain ? 'L09' : 'L04', slot: 'sit' };
      if (q('S04')?.state === 'active' && q('S04').stage === 2) return { from: 3, to: 1440, zone: 'L07', slot: 'read' };
    }
    let b = npcBlockAt(def, m);
    if (b.slot !== 'absent' && b.slot !== 'post' && b.slot !== 'follow') {
      const blocked = !zoneOpen(s, b.zone) || (b.zone === 'L04' && s.world.weather === 'rain') || (b.zone === 'L13' && b.slot === 'wash' && false);
      if (blocked) b = b.alt ? { ...b, zone: b.alt.zone, slot: b.alt.slot } : { ...b, zone: 'L02', slot: 'sit' };
    }
    return b;
  }

  private pickSlot(s: GameState, rt: NpcRuntime, def: NpcDef, b: NpcBlock): SlotDef | null {
    if (b.slot === 'sleep') { const bed = s.custody?.npcBeds[def.id] ?? def.bed; return bed ? SLOT_BY_ID[bed] ?? null : null; }
    if (b.slot === 'post') {
      const slot = def.post ? SLOT_BY_ID[def.post] : undefined;
      if (slot) return slot;
      return this.pickSlot(s, rt, def, { ...b, zone: (def.post as ZoneId) ?? 'L03', slot: 'stand' });
    }
    if (b.slot === 'absent' || b.slot === 'follow') return null;
    const free = SLOTS.filter((x) => x.zone === b.zone && x.kind === b.slot && (!s.world.reservations[x.id] || s.world.reservations[x.id] === rt.id) && !x.id.includes('_staff_'));
    if (!free.length) {
      const stand = SLOTS.filter((x) => x.zone === b.zone && (x.kind === 'stand' || x.kind === 'sit') && !s.world.reservations[x.id]);
      if (!stand.length) return null;
      return stand[hash32(rt.id + b.from) % stand.length];
    }
    if (b.slot === 'walk') {
      const cur = rt.goalSlot ? free.findIndex((x) => x.id === rt.goalSlot) : -1;
      return free[(cur + 1 + free.length) % free.length];
    }
    return free[hash32(`${rt.id}:${b.from}:${dayOf(s.minute)}`) % free.length];
  }

  private release(s: GameState, rt: NpcRuntime) {
    if (rt.goalSlot && s.world.reservations[rt.goalSlot] === rt.id) delete s.world.reservations[rt.goalSlot];
  }

  private spawnPoint(def: NpcDef): { pos: Vec3; zone: ZoneId } {
    const z: ZoneId = def.role === 'staff' ? 'L01' : 'L02';
    const dn = doorNodes(z)!;
    return { pos: { ...dn.inside }, zone: z };
  }

  think(ctx: Ctx, rt: NpcRuntime, def: NpcDef, snap = false) {
    const s = ctx.s;
    const b = this.effectiveBlock(s, def);
    if (rt.talkingWithPlayer) return;
    if (b.slot === 'absent') {
      if (!rt.absent) { this.release(s, rt); rt.absent = true; rt.path = []; rt.goalKey = 'absent'; rt.goalSlot = null; }
      return;
    }
    if (rt.absent) {
      const sp = this.spawnPoint(def);
      rt.pos = sp.pos; rt.zone = sp.zone; rt.absent = false; rt.goalKey = '';
    }
    if (b.slot === 'follow') {
      this.follow(ctx, rt, def);
      return;
    }
    const key = `${b.zone}:${b.slot}:${b.from}`;
    const arrivedWalk = b.slot === 'walk' && rt.path.length === 0 && rt.goalKey === key && !snap;
    if (rt.goalKey === key && !arrivedWalk && (rt.path.length > 0 || rt.activity !== 'walking')) return;
    const slot = this.pickSlot(s, rt, def, b);
    this.release(s, rt);
    rt.goalKey = key;
    rt.goalZone = b.zone;
    if (!slot) {
      rt.goalSlot = null;
      const c = zoneCenter(b.zone);
      if (snap) { rt.pos = { ...c }; rt.zone = b.zone; rt.path = []; rt.activity = 'idle'; return; }
      const p = pathToPoint(this.phys, rt.pos, rt.zone, b.zone, c);
      rt.path = p.points; rt.pathZones = p.zones; rt.activity = 'walking';
      return;
    }
    s.world.reservations[slot.id] = rt.id;
    rt.goalSlot = slot.id;
    if (snap) {
      rt.pos = { ...slot.pos }; rt.yaw = slot.yaw; rt.zone = slot.zone; rt.path = []; rt.pathZones = [];
      rt.activity = this.activityFor(slot, b);
      return;
    }
    const p = pathToSlot(this.phys, rt.pos, rt.zone, slot);
    rt.path = p.points; rt.pathZones = p.zones; rt.activity = 'walking'; rt.blockedFor = 0;
  }

  private activityFor(slot: SlotDef, b: NpcBlock): NpcActivity {
    if (b.slot === 'eat') return 'eating';
    if (slot.kind === 'queue') return 'queue';
    if (slot.kind === 'walk') return 'idle';
    return POSE_ACTIVITY[slot.pose] ?? 'idle';
  }

  private follow(ctx: Ctx, rt: NpcRuntime, def: NpcDef) {
    const s = ctx.s;
    const p = s.player.pos;
    const d = Math.hypot(p.x - rt.pos.x, p.z - rt.pos.z);
    rt.goalKey = 'follow';
    this.release(s, rt);
    rt.goalSlot = null;
    const keep = def.id === 'long' ? 1.8 : 1.6;
    if (d < keep + 0.3) { rt.path = []; rt.activity = 'idle'; rt.yaw = Math.atan2(p.x - rt.pos.x, p.z - rt.pos.z); return; }
    const t = { x: p.x - ((p.x - rt.pos.x) / d) * keep, y: 0, z: p.z - ((p.z - rt.pos.z) / d) * keep };
    if (rt.zone === s.player.zone) { rt.path = [t]; rt.pathZones = [s.player.zone]; }
    else { const r = pathToPoint(this.phys, rt.pos, rt.zone, s.player.zone, t); rt.path = r.points; rt.pathZones = r.zones; }
    rt.activity = 'walking';
  }

  /** Physical step (30 Hz) + LOD think scheduling. */
  update(ctx: Ctx, dt: number) {
    const s = ctx.s;
    const pp = s.player.pos;
    for (const def of NPCS) {
      const rt = s.npcs[def.id];
      if (!rt) continue;
      const dPlayer = Math.hypot(pp.x - rt.pos.x, pp.z - rt.pos.z);
      if (s.tick >= rt.nextThink) {
        this.think(ctx, rt, def);
        const near = dPlayer < 25;
        const rate = rt.goalKey === 'follow' ? 6 : near ? 6 : dPlayer < 60 ? 20 : 60; // ticks: 5 Hz near, 1.5 Hz mid, 0.5 Hz far
        rt.nextThink = s.tick + rate + (hash32(def.id) % 5);
      }
      if (rt.absent || rt.talkingWithPlayer) {
        if (rt.talkingWithPlayer) rt.yaw = Math.atan2(pp.x - rt.pos.x, pp.z - rt.pos.z);
        continue;
      }
      if (!rt.path.length) continue;
      const target = rt.path[0];
      const dx = target.x - rt.pos.x;
      const dz = target.z - rt.pos.z;
      const dist = Math.hypot(dx, dz);
      const speed = rt.goalKey === 'follow' && dist > 4 ? 2.6 : def.role === 'staff' ? 1.45 : 1.3;
      // player blocking → wait / yield / re-path (không teleport trước mắt)
      const ahead = dPlayer < 0.85 && ((pp.x - rt.pos.x) * dx + (pp.z - rt.pos.z) * dz) > 0;
      if (ahead && rt.goalKey !== 'follow') {
        rt.blockedFor += dt;
        if (rt.blockedFor > 2) {
          const side = { x: -dz / (dist || 1), z: dx / (dist || 1) };
          rt.pos.x += side.x * 0.6 * dt; rt.pos.z += side.z * 0.6 * dt;
        }
        if (rt.blockedFor > 10) { rt.goalKey = ''; rt.blockedFor = 0; rt.nextThink = s.tick; }
        continue;
      }
      rt.blockedFor = 0;
      const step = speed * dt;
      if (dist <= step) {
        rt.pos.x = target.x; rt.pos.z = target.z;
        rt.path.shift();
        const z = rt.pathZones.shift();
        if (z) rt.zone = z;
        if (!rt.path.length) this.arrive(s, rt);
      } else {
        rt.pos.x += (dx / dist) * step;
        rt.pos.z += (dz / dist) * step;
        const ty = Math.atan2(dx, dz);
        let dy = ty - rt.yaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        rt.yaw += dy * Math.min(1, dt * 10);
        const zz = zoneAt(rt.pos.x, rt.pos.z);
        if (zz) rt.zone = zz;
      }
    }
    // gentle separation between nearby idle/walking NPCs and player
    const list = Object.values(s.npcs).filter((n) => !n.absent);
    for (const n of list) {
      if (n.activity !== 'walking') continue;
      const d = Math.hypot(pp.x - n.pos.x, pp.z - n.pos.z);
      if (d < 0.55 && d > 0.001) { n.pos.x -= ((pp.x - n.pos.x) / d) * (0.55 - d); n.pos.z -= ((pp.z - n.pos.z) / d) * (0.55 - d); }
    }
  }

  private arrive(s: GameState, rt: NpcRuntime) {
    const slot = rt.goalSlot ? SLOT_BY_ID[rt.goalSlot] : null;
    if (!slot) { rt.activity = 'idle'; return; }
    rt.pos = { ...slot.pos };
    rt.yaw = slot.yaw;
    rt.zone = slot.zone;
    const def = NPC_BY_ID[rt.id];
    const b = this.effectiveBlock(s, def);
    rt.activity = this.activityFor(slot, b);
    if (slot.kind === 'walk') rt.nextThink = s.tick + 30 + (hash32(rt.id) % 30);
  }

  /** Fast-forward/load: place every NPC at its scheduled slot (zone-level simulation). */
  snapAll(ctx: Ctx) {
    for (const def of NPCS) {
      const rt = ctx.s.npcs[def.id];
      rt.talkingWithPlayer = false;
      rt.goalKey = '';
      this.release(ctx.s, rt);
      rt.goalSlot = null;
      this.think(ctx, rt, def, true);
      rt.nextThink = ctx.s.tick + (hash32(def.id) % 20);
    }
  }
}

/** F26/F08 witness: chỉ NPC cùng khu, gần, có mặt mới ghi nhớ — không omniscient. */
export function witness(ctx: Ctx, verb: string, label: string) {
  const s = ctx.s;
  const p = s.player.pos;
  for (const rt of Object.values(s.npcs)) {
    if (rt.absent || rt.zone !== s.player.zone) continue;
    if (Math.hypot(rt.pos.x - p.x, rt.pos.z - p.z) > 12) continue;
    if (s.player.zone !== zoneAt(rt.pos.x, rt.pos.z)) continue;
    const mem = { eventId: `${verb}:${s.tick}`, type: verb, subject: 'player', minute: s.minute, zone: s.player.zone, salience: 0.5, expires: s.minute + 3 * 1440 };
    pushBounded(rt.memories, mem, 32);
    adjustRel(ctx, rt.id, { trust: 1, familiarity: 1 }, `Thấy bạn ${label}`, `witness:${verb}`);
    rt.valence = Math.min(1, rt.valence + 0.05);
  }
}

export function decayMemories(s: GameState) {
  for (const rt of Object.values(s.npcs)) {
    rt.memories = rt.memories.filter((m) => m.expires > s.minute);
    rt.valence += (0.5 - rt.valence) * 0.2;
  }
}

export function zoneDoorCenter(zone: ZoneId) { return ZONE_BY_ID[zone].door; }
