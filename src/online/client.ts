// Chế độ Trực tuyến — kết nối Supabase Realtime (Presence: ai đang ở phòng; Broadcast: vị trí + trò chuyện).
// Không ghi save, không đồng bộ NPC/thế giới: mỗi máy vẫn tự giả lập như chế độ ngoại tuyến.
import type { RealtimeChannel } from '@supabase/supabase-js';
import { create } from 'zustand';
import { cloud } from '../persistence/cloud';
import { useGate } from './queue';
import type { Appearance } from '../domain/types';
import {
  areaOf, BUBBLE_MS, MAX_PLAYERS_PER_ROOM, PEER_TIMEOUT_MS, posHzFor, PROTOCOL_VERSION, RateLimiter, ROOMS, sanitize, sanitizeName, sessionPeerId, shouldReceive,
  validBotPos, validChat, validMeta, validPos, validRoster, type ChatLine, type ChatPacket, type ChatScope, type PeerMeta, type PosPacket,
} from './protocol';

export type OnlineStatus = 'off' | 'connecting' | 'online' | 'reconnecting' | 'error' | 'full';
export interface PeerView { id: string; name: string; zone: string; dist: number | null; blocked: boolean; elsewhere: boolean }

interface OnlineUI {
  status: OnlineStatus; room: string | null; error: string | null;
  peers: PeerView[]; lines: ChatLine[]; unread: number;
  chatOpen: boolean; typing: boolean; scope: ChatScope; whisperTo: string | null; notice: string | null;
  set: (p: Partial<OnlineUI>) => void;
}
export const useOnline = create<OnlineUI>((set) => ({
  status: 'off', room: null, error: null, peers: [], lines: [], unread: 0, chatOpen: false, typing: false, scope: 'room', whisperTo: null, notice: null,
  set: (p) => set(p),
}));

/** Trạng thái một người chơi khác (dùng cho dựng hình). */
export interface Peer {
  meta: PeerMeta;
  pos: { x: number; z: number; yaw: number } | null;
  target: { x: number; z: number; yaw: number } | null;
  zone: string; pose: string; lastSeen: number;
  bubble: { text: string; until: number } | null;
  /** Bạn tù do AI vận hành (chỉ dùng nội bộ — UI không phân biệt). */
  bot?: boolean;
}

const ROOM_KEY = 'mnm.onlineRoom';
const LINES_KEY = 'mnm.onlineLines';
const ss = () => { try { return typeof sessionStorage !== 'undefined' ? sessionStorage : null; } catch { return null; } };

class OnlineClient {
  /** Phòng đang tham gia của tab này (để F5 vào lại đúng phòng). */
  savedRoom(): string | null { try { return ss()?.getItem(ROOM_KEY) ?? null; } catch { return null; } }
  private saveLines() { try { ss()?.setItem(LINES_KEY, JSON.stringify(useOnline.getState().lines.slice(-60))); } catch { /* quota */ } }

  readonly id = sessionPeerId(typeof sessionStorage !== 'undefined' ? sessionStorage : null);
  peers = new Map<string, Peer>();
  private ch: RealtimeChannel | null = null;
  /** Kênh vị trí của khu vực hiện tại (giảm số lượt nhận theo bình phương số người). */
  private posCh: RealtimeChannel | null = null;
  private area = -1;
  private areaSwitching = false;
  private meta: PeerMeta | null = null;
  private limiter = new RateLimiter();
  private blocked = new Set<string>(JSON.parse(localStorage.getItem('mnm.blocked') ?? '[]') as string[]);
  private lastSent = 0;
  private lastSig = '';
  private me = { x: 0, z: 0, zone: 'L01' };
  private seen = new Set<string>();
  /** Bong bóng lời của chính mình (hiện trên đầu nhân vật). */
  myBubble: { text: string; until: number } | null = null;
  private peerUpdate = 0;

  configured() { return cloud.configured(); }
  get active() { const s = useOnline.getState().status; return s === 'online' || s === 'reconnecting' || s === 'connecting'; }

