// E13 autotest runner: node logs/e13/run-test.js [base_url] [mode full|smoke] [q] [outDir] [which both|landscape|portrait] [prefix]
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://127.0.0.1:8813';
const mode = process.argv[3] || 'full';
const q = process.argv[4] || 'low';
const outDir = process.argv[5] || 'logs/e13';
const which = process.argv[6] || 'both';
const log = (...a) => console.log(...a);
async function run(vw, vh, tag, shots) {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, hasTouch: true });
  const consoleErr = [];
  page.on('console', m => { if (m.type() === 'error') consoleErr.push(m.text()); if (/\[autotest\] (start|finished|free)|\[e13\]/.test(m.text())) log(`[${tag}] console: ${m.text()}`); });
  page.on('pageerror', e => consoleErr.push('pageerror: ' + e.message));
  await page.route('**/gf-playlog.zan72122.workers.dev/**', r => r.fulfill({ status: 204, body: '' }));
  const url = `${base}/games/e13/index.html?autotest&q=${q}`;
  const t0 = Date.now();
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  log(`[${tag}] ready in ${Date.now() - t0}ms url=games/e13/index.html?autotest&q=${q}`);
  let lastKey = '', taken = {}, maxNdc = 0, frameOut = 0, maxBloom = 0, maxExp = 0;
  const limit = mode === 'smoke' ? 60000 : 2400000;
  while (Date.now() - t0 < limit) {
    await page.waitForTimeout(700);
    const T = await page.evaluate(() => ({ ...window.__test, errors: window.__errors.length }));
    if (T.state === 'READY' || T.state === 'WAITING') maxNdc = Math.max(maxNdc, T.centerNdc || 0);
    if (!T.inFrame) frameOut++;
    maxBloom = Math.max(maxBloom, T.bloom); maxExp = Math.max(maxExp, T.exposure);
    const key = `${T.state} ${T.attached}`;
    if (key !== lastKey) { log(`[${tag}] t=${((Date.now() - t0) / 1000).toFixed(1)}s ${T.state} attached=${T.attached}/24 stage=${T.stage} climaxT=${T.climaxT} centerNdc=${T.centerNdc} inFrame=${T.inFrame} fov=${T.fov} bloom=${T.bloom} exp=${T.exposure} fps=${T.fps} q=${T.q} errors=${T.errors}`); lastKey = key; }
    for (const s of shots) {
      if (!taken[s.name] && s.when(T)) { await page.screenshot({ path: `${outDir}/${s.name}`, type: 'jpeg', quality: s.quality || 78 }); taken[s.name] = true; log(`[${tag}] shot ${s.name} (state=${T.state} attached=${T.attached} climaxT=${T.climaxT})`); }
    }
    if (T.finished) break;
    if (mode === 'smoke' && T.frames > 20 && Date.now() - t0 > 15000) break;
  }
  const final = await page.evaluate(() => ({ ready: window.__ready, errors: window.__errors.slice(), test: window.__test }));
  await browser.close();
  const t = final.test;
  const pass = final.ready === true && final.errors.length === 0 && consoleErr.length === 0 && (mode === 'smoke' || (t.attached === 24 && t.climax && t.peak && t.afterglow && t.free && t.freeTouches >= 3 && t.finished && t.celebrations === 2));
  log(`[${tag}] RESULT ${pass ? 'PASS' : 'FAIL'} __ready=${final.ready} __errors=${JSON.stringify(final.errors)} consoleErrors=${JSON.stringify(consoleErr)} attached=${t.attached}/24 stageCelebrations=${t.celebrations} climax=${t.climax} peak=${t.peak} afterglow=${t.afterglow} freePlay=${t.free} freeTouches=${t.freeTouches} taps=${t.taps} drags=${t.drags} ignoredPointers=${t.ignored} outsideTaps=${t.outside} maxTargetNdcWhileWaiting=${maxNdc} framesOutOfView=${frameOut} maxBloom=${maxBloom} maxExposure=${maxExp} elapsed=${((Date.now() - t0) / 1000).toFixed(0)}s`);
  return pass;
}
(async () => {
  let ok = true;
  const P = process.argv[7] || '';
  if (which !== 'portrait') ok = await run(1024, 768, '1024x768', mode === 'smoke' ? [{ name: P + 'smoke-L.jpg', when: T => T.frames > 15 }] : [
    { name: P + 'shot-1.jpg', when: T => T.attached >= 2 && T.state === 'WAITING' },
    { name: P + 'shot-2.jpg', when: T => T.attached >= 12 && T.state === 'UNFOLDING' },
    { name: P + 'shot-3.jpg', when: T => T.state === 'CLIMAX' && T.climaxT >= 6.0 },
  ]) && ok;
  if (which !== 'landscape') ok = await run(768, 1024, '768x1024', mode === 'smoke' ? [{ name: P + 'smoke-P.jpg', when: T => T.frames > 15 }] : [
    { name: P + 'p-shot-1.jpg', when: T => T.attached >= 2 && T.state === 'WAITING' },
    { name: P + 'p-shot-2.jpg', when: T => T.attached >= 12 && T.state === 'UNFOLDING' },
    { name: P + 'p-shot-3.jpg', when: T => T.state === 'CLIMAX' && T.climaxT >= 6.0 },
  ]) && ok;
  console.log(ok ? 'ALL PASS' : 'SOME FAILED');
})();
