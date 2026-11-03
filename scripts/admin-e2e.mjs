// E2E trang admin trên Postgres + PostgREST cục bộ (Docker: postgres:15 cổng 55432 đã chạy migration + dữ liệu thử, postgrest cổng 3300, JWT secret bên dưới).
// Mạng tới Supabase thật bị chặn và chuyển sang localhost:3300. Dùng: node scripts/admin-e2e.mjs <outDir> (cần dev server :5173).
import { chromium } from 'playwright-core';
import { createHmac } from 'node:crypto';
import { readFileSync, mkdirSync } from 'node:fs';
const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const SUPA = /VITE_SUPABASE_URL=(\S+)/.exec(readFileSync('C:/game-prison-online/.env', 'utf8'))[1].trim();
const ref = new URL(SUPA).hostname.split('.')[0];
const ADMIN = '11111111-1111-1111-1111-111111111111';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (sub) => { const h = b64({ alg: 'HS256', typ: 'JWT' }), p = b64({ sub, role: 'authenticated', aud: 'authenticated', exp: 4102444800 }); return `${h}.${p}.${createHmac('sha256', 'local-test-secret-local-test-secret-xx').update(`${h}.${p}`).digest('base64url')}`; };
const report = []; const errors = [];
const ok = (n, c, x = '') => report.push(`${c ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`);
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
async function open(viewport, sub = ADMIN, scheme = 'light') {
  const ctx = await browser.newContext({ viewport, colorScheme: scheme, isMobile: viewport.width < 500, hasTouch: viewport.width < 500 });
  const token = jwt(sub);
  await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [`sb-${ref}-auth-token`, JSON.stringify({ access_token: token, refresh_token: 'x', token_type: 'bearer', expires_in: 3600 * 24 * 365, expires_at: 4102444800, user: { id: sub, email: 'admin@test.local', aud: 'authenticated', role: 'authenticated' } })]);
  await ctx.route(`${SUPA}/rest/v1/**`, async (route) => {
    const r = route.request();
    const u = new URL(r.url());
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    for (const h of ['prefer', 'accept', 'range']) { const v = r.headers()[h]; if (v) headers[h] = v; }
    const res = await fetch(`http://localhost:3300${u.pathname.replace('/rest/v1', '')}${u.search}`, { method: r.method(), headers, body: ['GET', 'HEAD'].includes(r.method()) ? undefined : r.postData() });
    const body = Buffer.from(await res.arrayBuffer());
    await route.fulfill({ status: res.status, headers: { 'content-type': res.headers.get('content-type') ?? 'application/json', 'content-range': res.headers.get('content-range') ?? '', 'access-control-allow-origin': '*' }, body });
  });
  await ctx.route(`${SUPA}/auth/v1/**`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: sub, email: 'admin@test.local' }) }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/websocket|realtime/i.test(m.text())) errors.push('console: ' + m.text().slice(0, 200)); });
  return page;
}
const step = async (name, fn) => { try { await fn(); } catch (e) { ok(name, false, e.message.split('\n')[0]); } };

