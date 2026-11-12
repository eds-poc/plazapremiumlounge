// The Checkout block (blocks/checkout) on /en-uk/guest-checkout, with routed answers: the cart
// API as stage answers it (test/cart/fixtures: a lounge cart, a pass cart), the countries as the
// GetCountries API answers them (fixtures/countries.json). Checks:
// - the summary, the terms and the flight fields for a lounge cart and a pass cart
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
  cart = LOUNGE_CART, width = 1440, height = 900, stored = false, path = PATH, html,
} = {}) {
  const page = await browser.newPage({ viewport: { width, height }, userAgent: UA });
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
  await page.route(/ppg-app\/cart/, (r) => {
    page.gets += 1;
    if (cart === 'fail') return r.fulfill(json({ error: 'down' }, 500));
    return r.fulfill(json({ ...cart, cartId: 'CRT_TEST' }));
  });
  if (cart) {
    await page.addInitScript(`localStorage.setItem('ppl-cart-id', JSON.stringify({ id: 'CRT_TEST', expires: Date.now() + 20 * 3600e3, changed: Date.now(), count: 1, codes: [] }));
${stored ? 'sessionStorage.setItem(\'ppl-cart\', JSON.stringify({ cartId: \'CRT_TEST\', currency: \'HKD\', fetchedAt: Date.now(), expires: Date.now() + 3600e3, totals: { base: 100, discounts: [], total: 100 }, lines: [{ catalogueCode: \'X\', kind: \'lounge\', name: \'Stored Lounge\', product: \'Lounge Use\', place: \'\', start: \'2099-01-01 10:00:00\', adults: 1, children: 0, quantity: 1, total: 100 }], terms: [] }));' : ''}`);
  }
  await page.addInitScript(() => {
    window.payments = [];
    document.addEventListener('checkout:payment', (e) => window.payments.push(JSON.parse(JSON.stringify(e.detail))));
  });
  await page.goto(`${HOST}${path}`, { waitUntil: 'load', timeout: 60000 });
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
  check('title and back link', info.title === 'Back to Edit Booking' && /makeabooking/.test(info.back), `${info.title} ${info.back}`);
  check('the current step is Details', info.active === 'Details', info.active);
  check('summary: lounge, place, date, time, guests, service', /Plaza Premium Lounge Near Gate 1, Departures, Hong Kong International Airport Date: 28-Nov-2026 Time: 1500 ?hrs Guests: 1 Adult\(s\) Services: Lounge Use - 5 Hours/.test(info.summary), info.summary);
  check('summary: service total, discount, total', /Service Total: HKD 875\.00 10% Online Discount \[Lounge Booking\]: - HKD 87\.50 Total \(Includes applicable taxes and fees\) HKD 787\.50/.test(info.summary), info.summary);
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
  check('pass: its name, Quantity and price', /Global Family Pass.*Quantity: 1 USD 85\.00 Total \(Includes applicable taxes and fees\) USD 85\.00/.test(info.summary), info.summary);
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
  check('phone: the bar fixed at the bottom, the total and Payment', layout.bar && /Total: HKD 787\.50/.test(layout.barText) && /Payment/.test(layout.barText), layout.barText);
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
      banner: [outline?.textContent, outline?.getAttribute('href'), solid?.textContent, solid && getComputedStyle(solid).backgroundColor],
      blocks: document.querySelectorAll('main .checkout').length,
      cards: document.querySelectorAll('main .promo.card').length,
      // the banner between the title and the checkout
      order: [...document.querySelectorAll('main .block')].map((n) => n.classList[0]).filter((n) => ['booking-steps', 'title', 'promo', 'checkout'].includes(n)).join(' '),
    };
  });
  check('desktop: the summary beside the form', d.beside, JSON.stringify(d));
  check('desktop: no bar', d.bar === 'none');
  check('the page: Booking Steps, Title (back), the banner, Checkout, once each', d.blocks === 1 && d.cards === 1 && d.order === 'booking-steps title promo checkout', `${d.order}; ${d.blocks} checkout, ${d.cards} cards`);
  check('banner: Log In outlined (#login), Sign up now filled', d.banner[0] === 'Log In' && d.banner[1] === '#login' && d.banner[2] === 'Sign up now' && d.banner[3] === 'rgb(104, 18, 53)', JSON.stringify(d.banner));

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
  await desk.close();
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
  check(`${width} Booking Steps: ${phone ? 'the phone name shown' : 'no phone name'}, ${phone ? 30 : 50}px to the title`, m.short === 'Details' && m.shortShown === phone && m.after === (phone ? '30px' : '50px'), JSON.stringify([m.short, m.shortShown, m.after]));
  check(`${width} Title (back): a heading 1 link with the arrow before it, ${phone ? '18px' : '32px'}/500`, m.tag === 'H1' && m.linkText === 'Back to Edit Booking' && /makeabooking$/.test(m.href) && m.size === (phone ? '18px' : '32px') && m.weight === '500' && m.decoration === 'none', JSON.stringify(m));
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
  check(`${lang}: Booking Steps, Title (back), the banner, Checkout; its current step, back link, fields, summary`, m.order === 'booking-steps title promo checkout' && !!m.active && m.back === `/${lang}/makeabooking` && m.fields >= 14 && m.summary && !page.errors.length, JSON.stringify({ ...m, errors: page.errors }));
  await page.close();
}

await browser.close();
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
