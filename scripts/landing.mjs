import { chromium } from 'playwright-core';
const OUT = process.argv[2];
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
for (const [n, vp, mobile] of [['desk', { width: 1920, height: 1080 }, false], ['phone', { width: 390, height: 844 }, true]]) {
  const ctx = await b.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:5173/'); await p.waitForTimeout(1200);
  await p.screenshot({ path: `${OUT}/land_${n}.png` });
  await p.locator('#slogans').scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/land_${n}_slogans.png` });
  console.log(n, 'errors', errs.length, errs.join('|'));
  await ctx.close();
}
await b.close();
