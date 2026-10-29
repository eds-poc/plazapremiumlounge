// getGeoLocation: the Where list and the visitor's nearest airport, real and routed answers.
import { readFileSync } from 'node:fs';
import { open, PW } from './harness.mjs';

const { chromium } = await import(PW);
const SAMPLE = JSON.parse(readFileSync(new URL('./fixtures/getGeoLocation.json', import.meta.url), 'utf8'));
const browser = await chromium.launch();
let failed = 0;
const check = (name, ok, info = '') => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info ? ` — ${info}` : ''}`); };
const only = process.argv[2];
const W = 'main .hero .booking-widget';
const json = (body, delay = 0) => async (route) => {
  if (delay) await new Promise((r) => { setTimeout(r, delay); });
  await route.fulfill({
    status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: typeof body === 'string' ? body : JSON.stringify(body),
  }).catch(() => {});
};
const withDefault = (option, patch = (d) => d) => patch({ ...structuredClone(SAMPLE), defaultOption: option });
const blr = SAMPLE.defaultOption;
const state = (page) => page.evaluate((w) => {
  const input = document.querySelector(`${w} .booking-widget-where-input`);
  return {
    where: input?.value,
    status: document.querySelector(`${w} .booking-widget-where-status`)?.textContent || '',
    retry: !!document.querySelector(`${w} .booking-widget-retry`),
    card: document.querySelector('.hero-products .booking-widget-card:not(.booking-widget-card-skeleton) h2')?.textContent
      || (document.querySelector('.hero-products .booking-widget-more-properties:not([hidden]) a')?.textContent ? `(button) ${document.querySelector('.hero-products .booking-widget-more-properties a').textContent}` : ''),
    date: document.querySelector(`${w} input[name="date"]`)?.value,
    time: document.querySelector(`${w} input[name="time"]`)?.value,
  };
}, W);

async function run(name, {
  route, width = 1440, path = '/en-uk/', wait = 6000, act,
} = {}) {
  if (only && !name.includes(only)) return null;
  const products = [];
  // (the previewed homepages have the hero, and the navs the Book Now widget)
  const page = await open(browser, {
    hero: false,
    nav: false,
    width,
    path,
    extraRoute: async (p) => {
      p.on('request', (r) => { if (/getbookingwidgetproducts/.test(r.url())) products.push(JSON.parse(r.postData() || '{}').selectedAirport); });
      if (route) await p.route(/getGeoLocation/, route);
    },
  });
  if (act) await act(page);
  await page.waitForTimeout(wait);
  const s = await state(page);
  s.products = products;
  s.errors = page.errors.filter((e) => !/could not load the locations|Failed to load resource/.test(e));
  page.result = s;
  await name.fn?.(page);
  return { page, s };
}

const cases = [
  ['real en-uk: nearest chosen without interaction, card for it', {}, (s) => s.where && /\([A-Z]{3}\)$/.test(s.where) && s.products.length >= 1 && !!s.card],
  ['real zh-cn: nearest in the language', { path: '/zh-cn/' }, (s) => s.where && /[一-鿿]/.test(s.where)],
  ['real ja-jp 375: nearest', { path: '/ja-jp/', width: 375 }, (s) => !!s.where],
  ['sample BLR', { route: json(SAMPLE) }, (s) => s.where === 'Kempegowda International Airport (BLR)' && s.products.includes('BLR')],
  ['default not in data (XXX)', { route: json(withDefault({ ...blr, iataCode: 'XXX' })) }, (s) => s.where === '' && !s.products.length && !s.card],
  ['default without a city page (AOHR)', { route: json(withDefault({ ...blr, iataCode: 'AOHR' })) }, (s) => s.where === '' && !s.products.length],
  ['default inactive', { route: json(withDefault({ ...blr, status: 'Inactive' })) }, (s) => s.where === '' && !s.products.length],
  ['defaultOption null', { route: json(withDefault(null)) }, (s) => s.where === '' && !s.products.length],
  ['defaultOption missing', { route: json((() => { const d = structuredClone(SAMPLE); delete d.defaultOption; return d; })()) }, (s) => s.where === ''],
  ['default code lower case + spaces', { route: json(withDefault({ ...blr, iataCode: ' blr ' })) }, (s) => s.where === 'Kempegowda International Airport (BLR)'],
  ['default is a station → View all, no product call', { route: json(withDefault({ ...blr, iataCode: 'HKG', locationTypeCode: 'RLWYSTN' })) }, (s) => /HKG/.test(s.where) && !s.products.length && /^\(button\)/.test(s.card)],
  ['data empty → error + retry', { route: json({ data: [], defaultOption: blr }) }, (s) => s.where === '' && !s.products.length, async (page) => {
    await page.locator(`${W} .booking-widget-where-input`).click();
    await page.waitForTimeout(500);
    const st = await state(page);
    check('  data empty: list shows the error and Try again', st.retry, st.status);
  }],
  ['data not an array → error', { route: json({ data: { a: 1 }, defaultOption: blr }) }, (s) => s.where === ''],
  ['invalid JSON → error', { route: json('{"data": [') }, (s) => s.where === ''],
  ['HTTP 500 → error, Try again recovers', {
    route: (() => {
      let n = 0;
      return async (route) => {
        n += 1;
        if (n === 1) await route.fulfill({ status: 500, headers: { 'access-control-allow-origin': '*' }, body: 'boom' });
        else await json(SAMPLE)(route);
      };
    })(),
  }, (s) => s.where === '', async (page) => {
    await page.locator(`${W} .booking-widget-where-input`).click();
    await page.waitForTimeout(400);
    const st = await state(page);
    check('  500: Try again shown', st.retry, st.status);
    await page.locator(`${W} .booking-widget-retry`).click();
    await page.waitForTimeout(2500);
    const st2 = await state(page);
    const options = await page.locator(`${W} .booking-widget-option`).count();
    check('  500: after Try again the list fills (focused: no automatic pick)', options > 100 && st2.where === '', `${options} options, where="${st2.where}"`);
  }],
  ['timeout (16s) → error', { route: json(SAMPLE, 16500), wait: 17500 }, (s) => s.where === ''],
  ['bad entries skipped, zero-width + double spaces cleaned', {
    route: json(withDefault({ ...blr, iataCode: 'LOS' }, (d) => ({
      ...d,
      data: [{ displayName: 'No code (ZZZ)' }, {
        iata: 'LOS', id: 'LOS', displayName: 'Murtala  Muhammed International Airport​ (LOS)', nameEn: 'Murtala Muhammed International Airport', maxLeadTime: 1, timezone: '(GMT+1:00) Africa/Lagos, West Africa Standard Time', city: 'Lagos', country: 'Nigeria', region: 'India/Middle East/Africa', regionCode: 'IM',
      }, null, { iata: 'LOS', displayName: 'Duplicate (LOS)' }, ...d.data.filter((x) => x.iata !== 'LOS')],
    }))),
  }, (s) => s.where === 'Murtala Muhammed International Airport (LOS)'],
  ['lead time 20h (routed HKG)', {
    route: json(withDefault({ ...blr, iataCode: 'HKG' }, (d) => ({ ...d, data: d.data.map((x) => (x.iata === 'HKG' ? { ...x, maxLeadTime: 20 } : x)) }))),
  }, (s) => {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }));
    const at = new Date(`${s.date}T${s.time.slice(0, 2)}:${s.time.slice(2)}:00`);
    const hours = (at - now) / 3600000;
    console.log(`     HKG +20h: ${s.date} ${s.time} (${hours.toFixed(1)} h ahead in Hong Kong)`);
    return hours >= 20 && hours <= 20.6;
  }],
  ['lead time 0 (routed GIG)', { route: json(withDefault({ ...blr, iataCode: 'GIG' })) }, (s) => {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const at = new Date(`${s.date}T${s.time.slice(0, 2)}:${s.time.slice(2)}:00`);
    const hours = (at - now) / 3600000;
    console.log(`     GIG +0h: ${s.date} ${s.time} (${hours.toFixed(2)} h ahead in Rio)`);
    // (a still-bookable time is kept: lead 0 means any time from now)
    return /GIG/.test(s.where) && hours >= 0;
  }],
  ['typing before the answer is kept', {
    route: json(SAMPLE, 3000),
    act: async (page) => { const i = page.locator(`${W} .booking-widget-where-input`); await i.click(); await i.pressSequentially('hong', { delay: 40 }); },
  }, (s) => s.where === 'hong' && !s.products.length],
  ['set-location before the answer wins', {
    route: json(SAMPLE, 3000),
    act: async (page) => page.evaluate((w) => document.querySelector(w).dispatchEvent(new CustomEvent('booking-widget:set-location', { detail: { airport: 'HKG' } })), W),
  }, (s) => /HKG/.test(s.where) && s.products.at(-1) === 'HKG' && !s.products.includes('BLR')],
  ['sample: search goes to the nearest one\'s city page', { route: json(SAMPLE) }, (s) => /BLR/.test(s.where), async (page) => {
    await page.evaluate((w) => document.querySelector(w).addEventListener('booking-widget:search', (e) => { e.preventDefault(); window.lastSearch = e.detail.url; }, { once: true }), W);
    await page.locator(`${W} .booking-widget-submit`).click();
    const url = await page.evaluate(() => window.lastSearch || '');
    check('  search → Bangalore page', /\/en-uk\/find\/india-middle-east-south-africa\/india\/bangalore\?airport=BLR/.test(url), url.slice(0, 120));
  }],
  ['Book Now dialog (sample): nearest chosen when opened', { route: json(SAMPLE), wait: 1000 }, () => true, async (page) => {
    await page.locator('header a[href$="#book-now"]:visible').first().click();
    await page.waitForTimeout(3500);
    const v = await page.locator('dialog[open] .booking-widget-where-input').inputValue().catch(() => 'n/a');
    check('  dialog Where', v === 'Kempegowda International Airport (BLR)', v);
    const requests = await page.evaluate(() => performance.getEntriesByType('resource').filter((e) => /getGeoLocation/.test(e.name)).length);
    check('  one getGeoLocation request for both forms', requests === 1, String(requests));
  }],
];

for (const [name, opts, expect, after] of cases) {
  if (only && !name.includes(only)) continue;
  // eslint-disable-next-line no-await-in-loop
  const { page, s } = await run(name, opts);
  check(name, expect(s), `where="${s.where}" products=${JSON.stringify(s.products)} card="${s.card}"${s.errors.length ? ` errors=${s.errors.join(' | ').slice(0, 160)}` : ''}`);
  // eslint-disable-next-line no-await-in-loop
  if (after) await after(page);
  // eslint-disable-next-line no-await-in-loop
  await page.close();
}
console.log(`\n${failed} failed`);
await browser.close();
