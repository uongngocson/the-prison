// N2N UI audit: đo thời gian các bước loading, mở mọi overlay/màn hình + mọi verb mở màn hình của props, gom lỗi JS, chụp ảnh.
// Dùng: node scripts/n2n.mjs <url> <outDir> <width> <height> [mode]
import { chromium } from 'playwright-core';
const URL = process.argv[2] ?? 'http://localhost:5173/';
const OUT = process.argv[3] ?? '.';
const W = Number(process.argv[4] ?? 844), H = Number(process.argv[5] ?? 390);
const MODE = process.argv[6] ?? 'fictional_life';
const mobile = W < 900;
const tag = `${mobile ? 'm' : 'd'}${W}x${H}_${MODE === 'vn_custody' ? 'vn' : 'fl'}`;
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext(mobile ? { viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } : { viewport: { width: W, height: H } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text().slice(0, 300)}`); });
const shot = (n) => page.screenshot({ path: `${OUT}/n2n_${tag}_${n}.png` });
const ev = (fn, arg) => page.evaluate(fn, arg);
const report = [];
try {
  await page.goto(URL); await page.waitForFunction(() => window.__mnm, null, { timeout: 60000 }); await page.waitForTimeout(1500);
  // loading timings
  await ev((mode) => {
    window.__stages = [];
    const t0 = performance.now();
    let last = '';
    const iv = setInterval(() => { const st = document.querySelector('.ld-row span')?.textContent ?? ''; if (st && st !== last) { window.__stages.push([st, Math.round(performance.now() - t0)]); last = st; } }, 5);
    window.__stopStages = () => clearInterval(iv);
    // long tasks
    window.__long = [];
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push(Math.round(e.duration)); }).observe({ type: 'longtask', buffered: true }); } catch {}
    window.__mnm.startNew({ name: 'Minh An', appearance: { body: 'medium', skin: 1, hair: 0, hairColor: 0, outfit: 0 }, familyContext: 'family', ...(mode === 'vn_custody' ? { experienceMode: 'vn_custody', presetId: 'VN-T05Y', segment: 'intake' } : {}) });
  }, MODE);
  const tLoad = Date.now();
  await page.waitForSelector('text=Thủ tục tiếp nhận', { timeout: 120000 });
  const stages = await ev(() => { window.__stopStages(); return { stages: window.__stages, long: window.__long.sort((a, b) => b - a).slice(0, 8) }; });
  report.push(`LOAD ${Date.now() - tLoad}ms stages=${JSON.stringify(stages.stages)} longtasks=${JSON.stringify(stages.long)}`);
  await shot('00_admission');
  await page.getByRole('button', { name: /Bỏ qua thủ tục/ }).click(); await page.waitForTimeout(1500);
  await ev(() => { const s = window.__mnm.s; s.tutorial = Object.fromEntries(Object.keys(s.tutorial).map((k) => [k, 'done'])); window.__mnm.bump(); });
  await shot('01_hud');
  // open overlays by real keys / ui (as user does)
  const opens = [
    ['map', () => window.__mnm.onKeyAction('map')],
    ['schedule', () => window.__mnm.onKeyAction('schedule')],
    ['inventory', () => window.__mnm.onKeyAction('inventory')],
    ['journal', () => window.__mnm.onKeyAction('journal')],
    ['profile', () => window.__mnm.onKeyAction('profile')],
    ['life', () => window.__mnm.onKeyAction('life')],
    ['handbook', () => window.__mnm.onKeyAction('handbook')],
    ['work', () => window.__mnm.onKeyAction('work')],
    ['custody', () => window.__mnm.onKeyAction('custody')],
    ['pause', () => window.__mnm.onKeyAction('pause')],
  ];
  for (const [name] of opens) {
    const before = errors.length;
    await ev((n) => { const fns = { map: 'map', schedule: 'schedule', inventory: 'inventory', journal: 'journal', profile: 'profile', life: 'life', handbook: 'handbook', work: 'work', custody: 'custody', pause: 'pause' }; window.__mnm.onKeyAction(fns[n]); }, name);
    await page.waitForTimeout(700);
    const vis = await ev(() => ({ overlay: !!document.querySelector('.overlay .panel, .qm-sheet'), title: document.querySelector('.panel-head h2')?.textContent ?? '' }));
    report.push(`OPEN ${name}: panel=${vis.overlay} title="${vis.title}" newErrors=${errors.length - before}`);
    await shot(`10_${name}`);
    // close via Escape
    await page.keyboard.press('Escape'); await page.waitForTimeout(250);
    const still = await ev(() => !!document.querySelector('.overlay .panel'));
    if (still) { report.push(`  !! ${name} did not close with Esc`); await ev(() => window.__mnm.session && (window.__mnm.s && null)); await ev(() => { const u = document.querySelector('.panel-close'); u?.click(); }); await page.waitForTimeout(200); }
  }
  // life tabs
  const tabs = ['journey', 'property', 'store', 'contacts', 'cases', 'support', 'programs', 'incidents', 'transfer', 'release'];
  for (const t of tabs) {
    const before = errors.length;
    await ev((t) => window.__mnm.openScreen(t === 'journey' ? 'admission' : t), t);
    await page.waitForTimeout(400);
    report.push(`LIFE ${t}: errors=${errors.length - before} panel=${await ev(() => !!document.querySelector('.overlay .panel'))}`);
    if (mobile) await shot(`20_life_${t}`);
  }
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  // mobile quick menu
  if (mobile) {
    await ev(() => { document.querySelector('.m-nav button[aria-label="Menu"]')?.click(); });
    await page.waitForTimeout(500); await shot('30_quickmenu');
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  }
  // every prop with an instant screen verb: teleport next to it and interact via controller.doVerb (same as pressing E)
  const props = await ev(async () => {
    const w = await import('/src/content/world.ts');
    const a = await import('/src/domain/actions.ts');
    const s = window.__mnm.s;
    const out = [];
    const seen = new Set();
    for (const p of w.PROPS) {
      const vs = a.verbsFor(s, p, false).filter((v) => v.instant && v.screen);
      for (const v of vs) { const k = `${p.kind}:${v.screen}`; if (seen.has(k)) continue; seen.add(k); out.push({ id: p.id, verb: v.verb, screen: v.screen, x: p.x, z: p.z, zone: p.zone, w: p.w, d: p.d, yaw: p.yaw }); }
    }
    return out;
  });
  for (const p of props) {
    const before = errors.length;
    const r = await ev((p) => {
      const c = window.__mnm; const s = c.s;
      if (c.s && document.querySelector('.overlay .panel')) document.querySelector('.panel-close')?.click();
      const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
      s.player.pos = { x: p.x + fx * (p.d / 2 + 0.6), y: 0, z: p.z + fz * (p.d / 2 + 0.6) }; s.player.zone = p.zone;
      c.session.prevPlayer = { ...s.player.pos };
      const res = c.session.interact(p.id, p.verb);
      c.doVerb(p.id, p.verb);
      return res.ok ? 'ok' : res.message;
    }, p);
    await page.waitForTimeout(450);
    const vis = await ev(() => document.querySelector('.panel-head h2')?.textContent ?? (document.querySelector('.qm-sheet') ? 'quickmenu' : ''));
    report.push(`E ${p.id} ${p.verb}->${p.screen}: ${r} panel="${vis}" errors=${errors.length - before}`);
    if (errors.length - before) await shot(`40_err_${p.id}`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    await ev(() => document.querySelector('.panel-close')?.click()); await page.waitForTimeout(100);
  }
  // overlap audit on HUD and panels (mobile): text nodes whose boxes overlap other text
  const overlaps = await ev(() => {
    const els = [...document.querySelectorAll('.mhud *, .hud *, .m-ctrl *, .touch *')].filter((e) => e.childElementCount === 0 && e.textContent.trim() && e.getBoundingClientRect().width > 0);
    const r = els.map((e) => [e, e.getBoundingClientRect()]);
    const out = [];
    for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
      const a = r[i][1], b = r[j][1];
      const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left), iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ix > 4 && iy > 4 && !r[i][0].contains(r[j][0]) && !r[j][0].contains(r[i][0])) out.push(`${r[i][0].textContent.trim().slice(0, 30)} ⟂ ${r[j][0].textContent.trim().slice(0, 30)}`);
    }
    return out.slice(0, 20);
  });
  report.push(`HUD overlaps: ${JSON.stringify(overlaps)}`);
  const dpr = await ev(() => { const c = document.querySelector('canvas#game'); return { dpr: devicePixelRatio, cw: c.width, ch: c.height, css: [c.clientWidth, c.clientHeight] }; });
  report.push(`CANVAS ${JSON.stringify(dpr)}`);
  const fps = await ev(() => window.__mnm.view?.fps());
  report.push(`FPS ${fps}`);
} catch (e) { report.push('FAIL ' + e.message.split('\n')[0]); await shot('fail'); }
console.log(report.join('\n'));
console.log('ERRORS:\n' + [...new Set(errors)].slice(0, 30).join('\n'));
await browser.close();
