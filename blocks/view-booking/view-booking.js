import apiUrl from '../../scripts/endpoints.js';
import { authHeaders, getToken, logout } from '../../scripts/auth.js';
import { getLanguage, translate } from '../../scripts/i18n.js';
import { hideLoader, showLoader } from '../../scripts/scripts.js';

// an order id as in the address (?bookingid=HKBC-11339-64SCYL)
const ORDER_ID = /^[A-Za-z0-9-]{1,40}$/;

// the tags kept in the terms' HTML (from the API); anything else is dropped, its text kept
const TERMS_TAGS = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'UL', 'OL', 'LI', 'HR', 'A']);

let count = 0;

/**
 * Creates an element with an optional class name and text.
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 * @returns {HTMLElement}
 */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

/**
 * The contact number as on the source: "(+1) 78787888" (the code without its country).
 * @param {object} contact
 * @returns {string}
 */
function phoneText(contact) {
  const code = String(contact.countryCode || '').match(/\+[\d-]+/)?.[0];
  const number = String(contact.contactNumber || '').trim();
  if (!number) return '';
  return code ? `(${code}) ${number}` : number;
}

// the purchaser's read-only fields: the authored row (its label), the value from the answer, and
// the source's layout (half width from 992px; first name starts a new row)
const PURCHASER = [
  { key: 'title', width: 'half', value: (c) => c.title },
  {
    key: 'firstName', width: 'half', newRow: true, value: (c) => c.firstName,
  },
  { key: 'lastName', width: 'half', value: (c) => c.lastName },
  { key: 'countryOfResidence', width: 'half', value: (c, item) => item?.countryOfResidence },
  { key: 'contactNumber', width: 'half', value: (c) => phoneText(c) },
  { key: 'email', width: 'full', value: (c) => c.emailId },
];

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
function money(value, currency) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  const amount = new Intl.NumberFormat(locale(), {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(number);
  return currency ? `${currency} ${amount}` : amount;
}

/**
 * The visit's date and time as given (the lounge's local time, never moved to another time zone):
 * "30-Nov-2026" on the English pages (the source), the language's medium date elsewhere, and
 * "1600" for the time.
 * @param {string} value e.g. "2026-11-30 16:00:00"
 * @returns {{date: string, time: string}}
 */
function visitTime(value) {
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return { date: value ? String(value) : '', time: '' };
  const [, y, mo, d, h, mi] = m;
  const date = new Date(Date.UTC(+y, +mo - 1, +d));
  let day;
  if (getLanguage().startsWith('en')) {
    const month = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(date);
    day = `${d}-${month}-${y}`;
  } else {
    day = new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
  }
  return { date: day, time: h !== undefined ? `${h}${mi}` : '' };
}

/**
 * The terms' HTML from the API, keeping only simple text tags and web or site links (as text
 * nodes and new elements: nothing from the answer runs or styles the page).
 * @param {string} html
 * @returns {DocumentFragment}
 */
function safeTerms(html) {
  const fragment = document.createDocumentFragment();
  const source = new DOMParser().parseFromString(String(html || ''), 'text/html').body;
  const copy = (from, to) => {
    from.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        to.append(node.textContent);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      if (!TERMS_TAGS.has(node.tagName)) {
        if (!['SCRIPT', 'STYLE', 'TEMPLATE', 'IFRAME', 'OBJECT'].includes(node.tagName)) copy(node, to);
        return;
      }
      if (node.tagName === 'A') {
        const href = node.getAttribute('href') || '';
        let url;
        try { url = new URL(href, window.location.href); } catch { url = null; }
        // a broken or non-web link keeps its text only
        if (!href || !url || !['http:', 'https:'].includes(url.protocol)) {
          copy(node, to);
          return;
        }
        const link = document.createElement('a');
        link.href = url.href;
        copy(node, link);
        to.append(link);
        return;
      }
      const element = document.createElement(node.tagName.toLowerCase());
      copy(node, element);
      // the answer's empty paragraphs are left out
      if (element.tagName === 'P' && !element.textContent.trim() && !element.children.length) return;
      to.append(element);
    });
  };
  copy(source, fragment);
  // plain text becomes one paragraph
  if (!fragment.querySelector?.('p, ul, ol') && fragment.textContent.trim()) {
    const p = el('p');
    p.append(fragment);
    fragment.append(p);
  }
  return fragment;
}

/**
 * The authored texts, by row name (Key | Text): the text cell of each row.
 * @param {Element} block
 * @returns {Map<string, Element>}
 */
function readTexts(block) {
  const texts = new Map();
  [...block.children].forEach((row) => {
    const [key, cell] = row.children;
    const name = key?.textContent.trim().toLowerCase();
    if (name && cell) texts.set(name, cell);
  });
  return texts;
}