const P = await open({ width: 1440, height: 900 });
await step('overview', async () => {
  await P.goto('http://localhost:5173/admin');
  await P.waitForSelector('text=Người chơi hoạt động mỗi ngày', { timeout: 30000 });
  await P.waitForTimeout(1000);
  ok('overview loads with charts', await P.locator('.ad-chart svg').count() >= 5, `${await P.locator('.ad-chart svg').count()} charts`);
  const stats = await P.locator('.ad-stat b').allInnerTexts();
  ok('stat tiles have numbers', stats.filter((s) => /\d/.test(s)).length >= 5, stats.join(' | '));
  const svg = P.locator('.ad-card.wide .ad-chart svg').first();
  const box = await svg.boundingBox();
  await P.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2);
  ok('line chart tooltip on hover', await P.locator('.ad-tip').isVisible(), (await P.locator('.ad-tip').innerText().catch(() => '')).replace(/\n/g, ' '));
  await P.screenshot({ path: `${OUT}/01-overview.png`, fullPage: true });
  await P.getByRole('button', { name: 'Bảng' }).first().click();
  ok('chart table view', await P.locator('.ad-card.wide table').isVisible());
  await P.getByRole('button', { name: 'Biểu đồ' }).first().click();
});
await step('users', async () => {
  await P.click('a[href="#users"]');
  await P.waitForSelector('.ad-table tbody tr');
  const rows = await P.locator('.ad-table tbody tr').count();
  ok('users list', rows >= 20, `${rows} rows; ${await P.locator('.ad-toolbar .ad-muted').innerText()}`);
  await P.screenshot({ path: `${OUT}/02-users.png` });
  await P.getByRole('radio', { name: 'Khách vãng lai' }).click(); await P.waitForTimeout(700);
  ok('guest filter', (await P.locator('.ad-table tbody tr').first().innerText()).includes('Khách'));
  await P.getByRole('radio', { name: 'Tài khoản' }).click(); await P.waitForTimeout(700);
  await P.locator('.ad-table tbody tr').first().click();
  await P.waitForSelector('.ad-drawer h3:has-text("Thiết bị")');
  await P.waitForTimeout(500);
  ok('account drawer with devices', (await P.locator('.ad-drawer .ad-list li').count()) > 1);
  await P.screenshot({ path: `${OUT}/03-user-drawer.png` });
  await P.getByRole('button', { name: 'Khóa trực tuyến' }).click();
  await P.screenshot({ path: `${OUT}/04-ban-dialog.png` });
  await P.locator('.ad-modal').getByRole('button', { name: 'Khóa', exact: true }).click();
  await P.waitForSelector('.ad-banner.bad', { timeout: 8000 }).catch(() => {});
  ok('ban applied', await P.locator('.ad-banner.bad').isVisible());
  await P.getByRole('button', { name: 'Mở khóa trực tuyến' }).click();
  await P.waitForTimeout(900);
  ok('unban', !(await P.locator('.ad-banner.bad').isVisible()));
  await P.keyboard.press('Escape');
});
await step('errors', async () => {
  await P.click('a[href="#errors"]');
  await P.waitForSelector('.ad-table tbody tr');
  ok('error groups', (await P.locator('.ad-table tbody tr').count()) >= 4, `${await P.locator('.ad-table tbody tr').count()} groups`);
  await P.screenshot({ path: `${OUT}/05-errors.png`, fullPage: true });
  await P.locator('.ad-table tbody tr').first().click();
  await P.waitForSelector('.ad-drawer .ad-code');
  await P.screenshot({ path: `${OUT}/06-error-drawer.png` });
  const before = await P.locator('.ad-drawer-head p').innerText();
  await P.getByRole('button', { name: 'Đánh dấu đã xử lý' }).click();
  await P.waitForTimeout(1000);
  ok('resolve error group removes it from open list', !(await P.locator('.ad-table tbody').innerText()).includes(before.slice(0, 30)), before.slice(0, 50));
});
await step('bots', async () => {
  await P.click('a[href="#bots"]');
  await P.waitForSelector('text=Danh sách bạn tù');
  await P.waitForSelector('.ad-table tbody tr');
  await P.waitForTimeout(2000);
  await P.screenshot({ path: `${OUT}/07-bots.png`, fullPage: true });
  await P.locator('.ad-table tbody tr').nth(2).click();
  await P.fill('.ad-drawer input[maxlength="24"]', 'Phong Tiểu');
  await P.screenshot({ path: `${OUT}/08-bot-editor.png` });
  await P.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await P.waitForTimeout(1200);
  ok('bot rename saved', (await P.locator('.ad-table').first().innerText()).includes('Phong Tiểu'));
  const ov = await (await fetch('http://localhost:3300/bot_overrides?select=id,name,enabled,sociable')).json();
  ok('override stores only changed fields', ov.length === 1 && ov[0].name === 'Phong Tiểu' && ov[0].sociable === null && ov[0].enabled === null, JSON.stringify(ov));
  await P.locator('.ad-table tbody tr').nth(2).click();
  await P.getByRole('button', { name: 'Khôi phục mặc định' }).click();
  await P.waitForTimeout(1000);
  ok('bot reset', (await P.locator('.ad-table').first().innerText()).includes('Thanh Phong'));
  await P.getByRole('switch', { name: 'Dùng AI' }).click(); await P.waitForTimeout(900);
  const cfg = await (await fetch('http://localhost:3300/app_config?key=eq.bots&select=value')).json();
  ok('toggle LLM saved', cfg[0].value.llm === false, JSON.stringify(cfg[0].value));
  await P.getByRole('switch', { name: 'Dùng AI' }).click(); await P.waitForTimeout(700);
});
await step('online', async () => {
  await P.click('a[href="#online"]');
  await P.waitForSelector('text=Cấu hình phòng trực tuyến');
  await P.waitForTimeout(1500);
  await P.screenshot({ path: `${OUT}/09-online.png`, fullPage: true });
  await P.fill('.ad-num', '40'); await P.getByRole('button', { name: 'Lưu', exact: true }).click(); await P.waitForTimeout(900);
  const oc = await (await fetch('http://localhost:3300/app_config?key=eq.online&select=value')).json();
  ok('online cap saved', oc[0].value.cap === 40, JSON.stringify(oc[0].value));
});
await step('reports', async () => {
  await P.click('a[href="#reports"]');
  await P.waitForSelector('.ad-reports article');
  await P.screenshot({ path: `${OUT}/10-reports.png`, fullPage: true });
  await P.locator('.ad-reports article').first().getByRole('button', { name: 'Đã xử lý' }).click();
  await P.waitForTimeout(900);
  ok('report resolved', (await P.locator('.ad-reports article').count()) === 1);
});
await step('mobile', async () => {
  const M = await open({ width: 390, height: 844 }, ADMIN, 'dark');
  await M.goto('http://localhost:5173/admin#overview');
  await M.waitForSelector('text=Người chơi hoạt động mỗi ngày', { timeout: 30000 });
  await M.waitForTimeout(1000);
  const overflow = await M.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok('mobile has no horizontal overflow', overflow <= 1, `${overflow}px`);
  await M.screenshot({ path: `${OUT}/11-mobile-dark.png`, fullPage: true });
  await M.goto('http://localhost:5173/admin#users'); await M.waitForSelector('.ad-table tbody tr'); await M.locator('.ad-table tbody tr').first().click(); await M.waitForSelector('.ad-drawer'); await M.waitForTimeout(600);
  await M.screenshot({ path: `${OUT}/12-mobile-drawer.png` });
});
await step('denied', async () => {
  const N = await open({ width: 1280, height: 800 }, '22222222-2222-2222-2222-222222222222');
  await N.goto('http://localhost:5173/admin');
  await N.waitForSelector('text=Chưa có quyền quản trị', { timeout: 20000 }).catch(() => {});
  ok('non-admin denied', await N.locator('text=Chưa có quyền quản trị').isVisible());
  await N.screenshot({ path: `${OUT}/13-denied.png` });
});
console.log(report.join('\n') + '\nERRORS:\n' + errors.slice(0, 10).join('\n'));
await browser.close();
