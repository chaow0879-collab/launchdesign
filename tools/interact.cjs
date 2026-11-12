const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto('file://' + process.argv[2]);
  await p.waitForFunction(() => !document.querySelector('#play').disabled, null, { timeout: 120000 });
  await p.waitForTimeout(3000);
  const st = () => p.evaluate(() => ({time: document.querySelector('#time')?.textContent, playing: document.querySelector('#play')?.getAttribute('aria-label') || document.querySelector('#play')?.textContent, node: document.querySelector('.node-btn.active, [aria-current="step"]')?.textContent?.trim().slice(0, 12)}));
  console.log('autoplay', JSON.stringify(await st()));
  const btns = await p.$$('#steps button, .node-btn, [data-node]');
  console.log('node buttons', btns.length);
  const active = await p.$('[aria-current="step"]');
  if (active) { await active.click(); await p.waitForTimeout(1500); console.log('same node click', JSON.stringify(await st())); }
  const other = await p.$('[aria-current="step"] ~ *, button:has-text("2. ")'); if (other) { await other.click(); await p.waitForTimeout(2500); console.log('other node click', JSON.stringify(await st())); }
  await b.close();
})();
