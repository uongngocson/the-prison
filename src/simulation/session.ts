// LocalSession (ADR05): single-player authority. Fixed step 30 Hz, command boundary, typed events, HUD projection.
import type { DomainEvent, EmittedEvent, GameState, NpcRuntime, Vec3, ZoneId } from '../domain/types';
import { type Ctx, type SimSettings, actionSeen, adjustRel, changeNeed, decayNeeds, notify } from '../domain/core';
import { commitAction, needHint, verbsFor, zoneOpen, type VerbOption } from '../domain/actions';
import { autoStartQuests, checkAchievements, questsCheckState, questsOnEvent } from '../domain/quests';
import { chooseDialogue, continueDialogue, startDialogue, viewNode, type DialogueSession } from '../domain/dialogue';
import { BOOKING_VERBS, activeBookingAt, careRestActive, currentBed, hasNeed, lifeTick, refreshStaff, resetWeeklyStock, rollCallResolve } from '../domain/life';
import { AabbPhysics, type PhysicsPort } from '../physics/physics';
import { NpcAi, decayMemories, witness } from './npcAi';
import { CELL_ROOMS, PROPS, PROP_BY_ID, SLOTS, ZONES, ZONE_BY_ID, zoneAt, zoneCenter, type PropDef } from '../content/world';
import { NPCS, NPC_BY_ID } from '../content/npcs';
import { DAILY, ROLL_CALLS, npcBlockAt } from '../content/schedule';
import { Rng, dayOf, dist2, fmtClock, hm, minuteOfDay } from '../domain/util';
import { cellOf } from './nav';
import { ensureLabour, labourPanelVerbs, labourTick } from '../domain/labour';
import { constrainMove, custodyTick, homeBed, homeRoom, isVN, positionAllowed, propAllowed, reasonText, resolveOnLoad } from '../domain/custody';
import { CUSTODY_ROOM_BY_ID, custodyRoomAt, custodyRoomOfBed } from '../content/world';

export const TICK_HZ = 30;
const DT = 1 / TICK_HZ;
const ACTION_ACCEL = 14; // tua nhanh thời gian game khi đang thực hiện hành động (không bắt nhìn chờ)

export interface InputState { moveX: number; moveZ: number; run: boolean; crouch: boolean; camYaw: number }
export interface FocusTarget { kind: 'prop' | 'npc'; id: string; label: string; verbs: VerbOption[]; busy?: string }
type Listener = (e: EmittedEvent) => void;

const HELPFUL: Record<string, string> = { sort_books: 'sắp sách', help: 'giúp việc chung', return_tray: 'trả khay', arrange: 'chuẩn bị phòng', laundry_exchange: 'giữ đồ sạch sẽ' };

export class GameSession {
  readonly phys: PhysicsPort;
  readonly ai: NpcAi;
  rng: Rng;
  ctx: Ctx;
  paused = false;
  accumulator = 0;
  input: InputState = { moveX: 0, moveZ: 0, run: false, crouch: false, camYaw: 0 };
  prevPlayer: Vec3;
  prevNpc = new Map<string, Vec3>();
  dialogue: DialogueSession | null = null;
  focus: FocusTarget | null = null;
  private focusHold = 0;
  private listeners = new Set<Listener>();
  private queue: DomainEvent[] = [];
  private evSeq = 0;
  private vel = { x: 0, z: 0 };
  private safeTimer = 0;
  private hintCooldown = 0;
  dirty = true; // autosave eligibility
  changeVersion = 0; // runtime revision; detects edits made while a save awaits IDB
  catchUpDebt = 0;

  constructor(public s: GameState, public settings: SimSettings, options: { resume?: boolean } = {}) {
    this.phys = new AabbPhysics();
    this.ai = new NpcAi(this.phys);
    this.rng = new Rng(s.rngState);
    this.ctx = { s, rng: this.rng, settings, emit: (e) => this.queue.push(e) };
    this.prevPlayer = { ...s.player.pos };
    // Restore: rebuild transient state before emitting (không phát reward lặp)
    for (const [id, d] of Object.entries(s.world.doors)) this.phys.setDoor(id, d.state === 'closed');
    this.refreshDoors(true);
    this.refreshStaffDuty();
    resetWeeklyStock(this.ctx);
    // CR-VN-01: xử lý mốc đến hạn + vị trí hợp lệ TRƯỚC khi cho input (không có frame tự do khi khôi phục).
    ensureLabour(this.s); // CR-LAB-01: save cũ thiếu module → sổ đầu kỳ, không gán ca
    resolveOnLoad(this.ctx);
    if (!options.resume) {
      this.ai.snapAll(this.ctx);
      if (s.player.mode === 'acting' || s.player.mode === 'talking' || s.player.mode === 'sleeping') { s.player.mode = 'grounded'; s.player.action = null; }
    }
    for (const n of Object.values(s.npcs)) this.prevNpc.set(n.id, { ...n.pos });
    autoStartQuests(this.ctx);
    this.flush();
  }

  on(l: Listener) { this.listeners.add(l); return () => this.listeners.delete(l); }

