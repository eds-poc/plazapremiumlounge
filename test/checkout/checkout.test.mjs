// The Checkout block (blocks/checkout) on /en-uk/guest-checkout, with routed answers: the cart
// API as stage answers it (test/cart/fixtures: a lounge cart, a pass cart), the countries as the
// GetCountries API answers them (fixtures/countries.json). Checks:
// - the summary, the terms and the flight fields for a lounge cart and a pass cart
// - a lounge's Departures / Arrivals badge (from its location's words) and its tip
// - Payment off until both boxes are ticked
// - the source's rules: required fields, the contact number (digits; with its code, 7 to 15),
//   the emails, the flight number (digits, padded to 3)
// - the valid form announced as checkout:payment (the guest and the cart), the preview's note
// - no cart, a cart that can't be read, a cart emptied meanwhile
// - the phone layout (summary first, the bar, the fold) and the desktop one
// - the page's other blocks: Booking Steps (with and without its phone name), Title (back), the
//   banner's Promo card buttons; old Checkout rows (steps, back, banner) left out; five languages
// - axe (with AXE_CORE)
// The page is the split one (Booking Steps, Title (back), Promo (card), Checkout): serve the local
// content (aem up --html-folder content --html-mount / --prefer-plain-html) until it's in DA.
// Usage: BW_HOST=http://localhost:3000 PLAYWRIGHT=… [AXE_CORE=…] node checkout.test.mjs
import { readFileSync } from 'node:fs';

const HOST = process.env.BW_HOST || 'http://localhost:3000';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
const fixture = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const LOUNGE_CART = fixture('../cart/fixtures/cart.json');
const PASS_CART = fixture('../cart/fixtures/cart-pass.json');
const COUNTRIES = fixture('./fixtures/countries.json');
const PATH = '/en-uk/guest-checkout';
// (the site's third-party tags: not this block's)
const THIRD = /googletagmanager|adobedtm|netcore|facebook|stackadapt|yimg|hansel|consentag\.eu|ctnsnet|bing|denomatic|affilired|lkh\.plaza|cookielaw|hcaptcha/;
const browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] });
let failed = 0;
const check = (name, ok, info = '') => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info ? ` — ${info}` : ''}`); };
const json = (body, status = 200) => ({
  status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body),
});

/**
 * Opens the checkout: `cart` is the cart API's answer (null: no cart kept; 'fail': the GET
 * answers 500), `stored` keeps the cart's data in the tab already.
 */
async function open({
  cart = LOUNGE_CART, width = 1440, height = 900, stored = false, path = PATH, html, host = HOST, setup,
  cartDelay = 0, wait = true,
} = {}) {
  const page = await browser.newPage({ viewport: { width, height }, userAgent: UA });
  // (the test's own routes and storage, before the page loads)
  if (setup) await setup(page);
  // another host (e.g. http://checkout.test, standing for the live site): every request to it
  // answered by the preview server
  if (host !== HOST) {
    await page.route((url) => url.origin === host, async (r) => {
      const u = new URL(r.request().url());
      try {
        await r.fulfill({ response: await r.fetch({ url: `${HOST}${u.pathname}${u.search}` }) });
      } catch { /* (the page closed meanwhile) */ }
    });
  }
  page.setDefaultTimeout(15000);
  page.errors = [];
  page.gets = 0;
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.route(THIRD, (r) => r.abort());
  // the page's markup changed on its way (html: a function of it)
  if (html) {
    await page.route(new RegExp(`${path.replace(/\//g, '\\/')}$`), async (r) => {
      const resp = await r.fetch();
      await r.fulfill({ response: resp, body: html(await resp.text()) });
    });
  }
  await page.route(/\/GetCountries/, (r) => r.fulfill(json(COUNTRIES)));
  await page.route(/ppg-app\/cart/, async (r) => {
    page.gets += 1;
    // (the booking system's answer after cartDelay ms, e.g. stage's few seconds)
    if (cartDelay) await new Promise((res) => { setTimeout(res, cartDelay); });
    try {
      if (cart === 'fail') await r.fulfill(json({ error: 'down' }, 500));
      else await r.fulfill(json({ ...cart, cartId: 'CRT_TEST' }));
    } catch { /* (the page closed meanwhile) */ }
  });
  // the promo code as stage answers it: an unknown code (BKNG048)
  page.promos = [];
  await page.route(/ppg-app\/cart-validate-promocode/, (r) => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    page.promos.push(JSON.parse(r.request().postData() || '{}'));
    return r.fulfill(json({ details: 'No record found', errorCode: 'BKNG048', message: 'No record found for the provided promotional code.' }));
  });
  if (cart) {
    await page.addInitScript(`localStorage.setItem('ppl-cart-id', JSON.stringify({ id: 'CRT_TEST', expires: Date.now() + 20 * 3600e3, changed: Date.now(), count: 1, codes: [] }));
${stored ? 'sessionStorage.setItem(\'ppl-cart\', JSON.stringify({ cartId: \'CRT_TEST\', currency: \'HKD\', fetchedAt: Date.now(), expires: Date.now() + 3600e3, totals: { base: 100, discounts: [], total: 100 }, lines: [{ catalogueCode: \'X\', kind: \'lounge\', name: \'Stored Lounge\', product: \'Lounge Use\', place: \'\', start: \'2099-01-01 10:00:00\', adults: 1, children: 0, quantity: 1, total: 100 }], terms: [] }));' : ''}`);
  }
  await page.addInitScript(() => {
    window.payments = [];
    document.addEventListener('checkout:payment', (e) => window.payments.push(JSON.parse(JSON.stringify(e.detail))));
  });
  page.started = Date.now();
  await page.goto(`${host}${path}`, { waitUntil: 'load', timeout: 60000 });
  if (host !== HOST || !wait) return page;
  await page.waitForFunction(() => document.querySelector('.checkout')?.dataset.blockStatus === 'loaded', null, { timeout: 30000 });
  // the countries in, the cart read
  await page.waitForFunction(() => document.querySelector('.checkout .form-field-country select')?.options.length > 2, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  return page;
}

const field = (key) => `.checkout .form-field[data-key="${key}"]`;
const errorOf = (page, key) => page.locator(`${field(key)} .form-error`).evaluate((e) => (e.hidden ? '' : e.textContent));
const paymentDisabled = (page) => page.locator('.checkout .checkout-payment-summary').isDisabled();
const tick = (page, key, on = true) => page.locator(`${field(key)} input`).setChecked(on, { force: true });