  async connect(roomId: string, name: string, look: Appearance, outfit: number) {
    if (!this.configured()) { useOnline.getState().set({ status: 'error', error: 'Chế độ trực tuyến chưa được bật cho bản cài đặt này.' }); return false; }
    await this.disconnect(true);
    const ui = useOnline.getState();
    // F5 vào lại cùng phòng: giữ lịch sử trò chuyện của tab
    let keep: ChatLine[] = [];
    try { if (this.savedRoom() === roomId) keep = JSON.parse(ss()?.getItem(LINES_KEY) ?? '[]') as ChatLine[]; } catch { keep = []; }
    ui.set({ status: 'connecting', room: roomId, error: null, lines: Array.isArray(keep) ? keep : [], unread: 0, peers: [] });
    this.meta = { v: PROTOCOL_VERSION, id: this.id, name: sanitizeName(name), look, outfit, joinedAt: Date.now() };
    try {
      const client = await cloud.sb();
      const ch = client.channel(`mnm:${roomId}`, { config: { presence: { key: this.id }, broadcast: { self: false, ack: false } } });
      this.ch = ch;
      ch.on('presence', { event: 'sync' }, () => this.onSync())
        .on('presence', { event: 'join' }, ({ key, newPresences }) => this.onJoin(key, newPresences as unknown[]))
        .on('presence', { event: 'leave' }, ({ key }) => this.onLeave(key))
        .on('broadcast', { event: 'chat' }, ({ payload }) => this.onChat(payload))
        .on('broadcast', { event: 'bots' }, ({ payload }) => this.onRoster(payload))
        .on('broadcast', { event: 'bpos' }, ({ payload }) => this.onBotPos(payload));
      const ok = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), 12000);
        ch.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            clearTimeout(timer);
            await ch.track(this.meta!);
            useOnline.getState().set({ status: 'online' });
            try { ss()?.setItem(ROOM_KEY, roomId); } catch { /* ignore */ }
            this.system(`Đã vào ${ROOMS.find((r) => r.id === roomId)?.name ?? roomId} · trò chuyện lịch sự nhé.`);
            resolve(true);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            if (useOnline.getState().status === 'online') useOnline.getState().set({ status: 'reconnecting' });
            else { clearTimeout(timer); resolve(false); }
          } else if (status === 'CLOSED' && useOnline.getState().status !== 'off') {
            useOnline.getState().set({ status: 'reconnecting' });
          }
        });
      });
      if (!ok) { await this.disconnect(true); useOnline.getState().set({ status: 'error', error: 'Không kết nối được máy chủ. Kiểm tra mạng và thử lại.' }); return false; }
      return true;
    } catch (e) {
      useOnline.getState().set({ status: 'error', error: (e as Error).message });
      return false;
    }
  }

  async disconnect(silent = false) {
    const ch = this.ch;
    this.ch = null;
    const pch = this.posCh;
    this.posCh = null; this.area = -1;
    if (pch) { try { await (await cloud.sb()).removeChannel(pch); } catch { /* ignore */ } }
    this.peers.clear(); this.seen.clear();
    if (ch) { try { await ch.untrack(); } catch { /* ignore */ } try { await (await cloud.sb()).removeChannel(ch); } catch { /* ignore */ } }
    if (!silent) { try { ss()?.removeItem(ROOM_KEY); ss()?.removeItem(LINES_KEY); } catch { /* ignore */ } }
    if (!silent) useOnline.getState().set({ status: 'off', room: null, peers: [], chatOpen: false, typing: false, whisperTo: null });
  }

  // ---------- presence ----------
  private onSync() {
    if (!this.ch) return;
    const st = this.ch.presenceState() as Record<string, unknown[]>;
    const keys = Object.keys(st);
    // phòng đầy: người vào sau cùng tự rời
    if (keys.length > MAX_PLAYERS_PER_ROOM) {
      const metas = keys.map((k) => st[k][0] as PeerMeta).filter(validMeta).sort((a, b) => a.joinedAt - b.joinedAt);
      if (metas.slice(MAX_PLAYERS_PER_ROOM).some((m) => m.id === this.id)) { void this.disconnect(true).then(() => useOnline.getState().set({ status: 'full', error: 'Phòng đã đủ người. Hãy chọn phân khu khác.' })); return; }
    }
    for (const k of keys) { if (k === this.id) continue; const m = st[k][0]; if (validMeta(m)) this.upsert(m); }
    for (const [id, p] of [...this.peers]) if (!p.bot && !keys.includes(id)) this.peers.delete(id);
    this.publishPeers();
  }
  private onJoin(key: string, list: unknown[]) {
    if (key === this.id) return;
    const m = list[0];
    if (!validMeta(m)) return;
    this.upsert(m);
    if (!this.seen.has(key)) { this.seen.add(key); this.system(`${sanitizeName(m.name)} vừa vào phòng.`); }
    this.publishPeers();
    // gửi lại vị trí để người mới thấy mình ngay
    this.lastSig = '';
  }
  private onLeave(key: string) {
    const p = this.peers.get(key);
    if (!p) return;
    // F5: kết nối cũ rời sau khi kết nối mới (cùng mã) đã vào → vẫn còn trong phòng
    const still = (this.ch?.presenceState() as Record<string, unknown[]> | undefined)?.[key];
    if (still && still.length) return;
    this.peers.delete(key); this.seen.delete(key);
    this.system(`${p.meta.name} đã rời phòng.`);
    this.publishPeers();
  }
  private upsert(m: PeerMeta) {
    const p = this.peers.get(m.id);
    if (p) {
      // Presence có thể tới muộn hơn gói vị trí (khác kênh): thiếu thông tin khu thì giữ khu đã biết
      const area = m.area ?? p.meta.area;
      const moved = area !== p.meta.area;
      p.meta = { ...m, area, name: sanitizeName(m.name) };
      if (moved && !this.sameArea(p)) { p.pos = null; p.target = null; }
      if (moved && this.sameArea(p)) this.lastSig = '';
      return;
    }
    this.peers.set(m.id, { meta: { ...m, name: sanitizeName(m.name) }, pos: null, target: null, zone: '', pose: 'idle', lastSeen: performance.now(), bubble: null });
  }

  // ---------- vị trí ----------
  private onPos(raw: unknown) {
    if (!validPos(raw)) return;
    const p = this.peers.get(raw.id);
    if (!p) return;
    p.meta.area = this.area; // nhận trên kênh khu của mình ⇒ đang cùng khu
    p.target = { x: raw.x, z: raw.z, yaw: raw.yaw };
    if (!p.pos) p.pos = { ...p.target };
    p.zone = raw.zone; p.pose = raw.pose; p.lastSeen = performance.now();
  }
  /** Gọi mỗi khung từ controller; tự giới hạn POS_HZ và chỉ gửi khi có thay đổi (heartbeat 3 s). */
  /** Người cùng khu vực (để tính tần số gửi và quyết định hiển thị). */
  sameArea(p: Peer) { return (p.meta.area ?? -2) === this.area; }
  private async switchArea(area: number) {
    if (this.areaSwitching || !this.ch || !this.meta) return;
    this.areaSwitching = true;
    try {
      const client = await cloud.sb();
      if (this.posCh) { const old = this.posCh; this.posCh = null; await client.removeChannel(old); }
      const room = useOnline.getState().room;
      const pch = client.channel(`mnm:${room}:a${area}`, { config: { broadcast: { self: false, ack: false } } });
      pch.on('broadcast', { event: 'pos' }, ({ payload }) => this.onPos(payload));
      await new Promise<void>((res) => { const t = setTimeout(res, 8000); pch.subscribe((st) => { if (st === 'SUBSCRIBED') { clearTimeout(t); res(); } }); });
      this.posCh = pch;
      this.area = area;
      this.meta = { ...this.meta, area };
      await this.ch.track(this.meta); // presence báo khu vực mới (hiếm, rẻ)
      this.lastSig = '';
      // người khác khu: bỏ vị trí cũ để không hiện avatar đứng yên sai chỗ
      for (const p of this.peers.values()) if (!this.sameArea(p)) { p.pos = null; p.target = null; }
    } finally { this.areaSwitching = false; }
  }
  tick(now: number, me: { x: number; z: number; yaw: number; zone: string; pose: string }) {
    this.me = { x: me.x, z: me.z, zone: me.zone };
    if (!this.ch || useOnline.getState().status !== 'online') return;
    const want = areaOf(me.x, this.area < 0 ? undefined : this.area);
    if (want !== this.area) { void this.switchArea(want); return; }
    if (!this.posCh) return;
    const counts: number[] = new Array(5).fill(0);
    counts[this.area] = 1;
    for (const p of this.peers.values()) if (p.meta.area !== undefined && p.meta.area >= 0 && p.meta.area < 5) counts[p.meta.area]++;
    if (now - this.lastSent >= 1000 / posHzFor(counts, useGate.getState().playing)) {
      const pkt: PosPacket = { id: this.id, x: Math.round(me.x * 100) / 100, z: Math.round(me.z * 100) / 100, yaw: Math.round(me.yaw * 100) / 100, zone: me.zone, pose: me.pose, t: Date.now() };
      const sig = `${pkt.x}|${pkt.z}|${pkt.yaw}|${pkt.pose}`;
      if (sig !== this.lastSig || now - this.lastSent > 3000) {
        this.lastSig = sig; this.lastSent = now;
        void this.posCh.send({ type: 'broadcast', event: 'pos', payload: pkt });
      }
    }
    // vị trí quá cũ (mất gói) → ẩn avatar; danh sách người chơi do Presence quyết định
    for (const p of this.peers.values()) if (p.pos && now - p.lastSeen > PEER_TIMEOUT_MS) { p.pos = null; p.target = null; }
    if (now - this.peerUpdate > 1000) { this.peerUpdate = now; this.publishPeers(); }
  }

  // ---------- trò chuyện ----------
  send(rawText: string, scope: ChatScope, to?: string | null): { ok: boolean; message?: string } {
    if (!this.ch || useOnline.getState().status !== 'online') return { ok: false, message: 'Chưa kết nối.' };
    const text = sanitize(rawText);
    if (!text) return { ok: false };
    if (scope === 'whisper' && (!to || !this.peers.has(to))) return { ok: false, message: 'Người nhận không còn trong phòng.' };
    const rl = this.limiter.check(Date.now());
    if (!rl.ok) return { ok: false, message: `Gửi chậm lại một chút (${Math.ceil(rl.waitMs / 1000)} giây).` };
    const pkt: ChatPacket = { id: this.id, mid: `${this.id}_${Date.now().toString(36)}`, from: this.id, name: this.meta?.name ?? 'Tôi', text, scope, to: scope === 'whisper' ? to ?? undefined : undefined, x: this.me.x, z: this.me.z, t: Date.now() };
    void this.ch.send({ type: 'broadcast', event: 'chat', payload: pkt });
    this.chatTap?.(pkt); // máy chủ trì: Realtime không trả tin về người gửi → bạn tù vẫn nghe được người chơi trên máy này
    this.push({ mid: pkt.mid, from: this.id, name: 'Bạn', text, scope, to: pkt.to, t: pkt.t, mine: true });
    if (scope !== 'whisper') this.myBubble = { text, until: performance.now() + BUBBLE_MS };
    return { ok: true };
  }
  private onChat(raw: unknown) {
    if (!validChat(raw)) return;
    this.chatTap?.(raw); // máy chủ trì: bạn tù nghe mọi tin (trước bộ lọc hiển thị)
    if (!shouldReceive(raw, { id: this.id, x: this.me.x, z: this.me.z }, this.blocked)) return;
    const text = sanitize(raw.text); // lọc lại phía người nhận
    if (!text) return;
    const peer = this.peers.get(raw.from);
    const name = peer?.meta.name ?? sanitizeName(raw.name);
    this.push({ mid: raw.mid, from: raw.from, name, text, scope: raw.scope, to: raw.to, t: Date.now(), mine: false });
    if (peer && raw.scope !== 'whisper') peer.bubble = { text, until: performance.now() + BUBBLE_MS };
    const ui = useOnline.getState();
    if (!ui.chatOpen) ui.set({ unread: ui.unread + 1 });
  }
  // ---------- bạn tù (máy chủ trì phát; mọi máy hiển thị như người chơi) ----------
  /** Máy chủ trì nghe mọi tin chat để bạn tù trả lời. */
  chatTap: ((p: ChatPacket) => void) | null = null;
  /** Người chơi thật trong phòng (để bầu máy chủ trì và cho bạn tù tiếp cận). */
  realPeers(): Peer[] { return [...this.peers.values()].filter((p) => !p.bot); }
  /** Máy chủ trì = mã nhỏ nhất trong số người chơi thật đang ở phòng (mọi máy tính giống nhau). */
  isBotHost(): boolean {
    if (useOnline.getState().status !== 'online') return false;
    return this.realPeers().every((p) => p.meta.id > this.id);
  }
  private onRoster(raw: unknown) {
    if (!validRoster(raw)) return;
    const now = performance.now();
    for (const m of raw.bots) {
      const p = this.peers.get(m.id);
      if (p) { p.meta = { ...m, area: p.meta.area }; p.bot = true; p.lastSeen = now; }
      else this.peers.set(m.id, { meta: { ...m, name: sanitizeName(m.name) }, pos: null, target: null, zone: '', pose: 'idle', lastSeen: now, bubble: null, bot: true });
    }
    const ids = new Set(raw.bots.map((b) => b.id));
    for (const [id, p] of [...this.peers]) if (p.bot && !ids.has(id)) this.peers.delete(id);
    this.publishPeers();
  }
  private onBotPos(raw: unknown) {
    if (!validBotPos(raw)) return;
    const now = performance.now();
    for (const b of raw.bots) {
      const p = this.peers.get(b.id);
      if (!p || !p.bot) continue;
      p.meta.area = areaOf(b.x, p.meta.area);
      p.target = { x: b.x, z: b.z, yaw: b.yaw };
      if (!p.pos) p.pos = { ...p.target };
      p.zone = b.zone; p.pose = b.pose; p.lastSeen = now;
    }
  }
  /** Máy chủ trì: phát danh sách / vị trí bạn tù. */
  broadcastBots(event: 'bots' | 'bpos', payload: unknown) {
    if (!this.ch || useOnline.getState().status !== 'online') return;
    void this.ch.send({ type: 'broadcast', event, payload });
    if (event === 'bots') this.onRoster(payload); else this.onBotPos(payload); // máy chủ trì cũng thấy bạn tù
  }
  /** Máy chủ trì: bạn tù gửi tin (mọi máy nhận như tin của người chơi; máy chủ trì cũng tự hiển thị). */
  sendAsBot(botId: string, name: string, text: string, scope: ChatScope, pos: { x: number; z: number }, to?: string) {
    if (!this.ch || useOnline.getState().status !== 'online') return;
    const clean = sanitize(text);
    if (!clean) return;
    const pkt: ChatPacket = { id: botId, mid: `${botId}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, from: botId, name, text: clean, scope, to, x: pos.x, z: pos.z, t: Date.now() };
    void this.ch.send({ type: 'broadcast', event: 'chat', payload: pkt });
    this.onChat({ ...pkt }); // broadcast self:false → tự xử lý như người nhận
  }

  private push(line: ChatLine) {
    const ui = useOnline.getState();
    if (ui.lines.some((l) => l.mid === line.mid)) return;
    ui.set({ lines: [...ui.lines.slice(-99), line] });
    this.saveLines();
  }
  private system(text: string) { this.push({ mid: `sys_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, from: 'system', name: '', text, scope: 'room', t: Date.now(), mine: false, system: true }); }

  // ---------- an toàn ----------
  isBlocked(id: string) { return this.blocked.has(id); }
  block(id: string, on: boolean) {
    if (on) this.blocked.add(id); else this.blocked.delete(id);
    try { localStorage.setItem('mnm.blocked', JSON.stringify([...this.blocked].slice(-200))); } catch { /* ignore */ }
    if (on) { const ui = useOnline.getState(); ui.set({ lines: ui.lines.filter((l) => l.from !== id), whisperTo: ui.whisperTo === id ? null : ui.whisperTo }); const p = this.peers.get(id); if (p) p.bubble = null; }
    this.publishPeers();
  }
  async report(id: string, reason: string): Promise<{ ok: boolean; message: string }> {
    const p = this.peers.get(id);
    const room = useOnline.getState().room;
    const recent = useOnline.getState().lines.filter((l) => l.from === id).slice(-5).map((l) => l.text);
    try {
      const client = await cloud.sb();
      const { error } = await client.from('chat_reports').insert({ room, reported_peer: id, reported_name: p?.meta.name ?? '', reason: reason.slice(0, 200), excerpt: recent.join(' | ').slice(0, 800), reporter_peer: this.id });
      if (error) throw error;
      return { ok: true, message: 'Đã gửi báo cáo. Cảm ơn bạn.' };
    } catch {
      return { ok: false, message: 'Chưa gửi được báo cáo lên máy chủ. Bạn có thể chặn người này ngay.' };
    }
  }

  private publishPeers() {
    const list: PeerView[] = [...this.peers.values()].map((p) => ({
      id: p.meta.id, name: p.meta.name, zone: p.zone, blocked: this.blocked.has(p.meta.id), elsewhere: !this.sameArea(p),
      dist: p.pos ? Math.round(Math.hypot(p.pos.x - this.me.x, p.pos.z - this.me.z)) : null,
    })).sort((a, b) => (a.dist ?? 999) - (b.dist ?? 999));
    const ui = useOnline.getState();
    const prev = ui.peers;
    if (prev.length === list.length && prev.every((p, i) => p.id === list[i].id && p.dist === list[i].dist && p.zone === list[i].zone && p.blocked === list[i].blocked && p.name === list[i].name && p.elsewhere === list[i].elsewhere)) return;
    ui.set({ peers: list });
  }
}

export const online = new OnlineClient();

// Gỡ lỗi/kiểm thử E2E (như window.__mnm)
if (typeof window !== 'undefined') (window as unknown as { __mnmOnline: OnlineClient }).__mnmOnline = online;
if (typeof window !== 'undefined') (window as unknown as { __mnmOnlineUI: typeof useOnline }).__mnmOnlineUI = useOnline;
