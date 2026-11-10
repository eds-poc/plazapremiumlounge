// The cart (scripts/cart.js, cart-state.js, mini-cart.js; the header's count; the lounge card's
// Book Now and Remove From Cart), as the source's cart, with routed answers: the products from
// the booking widget's fixture, the cart API from the stage service's real answers (the GET
// answer carries what was posted). Usage: node cart.test.mjs [width]
import { readFileSync } from 'node:fs';
import { open, PW } from '../booking-widget/harness.mjs';

const { chromium } = await import(PW);
const PRODUCTS = readFileSync(new URL('../booking-widget/fixtures/getbookingwidgetproducts.json', import.meta.url), 'utf8');
const CART = JSON.parse(readFileSync(new URL('./fixtures/cart.json', import.meta.url), 'utf8'));
const CODE = JSON.parse(PRODUCTS).items.find((i) => i.prices?.[0]?.catalogueCode).prices[0].catalogueCode;
const WIDTHS = process.argv[2] ? [Number(process.argv[2])] : [1440, 375];
const browser = await chromium.launch();
let failed = 0;
const check = (name, ok, info = '') => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info ? ` — ${info}` : ''}`); };
const W = 'main .hero .booking-widget';
const json = (body, status = 200) => ({
  status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: typeof body === 'string' ? body : JSON.stringify(body),
});
const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });

/**
 * The homepage with routed products and cart answers. `post` answers the cart POST (default: a
 * new cart id), `get` the GET (default: the fixture with the posted product).
 */
async function openHome({
  width = 1440, path = '/en-uk/', post, get, del, init, guests,
} = {}) {
  const api = { posts: [], gets: [], deletes: [] };
  let last = null;
  let deleted = false;
  const page = await open(browser, {
    width,
    path,
    extraRoute: async (p) => {
      if (init) await p.addInitScript(init);
      await p.route(/ppg-app\/getGeoLocation/, async (r) => {
        try {
          const resp = await r.fetch();
          const body = await resp.json();
          body.defaultOption = null;
          await r.fulfill({ response: resp, body: JSON.stringify(body) });
        } catch { /* (the page closed meanwhile) */ }
      });
      await p.route(/ppg-app\/getbookingwidgetproducts/, (r) => (r.request().method() === 'POST' ? r.fulfill(json(PRODUCTS)) : r.fallback()));
      await p.route(/ppg-app\/cart(\?|$)/, async (r) => {
        const req = r.request();
        if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
        if (req.method() === 'POST') {
          const body = JSON.parse(req.postData() || '{}');
          api.posts.push(body);
          last = body;
          await wait(400);
          return r.fulfill(post ? await post(body, api) : json({ cartId: `CRT_TEST${api.posts.length}` }));
        }
        if (req.method() === 'DELETE') {
          api.deletes.push(req.url());
          await wait(400);
          if (del) return r.fulfill(await del(req.url(), api));
          deleted = true;
          // (the stage service's answer)
          return r.fulfill(json({ code: '200', description: 'Success' }));
        }
        api.gets.push(req.url());
        if (get) return r.fulfill(await get(req.url(), api));
        const cart = structuredClone(CART);
        const id = new URL(req.url()).searchParams.get('cartId');
        cart.cartId = id;
        // (a deleted cart reads back empty, as the stage service's)
        if (deleted) {
          cart.products = [];
          Object.keys(cart.cartTotalPrice).forEach((k) => { cart.cartTotalPrice[k] = 0; });
          return r.fulfill(json(cart));
        }
        if (guests) cart.products[0].guestsCount = guests;
        if (last) {
          const [posted] = last.products;
          Object.assign(cart.products[0], { catalogueCode: posted.catalogueCode, startDate: posted.startDate, guestsCount: posted.guestsCount });
          cart.currency = last.currency;
        }
        return r.fulfill(json(cart));
      });
    },
  });
  page.api = api;
  await page.waitForFunction((w) => document.querySelector(`${w} .booking-widget-submit`) && !document.querySelector(`${w} .booking-widget-submit`).disabled, W, { timeout: 40000 });
  return page;
}

async function pick(page, code = 'HKG') {
  const input = page.locator(`${W} .booking-widget-where-input`);
  await input.click();
  await input.fill(code);
  await page.locator(`${W} .booking-widget-option[id$="-${code}"]`).click();
  await page.waitForSelector('.booking-widget-card-book', { timeout: 20000 });
  await page.waitForTimeout(300);
}

const state = (page) => page.evaluate(() => ({
  badge: document.querySelector('header .header-cart-count:not([hidden])')?.textContent || null,
  badgeShown: !!document.querySelector('header .header-cart-count') && getComputedStyle(document.querySelector('header .header-cart-count')).display !== 'none',
  label: document.querySelector('header a.header-utility .icon-cart')?.closest('a')?.getAttribute('aria-label'),
  book: document.querySelector('.booking-widget-card-book')?.textContent,
  open: [...document.querySelectorAll('dialog.modal[open]')].map((d) => [...d.classList].find((c) => /^(mini-)?cart-/.test(c))),
  id: JSON.parse(localStorage.getItem('ppl-cart-id') || 'null')?.id || null,
  entry: JSON.parse(localStorage.getItem('ppl-cart-id') || 'null'),
  stored: JSON.parse(sessionStorage.getItem('ppl-cart') || 'null'),
  legacy: /(?:^|; )cartid=/.test(document.cookie) || !!localStorage.getItem('ppl-cart'),
}));
const miniText = (page) => page.evaluate(() => {
  const d = document.querySelector('dialog.mini-cart-modal[open]');
  const t = (s) => d?.querySelector(s)?.textContent.replace(/\s+/g, ' ').trim();
  return d && {
    title: t('.modal-title'),
    name: t('.mini-cart-name'),
    place: t('.mini-cart-place'),
    // (each part's own text: labels and values are spaced by the styles)
    details: [...d.querySelectorAll('.mini-cart-detail')].map((r) => [...r.children].map((c) => c.textContent.trim()).join(' ')),
    rows: [...d.querySelectorAll('.mini-cart-row')].map((r) => [...r.querySelectorAll(':scope > .mini-cart-label > *, :scope > .mini-cart-label:not(:has(*)), :scope > .mini-cart-amount')].map((c) => c.textContent.trim()).join(' ')),
    buttons: [...d.querySelectorAll('.mini-cart-actions button')].map((b) => b.textContent),
    removeLabel: d.querySelector('.mini-cart-remove')?.getAttribute('aria-label'),
  };
});

// add from the hero's card, at each width
async function addFlow(width) {
  const page = await openHome({ width });
  await pick(page);
  await page.locator('.booking-widget-card-book').click();
  await page.waitForSelector('#spinner-overlay', { state: 'attached', timeout: 3000 }).catch(() => {});
  const during = await page.evaluate(() => {
    const b = document.querySelector('.booking-widget-card-book');
    const l = document.getElementById('spinner-overlay');
    return { disabled: b.disabled, aria: b.getAttribute('aria-disabled'), loader: !!l && getComputedStyle(l).display !== 'none' };
  });
  await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 15000 });
  await page.waitForTimeout(600);
  const s = await state(page);
  const loaderAfter = await page.evaluate(() => !!document.getElementById('spinner-overlay'));
  const [body] = page.api.posts;
  const choice = await page.evaluate((w) => ({ date: new FormData(document.querySelector(`${w} form`)).get('date'), time: new FormData(document.querySelector(`${w} form`)).get('time') }), W);
  check(`${width} add: Book Now disabled (aria-disabled) and the site's loader while adding, as live`, during.disabled === true && during.aria === 'true' && during.loader, JSON.stringify(during));
  check(`${width} add: the loader gone with the mini cart`, !loaderAfter);
  check(`${width} add: one POST, the API's body`, page.api.posts.length === 1 && body.currency === 'USD' && body.pointOfPurchase === 'Online' && body.channel === 'B2C' && body.isThirdPartyFulfilment === false
      && body.products.length === 1 && body.products[0].catalogueCode === CODE && body.products[0].quantity === 1
      && body.products[0].startDate === `${choice.date} ${choice.time.slice(0, 2)}:${choice.time.slice(2)}:00`
      && JSON.stringify(body.products[0].guestsCount) === '{"adult":"1","child":"0"}', JSON.stringify(body));
  check(`${width} add: then one GET ?cartId=&locale=en`, page.api.gets.length === 1 && /cartId=CRT_TEST1&locale=en$/.test(page.api.gets[0]), page.api.gets.join(' '));
  const hours = (t) => (t - Date.now()) / 3600e3;
  check(`${width} add: the id in localStorage (24 hours, the count and code, no prices), the data in sessionStorage (2 hours), no cookie`, s.id === 'CRT_TEST1' && hours(s.entry.expires) > 23.9 && s.entry.count === 1 && JSON.stringify(s.entry.codes) === JSON.stringify([CODE]) && !JSON.stringify(s.entry).includes('total') && s.stored?.cartId === 'CRT_TEST1' && s.stored.lines[0].catalogueCode === CODE && hours(s.stored.expires) > 1.9 && hours(s.stored.expires) <= 2 && s.stored.fetchedAt > Date.now() - 60e3 && !s.legacy, JSON.stringify({ entry: s.entry, expires: hours(s.stored?.expires || 0), legacy: s.legacy }));
  check(`${width} add: header count 1 ${width >= 1200 ? 'shown' : 'not shown on this header (as live)'}, for screen readers too`, s.badge === '1' && s.badgeShown === (width >= 1200) && /Cart, 1 item\(s\)/.test(s.label), `${s.badge} shown=${s.badgeShown} | ${s.label}`);
  check(`${width} add: the card's button is Remove From Cart`, s.book === 'Remove From Cart', s.book);
  const m = await miniText(page);
  console.log('  mini cart', JSON.stringify(m));
  check(`${width} mini cart: title, lounge, place`, m?.title === 'Cart' && m.name === 'Plaza Premium Lounge' && /Near Gate 1, Departures, Hong Kong International Airport/.test(m.place), JSON.stringify(m && [m.title, m.name, m.place]));
  check(`${width} mini cart: date, time, guests, service`, /^Date: \d{2}-[A-Z][a-z]{2}-\d{4}$/.test(m?.details[0]) && /^Time: \d{4}hrs$/.test(m.details[1]) && m.details[2] === 'Guests: 1 Adult(s)' && m.details[3] === 'Services: Lounge Use - 5 Hours', m?.details.join(' | '));
  check(`${width} mini cart: service total, discount, total`, m?.rows.length === 3 && /^Service Total USD \d+\.\d{2}$/.test(m.rows[0]) && /^10% Online Discount \[Lounge Booking\]: - USD \d+\.\d{2}$/.test(m.rows[1]) && /^Total \(Includes applicable taxes and fees\) USD \d+\.\d{2}$/.test(m.rows[2]), m?.rows.join(' | '));
  check(`${width} mini cart: Check Out and Edit; the ⊗ labelled`, JSON.stringify(m?.buttons) === '["Check Out","Edit"]' && m.removeLabel === 'Remove Lounge Use - 5 Hours', JSON.stringify([m?.buttons, m?.removeLabel]));
  const box = await page.evaluate(() => { const b = document.querySelector('dialog.mini-cart-modal .modal-content').getBoundingClientRect(); return [b.x, b.y, b.width].map(Math.round); });
  check(`${width} mini cart: ${width >= 768 ? '420px panel at the top right' : 'the screen\'s width'}`, width >= 768 ? (box[2] === 420 && box[1] === 28 && Math.abs(box[0] + box[2] + 28 - width) <= 16) : (box[0] === 0 && box[2] === width), JSON.stringify(box));
  // Check Out / Edit: announced, nothing else
  const announced = await page.evaluate(() => new Promise((resolve) => {
    const got = [];
    ['cart:checkout', 'cart:edit'].forEach((n) => document.addEventListener(n, (e) => got.push(`${n}:${e.detail.cart?.cartId}`)));
    document.querySelectorAll('dialog.mini-cart-modal .mini-cart-actions button').forEach((b) => b.click());
    setTimeout(() => resolve(got), 200);
  }));
  check(`${width} Check Out and Edit announce cart:checkout / cart:edit`, JSON.stringify(announced) === '["cart:checkout:CRT_TEST1","cart:edit:CRT_TEST1"]' && new URL(page.url()).pathname === '/en-uk/', JSON.stringify(announced));
  // as live (static): Esc and a click beside it don't close it; ✕ does, focus back on the button
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const afterEsc = (await state(page)).open;
  await page.mouse.click(width >= 768 ? 100 : 187, width >= 768 ? 450 : 880 - 60);
  await page.waitForTimeout(400);
  const afterClick = (await state(page)).open;
  check(`${width} Esc and a click beside it: still open (as live)`, JSON.stringify(afterEsc) === '["mini-cart-modal"]' && JSON.stringify(afterClick) === '["mini-cart-modal"]', JSON.stringify([afterEsc, afterClick]));
  await page.locator('dialog.mini-cart-modal[open] .modal-close').click();
  await page.waitForTimeout(400);
  check(`${width} ✕ closes it, focus back on the card's button`, (await state(page)).open.length === 0 && await page.evaluate(() => document.activeElement?.classList.contains('booking-widget-card-book')));

  // another product while the cart holds a booking: Checkout Cart, no request
  await page.evaluate(() => {
    const b = document.querySelector('.booking-widget-card-book');
    b.dataset.catalogueCode = 'OTHER';
    b.classList.remove('is-in-cart');
  });
  // (the card's own product is in the cart: post another one as the card would)
  await page.evaluate(() => document.querySelector('.booking-widget-card-book').dispatchEvent(new CustomEvent('booking-widget:book', {
    bubbles: true,
    detail: {
      catalogueCode: 'PRD1-Regular-X', date: '2099-01-01', time: '1500', adult: '1', children: '0', currency: 'USD',
    },
  })));
  await page.waitForSelector('dialog.cart-message-modal[open]', { timeout: 10000 });
  const cf = await page.evaluate(() => document.querySelector('dialog.cart-message-modal[open]').textContent.replace(/\s+/g, ' ').trim());
  check(`${width} a second booking: the cart read first (GET), then Checkout Cart, no POST`, cf === 'Checkout CartPlease proceed to checkout before adding new item into cart.View Cart' && page.api.posts.length === 1 && page.api.gets.length === 2, `${cf} | gets ${page.api.gets.length}`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  check(`${width} Checkout Cart: Esc doesn't close it (as live)`, JSON.stringify((await state(page)).open) === '["cart-message-modal"]');
  await page.locator('dialog.cart-message-modal[open] .cart-button').click();
  await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 5000 });
  check(`${width} View Cart opens the mini cart`, JSON.stringify((await state(page)).open) === '["mini-cart-modal"]');

  // ⊗: Cancel keeps it, Yes takes it out
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-remove').click();
  await page.waitForSelector('dialog.cart-confirm-modal[open]');
  const cq = await page.evaluate(() => document.querySelector('dialog.cart-confirm-modal[open] .cart-confirm-message').textContent);
  const both = (await state(page)).open;
  check(`${width} ⊗: the confirmation, over the mini cart (as live)`, cq === 'Would you like to remove this order from the shopping cart?Lounge Use - 5 Hours' && JSON.stringify(both) === '["mini-cart-modal","cart-confirm-modal"]', `${cq} | ${JSON.stringify(both)}`);
  const look = await page.evaluate(() => {
    const [cancel, yes] = document.querySelectorAll('dialog.cart-confirm-modal .cart-confirm-actions .cart-button');
    const c = getComputedStyle(cancel); const y = getComputedStyle(yes);
    return [c.backgroundColor, c.color, y.backgroundColor, y.color, getComputedStyle(document.querySelector('.cart-confirm-actions')).borderTopColor];
  });
  check(`${width} the confirmation's buttons and footer line (as live)`, JSON.stringify(look) === '["rgb(104, 18, 53)","rgb(255, 255, 255)","rgba(104, 18, 53, 0.1)","rgb(83, 14, 42)","rgb(222, 226, 230)"]', JSON.stringify(look));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  check(`${width} the confirmation: Esc doesn't close it (as live)`, (await state(page)).open.includes('cart-confirm-modal'));
  await page.locator('dialog.cart-confirm-modal[open] .cart-button', { hasText: 'Cancel' }).click();
  await page.waitForTimeout(400);
  check(`${width} Cancel: only the confirmation closes, still in the cart`, JSON.stringify((await state(page)).open) === '["mini-cart-modal"]' && (await state(page)).id === 'CRT_TEST1', JSON.stringify((await state(page)).open));
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-remove').click();
  await page.waitForSelector('dialog.cart-confirm-modal[open]');
  let navigated = false;
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) navigated = true; });
  await page.locator('dialog.cart-confirm-modal[open] .cart-button', { hasText: 'Yes' }).click();
  await page.waitForSelector('#spinner-overlay', { state: 'attached', timeout: 3000 }).catch(() => {});
  const loaderOnYes = await page.evaluate(() => !!document.querySelector('dialog.mini-cart-modal[open] #spinner-overlay'));
  await page.waitForFunction(() => !document.querySelector('dialog.mini-cart-modal[open]'), null, { timeout: 10000 });
  await page.waitForTimeout(600);
  const gone = await state(page);
  const focus = await page.evaluate(() => document.activeElement?.className || document.activeElement?.tagName);
  // (live reloads the page here; this site updates in place)
  check(`${width} Yes: the loader over the mini cart, one DELETE ?cartId, no reload: out of the cart in place (count, card's Book Now, dialogs closed, focus back)`, loaderOnYes && page.api.deletes.length === 1 && /cart\?cartId=CRT_TEST1$/.test(page.api.deletes[0]) && !navigated && !gone.id && !gone.stored && !gone.badge && gone.label === 'Cart' && !gone.open.length && gone.book === 'Book Now' && focus !== 'BODY', JSON.stringify({
    gone: { ...gone, stored: !!gone.stored }, deletes: page.api.deletes, navigated, focus,
  }));
  check(`${width} no page errors`, !page.errors.length, page.errors.join(' | '));
  await page.close();
}
for (const width of WIDTHS) await addFlow(width);

