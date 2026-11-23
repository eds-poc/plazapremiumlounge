// The lounge page's Reserve Now with the cart (blocks/property-detail, scripts/mini-cart.js
// checkAndShow): a cart that already holds an item (a lounge, or passes) gets the source's
// Checkout Cart dialog, "Please proceed to checkout before adding new item into cart.", and the
// cart doesn't change; an empty cart goes on as before (`property-detail:reserve`). The page is
// /en-uk/find/lounge?propertycode=PRPRTY1219 (the lounge detail and price services as they are);
// the booking system's cart is routed (GET: the fixture; anything else is counted and refused).
// Usage: BW_HOST=… node reserve-now.test.mjs
import { readFileSync } from 'node:fs';
import { PW, UA } from '../booking-widget/harness.mjs';

const { chromium } = await import(PW);
const HOST = process.env.BW_HOST || 'http://localhost:3000';
const LOUNGE = JSON.parse(readFileSync(new URL('./fixtures/cart.json', import.meta.url), 'utf8'));
const PASS = JSON.parse(readFileSync(new URL('./fixtures/cart-pass.json', import.meta.url), 'utf8'));
const THIRD = /googletagmanager|adobedtm|netcore|facebook|stackadapt|yimg|hansel|consentag\.eu|ctnsnet|bing|denomatic|affilired|lkh\.plaza|cookielaw|hcaptcha|redintelligence|ad-srv/;
const day = (n) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Addis_Ababa' }).format(new Date(Date.now() + n * 864e5));
const PATH = `/en-uk/find/lounge?propertycode=PRPRTY1219&currency=USD&date=${day(8)}&time=1700`;
const TEXT = 'Please proceed to checkout before adding new item into cart.';
const browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] });
let failed = 0;
const check = (name, ok, info = '') => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info ? ` — ${info}` : ''}`); };

/** The page with `cart` in the booking system ('lounge', 'pass' or null: no cart kept). */
async function open({ cart = 'lounge', width = 1440, height = 900 } = {}) {
  const page = await browser.newPage({ viewport: { width, height }, userAgent: UA });
  page.setDefaultTimeout(20000);
  page.calls = [];
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.route(THIRD, (r) => r.abort());
  await page.route(/ppg-app\/cart(\?|$)/, async (r) => {
    const method = r.request().method();
    if (method === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    page.calls.push(method);
    if (method !== 'GET') {
      return r.fulfill({
        status: 500, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}',
      });
    }
    const body = structuredClone(cart === 'pass' ? PASS : LOUNGE);
    body.cartId = 'CRT_TEST';
    if (cart === 'lounge') body.products[0].startDate = `${day(7)} 15:00:00`;
    return r.fulfill({
      status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body),
    });
  });
  if (cart) {
    await page.addInitScript(() => localStorage.setItem('ppl-cart-id', JSON.stringify({
      id: 'CRT_TEST', expires: Date.now() + 20 * 3600e3, changed: Date.now(), count: 1, codes: [],
    })));
  }
  await page.addInitScript(() => {
    window.reserved = [];
    document.addEventListener('property-detail:reserve', (e) => window.reserved.push(e.detail?.price?.total ?? null));
  });
  await page.goto(`${HOST}${PATH}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForSelector('.property-detail[data-block-status="loaded"]', { timeout: 30000 });
  await page.waitForTimeout(2500);
  return page;
}

/** Get Price, then Reserve Now (the desktop panel's; on phones, in the Book Your Visit dialog). */
async function reserve(page) {
  if (await page.locator('.property-detail-bar-book').isVisible()) {
    await page.locator('.property-detail-bar-book').click();
    await page.waitForSelector('dialog.property-detail-modal[open]');
  }
  await page.locator('.property-detail-get-price:not(.property-detail-reserve):visible').first().click();
  await page.locator('.property-detail-reserve:visible').first().waitFor({ timeout: 30000 });
  const before = page.calls.length;
  await page.locator('.property-detail-reserve:visible').first().click();
  await page.waitForTimeout(2500);
  return before;
}

const dialog = (page) => page.evaluate(() => {
  const d = document.querySelector('dialog.cart-message-modal[open]');
  if (!d) return null;
  const css = (n, k) => (n ? getComputedStyle(n)[k] : '');
  const head = d.querySelector('.modal-header');
  const title = d.querySelector('.modal-title');
  const p = d.querySelector('.cart-dialog-body p, .modal-body p');
  const b = d.querySelector('.cart-button, .modal-body .button');
  const r = d.getBoundingClientRect();
  return {
    title: title?.textContent.trim(),
    text: p?.textContent.trim(),
    button: b?.textContent.trim(),
    box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
    radius: css(d.querySelector('.modal-content') || d, 'borderTopLeftRadius'),
    headBg: css(head, 'backgroundColor'),
    titleColor: css(title, 'color'),
    titleSize: css(title, 'fontSize'),
    pSize: css(p, 'fontSize'),
    buttonBg: css(b, 'backgroundColor'),
    buttonWidth: Math.round(b?.getBoundingClientRect().width || 0),
    bodyWidth: Math.round(d.querySelector('.modal-body, .cart-dialog-body')?.getBoundingClientRect().width || 0),
  };
});

