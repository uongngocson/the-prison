// Chế độ Trực tuyến — giao thức (thuần TS, không phụ thuộc Supabase để test được).
// Chỉ người chơi đồng bộ real-time (vị trí + trò chuyện). NPC và thế giới vẫn giả lập cục bộ trên từng máy.
import type { Appearance } from '../domain/types';

export const PROTOCOL_VERSION = 1;
/** Mỗi phân khu tối đa 100 người; 5 phân khu × 100 = 500 = trần trực tuyến (ONLINE_CAP_MAX). */
export const MAX_PLAYERS_PER_ROOM = 100;
export const POS_HZ = 8;
/** Ngân sách lượt nhận vị trí mỗi giây cho một kênh khu vực. Đo thực tế: dự án chịu ~500–550 lượt nhận/giây (mỗi tin × số người nhận). */
export const AREA_DELIVERY_BUDGET = 300;
/** Ngân sách tin gửi mỗi giây cho cả phòng. */
export const ROOM_SEND_BUDGET = 80;
export const MIN_POS_HZ = 0.2;
/** Ngân sách toàn dự án (mọi phân khu cộng lại) — mức đo tải ổn định ~500 lượt nhận/giây. Mỗi phòng được phần theo tỉ lệ số người. */
export const GLOBAL_DELIVERY_BUDGET = 500;
export const GLOBAL_SEND_BUDGET = 250;
/** Tần số gửi vị trí cho cả phòng, từ số người ở từng khu vực (biết qua Presence):
 *  Σ nₐ·hz·(nₐ−1) ≤ ngân sách lượt nhận, Σ nₐ·hz ≤ ngân sách gửi, trong khoảng 0,33–8 Hz. */
export function posHzFor(areaCounts: number[], globalPlaying = 0): number {
  const pairs = areaCounts.reduce((a, n) => a + n * Math.max(0, n - 1), 0);
  const total = areaCounts.reduce((a, n) => a + n, 0);
  if (pairs === 0) return POS_HZ;
  // đông người toàn hệ thống: phòng này chỉ dùng phần ngân sách tương ứng tỉ lệ người của nó
  const share = globalPlaying > total ? total / globalPlaying : 1;
  const delivery = Math.min(AREA_DELIVERY_BUDGET, GLOBAL_DELIVERY_BUDGET * share);
  const send = Math.min(ROOM_SEND_BUDGET, GLOBAL_SEND_BUDGET * share);
  return Math.max(MIN_POS_HZ, Math.min(POS_HZ, delivery / pairs, send / Math.max(1, total)));
}
/** Một khu duy nhất có n người (tiện cho test). */
export const posHz = (players: number) => posHzFor([players]);
/** Khu vực (dải 44 m theo trục x, x −101…119): chỉ đồng bộ vị trí trong cùng khu vực — người ở xa vốn đã bị ẩn. */
export const AREA_COUNT = 5;
export function areaOf(x: number, current?: number): number {
  const raw = (x + 101) / 44;
  if (current !== undefined && raw > current - 0.07 && raw < current + 1.07) return current; // ~3 m trễ để không đổi kênh liên tục ở ranh giới
  return Math.max(0, Math.min(AREA_COUNT - 1, Math.floor(raw)));
}
export const NEAR_RADIUS = 12;
export const MSG_MAX = 160;
export const BUBBLE_MS = 6000;
export const PEER_TIMEOUT_MS = 15000;

export interface RoomDef { id: string; name: string; desc: string }
export const ROOMS: RoomDef[] = [
  { id: 'an-binh-1', name: 'Phân khu 1', desc: 'Phòng chung — đông người chơi' },
  { id: 'an-binh-2', name: 'Phân khu 2', desc: 'Phòng chung' },
  { id: 'an-binh-3', name: 'Phân khu 3', desc: 'Phòng yên tĩnh' },
  { id: 'an-binh-4', name: 'Phân khu 4', desc: 'Phòng chung' },
  { id: 'an-binh-5', name: 'Phân khu 5', desc: 'Phòng chung' },
];

export type ChatScope = 'room' | 'near' | 'whisper';
export const SCOPE_LABEL: Record<ChatScope, string> = { room: 'Cả phòng', near: 'Gần đây', whisper: 'Riêng' };

/** Dữ liệu presence (công khai cho cả phòng) — không có dữ liệu cá nhân thật. */
export interface PeerMeta { v: number; id: string; name: string; look: Appearance; outfit: number; joinedAt: number; area?: number }
/** Gói vị trí (broadcast 'pos'). Toạ độ làm tròn 2 chữ số để gói nhỏ. */
export interface PosPacket { id: string; x: number; z: number; yaw: number; zone: string; pose: string; t: number }
/** Gói chat (broadcast 'chat'). Người nhận tự lọc theo scope/khoảng cách/to. */
export interface ChatPacket { id: string; mid: string; from: string; name: string; text: string; scope: ChatScope; to?: string; x: number; z: number; t: number }

