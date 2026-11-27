// dev helper: node logs/e14/shoot.js q vw vh outdir  -> captures several moments of the autotest
const { chromium } = require('playwright');
const [q = 'low', vw = 1024, vh = 768, out = '.', extra = ''] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const pg = await b.newPage({ viewport: { width: +vw, height: +vh }, deviceScaleFactor: 1, hasTouch: true });
  pg.on('console', m => { if (m.type() === 'error') console.log('ERR', m.text().slice(0, 300)); });
  await pg.route('**/gf-playlog.zan72122.workers.dev/**', r => r.fulfill({ status: 204, body: '' }));
  await pg.goto(`http://127.0.0.1:8814/games/e14/index.html?autotest&q=${q}${extra}`);
  await pg.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  const conds = [
    ['a-idle', T => T.frames > 3 && T.opened === 0],
    ['b-open', T => T.opened === 0 && T.o > 0.45],
    ['c-splash', T => T.opened === 1 && T.phase === 'splash' && T.flying > 20],
    ['d-ready7', T => T.opened === 7 && T.phase === 'ready'],
    ['e-splash13', T => T.opened >= 13 && T.phase === 'splash' && T.flying > 30],
    ['f-center', T => T.opened === 17 && T.phase === 'ready'],
    ['g-climax4', T => T.state === 'CLIMAX' && T.climaxT > 4],
    ['h-climax7', T => T.state === 'CLIMAX' && T.climaxT > 7],
    ['i-free', T => T.state === 'FREE_PLAY' && T.phase === 'ready'],
  ];
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  let i = 0; const t0 = Date.now();
  while (i < conds.length && Date.now() - t0 < 1500000) {
    if (only && !only.includes(conds[i][0])) { i++; continue; }
    const T = await pg.evaluate(() => window.__test);
    if (T && conds[i][1](T)) { await pg.screenshot({ path: `${out}/${conds[i][0]}.jpg`, type: 'jpeg', quality: 80 }); console.log('shot', conds[i][0], JSON.stringify({ s: T.state, o: T.opened, ndc: T.centerNdc, inF: T.inFrame, fly: T.flying, b: T.bloom, e: T.exposure })); i++; if (only && i >= conds.length) break; }
    if (T && T.state === 'FREE_PLAY' && i < 8) i = 8;
    await pg.waitForTimeout(80);
  }
  await b.close();
})();
