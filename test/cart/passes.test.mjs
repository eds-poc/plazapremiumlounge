// Lounge passes in the cart, on the passes page (Quick Buy and Pass Finder), with routed answers:
// the passes from the passes service's real answer (fixtures/passes.json), the cart API as the stage
// service answers (POST makes a cart, PUT replaces its products, GET reads it back from
// fixtures/cart-pass.json's pass line, DELETE empties it). Usage: node passes.test.mjs [width]
import { readFileSync } from 'node:fs';
import { open, PW, UA } from '../booking-widget/harness.mjs';

const { chromium } = await import(PW);
const PASSES = JSON.parse(readFileSync(new URL('./fixtures/passes.json', import.meta.url), 'utf8'));
const PASS_CART = JSON.parse(readFileSync(new URL('./fixtures/cart-pass.json', import.meta.url), 'utf8'));
const LOUNGE_CART = JSON.parse(readFileSync(new URL('./fixtures/cart.json', import.meta.url), 'utf8'));
const WIDTHS = process.argv[2] ? [Number(process.argv[2])] : [1440, 375];
const PATH = '/en-uk/airport-lounge-passes';
const browser = await chromium.launch();
let failed = 0;
const check = (name, ok, info = '') => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info ? ` — ${info}` : ''}`); };
const json = (body, status = 200) => ({
  status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: typeof body === 'string' ? body : JSON.stringify(body),
});
const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });
// a price's catalogue code → its pass and amount
const PRICES = new Map(PASSES.items.flatMap((item) => item.prices.map((p) => [p.catalogueCode, { item, amount: p.totalPrice }])));

/**
 * The cart service: carts by id, each its currency and products ({ catalogueCode, quantity,
 * startDate }), or `lounge` (the cart.json fixture). `fail` answers a method instead.
 */
function cartService({ carts = new Map(), fail = {} } = {}) {
  const api = {
    posts: [], puts: [], gets: [], deletes: [], carts,
  };
  let made = 0;
  const read = (id) => {
    const cart = carts.get(id);
    if (cart === 'lounge') return { ...structuredClone(LOUNGE_CART), cartId: id };
    const answer = structuredClone(PASS_CART);
    answer.cartId = id;
    answer.currency = cart.currency;
    answer.products = cart.products.map((p, i) => {
      const { item, amount } = PRICES.get(p.catalogueCode);
      const line = structuredClone(PASS_CART.products[0]);
      const quantity = Number(p.quantity);
      Object.assign(line, {
        cartItemId: `CRT_ITM_${i}`, catalogueCode: p.catalogueCode, productCode: item.productCode, productDisplayName: item.productDisplayName, productName: item.productName, quantity, startDate: p.startDate,
      });
      line.itemPriceDetails.productTotalPrice.totalPrice = amount * quantity;
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
    const log = {
      POST: api.posts, PUT: api.puts, GET: api.gets, DELETE: api.deletes,
    }[method];
    log.push(body || req.url());
    await wait(method === 'GET' ? 150 : 400);
    if (fail[method]) return r.fulfill(fail[method]);
    if (method === 'POST') {
      made += 1;
      const cartId = `CRT_P${made}`;
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

/**
 * The passes page (or `path`) with routed passes and cart answers; `init` runs before the page's
 * scripts (e.g. a stored cart), `lang` serves the English page in that site folder.
 */
async function openPasses({
  width = 1440, path = PATH, service = cartService(), init, lang, tabs = browser,
} = {}) {
  const page = await open(tabs, {
    width,
    path,
    extraRoute: async (p) => {
      if (init) await p.addInitScript(init);
      await p.route(/app_demo\/GetProductPasses/, (r) => {
        const code = new URL(r.request().url()).searchParams.get('productCode');
        const items = code ? PASSES.items.filter((i) => i.productCode === code) : PASSES.items;
        return r.fulfill(json({ ...PASSES, count: items.length, items }));
      });
      await p.route(/ppg-app\/cart(\?|$)/, service.route);
      if (lang) {
        await p.route(new RegExp(`/${lang}/airport-lounge-passes(\\?.*)?$`), async (r) => {
          const resp = await r.fetch({ url: r.request().url().replace(`/${lang}/`, '/en-uk/') });
          return r.fulfill({ response: resp, body: await resp.text(), headers: { ...resp.headers(), 'content-type': 'text/html' } });
        });
      }
    },
  });
  page.api = service.api;
  await page.waitForFunction(() => document.querySelectorAll('.quick-buy button[data-pass-add]').length >= 3 && document.querySelectorAll('.pass-finder button[data-pass-add]').length >= 5, null, { timeout: 30000 });
  await page.waitForTimeout(500);
  return page;
}

// the passes' catalogue codes as the page has them (the regular rate's)
const codes = (page) => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.pass-finder button[data-pass-add]')]
  .map((b) => [b.dataset.passName, b.dataset.catalogueCode])));
const labels = (page, code) => page.evaluate((c) => [...document.querySelectorAll('button[data-pass-add]')]
  .filter((b) => b.dataset.catalogueCode === c).map((b) => b.textContent), code);
const otherLabels = (page, code) => page.evaluate((c) => [...new Set([...document.querySelectorAll('button[data-pass-add]')]
  .filter((b) => b.dataset.catalogueCode !== c).map((b) => b.textContent))], code);
const state = (page) => page.evaluate(() => ({
  badge: document.querySelector('header .header-cart-count:not([hidden])')?.textContent || null,
  open: [...document.querySelectorAll('dialog.modal[open]')].map((d) => [...d.classList].find((c) => /^((mini-)?cart-|pass-modal)/.test(c))),
  id: JSON.parse(localStorage.getItem('ppl-cart-id') || 'null')?.id || null,
  stored: JSON.parse(sessionStorage.getItem('ppl-cart') || 'null'),
  url: `${window.location.pathname}${window.location.search}`,
}));
const mini = (page) => page.evaluate(() => {
  const d = document.querySelector('dialog.mini-cart-modal[open]');
  return d && {
    lines: [...d.querySelectorAll('.mini-cart-line')].map((l) => `${l.querySelector('.mini-cart-name').textContent.trim()} | ${[...(l.querySelector('.mini-cart-quantity')?.children || [])].map((c) => c.textContent).join(' | ')}`),
    pass: [...d.querySelectorAll('.mini-cart-line')].every((l) => l.classList.contains('mini-cart-line-pass') && !l.querySelector('.mini-cart-details, .mini-cart-place')),
    total: d.querySelector('.mini-cart-total .mini-cart-amount')?.textContent,
    buttons: [...d.querySelectorAll('.mini-cart-actions button')].map((b) => b.textContent),
  };
});
const closeMini = async (page) => {
  await page.locator('dialog.mini-cart-modal[open] .modal-close').click();
  await page.waitForTimeout(300);
};
// "YYYY-MM-DD HH:mm" an hour from now in Hong Kong
const hktInAnHour = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
const minutesApart = (a, b) => Math.abs(new Date(`${a.slice(0, 16).replace(' ', 'T')}:00Z`) - new Date(`${b.replace(' ', 'T')}:00Z`)) / 60e3;
const name = (code) => PRICES.get(code).item.productDisplayName.replace(/[\u200b-\u200d\ufeff]/g, '').replace(/\s+/g, ' ').trim();
// a stored cart with a lounge (as cart.test.mjs's), known to the service as `lounge`
const storedLounge = `(() => {
  if (sessionStorage.getItem('cart-seeded')) return;
  sessionStorage.setItem('cart-seeded', '1');
  const seed = (c) => { localStorage.setItem('ppl-cart-id', JSON.stringify({ id: c.cartId, expires: c.expires, changed: Date.now(), count: c.lines.reduce((n, l) => n + (Number(l.quantity) || 1), 0), codes: c.lines.map((l) => l.catalogueCode) })); sessionStorage.setItem('ppl-cart', JSON.stringify({ ...c, fetchedAt: Date.now(), expires: Date.now() + 2 * 3600e3 })); };
  seed({
    cartId: 'CRT_LOUNGE', currency: 'HKD', expires: Date.now() + 3600e3, totals: { base: 650.36, discounts: [], total: 650.36 },
    lines: [{ catalogueCode: '${LOUNGE_CART.products[0].catalogueCode}', type: 'lounge', kind: 'lounge', name: 'Plaza Premium Lounge', product: 'Lounge Use - 5 Hours', place: '', start: '2099-11-04 15:00:00', adults: 1, children: 0, quantity: 1 }],
  });
})()`;

async function passFlow(width) {
  const page = await openPasses({ width });
  const all = await codes(page);
  const [A, B, C] = [all['Global 2-Visit Pass'], all['Global 5-Visit Pass'], all['Canada 5-Visit Pass']];
  check(`${width} the page's passes and their codes`, !!(A && B && C), JSON.stringify(all));
  let navigated = false;
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) navigated = true; });

  // 1. Quick Buy's Add to Cart (an empty cart): the loader, POST, the mini cart, Add More
  const add = page.locator(`.quick-buy button[data-pass-add][data-catalogue-code="${A}"]`);
  await add.scrollIntoViewIfNeeded();
  await add.click();
  await page.waitForSelector('#spinner-overlay', { state: 'attached', timeout: 3000 }).catch(() => {});
  const during = await page.evaluate((c) => ({ loader: !!document.getElementById('spinner-overlay'), aria: document.querySelector(`.quick-buy button[data-catalogue-code="${c}"]`).getAttribute('aria-disabled') }), A);
  await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 15000 });
  await page.waitForTimeout(400);
  const [post] = page.api.posts;
  const p0 = post?.products?.[0];
  check(`${width} Add to Cart: the loader and the button off meanwhile`, during.loader && during.aria === 'true', JSON.stringify(during));
  check(`${width} the POST: as the user's pass sample (USD, B2C, Online, quantity "1", no isThirdPartyFulfilment)`, page.api.posts.length === 1 && post.currency === 'USD' && post.channel === 'B2C' && post.pointOfPurchase === 'Online' && !('isThirdPartyFulfilment' in post) && post.products.length === 1 && p0.catalogueCode === A && p0.quantity === '1' && !('guestsCount' in p0), JSON.stringify(post));
  check(`${width} the pass's start: an hour from now in Hong Kong ("YYYY-MM-DD HH:mm:ss")`, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:00$/.test(p0?.startDate || '') && minutesApart(p0.startDate, hktInAnHour()) <= 2, `${p0?.startDate} vs ${hktInAnHour()}`);
  let m = await mini(page);
  check(`${width} the mini cart: the pass's line (its name, Quantity: 1, its price), no Edit (as live)`, JSON.stringify(m?.lines) === JSON.stringify([`${name(A)} | Quantity: 1 | USD 99.00`]) && m.pass && m.total === 'USD 99.00' && JSON.stringify(m.buttons) === '["Check Out"]', JSON.stringify(m));
  let s = await state(page);
  check(`${width} the count and the stored cart`, s.badge === '1' && s.id === 'CRT_P1' && s.stored?.lines?.[0]?.kind === 'pass', JSON.stringify({ badge: s.badge, cookie: s.id }));
  check(`${width} every button for the pass reads Add More (Quick Buy, Pass Finder), the others Add to Cart`, JSON.stringify(await labels(page, A)) === '["Add More","Add More"]' && JSON.stringify(await otherLabels(page, A)) === '["Add to Cart"]', JSON.stringify([await labels(page, A), await otherLabels(page, A)]));
  check(`${width} Add More's name for screen readers`, await page.evaluate((c) => document.querySelector(`.pass-finder button[data-catalogue-code="${c}"]`).getAttribute('aria-label'), A) === 'Add More: Global 2-Visit Pass');
  await closeMini(page);

  // 2. Add More: the same pass again (PUT, quantity 2)
  await page.locator(`.pass-finder button[data-pass-add][data-catalogue-code="${A}"]`).click();
  await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 15000 });
  await page.waitForTimeout(400);
  const [put1] = page.api.puts;
  check(`${width} Add More: PUT ?cartId with the pass's quantity "2", no POST`, page.api.posts.length === 1 && page.api.puts.length === 1 && put1.currency === 'USD' && put1.products.length === 1 && put1.products[0].catalogueCode === A && put1.products[0].quantity === '2', JSON.stringify(put1));
  m = await mini(page);
  s = await state(page);
  check(`${width} Add More: Quantity: 2, the line's price, the count 2`, JSON.stringify(m?.lines) === JSON.stringify([`${name(A)} | Quantity: 2 | USD 198.00`]) && s.badge === '2', JSON.stringify([m?.lines, s.badge]));
  await closeMini(page);

  // 3. another pass from Pass Finder (PUT with both)
  await page.locator(`.pass-finder button[data-pass-add][data-catalogue-code="${B}"]`).click();
  await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 15000 });
  await page.waitForTimeout(400);
  const put2 = page.api.puts[1];
  check(`${width} a second pass: PUT with both passes (A ×2, B ×1)`, JSON.stringify(put2?.products.map((p) => [p.catalogueCode, p.quantity])) === JSON.stringify([[A, '2'], [B, '1']]), JSON.stringify(put2));
  m = await mini(page);
  check(`${width} a second pass: two lines, the total, the count 3`, m?.lines.length === 2 && m.total === 'USD 397.00' && (await state(page)).badge === '3', JSON.stringify([m, (await state(page)).badge]));
  await closeMini(page);

  // 4. a third from its Learn more pop-up: the pop-up closes, the mini cart opens
  await page.locator(`.pass-finder button[data-catalogue-code="${C}"]`).locator('xpath=preceding-sibling::button[contains(@class, "pass-finder-learn")]').click();
  await page.waitForSelector('dialog.pass-modal[open]', { timeout: 10000 });
  check(`${width} Learn more: its button reads Add to Cart`, await page.evaluate(() => document.querySelector('dialog.pass-modal[open] .pass-modal-add').textContent) === 'Add to Cart');
  await page.locator('dialog.pass-modal[open] .pass-modal-add').click();
  await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 15000 });
  await page.waitForTimeout(400);
  s = await state(page);
  check(`${width} from Learn more: PUT with three passes, the pop-up closed, the mini cart open (as live)`, page.api.puts.length === 3 && page.api.puts[2].products.length === 3 && JSON.stringify(s.open) === '["mini-cart-modal"]' && s.badge === '4', JSON.stringify({ open: s.open, badge: s.badge }));
  check(`${width} Learn more's button follows: Add More`, await page.evaluate((c) => [...document.querySelectorAll('dialog.pass-modal .pass-modal-add')].find((b) => b.dataset.catalogueCode === c)?.textContent, C) === 'Add More');

  // 5. ⊗ on one line → Yes: PUT with the others, in place (no reload)
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-line').first().locator('.mini-cart-remove').click();
  await page.waitForSelector('dialog.cart-confirm-modal[open]');
  check(`${width} ⊗: the confirmation names the pass`, (await page.evaluate(() => document.querySelector('dialog.cart-confirm-modal[open] .cart-confirm-product').textContent)) === name(A));
  await page.locator('dialog.cart-confirm-modal[open] .cart-button', { hasText: 'Yes' }).click();
  await page.waitForSelector('#spinner-overlay', { state: 'attached', timeout: 3000 }).catch(() => {});
  const loaderOnYes = await page.evaluate(() => !!document.querySelector('dialog.mini-cart-modal[open] #spinner-overlay'));
  await page.waitForFunction(() => document.querySelectorAll('dialog.mini-cart-modal[open] .mini-cart-line').length === 2, null, { timeout: 10000 });
  await page.waitForTimeout(400);
  const put4 = page.api.puts[3];
  s = await state(page);
  const focus = await page.evaluate(() => document.activeElement?.className);
  check(`${width} Yes on one of three: the loader, PUT with the other two, no DELETE`, loaderOnYes && JSON.stringify(put4?.products.map((p) => p.catalogueCode)) === JSON.stringify([B, C]) && !page.api.deletes.length, JSON.stringify({ loaderOnYes, put4 }));
  check(`${width} in place (no reload): the mini cart shows the two left, the count 2, focus on its ⊗`, !navigated && JSON.stringify(s.open) === '["mini-cart-modal"]' && s.badge === '2' && /mini-cart-remove/.test(focus), JSON.stringify({
    navigated, open: s.open, badge: s.badge, focus,
  }));
  check(`${width} the removed pass's buttons: Add to Cart again; the others Add More`, JSON.stringify(await labels(page, A)) === '["Add to Cart","Add to Cart"]' && JSON.stringify(await labels(page, B)) === '["Add More","Add More"]', JSON.stringify([await labels(page, A), await labels(page, B)]));

  // 6. after a reload: the labels from the stored cart, before any cart request
  await page.reload({ waitUntil: 'load' });
  navigated = false;
  const gets = page.api.gets.length;
  await page.waitForFunction(() => document.querySelectorAll('.pass-finder button[data-pass-add]').length >= 5, null, { timeout: 30000 });
  check(`${width} after a reload: Add More from the stored cart, no cart request`, JSON.stringify(await labels(page, B)) === '["Add More","Add More"]' && JSON.stringify(await labels(page, C)) === '["Add More"]' && JSON.stringify(await labels(page, A)) === '["Add to Cart","Add to Cart"]' && page.api.gets.length === gets, JSON.stringify([await labels(page, B), await labels(page, C), page.api.gets.length - gets]));

  // 7. the last two: one PUT, then DELETE for the last; the mini cart closes
  await page.locator('header a.header-utility:has(.icon-cart)').first().click();
  await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 10000 });
  for (let i = 0; i < 2; i += 1) {
    await page.locator('dialog.mini-cart-modal[open] .mini-cart-remove').first().click();
    await page.waitForSelector('dialog.cart-confirm-modal[open]');
    await page.locator('dialog.cart-confirm-modal[open] .cart-button', { hasText: 'Yes' }).click();
    await page.waitForFunction(() => !document.querySelector('dialog.cart-confirm-modal[open]') && !document.getElementById('spinner-overlay'), null, { timeout: 10000 });
    await page.waitForTimeout(600);
  }
  s = await state(page);
  check(`${width} the last line: DELETE ?cartId, the mini cart closed, no count, no reload`, page.api.deletes.length === 1 && /cartId=CRT_P1$/.test(page.api.deletes[0]) && !s.open.length && !s.badge && !s.id && !s.stored && !navigated, JSON.stringify({ deletes: page.api.deletes, s }));
  check(`${width} an empty cart: every pass reads Add to Cart`, JSON.stringify(await otherLabels(page, '')) === '["Add to Cart"]', JSON.stringify(await otherLabels(page, '')));
  check(`${width} no page errors`, !page.errors.length, page.errors.join(' | '));
  await page.close();
}
for (const width of WIDTHS) await passFlow(width);

