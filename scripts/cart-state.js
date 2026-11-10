/*
 * The cart's state on this site, shared by the header, the blocks that sell and the cart itself
 * (kept small, so the header can show the count without loading the cart):
 * - the cart's id in localStorage `ppl-cart-id` (every tab's): `{ id, expires, changed, count,
 *   codes, sig }`, for 24 hours from when the cart was made (as the source's cart cookie). With
 *   it, the count and the products in the cart (their catalogue codes, no prices), so a new tab
 *   shows the header count and the buttons' labels at once; `changed` (and `sig`, what changed)
 *   tell other tabs the cart changed;
 * - the cart's data (the booking system's last answer: lines, prices, totals, currency, promo) in
 *   sessionStorage `ppl-cart` (this tab's), for 2 hours from that answer, then read again: prices
 *   come from the booking system, the copy is only for showing the mini cart at once.
 * Every change is announced as `cart:change` on document (another tab's too); a tab that needs the
 * booking system's answer again (another tab changed the cart) is told by `cart:stale`.
 */

export const CART_EVENT = 'cart:change';
export const STALE_EVENT = 'cart:stale';
const ID_KEY = 'ppl-cart-id';
const DATA_KEY = 'ppl-cart';
// the cart's id lasts a day (as the source's cart cookie); its data in a tab, 2 hours
const ID_LIFETIME_MS = 24 * 60 * 60 * 1000;
const DATA_LIFETIME_MS = 2 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
// what earlier versions kept (the cookie and the data in localStorage), moved once
const OLD_COOKIE = 'cartid';

// when the browser's storage is blocked (or full), the cart is kept for this page only
const memory = new Map();

/**
 * A storage, by name, or null when the browser blocks it.
 * @param {'localStorage'|'sessionStorage'} name
 * @returns {Storage|null}
 */
function store(name) {
  try {
    return window[name];
  } catch {
    return null;
  }
}

/**
 * Reads a JSON value from a storage (null when it's missing or broken); blocked storage reads
 * what this page kept.
 * @param {'localStorage'|'sessionStorage'} name
 * @param {string} key
 * @returns {*}
 */
function read(name, key) {
  try {
    return JSON.parse(store(name).getItem(key) || 'null');
  } catch {
    return memory.get(`${name}:${key}`) ?? null;
  }
}

/**
 * Writes a JSON value to a storage; blocked or full, this page keeps it.
 * @param {'localStorage'|'sessionStorage'} name
 * @param {string} key
 * @param {*} value
 */
function write(name, key, value) {
  memory.set(`${name}:${key}`, value);
  try {
    store(name).setItem(key, JSON.stringify(value));
    memory.delete(`${name}:${key}`);
  } catch { /* storage unavailable: kept for this page */ }
}

/**
 * Removes a key from a storage (and what this page kept).
 * @param {'localStorage'|'sessionStorage'} name
 * @param {string} key
 */
function remove(name, key) {
  memory.delete(`${name}:${key}`);
  try {
    store(name).removeItem(key);
  } catch { /* storage unavailable */ }
}

/**
 * Moves an earlier version's cart (the cookie `cartid` and the data in localStorage `ppl-cart`)
 * to the id entry, once: the id, its day and the count and codes stay; the prices are read again.
 */
function migrate() {
  const cookie = document.cookie.match(new RegExp(`(?:^|; )${OLD_COOKIE}=([^;]*)`));
  const old = read('localStorage', DATA_KEY);
  if (!cookie && !old) return;
  const id = cookie ? decodeURIComponent(cookie[1]) : '';
  if (id && !read('localStorage', ID_KEY)) {
    const lines = old?.cartId === id && Array.isArray(old.lines) ? old.lines : [];
    write('localStorage', ID_KEY, {
      id,
      expires: Number(old?.expires) > Date.now()
        ? Number(old.expires) : Date.now() + ID_LIFETIME_MS,
      changed: Date.now(),
      count: lines.reduce((sum, line) => sum + (Number(line.quantity) || 1), 0),
      codes: lines.map((line) => line.catalogueCode).filter(Boolean),
    });
  }
  document.cookie = `${OLD_COOKIE}=; path=/; max-age=0; samesite=lax`;
  remove('localStorage', DATA_KEY);
}
migrate();

/**
 * The cart's id entry, or null without one (or past its day, then forgotten).
 * @returns {{id: string, expires: number, changed: number, count: number, codes: string[]}|null}
 */
function readEntry() {
  const entry = read('localStorage', ID_KEY);
  if (!entry?.id) return null;
  if (!(entry.expires > Date.now())) {
    remove('localStorage', ID_KEY);
    remove('sessionStorage', DATA_KEY);
    return null;
  }
  return entry;
}

/**
 * The cart's id, or '' without a cart.
 * @returns {string}
 */
export function getCartId() {
  return readEntry()?.id || '';
}

/**
 * Forgets the cart on this site: its id (every tab's) and this tab's data.
 * @param {boolean} [announce] Announce the change (`cart:change`)
 */
