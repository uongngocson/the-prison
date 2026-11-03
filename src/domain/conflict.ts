// CR-CONFLICT-01 — xung đột / ẩu đả trong trại (đợt 1: người chơi ↔ NPC).
// Luồng: căng thẳng (lời nói) → ẩu đả (thân thể) → báo động "GET DOWN" (cả khu nằm sấp) → đội phản ứng tới, khống chế,
// còng tay → áp giải vào SHU (Ad-Seg chờ điều tra 1 ngày) → điều trần theo dữ kiện: khởi xướng / ẩu đả qua lại → SHU,
// tự vệ → về khu thường. Không vũ khí, không máu, không mô tả thương tích chi tiết.
import type { Appearance, ConflictChoice, ConflictRecord, ConflictState, GameState, IncidentReview, ZoneId } from './types';
import { type Ctx, adjustRel, changeNeed, notify } from './core';
import { NPC_BY_ID, NPCS } from '../content/npcs';
import { CUSTODY_ROOM_BY_ID, SHU_CELLS, ZONE_BY_ID, doorNodes, zoneAt } from '../content/world';
import { MEALS } from '../content/schedule';
import { adSegForConflict, adSegResolve, escortToRoom, isVN, shuOrder } from './custody';
import { dayOf, fmtClock, fmtDayClock, minuteOfDay, MIN_PER_DAY, pushBounded } from './util';

export const TICKS_PER_SEC = 30;
const sec = (n: number) => Math.round(n * TICKS_PER_SEC);
/** Thời lượng các pha (giây thực). */
export const CONFLICT_TIMING = { tension: 9, brawlMin: 3, brawlMax: 8, alarmAfter: 1.2, responderArrive: 2.5, restrain: 5, escort: 4.5 };
/** Đội phản ứng (CERT): NPC cán bộ chỉ xuất hiện khi có báo động. */
export const RESPONDER_IDS = ['cert_1', 'cert_2', 'cert_3', 'cert_4'];
/** Số đòn trả lại tối đa vẫn được xem là tự vệ tương xứng. */
export const SELF_DEFENSE_MAX_STRIKES = 2;
export const SHU_DAYS = { initiator: 8, mutual: 5 } as const;
export const STORY_HOLD_DAYS = { initiator: 2, mutual: 1 } as const;
const PROVOKE_LINES = ['Mày nhìn cái gì đấy?', 'Chỗ này của tao. Né ra.', 'Lần trước mày làm tao mất mặt rồi đấy.', 'Đừng tưởng tao không dám.', 'Đứng lại đó. Nói chuyện chút.'];
const PLAYER_PROVOKE_LINE = 'Này, có vấn đề gì với tôi à?';
const NPC_REPLY_TO_PLAYER = ['Mày muốn gì?', 'Tránh xa tao ra.', 'Đừng có kiếm chuyện.'];

export const conflictEnabled = (ctx: Ctx) => ctx.settings.conflicts !== false;
export const activeConflict = (s: GameState): ConflictState | null => s.conflict ?? null;
/** Người chơi đang bị khóa điều khiển di chuyển (ẩu đả / khống chế / áp giải). */
export const conflictLocksMovement = (s: GameState) => !!s.conflict && s.conflict.phase !== 'tension';
/** Đang bị giữ trong SHU (cả hai chế độ). */
export function inShuHold(s: GameState): boolean { return isVN(s) ? !!shuOrder(s) : !!s.hold; }

/** Có thể bắt đầu xung đột với NPC này không (người chơi chủ động hoặc NPC gây sự). */
export function canConflict(ctx: Ctx, npcId: string): string | null {
  const s = ctx.s;
  if (!conflictEnabled(ctx)) return 'Nội dung xung đột đang tắt trong Cài đặt.';
  if (s.conflict) return 'Đang có xung đột.';
  if (inShuHold(s)) return 'Đang ở SHU.';
  const def = NPC_BY_ID[npcId];
  if (!def || def.role !== 'resident') return 'Chỉ áp dụng với bạn tù.';
  if (s.npcHolds?.[npcId]) return 'Người này đang ở SHU.';
  if (s.player.mode === 'sleeping' || s.player.mode === 'acting') return 'Bạn đang bận.';
  if (s.life.episode.state !== 'admitted' && isVN(s)) return 'Chưa hoàn tất tiếp nhận.';
  return null;
}

let seq = 0;
const cid = (s: GameState) => `cf_${s.tick.toString(36)}${(seq++).toString(36)}`;