// 1. a lounge in the cart (1440): the Checkout Cart dialog, the cart unchanged, nothing reserved
{
  const page = await open();
  const before = await reserve(page);
  const d = await dialog(page);
  const after = page.calls.slice(before);
  const reserved = await page.evaluate(() => window.reserved.length);
  check('a lounge in the cart: "Checkout Cart" / the message / View Cart', d?.title === 'Checkout Cart' && d?.text === TEXT && d?.button === 'View Cart', JSON.stringify(d));
  check('…the cart only read (GET), nothing added, removed or changed; nothing reserved', after.length >= 1 && after.every((m) => m === 'GET') && !reserved, JSON.stringify({ after, reserved }));
  const vw = 1440;
  check('…the source\'s look: centred 500px, maroon title bar, white 21px title (at every width), 16px text, the full-width maroon button', d && Math.abs(d.box[0] + d.box[2] / 2 - vw / 2) <= 2 && d.box[2] === 500 && d.headBg === 'rgb(83, 14, 42)' && d.titleColor === 'rgb(255, 255, 255)' && d.titleSize === '21px' && d.pSize === '16px' && d.buttonBg === 'rgb(104, 18, 53)' && Math.abs(d.buttonWidth - d.bodyWidth + 32) <= 2, JSON.stringify(d));
  // static, as the source's: Esc doesn't close it
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  check('…Esc doesn\'t close it (the source\'s is static)', !!(await dialog(page)));
  // View Cart: the dialog closes and the mini cart opens, the cart as it was
  await page.locator('dialog.cart-message-modal[open] .cart-button, dialog.cart-message-modal[open] .modal-body .button').first().click();
  await page.waitForTimeout(1500);
  const mini = await page.evaluate(() => ({
    message: !!document.querySelector('dialog.cart-message-modal[open]'),
    lines: [...document.querySelectorAll('dialog.mini-cart-modal[open] .mini-cart-name, dialog.mini-cart-modal[open] h3, dialog.mini-cart-modal[open] h5')].map((n) => n.textContent.trim()).filter(Boolean),
  }));
  check('View Cart: the dialog closes, the mini cart opens with the cart\'s lounge', !mini.message && mini.lines.some((t) => /Plaza Premium Lounge/.test(t)), JSON.stringify(mini));
  // the ✕ of a second refusal
  await page.keyboard.press('Escape');
  await page.locator('dialog.mini-cart-modal[open] .modal-close').first().click().catch(() => {});
  await page.waitForTimeout(500);
  await page.locator('.property-detail-reserve:visible').first().click();
  await page.waitForTimeout(2000);
  await page.locator('dialog.cart-message-modal[open] .modal-close').first().click();
  await page.waitForTimeout(500);
  check('again: the dialog again; ✕ closes it; still nothing reserved, the cart only read', !(await dialog(page)) && !(await page.evaluate(() => window.reserved.length)) && page.calls.every((m) => m === 'GET'), JSON.stringify(page.calls));
  check('no page errors', !page.errors.length, page.errors.join(' | '));
  await page.close();
}

// 2. passes in the cart: the same dialog (a lounge only goes into an empty cart, as the source's)
{
  const page = await open({ cart: 'pass' });
  await reserve(page);
  const d = await dialog(page);
  check('passes in the cart: the Checkout Cart dialog, nothing reserved, the cart only read', d?.text === TEXT && !(await page.evaluate(() => window.reserved.length)) && page.calls.every((m) => m === 'GET'), JSON.stringify([d?.text, page.calls]));
  await page.close();
}

// 3. no cart: no dialog, Reserve Now as before (its event, with the price), no cart call
{
  const page = await open({ cart: null });
  await reserve(page);
  const reserved = await page.evaluate(() => window.reserved);
  check('no cart: no dialog, Reserve Now announced with its price, no cart call', !(await dialog(page)) && reserved.length === 1 && reserved[0] > 0 && !page.calls.length, JSON.stringify({ reserved, calls: page.calls }));
  await page.close();
}

// 4. phones (375): Reserve Now in the Book Your Visit dialog; the Checkout Cart dialog over it (as
// the source's over #mobileVisit), within the screen, centred, its 21px title; ✕ leaves the
// booking dialog open
{
  const page = await open({ width: 375, height: 812 });
  await reserve(page);
  const d = await dialog(page);
  const open1 = await page.evaluate(() => [...document.querySelectorAll('dialog.modal[open]')].map((x) => x.classList[1]));
  check('375: the Checkout Cart dialog over the booking dialog, within the screen, centred, 21px title; nothing reserved', d?.text === TEXT && JSON.stringify(open1) === JSON.stringify(['property-detail-modal', 'cart-message-modal']) && d.box[0] >= 0 && d.box[0] + d.box[2] <= 375 && Math.abs(d.box[0] + d.box[2] / 2 - 187.5) <= 2 && d.titleSize === '21px' && !(await page.evaluate(() => window.reserved.length)), JSON.stringify({ d, open1 }));
  await page.locator('dialog.cart-message-modal[open] .modal-close').click();
  await page.waitForTimeout(500);
  const open2 = await page.evaluate(() => [...document.querySelectorAll('dialog.modal[open]')].map((x) => x.classList[1]));
  check('375: ✕ closes it, the booking dialog stays open with Reserve Now', JSON.stringify(open2) === JSON.stringify(['property-detail-modal']) && await page.locator('dialog.property-detail-modal[open] .property-detail-reserve').isVisible(), JSON.stringify(open2));
  await page.close();
}

// 5. axe on the dialog
if (process.env.AXE_CORE) {
  const page = await open();
  await reserve(page);
  await page.addScriptTag({ path: process.env.AXE_CORE });
  const violations = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const r = await axe.run({ include: [['dialog.cart-message-modal[open]']] }, { runOnly: ['wcag2a', 'wcag2aa'] });
    return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join('; ')}`);
  });
  check('axe: the dialog has no violations', !violations.length, violations.join(' | '));
  await page.close();
}

await browser.close();
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
