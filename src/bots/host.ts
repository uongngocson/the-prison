// Máy chủ trì bạn tù: chạy trên MỘT máy người chơi thật của phòng (bầu tự động), mô phỏng di chuyển + hội thoại,
// phát vị trí/tin nhắn qua Realtime để mọi người thấy như người chơi bình thường. Rời máy → máy khác tiếp quản.
import type { PhysicsPort } from '../physics/physics';
import type { Vec3, ZoneId } from '../domain/types';
import { pathToPoint } from '../simulation/nav';
import { zoneAt, zoneCenter } from '../content/world';
import { online, type Peer } from '../online/client';
import { RateLimiter, type ChatPacket, type ChatScope, type PeerMeta } from '../online/protocol';
import { botPeerId, personasInRoom, type Persona } from './personas';
import { openerLine, type BotClock, type Turn } from './prompt';
import { BOT_RULES, botPlan, pickResponder, shouldApproach, typingDelayMs, underReplyBudget, type BotPlan, type BotView, type Engagement } from './brain';

const WALK = 1.35;
type Mode = 'idle' | 'walk' | 'approach' | 'talk';

interface Bot {
  persona: Persona; peerId: string;
  x: number; z: number; yaw: number; zone: ZoneId; pose: string;
  mode: Mode; path: Vec3[]; idleUntil: number;
  engaged: Engagement | null;
  greeted: Map<string, number>;
  history: Map<string, Turn[]>;
  pending: { playerId: string; name: string; text: string; scope: ChatScope; due: number } | null;
  inflight: boolean;
  /** Tin mới nhất đang chờ trả lời (gom tin liên tiếp). */
  token: string;
  /** Hoạt động theo lịch chung đang theo (đổi → đi tới khu mới). */
  activity: string;
}

export interface BotHostDeps {
  phys: PhysicsPort;
  /** Vị trí người chơi trên máy này (máy chủ trì cũng là người chơi thật). */
  me: () => { id: string; name: string; x: number; z: number; zone: ZoneId };
  /** Gọi LLM qua server (mặc định /api/ai/bot). */
  reply?: (botId: string, player: string, message: string, history: Turn[], clock?: BotClock | null) => Promise<string>;
  /** CR-TIME-01: giờ chung của phòng (giờ trong ngày, mưa). Không có → đi dạo tự do như trước. */
  clock?: () => { mod: number; rain: boolean } | null;
  now?: () => number;
  rand?: () => number;
}

