// Lounge card scenarios with getbookingwidgetproducts (local harness, hero widget). Real API unless
// routed; routed answers start from the user's attached success and lead-time-error answers.
import { readFileSync } from 'node:fs';
import { open, PW } from './harness.mjs';

const { chromium } = await import(PW);
const SUCCESS = JSON.parse(readFileSync(new URL('./fixtures/getbookingwidgetproducts.json', import.meta.url), 'utf8'));
const LEAD = JSON.parse(readFileSync(new URL('./fixtures/getbookingwidgetproducts-lead-time.json', import.meta.url), 'utf8'));
const only = process.argv[2];
const browser = await chromium.launch();
const results = [];
const check = (name, ok, info = '') => { results.push(`${ok ? 'ok  ' : 'FAIL'} ${name}${info ? ` — ${info}` : ''}`); console.log(results.at(-1)); };
const W = 'main .hero .booking-widget';
const S = '.booking-widget-products';
const clone = (x) => JSON.parse(JSON.stringify(x));
const json = (body) => ({
  status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: typeof body === 'string' ? body : JSON.stringify(body),
});

async function pick(page, query, code) {
  const input = page.locator(`${W} .booking-widget-where-input`);
  await input.click();
  await page.waitForFunction((w) => document.querySelectorAll(`${w} .booking-widget-option`).length > 50, W, { timeout: 20000 });
  await input.fill(query);
  await page.locator(`${W} .booking-widget-option[id$="-${code}"]`).click();
  await page.waitForTimeout(700);
}
const state = (page) => page.evaluate((s) => {
  const sec = document.querySelector(s);
  if (!sec) return { section: 'none' };
  const card = sec.querySelector('.booking-widget-card:not(.booking-widget-card-skeleton)');
  const more = sec.querySelector('.booking-widget-more-properties');
  const q = (sel) => card?.querySelector(sel);
  return {
    hidden: sec.hidden,
    card: !!card,
    unavailable: card?.classList.contains('is-unavailable') || false,
    title: q('.booking-widget-card-title')?.textContent,
    place: q('.booking-widget-card-place')?.hidden ? '(hidden)' : q('.booking-widget-card-place')?.textContent,
    options: card ? [...card.querySelectorAll('.booking-widget-card-product option')].map((o) => o.textContent) : [],
    tabs: card ? [...card.querySelectorAll('.booking-widget-card-tab')].map((t) => t.textContent) : [],
    features: card ? [...card.querySelectorAll('.booking-widget-card-feature')].map((t) => t.textContent) : [],
    photos: card ? [...card.querySelectorAll('.booking-widget-card-slider img')].map((i) => (i.getAttribute('src') || i.dataset.src || '').split('/').pop()) : [],
    emptyPhotos: !!q('.booking-widget-card-slider.is-empty'),
    was: q('.booking-widget-card-price-was')?.hidden ? '' : q('.booking-widget-card-price-was')?.textContent,
    now: q('.booking-widget-card-price-now')?.textContent,
    status: q('.booking-widget-card-status') && !q('.booking-widget-card-status').hidden ? q('.booking-widget-card-status').textContent : '',
    book: q('.booking-widget-card-book')?.textContent || null,
    off: q('.booking-widget-card-unavailable') ? `${q('.booking-widget-card-unavailable').textContent} disabled=${q('.booking-widget-card-unavailable').disabled}` : null,
    moreAt: q('.booking-widget-card-more')?.textContent,
    more: more && !more.hidden && getComputedStyle(more).display !== 'none' ? more.textContent : null,
    moreHref: more?.querySelector('a')?.getAttribute('href'),
  };
}, S);
const waitDone = (page) => page.waitForFunction((s) => {
  const sec = document.querySelector(s);
  return sec && !sec.hidden && sec.getAttribute('aria-busy') !== 'true';
}, S, { timeout: 60000 });

async function run(code, query, { width = 1440, answer, extraRoute } = {}) {
  const page = await open(browser, {
    width,
    extraRoute: async (p) => {
      if (answer) await p.route(/ppg-app\/getbookingwidgetproducts/, answer);
      // (no nearest airport: the test's own pick drives the card)
      await p.route(/ppg-app\/getGeoLocation/, extraRoute ? (r) => r.fallback() : async (r) => {
        const resp = await r.fetch();
        const body = await resp.json();
        body.defaultOption = null;
        await r.fulfill({ response: resp, body: JSON.stringify(body) });
      });
      if (extraRoute) await extraRoute(p);
    },
  });
  const calls = [];
  page.on('request', (r) => {
    const m = r.url().match(/ppg-app\/([A-Za-z-]+)/);
    if (m && m[1] !== 'getGeoLocation') calls.push({ name: m[1], body: r.postData() });
  });
  await pick(page, query, code);
  await waitDone(page);
  await page.waitForTimeout(500);
  const s = await state(page);
  return { page, s, calls };
}

