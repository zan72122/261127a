// E15 autotest runner: node logs/e15/run-test.js [base_url] [mode full|smoke] [q] [outDir] [which both|landscape|portrait] [prefix] [extraQuery]
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://127.0.0.1:8815';
const mode = process.argv[3] || 'full';
const q = process.argv[4] || 'low';
const outDir = process.argv[5] || 'logs/e15';
const which = process.argv[6] || 'both';
const P = process.argv[7] || '';
const extra = process.argv[8] || '';
const log = (...a) => console.log(...a);
async function run(vw, vh, tag, shots) {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, hasTouch: true });
  const consoleErr = [];
  page.on('console', m => { if (m.type() === 'error') consoleErr.push(m.text()); if (/\[autotest\]|\[e15\]/.test(m.text())) log(`[${tag}] console: ${m.text()}`); });
  page.on('pageerror', e => consoleErr.push('pageerror: ' + e.message));
  await page.route('**/gf-playlog.zan72122.workers.dev/**', r => r.fulfill({ status: 204, body: '' }));
  const url = `${base}/games/e15/index.html?autotest&q=${q}${extra}`;
  const t0 = Date.now();
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true || (window.__errors && window.__errors.length > 0), null, { timeout: 180000 });
  log(`[${tag}] ready in ${Date.now() - t0}ms url=games/e15/index.html?autotest&q=${q}${extra}`);
  let lastKey = '', taken = {}, maxRx = 0, maxRy = 0, maxFx = 0, maxFy = 0, maxTx = 0, maxTy = 0, frameOut = 0, maxBloom = 0, maxExp = 0, minThr = 9, maxCalls = 0;
  const limit = mode === 'smoke' ? 40000 : 2400000;
  while (Date.now() - t0 < limit) {
    await page.waitForTimeout(600);
    const T = await page.evaluate(() => ({ ...window.__test, errors: window.__errors.length, err0: window.__errors[0] }));
    if (T.state === 'WAITING' && !T.free) { maxRx = Math.max(maxRx, T.restNdcX); maxRy = Math.max(maxRy, T.restNdcY); }
    if (T.state === 'WAITING') { maxFx = Math.max(maxFx, T.feederNdcX); maxFy = Math.max(maxFy, T.feederNdcY); }
    if (T.state === 'CLIMAX' && T.climaxT > 3) { maxTx = Math.max(maxTx, T.towerNdcX); maxTy = Math.max(maxTy, T.towerNdcY); }
    if (!T.inFrame) frameOut++;
    maxBloom = Math.max(maxBloom, T.bloom); maxExp = Math.max(maxExp, T.exposure); if (T.bloom > 0) minThr = Math.min(minThr, T.threshold); maxCalls = Math.max(maxCalls, T.calls);
    const key = `${T.state} ${T.arrived} ${T.free}`;
    if (key !== lastKey) { log(`[${tag}] t=${((Date.now() - t0) / 1000).toFixed(1)}s ${T.state} k=${T.k} arrived=${T.arrived}/24 stage=${T.stage} stored=${T.stored} runners=${T.runners} climaxT=${T.climaxT} feederNdc=${T.feederNdcX},${T.feederNdcY} inFrame=${T.inFrame} bloom=${T.bloom} exp=${T.exposure} fps=${T.fps} calls=${T.calls} q=${T.q} errors=${T.errors}${T.err0 ? ' ' + T.err0 : ''}`); lastKey = key; }
    for (const s of shots) {
      if (!taken[s.name] && s.when(T)) { await page.screenshot({ path: `${outDir}/${s.name}`, type: 'jpeg', quality: s.quality || 80 }); taken[s.name] = true; log(`[${tag}] shot ${s.name} (state=${T.state} arrived=${T.arrived} climaxT=${T.climaxT})`); }
    }
    if (T.finished || T.errors > 0) break;
  }
  const final = await page.evaluate(() => ({ ready: window.__ready, errors: window.__errors.slice(), test: window.__test }));
  await browser.close();
  const t = final.test;
  const pass = final.ready === true && final.errors.length === 0 && consoleErr.length === 0 && (mode === 'smoke' || (t.arrived === 24 && t.climax && t.peak && t.afterglow && t.free && t.freeArrivals >= 2 && t.finished && t.stageUps === 3));
  log(`[${tag}] RESULT ${pass ? 'PASS' : 'FAIL'} __ready=${final.ready} __errors=${JSON.stringify(final.errors)} consoleErrors=${JSON.stringify(consoleErr)} arrived=${t.arrived}/24 launched=${t.launched} stageUps=${t.stageUps} activations=${t.activations} bells=${t.bells} climax=${t.climax} peak=${t.peak} afterglow=${t.afterglow} freePlay=${t.free} freeArrivals=${t.freeArrivals} finished=${t.finished} taps=${t.taps} drags=${t.drags} ignoredPointers=${t.ignored} outsideTaps=${t.outside} targetRestNdc=${maxRx.toFixed(3)},${maxRy.toFixed(3)} maxTargetNdcWhileWaiting(incl.drag)=${maxFx.toFixed(3)},${maxFy.toFixed(3)} maxTowerNdcInClimax=${maxTx.toFixed(3)},${maxTy.toFixed(3)} framesOutOfView=${frameOut} maxBloom=${maxBloom} minThreshold=${minThr} maxExposure=${maxExp} maxDrawCalls=${maxCalls} elapsed=${((Date.now() - t0) / 1000).toFixed(0)}s`);
  return pass;
}
(async () => {
  let ok = true;
  const sm = (n) => [{ name: P + n, when: T => T.frames > 12 }];
  const full = (pre) => [
    { name: P + pre + 'shot-1.jpg', when: T => T.arrived >= 2 && T.state === 'WAITING' },
    { name: P + pre + 'shot-2.jpg', when: T => T.arrived >= 14 && (T.state === 'ROLLING' || T.state === 'MECHANISM') && T.runners >= 1 },
    { name: P + pre + 'shot-3.jpg', when: T => T.state === 'CLIMAX' && T.climaxT >= 13.0 },
  ];
  if (which !== 'portrait') ok = await run(1024, 768, '1024x768', mode === 'smoke' ? sm('smoke-L.jpg') : full('')) && ok;
  if (which !== 'landscape') ok = await run(768, 1024, '768x1024', mode === 'smoke' ? sm('smoke-P.jpg') : full('p-')) && ok;
  console.log(ok ? 'ALL PASS' : 'SOME FAILED');
})();