async function defaultReply(botId: string, player: string, message: string, history: Turn[], clock?: BotClock | null): Promise<string> {
  const res = await fetch('/api/ai/bot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ botId, player, message, history, clock: clock ?? undefined }) });
  const data = await res.json().catch(() => ({})) as { text?: string };
  return data.text ?? '';
}

export class BotHost {
  private bots: Bot[] = [];
  private room: string | null = null;
  private lastRoster = 0;
  private lastPos = 0;
  private lastThink = 0;
  private lastTick = 0;
  private llm = new RateLimiter(25, 60_000, 0); // tối đa 25 lời gọi LLM/phút từ một máy chủ trì
  private now: () => number;
  private rand: () => number;
  private reply: NonNullable<BotHostDeps['reply']>;

  constructor(private deps: BotHostDeps) {
    this.now = deps.now ?? (() => Date.now());
    this.rand = deps.rand ?? Math.random;
    this.reply = deps.reply ?? defaultReply;
  }

  get running() { return this.room !== null; }
  get currentRoom() { return this.room; }

  /** Bắt đầu chủ trì: tiếp tục từ vị trí cũ nếu máy trước đã phát (chuyển giao liền mạch). */
  start(room: string) {
    this.room = room;
    // phòng kiểm thử (e2e-*) dùng bộ bạn tù của Phân khu 1 — không ảnh hưởng phòng thật
    const cast = personasInRoom(room).length ? personasInRoom(room) : room.startsWith('e2e-') ? personasInRoom('an-binh-1') : [];
    this.bots = cast.map((p) => {
      const known = online.peers.get(botPeerId(p));
      const spawn = known?.target ?? this.randomSpot(p);
      const zone = (zoneAt(spawn.x, spawn.z) ?? (p.haunts[0] as ZoneId)) as ZoneId;
      return { persona: p, peerId: botPeerId(p), x: spawn.x, z: spawn.z, yaw: 0, zone, pose: 'idle', mode: 'idle', path: [], idleUntil: this.now() + this.rand() * 8000, engaged: null, greeted: new Map(), history: new Map(), pending: null, inflight: false, token: '', activity: '' };
    });
    online.chatTap = (p) => this.onChat(p);
    this.lastRoster = 0;
  }
  stop() { this.room = null; this.bots = []; if (online.chatTap) online.chatTap = null; }

  /** Gọi mỗi khung (controller). Dùng đồng hồ thật (không phụ thuộc FPS hay giới hạn dt của game). */
  tick() {
    if (!this.room) return;
    const now = this.now();
    const dt = this.lastTick ? Math.min(1, (now - this.lastTick) / 1000) : 0;
    this.lastTick = now;
    for (const b of this.bots) this.move(b, dt);
    if (now - this.lastThink > 1000) { this.lastThink = now; this.think(now); }
    if (now - this.lastPos > 500) { this.lastPos = now; this.publishPos(now); }
    if (now - this.lastRoster > 4000) { this.lastRoster = now; this.publishRoster(now); }
  }

  // ---------- quyết định ----------
  /** Kế hoạch theo giờ chung của một bạn tù (null = không có đồng hồ chung → đi dạo tự do). */
  private plan(b: Bot): BotPlan | null {
    const c = this.deps.clock?.();
    return c ? botPlan(b.persona, c.mod, c.rain) : null;
  }
  /** Giờ + hoạt động gửi kèm câu hỏi AI để câu trả lời hợp hoàn cảnh. */
  private clockFor(b: Bot): BotClock | null {
    const c = this.deps.clock?.();
    if (!c) return null;
    const m = Math.floor(c.mod);
    return { time: `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`, activity: botPlan(b.persona, c.mod, c.rain).activity };
  }

  private think(now: number) {
    const players = this.players();
    for (const b of this.bots) {
      // gửi câu đã “gõ” xong (trước mọi nhánh khác)
      if (b.pending && now >= b.pending.due) this.flush(b);
      // CR-TIME-01: đổi hoạt động theo lịch chung → kết thúc bắt chuyện nếu giờ không cho phép, đi tới khu mới
      const plan = this.plan(b);
      if (plan && plan.activity !== b.activity) {
        b.activity = plan.activity;
        if (!plan.social && b.engaged) { b.engaged = null; b.mode = 'idle'; }
        if (!b.engaged) { b.idleUntil = 0; if (b.mode === 'walk') b.mode = 'idle'; }
      }
      // hết hội thoại
      if (b.engaged && now - b.engaged.lastAt > BOT_RULES.engageTimeoutMs) { b.engaged = null; b.mode = 'idle'; b.idleUntil = now + 3000; }
      if (b.engaged) {
        const pl = players.find((p) => p.id === b.engaged!.playerId);
        if (!pl) { b.engaged = null; b.mode = 'idle'; continue; }
        const d = Math.hypot(pl.x - b.x, pl.z - b.z);
        b.yaw = Math.atan2(pl.x - b.x, pl.z - b.z);
        if (d > BOT_RULES.talkDistance + 3 && b.mode !== 'approach') this.goTo(b, pl, true); // đi theo khi người chơi bước đi
        else if (d <= BOT_RULES.talkDistance + 0.6 && b.mode !== 'talk') { b.mode = 'talk'; b.path = []; }
        continue;
      }
      // bắt chuyện (chỉ trong giờ tự do theo lịch)
      if ((b.mode === 'idle' || b.mode === 'walk') && (!plan || plan.social)) {
        for (const pl of players) {
          const d = Math.hypot(pl.x - b.x, pl.z - b.z);
          const onPlayer = this.bots.filter((x) => x.engaged?.playerId === pl.id || (x.mode === 'approach' && x.engaged?.playerId === pl.id)).length;
          if (shouldApproach(b.persona, d, onPlayer, b.greeted.get(pl.id), now, this.rand())) {
            b.engaged = { playerId: pl.id, since: now, lastAt: now, replies: [] };
            b.greeted.set(pl.id, now);
            this.goTo(b, pl, true);
            break;
          }
        }
      }
      // đi dạo giữa các nơi quen
      if (!b.engaged && b.mode === 'idle' && now > b.idleUntil) { const spot = this.randomSpot(b.persona, plan); this.goTo(b, { x: spot.x, z: spot.z }, false); }
    }
  }

  private onChat(p: ChatPacket) {
    if (!this.room || this.bots.some((b) => b.peerId === p.from)) return; // bỏ qua tin của chính bạn tù
    const pick = pickResponder({ from: p.from, scope: p.scope, to: p.to, text: p.text, x: p.x, z: p.z }, this.views(), this.rand());
    if (!pick) return;
    const b = this.bots.find((x) => x.peerId === pick.bot.peerId)!;
    const now = this.now();
    if (!b.engaged || b.engaged.playerId !== p.from) b.engaged = { playerId: p.from, since: now, lastAt: now, replies: b.engaged?.playerId === p.from ? b.engaged.replies : [] };
    b.engaged.lastAt = now;
    if (!underReplyBudget(b.engaged, now)) return; // đã nói nhiều — nghỉ, tránh vượt hạn mức
    const hist = b.history.get(p.from) ?? [];
    hist.push({ from: 'player', text: p.text });
    b.history.set(p.from, hist.slice(-12));
    // gom tin liên tiếp: chỉ trả lời tin mới nhất sau một nhịp
    void this.compose(b, p.from, p.name, p.text, pick.scope === 'whisper' ? 'whisper' : 'near');
  }

  private async compose(b: Bot, playerId: string, playerName: string, text: string, scope: ChatScope) {
    const token = `${playerId}:${text}:${this.now()}`;
    b.token = token;
    await new Promise((r) => setTimeout(r, BOT_RULES.debounceMs));
    if (b.token !== token || !this.room) return; // có tin mới hơn → bỏ
    if (b.inflight || !this.llm.check(this.now()).ok) return;
    b.inflight = true;
    const started = this.now();
    let out = '';
    try { out = (await this.reply(b.persona.id, playerName, text, (b.history.get(playerId) ?? []).slice(0, -1), this.clockFor(b))).trim(); } catch { out = ''; }
    b.inflight = false;
    if (!out || !this.room) return;
    const typed = typingDelayMs(out, this.rand());
    b.pending = { playerId, name: playerName, text: out, scope, due: started + typed };
    if (this.now() >= b.pending.due) this.flush(b);
  }

  private flush(b: Bot) {
    const p = b.pending;
    if (!p) return;
    b.pending = null;
    online.sendAsBot(b.peerId, b.persona.name, p.text, p.scope, { x: b.x, z: b.z }, p.scope === 'whisper' ? p.playerId : undefined);
    const hist = b.history.get(p.playerId) ?? [];
    hist.push({ from: 'bot', text: p.text });
    b.history.set(p.playerId, hist.slice(-12));
    if (b.engaged) { b.engaged.replies.push(this.now()); b.engaged.lastAt = this.now(); }
  }

  // ---------- di chuyển ----------
  private goTo(b: Bot, target: { x: number; z: number }, approach: boolean) {
    // đã đứng sát người chơi → quay mặt và chào luôn
    if (approach && Math.hypot(target.x - b.x, target.z - b.z) <= BOT_RULES.talkDistance + 0.6) { b.path = []; b.mode = 'approach'; this.arrive(b); return; }
    let tx = target.x, tz = target.z;
    if (approach) { const a = Math.atan2(b.x - tx, b.z - tz); tx += Math.sin(a) * BOT_RULES.talkDistance; tz += Math.cos(a) * BOT_RULES.talkDistance; }
    const toZone = (zoneAt(tx, tz) ?? b.zone) as ZoneId;
    try { b.path = pathToPoint(this.deps.phys, { x: b.x, y: 0, z: b.z }, b.zone, toZone, { x: tx, y: 0, z: tz }).points.map((p) => ({ ...p })); }
    catch { b.path = [{ x: tx, y: 0, z: tz }]; }
    b.mode = approach ? 'approach' : 'walk';
  }
  private move(b: Bot, dt: number) {
    if (b.mode === 'talk' || b.mode === 'idle' || !b.path.length) { b.pose = b.mode === 'talk' ? 'talk' : this.plan(b)?.pose ?? 'idle'; if (b.mode !== 'talk' && !b.path.length && b.mode !== 'idle') this.arrive(b); return; }
    const t = b.path[0];
    const dx = t.x - b.x, dz = t.z - b.z, d = Math.hypot(dx, dz);
    const step = WALK * dt;
    if (d <= step) { b.x = t.x; b.z = t.z; b.path.shift(); }
    else { b.x += (dx / d) * step; b.z += (dz / d) * step; b.yaw = Math.atan2(dx, dz); }
    b.zone = (zoneAt(b.x, b.z) ?? b.zone) as ZoneId;
    b.pose = 'walk';
    if (!b.path.length) this.arrive(b);
  }
  private arrive(b: Bot) {
    if (b.mode === 'approach' && b.engaged) {
      b.mode = 'talk';
      const pl = this.players().find((p) => p.id === b.engaged!.playerId);
      if (pl) {
        b.yaw = Math.atan2(pl.x - b.x, pl.z - b.z);
        // lời chào đầu (không tốn lượt LLM), như người thật bước tới hỏi han
        const text = openerLine(b.persona, pl.name, Math.floor(this.rand() * 100));
        b.pending = { playerId: pl.id, name: pl.name, text, scope: 'near', due: this.now() + typingDelayMs(text, this.rand()) };
      }
      return;
    }
    b.mode = 'idle';
    // theo lịch: ở lại khu của hoạt động lâu hơn (không đi lang thang giữa giờ ăn / điểm danh)
    const plan = this.plan(b);
    b.idleUntil = this.now() + (plan ? 20_000 + this.rand() * 40_000 : 6000 + this.rand() * 20_000);
  }
  private randomSpot(p: Persona, plan: BotPlan | null = null): { x: number; z: number } {
    const pool = plan ? plan.zones : p.haunts;
    const z = pool[Math.floor(this.rand() * pool.length)] as ZoneId;
    const c = zoneCenter(z);
    return { x: c.x + (this.rand() - 0.5) * 4, z: c.z + (this.rand() - 0.5) * 3 };
  }

  // ---------- dữ liệu ----------
  private players(): { id: string; name: string; x: number; z: number }[] {
    const me = this.deps.me();
    const list = [{ id: me.id, name: me.name, x: me.x, z: me.z }];
    for (const p of online.realPeers() as Peer[]) if (p.target) list.push({ id: p.meta.id, name: p.meta.name, x: p.target.x, z: p.target.z });
    return list;
  }
  private views(): BotView[] { return this.bots.map((b) => ({ persona: b.persona, peerId: b.peerId, x: b.x, z: b.z, engagedWith: b.engaged?.playerId ?? null, busy: b.inflight || !!b.pending || this.plan(b)?.social === false })); }
  private publishRoster(now: number) {
    const bots: PeerMeta[] = this.bots.map((b) => ({ v: 1, id: b.peerId, name: b.persona.name, look: b.persona.look, outfit: b.persona.outfit, joinedAt: now - 3_600_000 }));
    online.broadcastBots('bots', { host: online.id, bots, t: now });
  }
  private publishPos(now: number) {
    const r = (n: number) => Math.round(n * 100) / 100;
    online.broadcastBots('bpos', { host: online.id, t: now, bots: this.bots.map((b) => ({ id: b.peerId, x: r(b.x), z: r(b.z), yaw: r(b.yaw), zone: b.zone, pose: b.pose })) });
  }
}
