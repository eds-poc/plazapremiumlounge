/*
 * The cart, without UI (see mini-cart.js): products go in through their type's adapter (lounges
 * and lounge passes; others get their own adapter), after the cart's rules, as the source's cart:
 * a lounge only into an empty cart, passes together (the same pass again is one more of it). The
 * booking system's cart API makes a cart with the products (POST), reads it back (GET), replaces
 * its products (PUT: how a pass joins a cart, one more of it is counted, or a line goes) and
 * deletes it (DELETE: taking out its last line). The cart's id and a summary are kept by
 * cart-state.js.
 */
import { getMetadata } from './aem.js';
import apiUrl from './endpoints.js';
import {
  DAY_MINUTES, chooseSlot, nextDay, nowAt, toStartDateTime, toTime,
} from './booking.js';
import { DEFAULT_SITE, getSiteFolder } from './i18n.js';
import {
  forgetCart, getCart, getCartId, saveCart,
} from './cart-state.js';

// the service answers in about 1-3s
const CART_TIMEOUT_MS = 20000;
// what the source's site sends with every cart (and an adapter's `order`, e.g. a lounge's)
const ORDER = { pointOfPurchase: 'Online', channel: 'B2C' };
// passes are sold from Hong Kong: their start is in its time (the service refuses a start that's
// past there; the passes service gives no time zone), an hour ahead, as the source's
const PASS_TIME_ZONE = 'Asia/Hong_Kong';
const PASS_LEAD_MINUTES = 60;

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
 * Fetches the cart service's JSON (a POST with `body`, or `method` with it: PUT; or `method`
 * alone, e.g. DELETE), giving up after
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
        method: method || 'POST',
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
 * A pass's start as the cart takes it: an hour from now, in Hong Kong ("2026-11-04 19:49:00").
 * @returns {string}
 */
export function passStart() {
  const { date, minutes } = nowAt(PASS_TIME_ZONE);
  const later = minutes + PASS_LEAD_MINUTES;
  return toStartDateTime(later >= DAY_MINUTES ? nextDay(date) : date, toTime(later % DAY_MINUTES));
}

/**
 * A pass as the cart API takes it.
 * @param {string} catalogueCode
 * @param {number} quantity
 * @returns {{catalogueCode: string, quantity: string, startDate: string}}
 */
function passProduct(catalogueCode, quantity) {
  return { catalogueCode, quantity: String(quantity), startDate: passStart() };
}

/**
 * How each type of product goes into the cart. An adapter checks what it was given (`check`
 * answers why it can't be added, or ''), makes the cart API's product from it (`toProduct`) in
 * its currency (`currency`), with what its cart takes besides (`order`), and a cart line from it
 * (`toLine`), shown when the cart was made but couldn't be read back.
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
    order: { isThirdPartyFulfilment: false },
    toLine(item) {
      return {
        id: '',
        catalogueCode: item.catalogueCode,
        productCode: '',
        type: 'lounge',
        kind: 'lounge',
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
  // a lounge pass (the quick buy and pass finder's Add to Cart, and their Learn more): its
  // catalogue code (the regular rate's), one of it, from an hour from now (as the source's pass
  // cart; the user's sample: no isThirdPartyFulfilment, the quantity as text)
  pass: {
    check: (item) => (text(item.catalogueCode) ? '' : 'invalid'),
    toProduct: (item) => passProduct(item.catalogueCode, 1),
    currency: (item) => text(item.currency).toUpperCase(),
    order: {},
    toLine(item) {
      const name = text(item.name);
      return {
        id: '',
        catalogueCode: item.catalogueCode,
        productCode: text(item.productCode),
        type: 'gftcrd',
        kind: 'pass',
        name,
        product: name,
        place: '',
        start: passStart(),
        adults: 0,
        children: 0,
        quantity: 1,
        total: Number(item.price),
      };
    },
  },
};

/**
 * The cart's rules, in turn: each answers why a product can't go in, or '' ("checkout-first":
 * the source's "Please proceed to checkout before adding new item into cart.").
 */
const RULES = [
  // a lounge only goes into an empty cart (so a cart holds one lounge, and no passes with it)
  ({ cart, item }) => (item.type !== 'pass' && cart?.lines.length ? 'checkout-first' : ''),
  // a pass joins passes only, never a lounge
  ({ cart, item }) => (item.type === 'pass' && cart?.lines.some((line) => line.kind !== 'pass') ? 'checkout-first' : ''),
];

/**
 * Adds a type of product to the cart (see ADAPTERS).
 * @param {string} type
 * @param {{check: Function, toProduct: Function, currency: Function, order?: Object,
 *   toLine: Function}} adapter
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
  const type = text(p?.propertyTypeCode).toLowerCase();
  return {
    id: text(p?.cartItemId),
    catalogueCode: text(p?.catalogueCode),
    productCode: text(p?.productCode),
    // LOUNGE, GFTCRD (passes), …
    type,
    kind: type === 'gftcrd' || text(p?.serviceType).toUpperCase() === 'PASS' ? 'pass' : 'lounge',
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

/**
 * Replaces the cart's products in the booking system (PUT ?cartId=: the products given are the
 * cart's from then on, in this currency).
 * @param {string} cartId
 * @param {string} currency
 * @param {Object[]} products
 * @param {Object} order
 * @returns {Promise<Object>}
 */
function putProducts(cartId, currency, products, order) {
  const url = apiUrl('cart');
  url.searchParams.set('cartId', cartId);
  return fetchJson(url, { currency, products, ...order }, 'PUT');
}

/**
 * The cart's passes again as the cart API takes them (only passes share a cart).
 * @param {Object[]} lines
 * @returns {Object[]}
 */
