// E09 autotest runner: node logs/e09/run-test.js [base_url] [mode full|smoke] [q] [outDir] [which both|landscape|portrait]
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://127.0.0.1:8769';
const mode = process.argv[3] || 'full';
const q = process.argv[4] || 'low';
const outDir = process.argv[5] || 'logs/e09';
const which = process.argv[6] || 'both';
const log = (...a) => console.log(...a);
async function run(vw, vh, tag, shots) {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, hasTouch: true });
  const consoleErr = [];
  page.on('console', m => { if (m.type() === 'error') consoleErr.push(m.text()); });
  page.on('pageerror', e => consoleErr.push('pageerror: ' + e.message));
  await page.route('**/gf-playlog.zan72122.workers.dev/**', r => r.fulfill({ status: 204, body: '' }));
  const url = `${base}/games/e09/index.html?autotest&q=${q}`;
  const t0 = Date.now();
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  log(`[${tag}] ready in ${Date.now() - t0}ms url=games/e09/index.html?autotest&q=${q}`);
  let lastKey = '', taken = {}, maxErr = 0;
  const limit = mode === 'smoke' ? 60000 : 2400000;
  while (Date.now() - t0 < limit) {
    await page.waitForTimeout(1000);
    const T = await page.evaluate(() => ({ ...window.__test, errors: window.__errors.length }));
    if (T.state === 'idle' || T.state === 'climax' || T.state === 'after') maxErr = Math.max(maxErr, T.centerErr);
    const key = `${T.state} done=${T.done}`;
    if (key !== lastKey) { log(`[${tag}] t=${((Date.now() - t0) / 1000).toFixed(1)}s ${T.state} done=${T.done}/18 stage=${T.stage} climaxT=${T.climaxT} centerErr=${T.centerErr}px fps=${T.fps} q=${T.q} errors=${T.errors}`); lastKey = key; }
    for (const s of shots) {
      if (!taken[s.name] && s.when(T)) { await page.screenshot({ path: `${outDir}/${s.name}`, type: 'jpeg', quality: s.quality || 78 }); taken[s.name] = true; log(`[${tag}] shot ${s.name} (state=${T.state} done=${T.done} climaxT=${T.climaxT} centerErr=${T.centerErr}px)`); }
    }
    if (T.finished) break;
    if (mode === 'smoke' && T.frames > 40 && Date.now() - t0 > 25000) break;
  }
  const final = await page.evaluate(() => ({ ready: window.__ready, errors: window.__errors.slice(), test: window.__test }));
  await browser.close();
  const t = final.test;
  const pass = final.ready === true && final.errors.length === 0 && consoleErr.length === 0 && (mode === 'smoke' || (t.done === 18 && t.climax && t.peak && t.free && t.freeWaves >= 1 && t.finished));
  log(`[${tag}] RESULT ${pass ? 'PASS' : 'FAIL'} __ready=${final.ready} __errors=${JSON.stringify(final.errors)} consoleErrors=${JSON.stringify(consoleErr)} done=${t.done}/18 climax=${t.climax} peak=${t.peak} freePlay=${t.free} freeWaves=${t.freeWaves} taps=${t.taps} ignoredPointers=${t.ignoredPointers} maxCenterErr=${maxErr}px elapsed=${((Date.now() - t0) / 1000).toFixed(0)}s`);
  return pass;
}
(async () => {
  let ok = true;
  const P = which === 'portrait' ? 'p-' : '';
  if (which !== 'portrait') ok = await run(1024, 768, '1024x768', mode === 'smoke' ? [{ name: 'smoke-L.jpg', when: T => T.frames > 30 }] : [
    { name: 'shot-1.jpg', when: T => T.done >= 2 && T.state === 'idle' },
    { name: 'shot-2.jpg', when: T => T.done >= 10 && T.state === 'idle' },
    { name: 'shot-3.jpg', when: T => T.state === 'climax' && T.climaxT >= 12.3 },
  ]) && ok;
  if (which !== 'landscape') ok = await run(768, 1024, '768x1024', mode === 'smoke' ? [{ name: 'smoke-P.jpg', when: T => T.frames > 30 }] : [
    { name: 'p-shot-1.jpg', when: T => T.done >= 2 && T.state === 'idle' },
    { name: 'p-shot-2.jpg', when: T => T.done >= 10 && T.state === 'idle' },
    { name: 'p-shot-3.jpg', when: T => T.state === 'climax' && T.climaxT >= 12.3 },
  ]) && ok;
  console.log(ok ? 'ALL PASS' : 'SOME FAILED');
})();
