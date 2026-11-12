// The mini cart's Check Out / Edit links (from the page metadata), its promo code and the add-ons
// hook, with routed answers: a stored lounge or pass cart (fixtures/cart.json, cart-pass.json: the
// stage service's real GET answers), and the promo service as stage answers it (2026-11-12, see
// docs/cart.md): `{ code: "200", description: "Success" }`, then the cart's lines carry the code
// (`itemPriceDetails.promocode[]`) and `totalPromocodeAmount`; refusals are a 200 with BKNG048
// (no such code), BKNG043 (no line it applies to), BKNG004 (missing input), BKNG001 (no cart);
// every cart PUT takes the code off. PASS10PW applies to passes (15%), LOUNGE15 (made up here) to
// lounges (HKD 50). Usage: node mini-cart.test.mjs [width]
import { readFileSync } from 'node:fs';
import { open, PW } from '../booking-widget/harness.mjs';

const { chromium } = await import(PW);
const CART = JSON.parse(readFileSync(new URL('./fixtures/cart.json', import.meta.url), 'utf8'));
const PASS_CART = JSON.parse(readFileSync(new URL('./fixtures/cart-pass.json', import.meta.url), 'utf8'));
const WIDTHS = process.argv[2] ? [Number(process.argv[2])] : [1440, 375];
const browser = await chromium.launch();
let failed = 0;
const check = (name, ok, info = '') => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info ? ` — ${info}` : ''}`); };
const json = (body, status = 200) => ({
  status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: typeof body === 'string' ? body : JSON.stringify(body),
});
const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });
const LINE = CART.products[0];
// the stage service's refusals (2026-11-12)
const promoError = (errorCode, details, message = details) => json({ details, errorCode, message });
const NO_CODE = promoError('BKNG048', 'No record found for the provided promotional code.', 'No record found for the given promocode');
const NOT_ELIGIBLE = promoError('BKNG043', 'No item in the cart is eligible for the applied promo code.');
// the codes this emulated service knows, and the kind of line each applies to
const CODES = { PASS10PW: 'pass', LOUNGE15: 'lounge' };
const PASS_A = PASS_CART.products[0].catalogueCode;
const PASS_H = 'PRD3676-Regular-PRPRTY1235-GFTCRD-LCTN517-RTPLN3548';
const PASSES = { [PASS_A]: { name: 'Global Family Pass', price: 85 }, [PASS_H]: { name: 'Hong Kong and Shanghai 2-Visit Pass', price: 75 } };

/**
 * The stage promo service: a known code on a cart with a line it applies to is applied
 * (`state.applied` for `state.appliedTo`); `state.refuse` refuses the next request (BKNG043).
 */
function stagePromo(body, state) {
  if (!body.cartId || !body.promocode) return promoError('BKNG004', 'Missing mandatory inputs');
  if (state.refuse) {
    state.refuse = false;
    return NOT_ELIGIBLE;
  }
  const kind = CODES[body.promocode];
  if (!kind) return NO_CODE;
  if (kind !== state.kind) return NOT_ELIGIBLE;
  state.applied = body.promocode;
  state.appliedTo = body.cartId;
  return json({ code: '200', description: 'Success' });
}
const CHECKOUT = 'https://www.plazapremiumlounge.com/{lang}/guest-checkout?cart={cartId}';
const EDIT = 'https://www.plazapremiumlounge.com/{lang}/book-your-visit?date={date}&time={time}&adults={adults}&children={children}&product={catalogueCode}';

/** A stored cart (the id in localStorage, the tab's data in sessionStorage), once per tab. */
const stored = (kind = 'lounge', children = 0) => `(() => {
  if (sessionStorage.getItem('cart-seeded')) return;
  sessionStorage.setItem('cart-seeded', '1');
  const cart = ${JSON.stringify({
    cartId: 'CRT_MC',
    currency: 'HKD',
    totals: {
      base: 875, discounts: [{ name: '10% Online Discount [Lounge Booking]', value: 87.5 }], promo: 0, total: 787.5,
    },
    promoCode: '',
  })};
  cart.expires = Date.now() + 2 * 3600e3;
  cart.fetchedAt = Date.now();
  cart.lines = ${JSON.stringify([{
    catalogueCode: LINE.catalogueCode, productCode: 'PRD3341', type: 'lounge', kind: 'lounge', name: 'Plaza Premium Lounge', product: 'Lounge Use - 5 Hours', place: 'Near Gate 1, Departures, Hong Kong International Airport', start: LINE.startDate, adults: 1, children: 0, quantity: 1, total: 787.5,
  }])};
  cart.lines[0].children = ${children};
  if ('${kind}' === 'pass') {
    cart.currency = 'USD';
    cart.lines = [{ catalogueCode: '${PASS_CART.products[0].catalogueCode}', type: 'gftcrd', kind: 'pass', name: 'Global Family Pass', product: 'Global Family Pass', place: '', start: '2099-01-01 10:00:00', adults: 0, children: 0, quantity: 1, total: 85 }];
    cart.totals = { base: 85, discounts: [], promo: 0, total: 85 };
  }
  sessionStorage.setItem('ppl-cart', JSON.stringify(cart));
  localStorage.setItem('ppl-cart-id', JSON.stringify({ id: cart.cartId, expires: Date.now() + 20 * 3600e3, changed: Date.now(), count: 1, codes: cart.lines.map((l) => l.catalogueCode) }));
})()`;

/**
 * The homepage (or `path`) with a stored cart, the cart GET from the fixture (with a promo when
 * one is applied), and the promo call answered by `promo(body, state)`; `meta` adds metadata.
 */
async function openWithCart({
  width = 1440, path = '/en-uk/', promo = stagePromo, meta = {}, kind = 'lounge', children = 0,
} = {}) {
  const api = {
    promos: [], gets: 0, posts: [], deletes: [], puts: [],
  };
  // the promo is applied to one cart (its id); a new cart (POST) is CRT_MC2, CRT_MC3…; a pass
  // cart's passes and currency follow its PUTs
  const state = {
    applied: '', appliedTo: '', made: 1, kind, passes: [{ catalogueCode: PASS_A, quantity: 1 }], currency: kind === 'pass' ? 'USD' : 'HKD',
  };
  const page = await open(browser, {
    width,
    path,
    extraRoute: async (p) => {
      await p.addInitScript(stored(kind, children));
      if (Object.keys(meta).length) {
        await p.route(new RegExp(`localhost:\\d+${path.replace(/\//g, '\\/')}(\\?.*)?$`), async (r) => {
          const resp = await r.fetch();
          const tags = Object.entries(meta).map(([k, v]) => `<meta name="${k}" content="${v.replace(/&/g, '&amp;')}">`).join('');
          // (instead of the page's own, e.g. the sheet's cart-checkout-url)
          let body = await resp.text();
          Object.keys(meta).forEach((k) => { body = body.replace(new RegExp(`<meta name="${k}"[^>]*>`, 'g'), ''); });
          body = body.replace('</head>', `${tags}</head>`);
          return r.fulfill({ response: resp, body, headers: { ...resp.headers(), 'content-type': 'text/html' } });
        });
      }
      await p.route(/ppg-app\/getGeoLocation/, async (r) => {
        try {
          const resp = await r.fetch();
          const body = await resp.json();
          body.defaultOption = null;
          await r.fulfill({ response: resp, body: JSON.stringify(body) });
        } catch { /* (closed) */ }
      });
      await p.route(/ppg-app\/cart-validate-promocode/, async (r) => {
        if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
        const body = JSON.parse(r.request().postData() || '{}');
        api.promos.push({ method: r.request().method(), body });
        await wait(300);
        const answer = await promo(body, state);
        return answer === 'abort' ? r.abort() : r.fulfill(answer);
      });
      await p.route(/ppg-app\/cart(\?|$)/, async (r) => {
        if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
        const method = r.request().method();
        const id = new URL(r.request().url()).searchParams.get('cartId');
        if (method === 'DELETE') {
          api.deletes.push(id);
          await wait(300);
          return r.fulfill(json({ code: '200', description: 'Success' }));
        }
        if (method === 'POST') {
          state.made += 1;
          const body = JSON.parse(r.request().postData() || '{}');
          api.posts.push(body);
          if (state.kind === 'pass') state.passes = body.products.map((x) => ({ catalogueCode: x.catalogueCode, quantity: Number(x.quantity) }));
          await wait(300);
          return r.fulfill(json({ cartId: `CRT_MC${state.made}` }));
        }
        if (method === 'PUT') {
          // the cart's products replaced: the code comes off (as stage)
          const body = JSON.parse(r.request().postData() || '{}');
          api.puts.push(body);
          if (state.kind === 'pass') state.passes = body.products.map((x) => ({ catalogueCode: x.catalogueCode, quantity: Number(x.quantity) }));
          state.currency = body.currency || state.currency;
          if (state.appliedTo === id) state.applied = '';
          await wait(300);
          return r.fulfill(json({ cartId: id }));
        }
        api.gets += 1;
        const cart = structuredClone(state.kind === 'pass' ? PASS_CART : CART);
        cart.cartId = id || 'CRT_MC';
        if (state.kind === 'lounge' && children) cart.products[0].guestsCount = { ...cart.products[0].guestsCount, child: String(children) };
        const applied = state.applied && state.appliedTo === cart.cartId ? state.applied : '';
        const promoOn = (product, value) => {
          const t = product.itemPriceDetails.productTotalPrice;
          t.totalPromocodeAmount = value;
          t.totalPrice = Math.round((t.totalPrice - value) * 100) / 100;
          product.itemPriceDetails.promocode = [{
            code: applied, name: 'promo code', promocodeDisplayName: applied === 'PASS10PW' ? 'Pass 15% off' : 'HKD 50 off', type: 'Percentage', value,
          }];
        };
        if (state.kind === 'pass') {
          cart.currency = state.currency;
          cart.products = state.passes.map((x) => {
            const product = structuredClone(PASS_CART.products[0]);
            const amount = PASSES[x.catalogueCode].price * x.quantity;
            Object.assign(product, { catalogueCode: x.catalogueCode, productDisplayName: PASSES[x.catalogueCode].name, quantity: x.quantity });
            Object.assign(product.itemPriceDetails.productTotalPrice, { totalBasePrice: amount, totalPrice: amount });
            if (applied) promoOn(product, Math.round(amount * 15) / 100);
            return product;
          });
          const sum = (f) => cart.products.reduce((n, x) => n + (x.itemPriceDetails.productTotalPrice[f] || 0), 0);
          Object.assign(cart.cartTotalPrice, { totalBasePrice: sum('totalBasePrice'), totalPromocodeAmount: Math.round(sum('totalPromocodeAmount') * 100) / 100, totalPrice: Math.round(sum('totalPrice') * 100) / 100 });
        } else if (applied) {
          promoOn(cart.products[0], 50);
          cart.cartTotalPrice.totalPromocodeAmount = 50;
          cart.cartTotalPrice.totalPrice -= 50;
        }
        return r.fulfill(json(cart));
      });
      // the checkout and edit pages: a stub, not the source's site
      await p.route(/www\.plazapremiumlounge\.com\/.*(guest-checkout|book-your-visit)/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>stub</title>' }));
    },
  });
  page.api = api;
  page.state = state;
  return page;
}
const openCart = async (page) => {
  await page.locator('header a.header-utility:has(.icon-cart)').first().click();
  await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 10000 });
  await page.waitForTimeout(500);
};
const mini = (page) => page.evaluate(() => {
  const d = document.querySelector('dialog.mini-cart-modal[open]');
  const input = d?.querySelector('.mini-cart-promo-input');
  const msg = d?.querySelector('.mini-cart-promo-message');
  return d && {
    actions: [...d.querySelectorAll('.mini-cart-actions > *')].map((n) => ({ tag: n.tagName, text: n.textContent, href: n.getAttribute('href') })),
    hint: d.querySelector('.mini-cart-hint')?.textContent || null,
    label: d.querySelector('.mini-cart-promo-label')?.textContent,
    labelFor: d.querySelector('.mini-cart-promo-label')?.htmlFor === input?.id,
    placeholder: input?.placeholder,
    value: input?.value,
    readOnly: input?.readOnly,
    invalid: input?.getAttribute('aria-invalid'),
    action: d.querySelector('.mini-cart-promo-apply, .mini-cart-promo-remove')?.className,
    actionLabel: d.querySelector('.mini-cart-promo-apply, .mini-cart-promo-remove')?.getAttribute('aria-label'),
    message: msg?.textContent || '',
    error: !!msg?.classList.contains('is-error'),
    msgShown: !!msg && getComputedStyle(msg).display !== 'none',
    rows: [...d.querySelectorAll('.mini-cart-row')].map((r) => r.textContent.replace(/\s+/g, ' ').trim()),
    more: !!d.querySelector('.mini-cart-more'),
    addons: d.querySelector('.mini-cart-addons')?.textContent.replace(/\s+/g, ' ').trim() || null,
    order: [...d.querySelectorAll('.mini-cart-totals > *')].map((n) => n.className.split(' ').pop()),
    focus: document.activeElement?.className,
  };
});
const watchNav = (page) => {
  const nav = { count: 0, urls: [] };
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) { nav.count += 1; nav.urls.push(f.url()); } });
  return nav;
};