function begin(ctx: Ctx, npcId: string, provokedBy: 'player' | 'npc', line: string, peer?: OnlineOpponent): ConflictState {
  const s = ctx.s;
  const n = peer ? null : s.npcs[npcId];
  const op = peer ? { x: peer.x, z: peer.z } : { x: n!.pos.x, z: n!.pos.z };
  const c: ConflictState = {
    id: peer?.cid ?? cid(s), npcId: peer ? '' : npcId, zone: s.player.zone, pos: { x: (s.player.pos.x + op.x) / 2, z: (s.player.pos.z + op.z) / 2 }, phase: 'tension', phaseTick: s.tick,
    startedMinute: s.minute, initiator: null, provokedBy, line, playerStrikes: 0, npcStrikes: 0, blocks: 0, escaped: false, alarm: false, complied: false,
    sprayed: false, responders: [], nextNpcStrikeTick: 0, log: [],
    ...(peer ? { opp: peer.bot ? 'bot' as const : 'peer' as const, peer: { id: peer.id, name: peer.name, look: peer.look, outfit: peer.outfit }, oppPos: op, oppSeen: s.tick } : {}),
  };
  s.conflict = c;
  s.player.action = null;
  if (s.player.mode === 'seated') { s.player.mode = 'grounded'; s.player.seatedAt = null; }
  if (n) { n.path = []; n.talkingWithPlayer = false; }
  log(c, provokedBy === 'npc' ? `${oppName(c)} gây sự: "${line}"` : `Bạn gây sự với ${oppName(c)}.`);
  ctx.emit({ type: 'flag', key: 'conflict', value: true });
  return c;
}
const log = (c: ConflictState, text: string) => pushBounded(c.log, text, 12);

/** Người chơi chủ động gây sự với một bạn tù (verb "Gây sự"). */
export function startPlayerConflict(ctx: Ctx, npcId: string): boolean {
  if (canConflict(ctx, npcId)) return false;
  const c = begin(ctx, npcId, 'player', PLAYER_PROVOKE_LINE);
  c.line = NPC_REPLY_TO_PLAYER[ctx.rng.int(0, NPC_REPLY_TO_PLAYER.length - 1)];
  return true;
}
/** NPC gây sự với người chơi (chỉ lời nói — chưa ai ra tay). */
export function startNpcConflict(ctx: Ctx, npcId: string): boolean {
  if (canConflict(ctx, npcId)) return false;
  begin(ctx, npcId, 'npc', PROVOKE_LINES[ctx.rng.int(0, PROVOKE_LINES.length - 1)]);
  notify(ctx, `${NPC_BY_ID[npcId].name} gây sự · ra tay trước = người khởi xướng.`, 'warning', 'life');
  return true;
}

function setPhase(ctx: Ctx, c: ConflictState, phase: ConflictState['phase']) {
  c.phase = phase;
  c.phaseTick = ctx.s.tick;
  ctx.emit({ type: 'flag', key: `conflict_${phase}`, value: true });
}
function startBrawl(ctx: Ctx, c: ConflictState, by: 'player' | 'npc') {
  if (c.initiator === null) c.initiator = by;
  if (by === 'player' && c.myFirstAt === undefined) { c.myFirstAt = Date.now(); send(c, 'strike'); }
  setPhase(ctx, c, 'brawl');
  c.nextNpcStrikeTick = ctx.s.tick + sec(by === 'npc' ? 0.2 : 0.8);
  log(c, by === 'player' ? 'Bạn ra tay trước.' : `${oppName(c)} ra tay trước.`);
  if (!c.peer) adjustRel(ctx, c.npcId, { trust: -12, respect: -4 }, 'Ẩu đả', `fight:${c.id}`);
}
function npcStrike(ctx: Ctx, c: ConflictState, blocked: boolean) {
  c.npcStrikes++;
  if (blocked) { c.blocks++; changeNeed(ctx, 'energy', -1, 'Đỡ đòn'); }
  else { changeNeed(ctx, 'energy', -3, 'Trúng đòn trong ẩu đả'); changeNeed(ctx, 'mood', -2, 'Ẩu đả'); }
}
function end(ctx: Ctx, c: ConflictState, verdict: ConflictRecord['verdict'], text: string) {
  const s = ctx.s;
  record(s, c, verdict);
  s.conflict = null;
  notify(ctx, text, verdict === 'deescalated' || verdict === 'reported' ? 'success' : 'info', 'life');
  ctx.emit({ type: 'flag', key: 'conflict', value: false });
}
function record(s: GameState, c: ConflictState, verdict: ConflictRecord['verdict'], extra: Partial<ConflictRecord> = {}): ConflictRecord {
  s.conflicts ??= [];
  const r: ConflictRecord = {
    ...(c.peer ? { peerName: c.peer.name } : {}),
    id: c.id, minute: c.startedMinute, npcId: c.npcId, zone: c.zone, initiator: c.initiator, playerStrikes: c.playerStrikes, npcStrikes: c.npcStrikes, sprayed: c.sprayed, verdict,
    reportNo: `RVR-${dayOf(c.startedMinute).toString().padStart(3, '0')}-${(s.conflicts.length + 1).toString().padStart(3, '0')}`, ...extra,
  };
  pushBounded(s.conflicts, r, 30);
  return r;
}

