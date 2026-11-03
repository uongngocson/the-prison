// E2E Trực tuyến: 2 trình duyệt (desktop + điện thoại) vào cùng phòng THỬ NGHIỆM trên Supabase Realtime,
// kiểm tra presence, đồng bộ vị trí, chat cả phòng / gần / riêng, chặn; chụp ảnh. Dùng: node scripts/online.mjs <url> <outDir>
import { chromium } from 'playwright-core';
const URL = process.argv[2] ?? 'http://localhost:5173/';
const OUT = process.argv[3] ?? '.';
const ROOM = `e2e-${Date.now().toString(36)}`;
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
const report = [];
const ok = (name, cond, extra = '') => { report.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };
async function player(name, opts, tag) {
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(() => new MutationObserver(() => { const d = [...document.querySelectorAll('[role=dialog]')].find((x) => x.textContent.includes('Vào giờ chung')); d?.querySelector('button.primary')?.click(); }).observe(document, { childList: true, subtree: true })); // CR-TIME-01: tự đồng ý chuyển tới giờ chung
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${tag}] ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${tag}] ${m.text().slice(0, 200)}`); });
  await page.goto(URL); await page.waitForFunction(() => window.__mnm, null, { timeout: 60000 }); await page.waitForTimeout(1500);
  await page.evaluate((name) => window.__mnm.startNew({ name, appearance: { body: 'medium', skin: name.length % 5, hair: 1, hairColor: 0, outfit: name.length % 3 }, familyContext: 'family' }), name);
  await page.waitForSelector('text=Thủ tục tiếp nhận', { timeout: 120000 });
  await page.getByRole('button', { name: /Bỏ qua thủ tục/ }).click(); await page.waitForTimeout(800);
  await page.evaluate(() => { const s = window.__mnm.s; s.tutorial = Object.fromEntries(Object.keys(s.tutorial).map((k) => [k, 'done'])); });
  return { ctx, page, tag };
}
const A = await player('Minh An', { viewport: { width: 1280, height: 760 } }, 'A');
const B = await player('Quốc Bảo', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, 'B');
try {
  const join = (p) => p.page.evaluate((room) => window.__mnm.joinOnline(room), ROOM);
  const [ja, jb] = await Promise.all([join(A), join(B)]);
  ok('both players connected', ja && jb, `${ja}/${jb}`);
  // presence
  // chờ NGƯỜI CHƠI THẬT (bạn tù có mặt ngay nên không dùng peers.size)
  await A.page.waitForFunction(() => window.__mnmOnline.realPeers().length >= 1, null, { timeout: 20000 }).catch(() => {});
  await B.page.waitForFunction(() => window.__mnmOnline.realPeers().length >= 1, null, { timeout: 20000 }).catch(() => {});
  const ids = await Promise.all([A.page.evaluate(() => window.__mnmOnline.id), B.page.evaluate(() => window.__mnmOnline.id)]);
  ok('presence: A sees B', await A.page.evaluate((id) => window.__mnmOnline.peers.has(id), ids[1]));
  ok('presence: B sees A', await B.page.evaluate((id) => window.__mnmOnline.peers.has(id), ids[0]));
  // đặt hai người cạnh nhau ở khu phòng ở, A đi về phía trước
  await A.page.evaluate(() => { const g = window.__mnm.session; g.s.player.pos = { x: -27, y: 0, z: 6 }; g.s.player.zone = 'L02'; g.prevPlayer = { ...g.s.player.pos }; window.__mnm.view.yaw = Math.PI; });
  await B.page.evaluate(() => { const g = window.__mnm.session; g.s.player.pos = { x: -27, y: 0, z: 3 }; g.s.player.zone = 'L02'; g.prevPlayer = { ...g.s.player.pos }; window.__mnm.view.yaw = 0; });
  await A.page.waitForTimeout(1500);
  const bSeesA = await B.page.waitForFunction((id) => { const p = window.__mnmOnline.peers.get(id); return p && p.target && Math.abs(p.target.x + 27) < 0.2 && Math.abs(p.target.z - 6) < 0.2; }, ids[0], { timeout: 10000 }).then(() => true).catch(() => false);
  ok('position sync A → B', bSeesA);
  await A.page.evaluate(() => { const g = window.__mnm.session; g.s.player.pos = { x: -25, y: 0, z: 6.5 }; });
  const moved = await B.page.waitForFunction((id) => { const p = window.__mnmOnline.peers.get(id); return p && Math.abs(p.target.x + 25) < 0.2; }, ids[0], { timeout: 8000 }).then(() => true).catch(() => false);
  ok('position update after move', moved);
  // chat cả phòng (gõ thật trên desktop bằng phím T)
  await A.page.mouse.click(640, 380);
  await A.page.keyboard.press('KeyT'); await A.page.waitForTimeout(400);
  await A.page.keyboard.type('Chào cả phòng, gọi mình 0912345678 nhé');
  await A.page.keyboard.press('Enter'); await A.page.waitForTimeout(300);
  const posBefore = await A.page.evaluate(() => ({ ...window.__mnm.s.player.pos }));
  await A.page.keyboard.type('www'); // gõ chữ W không được làm nhân vật đi
  await A.page.waitForTimeout(500);
  const posAfter = await A.page.evaluate(() => ({ ...window.__mnm.s.player.pos }));
  ok('typing does not move the character', Math.abs(posBefore.z - posAfter.z) < 0.01 && Math.abs(posBefore.x - posAfter.x) < 0.01);
  await A.page.keyboard.press('Control+A'); await A.page.keyboard.press('Backspace');
  await B.page.waitForTimeout(1500);
  const lineB = await B.page.evaluate(() => window.__mnmOnlineUI.getState().lines.filter((x) => !x.system).map((x) => x.text));
  ok('room chat delivered + phone masked', lineB.some((t) => t.includes('Chào cả phòng') && t.includes('[ẩn số]')), JSON.stringify(lineB));
  // chat gần + riêng từ B (điện thoại)
  await B.page.evaluate((aid) => { const o = window.__mnmOnline; o.send('Mình ở gần bạn nè', 'near'); }, ids[0]);
  await B.page.waitForTimeout(1200);
  await B.page.evaluate((aid) => { window.__mnmOnline.send('Nhắn riêng cho An', 'whisper', aid); }, ids[0]);
  await A.page.waitForTimeout(1500);
  const linesA = await A.page.evaluate(() => window.__mnmOnlineUI.getState().lines.filter((x) => !x.system).map((x) => `${x.scope}:${x.text}`));
  ok('near chat delivered within radius', linesA.some((t) => t === 'near:Mình ở gần bạn nè'), JSON.stringify(linesA));
  ok('whisper delivered to recipient', linesA.some((t) => t === 'whisper:Nhắn riêng cho An'));
  // ảnh: A thấy B (avatar + tên + bong bóng), B mở khung chat trên điện thoại
  await A.page.keyboard.press('Escape');
  await A.page.evaluate(() => { window.__mnm.view.yaw = Math.PI; });
  await A.page.waitForTimeout(800);
  await A.page.screenshot({ path: `${OUT}/online_A_desktop.png` });
  await B.page.evaluate(() => window.__mnm.openChat());
  await B.page.waitForTimeout(800);
  await B.page.screenshot({ path: `${OUT}/online_B_mobile_chat.png` });
  await B.page.evaluate(() => window.__mnmOnlineUI.getState().set({ chatOpen: false, typing: false }));
  await B.page.evaluate(() => { window.__mnm.view.yaw = 0; });
  await B.page.waitForTimeout(800);
  await B.page.screenshot({ path: `${OUT}/online_B_mobile_world.png` });
  // chặn: B chặn A rồi A gửi → B không nhận
  await B.page.evaluate((aid) => window.__mnmOnline.block(aid, true), ids[0]);
  await A.page.evaluate(() => window.__mnmOnline.send('Tin sau khi bị chặn', 'room'));
  await B.page.waitForTimeout(1500);
  const afterBlock = await B.page.evaluate(() => window.__mnmOnlineUI.getState().lines.map((x) => x.text));
  ok('blocked sender filtered on receiver', !afterBlock.some((t) => t.includes('sau khi bị chặn')));
  await B.page.evaluate((aid) => window.__mnmOnline.block(aid, false), ids[0]);
  // báo cáo vi phạm → bảng chat_reports (migration 0003)
  const rep = await B.page.evaluate((aid) => window.__mnmOnline.report(aid, 'Spam'), ids[0]);
  ok('report saved to chat_reports (0003)', rep.ok, rep.message);
  // không đọc được báo cáo (không có policy SELECT)
  const leak = await B.page.evaluate(async () => { const c = await window.__mnmCloud.sb(); const { data, error } = await c.from('chat_reports').select('*').limit(1); return { n: data?.length ?? 0, err: error?.message ?? null }; });
  ok('reports not readable by players', leak.n === 0, JSON.stringify(leak));
  await B.page.evaluate((aid) => window.__mnmOnline.block(aid, false), ids[0]);
  // NPC vẫn giả lập cục bộ (khác nhau giữa 2 máy là bình thường) — kiểm tra NPC còn chạy
  ok('NPCs still simulated locally', (await A.page.evaluate(() => Object.values(window.__mnm.s.npcs).filter((n) => !n.absent).length)) > 20);
  // rời phòng: A rời → B thấy A biến mất
  await A.page.evaluate(() => window.__mnm.leaveOnline());
  const gone = await B.page.waitForFunction((id) => !window.__mnmOnline.peers.has(id), ids[0], { timeout: 15000 }).then(() => true).catch(() => false);
  ok('leave removes peer for others', gone);
  ok('offline play continues after leaving', await A.page.evaluate(() => !!window.__mnm.session && window.__mnm.s.player !== undefined));
} catch (e) { report.push('FAIL exception ' + e.message.split('\n')[0]); }
console.log(`ROOM ${ROOM}`);
console.log(report.join('\n'));
console.log('ERRORS:\n' + errors.slice(0, 15).join('\n'));
await browser.close();