export function forgetCart(announce = true) {
  remove('localStorage', ID_KEY);
  remove('sessionStorage', DATA_KEY);
  if (announce) document.dispatchEvent(new CustomEvent(CART_EVENT, { detail: { cart: null } }));
}

/**
 * Whether a cart line's start (lounge-local "YYYY-MM-DD HH:mm:ss") is over: before yesterday
 * in UTC, so no time zone can still be on that day.
 * @param {{start?: string}} line
 * @returns {boolean}
 */
function isPast(line) {
  const day = /^\d{4}-\d{2}-\d{2}/.exec(line.start || '')?.[0];
  return !!day && day < new Date(Date.now() - DAY_MS).toISOString().slice(0, 10);
}

/**
 * The cart's data in this tab: its lines, totals and count (see cart.js `readCart`), or null
 * without it: no cart, another cart's data, or data past its 2 hours (dropped; the cart is read
 * again). A cart whose bookings are all over is forgotten.
 * @returns {Object|null}
 */
export function getCart() {
  const cart = read('sessionStorage', DATA_KEY);
  if (!cart) return null;
  const id = getCartId();
  const lines = Array.isArray(cart.lines) ? cart.lines : [];
  if (!id || cart.cartId !== id || !(cart.expires > Date.now())) {
    remove('sessionStorage', DATA_KEY);
    return null;
  }
  if (!lines.length || lines.every(isPast)) {
    forgetCart(false);
    return null;
  }
  return cart;
}

/**
 * Whether this site has a cart whose data this tab hasn't got (a new tab, data past its 2 hours,
 * or another tab changed the cart): it should be read from the booking system.
 * @returns {boolean}
 */
export function needsRead() {
  return !!getCartId() && !getCart();
}

/**
 * The number shown on the header's cart: the lines' quantities, as the source's (without this
 * tab's data: the count kept with the cart's id).
 * @param {Object|null} [cart]
 * @returns {number}
 */
export function cartCount(cart = getCart()) {
  const lines = cart?.lines || [];
  if (lines.length) return lines.reduce((sum, line) => sum + (Number(line.quantity) || 1), 0);
  return Number(readEntry()?.count) || 0;
}

/**
 * Whether the cart holds this product (its catalogue code): from this tab's data, else from the
 * codes kept with the cart's id.
 * @param {string} catalogueCode
 * @returns {boolean}
 */
export function isInCart(catalogueCode) {
  if (!catalogueCode) return false;
  const cart = getCart();
  if (cart) return cart.lines.some((line) => line.catalogueCode === catalogueCode);
  return !!readEntry()?.codes?.includes(catalogueCode);
}

/**
 * Keeps the cart: its id entry (for a day from when the cart was made; the count and codes; the
 * change for other tabs) and this tab's data (for 2 hours from now: it's the booking system's
 * answer, or what the page knew right after a change).
 * @param {Object} cart A summary with `cartId` and `lines`
 */
export function saveCart(cart) {
  const known = readEntry();
  const now = Date.now();
  const lines = Array.isArray(cart.lines) ? cart.lines : [];
  // what other tabs need to know changed: the lines, quantities, amounts, currency and promo. The
  // same answer read again keeps the entry as it was (no storage event, so tabs don't keep
  // signalling each other's reads)
  const sig = JSON.stringify([cart.currency || '', cart.totals?.total ?? '', cart.promoCode || '',
    lines.map((line) => [line.catalogueCode, line.quantity, line.total])]);
  const same = known?.id === cart.cartId && known.sig === sig;
  write('localStorage', ID_KEY, {
    id: cart.cartId,
    expires: known?.id === cart.cartId ? known.expires : now + ID_LIFETIME_MS,
    changed: same ? known.changed : now,
    count: lines.reduce((sum, line) => sum + (Number(line.quantity) || 1), 0),
    codes: lines.map((line) => line.catalogueCode).filter(Boolean),
    sig,
  });
  const kept = { ...cart, fetchedAt: now, expires: now + DATA_LIFETIME_MS };
  write('sessionStorage', DATA_KEY, kept);
  document.dispatchEvent(new CustomEvent(CART_EVENT, { detail: { cart: kept } }));
}

// another tab changed the cart (its id entry): this tab's data is out of date. It's dropped, the
// page shows the entry's count and codes at once, and whoever reads the cart is told to
// (`cart:stale`); a forgotten cart is forgotten here too
window.addEventListener('storage', (e) => {
  if (e.key !== ID_KEY && e.key !== null) return;
  remove('sessionStorage', DATA_KEY);
  const stale = !!getCartId();
  document.dispatchEvent(new CustomEvent(CART_EVENT, { detail: { cart: null, stale } }));
  if (getCartId()) document.dispatchEvent(new CustomEvent(STALE_EVENT));
});

/**
 * Calls `listener(cart)` whenever the cart changes, here or in another tab (`cart` is this tab's
 * data, or null: no cart, or not read yet; cartCount and isInCart still answer from the id).
 * @param {(cart: Object|null) => void} listener
 */
export function onCartChange(listener) {
  document.addEventListener(CART_EVENT, () => listener(getCart()));
}
