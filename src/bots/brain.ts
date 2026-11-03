// Logic quyết định của bạn tù (thuần — không mạng, không 3D) để test được và tái dùng cho trang admin.
import type { ChatScope } from '../online/protocol';
import type { Persona } from './personas';
import type { ZoneId } from '../domain/types';
import type { BotActivity } from './prompt';

export const BOT_RULES = {
  /** Khoảng cách bắt đầu để ý người chơi (m). */
  noticeRadius: 22,
  /** Đứng cách người chơi khi trò chuyện (m). */
  talkDistance: 1.8,
  /** Bán kính nghe tin “gần đây” (m) — trùng NEAR_RADIUS của chat. */
  hearRadius: 12,
  /** Không chào lại cùng người trong khoảng này (ms). */
  regreetMs: 10 * 60_000,
  /** Hết hội thoại nếu im lặng (ms). */
  engageTimeoutMs: 90_000,
  /** Tối đa bạn tù cùng trò chuyện với một người. */
  maxBotsPerPlayer: 2,
  /** Tối đa câu trả lời của một bạn tù cho một người trong 5 phút (tiết kiệm hạn mức LLM). */
  maxRepliesPer5Min: 12,
  /** Gom tin liên tiếp trước khi trả lời (ms). */
  debounceMs: 1200,
};

export interface Engagement { playerId: string; since: number; lastAt: number; replies: number[] }

/** Thời gian “đang gõ” như người thật: đọc + gõ, có dao động, giới hạn 1,5–7 s. */
export function typingDelayMs(reply: string, rand: number): number {
  const ms = 900 + reply.length * 55 + rand * 1200;
  return Math.round(Math.max(1500, Math.min(7000, ms)));
}

/** Tin có gọi tên bạn tù không (tên đầy đủ hoặc tên gọi cuối). */
export function mentions(text: string, p: Persona): boolean {
  const t = text.toLowerCase();
  const last = p.name.split(' ').slice(-1)[0].toLowerCase();
  return t.includes(p.name.toLowerCase()) || new RegExp(`(^|[^\\p{L}])${last}([^\\p{L}]|$)`, 'u').test(t);
}

export interface BotView { persona: Persona; peerId: string; x: number; z: number; engagedWith: string | null; busy: boolean }
export interface IncomingChat { from: string; scope: ChatScope; to?: string; text: string; x: number; z: number }

/** Chọn bạn tù trả lời một tin của người chơi (hoặc null). Trả về kèm phạm vi trả lời. */
export function pickResponder(msg: IncomingChat, bots: BotView[], rand: number): { bot: BotView; scope: ChatScope } | null {
  if (msg.scope === 'whisper') { const b = bots.find((x) => x.peerId === msg.to); return b ? { bot: b, scope: 'whisper' } : null; }
  const named = bots.filter((b) => mentions(msg.text, b.persona));
  if (named.length) return { bot: named[0], scope: msg.scope };
  const near = bots.filter((b) => Math.hypot(b.x - msg.x, b.z - msg.z) <= BOT_RULES.hearRadius);
  const engaged = near.find((b) => b.engagedWith === msg.from);
  if (engaged) return { bot: engaged, scope: 'near' };
  if (msg.scope === 'room') return null; // tin cả phòng không gọi tên ai → để người thật trả lời
  const free = near.filter((b) => !b.busy && !b.engagedWith).sort((a, b) => Math.hypot(a.x - msg.x, a.z - msg.z) - Math.hypot(b.x - msg.x, b.z - msg.z));
  if (free.length && rand < 0.65) return { bot: free[0], scope: 'near' };
  return null;
}

/** Còn được trả lời người này không (giới hạn lượt trong 5 phút). */
export function underReplyBudget(e: Engagement | undefined, now: number): boolean {
  if (!e) return true;
  return e.replies.filter((t) => now - t < 5 * 60_000).length < BOT_RULES.maxRepliesPer5Min;
}

/** Có nên lại gần bắt chuyện với người chơi không. */
export function shouldApproach(p: Persona, dist: number, botsOnPlayer: number, lastGreetAt: number | undefined, now: number, rand: number): boolean {
  if (dist > BOT_RULES.noticeRadius) return false;
  if (botsOnPlayer >= BOT_RULES.maxBotsPerPlayer) return false;
  if (lastGreetAt !== undefined && now - lastGreetAt < BOT_RULES.regreetMs) return false;
  return rand < p.sociable * 0.35;
}

// ---------- CR-TIME-01: lịch sinh hoạt chung của bạn tù ----------
export interface BotPlan { activity: BotActivity; zones: ZoneId[]; social: boolean; pose: 'idle' | 'sit' | 'eat' | 'exercise' | 'read' }
const H = (h: number, m = 0) => h * 60 + m;
/** Bạn tù ở đâu, làm gì theo giờ chung (giờ trong ngày 0…1439). Cùng giờ → mọi máy chủ trì cho cùng kết quả. */
export function botPlan(p: Persona, mod: number, rain: boolean): BotPlan {
  const h = p.haunts as ZoneId[];
  if (mod >= H(22) || mod < H(6)) return { activity: 'giờ ngủ', zones: ['L02'], social: false, pose: 'sit' };
  if (mod < H(6, 30)) return { activity: 'vệ sinh buổi sáng', zones: ['L13'], social: false, pose: 'idle' };
  if (mod < H(7)) return { activity: 'điểm danh sáng', zones: ['L02'], social: false, pose: 'idle' };
  if (mod < H(8, 30)) return { activity: 'bữa sáng', zones: ['L05'], social: true, pose: 'eat' };
  if (mod < H(11, 30)) return { activity: 'giờ lao động, học tập', zones: [h[0] ?? 'L10'], social: true, pose: 'idle' };
  if (mod < H(13)) return { activity: 'bữa trưa', zones: ['L05'], social: true, pose: 'eat' };
  if (mod < H(14)) return { activity: 'nghỉ trưa', zones: ['L02'], social: false, pose: 'sit' };
  if (mod < H(15, 30)) return { activity: 'giờ thư viện, lớp học', zones: [h[1] ?? 'L07'], social: true, pose: 'read' };
  if (mod < H(17, 30)) return { activity: 'giờ ra sân', zones: [rain ? 'L09' : 'L04'], social: true, pose: p.sociable > 0.7 ? 'exercise' : 'idle' };
  if (mod < H(19)) return { activity: 'bữa tối', zones: ['L05'], social: true, pose: 'eat' };
  if (mod < H(21, 30)) return { activity: 'sinh hoạt buổi tối', zones: [h[2] ?? 'L02', 'L02'], social: true, pose: 'sit' };
  return { activity: 'điểm danh tối', zones: ['L02'], social: false, pose: 'idle' };
}
