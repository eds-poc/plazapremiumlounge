/*
 * GA4 ecommerce events in Google's data layer (`window.dataLayer`, read by the GTM container):
 * `{ event, ecommerce: { currency, item_list_id, item_list_name, view_source, items } }`, after
 * clearing the previous event's `ecommerce` (as Google asks, so one event's items don't carry over
 * to the next).
 *
 * How the visitor came to a listing (`view_source`): a click on a mega menu link (`mega_menu`) or
 * on the home page search widget's "More at …" / "View all properties in …"
 * (`hp_search_widget_click`) is noted for the page it opens (trackViewSource, on every page);
 * anything else is `others`. The lists are named after it: "Mega Menu - Beijing", "Other -
 * Beijing", "HP Search Widget - JFK" (id) / "HP Search Widget - John F. Kennedy International
 * Airport" (name).
 */

const SOURCE_KEY = 'ppl-view-source';
const SOURCES = {
  mega_menu: 'Mega Menu',
  hp_search_widget_click: 'HP Search Widget',
  others: 'Other',
};
// the links whose clicks are noted: every link in the header's main menu (the top links, the
// dropdowns, the mega menu and the phones' drill-down) and the home page search widget's
const SOURCE_LINKS = [
  ['.header-link, .header-dropdown-link, .header-mega-link, .header-drill-link', 'mega_menu'],
  ['.booking-widget-card-more, .booking-widget-more-properties-link', 'hp_search_widget_click'],
];
export const BRAND = 'PPL';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Notes, on every page, a click on a header menu or home page search widget link, for the page it
 * opens (the next time it opens in this browser session; a later click replaces it).
 */
export function trackViewSource() {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    const source = link && SOURCE_LINKS.find(([selector]) => link.matches(selector))?.[1];
    if (!source) return;
    try {
      const { pathname } = new URL(link.href, window.location.href);
      sessionStorage.setItem(SOURCE_KEY, JSON.stringify({ source, pathname }));
    } catch { /* storage blocked: the page counts as others */ }
  }, true);
}

// how the visitor came to this page, once read (see viewSource)
let pageSource;

/**
 * How the visitor came to this page: the noted click for it, used once (so a reload is
 * `others`), else `others`; kept for the page, so every event on it says the same (e.g. the
 * passes' view_item_list and a pass's view_item).
 * @returns {'mega_menu'|'hp_search_widget_click'|'others'}
 */
export function viewSource() {
  if (pageSource) return pageSource;
  pageSource = 'others';
  try {
    const noted = JSON.parse(sessionStorage.getItem(SOURCE_KEY) || 'null');
    if (noted && noted.pathname === window.location.pathname && SOURCES[noted.source]) {
      sessionStorage.removeItem(SOURCE_KEY);
      pageSource = noted.source;
    }
  } catch { /* nothing noted */ }
  return pageSource;
}

/**
 * A list's id or name with how the visitor came: "Mega Menu - PEK", "Other - Beijing".
 * @param {string} source See viewSource
 * @param {string} value
 * @returns {string}
 */
export function listLabel(source, value) {
  return `${SOURCES[source] || SOURCES.others} - ${value}`;
}

/**
 * The default visit at a place: now + 1h30 in its time zone, rounded to the nearest half hour, as
 * DD-MMM-YYYY and HHMM (24h); blank without a time zone.
 * @param {string} timeZone e.g. Asia/Shanghai
 * @returns {{date: string, time: string}}
 */
function defaultVisit(timeZone) {
  if (!timeZone) return { date: '', time: '' };
  const half = 30 * 60 * 1000;
  const at = new Date(Math.round((Date.now() + 90 * 60 * 1000) / half) * half);
  let parts;
  try {
    parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(at).map(({ type, value }) => [type, value]));
  } catch {
    // an unknown time zone
    return { date: '', time: '' };
  }
  return {
    date: `${parts.day}-${MONTHS[Number(parts.month) - 1]}-${parts.year}`,
    time: `${parts.hour}${parts.minute}`,
  };
}