/** Xác suất nói hạ nhiệt thành công (quan hệ + kỹ năng giao tiếp). */
export function calmChance(s: GameState, npcId: string): number {
  const r = npcId ? s.relationships[npcId] : undefined;
  return Math.max(0.15, Math.min(0.9, 0.4 + (r?.trust ?? 0) / 200 + (r?.respect ?? 0) / 300 + (s.skills.communication ?? 0) * 0.05));
}

/** Lựa chọn của người chơi trong pha hiện tại. */
export function conflictChoose(ctx: Ctx, choice: ConflictChoice): string | null {
  const s = ctx.s;
  const c = s.conflict;
  if (!c) return null;
  const name = oppName(c);
  const human = c.opp === 'peer';
  if (c.phase === 'tension') {
    // đối thủ là người chơi thật: không có xác suất — mỗi bên tự quyết, gửi lựa chọn qua mạng
    if (human && choice === 'leave') { send(c, 'leave'); end(ctx, c, 'deescalated', `Bạn bỏ đi khỏi ${name}.`); return 'ok'; }
    if (human && choice === 'calm') {
      if (c.calmMine) return null;
      c.calmMine = true; send(c, 'calm'); log(c, 'Bạn: “Thôi, bỏ qua đi.”');
      if (c.calmTheirs) { end(ctx, c, 'deescalated', `Cả hai cùng hạ nhiệt · ${name} bỏ đi.`); return 'ok'; }
      return 'waiting';
    }
    if (human && choice === 'call_staff') {
      send(c, 'call');
      end(ctx, c, 'reported', c.provokedBy === 'npc' ? `Cán bộ tách hai người · ${name} bị nhắc nhở, bạn không bị ghi lỗi.` : 'Cán bộ nhắc nhở cả hai · không ai bị ghi lỗi.');
      return 'ok';
    }
    if (choice === 'leave') {
      if (c.provokedBy === 'player' || ctx.rng.next() < 0.7) { end(ctx, c, 'deescalated', `Bạn bỏ đi. ${name} không theo.`); return 'ok'; }
      log(c, `${name} không để bạn đi.`);
      startBrawl(ctx, c, 'npc');
      return 'blocked';
    }
    if (choice === 'calm') {
      if (ctx.rng.next() < calmChance(s, c.npcId)) {
        adjustRel(ctx, c.npcId, { respect: 4 }, 'Bạn bình tĩnh hạ nhiệt', `calm:${c.id}`);
        end(ctx, c, 'deescalated', `Bạn nói chuyện bình tĩnh. ${name} dịu lại và bỏ đi.`);
        return 'ok';
      }
      log(c, 'Lời nói không có tác dụng.');
      if (c.provokedBy === 'npc' || ctx.rng.next() < 0.4) { startBrawl(ctx, c, 'npc'); return 'failed'; }
      c.line = 'Nói nhiều quá đấy.';
      return 'failed';
    }
    if (choice === 'call_staff') {
      c.alarm = true; // cán bộ tới hiện trường nhưng chưa có ẩu đả → không báo động nằm sấp
      const npcFault = c.provokedBy === 'npc';
      if (npcFault && !c.peer) holdNpc(s, c.npcId, s.minute + MIN_PER_DAY);
      end(ctx, c, 'reported', npcFault ? `Cán bộ tách hai người · ${name} bị đưa đi, bạn không bị ghi lỗi.` : 'Cán bộ nhắc nhở cả hai · không ai bị ghi lỗi.');
      return 'ok';
    }
    if (choice === 'shove' || choice === 'strike') {
      c.playerStrikes++;
      changeNeed(ctx, 'energy', -2, 'Ẩu đả');
      startBrawl(ctx, c, 'player');
      return 'ok';
    }
    return null;
  }
  if (c.phase === 'brawl') {
    if (choice === 'strike') { if (c.escaped) return null; if (c.myFirstAt === undefined) c.myFirstAt = Date.now(); c.playerStrikes++; changeNeed(ctx, 'energy', -2, 'Ẩu đả'); log(c, 'Bạn đánh trả.'); send(c, 'strike'); return 'ok'; }
    if (choice === 'block') { c.blocks++; c.lastBlockTick = s.tick; log(c, 'Bạn che chắn.'); return 'ok'; }
    if (choice === 'break_away') { c.escaped = true; log(c, 'Bạn thoát ra, lùi lại.'); send(c, 'break_away'); return 'ok'; }
    return null;
  }
  if (c.phase === 'restrain' && choice === 'comply' && !c.complied) {
    c.complied = true;
    log(c, 'Bạn nằm xuống, đưa tay ra sau lưng. Bị còng tay.');
    return 'ok';
  }
  return null;
}