if (!only || only === 'real') {
  const abv = await run('ABV', 'abuja');
  const { calls } = abv;
  let { page, s } = abv;
  console.log('  ABV', JSON.stringify(s));
  const body = JSON.parse(calls[0]?.body || '{}');
  check('ABV: one call, getbookingwidgetproducts only', calls.length === 1 && calls[0].name === 'getbookingwidgetproducts', calls.map((c) => c.name).join(','));
  check('ABV: request body', body.selectedAirport === 'ABV' && /^\d{4}-\d{2}-\d{2}$/.test(body.selectedDate) && /^\d{4}$/.test(body.selectedTime) && body.adult === 1 && body.children === 0 && body.promocode === '' && body.propertyCode === '' && body.languageCode === 'en', JSON.stringify(body));
  check('ABV: title (live: SDS Lounge)', s.title === 'SDS Lounge', s.title);
  check('ABV: location line (live)', s.place === 'International Departure, Nnamdi Azikiwe International Airport', s.place);
  check('ABV: product (live)', JSON.stringify(s.options) === '["Lounge Use - 3 Hours"]', s.options.join('/'));
  check('ABV: price USD 50.00, nothing struck (live)', s.now === 'USD 50.00' && !s.was, `${s.was} | ${s.now}`);
  check('ABV: photo = the product photo (live)', s.photos[0] === 'SDS_Lou_Int_Dep_New_Int_T_Top.jpg', s.photos.join(','));
  check('ABV: features 4 + more', s.features.length === 5 && /^\+ \d+ MORE$/.test(s.features[4]), s.features.join(' | '));
  check('ABV: Book Now, More at ABV, no View more (live)', s.book === 'Book Now' && s.moreAt === 'More at ABV' && !s.more, `${s.book} | ${s.moreAt} | ${s.more}`);
  check('ABV: no errors', !page.errors.length, page.errors.join(' | '));
  // guests: the request follows, the lounge is kept
  const before = calls.length;
  await page.locator(`${W} .booking-widget-children .booking-widget-step-plus`).click({ force: true });
  await page.waitForTimeout(800);
  await waitDone(page);
  const b2 = JSON.parse(calls[before]?.body || '{}');
  check('guest change: children sent, lounge kept', b2.children === 1 && b2.propertyCode === 'PRPRTY1343', JSON.stringify({ c: b2.children, p: b2.propertyCode }));
  // another airport: no lounge code sent
  await pick(page, 'hong kong int', 'HKG');
  await waitDone(page);
  await page.waitForTimeout(500);
  const b3 = JSON.parse(calls.at(-1)?.body || '{}');
  s = await state(page);
  console.log('  HKG', JSON.stringify(s));
  check('airport change: propertyCode empty', b3.selectedAirport === 'HKG' && b3.propertyCode === '', JSON.stringify({ a: b3.selectedAirport, p: b3.propertyCode }));
  check('HKG: card, View more properties (7 lounges)', s.card && /View more properties in Hong Kong International Airport \(HKG\)/.test(s.more || ''), `${s.title} | ${s.more}`);
  check('HKG: discount struck (995 → 895.50)', /HKD \d+\.\d\d/.test(s.was || '') && /HKD \d+\.\d\d/.test(s.now || ''), `${s.was} | ${s.now}`);
  // Book Now: the event, no navigation
  const booked = page.evaluate(() => new Promise((resolve) => { document.addEventListener('booking-widget:book', (e) => resolve(e.detail), { once: true }); }));
  const url = page.url();
  await page.locator('.booking-widget-card-book').click();
  const d = await booked;
  check('Book Now: event with catalogueCode, no navigation', d.propertyCode && d.productCode && d.catalogueCode && page.url() === url, JSON.stringify({ p: d.propertyCode, pr: d.productCode, c: d.catalogueCode }));
  await page.close();
  ({ page, s } = await run('DXB', 'dubai int'));
  console.log('  DXB', JSON.stringify(s));
  check('DXB: tabs in the answer\'s itemGroups order', JSON.stringify(s.tabs) === '["PRIVATE RESTING AREA","LOUNGE","SHOWER"]', s.tabs.join(' | '));
  await page.locator('.booking-widget-card-tab').nth(2).click();
  const opts = await page.locator('.booking-widget-card-product option').allTextContents();
  check('DXB: the SHOWER tab shows its products', opts.some((o) => /shower/i.test(o)), opts.join(' / '));
  await page.close();
  ({ page, s } = await run('ABV', 'abuja', { width: 375 }));
  check('ABV phone: card', s.card && s.title === 'SDS Lounge', s.title);
  await page.close();
}

