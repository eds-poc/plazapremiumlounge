/**
 * The Booking List block: the logged-in member's bookings, as the source "My Bookings" page
 * (`/en-uk/membership/my-booking`):
 * - Upcoming / Past Bookings / Cancelled tabs, the tab kept in the page address (`?status=past`);
 * - a card per booking: the lounge's photos, the order number, the lounge and where it is, date,
 *   time, guests, services, price and the booking's actions (resend the confirmation, view or
 *   modify, cancel), a page at a time (scripts/pagination.js).
 * The bookings come from the booking list API with the login token (scripts/auth.js). Every text
 * the block shows is authored, a row of the block's table each (see TEXTS); a text left out isn't
 * shown.
 */
import { getToken, isTokenValid, logout } from '../../scripts/auth.js';
import apiUrl from '../../scripts/endpoints.js';
import {
  DEFAULT_SITE, getLanguage, getSiteFolder, translate,
} from '../../scripts/i18n.js';
import { createPager, readPageSize, setPage } from '../../scripts/pagination.js';
import {
  buildSlider, el, getApiLanguage, isPreview, setLoading, toKey, toUrl,
} from '../../scripts/properties.js';

const TIMEOUT_MS = 8000;
const STATUS_PARAM = 'status';
// the bookings asked of the API: the lounges'
const PROPERTY_TYPE = 'LOUNGE';
// the tabs, in their order: the address value, the API's `status` (as it spells it), and their
// label and empty message (TEXTS keys); the first shown is the default (no `status` in the address)
const TABS = [
  {
    id: 'upcoming', status: 'Upcoming booking', label: 'upcomingTab', none: 'noUpcoming',
  },
  {
    id: 'past', status: 'Past booking', label: 'pastTab', none: 'noPast',
  },
  {
    id: 'cancelled', status: 'Cancelled', label: 'cancelledTab', none: 'noCancelled',
  },
];
// the authored texts: the block's name for each, and its row's name (names ignore capitals and
// spaces). `{id}` is the order number, `{n}` the number of guests.
const TEXTS = {
  upcomingTab: 'Upcoming tab',
  pastTab: 'Past tab',
  cancelledTab: 'Cancelled tab',
  tabsLabel: 'Tabs label',
  order: 'Order',
  date: 'Date',
  time: 'Time',
  guests: 'Guests',
  services: 'Services',
  additionalServices: 'Additional services',
  adult: 'Adult',
  adults: 'Adults',
  child: 'Child',
  children: 'Children',
  priceNote: 'Price note',
  resend: 'Resend',
  viewModify: 'View and modify',
  view: 'View',
  cancel: 'Cancel',
  cancelConfirm: 'Cancel confirm',
  cancelDone: 'Cancelled message',
  resent: 'Resent',
  actionError: 'Action error',
  noUpcoming: 'No upcoming',
  noPast: 'No past',
  noCancelled: 'No cancelled',
  error: 'Error',
};
// the texts whose value is the point: an authored text without its `{id}` / `{n}` gets it where
// the default text has it ("Order No." → "Order No. HKBC-…", "Adults" → "2 Adults")
const VALUE_AT = {
  order: '{text} {id}',
  adults: '{n} {text}',
  children: '{n} {text}',
};
// the settings rows (not texts)
const SETTINGS = ['View page', 'Page size'];
// the source's English month names (its dates are 30-Nov-2026); other languages use their own
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// the API's service date: "30 Nov 2026 16:00:00", the lounge's local time (shown as it is)
const SERVICE_DATE = /^(\d{1,2}) ([A-Za-z]{3}) (\d{4}) (\d{1,2}):(\d{2})/;

let blockCount = 0;

/**
 * API or authored text, trimmed, its runs of spaces made one ("Plaza Premium First " →
 * "Plaza Premium First").
 * @param {*} value
 * @returns {string}
 */
function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * The authored settings, rows of name | value (names ignore capitals and spaces): `View page` (the
 * booking page, a link or path; else /{site}/view-booking), `Page size` (bookings per page, 10
 * without it), and the texts (TEXTS).
 * @param {HTMLElement} block
 * @returns {{ text: function(string, Object=): string, viewPage: string, pageSize: number }}
 *   `text`: an authored text by its TEXTS key, `{id}` and `{n}` filled in; '' when not authored
 */