  private flush() {
    let guard = 0;
    let any = false;
    while (this.queue.length && guard++ < 500) {
      const e = this.queue.shift()!;
      any = true;
      questsOnEvent(this.ctx, e);
      const em: EmittedEvent = { id: `e${this.s.tick}_${this.evSeq++}`, tick: this.s.tick, minute: this.s.minute, event: e };
      for (const l of this.listeners) l(em);
      if (e.type === 'questUpdated' && e.state === 'completed') this.dirty = true;
    }
    if (any) {
      this.changeVersion++;
      autoStartQuests(this.ctx);
      questsCheckState(this.ctx);
      checkAchievements(this.ctx);
      if (this.queue.length && guard < 500) this.flush();
    }
    this.s.rngState = this.rng.state;
  }

  /** Run a domain command atomically with event flush (C0 boundary). */
  exec<T>(fn: (ctx: Ctx) => T): T {
    this.changeVersion++;
    const r = fn(this.ctx);
    autoStartQuests(this.ctx);
    questsCheckState(this.ctx);
    this.flush();
    this.dirty = true;
    return r;
  }

  // ======================= Frame update =======================
  update(realDt: number) {
    if (this.paused) return;
    const clamped = Math.min(realDt, 0.25);
    this.accumulator += clamped;
    let steps = 0;
    while (this.accumulator >= DT && steps < 4) {
      this.snapshotPrev();
      this.step();
      this.accumulator -= DT;
      steps++;
    }
    if (this.accumulator >= DT) { this.catchUpDebt += this.accumulator; this.accumulator = 0; } // slow sim rather than skip needs/events
  }
  get alpha() { return this.accumulator / DT; }

  private snapshotPrev() {
    this.prevPlayer = { ...this.s.player.pos };
    for (const n of Object.values(this.s.npcs)) {
      const p = this.prevNpc.get(n.id);
      if (p) { p.x = n.pos.x; p.y = n.pos.y; p.z = n.pos.z; } else this.prevNpc.set(n.id, { ...n.pos });
    }
  }

  private step() {
    this.changeVersion++;
    const s = this.s;
    s.tick++;
    const rate = 1440 / (this.settings.dayLengthRealMin * 60);
    // Đi vệ sinh tua chậm hơn (~5 giây thực) để thấy nhân vật ngồi trên bồn; vẫn bỏ qua được bằng phím tua.
    const accel = s.player.action && !s.player.action.committed ? (s.player.action.verb === 'use_toilet' ? 2 : ACTION_ACCEL) : 1;
    const dm = rate * DT * accel;
    this.movePlayer(DT);
    this.advanceMinutes(dm, false);
    const a = s.player.action;
    if (a && !a.committed) {
      a.elapsedMin += dm;
      if (a.elapsedMin >= a.durationMin) this.finishAction();
    }
    this.ai.update(this.ctx, DT);
    this.questNpcTriggers();
    if (s.tick % 3 === 0) this.updateFocus(DT * 3);
    this.flush();
  }

  // ======================= Clock & boundaries =======================
  private advanceMinutes(dm: number, sleeping: boolean) {
    const s = this.s;
    const before = s.minute;
    s.minute += dm;
    for (let m = Math.floor(before) + 1; m <= Math.floor(s.minute); m++) this.minuteTick(m, sleeping);
  }

  private minuteTick(absMin: number, sleeping: boolean) {
    const s = this.s;
    const ctx = this.ctx;
    const m = minuteOfDay(absMin);
    decayNeeds(ctx, 1, sleeping, hasNeed(s, 'rest') || careRestActive(s));
    if (sleeping) changeNeed(ctx, 'energy', 8 / 60);
    if (m === 0) {
      s.stats.daysCompleted++;
      this.emit({ type: 'dayStarted', day: dayOf(absMin) });
      notify(ctx, `Ngày ${dayOf(absMin)} bắt đầu.`, 'info', 'system');
      decayMemories(s);
      this.dirty = true;
    }
    for (const row of isVN(s) ? [] : DAILY) if (row.from === m) {
      this.emit({ type: 'boundary', minute: absMin, label: row.label });
      if (!sleeping && (row.kind === 'meal' || row.kind === 'rollcall' || row.id === 'yard' || row.id === 'night')) {
        this.emit({ type: 'subtitle', speaker: 'Loa thông báo', text: `${row.label} (${fmtClock(row.from)}–${fmtClock(row.to)}). ${row.hint}`, durationMs: 6000 });
        this.emit({ type: 'sound', cue: 'chime', caption: '[Chuông thông báo]' });
      }
    }
    for (const rc of ROLL_CALLS) {
      if (m === rc.at - 10 && !sleeping) notify(ctx, `${rc.label} lúc ${fmtClock(rc.at)} ${isVN(s) ? 'tại buồng' : 'tại Khu phòng ở'}.`, 'info', 'life');
      if (m === rc.end) {
        const vnHome = isVN(s) ? homeRoom(s) : null;
        const inL02 = isVN(s) ? !!vnHome && custodyRoomAt(s.player.pos.x, s.player.pos.z)?.id === vnHome.id : s.player.zone === 'L02' || !!s.flags[`muster:${rc.id}:${dayOf(absMin)}`];
        rollCallResolve(ctx, rc.id, inL02 || (sleeping && s.player.zone === 'L02'), !!s.player.action || !!this.dialogue);
      }
    }
    if (m % 5 === 0 || sleeping === false) this.refreshDoors(false);
    if (m % 30 === 0) this.refreshStaffDuty();
    if (s.minute >= s.world.nextWeatherMinute) this.rollWeather();
    if (m % 60 === 0) this.director();
    lifeTick(ctx);
    custodyTick(ctx);
    labourTick(ctx);
    autoStartQuests(ctx);
    questsCheckState(ctx);
    if (m % 10 === 0) checkAchievements(ctx);
    if (!sleeping && --this.hintCooldown <= 0) {
      const h = needHint(s);
      if (h) { notify(ctx, h, 'warning', 'system'); this.hintCooldown = 120; }
    }
  }

