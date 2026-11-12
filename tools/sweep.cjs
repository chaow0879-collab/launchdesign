const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGE ' + String(e).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') errs.push('CON ' + m.text().slice(0, 200)); });
  await page.goto('file://' + process.argv[2]);
  await page.waitForFunction(() => document.querySelector('#play') && !document.querySelector('#play').disabled, null, { timeout: 120000 });
  for (let ni = 0; ni < 26; ni++) {
    for (let s = 0; s < 52; s += 2.5) {
      const before = errs.length;
      await page.evaluate(([ni, s]) => window.__debugSeek(ni, s), [ni, s]);
      await page.waitForTimeout(60);
      if (errs.length > before) errs.push(`  ^ at node ${ni} t=${s}`);
    }
  }
  console.log(errs.slice(0, 40).join('\n') || 'NO ERRORS');
  await browser.close();
})();