// Check Out and Edit from the metadata
for (const width of WIDTHS) {
  const page = await openWithCart({ width, meta: { 'cart-checkout-url': CHECKOUT, 'cart-edit-url': EDIT } });
  await openCart(page);
  const m = await mini(page);
  const [checkout, edit] = m.actions;
  check(`${width} Check Out: a link to the metadata's page, {lang} and {cartId} filled`, checkout?.tag === 'A' && checkout.text === 'Check Out' && checkout.href === 'https://www.plazapremiumlounge.com/en-uk/guest-checkout?cart=CRT_MC', JSON.stringify(checkout));
  check(`${width} Edit: a link with the lounge's date, time, guests and product`, edit?.tag === 'A' && edit.text === 'Edit' && edit.href === `https://www.plazapremiumlounge.com/en-uk/book-your-visit?date=2026-11-28&time=1500&adults=1&children=0&product=${encodeURIComponent(LINE.catalogueCode)}`, JSON.stringify(edit));
  check(`${width} no author hint when both are set`, !m.hint);
  const looks = await page.evaluate(() => [...document.querySelectorAll('dialog.mini-cart-modal[open] .mini-cart-actions > a')].map((a) => { const s = getComputedStyle(a); return [s.backgroundColor, s.color, s.textDecorationLine, s.display]; }));
  check(`${width} the links look like the buttons (filled maroon; outlined)`, JSON.stringify(looks) === JSON.stringify([['rgb(104, 18, 53)', 'rgb(255, 255, 255)', 'none', 'flex'], ['rgb(255, 255, 255)', 'rgb(83, 14, 42)', 'none', 'flex']]), JSON.stringify(looks));
  const announced = page.evaluate(() => new Promise((resolve) => { document.addEventListener('cart:checkout', (e) => resolve(e.detail?.cart?.cartId), { once: true }); }));
  await Promise.all([page.waitForURL(/guest-checkout/, { timeout: 15000 }), page.locator('dialog.mini-cart-modal[open] .mini-cart-actions a', { hasText: 'Check Out' }).click()]);
  check(`${width} Check Out: announced (cart:checkout), then the page`, await announced === 'CRT_MC' && /guest-checkout\?cart=CRT_MC$/.test(page.url()), page.url());
  await page.close();
}
{
  // a pass cart without metadata: Check Out to this site's checkout page (no Edit for passes, no
  // hint)
  const page = await openWithCart({ kind: 'pass' });
  await page.route(/\/en-uk\/guest-checkout$/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>checkout</title>' }));
  await openCart(page);
  const m = await mini(page);
  check('no metadata: Check Out a link to this site\'s /en-uk/guest-checkout (no Edit for passes), no hint', m.actions.length === 1 && m.actions[0].tag === 'A' && new URL(m.actions[0].href, 'http://x').pathname === '/en-uk/guest-checkout' && m.actions[0].href.startsWith(await page.evaluate(() => window.location.origin)) && !m.hint, JSON.stringify(m.actions) + m.hint);
  const announced = page.evaluate(() => new Promise((resolve) => { document.addEventListener('cart:checkout', () => resolve(true), { once: true }); }));
  await Promise.all([page.waitForURL(/\/en-uk\/guest-checkout$/, { timeout: 15000 }), page.locator('dialog.mini-cart-modal[open] .mini-cart-actions a', { hasText: 'Check Out' }).click()]);
  check('no metadata: Check Out announced, then this site\'s checkout page', await announced && /\/en-uk\/guest-checkout$/.test(page.url()), page.url());
  await page.close();
}
{
  // a lounge cart without metadata: Check Out to this site's checkout; Edit a button, the hint
  // names its row only; zh-cn's Check Out in its own folder
  const page = await openWithCart({ path: '/zh-cn/' });
  await openCart(page);
  const m = await mini(page);
  check('no metadata, a lounge (zh-cn): Check Out to /zh-cn/guest-checkout, Edit a button, the hint names cart-edit-url only', m.actions[0]?.tag === 'A' && new URL(m.actions[0].href).pathname === '/zh-cn/guest-checkout' && m.actions[1]?.tag === 'BUTTON' && /cart-edit-url/.test(m.hint || '') && !/cart-checkout-url/.test(m.hint || ''), JSON.stringify(m.actions) + m.hint);
  await page.close();
}
{
  const page = await openWithCart({ path: '/zh-cn/', meta: { 'cart-checkout-url': CHECKOUT, 'cart-edit-url': '/{lang}/edit?d={date}' } });
  await openCart(page);
  const m = await mini(page);
  check('zh-cn: {lang} is zh-cn; a path is made absolute; the texts (结账, 编辑)', m.actions[0]?.href === 'https://www.plazapremiumlounge.com/zh-cn/guest-checkout?cart=CRT_MC' && /^http:\/\/localhost:\d+\/zh-cn\/edit\?d=2026-11-28$/.test(m.actions[1]?.href || '') && m.actions[0].text === '结账' && m.actions[1].text === '编辑', JSON.stringify(m.actions));
  check('zh-cn: the promo texts (促销代码, 输入代码)', m.label === '促销代码' && m.placeholder === '输入代码', `${m.label} ${m.placeholder}`);
  await page.close();
}
{
  const page = await openWithCart({ meta: { 'cart-checkout-url': ['javascript', 'alert(1)'].join(':') } });
  await openCart(page);
  const m = await mini(page);
  check('a metadata value that isn\'t a web address: not a link (a button, the hint)', m.actions[0]?.tag === 'BUTTON' && /cart-checkout-url/.test(m.hint || ''), JSON.stringify(m.actions));
  check('…and not the default either (an author\'s value wins, even a wrong one)', !m.actions.some((a) => /guest-checkout/.test(a.href || '')), JSON.stringify(m.actions));
  await page.close();
}

// the promo code
for (const width of WIDTHS) {
  const page = await openWithCart({ width });
  const nav = watchNav(page);
  await openCart(page);
  let m = await mini(page);
  check(`${width} promo: the source's field (Promo Code, Enter Code, the apply button), between the discounts and the total`, m.label === 'Promo Code' && m.labelFor && m.placeholder === 'Enter Code' && /mini-cart-promo-apply/.test(m.action) && m.actionLabel === 'Apply promo code' && !m.msgShown && JSON.stringify(m.order) === '["mini-cart-service-total","mini-cart-discount","mini-cart-promo","mini-cart-total"]', JSON.stringify(m));
  // empty: the message, no request
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-apply').click();
  m = await mini(page);
  check(`${width} promo empty: "Please enter promo code." in red, no request`, m.message === 'Please enter promo code.' && m.error && m.msgShown && m.invalid === 'true' && !page.api.promos.length, JSON.stringify({ message: m.message, error: m.error, promos: page.api.promos.length }));
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-input').type('S');
  m = await mini(page);
  check(`${width} promo: typing clears the message`, !m.msgShown && !m.invalid, m.message);
  // invalid (stage's answer today), by Enter
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-input').fill('SAVE10');
  const { gets } = page.api;
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-input').press('Enter');
  await page.waitForTimeout(150);
  const during = await page.evaluate(() => { const b = document.querySelector('dialog.mini-cart-modal[open] .mini-cart-promo-apply'); return { disabled: b?.disabled, busy: b?.getAttribute('aria-busy') }; });
  await page.waitForFunction(() => document.querySelector('dialog.mini-cart-modal[open] .mini-cart-promo-message')?.textContent, null, { timeout: 10000 });
  m = await mini(page);
  check(`${width} promo by Enter: PUT {cartId, promocode} (the API's shape), the button busy meanwhile`, page.api.promos.length === 1 && page.api.promos[0].method === 'PUT' && JSON.stringify(page.api.promos[0].body) === '{"cartId":"CRT_MC","promocode":"SAVE10"}' && during.disabled && during.busy === 'true', JSON.stringify({ promos: page.api.promos, during }));
  check(`${width} promo refused (BKNG048): "No record found for the provided promotional code.", the code kept, focus back, the cart read again and unchanged, no reload`, m.message === 'No record found for the provided promotional code.' && m.error && m.value === 'SAVE10' && !m.readOnly && /mini-cart-promo-input/.test(m.focus || '') && m.rows.at(-1).endsWith('HKD 787.50') && page.api.gets === gets + 1 && nav.count === 0, JSON.stringify({ ...m, gets: page.api.gets - gets, nav: nav.count }));
  await page.close();
}
for (const [label, promo, message, code = 'SAVE10'] of [
  ['"Success" but the cart names no code', () => json({ code: '200', description: 'Success' }), 'No record found for the provided promotional code.'],
  ['a pass code on a lounge (BKNG043)', stagePromo, 'No item in the cart is eligible for the applied promo code.', 'PASS10PW'],
  ['the service\'s other error (200 with errorCode)', () => promoError('BKNG999', 'Something else'), 'No record found for the provided promotional code.'],
  ['the network', () => 'abort', 'Error'],
  ['a 500', () => json('oops', 500), 'Error'],
]) {
  const page = await openWithCart({ promo });
  await openCart(page);
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-input').fill(code);
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-apply').click();
  await page.waitForFunction(() => document.querySelector('dialog.mini-cart-modal[open] .mini-cart-promo-message')?.textContent, null, { timeout: 10000 });
  const m = await mini(page);
  check(`promo, ${label}: "${message}", no promo row`, m.message === message && m.error && !m.rows.some((r) => /Promo Code/.test(r)), JSON.stringify({ message: m.message, rows: m.rows }));
  await page.close();
}
{
  // applied (the lounge's line then carries the code), then taken off
  const page = await openWithCart();
  const nav = watchNav(page);
  await openCart(page);
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-input').fill('LOUNGE15');
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-apply').click();
  await page.waitForSelector('dialog.mini-cart-modal[open] .mini-cart-promo-remove', { timeout: 10000 });
  await page.waitForTimeout(300);
  let m = await mini(page);
  const storedPromo = await page.evaluate(() => JSON.parse(sessionStorage.getItem('ppl-cart')).promoCode);
  check('lounge promo applied: PUT {cartId, promocode}, the GET\'s promo amount as a row, the total from the GET, the code read only with its remove button, kept in the summary', JSON.stringify(page.api.promos[0]?.body) === '{"cartId":"CRT_MC","promocode":"LOUNGE15"}' && m.rows.some((r) => r === 'Promo Code (LOUNGE15):- HKD 50.00') && m.rows.at(-1).endsWith('HKD 737.50') && m.value === 'LOUNGE15' && m.readOnly && /mini-cart-promo-remove/.test(m.action) && m.actionLabel === 'Remove promo code' && !m.msgShown && storedPromo === 'LOUNGE15' && nav.count === 0, JSON.stringify({
    rows: m.rows, value: m.value, action: m.action, storedPromo,
  }));
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-remove').click();
  await page.waitForSelector('dialog.cart-confirm-modal[open]');
  const confirmText = await page.evaluate(() => [...document.querySelectorAll('dialog.cart-confirm-modal[open]')].pop().textContent.replace(/\s+/g, ' ').trim());
  const open1 = await page.evaluate(() => [...document.querySelectorAll('dialog.modal[open]')].map((d) => [...d.classList].find((c) => /cart-/.test(c))));
  check('remove: the source\'s confirmation over the mini cart', /Confirmation/.test(confirmText) && /Are you sure\. Do you want to Delete Promo Code\?/.test(confirmText) && /Cancel/.test(confirmText) && /Confirm/.test(confirmText) && JSON.stringify(open1) === '["mini-cart-modal","cart-confirm-modal"]', `${confirmText} | ${JSON.stringify(open1)}`);
  await page.locator('dialog.cart-confirm-modal[open] .cart-button', { hasText: 'Cancel' }).click();
  await page.waitForTimeout(300);
  check('remove, Cancel: the code stays, no request', page.api.promos.length === 1 && (await mini(page)).readOnly);
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-remove').click();
  await page.waitForSelector('dialog.cart-confirm-modal[open]');
  await page.locator('dialog.cart-confirm-modal[open] .cart-button', { hasText: 'Confirm' }).click();
  await page.waitForSelector('dialog.mini-cart-modal[open] .mini-cart-promo-apply', { timeout: 10000 });
  await page.waitForTimeout(300);
  m = await mini(page);
  const put = page.api.puts[0];
  const sameLounge = put && put.currency === 'HKD' && put.isThirdPartyFulfilment === false && JSON.stringify(put.products) === JSON.stringify([{
    catalogueCode: LINE.catalogueCode, startDate: LINE.startDate, quantity: 1, guestsCount: { adult: '1', child: '0' },
  }]);
  check('remove, Confirm: the cart\'s own lounge sent again (PUT, which takes a code off; no promo call), the row gone, the field empty and editable, no reload', sameLounge && page.api.promos.length === 1 && !m.rows.some((r) => /Promo Code/.test(r)) && m.rows.at(-1).endsWith('HKD 787.50') && m.value === '' && !m.readOnly && nav.count === 0, JSON.stringify({
    put, promos: page.api.promos.length, rows: m.rows, value: m.value,
  }));
  await page.close();
}

// a promo code belongs to its cart: after the lounge is removed, the next lounge's cart starts
// afresh (no typed code, no message, no promo row or discount)
const removeLine = async (page) => {
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-remove').click();
  await page.waitForSelector('dialog.cart-confirm-modal[open]');
  await page.locator('dialog.cart-confirm-modal[open] .cart-button', { hasText: 'Yes' }).click();
  await page.waitForFunction(() => !document.querySelector('dialog.mini-cart-modal[open]') && !document.getElementById('spinner-overlay'), null, { timeout: 10000 });
  await page.waitForTimeout(300);
};
// another lounge, as the homepage card announces it
const bookAnother = async (page) => {
  await page.evaluate((code) => document.body.dispatchEvent(new CustomEvent('booking-widget:book', {
    bubbles: true,
    detail: {
      catalogueCode: code, date: '2099-11-28', time: '1500', adult: '1', children: '0', currency: 'HKD', propertyName: 'Plaza Premium Lounge', productName: 'Lounge Use - 3 Hours', price: 500, location: {},
    },
  })), LINE.catalogueCode);
  await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 15000 });
  await page.waitForTimeout(500);
};
const stateOf = (page) => page.evaluate(() => ({ id: JSON.parse(localStorage.getItem('ppl-cart-id') || 'null')?.id || null, stored: JSON.parse(sessionStorage.getItem('ppl-cart') || 'null') }));
const hasPromoRow = (m) => m.rows.some((r) => r.startsWith('Promo Code'));
for (const [label, promo, applied] of [
  ['a refused code typed', stagePromo, false],
  ['an applied code', stagePromo, true],
]) {
  const page = await openWithCart({ promo });
  await openCart(page);
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-input').fill(applied ? 'LOUNGE15' : 'SAVE10');
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-apply').click();
  if (applied) await page.waitForSelector('dialog.mini-cart-modal[open] .mini-cart-promo-remove', { timeout: 10000 });
  else await page.waitForFunction(() => document.querySelector('dialog.mini-cart-modal[open] .mini-cart-promo-message')?.textContent, null, { timeout: 10000 });
  await page.waitForTimeout(300);
  const before = await mini(page);
  await removeLine(page);
  const gone = await stateOf(page);
  await bookAnother(page);
  const m = await mini(page);
  const now = await stateOf(page);
  check(`${label}, then the lounge removed: the cart forgotten (DELETE)`, (applied ? before.readOnly : before.error) && page.api.deletes.length === 1 && !gone.id && !gone.stored, JSON.stringify({ before: { value: before.value, readOnly: before.readOnly }, deletes: page.api.deletes, gone }));
  check(`${label}, then another lounge: a new cart, the promo field empty and editable, no message, no promo row, no promo in the summary`, now.id === 'CRT_MC2' && m.value === '' && !m.readOnly && /mini-cart-promo-apply/.test(m.action) && !m.msgShown && !m.invalid && !hasPromoRow(m) && !now.stored?.promoCode && !(now.stored?.totals?.promo > 0) && page.api.promos.length === 1, JSON.stringify({
    id: now.id, value: m.value, readOnly: m.readOnly, message: m.message, rows: m.rows, promoCode: now.stored?.promoCode, promo: now.stored?.totals?.promo, promos: page.api.promos.length,
  }));
  await page.close();
}
{
  // the lounge removed while a code is being applied: the removed cart doesn't come back with it
  const page = await openWithCart({ promo: async (body, state) => { await wait(2500); return stagePromo(body, state); } });
  await openCart(page);
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-input').fill('LOUNGE15');
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-apply').click();
  await page.waitForTimeout(200);
  await removeLine(page);
  await page.waitForTimeout(3500);
  const s = await stateOf(page);
  const open1 = await page.evaluate(() => !!document.querySelector('dialog.mini-cart-modal[open]'));
  check('the lounge removed while a code is applied: the cart stays gone (no cookie, no summary), the mini cart closed', !s.id && !s.stored && !open1, JSON.stringify({ s, open: open1 }));
  await bookAnother(page);
  const m = await mini(page);
  check('…then another lounge: the field empty, no promo row', m.value === '' && !m.readOnly && !hasPromoRow(m), JSON.stringify({ value: m.value, rows: m.rows }));
  await page.close();
}
{
  // the same cart keeps what was typed while it redraws (a refresh, another tab's change)
  const page = await openWithCart();
  await openCart(page);
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-input').fill('KEEPME');
  await page.evaluate(async () => {
    // eslint-disable-next-line import/no-absolute-path
    const { saveCart, getCart } = await import('/scripts/cart-state.js');
    saveCart({ ...getCart() });
  });
  await page.waitForTimeout(300);
  check('the same cart redrawn: what was typed stays', (await mini(page)).value === 'KEEPME');
  await page.close();
}

