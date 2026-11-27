// E08 autotest runner: node logs/e08/run-test.js [base_url] [mode] [q] [outDir] [which]
// mode: full (default) | smoke
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://127.0.0.1:8765';
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
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  log(`[${tag}] ready in ${Date.now() - t0}ms url=games/e08/index.html?autotest&q=${q}`);
  let lastKey = '', taken = {};
  const limit = mode === 'smoke' ? 60000 : 1800000;
  while (Date.now() - t0 < limit) {
    await page.waitForTimeout(1000);
    const T = await page.evaluate(() => ({ ...window.__test, errors: window.__errors.length }));
    const key = `${T.state} ${T.target}`;
    if (key !== lastKey) { log(`[${tag}] t=${((Date.now() - t0) / 1000).toFixed(1)}s game=${T.t}s ${T.state} target=${T.target} spun=${T.spun}/15 climaxT=${T.climaxT} fps=${T.fps} q=${T.q} waves=${T.waves} seeds=${T.seeds} errors=${T.errors}`); lastKey = key; }
    for (const s of shots) {
      if (!taken[s.name] && s.when(T)) { await page.screenshot({ path: `${outDir}/${s.name}`, type: 'jpeg', quality: s.quality || 80 }); taken[s.name] = true; log(`[${tag}] shot ${s.name} (state=${T.state} spun=${T.spun} climaxT=${T.climaxT})`); }
    }
    if (T.finished) break;
  }
  const final = await page.evaluate(() => ({ ready: window.__ready, errors: window.__errors.slice(), test: window.__test }));
  await browser.close();
  const f = final.test.flags || {};
  const pass = final.ready === true && final.errors.length === 0 && consoleErr.length === 0 && (mode === 'smoke' || (final.test.climax && final.test.peak && final.test.free && final.test.finished));
  log(`[${tag}] RESULT ${pass ? 'PASS' : 'FAIL'} __ready=${final.ready} __errors=${JSON.stringify(final.errors)} consoleErrors=${JSON.stringify(consoleErr)} spun=${final.test.spun}/15 climax=${final.test.climax} peak=${final.test.peak} freePlay=${final.test.free} freeMoves=${final.test.freeMoves} finished=${final.test.finished}`);
  log(`[${tag}] checks: tap/swipe=${f.swipe} rescue=${f.rescue} boost=${f.boost} secondFingerIgnored=${f.multi} backgroundTap=${f.bg} guide3s=${f.guide3} guide6s=${f.guide6} fpsNormal=${final.test.fpsNormal} fpsClimax=${final.test.fpsClimax} elapsed=${((Date.now() - t0) / 1000).toFixed(0)}s`);
  return pass;
}
(async () => {
  let ok = true;
  const P = mode === 'smoke';
  if (which !== 'portrait') ok = await run(1024, 768, '1024x768', P ? [{ name: 'smoke-L.jpg', when: T => T.frames > 8 }, { name: 'smoke-L2.jpg', when: T => T.spun >= 1 && T.state === 'SPIN' }] : [
    { name: 'shot-1.jpg', when: T => T.spun >= 2 && T.state === 'SPIN' },
    { name: 'shot-2.jpg', when: T => T.spun >= 8 && T.state === 'SPIN' },
    { name: 'shot-3.jpg', when: T => T.state === 'CLIMAX' && T.climaxT >= 9.5 },
    { name: 'shot-4.jpg', when: T => T.state === 'FREE_WAIT' && T.centered },
  ]) && ok;
  if (which !== 'landscape') ok = await run(768, 1024, '768x1024', P ? [{ name: 'smoke-P.jpg', when: T => T.frames > 8 }] : [
    { name: 'p-shot-1.jpg', when: T => T.spun >= 2 && T.state === 'SPIN' },
    { name: 'p-shot-2.jpg', when: T => T.spun >= 8 && T.state === 'SPIN' },
    { name: 'p-shot-3.jpg', when: T => T.state === 'CLIMAX' && T.climaxT >= 9.5 },
  ]) && ok;
  console.log(ok ? 'ALL PASS' : 'SOME FAILED');
})();
