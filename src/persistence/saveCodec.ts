// Save DTO validation & migration (F18, 11 save schema v2). Checksum phát hiện lỗi, không chống gian lận.
import { SCHEMA_VERSION, type GameState } from '../domain/types';
import { createLifeState } from '../domain/life';
import { canonicalJson } from '../domain/util';

const MAX_BYTES = 512 * 1024;

function finite(n: unknown, lo = -1e9, hi = 1e12): boolean {
  return typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi;
}

/** Returns error string or null. Rejects unknown/invalid shapes (bounded schema, finite numbers). */
export function validateSave(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return 'Không phải dữ liệu save.';
  const s = raw as Partial<GameState>;
  if (s.schemaVersion !== 1 && s.schemaVersion !== 2) return `Phiên bản save không hỗ trợ (${String(s.schemaVersion)}).`;
  if (s.trustMode !== 'sp_untrusted') return 'Chế độ tin cậy không hợp lệ (chỉ hỗ trợ save đơn người chơi).';
  if (!finite(s.minute, 0) || !finite(s.tick, 0)) return 'Đồng hồ game không hợp lệ.';
  if (!s.character || typeof s.character.name !== 'string' || [...s.character.name].length > 24) return 'Thông tin nhân vật không hợp lệ.';
  if (!s.needs) return 'Thiếu chỉ số nhu cầu.';
  for (const k of ['energy', 'hunger', 'hygiene', 'mood'] as const) if (!finite(s.needs[k], 0, 100)) return `Chỉ số ${k} không hợp lệ.`;
  if (!s.player || !finite(s.player.pos?.x, -500, 500) || !finite(s.player.pos?.z, -500, 500)) return 'Vị trí người chơi không hợp lệ.';
  if (!s.inventory || !Array.isArray(s.inventory.bag) || s.inventory.bag.length !== 12) return 'Túi đồ không hợp lệ.';
  for (const c of ['bag', 'locker', 'mailbox', 'stored'] as const) {
    const arr = s.inventory[c];
    if (!Array.isArray(arr) || arr.length > 200) return `Kho ${c} không hợp lệ.`;
    for (const st of arr) if (st && (typeof st.itemId !== 'string' || !Number.isInteger(st.qty) || st.qty <= 0 || st.qty > 999)) return 'Số lượng vật phẩm không hợp lệ.';
  }
  if (s.skills) for (const v of Object.values(s.skills)) if (!finite(v, 0, 1e6)) return 'XP không hợp lệ.';
  if (s.schemaVersion === 2) {
    const l = s.life;
    if (!l || !l.episode || !l.account) return 'Thiếu lifeState (schema 2).';
    if (!Number.isInteger(l.account.balance) || l.account.balance < 0 || l.account.reserved < 0 || l.account.reserved > l.account.balance) return 'Sổ tài khoản không hợp lệ.';
  }
  return null;
}

/** v1 → v2: giữ progress/XP/items; episode admitted cho nhân vật cũ; account 0 với opening key; không phát item mới. */
export function migrate(raw: GameState): GameState {
  const s = raw;
  if (s.schemaVersion === 1) {
    const life = createLifeState(s.minute, 'family', `ep_${s.lineageId}`);
    life.episode.state = 'admitted';
    for (const k of Object.keys(life.episode.admissionSteps) as (keyof typeof life.episode.admissionSteps)[]) life.episode.admissionSteps[k] = true;
    life.housing.push({ id: 'hs_migrated', zone: 'L02', roomId: 'cell_3', bedSlotId: 'cell_3_bed_a', state: 'active', startMinute: s.minute, reason: 'Chuyển đổi save v1' });
    life.sourceKeys.push('migration:v1v2');
    (s as GameState).life = life;
    if (!s.inventory.stored) s.inventory.stored = [];
    s.flags = { ...(s.flags ?? {}), admission_complete: true };
    s.schemaVersion = 2;
  }
  for (const q of Object.values(s.quests ?? {})) if (!q.counts) q.counts = {};
  if (s.schemaVersion > SCHEMA_VERSION) throw new Error('Save mới hơn phiên bản game.');
  return s;
}

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface SaveEnvelope { format: 'mot-ngay-moi-save'; schemaVersion: number; contentVersion: string; savedAt: string; sha256: string; bytes: number; meta: SaveMeta; state: GameState }
export interface SaveMeta { name: string; day: number; minute: number; zone: string; chapter: number; lineageId: string; generation: number; ended: boolean }

export async function encodeSave(state: GameState, meta: SaveMeta): Promise<SaveEnvelope> {
  const canon = canonicalJson(state);
  if (canon.length > MAX_BYTES) throw new Error(`Save vượt giới hạn ${MAX_BYTES / 1024} KiB — không cắt bớt dữ liệu âm thầm.`);
  return { format: 'mot-ngay-moi-save', schemaVersion: state.schemaVersion, contentVersion: state.contentVersion, savedAt: new Date().toISOString(), sha256: await sha256Hex(canon), bytes: canon.length, meta, state };
}

export async function decodeSave(env: unknown): Promise<{ state?: GameState; error?: string }> {
  const e = env as SaveEnvelope;
  if (!e || e.format !== 'mot-ngay-moi-save' || !e.state) return { error: 'Tệp không phải save của Một Ngày Mới.' };
  const err = validateSave(e.state);
  if (err) return { error: err };
  const hash = await sha256Hex(canonicalJson(e.state));
  if (hash !== e.sha256) return { error: 'Checksum không khớp — save có thể bị hỏng.' };
  try {
    return { state: migrate(structuredClone(e.state)) };
  } catch (x) {
    return { error: (x as Error).message };
  }
}