// passes: PASS10PW on each pass (15%), kept through the cart's changes (every PUT takes it off:
// the code is sent again), several passes, a refused re-apply, removal
const applyCode = async (page, code) => {
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-input').fill(code);
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-apply').click();
  await page.waitForFunction(() => document.querySelector('dialog.mini-cart-modal[open] .mini-cart-promo-remove, dialog.mini-cart-modal[open] .mini-cart-promo-message:not(:empty)'), null, { timeout: 10000 });
  await page.waitForTimeout(300);
};
// a cart change from the site's own code (Add More, another pass, one taken out, another currency)
const cartCall = (page, name, ...args) => page.evaluate(async ([fn, a]) => {
  // eslint-disable-next-line import/no-unresolved, import/no-absolute-path
  const cart = await import('/scripts/cart.js');
  const result = await cart[fn](...a);
  await new Promise((r) => { setTimeout(r, 400); });
  return result?.status;
}, [name, args]);
const passItem = (code) => ({
  type: 'pass', catalogueCode: code, currency: 'USD', name: PASSES[code].name, productCode: code.slice(0, 7), price: PASSES[code].price,
});
{
  const page = await openWithCart({ kind: 'pass' });
  const nav = watchNav(page);
  await openCart(page);
  await applyCode(page, 'pass10pw');
  let m = await mini(page);
  check('pass: a code in lower case is refused (codes are case sensitive): BKNG048\'s message', m.message === 'No record found for the provided promotional code.' && !m.readOnly, m.message);
  await applyCode(page, 'PASS10PW');
  m = await mini(page);
  let s = await stateOf(page);
  check('pass: PASS10PW applied: Service Total, the promo row, the total; read only; kept in the summary with each line\'s code', m.rows.join(' | ') === 'Service TotalUSD 85.00 | Promo Code (PASS10PW):- USD 12.75 | Total(Includes applicable taxes and fees)USD 72.25' && m.readOnly && m.value === 'PASS10PW' && s.stored?.promoCode === 'PASS10PW' && s.stored?.totals?.promo === 12.75 && s.stored?.lines?.[0]?.promo?.name === 'Pass 15% off', JSON.stringify({ rows: m.rows, promo: s.stored?.totals?.promo, line: s.stored?.lines?.[0]?.promo }));
  const lineAmount = await page.evaluate(() => document.querySelector('dialog.mini-cart-modal[open] .mini-cart-line-amount')?.textContent);
  check('pass: the line\'s price after the code', lineAmount === 'USD 72.25', lineAmount);
  // Add More (the same pass): PUT, then the code again
  let promos = page.api.promos.length;
  await cartCall(page, 'addToCart', passItem(PASS_A));
  m = await mini(page);
  check('pass, Add More: PUT x2, the code sent again, still applied (USD 170.00 - 25.50)', page.api.puts.at(-1)?.products?.[0]?.quantity === '2' && page.api.promos.length === promos + 1 && page.api.promos.at(-1).body.promocode === 'PASS10PW' && m.rows.join(' | ') === 'Service TotalUSD 170.00 | Promo Code (PASS10PW):- USD 25.50 | Total(Includes applicable taxes and fees)USD 144.50' && m.readOnly, JSON.stringify({ puts: page.api.puts.length, promos: page.api.promos.length - promos, rows: m.rows }));
  // another pass: both passes carry the code
  promos = page.api.promos.length;
  await cartCall(page, 'addToCart', passItem(PASS_H));
  m = await mini(page);
  s = await stateOf(page);
  check('several passes: the code again after the PUT, each line with its own discount, the cart total', page.api.promos.length === promos + 1 && s.stored?.lines?.length === 2 && s.stored.lines.every((l) => l.promo?.code === 'PASS10PW') && m.rows.join(' | ') === 'Service TotalUSD 245.00 | Promo Code (PASS10PW):- USD 36.75 | Total(Includes applicable taxes and fees)USD 208.25', JSON.stringify({ rows: m.rows, lines: s.stored?.lines?.map((l) => l.promo) }));
  // one pass taken out
  promos = page.api.promos.length;
  await cartCall(page, 'removeFromCart', PASS_H);
  m = await mini(page);
  check('several passes, one taken out: PUT with the rest, the code again, the total', page.api.promos.length === promos + 1 && m.rows.join(' | ') === 'Service TotalUSD 170.00 | Promo Code (PASS10PW):- USD 25.50 | Total(Includes applicable taxes and fees)USD 144.50', JSON.stringify(m.rows));
  // another currency
  promos = page.api.promos.length;
  await cartCall(page, 'convertCart', 'HKD');
  m = await mini(page);
  check('passes in another currency: PUT in HKD, the code again, still applied', page.api.puts.at(-1)?.currency === 'HKD' && page.api.promos.length === promos + 1 && m.readOnly && m.rows.some((r) => r.startsWith('Promo Code (PASS10PW):- HKD')), JSON.stringify(m.rows));
  // a change after which the code is refused (e.g. no pass it applies to): dropped, with why
  page.state.refuse = true;
  await cartCall(page, 'addToCart', { ...passItem(PASS_H), currency: 'HKD' });
  m = await mini(page);
  s = await stateOf(page);
  check('the code refused after a change: no promo row, the field holds the code again with BKNG043\'s message, nothing kept', !m.rows.some((r) => r.startsWith('Promo Code')) && !m.readOnly && m.value === 'PASS10PW' && m.message === 'No item in the cart is eligible for the applied promo code.' && m.error && !s.stored?.promoCode && !(s.stored?.totals?.promo > 0), JSON.stringify({
    rows: m.rows, value: m.value, message: m.message, stored: s.stored?.promoCode,
  }));
  // applied again, then removed: the passes sent again (no promo call)
  await applyCode(page, 'PASS10PW');
  promos = page.api.promos.length;
  const puts = page.api.puts.length;
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-remove').click();
  await page.waitForSelector('dialog.cart-confirm-modal[open]');
  await page.locator('dialog.cart-confirm-modal[open] .cart-button', { hasText: 'Confirm' }).click();
  await page.waitForSelector('dialog.mini-cart-modal[open] .mini-cart-promo-apply', { timeout: 10000 });
  await page.waitForTimeout(300);
  m = await mini(page);
  s = await stateOf(page);
  check('passes, the code removed: the passes sent again (PUT), no promo call, no promo row or discount kept, no reload', page.api.puts.length === puts + 1 && page.api.promos.length === promos && page.api.puts.at(-1).products.length === 2 && !m.rows.some((r) => r.startsWith('Promo Code')) && !s.stored?.promoCode && !(s.stored?.totals?.promo > 0) && nav.count === 0, JSON.stringify({ rows: m.rows, stored: s.stored?.promoCode }));
  await page.close();
}
{
  // a code on passes, the passes all taken out, a new pass cart: nothing of the code
  const page = await openWithCart({ kind: 'pass' });
  await openCart(page);
  await applyCode(page, 'PASS10PW');
  await removeLine(page);
  const gone = await stateOf(page);
  await cartCall(page, 'addToCart', passItem(PASS_A));
  const s = await stateOf(page);
  check('passes with a code all taken out, then a new pass cart: the cart forgotten, the new one without the code', page.api.deletes.length === 1 && !gone.stored && s.id === 'CRT_MC2' && !s.stored?.promoCode && !(s.stored?.totals?.promo > 0), JSON.stringify({ gone, s: { id: s.id, promo: s.stored?.promoCode } }));
  await page.close();
}
{
  // the cart the service no longer has (BKNG001): forgotten, the mini cart closed
  const page = await openWithCart({ promo: () => promoError('BKNG001', 'Record not found', 'Cart not found') });
  await openCart(page);
  await page.route(/ppg-app\/cart(\?|$)/, (r) => (r.request().method() === 'GET' ? r.fulfill(promoError('BKNG001', 'Record not found', 'Cart not found')) : r.fallback()));
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-input').fill('LOUNGE15');
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-apply').click();
  await page.waitForTimeout(2000);
  const s = await stateOf(page);
  const open1 = await page.evaluate(() => !!document.querySelector('dialog.mini-cart-modal[open]'));
  check('a cart the service no longer has (BKNG001): forgotten, the mini cart closed', !s.id && !s.stored && !open1, JSON.stringify({ s, open: open1 }));
  await page.close();
}