// the rules: a pass with a lounge in the cart, a lounge with passes in it → Checkout Cart
{
  const page = await openPasses({ init: storedLounge, service: cartService({ carts: new Map([['CRT_LOUNGE', 'lounge']]) }) });
  const { 'Global 2-Visit Pass': A } = await codes(page);
  await page.locator(`.quick-buy button[data-pass-add][data-catalogue-code="${A}"]`).click();
  await page.waitForSelector('dialog.cart-message-modal[open]', { timeout: 15000 });
  const text = await page.evaluate(() => document.querySelector('dialog.cart-message-modal[open]').textContent.replace(/\s+/g, ' ').trim());
  check('a pass with a lounge in the cart: the cart read first, Checkout Cart, nothing added', /Checkout Cart/.test(text) && /Please proceed to checkout before adding new item into cart\./.test(text) && page.api.gets.length >= 1 && !page.api.posts.length && !page.api.puts.length, `${text} | ${JSON.stringify(page.api)}`);
  check('the pass keeps Add to Cart', JSON.stringify(await labels(page, A)) === '["Add to Cart","Add to Cart"]');
  await page.locator('dialog.cart-message-modal[open] .cart-button', { hasText: 'View Cart' }).click();
  await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 10000 });
  const m = await mini(page);
  check('View Cart: the mini cart with the lounge (and Edit)', m?.lines.length === 1 && JSON.stringify(m.buttons) === '["Check Out","Edit"]', JSON.stringify(m));
  await page.close();
}
{
  const service = cartService();
  const page = await openPasses({ service });
  const { 'Global 2-Visit Pass': A } = await codes(page);
  await page.locator(`.quick-buy button[data-pass-add][data-catalogue-code="${A}"]`).click();
  await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 15000 });
  await closeMini(page);
  // the homepage lounge card's Book Now, as it announces it
  await page.evaluate((code) => document.body.dispatchEvent(new CustomEvent('booking-widget:book', {
    bubbles: true,
    detail: {
      catalogueCode: code, date: '2099-11-04', time: '1500', adult: '1', children: '0', currency: 'HKD', location: {},
    },
  })), LOUNGE_CART.products[0].catalogueCode);
  await page.waitForSelector('dialog.cart-message-modal[open]', { timeout: 15000 });
  const text = await page.evaluate(() => document.querySelector('dialog.cart-message-modal[open]').textContent);
  check('a lounge with a pass in the cart: Checkout Cart, nothing added', /Please proceed to checkout/.test(text) && page.api.posts.length === 1 && !page.api.puts.length, JSON.stringify({ posts: page.api.posts.length, puts: page.api.puts.length }));
  await page.close();
}