  private emit(e: DomainEvent) { this.queue.push(e); }

  private refreshStaffDuty() {
    const roles: Record<string, string | null> = {};
    const m = minuteOfDay(this.s.minute);
    for (const n of NPCS) if (n.staffRole) {
      const on = npcBlockAt(n, m).slot !== 'absent';
      if (on && !roles[n.staffRole]) roles[n.staffRole] = n.id;
      else if (!(n.staffRole in roles)) roles[n.staffRole] = null;
    }
    refreshStaff(this.ctx, roles);
  }

  /** F28: door state per hours/weather/events; never trap the player (closing while occupied). */
  refreshDoors(initial: boolean) {
    const s = this.s;
    const m = minuteOfDay(s.minute);
    for (const z of ZONES) {
      if (!z.door || z.side === 'corridor') continue;
      const id = `door_${z.id}`;
      let open = true;
      let reason = '';
      if (z.hours) {
        const [a, b] = z.hours;
        open = m >= a && m < b;
        if (!open) reason = `Mở cửa ${fmtClock(a)}–${fmtClock(b)}`;
      }
      if (z.id === 'L04' && s.world.weather === 'rain' && open) { open = false; reason = 'Trời mưa — sân tạm đóng, dùng Phòng tập'; }
      const ev = s.world.activeEvent;
      if (ev && ev.id.startsWith('closure') && ev.zone === z.id && ev.state === 'running') { open = false; reason = 'Tạm đóng để bảo trì (hư cấu)'; }
      const cur = s.world.doors[id]?.state ?? 'open';
      let next: 'open' | 'closing' | 'closed' = open ? 'open' : s.player.zone === z.id ? 'closing' : 'closed';
      if (next === cur && s.world.doors[id]?.reason === reason) continue;
      if (next === 'closed' && this.npcInDoorway(z.id)) next = 'closing';
      s.world.doors[id] = { state: next, reason };
      this.phys.setDoor(id, next === 'closed');
      if (!initial) {
        this.emit({ type: 'doorChanged', doorId: id, state: next, reason });
        // Chỉ báo cho người đang ở trong khu (trước đây NPC đứng ở cửa cũng làm phát thông báo).
        if (next === 'closing' && s.player.zone === z.id) notify(this.ctx, `${z.name} sắp đóng (${reason}). Bạn có thể ra bất cứ lúc nào.`, 'info', 'system');
      }
    }
  }
  private npcInDoorway(zone: ZoneId) {
    const d = ZONE_BY_ID[zone].door!;
    return Object.values(this.s.npcs).some((n) => !n.absent && Math.abs(n.pos.x - d.x) < 1.2 && Math.abs(n.pos.z - d.z) < 1.2);
  }

  private rollWeather() {
    const s = this.s;
    const r = this.rng.next();
    const prev = s.world.weather;
    s.world.weather = r < 0.6 ? 'clear' : r < 0.85 ? 'overcast' : 'rain';
    s.world.nextWeatherMinute = s.minute + 240 + Math.floor(this.rng.next() * 240);
    if (prev !== s.world.weather) {
      this.emit({ type: 'weather', weather: s.world.weather });
      if (s.world.weather === 'rain') notify(this.ctx, 'Trời mưa nhẹ. Hoạt động ngoài sân chuyển vào Phòng tập.', 'info', 'system');
    }
    this.refreshDoors(false);
  }

  /** F10: finite catalog director, max 1 foreground event, seeded, cooldowns. */
  private director() {
    const s = this.s;
    const m = minuteOfDay(s.minute);
    const ev = s.world.activeEvent;
    if (ev && s.minute >= ev.endMinute) {
      ev.state = 'resolved';
      s.world.activeEvent = null;
      this.refreshDoors(false);
    }
    if (s.world.activeEvent) return;
    const day = dayOf(s.minute);
    const dow = (day - 1) % 7;
    if ([1, 3, 5].includes(dow) && m === hm(19)) {
      s.world.activeEvent = { id: `reading_group_${day}`, state: 'running', startMinute: s.minute, endMinute: s.minute + 90, actors: ['mai', 'hoa'], zone: 'L07' };
      this.emit({ type: 'subtitle', speaker: 'Loa thông báo', text: 'Nhóm đọc sách bắt đầu tại Thư viện. Ai muốn tham gia cứ đến.', durationMs: 6000 });
      return;
    }
    if (m === hm(16) && s.world.weather !== 'rain') {
      s.world.activeEvent = { id: `group_ex_${day}`, state: 'running', startMinute: s.minute, endMinute: s.minute + 60, actors: ['duy'], zone: 'L04' };
      this.emit({ type: 'subtitle', speaker: 'Anh Duy', text: 'Buổi tập nhóm ngoài sân bắt đầu! Ai mệt cứ ngồi nghỉ.', durationMs: 5000 });
      return;
    }
    const cd = s.world.eventCooldowns.closure ?? 0;
    if (day >= 3 && s.minute >= cd && m >= hm(9) && m <= hm(15) && this.rng.next() < 0.12) {
      const zone: ZoneId = this.rng.next() < 0.5 ? 'L09' : 'L07';
      s.world.activeEvent = { id: `closure_${zone}_${day}`, state: 'running', startMinute: s.minute, endMinute: s.minute + 90, actors: ['nam'], zone };
      s.world.eventCooldowns.closure = s.minute + 2 * 1440;
      notify(this.ctx, `${ZONE_BY_ID[zone].name} tạm đóng 90 phút để bảo trì. Lựa chọn thay thế: ${zone === 'L09' ? 'Sân sinh hoạt' : 'Phòng yên tĩnh'}.`, 'info', 'system');
      this.refreshDoors(false);
    }
  }

