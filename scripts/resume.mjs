// Reload regression: real browser + WebGL + sessionStorage + IndexedDB.
// Run against Vite dev: node scripts/resume.mjs http://127.0.0.1:5174/
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const url = process.argv[2] ?? 'http://127.0.0.1:5174/';
const ready = () => page.waitForFunction(() => !!window.__mnm?.s && !!window.__mnm?.view && !!document.querySelector('.hud'), null, { timeout: 60000 });
const reload = async () => { await page.reload(); await page.waitForFunction(() => window.__mnm, null, { timeout: 60000 }); await ready(); };
try {
  await page.goto(url); await page.waitForFunction(() => window.__mnm, null, { timeout: 60000 });
  await page.getByRole('button', { name: /Chơi ngay/ }).click();
  await page.getByRole('button', { name: /Hành trình mới/ }).click();
  await page.getByLabel(/Tên hiển thị/).fill('Khôi phục');
  await page.getByRole('button', { name: /Bắt đầu hành trình/ }).click();
  await ready();
  const lineage = await page.evaluate(() => window.__mnm.s.lineageId);
  // Refresh before the first minute / before completing admission.
  await reload();
  assert.equal(await page.evaluate(() => window.__mnm.s.lineageId), lineage);
  assert.equal(await page.evaluate(async () => (await import('/src/ui/store.ts')).useUI.getState().overlay), 'life');
  console.log('PASS new journey reload before first autosave');

  const before = await page.evaluate(async () => {
    const c = window.__mnm;
    const { skipAdmission, post, sendLetter, submitCase } = await import('/src/domain/life.ts');
    const { addItem } = await import('/src/domain/core.ts');
    const { useUI } = await import('/src/ui/store.ts');
    c.exec((ctx) => {
      skipAdmission(ctx, { familyContext: 'family' });
      addItem(ctx, 'tea', 2, { overflow: 'mailbox' });
      post(ctx, 'reload:credit', 1200, 'credit', 'Test');
      sendLetter(ctx, 'mother', 'daily', 'reload:letter');
      submitCase(ctx, 'general', 0, 'reload:case');
      ctx.s.flags.reload_probe = 'retained';
    });
    c.slot = 'slot2';
    c.view.yaw = 1.1; c.view.pitch = 0.25; c.view.boom = 3.2; c.view.shoulder = -1;
    useUI.getState().set({ overlay: 'life', lifeTab: 'contacts', waypoint: 'L07' });
    c.session.paused = true;
    c.checkpoint();
    return JSON.parse(JSON.stringify({ lineage: c.s.lineageId, pos: c.s.player.pos, minute: c.s.minute, inventory: c.s.inventory, life: c.s.life, quests: c.s.quests, needs: c.s.needs, npc: c.s.npcs.tu.pos }));
  });
  await reload();
  const after = await page.evaluate(async () => {
    const c = window.__mnm;
    const { useUI } = await import('/src/ui/store.ts');
    const u = useUI.getState();
    return { state: { lineage: c.s.lineageId, pos: c.s.player.pos, minute: c.s.minute, inventory: c.s.inventory, life: c.s.life, quests: c.s.quests, needs: c.s.needs, npc: c.s.npcs.tu.pos }, slot: c.slot, camera: [c.view.yaw, c.view.pitch, c.view.boom, c.view.shoulder], overlay: u.overlay, tab: u.lifeTab, waypoint: u.waypoint, flag: c.s.flags.reload_probe };
  });
  assert.deepEqual(after.state, before);
  assert.deepEqual(after.camera, [1.1, 0.25, 3.2, -1]);
  assert.equal(after.slot, 'slot2');
  assert.equal(after.tab, 'contacts');
  assert.equal(after.overlay, 'life');
  assert.equal(after.waypoint, 'L07');
  assert.equal(after.flag, 'retained');
  console.log('PASS gameplay + inventory + finance/cases/letters + quests + needs + NPC + camera + UI restore');

  await page.evaluate(async () => {
    const c = window.__mnm;
    const { useUI } = await import('/src/ui/store.ts');
    const n = c.s.npcs.tu;
    n.absent = false; n.activity = 'idle'; n.pos = { ...c.s.player.pos, x: c.s.player.pos.x + 0.5 };
    c.session.talk('tu');
    c.refreshDialogue();
    useUI.getState().set({ overlay: 'pause' });
    c.session.paused = true;
    c.checkpoint();
  });
  const dialogue = await page.evaluate(() => JSON.parse(JSON.stringify(window.__mnm.session.dialogue)));
  assert.ok(dialogue);
  const talks = await page.evaluate(() => window.__mnm.s.stats.talks);
  await reload();
  assert.deepEqual(await page.evaluate(() => window.__mnm.session.dialogue), dialogue);
  assert.equal(await page.evaluate(() => window.__mnm.s.stats.talks), talks);
  console.log('PASS dialogue restored without re-entering / duplicating effects');

  await page.evaluate(async () => {
    const c = window.__mnm;
    c.endDialogue();
    c.s.player.mode = 'acting';
    c.s.player.action = { actionId: 'reload-action', verb: 'read', targetId: 'probe', startMinute: c.s.minute, elapsedMin: 12, durationMin: 30, committed: false };
    c.s.world.reservations['player:probe'] = 'player';
    c.checkpoint();
  });
  await reload();
  assert.equal(await page.evaluate(() => window.__mnm.s.player.action?.elapsedMin), 12);
  assert.equal(await page.evaluate(() => window.__mnm.s.world.reservations['player:probe']), 'player');
  console.log('PASS in-flight action/reservation restored');

  // Independent tabs do not auto-enter another tab's world.
  const other = await context.newPage();
  await other.goto(url); await other.waitForFunction(() => window.__mnm, null, { timeout: 60000 });
  await other.getByRole('button', { name: /Chơi ngay/ }).waitFor();
  assert.equal(await other.evaluate(() => window.__mnm.s), null);
  await other.close();
  console.log('PASS tab isolation');

  // Last-moment changes saved by lifecycle even before the next interval.
  await page.evaluate(() => { window.__mnm.s.flags.lifecycle_probe = 'last-moment'; window.dispatchEvent(new PageTransitionEvent('pagehide')); });
  await reload();
  assert.equal(await page.evaluate(() => window.__mnm.s.flags.lifecycle_probe), 'last-moment');
  console.log('PASS lifecycle checkpoint');

  await page.evaluate(async () => {
    const c = window.__mnm;
    c.session.cancelAction();
    const { useUI } = await import('/src/ui/store.ts');
    useUI.getState().open(null);
  });
  await page.bringToFront();
  await page.waitForFunction(() => window.__mnm.view.gameplayInput && !window.__mnm.session.paused);
  const tickBefore = await page.evaluate(() => window.__mnm.s.tick);
  await page.keyboard.down('KeyW');
  await page.waitForFunction((tick) => window.__mnm.s.tick > tick + 3, tickBefore, { timeout: 30000 });
  await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyJ');
  await page.waitForSelector('.overlay');
  assert.ok(await page.evaluate(() => window.__mnm.s.tick) > tickBefore);
  await reload();
  assert.equal(await page.evaluate(async () => (await import('/src/ui/store.ts')).useUI.getState().overlay), 'journal');
  console.log('PASS simulation/input after resume and keyboard-opened panel reload');

  // A deliberate quit must not auto-resume on the next reload. Durable saves remain.
  await page.evaluate(async () => { const c = window.__mnm; await c.save('slot1'); c.quitToMenu(); });
  await page.reload(); await page.waitForFunction(() => window.__mnm, null, { timeout: 60000 });
  await page.getByRole('button', { name: /Chơi ngay/ }).waitFor();
  assert.equal(await page.evaluate(() => window.__mnm.s), null);
  const slots = await page.evaluate(async () => (await import('/src/persistence/localStore.ts')).listSlots());
  assert.ok(slots.find((s) => s.id === 'slot1')?.latest);
  console.log('PASS explicit quit clears resume and retains durable save');

  // Restore an ended journey as its ending, never as a new playable episode.
  await page.evaluate(async () => {
    const c = window.__mnm;
    await c.continueFrom('slot1');
    c.s.ended = true;
    c.s.life.episode.state = 'released';
    const { useUI } = await import('/src/ui/store.ts');
    useUI.getState().set({ screen: 'ending', overlay: null });
    c.checkpoint();
  });
  await page.reload(); await page.waitForFunction(() => window.__mnm, null, { timeout: 60000 });
  await page.getByRole('button', { name: /Chơi tự do/ }).waitFor({ timeout: 60000 });
  assert.equal(await page.evaluate(() => window.__mnm.s.ended), true);
  const endMinute = await page.evaluate(() => window.__mnm.s.minute);
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => window.__mnm.s.minute), endMinute);
  await page.evaluate(() => window.__mnm.quitToMenu());
  console.log('PASS ending reload stays ended and paused');

  // Corrupt journal must provide recovery, not silently start over.
  await page.evaluate(() => { sessionStorage.setItem('mot-ngay-moi:resume:v1', 'corrupt'); sessionStorage.setItem('mot-ngay-moi:resume:v1:previous', 'also corrupt'); });
  await page.reload(); await page.waitForFunction(() => window.__mnm, null, { timeout: 60000 });
  await page.getByRole('button', { name: 'Thử lại', exact: true }).waitFor();
  assert.ok(await page.evaluate(() => sessionStorage.getItem('mot-ngay-moi:resume:v1')));
  await page.getByRole('button', { name: 'Về menu', exact: true }).click();
  await page.getByRole('button', { name: /Tiếp tục —/ }).waitFor();
  assert.equal(await page.evaluate(() => window.__mnm.s), null);
  console.log('PASS corrupt data recovery path');
  assert.deepEqual(errors, []);
  console.log('PASS no browser runtime errors');
} catch (error) {
  console.error('BROWSER_ERRORS', errors);
  console.error('PAGE', await page.locator('body').innerText().catch(() => 'unavailable'));
  throw error;
} finally {
  await context.close();
  await browser.close();
}
