// E14 autotest runner: node logs/e14/run-test.js [base] [mode full|smoke] [q] [outDir] [which both|landscape|portrait] [prefix] [vw] [vh]
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://127.0.0.1:8814';
const mode = process.argv[3] || 'full';
const q = process.argv[4] || 'low';
const outDir = process.argv[5] || 'logs/e14';
const which = process.argv[6] || 'both';
const P = process.argv[7] || '';
const log = (...a) => console.log(...a);
async function run(vw, vh, tag, shots) {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, hasTouch: true });
  const consoleErr = [];
  page.on('console', m => { if (m.type() === 'error') consoleErr.push(m.text()); if (/\[autotest\]|\[e14\]/.test(m.text())) log(`[${tag}] console: ${m.text()}`); });
  page.on('pageerror', e => consoleErr.push('pageerror: ' + e.message));
  await page.route('**/gf-playlog.zan72122.workers.dev/**', r => r.fulfill({ status: 204, body: '' }));
  const url = `${base}/games/e14/index.html?autotest&q=${q}`;
  const t0 = Date.now();
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  log(`[${tag}] ready in ${Date.now() - t0}ms url=games/e14/index.html?autotest&q=${q}`);
  let lastKey = '', taken = {}, maxNdc = 0, frameOut = 0, maxBloom = 0, maxExp = 0, checks = 0;
  const limit = mode === 'smoke' ? 40000 : 2400000;
  while (Date.now() - t0 < limit) {
    await page.waitForTimeout(500);
    const T = await page.evaluate(() => ({ ...window.__test, errors: window.__errors.length }));
    if (!T || !T.state) continue;
    if (!T.moving) { checks++; if (T.phase === 'ready' || T.state === 'CLIMAX' || T.state === 'AFTERGLOW') maxNdc = Math.max(maxNdc, T.centerNdc || 0); if (!T.inFrame) frameOut++; }
    maxBloom = Math.max(maxBloom, T.bloom); maxExp = Math.max(maxExp, T.exposure);
    const key = `${T.state} ${T.phase} ${T.opened}`;
    if (key !== lastKey) { log(`[${tag}] t=${((Date.now() - t0) / 1000).toFixed(1)}s ${T.state}/${T.phase} opened=${T.opened}/18 free=${T.freeOpens} stage=${T.stage} climaxT=${T.climaxT} target=${T.target} centerNdc=${T.centerNdc} inFrame=${T.inFrame} flying=${T.flying} bloom=${T.bloom} exp=${T.exposure} fps=${T.fps} q=${T.q} errors=${T.errors}`); lastKey = key; }
    for (const s of shots) {
      if (!taken[s.name] && s.when(T)) { await page.screenshot({ path: `${outDir}/${s.name}`, type: 'jpeg', quality: s.quality || 80 }); taken[s.name] = true; log(`[${tag}] shot ${s.name} (state=${T.state} opened=${T.opened} climaxT=${T.climaxT} flying=${T.flying})`); }
    }
    if (T.finished) break;
    if (mode === 'smoke' && T.frames > 30 && Object.keys(taken).length === shots.length) break;
  }
  const final = await page.evaluate(() => ({ ready: window.__ready, errors: window.__errors.slice(), test: window.__test }));
  await browser.close();
  const t = final.test || {};
  const pass = final.ready === true && final.errors.length === 0 && consoleErr.length === 0 && (mode === 'smoke' || (t.opened === 18 && t.climax && t.peak && t.afterglow && t.free && t.freeOpens >= 2 && t.finished && t.celebrations === 2 && frameOut === 0));
  log(`[${tag}] RESULT ${pass ? 'PASS' : 'FAIL'} __ready=${final.ready} __errors=${JSON.stringify(final.errors)} consoleErrors=${JSON.stringify(consoleErr)} opened=${t.opened}/18 stageChanges=${t.celebrations} climax=${t.climax} peak=${t.peak} afterglow=${t.afterglow} freePlay=${t.free} freeOpens=${t.freeOpens} taps=${t.taps} drags=${t.drags} ignoredPointers=${t.ignored} outsideTaps=${t.outside} maxFlyingDrops=${t.maxFly} maxTargetNdc=${maxNdc} framesOutOfView=${frameOut}/${checks} maxBloom=${maxBloom} maxExposure=${maxExp} minFps=${t.minFps} elapsed=${((Date.now() - t0) / 1000).toFixed(0)}s`);
  return pass;
}
(async () => {
  let ok = true;
  const sm = n => [{ name: P + n, when: T => T.frames > 25 }];
  if (which !== 'portrait') ok = await run(1024, 768, '1024x768', mode === 'smoke' ? sm('smoke-L.jpg') : [
    { name: P + 'shot-1.jpg', when: T => T.opened >= 1 && T.phase === 'splash' },
    { name: P + 'shot-2.jpg', when: T => T.opened >= 9 && T.phase === 'splash' },
    { name: P + 'shot-3.jpg', when: T => T.state === 'CLIMAX' && T.climaxT >= 6.0 },
  ]) && ok;
  if (which !== 'landscape') ok = await run(768, 1024, '768x1024', mode === 'smoke' ? sm('smoke-P.jpg') : [
    { name: P + 'p-shot-1.jpg', when: T => T.opened >= 1 && T.phase === 'splash' },
    { name: P + 'p-shot-2.jpg', when: T => T.opened >= 9 && T.phase === 'splash' },
    { name: P + 'p-shot-3.jpg', when: T => T.state === 'CLIMAX' && T.climaxT >= 6.0 },
  ]) && ok;
  console.log(ok ? 'ALL PASS' : 'SOME FAILED');
})();