  // ======================= Player movement (F04) =======================
  private movePlayer(dt: number) {
    const s = this.s;
    const p = s.player;
    const blocked = p.mode === 'acting' || p.mode === 'sleeping' || p.mode === 'talking' || this.dialogue;
    let ix = blocked ? 0 : this.input.moveX;
    let iz = blocked ? 0 : this.input.moveZ;
    const len = Math.hypot(ix, iz);
    if (len > 1) { ix /= len; iz /= len; }
    if (p.mode === 'seated' && len > 0.1) this.standUp();
    if (p.mode === 'seated') return;
    if (!blocked) {
      if (this.input.crouch !== p.crouch) {
        if (this.input.crouch) p.crouch = true;
        else p.crouch = false; // trần thấp không tồn tại trong blockout — shape cast luôn pass
      }
    }
    const speed = p.crouch ? 0.9 : this.input.run ? 3.4 : 1.6;
    const tx = ix * speed;
    const tz = iz * speed;
    const acc = 10 * dt;
    this.vel.x += Math.max(-acc, Math.min(acc, tx - this.vel.x));
    this.vel.z += Math.max(-acc, Math.min(acc, tz - this.vel.z));
    if (Math.hypot(this.vel.x, this.vel.z) < 0.01) { this.vel.x = this.vel.z = 0; if (p.mode === 'moving') p.mode = p.crouch ? 'crouched' : 'grounded'; return; }
    let np = this.phys.moveCharacter(p.pos, this.vel.x * dt, this.vel.z * dt, 0.3);
    if (isVN(s)) {
      // F64: cùng một evaluator cho bàn phím/cảm ứng/tay cầm — kiểm tại bước băng qua ranh giới.
      const c = constrainMove(s, p.pos, np);
      if (c.denied) {
        this.denyMovement(c.denied);
        if (c.x === p.pos.x && c.z === p.pos.z) { this.vel.x = this.vel.z = 0; return; }
      }
      np = { x: c.x, y: np.y, z: c.z };
    }
    const moved = Math.hypot(np.x - p.pos.x, np.z - p.pos.z);
    if (!Number.isFinite(np.x) || np.x < -107 || np.x > 115 || np.z < -40 || np.z > 40) {
      p.pos = { ...p.lastSafe };
      p.mode = 'recovering';
      notify(this.ctx, 'Đã đưa bạn về vị trí an toàn gần nhất.', 'info', 'system');
      return;
    }
    p.pos = np;
    p.mode = p.crouch ? 'crouched' : 'moving';
    if (moved > 0.0005) p.yaw = Math.atan2(this.vel.x, this.vel.z);
    s.stats.distanceWalked += moved;
    if (this.s.tutorial.move === 'active' && s.stats.distanceWalked > 4) this.tutorialDone('move', 'look');
    const z = zoneAt(p.pos.x, p.pos.z);
    if (z && z !== p.zone) {
      p.zone = z;
      if (!s.discoveredZones.includes(z)) { s.discoveredZones.push(z); notify(this.ctx, `Khám phá: ${ZONE_BY_ID[z].name}`, 'info', 'system'); }
      this.emit({ type: 'enteredZone', zone: z });
    }
    this.safeTimer += dt;
    if (this.safeTimer > 1 && !this.phys.overlaps(p.pos.x, p.pos.z, 0.32) && positionAllowed(s, p.pos.x, p.pos.z).ok) { p.lastSafe = { ...p.pos }; this.safeTimer = 0; }
  }

  private lastDenial = { code: '', at: -1e9 };
  /** Thông báo bị chặn có lý do — dedup để không spam mỗi frame. */
  private denyMovement(code: string) {
    const now = this.s.tick;
    if (code === this.lastDenial.code && now - this.lastDenial.at < 30 * 6) return;
    this.lastDenial = { code, at: now };
    notify(this.ctx, reasonText(code), 'warning', 'life');
  }

  tutorialDone(step: string, next?: string) {
    if (this.s.tutorial[step] === 'done' || this.s.tutorial[step] === 'skipped') return;
    this.s.tutorial[step] = 'done';
    if (next && this.s.tutorial[next] === 'unseen') this.s.tutorial[next] = 'active';
    this.emit({ type: 'flag', key: `tutorial_${step}`, value: true });
  }
  skipTutorial() { for (const k of Object.keys(this.s.tutorial)) if (this.s.tutorial[k] !== 'done') this.s.tutorial[k] = 'skipped'; this.flush(); }
  replayTutorial() { const keys = Object.keys(this.s.tutorial); keys.forEach((k, i) => (this.s.tutorial[k] = i === 0 ? 'active' : 'unseen')); this.flush(); }