// the source's look (its own CSS, 2026-11-12 audit): the panel's place at each width, the header,
// the promo message's amber callout with its icon, and focus back where the visitor was
for (const [width, x, y, w] of [[414, 0, 8, 414], [575, 78, 8, 420], [700, 140, 28, 420], [767, 174, 28, 420], [1440, null, 28, 420]]) {
  const page = await openWithCart({ width });
  await openCart(page);
  const box = await page.evaluate(() => { const r = document.querySelector('dialog.mini-cart-modal[open] .modal-content').getBoundingClientRect(); return [r.x, r.y, r.width].map(Math.round); });
  const expectX = x ?? width - 28 - 420;
  check(`${width} the panel as the source's: x ${expectX}, y ${y}, ${w} wide`, Math.abs(box[0] - expectX) <= 1 && Math.abs(box[1] - y) <= 1 && Math.abs(box[2] - w) <= 1, JSON.stringify(box));
  await page.close();
}
for (const [width, size, gap, padding, after] of [[375, '18px', '5px', '12px', '12px'], [1440, '20px', '8px', '15px', '20px']]) {
  const page = await openWithCart({ width });
  await openCart(page);
  const h = await page.evaluate(() => {
    const d = document.querySelector('dialog.mini-cart-modal[open]');
    const t = getComputedStyle(d.querySelector('.modal-title'));
    return {
      size: t.fontSize, gap: t.marginBottom, padding: getComputedStyle(d.querySelector('.modal-header')).paddingBottom, after: getComputedStyle(d.querySelector('.modal-body')).paddingTop,
    };
  });
  check(`${width} the header as the source's: the title ${size} with ${gap} under it, ${padding} above the line, ${after} after it`, h.size === size && h.gap === gap && h.padding === padding && h.after === after, JSON.stringify(h));
  await page.close();
}
{
  const callout = (page) => page.evaluate(() => {
    const m = document.querySelector('dialog.mini-cart-modal[open] .mini-cart-promo-message');
    const cs = getComputedStyle(m);
    const icon = getComputedStyle(m, '::before');
    return {
      text: m.textContent, color: cs.color, bg: cs.backgroundColor, border: cs.borderTop, radius: cs.borderRadius, padding: cs.padding, margin: cs.margin, size: cs.fontSize, icon: icon.maskImage.includes('circle-exclamation') && icon.width === '13px' && icon.marginRight === '6px',
    };
  });
  const LOOK = (c) => c.color === 'rgb(146, 64, 14)' && c.bg === 'rgb(255, 251, 235)' && c.border === '1px solid rgb(245, 202, 69)' && c.radius === '5px' && c.padding === '2px 10px' && c.margin === '5px 0px' && c.size === '13px' && c.icon;
  const page = await openWithCart({ promo: (body, state) => (body.promocode === 'DOWN' ? 'abort' : stagePromo(body, state)) });
  await openCart(page);
  // an empty code, by a click: the callout, focus stays on the arrow
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-apply').click();
  let c = await callout(page);
  const focusOf = () => page.evaluate(() => document.activeElement?.className || '');
  check('the empty code\'s message as the source\'s amber callout with its icon; focus stays on the arrow', c.text === 'Please enter promo code.' && LOOK(c) && /mini-cart-promo-apply/.test(await focusOf()), JSON.stringify(c));
  // a refused code by a click: the callout, focus back on the arrow (no ring on the field)
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-input').fill('SAVE10');
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-apply').click();
  await page.waitForFunction(() => /No record/.test(document.querySelector('dialog.mini-cart-modal[open] .mini-cart-promo-message')?.textContent || ''), null, { timeout: 10000 });
  c = await callout(page);
  check('a refused code by a click: the callout; focus back on the arrow', LOOK(c) && /mini-cart-promo-apply/.test(await focusOf()), JSON.stringify({ c, focus: await focusOf() }));
  // by Enter: focus back in the field, shown as the source's (white, the light blue glow, no outline)
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-input').fill('SAVE11');
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-input').press('Enter');
  await page.waitForTimeout(1200);
  const field = await page.evaluate(() => {
    const i = document.querySelector('dialog.mini-cart-modal[open] .mini-cart-promo-input'); const cs = getComputedStyle(i); return {
      focused: document.activeElement === i, bg: cs.backgroundColor, outline: cs.outlineStyle, shadow: cs.boxShadow,
    };
  });
  check('a refused code by Enter: focus back in the field, white with the light blue glow, no outline', field.focused && field.bg === 'rgb(255, 255, 255)' && field.outline === 'none' && /rgba\(13, 110, 253, 0\.25\)/.test(field.shadow), JSON.stringify(field));
  // no answer: "Error" in the same callout
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-input').fill('DOWN');
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-apply').click();
  await page.waitForFunction(() => document.querySelector('dialog.mini-cart-modal[open] .mini-cart-promo-message')?.textContent === 'Error', null, { timeout: 10000 });
  c = await callout(page);
  check('no answer: "Error" in the same callout', LOOK(c), JSON.stringify(c));
  await page.close();
}

