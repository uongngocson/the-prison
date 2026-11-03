// Theo dõi trực tuyến thời gian thực cho admin: chỉ NGHE (không track presence) — admin không bị tính là người chơi.
import { useEffect, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { sb } from './api';
import { ROOMS, validBotPos, validRoster } from '../online/protocol';
import type { GateMeta } from '../online/queue';

export interface LiveBot { id: string; name: string; room: string; zone: string; pose: string; host: string; seenAt: number }
export interface LiveState { connected: boolean; players: GateMeta[]; bots: Record<string, LiveBot>; updatedAt: number }

const EMPTY: LiveState = { connected: false, players: [], bots: {}, updatedAt: 0 };

export function useLive(): LiveState {
  const [st, setSt] = useState<LiveState>(EMPTY);
  useEffect(() => {
    let dead = false;
    const chans: RealtimeChannel[] = [];
    let client: Awaited<ReturnType<typeof sb>> | null = null;
    void (async () => {
      client = await sb();
      if (dead) return;
      const lobby = client.channel('mnm:lobby');
      lobby.on('presence', { event: 'sync' }, () => {
        const all = Object.values(lobby.presenceState() as Record<string, GateMeta[]>).flat();
        const seen = new Map<string, GateMeta>();
        for (const m of all) if (m?.id && (!seen.has(m.id) || m.state === 'playing')) seen.set(m.id, m);
        setSt((s) => ({ ...s, players: [...seen.values()].sort((a, b) => a.since - b.since), updatedAt: Date.now() }));
      }).subscribe((status) => setSt((s) => ({ ...s, connected: status === 'SUBSCRIBED' })));
      chans.push(lobby);
      for (const r of ROOMS) {
        const ch = client.channel(`mnm:${r.id}`);
        ch.on('broadcast', { event: 'bots' }, ({ payload }) => {
          if (!validRoster(payload)) return;
          setSt((s) => {
            const bots = { ...s.bots };
            for (const b of payload.bots) bots[b.id] = { ...(bots[b.id] ?? { zone: '', pose: 'idle' }), id: b.id, name: b.name, room: r.id, host: payload.host, seenAt: Date.now() };
            return { ...s, bots, updatedAt: Date.now() };
          });
        }).on('broadcast', { event: 'bpos' }, ({ payload }) => {
          if (!validBotPos(payload)) return;
          setSt((s) => {
            const bots = { ...s.bots };
            for (const b of payload.bots) if (bots[b.id]) bots[b.id] = { ...bots[b.id], zone: b.zone, pose: b.pose, seenAt: Date.now() };
            return { ...s, bots };
          });
        }).subscribe();
        chans.push(ch);
      }
    })();
    // bạn tù không được phát >15 s (máy chủ trì rời phòng) → coi như đang nghỉ
    const sweep = setInterval(() => setSt((s) => {
      const now = Date.now();
      const bots = Object.fromEntries(Object.entries(s.bots).filter(([, b]) => now - b.seenAt < 15_000));
      return Object.keys(bots).length === Object.keys(s.bots).length ? s : { ...s, bots };
    }), 5000);
    return () => { dead = true; clearInterval(sweep); for (const c of chans) void client?.removeChannel(c); };
  }, []);
  return st;
}