// the card's Remove From Cart: at once, no confirmation; a double click adds once
{
  const page = await openHome();
  await pick(page);
  await page.locator('.booking-widget-card-book').dblclick();
  await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 15000 });
  await page.waitForTimeout(800);
  check('double click on Book Now: one POST', page.api.posts.length === 1, `${page.api.posts.length}`);
  await page.locator('dialog.mini-cart-modal[open] .modal-close').click();
  let navigated = false;
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) navigated = true; });
  await page.locator('.booking-widget-card-book').dblclick();
  await page.waitForSelector('#spinner-overlay', { state: 'attached', timeout: 3000 }).catch(() => {});
  const during = await page.evaluate(() => ({ loader: !!document.getElementById('spinner-overlay'), aria: document.querySelector('.booking-widget-card-book').getAttribute('aria-disabled') }));
  await page.waitForFunction(() => document.querySelector('.booking-widget-card-book')?.textContent === 'Book Now', null, { timeout: 10000 });
  await page.waitForTimeout(600);
  const s = await state(page);
  check('the card\'s Remove From Cart: loader and aria-disabled meanwhile, one DELETE (double click), no reload', during.loader && during.aria === 'true' && page.api.deletes.length === 1 && !navigated, JSON.stringify({ during, deletes: page.api.deletes.length, navigated }));
  check('the card\'s Remove From Cart: out of the cart (cookie, summary, count), Book Now, no dialog', !s.id && !s.stored && !s.badge && s.book === 'Book Now' && !s.open.length, JSON.stringify(s));
  await page.close();
}

