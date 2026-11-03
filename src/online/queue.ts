// Chế độ Trực tuyến — giới hạn người chơi đồng thời toàn hệ thống + hàng đợi (đến trước vào trước).
// Kênh Presence chung `mnm:lobby`: mỗi người báo trạng thái 'playing' hoặc 'queued'. Mọi máy cùng tính một thứ tự → không cần máy chủ riêng.
// Chế độ ngoại tuyến không dùng module này (không giới hạn, không kết nối mạng).
import type { RealtimeChannel } from '@supabase/supabase-js';
import { create } from 'zustand';
import { cloud } from '../persistence/cloud';

/** Số người chơi trực tuyến đồng thời tối đa (đo tải: dự án Supabase hiện tại ổn định tới ~50). */
export const ONLINE_CAP = 50;

export interface GateMeta { id: string; state: 'playing' | 'queued'; since: number; room: string; name: string }
export interface QueueView { playing: number; waiting: number; position: number; ahead: number; admit: boolean }

/** Tính hàng đợi từ ảnh chụp Presence (thuần — giống nhau trên mọi máy). position: 1-based, 0 nếu không xếp hàng. */
export function computeQueue(all: GateMeta[], me: string, cap: number): QueueView {
  // một người có thể có 2 bản ghi trong lúc F5: lấy bản mới nhất, ưu tiên 'playing'
  const byId = new Map<string, GateMeta>();
  for (const m of all) {
    const cur = byId.get(m.id);
    if (!cur || (m.state === 'playing' && cur.state !== 'playing') || (m.state === cur.state && m.since > cur.since)) byId.set(m.id, m);
  }
  const list = [...byId.values()];
  const playing = list.filter((m) => m.state === 'playing').length;
  const queued = list.filter((m) => m.state === 'queued').sort((a, b) => a.since - b.since || a.id.localeCompare(b.id));
  const idx = queued.findIndex((m) => m.id === me);
  const free = Math.max(0, cap - playing);
  return { playing, waiting: queued.length, position: idx + 1, ahead: Math.max(0, idx), admit: idx >= 0 && idx < free };
}

export type GateStatus = 'idle' | 'checking' | 'queued' | 'admitted' | 'error';
interface GateUI {
  status: GateStatus; room: string | null; playing: number; waiting: number; position: number; ahead: number; cap: number;
  etaSec: number | null; joinedQueueAt: number | null; background: boolean; error: string | null;
  set: (p: Partial<GateUI>) => void;
}
export const useGate = create<GateUI>((set) => ({
  status: 'idle', room: null, playing: 0, waiting: 0, position: 0, ahead: 0, cap: ONLINE_CAP, etaSec: null, joinedQueueAt: null, background: false, error: null,
  set: (p) => set(p),
}));

const SINCE_KEY = 'mnm.queueSince';
const QROOM_KEY = 'mnm.queueRoom';
const ss = () => { try { return sessionStorage; } catch { return null; } };

class Gate {
  private ch: RealtimeChannel | null = null;
  private meta: GateMeta | null = null;
  private waiters: ((ok: boolean) => void)[] = [];
  /** Thời điểm những người phía trước được vào (để ước tính thời gian chờ). */
  private admits: number[] = [];
  private lastQueued = new Set<string>();
  cap = ONLINE_CAP;
  constructor() {
    // kiểm thử: localStorage 'mnm.debugGate' = {"cap":1,"lobby":"mnm:lobby-e2e"} — chỉ được GIẢM giới hạn, không vượt ONLINE_CAP
    try {
      const d = JSON.parse(localStorage.getItem('mnm.debugGate') ?? 'null') as { cap?: number; lobby?: string } | null;
      if (d?.cap && d.cap > 0) this.cap = Math.min(ONLINE_CAP, Math.floor(d.cap));
      if (d?.lobby && /^mnm:lobby-[a-z0-9-]{1,40}$/.test(d.lobby)) this.lobby = d.lobby;
    } catch { /* ignore */ }
  }
  /** Tên kênh sảnh (script kiểm thử dùng kênh riêng để không ảnh hưởng người chơi thật). */
  lobby = 'mnm:lobby';
  /** Phòng đang xếp hàng của tab (F5 giữ chỗ). */
  savedQueueRoom(): string | null { try { return ss()?.getItem(QROOM_KEY) ?? null; } catch { return null; } }

  /** Theo dõi số người (không xếp hàng) — cho màn sảnh hiển thị “đang trực tuyến 32/50”. */
  async watch() {
    await this.ensure();
  }