function readSettings(block) {
  const rows = [...block.children].map((row) => [...row.children]);
  const cell = (name) => rows.find((cells) => cells.length >= 2
    && toKey(cells[0].textContent) === toKey(name))?.[1];
  const value = (c) => (c?.querySelector('a[href]')?.getAttribute('href') || c?.textContent || '').trim();
  const sameSite = (raw) => {
    if (!raw) return '';
    try {
      const url = new URL(raw, window.location.href);
      return url.origin === window.location.origin ? `${url.pathname}${url.search}` : '';
    } catch {
      return '';
    }
  };
  const texts = Object.fromEntries(Object.entries(TEXTS).map(([key, name]) => {
    const authored = clean(cell(name)?.textContent);
    const placeholder = VALUE_AT[key]?.match(/\{(id|n)\}/)[0];
    return [key, authored && placeholder && !authored.includes(placeholder)
      ? VALUE_AT[key].replace('{text}', authored) : authored];
  }));
  if (isPreview()) {
    // a row name mistyped leaves its text out without a word: say so on preview pages
    const known = [...Object.values(TEXTS), ...SETTINGS].map(toKey);
    const missing = Object.entries(TEXTS).filter(([key]) => !texts[key]).map(([, name]) => name);
    const unknown = rows.filter((cells) => cells.length >= 2)
      .map((cells) => clean(cells[0].textContent))
      .filter((name) => name && !known.includes(toKey(name)));
    if (missing.length || unknown.length) {
      // eslint-disable-next-line no-console
      console.warn(`booking-list: rows not found (their texts aren't shown): ${missing.join(', ') || 'none'}; rows not known: ${unknown.join(', ') || 'none'}`);
    }
  }
  return {
    text: (key, values = {}) => (texts[key] || '')
      .replace(/\{(\w+)\}/g, (all, name) => values[name] ?? all),
    viewPage: sameSite(value(cell('View page'))) || `/${getSiteFolder() || DEFAULT_SITE}/view-booking`,
    pageSize: readPageSize(value(cell('Page size'))),
  };
}

/**
 * The service date's parts, as the API gives them (no time zone conversion), or null.
 * @param {string} value e.g. "30 Nov 2026 16:00:00"
 * @returns {{ day: number, month: number, year: number, hours: number, minutes: number,
 *   time: number }|null} `time` orders the bookings
 */
function readServiceDate(value) {
  const m = String(value ?? '').trim().match(SERVICE_DATE);
  const month = m ? MONTHS.findIndex((name) => name.toLowerCase() === m[2].toLowerCase()) : -1;
  if (!m || month < 0) return null;
  const [day, year, hours, minutes] = [m[1], m[3], m[4], m[5]].map(Number);
  return {
    day, month, year, hours, minutes, time: Date.UTC(year, month, day, hours, minutes),
  };
}

/**
 * The date as the source shows it: 30-Nov-2026 (the month in the page's language).
 * @param {{ day: number, month: number, year: number }} date
 * @returns {string}
 */
function formatDate({ day, month, year }) {
  const lang = document.documentElement.lang || getLanguage();
  const name = lang.startsWith('en') ? MONTHS[month]
    : new Intl.DateTimeFormat(lang, { month: 'short', timeZone: 'UTC' }).format(Date.UTC(year, month, 1));
  return `${String(day).padStart(2, '0')}-${name}-${year}`;
}

/**
 * The guests: "2 Adults", "1 Adult, 1 Child", with the authored texts (a count without its text
 * is left out).
 * @param {{ adult?: number, child?: number }} guests
 * @param {function(string, Object=): string} text
 * @returns {string}
 */
function formatGuests(guests, text) {
  const adults = Number(guests?.adult) || 0;
  const children = Number(guests?.child) || 0;
  return [
    adults && text(adults === 1 ? 'adult' : 'adults', { n: adults }),
    children && text(children === 1 ? 'child' : 'children', { n: children }),
  ].filter(Boolean).join(', ');
}

/**
 * The price as the source shows it: "HKD 1,763.64" (two decimals, the page language's grouping).
 * @param {string} currency
 * @param {number} total
 * @returns {string}
 */
