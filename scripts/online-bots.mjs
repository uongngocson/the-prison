// E2E bạn tù AI: người chơi thật A (máy chủ trì) + người chơi B (chỉ xem) vào phòng thử e2e-*.
// Kiểm: bạn tù xuất hiện cho cả 2 máy như người chơi, tự lại gần chào A, trả lời tin nhắn qua LLM, có độ trễ gõ, trả lời thật khi bị hỏi.
// Dùng: node scripts/online-bots.mjs <url> <outDir>
import { chromium } from 'playwright-core';
const URL = process.argv[2] ?? 'http://localhost:5173/';
const OUT = process.argv[3] ?? '.';
const ROOM = `e2e-${Date.now().toString(36)}`;
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const report = []; const errors = [];
const ok = (n, c, x = '') => report.push(`${c ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`);
async function player(name, opts, tag) {
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(() => new MutationObserver(() => { const d = [...document.querySelectorAll('[role=dialog]')].find((x) => x.textContent.includes('Vào giờ chung')); d?.querySelector('button.primary')?.click(); }).observe(document, { childList: true, subtree: true })); // CR-TIME-01: tự đồng ý chuyển tới giờ chung
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${tag}] ${e.message}`));
  await page.goto(URL); await page.waitForFunction(() => window.__mnm, null, { timeout: 60000 }); await page.waitForTimeout(1500);
  await page.evaluate((name) => window.__mnm.startNew({ name, appearance: { body: 'medium', skin: 2, hair: 1, hairColor: 0, outfit: 1 }, familyContext: 'family' }), name);
  await page.waitForSelector('text=Thủ tục tiếp nhận', { timeout: 120000 });
  await page.getByRole('button', { name: /Bỏ qua thủ tục/ }).click(); await page.waitForTimeout(600);
  await page.evaluate(() => { const g = window.__mnm.session; g.s.tutorial = Object.fromEntries(Object.keys(g.s.tutorial).map((k) => [k, 'done'])); g.s.player.pos = { x: 89, y: 0, z: -2 }; g.s.player.zone = 'L04'; g.prevPlayer = { ...g.s.player.pos }; g.s.world.weather = 'clear'; });
  return page;
}
const lines = (p) => p.evaluate(() => window.__mnmOnlineUI.getState().lines.filter((l) => !l.system).map((l) => ({ name: l.name, text: l.text, mine: l.mine, t: l.t })));
try {
  const A = await player('Minh An', { viewport: { width: 1280, height: 760 } }, 'A');
  ok('A joined', await A.evaluate((r) => window.__mnm.joinOnline(r), ROOM));
  await A.waitForFunction(() => [...window.__mnmOnline.peers.values()].filter((p) => p.bot).length >= 3, null, { timeout: 20000 });
  const roster = await A.evaluate(() => [...window.__mnmOnline.peers.values()].filter((p) => p.bot).map((p) => p.meta.name));
  ok('bạn tù appear in A\'s player list', roster.length >= 3, roster.join(', '));
  const B = await player('Quốc Bảo', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, 'B');
  await B.evaluate((r) => window.__mnm.joinOnline(r), ROOM);
  await B.waitForFunction(() => [...window.__mnmOnline.peers.values()].filter((p) => p.bot).length >= 3, null, { timeout: 20000 }).catch(() => {});
  ok('same bạn tù visible on B (not host)', (await B.evaluate(() => [...window.__mnmOnline.peers.values()].filter((p) => p.bot).length)) === roster.length);
  const hostA = await A.evaluate(() => window.__mnmOnline.isBotHost()), hostB = await B.evaluate(() => window.__mnmOnline.isBotHost());
  ok('exactly one host elected', hostA !== hostB, hostA ? 'A' : 'B');
  const uiNames = await B.evaluate(() => window.__mnmOnlineUI.getState().peers.map((p) => p.name));
  ok('UI player list shows normal names only', uiNames.every((n) => !/bot|\bai\b/i.test(n)), uiNames.join(', '));
  // một bạn tù tự lại gần và chào (A hoặc B — đứng cùng chỗ)
  const botLines = () => A.evaluate(() => { const bots = new Map([...window.__mnmOnline.peers.values()].filter((p) => p.bot).map((p) => [p.meta.id, p.meta.name])); return window.__mnmOnlineUI.getState().lines.filter((l) => bots.has(l.from)).map((l) => ({ name: l.name, text: l.text })); });
  const greeted = await A.waitForFunction(() => { const bots = new Set([...window.__mnmOnline.peers.values()].filter((p) => p.bot).map((p) => p.meta.id)); return window.__mnmOnlineUI.getState().lines.some((l) => bots.has(l.from)); }, null, { timeout: 90000 }).then(() => true).catch(() => false);
  const g = await botLines();
  ok('a bạn tù approached and greeted', greeted, g.map((l) => `${l.name}: ${l.text}`).join(' | '));
  const greeter = g[0]?.name ?? '';
  const dist = await A.evaluate((nm) => { const p = [...window.__mnmOnline.peers.values()].find((x) => x.meta.name === nm); const me = window.__mnm.s.player.pos; return p?.target ? Math.hypot(p.target.x - me.x, p.target.z - me.z) : null; }, greeter);
  ok('greeter stands next to the players', dist !== null && dist < 5, `${dist?.toFixed(1)} m`);
  await A.screenshot({ path: `${OUT}/bots_greet.png` });
  // A gọi tên bạn tù đó → trả lời bằng LLM, có độ trễ gõ
  const first = greeter.split(' ').slice(-1)[0];
  const waitReply = async (n, ms) => A.waitForFunction(([nm, n]) => { const p = [...window.__mnmOnline.peers.values()].find((x) => x.meta.name === nm); return window.__mnmOnlineUI.getState().lines.filter((l) => l.from === p?.meta.id).length > n; }, [greeter, n], { timeout: ms }).then(() => true).catch(() => false);
  const count = async () => (await botLines()).filter((l) => l.name === greeter).length;
  let n0 = await count();
  const t0 = Date.now();
  await A.evaluate((t) => window.__mnmOnline.send(t, 'near'), `${first} ơi, nay ăn cơm chưa? chiều ra sân đá bóng không`);
  const replied = await waitReply(n0, 30000);
  const rep = (await botLines()).filter((l) => l.name === greeter).slice(-1)[0];
  ok('the bạn tù replied via LLM', replied, rep ? `${rep.name}: ${rep.text}` : '');
  ok('reply had human-like typing delay (≥1.5 s)', Date.now() - t0 >= 1500, `${Date.now() - t0} ms`);
  await B.waitForTimeout(1500);
  ok('nearby player B also sees the conversation', (await B.evaluate(() => window.__mnmOnlineUI.getState().lines.map((l) => l.text))).includes(rep?.text));
  // hỏi thẳng → trả lời thật
  await A.waitForTimeout(2500);
  n0 = await count();
  await A.evaluate((t) => window.__mnmOnline.send(t, 'near'), `${first} ơi, bạn là người thật hay là AI vậy? nói thật đi`);
  await waitReply(n0, 30000);
  const honest = (await botLines()).filter((l) => l.name === greeter).slice(-1)[0];
  ok('answers honestly when asked directly', /\bAI\b|trí tuệ nhân tạo|máy|chương trình/i.test(honest?.text ?? ''), honest?.text ?? '');
  await A.screenshot({ path: `${OUT}/bots_chat.png` });
  await B.screenshot({ path: `${OUT}/bots_mobile.png` });
  // máy chủ trì rời → máy còn lại tiếp quản, bạn tù vẫn còn
  const [H, R] = hostA ? [A, B] : [B, A];
  await H.evaluate(() => window.__mnm.leaveOnline());
  const took = await R.waitForFunction(() => window.__mnmOnline.isBotHost(), null, { timeout: 20000 }).then(() => true).catch(() => false);
  await R.waitForTimeout(6000);
  ok('host hand-over: other player takes over, bạn tù stay', took && (await R.evaluate(() => [...window.__mnmOnline.peers.values()].filter((p) => p.bot && p.target).length)) >= 3);
} catch (e) { report.push('FAIL exception ' + e.message.split('\n')[0]); }
console.log(`ROOM ${ROOM}\n${report.join('\n')}\nERRORS:\n${errors.slice(0, 10).join('\n')}`);
await browser.close();
