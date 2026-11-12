const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8765/index.html');
  await p.waitForFunction(() => !document.querySelector('#play').disabled, null, { timeout: 120000 });
  await p.waitForTimeout(3000);
  console.log(await p.evaluate(() => document.querySelector('#time').textContent), errs.slice(0, 5));
  await p.screenshot({ path: '/home/claude/v8/shots/web.png' });
  await b.close();
})();