// a lounge cart
{
  const page = await open();
  const info = await page.evaluate(() => {
    const b = document.querySelector('.checkout');
    return {
      title: document.querySelector('main .title.back .title-heading')?.textContent,
      back: document.querySelector('main .title.back .title-back')?.getAttribute('href'),
      active: document.querySelector('main .booking-steps-item.is-active .booking-steps-name')?.textContent,
      summary: b.querySelector('.checkout-summary')?.innerText.replace(/\s+/g, ' '),
      terms: [...b.querySelectorAll('.checkout-terms-name')].map((h) => h.textContent),
      termsAfterBox: b.querySelector('.form-field[data-key="termsAgreed"] + .checkout-terms-slot .checkout-terms') !== null,
      flight: ['arrivalDepartureFlight', 'flightNumber'].map((k) => !b.querySelector(`.form-field[data-key="${k}"]`).hidden),
      ownSubmit: b.querySelectorAll('.form-submit').length,
      metaRobots: document.querySelector('meta[name="robots"]')?.content || '',
    };
  });
  check('title and back link', info.title === 'Back to Edit Booking' && /book-your-visit$/.test(info.back), `${info.title} ${info.back}`);
  check('the current step is Details', info.active === 'Details', info.active);
  check('summary: lounge, place, date, time, guests, service', /Plaza Premium Lounge Near Gate 1, Departures, Hong Kong International Airport Date: 28-Nov-2026 Time: 1500 ?hrs Guests: 1 Adult\(s\) Services: Lounge Use - 5 Hours/.test(info.summary), info.summary);
  check('summary: service total, discount, the promo field, the total with its note under it', /Service Total: HKD 875\.00 10% Online Discount \[Lounge Booking\]: - HKD 87\.50 PROMO CODE Total HKD 787\.50 \(Includes applicable taxes and fees\)/.test(info.summary), info.summary);
  check('the cart\'s terms after the T&C box', info.termsAfterBox && info.terms.length >= 1, info.terms.join(' | '));
  check('a lounge asks for the flight', info.flight.every(Boolean));
  check('no form button (Payment instead)', info.ownSubmit === 0);
  check('the cart read from the booking system', page.gets >= 1, `${page.gets}`);

  // Payment waits for both boxes
  check('Payment off to start with', await paymentDisabled(page));
  await tick(page, 'consent');
  check('Payment off with the Privacy box only', await paymentDisabled(page));
  await tick(page, 'termsAgreed');
  check('Payment on with both boxes', !(await paymentDisabled(page)));
  await tick(page, 'consent', false);
  check('Payment off again when a box is unticked', await paymentDisabled(page));
  await tick(page, 'consent');

  // an empty form
  await page.locator('.checkout .checkout-payment-summary').click();
  await page.waitForTimeout(300);
  const empty = await Promise.all(['title', 'firstName', 'lastName', 'countryOfResidence', 'contactNumber', 'emailAddress', 'confirmEmailAddress'].map((k) => errorOf(page, k)));
  check('required fields: the source\'s messages', empty.join('|') === 'Please select title|Please fill in first name.|Please fill in last name.|Please fill in Country of Residence|Please fill in contact number|Please fill in email address.|Please retype the email address', empty.join('|'));
  check('focus on the first field in error', await page.evaluate(() => document.activeElement?.closest('.form-field')?.dataset.key) === 'title');
  check('no payment announced', (await page.evaluate(() => window.payments.length)) === 0);

  // the contact number: digits only; with its code, 7 to 15 digits
  const phone = page.locator(`${field('contactNumber')} input`);
  await phone.pressSequentially('12ab3');
  check('contact number: digits only', await phone.inputValue() === '123', await phone.inputValue());
  await phone.blur();
  check('contact number too short (+1 and 3 digits)', await errorOf(page, 'contactNumber') === 'Please fill in valid contact number', await errorOf(page, 'contactNumber'));
  await phone.fill('2025550123');
  await phone.blur();
  check('a valid contact number', await errorOf(page, 'contactNumber') === '');
  // the country of residence sets the code
  await page.locator(`${field('countryOfResidence')} select`).selectOption({ label: 'Hong Kong SAR, China' });
  check('the country sets the dial code', (await page.locator(`${field('contactNumber')} select`).evaluate((s) => s.selectedOptions[0]?.textContent)) === '+852 (HK)');

  // the emails
  const email = page.locator(`${field('emailAddress')} input`);
  await email.fill('not-an-email');
  await email.blur();
  check('email: the source\'s format message', await errorOf(page, 'emailAddress') === 'Please enter a valid email address', await errorOf(page, 'emailAddress'));
  await email.fill('guest@example.com');
  const confirm = page.locator(`${field('confirmEmailAddress')} input`);
  await confirm.fill('other@example.com');
  await confirm.blur();
  check('confirm email: Email do not match', await errorOf(page, 'confirmEmailAddress') === 'Email do not match', await errorOf(page, 'confirmEmailAddress'));
  await confirm.fill('guest@example.com');
  await confirm.blur();

  // the flight number: digits, padded to 3
  const flight = page.locator(`${field('flightNumber')} input`);
  await flight.pressSequentially('7x');
  await flight.blur();
  check('flight number: digits, "7" → "007"', await flight.inputValue() === '007', await flight.inputValue());
  check('flight number: at most 4', await flight.getAttribute('maxlength') === '4');

  // the rest, then Payment
  await page.locator(`${field('title')} select`).selectOption('Mr.');
  await page.locator(`${field('firstName')} input`).fill('Probe');
  await page.locator(`${field('lastName')} input`).fill('Test');
  await page.locator(`${field('arrivalDepartureFlight')} input`).fill('CX');
  await page.locator('.checkout .checkout-payment-summary').click();
  await page.waitForTimeout(500);
  const sent = await page.evaluate(() => window.payments);
  const guest = sent[0]?.guest || {};
  check('a valid form announced once', sent.length === 1, `${sent.length}`);
  check('the guest\'s details', guest.title === 'Mr.' && guest.firstName === 'Probe' && guest.lastName === 'Test' && guest.emailAddress === 'guest@example.com' && guest.contactNumber === '2025550123' && guest.phoneCountryCode === '+852', JSON.stringify(guest));
  check('the country as its id, the flight, the boxes', guest.countryOfResidence === 33 && guest.arrivalDepartureFlight === 'CX' && guest.flightNumber === '007' && guest.consent === true && guest.termsAgreed === true && guest.newsletter === false, JSON.stringify(guest));
  check('the cart with it', sent[0]?.cart?.cartId === 'CRT_TEST' && sent[0]?.cart?.lines?.length === 1);
  const status = await page.locator('.checkout .form-status').evaluate((s) => (s.hidden ? '' : s.textContent.trim()));
  check('the preview says payment isn\'t connected', /Payment isn’t connected yet/.test(status), status);
  check('no page errors', !page.errors.length, page.errors.join(' | '));
  await page.close();
}

// a pass cart
{
  const page = await open({ cart: PASS_CART });
  const info = await page.evaluate(() => {
    const b = document.querySelector('.checkout');
    return {
      summary: b.querySelector('.checkout-summary')?.innerText.replace(/\s+/g, ' '),
      flight: ['arrivalDepartureFlight', 'flightNumber'].map((k) => b.querySelector(`.form-field[data-key="${k}"]`).hidden),
      terms: [...b.querySelectorAll('.checkout-terms-name')].map((h) => h.textContent),
    };
  });
  check('pass: its name, Quantity and price, the "For me" pill, the promo field', /Global Family Pass.*Quantity: 1 USD 85\.00 For me PROMO CODE Total USD 85\.00 \(Includes applicable taxes and fees\)/.test(info.summary), info.summary);
  check('pass: no flight fields', info.flight.every(Boolean));
  check('pass: its own terms', info.terms.some((t) => /PASS/i.test(t)), info.terms.join(' | '));
  await page.locator(`${field('title')} select`).selectOption('Ms.');
  await page.locator(`${field('firstName')} input`).fill('Pass');
  await page.locator(`${field('lastName')} input`).fill('Guest');
  await page.locator(`${field('countryOfResidence')} select`).selectOption({ label: 'Singapore' });
  await page.locator(`${field('contactNumber')} input`).fill('81234567');
  await page.locator(`${field('emailAddress')} input`).fill('pass@example.com');
  await page.locator(`${field('confirmEmailAddress')} input`).fill('pass@example.com');
  await tick(page, 'consent');
  await tick(page, 'termsAgreed');
  await page.locator('.checkout .checkout-payment-summary').click();
  await page.waitForTimeout(500);
  const guest = (await page.evaluate(() => window.payments))[0]?.guest || {};
  check('pass: announced without the flight', guest.firstName === 'Pass' && !('flightNumber' in guest) && !('arrivalDepartureFlight' in guest), JSON.stringify(guest));
  await page.close();
}

// no cart; a cart that can't be read; the cart emptied meanwhile
{
  const none = await open({ cart: null });
  await tick(none, 'consent');
  await tick(none, 'termsAgreed');
  const text = await none.locator('.checkout .checkout-summary').innerText();
  check('no cart: "Please add item", Payment off', /Please add item/.test(text) && await paymentDisabled(none), text.replace(/\s+/g, ' '));
  check('no cart: no cart request', none.gets === 0, `${none.gets}`);
  check('no cart: one checkout, one banner, one band', await none.evaluate(() => document.querySelectorAll('main .checkout').length === 1 && document.querySelectorAll('main .promo.card').length === 1 && document.querySelectorAll('main .booking-steps').length === 1));
  await none.close();

  const down = await open({ cart: 'fail' });
  const downText = await down.locator('.checkout .checkout-summary').innerText();
  check('cart unreadable: the error text', /couldn’t load your cart/.test(downText), downText.replace(/\s+/g, ' '));
  await down.close();

  const page = await open();
  await page.evaluate(() => { localStorage.removeItem('ppl-cart-id'); sessionStorage.removeItem('ppl-cart'); window.dispatchEvent(new StorageEvent('storage', { key: 'ppl-cart-id' })); });
  // eslint-disable-next-line import/no-unresolved, import/no-absolute-path
  await page.evaluate(() => import('/scripts/cart-state.js').then((m) => m.forgetCart()));
  await page.waitForTimeout(300);
  const emptied = await page.locator('.checkout .checkout-summary').innerText();
  check('cart emptied meanwhile: the summary follows', /Please add item/.test(emptied), emptied.replace(/\s+/g, ' '));
  await page.close();

  // a tab with the cart's data shows it at once, then the booking system's
  const stored = await open({ stored: true });
  const storedText = await stored.locator('.checkout .checkout-summary').innerText();
  check('stored data replaced by the booking system\'s', /HKD 787\.50/.test(storedText) && !/Stored Lounge/.test(storedText), storedText.replace(/\s+/g, ' ').slice(0, 120));
  await stored.close();
}

