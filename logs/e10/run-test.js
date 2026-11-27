// E10 autotest runner: node logs/e10/run-test.js [base_url] [mode=full|smoke] [q] [which=both|landscape|portrait] [extra]
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://127.0.0.1:8770';
const mode = process.argv[3] || 'full';
const q = process.argv[4] || 'low';
const which = process.argv[5] || 'both';
const extra = process.argv[6] || '';
const outDir = 'logs/e10';
const log = (...a) => console.log(...a);
async function run(vw, vh, tag, shots) {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, hasTouch: true });
  const consoleErr = [];
  page.on('console', m => { if (m.type() === 'error') consoleErr.push(m.text()); });
  page.on('pageerror', e => consoleErr.push('pageerror: ' + e.message));
  await page.route('**/gf-playlog.zan72122.workers.dev/**', r => r.fulfill({ status: 204, body: '' }));
  const url = `${base}/games/e10/index.html?autotest&q=${q}${extra}`;
  const t0 = Date.now();
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  log(`[${tag}] ready in ${Date.now() - t0}ms url=games/e10/index.html?autotest&q=${q}${extra}`);
  let lastKey = '', taken = {}, worst = { tx: 0, ty: 0, out: 0 };
  const limit = mode === 'smoke' ? 45000 : 2400000;
  while (Date.now() - t0 < limit) {
    await page.waitForTimeout(1000);
    const T = await page.evaluate(() => ({ ...window.__test, errors: window.__errors.length }));
    const v = T.view || {};
    const stable = ['WAIT_FILL', 'WAIT_POUR', 'FREEPLAY'].includes(T.state);
    if (stable && T.settled && v.tx !== undefined) { worst.tx = Math.max(worst.tx, Math.abs(v.tx)); worst.ty = Math.max(worst.ty, Math.abs(v.ty)); }
    const key = `${T.state} ${T.feeds}`;
    if (key !== lastKey) { log(`[${tag}] t=${((Date.now() - t0) / 1000).toFixed(0)}s game=${T.t}s ${T.state} feeds=${T.feeds}/18 stage=${T.stage} birds=${T.birds} opened=${T.opened}/${T.flowers} climaxT=${T.climaxT} fps=${T.fps} q=${T.q} view=${JSON.stringify(v)} errors=${T.errors}`); lastKey = key; }
    for (const s of shots) {
      if (!taken[s.name] && s.when(T)) { await page.screenshot({ path: `${outDir}/${s.name}`, type: 'jpeg', quality: s.quality || 78 }); taken[s.name] = true; log(`[${tag}] shot ${s.name} (state=${T.state} feeds=${T.feeds} climaxT=${T.climaxT} view=${JSON.stringify(v)})`); }
    }
    if (T.finished) break;
  }
  const final = await page.evaluate(() => ({ ready: window.__ready, errors: window.__errors.slice(), test: window.__test }));
  await browser.close();
  const f = final.test.flags || {};
  const pass = final.ready === true && final.errors.length === 0 && consoleErr.length === 0 && (mode === 'smoke' || (final.test.peak && final.test.free && final.test.finished && final.test.feeds === 18));
  log(`[${tag}] RESULT ${pass ? 'PASS' : 'FAIL'} __ready=${final.ready} __errors=${JSON.stringify(final.errors)} consoleErrors=${JSON.stringify(consoleErr)} feeds=${final.test.feeds}/18 climaxPeak=${final.test.peak} freePlay=${final.test.free} freeCycles=${final.test.freeCycles} finished=${final.test.finished} opened=${final.test.opened}/${final.test.flowers}`);
  log(`[${tag}] checks: backgroundTapNoAction=${f.bgNoAction} rapidTapIgnored=${f.rapidIgnored} secondFingerIgnored=${f.secondFingerIgnored} pointercancelOk=${f.cancelOk} guideLight2.7s=${f.guide1} guideNudge5s=${f.guide2} worstTargetOffsetNDC(wait states)=${worst.tx.toFixed(3)},${worst.ty.toFixed(3)} fpsNormal=${final.test.fpsNormal} fpsClimax=${final.test.fpsClimax} elapsed=${((Date.now() - t0) / 1000).toFixed(0)}s`);
  return pass;
}
(async () => {
  let ok = true;
  const S = mode === 'smoke';
  if (which !== 'portrait') ok = await run(1024, 768, '1024x768', S ? [{ name: 'smoke-L.jpg', when: T => T.frames > 5 }, { name: 'smoke-L2.jpg', when: T => T.state === 'WAIT_POUR' }, { name: 'smoke-L3.jpg', when: T => T.state === 'FEEDING' && T.t > 0 }] : [
    { name: 'shot-1.jpg', when: T => T.feeds === 1 && (T.state === 'WAIT_POUR' || T.state === 'POURING') },
    { name: 'shot-2.jpg', when: T => T.feeds === 9 && T.state === 'FEEDING' },
    { name: 'shot-3.jpg', when: T => T.state === 'CLIMAX' && T.climaxT >= 9.5 },
    { name: 'shot-4.jpg', when: T => T.state === 'FREEPLAY' },
  ]) && ok;
  if (which !== 'landscape') ok = await run(768, 1024, '768x1024', S ? [{ name: 'smoke-P.jpg', when: T => T.frames > 5 }] : [
    { name: 'p-shot-1.jpg', when: T => T.feeds === 1 && T.state === 'WAIT_POUR' },
    { name: 'p-shot-2.jpg', when: T => T.feeds === 9 && T.state === 'FEEDING' },
    { name: 'p-shot-3.jpg', when: T => T.state === 'CLIMAX' && T.climaxT >= 9.5 },
  ]) && ok;
  console.log(ok ? 'ALL PASS' : 'SOME FAILED');
})();
