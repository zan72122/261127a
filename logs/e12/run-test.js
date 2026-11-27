// E12 autotest runner: node logs/e12/run-test.js [base_url] [mode full|smoke] [q] [outDir] [which both|landscape|portrait] [extra query]
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://127.0.0.1:8772';
const mode = process.argv[3] || 'full';
const q = process.argv[4] || 'low';
const outDir = process.argv[5] || 'logs/e12';
const which = process.argv[6] || 'both';
const extra = process.argv[7] || '';
const log = (...a) => console.log(...a);
async function run(vw, vh, tag, shots) {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, hasTouch: true });
  const consoleErr = [];
  page.on('console', m => { if (m.type() === 'error') consoleErr.push(m.text()); if (/\[autotest\]|\[e12\]/.test(m.text()) && !/state (HARVESTING|BASKET_READY|TRANSPORTING|PROCESSING|FILLING)/.test(m.text())) log(`[${tag}] console: ${m.text()}`); if (m.type() === 'warning' && !/GPU stall|ReadPixels/.test(m.text())) log(`[${tag}] warn: ${m.text()}`); });
  page.on('pageerror', e => consoleErr.push('pageerror: ' + e.message));
  await page.route('**/gf-playlog.zan72122.workers.dev/**', r => r.fulfill({ status: 204, body: '' }));
  const url = `${base}/games/e12/index.html?autotest&q=${q}${extra}`;
  const t0 = Date.now();
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  log(`[${tag}] ready in ${Date.now() - t0}ms url=games/e12/index.html?autotest&q=${q}${extra}`);
  let lastKey = '', taken = {}, stalls = 0;
  const limit = mode === 'smoke' ? 45000 : 2400000;
  while (Date.now() - t0 < limit) {
    await page.waitForTimeout(800);
    const T = await Promise.race([page.evaluate(() => ({ ...window.__test, errors: window.__errors.length })), new Promise(r => setTimeout(() => r(null), 30000))]);
    if (!T) { stalls++; log(`[${tag}] evaluate timeout (${stalls})`); if (stalls >= 5) break; continue; }
    const key = `${T.state} ${T.loop} ${T.cycle}`;
    if (key !== lastKey) { log(`[${tag}] t=${((Date.now() - t0) / 1000).toFixed(1)}s ${T.state} loop=${T.loop + 1}/20 stage=${T.stage + 1} cycle=${T.cycle} harvested=${T.harvested} pressed=${T.pressed} jar=${T.jarUnits}/115 level=${T.level} centerErr=${T.centerErr}px inFrame=${T.inFrame} fps=${T.fps} q=${T.q} apples=${T.apples} errors=${T.errors}`); lastKey = key; }
    for (const s of shots) {
      if (!taken[s.name] && s.when(T)) { await page.screenshot({ path: `${outDir}/${s.name}`, type: 'jpeg', quality: s.quality || 78 }); taken[s.name] = true; log(`[${tag}] shot ${s.name} (state=${T.state} loop=${T.loop + 1} finaleT=${T.finaleT})`); }
    }
    if (T.finished) break;
    if (mode === 'smoke' && T.frames > 30 && Date.now() - t0 > 40000) break;
  }
  const final = await page.evaluate(() => ({ ready: window.__ready, errors: window.__errors.slice(), test: window.__test }));
  await browser.close();
  const t = final.test;
  const pass = final.ready === true && final.errors.length === 0 && consoleErr.length === 0 && (mode === 'smoke' || (t.finale && t.full && t.peak && t.afterglow && t.reset && t.finished && t.cycle >= 1 && t.state === 'HARVEST_READY'));
  log(`[${tag}] RESULT ${pass ? 'PASS' : 'FAIL'} __ready=${final.ready} __errors=${JSON.stringify(final.errors)} consoleErrors=${JSON.stringify(consoleErr)} finale=${t.finale} jarFull=${t.full} wavePeak=${t.peak} afterglow=${t.afterglow} reset=${t.reset} replayReady=${t.finished} cycle=${t.cycle} harvestedTotal(last cycle)=${t.harvested} flags=${t.flags}/${t.flagsTotal} lamps=${t.lamps}/${t.lampsTotal} ignoredPointers=${t.ignored} outsideTaps=${t.outside} extraTaps=${t.extraTaps} maxCenterErr(settled)=${t.maxCenterErr}px framesOutOfView=${t.outFrames} playFps=${t.playFps} climaxFps=${t.climaxFps} elapsed=${((Date.now() - t0) / 1000).toFixed(0)}s`);
  return pass;
}
(async () => {
  let ok = true;
  const S = (p) => mode === 'smoke' ? [{ name: `smoke-${p}.jpg`, when: T => T.frames > 20 }] : [
    { name: `${p}shot-1.jpg`, when: T => T.loop >= 1 && T.state === 'HARVEST_READY' && T.arrived },
    { name: `${p}shot-2.jpg`, when: T => T.loop >= 11 && T.state === 'PROCESSING' && T.arrived },
    { name: `${p}shot-3.jpg`, when: T => T.state === 'FINALE' && T.finaleT >= 9.5 },
  ];
  if (which !== 'portrait') ok = await run(1024, 768, '1024x768', S('')) && ok;
  if (which !== 'landscape') ok = await run(768, 1024, '768x1024', S('p-')) && ok;
  console.log(ok ? 'ALL PASS' : 'SOME FAILED');
})();
