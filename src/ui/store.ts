// UI store (S16 zustand): chỉ modal/tab/focus + HUD projection; không phải nguồn sự thật mô phỏng.
import { create } from 'zustand';
import type { NotificationEntry } from '../domain/types';
import type { NodeView } from '../domain/dialogue';
import type { FocusTarget } from '../simulation/session';

export type Screen = 'landing' | 'auth' | 'menu' | 'create' | 'loading' | 'game' | 'ending' | 'lobby' | 'fatal' | 'credits';
export type Overlay =
  | null | 'pause' | 'inventory' | 'journal' | 'map' | 'schedule' | 'profile' | 'handbook' | 'saves' | 'settings' | 'life'
  | 'quickmenu' | 'sleep' | 'scene' | 'library' | 'news' | 'menu_board' | 'notifications';

export interface HudSnapshot {
  clock: string; dayLabel: string; period: string; activity: string; zone: string; cell: string | null; weather: string;
  needs: { key: string; label: string; value: number; cause: string }[];
  quest: { id: string; title: string; objectives: { text: string; done: boolean }[]; where?: string } | null;
  action: { label: string; progress: number; canSkip: boolean } | null;
  mode: string; money: string; lifeBadges: number; tutorial: string | null; waypoint: { label: string; dist: number; dir: number } | null;
  saveStatus: string; paused: boolean; fps: number;
}
export interface Toast { id: string; text: string; severity: NotificationEntry['severity']; persistent?: boolean; at: number }

interface UIState {
  screen: Screen;
  overlay: Overlay;
  overlayParams: Record<string, string>;
  lifeTab: string;
  profileTab: string;
  settingsTab: string;
  hud: HudSnapshot | null;
  focus: FocusTarget | null;
  dialogue: NodeView | null;
  dialogueHistory: { speaker: string; text: string }[];
  toasts: Toast[];
  subtitle: { speaker: string; text: string; until: number } | null;
  loading: { stage: string; progress: number; error: string | null; stages: string[] };
  fatal: { title: string; message: string; code: string } | null;
  ending: { title: string; text: string[]; summary: string[] } | null;
  rev: number; // bump when domain changed so panels re-read session
  waypoint: string | null;
  set: (p: Partial<UIState>) => void;
  open: (o: Overlay, params?: Record<string, string>) => void;
  toast: (t: Omit<Toast, 'at'>) => void;
  dismiss: (id: string) => void;
}

export const useUI = create<UIState>((set, get) => ({
  screen: 'loading',
  overlay: null,
  overlayParams: {},
  lifeTab: 'journey',
  profileTab: 'profile',
  settingsTab: 'graphics',
  hud: null,
  focus: null,
  dialogue: null,
  dialogueHistory: [],
  toasts: [],
  subtitle: null,
  loading: { stage: 'Kiểm tra phiên chơi đã lưu', progress: 0, error: null, stages: ['Kiểm tra phiên chơi đã lưu'] },
  fatal: null,
  ending: null,
  rev: 0,
  waypoint: null,
  set: (p) => set(p),
  open: (o, params = {}) => set({ overlay: o, overlayParams: params }),
  toast: (t) => {
    const cur = get().toasts;
    if (cur.some((x) => x.text === t.text)) return; // dedup
    const next = [...cur, { ...t, at: performance.now() }];
    // max 3 visible; persistent kept
    while (next.filter((x) => !x.persistent).length > 3) next.splice(next.findIndex((x) => !x.persistent), 1);
    set({ toasts: next.slice(-6) });
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));
