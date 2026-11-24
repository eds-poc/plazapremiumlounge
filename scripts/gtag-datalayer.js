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
  // Book Your Visit's view_cart (cart_page) opened from the mini cart's Edit: "View Cart - HKG"
  view_cart: 'View Cart',
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