if (!only || only === 'routed') {
  const cases = [
    ['lead time not met (attached DCPE060)', (r) => r.fulfill(json(LEAD)), (s) => !s.card && /View all properties in Nnamdi Azikiwe International Airport \(ABV\)/.test(s.more || '')],
    ['not available DCPE061', (r) => r.fulfill(json({ ...LEAD, productApiError: { errorCode: 'DCPE061', message: 'Property not available for given date and time' } })), (s) => !s.card && /View all/.test(s.more || '')],
    ['invalid date DCPE108', (r) => r.fulfill(json({ ...LEAD, productApiError: { errorCode: 'DCPE108', message: 'Invalid start datetime' } })), (s) => !s.card && /View all/.test(s.more || '')],
    ['statusCode 500 in the body', (r) => r.fulfill(json({ ...clone(SUCCESS), statusCode: '500' })), (s) => !s.card && /View all/.test(s.more || '')],
    ['HTTP 404 (unknown lounge)', (r) => r.fulfill({
      status: 404, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"error":"not found"}',
    }), (s) => !s.card && /View all/.test(s.more || '')],
    ['HTTP 503 HTML', (r) => r.fulfill({
      status: 503, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: '<html>down</html>',
    }), (s) => !s.card && /View all/.test(s.more || '')],
    ['invalid JSON', (r) => r.fulfill(json('{"statusCode":"200","items":[')), (s) => !s.card && /View all/.test(s.more || '')],
    ['network failure', (r) => r.abort('failed'), (s) => !s.card && /View all/.test(s.more || '')],
    ['items not an array', (r) => r.fulfill(json({ ...clone(SUCCESS), items: { a: 1 }, itemGroups: null })), (s) => !s.card && /View all/.test(s.more || '')],
    ['pass service only', (r) => { const b = clone(SUCCESS); b.items.forEach((i) => { i.serviceName = 'Pass Service'; i.serviceDisplayName = 'Pass Service'; }); b.itemGroups = []; return r.fulfill(json(b)); }, (s) => !s.card && /View all/.test(s.more || '')],
    ['no title anywhere', (r) => { const b = clone(SUCCESS); b.propertyDisplayName = ''; b.items.forEach((i) => { i.locations = []; }); b.itemGroups.forEach((g) => g.items.forEach((i) => { i.locations = []; })); return r.fulfill(json(b)); }, (s) => !s.card && /View all/.test(s.more || '')],
    ['title from the item\'s property name', (r) => { const b = clone(SUCCESS); b.propertyDisplayName = null; return r.fulfill(json(b)); }, (s) => s.card && s.title === 'SDS Lounge'],
    ['missing prices → —', (r) => { const b = clone(SUCCESS); b.itemGroups[0].items[0].prices = []; return r.fulfill(json(b)); }, (s) => s.card && s.now === '—' && !s.was],
    ['a discount → struck price', (r) => { const b = clone(SUCCESS); b.itemGroups[0].items[0].prices[0].basePriceWithDiscount = 45; return r.fulfill(json(b)); }, (s) => s.card && s.was === 'USD 50.00' && s.now === 'USD 45.00'],
    ['no product photo → the lounge photos', (r) => { const b = clone(SUCCESS); b.itemGroups[0].items[0].images = []; return r.fulfill(json(b)); }, (s) => s.card && s.photos.length === 4 && /Primeclass/.test(s.photos[0])],
    ['no photos at all → the grey box', (r) => { const b = clone(SUCCESS); b.itemGroups[0].items[0].images = []; b.images = null; return r.fulfill(json(b)); }, (s) => s.card && s.emptyPhotos],
    ['no features → hidden', (r) => { const b = clone(SUCCESS); b.features = null; return r.fulfill(json(b)); }, (s) => s.card && s.features.length === 0],
    ['no location line → hidden', (r) => { const b = clone(SUCCESS); b.shortLocation = ''; b.locationDisplayName = ''; b.locationName = ''; return r.fulfill(json(b)); }, (s) => s.card && s.place === '(hidden)'],
    ['availability false → Filling Up', (r) => { const b = clone(SUCCESS); b.itemGroups[0].items[0].availability = false; return r.fulfill(json(b)); }, (s) => s.card && s.status === 'Filling Up'],
    ['online booking off → Currently Unavailable', (r) => r.fulfill(json({ ...clone(SUCCESS), isTecoEnabled: false })), (s) => s.card && s.unavailable && /Currently Unavailable disabled=true/.test(s.off || '') && !s.book && s.options.length === 0 && s.moreAt === 'More at ABV'],
    ['no itemGroups → grouped from items', (r) => r.fulfill(json({ ...clone(SUCCESS), itemGroups: undefined })), (s) => s.card && s.options.length === 1],
    ['loungePropertyCount 3 → View more', (r) => r.fulfill(json({ ...clone(SUCCESS), loungePropertyCount: 3 })), (s) => s.card && /View more properties/.test(s.more || '')],
  ];
  for (const [name, answer, ok] of cases) {
    // eslint-disable-next-line no-await-in-loop
    const { page, s } = await run('ABV', 'abuja', { answer });
    check(name, ok(s), JSON.stringify({
      card: s.card, title: s.title, place: s.place, now: s.now, was: s.was, photos: s.photos.length, features: s.features.length, status: s.status, off: s.off, more: s.more,
    }));
    // eslint-disable-next-line no-await-in-loop
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    // eslint-disable-next-line no-await-in-loop
    await page.close();
  }
  // a railway station: no call, View all (the locations answer says HKG is a station)
  const { page, s, calls } = await run('HKG', 'hong kong int', {
    extraRoute: (p) => p.route(/ppg-app\/getGeoLocation/, async (r) => {
      const resp = await r.fetch();
      const body = await resp.json();
      body.defaultOption = null;
      body.data.forEach((l) => { if (l.iata === 'HKG') l.locationTypeCode = 'RLWYSTN'; });
      await r.fulfill({ response: resp, body: JSON.stringify(body) });
    }),
  });
  check('railway station: no call, View all', !s.card && calls.length === 0 && /View all/.test(s.more || ''), `${calls.length} calls | ${s.more}`);
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.close();
}