/**
 * The visit for a listing's item: the date (DD-MMM-YYYY) and time (24h) chosen in the page
 * address (the home page search widget's links carry them: ?date=2026-03-10&time=1500&adult=2&
 * children=1), both or neither (else now + 1h30 at the place, see defaultVisit); and the guests
 * chosen, else 1 adult and no children.
 * @param {string} timeZone The place's time zone, e.g. Asia/Shanghai
 * @returns {{checkInDate: string, checkInTime: string, adults: number, children: number,
 *   total_guest_count: number}}
 */
export function chosenVisit(timeZone) {
  const params = new URLSearchParams(window.location.search);
  const [, y, m, d] = (params.get('date') || '').match(/^(\d{4})-(\d{2})-(\d{2})$/) || [];
  const time = params.get('time') || '';
  const count = (name, fallback) => {
    const n = Number.parseInt(params.get(name), 10);
    return Number.isInteger(n) && n >= 0 ? n : fallback;
  };
  const date = y && MONTHS[Number(m) - 1] ? `${d}-${MONTHS[Number(m) - 1]}-${y}` : '';
  const chosen = date && /^([01]\d|2[0-3])[0-5]\d$/.test(time);
  const visit = chosen ? { date, time } : defaultVisit(timeZone);
  const adults = count('adult', 1);
  const children = count('children', 0);
  return {
    checkInDate: visit.date,
    checkInTime: visit.time,
    adults,
    children,
    total_guest_count: adults + children,
  };
}

/**
 * Pushes a GA4 event that isn't an ecommerce one to the data layer: its name and its fields, next
 * to each other, e.g. `{ event: 'sign_up', method: 'email', user_id: '6000032669',
 * user_properties: {…} }`.
 * @param {string} event e.g. sign_up
 * @param {Object} fields
 * @returns {Object} the pushed event
 */
export function pushGtagEvent(event, fields) {
  window.dataLayer = window.dataLayer || [];
  const entry = { event, ...fields };
  window.dataLayer.push(entry);
  return entry;
}

/**
 * GA4's `all_error` for an error shown to the visitor, on any page or form (the error pages,
 * forms, the login, the lounge page's price, the cart): its message as shown and the service's
 * code for it ('' without one), e.g. `{ event: 'all_error', error_message_code: 'BKNG049',
 * error_message: 'Past booking is not allowed' }`. Nothing without a message.
 * @param {string} message
 * @param {string|number} [code] e.g. BKNG049, 404
 * @returns {Object|null} the pushed event
 */
export function trackAllError(message, code = '') {
  const errorMessage = String(message ?? '').replace(/\s+/g, ' ').trim();
  if (!errorMessage) return null;
  return pushGtagEvent('all_error', {
    error_message_code: code ? String(code) : '',
    error_message: errorMessage,
  });
}

/**
 * Pushes a GA4 ecommerce event to the data layer, after clearing the last one's `ecommerce`.
 * @param {string} event e.g. view_item_list
 * @param {Object} ecommerce
 * @returns {Object} the pushed event
 */
export function pushEcommerce(event, ecommerce) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ ecommerce: null });
  const entry = { event, ecommerce };
  window.dataLayer.push(entry);
  return entry;
}

// the home page's address: / or a site folder's (/en-uk/ …), as in scripts/mini-cart.js
const HOMEPAGE_PATH = /^\/([a-z]{2}-[a-z]{2}\/?)?$/;
// the passes' list name, as PASSES_LIST_NAME in scripts/passes.js (this file imports nothing)
const PASSES_LIST_NAME = 'Airport Lounge Passes';

/**
 * A cart line as a GA4 item for remove_from_cart: the property, its promo code and discount, the
 * product, the airport with its code, the city and country code, the line's price and quantity,
 * and for a lounge the visit and guests (as view_cart's items).
 * @param {Object} cart The cart's summary (see readCart in cart.js)
 * @param {Object} line One of its lines
 * @returns {Object}
 */