// the Departures / Arrivals badge above a lounge's name, from its location's words (as the
// source's): departures (the fixture's "Near Gate 1, Departures"), arrivals, neither, a pass; its
// tip on hover, a click, Escape, a click elsewhere; above it on a phone; the zh-hk page's words
{
  const placed = (place) => {
    const c = structuredClone(LOUNGE_CART);
    c.products[0].shortLocation = place;
    return c;
  };
  const badgeOf = (page) => page.evaluate(() => {
    const badge = document.querySelector('.checkout .checkout-summary-line .checkout-badge');
    if (!badge) return null;
    const button = badge.querySelector('.checkout-badge-button');
    const tip = document.getElementById(button.getAttribute('aria-describedby'));
    const cs = getComputedStyle(button);
    const r = button.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    return {
      side: badge.className.replace('checkout-badge ', ''),
      text: button.innerText.trim(),
      tip: tip?.getAttribute('role') === 'tooltip' && tip.textContent,
      shown: getComputedStyle(tip).visibility === 'visible',
      beforeName: badge.nextElementSibling?.classList.contains('checkout-summary-name'),
      look: [cs.backgroundColor, cs.color, cs.fontSize, cs.fontWeight, cs.textTransform, cs.borderRadius, cs.padding, Math.round(r.height)].join(' '),
      icon: getComputedStyle(badge.querySelector('.checkout-badge-icon')).transform,
      tipAbove: t.bottom <= r.top,
      tipRight: t.left >= r.right,
    };
  });
  const tipShown = async (page) => (await badgeOf(page)).shown;

  let page = await open();
  let b = await badgeOf(page);
  check('badge: a departures lounge, above its name', b?.side === 'checkout-badge-departure' && b.text === 'DEPARTURES LOUNGE' && b.beforeName, JSON.stringify(b));
  check('badge: the source\'s look (#530e2a pill, white 11px 700 capitals, 6px corners, 4px 10px, 24px)', b?.look === 'rgb(83, 14, 42) rgb(255, 255, 255) 11px 700 uppercase 6px 4px 10px 24', b?.look);
  check('badge: the plane taking off', b?.icon === 'matrix(0.707107, -0.707107, 0.707107, 0.707107, 0, 0)', b?.icon);
  check('badge: its tip, hidden to start with', b?.tip === 'Located after security & immigration — you’ll need your boarding pass to enter.' && !b.shown, JSON.stringify(b));
  const button = page.locator('.checkout .checkout-badge-button');
  await button.hover();
  await page.waitForTimeout(250);
  const hovered = await badgeOf(page);
  check('badge: hover shows the tip, to its right', hovered.shown && hovered.tipRight, JSON.stringify(hovered));
  await page.mouse.move(1, 1);
  await page.waitForTimeout(250);
  check('badge: the tip goes with the pointer', !(await tipShown(page)));
  await button.click();
  await page.mouse.move(1, 1);
  await page.waitForTimeout(250);
  check('badge: a click keeps the tip shown', await tipShown(page));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  check('badge: Escape hides it', !(await tipShown(page)));
  await button.click();
  await page.mouse.move(1, 1);
  await page.locator('.checkout .checkout-summary-title').click();
  await page.waitForTimeout(250);
  check('badge: a click elsewhere hides it', !(await tipShown(page)));
  await page.close();

  page = await open({ cart: placed('Arrival Hall, Terminal 1') });
  b = await badgeOf(page);
  check('badge: an arrivals lounge, the plane landing', b?.side === 'checkout-badge-arrival' && b.text === 'ARRIVALS LOUNGE' && b.icon === 'matrix(0, 1, -1, 0, 0, 0)' && /^Located after you land/.test(b.tip), JSON.stringify(b));
  await page.close();

  page = await open({ cart: placed('Terminal 1') });
  check('badge: none when the location says neither', !(await badgeOf(page)));
  await page.close();

  page = await open({ cart: PASS_CART });
  check('badge: none on a pass', !(await badgeOf(page)));
  await page.close();

  page = await open({ width: 375, height: 812 });
  await page.locator('.checkout .checkout-badge-button').hover();
  await page.waitForTimeout(250);
  b = await badgeOf(page);
  check('badge: on a phone the tip is above it', b?.shown && b.tipAbove, JSON.stringify(b));
  await page.close();

  page = await open({ cart: placed('1號登機閘口附近, 離境層'), path: '/zh-hk/guest-checkout' });
  b = await badgeOf(page);
  check('badge: the zh-hk page\'s words and texts', b?.side === 'checkout-badge-departure' && b.text === '離境貴賓室' && b.tip === '位於安檢及離境檢查之後,需出示登機證方可進入。', JSON.stringify(b));
  await page.close();
}

// the source's look (the UI audit of 2026-11-17, .migration/plans/guest-checkout-ui-audit.md): the
// space under the steps band, the back title's text after its arrow, the dropdown arrow, the boxes
// (a ticked one filled with the white check), a field with an error (no ring, the "!" in it, the
// message right under it), the terms' lists, the summary (the fold up to 991px, the discount
// maroon, the note 11px #555, Payment light), the phone bar (15px in, Payment 14px from 576px)
const listed = structuredClone(LOUNGE_CART);
listed.sortedTermsPolicies = [...(listed.sortedTermsPolicies || []), { termsName: 'GENERAL - TERMS AND CONDITIONS', description: '<ul>SERVICE AND LOCATION<li>Guests must make sure that the area of their selected service location matches the area of the airport.</li><li>Shower usage is subject to availability.</li></ul>' }];
for (const width of [375, 576, 768, 992, 1440]) {
  const page = await open({ cart: listed, width, height: 900 });
  const f = (k) => page.locator(`.checkout .form-field[data-key="${k}"] .form-input:not(.form-phone-code)`);
  await f('emailAddress').fill('bad');
  await page.keyboard.press('Tab');
  await page.locator('.checkout .form-field[data-key="consent"] .form-check-input').check({ force: true });
  await page.mouse.move(1, 1);
  await page.waitForTimeout(300);
  const L = await page.evaluate(() => {
    const cs = (sel, pseudo) => { const n = document.querySelector(sel); return n && getComputedStyle(n, pseudo || null); };
    const box = (sel) => document.querySelector(sel)?.getBoundingClientRect();
    const arrow = box('main .title.back .title-back-arrow');
    const range = document.createRange();
    const link = document.querySelector('main .title.back .title-back');
    range.selectNodeContents([...link.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim()) || link);
    const email = document.querySelector('.checkout .form-field[data-key="emailAddress"]');
    const control = email.querySelector('.form-input').getBoundingClientRect();
    const message = email.querySelector('.form-error');
    return {
      stepsAfter: cs('main .booking-steps.block').marginBottom,
      titleGap: Math.round(range.getBoundingClientRect().left - arrow.right),
      select: [cs('.checkout .form-field[data-key="title"] .form-select').backgroundPositionX, cs('.checkout .form-field[data-key="title"] .form-select').paddingRight],
      ticked: [cs('.checkout .form-field[data-key="consent"] .form-check-input').backgroundColor, cs('.checkout .form-field[data-key="consent"] .form-check-input').boxShadow, cs('.checkout .form-field[data-key="consent"] .form-check-label', '::before').maskImage.includes('check.svg')],
      invalid: [cs('.checkout .form-field[data-key="emailAddress"] .form-input').boxShadow, cs('.checkout .form-field[data-key="emailAddress"] .form-control-wrap', '::after').maskImage.includes('circle-exclamation-outline'), Math.round(message.getBoundingClientRect().top - control.bottom), message.textContent],
      list: [cs('.checkout .checkout-terms-text ul').marginLeft, cs('.checkout .checkout-terms-text ul').paddingLeft, cs('.checkout .checkout-terms-text li').padding],
      toggle: cs('.checkout .checkout-summary-toggle')?.display,
      discount: cs('.checkout .checkout-summary-discount .checkout-summary-amount')?.color,
      note: [cs('.checkout .checkout-summary-note').fontSize, cs('.checkout .checkout-summary-note').color],
      payment: cs('.checkout .checkout-payment-summary').fontWeight,
      bar: [cs('.checkout .checkout-bar-total')?.paddingLeft, cs('.checkout .checkout-payment-bar')?.fontSize, cs('.checkout .checkout-bar')?.display],
    };
  });
  const phone = width < 768;
  check(`${width} look: ${phone ? 25 : width < 992 ? 35 : 50}px under the steps band; the title's text ${phone ? 20 : 23}px after its arrow`, L.stepsAfter === `${phone ? 25 : width < 992 ? 35 : 50}px` && L.titleGap === (phone ? 20 : 23), JSON.stringify([L.stepsAfter, L.titleGap]));
  check(`${width} look: the dropdown arrow 12px in, 25px of room`, L.select[0] === 'calc(100% - 12px)' && L.select[1] === '25px', JSON.stringify(L.select));
  check(`${width} look: a ticked box filled maroon (no inner ring) with the white check`, L.ticked[0] === 'rgb(83, 14, 42)' && L.ticked[1] === 'none' && L.ticked[2], JSON.stringify(L.ticked));
  check(`${width} look: an invalid field without the red ring, the "!" in it, its message ${phone ? 1 : 4}px under it`, L.invalid[0] === 'none' && L.invalid[1] && L.invalid[2] === (phone ? 1 : 4) && L.invalid[3] === 'Please enter a valid email address', JSON.stringify(L.invalid));
  check(`${width} look: the terms' lists 20px + 20px in, items 2px 5px 8px`, JSON.stringify(L.list) === JSON.stringify(['20px', '20px', '2px 5px 8px']), JSON.stringify(L.list));
  check(`${width} look: the fold arrow ${width < 992 ? 'shown' : 'hidden'}; the discount maroon; the note 11px #555`, L.toggle === (width < 992 ? 'block' : 'none') && L.discount === 'rgb(104, 18, 53)' && JSON.stringify(L.note) === JSON.stringify(['11px', 'rgb(85, 85, 85)']), JSON.stringify([L.toggle, L.discount, L.note]));
  if (width < 992) check(`${width} look: the phone bar ${phone ? 15 : 12}px in, its Payment ${width < 576 ? 12 : 14}px`, L.bar[0] === `${phone ? 15 : 12}px` && L.bar[1] === `${width < 576 ? 12 : 14}px` && L.bar[2] === 'block', JSON.stringify(L.bar));
  else check(`${width} look: Payment light (300), no phone bar`, L.payment === '300' && L.bar[2] === 'none', JSON.stringify([L.payment, L.bar]));
  await page.close();
}

