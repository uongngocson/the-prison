// E2E CR-TIME-01: hai người chơi (B có đồng hồ máy lệch +3 giờ, save ở ngày/giờ khác) vào cùng phòng thử e2e-*.
// Kiểm: hộp xác nhận chuyển giờ, cùng giờ trại/thứ/thời tiết/cửa sân, mở panel không dừng đồng hồ, F5 khớp lại không hỏi,
// bạn tù theo lịch, rời phòng thì về đồng hồ riêng. Dùng: node scripts/online-clock.mjs <url> <outDir>
import { chromium } from 'playwright-core';
const URL = process.argv[2] ?? 'http://localhost:5173/';
const OUT = process.argv[3] ?? '.';
const ROOM = `e2e-${Date.now().toString(36)}`;
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const report = []; const errors = [];
const ok = (n, c, x = '') => report.push(`${c ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`);
const SKEW_MS = 3 * 3600_000;

async function player(name, opts, tag, skew = 0) {
  const ctx = await browser.newContext(opts);
  if (skew) await ctx.addInitScript((ms) => { const real = Date.now.bind(Date); Date.now = () => real() + ms; }, skew);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${tag}] ${e.message}`));
  await page.goto(URL); await page.waitForFunction(() => window.__mnm, null, { timeout: 60000 });
  await page.evaluate((name) => window.__mnm.startNew({ name, appearance: { body: 'medium', skin: 2, hair: 1, hairColor: 0, outfit: 1 }, familyContext: 'family' }), name);
  await page.waitForSelector('text=Thủ tục tiếp nhận', { timeout: 120000 });
  await page.getByRole('button', { name: /Bỏ qua thủ tục/ }).click(); await page.waitForTimeout(600);
  await page.evaluate(() => { const g = window.__mnm.session; g.s.tutorial = Object.fromEntries(Object.keys(g.s.tutorial).map((k) => [k, 'done'])); g.s.player.pos = { x: 89, y: 0, z: -2 }; g.s.player.zone = 'L04'; g.prevPlayer = { ...g.s.player.pos }; });
  return page;
}
/** Trạng thái đồng hồ của một máy. */
const clock = (p) => p.evaluate(() => {
  const g = window.__mnm.session, s = g.s;
  const shared = window.__mnmTime.sharedMinuteNow();
  return { local: s.minute, mod: s.minute % 1440, sharedMod: ((shared % 1440) + 1440) % 1440, day: Math.floor(s.minute / 1440) + 1, weekday: (Math.floor(s.minute / 1440) + (s.online?.weekShift ?? 0)) % 7, sharedWeekday: ((Math.floor(shared / 1440) % 7) + 7) % 7, weather: s.world.weather, yard: s.world.doors.door_L04?.state ?? 'open', attached: !!g.shared, online: s.online ?? null };
});
const modDiff = (a, b) => { const d = Math.abs(a - b) % 1440; return Math.min(d, 1440 - d); };
async function join(p, label) {
  const done = p.evaluate((r) => window.__mnm.joinOnline(r), ROOM);
  const prompted = await p.waitForSelector('text=Vào giờ chung của phân khu', { timeout: 20000 }).then(() => true).catch(() => false);
  if (prompted) { await p.screenshot({ path: `${OUT}/clock_prompt_${label}.png` }); await p.getByRole('button', { name: 'Vào phòng' }).click(); }
  return { joined: await done, prompted };
}

try {
  const A = await player('Minh An', { viewport: { width: 1280, height: 760 } }, 'A');
  const B = await player('Quốc Bảo', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, 'B', SKEW_MS);
  // B chơi ngoại tuyến tới ngày khác, giờ khác trước khi vào phòng
  await B.evaluate(() => { const g = window.__mnm.session; g.fastForward(4 * 1440 + 11 * 60, false); });
  const b0 = await clock(B);
  ok('B offline on a different day before joining', b0.day >= 5, `Ngày ${b0.day}`);

  const ja = await join(A, 'A');
  ok('A joined (with clock prompt if needed)', ja.joined, ja.prompted ? 'có hộp xác nhận' : 'không cần hỏi');
  const jb = await join(B, 'B');
  ok('B joined despite +3h device clock skew', jb.joined, jb.prompted ? 'có hộp xác nhận' : 'không cần hỏi');
  await A.waitForTimeout(2000);
  let [ca, cb] = [await clock(A), await clock(B)];
  ok('both attached to shared clock', ca.attached && cb.attached);
  ok('QA39 same camp time on both', modDiff(ca.mod, cb.mod) <= 1, `A ${ca.mod.toFixed(1)} · B ${cb.mod.toFixed(1)} · chung ${ca.sharedMod.toFixed(1)}`);
  ok('QA40 skewed device follows server time', modDiff(cb.mod, ca.sharedMod) <= 1.5, `B ${cb.mod.toFixed(1)} vs chung ${ca.sharedMod.toFixed(1)}`);
  ok('personal days differ (each inmate keeps own day count)', ca.day !== cb.day, `A Ngày ${ca.day} · B Ngày ${cb.day}`);
  ok('D5 same weekday', ca.weekday === cb.weekday && ca.weekday === ca.sharedWeekday, `${ca.weekday}/${cb.weekday}/${ca.sharedWeekday}`);
  ok('QA43 same weather and yard door', ca.weather === cb.weather && ca.yard === cb.yard, `${ca.weather}/${cb.weather} · sân ${ca.yard}/${cb.yard}`);
  ok('local minute never went backwards on join', cb.local >= b0.local, `${b0.local.toFixed(0)} → ${cb.local.toFixed(0)}`);
  ok('HUD shows shared-time badge', await A.locator('.clock-shared').isVisible());
  await A.screenshot({ path: `${OUT}/clock_hud_A.png` });
  await B.screenshot({ path: `${OUT}/clock_hud_B.png` });

  // QA41: mở panel không dừng đồng hồ chung
  const a1 = await clock(A);
  await A.evaluate(() => window.__mnm.openScreen('inventory'));
  await A.waitForTimeout(8000);
  const a2 = await clock(A); const b2 = await clock(B);
  ok('QA41 clock keeps running while a panel is open', a2.local - a1.local > 2.5, `+${(a2.local - a1.local).toFixed(1)} phút game trong 8 s`);
  ok('still aligned after panel', modDiff(a2.mod, b2.mod) <= 1, `A ${a2.mod.toFixed(1)} · B ${b2.mod.toFixed(1)}`);
  await A.keyboard.press('Escape');

  // QA42: không tua được khi trực tuyến
  await A.evaluate(() => window.__mnm.onKeyAction('skip'));
  const a3 = await clock(A);
  ok('QA42 skip does not jump ahead', a3.local - (a3.local - a3.mod) <= a3.sharedMod + 1 && modDiff(a3.mod, a3.sharedMod) <= 1);

  // QA46: bạn tù theo lịch chung (đợi họ đi tới khu)
  await A.waitForTimeout(40000);
  const botInfo = await A.evaluate(() => [...window.__mnmOnline.peers.values()].filter((p) => p.bot).map((p) => ({ name: p.meta.name, zone: p.zone })));
  const nowMod = (await clock(A)).sharedMod;
  ok('QA46 bots present', botInfo.length >= 3, botInfo.map((b) => `${b.name}@${b.zone}`).join(', ') + ` · ${Math.floor(nowMod / 60)}:${String(Math.floor(nowMod % 60)).padStart(2, '0')}`);

  // QA45: F5 trên B → tự vào lại, khớp giờ, không hỏi lại
  await B.reload(); await B.waitForFunction(() => window.__mnm, null, { timeout: 60000 });
  const reattached = await B.waitForFunction(() => window.__mnm.session?.shared, null, { timeout: 60000 }).then(() => true).catch(() => false);
  const askedAgain = await B.locator('text=Vào giờ chung của phân khu').isVisible().catch(() => false);
  const [cr, ar] = [await clock(B), await clock(A)];
  ok('QA45 F5 rejoins and re-aligns without asking', reattached && !askedAgain && modDiff(cr.mod, ar.mod) <= 1, `A ${ar.mod.toFixed(1)} · B ${cr.mod.toFixed(1)}`);

  // QA47: rời phòng → đồng hồ riêng (mở panel thì đứng)
  await A.evaluate(() => window.__mnm.leaveOnline());
  await A.waitForTimeout(800);
  const l1 = await clock(A);
  await A.evaluate(() => window.__mnm.openScreen('inventory'));
  await A.waitForTimeout(3000);
  const l2 = await clock(A);
  ok('QA47 after leaving: own clock again (pauses with a panel open)', !l1.attached && Math.abs(l2.local - l1.local) < 0.05, `+${(l2.local - l1.local).toFixed(2)} phút`);
} catch (e) { report.push('FAIL exception ' + e.message.split('\n')[0]); }
console.log(`ROOM ${ROOM}\n${report.join('\n')}\nERRORS:\n${errors.slice(0, 10).join('\n')}`);
await browser.close();
