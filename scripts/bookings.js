/*
 * A member's booking, shared by the booking blocks (View Booking, Edit Booking): the booking id in
 * the address, the booking from GetOrderDetail with the login token, its items grouped (the lounge
 * service and its add-ons), and the prices and dates written as the source does.
 */
import apiUrl from './endpoints.js';
import { authHeaders, logout } from './auth.js';
import { getLanguage } from './i18n.js';
import { hideLoader, showLoader } from './scripts.js';

// an order id as in the address (?bookingid=HKBC-11339-64SCYL)
const ORDER_ID = /^[A-Za-z0-9-]{1,40}$/;

/**
 * The booking id in the address (`?bookingid=`, also `?orderId=`), or '' when there is none or it
 * isn't one.
 * @returns {string}
 */
export function bookingId() {
  const params = new URLSearchParams(window.location.search);
  const id = (params.get('bookingid') || params.get('orderId') || '').trim();
  return ORDER_ID.test(id) ? id : '';
}

/**
 * The booking (GetOrderDetail) for an order id. A refused token (401) logs out and goes home: the
 * promise then gives null. A missing booking rejects with `notFound`, any other failure without.
 * @param {string} orderId
 * @returns {Promise<object|null>}
 */
export function fetchOrder(orderId) {
  return fetch(apiUrl('getOrderDetail'), {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId }),
  }).then((res) => {
    if (res.status === 401) {
      logout();
      return null;
    }
    return res.json().catch(() => ({})).then((data) => {
      if (res.status === 404 || (res.ok && !data?.orderId)) throw Object.assign(new Error('booking'), { notFound: true });
      if (!res.ok || data.error || Number(data.serviceResponseCode) >= 400) throw new Error('booking');
      return data;
    });
  });
}

/**
 * The site's full-page loader while a booking block loads its booking. The block is first on its
 * page, so the page's first load takes the loader away once the block is built: while loading,
 * it's put straight back (before the next paint, so it doesn't flicker).
 * @returns {{start: () => void, done: () => void}}
 */
export function bookingLoader() {
  const keep = new MutationObserver(() => {
    if (!document.getElementById('spinner-overlay')) showLoader();
  });
  return {
    start() {
      showLoader();
      keep.observe(document.body, { childList: true });
    },
    done() {
      keep.disconnect();
      hideLoader();
    },
  };
}

/**
 * The authored texts, by row name (Key | Text): the text cell of each row.
 * @param {Element} block
 * @returns {Map<string, Element>}
 */
export function readTexts(block) {
  const texts = new Map();
  [...block.children].forEach((row) => {
    const [key, cell] = row.children;
    const name = key?.textContent.trim().toLowerCase();
    if (name && cell) texts.set(name, cell);
  });
  return texts;
}

/**
 * The page's locale for numbers and dates (English pages as the source: en-US).
 * @returns {string}
 */
function locale() {
  const lang = getLanguage();
  return lang.startsWith('en') ? 'en-US' : lang;
}

/**
 * An amount as on the source: "HKD 1,763.64".
 * @param {*} value
 * @param {string} currency
 * @returns {string}
 */
export function money(value, currency) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  const amount = new Intl.NumberFormat(locale(), {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(number);
  return currency ? `${currency} ${amount}` : amount;
}

/**
 * A day as the source writes it: "30-Nov-2026" on the English pages, the language's medium date
 * elsewhere.
 * @param {string} iso e.g. "2026-11-30"
 * @returns {string}
 */
export function dayText(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso ? String(iso) : '';
  const [, y, mo, d] = m;
  const date = new Date(Date.UTC(+y, +mo - 1, +d));
  if (getLanguage().startsWith('en')) {
    const month = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(date);
    return `${d}-${month}-${y}`;
  }
  return new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
}

/**
 * The visit's date and time as given (the lounge's local time, never moved to another time zone):
 * "30-Nov-2026" (dayText) and "1600" for the time.
 * @param {string} value e.g. "2026-11-30 16:00:00"
 * @returns {{date: string, time: string}}
 */
export function visitTime(value) {
  const m = String(value || '').match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return { date: value ? String(value) : '', time: '' };
  const [, day, h, mi] = m;
  return { date: dayText(day), time: h !== undefined ? `${h}${mi}` : '' };
}

/**
 * Whether a booked item is a lounge service (else an add-on, e.g. a retail product), by its
 * serviceType (its propertyTypeCode is the lounge's, the same for its add-ons).
 * @param {object} item
 * @returns {boolean}
 */
export function isLounge(item) {
  return String(item.serviceType || '').toUpperCase() === 'LOUNGE';
}

/**
 * The booked items as boxes: the items at the same lounge and start time together, the (first)
 * lounge service as the box and the other items there (not lounge services) as its add-ons; a
 * second lounge service at the same place and time gets a box of its own.
 * @param {object[]} items
 * @returns {{main: object, addOns: object[]}[]}
 */
export function groupItems(items) {
  const visits = new Map();
  items.forEach((item) => {
    const key = `${item.propertyCode || ''}|${item.startDate || ''}`;
    if (!visits.has(key)) visits.set(key, []);
    visits.get(key).push(item);
  });
  return [...visits.values()].flatMap((list) => {
    const lounges = list.filter(isLounge);
    if (!lounges.length) return [{ main: list[0], addOns: list.slice(1) }];
    const addOns = list.filter((item) => !isLounge(item));
    return lounges.map((main, i) => ({ main, addOns: i ? [] : addOns }));
  });
}

/**
 * An item's price (its total, as booked).
 * @param {object} item
 * @returns {number}
 */
export function itemPrice(item) {
  return Number(item?.itemPriceDetails?.productTotalPrice?.totalPrice) || 0;
}

/**
 * The booking's currency (its first item's, else the payment's).
 * @param {object} order
 * @returns {string}
 */
export function orderCurrency(order) {
  const items = Array.isArray(order.orderItems) ? order.orderItems : [];
  return items[0]?.itemPriceDetails?.baseRate?.[0]?.currency
    || order.payment?.paymentOrders?.[0]?.paymentCurrency || '';
}