// a logged-in member: the form filled from GetProfile (routed; a stand-in login, never a real one),
// as the source's guest checkout for a member: the title, names, both emails, the number, the
// country by name and the dial code following it (not the profile's own code: a shared +1 by the
// country; no country, the default); only empty fields (a country chosen meanwhile and its dial
// code stay); the filled names and both emails disabled (not focusable, live's 55% look; a value
// their rules refuse stays editable), the other fields editable; no messages;
// Payment sends the filled values. A guest makes no request; a profile error or no answer leaves
// the form empty; an expired login logs out (home). The other languages; 375 and 1440.
{
  const part = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const jwt = (exp) => `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ sub: 'member', exp })}.c2lnbmF0dXJl`;
  const VALID = jwt(Math.floor(Date.now() / 1000) + 3600);
  const EXPIRED = jwt(Math.floor(Date.now() / 1000) - 60);
  const PROFILE = {
    serviceResponseCode: 200, salutation: 'Mr', firstName: 'Kai', lastName: 'Chan', userName: 'kai.chan@example.com', phone: '07700 900123', countryPhoneCode: '852', countryName: 'United Kingdom', membershipID: 'ST0001',
  };
  // routes GetProfile (its answer, a status, or a delay) and stores a login before the page loads
  const member = ({ token = VALID, profile = PROFILE, status = 200, delay = 0 } = {}) => async (page) => {
    page.profileCalls = 0;
    await page.route(/\/GetProfile/, async (r) => {
      page.profileCalls += 1;
      page.profileAuth = r.request().headers().authorization;
      if (delay) await new Promise((res) => { setTimeout(res, delay); });
      try { await r.fulfill(json(profile, status)); } catch { /* (the page closed meanwhile) */ }
    });
    if (token) await page.addInitScript(`localStorage.setItem('token', ${JSON.stringify(token)});`);
  };
  const filled = (page) => page.evaluate(() => {
    const v = (k) => document.querySelector(`.checkout .form-field[data-key="${k}"] .form-input:not(.form-phone-code)`)?.value;
    const code = document.querySelector('.checkout .form-field[data-key="contactNumber"] .form-phone-code');
    return {
      title: v('title'), first: v('firstName'), last: v('lastName'), email: v('emailAddress'), confirm: v('confirmEmailAddress'), number: v('contactNumber'), country: v('countryOfResidence'),
      code: code?.selectedOptions[0]?.textContent, dial: document.querySelector('.checkout .checkout-dial')?.textContent,
      flight: v('arrivalDepartureFlight'), partner: v('partnerId'),
      locked: [...document.querySelectorAll('.checkout .form-field .form-input')].filter((i) => i.disabled && !i.closest('[hidden]') && !i.matches('select')).map((i) => i.closest('.form-field').dataset.key),
      errors: [...document.querySelectorAll('.checkout .form-field.has-error')].map((n) => n.dataset.key),
    };
  });
  const settle = (page) => page.waitForTimeout(1200);

  let page = await open({ setup: member() });
  await settle(page);
  let f = await filled(page);
  check('member: one GetProfile with the login', page.profileCalls === 1 && page.profileAuth === `Bearer ${VALID}`, JSON.stringify([page.profileCalls, page.profileAuth?.slice(0, 20)]));
  check('member: title, names, both emails, the number (digits), the country by name, its dial code +44 (GB) and short code (not the profile\'s +852)', f.title === 'Mr.' && f.first === 'Kai' && f.last === 'Chan' && f.email === 'kai.chan@example.com' && f.confirm === 'kai.chan@example.com' && f.number === '07700900123' && f.code === '+44 (GB)' && f.dial === '+44' && f.country === '41', JSON.stringify(f));
  check('member: the flight and partner fields empty, no messages', !f.flight && !f.partner && f.errors.length === 0, JSON.stringify(f));
  check('member: the names and both emails locked (disabled), nothing else', f.locked.join() === 'firstName,lastName,emailAddress,confirmEmailAddress', JSON.stringify(f.locked));
  // a locked field takes no click, focus or typing (a click on it or its label leaves the focus
  // where it was; Tab from the title goes past both names to Country of Residence); live's look
  // for a disabled field: 55% on the warm grey, the field's own text colour, the arrow cursor
  const first = page.locator('.checkout .form-field[data-key="firstName"] .form-input');
  await first.click({ force: true });
  await page.locator('.checkout .form-field[data-key="firstName"] label').first().click({ force: true });
  await page.keyboard.type('X');
  const clickFocus = await page.evaluate(() => document.activeElement?.closest?.('.form-field')?.dataset.key || document.activeElement?.tagName);
  await page.locator('.checkout .form-field[data-key="title"] select').focus();
  await page.keyboard.press('Tab');
  const tabbedTo = await page.evaluate(() => document.activeElement?.closest?.('.form-field')?.dataset.key);
  const lockedLook = await first.evaluate((i) => {
    const cs = getComputedStyle(i);
    return {
      value: i.value, opacity: cs.opacity, color: cs.color, cursor: cs.cursor, bg: cs.backgroundColor, hover: getComputedStyle(i).cursor,
    };
  });
  await first.hover({ force: true });
  const hoverCursor = await first.evaluate((i) => getComputedStyle(i).cursor);
  check('member: a locked name takes no click, focus or typing; Tab goes from Title past the names to Country of Residence', lockedLook.value === 'Kai' && clickFocus !== 'firstName' && tabbedTo === 'countryOfResidence', JSON.stringify({ clickFocus, tabbedTo, value: lockedLook.value }));
  check('member: a locked name looks as live\'s disabled fields: 55% on the warm grey, the field\'s text colour, the arrow cursor (on hover too)', lockedLook.opacity === '0.55' && lockedLook.bg === 'rgb(245, 244, 241)' && lockedLook.color !== 'rgb(102, 102, 102)' && lockedLook.cursor === 'default' && hoverCursor === 'default', JSON.stringify({ ...lockedLook, hoverCursor }));
  await page.locator('.checkout .form-field[data-key="title"] select').selectOption({ index: 2 });
  const phoneEdit = page.locator('.checkout .form-field[data-key="contactNumber"] .form-input:not(.form-phone-code)');
  await phoneEdit.fill('07700900124');
  check('member: the title and the number stay editable', (await page.locator('.checkout .form-field[data-key="title"] select').inputValue()) !== 'Mr.' && (await phoneEdit.inputValue()) === '07700900124');
  await phoneEdit.fill('07700900123');
  await page.locator('.checkout .form-field[data-key="title"] select').selectOption('Mr.');
  if (process.env.AXE_CORE) {
    await page.addScriptTag({ path: process.env.AXE_CORE });
    const violations = await page.evaluate(async () => {
      // eslint-disable-next-line no-undef
      const result = await axe.run({ include: [['main .checkout .checkout-form']] }, { runOnly: ['wcag2a', 'wcag2aa'] });
      return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join('; ')}`);
    });
    check('member: axe on the filled form (with the locked fields): no violations', !violations.length, violations.join(', '));
  }
  // the Smart Traveller card (Promo card, guests-only) left out, with its space: the checkout
  // right after the back title
  const card = await page.evaluate(() => ({
    card: !!document.querySelector('main .promo'),
    after: document.querySelector('main .title-wrapper')?.nextElementSibling?.className,
    gap: Math.round(document.querySelector('main .checkout').getBoundingClientRect().top - document.querySelector('main .title.back').getBoundingClientRect().bottom),
  }));
  check('member: no Smart Traveller card, the checkout 35px under the back title', !card.card && card.after === 'checkout-wrapper' && card.gap === 35, JSON.stringify(card));
  // Payment sends the filled values (the boxes ticked, a flight given)
  await tick(page, 'consent');
  await tick(page, 'termsAgreed');
  await page.locator('.checkout .form-field[data-key="arrivalDepartureFlight"] .form-input').fill('Cathay Pacific (CX)');
  await page.locator('.checkout .form-field[data-key="flightNumber"] .form-input').fill('123');
  await page.locator('.checkout .checkout-payment-summary').click();
  await page.waitForTimeout(500);
  const sent = await page.evaluate(() => window.payments[0]?.guest);
  check('member: Payment sends the filled details', sent?.firstName === 'Kai' && sent.emailAddress === 'kai.chan@example.com' && sent.contactNumber === '07700900123' && sent.phoneCountryCode === '+44' && String(sent.countryOfResidence) === '41', JSON.stringify(sent));
  await page.close();

  page = await open({ setup: member({ profile: { ...PROFILE, countryName: 'Canada', countryPhoneCode: '44', salutation: 'ms', phone: '4165550100' } }) });
  await settle(page);
  f = await filled(page);
  check('member: a shared +1 by the country (+1 (CA), not the profile\'s +44), "ms" as Ms.', f.code === '+1 (CA)' && f.dial === '+1' && f.country === '38' && f.title === 'Ms.', JSON.stringify(f));
  await page.close();

  // a country the list doesn't have: no country, the default dial code (as the source's without a
  // selected country), the rest filled
  page = await open({ setup: member({ profile: { ...PROFILE, countryName: 'Atlantis' } }) });
  await settle(page);
  f = await filled(page);
  check('member: an unknown country: no country, the dial code stays +1 (US) (not the profile\'s +852), the number filled', !f.country && f.code === '+1 (US)' && f.dial === '+1' && f.number === '07700900123' && f.errors.length === 0, JSON.stringify(f));
  await page.close();

  // a country chosen before the profile answers: it and its dial code stay
  page = await open({ setup: member({ delay: 2500 }) });
  await page.locator('.checkout .form-field[data-key="countryOfResidence"] select').selectOption({ label: 'Hong Kong SAR, China' });
  await page.waitForTimeout(3500);
  f = await filled(page);
  check('member: a country chosen before the profile answers stays, with its dial code +852 (HK); the rest filled', f.code === '+852 (HK)' && f.dial === '+852' && f.country !== '41' && !!f.country && f.first === 'Kai' && f.number === '07700900123' && f.errors.length === 0, JSON.stringify(f));
  await page.close();

  // typed before the profile answers: kept
  page = await open({ setup: member({ delay: 2500 }) });
  await page.locator('.checkout .form-field[data-key="firstName"] .form-input').fill('Typed');
  await page.waitForTimeout(3500);
  f = await filled(page);
  check('member: a name typed before the profile answers stays, editable; the rest filled (and locked)', f.first === 'Typed' && f.last === 'Chan' && f.locked.join() === 'lastName,emailAddress,confirmEmailAddress' && f.errors.length === 0, JSON.stringify(f));
  await page.close();

  // a profile email the field's rules refuse: filled, but left editable (both email fields), so the
  // member can put it right; the names still locked
  page = await open({ setup: member({ profile: { ...PROFILE, userName: 'kai.chan@' } }) });
  await settle(page);
  f = await filled(page);
  check('member: an email its rules refuse: filled, both email fields editable; the names locked', f.email === 'kai.chan@' && f.locked.join() === 'firstName,lastName' && f.errors.length === 0, JSON.stringify(f));
  await page.close();

  // a guest: no request, an empty form
  page = await open({ setup: member({ token: '' }) });
  await settle(page);
  f = await filled(page);
  check('guest: no GetProfile, an empty form, nothing locked', page.profileCalls === 0 && !f.first && !f.email && !f.number && f.code === '+1 (US)' && !f.locked.length, JSON.stringify([page.profileCalls, f]));
  check('guest: the Smart Traveller card shown', await page.locator('main .promo.card.guests-only .promo-button').count() === 2);
  await page.close();

  // the profile refused, or no answer in time: an empty form, no messages
  for (const [name, opt] of [['an error (500)', { status: 500, profile: { error: 'down' } }], ['refused (401)', { status: 401, profile: { message: 'Unauthorized' } }], ['no answer within 5s', { delay: 7000 }]]) {
    page = await open({ setup: member(opt) });
    await page.waitForTimeout(opt.delay ? 7500 : 1200);
    f = await filled(page);
    check(`member, profile ${name}: an empty form, no messages, the page stays`, !f.first && !f.email && !f.number && f.errors.length === 0 && /guest-checkout/.test(page.url()), JSON.stringify(f));
    await page.close();
  }

  // an expired login: logged out on page load (home), no GetProfile
  page = await browser.newPage({ viewport: { width: 1440, height: 900 }, userAgent: UA });
  await member({ token: EXPIRED })(page);
  await page.route(THIRD, (r) => r.abort());
  await page.goto(`${HOST}${PATH}`, { waitUntil: 'load', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const stored = await page.evaluate(() => localStorage.getItem('token'));
  check('member, an expired login: logged out (home), no GetProfile', page.profileCalls === 0 && !stored && !/guest-checkout/.test(page.url()), JSON.stringify([page.profileCalls, stored, page.url()]));
  await page.close();

  // the other languages (the title by its place in the authored order), phone and desktop
  for (const [path, title] of [['/zh-cn/guest-checkout', '先生'], ['/zh-hk/guest-checkout', '先生'], ['/ja-jp/guest-checkout', null], ['/pt-br/guest-checkout', null]]) {
    page = await open({ path, setup: member() });
    await settle(page);
    f = await filled(page);
    const titleOk = title ? f.title === title : !!f.title;
    check(`member ${path}: filled (title ${f.title}), no messages`, titleOk && f.first === 'Kai' && f.email === 'kai.chan@example.com' && f.number === '07700900123' && f.dial === '+44' && f.errors.length === 0, JSON.stringify(f));
    await page.close();
  }
  for (const width of [375, 1440]) {
    page = await open({ width, height: 900, setup: member() });
    await settle(page);
    f = await filled(page);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    check(`${width} member: filled, nothing wider than the screen`, f.first === 'Kai' && f.dial === '+44' && !wide, JSON.stringify([f.first, f.dial, wide]));
    await page.close();
  }
}

// timing: the booking system's cart answers after 4s; the Checkout block doesn't hold up the page
// (decorate doesn't wait), so the page and its header load before that either way. A tab with the
// cart's data shows its stored summary (the page-load loader gone), then the answer's; an
// unreadable answer keeps the stored summary. A tab without it keeps the loader up over the page
// until the cart is in (past the page's own load), then the summary, or the error text.
{
  const DELAY = 4000;
  // when the page's section shows, the summary's text then, whether the loader is up then, and
  // whether it was still up 2.5s in (the cart's own wait, past the page-load loader)
  const watch = async (page) => {
    let shownAt = 0;
    let shownText = '';
    let loader = false;
    let loaderLate = false;
    for (let t = 0; t < 120 && !shownAt; t += 1) {
      // eslint-disable-next-line no-await-in-loop
      const s = await page.evaluate(() => {
        const section = document.querySelector('main .section:has(.checkout)');
        return {
          shown: !!section && section.style.display !== 'none' && section.dataset.sectionStatus === 'loaded'
            && document.querySelector('header .header')?.dataset.blockStatus === 'loaded',
          text: document.querySelector('.checkout .checkout-summary')?.innerText.replace(/\s+/g, ' ') || '',
          loader: !!document.getElementById('spinner-overlay'),
        };
      }).catch(() => ({ shown: false, text: '', loader: false }));
      loader = s.loader;
      if (s.loader && Date.now() - page.started > 2500) loaderLate = true;
      if (s.shown) { shownAt = Date.now(); shownText = s.text; }
      // eslint-disable-next-line no-await-in-loop
      else await page.waitForTimeout(100);
    }
    return {
      shownAt, shownText, loader, loaderLate,
    };
  };
  // (the cart's answer comes DELAY ms after its request, so no earlier than this)
  const answered = (page) => page.started + DELAY;
  const loaderUp = (page) => page.evaluate(() => !!document.getElementById('spinner-overlay'));
  const until = (page, ms) => page.waitForTimeout(Math.max(0, ms - (Date.now() - page.started)));

  let page = await open({ stored: true, cartDelay: DELAY, wait: false });
  let w = await watch(page);
  check('timing, a tab with the cart: the page and its header show before the booking system answers, with the stored summary, no loader', w.shownAt && w.shownAt < answered(page) && /Stored Lounge/.test(w.shownText) && !w.loader, JSON.stringify({ shownAfter: w.shownAt - page.started, answerAfter: DELAY, text: w.shownText.slice(0, 60), loader: w.loader }));
  await page.waitForTimeout(Math.max(0, DELAY + 1500 - (Date.now() - page.started)));
  let text = await page.locator('.checkout .checkout-summary').innerText();
  check('timing, a tab with the cart: then the booking system\'s summary', /HKD 787\.50/.test(text) && !/Stored Lounge/.test(text), text.replace(/\s+/g, ' ').slice(0, 80));
  await page.close();

  page = await open({ cart: 'fail', stored: true, cartDelay: DELAY, wait: false });
  w = await watch(page);
  await page.waitForTimeout(Math.max(0, DELAY + 1500 - (Date.now() - page.started)));
  text = await page.locator('.checkout .checkout-summary').innerText();
  check('timing, a tab with the cart, the answer unreadable: shown at once, the stored summary kept', w.shownAt && w.shownAt < answered(page) && /Stored Lounge/.test(text), JSON.stringify({ shownAfter: w.shownAt - page.started, text: text.replace(/\s+/g, ' ').slice(0, 80) }));
  await page.close();

  page = await open({ cartDelay: DELAY, wait: false });
  w = await watch(page);
  await until(page, 2500);
  const early = await loaderUp(page);
  await until(page, DELAY - 300);
  const late = await loaderUp(page);
  await until(page, DELAY + 1200);
  const after = await loaderUp(page);
  text = await page.locator('.checkout .checkout-summary').innerText();
  check('timing, a tab without the cart: the page and its header load before the cart answers, under the loader', w.shownAt && w.shownAt < answered(page) && early && late, JSON.stringify({ shownAfter: w.shownAt - page.started, answerAfter: DELAY, loaderAt2500: early, loaderAt3700: late }));
  check('timing, a tab without the cart: once the cart is in, the loader gone and its summary', !after && /HKD 787\.50/.test(text), JSON.stringify({ loaderAfter: after, text: text.replace(/\s+/g, ' ').slice(0, 80) }));
  await page.close();

  page = await open({ cart: 'fail', cartDelay: DELAY, wait: false });
  await until(page, 2500);
  const failEarly = await loaderUp(page);
  await until(page, DELAY + 1200);
  const failAfter = await loaderUp(page);
  text = await page.locator('.checkout .checkout-summary').innerText();
  check('timing, a tab without the cart, the answer unreadable: the loader, then the error text', failEarly && !failAfter && /something went wrong|try again|error/i.test(text) && !/HKD/.test(text), JSON.stringify({ failEarly, failAfter, text: text.replace(/\s+/g, ' ').slice(0, 80) }));
  await page.close();
}

// the layouts
{
  const phone = await open({ width: 375, height: 812 });
  const layout = await phone.evaluate(() => {
    const b = document.querySelector('.checkout');
    const summary = b.querySelector('.checkout-summary').getBoundingClientRect();
    const form = b.querySelector('.checkout-form').getBoundingClientRect();
    const bar = b.querySelector('.checkout-bar');
    return {
      summaryFirst: summary.bottom <= form.top + 1,
      bar: getComputedStyle(bar).position === 'fixed' && getComputedStyle(bar).display !== 'none' && Math.abs(bar.getBoundingClientRect().bottom - window.innerHeight) <= 1,
      barText: bar.innerText.replace(/\s+/g, ' '),
      summaryPayment: !!b.querySelector('.checkout-payment-summary').offsetParent,
      band: getComputedStyle(document.querySelector('main .booking-steps')).display,
    };
  });
  check('phone: the summary above the form', layout.summaryFirst);
  check('phone: the bar fixed at the bottom, the total and Payment (in capitals, as the source\'s)', layout.bar && /Total:\s*HKD 787\.50/.test(layout.barText) && /PAYMENT/.test(layout.barText), layout.barText);
  check('phone: no Payment in the summary', !layout.summaryPayment);
  check('phone: the step band shows', layout.band === 'block', layout.band);
  const toggle = phone.locator('.checkout .checkout-summary-toggle').first();
  await toggle.click();
  check('phone: the lounge\'s details fold away', await toggle.getAttribute('aria-expanded') === 'false' && !(await phone.locator('.checkout .checkout-summary-details').first().isVisible()));
  await phone.close();

  const desk = await open({ width: 1440 });
  const d = await desk.evaluate(() => {
    const b = document.querySelector('.checkout');
    const summary = b.querySelector('.checkout-summary').getBoundingClientRect();
    const form = b.querySelector('.checkout-form').getBoundingClientRect();
    const solid = document.querySelector('main .promo.card .is-solid .promo-button');
    const outline = document.querySelector('main .promo.card .is-outline .promo-button');
    return {
      beside: summary.left > form.right && Math.abs(summary.top - form.top) < 80,
      bar: getComputedStyle(b.querySelector('.checkout-bar')).display,
      ratio: Math.round((form.width / (summary.right - form.left)) * 100),
      banner: [outline?.textContent, outline?.getAttribute('href') || outline?.dataset.href, solid?.textContent, solid && getComputedStyle(solid).backgroundColor],
      blocks: document.querySelectorAll('main .checkout').length,
      cards: document.querySelectorAll('main .promo.card').length,
      // the banner between the title and the checkout
      order: [...document.querySelectorAll('main .block')].map((n) => n.classList[0]).filter((n) => ['booking-steps', 'title', 'promo', 'checkout'].includes(n)).join(' '),
    };
  });
  check('desktop: the summary beside the form', d.beside, JSON.stringify(d));
  check('desktop: no bar', d.bar === 'none');
  check('the page: Booking Steps, Title (back), the banner, Checkout, once each', d.blocks === 1 && d.cards === 1 && d.order === 'booking-steps title promo checkout', `${d.order}; ${d.blocks} checkout, ${d.cards} cards`);
  check('banner: Log In outlined (the login modal page), Sign up now filled', d.banner[0] === 'Log In' && d.banner[1] === '/en-uk/modals/login' && d.banner[2] === 'Sign up now' && d.banner[3] === 'rgb(104, 18, 53)', JSON.stringify(d.banner));

  if (process.env.AXE_CORE) {
    await desk.addScriptTag({ path: process.env.AXE_CORE });
    const violations = await desk.evaluate(async () => {
      // (the booking steps band is left out: its faded steps are the source's, as on Edit Booking:
      // styles/booking-steps.css)
      // eslint-disable-next-line no-undef
      const result = await axe.run({ include: [['main .checkout'], ['main .title.back'], ['main .promo.card']] }, { runOnly: ['wcag2a', 'wcag2aa'] });
      return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => `${n.target.join(' ')} (${n.any[0]?.message || ''})`).join('; ')}`);
    });
    check('axe: no violations', !violations.length, violations.join(', '));
  }
  // a click: the language's login modal opens over the checkout (its title, focus inside), the
  // address unchanged
  const before = desk.url();
  await desk.locator('main .promo.card .is-outline .promo-button').click();
  await desk.waitForFunction(() => document.querySelector('dialog[open]'), null, { timeout: 10000 }).catch(() => {});
  const login = await desk.evaluate(() => { const dlg = document.querySelector('dialog[open]'); return dlg && { title: dlg.querySelector('h1, h2, h3, .modal-title')?.textContent.trim(), focusIn: dlg.contains(document.activeElement) }; });
  check('banner: Log In opens the login modal, the page stays', login?.title === 'Log In' && login.focusIn && desk.url() === before, JSON.stringify({ login, url: desk.url() }));
  await desk.close();
}

