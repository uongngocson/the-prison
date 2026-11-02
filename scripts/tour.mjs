// Visual tour: start new game via debug handle, teleport through zones, screenshot + perf counters.
import { chromium } from 'playwright-core';
const URL = process.argv[2] ?? 'http://localhost:5173/';
const OUT = process.argv[3] ?? '.';
const ZONES = (process.argv[4] ?? 'L03,L05,L04,L07,L13,L10').split(',');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(URL);
await page.waitForFunction(() => !!window.__mnm);
await page.evaluate(async () => {
  const c = window.__mnm;
  await c.startNew({ name: 'Tour', appearance: { body: 'medium', skin: 2, hair: 0, hairColor: 1, outfit: 1 }, familyContext: 'family' });
});
await page.waitForFunction(() => window.__mnm.view && window.__mnm.session);
await page.evaluate(async () => {
  const c = window.__mnm;
  const { skipAdmission } = await import('/src/domain/life.ts');
  c.exec((ctx) => skipAdmission(ctx, { familyContext: 'family' }));
  const { useUI } = await import('/src/ui/store.ts');
  useUI.getState().set({ overlay: null });
});
const at = { L03: [-10, 0, Math.PI / 2], L05: [-2, 6, 0], L04: [85, -2, Math.PI / 2], L07: [31, 5, 0], L13: [-19, -5, Math.PI], L10: [56, -6, Math.PI], L02: [-26, 4, 0], L14: [48, 5, 0], L12: [13, -5, Math.PI], L09: [33, -5, Math.PI], L01: [-61, 5, 0], L06: [16, 5, 0], L08: [-4, -5, Math.PI], L11: [-61, -5, Math.PI], L15: [-33, -5, Math.PI], L16: [-46, -5, Math.PI], L17: [63, 5, 0], L18: [-46, 5, 0] };
for (const z of ZONES) {
  const [x, zz, yaw] = at[z];
  await page.evaluate(([x, zz, yaw, minute]) => {
    const c = window.__mnm; const s = c.s;
    s.player.pos = { x, y: 0, z: zz }; s.player.lastSafe = { ...s.player.pos }; s.player.yaw = yaw; c.view.yaw = yaw; c.view.pitch = 0.25;
    if (minute) { s.minute = minute; c.session.ai.snapAll(c.session.ctx); }
  }, [x, zz, yaw, z === 'L05' ? 12 * 60 : z === 'L04' ? 16 * 60 : 0]);
  await page.waitForTimeout(2500);
  const perf = await page.evaluate(() => { const v = window.__mnm.view; return { fps: Math.round(v.engine.getFps()), active: v.scene.getActiveMeshes().length, verts: v.scene.getTotalVertices(), meshes: v.scene.meshes.length, zone: window.__mnm.s.player.zone }; });
  console.log(z, JSON.stringify(perf));
  await page.screenshot({ path: `${OUT}/tour_${z}.png` });
}
console.log('ERRORS', errors.length, errors.slice(0, 10).join('\n'));
await browser.close();