/** Bước thời gian thực (30 Hz) — pha, đòn của NPC, báo động, đội phản ứng. */
export function conflictStep(ctx: Ctx) {
  const s = ctx.s;
  const c = s.conflict;
  if (!c) return;
  const t = s.tick - c.phaseTick;
  const op = c.peer ? c.oppPos ?? c.pos : s.npcs[c.npcId].pos;
  if (c.phase === 'tension') {
    const d = Math.hypot(s.player.pos.x - op.x, s.player.pos.z - op.z);
    if (c.opp === 'peer' && s.tick - (c.oppSeen ?? c.phaseTick) > sec(6)) { end(ctx, c, 'deescalated', `${oppName(c)} đã rời đi.`); return; }
    if (d > 6) { conflictChoose(ctx, 'leave'); return; }
    if (t >= sec(CONFLICT_TIMING.tension)) {
      // người chơi thật tự quyết định ra tay; hết giờ mà không ai ra tay thì tự tan
      if (c.provokedBy === 'npc' && c.opp !== 'peer') startBrawl(ctx, c, 'npc');
      else { if (c.opp === 'peer') send(c, 'leave'); end(ctx, c, 'deescalated', `${oppName(c)} lườm bạn rồi bỏ đi.`); }
    }
    return;
  }
  if (c.phase === 'brawl') {
    if (!c.alarm && t >= sec(CONFLICT_TIMING.alarmAfter)) raiseAlarm(ctx, c);
    if (c.opp !== 'peer' && s.tick >= c.nextNpcStrikeTick && !c.escaped) {
      npcStrike(ctx, c, ctx.rng.next() < Math.min(0.85, 0.25 + c.blocks * 0.08));
      c.nextNpcStrikeTick = s.tick + sec(0.9 + ctx.rng.next() * 0.6);
    }
    const arrived = c.responders.length > 0 && c.responders.every((id) => { const r = s.npcs[id]; return r && !r.absent && r.path.length === 0; });
    if ((arrived && t >= sec(CONFLICT_TIMING.brawlMin)) || t >= sec(CONFLICT_TIMING.brawlMax)) {
      setPhase(ctx, c, 'restrain');
      notify(ctx, 'Cán bộ: “Nằm xuống! Tay ra sau lưng!”', 'warning', 'life');
    }
    return;
  }
  if (c.phase === 'restrain') {
    if (!c.complied && t >= sec(CONFLICT_TIMING.restrain)) {
      c.sprayed = true; c.complied = true;
      changeNeed(ctx, 'mood', -8, 'Bị xịt hơi cay'); changeNeed(ctx, 'energy', -10, 'Bị xịt hơi cay');
      log(c, 'Không chấp hành lệnh — bị xịt hơi cay (OC) và khống chế.');
      notify(ctx, 'Không chấp hành · bị xịt hơi cay và khống chế.', 'warning', 'life');
    }
    if (c.complied && t >= sec(1.4)) { setPhase(ctx, c, 'escort'); notify(ctx, 'Còng tay · áp giải tới Khu biệt giam (SHU).', 'info', 'life'); }
    return;
  }
  if (c.phase === 'escort') {
    // đi bộ vài bước có cán bộ kèm hai bên, rồi chuyển cảnh vào SHU
    const dn = doorNodes(c.zone);
    if (dn) {
      const dx = dn.outside.x - s.player.pos.x, dz = dn.outside.z - s.player.pos.z, d = Math.hypot(dx, dz);
      if (d > 0.3) { const step = 1.1 / TICKS_PER_SEC; s.player.pos.x += (dx / d) * step; s.player.pos.z += (dz / d) * step; s.player.yaw = Math.atan2(dx, dz); }
    }
    if (t >= sec(CONFLICT_TIMING.escort)) finishEscort(ctx, c);
  }
}