function formatPrice(currency, total) {
  const lang = document.documentElement.lang || getLanguage();
  const amount = new Intl.NumberFormat(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(Number(total) || 0);
  return [String(currency ?? '').trim(), amount].filter(Boolean).join(' ');
}

/**
 * A tab's bookings, from the API's list for it: those with an order number, in the tab's order
 * (upcoming soonest first, the others latest first; the API's order for the same time). The
 * lounge (its name, place and photos) is the order items' (the first with one). The first item
 * is the booking's service, the others its additional services ("1 x Sakura Shrimp Spice").
 * @param {Object[]} items
 * @param {string} tab
 * @param {function(string, Object=): string} text
 * @returns {Object[]}
 */
function readBookings(items, tab, text) {
  const direction = tab === 'upcoming' ? 1 : -1;
  return items.map((row, index) => {
    const orderId = clean(row?.orderId);
    if (!orderId) return null;
    const orderItems = (Array.isArray(row.orderItems) ? row.orderItems : []).filter(Boolean);
    const lounge = orderItems.find((item) => item.propertyDisplayName || item.propertyName) || {};
    const photos = orderItems.find((item) => Array.isArray(item.images) && item.images.length);
    const serviceName = (item) => clean(item?.productDisplayName || item?.productName);
    const [service, ...extras] = orderItems;
    return {
      index,
      orderId,
      tab,
      // the display name is the lounge's alone; propertyName adds its place in brackets
      name: clean(lounge.propertyDisplayName || lounge.propertyName),
      // the lounge's place in the airport, then the airport, as the source's address line
      line: [clean(lounge.shortLocation), clean(lounge.locationName || row.locationName)]
        .filter(Boolean).join(', '),
      date: readServiceDate(row.serviceDate),
      guests: formatGuests(row.guests, text),
      service: serviceName(service),
      // as the source: the quantity, then the name
      additionalServices: extras
        .map((item) => serviceName(item) && `${Number(item.quantity) || 1} x ${serviceName(item)}`)
        .filter(Boolean),
      price: formatPrice(row.currencyCode, row.totalPrice ?? row.orderTotalPrice?.totalPrice),
      // in the API's order (the photos have no sequence here), as buildSlider takes them
      images: (photos?.images || [])
        .map((image) => ({ src: toUrl(image?.path) }))
        .filter((image) => image.src),
      canModify: row.isEligibleForModify === true,
      canCancel: row.isEligibleForCancel === true,
      // the API has no flag for resending: every upcoming booking can (unless one says otherwise)
      canResend: tab === 'upcoming' && row.isEligibleForResend !== false,
    };
  }).filter(Boolean)
    .sort((a, b) => direction * ((a.date?.time ?? 0) - (b.date?.time ?? 0)) || a.index - b.index);
}

/**
 * POSTs JSON with a timeout and the login token. Rejects with an Error that has `status` (0 for a
 * network failure or the timeout); a 200 with an API error object (`{ errorCode, message }` or
 * `{ error }`) is a failure too.
 * @param {string} url
 * @param {Object} body
 * @returns {Promise<Object|Object[]>}
 */
async function request(url, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw Object.assign(new Error(`HTTP ${resp.status}`), { status: resp.status });
    const json = await resp.json();
    if (json?.errorCode || json?.error) {
      const text = json.errorCode ? `${json.errorCode}: ${json.message || ''}` : String(json.error);
      throw Object.assign(new Error(text), { status: resp.status });
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
 * A tab's bookings as the API lists them: a POST of the language, the property type and the tab's
 * `status`, with the login token.
 * @param {string} tab
 * @returns {Promise<Object[]>}
 */
async function fetchBookings(tab) {
  const json = await request(apiUrl('bookingList').href, {
    languageCode: getApiLanguage(),
    propertyTypeCode: PROPERTY_TYPE,
    status: TABS.find((t) => t.id === tab).status,
  });
  // the bookings are the response (a list), or its `items`
  const items = Array.isArray(json) ? json : json?.items;
  if (!Array.isArray(items)) throw new Error('Unexpected response: not a list of bookings');
  return items;
}

/**
 * The tab in the page address (`?status=past`), if it's shown, else the first shown.
 * @param {string[]} shown The tabs shown, in their order
 * @returns {string}
 */
function readTab(shown) {
  const value = toKey(new URLSearchParams(window.location.search).get(STATUS_PARAM));
  return shown.includes(value) ? value : shown[0];
}

/**
 * Puts the tab in the page address (the first shown removes it) and goes back to the first page,
 * as a new history entry when it changes.
 * @param {string} tab
 * @param {string[]} shown The tabs shown, in their order
 */
function writeTab(tab, shown) {
  const url = setPage(new URL(window.location.href), 1);
  if (tab === shown[0]) url.searchParams.delete(STATUS_PARAM);
  else url.searchParams.set(STATUS_PARAM, tab);
  if (url.href !== window.location.href) window.history.pushState(window.history.state, '', url);
}

/**
 * The tabs: a tablist of buttons, the arrows, Home and End moving between them (and choosing).
 * @param {string} prefix Unique per block, for the ids
 * @param {string} panelId The list the tabs control
 * @param {{ id: string, label: string }[]} tabs The tabs shown, with their authored labels
 * @param {string} name The tablist's name for screen readers ('' for none)
 * @param {function(string): void} onSelect
 * @returns {{ element: HTMLElement, show: function(string): void }}
 */
function buildTabs(prefix, panelId, tabs, name, onSelect) {
  const list = el('div', 'booking-list-tabs');
  list.setAttribute('role', 'tablist');
  if (name) list.setAttribute('aria-label', name);
  const buttons = tabs.map((tab) => {
    const button = el('button', 'booking-list-tab', tab.label);
    button.type = 'button';
    button.id = `${prefix}-tab-${tab.id}`;
    button.dataset.tab = tab.id;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', panelId);
    list.append(button);
    return button;
  });
  const show = (id) => buttons.forEach((button) => {
    const selected = button.dataset.tab === id;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  const choose = (id) => {
    show(id);
    onSelect(id);
  };
  list.addEventListener('click', (e) => {
    const button = e.target.closest('.booking-list-tab');
    if (button && button.getAttribute('aria-selected') !== 'true') choose(button.dataset.tab);
  });
  list.addEventListener('keydown', (e) => {
    const index = buttons.indexOf(document.activeElement);
    const moves = {
      ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: buttons.length - 1,
    };
    if (index < 0 || !(e.key in moves)) return;
    e.preventDefault();
    const next = buttons[(moves[e.key] + buttons.length) % buttons.length];
    next.focus();
    if (next.getAttribute('aria-selected') !== 'true') choose(next.dataset.tab);
  });
  return { element: list, show };
}

/**
 * A booking's card: the photos, the order number, the lounge, the details, the price and the
 * actions (by tab, the API's flags and the authored texts: an action without its text isn't
 * shown, nor Cancel without its confirmation).
 * @param {Object} booking
 * @param {{ text: function(string, Object=): string, viewPage: string, eager: boolean,
 *   prefix: string }} options
 * @returns {HTMLLIElement}
 */
function buildCard(booking, {
  text, viewPage, eager, prefix,
}) {
  const card = el('li', 'booking-list-card');
  card.dataset.orderId = booking.orderId;
  const media = el('div', 'booking-list-media');
  media.append(buildSlider({ images: booking.images, name: booking.name, line: booking.line }, eager, 'booking-list-slider'));

  const view = new URL(viewPage, window.location.href);
  view.searchParams.set('bookingid', booking.orderId);
  const viewHref = `${view.pathname}${view.search}`;

  const details = el('div', 'booking-list-details');
  const title = el('h3', 'booking-list-order');
  const titleLink = el('a', '', text('order', { id: booking.orderId }) || booking.orderId);
  titleLink.href = viewHref;
  titleLink.id = `${prefix}-order-${booking.tab}-${booking.index + 1}`;
  title.append(titleLink);

  const lounge = el('p', 'booking-list-lounge');
  if (booking.name) lounge.append(el('b', 'booking-list-lounge-name', booking.name));
  if (booking.line) lounge.append(el('span', 'booking-list-lounge-line', booking.line));

  const info = el('dl', 'booking-list-info');
  // a label and its value (a value without its label keeps an empty term); a list of values goes
  // below the label, one per line
  const add = (label, value) => {
    const lines = [value].flat().filter(Boolean);
    if (!lines.length) return;
    const item = el('div', 'booking-list-info-item');
    const dd = el('dd', '', Array.isArray(value) ? '' : value);
    if (Array.isArray(value)) {
      item.classList.add('booking-list-info-item-list');
      dd.append(...lines.map((line) => el('span', 'booking-list-info-line', line)));
    }
    item.append(el('dt', '', text(label)), dd);
    info.append(item);
  };
  if (booking.date) {
    add('date', formatDate(booking.date));
    const hhmm = `${String(booking.date.hours).padStart(2, '0')}${String(booking.date.minutes).padStart(2, '0')}`;
    add('time', `${hhmm} ${translate('propertyHours')}`);
  }
  add('guests', booking.guests);
  add('services', booking.service);
  add('additionalServices', booking.additionalServices);

  const price = el('p', 'booking-list-price');
  price.append(el('b', '', booking.price));
  if (text('priceNote')) price.append(el('span', '', text('priceNote')));

  const actions = el('ul', 'booking-list-actions');
  const action = (node) => {
    if (!node.textContent) return;
    const item = el('li');
    item.append(node);
    actions.append(item);
  };
  const button = (label, name) => {
    const b = el('button', 'booking-list-action', text(label));
    b.type = 'button';
    b.dataset.action = name;
    // the order number names the action for screen readers
    b.setAttribute('aria-describedby', titleLink.id);
    return b;
  };
  const link = (label) => {
    const a = el('a', 'booking-list-action', text(label));
    a.href = viewHref;
    a.setAttribute('aria-describedby', titleLink.id);
    return a;
  };
  if (booking.canResend) action(button('resend', 'resend'));
  action(link(booking.canModify ? 'viewModify' : 'view'));
  if (booking.canCancel && text('cancelConfirm')) action(button('cancel', 'cancel'));

  const note = el('p', 'booking-list-note');
  note.setAttribute('aria-live', 'polite');

  details.append(title, lounge, info, price);
  if (actions.children.length) details.append(actions);
  details.append(note);
  card.append(media, details);
  return card;
}

/**
 * Fills the block with the member's bookings; nothing when nobody is logged in (a members' page
 * sends them home: scripts/auth.js checkSession). Runs again after a cancellation.
 * @param {HTMLElement} block
 * @param {Object} settings
 * @param {string} prefix
 * @param {string} [notice] A message shown above the tabs (e.g. a booking was cancelled)
 */
async function load(block, settings, prefix, notice = '') {
  const { text } = settings;
  const token = getToken();
  if (!token || !isTokenValid(token)) {
    block.replaceChildren();
    block.removeAttribute('aria-busy');
    return;
  }

  const message = el('p', 'booking-list-message');
  message.hidden = true;
  const status = el('p', 'booking-list-status visually-hidden');
  status.setAttribute('aria-live', 'polite');
  // the tabs, the cards and the page buttons are put together hidden and shown at once
  const results = el('div', 'booking-list-results');
  results.hidden = true;
  block.replaceChildren(results, message, status);
  block.setAttribute('aria-busy', 'true');

  // the tabs with an authored label; without any, no tab bar and the first tab's bookings
  const tabsShown = TABS.map((t) => ({ id: t.id, label: text(t.label) })).filter((t) => t.label);
  const shownIds = tabsShown.length ? tabsShown.map((t) => t.id) : [TABS[0].id];

  const panel = el('ul', 'booking-list-cards');
  panel.id = `${prefix}-panel`;
  if (tabsShown.length) panel.setAttribute('role', 'tabpanel');

  let tab = readTab(shownIds);
  const pager = createPager({
    size: settings.pageSize,
    target: block,
    onChange: ({ page }) => { block.dataset.page = page; },
  });

  // each tab's cards, asked of the API the first time the tab is shown and kept: coming back to
  // a tab shows them again without asking. A failed request isn't kept (the tab asks again).
  const cache = new Map();
  const cardsOf = (id) => {
    if (!cache.has(id)) {
      // the first photo loads early on the first tab shown only
      const eager = !cache.size;
      const cards = fetchBookings(id).then((items) => readBookings(items, id, text)
        .map((booking, i) => buildCard(booking, {
          text, viewPage: settings.viewPage, eager: eager && i === 0, prefix,
        })));
      cards.catch(() => cache.delete(id));
      cache.set(id, cards);
    }
    return cache.get(id);
  };

  // shows a tab's bookings, paged by the pager (`reset`: from the first page, a new tab), with
  // the site's loader while they're asked for; a slower answer for a tab left meanwhile is ignored
  let shown = 0;
  const show = async (id, { announce = false, reset = false } = {}) => {
    shown += 1;
    const current = shown;
    let cards = null;
    setLoading(true);
    try {
      cards = await cardsOf(id);
    } catch (error) {
      // the token refused (invalid or expired): log out and go home
      if ([401, 403].includes(error.status)) {
        logout();
        return;
      }
      // eslint-disable-next-line no-console
      console.error(`booking-list: couldn't load the ${id} bookings (${error.message})`);
    } finally {
      setLoading(false);
    }
    if (current !== shown) return;
    panel.replaceChildren(...(cards || []));
    pager.setItems(cards || [], { reset });
    if (tabsShown.length) panel.setAttribute('aria-labelledby', `${prefix}-tab-${id}`);
    let said = '';
    if (!cards) said = text('error');
    else if (!cards.length) said = text(TABS.find((t) => t.id === id).none);
    message.textContent = said;
    message.hidden = !said;
    block.dataset.status = id;
    if (announce) status.textContent = said;
  };

  const tabs = tabsShown.length
    ? buildTabs(prefix, panel.id, tabsShown, text('tabsLabel'), (next) => {
      tab = next;
      writeTab(tab, shownIds);
      show(tab, { announce: true, reset: true });
    })
    : null;

  // resend the confirmation, or cancel the booking (after a confirmation), with the API
  panel.addEventListener('click', async (e) => {
    const b = e.target.closest('button.booking-list-action');
    if (!b || b.disabled) return;
    const card = b.closest('.booking-list-card');
    const { orderId } = card.dataset;
    const note = card.querySelector('.booking-list-note');
    const cancel = b.dataset.action === 'cancel';
    // eslint-disable-next-line no-alert
    if (cancel && !window.confirm(text('cancelConfirm', { id: orderId }))) return;
    b.disabled = true;
    note.textContent = '';
    try {
      await request(apiUrl(cancel ? 'cancelBooking' : 'resendBookingConfirmation').href, { orderId });
      // a cancelled booking moves to the Cancelled tab: the list is loaded again, with the message
      if (cancel) {
        load(block, settings, prefix, text('cancelDone', { id: orderId }));
        return;
      }
      note.textContent = text('resent');
    } catch (error) {
      note.textContent = text('actionError');
      if (isPreview()) {
        // eslint-disable-next-line no-console
        console.error(`booking-list: ${b.dataset.action} for ${orderId} failed (${error.message})`);
      }
    } finally {
      b.disabled = false;
    }
  });

  if (notice) {
    const done = el('p', 'booking-list-notice', notice);
    done.setAttribute('role', 'status');
    results.append(done);
  }
  if (tabs) results.append(tabs.element);
  results.append(panel, pager.element);
  // the page buttons' look first, then the tab's bookings, all still hidden: shown at once
  await pager.ready;
  if (tabs) tabs.show(tab);
  await show(tab);
  results.hidden = false;
  block.removeAttribute('aria-busy');

  // Back and Forward restore the tab and the page from the address
  const onHistory = () => {
    if (!block.isConnected || !results.isConnected) {
      window.removeEventListener('popstate', onHistory);
      return;
    }
    const next = readTab(shownIds);
    if (next === tab) {
      pager.sync();
      return;
    }
    tab = next;
    if (tabs) tabs.show(tab);
    pager.sync({ render: false });
    show(tab, { announce: true });
  };
  window.addEventListener('popstate', onHistory);
}

/**
 * Decorates the Booking List block: the visitor's bookings once they're logged in. Rows: the texts
 * (TEXTS) and, optional, `View page` and `Page size` (see readSettings).
 * @param {HTMLElement} block
 */
export default function decorate(block) {
  blockCount += 1;
  const prefix = `booking-list-${blockCount}`;
  const settings = readSettings(block);
  block.replaceChildren();
  block.setAttribute('aria-busy', 'true');
  // the bookings load in the background: the section (and the page's other sections, the footer)
  // show without waiting for the API; the block keeps its room until they're in
  load(block, settings, prefix).catch((error) => {
    block.removeAttribute('aria-busy');
    // eslint-disable-next-line no-console
    console.error('booking-list: could not load', error);
  });
}