  // ======================= Focus / interaction (F05) =======================
  private updateFocus(dt: number) {
    const s = this.s;
    const p = s.player;
    if (p.mode === 'sleeping' || this.dialogue) { this.focus = null; return; }
    const fx = Math.sin(this.input.camYaw);
    const fz = Math.cos(this.input.camYaw);
    let best: { score: number; t: FocusTarget } | null = null;
    const consider = (id: string, kind: 'prop' | 'npc', x: number, z: number, edgeDist: number, label: string, ignoreId?: string) => {
      if (edgeDist > (kind === 'npc' ? 1.8 : 1.35)) return;
      const dx = x - p.pos.x;
      const dz = z - p.pos.z;
      const d = Math.hypot(dx, dz) || 0.001;
      const dot = (dx * fx + dz * fz) / d;
      if (dot < -0.1 && edgeDist > 0.6) return;
      if (this.phys.raycast(p.pos.x, p.pos.z, x, z, ['wall', 'door'], ignoreId) < 0.98 && edgeDist > 0.4) return;
      const score = dot * 1.5 - edgeDist + (this.focus?.id === id ? 0.35 : 0) + (kind === 'npc' ? 0.8 : 0) - (s.player.mode === 'seated' && kind === 'prop' ? 0.5 : 0);
      if (!best || score > best.score) best = { score, t: { kind, id, label, verbs: [] } };
    };
    for (const pr of PROPS) {
      if (pr.zone !== p.zone && pr.zone !== 'L03' && p.zone !== 'L03') continue;
      if (Math.abs(pr.x - p.pos.x) > 4 || Math.abs(pr.z - p.pos.z) > 4) continue;
      const c = Math.abs(Math.cos(pr.yaw)), sn = Math.abs(Math.sin(pr.yaw));
      const hx = (pr.w * c + pr.d * sn) / 2, hz = (pr.w * sn + pr.d * c) / 2;
      const ex = Math.max(0, Math.abs(p.pos.x - pr.x) - hx);
      const ez = Math.max(0, Math.abs(p.pos.z - pr.z) - hz);
      const verbs = this.gatedVerbs(pr);
      if (!verbs.length) continue;
      consider(pr.id, 'prop', pr.x, pr.z, Math.hypot(ex, ez), pr.label);
    }
    for (const n of Object.values(s.npcs)) {
      if (n.absent) continue;
      if (Math.abs(n.pos.x - p.pos.x) > 3 || Math.abs(n.pos.z - p.pos.z) > 3) continue;
      consider(n.id, 'npc', n.pos.x, n.pos.z, Math.max(0, Math.hypot(n.pos.x - p.pos.x, n.pos.z - p.pos.z) - 0.3), NPC_BY_ID[n.id].name);
    }
    const found = best as { score: number; t: FocusTarget } | null;
    if (!found) {
      this.focusHold += dt;
      if (this.focusHold > 0.15) this.focus = null; // hysteresis 150 ms
      return;
    }
    this.focusHold = 0;
    const t = found.t;
    if (t.kind === 'prop') t.verbs = this.gatedVerbs(PROP_BY_ID[t.id]);
    else {
      const rt = s.npcs[t.id];
      const def = NPC_BY_ID[t.id];
      const busy = rt.activity === 'sleeping' ? 'Đang ngủ' : undefined;
      const known = s.relationships[t.id]?.known;
      t.label = known ? `${def.name} · ${def.title}` : def.role === 'staff' ? def.title : 'Người lạ';
      t.verbs = [{ verb: 'talk', label: 'Nói chuyện', duration: 0, enabled: !busy, reason: busy, instant: true }];
      t.busy = busy;
    }
    this.focus = t;
  }

  /** Thao tác trong panel station (U42) — cùng gate custody như prompt. */
  gatedPanelVerbs(prop: PropDef): VerbOption[] {
    const verbs = labourPanelVerbs(this.s, prop);
    if (!isVN(this.s)) return verbs;
    const e = propAllowed(this.s, prop);
    return e.ok ? verbs : verbs.map((v) => ({ ...v, enabled: false, reason: reasonText(e.reasonCode) }));
  }

  /** Verbs filtered by custody evaluator (cùng luật với commit). */
  gatedVerbs(prop: PropDef): VerbOption[] {
    const verbs = verbsFor(this.s, prop, this.settings.autoComplete);
    if (!isVN(this.s)) return verbs;
    const e = propAllowed(this.s, prop);
    if (e.ok) return verbs;
    return verbs.map((v) => ({ ...v, enabled: false, reason: reasonText(e.reasonCode) }));
  }

  /** Validate range+LOS again at commit (authority không tin client focus). */
  private inRange(prop: PropDef): boolean {
    const p = this.s.player.pos;
    const c = Math.abs(Math.cos(prop.yaw)), sn = Math.abs(Math.sin(prop.yaw));
    const hx = (prop.w * c + prop.d * sn) / 2, hz = (prop.w * sn + prop.d * c) / 2;
    const ex = Math.max(0, Math.abs(p.x - prop.x) - hx);
    const ez = Math.max(0, Math.abs(p.z - prop.z) - hz);
    return Math.hypot(ex, ez) <= 1.5;
  }