function raiseAlarm(ctx: Ctx, c: ConflictState) {
  const s = ctx.s;
  c.alarm = true;
  log(c, 'Báo động: "All inmates — GET DOWN!"');
  notify(ctx, `BÁO ĐỘNG · ${ZONE_BY_ID[c.zone].name} · GET DOWN!`, 'error', 'life');
  // đội phản ứng: xuất hiện ở rìa khu (cửa hoặc 8 m quanh hiện trường) và chạy tới
  c.responders = RESPONDER_IDS.slice(0, 4);
  c.responders.forEach((id, i) => {
    const r = s.npcs[id];
    if (!r) return;
    const a = (i / c.responders.length) * Math.PI * 2 + 0.6;
    const dn = doorNodes(c.zone);
    const start = i < 2 && dn ? { x: dn.inside.x + (i ? 0.8 : -0.8), z: dn.inside.z } : { x: c.pos.x + Math.cos(a) * 8, z: c.pos.z + Math.sin(a) * 8 };
    const okStart = zoneAt(start.x, start.z) === c.zone ? start : { x: c.pos.x + Math.cos(a) * 4, z: c.pos.z + Math.sin(a) * 4 };
    r.absent = false; r.zone = c.zone; r.pos = { x: okStart.x, y: 0, z: okStart.z };
    r.path = [{ x: c.pos.x + Math.cos(a) * 1.3, y: 0, z: c.pos.z + Math.sin(a) * 1.3 }]; r.pathZones = [c.zone];
    r.activity = 'responding'; r.goalKey = `respond:${c.id}`;
  });
}

function holdNpc(s: GameState, npcId: string, until: number) {
  s.npcHolds ??= {};
  const used = new Set(Object.values(s.npcHolds).map((h) => h.roomId));
  const room = SHU_CELLS.slice().reverse().find((r) => !used.has(r.id)) ?? SHU_CELLS[SHU_CELLS.length - 1];
  s.npcHolds[npcId] = { roomId: room.id, untilMinute: until };
}

function finishEscort(ctx: Ctx, c: ConflictState) {
  const s = ctx.s;
  const hearingAt = s.minute + MIN_PER_DAY;
  const name = oppName(c);
  const inc: IncidentReview = {
    id: `inc_${c.id}`, kind: 'conduct', ruleId: 'fight', state: 'in_review',
    facts: [
      { text: `Ẩu đả với ${name} tại ${ZONE_BY_ID[c.zone].name} lúc ${fmtClock(minuteOfDay(c.startedMinute))}`, provenance: `Camera ${c.zone}`, confidence: 0.95 },
      { text: c.initiator === 'player' ? 'Hình ảnh cho thấy bạn ra tay trước.' : `Hình ảnh cho thấy ${name} ra tay trước.`, provenance: 'Trích xuất camera', confidence: 0.9 },
      { text: `Đòn: bạn ${c.playerStrikes} · ${name} ${c.npcStrikes}${c.escaped ? ' · bạn đã thoát ra' : ''}`, provenance: 'Báo cáo đội phản ứng', confidence: 0.85 },
      ...(c.sprayed ? [{ text: 'Không chấp hành lệnh nằm xuống — phải dùng hơi cay.', provenance: 'Báo cáo đội phản ứng', confidence: 0.95 }] : []),
    ],
    responses: [], history: [{ minute: s.minute, actorRole: 'shift_commander', text: 'Lập biên bản vi phạm, tách riêng chờ điều tra (Ad-Seg).', state: 'submitted' }],
    canonicalKey: `fight:${c.id}`, minute: s.minute, dueMinute: hearingAt + 3 * MIN_PER_DAY,
  };
  s.life.incidents.push(inc);
  const rec = record(s, c, 'pending', { incidentId: inc.id, hearingAt });
  if (!c.peer) holdNpc(s, c.npcId, hearingAt + 60);
  // đưa vào SHU
  if (isVN(s)) adSegForConflict(ctx, c.id, hearingAt);
  else {
    const room = SHU_CELLS[0];
    s.hold = { roomId: room.id, untilMinute: hearingAt + 60, reason: 'Tách riêng chờ điều tra sau ẩu đả', conflictId: c.id };
    s.player.pos = { x: room.anchor.x, y: 0, z: room.anchor.z }; s.player.lastSafe = { ...s.player.pos }; s.player.zone = room.zone; s.player.yaw = Math.PI;
    if (!s.discoveredZones.includes(room.zone)) s.discoveredZones.push(room.zone);
  }
  s.player.mode = 'grounded';
  for (const id of c.responders) { const r = s.npcs[id]; if (r) { r.absent = true; r.path = []; r.activity = 'idle'; } }
  s.conflict = null;
  notify(ctx, `Biên bản ${rec.reportNo} · tách riêng ở SHU chờ điều tra · điều trần ${fmtDayClock(hearingAt)}. Y tế: không chấn thương nặng.`, 'warning', 'life', true);
  ctx.emit({ type: 'flag', key: 'conflict', value: false });
}

