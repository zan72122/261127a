// E11 autotest runner: node logs/e11/run-test.js [base_url] [mode full|smoke] [q] [outDir] [which both|landscape|portrait]
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://127.0.0.1:8771';
const mode = process.argv[3] || 'full';
const q = process.argv[4] || 'low';
const outDir = process.argv[5] || 'logs/e11';
const which = process.argv[6] || 'both';
const log = (...a) => console.log(...a);
async function run(vw, vh, tag, shots) {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, hasTouch: true });
  const consoleErr = [];
  page.on('console', m => { if (m.type() === 'error') consoleErr.push(m.text()); if (/\[autotest\]|climax|afterglow|free play|stage \d begins/.test(m.text())) log(`[${tag}] console: ${m.text()}`); });
  page.on('pageerror', e => consoleErr.push('pageerror: ' + e.message));
  await page.route('**/gf-playlog.zan72122.workers.dev/**', r => r.fulfill({ status: 204, body: '' }));
  const url = `${base}/games/e11/index.html?autotest&q=${q}`;
  const t0 = Date.now();
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  log(`[${tag}] ready in ${Date.now() - t0}ms url=games/e11/index.html?autotest&q=${q}`);
  let lastKey = '', taken = {}, maxErr = 0, frameOut = 0, bellMin = 1, bellMax = 0;
  const limit = mode === 'smoke' ? 60000 : 2400000;
  while (Date.now() - t0 < limit) {
    await page.waitForTimeout(1000);
    const T = await page.evaluate(() => ({ ...window.__test, errors: window.__errors.length }));
    maxErr = Math.max(maxErr, T.centerErr); if (!T.inFrame) frameOut++;
    if (T.mode === 'PLAY' || T.mode === 'FREE_PLAY') { bellMin = Math.min(bellMin, T.bellowsY); bellMax = Math.max(bellMax, T.bellowsY); }
    const key = `${T.state} count=${T.count}`;
    if (key !== lastKey) { log(`[${tag}] t=${((Date.now() - t0) / 1000).toFixed(1)}s ${T.state} count=${T.count}/20 stage=${T.stage} climaxT=${T.climaxT} centerErr=${T.centerErr}px inFrame=${T.inFrame} bellowsY=${T.bellowsY} fps=${T.fps} q=${T.q} errors=${T.errors}`); lastKey = key; }
    for (const s of shots) {
      if (!taken[s.name] && s.when(T)) { await page.screenshot({ path: `${outDir}/${s.name}`, type: 'jpeg', quality: s.quality || 80 }); taken[s.name] = true; log(`[${tag}] shot ${s.name} (state=${T.state} count=${T.count} climaxT=${T.climaxT})`); }
    }
    if (T.finished) break;
    if (mode === 'smoke' && T.frames > 30 && Date.now() - t0 > 20000) break;
  }
  const final = await page.evaluate(() => ({ ready: window.__ready, errors: window.__errors.slice(), test: window.__test }));
  await browser.close();
  const t = final.test;
  const pass = final.ready === true && final.errors.length === 0 && consoleErr.length === 0 && (mode === 'smoke' || (t.count === 20 && t.climax && t.peak && t.afterglow && t.free && t.freeChords >= 1 && t.finished));
  log(`[${tag}] RESULT ${pass ? 'PASS' : 'FAIL'} __ready=${final.ready} __errors=${JSON.stringify(final.errors)} consoleErrors=${JSON.stringify(consoleErr)} count=${t.count}/20 climax=${t.climax} peak=${t.peak} afterglow=${t.afterglow} freePlay=${t.free} freeChords=${t.freeChords} plays=${t.plays} ignoredPointers=${t.ignored} outsideTaps=${t.outside} maxCenterErr=${maxErr}px framesOutOfView=${frameOut} bellowsY=${bellMin}-${bellMax} elapsed=${((Date.now() - t0) / 1000).toFixed(0)}s`);
  return pass;
}
(async () => {
  let ok = true;
  if (which !== 'portrait') ok = await run(1024, 768, '1024x768', mode === 'smoke' ? [{ name: 'smoke-L.jpg', when: T => T.frames > 20 }] : [
    { name: 'shot-1.jpg', when: T => T.count >= 2 && T.state === 'IDLE' },
    { name: 'shot-2.jpg', when: T => T.count >= 12 && T.state === 'IDLE' },
    { name: 'shot-3.jpg', when: T => T.state === 'CLIMAX' && T.climaxT >= 10.5 },
  ]) && ok;
  if (which !== 'landscape') ok = await run(768, 1024, '768x1024', mode === 'smoke' ? [{ name: 'smoke-P.jpg', when: T => T.frames > 20 }] : [
    { name: 'p-shot-1.jpg', when: T => T.count >= 2 && T.state === 'IDLE' },
    { name: 'p-shot-2.jpg', when: T => T.count >= 12 && T.state === 'IDLE' },
    { name: 'p-shot-3.jpg', when: T => T.state === 'CLIMAX' && T.climaxT >= 10.5 },
  ]) && ok;
  console.log(ok ? 'ALL PASS' : 'SOME FAILED');
})();