function cartItem(cart, line) {
  const isPass = line.kind === 'pass';
  // a lounge's visit and guests (a pass has neither): its start is the lounge's local time,
  // "2026-11-28 15:00:00": "28-Nov-2026", "1500"
  const [, y, m, d, hour = '', minute = ''] = isPass ? []
    : String(line.start || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/) || [];
  return {
    item_id: line.propertyCode,
    item_name: line.shortLocation ? `${line.name} (${line.shortLocation})` : line.name,
    coupon: line.promo?.code || '',
    discount: line.discount,
    item_brand: BRAND,
    item_category: line.product,
    // the airport with its code, e.g. Hong Kong International Airport (HKG)
    item_category2: line.iataCode ? `${line.locationName} (${line.iataCode})` : line.locationName,
    item_category3: line.name,
    item_category4: cart.cityName,
    item_category5: cart.countryCode,
    price: line.total,
    quantity: line.quantity,
    checkInDate: y && MONTHS[Number(m) - 1] ? `${d}-${MONTHS[Number(m) - 1]}-${y}` : '',
    checkInTime: `${hour}${minute}`,
    adults: isPass ? '' : line.adults,
    children: isPass ? '' : line.children,
    total_guest_count: isPass ? '' : line.adults + line.children,
  };
}

// an amount to the cent
const cents = (amount) => Math.round((Number(amount) || 0) * 100) / 100;

/**
 * A cart line's list, as view_cart's (trackViewCart in scripts/mini-cart.js): how the visitor
 * came to the page (on the home page, its search widget; else viewSource) with the line's
 * airport, its code in the id and its name in the name ("HP Search Widget - HKG" / "HP Search
 * Widget - Hong Kong International Airport"); a pass, the passes' list ("Other - Airport Lounge
 * Passes").
 * @param {Object} line See readLine in cart.js
 * @returns {{id: string, name: string}}
 */
function cartLineList(line) {
  const source = HOMEPAGE_PATH.test(window.location.pathname)
    ? 'hp_search_widget_click' : viewSource();
  const isPass = line.kind === 'pass';
  return {
    id: listLabel(source, isPass ? PASSES_LIST_NAME : line.iataCode),
    name: listLabel(source, isPass ? PASSES_LIST_NAME : line.locationName),
  };
}

/**
 * The GA4 `remove_from_cart` once the booking system has taken products out, with only those, as
 * the cart had them before. Called by scripts/mini-cart.js (the mini cart's ⊗, the home page
 * lounge card's Remove From Cart: a line with its whole quantity, a lounge with its add-ons) and
 * the Add-ons block (Book Your Visit's Remove: an add-on). Each item as view_cart's
 * (cartItem) in its list (cartLineList), at its unit price and discount, with the quantity taken
 * out; an add-on as its lounge with the add-on's name as the product, its own price, no promo code
 * or discount. In the cart's currency, the value the items' total.
 * @param {Object} cart The cart's summary before the removal (see readCart in cart.js)
 * @param {{line: Object, quantity: number, addon?: Object}[]} removed The line, how many were
 *   taken out, and the add-on when it's one of the line's
 */
export function trackCartRemove(cart, removed) {
  const items = removed.filter(({ line, quantity }) => line && quantity > 0)
    .map(({ line, quantity, addon }) => {
      // the line's (or the add-on's) total and discount for one
      const of = addon || line;
      const count = of.quantity || 1;
      const list = cartLineList(line);
      return {
        ...cartItem(cart, line),
        ...(addon && { coupon: '', item_category: addon.name }),
        discount: addon ? 0 : cents(line.discount / count),
        item_list_id: list.id,
        item_list_name: list.name,
        price: cents(of.total / count),
        quantity,
      };
    });
  if (!items.length) return;
  pushEcommerce('remove_from_cart', {
    currency: cart.currency,
    value: cents(items.reduce((sum, item) => sum + item.price * item.quantity, 0)),
    items,
  });
}