/** Phán quyết thuần theo dữ kiện (không theo uy tín/ngoại hình). */
export function verdictFor(r: Pick<ConflictRecord, 'initiator' | 'playerStrikes'>): 'initiator' | 'mutual' | 'self_defense' {
  if (r.initiator === 'player') return 'initiator';
  return r.playerStrikes > SELF_DEFENSE_MAX_STRIKES ? 'mutual' : 'self_defense';
}

/** Mỗi phút game: điều trần, hết hạn giữ, suất ăn khi bị giữ (chế độ Cốt truyện), NPC gây sự. */
export function conflictMinute(ctx: Ctx) {
  const s = ctx.s;
  // điều trần
  for (const r of s.conflicts ?? []) {
    if (r.verdict !== 'pending' || r.hearingAt === undefined || s.minute < r.hearingAt) continue;
    const v = verdictFor(r);
    r.verdict = v;
    const name = r.peerName ?? NPC_BY_ID[r.npcId]?.name ?? r.npcId;
    const inc = s.life.incidents.find((i) => i.id === r.incidentId);
    const vn = isVN(s);
    let text: string;
    if (v === 'self_defense') {
      text = `Điều trần ${r.reportNo}: TỰ VỆ (${name} ra tay trước, bạn trả ${r.playerStrikes} đòn) · không ghi lỗi, về khu thường.`;
      if (vn) adSegResolve(ctx, r.id, null, text); else releaseHold(ctx, 'Kết luận tự vệ — trở về khu ở');
      if (s.npcHolds?.[r.npcId]) s.npcHolds[r.npcId].untilMinute = s.minute + SHU_DAYS.initiator * MIN_PER_DAY;
      if (inc) { inc.state = 'dismissed'; inc.decision = text; }
    } else {
      const days = vn ? SHU_DAYS[v] : STORY_HOLD_DAYS[v];
      text = `Điều trần ${r.reportNo}: ${v === 'initiator' ? 'KHỞI XƯỚNG' : 'ẨU ĐẢ QUA LẠI'}${r.sprayed ? ' + không chấp hành lệnh' : ''}. ${vn ? `SHU ${days} ngày (step-down).` : `Giữ ở SHU thêm ${days} ngày.`}`;
      if (vn) adSegResolve(ctx, r.id, days + (r.sprayed ? 1 : 0), text);
      else if (s.hold) s.hold.untilMinute = s.minute + (days + (r.sprayed ? 1 : 0)) * MIN_PER_DAY;
      if (s.npcHolds?.[r.npcId]) s.npcHolds[r.npcId].untilMinute = s.minute + (v === 'mutual' ? SHU_DAYS.mutual : 1) * MIN_PER_DAY;
      if (inc) { inc.state = 'decided'; inc.decision = text; }
    }
    inc?.history.push({ minute: s.minute, actorRole: 'hearing_officer', text, state: 'answered' });
    notify(ctx, text, v === 'self_defense' ? 'success' : 'warning', 'life', true);
    ctx.emit({ type: 'lifeUpdated', domain: 'incidents' });
  }
  // chế độ Cốt truyện: hết hạn giữ + suất ăn qua khe cửa
  if (s.hold) {
    if (s.minute >= s.hold.untilMinute) releaseHold(ctx, 'Hết thời hạn giữ ở SHU');
    else {
      const m = minuteOfDay(s.minute);
      for (const meal of MEALS) {
        const key = `${dayOf(s.minute)}:${meal.id}`;
        if (m === meal.from + 30 && !s.mealClaims[key]) { s.mealClaims[key] = true; changeNeed(ctx, 'hunger', 35, 'Suất ăn qua khe cửa'); notify(ctx, `${meal.label}: khay cơm được đẩy qua khe cửa.`, 'info', 'life'); }
      }
      if (m % 60 === 30) changeNeed(ctx, 'mood', -2, 'Cô lập trong buồng SHU');
    }
  }
  // NPC hết hạn giữ
  for (const [id, h] of Object.entries(s.npcHolds ?? {})) if (s.minute >= h.untilMinute) delete s.npcHolds![id];
  // NPC gây sự
  maybeProvoke(ctx);
}

