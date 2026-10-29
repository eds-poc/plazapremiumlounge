// Search disabled until getGeoLocation answers and the nearest airport is chosen.
import { readFileSync } from 'node:fs';
import { open, PW } from './harness.mjs';

const { chromium } = await import(PW);
const SAMPLE = JSON.parse(readFileSync(new URL('./fixtures/getGeoLocation.json', import.meta.url), 'utf8'));
const browser = await chromium.launch();
let failed = 0;
const check = (name, ok, info = '') => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info ? ` — ${info}` : ''}`); };
const H = 'main .hero .booking-widget';
const D = 'dialog[open] .booking-widget';
const answer = (body, delay, status = 200) => async (route) => {
  await new Promise((r) => { setTimeout(r, delay); });
  await route.fulfill({
    status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: typeof body === 'string' ? body : JSON.stringify(body),
  }).catch(() => {});
};
const button = (page, w) => page.evaluate((sel) => {
  const b = document.querySelector(`${sel} .booking-widget-submit`);
  return b && {
    disabled: b.disabled, opacity: getComputedStyle(b).opacity, cursor: getComputedStyle(b).cursor, where: document.querySelector(`${sel} .booking-widget-where-input`).value,
  };
}, w);
const watchSearch = (page, w) => page.evaluate((sel) => {
  window.searches = 0;
  document.querySelector(sel).addEventListener('booking-widget:search', (e) => { e.preventDefault(); window.searches += 1; });
}, w);

for (const width of [1440, 375]) {
  // slow answer: disabled until it's in and BLR is chosen
  {
    // eslint-disable-next-line no-await-in-loop
    const page = await open(browser, { width, extraRoute: (p) => p.route(/getGeoLocation/, answer(SAMPLE, 4000)) });
    // eslint-disable-next-line no-await-in-loop
    await watchSearch(page, H);
    // eslint-disable-next-line no-await-in-loop
    const before = await button(page, H);
    check(`${width} hero: Search disabled while loading`, before.disabled && before.opacity === '0.65' && before.cursor === 'progress', JSON.stringify(before));
    // eslint-disable-next-line no-await-in-loop
    await page.locator(`${H} .booking-widget-submit`).click({ force: true });
    // eslint-disable-next-line no-await-in-loop
    await page.locator(`${H} .booking-widget-where-input`).press('Enter');
    // eslint-disable-next-line no-await-in-loop
    await page.keyboard.press('Escape');
    // eslint-disable-next-line no-await-in-loop
    const blocked = await page.evaluate((sel) => ({ searches: window.searches, error: document.querySelector(`${sel} .booking-widget-error`)?.textContent || '' }), H);
    check(`${width} hero: click and Enter do nothing meanwhile`, blocked.searches === 0 && !blocked.error, JSON.stringify(blocked));
    // eslint-disable-next-line no-await-in-loop
    await page.evaluate(() => document.activeElement?.blur());
    // eslint-disable-next-line no-await-in-loop
    await page.waitForFunction((sel) => !document.querySelector(`${sel} .booking-widget-submit`).disabled, H, { timeout: 15000 }).catch(() => {});
    // eslint-disable-next-line no-await-in-loop
    const after = await button(page, H);
    check(`${width} hero: enabled with BLR chosen`, !after.disabled && after.opacity === '1' && after.where === 'Kempegowda International Airport (BLR)', JSON.stringify(after));
    // eslint-disable-next-line no-await-in-loop
    await page.locator(`${H} .booking-widget-submit`).click();
    // eslint-disable-next-line no-await-in-loop
    check(`${width} hero: Search works then`, (await page.evaluate(() => window.searches)) === 1);
    // the Book Now dialog on the same page: the shared answer, enabled at once
    // eslint-disable-next-line no-await-in-loop
    await page.locator('header a[href$="#book-now"]:visible').first().click();
    // eslint-disable-next-line no-await-in-loop
    await page.waitForSelector(`${D} .booking-widget-submit`, { timeout: 15000 });
    // eslint-disable-next-line no-await-in-loop
    await page.waitForTimeout(400);
    // eslint-disable-next-line no-await-in-loop
    const dlg = await button(page, D);
    check(`${width} homepage dialog: enabled with BLR at once`, !dlg.disabled && /BLR/.test(dlg.where), JSON.stringify(dlg));
    // eslint-disable-next-line no-await-in-loop
    await page.close();
  }
  // failure: Search comes back (and asks for an airport)
  {
    // eslint-disable-next-line no-await-in-loop
    const page = await open(browser, { width, extraRoute: (p) => p.route(/getGeoLocation/, answer('boom', 1500, 500)) });
    // eslint-disable-next-line no-await-in-loop
    await page.waitForFunction((sel) => !document.querySelector(`${sel} .booking-widget-submit`).disabled, H, { timeout: 15000 }).catch(() => {});
    // eslint-disable-next-line no-await-in-loop
    const b = await button(page, H);
    // eslint-disable-next-line no-await-in-loop
    await page.locator(`${H} .booking-widget-submit`).click();
    // eslint-disable-next-line no-await-in-loop
    const err = await page.locator(`${H} .booking-widget-error`).textContent();
    check(`${width} failure: Search enabled, asks for an airport`, !b.disabled && b.where === '' && /select an airport/i.test(err), `${JSON.stringify(b)} ${err}`);
    // eslint-disable-next-line no-await-in-loop
    await page.close();
  }
  // no nearest airport: enabled once the list is in
  {
    // eslint-disable-next-line no-await-in-loop
    const page = await open(browser, { width, extraRoute: (p) => p.route(/getGeoLocation/, answer({ ...SAMPLE, defaultOption: null }, 1500)) });
    // eslint-disable-next-line no-await-in-loop
    await page.waitForFunction((sel) => !document.querySelector(`${sel} .booking-widget-submit`).disabled, H, { timeout: 15000 }).catch(() => {});
    // eslint-disable-next-line no-await-in-loop
    const b = await button(page, H);
    check(`${width} no nearest: enabled, Where empty`, !b.disabled && b.where === '', JSON.stringify(b));
    // eslint-disable-next-line no-await-in-loop
    await page.close();
  }
  // another page: the dialog loads when it opens, disabled until then
  {
    let requestedAt = 0;
    // eslint-disable-next-line no-await-in-loop
    const page = await open(browser, {
      width,
      path: '/en-uk/airport-lounge-passes',
      extraRoute: (p) => p.route(/getGeoLocation/, async (route) => { requestedAt = Date.now(); await answer(SAMPLE, 2500)(route); }),
    });
    // eslint-disable-next-line no-await-in-loop
    await page.waitForTimeout(1500);
    const beforeOpen = requestedAt;
    const clickedAt = Date.now();
    // eslint-disable-next-line no-await-in-loop
    await page.locator('header a[href$="#book-now"]:visible').first().click();
    // eslint-disable-next-line no-await-in-loop
    await page.waitForSelector(`${D} .booking-widget-submit`, { timeout: 15000 });
    // eslint-disable-next-line no-await-in-loop
    await page.waitForTimeout(500);
    // eslint-disable-next-line no-await-in-loop
    const during = await button(page, D);
    // eslint-disable-next-line no-await-in-loop
    await page.waitForFunction((sel) => !document.querySelector(`${sel} .booking-widget-submit`).disabled, D, { timeout: 15000 }).catch(() => {});
    // eslint-disable-next-line no-await-in-loop
    const after = await button(page, D);
    check(`${width} other page: no request before the dialog opens`, beforeOpen === 0, String(beforeOpen));
    check(`${width} other page: request when it opens`, requestedAt >= clickedAt && requestedAt - clickedAt < 1500, `${requestedAt - clickedAt}ms after the click`);
    check(`${width} other page dialog: disabled, then enabled with BLR`, during.disabled && !after.disabled && /BLR/.test(after.where), `${JSON.stringify(during)} → ${JSON.stringify(after)}`);
    check(`${width} other page: no page errors`, !page.errors.length, page.errors.join(' | ').slice(0, 160));
    // eslint-disable-next-line no-await-in-loop
    await page.close();
  }
}
console.log(`\n${failed} failed`);
await browser.close();
