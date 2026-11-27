// E08 autotest runner: node logs/e08/run-test.js [base_url] [mode] [q] [outDir] [which] [w] [h]
// mode: full (default) | smoke
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://127.0.0.1:8768';
const mode = process.argv[3] || 'full';
const q = process.argv[4] || 'low';
const outDir = process.argv[5] || 'logs/e08';
const which = process.argv[6] || 'both';
const log = (...a) => console.log(...a);
async function run(vw, vh, tag, shots) {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, hasTouch: true });
  const consoleErr = [];
  page.on('console', m => { if (m.type() === 'error') consoleErr.push(m.text()); });
  page.on('pageerror', e => consoleErr.push('pageerror: ' + e.message));
  await page.route('**/gf-playlog.zan72122.workers.dev/**', r => r.fulfill({ status: 204, body: '' }));
  const url = `${base}/games/e08/index.html?autotest&q=${q}`;
  const t0 = Date.now();
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  log(`[${tag}] ready in ${Date.now() - t0}ms url=games/e08/index.html?autotest&q=${q}`);
  let lastKey = '', taken = {}, T = null;
  const limit = mode === 'smoke' ? 60000 : 1800000;
  while (Date.now() - t0 < limit) {
    await page.waitForTimeout(700);
    T = await page.evaluate(() => ({ ...window.__test, errors: window.__errors.length }));
    const key = `${T.state} t=${T.target}`;
    if (key !== lastKey) { log(`[${tag}] t=${((Date.now() - t0) / 1000).toFixed(1)}s ${T.state} target=${T.target} done=${T.done}/15 climaxT=${T.climaxT} fps=${T.fps} q=${T.q} waves=${T.waves} errors=${T.errors}`); lastKey = key; }
    for (const s of shots) {
      if (!taken[s.name] && s.when(T)) { await page.screenshot({ path: `${outDir}/${s.name}`, type: 'jpeg', quality: s.quality || 78 }); taken[s.name] = true; log(`[${tag}] shot ${s.name} (state=${T.state} done=${T.done} climaxT=${T.climaxT})`); }
    }
    if (T.finished) break;
    if (mode === 'smoke' && T.frames > (shots.length ? 9999 : 0) && Object.keys(taken).length >= shots.length && Date.now() - t0 > 20000) break;
  }
  const final = await page.evaluate(() => ({ ready: window.__ready, errors: window.__errors.slice(), test: window.__test }));
  await browser.close();
  const pass = final.ready === true && final.errors.length === 0 && consoleErr.length === 0 && (mode === 'smoke' || (final.test.climax && final.test.peak && final.test.free && final.test.finished));
  log(`[${tag}] RESULT ${pass ? 'PASS' : 'FAIL'} __ready=${final.ready} __errors=${JSON.stringify(final.errors)} consoleErrors=${JSON.stringify(consoleErr)} done=${final.test.done}/15 climax=${final.test.climax} peak=${final.test.peak} freePlay=${final.test.free} freeTouches=${final.test.freeTouches} finished=${final.test.finished} elapsed=${((Date.now() - t0) / 1000).toFixed(0)}s`);
  return pass;
}
(async () => {
  let ok = true;
  const W = +(process.argv[7] || 1024), H = +(process.argv[8] || 768);
  const P = (pre) => mode === 'smoke' ? [{ name: pre + 'smoke-a.jpg', when: T => T.frames > 3 && T.state === 'WAIT' }, { name: pre + 'smoke-b.jpg', when: T => T.state === 'WAVE' && T.done >= 1 }] : [
    { name: pre + 'shot-1.jpg', when: T => T.state === 'WAVE' && T.done >= 2 },
    { name: pre + 'shot-2.jpg', when: T => T.state === 'WAVE' && T.done >= 9 },
    { name: pre + 'shot-3.jpg', when: T => T.state === 'CLIMAX' && T.climaxT >= 9.5 },
    { name: pre + 'shot-4.jpg', when: T => T.state === 'FREE_WAIT' },
  ];
  if (which !== 'portrait') ok = await run(W, H, `${W}x${H}`, P(which === 'custom' ? 'c-' : '')) && ok;
  if (which !== 'landscape' && which !== 'custom') ok = await run(768, 1024, '768x1024', P('p-')) && ok;
  console.log(ok ? 'ALL PASS' : 'SOME FAILED');
})();
