import { chromium } from 'playwright-core';
const OUT = process.argv[2];
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
for (const [n, vp, m] of [['desk', { width: 1920, height: 920 }, false], ['laptop', { width: 1366, height: 768 }, false], ['phone', { width: 390, height: 844 }, true], ['phone_land', { width: 844, height: 390 }, true]]) {
  const ctx = await b.newContext({ viewport: vp, isMobile: m, hasTouch: m });
  const p = await ctx.newPage(); const e = [];
  p.on('pageerror', (x) => e.push(x.message));
  await p.goto('http://localhost:5173/'); await p.waitForTimeout(1000);
  const scroll = await p.evaluate(() => { const h = document.querySelector('.home'); return { sh: h.scrollHeight, ch: h.clientHeight, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
  await p.screenshot({ path: `${OUT}/home_${n}.png` });
  if (n === 'desk') { await p.getByRole('button', { name: 'Châm ngôn pháp luật' }).click(); await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}/home_law.png` }); }
  console.log(n, JSON.stringify(scroll), 'errors', e.length);
  await ctx.close();
}
await b.close();
