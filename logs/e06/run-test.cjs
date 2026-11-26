// E06 headless check: node run-test.cjs <url-query> <WxH> <prefix> [maxSec]
const { chromium } = require('playwright');
const [,, query = 'autotest&q=low', size = '1024x768', prefix = 'L', maxSec = '900', shotDir = '.'] = process.argv;
const [W, H] = size.split('x').map(Number);
(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); if (m.text().startsWith('[e06]')) console.log(`[${size}] console: ${m.text()}`); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
  await page.route(/workers\.dev/, (r) => r.fulfill({ status: 204, body: '' }));
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:8765/games/e06/index.html?${query}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  console.log(`[${size}] ready in ${Date.now() - t0}ms`);
  const shots = { s1: false, s2: false, s3: false };
  let lastKey = '';
  while ((Date.now() - t0) / 1000 < +maxSec) {
    const t = await page.evaluate(() => window.__test);
    const key = `${t.state}/${t.count}`;
    if (key !== lastKey) { console.log(`[${size}] t=${((Date.now() - t0) / 1000).toFixed(1)}s ${t.state} count=${t.count} stage=${t.stage} q=${t.q} fps=${t.fps} cam=${t.cam} roller=${t.roller} sun=${t.sun}`); lastKey = key; }
    if (!shots.s1 && t.count === 1 && t.state === 'ROLLING') { await page.waitForTimeout(1600); await page.screenshot({ path: `${shotDir}/${prefix}shot-1.jpg`, type: 'jpeg', quality: 80 }); shots.s1 = true; console.log(`[${size}] shot ${prefix}shot-1.jpg`); }
    if (!shots.s2 && t.count === 12 && t.state === 'STAGE_UP' && t.stageF > 1.5) { await page.screenshot({ path: `${shotDir}/${prefix}shot-2.jpg`, type: 'jpeg', quality: 80 }); shots.s2 = true; console.log(`[${size}] shot ${prefix}shot-2.jpg`); }
    if (!shots.s3 && t.state === 'CLIMAX' && t.climaxT > 10.5) { await page.screenshot({ path: `${shotDir}/${prefix}shot-3.jpg`, type: 'jpeg', quality: 80 }); shots.s3 = true; console.log(`[${size}] shot ${prefix}shot-3.jpg (sun=${t.sun} roller=${t.roller})`); }
    if (t.done) break;
    await page.waitForTimeout(300);
  }
  const fin = await page.evaluate(() => ({ ready: window.__ready, errors: window.__errors, test: window.__test }));
  console.log(`[${size}] final ${JSON.stringify(fin)}`);
  console.log(`[${size}] consoleErrors=${JSON.stringify(consoleErrors)}`);
  const pass = fin.ready === true && fin.errors.length === 0 && consoleErrors.length === 0 && fin.test.climaxReached && fin.test.afterglowReached && fin.test.done;
  console.log(`[${size}] RESULT ${pass ? 'PASS' : 'FAIL'} (elapsed ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  await browser.close();
})().catch((e) => { console.log('FATAL', e.message); process.exit(1); });