function releaseHold(ctx: Ctx, why: string) {
  const s = ctx.s;
  if (!s.hold) return;
  s.hold = null;
  const back = doorNodes('L02');
  s.player.pos = back ? { ...back.inside } : { x: -26, y: 0, z: 5 };
  s.player.lastSafe = { ...s.player.pos }; s.player.zone = 'L02'; s.player.mode = 'grounded';
  notify(ctx, `${why}. Bạn được đưa về khu ở.`, 'info', 'life');
}

/** NPC có quan hệ xấu (hoặc Long hay gây áp lực) thỉnh thoảng gây sự khi ở gần người chơi. Tối đa 1 lần/ngày. */
function maybeProvoke(ctx: Ctx) {
  const s = ctx.s;
  if (!conflictEnabled(ctx) || s.conflict || inShuHold(s) || s.player.mode === 'sleeping' || s.player.mode === 'acting') return;
  if (isVN(s) && !['authorized_activity'].includes(s.custody!.phase)) return;
  const day = dayOf(s.minute);
  if (s.flags.conflict_day === day) return;
  if ((s.conflicts ?? []).some((r) => s.minute - r.minute < 2 * MIN_PER_DAY)) return; // giãn cách
  for (const def of NPCS) {
    if (def.role !== 'resident' || s.npcHolds?.[def.id]) continue;
    const rt = s.npcs[def.id];
    if (!rt || rt.absent || rt.zone !== s.player.zone || rt.activity === 'sleeping') continue;
    if (Math.hypot(rt.pos.x - s.player.pos.x, rt.pos.z - s.player.pos.z) > 5) continue;
    const rel = s.relationships[def.id];
    const hostile = def.id === 'long' ? (rel?.trust ?? 0) <= 5 : (rel?.trust ?? 0) <= -20;
    if (!hostile) continue;
    if (ctx.rng.next() < (def.id === 'long' ? 1 / 180 : 1 / 400)) {
      s.flags.conflict_day = day;
      startNpcConflict(ctx, def.id);
      return;
    }
  }
}

// ======================= Trực tuyến: người chơi ↔ người chơi / bạn tù AI =======================
// Mỗi máy chạy máy trạng thái cho người chơi của mình; hai máy chỉ trao đổi lựa chọn (gây sự, đòn, rời đi, hạ nhiệt,
// gọi cán bộ). Báo động, đội phản ứng, áp giải, điều trần chạy cục bộ trên từng máy theo cùng luật.
export interface OnlineOpponent { id: string; name: string; look: Appearance; outfit: number; x: number; z: number; bot: boolean; cid?: string }
export type FightKind = 'start' | 'strike' | 'break_away' | 'leave' | 'calm' | 'call' | 'busy';
export interface FightOut { k: FightKind; cid: string; to: string; at: number; reason?: string }
/** Hộp thư đi — controller lấy ra và gửi lên kênh phòng mỗi khung (domain không phụ thuộc mạng). */
export const conflictOutbox: FightOut[] = [];
function send(c: ConflictState, k: FightKind) {
  if (c.opp !== 'peer' || !c.peer) return;
  conflictOutbox.push({ k, cid: c.id, to: c.peer.id, at: k === 'strike' && c.playerStrikes <= 1 && c.myFirstAt ? c.myFirstAt : Date.now() });
}
export function oppName(c: ConflictState): string { return c.peer?.name ?? NPC_BY_ID[c.npcId]?.name ?? 'Bạn tù'; }

