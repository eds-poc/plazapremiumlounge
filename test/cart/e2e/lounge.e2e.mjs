// The lounge journey end to end on the real stage cart API (dev only; HOST: the local preview or a
// branch preview, WIDTH, PLAYWRIGHT): add → GET (the modal against the answer, field by field) →
// delete from the card (DELETE; then the server's cart read directly) → add → ⊗ Cancel → ⊗ Yes
// (DELETE, in place: no reload; the server's cart again). A second tab follows the count. It needs a
// bookable lounge card at HKG from the stage service.
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');

const HOST = process.env.HOST || 'http://localhost:3001';
const WIDTH = Number(process.env.WIDTH || 1440);
const PPG = 'https://1074235-ppginternal-stage.adobeioruntime.net/api/v1/web/ppg-app';
const W = 'main .hero .booking-widget';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
let failed = 0;
const check = (name, ok, info = '') => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${WIDTH} ${name}${info ? ` — ${info}` : ''}`); };
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: WIDTH, height: WIDTH < 768 ? 812 : 900 }, userAgent: UA });
const page = await context.newPage();
const other = await context.newPage();
page.setDefaultTimeout(30000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const calls = [];
page.on('response', async (r) => {
  if (!/ppg-app\/cart(\?|$)/.test(r.url()) || r.request().method() === 'OPTIONS') return;
  let body = null;
  try { body = await r.json(); } catch { /* none */ }
  calls.push({
    method: r.request().method(), url: r.url().replace(/^.*ppg-app/, ''), status: r.status(), body,
  });
});
const serverCart = async (id) => (await fetch(`${PPG}/cart?cartId=${id}&locale=en`)).json();
const state = (p) => p.evaluate(() => ({
  cookie: document.cookie.match(/cartid=([^;]+)/)?.[1] || null,
  stored: !!localStorage.getItem('ppl-cart'),
  count: document.querySelector('header .header-cart-count:not([hidden])')?.textContent || null,
  label: document.querySelector('header a.header-utility .icon-cart')?.closest('a')?.getAttribute('aria-label'),
  book: document.querySelector('.booking-widget-card-book')?.textContent || null,
  open: [...document.querySelectorAll('dialog.modal[open]')].map((d) => [...d.classList].find((c) => /^(mini-)?cart-/.test(c))),
}));
const ready = async (p) => p.waitForFunction((w) => document.querySelector(`${w} .booking-widget-submit`) && !document.querySelector(`${w} .booking-widget-submit`).disabled, W, { timeout: 40000 });
async function pickHkg() {
  const input = page.locator(`${W} .booking-widget-where-input`);
  await input.click();
  await input.fill('HKG');
  await page.locator(`${W} .booking-widget-option[id$="-HKG"]`).click();
  await page.waitForSelector('.booking-widget-card-book', { timeout: 60000 });
  await page.waitForTimeout(500);
}
async function add() {
  await page.locator('.booking-widget-card-book').click();
  await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 60000 });
  await page.waitForTimeout(800);
}

await other.goto(`${HOST}/en-uk/airport-lounge-passes`, { waitUntil: 'load' });
await page.goto(`${HOST}/en-uk/`, { waitUntil: 'load' });
await ready(page);
await pickHkg();

// 1. add
await add();
const post = calls.find((c) => c.method === 'POST');
const get = calls.find((c) => c.method === 'GET');
const id = post?.body?.cartId;
let s = await state(page);
check('1 add: POST → cartId; cookie, summary, count 1, Remove From Cart', !!id && s.cookie === id && s.stored && s.count === '1' && s.book === 'Remove From Cart', JSON.stringify({ id, ...s }));

// 2. the modal against the GET answer, field by field
const p = get.body.products[0];
const t = get.body.cartTotalPrice;
const amount = (n) => `${get.body.currency} ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
const m = await page.evaluate(() => {
  const d = document.querySelector('dialog.mini-cart-modal[open]');
  const part = (r) => [...r.children].map((c) => c.textContent.trim());
  return {
    name: d.querySelector('.mini-cart-name').textContent.trim(),
    place: d.querySelector('.mini-cart-place')?.textContent.trim(),
    details: [...d.querySelectorAll('.mini-cart-detail')].map(part),
    rows: [...d.querySelectorAll('.mini-cart-row')].map((r) => [r.querySelector('.mini-cart-label').firstChild.textContent.trim(), r.querySelector('.mini-cart-amount').textContent.trim()]),
  };
});
const [day, time] = p.startDate.split(' ');
const [y, , dd] = day.split('-');
const month = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`));
const expect = {
  name: p.propertyDisplayName.trim(),
  place: [p.shortLocation, p.locationName].filter(Boolean).join(', '),
  date: `${dd}-${month}-${y}`,
  time: `${time.slice(0, 2)}${time.slice(3, 5)}hrs`,
  guests: `${Number(p.guestsCount.adult)} Adult(s)${Number(p.guestsCount.child) ? ` ${Number(p.guestsCount.child)} Child(ren)` : ''}`,
  services: p.productDisplayName,
};
console.log('  GET', JSON.stringify({
  ...expect, base: t.totalBasePrice, discounts: p.itemPriceDetails.discounts.map((x) => [x.name, x.value]), total: t.totalPrice, currency: get.body.currency,
}));
console.log('  modal', JSON.stringify(m));
check('2 name = propertyDisplayName', m.name === expect.name, `${m.name} | ${expect.name}`);
check('2 place = shortLocation, locationName', m.place === expect.place, `${m.place} | ${expect.place}`);
check('2 Date = startDate (dd-Mon-yyyy)', JSON.stringify(m.details[0]) === JSON.stringify(['Date:', expect.date]), JSON.stringify(m.details[0]));
check('2 Time = startDate (HHmm hrs)', JSON.stringify(m.details[1]) === JSON.stringify(['Time:', expect.time]), JSON.stringify(m.details[1]));
check('2 Guests = guestsCount', JSON.stringify(m.details[2]) === JSON.stringify(['Guests:', expect.guests]), JSON.stringify(m.details[2]));
check('2 Services = productDisplayName', JSON.stringify(m.details[3]) === JSON.stringify(['Services:', expect.services]), JSON.stringify(m.details[3]));
const wantRows = [];
if (p.itemPriceDetails.discounts.length) {
  wantRows.push(['Service Total', amount(t.totalBasePrice)]);
  p.itemPriceDetails.discounts.forEach((x) => wantRows.push([`${x.name}:`, `- ${amount(x.value)}`]));
}
wantRows.push(['Total', amount(t.totalPrice)]);
check('2 Service Total / discounts / Total = cartTotalPrice, itemPriceDetails.discounts, currency', JSON.stringify(m.rows) === JSON.stringify(wantRows), `${JSON.stringify(m.rows)} | ${JSON.stringify(wantRows)}`);
await other.waitForTimeout(800);
check('2 another tab: count 1', (await state(other)).count === '1');

// 3. delete from the card
await page.locator('dialog.mini-cart-modal[open] .modal-close').click();
await page.waitForTimeout(400);
const n3 = calls.length;
await page.locator('.booking-widget-card-book').click();
const loader3 = await page.waitForSelector('#spinner-overlay', { state: 'attached', timeout: 3000 }).then(() => true).catch(() => false);
await page.waitForFunction(() => document.querySelector('.booking-widget-card-book')?.textContent === 'Book Now', null, { timeout: 30000 });
await page.waitForTimeout(500);
const del3 = calls.slice(n3).find((c) => c.method === 'DELETE');
s = await state(page);
const server3 = await serverCart(id);
check('3 Remove From Cart: loader, DELETE ?cartId → Success', loader3 && del3?.url === `/cart?cartId=${id}` && del3.body?.code === '200', JSON.stringify(del3));
check('3 after: cookie and summary gone, no count, Book Now, no reload, no dialog', !s.cookie && !s.stored && !s.count && s.label === 'Cart' && s.book === 'Book Now' && !s.open.length, JSON.stringify(s));
check('3 the server\'s cart is empty', Array.isArray(server3.products) && server3.products.length === 0 && server3.cartTotalPrice?.totalPrice === 0, JSON.stringify({ products: server3.products?.length, total: server3.cartTotalPrice?.totalPrice }));
await other.waitForTimeout(800);
check('3 another tab: no count', !(await state(other)).count);

// 4. add again; ⊗ → Cancel; ⊗ → Yes
await add();
const id4 = calls.filter((c) => c.method === 'POST').at(-1)?.body?.cartId;
await page.locator('dialog.mini-cart-modal[open] .mini-cart-remove').click();
await page.waitForSelector('dialog.cart-confirm-modal[open]');
const n4 = calls.length;
await page.locator('dialog.cart-confirm-modal[open] .cart-button', { hasText: 'Cancel' }).click();
await page.waitForTimeout(600);
s = await state(page);
check('4 Cancel: no request, the mini cart and the cart stay', calls.length === n4 && JSON.stringify(s.open) === '["mini-cart-modal"]' && s.cookie === id4 && s.count === '1', JSON.stringify(s));
await page.locator('dialog.mini-cart-modal[open] .mini-cart-remove').click();
await page.waitForSelector('dialog.cart-confirm-modal[open]');
let navigated4 = false;
page.on('framenavigated', (f) => { if (f === page.mainFrame()) navigated4 = true; });
await page.locator('dialog.cart-confirm-modal[open] .cart-button', { hasText: 'Yes' }).click();
await page.waitForFunction(() => !document.querySelector('dialog.mini-cart-modal[open]'), null, { timeout: 45000 });
await page.waitForTimeout(1500);
const del4 = calls.slice(n4).find((c) => c.method === 'DELETE');
s = await state(page);
const server4 = await serverCart(id4);
check('4 Yes: DELETE ?cartId → Success, no reload', del4?.url === `/cart?cartId=${id4}` && del4.body?.code === '200' && !navigated4, JSON.stringify(del4));
check('4 in place: no cart, no count, no dialog, Book Now', !s.cookie && !s.stored && !s.count && !s.open.length && s.book === 'Book Now', JSON.stringify(s));
check('4 the server\'s cart is empty', server4.products?.length === 0, `${server4.products?.length}`);
await other.waitForTimeout(800);
check('4 another tab: no count', !(await state(other)).count);
check('no page errors', !errors.length, errors.join(' | '));
console.log('calls', calls.map((c) => `${c.method} ${c.url} ${c.status}`).join(' | '));
console.log(`${failed} failed`);
await browser.close();
process.exit(failed ? 1 : 0);
