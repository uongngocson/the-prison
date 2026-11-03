import { chromium } from 'playwright-core';
const OUT = process.argv[2];
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://localhost:5173/'); await p.waitForFunction(() => window.__mnm, null, { timeout: 60000 });
await p.waitForFunction(() => !!window.__mnm, null, { timeout: 60000 });
await p.evaluate(async () => { await window.__mnm.startNew({ name: 'Song', appearance: { body: 'medium', skin: 1, hair: 0, hairColor: 0, outfit: 0 }, familyContext: 'family' }); });
await p.waitForFunction(() => window.__mnm.view && window.__mnm.session, null, { timeout: 60000 });
await p.evaluate(async () => { const c = window.__mnm; const { skipAdmission } = await import('/src/domain/life.ts'); const { useUI } = await import('/src/ui/store.ts'); c.exec((x) => skipAdmission(x, { familyContext: 'family' })); useUI.getState().set({ overlay: null }); });
const shots = [['cells', -26, 7.2, 0, 0.18], ['cellfront', -21, 8.6, 0.6, 0.12], ['zonedoor', -61, 0.9, Math.PI, 0.05]];
for (const [n, x, z, yaw, pitch] of shots) {
  await p.evaluate(([x, z, yaw, pitch, n]) => { const c = window.__mnm; const s = c.s; s.player.pos = { x, y: 0, z }; s.player.lastSafe = { ...s.player.pos }; s.player.yaw = yaw; c.view.yaw = yaw; c.view.pitch = pitch; import('/src/ui/store.ts').then(({ useUI }) => useUI.getState().set({ overlay: null })); if (n === 'zonedoor') { s.minute = 20 * 60; c.session.refreshDoors(false); for (const npc of Object.values(s.npcs)) if (Math.abs(npc.pos.x + 61) < 4 && Math.abs(npc.pos.z) < 4) { npc.absent = true; } c.view.boom = 2.2; c.view.cullDistance = 0; } }, [x, z, yaw, pitch, n]);
  for (let k = 0; k < 3; k++) { const btn = p.getByRole("button", { name: "Đóng" }); if (await btn.count()) await btn.first().click().catch(() => {}); await p.waitForTimeout(300); }
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${OUT}/bars_${n}.png` });
}
console.log('errors', errs.length, errs.join('|'));
await b.close();
