// CR-LAB-01 browser walkthrough: U39 nhận ca → U43 nhận dụng cụ (L27) → luống R-01 thu hoạch/dọn → U44 bàn giao. Ảnh khu L23/L24/L25/L27/L10.
import { chromium } from 'playwright-core';
const URL = process.argv[2] ?? 'http://localhost:5173/';
const OUT = process.argv[3] ?? '.';
const W = Number(process.argv[4] ?? 1440), H = Number(process.argv[5] ?? 900);
const mobile = W < 900;
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext(mobile ? { viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: W, height: H } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[error] ${m.text()}`); });
const tag = mobile ? 'm' : 'd';
const shot = (n) => page.screenshot({ path: `${OUT}/lab_${tag}_${n}.png` });
const ev = (fn, arg) => page.evaluate(fn, arg);
const click = (loc) => (mobile ? loc.tap() : loc.click());
try {
  await page.goto(URL); await page.waitForTimeout(1200);
  await ev(() => window.__mnm.startNew({ name: 'Minh An', appearance: { body: 'medium', skin: 1, hair: 0, hairColor: 0, outfit: 0 }, familyContext: 'family' }));
  await page.waitForSelector('text=Thủ tục tiếp nhận', { timeout: 60000 });
  await click(page.getByRole('button', { name: /Bỏ qua thủ tục/ })); await page.waitForTimeout(1200);
  await ev(() => { const s = window.__mnm.s; s.tutorial = Object.fromEntries(Object.keys(s.tutorial).map((k) => [k, 'done'])); });
  // U39
  await ev(() => window.__mnm.openScreen('work')); await page.waitForTimeout(600);
  await shot('u39_hub');
  await click(page.getByRole('listitem', { name: /Vườn rau/ })); await page.waitForTimeout(300);
  await shot('u39_detail');
  // chọn ca sáng ngày mai
  const slots = page.getByRole('radio', { name: /Ngày mai · Ca sáng/ });
  await click(slots.first()); await page.waitForTimeout(200);
  await click(page.getByRole('button', { name: /^Nhận phân công$/ })); await page.waitForTimeout(500);
  await shot('u39_assigned');
  await page.keyboard.press('Escape');
  // tua tới 08:05 ngày mai, đứng ở quầy L27
  await ev(() => { const g = window.__mnm.session; const s = g.s; const day = Math.floor(s.minute / 1440) + 1; g.fastForward((day * 1440 + 485) - s.minute, false); s.player.pos = { x: 97, y: 0, z: -19.1 }; s.player.zone = 'L27'; g.prevPlayer = { ...s.player.pos }; window.__mnm.view.yaw = Math.PI; window.__mnm.bump(); });
  await page.waitForTimeout(1500);
  await shot('l27_store');
  await ev(() => window.__mnm.doVerb('tool_counter', 'lab_tools')); await page.waitForTimeout(600);
  await shot('u43_tools');
  await click(page.getByRole('button', { name: /Nhận bộ dụng cụ/ })); await page.waitForTimeout(500);
  await shot('u43_issued');
  await page.keyboard.press('Escape');
  // tới vườn rau, check-in
  await ev(() => { const g = window.__mnm.session; const s = g.s; g.fastForward(30, false); s.world.weather = 'clear'; s.world.nextWeatherMinute = s.minute + 600; s.player.pos = { x: 74.4, y: 0, z: 20.5 }; s.player.zone = 'L23'; g.prevPlayer = { ...s.player.pos }; window.__mnm.view.yaw = 0.35; window.__mnm.bump(); });
  await page.waitForTimeout(400);
  await ev(() => window.__mnm.session.fastForward(1, false)); await page.waitForTimeout(1500);
  await shot('l23_garden');
  await ev(() => window.__mnm.doVerb('plot_R-01', 'lab_view')); await page.waitForTimeout(600);
  await shot('u40_station');
  await page.keyboard.press('Escape');
  await ev(() => window.__mnm.doVerb('plot_R-01', 'lab_harvest')); await page.waitForTimeout(500);
  await shot('l23_harvesting');
  await page.waitForTimeout(4000);
  await ev(() => window.__mnm.doVerb('plot_R-01', 'lab_clean')); await page.waitForTimeout(4500);
  await shot('l23_after');
  // về kho bàn giao
  await ev(() => { const g = window.__mnm.session; const s = g.s; s.player.pos = { x: 103.5, y: 0, z: -19.9 }; s.player.zone = 'L27'; g.prevPlayer = { ...s.player.pos }; window.__mnm.bump(); });
  await page.waitForTimeout(500);
  await ev(() => window.__mnm.doVerb('scale_station', 'lab_handover')); await page.waitForTimeout(600);
  await shot('u44_before');
  await click(page.getByRole('button', { name: /Bàn giao & kết ca/ })); await page.waitForTimeout(600);
  await shot('u44_done');
  await page.keyboard.press('Escape');
  const st = await ev(() => { const l = window.__mnm.s.labour; return { a: l.assignments.map((x) => [x.workId, x.state, x.credit]), batches: l.batches.map((b) => [b.id, b.state, b.qty]), tools: l.tools.filter((t) => t.status !== 'available').length, bal: window.__mnm.s.life.account.balance }; });
  console.log('STATE', JSON.stringify(st));
  // ảnh các khu khác
  const views = [['l24_pond', 82, -18.6, Math.PI + 0.3], ['l25_landscape', 100, 16.5, 0.1], ['l10_wood', null, null, 0]];
  for (const [n, x, z, yaw] of views) {
    await ev(({ x, z, yaw }) => { const g = window.__mnm.session; const s = g.s; if (x === null) { const b = (window.__mnmProps ?? null); s.player.pos = { x: s.player.pos.x, y: 0, z: s.player.pos.z }; } else { s.player.pos = { x, y: 0, z }; } g.prevPlayer = { ...s.player.pos }; window.__mnm.view.yaw = yaw; }, { x, z, yaw });
    if (n === 'l10_wood') await ev(async () => { const w = await import('/src/content/world.ts'); const p = w.PROP_BY_ID.wood_bench; const g = window.__mnm.session; g.s.player.pos = { x: p.x, y: 0, z: p.z + 2.2 }; g.prevPlayer = { ...g.s.player.pos }; window.__mnm.view.yaw = Math.PI; });
    await page.waitForTimeout(1200);
    await shot(n);
  }
  await ev(() => window.__mnm.openScreen('work_wood')); await page.waitForTimeout(500);
  await shot('u42_wood');
} catch (e) { console.log('FAIL', e.message.split('\n')[0]); await shot('fail'); }
console.log('errors:', errors.slice(0, 10).join('\n'));
await browser.close();