/**
 * Decorates the View Booking block: a member's booking (the source Review your Booking page), from
 * GetOrderDetail for the address's `bookingid`, with the member's login token. Authors write the
 * texts (Key | Text rows, see README); the booking itself comes from the API.
 * @param {Element} block The View Booking block element
 */
export default function decorate(block) {
  const texts = readTexts(block);
  const text = (key) => texts.get(key.toLowerCase())?.textContent.trim() || '';
  const link = (key) => texts.get(key.toLowerCase())?.querySelector('a[href]');

  // the title, after the arrow back to the bookings list
  const heading = el('h1', 'view-booking-title');
  const back = link('back');
  if (back) {
    const arrow = el('a', 'view-booking-back');
    arrow.href = back.href;
    arrow.setAttribute('aria-label', back.textContent.trim() || back.href);
    heading.append(arrow);
  }
  heading.append(text('heading'));

  const message = el('p', 'view-booking-message');
  message.setAttribute('role', 'status');
  message.hidden = true;
  const body = el('div', 'view-booking-body');
  body.hidden = true;
  block.replaceChildren(heading, message, body);

  const params = new URLSearchParams(window.location.search);
  const orderId = (params.get('bookingid') || params.get('orderId') || '').trim();
  const showMessage = (content, retry) => {
    message.replaceChildren(content);
    if (retry) {
      const button = el('button', 'view-booking-retry', translate('formRetry'));
      button.type = 'button';
      button.addEventListener('click', retry);
      message.append(' ', button);
    }
    message.hidden = false;
  };
  if (!ORDER_ID.test(orderId)) {
    showMessage(text('notFound') || translate('bookingNotFound'));
    return;
  }
  // no login: the page's login check is already sending the visitor home
  if (!getToken()) return;

  /**
   * One booked item's box: location (and the edit and cancel links), date and time, guests,
   * services, price.
   * @param {object} item
   * @param {string} currency
   * @param {object} order
   * @returns {HTMLElement}
   */
  const itemBox = (item, currency, order) => {
    const box = el('div', 'view-booking-box');
    const cell = (name, title) => {
      const part = el('div', `view-booking-cell view-booking-${name}`);
      if (title) part.append(el('p', 'view-booking-cell-title', title));
      box.append(part);
      return part;
    };
    const details = (rows) => {
      const list = el('dl', 'view-booking-details');
      rows.filter(([, value]) => value !== '' && value !== null && value !== undefined)
        .forEach(([label, value, unit]) => {
          const row = el('div', 'view-booking-detail');
          const dd = el('dd', '', value);
          if (unit) dd.append(el('span', 'view-booking-unit', unit));
          row.append(el('dt', '', label), dd);
          list.append(row);
        });
      return list;
    };

    // the lounge: its name, then where it is; a link only when the answer gives a web address
    const location = cell('location', text('location'));
    const name = el('span', 'view-booking-lounge-name', String(item.propertyDisplayName || item.propertyName || '').trim());
    const address = el('span', 'view-booking-lounge-address', [item.shortLocation, item.locationName]
      .map((part) => String(part || '').trim()).filter(Boolean).join('. '));
    let place;
    try {
      const url = item.propertyUrl && new URL(item.propertyUrl, window.location.href);
      if (url && ['http:', 'https:'].includes(url.protocol)) {
        place = el('a', 'view-booking-lounge');
        place.href = url.href;
      }
    } catch { /* no link */ }
    place = place || el('p', 'view-booking-lounge');
    place.append(name, address);
    location.append(place);
    // edit and cancel: the authored pages, with this booking, when the answer allows them
    const actions = el('ul', 'view-booking-actions');
    [['edit', item.isEligibleForModify], ['cancel', item.isEligibleForCancel]].forEach(([key, allowed]) => {
      const authored = link(key);
      if (!authored || allowed === false) return;
      const url = new URL(authored.href, window.location.href);
      url.searchParams.set('bookingid', order.orderId || orderId);
      const action = el('a', '', authored.textContent.trim());
      action.href = url.href;
      const li = el('li');
      li.append(action);
      actions.append(li);
    });
    if (actions.children.length) location.append(actions);

    const { date, time } = visitTime(item.startDate);
    cell('date-time', text('dateTime')).append(details([
      [text('date'), date], [text('time'), time, time && text('hours')],
    ]));

    const groups = new Map((order.ageGroup || []).map((g) => [g.group, g.description]));
    const guests = item.guestsCount || {};
    cell('guests', text('guests')).append(details([
      [text('adults') || `${groups.get('adult') || ''}:`, Number(guests.adult) > 0 ? guests.adult : ''],
      [text('children') || `${groups.get('child') || ''}:`, Number(guests.child) > 0 ? guests.child : ''],
    ]));

    const services = cell('services', text('services'));
    const service = el('ul', 'view-booking-service-list');
    service.append(el('li', '', item.productDisplayName || item.productName || ''));
    services.append(service);

    const price = cell('price', text('price'));
    price.append(el('p', 'view-booking-price-amount', money(item.itemPriceDetails?.productTotalPrice?.totalPrice, currency)));
    return box;
  };

  /**
   * Fills the booking from the GetOrderDetail answer.
   * @param {object} order
   */
  const fill = (order) => {
    const items = Array.isArray(order.orderItems) ? order.orderItems : [];
    const currency = items[0]?.itemPriceDetails?.baseRate?.[0]?.currency
      || order.payment?.paymentOrders?.[0]?.paymentCurrency || '';
    const parts = [];

    parts.push(el('h2', 'view-booking-order', `${text('orderNo')} ${order.orderId || orderId}`.trim()));
    if (text('details')) parts.push(el('p', 'view-booking-label', text('details')));
    items.forEach((item) => parts.push(itemBox(item, currency, order)));

    // the purchaser, read-only (the shared form look)
    const contact = order.contactInfo || order.guests?.[0] || {};
    const purchaser = el('section', 'view-booking-purchaser');
    if (text('purchaser')) purchaser.append(el('h3', 'view-booking-section-title', text('purchaser')));
    const fields = el('div', 'form-fields');
    PURCHASER.forEach(({
      key, width, newRow, value,
    }) => {
      if (!texts.has(key.toLowerCase())) return;
      count += 1;
      const field = el('div', `form-field width-${width}${newRow ? ' new-row' : ''}`);
      const label = el('label', 'form-label', text(key));
      const input = el('input', 'form-input');
      input.id = `view-booking-${key}-${count}`;
      label.htmlFor = input.id;
      input.type = 'text';
      input.readOnly = true;
      input.value = value(contact, items[0]) ?? '';
      field.append(label, input);
      fields.append(field);
    });
    purchaser.append(fields);
    parts.push(purchaser);

    // the totals: subtotal and discounts (from 992px, as the source), then the total
    const totals = el('div', 'view-booking-totals');
    const total = order.orderTotalPrice || {};
    const row = (className, label, amount, note) => {
      const line = el('div', `view-booking-total-row ${className}`);
      const name = el('p', 'view-booking-total-label');
      name.append(el('span', '', label));
      if (note) name.append(el('span', 'view-booking-total-note', note));
      line.append(name, el('p', 'view-booking-total-amount', amount));
      totals.append(line);
    };
    if (text('subtotal')) row('is-subtotal', text('subtotal'), money(total.totalBasePrice, currency));
    const discounts = new Map();
    items.forEach((item) => (item.itemPriceDetails?.discounts || []).forEach((d) => {
      discounts.set(d.name, (discounts.get(d.name) || 0) + Number(d.value || 0));
    }));
    discounts.forEach((value, label) => {
      if (value > 0) row('is-discount', `${label || text('discount')}:`, `- ${money(value, currency)}`);
    });
    row('is-total', text('total'), money(total.totalPrice, currency), text('taxes'));
    parts.push(totals);

    // the terms (from the API), shown only those for the website
    const policies = (Array.isArray(order.sortedTermsPolicies) ? order.sortedTermsPolicies
      : items[0]?.itemPriceDetails?.termsPolicies || [])
      .filter((policy) => policy.isDisplayOnWebsite !== false);
    if (policies.length) {
      const terms = el('section', 'view-booking-terms');
      if (text('terms')) terms.append(el('h3', 'view-booking-section-title', text('terms')));
      policies.forEach((policy) => {
        const group = el('div', 'view-booking-term');
        if (policy.termsName) group.append(el('h4', 'view-booking-term-title', policy.termsName));
        const content = el('div', 'view-booking-term-body');
        content.append(safeTerms(policy.description));
        group.append(content);
        terms.append(group);
      });
      parts.push(terms);
    }
    body.replaceChildren(...parts);
    body.hidden = false;
  };

  const load = () => {
    // the site's full-page loader until the booking is in (the text for screen readers)
    showLoader();
    showMessage(text('loading') || translate('bookingLoading'));
    block.setAttribute('aria-busy', 'true');
    fetch(apiUrl('getOrderDetail'), {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    })
      .then((res) => {
        // the token refused (invalid or expired): log out and go home (the loader stays meanwhile)
        if (res.status === 401) {
          logout();
          return null;
        }
        return res.json().catch(() => ({})).then((data) => {
          if (res.status === 404 || (res.ok && !data?.orderId)) throw Object.assign(new Error('booking'), { notFound: true });
          if (!res.ok || data.error || Number(data.serviceResponseCode) >= 400) throw new Error('booking');
          return data;
        });
      })
      .then((order) => {
        if (!order) return;
        fill(order);
        message.hidden = true;
        block.removeAttribute('aria-busy');
        hideLoader();
      })
      .catch((error) => {
        hideLoader();
        block.removeAttribute('aria-busy');
        if (error.notFound) showMessage(text('notFound') || translate('bookingNotFound'));
        else showMessage(text('error') || translate('bookingLoadError'), load);
      });
  };
  load();
}
