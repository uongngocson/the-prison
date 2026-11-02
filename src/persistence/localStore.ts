// IndexedDB local save (S34): 3 manual slots + autosave with 2 generations; atomic per-transaction writes.
import type { GameState } from '../domain/types';
import { dayOf } from '../domain/util';
import { ZONE_BY_ID, custodyRoomOfBed } from '../content/world';
import { PRESET_BY_ID } from '../content/custody';
import { decodeSave, encodeSave, type SaveEnvelope, type SaveMeta } from './saveCodec';

const DB = 'mot-ngay-moi';
const STORE = 'saves';
export type SlotId = 'auto' | 'slot1' | 'slot2' | 'slot3';
export const SLOTS: { id: SlotId; label: string }[] = [
  { id: 'auto', label: 'Tự động lưu' }, { id: 'slot1', label: 'Ô lưu 1' }, { id: 'slot2', label: 'Ô lưu 2' }, { id: 'slot3', label: 'Ô lưu 3' },
];
interface Record { id: SlotId; generations: SaveEnvelope[] } // [latest, previous]

let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') return rej(new Error('Trình duyệt không hỗ trợ IndexedDB (chế độ riêng tư?). Hãy dùng Xuất file.'));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
function tx<T>(mode: IDBTransactionMode, fn: (st: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return db().then((d) => new Promise<T | undefined>((res, rej) => {
    const t = d.transaction(STORE, mode);
    const st = t.objectStore(STORE);
    let result: T | undefined;
    const req = fn(st);
    if (req) req.onsuccess = () => { result = req.result; };
    t.oncomplete = () => res(result);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error ?? new Error('Giao dịch bị hủy (có thể hết dung lượng).'));
  }));
}

export function metaOf(s: GameState): SaveMeta {
  const room = s.custody ? custodyRoomOfBed(s.life.housing.find((h) => h.state === 'active')?.bedSlotId ?? null)?.label : undefined;
  // Metadata không nhạy cảm: mode/preset/buồng; không đưa dữ kiện sự việc vào danh sách save.
  return { name: s.character.name, day: dayOf(s.minute), minute: s.minute, zone: ZONE_BY_ID[s.player.zone]?.name ?? s.player.zone, chapter: s.chapter, lineageId: s.lineageId, generation: s.generation, ended: s.ended, mode: s.experienceMode, preset: s.custody ? PRESET_BY_ID[s.custody.presetId]?.label : undefined, room };
}

/** Capture → validate → write new generation keeping previous (≥1 valid generation after interrupted write). */
export async function saveToSlot(slot: SlotId, state: GameState): Promise<SaveEnvelope> {
  const snapshot = structuredClone(state);
  snapshot.generation = state.generation + 1;
  const env = await encodeSave(snapshot, metaOf(snapshot));
  const existing = await tx<Record>('readonly', (st) => st.get(slot));
  const prev = existing?.generations?.[0];
  await tx('readwrite', (st) => st.put({ id: slot, generations: prev ? [env, prev] : [env] } satisfies Record));
  state.generation = snapshot.generation;
  return env;
}

export async function listSlots(): Promise<{ id: SlotId; label: string; latest?: SaveEnvelope; previous?: SaveEnvelope }[]> {
  const out = [];
  for (const s of SLOTS) {
    const r = await tx<Record>('readonly', (st) => st.get(s.id)).catch(() => undefined);
    out.push({ ...s, latest: r?.generations?.[0], previous: r?.generations?.[1] });
  }
  return out;
}

/** Load latest; if corrupt try previous generation. */
export async function loadSlot(slot: SlotId, which: 0 | 1 = 0): Promise<{ state?: GameState; error?: string; usedPrevious?: boolean }> {
  const r = await tx<Record>('readonly', (st) => st.get(slot));
  const env = r?.generations?.[which];
  if (!env) return { error: 'Ô lưu trống.' };
  const d = await decodeSave(env);
  if (d.state) return { state: d.state, usedPrevious: which === 1 };
  if (which === 0 && r?.generations?.[1]) {
    const p = await decodeSave(r.generations[1]);
    if (p.state) return { state: p.state, usedPrevious: true, error: `Bản mới nhất lỗi (${d.error}); đã dùng bản trước.` };
  }
  return { error: d.error };
}

export async function deleteSlot(slot: SlotId) { await tx('readwrite', (st) => st.delete(slot)); }

export async function exportEnvelope(state: GameState): Promise<Blob> {
  const env = await encodeSave(structuredClone(state), metaOf(state));
  return new Blob([JSON.stringify(env)], { type: 'application/json' });
}
export async function importFile(file: File): Promise<{ state?: GameState; error?: string }> {
  if (file.size > 2 * 1024 * 1024) return { error: 'Tệp quá lớn.' };
  try {
    const env = JSON.parse(await file.text());
    return decodeSave(env);
  } catch {
    return { error: 'Tệp không đọc được (JSON lỗi).' };
  }
}

export async function hasAnySave(): Promise<SaveEnvelope | null> {
  const all = await listSlots().catch(() => []);
  const latest = all.map((a) => a.latest).filter(Boolean) as SaveEnvelope[];
  latest.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  return latest[0] ?? null;
}
export async function slotOfLatest(): Promise<SlotId | null> {
  const all = await listSlots().catch(() => []);
  let best: { id: SlotId; t: string } | null = null;
  for (const a of all) if (a.latest && (!best || a.latest.savedAt > best.t)) best = { id: a.id, t: a.latest.savedAt };
  return best?.id ?? null;
}