// the header as the source's checkout: no Book Now, no cart (metadata header = checkout); the
// homepage keeps both
{
  const page = await open();
  // the header's actions by where they go (a modal's #name, a modal page in data-href)
  // (once the header is in: its navigation loads after the checkout)
  const head = async (p) => {
    await p.waitForFunction(() => document.querySelector('header .header')?.dataset.blockStatus === 'loaded', null, { timeout: 20000 }).catch(() => {});
    return p.evaluate(() => [...document.querySelectorAll('header .header-actions a, header .header-actions button')]
      .map((n) => n.getAttribute('href') || n.dataset.href || '').filter(Boolean));
  };
  const h = await head(page);
  check('header: no Book Now and no cart on the checkout, Log In kept', !h.includes('#book-now') && !h.includes('#cart') && h.some((x) => x.includes('login')), JSON.stringify(h));
  await page.goto(`${HOST}/en-uk/`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => document.querySelector('header .header-actions'), null, { timeout: 30000 });
  const home = await head(page);
  check('header: the homepage keeps Book Now and the cart', home.includes('#book-now') && home.includes('#cart'), JSON.stringify(home));
  await page.close();
}

// no cart on the live site: the language's homepage (address replaced); on the preview the page stays
{
  const LIVE_HOST = 'http://checkout.test';
  const none = await open({ cart: null, host: LIVE_HOST });
  await none.waitForURL(`${LIVE_HOST}/en-uk/`, { timeout: 20000 }).catch(() => {});
  check('live, no cart: the homepage /en-uk/', none.url() === `${LIVE_HOST}/en-uk/`, none.url());
  await none.close();
  const emptied = await open({ host: LIVE_HOST });
  await emptied.waitForFunction(() => document.querySelector('.checkout')?.dataset.blockStatus === 'loaded', null, { timeout: 30000 });
  await emptied.waitForTimeout(1000);
  const stayed = emptied.url() === `${LIVE_HOST}${PATH}`;
  // eslint-disable-next-line import/no-unresolved, import/no-absolute-path
  await emptied.evaluate(() => import('/scripts/cart-state.js').then((m) => m.forgetCart()));
  await emptied.waitForURL(`${LIVE_HOST}/en-uk/`, { timeout: 20000 }).catch(() => {});
  check('live, a cart: the checkout stays; emptied meanwhile: the homepage', stayed && emptied.url() === `${LIVE_HOST}/en-uk/`, emptied.url());
  await emptied.close();
}

