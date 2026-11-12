const { chromium } = require('playwright');
(async () => {
  const [,, file, ni, sec, expr] = process.argv;
  const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  page.on('pageerror', e => console.log('PAGEERR', String(e)));
  await page.goto('file://' + file);
  await page.waitForFunction(() => document.querySelector('#play') && !document.querySelector('#play').disabled, null, { timeout: 120000 });
  await page.evaluate(([ni, sec]) => window.__debugSeek(+ni, +sec), [ni, sec]);
  await page.waitForTimeout(800);
  console.log(await page.evaluate(expr));
  await browser.close();
})();
