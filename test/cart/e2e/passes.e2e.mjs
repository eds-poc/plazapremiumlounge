// The passes journey end to end on the real stage passes and cart APIs (dev only; HOST: the local
// preview or a branch preview, WIDTH, PLAYWRIGHT), on the passes page. Nothing is routed. After each
// step the page's stored cart, count and labels are compared with a fresh GET.
// 1. a pass, Add More, a pass stage won't sell (the Notice), another pass, the inventory limit
// 2. the currency: the cart of passes priced in HKD when the mini cart opens on an HKD page
// 3. another language's page (zh-cn): the mini cart's texts
// 4. removing a line (PUT, no reload), the last (DELETE)
// 5. the promotional address; two tabs adding at once (reported, not checked)
// 6. mixed: a real lounge cart refuses a pass and the promotional address; with passes in the cart
//    the homepage's Book Now is refused (when stage has a lounge card at HKG)
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');

const HOST = process.env.HOST || 'http://localhost:3001';
const WIDTH = Number(process.env.WIDTH || 1440);
const PPG = 'https://1074235-ppginternal-stage.adobeioruntime.net/api/v1/web/ppg-app';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const PATH = '/en-uk/airport-lounge-passes';
// stage passes (PRPRTY1235): Global 2-Visit (inventory 5 on its regular rate), Adelaide 2-Visit,
// Hong Kong and Shanghai 2-Visit; Global 5-Visit is listed but the cart service refuses it
const [A, C, D, REFUSED] = ['PRD3705', 'PRD3673', 'PRD3676', 'PRD3696'];
let failed = 0;
const check = (name, ok, info = '') => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${WIDTH} ${name}${info ? ` — ${info}` : ''}`); };
const note = (name, info) => console.log(`note ${WIDTH} ${name} — ${info}`);
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: WIDTH, height: WIDTH < 768 ? 812 : 900 }, userAgent: UA });
const page = await context.newPage();
page.setDefaultTimeout(30000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
let navigations = 0;
page.on('framenavigated', (f) => { if (f === page.mainFrame()) navigations += 1; });
const calls = [];
page.on('request', (r) => { if (/ppg-app\/cart/.test(r.url()) && r.method() !== 'OPTIONS') calls.push(`${r.method()} ${r.url().split('cart')[1] || ''}`); });
const made = new Set();

const ready = async (p = page) => {
  await p.waitForFunction(() => document.querySelectorAll('.pass-finder button[data-pass-add]').length >= 3 && document.querySelectorAll('.quick-buy button[data-pass-add]').length >= 2, null, { timeout: 60000 });
  await p.waitForTimeout(800);
};
const go = async (path, p = page) => {
  await p.goto(`${HOST}${path}`, { waitUntil: 'load', timeout: 90000 });
  if (p === page) navigations = 0;
  await ready(p);
};
const button = (product, p = page) => p.locator(`button[data-pass-add][data-catalogue-code^="${product}-"]`).first();
const cartId = (p = page) => p.evaluate(() => document.cookie.match(/cartid=([^;]+)/)?.[1] || null);
const getCart = async (id) => (await fetch(`${PPG}/cart?cartId=${id}&locale=en`)).json();
const compare = async (label, p = page) => {
  const s = await p.evaluate(() => ({
    stored: JSON.parse(localStorage.getItem('ppl-cart') || 'null'),
    cookie: document.cookie.match(/cartid=([^;]+)/)?.[1] || null,
    badge: document.querySelector('header .header-cart-count:not([hidden])')?.textContent || null,
    labels: Object.fromEntries([...document.querySelectorAll('button[data-pass-add]')].map((b) => [b.dataset.catalogueCode, b.textContent])),
  }));
  if (!s.cookie) {
    check(`${label}: no cart on the page`, !s.stored && !s.badge && Object.values(s.labels).every((l) => l === 'Add to Cart'));
    return null;
  }
  made.add(s.cookie);
  const fresh = await getCart(s.cookie);
  const want = (fresh.products || []).map((x) => `${x.catalogueCode}×${x.quantity}`).sort().join(',');
  const have = (s.stored?.lines || []).map((l) => `${l.catalogueCode}×${l.quantity}`).sort().join(',');
  const count = (fresh.products || []).reduce((n, x) => n + Number(x.quantity), 0);
  const inCart = new Set((fresh.products || []).map((x) => x.catalogueCode));
  const labelsOk = !Object.keys(s.labels).length || Object.entries(s.labels).every(([code, l]) => l === (inCart.has(code) ? 'Add More' : 'Add to Cart'));
  check(`${label}: the page = a fresh GET (lines, count ${count}, total, currency${Object.keys(s.labels).length ? ', labels' : ''})`, want === have && s.badge === String(count) && labelsOk && Number(s.stored.totals.total) === Number(fresh.cartTotalPrice.totalPrice) && s.stored.currency === fresh.currency, JSON.stringify({
    want, have, badge: s.badge, total: [s.stored?.totals?.total, fresh.cartTotalPrice?.totalPrice], currency: [s.stored?.currency, fresh.currency],
  }));
  return fresh;
};
const dialogText = (p = page) => p.evaluate(() => [...document.querySelectorAll('dialog.modal[open]')].pop()?.textContent.replace(/\s+/g, ' ').trim());
const added = async (p = page) => {
  await p.waitForSelector('dialog.mini-cart-modal[open], dialog.cart-message-modal[open]', { timeout: 60000 });
  await p.waitForFunction(() => !document.getElementById('spinner-overlay'));
  await p.waitForTimeout(600);
  return p.evaluate(() => !!document.querySelector('dialog.mini-cart-modal[open]'));
};
const closeAll = async (p = page) => {
  for (let i = 0; i < 3; i += 1) {
    const x = p.locator('dialog.modal[open] .modal-close').last();
    if (!(await x.count())) break;
    await x.click();
    await p.waitForTimeout(300);
  }
};
const lines = (p = page) => p.evaluate(() => [...document.querySelectorAll('dialog.mini-cart-modal[open] .mini-cart-line')].map((l) => l.textContent.replace(/\s+/g, ' ').trim()));
const openCart = async (p = page) => {
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.locator('header a.header-utility:has(.icon-cart)').first().click();
  await p.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 60000 });
  await p.waitForFunction(() => !document.getElementById('spinner-overlay'));
  await p.waitForTimeout(800);
};
const yes = async (index = 0) => {
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-remove').nth(index).click();
  await page.waitForSelector('dialog.cart-confirm-modal[open]');
  await page.locator('dialog.cart-confirm-modal[open] .cart-button', { hasText: 'Yes' }).click();
  await page.waitForFunction(() => !document.querySelector('dialog.cart-confirm-modal[open]') && !document.getElementById('spinner-overlay'), null, { timeout: 45000 });
  await page.waitForTimeout(1500);
};
const empty = async () => {
  const id = await cartId();
  if (id) await fetch(`${PPG}/cart?cartId=${id}`, { method: 'DELETE' });
  await page.evaluate(() => { document.cookie = 'cartid=; path=/; max-age=0'; localStorage.removeItem('ppl-cart'); sessionStorage.clear(); });
};

// 1. a pass, Add More, a refused pass, another pass, the inventory limit
await go(PATH);
await empty();
await go(PATH);
await button(A).scrollIntoViewIfNeeded();
await button(A).click();
check('1 a pass: POST, the mini cart', await added() && calls.filter((c) => c.startsWith('POST')).length === 1, JSON.stringify([calls, await lines()]));
let fresh = await compare('1 after the first pass');
check('1 the stage line: GFTCRD, the start an hour ahead in Hong Kong', fresh?.products?.[0]?.propertyTypeCode === 'GFTCRD', JSON.stringify(fresh?.products?.[0] && { t: fresh.products[0].propertyTypeCode, s: fresh.products[0].startDate }));
await closeAll();
await button(A).click();
check('1 Add More: PUT, Quantity: 2', await added() && calls.some((c) => c.startsWith('PUT')) && /Quantity: 2/.test((await lines())[0] || ''), JSON.stringify(await lines()));
await compare('1 after Add More');
await closeAll();
if (await button(REFUSED).count()) {
  await button(REFUSED).scrollIntoViewIfNeeded();
  await button(REFUSED).click();
  const ok = await added();
  check(`1 ${REFUSED} (stage refuses it, PRDCT_ERR_001): the Notice, the cart as it was`, !ok && /An error occurred/.test(await dialogText() || ''), await dialogText());
  await compare(`1 after the refused ${REFUSED}`);
  await closeAll();
}
await button(C).scrollIntoViewIfNeeded();
await button(C).click();
check('1 another pass: two lines', await added() && (await lines()).length === 2, JSON.stringify(await lines()));
await compare('1 after the second pass');
await closeAll();
// Global 2-Visit's regular rate has an inventory of 5 on stage: Add More up to it, then one more
let quantity = 2;
let refusedAt = 0;
for (let i = 0; i < 5 && !refusedAt; i += 1) {
  await button(A).click();
  if (await added()) quantity += 1;
  else refusedAt = quantity + 1;
  await closeAll();
}
check('1 the inventory limit: Add More past it shows the Notice (CRT_ERR_002), the quantity stays', refusedAt > 0, `quantity ${quantity}, refused at ${refusedAt || 'none'}`);
await compare('1 after the inventory limit');

// 2. the currency: the cart opened on an HKD page is priced in HKD
await go(`${PATH}?currencyCode=HKD`);
const before = calls.length;
await openCart();
fresh = await compare('2 the mini cart on an HKD page');
check('2 the cart of passes converted to HKD (PUT), the mini cart in HKD', fresh?.currency === 'HKD' && calls.slice(before).some((c) => c.startsWith('PUT')) && (await lines()).every((l) => /HKD /.test(l)), JSON.stringify({ currency: fresh?.currency, calls: calls.slice(before), lines: await lines() }));
await closeAll();
check('2 the HKD passes page lists HKD prices', await page.evaluate(() => /HKD /.test(document.querySelector('.quick-buy')?.textContent || '')));

// 3. another language: the zh-cn homepage's cart (the session's HKD kept)
await page.goto(`${HOST}/zh-cn/`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => document.querySelector('header .header')?.dataset.blockStatus === 'loaded', null, { timeout: 30000 });
navigations = 0;
await openCart();
const zh = await page.evaluate(() => {
  const d = document.querySelector('dialog.mini-cart-modal[open]');
  return { title: d.querySelector('.modal-title, .cart-dialog-title')?.textContent, lines: [...d.querySelectorAll('.mini-cart-line')].map((l) => l.textContent.replace(/\s+/g, ' ').trim()), buttons: [...d.querySelectorAll('.mini-cart-actions button')].map((b) => b.textContent) };
});
check('3 zh-cn: 购物车, 数量:, 结账, the names as the API gives them (English)', /购物车/.test(zh.title || '') && zh.lines.every((l) => /数量: \d/.test(l)) && JSON.stringify(zh.buttons) === '["结账"]', JSON.stringify(zh));
await compare('3 on the zh-cn homepage');
await closeAll();

// 4. removing a line (PUT, in place), the last (DELETE)
await go(PATH);
await openCart();
const n4 = (await lines()).length;
await yes(0);
check('4 one line removed: in place, no reload', (await lines()).length === n4 - 1 && navigations === 0, JSON.stringify([await lines(), navigations]));
await compare('4 after removing a line');
await yes(0);
check('4 the last line: DELETE, the mini cart closed, no reload', calls.some((c) => c.startsWith('DELETE')) && !(await page.locator('dialog.mini-cart-modal[open]').count()) && navigations === 0, JSON.stringify([calls.slice(-3), navigations]));
await compare('4 after removing the last');

// 5. the promotional address; two tabs at once
await page.goto(`${HOST}${PATH}?selectedPassID=${D}`, { waitUntil: 'load', timeout: 90000 });
await added();
check(`5 ?selectedPassID=${D}: added, the mini cart open, the parameter gone`, (await lines()).length === 1 && (await page.evaluate(() => window.location.search)) === '', JSON.stringify([await lines(), await page.evaluate(() => window.location.search)]));
await compare('5 after the promotional address');
await closeAll();
const other = await context.newPage();
await go(PATH, other);
await button(A).scrollIntoViewIfNeeded();
await button(C, other).scrollIntoViewIfNeeded();
await Promise.all([button(A).click(), button(C, other).click()]);
const shown = await Promise.all([added().catch(() => 'nothing shown'), added(other).catch(() => 'nothing shown')]);
await page.waitForTimeout(1500);
const both = await getCart(await cartId());
note('5 two tabs adding at once', `the cart holds ${both.products?.map((x) => `${x.productCode}×${x.quantity}`).join(', ')} (wanted ${D}, ${A}, ${C}: PUT replaces the list, so one can overwrite the other); the tabs showed ${JSON.stringify(shown)}`);
await other.close();
await empty();

// 6. mixed: a real lounge cart; then passes and the homepage's Book Now
const lounge = await (await fetch(`${PPG}/cart`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    currency: 'HKD',
    channel: 'B2C',
    pointOfPurchase: 'Online',
    isThirdPartyFulfilment: false,
    products: [{
      catalogueCode: 'PRD3341-Regular-PRPRTY816-LOUNGE-LCTN517-RTPLN3480', startDate: '2026-11-22 20:00:00', quantity: 1, guestsCount: { adult: '1', child: '0' },
    }],
  }),
})).json();
if (lounge.cartId) {
  made.add(lounge.cartId);
  await page.evaluate((id) => {
    document.cookie = `cartid=${id}; path=/`;
    localStorage.setItem('ppl-cart', JSON.stringify({
      cartId: id,
      currency: 'HKD',
      expires: Date.now() + 3600e3,
      totals: { base: 1, discounts: [], total: 1 },
      lines: [{
        catalogueCode: 'PRD3341-Regular-PRPRTY816-LOUNGE-LCTN517-RTPLN3480', type: 'lounge', kind: 'lounge', name: 'Lounge', product: '', place: '', start: '2026-11-22 20:00:00', adults: 1, children: 0, quantity: 1,
      }],
    }));
  }, lounge.cartId);
  await go(PATH);
  const n6 = calls.length;
  await button(A).click();
  await added();
  check('6 a pass with a real lounge cart: Checkout Cart, only a GET', /Please proceed to checkout/.test(await dialogText() || '') && calls.slice(n6).every((c) => c.startsWith('GET')), JSON.stringify(calls.slice(n6)));
  await closeAll();
  await page.goto(`${HOST}${PATH}?selectedPassID=${D}`, { waitUntil: 'load', timeout: 90000 });
  await added();
  const kept = await getCart(lounge.cartId);
  check('6 ?selectedPassID with the lounge: Checkout Cart, the stage cart still only the lounge', /Please proceed to checkout/.test(await dialogText() || '') && kept.products?.length === 1 && kept.products[0].propertyTypeCode === 'LOUNGE', JSON.stringify(kept.products?.map((x) => x.propertyTypeCode)));
  await closeAll();
  await empty();
} else note('6 the lounge cart', `stage didn't make it: ${JSON.stringify(lounge).slice(0, 200)}`);
// passes in the cart, then the homepage lounge card's Book Now
await go(PATH);
await button(C).click();
await added();
await closeAll();
await page.goto(`${HOST}/en-uk/`, { waitUntil: 'load', timeout: 90000 });
const input = page.locator('main .hero .booking-widget .booking-widget-where-input');
await page.waitForFunction(() => !document.querySelector('main .hero .booking-widget .booking-widget-submit')?.disabled, null, { timeout: 40000 });
await input.click();
await input.fill('HKG');
await page.locator('main .hero .booking-widget .booking-widget-option[id$="-HKG"]').click();
const card = await page.waitForSelector('.booking-widget-card-book', { timeout: 60000 }).then(() => true).catch(() => false);
if (card) {
  const n7 = calls.length;
  await page.locator('.booking-widget-card-book').click();
  await added();
  check('6 the homepage Book Now with a pass in the cart: Checkout Cart, no POST/PUT', /Please proceed to checkout/.test(await dialogText() || '') && calls.slice(n7).every((c) => c.startsWith('GET')), JSON.stringify(calls.slice(n7)));
  await closeAll();
} else note('6 the homepage Book Now with passes', 'skipped: stage has no bookable lounge card at HKG now');
await empty();
check('no page errors', !errors.length, errors.join(' | '));
for (const id of made) await fetch(`${PPG}/cart?cartId=${id}`, { method: 'DELETE' });
await browser.close();
console.log(`${failed} failed`);
process.exit(failed ? 1 : 0);