// the source's measures (the 2026-11-12 audit's medium items, from its own CSS): the cross, the
// promo field and its arrow, the space above "PROMO CODE", the amounts, the phone pass line
for (const width of [375, 1440]) {
  const phone = width < 768;
  const page = await openWithCart({ width });
  await openCart(page);
  const m = await page.evaluate(() => {
    const d = document.querySelector('dialog.mini-cart-modal[open]');
    const panel = d.querySelector('.modal-content').getBoundingClientRect();
    const box = (sel) => { const r = d.querySelector(sel).getBoundingClientRect(); return [r.x - panel.x, r.y - panel.y, r.width, r.height].map(Math.round); };
    const cs = (sel) => getComputedStyle(d.querySelector(sel));
    const input = d.querySelector('.mini-cart-promo-input').getBoundingClientRect();
    const arrow = d.querySelector('.mini-cart-promo-apply').getBoundingClientRect();
    return {
      panelWidth: Math.round(panel.width),
      close: box('.modal-close'),
      closeIcon: cs('.modal-close').maskSize,
      input: Math.round(input.height),
      inputPlaceholder: getComputedStyle(d.querySelector('.mini-cart-promo-input'), '::placeholder').color,
      arrow: [arrow.width, arrow.height, Math.round(input.right - arrow.right), Math.round(arrow.top - input.top)],
      arrowIcon: cs('.mini-cart-promo-apply').maskSize,
      promoTop: cs('.mini-cart-promo').paddingTop,
      promoMargin: cs('.mini-cart-promo').marginTop,
      discountAfter: cs('.mini-cart-discount').paddingBottom,
      service: [cs('.mini-cart-service-total .mini-cart-amount').fontSize, cs('.mini-cart-service-total .mini-cart-amount').fontWeight, cs('.mini-cart-service-total .mini-cart-amount').color],
      discount: [cs('.mini-cart-discount .mini-cart-amount').fontSize, cs('.mini-cart-discount .mini-cart-amount').fontWeight],
      total: cs('.mini-cart-total .mini-cart-amount').fontSize,
      note: cs('.mini-cart-note').fontSize,
      line: [cs('.mini-cart-line').paddingBottom, cs('.mini-cart-line').marginBottom],
      details: cs('.mini-cart-details').marginBottom,
      afterName: cs('.mini-cart-name + *').paddingTop,
    };
  });
  const closeAt = phone ? [m.panelWidth - 20 - 21, 15, 21, 21] : [m.panelWidth - 20 - 24, 22, 24, 24];
  check(`${width} the cross as the source's: ${closeAt[2]}px, ${closeAt[1]}px from the top and 20px from the right, its icon ${phone ? 14 : 16}px`, m.close.every((n, i) => Math.abs(n - closeAt[i]) <= 1) && m.closeIcon === `${phone ? 14 : 16}px`, JSON.stringify({ close: m.close, closeAt, icon: m.closeIcon }));
  check(`${width} the promo field 47px, its placeholder as the source's; the arrow 11 x 10 in a 24px button, 10px from the right, ${phone ? 11 : 14}px from the top`, m.input === 47 && m.inputPlaceholder === 'rgba(33, 37, 41, 0.75)' && JSON.stringify(m.arrow) === JSON.stringify([24, 24, 10, phone ? 11 : 14]) && m.arrowIcon === '11px 10px', JSON.stringify(m));
  check(`${width} 15px above "PROMO CODE" (no margin), the discount row 8px`, m.promoTop === '15px' && m.promoMargin === '0px' && m.discountAfter === '8px', JSON.stringify([m.promoTop, m.promoMargin, m.discountAfter]));
  check(`${width} the amounts as the source's: Service Total 16px/300 black, the discount 16px/${phone ? 500 : 400}, Total ${phone ? 16 : 18}px, the note ${phone ? '12.25' : 14}px`, JSON.stringify(m.service) === '["16px","300","rgb(0, 0, 0)"]' && JSON.stringify(m.discount) === JSON.stringify(['16px', phone ? '500' : '400']) && m.total === `${phone ? 16 : 18}px` && m.note === `${phone ? 12.25 : 14}px`, JSON.stringify(m));
  check(`${width} the lounge line: ${phone ? 12 : 10}px padding and margin, 10px under the details${phone ? ', 20px above the location' : ''}`, JSON.stringify(m.line) === JSON.stringify(phone ? ['12px', '12px'] : ['10px', '10px']) && m.details === '10px' && m.afterName === (phone ? '20px' : '0px'), JSON.stringify([m.line, m.details, m.afterName]));
  await page.close();
}
// the phone pass line: "Quantity" 52px below the line's top, as the source's (29px from 768px)
for (const width of [375, 1440]) {
  const page = await openWithCart({ width, kind: 'pass' });
  await openCart(page);
  const gap = await page.evaluate(() => {
    const d = document.querySelector('dialog.mini-cart-modal[open]');
    return Math.round(d.querySelector('.mini-cart-quantity').getBoundingClientRect().y - d.querySelector('.mini-cart-line').getBoundingClientRect().y);
  });
  const want = width < 768 ? 52 : 29;
  check(`${width} the pass line: "Quantity" ${want}px below the line's top, as the source's`, Math.abs(gap - want) <= 1, `${gap}`);
  await page.close();
}

