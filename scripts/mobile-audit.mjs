import { chromium } from 'playwright-core';
const OUT = process.argv[2];
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [tag, vp] of [['p', { width: 390, height: 844 }], ['l', { width: 844, height: 390 }]]) {
  const ctx = await b.newContext({ viewport: vp, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const shot = (n) => p.screenshot({ path: `${OUT}/${tag}_${n}.png` });
  await p.goto('http://localhost:5173/'); await p.waitForFunction(() => window.__mnm, null, { timeout: 60000 }); await p.waitForTimeout(1500);
  await shot('01_home');
  await p.getByRole('button', { name: /Chơi ngay/ }).first().click(); await p.waitForTimeout(800); await shot('02_menu');
  await p.getByRole('button', { name: /Hành trình mới/ }).click(); await p.waitForTimeout(2500); await shot('03_create');
  await p.evaluate(async () => { await window.__mnm.startNew({ name: 'An', appearance: { body: 'medium', skin: 1, hair: 0, hairColor: 0, outfit: 0 }, familyContext: 'family' }); });
  await p.waitForFunction(() => window.__mnm.view && window.__mnm.session, null, { timeout: 90000 });
  await p.waitForTimeout(1500); await shot('04_admission');
  await p.evaluate(async () => { const c = window.__mnm; const { skipAdmission } = await import('/src/domain/life.ts'); c.exec((x) => skipAdmission(x, { familyContext: 'family' })); });
  for (let k = 0; k < 3; k++) { const btn = p.getByRole('button', { name: 'Đóng' }); if (await btn.count()) await btn.first().click().catch(() => {}); await p.waitForTimeout(300); }
  await p.waitForTimeout(2500); await shot('05_hud');
  const closeAll = async () => { for (let k = 0; k < 3; k++) { const btn = p.getByRole('button', { name: 'Đóng' }); if (await btn.count()) await btn.first().click().catch(() => {}); await p.waitForTimeout(250); } };
  await p.getByRole('button', { name: 'Menu' }).first().click(); await p.waitForTimeout(600); await shot('06_quickmenu');
  for (const [lbl, n] of [['Đời sống', 'life'], ['Túi đồ', 'inventory'], ['Nhiệm vụ', 'journal'], ['Bản đồ', 'map'], ['Lịch', 'schedule'], ['Hồ sơ', 'profile'], ['Tạm dừng', 'pause'], ['Cài đặt', 'settings']]) {
    await closeAll();
    await p.getByRole('button', { name: 'Menu' }).first().click(); await p.waitForTimeout(400);
    await p.locator('.qm-item', { hasText: lbl }).first().click(); await p.waitForTimeout(800); await shot(`06_${n}`);
  }
  await closeAll();
  await p.evaluate(async () => { const c = window.__mnm; const t = c.s.npcs.tu; c.s.player.pos = { x: t.pos.x, y: 0, z: t.pos.z - 1.2 }; c.s.player.zone = t.zone; });
  await p.waitForTimeout(1500);
  await p.evaluate(() => window.__mnm.doVerb('tu', 'talk')); await p.waitForTimeout(1200); await shot('07_dialogue');
  console.log(tag, 'errors', errs.length, errs.slice(0, 3).join('|'));
  await ctx.close();
}
await b.close();
