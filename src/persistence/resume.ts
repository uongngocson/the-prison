// Tab-scoped, synchronous recovery journal. Unlike async IndexedDB writes this
// can finish during pagehide/reload. Manual save slots remain independent.
import type { GameState } from '../domain/types';
import { CONTENT_VERSION } from '../domain/types';
import type { DialogueSession } from '../domain/dialogue';
import { DIALOGUES } from '../content/dialogues';
import { hash32 } from '../domain/util';
import { migrate, validateSave } from './saveCodec';
import type { SlotId } from './localStore';
import type { Overlay } from '../ui/store';

export const RESUME_KEY = 'mot-ngay-moi:resume:v1';
export const RESUME_PREVIOUS_KEY = `${RESUME_KEY}:previous`;
const MAX_BYTES = 768 * 1024;
const overlays: Overlay[] = [null, 'pause', 'inventory', 'journal', 'map', 'schedule', 'profile', 'handbook', 'saves', 'settings', 'life', 'sleep', 'scene', 'library', 'news', 'menu_board', 'notifications', 'quickmenu', 'custody', 'incell'];

export interface ResumeUI {
  screen: 'game' | 'ending';
  overlay: Overlay;
  overlayParams: Record<string, string>;
  lifeTab: string;
  profileTab: string;
  settingsTab: string;
  waypoint: string | null;
}
export interface ResumeSnapshot {
  version: 1;
  state: GameState;
  slot: SlotId;
  ui: ResumeUI;
  dialogue: DialogueSession | null;
  camera: { yaw: number; pitch: number; boom: number; shoulder: number };
}
export type ResumeRead = { snapshot?: ResumeSnapshot; warning?: string; error?: string };

function decode(text: string): ResumeSnapshot {
  if (new TextEncoder().encode(text).byteLength > MAX_BYTES) throw new Error('Checkpoint vượt giới hạn.');
  const envelope = JSON.parse(text) as { payload: string; checksum: number };
  if (typeof envelope.payload !== 'string' || hash32(envelope.payload) !== envelope.checksum) throw new Error('Checkpoint bị hỏng.');
  const r = JSON.parse(envelope.payload) as ResumeSnapshot;
  if (r.version !== 1 || !['auto', 'slot1', 'slot2', 'slot3'].includes(r.slot)) throw new Error('Phiên khôi phục không được hỗ trợ.');
  const error = validateSave(r.state);
  if (error) throw new Error(error);
  if (r.state.contentVersion !== CONTENT_VERSION) throw new Error('Nội dung game đã thay đổi. Hãy tải bản lưu qua menu để kiểm tra tương thích.');
  if (!r.ui || !['game', 'ending'].includes(r.ui.screen) || !overlays.includes(r.ui.overlay)) throw new Error('Màn hình khôi phục không hợp lệ.');
  if (!r.camera || !Object.values(r.camera).every((v) => typeof v === 'number' && Number.isFinite(v))) throw new Error('Camera khôi phục không hợp lệ.');
  if (r.dialogue && (!r.state.npcs[r.dialogue.npcId] || !DIALOGUES[r.dialogue.graphId]?.nodes[r.dialogue.nodeId] || r.dialogue.ended || !Array.isArray(r.dialogue.history))) throw new Error('Hội thoại khôi phục không hợp lệ.');
  r.state = migrate(r.state);
  return r;
}

export function readResume(storage: Storage): ResumeRead {
  let found = false;
  try {
    for (const key of [RESUME_KEY, RESUME_PREVIOUS_KEY]) {
      const text = storage.getItem(key);
      if (!text) continue;
      found = true;
      try {
        const snapshot = decode(text);
        return { snapshot, warning: key === RESUME_PREVIOUS_KEY ? 'Checkpoint mới nhất bị lỗi; đã khôi phục checkpoint trước.' : undefined };
      } catch { /* Keep both records intact; try the preceding generation. */ }
    }
    return found ? { error: 'Không đọc được checkpoint phiên chơi. Bạn có thể tải bản lưu từ menu; dữ liệu lỗi vẫn được giữ nguyên.' } : {};
  } catch {
    return { error: 'Trình duyệt đang chặn bộ nhớ phiên. Hãy mở menu để tải bản lưu hoặc nhập file save.' };
  }
}

export function writeResume(storage: Storage, snapshot: ResumeSnapshot): void {
  // Validate before replacing the last good generation. This checksum detects
  // accidental corruption only; a local single-player save is never trusted MP.
  const payload = JSON.stringify(snapshot);
  const text = JSON.stringify({ payload, checksum: hash32(payload) });
  decode(text);
  const previous = storage.getItem(RESUME_KEY);
  if (previous) {
    try { decode(previous); storage.setItem(RESUME_PREVIOUS_KEY, previous); } catch { /* Do not replace a good backup with corrupt data. */ }
  }
  storage.setItem(RESUME_KEY, text);
}

export function clearResume(storage: Storage): void {
  storage.removeItem(RESUME_KEY);
  storage.removeItem(RESUME_PREVIOUS_KEY);
}