  interact(targetId: string, verb: string, params: Record<string, string | number | boolean> = {}): { ok: boolean; message?: string; screen?: string } {
    const s = this.s;
    if (this.paused || this.dialogue) return { ok: false, message: 'Không thể thao tác lúc này.' };
    if (s.player.action && !s.player.action.committed) return { ok: false, message: 'Đang thực hiện hành động khác.' };
    if (verb === 'talk') return this.talk(targetId);
    const prop = PROP_BY_ID[targetId];
    if (!prop || !this.inRange(prop)) return { ok: false, message: 'Quá xa hoặc bị che khuất.' };
    const opt = this.gatedVerbs(prop).find((v) => v.verb === verb) ?? this.gatedPanelVerbs(prop).find((v) => v.verb === verb);
    if (!opt) return { ok: false, message: 'Không thể làm việc này ở đây.' };
    if (!opt.enabled) return { ok: false, message: opt.reason ?? 'Chưa khả dụng.' };
    if (this.s.tutorial.interact === 'active') this.tutorialDone('interact', 'schedule');
    const actionId = String(params.actionId ?? `a${s.tick}_${verb}_${targetId}`);
    if (opt.instant) {
      const r = this.exec((ctx) => {
        if (verb === 'muster') {
          const day = dayOf(s.minute);
          for (const rc of ROLL_CALLS) { const m = minuteOfDay(s.minute); if (m >= rc.at - 10 && m < rc.end) s.flags[`muster:${rc.id}:${day}`] = true; }
          return 'Đã ghi nhận có mặt.';
        }
        if (verb === 'report_fault') return commitAction(ctx, verb, prop, actionId);
        if (verb === 'read_rules') for (const t of Object.keys(s.life.episode.orientation)) s.life.episode.orientation[t] = 'acknowledged';
        ctx.emit({ type: 'actionCompleted', verb, targetId, zone: s.player.zone, actionId });
        return null;
      });
      if (verb === 'view_schedule' && s.tutorial.schedule === 'active') this.tutorialDone('schedule', 'journal');
      return { ok: true, message: r ?? undefined, screen: opt.screen };
    }
    if (verb === 'sit') { this.sit(prop); return { ok: true }; }
    if (verb === 'sleep') return { ok: true, screen: 'sleep' };
    // reservation: shared stations used by an NPC are busy (một slot không hai owner)
    const occupant = SLOTS.find((sl) => sl.propId === prop.id && s.world.reservations[sl.id] && s.world.reservations[sl.id] !== 'player' && s.npcs[s.world.reservations[sl.id]]?.activity !== 'walking' && ['shower', 'sink', 'barber', 'phone', 'medbed', 'bar', 'mat'].includes(prop.kind) && Math.hypot(s.npcs[s.world.reservations[sl.id]].pos.x - sl.pos.x, s.npcs[s.world.reservations[sl.id]].pos.z - sl.pos.z) < 0.5);
    if (occupant) return { ok: false, message: 'Đang có người dùng — thử chỗ bên cạnh hoặc chờ một chút.' };
    s.world.reservations[`player:${prop.id}`] = 'player';
    let duration = opt.duration;
    if (BOOKING_VERBS[verb]) {
      const b = activeBookingAt(s, BOOKING_VERBS[verb], s.player.zone);
      if (!b) return { ok: false, message: 'Không còn lịch hẹn hợp lệ.' };
      b.state = 'active'; // vòng đời booking không đánh dấu “lỡ” khi đang diễn ra
      duration = Math.max(5, Math.min(opt.duration, b.end - s.minute));
    }
    s.player.action = { actionId, verb, targetId, startMinute: s.minute, durationMin: Math.max(0.5, duration), elapsedMin: 0, committed: false, params };
    s.player.mode = 'acting';
    const slot = SLOTS.find((sl) => sl.propId === prop.id && (!s.world.reservations[sl.id] || s.world.reservations[sl.id] === 'player'));
    if (slot && ['shower', 'medbed', 'quiet_mat', 'mat', 'bar', 'visit_table', 'table', 'phone', 'toilet'].includes(prop.kind)) {
      s.player.pos = { ...slot.pos };
      s.player.yaw = slot.yaw;
      s.player.seatedAt = slot.id;
    } else s.player.yaw = Math.atan2(prop.x - s.player.pos.x, prop.z - s.player.pos.z);
    this.flush();
    return { ok: true };
  }

  private finishAction() {
    const s = this.s;
    const a = s.player.action!;
    const prop = PROP_BY_ID[a.targetId] ?? null;
    let msg: string | null = null;
    this.exec((ctx) => {
      if (actionSeen(s, a.actionId)) return;
      msg = commitAction(ctx, a.verb, prop, a.actionId, a.params ?? {});
      if (HELPFUL[a.verb]) witness(ctx, a.verb, HELPFUL[a.verb]);
    });
    a.committed = true;
    delete s.world.reservations[`player:${a.targetId}`];
    s.player.action = null;
    const seat = s.player.seatedAt;
    s.player.seatedAt = null;
    s.player.mode = 'grounded';
    if (seat) this.placeAtExit(seat);
    if (msg) this.exec((ctx) => notify(ctx, msg!, 'info', 'system'));
  }