// failures: the source's pass notice; nothing changes
for (const [label, fail, before] of [
  ['the POST (500)', { POST: json('oops', 500) }, null],
  ['the POST (the service\'s error)', { POST: json({ errorCode: 'BKNG030', message: 'invalid locationCode' }) }, null],
  ['Add More\'s PUT (400)', { PUT: json({ error: { code: 'UPSTREAM_REQUEST_REJECTED' } }, 400) }, 'A'],
]) {
  const service = cartService();
  const page = await openPasses({ service });
  const { 'Global 2-Visit Pass': A } = await codes(page);
  const button = page.locator(`.quick-buy button[data-pass-add][data-catalogue-code="${A}"]`);
  if (before) {
    await button.click();
    await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 15000 });
    await closeMini(page);
  }
  await page.route(/ppg-app\/cart(\?|$)/, async (r) => {
    const m = r.request().method();
    if (fail[m]) { await wait(300); return r.fulfill(fail[m]); }
    return r.fallback();
  });
  await button.click();
  await page.waitForSelector('dialog.cart-message-modal[open]', { timeout: 15000 });
  const text = await page.evaluate(() => document.querySelector('dialog.cart-message-modal[open]').textContent.replace(/\s+/g, ' ').trim());
  const s = await state(page);
  check(`a failed add, ${label}: "Notice", "An error occurred. Please try again later." (as live), the cart as it was`, text === 'NoticeAn error occurred. Please try again later.' && (before ? s.stored?.lines?.[0]?.quantity === 1 && s.badge === '1' : !s.stored && !s.id), `${text} | ${JSON.stringify({ badge: s.badge, cookie: s.id })}`);
  check(`a failed add, ${label}: the button's label unchanged, usable again`, JSON.stringify(await labels(page, A)) === (before ? '["Add More","Add More"]' : '["Add to Cart","Add to Cart"]') && await button.isEnabled(), JSON.stringify(await labels(page, A)));
  await page.close();
}
{
  // removing one of two fails: the cart kept, the message over the mini cart
  const service = cartService();
  const page = await openPasses({ service });
  const { 'Global 2-Visit Pass': A, 'Global 5-Visit Pass': B } = await codes(page);
  for (const code of [A, B]) {
    await page.locator(`.quick-buy button[data-pass-add][data-catalogue-code="${code}"]`).click();
    await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 15000 });
    await page.waitForTimeout(300);
    if (code === A) await closeMini(page);
  }
  await page.route(/ppg-app\/cart(\?|$)/, (r) => (r.request().method() === 'PUT' ? r.fulfill(json('oops', 500)) : r.fallback()));
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-remove').first().click();
  await page.locator('dialog.cart-confirm-modal[open] .cart-button', { hasText: 'Yes' }).click();
  await page.waitForSelector('dialog.cart-message-modal[open]', { timeout: 15000 });
  const s = await state(page);
  check('removing one of two fails: "Unable to remove from cart." over the mini cart, both kept', JSON.stringify([...s.open].sort()) === '["cart-message-modal","mini-cart-modal"]' && s.stored?.lines?.length === 2 && s.badge === '2', JSON.stringify({ open: s.open, badge: s.badge }));
  await page.close();
}

