// axe on the hero with the ABV card, the online-booking-off card and the Filling Up state.
import { readFileSync } from 'node:fs';
import { open, PW } from './harness.mjs';

const { chromium } = await import(PW);
const AXE = readFileSync(process.env.AXE_CORE || 'node_modules/axe-core/axe.min.js', 'utf8');
const SUCCESS = JSON.parse(readFileSync(new URL('./fixtures/getbookingwidgetproducts.json', import.meta.url), 'utf8'));
const filling = JSON.parse(JSON.stringify(SUCCESS));
filling.itemGroups[0].items[0].availability = false;
const browser = await chromium.launch();
const runs = [['card', 1440], ['card', 375], ['unavailable', 1440, { ...SUCCESS, isTecoEnabled: false }], ['filling up', 1440, filling]];
for (const [label, width, answer] of runs) {
  // eslint-disable-next-line no-await-in-loop
  const page = await open(browser, {
    width,
    extraRoute: answer ? (p) => p.route(/getbookingwidgetproducts/, (r) => r.fulfill({
      status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(answer),
    })) : undefined,
  });
  // eslint-disable-next-line no-await-in-loop
  await page.evaluate(() => document.querySelector('main .hero .booking-widget').dispatchEvent(new CustomEvent('booking-widget:set-location', { detail: { airport: 'ABV' } })));
  // eslint-disable-next-line no-await-in-loop
  await page.waitForFunction(() => document.querySelector('.booking-widget-card:not(.booking-widget-card-skeleton)'), null, { timeout: 60000 });
  // eslint-disable-next-line no-await-in-loop
  await page.waitForTimeout(1500);
  // eslint-disable-next-line no-await-in-loop
  await page.addScriptTag({ content: AXE });
  // eslint-disable-next-line no-await-in-loop
  const res = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const r = await axe.run(document.querySelector('.hero.booking'), { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] });
    return r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' ; ')}`);
  });
  console.log(`[${width}] ${label}: ${res.length ? `\n  ${res.join('\n  ')}` : 'no violations'}`);
  // eslint-disable-next-line no-await-in-loop
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  // eslint-disable-next-line no-await-in-loop
  await page.close();
}
await browser.close();
