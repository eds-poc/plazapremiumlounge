// Where the cart is kept (scripts/cart-state.js) and when it's read again, on the passes page with
// routed answers (the passes service's real passes, the cart API as stage answers it):
// - the cart's id in localStorage `ppl-cart-id` (24 hours; the count and catalogue codes, no prices)
// - the cart's data in sessionStorage `ppl-cart` (2 hours from the booking system's answer)
// New tabs (only the id), data past its 2 hours, a changed price, two tabs, the tab shown again,
// the earlier cookie/localStorage moved, blocked storage, and adds/removals from a tab that has
// only the id. Usage: node storage.test.mjs
import { readFileSync } from 'node:fs';
import { open, PW, UA } from '../booking-widget/harness.mjs';

const { chromium } = await import(PW);
const PASSES = JSON.parse(readFileSync(new URL('./fixtures/passes.json', import.meta.url), 'utf8'));
const PASS_CART = JSON.parse(readFileSync(new URL('./fixtures/cart-pass.json', import.meta.url), 'utf8'));
const LOUNGE_CART = JSON.parse(readFileSync(new URL('./fixtures/cart.json', import.meta.url), 'utf8'));
const PATH = '/en-uk/airport-lounge-passes';
const browser = await chromium.launch();
let failed = 0;
const check = (name, ok, info = '') => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info ? ` — ${info}` : ''}`); };
const json = (body, status = 200) => ({
  status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: typeof body === 'string' ? body : JSON.stringify(body),
});
const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });
const PRICES = new Map(PASSES.items.flatMap((item) => item.prices.map((p) => [p.catalogueCode, { item, amount: p.totalPrice }])));
// Global 2-Visit Pass's regular rate (the one the page sells), USD 99.00
const A = 'PRD3705-Regular-PRPRTY1235-GFTCRD-LCTN517-RTPLN3518';

/**
 * The cart service: carts by id ({ currency, products } or 'lounge'); `price` overrides a code's
 * amount (a price changed by the booking system); `delay` holds the GET back.
 */
function cartService({ carts = new Map(), price = {}, delay = 0 } = {}) {
  const api = {
    posts: [], puts: [], gets: [], deletes: [],
  };
  let made = 0;
  const read = (id) => {
    const cart = carts.get(id);
    if (cart === 'lounge') return { ...structuredClone(LOUNGE_CART), cartId: id };
    const answer = structuredClone(PASS_CART);
    Object.assign(answer, { cartId: id, currency: cart.currency });
    answer.products = cart.products.map((p, i) => {
      const { item, amount } = PRICES.get(p.catalogueCode);
      const line = structuredClone(PASS_CART.products[0]);
      Object.assign(line, {
        cartItemId: `CRT_ITM_${i}`, catalogueCode: p.catalogueCode, productCode: item.productCode, productDisplayName: item.productDisplayName, quantity: Number(p.quantity), startDate: p.startDate,
      });
      line.itemPriceDetails.productTotalPrice.totalPrice = (price[p.catalogueCode] ?? amount) * Number(p.quantity);
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
    if (method === 'POST') {
      api.posts.push(body);
      made += 1;
      carts.set(`CRT_S${made}`, { currency: body.currency, products: body.products });
      await wait(200);
      return r.fulfill(json({ cartId: `CRT_S${made}` }));
    }
    if (method === 'PUT') {
      api.puts.push(body);
      carts.set(id, { currency: body.currency, products: body.products });
      await wait(200);
      return r.fulfill(json({ cartId: id }));
    }
    if (method === 'DELETE') {
      api.deletes.push(id);
      carts.delete(id);
      await wait(200);
      return r.fulfill(json({ code: '200', description: 'Success' }));
    }
    api.gets.push(id);
    await wait(delay || 150);
    if (!carts.has(id)) return r.fulfill(json({ errorCode: 'BKNG001', message: 'Cart not found' }));
    return r.fulfill(json(read(id)));
  };
  return { api, route, carts };
}

// the site's third-party tags (they use storage unguarded: blocked, they throw on their own)
const THIRD = /googletagmanager|adobedtm|netcore|facebook|stackadapt|yimg|hansel|consentag\.eu|ctnsnet|bing|denomatic|affilired|lkh\.plaza/;

async function openPasses({
  service, init, tabs = browser, path = PATH, waitPasses = true, noThird = false,
} = {}) {
  const page = await open(tabs, {
    width: 1440,
    path,
    extraRoute: async (p) => {
      if (init) await p.addInitScript(init);
      if (noThird) await p.route(THIRD, (r) => r.abort());
      await p.route(/app_demo\/GetProductPasses/, (r) => r.fulfill(json(PASSES)));
      await p.route(/ppg-app\/cart(\?|$)/, service.route);
    },
  });
  page.errorsSeen = page.errors;
  if (waitPasses) await page.waitForFunction(() => document.querySelectorAll('.pass-finder button[data-pass-add]').length >= 5, null, { timeout: 30000 });
  return page;
}
const state = (page) => page.evaluate(() => ({
  entry: JSON.parse(localStorage.getItem('ppl-cart-id') || 'null'),
  data: JSON.parse(sessionStorage.getItem('ppl-cart') || 'null'),
  badge: document.querySelector('header .header-cart-count:not([hidden])')?.textContent || null,
  labelA: [...document.querySelectorAll('button[data-pass-add]')].find((b) => b.dataset.catalogueCode.startsWith('PRD3705-'))?.textContent,
  legacy: /(?:^|; )cartid=/.test(document.cookie) || !!localStorage.getItem('ppl-cart'),
}));
const miniLines = (page) => page.evaluate(() => [...document.querySelectorAll('dialog.mini-cart-modal[open] .mini-cart-line')].map((l) => l.textContent.replace(/\s+/g, ' ').trim()));
// the id entry only (a tab that hasn't read the cart), or with this tab's data
const idOnly = (id, extra = {}) => `(() => {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  localStorage.setItem('ppl-cart-id', JSON.stringify(Object.assign({ id: '${id}', expires: Date.now() + 20 * 3600e3, changed: Date.now(), count: 1, codes: ['${A}'] }, ${JSON.stringify(extra)})));
})()`;
const withData = (id, { fetchedAgo = 0, total = 99 } = {}) => `(() => {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  localStorage.setItem('ppl-cart-id', JSON.stringify({ id: '${id}', expires: Date.now() + 20 * 3600e3, changed: Date.now(), count: 1, codes: ['${A}'] }));
  const at = Date.now() - ${fetchedAgo};
  sessionStorage.setItem('ppl-cart', JSON.stringify({
    cartId: '${id}', currency: 'USD', fetchedAt: at, expires: at + 2 * 3600e3, promoCode: '',
    totals: { base: ${total}, discounts: [], promo: 0, total: ${total} },
    lines: [{ catalogueCode: '${A}', productCode: 'PRD3705', type: 'gftcrd', kind: 'pass', name: 'Global 2-Visit Pass', product: 'Global 2-Visit Pass', place: '', start: '2099-01-01 10:00:00', adults: 0, children: 0, quantity: 1, total: ${total} }],
  }));
})()`;
const passCart = () => new Map([['CRT_KEEP', { currency: 'USD', products: [{ catalogueCode: A, quantity: '1', startDate: '2099-01-01 10:00:00' }] }]]);
const openCart = (page) => page.locator('header a.header-utility:has(.icon-cart)').first().click();

// 1. a new tab: only the id (shared), no data in this tab
{
  const service = cartService({ carts: passCart(), delay: 6000 });
  const page = await openPasses({ service, init: idOnly('CRT_KEEP'), waitPasses: false });
  await page.waitForFunction(() => document.querySelectorAll('button[data-pass-add]').length > 0, null, { timeout: 30000 });
  const first = await state(page);
  check('a new tab: the count and Add More at once (from the id\'s count and codes), before any read', first.badge === '1' && first.labelA === 'Add More' && !first.data, JSON.stringify(first));
  await page.waitForFunction(() => !!sessionStorage.getItem('ppl-cart'), null, { timeout: 20000 });
  const after = await state(page);
  const hours = (after.data.expires - Date.now()) / 3600e3;
  check('a new tab: one background read after the load, then the data in this tab for 2 hours', service.api.gets.length === 1 && after.data.cartId === 'CRT_KEEP' && hours > 1.9 && hours <= 2 && after.badge === '1', JSON.stringify({ gets: service.api.gets.length, hours }));
  await page.close();
}
{
  // opening the cart before the read finishes: the loader, then the booking system's lines
  const service = cartService({ carts: passCart(), delay: 2500 });
  const page = await openPasses({ service, init: idOnly('CRT_KEEP') });
  await openCart(page);
  await page.waitForSelector('#spinner-overlay', { state: 'attached', timeout: 3000 }).catch(() => {});
  const loader = await page.evaluate(() => !!document.getElementById('spinner-overlay') && !document.querySelector('dialog.mini-cart-modal[open]'));
  await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 15000 });
  await page.waitForTimeout(300);
  const lines = await miniLines(page);
  check('a new tab, the cart opened before the read: the loader, then the cart (USD 99.00)', loader && lines.length === 1 && /USD 99\.00/.test(lines[0]), JSON.stringify({ loader, lines }));
  await page.close();
}
{
  // adding in a new tab: the cart is read first, so the pass joins it (PUT), no second cart
  const service = cartService({ carts: passCart() });
  const page = await openPasses({ service, init: idOnly('CRT_KEEP') });
  await page.evaluate(() => sessionStorage.removeItem('ppl-cart'));
  await page.locator(`.quick-buy button[data-catalogue-code="${A}"]`).click();
  await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 15000 });
  await page.waitForTimeout(300);
  check('adding in a new tab: the cart read first, Add More raises its quantity (PUT, no POST)', !service.api.posts.length && service.api.puts.length === 1 && service.api.puts[0].products[0].quantity === '2', JSON.stringify({ posts: service.api.posts.length, puts: service.api.puts }));
  await page.close();
}
{
  // a lounge in the cart, known by id only: a pass is refused (the rules read the cart first)
  const service = cartService({ carts: new Map([['CRT_LOUNGE', 'lounge']]) });
  const page = await openPasses({ service, init: idOnly('CRT_LOUNGE', { codes: [LOUNGE_CART.products[0].catalogueCode] }) });
  await page.evaluate(() => sessionStorage.removeItem('ppl-cart'));
  await page.locator(`.quick-buy button[data-catalogue-code="${A}"]`).click();
  await page.waitForSelector('dialog.cart-message-modal[open]', { timeout: 15000 });
  const text = await page.evaluate(() => document.querySelector('dialog.cart-message-modal[open]').textContent);
  check('a new tab with a lounge in the cart: a pass gets Checkout Cart, nothing added', /Please proceed to checkout/.test(text) && !service.api.posts.length && !service.api.puts.length, text);
  await page.close();
}
{
  // removing in a new tab: read first, then DELETE (the last line)
  const service = cartService({ carts: passCart() });
  const page = await openPasses({ service, init: idOnly('CRT_KEEP') });
  await page.evaluate(() => sessionStorage.removeItem('ppl-cart'));
  // eslint-disable-next-line import/no-absolute-path
  const result = await page.evaluate((code) => import('/scripts/cart.js').then((m) => m.removeFromCart(code)), A);
  const s = await state(page);
  check('removing in a new tab: the cart read first, then DELETE; forgotten', result.status === 'removed' && service.api.deletes.length === 1 && !s.entry && !s.data && !s.badge, JSON.stringify({ result, deletes: service.api.deletes, s }));
  await page.close();
}

// 2. the data past its 2 hours, and a price the booking system changed
{
  const service = cartService({ carts: passCart(), price: { [A]: 120 }, delay: 2000 });
  const page = await openPasses({ service, init: withData('CRT_KEEP', { fetchedAgo: 2 * 3600e3 + 60e3 }), waitPasses: false });
  await page.waitForTimeout(300);
  const early = await state(page);
  await openCart(page);
  await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 15000 });
  const firstShown = await miniLines(page);
  check('data past its 2 hours: dropped; the cart opens only after a read, with the booking system\'s new price (USD 120.00), never the old one', !early.data && firstShown.length === 1 && /USD 120\.00/.test(firstShown[0]) && !/USD 99\.00/.test(firstShown[0]) && service.api.gets.length >= 1, JSON.stringify({ early: !!early.data, firstShown, gets: service.api.gets.length }));
  await page.close();
}
{
  // within its 2 hours: shown at once, then the background read updates a changed price in place
  const service = cartService({ carts: passCart(), price: { [A]: 120 }, delay: 1500 });
  const page = await openPasses({ service, init: withData('CRT_KEEP', { fetchedAgo: 30 * 60e3 }) });
  const gets = service.api.gets.length;
  await openCart(page);
  await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 5000 });
  const atOnce = await miniLines(page);
  await page.waitForFunction(() => /USD 120\.00/.test(document.querySelector('dialog.mini-cart-modal[open]')?.textContent || ''), null, { timeout: 10000 });
  const later = await miniLines(page);
  check('within its 2 hours: no read on load; the cart at once (USD 99.00), then the read updates it in place (USD 120.00)', gets === 0 && /USD 99\.00/.test(atOnce[0]) && /USD 120\.00/.test(later[0]), JSON.stringify({ gets, atOnce, later }));
  await page.close();
}
{
  // the tab shown again with its data past the 2 hours: read again
  const service = cartService({ carts: passCart() });
  const page = await openPasses({ service, init: withData('CRT_KEEP', { fetchedAgo: 60e3 }) });
  const before = service.api.gets.length;
  await page.evaluate(() => {
    const d = JSON.parse(sessionStorage.getItem('ppl-cart'));
    d.expires = Date.now() - 1000;
    sessionStorage.setItem('ppl-cart', JSON.stringify(d));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(1200);
  const s = await state(page);
  check('the tab shown again with its data past the 2 hours: read again (one GET), the data renewed', service.api.gets.length === before + 1 && s.data?.expires > Date.now() + 1.9 * 3600e3, JSON.stringify({ gets: service.api.gets.length - before }));
  await page.close();
}

// 3. two tabs of one browser: a change in one, the other follows (the id's signal, then a read)
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent: UA });
  const tabs = { newPage: () => context.newPage() };
  const service = cartService();
  const a = await openPasses({ service, tabs });
  const b = await openPasses({ service, tabs });
  await a.locator(`.quick-buy button[data-catalogue-code="${A}"]`).click();
  await a.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 15000 });
  await b.waitForFunction(() => document.querySelector('header .header-cart-count:not([hidden])')?.textContent === '1', null, { timeout: 5000 }).catch(() => {});
  const b1 = await state(b);
  await b.waitForFunction(() => !!sessionStorage.getItem('ppl-cart'), null, { timeout: 10000 }).catch(() => {});
  const b2 = await state(b);
  check('two tabs: the other tab\'s count and Add More follow at once, then it reads the cart into its own data', b1.badge === '1' && b1.labelA === 'Add More' && b2.data?.cartId === 'CRT_S1', JSON.stringify({ b1, b2: !!b2.data }));
  // the tabs settle: a read that finds the same cart doesn't signal the other tab again
  await wait(1500);
  const settled = service.api.gets.length;
  await wait(3000);
  const a1 = await state(a);
  check('two tabs settle: no more reads once both have the cart (no tab-to-tab loop); both keep their data', service.api.gets.length === settled && settled <= 4 && !!a1.data && !!(await state(b)).data, JSON.stringify({ settled, later: service.api.gets.length, aData: !!a1.data }));
  // b opens its mini cart; a empties the cart: b forgets it and closes its mini cart
  await openCart(b);
  await b.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 10000 });
  // eslint-disable-next-line import/no-absolute-path
  await a.evaluate((code) => import('/scripts/cart.js').then((m) => m.removeFromCart(code)), A);
  await b.waitForFunction(() => !document.querySelector('dialog.mini-cart-modal[open]'), null, { timeout: 5000 }).catch(() => {});
  const b3 = await state(b);
  check('two tabs: the cart emptied in one, the other forgets it and closes its mini cart', !b3.entry && !b3.data && !b3.badge && b3.labelA === 'Add to Cart' && !(await b.evaluate(() => !!document.querySelector('dialog.mini-cart-modal[open]'))), JSON.stringify(b3));
  await context.close();
}

// 4. the earlier version's cookie and localStorage data: moved once, then removed
{
  const service = cartService({ carts: passCart() });
  const page = await openPasses({
    service,
    init: `(() => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      document.cookie = 'cartid=CRT_KEEP; path=/';
      localStorage.setItem('ppl-cart', JSON.stringify({ cartId: 'CRT_KEEP', currency: 'USD', expires: Date.now() + 5 * 3600e3, totals: { base: 99, discounts: [], total: 99 }, lines: [{ catalogueCode: '${A}', kind: 'pass', quantity: 1, total: 99, start: '2099-01-01 10:00:00' }] }));
    })()`,
  });
  await page.waitForFunction(() => !!sessionStorage.getItem('ppl-cart'), null, { timeout: 10000 }).catch(() => {});
  const s = await state(page);
  const hours = ((s.entry?.expires || 0) - Date.now()) / 3600e3;
  check('the earlier cookie and localStorage data: the id moved (its own day kept), the count and codes, the old ones gone, the data read again', s.entry?.id === 'CRT_KEEP' && hours > 4.9 && hours < 5.1 && s.entry.count === 1 && s.entry.codes[0] === A && !s.legacy && s.data?.cartId === 'CRT_KEEP' && service.api.gets.length === 1 && s.badge === '1', JSON.stringify({ s, hours }));
  await page.close();
}

// 5. blocked storage: the cart still works in the page, no errors
{
  const service = cartService();
  const page = await openPasses({
    service,
    init: '(() => { const no = () => { throw new DOMException(\'blocked\', \'SecurityError\'); }; Storage.prototype.setItem = no; Storage.prototype.getItem = no; Storage.prototype.removeItem = no; })()',
    waitPasses: false,
    noThird: true,
  });
  await page.waitForTimeout(3000);
  const errs = page.errors.filter((e) => e.startsWith('pageerror'));
  await page.locator('.quick-buy button[data-pass-add]').first().click().catch(() => {});
  const added = await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 15000 }).then(() => true).catch(() => false);
  check('blocked storage (the site\'s own code): no page errors, and adding a pass still opens the mini cart', !errs.length && added && !page.errors.some((e) => e.startsWith('pageerror')), `${errs.join(' | ')} added=${added}`);
  await page.close();
}

// 6. no cart: no cart code and no cart request on the page
{
  const service = cartService();
  const page = await openPasses({ service });
  await page.waitForTimeout(1500);
  const loaded = await page.evaluate(() => performance.getEntriesByType('resource').some((e) => /\/scripts\/(cart|mini-cart)\.js/.test(e.name)));
  check('no cart: no cart request and no cart code loaded', !service.api.gets.length && !loaded, JSON.stringify({ gets: service.api.gets.length, loaded }));
  await page.close();
}

await browser.close();
console.log(`\n${failed} failed`);
process.exit(failed ? 1 : 0);
