// dev helper: node logs/e14/still.js url out.jpg vw vh waitms
const { chromium } = require('playwright');
const [url, out, vw = 1024, vh = 768, wait = 1500] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const pg = await b.newPage({ viewport: { width: +vw, height: +vh }, deviceScaleFactor: 1, hasTouch: true });
  pg.on('console', m => { if (m.type() === 'error') console.log('ERR', m.text().slice(0, 300)); });
  await pg.route('**/gf-playlog.zan72122.workers.dev/**', r => r.fulfill({ status: 204, body: '' }));
  await pg.goto(url);
  await pg.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  await pg.waitForTimeout(+wait);
  await pg.screenshot({ path: out, type: 'jpeg', quality: 80 });
  console.log(JSON.stringify(await pg.evaluate(() => window.__test)));
  await b.close();
})();
