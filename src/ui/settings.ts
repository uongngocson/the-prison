// F20 settings: graphics / audio / controls / accessibility. Validated schema; corrupt prefs → defaults.
import { create } from 'zustand';

export type ActionName =
  | 'moveForward' | 'moveBack' | 'moveLeft' | 'moveRight' | 'run' | 'crouch' | 'interact' | 'cancel' | 'skip'
  | 'inventory' | 'journal' | 'map' | 'schedule' | 'profile' | 'life' | 'handbook' | 'pause' | 'shoulder' | 'custody';

export const ACTION_LABEL: Record<ActionName, string> = {
  moveForward: 'Đi tới', moveBack: 'Đi lùi', moveLeft: 'Sang trái', moveRight: 'Sang phải', run: 'Chạy', crouch: 'Cúi người',
  interact: 'Tương tác', cancel: 'Hủy hành động', skip: 'Tua nhanh hành động', inventory: 'Túi đồ', journal: 'Nhật ký nhiệm vụ',
  map: 'Bản đồ', schedule: 'Lịch sinh hoạt', profile: 'Hồ sơ nhân vật', life: 'Đời sống', handbook: 'Sổ tay', pause: 'Tạm dừng / Menu', shoulder: 'Đổi vai camera', custody: 'Chế độ thụ án',
};

export const DEFAULT_BINDINGS: Record<ActionName, string> = {
  moveForward: 'KeyW', moveBack: 'KeyS', moveLeft: 'KeyA', moveRight: 'KeyD', run: 'ShiftLeft', crouch: 'KeyC', interact: 'KeyE',
  cancel: 'KeyQ', skip: 'KeyF', inventory: 'KeyI', journal: 'KeyJ', map: 'KeyM', schedule: 'KeyK', profile: 'KeyP', life: 'KeyL',
  handbook: 'KeyH', pause: 'Escape', shoulder: 'KeyV', custody: 'KeyG',
};

export interface Settings {
  graphics: { preset: 'auto' | 'low' | 'medium' | 'high'; resolutionScale: number; shadows: boolean; lockManual: boolean };
  audio: { master: number; music: number; sfx: number; dialogue: number; ambience: number; ui: number };
  controls: { bindings: Record<ActionName, string>; sensitivity: number; invertY: boolean; runToggle: boolean; crouchToggle: boolean; touchMode: 'auto' | 'on' | 'off'; touchSensitivity: number; joystickSize: number; leftHanded: boolean; gamepadSensitivity: number };
  access: { subtitles: boolean; subtitleScale: number; reducedMotion: boolean; highContrast: boolean; lightNeeds: boolean; autoComplete: boolean; dayLength: 48 | 72; textScale: number; hudMinimal: boolean; tutorialHints: boolean };
}

export const DEFAULT_SETTINGS: Settings = {
  graphics: { preset: 'auto', resolutionScale: 1, shadows: true, lockManual: false },
  audio: { master: 0.8, music: 0.5, sfx: 0.8, dialogue: 1, ambience: 0.6, ui: 0.6 },
  controls: { bindings: { ...DEFAULT_BINDINGS }, sensitivity: 1, invertY: false, runToggle: false, crouchToggle: true, touchMode: 'auto', touchSensitivity: 1, joystickSize: 1, leftHanded: false, gamepadSensitivity: 1 },
  access: { subtitles: true, subtitleScale: 1, reducedMotion: false, highContrast: false, lightNeeds: false, autoComplete: false, dayLength: 48, textScale: 1, hudMinimal: false, tutorialHints: true },
};

const KEY = 'mnm.settings.v1';
const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);

export function sanitize(raw: unknown): Settings {
  const d = DEFAULT_SETTINGS;
  const r = (raw ?? {}) as Partial<Settings>;
  const g = (r.graphics ?? {}) as Partial<Settings['graphics']>;
  const a = (r.audio ?? {}) as Partial<Settings['audio']>;
  const c = (r.controls ?? {}) as Partial<Settings['controls']>;
  const x = (r.access ?? {}) as Partial<Settings['access']>;
  const bindings = { ...d.controls.bindings };
  if (c.bindings) for (const k of Object.keys(bindings) as ActionName[]) if (typeof c.bindings[k] === 'string' && c.bindings[k].length < 32) bindings[k] = c.bindings[k];
  return {
    graphics: { preset: (['auto', 'low', 'medium', 'high'] as const).includes(g.preset as never) ? g.preset! : d.graphics.preset, resolutionScale: num(g.resolutionScale, 0.5, 1, 1), shadows: bool(g.shadows, true), lockManual: bool(g.lockManual, false) },
    audio: { master: num(a.master, 0, 1, d.audio.master), music: num(a.music, 0, 1, d.audio.music), sfx: num(a.sfx, 0, 1, d.audio.sfx), dialogue: num(a.dialogue, 0, 1, 1), ambience: num(a.ambience, 0, 1, d.audio.ambience), ui: num(a.ui, 0, 1, d.audio.ui) },
    controls: { bindings, sensitivity: num(c.sensitivity, 0.2, 3, 1), invertY: bool(c.invertY, false), runToggle: bool(c.runToggle, false), crouchToggle: bool(c.crouchToggle, true), touchMode: (['auto', 'on', 'off'] as const).includes(c.touchMode as never) ? c.touchMode! : 'auto', touchSensitivity: num(c.touchSensitivity, 0.3, 3, 1), joystickSize: num(c.joystickSize, 0.7, 1.5, 1), leftHanded: bool(c.leftHanded, false), gamepadSensitivity: num(c.gamepadSensitivity, 0.3, 3, 1) },
    access: {
      subtitles: bool(x.subtitles, true), subtitleScale: num(x.subtitleScale, 0.8, 1.8, 1), reducedMotion: bool(x.reducedMotion, false), highContrast: bool(x.highContrast, false),
      lightNeeds: bool(x.lightNeeds, false), autoComplete: bool(x.autoComplete, false), dayLength: x.dayLength === 72 ? 72 : 48, textScale: num(x.textScale, 1, 2, 1), hudMinimal: bool(x.hudMinimal, false), tutorialHints: bool(x.tutorialHints, true),
    },
  };
}

function load(): Settings {
  try { return sanitize(JSON.parse(localStorage.getItem(KEY) ?? 'null')); } catch { return structuredClone(DEFAULT_SETTINGS); }
}

interface SettingsStore { s: Settings; set: (fn: (s: Settings) => void) => void; reset: (group?: keyof Settings) => void }
export const useSettings = create<SettingsStore>((set, get) => ({
  s: load(),
  set: (fn) => {
    const next = structuredClone(get().s);
    fn(next);
    const clean = sanitize(next);
    try { localStorage.setItem(KEY, JSON.stringify(clean)); } catch { /* quota */ }
    set({ s: clean });
  },
  reset: (group) => {
    const next = structuredClone(get().s);
    if (group) (next as unknown as Record<string, unknown>)[group] = structuredClone(DEFAULT_SETTINGS[group]);
    else Object.assign(next, structuredClone(DEFAULT_SETTINGS));
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* */ }
    set({ s: next });
  },
}));

export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return ({ ShiftLeft: 'Shift', ShiftRight: 'Shift phải', ControlLeft: 'Ctrl', Space: 'Space', Escape: 'Esc', Tab: 'Tab', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'Enter' } as Record<string, string>)[code] ?? code;
}