if (!only || only === 'flow') {
  const page = await open(browser, { width: 1440 });
  const calls = [];
  page.on('request', (r) => { if (/getbookingwidgetproducts/.test(r.url())) calls.push(JSON.parse(r.postData())); });
  await page.evaluate(() => document.querySelector('main .hero .booking-widget').dispatchEvent(new CustomEvent('booking-widget:set-location', { detail: { airport: 'ABV' } })));
  await page.waitForTimeout(800);
  await waitDone(page);
  let s = await state(page);
  check('set-location ABV → card', s.card && s.title === 'SDS Lounge', s.title);
  const n = calls.length;
  await page.locator(`${W} .booking-widget-adults .booking-widget-step-plus`).click({ force: true });
  await page.locator(`${W} .booking-widget-adults .booking-widget-step-plus`).click({ force: true });
  await page.waitForTimeout(300);
  const mid = calls.length;
  await page.waitForTimeout(700);
  await waitDone(page);
  check('two quick guest changes → one request', mid === n && calls.length === n + 1 && calls.at(-1).adult === 3, `${calls.length - n} request(s), adult ${calls.at(-1)?.adult}`);
  await pick(page, 'dubai int', 'DXB');
  await page.waitForTimeout(100);
  await pick(page, 'abuja', 'ABV');
  await waitDone(page);
  await page.waitForTimeout(800);
  s = await state(page);
  check('quick airport change: the last one shows', s.title === 'SDS Lounge' && s.moreAt === 'More at ABV', `${s.title} | ${s.moreAt}`);
  await page.locator('header a[href="#book-now"]:visible').first().click();
  await page.waitForSelector('dialog.modal[open] .booking-widget');
  const inp = page.locator('dialog.modal[open] .booking-widget-where-input');
  await inp.click();
  await inp.fill('hong kong int');
  await page.locator('dialog.modal[open] .booking-widget-option').first().click();
  await page.waitForTimeout(2500);
  const sections = await page.evaluate(() => document.querySelectorAll('.booking-widget-products').length);
  check('Book Now dialog: no lounge card', sections === 1 && !(await page.evaluate(() => !!document.querySelector('dialog .booking-widget-products'))), `${sections} section(s)`);
  check('flow: no page errors', !page.errors.length, page.errors.join(' | '));
  await page.close();
}
await browser.close();
console.log(`\n${results.filter((r) => r.startsWith('FAIL')).length} failed of ${results.length}`);