/** Danh sách bạn tù do máy chủ trì phát (mỗi ~4 s). */
export interface BotRoster { host: string; bots: PeerMeta[]; t: number }
/** Vị trí bạn tù (gộp một gói cho mọi bạn tù trong phòng, ~2 Hz). */
export interface BotPosBatch { host: string; t: number; bots: { id: string; x: number; z: number; yaw: number; zone: string; pose: string }[] }
export function validRoster(p: unknown): p is BotRoster { const o = p as BotRoster; return !!o && typeof o.host === 'string' && Array.isArray(o.bots) && o.bots.length <= 20 && o.bots.every(validMeta); }
export function validBotPos(p: unknown): p is BotPosBatch { const o = p as BotPosBatch; return !!o && typeof o.host === 'string' && Array.isArray(o.bots) && o.bots.length <= 20 && o.bots.every((b) => validPos({ ...b, t: 0 })); }

// ---------- Xung đột trực tuyến ----------
export type FightK = 'start' | 'strike' | 'break_away' | 'leave' | 'calm' | 'call' | 'busy';
/** Lựa chọn trong một vụ xung đột giữa hai người chơi (broadcast 'fight', người nhận lọc theo `to`). */
export interface FightPacket { from: string; to: string; cid: string; k: FightK; at: number; x: number; z: number; reason?: string }
/** Một nhân vật phụ trong cảnh xung đột (đối thủ NPC, cán bộ) để người xem dựng lại. */
export interface SceneActor { id: string; name?: string; look: Appearance; outfit: 'res' | 'staff'; x: number; z: number; yaw: number; pose: string }
/** Cảnh xung đột của một người chơi (broadcast 'scene' ~4 Hz khi đang có xung đột; end = kết thúc). */
export interface ScenePacket { from: string; cid: string; zone: string; phase: string; alarm: boolean; x: number; z: number; actors: SceneActor[]; end?: boolean; t: number }
const FIGHT_K: FightK[] = ['start', 'strike', 'break_away', 'leave', 'calm', 'call', 'busy'];
const num = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 500;
export function validFight(p: unknown): p is FightPacket {
  const o = p as FightPacket;
  return !!o && typeof o.from === 'string' && o.from.length < 64 && typeof o.to === 'string' && o.to.length < 64 && typeof o.cid === 'string' && o.cid.length < 64
    && FIGHT_K.includes(o.k) && typeof o.at === 'number' && Number.isFinite(o.at) && num(o.x) && num(o.z) && (o.reason === undefined || (typeof o.reason === 'string' && o.reason.length < 120));
}
export function validScene(p: unknown): p is ScenePacket {
  const o = p as ScenePacket;
  return !!o && typeof o.from === 'string' && o.from.length < 64 && typeof o.cid === 'string' && o.cid.length < 64 && typeof o.zone === 'string' && o.zone.length < 8
    && typeof o.phase === 'string' && o.phase.length < 16 && typeof o.alarm === 'boolean' && num(o.x) && num(o.z) && Array.isArray(o.actors) && o.actors.length <= 6
    && o.actors.every((a) => !!a && typeof a.id === 'string' && a.id.length < 40 && !!a.look && typeof a.look.body === 'string' && (a.outfit === 'res' || a.outfit === 'staff') && num(a.x) && num(a.z) && num(a.yaw) && typeof a.pose === 'string' && a.pose.length < 16 && (a.name === undefined || (typeof a.name === 'string' && a.name.length <= 40)));
}
/** Tối đa số lần bị gây sự bởi cùng một người trong 1 phút (chống quấy rối). */
export const FIGHT_COOLDOWN_MS = 60_000;

export interface ChatLine { mid: string; from: string; name: string; text: string; scope: ChatScope; to?: string; t: number; mine: boolean; system?: boolean }

