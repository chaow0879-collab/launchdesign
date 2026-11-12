// 用法: node shot.mjs <html> <out-prefix> [nodeIndex:seconds ...]
import { chromium } from 'playwright';
const [,, file, prefix, ...marks] = process.argv;
const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('file://' + file);
await page.waitForFunction(() => document.querySelector('#play') && !document.querySelector('#play').disabled, null, { timeout: 120000 });
for (const m of marks) {
  const [ni, sec] = m.split(':').map(Number);
  await page.evaluate(([ni, sec]) => window.__debugSeek && window.__debugSeek(ni, sec), [ni, sec]);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${prefix}-${ni}-${sec}.png` });
}
if (!marks.length) { await page.waitForTimeout(3000); await page.screenshot({ path: `${prefix}.png` }); }
console.log('errors:', errs.slice(0, 8));
await browser.close();
