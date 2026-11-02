// Computed styles + boxes of every element in the homepage hero (widget, lounge card, button) and
// the Book Now dialog, with fixed answers (the user's getGeoLocation sample → BLR; the attached
// products answer), at 1440 / 1200 / 992 / 768 / 375, plus screenshots. Usage: node snapshot.mjs <label>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { open, PW } from './harness.mjs';

const { chromium } = await import(PW);
const label = process.argv[2] || 'snap';
const GEO = readFileSync(new URL('./fixtures/getGeoLocation.json', import.meta.url), 'utf8');
const PRODUCTS = readFileSync(new URL('./fixtures/getbookingwidgetproducts.json', import.meta.url), 'utf8');
const PROPS = ['display', 'position', 'width', 'height', 'margin', 'padding', 'border', 'border-radius', 'box-shadow', 'background-color', 'background-image', 'color', 'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-transform', 'gap', 'grid-template-columns', 'opacity', 'z-index', 'overflow', 'transform', 'transition', 'cursor', 'min-height', 'max-width', 'inset'];
const json = (body) => (route) => route.fulfill({
  status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body,
});
const OUT = process.env.RESULTS || 'test/booking-widget/results';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const out = {};
for (const width of [1440, 1200, 992, 768, 375]) {
  // eslint-disable-next-line no-await-in-loop
  const page = await open(browser, {
    width,
    height: 1000,
    extraRoute: async (p) => {
      await p.route(/getGeoLocation/, json(GEO));
      await p.route(/getbookingwidgetproducts/, json(PRODUCTS));
      // a still photo for the card (no slide change during the capture)
      await p.addInitScript(() => { window.setInterval = ((orig) => (fn, ms, ...a) => (ms === 8000 ? 0 : orig(fn, ms, ...a)))(window.setInterval); });
    },
  });
  // eslint-disable-next-line no-await-in-loop
  await page.waitForFunction(() => document.querySelector('.hero-products .booking-widget-card:not(.booking-widget-card-skeleton) h2'), null, { timeout: 30000 });
  // eslint-disable-next-line no-await-in-loop
  await page.waitForTimeout(1500);
  // eslint-disable-next-line no-await-in-loop
  out[`hero ${width}`] = await page.evaluate((props) => {
    const root = document.querySelector('main .hero.booking');
    const all = [root, ...root.querySelectorAll('*')];
    return all.map((e, i) => {
      const cs = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      const before = getComputedStyle(e, '::before');
      const after = getComputedStyle(e, '::after');
      return {
        i,
        tag: e.tagName,
        cls: String(e.className),
        box: [r.x, r.y, r.width, r.height].map((n) => Math.round(n * 10) / 10),
        css: props.map((p) => cs.getPropertyValue(p)).join('|'),
        pseudo: `${before.content}|${before.width}|${before.height}|${before.backgroundColor}|${after.content}|${after.width}|${after.height}|${after.backgroundColor}|${after.borderTopColor}`,
      };
    });
  }, PROPS);
  // eslint-disable-next-line no-await-in-loop
  await page.locator('main .hero.booking').screenshot({ path: `${OUT}/${label}-hero-${width}.png` });
  // the dialog
  // eslint-disable-next-line no-await-in-loop
  await page.locator('header a[href$="#book-now"]:visible').first().click();
  // eslint-disable-next-line no-await-in-loop
  await page.waitForSelector('dialog[open] .booking-widget-where-input', { timeout: 15000 });
  // eslint-disable-next-line no-await-in-loop
  await page.waitForTimeout(1200);
  // eslint-disable-next-line no-await-in-loop
  out[`dialog ${width}`] = await page.evaluate((props) => {
    const root = document.querySelector('dialog[open]');
    return [root, ...root.querySelectorAll('*')].map((e, i) => {
      const cs = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      return {
        i, tag: e.tagName, cls: String(e.className), box: [r.x, r.y, r.width, r.height].map((n) => Math.round(n * 10) / 10), css: props.map((p) => cs.getPropertyValue(p)).join('|'),
      };
    });
  }, PROPS);
  // eslint-disable-next-line no-await-in-loop
  await page.close();
  console.log(width, out[`hero ${width}`].length, 'hero elements,', out[`dialog ${width}`].length, 'dialog elements');
}
writeFileSync(`${OUT}/${label}.snapshot.json`, JSON.stringify(out));
await browser.close();