// the form as the source's: an empty field left is quiet, names lose trailing spaces, the Privacy
// Policy and newsletter links open in a new tab, the dial code shows short
{
  const page = await open();
  for (const key of ['firstName', 'lastName', 'emailAddress']) {
    await page.locator(`${field(key)} input`).focus();
    await page.locator(`${field(key)} input`).blur();
  }
  check('leaving empty fields shows no message (as the source\'s)', (await Promise.all(['firstName', 'lastName', 'emailAddress'].map((k) => errorOf(page, k)))).join('') === '');
  await page.locator(`${field('firstName')} input`).fill('  Probe  ');
  await page.locator(`${field('firstName')} input`).blur();
  check('first name: trailing spaces off, leading kept (as the source\'s)', await page.locator(`${field('firstName')} input`).inputValue() === '  Probe');
  const links = await page.evaluate(() => [...document.querySelectorAll('.checkout .form-field[data-key="consent"] a, .checkout .form-field[data-key="newsletter"] a, .checkout .form-field[data-key="termsAgreed"] a')].map((a) => `${a.closest('.form-field').dataset.key}:${a.target || 'same'}`));
  check('Privacy Policy and newsletter links in a new tab, T&C in the same', links.join(' ') === 'consent:_blank newsletter:_blank termsAgreed:same', links.join(' '));
  const dial = await page.evaluate(() => ({ shown: document.querySelector('.checkout .checkout-dial')?.textContent, value: document.querySelector('.checkout .form-phone-code')?.value }));
  check('the dial code shown short ("+1"), the select underneath', dial.shown === '+1' && /^\+1/.test(dial.value || ''), JSON.stringify(dial));
  await page.locator(`${field('countryOfResidence')} select`).selectOption({ label: 'Hong Kong SAR, China' });
  check('the country sets the short dial code too', await page.locator('.checkout .checkout-dial').textContent() === '+852');
  // a longer code: the box widens with it (+1 55px, +852 77px, as the source's), the number after
  // the line, the code inside the box
  const fit = await page.evaluate(() => {
    const f = document.querySelector('.checkout .form-field[data-key="contactNumber"]');
    const box = f.querySelector('.checkout-dial-box').getBoundingClientRect();
    const dial = f.querySelector('.checkout-dial').getBoundingClientRect();
    const input = f.querySelector('input').getBoundingClientRect();
    return { box: Math.round(box.width), inside: dial.right <= box.right - 10, after: Math.round(input.left - box.right) };
  });
  check('a 3-digit dial code fits: its box wider than +1\'s 55px (about 76px), the code inside it, the number after the line', fit.box >= 74 && fit.box <= 79 && fit.inside && fit.after === 0, JSON.stringify(fit));
  // the promo field: capitals, an empty code, stage's BKNG048
  const promo = page.locator('.checkout .checkout-promo-input');
  await page.locator('.checkout .checkout-promo-apply').click();
  await page.waitForTimeout(300);
  check('promo: an empty code says so, nothing sent', await page.locator('.checkout .checkout-promo-message').textContent() === 'Please enter promo code.' && page.promos.length === 0);
  await promo.pressSequentially('zzbad1');
  check('promo: typed in capitals', await promo.inputValue() === 'ZZBAD1', await promo.inputValue());
  await promo.press('Enter');
  await page.waitForFunction(() => /No record/.test(document.querySelector('.checkout .checkout-promo-message')?.textContent || ''), null, { timeout: 10000 }).catch(() => {});
  check('promo: sent for this cart, stage\'s message shown', page.promos.at(-1)?.cartId === 'CRT_TEST' && page.promos.at(-1)?.promocode === 'ZZBAD1' && /No record found/.test(await page.locator('.checkout .checkout-promo-message').textContent()), JSON.stringify(page.promos));
  check('no page errors (form, promo)', !page.errors.length, page.errors.join(' | '));
  await page.close();
}

