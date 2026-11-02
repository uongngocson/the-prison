// Save DTO validation & migration (F18, 11 save schema v2). Checksum phát hiện lỗi, không chống gian lận.
import { SCHEMA_VERSION, type GameState } from '../domain/types';
import { createLifeState } from '../domain/life';
import { canonicalJson } from '../domain/util';
import { VN_PROFILE, PRESET_BY_ID } from '../content/custody';
import { CUSTODY_ROOM_BY_ID, custodyRoomOfBed } from '../content/world';

const MAX_BYTES = 512 * 1024;

function finite(n: unknown, lo = -1e9, hi = 1e12): boolean {
  return typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi;
}

/** Returns error string or null. Rejects unknown/invalid shapes (bounded schema, finite numbers). */
export function validateSave(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return 'Không phải dữ liệu save.';
  const s = raw as Partial<GameState>;
  if (s.schemaVersion !== 1 && s.schemaVersion !== 2 && s.schemaVersion !== 3) return `Phiên bản save không hỗ trợ (${String(s.schemaVersion)}).`;
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
  if (s.schemaVersion === 3) {
    if (s.experienceMode !== 'fictional_life' && s.experienceMode !== 'vn_custody') return 'Chế độ trải nghiệm không hợp lệ (schema 3).';
    if (s.experienceMode === 'fictional_life' && s.custody) return 'Save hư cấu không được chứa dữ liệu giam giữ.';
    if (s.experienceMode === 'vn_custody') { const e = validateCustody(s as GameState); if (e) return e; }
  }
  if ((s.schemaVersion ?? 0) >= 2) {
    const l = s.life;
    if (!l || !l.episode || !l.account) return 'Thiếu lifeState (schema 2).';
    if (!Number.isInteger(l.account.balance) || l.account.balance < 0 || l.account.reserved < 0 || l.account.reserved > l.account.balance) return 'Sổ tài khoản không hợp lệ.';
  }
  return null;
}

/** Toàn graph custody (16 §8.3): refs, cohort, một housing active, khoảng lệnh, quyền theo phạm vi. */
function validateCustody(s: GameState): string | null {
  const c = s.custody;
  if (!c || c.mode !== 'vn_custody') return 'Thiếu dữ liệu chế độ giam giữ.';
  if (c.scenarioRef?.id == null || c.scenarioRef.version !== VN_PROFILE.version || c.scenarioRef.hash !== VN_PROFILE.hash) return `POLICY_MISSING: profile ${String(c.scenarioRef?.version)} không còn trong registry — save được giữ nguyên.`;
  if (!PRESET_BY_ID[c.presetId]) return 'Mức án của save không có trong danh mục.';
  const j = c.judgment;
  if (!j || (j.sentenceKind !== 'term' && j.sentenceKind !== 'life')) return 'Bản án không hợp lệ.';
  if (j.sentenceKind === 'life' && j.declaredTermMonths !== null) return 'Chung thân không được có thời hạn.';
  if (j.sentenceKind === 'term' && (!Number.isInteger(j.declaredTermMonths) || (j.declaredTermMonths as number) < 3 || (j.declaredTermMonths as number) > 360)) return 'Thời hạn án không hợp lệ.';
  if (!finite(j.creditedDays, 0, 20000) || !finite(j.servedDaysAtStart, 0, 20000)) return 'Thời gian đã chấp hành không hợp lệ.';
  if (!Array.isArray(c.classification) || !c.classification.length) return 'Thiếu quyết định phân loại.';
  if (!Array.isArray(c.orders) || !Array.isArray(c.grants) || !Array.isArray(c.journal)) return 'Dữ liệu lệnh/quyền không hợp lệ.';
  for (const o of c.orders) {
    if (!finite(o.startMinute, 0) || (o.endMinute !== null && (!finite(o.endMinute, 0) || o.endMinute <= o.startMinute))) return 'Khoảng thời gian lệnh không hợp lệ.';
    if (o.kind === 'discipline_confinement' && (o.endMinute === null || o.endMinute - o.startMinute > VN_PROFILE.disciplineMaxDays * 1440)) return 'Lệnh kỷ luật vượt giới hạn hồ sơ.';
    if (o.roomId && !CUSTODY_ROOM_BY_ID[o.roomId]) return 'Lệnh tham chiếu buồng không tồn tại.';
  }
  if (c.orders.filter((o) => o.state === 'active' && o.kind === 'discipline_confinement').length > 1) return 'Nhiều lệnh kỷ luật đang hiệu lực cùng lúc.';
  const active = s.life.housing.filter((h) => h.state === 'active');
  if (active.length > 1) return 'Có nhiều hơn một chỗ ở đang hiệu lực.';
  if (s.life.episode.state === 'admitted' && active.length === 1) {
    const room = custodyRoomOfBed(active[0].bedSlotId);
    const g = c.classification[c.classification.length - 1].group;
    if (!room || (room.cohort !== g && !s.life.transitions.some((t) => t.state === 'proposed'))) return 'Chỗ ở không tương thích với phân loại.';
  }
  for (const g of c.grants) if (!finite(g.validFromMinute, 0) || !finite(g.validUntilMinute, 0) || g.validUntilMinute <= g.validFromMinute) return 'Quyền di chuyển không hợp lệ.';
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
  if (s.schemaVersion === 2) {
    // v2 → v3: đánh dấu hành trình hư cấu cũ; KHÔNG tự gán bản án hay chuyển chỗ.
    s.experienceMode = 'fictional_life';
    s.custody = null;
    s.schemaVersion = 3;
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
export interface SaveMeta { name: string; day: number; minute: number; zone: string; chapter: number; lineageId: string; generation: number; ended: boolean; mode?: string; preset?: string; room?: string }

export async function encodeSave(state: GameState, meta: SaveMeta): Promise<SaveEnvelope> {
  const canon = canonicalJson(state);
  if (new TextEncoder().encode(canon).byteLength > MAX_BYTES) throw new Error(`Save vượt giới hạn ${MAX_BYTES / 1024} KiB — không cắt bớt dữ liệu âm thầm.`);
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
