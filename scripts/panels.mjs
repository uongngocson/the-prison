import { chromium } from 'playwright-core';
const OUT = process.argv[2];
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://localhost:5173/'); await page.waitForFunction(() => window.__mnm, null, { timeout: 60000 });
await page.waitForFunction(() => !!window.__mnm);
await page.evaluate(async () => { await window.__mnm.startNew({ name: 'Bảng', appearance: { body: 'medium', skin: 1, hair: 2, hairColor: 2, outfit: 1 }, familyContext: 'family' }); });
await page.waitForFunction(() => window.__mnm.view);
await page.evaluate(async () => {
  const c = window.__mnm; const L = await import('/src/domain/life.ts');
  c.exec((ctx) => L.skipAdmission(ctx, { familyContext: 'family' }));
  // seed life data so every tab has content
  c.exec((ctx) => { L.post(ctx, 'test:seed', 3000, 'credit', 'Thử nghiệm'); const q = L.quote(ctx, [{ itemId: 'tea', qty: 2 }]); L.placeOrder(ctx, q.quoteId, 'o1'); L.sendLetter(ctx, 'mother', 'daily', 'lt1'); L.submitCase(ctx, 'general', 0, 'c1'); L.reportIncident(ctx, 'roll_call', 'Vắng điểm danh thử', 'rc:t'); L.enroll(ctx, 'literacy'); L.requestRoomMove(ctx); });
  c.session.fastForward(14 * 60, false);
});
const overlays = [['life', 'journey'], ['life', 'property'], ['life', 'store'], ['life', 'contacts'], ['life', 'cases'], ['life', 'support'], ['life', 'programs'], ['life', 'incidents'], ['life', 'transfer'], ['life', 'release'], ['profile', 'profile'], ['profile', 'relations'], ['profile', 'skills'], ['profile', 'achievements'], ['inventory'], ['journal'], ['map'], ['schedule'], ['handbook'], ['saves'], ['settings'], ['pause'], ['notifications'], ['news'], ['library'], ['menu_board'], ['sleep']];
for (const [o, tab] of overlays) {
  await page.evaluate(async ([o, tab]) => { const { useUI } = await import('/src/ui/store.ts'); useUI.getState().set({ overlay: o, lifeTab: tab ?? 'journey', profileTab: tab ?? 'profile', overlayParams: o === 'sleep' ? { bed: 'cell_3_bed_a' } : {} }); }, [o, tab]);
  await page.waitForTimeout(700);
  const ok = await page.evaluate(() => !!document.querySelector('[role=dialog]'));
  console.log(o, tab ?? '', ok ? 'ok' : 'NO DIALOG');
  if (['store', 'cases', 'incidents', 'settings'].includes(tab ?? o)) await page.screenshot({ path: `${OUT}/p_${o}_${tab ?? ''}.png` });
}
console.log('ERRORS', errors.length, errors.slice(0, 8).join('\n'));
await browser.close();