// the source's fine type (the 2026-11-12 audit's low items): "PROMO CODE"'s 1px spacing, "hrs"
// (4px each side, a 1.5 line), the guests' line before the children from 768px (b+b), the 0.6px
// rules, the ⊗ (14px below 768px), the amounts on one line, the note at 11px from 992 to 1200px
for (const width of [375, 1100, 1440]) {
  const page = await openWithCart({ width, children: 1 });
  await openCart(page);
  const m = await page.evaluate(() => {
    const d = document.querySelector('dialog.mini-cart-modal[open]');
    const cs = (sel) => getComputedStyle(d.querySelector(sel));
    const adults = d.querySelector('.mini-cart-adults').getBoundingClientRect();
    const child = d.querySelector('.mini-cart-children').getBoundingClientRect();
    const amount = d.querySelector('.mini-cart-discount .mini-cart-amount');
    return {
      spacing: cs('.mini-cart-promo-label').letterSpacing,
      hours: [cs('.mini-cart-hours').paddingLeft, cs('.mini-cart-hours').paddingRight, cs('.mini-cart-hours').lineHeight],
      guests: d.querySelector('.mini-cart-children').closest('dd').textContent,
      child: [cs('.mini-cart-children').borderLeftWidth, cs('.mini-cart-children').borderLeftStyle, cs('.mini-cart-children').borderLeftColor, cs('.mini-cart-children').paddingLeft, Math.round(child.x - adults.right), Math.round(child.y) === Math.round(adults.y)],
      rule: getComputedStyle(d).getPropertyValue('--cart-rule').trim(),
      remove: Math.round(d.querySelector('.mini-cart-remove').getBoundingClientRect().width),
      amountLines: Math.round(amount.getBoundingClientRect().height / parseFloat(getComputedStyle(amount).lineHeight)),
      note: cs('.mini-cart-note').fontSize,
      labelPad: cs('.mini-cart-total .mini-cart-label').paddingRight,
    };
  });
  const wide = width >= 768;
  const narrow = width >= 992 && width <= 1200;
  check(`${width} "PROMO CODE" 1px apart; "hrs" 4px each side on a 1.5 line, as the source's`, m.spacing === '1px' && JSON.stringify(m.hours) === '["4px","4px","19.5px"]', JSON.stringify([m.spacing, m.hours]));
  check(`${width} the guests "1 Adult(s) 1 Child(ren)" on one line, ${wide ? 'a 1px black line and 5px before the children' : 'a space only'} (the source's b+b)`, m.guests === '1 Adult(s) 1 Child(ren)' && JSON.stringify(m.child) === JSON.stringify(wide ? ['1px', 'solid', 'rgb(0, 0, 0)', '5px', 4, true] : ['0px', 'none', m.child[2], '0px', 4, true]), JSON.stringify(m));
  check(`${width} the source's 0.6px rules, the ⊗ ${wide ? 16 : 14}px, the discount on one line`, m.rule.startsWith('0.6px solid') && m.remove === (wide ? 16 : 14) && m.amountLines === 1, JSON.stringify([m.rule, m.remove, m.amountLines]));
  check(`${width} the Total's note ${narrow ? '11px and 10px after the label (992-1200px)' : 'as before'}`, narrow ? m.note === '11px' && m.labelPad === '10px' : m.note !== '11px' && m.labelPad === '0px', JSON.stringify([m.note, m.labelPad]));
  await page.close();
}
// the cross's hover as the source's (Bootstrap's .btn-close): black at 0.5, 0.75 while the pointer is
// on it, with no fade (the site dialog's grey hover once faded it lighter than at rest)
for (const width of [375, 1440]) {
  const page = await openWithCart({ width });
  await openCart(page);
  const close = page.locator('dialog.mini-cart-modal[open] .modal-close');
  const look = () => close.evaluate((c) => { const st = getComputedStyle(c); return `${st.opacity} ${st.backgroundColor}`; });
  const rest = await look();
  const box = await close.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const hover = [await look()];
  for (const ms of [100, 300, 1000]) {
    await page.waitForTimeout(ms);
    hover.push(await look());
  }
  check(`${width} the cross: 0.5 at rest, a steady 0.75 on hover, black (as the source's)`, rest === '0.5 rgb(0, 0, 0)' && hover.every((h) => h === '0.75 rgb(0, 0, 0)'), JSON.stringify({ rest, hover }));
  await page.close();
}
// the add-ons hook: no View more options without an add-ons source; with one, the link and its call
{
  const page = await openWithCart();
  await openCart(page);
  check('add-ons: no View more options without the add-ons API', !(await mini(page)).more);
  await page.locator('dialog.mini-cart-modal[open] .modal-close').click();
  await page.evaluate(async () => {
    // eslint-disable-next-line import/no-absolute-path
    const { registerAddons } = await import('/scripts/mini-cart.js');
    registerAddons({ available: (line) => line.kind === 'lounge', open: (line) => { window.addonsOpened = line.catalogueCode; } });
    const cart = JSON.parse(sessionStorage.getItem('ppl-cart'));
    cart.lines[0].addons = [{ name: 'Plaza Premium Lounge Sakura Shrimp Spice (50g)', quantity: 2 }];
    sessionStorage.setItem('ppl-cart', JSON.stringify(cart));
  });
  await page.route(/ppg-app\/cart(\?|$)/, (r) => r.fulfill({ status: 503, body: '' }));
  await openCart(page);
  const m = await mini(page);
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-more').click();
  const opened = await page.evaluate(() => window.addonsOpened);
  check('add-ons, with a registered source: "View more options" opens it; the line\'s "Additional Services: 2x …"', m.more && opened === LINE.catalogueCode && m.addons === 'Additional Services:2x Plaza Premium Lounge Sakura Shrimp Spice (50g)', JSON.stringify({ more: m.more, opened, addons: m.addons }));
  await page.close();
}

