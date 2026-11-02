// Composition root: session + view + persistence + audio + UI projection. Không service locator toàn cục ngoài singleton này.
import { homeRoom, isConfinedPhase, isVN, windowAt } from '../domain/custody';
/** Trong bối cảnh VN, khu ở cũ (L02) được thay bằng khu của buồng đang ở. */
const vnWhere = (s: GameState, z: ZoneId): ZoneId => (z === 'L02' && isVN(s) ? homeRoom(s)?.zone ?? z : z);
import { GameSession } from '../simulation/session';
import type { GameView } from '../presentation/gameView';
import { createNewGame, type CharacterDraft } from '../domain/newgame';
import type { GameState } from '../domain/types';
import { useUI, type HudSnapshot, type Overlay } from '../ui/store';
import { useSettings, type ActionName, type Settings } from '../ui/settings';
import { touchUIActive } from '../ui/device';
import { audio } from '../audio/audio';
import { saveToSlot, loadSlot, type SlotId } from '../persistence/localStore';
import { NEED_LABEL } from '../domain/core';
import { QUEST_BY_ID } from '../content/quests';
import { DAILY } from '../content/schedule';
import { ZONE_BY_ID, doorNodes, zoneCenter } from '../content/world';
import { PERIOD_LABEL, dayOf, fmtClock, fmtDayClock, fmtMoney, minuteOfDay, periodOf } from '../domain/util';
import { lifeSummaryCounts, available } from '../domain/life';
import { ENDINGS } from '../content/life';
import type { ZoneId } from '../domain/types';
import { ITEM_BY_ID } from '../content/items';
import { SKILL_LABEL, levelOf } from '../domain/core';
import { clearResume, readResume, writeResume, type ResumeSnapshot } from '../persistence/resume';

const TUTORIAL_TEXT: Record<string, (k: (a: ActionName) => string) => string> = {
  move: (k) => `Di chuyển bằng ${k('moveForward')}/${k('moveLeft')}/${k('moveBack')}/${k('moveRight')}. Giữ ${k('run')} để chạy.`,
  look: () => 'Nhấp vào khung hình để điều khiển camera bằng chuột (Esc để thả chuột). Có thể kéo chuột phải nếu trình duyệt chặn khóa con trỏ.',
  interact: (k) => `Đến gần đồ vật hoặc người có vòng sáng và nhấn ${k('interact')} để tương tác.`,
  schedule: (k) => `Nhấn ${k('schedule')} hoặc xem bảng lịch để biết giờ ăn, điểm danh và hoạt động.`,
  journal: (k) => `Nhấn ${k('journal')} để xem nhiệm vụ. ${k('life')}: Đời sống (thư, cửa hàng, yêu cầu...).`,
  save: (k) => `Game tự lưu mỗi phút. Nhấn ${k('pause')} để lưu thủ công hoặc mở cài đặt.`,
};

const TOUCH_TUTORIAL: Record<string, string> = {
  move: 'Kéo cần điều khiển góc trái để đi; đẩy ra sát mép để chạy.',
  look: 'Vuốt nửa phải màn hình để xoay camera, chụm hai ngón để thu phóng.',
  interact: 'Đến gần đồ vật/người có vòng sáng rồi chạm nút ✋ (hoặc chạm nhanh vào màn hình).',
  schedule: 'Chạm 📅 để xem lịch: giờ ăn, điểm danh và hoạt động.',
  journal: 'Chạm 📋 để xem nhiệm vụ, 🏠 để mở Đời sống (thư, cửa hàng, yêu cầu...).',
  save: 'Game tự lưu mỗi phút. Chạm ☰ để lưu thủ công hoặc mở cài đặt.',
};

class Controller {
  session: GameSession | null = null;
  view: GameView | null = null;
  slot: SlotId = 'auto';
  private raf = 0;
  private last = 0;
  private hudTimer = 0;
  private autosaveTimer = 0;
  private saving = false;
  private initialized = false;
  private booting = false;
  private recoveryTimer = 0;
  private recoveryError = false;
  saveStatus = 'Chưa lưu';
  private unsubSettings: (() => void) | null = null;
  canvas: HTMLCanvasElement | null = null;
  private lastZoneAudio = '';