  cancelAction() {
    const s = this.s;
    const a = s.player.action;
    if (!a || a.committed) return;
    if (BOOKING_VERBS[a.verb]) { const b = s.life.bookings.find((x) => x.state === 'active' && x.kind === BOOKING_VERBS[a.verb]); if (b) b.state = s.minute < b.end ? 'booked' : 'missed'; }
    delete s.world.reservations[`player:${a.targetId}`];
    s.player.action = null;
    s.player.mode = 'grounded';
    const seat = s.player.seatedAt;
    s.player.seatedAt = null;
    if (seat) this.placeAtExit(seat);
    this.emit({ type: 'actionCancelled', verb: a.verb, reason: 'Người chơi hủy trước khi hoàn tất — không nhận kết quả' });
    this.flush();
  }

  /** Skip presentation: fast-forward domain to action end (cùng boundary reducers). */
  skipAction() {
    const a = this.s.player.action;
    if (!a || a.committed) return;
    const remain = a.durationMin - a.elapsedMin;
    this.fastForward(remain, false);
    a.elapsedMin = a.durationMin;
    this.finishAction();
  }

  private placeAtExit(slotId: string) {
    const sl = SLOTS.find((x) => x.id === slotId);
    if (!sl) return;
    // Bồn cầu: đứng dậy bước ra phía trước (sau lưng là két nước/tường).
    const dir = sl.kind === 'toilet' ? -1 : 1;
    const back = { x: sl.pos.x - dir * Math.sin(sl.yaw) * 0.85, y: 0, z: sl.pos.z - dir * Math.cos(sl.yaw) * 0.85 };
    const fixed = this.phys.moveCharacter(back, 0.001, 0.001, 0.3);
    this.s.player.pos = this.phys.overlaps(fixed.x, fixed.z, 0.29) ? { ...this.s.player.lastSafe } : fixed;
  }

  private sit(prop: PropDef) {
    const s = this.s;
    const slot = SLOTS.filter((sl) => sl.propId === prop.id || (Math.abs(sl.pos.x - prop.x) < 1.6 && Math.abs(sl.pos.z - prop.z) < 1.6 && ['sit', 'eat', 'read', 'visit'].includes(sl.kind)))
      .filter((sl) => !s.world.reservations[sl.id] || s.world.reservations[sl.id] === 'player')
      .sort((a, b) => dist2(a.pos, s.player.pos) - dist2(b.pos, s.player.pos))[0];
    s.player.pos = slot ? { ...slot.pos } : { x: prop.x, y: 0, z: prop.z };
    s.player.yaw = slot ? slot.yaw : prop.yaw;
    s.player.seatedAt = slot?.id ?? null;
    if (slot) s.world.reservations[slot.id] = 'player';
    s.player.mode = 'seated';
  }
  standUp() {
    const s = this.s;
    if (s.player.mode !== 'seated') return;
    const seat = s.player.seatedAt;
    if (seat && s.world.reservations[seat] === 'player') delete s.world.reservations[seat];
    s.player.seatedAt = null;
    s.player.mode = 'grounded';
    if (seat) this.placeAtExit(seat);
    else s.player.pos = { ...s.player.lastSafe };
  }

  // ======================= Sleep (F22) =======================
  previewSleep(wakeAbs: number): string[] {
    const s = this.s;
    const out: string[] = [];
    for (const b of s.life.bookings) if (['booked', 'waiting'].includes(b.state) && b.start < wakeAbs && b.end > s.minute) out.push(`Lịch hẹn lúc ${fmtClock(b.start)} sẽ bị lỡ (không bị phạt, có thể đặt lại).`);
    for (let t = Math.ceil(s.minute); t < wakeAbs; t += 1) {
      const m = minuteOfDay(t);
      for (const row of DAILY) if (row.from === m && row.kind !== 'sleep') out.push(`${fmtClock(row.from)} ${row.label}`);
    }
    return out.slice(0, 12);
  }
  sleep(bedId: string, wakeAbs: number): { ok: boolean; message?: string } {
    const s = this.s;
    const prop = PROP_BY_ID[bedId];
    const ownBed = isVN(s) ? homeBed(s) : currentBed(s);
    if (!prop || ownBed !== bedId || !this.inRange(prop)) return { ok: false, message: 'Chỉ ngủ được trên giường của bạn.' };
    if (wakeAbs <= s.minute + 30 || wakeAbs > s.minute + 14 * 60) return { ok: false, message: 'Giờ thức không hợp lệ.' };
    const actionId = `sleep_${s.tick}`;
    const hours = (wakeAbs - s.minute) / 60;
    s.player.mode = 'sleeping';
    s.player.pos = { x: prop.x, y: 0, z: prop.z };
    this.fastForward(wakeAbs - s.minute, true);
    this.exec((ctx) => { if (!actionSeen(s, actionId)) commitAction(ctx, 'sleep', prop, actionId, { hours }); });
    s.player.mode = 'grounded';
    const cell = CELL_ROOMS.find((c) => c.beds.includes(bedId));
    const vnRoom = custodyRoomOfBed(bedId);
    if (vnRoom) { s.player.pos = { x: vnRoom.anchor.x, y: 0, z: vnRoom.anchor.z }; s.player.zone = vnRoom.zone; }
    else if (cell) s.player.pos = this.phys.moveCharacter({ x: cell.door.x, y: 0, z: cell.door.z + cell.inward * 1.6 }, 0.001, 0, 0.3);
    s.player.lastSafe = { ...s.player.pos };
    this.dirty = true;
    this.exec((ctx) => notify(ctx, `Bạn đã ngủ ${hours.toFixed(1)} giờ. Năng lượng ${Math.round(s.needs.energy)}.`, 'success', 'system'));
    return { ok: true };
  }

