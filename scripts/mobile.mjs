// Multi-device check: phone landscape/portrait + tablet with touch emulation. Screenshots + joystick movement test.
import { chromium } from 'playwright-core';
const OUT = process.argv[2] ?? '.';
const DEVICES = [
  { name: 'phone_land', viewport: { width: 844, height: 390 }, dpr: 3 },
  { name: 'phone_port', viewport: { width: 390, height: 844 }, dpr: 3 },
  { name: 'tablet', viewport: { width: 1180, height: 820 }, dpr: 2 },
];
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const d of DEVICES) {
  const ctx = await browser.newContext({ viewport: d.viewport, deviceScaleFactor: d.dpr, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/m_${d.name}_landing.png` });
  const playEnabled = await page.getByRole('button', { name: /Chơi ngay/ }).isEnabled();
  await page.evaluate(async () => { await window.__mnm.startNew({ name: 'Di động', appearance: { body: 'medium', skin: 1, hair: 0, hairColor: 0, outfit: 0 }, familyContext: 'family' }); });
  await page.waitForFunction(() => window.__mnm.view, null, { timeout: 90000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/m_${d.name}_admission.png` });
  await page.evaluate(async () => { const c = window.__mnm; const { skipAdmission } = await import('/src/domain/life.ts'); const { useUI } = await import('/src/ui/store.ts'); c.exec((x) => skipAdmission(x, { familyContext: 'family' })); useUI.getState().set({ overlay: null }); });
  await page.waitForTimeout(1500);
  const hint = page.getByRole('button', { name: 'Chơi dọc' });
  if (await hint.count()) await hint.click();
  const before = await page.evaluate(() => ({ ...window.__mnm.s.player.pos }));
  const joy = page.locator('.joystick');
  const hasJoy = await joy.count();
  if (hasJoy) {
    const b = await joy.boundingBox();
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx, cy - 50, { steps: 4 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${OUT}/m_${d.name}_game.png` });
    await page.mouse.up();
  }
  const after = await page.evaluate(() => ({ ...window.__mnm.s.player.pos }));
  await page.locator('.touch-menu button[aria-label="Đời sống"]').click().catch(() => errors.push('no life button'));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/m_${d.name}_life.png` });
  const overflowX = await page.evaluate(() => document.querySelector('.panel')?.scrollWidth > window.innerWidth + 2);
  console.log(d.name, JSON.stringify({ playEnabled, hasJoy, moved: Math.hypot(after.x - before.x, after.z - before.z).toFixed(2), panelOverflowX: overflowX, errors: errors.slice(0, 5) }));
  await ctx.close();
}
await browser.close();
