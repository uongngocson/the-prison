// CR-CONFLICT-01 đợt 3 — cầu nối xung đột ↔ trực tuyến (gọi mỗi khung từ controller).
// • Gửi/nhận lựa chọn ẩu đả giữa hai người chơi (domain/conflict giữ luật; ở đây chỉ chuyển gói).
// • Phát "cảnh" (đối thủ NPC, đội phản ứng, báo động) để người khác cùng thấy; nhận cảnh của người khác.
// • Báo động của người khác cùng khu: người xem phải nằm xuống (GET DOWN), không chấp hành bị nhắc nhở.
import { create } from 'zustand';
import type { GameSession } from '../simulation/session';
import type { GameView } from '../presentation/gameView';
import { online } from './client';
import type { SceneActor } from './protocol';
import { NPC_BY_ID } from '../content/npcs';
import { ZONE_BY_ID } from '../content/world';
import { conflictOutbox, conflictRemote, type OnlineOpponent } from '../domain/conflict';
import { changeNeed, notify } from '../domain/core';
import type { Pose } from '../presentation/characters';
import type { NpcActivity } from '../domain/types';

/** Báo động của người chơi khác mà mình đang chứng kiến (cùng khu, ≤ 30 m). */
export interface SpectatorAlarm { from: string; name: string; zone: string; since: number }
interface SpectatorUI { alarm: SpectatorAlarm | null; prone: boolean; set: (p: Partial<SpectatorUI>) => void }
export const useSpectator = create<SpectatorUI>((set) => ({ alarm: null, prone: false, set: (p) => set(p) }));

const ACT_POSE: Partial<Record<NpcActivity, Pose>> = { fighting: 'fight', prone: 'prone', restrained: 'prone_cuffed', responding: 'restrain', walking: 'run', talking: 'talk' };
const SPECTATE_RADIUS = 30;
const COMPLY_SEC = 6;

let lastScene = 0;
let sceneOpen: string | null = null;
let warned: string | null = null;

/** Danh sách người chơi/bạn tù trực tuyến gần mình (cho focus "Gây sự", "Nhắn riêng"). */
export function nearbyOpponents(): OnlineOpponent[] {
  if (!online.active) return [];
  const out: OnlineOpponent[] = [];
  for (const p of online.peers.values()) {
    if (!p.pos || !online.sameArea(p) || online.isBlocked(p.meta.id)) continue;
    out.push({ id: p.meta.id, name: p.meta.name, look: p.meta.look, outfit: p.meta.outfit ?? p.meta.look.outfit ?? 0, x: p.pos.x, z: p.pos.z, bot: !!p.bot });
  }
  return out;
}

/** Đăng ký một lần cho phiên chơi. */
export function installFightBridge(sess: GameSession) {
  sess.peerProvider = nearbyOpponents;
  online.onFightIn = (pkt, peer) => {
    const o: OnlineOpponent = { id: peer.meta.id, name: peer.meta.name, look: peer.meta.look, outfit: peer.meta.outfit ?? 0, x: pkt.x, z: pkt.z, bot: false };
    const reply = sess.exec((ctx) => conflictRemote(ctx, o, pkt.k, pkt.cid, pkt.at));
    if (reply) online.sendFight(reply);
  };
}

