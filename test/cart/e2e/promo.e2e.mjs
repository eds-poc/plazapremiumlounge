// The promo code end to end on the real stage passes, cart and promo APIs (dev only; HOST: the
// local preview or a branch preview, WIDTH, PLAYWRIGHT, CODE: a working pass code, default
// PASS10PW), on the passes page. Nothing is routed; after each step the mini cart and the stored
// cart are compared with a fresh GET.
// 1. a pass; a wrong code (BKNG048's message), the code in lower case (refused: case sensitive)
// 2. the code applied: the promo row, the total, read only, the GET's per-line code
// 3. Add More and another pass: the code sent again, still applied on every line
// 4. the code removed (the passes sent again): no promo in the mini cart or the GET
// 5. the passes taken out (DELETE), a new cart: no code
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');

const HOST = process.env.HOST || 'http://localhost:3001';
const WIDTH = Number(process.env.WIDTH || 1440);
const CODE = process.env.CODE || 'PASS10PW';
const PPG = 'https://1074235-ppginternal-stage.adobeioruntime.net/api/v1/web/ppg-app';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
// stage passes (PRPRTY1235): Global 2-Visit, Hong Kong and Shanghai 2-Visit
const [A, D] = ['PRD3705', 'PRD3676'];
let failed = 0;
const check = (name, ok, info = '') => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${WIDTH} ${name}${info ? ` — ${info}` : ''}`); };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: WIDTH, height: WIDTH < 768 ? 812 : 900 }, userAgent: UA });
page.setDefaultTimeout(30000);
const made = new Set();

await page.goto(`${HOST}/en-uk/airport-lounge-passes?currencyCode=USD`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => document.querySelectorAll('button[data-pass-add]').length >= 3, null, { timeout: 60000 });
await page.waitForTimeout(800);
const button = (product) => page.locator(`button[data-pass-add][data-catalogue-code^="${product}-"]`).first();
const cartId = () => page.evaluate(() => JSON.parse(localStorage.getItem('ppl-cart-id') || 'null')?.id || null);
const getCart = async (id) => (await fetch(`${PPG}/cart?cartId=${id}&locale=en`)).json();
const closeMini = async () => {
  await page.locator('dialog.mini-cart-modal[open] .modal-close').click().catch(() => {});
  await page.waitForTimeout(300);
};
const add = async (product) => {
  await closeMini();
  await button(product).click();
  await page.waitForSelector('dialog.mini-cart-modal[open]', { timeout: 60000 });
  await page.waitForFunction(() => !document.getElementById('spinner-overlay'), null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);
  made.add(await cartId());
};
const mini = () => page.evaluate(() => {
  const d = document.querySelector('dialog.mini-cart-modal[open]');
  const input = d?.querySelector('.mini-cart-promo-input');
  return d && {
    rows: [...d.querySelectorAll('.mini-cart-row')].map((r) => r.textContent.replace(/\s+/g, ' ').trim()),
    value: input?.value,
    readOnly: input?.readOnly,
    message: d.querySelector('.mini-cart-promo-message')?.textContent || '',
  };
});
const apply = async (code) => {
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-input').fill(code);
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-apply').click();
  await page.waitForFunction(() => document.querySelector('dialog.mini-cart-modal[open] .mini-cart-promo-remove, dialog.mini-cart-modal[open] .mini-cart-promo-message:not(:empty)'), null, { timeout: 30000 });
  await page.waitForTimeout(500);
};
const promoOf = (cart) => ({
  amount: cart?.cartTotalPrice?.totalPromocodeAmount,
  total: cart?.cartTotalPrice?.totalPrice,
  codes: (cart?.products || []).map((p) => p.itemPriceDetails?.promocode?.[0]?.code || ''),
});
const money = (n) => `USD ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// 1. a pass, a wrong code, the code in lower case
await add(A);
await apply('ZZNOTACODE1');
let m = await mini();
check('a wrong code: BKNG048\'s message, the field editable', m.message === 'No record found for the provided promotional code.' && !m.readOnly, m.message);
await apply(CODE.toLowerCase());
m = await mini();
check('the code in lower case: refused (case sensitive)', /No record found/.test(m.message) && !m.readOnly, m.message);