/** Điều kiện gây sự với người chơi/bạn tù trực tuyến (không có kiểm tra quan hệ NPC). */
export function canConflictOnline(ctx: Ctx): string | null {
  const s = ctx.s;
  if (!conflictEnabled(ctx)) return 'Nội dung xung đột đang tắt trong Cài đặt.';
  if (s.conflict) return 'Đang có xung đột.';
  if (inShuHold(s)) return 'Đang ở SHU.';
  if (s.player.mode === 'sleeping' || s.player.mode === 'acting') return 'Bạn đang bận.';
  if (s.life.episode.state !== 'admitted' && isVN(s)) return 'Chưa hoàn tất tiếp nhận.';
  return null;
}
/** Người chơi gây sự với người chơi khác / bạn tù trực tuyến. */
export function startPeerConflict(ctx: Ctx, o: OnlineOpponent): boolean {
  if (canConflictOnline(ctx)) return false;
  const c = begin(ctx, '', 'player', PLAYER_PROVOKE_LINE, o);
  c.line = o.bot ? NPC_REPLY_TO_PLAYER[ctx.rng.int(0, NPC_REPLY_TO_PLAYER.length - 1)] : `Bạn gây sự với ${o.name}…`;
  send(c, 'start');
  return true;
}
/** Gói xung đột nhận từ người chơi khác. Trả về gói trả lời (vd. 'busy') nếu cần. */
export function conflictRemote(ctx: Ctx, from: OnlineOpponent, k: FightKind, cidIn: string, at: number): FightOut | null {
  const s = ctx.s;
  const c = s.conflict;
  if (k === 'start') {
    const why = canConflictOnline(ctx);
    if (why) return { k: 'busy', cid: cidIn, to: from.id, at: Date.now(), reason: why };
    const nc = begin(ctx, '', 'npc', `${from.name} gây sự với bạn`, { ...from, bot: false, cid: cidIn });
    notify(ctx, `${from.name} gây sự · ra tay trước = người khởi xướng.`, 'warning', 'life');
    nc.line = 'Mày có vấn đề gì à?';
    return null;
  }
  if (!c || c.id !== cidIn || c.peer?.id !== from.id) return null;
  c.oppSeen = s.tick;
  const name = oppName(c);
  switch (k) {
    case 'busy': end(ctx, c, 'deescalated', `${name} không thể tham gia lúc này.`); return null;
    case 'leave': if (c.phase === 'tension') end(ctx, c, 'deescalated', `${name} bỏ đi.`); return null;
    case 'call': if (c.phase === 'tension') end(ctx, c, 'reported', c.provokedBy === 'player' ? `${name} gọi cán bộ · bạn bị nhắc nhở.` : `${name} gọi cán bộ · cán bộ tách hai người.`); return null;
    case 'calm':
      if (c.phase !== 'tension') return null;
      c.calmTheirs = true; log(c, `${name}: “Thôi, bỏ qua đi.”`); c.line = 'Thôi, bỏ qua đi.';
      if (c.calmMine) end(ctx, c, 'deescalated', `Cả hai cùng hạ nhiệt · ${name} bỏ đi.`);
      return null;
    case 'break_away': log(c, `${name} lùi lại.`); return null;
    case 'strike': {
      if (c.theirFirstAt === undefined) c.theirFirstAt = at;
      if (c.phase === 'tension') { startBrawl(ctx, c, 'npc'); npcStrike(ctx, c, false); } // đòn mở màn trúng người bị đánh
      else if (c.phase === 'brawl') {
        // khởi xướng = đòn đầu tiên sớm hơn theo đồng hồ hai máy; cả hai máy cùng so một cặp mốc nên kết luận giống nhau
        if (c.myFirstAt !== undefined && c.initiator === 'player' && (c.theirFirstAt < c.myFirstAt)) { c.initiator = 'npc'; log(c, `${name} ra tay trước.`); }
        const blocked = c.lastBlockTick !== undefined && s.tick - c.lastBlockTick < sec(0.9);
        npcStrike(ctx, c, blocked);
      }
      return null;
    }
  }
  return null;
}

/** NPC đang bị giữ ở SHU → vị trí neo trong buồng (để npcAi đặt). */
export function npcHoldAnchor(s: GameState, npcId: string): { x: number; z: number; zone: ZoneId } | null {
  const h = s.npcHolds?.[npcId];
  if (!h) return null;
  const r = CUSTODY_ROOM_BY_ID[h.roomId];
  return r ? { x: r.anchor.x, z: r.anchor.z, zone: r.zone } : null;
}
/** Vai trò của NPC trong xung đột hiện tại (để AI/hiển thị). */
export function npcConflictRole(s: GameState, npcId: string): 'opponent' | 'responder' | 'prone' | null {
  const c = s.conflict;
  if (!c) return null;
  if (c.npcId === npcId) return 'opponent';
  if (c.responders.includes(npcId)) return 'responder';
  const rt = s.npcs[npcId];
  if (c.alarm && c.phase !== 'tension' && rt && rt.zone === c.zone && NPC_BY_ID[npcId]?.role === 'resident') return 'prone';
  return null;
}
