// E2E: F5 trong phòng trực tuyến — giữ trạng thái game, vào lại đúng phòng, cùng mã người chơi, giữ lịch sử chat; người kia chỉ mất B trong chốc lát.
// Dùng: node scripts/online-reload.mjs <url>
import { chromium } from 'playwright-core';
const URL = process.argv[2] ?? 'http://localhost:5173/';
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
  await page.getByRole('button', { name: /Bỏ qua thủ tục/ }).click(); await page.waitForTimeout(800);
  return page;
}
try {
  const A = await player('Minh An', { viewport: { width: 1280, height: 760 } }, 'A');
  const B = await player('Quốc Bảo', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, 'B');
  await Promise.all([A.evaluate((r) => window.__mnm.joinOnline(r), ROOM), B.evaluate((r) => window.__mnm.joinOnline(r), ROOM)]);
  const bid = await B.evaluate(() => window.__mnmOnline.id);
  await A.waitForFunction((id) => window.__mnmOnline.peers.has(id), bid, { timeout: 20000 });
  await A.evaluate(() => { const g = window.__mnm.session; g.s.player.pos = { x: 84, y: 0, z: -3 }; g.s.player.zone = 'L04'; g.prevPlayer = { ...g.s.player.pos }; });
  await B.evaluate(() => { const g = window.__mnm.session; g.s.player.pos = { x: 88, y: 0, z: -3 }; g.s.player.zone = 'L04'; g.prevPlayer = { ...g.s.player.pos }; });
  await A.evaluate(() => window.__mnmOnline.send('Tin trước khi F5', 'room'));
  await B.waitForTimeout(2500);
  const before = await B.evaluate(() => ({ minute: window.__mnm.s.minute, pos: window.__mnm.s.player.pos, lines: window.__mnmOnlineUI.getState().lines.filter((l) => !l.system).length }));
  // F5
  const t0 = Date.now();
  await B.reload(); await B.waitForFunction(() => window.__mnm, null, { timeout: 60000 });
  await B.waitForFunction(() => window.__mnmOnlineUI?.getState().status === 'online', null, { timeout: 90000 });
  const rejoinMs = Date.now() - t0;
  const after = await B.evaluate(() => ({ id: window.__mnmOnline.id, room: window.__mnmOnlineUI.getState().room, minute: window.__mnm.s.minute, pos: window.__mnm.s.player.pos, lines: window.__mnmOnlineUI.getState().lines.filter((l) => !l.system).map((l) => l.text) }));
  ok('B auto-rejoined same room after F5', after.room === ROOM, `${rejoinMs} ms`);
  ok('same player identity after F5', after.id === bid);
  ok('game state kept (time & position)', after.minute >= before.minute && Math.abs(after.pos.x - 88) < 0.5 && Math.abs(after.pos.z + 3) < 0.5, JSON.stringify(after.pos));
  ok('chat history kept', after.lines.includes('Tin trước khi F5'), JSON.stringify(after.lines));
  // A vẫn thấy B (sau vài giây ổn định)
  await A.waitForTimeout(6000);
  const aSees = await A.evaluate((id) => { const p = window.__mnmOnline.peers.get(id); return p ? { x: p.target?.x, z: p.target?.z } : null; }, bid);
  // khác khu thì không nhận vị trí (đúng thiết kế); cùng khu (sân) thì phải thấy
  ok('A still sees B after reload', !!aSees && Math.abs(aSees.x - 88) < 0.5, JSON.stringify(aSees));
  // chat 2 chiều sau F5
  await B.evaluate(() => window.__mnmOnline.send('Mình F5 xong rồi', 'room'));
  await A.evaluate(() => window.__mnmOnline.send('Thấy bạn rồi', 'room'));
  await A.waitForTimeout(2000);
  ok('B → A chat after reload', await A.evaluate(() => window.__mnmOnlineUI.getState().lines.some((l) => l.text === 'Mình F5 xong rồi')));
  ok('A → B chat after reload', await B.evaluate(() => window.__mnmOnlineUI.getState().lines.some((l) => l.text === 'Thấy bạn rồi')));
  ok('no duplicate "joined" spam', (await A.evaluate(() => window.__mnmOnlineUI.getState().lines.filter((l) => l.system && l.text.includes('vừa vào')).length)) <= 2);
  // rời chủ động → F5 không tự vào lại
  await B.evaluate(() => window.__mnm.leaveOnline()); await B.waitForTimeout(500);
  await B.reload(); await B.waitForFunction(() => window.__mnm, null, { timeout: 60000 }); await B.waitForTimeout(8000);
  ok('after leaving, F5 stays offline', await B.evaluate(() => window.__mnmOnlineUI.getState().status === 'off'));
} catch (e) { report.push('FAIL exception ' + e.message.split('\n')[0]); }
console.log(`ROOM ${ROOM}\n${report.join('\n')}\nERRORS:\n${errors.slice(0, 10).join('\n')}`);
await browser.close();