// 2. applied
await apply(CODE);
m = await mini();
let fresh = promoOf(await getCart(await cartId()));
check('applied: the GET has the code on the line and a promo amount', fresh.amount > 0 && fresh.codes.every((c) => c === CODE), JSON.stringify(fresh));
check('applied: the promo row and the total as the GET, the code read only', m.readOnly && m.value === CODE && m.rows.some((r) => r === `Promo Code (${CODE}):- ${money(fresh.amount)}`) && m.rows.at(-1).endsWith(money(fresh.total)), JSON.stringify({ rows: m.rows, fresh }));

// 3. Add More, another pass
await add(A);
m = await mini();
fresh = promoOf(await getCart(await cartId()));
check('Add More: the code still on the line (sent again), the mini cart as the GET', fresh.amount > 0 && fresh.codes.every((c) => c === CODE) && m.readOnly && m.rows.at(-1).endsWith(money(fresh.total)), JSON.stringify({ rows: m.rows, fresh }));
await add(D);
m = await mini();
fresh = promoOf(await getCart(await cartId()));
check('another pass: the code on both lines, the promo row as the GET', fresh.codes.length === 2 && fresh.codes.every((c) => c === CODE) && m.rows.some((r) => r === `Promo Code (${CODE}):- ${money(fresh.amount)}`) && m.rows.at(-1).endsWith(money(fresh.total)), JSON.stringify({ rows: m.rows, fresh }));

// 4. removed
await page.locator('dialog.mini-cart-modal[open] .mini-cart-promo-remove').click();
await page.waitForSelector('dialog.cart-confirm-modal[open]');
await page.locator('dialog.cart-confirm-modal[open] .cart-button', { hasText: 'Confirm' }).click();
await page.waitForSelector('dialog.mini-cart-modal[open] .mini-cart-promo-apply', { timeout: 60000 });
await page.waitForTimeout(800);
m = await mini();
fresh = promoOf(await getCart(await cartId()));
const stored = await page.evaluate(() => JSON.parse(sessionStorage.getItem('ppl-cart') || 'null'));
check('removed: no code in the GET, the mini cart or the stored cart', !fresh.amount && fresh.codes.every((c) => !c) && !m.rows.some((r) => r.startsWith('Promo Code')) && !m.readOnly && !stored?.promoCode && !(stored?.totals?.promo > 0), JSON.stringify({ rows: m.rows, fresh, promo: stored?.promoCode }));

// 5. applied again, the passes taken out, a new cart
await apply(CODE);
for (let i = 0; i < 2; i += 1) {
  // eslint-disable-next-line no-await-in-loop
  await page.locator('dialog.mini-cart-modal[open] .mini-cart-remove').first().click();
  // eslint-disable-next-line no-await-in-loop
  await page.waitForSelector('dialog.cart-confirm-modal[open]');
  // eslint-disable-next-line no-await-in-loop
  await page.locator('dialog.cart-confirm-modal[open] .cart-button', { hasText: 'Yes' }).click();
  // eslint-disable-next-line no-await-in-loop
  await page.waitForTimeout(4000);
}
check('the passes taken out: the cart forgotten', !(await cartId()));
await add(A);
m = await mini();
fresh = promoOf(await getCart(await cartId()));
check('a new cart: no code anywhere', !fresh.amount && fresh.codes.every((c) => !c) && !m.readOnly && m.value === '' && !m.rows.some((r) => r.startsWith('Promo Code')), JSON.stringify({ rows: m.rows, fresh }));

// clean up: the carts made here
for (const id of made) {
  // eslint-disable-next-line no-await-in-loop
  if (id) await fetch(`${PPG}/cart?cartId=${id}`, { method: 'DELETE' }).catch(() => {});
}
await browser.close();
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
