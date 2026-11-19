// A campaign page's own Add to Cart (an Embed Code block's script, copied from the source, calls
// the source's global AddToCart(button, catalogueCode, …)): Beyond The Event's pass cards put their
// pass into this site's cart, as the pass blocks' Add to Cart does. The cart API is routed (POST
// makes a cart, PUT replaces its products, GET reads it back as fixtures/cart-pass.json's pass
// line, with the card's name and price). Usage: node embed-pass.test.mjs [width]
import { readFileSync } from 'node:fs';
import { open, PW } from '../booking-widget/harness.mjs';

const { chromium } = await import(PW);
const PASS_CART = JSON.parse(readFileSync(new URL('./fixtures/cart-pass.json', import.meta.url), 'utf8'));
const LOUNGE_CART = JSON.parse(readFileSync(new URL('./fixtures/cart.json', import.meta.url), 'utf8'));
const WIDTHS = process.argv[2] ? [Number(process.argv[2])] : [1440, 375];
const PATH = '/en-uk/offers/beyond-the-event';
const browser = await chromium.launch();
let failed = 0;
const check = (name, ok, info = '') => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info ? ` — ${info}` : ''}`); };
const json = (body, status = 200) => ({
  status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: typeof body === 'string' ? body : JSON.stringify(body),
});
const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });
// the page's cards: their codes (data-prd), names and prices
const A = 'PRD2825-Regular-PRPRTY742-GFTCRD-LCTN1001-RTPLN9248';
const B = 'PRD3068-Regular-PRPRTY742-GFTCRD-LCTN1001-RTPLN9248';
const PASSES = new Map([
  [A, { name: 'Kuala Lumpur, Singapore, Jakarta & Medan 2-Visit Pass', price: 70 }],
  [B, { name: 'Global 2-Visit Pass', price: 99 }],
]);

/**
 * The cart service: carts by id (their currency and products, or `lounge`: the cart.json
 * fixture); `fail` answers a method instead.
 */
function cartService({ carts = new Map(), fail = {} } = {}) {
  const api = {
    posts: [], puts: [], gets: [], deletes: [],
  };
  let made = 0;
  const read = (id) => {
    const cart = carts.get(id);
    if (cart === 'lounge') return { ...structuredClone(LOUNGE_CART), cartId: id };
    const answer = structuredClone(PASS_CART);
    answer.cartId = id;
    answer.currency = cart.currency;
    answer.products = cart.products.map((p, i) => {
      const pass = PASSES.get(p.catalogueCode);
      const line = structuredClone(PASS_CART.products[0]);
      const quantity = Number(p.quantity);
      Object.assign(line, {
        cartItemId: `CRT_ITM_${i}`, catalogueCode: p.catalogueCode, productCode: p.catalogueCode.split('-')[0], productDisplayName: pass.name, productName: pass.name, quantity, startDate: p.startDate,
      });
      line.itemPriceDetails.productTotalPrice.totalPrice = pass.price * quantity;
      return line;
    });
    const total = answer.products.reduce((sum, p) => sum + p.itemPriceDetails.productTotalPrice.totalPrice, 0);
    Object.assign(answer.cartTotalPrice, { totalBasePrice: total, totalPrice: total });
    return answer;
  };
  const route = async (r) => {
    const req = r.request();
    const method = req.method();
    if (method === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const id = new URL(req.url()).searchParams.get('cartId');
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    ({
      POST: api.posts, PUT: api.puts, GET: api.gets, DELETE: api.deletes,
    })[method].push(body || req.url());
    await wait(method === 'GET' ? 150 : 400);
    if (fail[method]) return r.fulfill(fail[method]);
    if (method === 'POST') {
      made += 1;
      const cartId = `CRT_E${made}`;
      carts.set(cartId, { currency: body.currency, products: body.products });
      return r.fulfill(json({ cartId }));
    }
    if (method === 'PUT') {
      if (!carts.has(id)) return r.fulfill(json({ errorCode: 'BKNG001', message: 'Cart not found' }));
      carts.set(id, { currency: body.currency, products: body.products });
      return r.fulfill(json({ cartId: id }));
    }
    if (method === 'DELETE') {
      carts.delete(id);
      return r.fulfill(json({ code: '200', description: 'Success' }));
    }
    if (!carts.has(id)) return r.fulfill(json({ errorCode: 'BKNG001', message: 'Cart not found' }));
    return r.fulfill(json(read(id)));
  };
  return { api, route };
}

/** The page with the routed cart; `init` runs before the page's scripts (e.g. a stored cart). */
async function openPage({
  width = 1440, query = '', service = cartService(), init,
} = {}) {
  const warnings = [];
  const page = await open(browser, {
    width,
    path: `${PATH}${query}`,
    extraRoute: async (p) => {
      p.on('console', (m) => { if (m.type() === 'warning') warnings.push(m.text()); });
      if (init) await p.addInitScript(init);
      await p.route(/ppg-app\/cart(\?|$)/, service.route);
    },
  });
  page.api = service.api;
  page.warnings = warnings;
  await page.waitForFunction(() => document.querySelectorAll('.embed-code .ppg-atc').length === 9 && typeof window.AddToCart === 'function', null, { timeout: 30000 });
  return page;
}

const card = (page, code) => page.locator(`.embed-code .ppg-atc[data-prd="${code}"]`);
const mini = (page) => page.evaluate(() => {
  const d = document.querySelector('dialog.mini-cart-modal[open]');
  return d && {
    lines: [...d.querySelectorAll('.mini-cart-line')].map((l) => `${l.querySelector('.mini-cart-name').textContent.trim()} | ${[...(l.querySelector('.mini-cart-quantity')?.children || [])].map((c) => c.textContent).join(' | ')}`),
    total: d.querySelector('.mini-cart-total .mini-cart-amount')?.textContent,
  };
});
// the cart's count as the site keeps it (what the header's count shows)
const badge = (page) => page.evaluate(() => String(JSON.parse(localStorage.getItem('ppl-cart-id') || 'null')?.count ?? ''));
const closeMini = async (page) => {
  await page.locator('dialog.mini-cart-modal[open] .modal-close').click();
  await page.waitForTimeout(300);
};
const message = (page) => page.evaluate(() => {
  const d = document.querySelector('dialog.cart-message-modal[open]');
  return d && { title: d.querySelector('.cart-dialog-title')?.textContent, text: d.querySelector('.cart-dialog-body p')?.textContent };
});
// the site's own errors: not the campaign's images or the tags' (their hosts; the ctnsnet tag's
// document.write the site's Trusted Types block and an unload listener, as on the passes page), nor
// the local copy's section-metadata table (loaded there as a block; the page in Document Authoring
// makes it the section's style, inset)
const ownErrors = (page) => page.errors.filter((e) => !/Failed to load resource|ERR_|net::|ctnsnet|doubleclick|googletag|facebook|netcore|hansel|section-metadata|requires 'TrustedHTML' assignment|Permissions policy violation: unload/i.test(e));
// a stored cart with a lounge (as passes.test.mjs's), known to the service as `lounge`
const storedLounge = `(() => {
  if (sessionStorage.getItem('cart-seeded')) return;
  sessionStorage.setItem('cart-seeded', '1');
  const c = {
    cartId: 'CRT_LOUNGE', currency: 'HKD', expires: Date.now() + 3600e3, totals: { base: 650.36, discounts: [], total: 650.36 },
    lines: [{ catalogueCode: '${LOUNGE_CART.products[0].catalogueCode}', type: 'lounge', kind: 'lounge', name: 'Plaza Premium Lounge', product: 'Lounge Use - 5 Hours', place: '', start: '2099-11-04 15:00:00', adults: 1, children: 0, quantity: 1 }],
  };
  localStorage.setItem('ppl-cart-id', JSON.stringify({ id: c.cartId, expires: c.expires, changed: Date.now(), count: 1, codes: [c.lines[0].catalogueCode] }));
  sessionStorage.setItem('ppl-cart', JSON.stringify({ ...c, fetchedAt: Date.now(), expires: Date.now() + 2 * 3600e3 }));
})()`;

async function flow(width) {
  // 1. a card's Add to Cart (an empty cart): the button off and the loader meanwhile, one POST
  // with the card's code, then the mini cart with the pass
  let page = await openPage({ width });
  const add = card(page, A);
  await add.scrollIntoViewIfNeeded();
  await add.click();
  await page.waitForSelector('#spinner-overlay', { state: 'attached', timeout: 3000 }).catch(() => {});
  const during = await add.evaluate((b) => ({ loader: !!document.getElementById('spinner-overlay'), disabled: b.disabled, aria: b.getAttribute('aria-disabled') }));
  await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 15000 });
  await page.waitForTimeout(400);
  const [post] = page.api.posts;
  const p0 = post?.products?.[0];
  check(`${width} Add to Cart: the loader and the button off meanwhile`, during.loader && during.disabled && during.aria === 'true', JSON.stringify(during));
  check(`${width} one POST: USD, the card's code (data-prd), quantity "1", a pass start, B2C Online`, page.api.posts.length === 1 && post.currency === 'USD' && post.channel === 'B2C' && post.pointOfPurchase === 'Online' && post.products.length === 1 && p0.catalogueCode === A && p0.quantity === '1' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:00$/.test(p0.startDate || '') && !('guestsCount' in p0), JSON.stringify(post));
  let m = await mini(page);
  check(`${width} the mini cart: the pass (its name, Quantity: 1, its price), the count 1`, JSON.stringify(m?.lines) === JSON.stringify([`${PASSES.get(A).name} | Quantity: 1 | USD 70.00`]) && m.total === 'USD 70.00' && await badge(page) === '1', JSON.stringify([m, await badge(page)]));
  check(`${width} the button back on after the add`, await add.evaluate((b) => !b.disabled && !b.hasAttribute('aria-disabled')));
  await closeMini(page);

  // 2. the same card again: PUT with quantity "2"
  await add.click();
  await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 15000 });
  await page.waitForTimeout(400);
  const [put1] = page.api.puts;
  m = await mini(page);
  check(`${width} the same card again: PUT with its quantity "2", no other POST; Quantity: 2`, page.api.posts.length === 1 && page.api.puts.length === 1 && put1.products.length === 1 && put1.products[0].catalogueCode === A && put1.products[0].quantity === '2' && JSON.stringify(m?.lines) === JSON.stringify([`${PASSES.get(A).name} | Quantity: 2 | USD 140.00`]), JSON.stringify([put1, m?.lines]));
  await closeMini(page);

  // 3. another card: PUT with both passes
  await card(page, B).scrollIntoViewIfNeeded();
  await card(page, B).click();
  await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 15000 });
  await page.waitForTimeout(400);
  const put2 = page.api.puts[1];
  m = await mini(page);
  check(`${width} another card: PUT with both passes (A ×2, B ×1), two lines, the total, the count 3`, JSON.stringify(put2?.products.map((p) => [p.catalogueCode, p.quantity])) === JSON.stringify([[A, '2'], [B, '1']]) && m?.lines.length === 2 && m.total === 'USD 239.00' && await badge(page) === '3', JSON.stringify([put2?.products, m, await badge(page)]));
  await closeMini(page);

  // 6. a code that isn't a pass's: nothing added, a warning
  const before = page.api.posts.length + page.api.puts.length;
  await page.evaluate(() => window.AddToCart(document.querySelector('.embed-code .ppg-atc'), 'PRD2516-Regular-PRPRTY1324-LOUNGE-LCTN1-RTPLN1', 'All', 'False', '', '', ''));
  await page.waitForTimeout(800);
  check(`${width} AddToCart with a non-pass code: nothing sent, no dialog, a console warning`, page.api.posts.length + page.api.puts.length === before && !(await page.evaluate(() => document.querySelector('dialog.modal[open]'))) && page.warnings.some((w) => /AddToCart: not a pass/.test(w)), JSON.stringify(page.warnings.slice(-2)));
  check(`${width} no page errors from the site's code`, !ownErrors(page).length, ownErrors(page).join(' | '));
  await page.close();

  // 4. a lounge in the cart: Checkout Cart, nothing sent
  const lounge = cartService({ carts: new Map([['CRT_LOUNGE', 'lounge']]) });
  page = await openPage({ width, service: lounge, init: storedLounge });
  await card(page, A).scrollIntoViewIfNeeded();
  await card(page, A).click();
  await page.waitForSelector('dialog.cart-message-modal[open]', { timeout: 15000 });
  const refused = await message(page);
  check(`${width} a lounge in the cart: "Checkout Cart" (its message), no POST or PUT`, refused?.title === 'Checkout Cart' && refused.text === 'Please proceed to checkout before adding new item into cart.' && !page.api.posts.length && !page.api.puts.length, JSON.stringify(refused));
  await page.close();

  // 5. the booking system refuses the code (as stage answers the live codes): the pass notice
  const refusing = cartService({ fail: { POST: json({ details: 'Invalid input data', errorCode: 'BKNG030', message: 'invalid locationCode' }) } });
  page = await openPage({ width, service: refusing });
  await card(page, A).scrollIntoViewIfNeeded();
  await card(page, A).click();
  await page.waitForSelector('dialog.cart-message-modal[open]', { timeout: 15000 });
  const notice = await message(page);
  check(`${width} the booking system refuses the code: the notice ("An error occurred…"), no cart kept, the button back on`, notice?.title === 'Notice' && notice.text === 'An error occurred. Please try again later.' && !(await page.evaluate(() => localStorage.getItem('ppl-cart-id'))) && await card(page, A).evaluate((b) => !b.disabled), JSON.stringify(notice));
  await page.close();

  // 7. the visitor's currency (?currencyCode=HKD): the POST in HKD
  page = await openPage({ width, query: '?currencyCode=HKD' });
  await card(page, B).scrollIntoViewIfNeeded();
  await card(page, B).click();
  await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 15000 });
  check(`${width} ?currencyCode=HKD: the POST in HKD`, page.api.posts[0]?.currency === 'HKD' && page.api.posts[0].products[0].catalogueCode === B, JSON.stringify(page.api.posts[0]));
  await page.close();
}

for (const width of WIDTHS) {
  // eslint-disable-next-line no-await-in-loop
  await flow(width);
}
await browser.close();
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
