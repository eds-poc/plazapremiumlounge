// Compact regression of the widget form (hero and Book Now dialog) after the lounge card change.
import { open, PW } from './harness.mjs';

const { chromium } = await import(PW);
const browser = await chromium.launch();
const results = [];
const check = (name, ok, info = '') => { results.push(`${ok ? 'ok  ' : 'FAIL'} ${name}${info ? ` — ${info}` : ''}`); console.log(results.at(-1)); };
const W = 'main .hero .booking-widget';
const page = await open(browser, { width: 1440 });
const input = page.locator(`${W} .booking-widget-where-input`);
await input.click();
await page.waitForFunction((w) => document.querySelectorAll(`${w} .booking-widget-option`).length > 100, W, { timeout: 20000 });
for (const [q, expect] of [['HKG', ['HKG']], ['abuja', ['ABV']], ['nigeria', ['ABV', 'LOS']], ['zhong', ['LHW']]]) {
  // eslint-disable-next-line no-await-in-loop
  await input.fill(q);
  // eslint-disable-next-line no-await-in-loop
  const codes = await page.evaluate((w) => [...document.querySelectorAll(`${w} .booking-widget-option`)].map((o) => o.id.split('-').pop()), W);
  check(`Where "${q}"`, JSON.stringify(codes.sort()) === JSON.stringify(expect), codes.join(','));
}
await input.fill('xyzq');
check('no match message', /No airports found/.test(await page.locator(`${W} .booking-widget-where-status`).textContent()));
await input.fill('hong kong int');
await input.press('ArrowDown');
await input.press('Enter');
check('keyboard pick', (await input.inputValue()).includes('(HKG)'), await input.inputValue());
await page.locator(`${W} .booking-widget-time-text`).click();
check('time list opens', await page.locator(`${W} .booking-widget-times`).isVisible());
await page.keyboard.press('Escape');
const plusA = page.locator(`${W} .booking-widget-adults .booking-widget-step-plus`);
const plusC = page.locator(`${W} .booking-widget-children .booking-widget-step-plus`);
await plusA.click({ force: true });
for (let i = 0; i < 7; i += 1) {
  // eslint-disable-next-line no-await-in-loop
  await plusC.click({ force: true });
}
const g = await page.evaluate((w) => `${document.querySelector(`${w} [name="adult"]`).value}+${document.querySelector(`${w} [name="children"]`).value}`, W);
check('guest limits (2 adults → 4 children)', g === '2+4', g);
const searched = page.evaluate(() => new Promise((resolve) => { document.addEventListener('booking-widget:search', (e) => { e.preventDefault(); resolve(e.detail.url); }, { once: true }); }));
await page.locator(`${W} .booking-widget-submit`).click();
const url = await searched;
check('search address', /\/en-uk\/find\/china-regions\/hong-kong\/hong-kong\?airport=HKG&date=\d{4}-\d{2}-\d{2}&time=\d{4}&adult=2&children=4/.test(url), url);
await input.fill('');
await page.locator(`${W} .booking-widget-submit`).click();
check('empty Where message', (await page.locator(`${W} .booking-widget-error`).textContent()) === 'Please select an airport');
await page.locator('header a[href="#book-now"]:visible').first().click();
await page.waitForSelector('dialog.modal[open] .booking-widget');
check('Book Now dialog opens with the widget (in-modal)', await page.evaluate(() => document.querySelector('dialog.modal[open] .booking-widget').classList.contains('in-modal')));
await page.keyboard.press('Escape');
check('Escape closes it, focus back on Book Now', (await page.locator('dialog.modal[open]').count()) === 0 && await page.evaluate(() => document.activeElement?.getAttribute('href')) === '#book-now');
check('no page errors', !page.errors.length, page.errors.join(' | '));
await page.close();
await browser.close();
console.log(`\n${results.filter((r) => r.startsWith('FAIL')).length} failed of ${results.length}`);