  /** Xin vào: trả true khi được vào; false nếu bị hủy/lỗi. priority = đang chơi trước F5 (giữ chỗ). */
  async request(room: string, name: string, id: string, priority = false): Promise<boolean> {
    // đã có chỗ / đang xếp hàng cho cùng phòng: không xếp lại từ đầu
    if (this.meta && this.meta.room === room && this.meta.state === 'playing') return true;
    if (this.meta && this.meta.room === room && this.meta.state === 'queued') return new Promise<boolean>((resolve) => { this.waiters.push(resolve); this.evaluate(); });
    const ok = await this.ensure();
    if (!ok) { useGate.getState().set({ status: 'error', error: 'Không kết nối được máy chủ trực tuyến.' }); return false; }
    let since = Date.now();
    try { const s = Number(ss()?.getItem(SINCE_KEY)); if (s > 0 && Date.now() - s < 30 * 60000) since = s; else ss()?.setItem(SINCE_KEY, String(since)); } catch { /* ignore */ }
    this.meta = { id, state: priority ? 'playing' : 'queued', since, room, name };
    useGate.getState().set({ status: priority ? 'admitted' : 'checking', room, joinedQueueAt: since, error: null });
    if (!priority) { try { ss()?.setItem(QROOM_KEY, room); } catch { /* ignore */ } }
    await this.ch!.track(this.meta);
    if (priority) return true;
    return new Promise<boolean>((resolve) => { this.waiters.push(resolve); this.evaluate(); });
  }

  /** Rời hàng đợi hoặc nhường chỗ khi rời phòng. */
  async release() {
    try { ss()?.removeItem(SINCE_KEY); ss()?.removeItem(QROOM_KEY); } catch { /* ignore */ }
    const w = this.waiters; this.waiters = [];
    w.forEach((r) => r(false));
    this.meta = null;
    useGate.getState().set({ status: 'idle', room: null, position: 0, ahead: 0, background: false, etaSec: null, joinedQueueAt: null });
    if (this.ch) { try { await this.ch.untrack(); } catch { /* ignore */ } }
  }
  /** Ngắt hẳn kênh sảnh (khi về menu). */
  async close() {
    await this.release();
    const ch = this.ch; this.ch = null;
    if (ch) { try { await (await cloud.sb()).removeChannel(ch); } catch { /* ignore */ } }
  }

  private async ensure(): Promise<boolean> {
    if (this.ch) return true;
    if (!cloud.configured()) return false;
    try {
      const client = await cloud.sb();
      const ch = client.channel(this.lobby, { config: { presence: { key: `g_${Math.random().toString(36).slice(2, 10)}` } } });
      ch.on('presence', { event: 'sync' }, () => this.evaluate());
      const ok = await new Promise<boolean>((res) => { const t = setTimeout(() => res(false), 12000); ch.subscribe((st) => { if (st === 'SUBSCRIBED') { clearTimeout(t); res(true); } else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') { clearTimeout(t); res(false); } }); });
      if (!ok) { try { await client.removeChannel(ch); } catch { /* ignore */ } return false; }
      this.ch = ch;
      // trạng thái người chơi phải được track lại nếu kênh nối lại
      if (this.meta) await ch.track(this.meta);
      return true;
    } catch { return false; }
  }

  private snapshot(): GateMeta[] {
    const st = (this.ch?.presenceState() ?? {}) as Record<string, GateMeta[]>;
    return Object.values(st).flat().filter((m) => m && typeof m.id === 'string' && (m.state === 'playing' || m.state === 'queued') && Number.isFinite(m.since));
  }

  private evaluate() {
    const all = this.snapshot();
    const me = this.meta?.id ?? '';
    const q = computeQueue(all, me, this.cap);
    // đo tốc độ hàng đợi: ai rời trạng thái 'queued' sang 'playing'
    const nowQueued = new Set(all.filter((m) => m.state === 'queued').map((m) => m.id));
    const nowPlaying = new Set(all.filter((m) => m.state === 'playing').map((m) => m.id));
    for (const id of this.lastQueued) if (!nowQueued.has(id) && nowPlaying.has(id) && id !== me) this.admits.push(Date.now());
    this.lastQueued = nowQueued;
    this.admits = this.admits.filter((t) => Date.now() - t < 10 * 60000);
    const rate = this.admits.length >= 2 ? this.admits.length / ((Date.now() - this.admits[0]) / 1000) : null; // người/giây
    const etaSec = q.position > 0 && rate && rate > 0 ? Math.round((q.ahead + 1) / rate) : null;
    const ui = useGate.getState();
    ui.set({ playing: q.playing, waiting: q.waiting, position: q.position, ahead: q.ahead, cap: this.cap, etaSec });
    if (!this.meta) return;
    if (this.meta.state === 'queued') {
      if (q.admit) void this.admitMe();
      else if (ui.status !== 'queued') ui.set({ status: 'queued' });
    }
  }
  private async admitMe() {
    if (!this.meta || this.meta.state === 'playing') return;
    this.meta = { ...this.meta, state: 'playing' };
    await this.ch?.track(this.meta);
    try { ss()?.removeItem(SINCE_KEY); ss()?.removeItem(QROOM_KEY); } catch { /* ignore */ }
    useGate.getState().set({ status: 'admitted' });
    const w = this.waiters; this.waiters = [];
    w.forEach((r) => r(true));
  }
}

export const gate = new Gate();
if (typeof window !== 'undefined') (window as unknown as { __mnmGate: Gate; __mnmGateUI: typeof useGate }).__mnmGate = gate;
if (typeof window !== 'undefined') (window as unknown as { __mnmGateUI: typeof useGate }).__mnmGateUI = useGate;