// failures: nothing kept, the message, Book Now usable again
for (const [name, post] of [
  ['the service\'s error (200 BKNG030)', () => json({ details: 'Invalid input data', errorCode: 'BKNG030', message: 'invalid locationCode' })],
  ['a 400 (UPSTREAM_REQUEST_REJECTED)', () => json({ error: { code: 'UPSTREAM_REQUEST_REJECTED', message: 'OneTECO rejected the request' } }, 400)],
  ['a 500', () => json('oops', 500)],
  ['not JSON', () => ({
    status: 200, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: '<html></html>',
  })],
  ['no cartId', () => json({})],
]) {
  const page = await openHome({ post });
  await pick(page);
  await page.locator('.booking-widget-card-book').click();
  await page.waitForSelector('dialog.cart-message-modal[open]', { timeout: 15000 });
  const text = await page.evaluate(() => document.querySelector('dialog.cart-message-modal[open]').textContent.replace(/\s+/g, ' ').trim());
  const s = await state(page);
  const enabled = await page.evaluate(() => !document.querySelector('.booking-widget-card-book').disabled);
  check(`failure, ${name}: "Unable to add to cart.", nothing kept, Book Now usable`, text === 'CartUnable to add to cart.' && !s.id && !s.stored && !s.badge && enabled && s.book === 'Book Now', JSON.stringify({ text, s: { ...s, stored: !!s.stored } }));
  await page.close();
}
// a network failure
{
  const page = await openHome();
  await page.route(/ppg-app\/cart(\?|$)/, (r) => (r.request().method() === 'POST' ? r.abort() : r.fallback()));
  await pick(page);
  await page.locator('.booking-widget-card-book').click();
  await page.waitForSelector('dialog.cart-message-modal[open]', { timeout: 15000 });
  check('failure, the network: the message, nothing kept', !(await state(page)).id);
  await page.close();
}
// made, but not read back: kept with what the card knew
{
  const page = await openHome({ get: () => json('down', 503) });
  await pick(page);
  await page.locator('.booking-widget-card-book').click();
  await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 15000 });
  const m = await miniText(page);
  const s = await state(page);
  check('made but not read back: kept, the mini cart from the card', s.id === 'CRT_TEST1' && s.badge === '1' && m?.name === 'SDS Lounge' && m.details[3] === 'Services: Lounge Use - 3 Hours' && /^Total .* USD 50\.00$/.test(m.rows.at(-1)) && m.rows.length === 1, JSON.stringify(m));
  await page.close();
}

