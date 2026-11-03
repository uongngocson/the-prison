// Presentation bridge: Babylon scene, third-person camera, input mapping, day/night, weather, sync from sim snapshots.
import { Color3, Color4, DirectionalLight, DynamicTexture, Engine, HemisphericLight, ParticleSystem, Scene, ShadowGenerator, UniversalCamera, Vector3 } from '@babylonjs/core';
import { buildWorld, type WorldHandles } from './worldBuilder';
import { LabourView } from './labourView';
import { RemotePlayers } from './remotePlayers';
import { online } from '../online/client';
import { COSMETIC_OUTFIT, Humanoid, STAFF_OUTFIT, type Held, type Pose } from './characters';
import { stripe } from './palette';
import type { GameSession } from '../simulation/session';
import { NPCS, NPC_BY_ID } from '../content/npcs';
import { PROP_BY_ID, ZONE_BY_ID } from '../content/world';
import { minuteOfDay } from '../domain/util';
import { cellDoorClosed } from '../domain/custody';
import type { NpcActivity } from '../domain/types';
import type { Settings, ActionName } from '../ui/settings';

const ACT_POSE: Record<NpcActivity, Pose> = { idle: 'idle', walking: 'walk', acting: 'work', sleeping: 'lie', talking: 'talk', seated: 'sit', eating: 'eat', exercising: 'exercise', reading: 'read', working: 'work', queue: 'idle' };
const LAB_POSE: Record<string, [Pose, Held]> = {
  lab_prepare: ['tend', 'hoe'], lab_sow: ['tend', null], lab_water: ['water', 'can'], lab_weed: ['tend', null], lab_harvest: ['tend', 'tray'], lab_clean: ['tend', 'hoe'],
  lab_observe: ['idle', 'notebook'], lab_feed: ['water', 'scoop'], lab_log: ['read', 'notebook'], lab_harvest_fish: ['work', null], lab_weed_patch: ['tend', null], lab_plant: ['tend', null],
  lab_collect: ['work', null], lab_sweep: ['sweep', 'broom'], lab_dump: ['work', 'broom'], lab_sort: ['work', null], lab_measure: ['work', null], lab_assemble: ['work', null], lab_finish: ['work', 'sander'],
};
const VERB_POSE: Record<string, Pose> = { use_toilet: 'toilet', eat: 'eat', read: 'read', exercise: 'exercise', work_shift: 'work', help: 'work', sort_books: 'work', attend_class: 'read', quiet_time: 'sit', culture_session: 'sit', rest: 'lie', rest_care: 'lie', call: 'sit', visit: 'sit', legal_meeting: 'sit', care_appointment: 'sit', wash: 'work', shower: 'idle', laundry_exchange: 'work', grooming: 'sit', arrange: 'work' };

export class GameView {
  engine: Engine;
  scene: Scene;
  camera: UniversalCamera;
  world!: WorldHandles;
  hemi: HemisphericLight;
  sun: DirectionalLight;
  shadows: ShadowGenerator | null = null;
  rain: ParticleSystem;
  player!: Humanoid;
  npcs = new Map<string, Humanoid>();
  yaw = 0;
  pitch = 0.32;
  boom = 2.8;
  private curBoom = 2.8;
  shoulder = 1;
  private held = new Set<string>();
  private runToggled = false;
  private crouchToggled = false;
  gameplayInput = true;
  /** Virtual joystick from touch UI (-1..1, y = forward). */
  virtual = { x: 0, y: 0, run: false };
  private gamepadPrev: boolean[] = [];
  /** Effective device tier used for auto preset & culling. */
  tier: 'low' | 'medium' | 'high' = 'medium';
  cullDistance = 48;
  onAction: (a: ActionName) => void = () => {};
  settings!: Settings;
  private lastPlayerPos = new Vector3();
  contextLost = false;
  onContextLost: () => void = () => {};
  onContextRestored: () => void = () => {};
  private disposers: (() => void)[] = [];