// the promotional address: ?selectedPassID=
{
  const page = await openPasses({ path: `${PATH}?selectedPassID=PRD3696&utm_source=x` });
  await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 20000 });
  await page.waitForTimeout(400);
  const { 'Global 5-Visit Pass': B } = await codes(page);
  const s = await state(page);
  const m = await mini(page);
  check('?selectedPassID=PRD3696, an empty cart: added (POST with its code), the mini cart open (as live)', page.api.posts.length === 1 && page.api.posts[0].products[0].catalogueCode === B && JSON.stringify(m?.lines) === JSON.stringify([`${name(B)} | Quantity: 1 | USD 199.00`]), JSON.stringify({ posts: page.api.posts, m }));
  check('?selectedPassID: the parameter leaves the address (no reload), the others stay', s.url === `${PATH}?utm_source=x`, s.url);
  check('?selectedPassID: its buttons read Add More', JSON.stringify(await labels(page, B)) === '["Add More","Add More"]');
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelectorAll('.pass-finder button[data-pass-add]').length >= 5, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  check('?selectedPassID: a reload doesn\'t add it again', page.api.posts.length === 1 && !page.api.puts.length, JSON.stringify({ posts: page.api.posts.length, puts: page.api.puts.length }));
  await page.close();
}
{
  // passes in the cart, the same pass (any case): one more of it
  const service = cartService();
  const first = await openPasses({ service });
  const { 'Global 5-Visit Pass': B } = await codes(first);
  await first.locator(`.quick-buy button[data-pass-add][data-catalogue-code="${B}"]`).click();
  await first.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 15000 });
  const kept = await first.evaluate(() => localStorage.getItem('ppl-cart-id'));
  await first.close();
  const page = await openPasses({ service, path: `${PATH}?selectedpassid=prd3696`, init: `(() => { if (!localStorage.getItem('ppl-cart-id')) localStorage.setItem('ppl-cart-id', ${JSON.stringify(kept)}); })()` });
  await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 20000 });
  await page.waitForTimeout(400);
  const m = await mini(page);
  check('?selectedpassid=prd3696 (lower case), the pass in the cart: PUT quantity "2"', service.api.puts.length === 1 && service.api.puts[0].products[0].quantity === '2' && /Quantity: 2/.test(m?.lines[0] || ''), JSON.stringify({ puts: service.api.puts, m }));
  await page.close();
}
{
  const page = await openPasses({ path: `${PATH}?selectedPassID=PRD3696`, init: storedLounge, service: cartService({ carts: new Map([['CRT_LOUNGE', 'lounge']]) }) });
  await page.waitForSelector('dialog.cart-message-modal[open]', { timeout: 20000 });
  const s = await state(page);
  check('?selectedPassID with a lounge in the cart: Checkout Cart, nothing added (live adds it), the parameter gone', !page.api.posts.length && !page.api.puts.length && s.id === 'CRT_LOUNGE' && s.url === PATH, JSON.stringify({ posts: page.api.posts.length, puts: page.api.puts.length, s: { ...s, stored: !!s.stored } }));
  await page.close();
}
{
  const page = await openPasses({ path: `${PATH}?selectedPassID=PRD0000` });
  await page.waitForTimeout(2000);
  const s = await state(page);
  check('?selectedPassID unknown: nothing happens (as live)', !page.api.posts.length && !s.open.length && s.url === `${PATH}?selectedPassID=PRD0000`, JSON.stringify(s));
  await page.close();
}