  /** Called after the canvas mounts; StrictMode must not start two worlds. */
  async initialize() {
    if (this.initialized) return;
    this.initialized = true;
    const checkpoint = () => this.checkpoint();
    window.addEventListener('pagehide', checkpoint);
    window.addEventListener('beforeunload', checkpoint);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.checkpoint();
        if (this.session && !this.booting) void this.save('auto');
      }
    });
    // Save selected panels immediately, without rewriting on every HUD update.
    useUI.subscribe((u, prev) => {
      if (!this.booting && this.session && this.view && (u.overlay !== prev.overlay || u.screen !== prev.screen || u.dialogue !== prev.dialogue || u.fatal !== prev.fatal)) {
        const modal = u.overlay !== null || u.dialogue !== null || u.fatal !== null;
        this.session.paused = modal || u.screen !== 'game';
        this.view.setGameplayInput(!this.session.paused);
      }
      if (u.overlay !== prev.overlay || u.screen !== prev.screen || u.lifeTab !== prev.lifeTab || u.profileTab !== prev.profileTab || u.settingsTab !== prev.settingsTab || u.waypoint !== prev.waypoint || u.overlayParams !== prev.overlayParams) this.checkpoint();
    });
    let recovery: ReturnType<typeof readResume>;
    try { recovery = readResume(window.sessionStorage); }
    catch { recovery = { error: 'Không truy cập được bộ nhớ phiên. Hãy tải bản lưu từ menu.' }; }
    if (recovery.snapshot) {
      this.slot = recovery.snapshot.slot;
      await this.boot(recovery.snapshot.state, false, recovery.snapshot);
      if (recovery.warning) useUI.getState().toast({ id: 'resume_previous', text: recovery.warning, severity: 'warning', persistent: true });
    } else if (recovery.error) {
      useUI.getState().set({ screen: 'loading', loading: { stage: 'Khôi phục phiên chơi', stages: [], progress: 0, error: recovery.error } });
    } else useUI.getState().set({ screen: 'landing' });
  }

  /** Synchronous journal; never rely on awaiting an IDB write during unload. */
  checkpoint() {
    const ui = useUI.getState();
    if (this.booting || !this.session || !this.view || (ui.screen !== 'game' && ui.screen !== 'ending')) return;
    try {
      writeResume(window.sessionStorage, {
        version: 1, state: this.session.s, slot: this.slot,
        ui: { screen: ui.screen, overlay: ui.overlay, overlayParams: ui.overlayParams, lifeTab: ui.lifeTab, profileTab: ui.profileTab, settingsTab: ui.settingsTab, waypoint: ui.waypoint },
        dialogue: this.session.dialogue,
        camera: { yaw: this.view.yaw, pitch: this.view.pitch, boom: this.view.boom, shoulder: this.view.shoulder },
      });
      this.recoveryError = false;
    } catch {
      if (!this.recoveryError) {
        this.recoveryError = true;
        ui.toast({ id: 'resume_fail', text: 'Không ghi được checkpoint khôi phục khi tải lại trang. Hãy lưu thủ công hoặc Xuất file trước khi đóng trang.', severity: 'error', persistent: true });
      }
    }
  }

  get s(): GameState | null { return this.session?.s ?? null; }
  bump() { useUI.setState((u) => ({ rev: u.rev + 1 })); }

  /** Run a domain command and refresh UI projections. */
  exec<T>(fn: Parameters<GameSession['exec']>[0]): T | undefined {
    if (!this.session) return undefined;
    const r = this.session.exec(fn) as T;
    this.bump();
    this.checkpoint();
    return r;
  }

  simSettings(st: Settings) {
    return { lightNeeds: st.access.lightNeeds, autoComplete: st.access.autoComplete || this.hasMobility(), dayLengthRealMin: st.access.dayLength };
  }
  private hasMobility() { return !!this.session?.s.life.support.some((p) => p.kind === 'functional' && p.state === 'active' && p.flags.includes('mobility')); }

  async startNew(draft: CharacterDraft) {
    const lineage = `lin_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
    const state = createNewGame(draft, lineage);
    this.slot = 'auto';
    await this.boot(state, true);
  }

  async continueFrom(slot: SlotId, which: 0 | 1 = 0) {
    const r = await loadSlot(slot, which);
    if (!r.state) { useUI.getState().set({ screen: 'fatal', fatal: { title: 'Không tải được save', message: r.error ?? 'Lỗi không xác định', code: 'SAVE_LOAD' } }); return; }
    if (r.error) useUI.getState().toast({ id: 'load_prev', text: r.error, severity: 'warning', persistent: true });
    this.slot = slot === 'auto' ? 'auto' : slot;
    await this.boot(r.state, false);
  }
  async loadState(state: GameState) { this.slot = 'auto'; await this.boot(state, false); }

  /** U05 loading with real stages; readiness barrier collider+nav before spawn. */
  private async boot(state: GameState, isNew: boolean, resume?: ResumeSnapshot) {
    this.booting = true;
    this.teardown();
    this.hudTimer = this.autosaveTimer = this.recoveryTimer = 0;
    this.lastZoneAudio = '';
    const ui = useUI.getState();
    const stages = ['Khởi động', 'Chuẩn bị bản đồ', 'Dựng khu trại', 'Tạo nhân vật', 'Hoàn thiện hình ảnh', 'Sẵn sàng'];
    ui.set({ screen: 'loading', loading: { stage: stages[0], progress: 0, error: null, stages }, overlay: null, dialogue: null, toasts: [], ending: null, fatal: null, focus: null, hud: null, subtitle: null, waypoint: null, overlayParams: {} });
    const step = async (i: number) => { useUI.getState().set({ loading: { stage: stages[i], progress: i / (stages.length - 1), error: null, stages } }); await new Promise((r) => setTimeout(r, 30)); };
    try {
      const st = useSettings.getState().s;
      await step(0);
      const session = new GameSession(state, this.simSettings(st), { resume: !!resume });
      this.session = session;
      if (resume?.dialogue) session.dialogue = resume.dialogue;
      await step(1);
      if (!this.canvas) throw new Error('Không tìm thấy canvas.');
      const { GameView } = await import('../presentation/gameView');
      const view = new GameView(this.canvas, session);
      this.view = view;
      view.applySettings(st);
      await step(2);
      // dựng theo đợt, cập nhật thanh tiến trình trong bước (không treo ở 40%)
      await view.buildWorldStage((f) => useUI.getState().set({ loading: { stage: stages[2], progress: (2 + f) / (stages.length - 1), error: null, stages } }));
      await step(3);
      await view.buildCharactersStage();
      if (resume) Object.assign(view, resume.camera);
      await step(4);
      await view.warmStage();
      await step(5);
      view.attachInput();
      view.onAction = (a) => this.onKeyAction(a);
      view.onContextLost = () => { this.pause(true); useUI.getState().set({ fatal: { title: 'Mất ngữ cảnh đồ họa', message: 'Trình duyệt đã tạm dừng GPU. Tiến trình được giữ; đang thử khôi phục...', code: 'CONTEXT_LOST' } }); };
      view.onContextRestored = () => { useUI.getState().set({ fatal: null }); };
      session.on((e) => this.onEvent(e.event));
      this.unsubSettings = useSettings.subscribe((x) => { view.applySettings(x.s); session.settings = this.simSettings(x.s); session.ctx.settings = session.settings; audio.setVolumes(x.s.audio); });
      audio.setVolumes(st.audio);
      audio.resume();
      useUI.getState().set({ screen: 'game', overlay: isNew ? 'life' : null, lifeTab: 'journey' });
      if (isNew) view.setGameplayInput(false);
      if (resume) {
        useUI.getState().set(resume.ui);
        this.refreshDialogue();
      }
      this.saveStatus = isNew ? 'Chưa lưu' : 'Đã tải';
      this.booting = false;
      if (state.ended) this.showEnding(false);
      this.projectHud();
      this.checkpoint();
      this.last = performance.now();
      this.loop();
      window.addEventListener('resize', this.onResize);
      // Persist a starting/recovery save too; first-minute reloads must not
      // depend on the 60-second timer. Keep manual slots independent.
      if (!resume) void this.save('auto');
    } catch (e) {
      console.error('BOOT_FAIL', e);
      useUI.getState().set({ loading: { stage: 'Lỗi', progress: 0, error: (e as Error).message, stages } });
      this.teardown();
    } finally {
      this.booting = false;
    }
  }

  private onResize = () => this.view?.resize();

  teardown() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.unsubSettings?.();
    this.unsubSettings = null;
    this.view?.dispose();
    this.view = null;
    this.session = null;
  }

  private lastLoopErr = 0;
  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const sess = this.session;
    const view = this.view;
    if (!sess || !view || view.contextLost) return;
    const ui = useUI.getState();
    const modal = ui.overlay !== null || ui.dialogue !== null || ui.fatal !== null;
    sess.paused = modal || ui.screen !== 'game'; // Ending/loading must not advance the world either.
    view.setGameplayInput(!modal && ui.screen === 'game');
    // một lỗi khung hình không được làm đứng HUD/vòng lặp (ghi log có giới hạn)
    try {
      // Đang tải: không vẽ cảnh dựng dở mỗi khung (tốn GPU/CPU, làm chậm loading trên máy yếu)
      if (ui.screen === 'loading' || this.booting) return;
      sess.update(dt);
      view.frame(dt);
      view.render();
      this.hudTimer += dt;
      if (this.hudTimer > 0.25) { this.hudTimer = 0; this.projectHud(); }
    } catch (e) {
      if (now - this.lastLoopErr > 5000) { this.lastLoopErr = now; console.error('[loop]', e); }
    }
    // focus prompt updates (10 Hz in sim) — copy reference cheaply
    if (ui.focus !== sess.focus) ui.set({ focus: sess.focus });
    if (!sess.paused) {
      this.autosaveTimer += dt;
      if (this.autosaveTimer > 60 && sess.dirty) { this.autosaveTimer = 0; void this.save('auto'); }
    }
    if (ui.subtitle && performance.now() > ui.subtitle.until) ui.set({ subtitle: null });
    const z = sess.s.player.zone;
    const key = `${z}|${sess.s.world.weather}|${sess.s.player.mode}`;
    if (key !== this.lastZoneAudio) { this.lastZoneAudio = key; audio.setEnvironment(z, sess.s.world.weather, sess.s.player.mode === 'sleeping', !!ZONE_BY_ID[z].outdoor); }
    this.recoveryTimer += dt;
    if (this.recoveryTimer >= 1) { this.recoveryTimer = 0; this.checkpoint(); }
  };

  private projectHud() {
    const sess = this.session!;
    const s = sess.s;
    const st = useSettings.getState().s;
    const m = minuteOfDay(s.minute);
    const row = DAILY.find((r) => m >= r.from && m < r.to);
    const q = s.trackedQuest ? QUEST_BY_ID[s.trackedQuest] : null;
    const qp = q ? s.quests[q.id] : null;
    const a = s.player.action;
    const counts = lifeSummaryCounts(s);
    const tut = Object.entries(s.tutorial).find(([, v]) => v === 'active')?.[0] ?? null;
    const b = st.controls.bindings;
    const k = (x: ActionName) => `[${b[x].replace('Key', '').replace('ShiftLeft', 'Shift').replace('Escape', 'Esc')}]`;
    let waypoint: HudSnapshot['waypoint'] = null;
    const wp = useUI.getState().waypoint as ZoneId | null;
    if (wp && wp !== s.player.zone) {
      const target = s.player.zone === 'L03' || ZONE_BY_ID[s.player.zone].side === 'corridor' ? (doorNodes(wp)?.outside ?? zoneCenter(wp)) : (doorNodes(s.player.zone)?.inside ?? zoneCenter(wp));
      const dx = target.x - s.player.pos.x, dz = target.z - s.player.pos.z;
      waypoint = { label: ZONE_BY_ID[wp].name, dist: Math.round(Math.hypot(dx, dz)), dir: Math.atan2(dx, dz) - (this.view?.yaw ?? 0) };
    } else if (wp === s.player.zone) useUI.getState().set({ waypoint: null });
    const hud: HudSnapshot = {
      clock: fmtClock(s.minute),
      dayLabel: fmtDayClock(s.minute),
      period: PERIOD_LABEL[periodOf(s.minute)],
      activity: isVN(s) ? windowAt(s).label : row ? row.label : 'Tự do',
      zone: ZONE_BY_ID[s.player.zone].name,
      cell: sess.cellLabel(),
      weather: s.world.weather === 'rain' ? 'Mưa nhẹ' : s.world.weather === 'overcast' ? 'Âm u' : 'Trời quang',
      needs: (['energy', 'hunger', 'hygiene', 'mood'] as const).map((key) => ({ key, label: NEED_LABEL[key], value: Math.round(s.needs[key]), cause: s.needCauses[key] })),
      quest: q && qp ? { id: q.id, title: q.title, objectives: q.objectives.slice(qp.stage, qp.stage + 2).map((o) => ({ text: o.text + (('count' in o.match && o.match.count) ? ` (${qp.counts[o.id] ?? 0}/${o.match.count})` : ''), done: false })), where: q.objectives[qp.stage]?.where ? ZONE_BY_ID[vnWhere(s, q.objectives[qp.stage].where!)].name : undefined } : null,
      action: a && !a.committed ? { label: verbLabel(a.verb, a.targetId), progress: Math.min(1, a.elapsedMin / a.durationMin), canSkip: true } : null,
      mode: s.player.mode,
      money: fmtMoney(available(s)),
      lifeBadges: counts.unreadLetters + counts.answeredCases + counts.readyOrders + counts.transitions + (counts.incidents ? 1 : 0),
      tutorial: tut && st.access.tutorialHints ? (touchUIActive(st.controls.touchMode) ? TOUCH_TUTORIAL[tut] : TUTORIAL_TEXT[tut]?.(k)) ?? null : null,
      waypoint,
      saveStatus: this.saveStatus,
      paused: sess.paused,
      fps: Math.round(this.view?.fps() ?? 0),
    };
    useUI.getState().set({ hud });
  }

  private onEvent(e: import('../domain/types').DomainEvent) {
    const ui = useUI.getState();
    switch (e.type) {
      case 'notify':
        ui.toast({ id: e.entry.id, text: e.entry.text, severity: e.entry.severity, persistent: e.entry.persistent });
        if (e.entry.severity === 'success') audio.cue('ok'); else audio.cue('notify');
        break;
      case 'subtitle':
        if (useSettings.getState().s.access.subtitles || true) ui.set({ subtitle: { speaker: e.speaker, text: e.text, until: performance.now() + (e.durationMs ?? 4000) } });
        break;
      case 'sound': audio.cue(e.cue as 'chime'); break;
      case 'openScreen': this.openScreen(e.screen, e.params); break;
      case 'flag':
        if (e.key === 'departed') this.showEnding();
        break;
      case 'questUpdated': case 'lifeUpdated': case 'itemAdded': case 'itemRemoved': case 'xp': case 'relationship': case 'achievement':
        this.bump();
        break;
      case 'dayStarted': void this.save('auto'); break;
    }
  }

  openScreen(screen: string, params?: Record<string, string>) {
    const ui = useUI.getState();
    const lifeTabs: Record<string, string> = { admission: 'journey', property: 'property', store: 'store', contacts: 'contacts', cases: 'cases', support: 'support', programs: 'programs', incidents: 'incidents', transfer: 'transfer', release: 'release' };
    if (lifeTabs[screen]) { ui.set({ overlay: 'life', lifeTab: lifeTabs[screen] }); return; }
    if (screen === 'achievements') { ui.set({ overlay: 'profile', profileTab: 'achievements' }); return; }
    if (screen === 'inventory') { ui.set({ overlay: 'inventory', overlayParams: { locker: '1' } }); return; }
    if (screen === 'menu') { ui.set({ overlay: 'menu_board' }); return; }
    // CR-LAB-01: U39 bảng công việc, U40/41 station, U42 bàn mộc, U43 dụng cụ, U44 bàn giao
    if (screen === 'work' || screen.startsWith('work_')) { ui.open('work', { view: screen === 'work' ? 'hub' : screen.slice(5), ...(params ?? {}) }); return; }
    const map: Record<string, Overlay> = { schedule: 'schedule', handbook: 'handbook', news: 'news', library: 'library', scene: 'scene', sleep: 'sleep', journal: 'journal', map: 'map' };
    const o = map[screen];
    if (o) ui.open(o, params ?? {});
    if (screen === 'schedule' && this.session?.s.tutorial.schedule === 'active') this.session.tutorialDone('schedule', 'journal');
  }

  onKeyAction(a: ActionName) {
    const ui = useUI.getState();
    const sess = this.session;
    if (!sess) return;
    audio.resume();
    switch (a) {
      // Blur/pointer-lock/visibility can arrive before the next frame. Keep an
      // already-open panel/dialogue rather than replacing it during reload.
      case 'pause': if (!ui.overlay && !ui.dialogue) ui.open('pause'); break;
      case 'inventory': ui.open('inventory'); break;
      case 'journal': ui.open('journal'); if (sess.s.tutorial.journal === 'active') sess.tutorialDone('journal', 'save'); break;
      case 'map': ui.open('map'); break;
      case 'schedule': this.openScreen('schedule'); break;
      case 'profile': ui.set({ overlay: 'profile', profileTab: 'profile' }); break;
      case 'life': ui.set({ overlay: 'life' }); break;
      case 'handbook': ui.open('handbook'); break;
      case 'work': ui.open('work', { view: 'hub' }); break;
      case 'custody': if (isVN(sess.s)) ui.open(isConfinedPhase(sess.s.custody!.phase) ? 'incell' : 'custody'); break;
      case 'cancel': if (sess.s.player.action) sess.cancelAction(); else if (sess.s.player.mode === 'seated') sess.standUp(); break;
      case 'skip': sess.skipAction(); this.bump(); break;
      case 'interact': {
        const f = sess.focus;
        if (!f) return;
        const v = f.verbs.find((x) => x.enabled) ?? f.verbs[0];
        if (v) this.doVerb(f.id, v.verb);
        break;
      }
    }
  }

  doVerb(targetId: string, verb: string) {
    const sess = this.session!;
    const r = sess.interact(targetId, verb);
    const ui = useUI.getState();
    if (!r.ok) { ui.toast({ id: `err_${Date.now()}`, text: r.message ?? 'Không thể thực hiện.', severity: 'warning' }); audio.cue('error'); return; }
    if (verb === 'talk') this.refreshDialogue();
    if (r.message) ui.toast({ id: `m_${Date.now()}`, text: r.message, severity: 'info' });
    if (r.screen === 'sleep') ui.open('sleep', { bed: targetId });
    else if (r.screen) this.openScreen(r.screen, { target: targetId });
    this.bump();
    this.checkpoint();
  }

  refreshDialogue() {
    const sess = this.session!;
    const v = sess.dialogueView();
    useUI.getState().set({ dialogue: v, dialogueHistory: sess.dialogue?.history.slice() ?? [] });
    this.checkpoint();
  }
  choose(id: string) {
    const sess = this.session!;
    const r = sess.dialogueChoose(id);
    if (!r.ok && 'message' in r && r.message) useUI.getState().toast({ id: `dc_${Date.now()}`, text: r.message, severity: 'warning' });
    this.refreshDialogue();
    this.bump();
  }
  continueDialogue() { this.session!.dialogueContinue(); this.refreshDialogue(); this.bump(); }
  endDialogue() { this.session!.endDialogue(); this.refreshDialogue(); this.bump(); }

  pause(on: boolean) { useUI.getState().open(on ? 'pause' : null); }

  async save(slot: SlotId = this.slot): Promise<boolean> {
    if (!this.session || this.saving) return false;
    const session = this.session;
    const savedTick = session.s.tick;
    const savedVersion = session.changeVersion;
    this.saving = true;
    this.saveStatus = 'Đang lưu...';
    try {
      await saveToSlot(slot, session.s);
      if (this.session !== session) return true;
      if (session.s.tick === savedTick && session.changeVersion === savedVersion) session.dirty = false;
      this.saveStatus = `Đã lưu ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
      return true;
    } catch (e) {
      this.saveStatus = 'Lưu thất bại';
      useUI.getState().toast({ id: 'save_fail', text: `Lưu thất bại: ${(e as Error).message}. Tiến trình vẫn còn trong phiên; hãy thử lại hoặc Xuất file.`, severity: 'error', persistent: true });
      return false;
    } finally { this.saving = false; if (this.session === session && !this.booting) { this.projectHud(); this.checkpoint(); } }
  }

  private showEnding(save = true) {
    const s = this.session!.s;
    s.ended = true;
    const id = s.life.reintegration.endingId ?? 'partial';
    const e = ENDINGS[id];
    const summary = [
      `Số ngày: ${dayOf(s.minute)}`,
      `Kỹ năng: ${(['focus', 'fitness', 'communication'] as const).map((k) => `${SKILL_LABEL[k]} cấp ${levelOf(s.skills[k])}`).join(', ')}`,
      `Mục tiêu kế hoạch: ${Object.values(s.life.reintegration.goals).filter(Boolean).length}/6`,
      `Tài sản đã nhận lại: ${s.life.receipts.filter((r) => r.kind === 'return').flatMap((r) => r.lines).map((l) => ITEM_BY_ID[l.itemId]?.name).join(', ') || 'không có'}`,
      `Quyết toán tài khoản: ${fmtMoney(Number(s.flags.settled_amount ?? 0))}`,
      `Người đã quen: ${Object.values(s.relationships).filter((r) => r.known).length}`,
    ];
    if (save) void this.save('auto');
    useUI.getState().set({ overlay: null, ending: { title: e.title, text: e.text, summary }, screen: 'ending' });
    this.checkpoint();
  }

  /** Post-ending sandbox is a separate fork (F57) — không mở lại vòng lặp của episode đã kết thúc. */
  async sandboxFork() {
    const s = this.session?.s;
    if (!s) return;
    const fork: GameState = structuredClone(s);
    fork.lineageId = `${s.lineageId}_sandbox`;
    fork.generation = 0;
    fork.ended = false;
    fork.flags.sandbox = true;
    fork.life.episode.state = 'archived';
    this.slot = 'slot3';
    await this.boot(fork, false);
    useUI.getState().toast({ id: 'sandbox', text: 'Chế độ tự do (bản sao riêng, lưu ở Ô lưu 3). Hành trình chính đã khép lại.', severity: 'info', persistent: true });
  }

  quitToMenu() {
    try { clearResume(window.sessionStorage); } catch { /* Storage may be denied. */ }
    this.teardown();
    useUI.getState().set({ screen: 'menu', overlay: null, dialogue: null, hud: null, focus: null });
  }
}

