// E07 autotest runner: node logs/e07/run-test.js [base_url] [mode]
// mode: full (default) | smoke
const { chromium } = require('playwright');
const fs = require('fs');
const base = process.argv[2] || 'http://127.0.0.1:8765';
const mode = process.argv[3] || 'full';
const q = process.argv[4] || 'low';
const outDir = process.argv[5] || 'logs/e07';
const log = (...a) => console.log(...a);
async function run(vw, vh, tag, shots) {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, hasTouch: true });
  const consoleErr = [];
  page.on('console', m => { if (m.type() === 'error') consoleErr.push(m.text()); });
  page.on('pageerror', e => consoleErr.push('pageerror: ' + e.message));
  await page.route('**/gf-playlog.zan72122.workers.dev/**', r => r.fulfill({ status: 204, body: '' }));
  const url = `${base}/games/e07/index.html?autotest&q=${q}`;
  const t0 = Date.now();
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  log(`[${tag}] ready in ${Date.now() - t0}ms url=games/e07/index.html?autotest&q=${q}`);
  let lastState = '', taken = {}, result = null;
  const limit = mode === 'smoke' ? 40000 : 1500000;
  while (Date.now() - t0 < limit) {
    await page.waitForTimeout(1000);
    const T = await page.evaluate(() => ({ ...window.__test, errors: window.__errors.length }));
    const key = `${T.state} done=${T.done}`;
    if (key !== lastState) { log(`[${tag}] t=${((Date.now() - t0) / 1000).toFixed(1)}s ${T.state} done=${T.done}/28 climaxT=${T.climaxT} fps=${T.fps} q=${T.q} particles=${T.particles} errors=${T.errors}`); lastState = key; }
    for (const s of shots) {
      if (!taken[s.name] && s.when(T)) { await page.screenshot({ path: `${outDir}/${s.name}`, type: 'jpeg', quality: s.quality || 80 }); taken[s.name] = true; log(`[${tag}] shot ${s.name} (state=${T.state} done=${T.done} climaxT=${T.climaxT})`); }
    }
    result = T;
    if (T.finished) break;
    if (mode === 'smoke' && Date.now() - t0 > 30000) break;
  }
  const final = await page.evaluate(() => ({ ready: window.__ready, errors: window.__errors.slice(), test: window.__test }));
  await browser.close();
  const pass = final.ready === true && final.errors.length === 0 && consoleErr.length === 0 && (mode === 'smoke' || (final.test.climax && final.test.peak && final.test.free && final.test.reset && final.test.intro2));
  log(`[${tag}] RESULT ${pass ? 'PASS' : 'FAIL'} __ready=${final.ready} __errors=${JSON.stringify(final.errors)} consoleErrors=${JSON.stringify(consoleErr)} climax=${final.test.climax} peak=${final.test.peak} freePlay=${final.test.free} reset=${final.test.reset} backToIntro=${final.test.intro2} elapsed=${((Date.now() - t0) / 1000).toFixed(0)}s`);
  return pass;
}
(async () => {
  const which = process.argv[6] || 'both';
  let ok = true;
  if (which !== 'portrait') ok = await run(1024, 768, '1024x768', mode === 'smoke' ? [{ name: 'smoke-L.jpg', when: T => T.frames > 20 }] : [
    { name: 'shot-1.jpg', when: T => T.done >= 3 },
    { name: 'shot-2.jpg', when: T => T.done >= 15 },
    { name: 'shot-3.jpg', when: T => T.state === 'CLIMAX' && T.climaxT >= 8.7 },
    
  ]) && ok;
  if (which !== 'landscape') ok = await run(768, 1024, '768x1024', mode === 'smoke' ? [{ name: 'smoke-P.jpg', when: T => T.frames > 20 }] : [
    { name: 'p-shot-1.jpg', when: T => T.done >= 3 },
    { name: 'p-shot-2.jpg', when: T => T.done >= 15 },
    { name: 'p-shot-3.jpg', when: T => T.state === 'CLIMAX' && T.climaxT >= 8.7 },
  ]) && ok;
  console.log(ok ? 'ALL PASS' : 'SOME FAILED');
})();