// the currency: the passes in the visitor's currency (the address, then the session); a cart of
// passes in another currency is priced in theirs when the mini cart opens (PUT); a lounge's isn't
{
  const service = cartService();
  const asked = [];
  const page = await openPasses({ service });
  page.on('request', (r) => { if (/GetProductPasses/.test(r.url())) asked.push(new URL(r.url()).searchParams.get('currencyCode')); });
  const { 'Global 2-Visit Pass': A } = await codes(page);
  await page.locator(`.quick-buy button[data-pass-add][data-catalogue-code="${A}"]`).click();
  await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 15000 });
  await closeMini(page);
  await page.goto(`${page.url().split('?')[0]}?currencyCode=HKD`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelectorAll('.pass-finder button[data-pass-add]').length >= 5, null, { timeout: 30000 });
  check('?currencyCode=HKD: the passes asked for in HKD', asked.includes('HKD') && !asked.includes('USD'), JSON.stringify(asked));
  // the next page without it keeps the session's currency
  asked.length = 0;
  await page.goto(page.url().split('?')[0], { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelectorAll('.pass-finder button[data-pass-add]').length >= 5, null, { timeout: 30000 });
  check('the next page: still HKD (the session\'s currency)', asked.length && asked.every((c) => c === 'HKD'), JSON.stringify(asked));
  const puts = service.api.puts.length;
  await page.locator('header a.header-utility:has(.icon-cart)').first().click();
  await page.waitForSelector('#spinner-overlay', { state: 'attached', timeout: 3000 }).catch(() => {});
  const loader = await page.evaluate(() => !!document.getElementById('spinner-overlay'));
  await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 15000 });
  await page.waitForTimeout(400);
  const put = service.api.puts[puts];
  const m = await mini(page);
  check('the USD cart of passes, opened in HKD: the loader, PUT with the same passes in HKD, the mini cart in HKD', loader && service.api.puts.length === puts + 1 && put.currency === 'HKD' && put.products.length === 1 && put.products[0].catalogueCode === A && /^HKD /.test(m?.total || ''), JSON.stringify({ put, total: m?.total }));
  await closeMini(page);
  await page.locator('header a.header-utility:has(.icon-cart)').first().click();
  await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 15000 });
  await page.waitForTimeout(400);
  check('opened again in HKD: no second conversion', service.api.puts.length === puts + 1, `${service.api.puts.length - puts}`);
  await page.close();
}
{
  const service = cartService({ carts: new Map([['CRT_LOUNGE', 'lounge']]) });
  const page = await openPasses({ service, init: storedLounge, path: `${PATH}?currencyCode=USD` });
  await page.locator('header a.header-utility:has(.icon-cart)').first().click();
  await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 15000 });
  await page.waitForTimeout(400);
  check('a lounge\'s cart (HKD) on a USD page: not converted (no PUT)', !service.api.puts.length && /^HKD /.test((await mini(page))?.total || ''), JSON.stringify(service.api.puts));
  await page.close();
}