// ---------- Lọc nội dung ----------
// Chỉ các từ rõ ràng; bỏ dạng không dấu dễ trùng từ thường (lon, buoi, cac, deo, ngu…).
const BAD = ['đm', 'dm', 'dcm', 'đcm', 'vcl', 'vkl', 'clm', 'địt', 'dit me', 'đéo', 'lồn', 'buồi', 'cặc', 'đĩ', 'fuck', 'shit', 'bitch', 'óc chó', 'oc cho', 'chó má'];
const BAD_RE = new RegExp(`(^|[^\\p{L}\\p{N}])(${BAD.map((w) => w.replace(/\s+/g, '\\s+')).join('|')})(?=$|[^\\p{L}\\p{N}])`, 'giu');
const PHONE_RE = /(\+?\d[\d\s.-]{7,}\d)/g;
const URL_RE = /\b((https?:\/\/|www\.)\S+|\S+\.(com|vn|net|org|io|me|xyz)(\/\S*)?)\b/gi;
const EMAIL_RE = /\S+@\S+\.\S+/g;

/** Chuẩn hoá + che từ tục, số điện thoại, liên kết, email. Trả '' nếu rỗng. */
export function sanitize(raw: string): string {
  let t = raw.normalize('NFC').replace(/[\u0000-\u001f\u007f​-‏‪-‮]/g, '').replace(/\s+/g, ' ').trim();
  if (t.length > MSG_MAX) t = t.slice(0, MSG_MAX);
  t = t.replace(EMAIL_RE, '[ẩn]').replace(URL_RE, '[ẩn liên kết]').replace(PHONE_RE, '[ẩn số]');
  t = t.replace(BAD_RE, (_m, pre: string, w: string) => `${pre}${'*'.repeat([...w].length)}`);
  return t;
}
export function sanitizeName(raw: string): string {
  const n = sanitize(raw).replace(/[[\]]/g, '').slice(0, 24).trim();
  return n || 'Người chơi';
}

/** Giới hạn tốc độ gửi: tối đa `burst` tin trong `windowMs`, cách nhau ít nhất `minGapMs`. */
export class RateLimiter {
  private times: number[] = [];
  constructor(private burst = 5, private windowMs = 10000, private minGapMs = 900) {}
  check(now: number): { ok: true } | { ok: false; waitMs: number } {
    this.times = this.times.filter((t) => now - t < this.windowMs);
    const last = this.times[this.times.length - 1];
    if (last !== undefined && now - last < this.minGapMs) return { ok: false, waitMs: this.minGapMs - (now - last) };
    if (this.times.length >= this.burst) return { ok: false, waitMs: this.windowMs - (now - this.times[0]) };
    this.times.push(now);
    return { ok: true };
  }
}

/** Người nhận quyết định có hiển thị tin hay không (không tin người gửi). */
export function shouldReceive(p: ChatPacket, me: { id: string; x: number; z: number }, blocked: Set<string>): boolean {
  if (p.from === me.id || blocked.has(p.from)) return false;
  if (p.scope === 'whisper') return p.to === me.id;
  if (p.scope === 'near') return Math.hypot(p.x - me.x, p.z - me.z) <= NEAR_RADIUS;
  return true;
}

/** Kiểm tra gói nhận được (không tin dữ liệu mạng). */
export function validPos(p: unknown): p is PosPacket {
  const o = p as PosPacket;
  return !!o && typeof o.id === 'string' && o.id.length < 64 && [o.x, o.z, o.yaw].every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 500) && typeof o.zone === 'string' && o.zone.length < 8 && typeof o.pose === 'string' && o.pose.length < 16;
}
export function validChat(p: unknown): p is ChatPacket {
  const o = p as ChatPacket;
  return !!o && typeof o.from === 'string' && o.from.length < 64 && typeof o.mid === 'string' && o.mid.length < 64 && typeof o.text === 'string' && o.text.length > 0 && o.text.length <= MSG_MAX
    && ['room', 'near', 'whisper'].includes(o.scope) && typeof o.name === 'string' && o.name.length <= 40 && Number.isFinite(o.x) && Number.isFinite(o.z);
}
export function validMeta(p: unknown): p is PeerMeta {
  const o = p as PeerMeta;
  return !!o && typeof o.id === 'string' && typeof o.name === 'string' && !!o.look && typeof o.look.body === 'string';
}

/** Mã định danh phiên (không phải tài khoản): lưu theo tab để reload vẫn là một người. */
export function sessionPeerId(storage: Storage | null): string {
  try {
    const k = 'mnm.peerId';
    let id = storage?.getItem(k);
    if (!id) { id = `p_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`; storage?.setItem(k, id); }
    return id;
  } catch { return `p_${Math.random().toString(36).slice(2, 12)}`; }
}

/** Câu nhanh cho điện thoại (không cần bàn phím). */
export const QUICK_PHRASES = ['Xin chào!', 'Chào buổi sáng', 'Đi ăn cơm không?', 'Cảm ơn bạn', 'Hẹn gặp ở sân', 'Cố lên nhé!', 'Tạm biệt'];