// the Arrival / Departure Flight list, as the source's (its 136 airlines, from the Placeholder cell)
for (const width of [1440, 375]) {
  const page = await open({ width, height: width < 768 ? 812 : 900 });
  const flight = page.locator(`${field('arrivalDepartureFlight')} input`);
  const list = () => page.evaluate(() => {
    const l = document.querySelector('.checkout .form-field[data-key="arrivalDepartureFlight"] .form-suggest-list');
    const i = document.querySelector('.checkout .form-field[data-key="arrivalDepartureFlight"] input');
    const shown = [...l.querySelectorAll('.form-suggest-option')].filter((o) => !o.hidden);
    const r = l.getBoundingClientRect();
    const ir = i.getBoundingClientRect();
    const o = shown[0]?.getBoundingClientRect();
    return {
      open: !l.hidden, expanded: i.getAttribute('aria-expanded'), role: i.getAttribute('role'), count: l.children.length, shown: shown.map((x) => x.textContent), value: i.value,
      under: Math.round(r.top - ir.bottom), sameWidth: Math.round(r.width) === Math.round(ir.width), height: Math.round(r.height), item: o ? Math.round(o.height) : 0, border: getComputedStyle(l).borderTopStyle + '/' + getComputedStyle(l).borderBottomWidth,
    };
  });
  await flight.scrollIntoViewIfNeeded();
  check(`${width} flight list: closed to start with, a combobox`, !(await list()).open && (await list()).role === 'combobox' && (await list()).expanded === 'false');
  await flight.click();
  let m = await list();
  check(`${width} flight list: opens under the field on focus, the source's 136 airlines, Cathay Pacific first`, m.open && m.expanded === 'true' && m.count === 136 && m.shown.length === 136 && m.shown[0] === 'Cathay Pacific (CX)', JSON.stringify({ ...m, shown: m.shown.length }));
  check(`${width} flight list: as the source's look: right under the field, its width, 100px tall, ${width < 768 ? 36 : 38}px items, no top border`, m.under === 0 && m.sameWidth && m.height === 100 && m.item === (width < 768 ? 36 : 38) && m.border === 'none/1px', JSON.stringify({ ...m, shown: m.shown.length }));
  await flight.pressSequentially('cath');
  m = await list();
  check(`${width} flight list: typing "cath" keeps Cathay Pacific only`, m.open && m.shown.join() === 'Cathay Pacific (CX)', m.shown.join(' | '));
  await page.locator(`${field('arrivalDepartureFlight')} .form-suggest-option:not([hidden])`).first().click();
  m = await list();
  check(`${width} flight list: a click fills the field and closes the list`, m.value === 'Cathay Pacific (CX)' && !m.open && m.expanded === 'false', JSON.stringify({ value: m.value, open: m.open }));
  await flight.fill('');
  await flight.pressSequentially('zzz');
  m = await list();
  check(`${width} flight list: nothing matching: closed, the text kept (free text allowed)`, !m.open && m.value === 'zzz', JSON.stringify({ value: m.value, open: m.open }));
  await flight.fill('');
  await flight.pressSequentially('hong');
  await page.keyboard.press('ArrowDown');
  const active = await page.evaluate(() => document.querySelector('.checkout .form-field[data-key="arrivalDepartureFlight"] input').getAttribute('aria-activedescendant'));
  await page.keyboard.press('Enter');
  m = await list();
  check(`${width} flight list: ↓ then Enter chooses (Hong Kong Airlines), the form not sent`, !!active && m.value === 'Hong Kong Airlines (HX)' && !m.open && (await page.evaluate(() => window.payments.length)) === 0, JSON.stringify({ active, value: m.value }));
  await flight.fill('');
  await flight.click();
  await page.keyboard.press('Escape');
  check(`${width} flight list: Escape closes it`, !(await list()).open);
  await flight.click();
  await page.locator(`${field('flightNumber')} input`).click();
  check(`${width} flight list: leaving the field closes it`, !(await list()).open);
  await page.close();
}