  /** Domain fast-forward: scheduled boundaries processed once each; physics not stepped. */
  fastForward(minutes: number, sleeping: boolean) {
    const s = this.s;
    let left = minutes;
    while (left > 0) {
      const d = Math.min(1, left);
      s.tick += Math.round(d * 60); // keep tick monotonic for ids (domain uses minute for time)
      this.advanceMinutes(d, sleeping);
      left -= d;
      this.flush();
    }
    this.ai.snapAll(this.ctx);
    for (const n of Object.values(s.npcs)) this.prevNpc.set(n.id, { ...n.pos });
    this.prevPlayer = { ...s.player.pos };
    this.flush();
  }

  // ======================= Dialogue (F06) =======================
  talk(npcId: string): { ok: boolean; message?: string } {
    const s = this.s;
    const rt = s.npcs[npcId];
    if (!rt || rt.absent) return { ok: false, message: 'Không có ở đây.' };
    if (Math.hypot(rt.pos.x - s.player.pos.x, rt.pos.z - s.player.pos.z) > 2.2) return { ok: false, message: 'Hãy lại gần hơn.' };
    if (rt.activity === 'sleeping') return { ok: false, message: 'Người này đang ngủ.' };
    if (s.player.mode === 'seated') this.standUp();
    const d = this.exec((ctx) => startDialogue(ctx, npcId));
    if (!d) return { ok: false, message: 'Không có gì để nói lúc này.' };
    this.dialogue = d;
    rt.talkingWithPlayer = true;
    s.player.mode = 'talking';
    s.player.yaw = Math.atan2(rt.pos.x - s.player.pos.x, rt.pos.z - s.player.pos.z);
    if (s.tutorial.interact === 'active') this.tutorialDone('interact', 'schedule');
    return { ok: true };
  }
  dialogueView() { return this.dialogue ? viewNode(this.s, this.dialogue) : null; }
  dialogueChoose(choiceId: string) {
    if (!this.dialogue) return { ok: false };
    const r = this.exec((ctx) => chooseDialogue(ctx, this.dialogue!, choiceId));
    if (this.dialogue.ended) this.endDialogue();
    return r;
  }
  dialogueContinue() {
    if (!this.dialogue) return;
    this.exec((ctx) => continueDialogue(ctx, this.dialogue!));
    if (this.dialogue.ended) this.endDialogue();
  }
  endDialogue() {
    const d = this.dialogue;
    if (!d) return;
    this.dialogue = null;
    const rt = this.s.npcs[d.npcId];
    if (rt) { rt.talkingWithPlayer = false; rt.nextThink = this.s.tick; }
    this.s.player.mode = 'grounded';
    if (d.pendingOpen) this.emit({ type: 'openScreen', screen: d.pendingOpen });
    this.flush();
  }

  // ======================= Quest-related NPC triggers =======================
  private questNpcTriggers() {
    const s = this.s;
    if (s.flags.binh_following && s.quests.S06?.state === 'active') {
      const b = s.npcs.binh;
      for (const z of ['L13', 'L05'] as ZoneId[]) {
        if (s.player.zone === z && b && !b.absent && b.zone === z && !s.flags[`binh_saw_${z}`]) {
          s.flags[`binh_saw_${z}`] = true;
          this.emit({ type: 'subtitle', speaker: 'Bình', text: z === 'L13' ? 'À, đây là chỗ tắm rửa với giặt đồ. Nhớ rồi!' : 'Nhà ăn đây hả? Rộng ghê.', durationMs: 4000 });
          adjustRel(this.ctx, 'binh', { familiarity: 3 }, 'Được dẫn đường');
        }
      }
    }
  }

  // ======================= Projections =======================
  npcRenderPos(n: NpcRuntime, alpha: number): Vec3 {
    const p = this.prevNpc.get(n.id) ?? n.pos;
    return { x: p.x + (n.pos.x - p.x) * alpha, y: 0, z: p.z + (n.pos.z - p.z) * alpha };
  }
  playerRenderPos(alpha: number): Vec3 {
    const p = this.prevPlayer;
    const c = this.s.player.pos;
    if (Math.hypot(c.x - p.x, c.z - p.z) > 2) return { ...c };
    return { x: p.x + (c.x - p.x) * alpha, y: 0, z: p.z + (c.z - p.z) * alpha };
  }
  zoneIsOpen(z: ZoneId) { return zoneOpen(this.s, z); }
  cellLabel(): string | null {
    const c = cellOf(this.s.player.pos);
    return c ? c.label : null;
  }
  safeAnchorFor(z: ZoneId) {
    // F71: room-specific anchor hợp lệ với actor, không dùng tâm khu.
    const home = isVN(this.s) ? homeRoom(this.s) : null;
    if (home) return { x: home.anchor.x, y: 0, z: home.anchor.z };
    return zoneCenter(z);
  }
  custodyRoomLabel(): string | null {
    if (!isVN(this.s)) return null;
    const r = custodyRoomAt(this.s.player.pos.x, this.s.player.pos.z);
    return r ? r.label : null;
  }
  custodyRoom(id: string) { return CUSTODY_ROOM_BY_ID[id]; }
}
