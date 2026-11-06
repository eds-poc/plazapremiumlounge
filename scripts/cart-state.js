/*
 * The cart's state on this site, shared by the header, the blocks that sell and the cart itself
 * (kept small, so the header can show the count without loading the cart):
 * - the cart's id in the cookie `cartid` (24 hours, as the source's),
 * - a summary of the booking system's last answer for it in localStorage `ppl-cart`, so the
 *   header count and the mini cart show at once, without a request.
 * Every change is announced as `cart:change` on document (another tab's too).
 */

export const CART_EVENT = 'cart:change';
const COOKIE = 'cartid';
const KEY = 'ppl-cart';
// the source's cart cookie lasts a day
const LIFETIME_MS = 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The cart's id from its cookie, or '' without one.
 * @returns {string}
 */
export function getCartId() {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

/**
 * Forgets the cart on this site: its cookie and its summary.
 * @param {boolean} [announce] Announce the change (`cart:change`)
 */
export function forgetCart(announce = true) {
  document.cookie = `${COOKIE}=; path=/; max-age=0; samesite=lax`;
  try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
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
 * The cart's summary: its lines, totals and count (see cart.js `readCart`), or null without a
 * cart. A summary without its cookie, or past its day, or whose bookings are over is forgotten.
 * @returns {Object|null}
 */
export function getCart() {
  let cart = null;
  try { cart = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { cart = null; }
  if (!cart) return null;
  const id = getCartId();
  const lines = Array.isArray(cart.lines) ? cart.lines : [];
  const over = !(cart.expires > Date.now()) || !lines.length || lines.every(isPast);
  if (!id || cart.cartId !== id || over) {
    forgetCart(false);
    return null;
  }
  return cart;
}

/**
 * The number shown on the header's cart: the lines' quantities, as the source's.
 * @param {Object|null} [cart]
 * @returns {number}
 */
export function cartCount(cart = getCart()) {
  return (cart?.lines || []).reduce((sum, line) => sum + (Number(line.quantity) || 1), 0);
}

/**
 * Whether the cart holds this product (its catalogue code).
 * @param {string} catalogueCode
 * @returns {boolean}
 */
export function isInCart(catalogueCode) {
  return !!catalogueCode && !!getCart()?.lines.some((line) => line.catalogueCode === catalogueCode);
}

/**
 * Keeps the cart: its id in the cookie (for a day from when the cart was made) and its summary.
 * @param {Object} cart A summary with `cartId` and `lines`
 */
export function saveCart(cart) {
  const known = getCartId() === cart.cartId ? getCart() : null;
  const expires = known?.expires || Date.now() + LIFETIME_MS;
  const kept = { ...cart, expires };
  const maxAge = Math.max(0, Math.round((expires - Date.now()) / 1000));
  document.cookie = `${COOKIE}=${encodeURIComponent(cart.cartId)}; path=/; max-age=${maxAge}; samesite=lax`;
  try { localStorage.setItem(KEY, JSON.stringify(kept)); } catch { /* storage unavailable */ }
  document.dispatchEvent(new CustomEvent(CART_EVENT, { detail: { cart: kept } }));
}

/**
 * Calls `listener(cart)` whenever the cart changes, here or in another tab.
 * @param {(cart: Object|null) => void} listener
 */
export function onCartChange(listener) {
  document.addEventListener(CART_EVENT, () => listener(getCart()));
  window.addEventListener('storage', (e) => {
    if (e.key === KEY || e.key === null) listener(getCart());
  });
}