// a stored cart: the count at once, no request; the icon opens the mini cart (and reads the cart)
const stored = (extra = {}) => `(() => {
  // (once per tab: not again when the page loads again, e.g. after Yes)
  if (sessionStorage.getItem('cart-seeded')) return;
  sessionStorage.setItem('cart-seeded', '1');
  const seed = (c) => { localStorage.setItem('ppl-cart-id', JSON.stringify({ id: c.cartId, expires: c.expires, changed: Date.now(), count: c.lines.reduce((n, l) => n + (Number(l.quantity) || 1), 0), codes: c.lines.map((l) => l.catalogueCode) })); sessionStorage.setItem('ppl-cart', JSON.stringify({ ...c, fetchedAt: Date.now(), expires: Date.now() + 2 * 3600e3 })); };
  seed(Object.assign({
    cartId: 'CRT_KEPT', currency: 'HKD', expires: Date.now() + 3600e3,
    totals: { base: 650.36, discounts: [{ name: '10% Online Discount [Lounge Booking]', value: 65.04 }], total: 585.32 },
    lines: [{ catalogueCode: '${CART.products[0].catalogueCode}', name: 'Plaza Premium Lounge', product: 'Lounge Use - 5 Hours', place: 'Near Gate 1, Departures, Hong Kong International Airport', start: '2099-11-04 15:00:00', adults: 2, children: 1, quantity: 1 }],
  }, ${JSON.stringify(extra)}));
})()`;
{
  const page = await openHome({ init: stored(), guests: { adult: '2', child: '1' } });
  await page.waitForTimeout(1000);
  const s = await state(page);
  check('stored cart: the count on load, no cart request', s.badge === '1' && page.api.gets.length === 0 && page.api.posts.length === 0, JSON.stringify({ badge: s.badge, gets: page.api.gets.length }));
  // (the cart's code isn't loaded until it's needed)
  const loaded = await page.evaluate(() => performance.getEntriesByType('resource').some((e) => /\/scripts\/(cart|mini-cart)\.js/.test(e.name)));
  check('stored cart: cart.js / mini-cart.js not loaded yet', !loaded);
  await page.locator('header a.header-utility:has(.icon-cart)').first().click();
  await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 10000 });
  const m = await miniText(page);
  check('the header\'s cart opens the mini cart (guests with a child), and reads the cart', /^Guests: 2 Adult\(s\) 1 Child\(ren\)$/.test(m?.details[2]) && page.api.gets.some((u) => /cartId=CRT_KEPT/.test(u)), JSON.stringify([m?.details, page.api.gets]));
  // a removal while the read is under way stays removed
  await page.close();
}
{
  const page = await openHome({
    init: stored(),
    get: async () => { await wait(1500); return json({ ...structuredClone(CART), cartId: 'CRT_KEPT' }); },
  });
  await page.locator('header a.header-utility:has(.icon-cart)').first().click();
  await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 10000 });
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-remove').click();
  await page.locator('dialog.cart-confirm-modal[open] .cart-button', { hasText: 'Yes' }).click();
  await page.waitForTimeout(2500);
  const s = await state(page);
  check('removed while the cart is being read: stays removed', !s.id && !s.stored && !s.badge, JSON.stringify(s));
  await page.close();
}
// expired, past, unknown to the service
{
  const page = await openHome({ init: stored({ expires: Date.now() - 1000 }) });
  check('a cart past its day: forgotten, no count', !(await state(page)).badge && !(await state(page)).id);
  await page.close();
}
{
  const page = await openHome({
    init: stored({
      lines: [{
        catalogueCode: 'X', name: 'L', product: 'P', start: '2020-01-01 10:00:00', adults: 1, children: 0, quantity: 1,
      }],
    }),
  });
  check('a cart whose booking is over: forgotten', !(await state(page)).badge);
  await page.close();
}
{
  const page = await openHome({ init: stored(), get: () => json({ details: 'Record not found', errorCode: 'BKNG001', message: 'Cart not found' }) });
  await page.locator('header a.header-utility:has(.icon-cart)').first().click();
  await page.waitForTimeout(1500);
  const s = await state(page);
  check('a cart the service no longer knows (BKNG001): forgotten, the mini cart closes', !s.id && !s.badge && !s.open.includes('mini-cart-modal'), JSON.stringify(s));
  await page.close();
}
// another tab
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.route(/ppg-app\/cart(\?|$)/, (r) => r.fulfill(json({ ...structuredClone(CART), cartId: 'CRT_KEPT' })));
  const a = await context.newPage();
  const b = await context.newPage();
  await a.goto(`${process.env.BW_HOST || 'http://localhost:3000'}/en-uk/airport-lounge-passes`, { waitUntil: 'load' });
  await b.goto(`${process.env.BW_HOST || 'http://localhost:3000'}/en-uk/airport-lounge-passes`, { waitUntil: 'load' });
  await a.waitForSelector('header .header-cart-count', { state: 'attached', timeout: 20000 });
  await b.waitForSelector('header .header-cart-count', { state: 'attached', timeout: 20000 });
  await a.evaluate(stored());
  // eslint-disable-next-line import/no-absolute-path
  await a.evaluate(() => import('/scripts/cart-state.js').then((m) => m.saveCart(JSON.parse(sessionStorage.getItem('ppl-cart')))));
  await b.waitForTimeout(800);
  const badge = await b.evaluate(() => document.querySelector('header .header-cart-count:not([hidden])')?.textContent);
  check('another tab: its header follows', badge === '1', badge);
  await context.close();
}

