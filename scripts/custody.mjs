// CR-VN-01 browser smoke: create → U36 (VN, 20 năm, tiếp nhận) → admission → wing L20 → U37/U38 → night confinement.
import { chromium } from 'playwright-core';
const URL = process.argv[2] ?? 'http://localhost:5173/';
const OUT = process.argv[3] ?? '.';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[error] ${m.text()}`); });
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
try {
  await page.goto(URL); await page.waitForFunction(() => window.__mnm, null, { timeout: 60000 }); await page.waitForTimeout(800);
  await page.getByRole('button', { name: /Chơi ngay/ }).click(); await page.waitForTimeout(400);
  await page.getByRole('button', { name: /Hành trình mới/ }).click(); await page.waitForTimeout(1500);
  await page.getByLabel(/Tên nhân vật/).fill('Minh An');
  await page.getByLabel(/Tên nhân vật/).press('Enter');
  await page.waitForSelector('text=Chọn chế độ'); await shot('c01_setup');
  await page.getByRole('radio', { name: /Thụ án/ }).click();
  await page.getByRole('radio', { name: /^20 năm$/ }).click(); await shot('c02_setup_sentence');
  // reload keeps draft
  await page.reload(); await page.waitForFunction(() => window.__mnm, null, { timeout: 60000 }); await page.waitForTimeout(1200);
  const kept = await page.evaluate(() => sessionStorage.getItem('mnm.setupDraft'));
  console.log('draft after reload:', kept ? JSON.parse(kept).presetId : null);
  await page.getByRole('button', { name: /Chơi ngay/ }).click().catch(() => {});
  await page.evaluate(() => window.__mnm && null);
  // Start directly via controller with the kept draft to avoid UI routing differences after reload
  await page.evaluate(async (d) => { const x = JSON.parse(d); await window.__mnm.startNew({ ...x.character, experienceMode: x.mode, presetId: x.presetId, segment: x.segment }); }, kept);
  await page.waitForSelector('text=Thủ tục tiếp nhận', { timeout: 60000 }); await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /Xác nhận$/ }).click(); await page.waitForTimeout(300);
  await page.getByRole('button', { name: /^Tiếp tục$/ }).click(); await page.waitForTimeout(300);
  await page.getByRole('button', { name: /^Xác nhận$/ }).click(); await page.waitForTimeout(300);
  await page.getByRole('button', { name: /^Bỏ qua$/ }).click(); await page.waitForTimeout(300);
  await page.getByRole('button', { name: /Nhận chỗ ở/ }).click(); await page.waitForTimeout(2500);
  await shot('c05_in_room');
  const st = await page.evaluate(() => { const s = window.__mnm.s; return { zone: s.player.zone, pos: s.player.pos, phase: s.custody.phase, bed: s.life.housing.find((h) => h.state === 'active')?.bedSlotId }; });
  console.log('after admission:', JSON.stringify(st));
  await page.getByRole('button', { name: /Mở hồ sơ chế độ/ }).click(); await page.waitForTimeout(800);
  await shot('c06_custody_profile');
  await page.getByRole('tab', { name: /Lịch/ }).click(); await page.waitForTimeout(300); await shot('c07_custody_movement');
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  // advance to 22:30 and try to walk out
  await page.evaluate(() => { const g = window.__mnm.session; const s = g.s; const m = s.minute % 1440; g.fastForward((22 * 60 + 30 - m + 1440) % 1440, false); window.__mnm.bump(); });
  await page.waitForTimeout(800);
  await page.mouse.click(720, 450);
  await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft'); await page.waitForTimeout(2500); await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
  await page.waitForTimeout(400);
  await shot('c08_night_try_exit');
  const st2 = await page.evaluate(() => { const s = window.__mnm.s; return { zone: s.player.zone, pos: s.player.pos, phase: s.custody.phase, toasts: s.notifications.slice(-3).map((n) => n.text) }; });
  console.log('night:', JSON.stringify(st2));
  await page.keyboard.press('KeyG'); await page.waitForTimeout(800);
  await shot('c09_incell');
  await page.getByRole('button', { name: /^Tua đến/ }).click(); await page.waitForTimeout(1500);
  const st3 = await page.evaluate(() => { const s = window.__mnm.s; return { min: s.minute % 1440, phase: s.custody.phase }; });
  console.log('after skip:', JSON.stringify(st3));
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.keyboard.press('KeyK'); await page.waitForTimeout(1200); await shot('c10_schedule');
  await page.keyboard.press('Escape'); await page.keyboard.press('KeyM'); await page.waitForTimeout(1200); await shot('c11_map');
  await page.keyboard.press('Escape');
} catch (e) { console.log('FAIL', e.message); await shot('c_fail'); }
console.log('errors:', errors.slice(0, 10).join('\n'));
await browser.close();