// axe: the mini cart with the promo field (and its error), the promo confirmation
if (process.env.AXE_CORE) {
  const AXE = readFileSync(process.env.AXE_CORE, 'utf8');
  for (const width of WIDTHS) {
    const page = await openWithCart({ width, meta: { 'cart-checkout-url': CHECKOUT, 'cart-edit-url': EDIT } });
    await openCart(page);
    await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-apply').click();
    await page.addScriptTag({ content: AXE });
    const run = () => page.evaluate(async () => {
      // eslint-disable-next-line no-undef
      const r = await axe.run([...document.querySelectorAll('dialog.modal[open]')].pop(), { resultTypes: ['violations'] });
      return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
    });
    let res = await run();
    check(`axe, ${width} the mini cart with the promo field and its message: no violations`, !res.length, res.join(' | '));
    await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-input').fill('LOUNGE15');
    await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-apply').click();
    await page.waitForSelector('dialog.mini-cart-modal[open] .mini-cart-promo-remove', { timeout: 10000 });
    res = await run();
    check(`axe, ${width} the applied code (read only, its remove button): no violations`, !res.length, res.join(' | '));
    await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-remove').click();
    await page.waitForSelector('dialog.cart-confirm-modal[open]');
    res = await run();
    check(`axe, ${width} the promo confirmation: no violations`, !res.length, res.join(' | '));
    await page.close();
  }
}

await browser.close();
console.log(`\n${failed} failed`);
process.exit(failed ? 1 : 0);
