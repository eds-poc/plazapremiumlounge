// Book Your Visit (blocks/book-your-visit) and its Add-ons (blocks/add-ons) on the local
// /en-uk/book-your-visit page, with the booking system's cart routed: GET answers the lounge cart
// fixture (fixtures/cart.json: PRPRTY816, its start as the test sets it, Hong Kong's time zone)
// with the add-on lines the PUTs gave it; PUT keeps the products it's sent. The add-ons are the
// sample answer (blocks/add-ons/sample-add-ons.json). Usage: node book-your-visit.test.mjs
import { readFileSync } from 'node:fs';
import { PW, UA } from '../booking-widget/harness.mjs';

const { chromium } = await import(PW);
const HOST = process.env.BW_HOST || 'http://localhost:3000';
const LOUNGE = JSON.parse(readFileSync(new URL('./fixtures/cart.json', import.meta.url), 'utf8'));
const PASS = JSON.parse(readFileSync(new URL('./fixtures/cart-pass.json', import.meta.url), 'utf8'));
const THIRD = /googletagmanager|adobedtm|netcore|facebook|stackadapt|yimg|hansel|consentag\.eu|ctnsnet|bing|denomatic|affilired|lkh\.plaza|cookielaw|hcaptcha/;
const TZ = 'Asia/Hong_Kong';
const browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] });
let failed = 0;
const check = (name, ok, info = '') => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info ? ` — ${info}` : ''}`); };
const json = (body, status = 200) => ({
  status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body),
});
// Hong Kong's today and its date in `days`
const hkDate = (days = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(Date.now() + days * 864e5));
const SAKURA = 'PRD3772-Add-On-PRPRTY816-LOUNGE-LCTN517-RTPLN3773';
const XO = 'PRD3877-Add-On-PRPRTY817-LOUNGE-LCTN517-RTPLN3861';
// the site's own errors: not the local navigation and footer copies' (their section-metadata,
// icons), the tags', nor the lounge detail service's answer (it falls back)
const ownErrors = (errors) => errors.filter((e) => !/section-metadata|Failed to load resource|ERR_|net::|icons?\b/i.test(e));

/**
 * The cart service: the lounge (`start`), with the add-on lines the PUTs give; `fail` answers a
 * method with a 500 instead.
 */
function cartService({ start = `${hkDate(7)} 15:00:00`, fail = {}, cart = 'lounge' } = {}) {
  const api = { gets: 0, puts: [] };
  let lounge = { catalogueCode: LOUNGE.products[0].catalogueCode, startDate: start };
  let addons = [];
  const answer = () => {
    if (cart === 'pass') return { ...structuredClone(PASS), cartId: 'CRT_TEST' };
    const a = structuredClone(LOUNGE);
    a.cartId = 'CRT_TEST';
    a.products[0].startDate = lounge.startDate;
    a.products[0].timeZone = '(GMT+8:00) Asia/Hong_Kong, China Standard Time';
    addons.forEach((p, i) => a.products.push({
      ...structuredClone(LOUNGE.products[0]),
      cartItemId: `CRT_ITM_A${i}`,
      productType: 'Add-On',
      serviceCode: 'SRVC1638',
      catalogueCode: p.catalogueCode,
      productCode: p.catalogueCode.split('-')[0],
      productDisplayName: p.catalogueCode === SAKURA ? 'Plaza Premium Lounge Sakura Shrimp Spice (50g)' : 'Plaza Premium Lounge XO Sauce (100g)',
      quantity: Number(p.quantity),
      startDate: p.startDate,
      itemPriceDetails: { productTotalPrice: { totalPrice: 23.03 * Number(p.quantity), totalBasePrice: 23.03 * Number(p.quantity) }, discounts: [] },
    }));
    return a;
  };
  const route = async (r) => {
    const req = r.request();
    const method = req.method();
    if (method === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    await new Promise((res) => { setTimeout(res, method === 'GET' ? 120 : 300); });
    if (fail[method]) return r.fulfill(json({ error: 'down' }, 500));
    if (method === 'PUT') {
      const body = JSON.parse(req.postData());
      api.puts.push(body);
      [lounge] = body.products;
      addons = body.products.slice(1);
      return r.fulfill(json({ cartId: 'CRT_TEST' }));
    }
    api.gets += 1;
    return r.fulfill(json(answer()));
  };
  return { api, route };
}

/** The page with the routed cart (`cart: null`: no cart kept). */
async function open({
  width = 1440, height = 900, path = '/en-uk/book-your-visit', service = cartService(), cart = true, addonsAnswer,
} = {}) {
  const page = await browser.newPage({ viewport: { width, height }, userAgent: UA });
  page.setDefaultTimeout(15000);
  page.errors = [];
  page.addonCalls = 0;
  page.on('pageerror', (e) => page.errors.push(`pageerror ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(`console ${m.text().slice(0, 200)}`); });
  await page.route(THIRD, (r) => r.abort());
  await page.route(/ppg-app\/cart(\?|$)/, service.route);
  await page.route(/sample-add-ons\.json/, async (r) => {
    page.addonCalls += 1;
    if (addonsAnswer) return r.fulfill(addonsAnswer);
    return r.fallback();
  });
  // the checkout (where Check Out goes): a blank page
  await page.route(/\/guest-checkout$/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>checkout</body></html>' }));
  if (cart) {
    await page.addInitScript(() => localStorage.setItem('ppl-cart-id', JSON.stringify({
      id: 'CRT_TEST', expires: Date.now() + 20 * 3600e3, changed: Date.now(), count: 1, codes: [],
    })));
  }
  page.api = service.api;
  await page.goto(`${HOST}${path}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(2500);
  return page;
}

const state = (page) => page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const t = (s) => q(s)?.textContent.replace(/\s+/g, ' ').trim() || '';
  return {
    url: `${window.location.pathname}${window.location.search}`,
    blocks: [...document.querySelectorAll('main .block')].map((b) => `${b.classList[0]}:${b.dataset.blockStatus}`),
    badge: t('.book-your-visit-lounge .checkout-badge-label'),
    name: t('.book-your-visit-name'),
    place: t('.book-your-visit-place'),
    date: t('.book-your-visit-date-text'),
    time: q('.book-your-visit-time-select')?.value,
    locked: [...document.querySelectorAll('.book-your-visit-locked')].map((i) => `${i.value}|${i.disabled}|${i.readOnly}`),
    labels: [...document.querySelectorAll('.book-your-visit-fields .book-your-visit-label')].map((l) => l.textContent.trim()),
    back: q('main .title.back a')?.getAttribute('href'),
    summary: t('.book-your-visit-summary'),
    checkOut: t('.book-your-visit-summary .checkout-payment'),
    addons: [...document.querySelectorAll('.add-ons-item')].map((i) => i.innerText.replace(/\s+/g, ' ').trim()),
    addonsUnderForm: !!q('.book-your-visit-main .add-ons-wrapper'),
    error: q('.book-your-visit-error')?.hidden ? '' : t('.book-your-visit-error'),
    count: JSON.parse(localStorage.getItem('ppl-cart-id') || 'null')?.count,
  };
});

// 1. the page (1440): its blocks, the lounge, the date and time, the locked fields, the summary,
// the back link, the add-ons under the form
{
  const page = await open();
  const s = await state(page);
  check('the page: Booking Steps, Title (back), Book Your Visit, Add-ons, all loaded', JSON.stringify(s.blocks) === JSON.stringify(['booking-steps:loaded', 'title:loaded', 'book-your-visit:loaded', 'add-ons:loaded']), JSON.stringify(s.blocks));
  check('the lounge: Departures badge, its name and location', /departures/i.test(s.badge) && s.name === 'Plaza Premium Lounge' && s.place === 'Near Gate 1, Departures, Hong Kong International Airport', JSON.stringify([s.badge, s.name, s.place]));
  check('Date and Time from the cart (a week ahead, 1500)', /^\d{2}-\w{3}-\d{4}$/.test(s.date) && s.time === '1500', JSON.stringify([s.date, s.time]));
  check('Adult(s), Child(ren), Service Details shown and locked', JSON.stringify(s.locked) === JSON.stringify(['1|true|true', '0|true|true', 'Lounge Use - 5 Hours|true|true']), JSON.stringify(s.locked));
  check('the labels (authored)', JSON.stringify(s.labels) === JSON.stringify(['Date', 'Time', 'Adult(s)', 'Child(ren) Complimentary for under 2 years old', 'Service Details']), JSON.stringify(s.labels));
  check('the back arrow: the lounge page with the visit', s.back === `/en-uk/find/lounge?propertycode=PRPRTY816&currency=HKD&date=${hkDate(7)}&time=1500`, s.back);
  check('the Booking Summary: the lounge, the totals, the promo code, Check Out', /Booking Summary/.test(s.summary) && /HKD 787\.50/.test(s.summary) && /PROMO CODE/i.test(s.summary) && s.checkOut === 'Check Out', s.summary.slice(0, 200));
  check('the add-ons under the form: Sakura (PRPRTY816\'s price) and XO Sauce (the first in stock)', s.addonsUnderForm && JSON.stringify(s.addons) === JSON.stringify(['Plaza Premium Lounge Sakura Shrimp Spice (50g) Add', 'Plaza Premium Lounge XO Sauce (100g) Add']), JSON.stringify(s.addons));
  check('no page errors from the site\'s code', !ownErrors(page.errors).length, ownErrors(page.errors).join(' | '));

  // 2. the add-on pop-up: its price, 1 to 10, Add → the cart's lounge with the add-on
  await page.locator('.add-ons-item-button').first().click();
  await page.waitForSelector('dialog.add-ons-modal[open]');
  const pop = () => page.evaluate(() => {
    const d = document.querySelector('dialog.add-ons-modal[open]');
    return d && {
      qty: d.querySelector('.add-ons-qty').value, total: d.querySelector('.add-ons-popup-amount').textContent, minus: d.querySelector('.add-ons-minus').disabled, plus: d.querySelector('.add-ons-plus').disabled, name: d.querySelector('.add-ons-popup-name').textContent, title: d.querySelector('.modal-title')?.textContent,
    };
  });
  let p = await pop();
  check('pop-up: the name, quantity 1 (− off), USD 22.96 (the booked lounge\'s price)', p.name === 'Plaza Premium Lounge Sakura Shrimp Spice (50g)' && p.title === p.name && p.qty === '1' && p.minus && p.total === 'USD 22.96', JSON.stringify(p));
  for (let i = 0; i < 12; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await page.locator('dialog.add-ons-modal[open] .add-ons-plus').click({ force: true });
  }
  p = await pop();
  check('pop-up: + stops at 10 (the product\'s maximum), the total 10 × 22.96', p.qty === '10' && p.plus && p.total === 'USD 229.60', JSON.stringify(p));
  for (let i = 0; i < 8; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await page.locator('dialog.add-ons-modal[open] .add-ons-minus').click();
  }
  await page.locator('dialog.add-ons-modal[open] .add-ons-popup-add').click();
  await page.waitForFunction(() => !document.querySelector('dialog.add-ons-modal[open]'), null, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(800);
  const put = page.api.puts.at(-1);
  check('Add: one PUT with the lounge and Sakura ×2 at the lounge\'s start', page.api.puts.length === 1 && put.products.length === 2 && put.products[1].catalogueCode === SAKURA && put.products[1].quantity === '2' && put.products[1].startDate === put.products[0].startDate, JSON.stringify(put?.products));
  let s2 = await state(page);
  check('after Add: the row (as live\'s) the name, "2x name" and Remove, the summary\'s Additional Services, the count 3', s2.addons[0] === 'Plaza Premium Lounge Sakura Shrimp Spice (50g) 2x Plaza Premium Lounge Sakura Shrimp Spice (50g) Remove' && /Additional Services: ?2x Plaza Premium Lounge Sakura/.test(s2.summary) && s2.count === 3, JSON.stringify([s2.addons, s2.count, s2.summary.match(/.{40}Additional.{60}/)?.[0]]));

  // 3. Remove: the confirmation, Yes → the lounge alone
  await page.locator('.add-ons-item.is-added .add-ons-item-button').click();
  await page.waitForSelector('dialog.add-ons-confirm-modal[open]');
  const confirmText = await page.locator('dialog.add-ons-confirm-modal[open] .add-ons-confirm').innerText();
  await page.locator('dialog.add-ons-confirm-modal[open] .add-ons-yes').click();
  await page.waitForTimeout(1500);
  s2 = await state(page);
  check('Remove: "Would you like to remove this order from the shopping cart?" + the name; Yes: a PUT with the lounge alone, the row back to Add', /Would you like to remove this order from the shopping cart\?/.test(confirmText) && /Sakura/.test(confirmText) && page.api.puts.at(-1).products.length === 1 && /Add$/.test(s2.addons[0]) && s2.count === 1, JSON.stringify([confirmText, page.api.puts.at(-1).products.length, s2.addons]));

  // 4. a time change, then Check Out: the visit saved (PUT with the new start), then the checkout
  const before = page.addonCalls;
  await page.locator('.book-your-visit-time-select').selectOption('1700');
  await page.waitForTimeout(800);
  check('a time change: the add-ons asked again (for the new start)', page.addonCalls > before, `${before} → ${page.addonCalls}`);
  await page.locator('.book-your-visit-summary .checkout-payment').click();
  await page.waitForURL(/guest-checkout/, { timeout: 15000 }).catch(() => {});
  check('Check Out after a change: a PUT with the new start, then the checkout', page.api.puts.at(-1).products[0].startDate === `${hkDate(7)} 17:00:00` && /\/en-uk\/guest-checkout$/.test(page.url()), JSON.stringify([page.api.puts.at(-1).products[0].startDate, page.url()]));
  await page.close();
}

// 4b. XO Sauce: no price of the booked lounge's, so the first in stock (PRPRTY817's, USD 13.78), as live
{
  const page = await open();
  await page.locator('.add-ons-item-button').nth(1).click();
  await page.waitForSelector('dialog.add-ons-modal[open]');
  const total = await page.locator('dialog.add-ons-modal[open] .add-ons-popup-amount').textContent();
  await page.locator('dialog.add-ons-modal[open] .add-ons-popup-add').click();
  await page.waitForTimeout(1500);
  const put = page.api.puts.at(-1);
  check('XO Sauce: USD 13.78 (the first lounge in stock), its Add puts that lounge\'s code', total === 'USD 13.78' && put?.products[1]?.catalogueCode === XO && put.products[1].quantity === '1', JSON.stringify([total, put?.products[1]]));
  await page.close();
}

// 5. Check Out without a change: no PUT, the checkout; a failed save: the error, the page stays
{
  let page = await open();
  await page.locator('.book-your-visit-summary .checkout-payment').click();
  await page.waitForURL(/guest-checkout/, { timeout: 15000 }).catch(() => {});
  check('Check Out unchanged: no PUT, the checkout', !page.api.puts.length && /guest-checkout$/.test(page.url()), page.url());
  await page.close();
  page = await open({ service: cartService({ fail: { PUT: true } }) });
  await page.locator('.book-your-visit-time-select').selectOption('1800');
  await page.locator('.book-your-visit-summary .checkout-payment').click();
  await page.waitForTimeout(2000);
  const s = await state(page);
  check('a failed save: "An error occurred. Please try again.", the page stays', s.error === 'An error occurred. Please try again.' && /book-your-visit/.test(s.url), JSON.stringify([s.error, s.url]));
  await page.close();
}

// 6. today at the lounge: the times before now + an hour + 15 minutes (onto the next half hour) off
{
  const page = await open({ service: cartService({ start: `${hkDate(0)} 00:00:00` }) });
  const info = await page.evaluate(() => {
    const options = [...document.querySelectorAll('.book-your-visit-time-select option')];
    return { value: document.querySelector('.book-your-visit-time-select').value, firstOn: options.find((o) => !o.disabled)?.value || '', off: options.filter((o) => o.disabled).length };
  });
  const now = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date()).split(':').map(Number);
  const later = now[0] * 60 + now[1] + 60 + 15;
  const first = later % 30 ? later + (30 - (later % 30)) : later + 30;
  const expected = first >= 1440 ? '' : `${String(Math.floor(first / 60)).padStart(2, '0')}${String(first % 60).padStart(2, '0')}`;
  check('today: the first time on is the half hour after now + 1 h + 15 min (Hong Kong), chosen; the earlier ones off', info.firstOn === expected && info.value === expected && info.off === first / 30, JSON.stringify({ ...info, expected }));
  await page.close();
}

// 7. a failed add: the pop-up says so and stays
{
  const page = await open({ service: cartService({ fail: { PUT: true } }) });
  await page.locator('.add-ons-item-button').first().click();
  await page.waitForSelector('dialog.add-ons-modal[open]');
  await page.locator('dialog.add-ons-modal[open] .add-ons-popup-add').click();
  await page.waitForTimeout(1500);
  const err = await page.locator('dialog.add-ons-modal[open] .add-ons-popup-error').textContent().catch(() => '');
  check('a failed add: "Unable to add service. Please try again." in the pop-up', err === 'Unable to add service. Please try again.', err);
  await page.close();
}

// 8. phones (375): the list with Edit, the date pop-up, the promo field once, the bar, no summary card
{
  const page = await open({ width: 375, height: 812 });
  const info = await page.evaluate(() => ({
    rows: [...document.querySelectorAll('.book-your-visit-phone-row')].map((r) => r.innerText.replace(/\s+/g, ' ').trim()),
    promo: document.querySelectorAll('.checkout-promo-input').length,
    fields: getComputedStyle(document.querySelector('.book-your-visit-fields')).display,
    card: getComputedStyle(document.querySelector('.book-your-visit-summary')).display,
    bar: document.querySelector('.book-your-visit-bar')?.innerText.replace(/\s+/g, ' ').trim(),
    barFixed: getComputedStyle(document.querySelector('.book-your-visit-bar')).position,
    wide: document.documentElement.scrollWidth > 375,
  }));
  check('375: Date and Time with Edit, Guests, Services; one promo field; the fields and the card hidden', info.rows.length === 4 && /Edit$/.test(info.rows[0]) && /Edit$/.test(info.rows[1]) && /Guests:/.test(info.rows[2]) && info.promo === 1 && info.fields === 'none' && info.card === 'none', JSON.stringify(info));
  check('375: the bar fixed at the bottom: Subtotal HKD 787.50, HKD 875.00 struck, Confirm & Proceed; nothing wider than the screen', info.barFixed === 'fixed' && /Subtotal HKD 787\.50 HKD 875\.00 CONFIRM & PROCEED/i.test(info.bar) && !info.wide, info.bar);
  await page.locator('.book-your-visit-edit').first().click();
  await page.waitForSelector('dialog.book-your-visit-modal[open]');
  const day = await page.locator('dialog.book-your-visit-modal[open] td[data-date]:not([aria-disabled="true"])').nth(10).getAttribute('data-date');
  await page.locator(`dialog.book-your-visit-modal[open] td[data-date="${day}"]`).click();
  await page.locator('dialog.book-your-visit-modal[open] .book-your-visit-confirm').click();
  await page.waitForTimeout(600);
  const row = await page.locator('.book-your-visit-phone-row').first().innerText();
  const [y, m, dd] = day.split('-');
  const mon = new Date(`${day}T00:00:00Z`).toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
  check('375: Date\'s Edit → the calendar, a day, Confirm → the list shows it', row.includes(`${dd}-${mon}-${y}`) && !!m, `${row} vs ${day}`);
  await page.close();
}

// 9. no cart, or a cart of passes: the homepage
{
  let page = await open({ cart: false });
  check('no cart: the homepage', /\/en-uk\/$/.test(new URL(page.url()).pathname), page.url());
  await page.close();
  page = await open({ service: cartService({ cart: 'pass' }) });
  await page.waitForTimeout(1500);
  check('a cart of passes: the homepage', /\/en-uk\/$/.test(new URL(page.url()).pathname), page.url());
  await page.close();
}

// 10. the other languages: their texts
for (const [lang, title, checkout] of [['zh-cn', '日期', '结账'], ['zh-hk', '日期', '結帳'], ['ja-jp', '日付', 'チェックアウト'], ['pt-br', 'Data', 'Finalizar Compra']]) {
  // eslint-disable-next-line no-await-in-loop
  const page = await open({ path: `/${lang}/book-your-visit` });
  // eslint-disable-next-line no-await-in-loop
  const s = await state(page);
  check(`${lang}: the page in its language (${title}, ${checkout}), the add-ons`, s.labels[0] === title && s.checkOut === checkout && s.addons.length === 2 && s.back.startsWith(`/${lang}/find/lounge?`), JSON.stringify([s.labels[0], s.checkOut, s.addons.length, s.back]));
  // eslint-disable-next-line no-await-in-loop
  await page.close();
}

// 11. axe (1440 and 375)
if (process.env.AXE_CORE) {
  for (const width of [1440, 375]) {
    // eslint-disable-next-line no-await-in-loop
    const page = await open({ width, height: 900 });
    // eslint-disable-next-line no-await-in-loop
    await page.addScriptTag({ path: process.env.AXE_CORE });
    // eslint-disable-next-line no-await-in-loop
    const violations = await page.evaluate(async () => {
      // eslint-disable-next-line no-undef
      const r = await axe.run({ include: [['main .book-your-visit'], ['main .add-ons']] }, { runOnly: ['wcag2a', 'wcag2aa'] });
      return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join('; ')}`);
    });
    check(`${width} axe: no violations`, !violations.length, violations.join(' | '));
    // eslint-disable-next-line no-await-in-loop
    await page.close();
  }
}

await browser.close();
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