/** Mỗi khung: hộp thư đi, vị trí đối thủ, cảnh phát đi, báo động của người khác. */
export function fightFrame(sess: GameSession, view: GameView, now: number) {
  const s = sess.s;
  // 1) gửi lựa chọn đã ghi trong domain
  while (conflictOutbox.length) { const m = conflictOutbox.shift()!; if (online.active) online.sendFight(m); }
  const c = s.conflict;
  // 2) vị trí đối thủ trực tuyến
  if (c?.peer) {
    const p = online.peers.get(c.peer.id);
    if (c.opp === 'bot') {
      // bạn tù AI: máy chủ trì vẫn cho đi dạo — máy mình giữ bạn tù đứng đối diện trong lúc ẩu đả
      if (c.phase === 'tension' && p?.pos) { c.oppPos = { x: p.pos.x, z: p.pos.z }; c.oppSeen = s.tick; }
      else if (c.oppPos) {
        const pp = s.player.pos, d = Math.hypot(c.oppPos.x - pp.x, c.oppPos.z - pp.z) || 1;
        if (d > 1) c.oppPos = { x: pp.x + ((c.oppPos.x - pp.x) / d) * 0.9, z: pp.z + ((c.oppPos.z - pp.z) / d) * 0.9 };
      }
    } else if (p?.pos) {
      c.oppPos = { x: p.pos.x, z: p.pos.z }; c.oppSeen = s.tick;
      // ẩu đả: máy có mã lớn hơn tự bước tới sát đối thủ (máy còn lại chỉ quay mặt) để hai nhân vật không đánh vào không khí
      if (c.phase === 'brawl' && !c.escaped) {
        const pp = s.player.pos, dx = p.pos.x - pp.x, dz = p.pos.z - pp.z, d = Math.hypot(dx, dz);
        s.player.yaw = Math.atan2(dx, dz);
        if (online.id > c.peer.id && d > 0.95) { const step = Math.min(d - 0.9, 2.5 / 30); pp.x += (dx / d) * step; pp.z += (dz / d) * step; }
      }
    }
  }
  // 3) phát cảnh của mình (~4 Hz) để người khác thấy đối thủ NPC, đội phản ứng, báo động
  if (online.active) {
    if (c && now - lastScene > 250) {
      lastScene = now;
      sceneOpen = c.id;
      const actors: SceneActor[] = [];
      if (!c.peer && c.npcId) {
        const rt = s.npcs[c.npcId], def = NPC_BY_ID[c.npcId];
        if (rt && def) actors.push({ id: c.npcId, name: def.name, look: def.appearance, outfit: 'res', x: rt.pos.x, z: rt.pos.z, yaw: rt.yaw, pose: ACT_POSE[rt.activity] ?? 'idle' });
      }
      if (c.opp === 'bot' && c.peer && c.oppPos) {
        const pp = s.player.pos;
        actors.push({ id: `peer:${c.peer.id}`, look: c.peer.look, outfit: 'res', x: c.oppPos.x, z: c.oppPos.z, yaw: Math.atan2(pp.x - c.oppPos.x, pp.z - c.oppPos.z), pose: c.phase === 'tension' ? 'talk' : c.phase === 'brawl' ? 'fight' : c.phase === 'restrain' ? 'prone_cuffed' : 'cuffed' });
      }
      // đội phản ứng: ẩu đả giữa hai người chơi chỉ một máy phát để người xem không thấy hai đội
      if (c.opp !== 'peer' || (c.peer && online.id < c.peer.id)) {
        for (const id of c.responders) {
          const rt = s.npcs[id], def = NPC_BY_ID[id];
          if (!rt || rt.absent || !def) continue;
          actors.push({ id, look: def.appearance, outfit: 'staff', x: rt.pos.x, z: rt.pos.z, yaw: rt.yaw, pose: c.phase === 'escort' ? 'walk' : ACT_POSE[rt.activity] ?? 'idle' });
        }
      }
      online.sendScene({ cid: c.id, zone: c.zone, phase: c.phase, alarm: c.alarm && c.phase !== 'tension', x: c.pos.x, z: c.pos.z, actors: actors.slice(0, 6) });
    } else if (!c && sceneOpen) {
      online.sendScene({ cid: sceneOpen, zone: s.player.zone, phase: 'end', alarm: false, x: s.player.pos.x, z: s.player.pos.z, actors: [], end: true });
      sceneOpen = null;
    }
  }
  // 4) báo động của người khác: cùng khu, đủ gần, mình không đang ẩu đả
  const sp = useSpectator.getState();
  let alarm: SpectatorAlarm | null = null;
  if (online.active && !c) {
    for (const sc of online.liveScenes()) {
      if (!sc.alarm || sc.zone !== s.player.zone) continue;
      if (Math.hypot(sc.x - s.player.pos.x, sc.z - s.player.pos.z) > SPECTATE_RADIUS) continue;
      alarm = { from: sc.from, name: online.peers.get(sc.from)?.meta.name ?? 'Người chơi', zone: sc.zone, since: sp.alarm?.from === sc.from ? sp.alarm.since : now };
      break;
    }
  }
  if (alarm && !sp.alarm) sess.exec((ctx) => notify(ctx, `BÁO ĐỘNG · ${ZONE_BY_ID[alarm!.zone as keyof typeof ZONE_BY_ID]?.name ?? ''} · GET DOWN!`, 'error', 'life'));
  if (!alarm && sp.alarm) { sp.set({ alarm: null, prone: false }); warned = null; }
  else if (alarm && (sp.alarm?.from !== alarm.from)) sp.set({ alarm, prone: false });
  const prone = !!alarm && useSpectator.getState().prone;
  sess.externalLock = prone;
  view.forcePose = prone ? 'prone' : null;
  // không nằm xuống sau vài giây → bị nhắc nhở (một lần mỗi báo động)
  if (alarm && !prone && now - alarm.since > COMPLY_SEC * 1000 && warned !== alarm.from) {
    warned = alarm.from;
    sess.exec((ctx) => { changeNeed(ctx, 'mood', -3, 'Bị nhắc nhở khi báo động'); notify(ctx, 'Không nằm xuống khi báo động · bị cán bộ nhắc nhở.', 'warning', 'life'); });
  }
}
