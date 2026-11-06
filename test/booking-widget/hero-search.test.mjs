// The hero's Search, as the source's hero: the page stays, and half a second after the click the
// lounge card is asked for again (getbookingwidgetproducts, the shown lounge kept, not from the
// page's earlier answers); the focus stays on Search. Book Now's dialog still opens the city page.
// Products answers are routed (the user's attached success answer); the locations are real, with
// no nearest airport (the test picks HKG).
import { readFileSync } from 'node:fs';
import { open, PW } from './harness.mjs';

const { chromium } = await import(PW);
const SUCCESS = readFileSync(new URL('./fixtures/getbookingwidgetproducts.json', import.meta.url), 'utf8');
const CODE = JSON.parse(SUCCESS).propertyCode;
const browser = await chromium.launch();
let failed = 0;
const check = (name, ok, info = '') => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info ? ` — ${info}` : ''}`); };
const H = 'main .hero .booking-widget';
const SUBMIT = `${H} .booking-widget-submit`;
const shown = (page) => page.waitForFunction(() => !!document.querySelector('.booking-widget-products .booking-widget-card:not(.booking-widget-card-skeleton)'), null, { timeout: 20000 });

async function openHero(width) {
  const bodies = [];
  const page = await open(browser, {
    width,
    extraRoute: async (p) => {
      await p.route(/ppg-app\/getGeoLocation/, async (r) => {
        const resp = await r.fetch();
        const body = await resp.json();
        body.defaultOption = null;
        await r.fulfill({ response: resp, body: JSON.stringify(body) });
      });
      await p.route(/ppg-app\/getbookingwidgetproducts/, async (r) => {
        if (r.request().method() !== 'POST') return r.fallback();
        bodies.push({ t: Date.now(), body: JSON.parse(r.request().postData() || '{}') });
        await new Promise((resolve) => { setTimeout(resolve, 300); });
        return r.fulfill({
          status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: SUCCESS,
        }).catch(() => {});
      });
    },
  });
  const navs = [];
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) navs.push(f.url()); });
  await page.waitForFunction((sel) => document.querySelector(sel) && !document.querySelector(sel).disabled, SUBMIT, { timeout: 30000 });
  // whether anything cancelled the search before the page could see it
  await page.evaluate(() => {
    window.searches = [];
    // (and no page leaves: the test cancels it, after noting it)
    document.addEventListener('booking-widget:search', (e) => {
      window.searches.push(e.defaultPrevented);
      window.lastSearch = e.detail.url;
      e.preventDefault();
    });
  });
  return { page, bodies, navs };
}

for (const width of [1440, 375]) {
  // without a location: Where's message, no request, no search
  {
    const { page, bodies, navs } = await openHero(width);
    await page.locator(SUBMIT).click();
    await page.waitForTimeout(1200);
    const s = await page.evaluate((h) => ({
      error: document.querySelector(`${h} [id$="-where-error"]`)?.textContent.trim() || '',
      focus: document.activeElement?.className,
      searches: window.searches.length,
    }), H);
    check(`${width} no location: Where's message, focus on Where, no request`, /select an airport/i.test(s.error) && /where-input/.test(s.focus) && bodies.length === 0 && s.searches === 0 && navs.length === 0, JSON.stringify(s));
    await page.close();
  }

  const { page, bodies, navs } = await openHero(width);
  const input = page.locator(`${H} .booking-widget-where-input`);
  await input.click();
  await input.fill('HKG');
  await page.locator(`${H} .booking-widget-option[id$="-HKG"]`).click();
  await shown(page);
  await page.waitForTimeout(800);
  const before = bodies.length;
  check(`${width} HKG chosen: one card request, no lounge kept yet`, before === 1 && bodies[0].body.selectedAirport === 'HKG' && bodies[0].body.propertyCode === '', JSON.stringify(bodies.map((b) => b.body.propertyCode)));

  // Search: the page stays, the card is asked for again after half a second
  const t0 = Date.now();
  await page.locator(SUBMIT).click();
  await page.waitForTimeout(300);
  const early = bodies.length - before;
  await page.waitForTimeout(900);
  const req = bodies[before];
  check(`${width} Search: the page stays (no navigation)`, navs.length === 0 && new URL(page.url()).pathname === '/en-uk/', `${navs.join(', ')} ${page.url()}`);
  check(`${width} Search: cancelled by the lounge card (in place)`, JSON.stringify(await page.evaluate(() => window.searches)) === '[true]', JSON.stringify(await page.evaluate(() => window.searches)));
  check(`${width} Search: nothing asked before half a second`, early === 0, `${early}`);
  check(`${width} Search: one new request after ~0.5 s`, bodies.length - before === 1 && req.t - t0 >= 450 && req.t - t0 < 1100, req ? `${req.t - t0} ms` : 'none');
  check(`${width} Search: same choices, the shown lounge kept`, req?.body.selectedAirport === 'HKG' && req.body.propertyCode === CODE && req.body.selectedDate === bodies[0].body.selectedDate && req.body.selectedTime === bodies[0].body.selectedTime && req.body.adult === 1 && req.body.children === 0, JSON.stringify(req?.body));
  await shown(page);
  check(`${width} Search: the card is back, focus on Search`, await page.evaluate(() => document.activeElement?.classList.contains('booking-widget-submit')), await page.evaluate(() => document.activeElement?.className));

  // the same choices again: asked for afresh (the source asks every time)
  const n1 = bodies.length;
  await page.locator(SUBMIT).click();
  await page.waitForTimeout(1200);
  check(`${width} Search again, same choices: asked again`, bodies.length - n1 === 1, `${bodies.length - n1}`);

  // a double click: one request
  await shown(page);
  const n2 = bodies.length;
  await page.locator(SUBMIT).dblclick();
  await page.waitForTimeout(1500);
  check(`${width} double click: one request`, bodies.length - n2 === 1, `${bodies.length - n2}`);
  check(`${width} no page errors`, page.errors.length === 0, page.errors.join(' | '));
  await page.close();
}

// the Book Now dialog: its Search isn't taken over (the city page opens)
{
  const { page } = await openHero(1440);
  await page.locator('header a[href="#book-now"]:visible').first().click();
  await page.waitForSelector('dialog.modal[open] .booking-widget');
  const D = 'dialog.modal[open] .booking-widget';
  await page.waitForFunction((d) => !document.querySelector(`${d} .booking-widget-submit`)?.disabled, D, { timeout: 30000 });
  const din = page.locator(`${D} .booking-widget-where-input`);
  await din.click();
  await din.fill('HKG');
  await page.locator(`${D} .booking-widget-option[id$="-HKG"]`).click();
  await page.locator(`${D} .booking-widget-submit`).click();
  await page.waitForTimeout(300);
  const s = await page.evaluate(() => ({ searches: window.searches, url: window.lastSearch }));
  check('Book Now dialog: Search not taken over, the city page with the choices', JSON.stringify(s.searches) === '[false]' && /\/en-uk\/find\/china-regions\/hong-kong\/hong-kong\?airport=HKG/.test(s.url), JSON.stringify(s).slice(0, 160));
  await page.close();
}

await browser.close();
console.log(`\n${failed} failed`);
process.exit(failed ? 1 : 0);