// another language: zh-cn texts and date
{
  const page = await openHome({ path: '/zh-cn/', init: stored(), guests: { adult: '2', child: '1' } });
  await page.locator('header a.header-utility:has(.icon-cart)').first().click();
  await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 10000 });
  const m = await miniText(page);
  check('zh-cn: the source\'s texts and date', m?.title === '购物车' && /^日期: \d{4}年\d{2}月\d{2}日$/.test(m.details[0]) && /^时间: \d{4}hrs$/.test(m.details[1]) && /^宾客: 2 成人 1 儿童$/.test(m.details[2]) && /^服务总额 HKD /.test(m.rows[0]) && /^总额 \(包含相关税项及费用\) HKD /.test(m.rows.at(-1)) && JSON.stringify(m.buttons) === '["结账","编辑"]', JSON.stringify(m));
  await page.close();
}

// removal failures: the cart kept, with the source's message (no reload from Yes); a cart the
// service doesn't know (CRT_ERR_004) counts as removed
// (a stored cart holding the card's own product, so the card offers Remove From Cart)
const storedCard = () => stored({
  lines: [{
    catalogueCode: CODE, name: 'SDS Lounge', product: 'Lounge Use - 3 Hours', place: '', start: '2099-11-04 15:00:00', adults: 1, children: 0, quantity: 1,
  }],
});
for (const [name, del] of [
  ['a 500', () => json('oops', 500)],
  ['the service\'s error (200 CRT_ERR_005)', () => json({ errorCode: 'CRT_ERR_005', message: 'Something failed' })],
]) {
  const page = await openHome({ init: storedCard(), del });
  await pick(page);
  await page.waitForFunction(() => document.querySelector('.booking-widget-card-book')?.textContent === 'Remove From Cart', null, { timeout: 10000 });
  await page.locator('.booking-widget-card-book').click();
  await page.waitForSelector('dialog.cart-message-modal[open]', { timeout: 10000 });
  const text = await page.evaluate(() => document.querySelector('dialog.cart-message-modal[open]').textContent.replace(/\s+/g, ' ').trim());
  const s = await state(page);
  check(`removal fails (${name}), from the card: "Unable to remove from cart.", the cart kept`, text === 'CartUnable to remove from cart.' && s.id === 'CRT_KEPT' && s.badge === '1' && s.book === 'Remove From Cart', JSON.stringify({ text, s: { ...s, stored: !!s.stored } }));
  await page.locator('dialog.cart-message-modal[open] .modal-close').click();
  await page.locator('header a.header-utility:has(.icon-cart)').first().click();
  await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 10000 });
  let navigated = false;
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) navigated = true; });
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-remove').click();
  await page.locator('dialog.cart-confirm-modal[open] .cart-button', { hasText: 'Yes' }).click();
  await page.waitForSelector('dialog.cart-message-modal[open]', { timeout: 10000 });
  await page.waitForTimeout(800);
  const s2 = await state(page);
  check(`removal fails (${name}), from Yes: no reload, the mini cart stays with the message over it, the cart kept`, !navigated && JSON.stringify([...s2.open].sort()) === '["cart-message-modal","mini-cart-modal"]' && await page.evaluate(() => [...document.querySelectorAll('dialog.modal[open]')].pop() === document.querySelector('dialog.cart-message-modal') || document.activeElement?.closest('dialog')?.classList.contains('cart-message-modal')) && s2.id === 'CRT_KEPT' && !(await page.evaluate(() => !!document.getElementById('spinner-overlay'))), JSON.stringify({ navigated, s2: { ...s2, stored: !!s2.stored } }));
  await page.close();
}
{
  const page = await openHome({ init: storedCard(), del: () => json({ details: 'Cart Id  not found', errorCode: 'CRT_ERR_004', message: 'Cart not found forCRT_KEPT' }) });
  await pick(page);
  await page.waitForFunction(() => document.querySelector('.booking-widget-card-book')?.textContent === 'Remove From Cart', null, { timeout: 10000 });
  await page.locator('.booking-widget-card-book').click();
  await page.waitForFunction(() => document.querySelector('.booking-widget-card-book')?.textContent === 'Book Now', null, { timeout: 10000 });
  const s = await state(page);
  check('a cart the service doesn\'t know (CRT_ERR_004) on delete: counts as removed', !s.id && !s.badge && !s.open.length, JSON.stringify(s));
  await page.close();
}