// the page's other blocks: Booking Steps and Title (back), desktop and phone
for (const width of [1440, 375]) {
  const page = await open({ width, height: width < 768 ? 812 : 900 });
  const m = await page.evaluate(() => {
    const band = document.querySelector('main .booking-steps');
    const items = [...band.querySelectorAll('.booking-steps-item')];
    const head = document.querySelector('main .title.back .title-heading');
    const link = head.querySelector('a.title-back');
    const arrow = link.querySelector('.title-back-arrow');
    const a = arrow.getBoundingClientRect();
    const section = band.closest('.section');
    return {
      // the block is the band (no band inside a band), first in its section, right under the header
      own: band.classList.contains('block') && !band.querySelector('.booking-steps'),
      top: getComputedStyle(section).paddingTop,
      steps: items.map((i) => i.querySelector('.booking-steps-name').textContent).join(' › '),
      done: items.filter((i) => i.classList.contains('is-done')).length,
      current: items.findIndex((i) => i.getAttribute('aria-current') === 'step'),
      nav: band.querySelector('nav')?.getAttribute('aria-label'),
      short: band.querySelector('.is-active .booking-steps-short')?.textContent,
      shortShown: !!band.querySelector('.is-active .booking-steps-short')?.offsetParent,
      after: getComputedStyle(band).marginBottom,
      tag: head.tagName,
      size: getComputedStyle(head).fontSize,
      weight: getComputedStyle(head).fontWeight,
      linkText: link.textContent.trim(),
      href: link.getAttribute('href'),
      arrow: [Math.round(a.width), Math.round(a.height), arrow.getAttribute('aria-hidden'), getComputedStyle(arrow).backgroundColor],
      decoration: getComputedStyle(link).textDecorationLine,
    };
  });
  const phone = width < 768;
  check(`${width} Booking Steps: the band itself, first in its section with no space above`, m.own && m.top === '0px', JSON.stringify([m.own, m.top]));
  check(`${width} Booking Steps: four steps, Details current (two done), named after the page's heading`, m.steps === 'Lounges › Book › Details › Confirm & Pay' && m.done === 2 && m.current === 2 && m.nav === 'Back to Edit Booking', JSON.stringify(m));
  check(`${width} Booking Steps: ${phone ? 'the phone name shown' : 'no phone name'}, ${phone ? 25 : 50}px to the title`, m.short === 'Details' && m.shortShown === phone && m.after === (phone ? '25px' : '50px'), JSON.stringify([m.short, m.shortShown, m.after]));
  check(`${width} Title (back): a heading 1 link with the arrow before it, ${phone ? '18px' : '32px'}/500`, m.tag === 'H1' && m.linkText === 'Back to Edit Booking' && /book-your-visit$/.test(m.href) && m.size === (phone ? '18px' : '32px') && m.weight === '500' && m.decoration === 'none', JSON.stringify(m));
  check(`${width} Title (back): the maroon arrow ${phone ? '14 x 16' : '21 x 24'}, hidden from screen readers`, JSON.stringify(m.arrow) === JSON.stringify([phone ? 14 : 21, phone ? 16 : 24, 'true', 'rgb(83, 14, 42)']), JSON.stringify(m.arrow));
  if (!phone) {
    await page.locator('main .title-back').hover();
    const hover = await page.locator('main .title-back-arrow').evaluate((n) => getComputedStyle(n).backgroundColor);
    check('Title (back): the arrow grey on hover', hover === 'rgb(153, 153, 153)', hover);
  }
  await page.close();
}

// Booking Steps without its phone name: the bold step's own text; old Checkout rows left out
{
  const phone = await open({ width: 375, height: 812, html: (h) => h.replace(/(<div class="booking-steps">[\s\S]*?<\/ul>\s*<\/div>\s*<\/div>)\s*<div>\s*<div>\s*(?:<p>)?[^<]*(?:<\/p>)?\s*<\/div>\s*<\/div>/, '$1') });
  const short = await phone.evaluate(() => [document.querySelector('main .booking-steps .is-active .booking-steps-short'), document.querySelector('main .booking-steps .is-active .booking-steps-name')?.offsetParent !== null]);
  check('Booking Steps without row 2: the bold step\'s name on phones', short[0] === null && short[1], JSON.stringify(short));
  await phone.close();

  const old = await open({ html: (h) => h.replace('<div class="checkout">', '<div class="checkout"><div><div><p>steps</p></div><div><ul><li>Old</li><li><strong>Row</strong></li></ul></div></div><div><div><p>back</p></div><div><p><a href="/x">Old back</a></p></div></div><div><div><p>banner</p></div><div><p><a href="/en-uk/fragments/checkout-banner">/en-uk/fragments/checkout-banner</a></p></div></div>') });
  const o = await old.evaluate(() => ({
    band: document.querySelector('main .checkout .booking-steps'),
    text: /Old back|Old|fragments/.test(document.querySelector('main .checkout').textContent),
    cards: document.querySelectorAll('main .promo.card').length,
  }));
  check('old steps / back / banner rows: left out of the checkout', o.band === null && !o.text && o.cards === 1, JSON.stringify(o));
  await old.close();
}

// the other languages: each page's band, title, banner and checkout
for (const lang of ['zh-cn', 'zh-hk', 'ja-jp', 'pt-br']) {
  const page = await open({ path: `/${lang}/guest-checkout` });
  const m = await page.evaluate(() => ({
    order: [...document.querySelectorAll('main .block')].map((n) => n.classList[0]).filter((n) => ['booking-steps', 'title', 'promo', 'checkout'].includes(n)).join(' '),
    active: document.querySelector('main .booking-steps .is-active .booking-steps-name')?.textContent,
    back: document.querySelector('main .title-back')?.getAttribute('href'),
    fields: document.querySelectorAll('main .checkout .form-field').length,
    summary: !!document.querySelector('main .checkout .checkout-summary-line'),
  }));
  check(`${lang}: Booking Steps, Title (back), the banner, Checkout; its current step, back link, fields, summary`, m.order === 'booking-steps title promo checkout' && !!m.active && m.back === `/${lang}/book-your-visit` && m.fields >= 14 && m.summary && !page.errors.length, JSON.stringify({ ...m, errors: page.errors }));
  await page.close();
}

await browser.close();
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
