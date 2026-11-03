/*
 * The cart, without UI (see mini-cart.js): products go in through their type's adapter (only
 * lounges for now; lounge passes and others get their own adapter), after the cart's rules, as
 * the source's cart. The booking system's cart API makes a cart with the products (POST), reads
 * it back (GET) and deletes it (DELETE); there is no call yet to add to a cart or take a single
 * item out, so the cart holds one booking, as the source's does for a lounge, and taking it out
 * deletes the cart. The cart's id and a summary are kept by cart-state.js.
 */
import { getMetadata } from './aem.js';
import apiUrl from './endpoints.js';
import { chooseSlot, toStartDateTime } from './booking.js';
import { DEFAULT_SITE, getSiteFolder } from './i18n.js';
import {
  forgetCart, getCart, getCartId, saveCart,
} from './cart-state.js';

// the service answers in about 1-3s
const CART_TIMEOUT_MS = 20000;
// what the source's site sends with every cart
const ORDER = { pointOfPurchase: 'Online', channel: 'B2C', isThirdPartyFulfilment: false };

/**
 * The text a field holds, trimmed (without the service's zero-width spaces).
 * @param {*} value
 * @returns {string}
 */
function text(value) {
  return String(value ?? '').replace(/[\u200b-\u200d\ufeff]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * The page's language as the booking system takes it (as properties.js `getApiLanguage`): page
 * metadata `language-code`, else the site folder (en-uk is "en").
 * @returns {string}
 */
function apiLanguage() {
  const authored = getMetadata('language-code').trim();
  if (authored) return authored;
  const folder = getSiteFolder() || DEFAULT_SITE;
  return folder === 'en-uk' ? 'en' : folder;
}

/**
 * Fetches the cart service's JSON (a POST with `body`; or `method`, e.g. DELETE), giving up after
 * the timeout. A failure (HTTP, network, not JSON, or the service's error object: `{ errorCode,
 * message }`, or nested as `{ error: { … } }`) rejects with an Error carrying `status` and the
 * service's error as `service`.
 * @param {URL} url
 * @param {Object} [body]
 * @param {string} [method]
 * @returns {Promise<Object>}
 */
async function fetchJson(url, body, method) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CART_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      ...(method && { method }),
      ...(body && {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    });
    if (!resp.ok) throw Object.assign(new Error(`HTTP ${resp.status}`), { status: resp.status });
    const json = await resp.json();
    const failure = json?.errorCode ? json : json?.error && typeof json.error === 'object' && json.error;
    if (failure) {
      throw Object.assign(new Error(`${failure.errorCode || failure.code || 'error'}: ${failure.message || ''}`), { status: resp.status, service: failure });
    }
    return json;
  } catch (error) {
    if (error.status === undefined) error.status = 0;
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * How each type of product goes into the cart. An adapter checks what it was given (`check`
 * answers why it can't be added, or ''), makes the cart API's product from it (`toProduct`) in
 * its currency (`currency`), and a cart line from it (`toLine`), shown when the cart was made
 * but couldn't be read back.
 */
const ADAPTERS = {
  // a lounge booking from the homepage's lounge card (`booking-widget:book`): the product's
  // catalogue code, the visit's date and time at the lounge, and the guests
  lounge: {
    check(item) {
      const adults = Number.parseInt(item.adult, 10);
      const children = Number.parseInt(item.children, 10) || 0;
      const when = /^\d{4}-\d{2}-\d{2}$/.test(item.date || '') && /^\d{4}$/.test(item.time || '');
      if (!item.catalogueCode || !when) return 'invalid';
      // (the cart API itself takes 0 adults)
      if (!(adults >= 1) || children < 0) return 'invalid';
      // still bookable at the lounge: not before its first bookable slot (lead time included)
      const { timeZone, lead = 0 } = item.location || {};
      const slot = chooseSlot({ date: item.date, time: item.time }, timeZone, lead);
      if (slot.date !== item.date || slot.time !== item.time) return 'slot';
      return '';
    },
    toProduct(item) {
      return {
        catalogueCode: item.catalogueCode,
        startDate: toStartDateTime(item.date, item.time),
        quantity: 1,
        guestsCount: {
          adult: String(Number.parseInt(item.adult, 10)),
          child: String(Number.parseInt(item.children, 10) || 0),
        },
      };
    },
    currency: (item) => text(item.currency).toUpperCase(),
    toLine(item) {
      return {
        id: '',
        catalogueCode: item.catalogueCode,
        type: 'lounge',
        name: text(item.propertyName),
        product: text(item.productName),
        place: text(item.place),
        start: toStartDateTime(item.date, item.time),
        adults: Number.parseInt(item.adult, 10) || 1,
        children: Number.parseInt(item.children, 10) || 0,
        quantity: 1,
        total: Number(item.price),
      };
    },
  },
};

/**
 * The cart's rules, in turn: each answers why a product can't go in, or ''.
 */
const RULES = [
  // the source's: nothing goes into a cart that holds a booking ("Please proceed to checkout
  // before adding new item into cart.")
  ({ cart }) => (cart?.lines.length ? 'checkout-first' : ''),
];

/**
 * Adds a type of product to the cart (e.g. lounge passes, when their cart call exists).
 * @param {string} type
 * @param {{check: Function, toProduct: Function, currency: Function}} adapter
 */
export function registerAdapter(type, adapter) {
  ADAPTERS[type] = adapter;
}

/**
 * A cart line from the service's product: what the mini cart shows.
 * @param {Object} p
 * @returns {Object}
 */
function readLine(p) {
  const price = p?.itemPriceDetails?.productTotalPrice || {};
  return {
    id: text(p?.cartItemId),
    catalogueCode: text(p?.catalogueCode),
    // LOUNGE, GFTCRD (passes), …
    type: text(p?.propertyTypeCode).toLowerCase(),
    name: text(p?.propertyDisplayName) || text(p?.propertyName),
    product: text(p?.productDisplayName) || text(p?.productName),
    place: [p?.shortLocation, p?.locationName].map(text).filter(Boolean).join(', '),
    start: text(p?.startDate),
    adults: Number.parseInt(p?.guestsCount?.adult, 10) || 0,
    children: Number.parseInt(p?.guestsCount?.child, 10) || 0,
    quantity: Number.parseInt(p?.quantity, 10) || 1,
    total: Number(price.totalPrice),
  };
}

/**
 * The cart's summary from the service's cart: its lines, its currency and totals (the base,
 * each discount, the total).
 * @param {Object} json
 * @returns {Object}
 */
function readCart(json) {
  const totals = json?.cartTotalPrice || {};
  const products = Array.isArray(json?.products) ? json.products : [];
  const discounts = products
    .flatMap((p) => p?.itemPriceDetails?.discounts)
    .filter(Boolean)
    .map((d) => ({ name: text(d?.name), value: Number(d?.value) }))
    .filter((d) => d.name && Number.isFinite(d.value) && d.value > 0);
  return {
    cartId: text(json?.cartId),
    currency: text(json?.currency),
    lines: products.map(readLine).filter((line) => line.catalogueCode),
    totals: {
      base: Number(totals.totalBasePrice),
      discounts,
      total: Number(totals.totalPrice),
    },
  };
}

/**
 * Reads the cart from the booking system (in the page's language) and keeps its summary. A cart
 * the service no longer knows (BKNG001) is forgotten. Reading the cart this site has (no `cartId`
 * given) keeps the answer only if it is still that cart (not taken out meanwhile).
 * @param {string} [cartId] A cart just made, to keep
 * @returns {Promise<Object|null>}
 */
export async function refreshCart(cartId) {
  const id = cartId || getCartId();
  if (!id) return null;
  const url = apiUrl('cart');
  url.searchParams.set('cartId', id);
  url.searchParams.set('locale', apiLanguage());
  // (a background read: the cart may be taken out before it answers)
  const current = () => cartId || getCartId() === id;
  try {
    const cart = readCart(await fetchJson(url));
    if (!current()) return getCart();
    if (!cart.lines.length) {
      forgetCart();
      return null;
    }
    saveCart({ ...cart, cartId: id });
    return getCart();
  } catch (error) {
    if (error.service?.errorCode === 'BKNG001' && current()) {
      forgetCart();
      return null;
    }
    throw error;
  }
}

let pending = null;

/**
 * Adds a product to the cart. One at a time: while an add is under way, another click gets the
 * same answer.
 * @param {{type: string}} item The product, as its type's adapter takes it
 * @returns {Promise<{status: 'added'|'refused'|'failed', reason?: string, cart?: Object,
 *   error?: Error}>} refused: a rule or the adapter's check said no (`reason`); failed: the
 *   booking system didn't take it
 */
export function addToCart(item) {
  if (pending) return pending;
  pending = (async () => {
    const adapter = ADAPTERS[item?.type];
    if (!adapter) return { status: 'refused', reason: 'invalid' };
    let cart = getCart();
    // the booking system has the last word on what the cart holds (as the source's, where it
    // answers 409): a cart it no longer has doesn't hold the add back
    if (cart?.lines.length) {
      try {
        cart = await refreshCart();
      } catch { /* (unreachable: what this site knows stands) */ }
    }
    const rule = RULES.map((r) => r({ cart, item })).find(Boolean);
    if (rule) return { status: 'refused', reason: rule };
    const check = adapter.check(item);
    if (check) return { status: 'refused', reason: check };
    try {
      const answer = await fetchJson(apiUrl('cart'), {
        currency: adapter.currency(item), products: [adapter.toProduct(item)], ...ORDER,
      });
      const cartId = text(answer?.cartId);
      if (!cartId) throw new Error('no cartId');
      try {
        return { status: 'added', cart: await refreshCart(cartId) };
      } catch (error) {
        // the cart was made: keep it, with what the page knows of the product
        // eslint-disable-next-line no-console
        console.warn('cart: the cart could not be read back', error);
        const line = adapter.toLine(item);
        saveCart({
          cartId,
          currency: adapter.currency(item),
          lines: [line],
          totals: { base: line.total, discounts: [], total: line.total },
        });
        return { status: 'added', cart: getCart() };
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('cart: the product was not added', error);
      return { status: 'failed', error };
    }
  })().finally(() => { pending = null; });
  return pending;
}

/**
 * Deletes the cart in the booking system (DELETE ?cartId=; it empties the cart), then forgets it
 * here. A cart the system doesn't know (CRT_ERR_004, or BKNG001) is gone already: forgotten too.
 * Any other failure keeps it.
 * @param {string} [cartId]
 * @param {{quiet?: boolean}} [options] quiet: no `cart:change` (the page loads again next)
 * @returns {Promise<{status: 'removed'|'failed', error?: Error}>}
 */
export async function deleteCart(cartId = getCartId(), { quiet = false } = {}) {
  if (!cartId) return { status: 'removed' };
  const url = apiUrl('cart');
  url.searchParams.set('cartId', cartId);
  try {
    await fetchJson(url, undefined, 'DELETE');
  } catch (error) {
    if (!['CRT_ERR_004', 'BKNG001'].includes(error.service?.errorCode)) {
      // eslint-disable-next-line no-console
      console.error('cart: the cart was not deleted', error);
      return { status: 'failed', error };
    }
  }
  // (unless it's another cart by now)
  if (getCartId() === cartId) forgetCart(!quiet);
  return { status: 'removed' };
}

let removing = null;

/**
 * Takes a product out of the cart. The cart holds one booking and the booking system deletes
 * carts (not single items yet), so the cart is deleted. One at a time: a second click while it's
 * under way gets the same answer.
 * @param {string} catalogueCode
 * @param {{quiet?: boolean}} [options] quiet: no `cart:change` (the page loads again next)
 * @returns {Promise<{status: 'removed'|'failed'|'absent', error?: Error}>} absent: it wasn't in
 *   the cart
 */
export function removeFromCart(catalogueCode, { quiet = false } = {}) {
  if (removing) return removing;
  const cart = getCart();
  if (!cart?.lines.some((line) => line.catalogueCode === catalogueCode)) {
    return Promise.resolve({ status: 'absent' });
  }
  removing = deleteCart(cart.cartId, { quiet }).finally(() => { removing = null; });
  return removing;
}