function passProducts(lines) {
  return lines.map((line) => passProduct(line.catalogueCode, line.quantity));
}

/**
 * The cart's totals from its lines, when the booking system couldn't be read (no discounts).
 * @param {Object[]} lines
 * @returns {{base: number, discounts: Object[], total: number}}
 */
function sumLines(lines) {
  const total = lines.reduce((sum, line) => sum + (Number(line.total) || 0), 0);
  return { base: total, discounts: [], total };
}

let pending = null;
// a cart being priced in another currency (see convertCart)
let converting = null;

/**
 * Adds a product to the cart. An empty cart is made with it (POST); a pass joins the cart's passes
 * (PUT with them all), and the same pass again is one more of it. One at a time: while an add is
 * under way, another click gets the same answer.
 * @param {{type: string}} item The product, as its type's adapter takes it
 * @returns {Promise<{status: 'added'|'refused'|'failed', reason?: string, cart?: Object,
 *   error?: Error}>} refused: a rule or the adapter's check said no (`reason`); failed: the
 *   booking system didn't take it
 */
export function addToCart(item) {
  if (pending) return pending;
  pending = (async () => {
    // (after a conversion under way: it rewrites the cart's products)
    if (converting) await converting;
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
    const currency = adapter.currency(item);
    const order = { ...ORDER, ...adapter.order };
    const known = cart?.lines.length ? cart.lines : [];
    // what the cart holds after it, should the booking system not be read back
    const unit = Number(item.price);
    const lines = known.some((line) => line.catalogueCode === item.catalogueCode)
      ? known.map((line) => (line.catalogueCode === item.catalogueCode
        ? { ...line, quantity: line.quantity + 1, total: line.total + unit } : line))
      : [...known, adapter.toLine(item)];
    try {
      let cartId = cart?.cartId;
      if (known.length) {
        // (the rules let only a pass join a cart: its passes, with this one or one more of it)
        await putProducts(cartId, currency, passProducts(lines), order);
      } else {
        const answer = await fetchJson(apiUrl('cart'), {
          currency, products: [adapter.toProduct(item)], ...order,
        });
        cartId = text(answer?.cartId);
        if (!cartId) throw new Error('no cartId');
      }
      try {
        return { status: 'added', cart: await refreshCart(cartId) };
      } catch (error) {
        // the product is in: keep the cart, with what the page knows of it
        // eslint-disable-next-line no-console
        console.warn('cart: the cart could not be read back', error);
        saveCart({
          cartId, currency, lines, totals: sumLines(lines),
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
 * @returns {Promise<{status: 'removed'|'failed', error?: Error}>}
 */
export async function deleteCart(cartId = getCartId()) {
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
  if (getCartId() === cartId) forgetCart();
  return { status: 'removed' };
}

/**
 * Takes a line out of a cart that keeps others (passes): the booking system gets the cart's
 * other products (PUT), then the cart is read again.
 * @param {Object} cart
 * @param {Object[]} rest The lines that stay
 * @returns {Promise<{status: 'removed'|'failed', error?: Error}>}
 */
async function keepLines(cart, rest) {
  try {
    await putProducts(cart.cartId, cart.currency, passProducts(rest), ORDER);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('cart: the line was not taken out', error);
    return { status: 'failed', error };
  }
  try {
    await refreshCart(cart.cartId);
  } catch {
    // (taken out: what the page knows of the rest stands)
    if (getCartId() === cart.cartId) saveCart({ ...cart, lines: rest, totals: sumLines(rest) });
  }
  return { status: 'removed' };
}

let removing = null;

/**
 * Takes a product (its whole line, as the source's ⊗) out of the cart: the cart's last line
 * deletes the cart; otherwise the cart keeps its other lines. One at a time: a second click while
 * it's under way gets the same answer.
 * @param {string} catalogueCode
 * @returns {Promise<{status: 'removed'|'failed'|'absent', error?: Error}>} absent: it wasn't in
 *   the cart
 */
export function removeFromCart(catalogueCode) {
  if (removing) return removing;
  const cart = getCart();
  if (!cart?.lines.some((line) => line.catalogueCode === catalogueCode)) {
    return Promise.resolve({ status: 'absent' });
  }
  const rest = cart.lines.filter((line) => line.catalogueCode !== catalogueCode);
  removing = (rest.length ? keepLines(cart, rest) : deleteCart(cart.cartId))
    .finally(() => { removing = null; });
  return removing;
}

/**
 * Prices a cart of passes in another currency, as the source shows its cart in the page's
 * currency: the same passes again (PUT, which converts the cart), then the cart is read again. A
 * cart with a lounge stays in the lounge's currency (converting one isn't known to work). Not while
 * an add or a removal is under way.
 * @param {string} currency
 * @returns {Promise<{status: 'converted'|'unchanged'|'failed', error?: Error}>}
 */
export function convertCart(currency) {
  if (converting) return converting;
  const cart = getCart();
  const code = text(currency).toUpperCase();
  const passesOnly = !!cart?.lines.length && cart.lines.every((line) => line.kind === 'pass');
  if (pending || removing || !passesOnly || !/^[A-Z]{3}$/.test(code) || cart.currency === code) {
    return Promise.resolve({ status: 'unchanged' });
  }
  converting = (async () => {
    try {
      await putProducts(cart.cartId, code, passProducts(cart.lines), ORDER);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('cart: the cart was not priced in', code, error);
      return { status: 'failed', error };
    }
    try {
      await refreshCart(cart.cartId);
    } catch { /* (converted: read again next time) */ }
    return { status: 'converted' };
  })().finally(() => { converting = null; });
  return converting;
}