  constructor(public canvas: HTMLCanvasElement, public session: GameSession) {
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: false, antialias: true, powerPreference: 'high-performance' }, true);
    this.scene = new Scene(this.engine);
    this.scene.skipPointerMovePicking = true;
    this.scene.clearColor = new Color4(0.55, 0.68, 0.8, 1);
    this.scene.ambientColor = new Color3(0.25, 0.25, 0.25);
    this.camera = new UniversalCamera('cam', new Vector3(0, 2, -4), this.scene);
    this.camera.minZ = 0.05;
    this.camera.maxZ = 400;
    this.camera.fov = 1.05;
    this.camera.inputs.clear();
    this.hemi = new HemisphericLight('hemi', new Vector3(0.2, 1, 0.1), this.scene);
    this.hemi.groundColor = new Color3(0.32, 0.3, 0.28);
    this.sun = new DirectionalLight('sun', new Vector3(-0.4, -1, 0.3), this.scene);
    this.sun.position = new Vector3(120, 60, -40);
    this.rain = this.makeRain();
    this.engine.onContextLostObservable.add(() => { this.contextLost = true; this.onContextLost(); });
    this.engine.onContextRestoredObservable.add(() => { this.contextLost = false; this.onContextRestored(); });
  }

  /** Staged build (U05 stages reported by caller). */
  async buildWorldStage(onProgress?: (f: number) => void) { this.world = await buildWorld(this.scene, onProgress); this.labour = new LabourView(this.scene); }
  private labour: LabourView | null = null;
  async buildCharactersStage() {
    const s = this.session.s;
    this.player = new Humanoid(this.scene, 'player', s.character.appearance, stripe(s.character.appearance.outfit));
    let i = 0;
    for (const n of NPCS) {
      this.npcs.set(n.id, new Humanoid(this.scene, n.id, n.appearance, n.role === 'staff' ? STAFF_OUTFIT : stripe(n.appearance.outfit)));
      if (++i % 12 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    this.yaw = s.player.yaw;
  }
  async warmStage() {
    await this.scene.whenReadyAsync();
  }

  applySettings(st: Settings) {
    this.settings = st;
    // Auto: dien thoai -> thap, may tinh bang -> trung binh khong bong, desktop -> trung binh
    const coarse = matchMedia('(pointer: coarse)').matches;
    const short = Math.min(window.innerWidth, window.innerHeight);
    const preset = st.graphics.preset === 'auto' ? (coarse && short < 600 ? 'low' : 'medium') : st.graphics.preset;
    this.tier = preset === 'high' ? 'high' : preset === 'low' ? 'low' : 'medium';
    this.cullDistance = this.tier === 'low' ? 28 : this.tier === 'medium' ? 42 : 56;
    // Độ nét: màn mật độ cao (điện thoại) render tối đa 2× CSS; không xuống dưới 1× CSS (trước đây 0,7–0,875× → mờ).
    const devDpr = window.devicePixelRatio || 1;
    const cap = preset === 'high' ? 2 : preset === 'low' ? (coarse ? 1.5 : 1) : coarse ? 1.75 : 1.25;
    this.maxRes = Math.max(1, Math.min(devDpr, cap)) * Math.max(0.5, st.graphics.resolutionScale);
    this.minRes = Math.min(this.maxRes, Math.max(0.75, coarse ? 1 : 0.85) * Math.max(0.5, st.graphics.resolutionScale));
    this.res = this.maxRes;
    this.engine.setHardwareScalingLevel(1 / this.res);
    const wantShadows = st.graphics.shadows && preset !== 'low' && !(st.graphics.preset === 'auto' && coarse);
    if (wantShadows && !this.shadows) {
      this.shadows = new ShadowGenerator(preset === 'high' ? 2048 : 1024, this.sun);
      this.shadows.usePercentageCloserFiltering = preset === 'high';
      this.shadows.bias = 0.002;
      this.sun.shadowMinZ = 1; this.sun.shadowMaxZ = 200;
    } else if (!wantShadows && this.shadows) { this.shadows.dispose(); this.shadows = null; }
  }

  // ---------------- Input (F04/F20) ----------------
  attachInput() {
    const kd = (e: KeyboardEvent) => {
      if (!this.gameplayInput) return;
      if ((e.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      const b = this.settings.controls.bindings;
      const code = e.code;
      const act = (Object.keys(b) as ActionName[]).find((k) => b[k] === code);
      if (['moveForward', 'moveBack', 'moveLeft', 'moveRight'].includes(act ?? '') || code.startsWith('Arrow')) { this.held.add(code); e.preventDefault(); return; }
      if (act === 'run') { if (this.settings.controls.runToggle) { if (!e.repeat) this.runToggled = !this.runToggled; } else this.held.add(code); return; }
      if (act === 'crouch') { if (this.settings.controls.crouchToggle) { if (!e.repeat) this.crouchToggled = !this.crouchToggled; } else this.held.add(code); return; }
      if (act === 'shoulder') { if (!e.repeat) this.shoulder = -this.shoulder; return; }
      if (act && !e.repeat) { e.preventDefault(); this.onAction(act); }
    };
    const ku = (e: KeyboardEvent) => { this.held.delete(e.code); };
    const blur = () => this.releaseInput();
    const mm = (e: MouseEvent) => {
      if (!this.gameplayInput) return;
      const locked = document.pointerLockElement === this.canvas;
      if (!locked && !(e.buttons & 2)) return;
      const sens = 0.0024 * this.settings.controls.sensitivity;
      this.yaw += e.movementX * sens;
      const dy = e.movementY * sens * (this.settings.controls.invertY ? -1 : 1);
      this.pitch = Math.max(-0.6, Math.min(1.13, this.pitch + dy));
      if (this.session.s.tutorial.look === 'active' && Math.abs(e.movementX) > 2) this.session.tutorialDone('look', 'interact');
    };
    const click = (e: Event) => {
      if (!this.gameplayInput) return;
      const pt = (e as PointerEvent).pointerType;
      if (pt && pt !== 'mouse') return; // cam ung: khong khoa con tro
      if (matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches) return;
      if (document.pointerLockElement !== this.canvas) (this.canvas.requestPointerLock?.() as Promise<void> | undefined)?.catch?.(() => { /* denied: right-drag fallback */ });
    };
    const ctx = (e: Event) => e.preventDefault();
    const wheel = (e: WheelEvent) => { if (this.gameplayInput) this.boom = Math.max(1.4, Math.min(4.5, this.boom + Math.sign(e.deltaY) * 0.3)); };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', blur);
    window.addEventListener('mousemove', mm);
    this.canvas.addEventListener('click', click);
    this.canvas.addEventListener('contextmenu', ctx);
    this.canvas.addEventListener('wheel', wheel, { passive: true });
    const vis = () => { if (document.hidden) { this.releaseInput(); if (this.gameplayInput) this.onAction('pause'); } };
    document.addEventListener('visibilitychange', vis);
    const plc = () => { if (document.pointerLockElement !== this.canvas && this.gameplayInput) { this.releaseInput(); this.onAction('pause'); } };
    document.addEventListener('pointerlockchange', plc);
    this.disposers.push(() => document.removeEventListener('pointerlockchange', plc));
    this.disposers.push(() => {
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur);
      window.removeEventListener('mousemove', mm); this.canvas.removeEventListener('click', click); this.canvas.removeEventListener('contextmenu', ctx);
      this.canvas.removeEventListener('wheel', wheel); document.removeEventListener('visibilitychange', vis);
    });
  }
  releaseInput() { this.held.clear(); this.runToggled = false; this.virtual.x = 0; this.virtual.y = 0; this.virtual.run = false; this.session.input.moveX = 0; this.session.input.moveZ = 0; }
  /** Camera rotation from touch drag / gamepad. */
  look(dx: number, dy: number, sens: number) {
    this.yaw += dx * 0.0042 * sens;
    this.pitch = Math.max(-0.6, Math.min(1.13, this.pitch + dy * 0.0042 * sens * (this.settings.controls.invertY ? -1 : 1)));
    if (this.session.s.tutorial.look === 'active' && Math.abs(dx) > 3) this.session.tutorialDone('look', 'interact');
  }
  zoom(delta: number) { this.boom = Math.max(1.4, Math.min(4.5, this.boom + delta)); }
  toggleCrouch() { this.crouchToggled = !this.crouchToggled; }
  toggleShoulder() { this.shoulder = -this.shoulder; }
  get crouching() { return this.crouchToggled; }

  /** Standard gamepad: LS move, RS camera, A interact, B cancel, X skip, Y life, LB map, RB journal, Back schedule, Start pause, D-pad up inventory / down profile, L3 run, R3 crouch. */
  private pollGamepad(dt: number): { f: number; r: number; run: boolean } | null {
    const pads = navigator.getGamepads ? [...navigator.getGamepads()] : [];
    const gp = pads.find((p) => p && p.connected && p.mapping === 'standard') ?? pads.find((p) => p && p.connected);
    if (!gp) return null;
    const dz = (v: number) => (Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82);
    const pressed = gp.buttons.map((b) => b.pressed);
    const edge = (i: number) => !!pressed[i] && !this.gamepadPrev[i];
    const map: [number, ActionName][] = [[0, 'interact'], [1, 'cancel'], [2, 'skip'], [3, 'life'], [4, 'map'], [5, 'journal'], [8, 'schedule'], [9, 'pause'], [12, 'inventory'], [13, 'profile']];
    if (this.gameplayInput) for (const [i, a] of map) if (edge(i)) this.onAction(a);
    if (this.gameplayInput && edge(11)) this.toggleCrouch();
    if (this.gameplayInput && edge(10)) this.runToggled = !this.runToggled;
    this.gamepadPrev = pressed;
    const sens = this.settings.controls.gamepadSensitivity;
    const rx = dz(gp.axes[2] ?? 0), ry = dz(gp.axes[3] ?? 0);
    if (this.gameplayInput && (rx || ry)) this.look(rx * 900 * dt, ry * 700 * dt, sens);
    const lx = dz(gp.axes[0] ?? 0), ly = dz(gp.axes[1] ?? 0);
    return { f: -ly, r: lx, run: this.runToggled };
  }
  setGameplayInput(on: boolean) {
    this.gameplayInput = on;
    if (!on) { this.releaseInput(); if (document.pointerLockElement) document.exitPointerLock(); }
  }

  private pushInput(dt: number) {
    const b = this.settings.controls.bindings;
    const h = (code: string) => this.held.has(code);
    let f = (h(b.moveForward) || h('ArrowUp') ? 1 : 0) - (h(b.moveBack) || h('ArrowDown') ? 1 : 0);
    let r = (h(b.moveRight) || h('ArrowRight') ? 1 : 0) - (h(b.moveLeft) || h('ArrowLeft') ? 1 : 0);
    const pad = this.pollGamepad(dt);
    let analogRun = false;
    if (pad && (pad.f || pad.r)) { f = pad.f; r = pad.r; analogRun = pad.run; }
    if (this.virtual.x || this.virtual.y) { f = this.virtual.y; r = this.virtual.x; analogRun = this.virtual.run; }
    const len = Math.hypot(f, r);
    if (len > 1) { f /= len; r /= len; } // diagonal normalized
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const inp = this.session.input;
    inp.moveX = sy * f + cy * r;
    inp.moveZ = cy * f - sy * r;
    inp.run = analogRun || (this.settings.controls.runToggle ? this.runToggled : h(b.run));
    inp.crouch = this.settings.controls.crouchToggle || this.crouchToggled ? this.crouchToggled : h(b.crouch);
    inp.camYaw = this.yaw;
  }

  // ---------------- Frame ----------------
  frame(dt: number) {
    this.adaptResolution(dt);
    const s = this.session.s;
    if (this.gameplayInput) this.pushInput(dt);
    else this.pollGamepad(dt);
    const a = this.session.alpha;
    const rm = this.settings.access.reducedMotion;
    // player
    const pp = this.session.playerRenderPos(a);
    const pr = this.player.root;
    pr.position.set(pp.x, 0, pp.z);
    const jump = Math.hypot(pp.x - this.lastPlayerPos.x, pp.z - this.lastPlayerPos.z);
    const moving = jump > 3 ? 0 : jump / Math.max(dt, 1e-3);
    this.lastPlayerPos.set(pp.x, 0, pp.z);
    // bị áp giải/chuyển chỗ (dịch chuyển xa trong 1 khung hình): camera quay theo hướng nhân vật, không giữ góc cũ hướng vào tường
    if (jump > 3) { this.yaw = s.player.yaw; this.pitch = 0.32; pr.rotation.y = s.player.yaw; }
    let targetYaw = s.player.yaw;
    let dyaw = targetYaw - pr.rotation.y;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    pr.rotation.y += dyaw * Math.min(1, dt * 12);
    let pose: Pose = 'idle';
    const m = s.player.mode;
    // Đi vệ sinh: camera quay ra trước mặt để thấy nhân vật ngồi trên bồn.
    if (m === 'acting' && s.player.action?.verb === 'use_toilet') {
      let dc = s.player.yaw + Math.PI - this.yaw;
      while (dc > Math.PI) dc -= Math.PI * 2;
      while (dc < -Math.PI) dc += Math.PI * 2;
      this.yaw += dc * Math.min(1, dt * 3);
    }
    if (m === 'sleeping') pose = 'lie';
    else if (m === 'seated') pose = 'sit';
    else if (m === 'talking') pose = 'talk';
    else if (m === 'acting' && s.player.action) pose = LAB_POSE[s.player.action.verb]?.[0] ?? VERB_POSE[s.player.action.verb] ?? 'work';
    else if (moving > 0.2) pose = s.player.crouch ? 'crouch' : moving > 2.4 ? 'run' : 'walk';
    else if (s.player.crouch) pose = 'crouch';
    if (pose === 'lie') { const bed = s.player.action ? PROP_BY_ID[s.player.action.targetId] : null; if (bed) { pr.rotation.y = bed.yaw; pr.position.set(bed.x, 0, bed.z); } }
    this.player.setHeld(m === 'acting' && s.player.action ? LAB_POSE[s.player.action.verb]?.[1] ?? null : null);
    this.player.animate(dt, pose, moving, rm);
    this.lastPose = moving > 0.2 ? (moving > 2.4 ? 'run' : 'walk') : pose;
    const outfit = s.equipped.outfit ? s.inventory.bag.find((x) => x?.uid === s.equipped.outfit)?.itemId : null;
    this.player.setOutfit(outfit ? COSMETIC_OUTFIT[outfit] ?? 'stripe' : 'stripe');
    // npcs
    const cam = this.camera.position;
    for (const [id, h] of this.npcs) {
      const rt = s.npcs[id];
      if (!rt || rt.absent) { h.setVisible(false); continue; }
      const p = this.session.npcRenderPos(rt, a);
      const far = Math.hypot(p.x - cam.x, p.z - cam.z) > this.cullDistance;
      h.setVisible(!far);
      if (far) continue;
      h.root.position.set(p.x, 0, p.z);
      h.root.rotation.y = rt.yaw;
      const np: Pose = rt.talkingWithPlayer ? 'talk' : ACT_POSE[rt.activity] ?? 'idle';
      h.animate(dt, np, rt.activity === 'walking' ? (NPC_BY_ID[id].role === 'staff' ? 1.45 : 1.3) : 0, rm);
    }
    // Trực tuyến: người chơi khác (chỉ hiển thị khi đang kết nối)
    if (online.active || online.peers.size) {
      this.remote ??= new RemotePlayers(this.scene);
      this.remote.update(dt, online.peers, { x: cam.x, z: cam.z }, this.cullDistance + 10, rm, (id) => online.isBlocked(id));
      this.remote.updateSelf(online.active ? pp : null, online.myBubble);
    } else if (this.remote) { this.remote.disposeAll(); this.remote = null; }
    this.updateCamera(dt, pp);
    this.updateEnvironment();
    this.updateDoors(dt);
    this.updateFocusRing();
  }

  private updateCamera(dt: number, pp: { x: number; z: number }) {
    const s = this.session.s;
    const crouch = s.player.crouch;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const right = { x: cy, z: -sy };
    // Màn dọc hẹp (góc nhìn ngang chỉ ~30°): độ lệch vai cố định đẩy nhân vật ra mép → giảm theo tỉ lệ màn hình
    // (≤0,6: nhân vật ở giữa; ≥1,3: nhìn qua vai đầy đủ như máy tính / điện thoại ngang), camera lùi xa hơn một chút.
    const eng = this.scene.getEngine();
    const aspect = eng.getRenderWidth() / Math.max(1, eng.getRenderHeight());
    const wide = Math.max(0, Math.min(1, (aspect - 0.6) / 0.7));
    const boom = this.boom * (1 + 0.2 * (1 - wide));
    let shoulderOff = 0.42 * this.shoulder * wide;
    const ts = this.session.phys.raycast(pp.x, pp.z, pp.x + right.x * shoulderOff * 1.4, pp.z + right.z * shoulderOff * 1.4, ['wall', 'door']);
    shoulderOff *= Math.max(0, ts - 0.2);
    const pivot = new Vector3(pp.x + right.x * shoulderOff, crouch ? 1.15 : 1.55, pp.z + right.z * shoulderOff);
    if (s.player.mode === 'sleeping' || (s.player.mode === 'acting' && VERB_POSE[s.player.action?.verb ?? ''] === 'lie')) pivot.y = 1.0;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const dir = new Vector3(sy * cp, -sp, cy * cp);
    const desired = pivot.subtract(dir.scale(boom));
    const t = this.session.phys.raycast(pivot.x, pivot.z, desired.x, desired.z, ['wall', 'door']);
    const dXZ = Math.hypot(desired.x - pivot.x, desired.z - pivot.z) || 1e-3;
    let target = boom;
    if (t < 1) target = Math.max(0.35, (t * dXZ - 0.25) / Math.max(cp, 0.2));
    // co nhanh, giãn mềm
    this.curBoom = target < this.curBoom ? target : this.curBoom + (target - this.curBoom) * Math.min(1, dt * 3);
    const pos = pivot.subtract(dir.scale(this.curBoom));
    const zone = ZONE_BY_ID[s.player.zone];
    if (!zone.outdoor) pos.y = Math.min(pos.y, zone.height - 0.2);
    pos.y = Math.max(0.3, pos.y);
    this.camera.position.copyFrom(pos);
    this.camera.setTarget(pivot.add(dir.scale(2)));
    // hide player mesh when camera too close (fade đầu/vai)
    this.player.root.setEnabled(this.curBoom > 0.6);
  }

  private updateEnvironment() {
    const s = this.session.s;
    const m = minuteOfDay(s.minute) / 60;
    const day = Math.max(0, Math.sin(((m - 6) / 12) * Math.PI)); // 0 at 6h/18h, 1 at noon
    const dusk = Math.max(0, 1 - Math.abs(m - 18.2) / 1.6) + Math.max(0, 1 - Math.abs(m - 6) / 1.4);
    const w = s.world.weather;
    const overcast = w === 'clear' ? 0 : w === 'overcast' ? 0.45 : 0.7;
    const sky = new Color3(0.06 + 0.5 * day, 0.08 + 0.6 * day, 0.15 + 0.68 * day).scale(1 - overcast * 0.45);
    if (dusk > 0) { sky.r = Math.min(1, sky.r + dusk * 0.35); sky.g = Math.min(1, sky.g + dusk * 0.12); }
    this.scene.clearColor = new Color4(sky.r, sky.g, sky.b, 1);
    this.hemi.intensity = 0.62 + 0.3 * day * (1 - overcast * 0.4);
    this.hemi.diffuse = new Color3(1, 0.98 - dusk * 0.08, 0.94 - dusk * 0.15);
    this.sun.intensity = (0.08 + 0.75 * day) * (1 - overcast * 0.6);
    this.sun.diffuse = new Color3(1, 0.92 - dusk * 0.2, 0.82 - dusk * 0.35);
    const ang = ((m - 6) / 12) * Math.PI;
    this.sun.direction = new Vector3(-Math.cos(ang) * 0.8, -Math.max(0.25, Math.sin(ang)), 0.35);
    this.world.windowMat.emissiveColor = new Color3(0.25 + 0.55 * day + dusk * 0.2, 0.3 + 0.55 * day, 0.42 + 0.5 * day).scale(1 - overcast * 0.3);
    this.world.lightMat.emissiveColor = day > 0.6 ? new Color3(0.8, 0.79, 0.72) : new Color3(1, 0.96, 0.85);
    const outdoor = !!ZONE_BY_ID[s.player.zone].outdoor;
    this.scene.fogMode = overcast > 0 && outdoor ? Scene.FOGMODE_EXP2 : Scene.FOGMODE_NONE;
    this.scene.fogDensity = 0.008 * overcast;
    this.scene.fogColor = sky;
    const raining = w === 'rain' && outdoor;
    if (raining && !this.rain.isStarted()) this.rain.start();
    if (!raining && this.rain.isStarted()) this.rain.stop();
    if (raining) (this.rain.emitter as Vector3).copyFrom(this.camera.position.add(new Vector3(0, 6, 0)));
    // shadows only matter outdoors; register casters lazily
    if (this.shadows) {
      const map = this.shadows.getShadowMap()!;
      map.refreshRate = outdoor ? 1 : 0;
      if (!map.renderList?.length) {
        for (const h of [this.player, ...this.npcs.values()]) for (const c of h.root.getChildMeshes()) this.shadows.addShadowCaster(c, false);
      }
    }
    for (const [id, mk] of this.world.brokenMarkers) mk.setEnabled(!!s.world.brokenFixtures[id]);
  }

  private updateDoors(dt: number) {
    this.labour?.update(this.session.s, dt);
    for (const [id, d] of this.world.doors) {
      const st = this.session.s.world.doors[id]?.state ?? 'open';
      const target = st === 'closed' ? 1 : 0;
      d.t += (target - d.t) * Math.min(1, dt * 4);
      d.mesh.position = Vector3.Lerp(d.openPos, d.closedPos, d.t);
      d.mesh.setEnabled(d.t > 0.02);
    }
    for (const [roomId, d] of this.world.cellDoors) {
      const target = cellDoorClosed(this.session.s, roomId) ? 1 : 0;
      d.t += (target - d.t) * Math.min(1, dt * 3);
      d.mesh.position = Vector3.Lerp(d.openPos, d.closedPos, d.t);
    }
  }

  private updateFocusRing() {
    const f = this.session.focus;
    const ring = this.world.focusRing;
    if (!f) { ring.setEnabled(false); return; }
    let x = 0, z = 0;
    if (f.kind === 'prop') { const p = PROP_BY_ID[f.id]; x = p.x; z = p.z; }
    else { const n = this.session.s.npcs[f.id]; x = n.pos.x; z = n.pos.z; }
    ring.setEnabled(true);
    ring.position.set(x, 0.03, z);
    ring.rotation.y += 0.02;
  }

  private makeRain(): ParticleSystem {
    const ps = new ParticleSystem('rain', 2500, this.scene);
    const tex = new DynamicTexture('rain_tex', { width: 8, height: 64 }, this.scene, false);
    const c = tex.getContext() as CanvasRenderingContext2D;
    const g = c.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(220,230,255,0.9)');
    c.fillStyle = g; c.fillRect(3, 0, 2, 64);
    tex.hasAlpha = true;
    tex.update();
    ps.particleTexture = tex;
    ps.emitter = new Vector3(0, 6, 0);
    ps.minEmitBox = new Vector3(-18, 0, -18);
    ps.maxEmitBox = new Vector3(18, 2, 18);
    ps.direction1 = new Vector3(-0.3, -10, 0.2);
    ps.direction2 = new Vector3(0.3, -12, -0.2);
    ps.minSize = 0.05; ps.maxSize = 0.08;
    ps.minScaleY = 6; ps.maxScaleY = 9;
    ps.minLifeTime = 0.6; ps.maxLifeTime = 0.8;
    ps.emitRate = 1800;
    ps.color1 = new Color4(0.8, 0.85, 1, 0.5);
    ps.color2 = new Color4(0.8, 0.85, 1, 0.3);
    ps.colorDead = new Color4(0.8, 0.85, 1, 0);
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    ps.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED;
    return ps;
  }

  render() { this.scene.render(); }
  resize() { this.engine.resize(); }
  fps() { return this.engine.getFps(); }
  private maxRes = 1; private minRes = 1; private res = 1; private resTimer = 0; private lowFps = 0;
  /** Độ phân giải động: FPS thấp kéo dài → hạ từng bậc; FPS dư → nâng lại (không dưới 1× CSS trên cảm ứng). */
  private adaptResolution(dt: number) {
    this.resTimer += dt;
    if (this.resTimer < 1.5) return;
    this.resTimer = 0;
    const f = this.engine.getFps();
    if (f < 38 && this.res > this.minRes) { if (++this.lowFps >= 2) { this.res = Math.max(this.minRes, this.res - 0.25); this.engine.setHardwareScalingLevel(1 / this.res); this.lowFps = 0; } }
    else if (f > 56 && this.res < this.maxRes) { this.res = Math.min(this.maxRes, this.res + 0.125); this.engine.setHardwareScalingLevel(1 / this.res); this.lowFps = 0; }
    else this.lowFps = 0;
  }
  /** Tư thế gần nhất của người chơi (gửi cho người khác ở chế độ Trực tuyến). */
  lastPose = 'idle';
  private remote: RemotePlayers | null = null;
  dispose() { this.remote?.disposeAll(); for (const d of this.disposers) d(); this.scene.dispose(); this.engine.dispose(); }
}