export function verbLabel(verb: string, target: string): string {
  const L: Record<string, string> = { eat: 'Đang ăn', read: 'Đang đọc', exercise: 'Đang tập', rest: 'Đang nghỉ', wash: 'Đang rửa mặt', shower: 'Đang tắm', use_toilet: 'Đang đi vệ sinh', lab_prepare: 'Đang làm đất', lab_sow: 'Đang gieo hạt', lab_water: 'Đang tưới', lab_weed: 'Đang nhổ cỏ', lab_harvest: 'Đang thu hoạch', lab_clean: 'Đang dọn luống', lab_observe: 'Đang quan sát ao', lab_feed: 'Đang cho cá ăn', lab_log: 'Đang ghi nhật ký', lab_harvest_fish: 'Đang hỗ trợ thu cá', lab_weed_patch: 'Đang làm cỏ', lab_plant: 'Đang trồng hoa', lab_collect: 'Đang gom phế liệu', lab_sweep: 'Đang quét dọn', lab_dump: 'Đang đổ rác', lab_sort: 'Đang phân loại khay', lab_measure: 'Đang đo & đánh dấu', lab_assemble: 'Đang ghép khay', lab_finish: 'Đang chà nhám', drink: 'Đang uống nước', sort_books: 'Đang sắp sách', help: 'Đang giúp việc', work_shift: 'Đang làm ca', attend_class: 'Đang học', quiet_time: 'Giờ yên tĩnh', culture_session: 'Sinh hoạt', grooming: 'Cắt tóc', laundry_exchange: 'Đổi đồ giặt', take_meal: 'Nhận suất ăn', take_spare_meal: 'Nhận suất dự phòng', return_tray: 'Trả khay', call: 'Cuộc gọi', visit: 'Thăm gặp', legal_meeting: 'Buổi hẹn cố vấn', care_appointment: 'Buổi hẹn chăm sóc', rest_care: 'Nghỉ phục hồi', arrange: 'Trải thảm', collect_orders: 'Nhận hàng', essentials: 'Nhận vật dụng' };
  return L[verb] ?? verb;
}

export const controller = new Controller();
// Debug handle for automated smoke tests (read-only use).
if (typeof window !== 'undefined') (window as unknown as { __mnm: Controller }).__mnm = controller;
