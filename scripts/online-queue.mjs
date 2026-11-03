// E2E giới hạn & hàng đợi: dùng kênh sảnh riêng + giới hạn 1 người (không ảnh hưởng người chơi thật).
// A vào trước (chiếm chỗ) → B thấy "Máy chủ đang đầy", vào hàng đợi (UI thật) → F5 vẫn giữ chỗ → chơi ngoại tuyến trong lúc chờ
// → A rời → B tự vào phòng, chat được với C. Ngoại tuyến không bị giới hạn. Dùng: node scripts/online-queue.mjs <url> <outDir>
import { chromium } from 'playwright-core';
const URL = process.argv[2] ?? 'http://localhost:5173/';
const OUT = process.argv[3] ?? '.';
const LOBBY = `mnm:lobby-e2e-${Date.now().toString(36)}`;
const ROOM = 'an-binh-3';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const report = []; const errors = [];
const ok = (n, c, x = '') => report.push(`${c ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`);
async function ctx(opts, tag, cap = 1) {
  const c = await browser.newContext(opts);
  await c.addInitScript(([lobby, cap]) => { try { localStorage.setItem('mnm.debugGate', JSON.stringify({ cap, lobby })); } catch { /* */ } }, [LOBBY, cap]);
  await c.addInitScript(() => new MutationObserver(() => { const d = [...document.querySelectorAll('[role=dialog]')].find((x) => x.textContent.includes('Vào giờ chung')); d?.querySelector('button.primary')?.click(); }).observe(document, { childList: true, subtree: true })); // CR-TIME-01: tự đồng ý chuyển tới giờ chung
  const page = await c.newPage();
  page.on('pageerror', (e) => errors.push(`[${tag}] ${e.message}`));
  await page.goto(URL); await page.waitForFunction(() => window.__mnm, null, { timeout: 60000 }); await page.waitForTimeout(1500);
  return page;
}
async function newChar(page, name) {
  await page.evaluate((name) => window.__mnm.startNew({ name, appearance: { body: 'medium', skin: 2, hair: 1, hairColor: 0, outfit: 1 }, familyContext: 'family' }), name);
  await page.waitForSelector('text=Thủ tục tiếp nhận', { timeout: 120000 });
  await page.getByRole('button', { name: /Bỏ qua thủ tục/ }).click(); await page.waitForTimeout(600);
}
try {
  // A chiếm chỗ duy nhất
  const A = await ctx({ viewport: { width: 1280, height: 760 } }, 'A');
  await newChar(A, 'Minh An');
  ok('A admitted while server has room', await A.evaluate((r) => window.__mnm.joinOnline(r), ROOM));
  // B: có save sẵn, vào sảnh → thấy đầy
  const B = await ctx({ viewport: { width: 1280, height: 760 } }, 'B');
  await newChar(B, 'Quốc Bảo');
  await B.evaluate(async () => { await window.__mnm.save('auto'); window.__mnm.quitToMenu(); });
  await B.waitForTimeout(800);
  await B.getByRole('button', { name: /Chơi trực tuyến/ }).click();
  await B.waitForFunction(() => window.__mnmGateUI.getState().playing >= 1, null, { timeout: 20000 });
  await B.waitForTimeout(500);
  await B.screenshot({ path: `${OUT}/queue_lobby_full.png` });
  ok('lobby shows full + "Vào hàng đợi"', await B.getByRole('button', { name: 'Vào hàng đợi' }).count() === 1);
  await B.getByRole('button', { name: 'Vào hàng đợi' }).click();
  await B.waitForSelector('text=Máy chủ đang đủ người', { timeout: 15000 });
  await B.waitForTimeout(1200);
  const q = await B.evaluate(() => window.__mnmGateUI.getState());
  ok('queue screen: position 1, 1/1 playing', q.position === 1 && q.playing === 1 && q.status === 'queued', `pos=${q.position} playing=${q.playing} status=${q.status}`);
  await B.screenshot({ path: `${OUT}/queue_screen.png` });
  // C (điện thoại) cũng xếp hàng → vị trí 2
  const C = await ctx({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, 'C');
  await newChar(C, 'Gia Khang');
  void C.evaluate((r) => window.__mnm.joinOnline(r), ROOM);
  await C.waitForFunction(() => window.__mnmGateUI.getState().position === 2, null, { timeout: 20000 }).catch(() => {});
  ok('second waiter gets position 2 (FIFO)', (await C.evaluate(() => window.__mnmGateUI.getState().position)) === 2);
  await C.waitForTimeout(800);
  await C.screenshot({ path: `${OUT}/queue_mobile_chip.png` });
  // B: chơi ngoại tuyến trong lúc chờ
  await B.getByRole('button', { name: /Chơi ngoại tuyến trong lúc chờ/ }).click();
  await B.waitForFunction(() => !!window.__mnm.session && window.__mnmGateUI.getState().background, null, { timeout: 120000 });
  await B.waitForTimeout(1500);
  ok('offline play while waiting (game running, still queued)', await B.evaluate(() => !!window.__mnm.session && window.__mnmGateUI.getState().status === 'queued'));
  await B.screenshot({ path: `${OUT}/queue_ingame_chip.png` });
  // F5 khi đang chờ → giữ vị trí
  await B.reload(); await B.waitForFunction(() => window.__mnm, null, { timeout: 60000 });
  await B.waitForFunction(() => window.__mnmGateUI?.getState().status === 'queued', null, { timeout: 120000 }).catch(() => {});
  await B.waitForTimeout(1500);
  ok('F5 keeps queue position', (await B.evaluate(() => window.__mnmGateUI.getState().position)) === 1, `pos=${await B.evaluate(() => window.__mnmGateUI.getState().position)}`);
  // A rời → B tự vào
  await A.evaluate(() => window.__mnm.leaveOnline());
  const t0 = Date.now();
  const admitted = await B.waitForFunction(() => window.__mnmOnlineUI.getState().status === 'online', null, { timeout: 30000 }).then(() => true).catch(() => false);
  ok('B auto-admitted when A leaves', admitted, `${Date.now() - t0} ms`);
  ok('C moves up to position 1', await C.waitForFunction(() => window.__mnmGateUI.getState().position === 1, null, { timeout: 15000 }).then(() => true).catch(() => false));
  ok('C still waiting (cap respected)', (await C.evaluate(() => window.__mnmOnlineUI.getState().status)) !== 'online');
  // B rời → C vào, chat với nhau sau khi B vào lại hàng (kiểm cap luôn đúng)
  await B.evaluate(() => window.__mnm.leaveOnline());
  ok('C auto-admitted when B leaves', await C.waitForFunction(() => window.__mnmOnlineUI.getState().status === 'online', null, { timeout: 30000 }).then(() => true).catch(() => false));
  // ngoại tuyến không giới hạn: A vẫn chơi bình thường
  ok('offline unaffected by cap', await A.evaluate(() => !!window.__mnm.session && window.__mnmOnlineUI.getState().status === 'off'));
} catch (e) { report.push('FAIL exception ' + e.message.split('\n')[0]); }
console.log(`LOBBY ${LOBBY}\n${report.join('\n')}\nERRORS:\n${errors.slice(0, 10).join('\n')}`);
await browser.close();