// axe on the mini cart, the remove confirmation and Checkout Cart (with AXE_CORE: axe.min.js)
if (process.env.AXE_CORE) {
  const AXE = readFileSync(process.env.AXE_CORE, 'utf8');
  const axe = async (page, label) => {
    await page.addScriptTag({ content: AXE });
    const res = await page.evaluate(async () => {
      // eslint-disable-next-line no-undef
      const r = await axe.run(document.querySelector('dialog.modal[open]'), { resultTypes: ['violations'] });
      return r.violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.target}`);
    });
    check(`axe, ${label}: no violations`, !res.length, res.join(' | '));
  };
  for (const width of [1440, 375]) {
    const page = await openHome({ width, init: stored() });
    await page.locator('header a.header-utility:has(.icon-cart)').first().click();
    await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 10000 });
    await page.waitForTimeout(800);
    await axe(page, `${width} mini cart`);
    await page.locator('dialog.mini-cart-modal[open] .mini-cart-remove').click();
    await page.waitForSelector('dialog.cart-confirm-modal[open]');
    await axe(page, `${width} remove confirmation`);
    await page.locator('dialog.cart-confirm-modal[open] .cart-button', { hasText: 'Cancel' }).click();
    await page.waitForSelector('dialog.mini-cart-modal[open]');
    await page.locator('dialog.mini-cart-modal[open] .modal-close').click();
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('booking-widget:book', {
      detail: {
        catalogueCode: 'PRD1-Regular-X', date: '2099-01-01', time: '1500', adult: '1', children: '0', currency: 'USD',
      },
    })));
    await page.waitForSelector('dialog.cart-message-modal[open]', { timeout: 10000 });
    await axe(page, `${width} Checkout Cart`);
    await page.close();
  }
}

await browser.close();
console.log(`\n${failed} failed`);
process.exit(failed ? 1 : 0);