// another tab's add relabels this one
{
  // (two tabs of one browser profile: the harness opens each page in its own otherwise)
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent: UA });
  const tabs = { newPage: () => context.newPage() };
  const service = cartService();
  const page = await openPasses({ service, tabs });
  const other = await openPasses({ service, tabs });
  const { 'Global 10-Visit Pass': D } = await codes(page);
  await other.locator(`.quick-buy button[data-pass-add][data-catalogue-code="${D}"]`).click();
  await other.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 15000 });
  await page.waitForTimeout(800);
  check('another tab adds a pass: this tab\'s buttons read Add More, and its count', JSON.stringify(await labels(page, D)) === '["Add More","Add More"]' && (await state(page)).badge === '1', JSON.stringify([await labels(page, D), (await state(page)).badge]));
  await context.close();
}

// the texts in the other languages (the source's: Add More, Quantity, Notice)
for (const [lang, addToCart, addMore, quantity] of [
  ['zh-cn', '加入购物车', '新增更多', '数量:'], ['zh-hk', '加入購物車', '新增更多', '數量:'], ['ja-jp', 'カートに入れる', 'さらに追加', '数量:'], ['pt-br', 'Adicionar ao Carrinho', 'Adicionar Mais', 'Quantidade:'],
]) {
  const page = await openPasses({ path: `/${lang}/airport-lounge-passes`, lang });
  const { 'Global 2-Visit Pass': A } = await codes(page);
  check(`${lang}: Add to Cart "${addToCart}" (live's)`, (await labels(page, A)).every((l) => l === addToCart), JSON.stringify(await labels(page, A)));
  await page.locator(`.quick-buy button[data-pass-add][data-catalogue-code="${A}"]`).click();
  await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 15000 });
  await page.waitForTimeout(400);
  const m = await mini(page);
  check(`${lang}: Add More "${addMore}", the line's "${quantity} 1"`, (await labels(page, A)).every((l) => l === addMore) && m?.lines[0].includes(`${quantity} 1`), JSON.stringify([await labels(page, A), m?.lines]));
  await page.close();
}

