// Tải Realtime: N client Supabase (mỗi client 1 websocket) cùng 1 phòng, presence + broadcast vị trí 8 Hz (trường hợp mọi người cùng di chuyển) + chat.
// Đo: vào phòng thành công, thời gian hội tụ presence, tỉ lệ nhận vị trí/chat, độ trễ chat. Dùng: node scripts/online-load.mjs 10 25 50 ...
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const SB_URL = env.VITE_SUPABASE_URL, KEY = env.VITE_SUPABASE_ANON_KEY;
const LEVELS = process.argv.slice(2).map(Number).filter(Boolean);
const POS_HZ = 8, DURATION = 20000;
const ADAPTIVE = process.env.ADAPTIVE !== '0';
// cùng công thức với src/online/protocol.ts (posHz / AREA_DELIVERY_BUDGET)
const BUDGET = Number(process.env.BUDGET ?? 300);
const hzAll = (counts) => { const pairs = counts.reduce((a, n) => a + n * Math.max(0, n - 1), 0); const total = counts.reduce((a, n) => a + n, 0); return !ADAPTIVE ? POS_HZ : pairs === 0 ? POS_HZ : Math.max(0.33, Math.min(POS_HZ, BUDGET / pairs, 80 / total)); };
const SPREAD = process.env.SPREAD === '1'; // 1: người chơi rải đều 5 khu vực; 0: tất cả cùng 1 khu (xấu nhất)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))]); };

async function level(n) {
  const room = `load-${n}-${Date.now().toString(36)}`;
  const bots = [];
  const errs = {};
  const t0 = Date.now();
  // vào phòng theo đợt 10 client/giây (giống người chơi vào dần)
  for (let i = 0; i < n; i++) {
    const c = createClient(SB_URL, KEY, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { params: { eventsPerSecond: 50 } } });
    const id = `bot${i}`;
    const area = SPREAD ? i % 5 : 0;
    const b = { id, area, c, ch: null, pch: null, joined: false, joinMs: 0, posRecv: 0, chatRecv: 0, lat: [], seenPeers: 0 };
    const ch = c.channel(`mnm:${room}`, { config: { presence: { key: id }, broadcast: { self: false } } });
    b.ch = ch;
    ch.on('presence', { event: 'sync' }, () => { b.seenPeers = Object.keys(ch.presenceState()).length; })
      .on('broadcast', { event: 'chat' }, ({ payload }) => { b.chatRecv++; b.lat.push(Date.now() - payload.t); });
    const start = Date.now();
    ch.subscribe(async (st, err) => {
      if (st === 'SUBSCRIBED' && !b.joined) { b.joined = true; b.joinMs = Date.now() - start; await ch.track({ v: 1, id, name: id, look: { body: 'medium' }, outfit: 0, joinedAt: Date.now() }); }
      else if (st !== 'SUBSCRIBED') errs[st] = (errs[st] ?? 0) + 1;
      if (err) errs[String(err.message ?? err).slice(0, 60)] = (errs[String(err.message ?? err).slice(0, 60)] ?? 0) + 1;
    });
    const pch = c.channel(`mnm:${room}:a${area}`, { config: { broadcast: { self: false } } });
    pch.on('broadcast', { event: 'pos' }, () => { b.posRecv++; });
    pch.subscribe();
    b.pch = pch;
    bots.push(b);
    if (i % 10 === 9) await sleep(1000);
  }
  // chờ tất cả vào + presence hội tụ
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline && !(bots.every((b) => b.joined) && bots.every((b) => b.seenPeers >= n))) await sleep(250);
  const joined = bots.filter((b) => b.joined).length;
  const converge = Date.now() - t0;
  const fullView = bots.filter((b) => b.seenPeers >= n).length;
  // chạy tải
  let posSent = 0, chatSent = 0, sendErr = 0;
  const live = bots.filter((b) => b.joined);
  // mỗi khu vực gửi theo tần số của số người trong khu đó
  const areaN = {}; for (const b of live) areaN[b.area] = (areaN[b.area] ?? 0) + 1;
  const timers = [];
  let posExpect = 0;
  const HZ = hzAll(Object.values(areaN));
  for (const [area, cnt] of Object.entries(areaN)) {
    const hz = HZ;
    const members = live.filter((b) => String(b.area) === area);
    timers.push(setInterval(() => { for (const b of members) { posSent++; posExpect += cnt - 1; b.pch.send({ type: 'broadcast', event: 'pos', payload: { id: b.id, x: 0, z: 0, yaw: 0, zone: 'L04', pose: 'walk', t: Date.now() } }).then((r) => { if (r !== 'ok') sendErr++; }); } }, 1000 / hz));
  }
  const iv = setInterval(() => {
    for (const b of []) { posSent++; b.ch.send({ type: 'broadcast', event: 'pos', payload: { id: b.id, x: Math.random() * 10, z: Math.random() * 10, yaw: 0, zone: 'L04', pose: 'walk', t: Date.now() } }).then((r) => { if (r !== 'ok') sendErr++; }); }
  }, 1000);
  // mỗi bot chat 1 tin / 5 giây
  const iv2 = setInterval(() => {
    for (const b of live) if (Math.random() < 0.2 * 0.5) { chatSent++; b.ch.send({ type: 'broadcast', event: 'chat', payload: { id: b.id, mid: `${b.id}_${Date.now()}`, from: b.id, name: b.id, text: 'xin chào', scope: 'room', x: 0, z: 0, t: Date.now() } }).then((r) => { if (r !== 'ok') sendErr++; }); }
  }, 500);
  await sleep(DURATION);
  clearInterval(iv); clearInterval(iv2); timers.forEach(clearInterval);
  await sleep(2000);
  const expectPos = posExpect / Math.max(1, live.length);
  const posRecv = live.reduce((a, b) => a + b.posRecv, 0) / Math.max(1, live.length);
  const expectChat = chatSent * (live.length - 1) / Math.max(1, live.length);
  const chatRecv = live.reduce((a, b) => a + b.chatRecv, 0) / Math.max(1, live.length);
  const lat = live.flatMap((b) => b.lat);
  const res = {
    users: n, spread: SPREAD, hz: Math.round(HZ * 100) / 100, perArea: Object.values(areaN), joined, fullPresence: fullView, joinP50: pct(live.map((b) => b.joinMs), 0.5), joinP95: pct(live.map((b) => b.joinMs), 0.95), convergeMs: converge,
    sentPerSec: Math.round((posSent + chatSent) / (DURATION / 1000)), posDelivery: `${Math.min(100, Math.round((posRecv / Math.max(1, expectPos)) * 100))}%`,
    chatDelivery: `${Math.min(100, Math.round((chatRecv / Math.max(1, expectChat)) * 100))}%`, chatLatP50: pct(lat, 0.5), chatLatP95: pct(lat, 0.95), sendErr, errs,
  };
  for (const b of bots) { try { await b.ch.unsubscribe(); await b.pch?.unsubscribe(); b.c.removeAllChannels(); } catch { /* ignore */ } }
  await sleep(3000);
  return res;
}
for (const n of LEVELS) { const r = await level(n); console.log(JSON.stringify(r)); }
process.exit(0);
