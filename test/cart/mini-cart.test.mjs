// The mini cart's Check Out / Edit links (from the page metadata), its promo code and the add-ons
// hook, with routed answers: a stored lounge cart (fixtures/cart.json, the stage service's real
// GET answer), the promo call as stage answers it today (400 VALIDATION_ERROR for {cartId,
// promocode}), and a modelled success (no valid code on stage yet: the cart's
// totalPromocodeAmount above 0). Usage: node mini-cart.test.mjs [width]
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
// the stage service's answer to {cartId, promocode} (2026-11-06)
const STAGE_PROMO = json({ error: { code: 'VALIDATION_ERROR', details: {}, message: 'Request body is required for update cart' } }, 400);
const CHECKOUT = 'https://www.plazapremiumlounge.com/{lang}/guest-checkout?cart={cartId}';
const EDIT = 'https://www.plazapremiumlounge.com/{lang}/book-your-visit?date={date}&time={time}&adults={adults}&children={children}&product={catalogueCode}';

/** A stored cart (the id in localStorage, the tab's data in sessionStorage), once per tab. */
const stored = (kind = 'lounge') => `(() => {
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
  width = 1440, path = '/en-uk/', promo = () => STAGE_PROMO, meta = {}, kind = 'lounge',
} = {}) {
  const api = {
    promos: [], gets: 0, posts: [], deletes: [],
  };
  // the promo is applied to one cart (its id); a new cart (POST) is CRT_MC2, CRT_MC3…
  const state = { applied: '', appliedTo: '', made: 1 };
  const page = await open(browser, {
    width,
    path,
    extraRoute: async (p) => {
      await p.addInitScript(stored(kind));
      if (Object.keys(meta).length) {
        await p.route(new RegExp(`localhost:\\d+${path.replace(/\//g, '\\/')}(\\?.*)?$`), async (r) => {
          const resp = await r.fetch();
          const tags = Object.entries(meta).map(([k, v]) => `<meta name="${k}" content="${v.replace(/&/g, '&amp;')}">`).join('');
          const body = (await resp.text()).replace('</head>', `${tags}</head>`);
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
          api.posts.push(JSON.parse(r.request().postData() || '{}'));
          await wait(300);
          return r.fulfill(json({ cartId: `CRT_MC${state.made}` }));
        }
        api.gets += 1;
        const cart = structuredClone(kind === 'pass' ? PASS_CART : CART);
        cart.cartId = id || 'CRT_MC';
        if (state.applied && state.appliedTo === cart.cartId) {
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
  // a pass cart: Check Out only; no metadata: buttons that only announce, and a hint on the preview
  const page = await openWithCart({ kind: 'pass' });
  const nav = watchNav(page);
  await openCart(page);
  const m = await mini(page);
  check('no metadata: Check Out a button (no Edit for passes), the preview hint names the row', m.actions.length === 1 && m.actions[0].tag === 'BUTTON' && /cart-checkout-url/.test(m.hint || '') && !/cart-edit-url/.test(m.hint || ''), JSON.stringify(m.actions) + m.hint);
  const announced = page.evaluate(() => new Promise((resolve) => { document.addEventListener('cart:checkout', () => resolve(true), { once: true }); }));
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-actions button').click();
  check('no metadata: Check Out only announces, no navigation', await announced && nav.count === 0);
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
  check(`${width} promo refused (stage's 400): "No record found for the provided promotional code.", the code kept, focus back, the totals unchanged, no reload`, m.message === 'No record found for the provided promotional code.' && m.error && m.value === 'SAVE10' && !m.readOnly && /mini-cart-promo-input/.test(m.focus || '') && m.rows.at(-1).endsWith('HKD 787.50') && page.api.gets === gets && nav.count === 0, JSON.stringify({ ...m, gets: page.api.gets - gets, nav: nav.count }));
  await page.close();
}
for (const [label, promo, message] of [
  ['accepted but not applied (stage\'s 200 {cartId} for a full cart body)', () => json({ cartId: 'CRT_MC' }), 'No record found for the provided promotional code.'],
  ['the service\'s error (200 with errorCode)', () => json({ errorCode: 'PROMO_ERR', message: 'Invalid promo' }), 'No record found for the provided promotional code.'],
  ['the network', () => 'abort', 'Error'],
  ['a 500', () => json('oops', 500), 'Error'],
]) {
  const page = await openWithCart({ promo });
  await openCart(page);
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-input').fill('SAVE10');
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-apply').click();
  await page.waitForFunction(() => document.querySelector('dialog.mini-cart-modal[open] .mini-cart-promo-message')?.textContent, null, { timeout: 10000 });
  const m = await mini(page);
  check(`promo, ${label}: "${message}", no promo row`, m.message === message && m.error && !m.rows.some((r) => /Promo Code/.test(r)), JSON.stringify({ message: m.message, rows: m.rows }));
  await page.close();
}
{
  // applied (modelled: the cart then has a promo discount), then taken off
  const page = await openWithCart({ promo: (body, state) => { state.applied = body.promocode; state.appliedTo = body.cartId; return json({ cartId: body.cartId }); } });
  const nav = watchNav(page);
  await openCart(page);
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-input').fill('SAVE10');
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-apply').click();
  await page.waitForSelector('dialog.mini-cart-modal[open] .mini-cart-promo-remove', { timeout: 10000 });
  await page.waitForTimeout(300);
  let m = await mini(page);
  const storedPromo = await page.evaluate(() => JSON.parse(sessionStorage.getItem('ppl-cart')).promoCode);
  check('promo applied (modelled): the GET\'s promo amount as a row, the total from the GET, the code read only with its remove button, kept in the summary', m.rows.some((r) => r === 'Promo Code (SAVE10):- HKD 50.00') && m.rows.at(-1).endsWith('HKD 737.50') && m.value === 'SAVE10' && m.readOnly && /mini-cart-promo-remove/.test(m.action) && m.actionLabel === 'Remove promo code' && !m.msgShown && storedPromo === 'SAVE10' && nav.count === 0, JSON.stringify({
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
  check('remove, Confirm: PUT with an empty code, the row gone, the field empty and editable, no reload', JSON.stringify(page.api.promos[1]?.body) === '{"cartId":"CRT_MC","promocode":""}' && !m.rows.some((r) => /Promo Code/.test(r)) && m.rows.at(-1).endsWith('HKD 787.50') && m.value === '' && !m.readOnly && nav.count === 0, JSON.stringify({ promos: page.api.promos, rows: m.rows, value: m.value }));
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
  ['a refused code typed', () => STAGE_PROMO, false],
  ['an applied code (modelled)', (body, state) => { state.applied = body.promocode; state.appliedTo = body.cartId; return json({ cartId: body.cartId }); }, true],
]) {
  const page = await openWithCart({ promo });
  await openCart(page);
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-input').fill('SAVE10');
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
  const page = await openWithCart({ promo: async (body, state) => { await wait(2500); state.applied = body.promocode; state.appliedTo = body.cartId; return json({ cartId: body.cartId }); } });
  await openCart(page);
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-input').fill('SAVE10');
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
    const page = await openWithCart({ width, meta: { 'cart-checkout-url': CHECKOUT, 'cart-edit-url': EDIT }, promo: (body, state) => { state.applied = body.promocode; state.appliedTo = body.cartId; return json({ cartId: body.cartId }); } });
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
    await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-input').fill('SAVE10');
    await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-apply').click();
    await page.waitForSelector('dialog.mini-cart-modal[open] .mini-cart-promo-remove', { timeout: 10000 });
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