// axe on the mini cart with passes (with AXE_CORE: axe.min.js)
if (process.env.AXE_CORE) {
  const AXE = readFileSync(process.env.AXE_CORE, 'utf8');
  for (const width of WIDTHS) {
    const page = await openPasses({ width });
    const all = await codes(page);
    for (const code of [all['Global 2-Visit Pass'], all['Global 5-Visit Pass']]) {
      await page.locator(`.quick-buy button[data-pass-add][data-catalogue-code="${code}"]`).click();
      await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 15000 });
      await page.waitForTimeout(400);
      if (code === all['Global 2-Visit Pass']) await closeMini(page);
    }
    await page.addScriptTag({ content: AXE });
    const res = await page.evaluate(async () => {
      // eslint-disable-next-line no-undef
      const r = await axe.run(document.querySelector('dialog.modal[open]'), { resultTypes: ['violations'] });
      return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
    });
    check(`axe, ${width} the mini cart with passes: no violations`, !res.length, res.join(' | '));
    const cards = await page.evaluate(async () => {
      // eslint-disable-next-line no-undef
      const r = await axe.run(document.querySelector('.quick-buy'), { resultTypes: ['violations'] });
      return r.violations.map((v) => v.id);
    });
    check(`axe, ${width} the Quick Buy cards with Add More: no violations`, !cards.length, cards.join(' | '));
    await page.close();
  }
}

await browser.close();
console.log(`\n${failed} failed`);
process.exit(failed ? 1 : 0);
