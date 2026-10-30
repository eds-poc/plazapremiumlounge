import { getToken } from '../../scripts/auth.js';
import { translate } from '../../scripts/i18n.js';
import {
  bookingId, bookingLoader, fetchOrder, groupItems, itemPrice, money, orderCurrency, readTexts,
  visitTime,
} from '../../scripts/bookings.js';

// the tags kept in the terms' HTML (from the API); anything else is dropped, its text kept
const TERMS_TAGS = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'UL', 'OL', 'LI', 'HR', 'A']);
// the terms' block tags: the text between them is a paragraph of its own
const TERMS_BLOCKS = new Set(['P', 'UL', 'OL', 'HR']);

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
 * The terms' HTML from the API, keeping only simple text tags and web or site links (as text
 * nodes and new elements: nothing from the answer runs or styles the page).
 * @param {string} html
 * @returns {DocumentFragment}
 */
function safeTerms(html) {
  const fragment = document.createDocumentFragment();
  // the answer's links with doubled quotes (href=""https://…"") as plain links
  const repaired = String(html || '').replace(/href=""(https?:\/\/[^"\s]+)""/gi, 'href="$1"');
  const source = new DOMParser().parseFromString(repaired, 'text/html').body;
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
      // the answer's empty paragraphs are left out (at the top they still end the text before them)
      if (element.tagName === 'P' && !element.textContent.trim() && !element.children.length
        && to !== fragment) return;
      to.append(element);
    });
  };
  copy(source, fragment);
  // the text outside any paragraph (e.g. between the answer's stray </p>) in paragraphs of its own,
  // one per run between blocks; the empty paragraphs only end a run
  const terms = document.createDocumentFragment();
  let run = null;
  [...fragment.childNodes].forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE && TERMS_BLOCKS.has(node.tagName)) {
      run = null;
      if (node.tagName !== 'P' || node.textContent.trim() || node.children.length) terms.append(node);
      return;
    }
    if (!run) {
      if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) return;
      run = el('p');
      terms.append(run);
    }
    run.append(node);
  });
  return terms;
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
  // the booking pages' maroon band at the top (no steps on this page; styles/booking-steps.css)
  const band = el('div', 'booking-steps');
  block.replaceChildren(band, heading, message, body);

  const orderId = bookingId();
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
  if (!orderId) {
    showMessage(text('notFound') || translate('bookingNotFound'));
    return;
  }
  // no login: the page's login check is already sending the visitor home
  if (!getToken()) return;

  /**
   * One booked item's box: location (and the edit and cancel links), date and time, guests,
   * services, its add-ons (additional services, when there are any), price (the item and its
   * add-ons).
   * @param {{main: object, addOns: object[]}} group
   * @param {string} currency
   * @param {object} order
   * @returns {HTMLElement}
   */
  const itemBox = ({ main: item, addOns }, currency, order) => {
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

    // the add-ons: "1 x Plaza Premium Lounge Sakura Shrimp Spice (50g)"
    if (addOns.length) {
      const extras = cell('additional-services', text('additionalServices') || translate('bookingAdditionalServices'));
      const list = el('ul', 'view-booking-service-list');
      addOns.forEach((addOn) => {
        list.append(el('li', '', `${Number(addOn.quantity) || 1} x ${addOn.productDisplayName || addOn.productName || ''}`));
      });
      extras.append(list);
    }

    const amount = [item, ...addOns].reduce((sum, part) => sum + itemPrice(part), 0);
    const price = cell('price', text('price'));
    price.append(el('p', 'view-booking-price-amount', money(amount, currency)));
    return box;
  };

  /**
   * Fills the booking from the GetOrderDetail answer.
   * @param {object} order
   */
  const fill = (order) => {
    const items = Array.isArray(order.orderItems) ? order.orderItems : [];
    const currency = orderCurrency(order);
    const parts = [];

    parts.push(el('h2', 'view-booking-order', `${text('orderNo')} ${order.orderId || orderId}`.trim()));
    if (text('details')) parts.push(el('p', 'view-booking-label', text('details')));
    groupItems(items).forEach((group) => parts.push(itemBox(group, currency, order)));

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

  // the site's full-page loader until the booking is in (the text for screen readers); a refused
  // token logs out and goes home (the loader stays meanwhile)
  const loader = bookingLoader();
  const load = () => {
    loader.start();
    showMessage(text('loading') || translate('bookingLoading'));
    block.setAttribute('aria-busy', 'true');
    fetchOrder(orderId)
      .then((order) => {
        if (!order) return;
        fill(order);
        message.hidden = true;
        block.removeAttribute('aria-busy');
        loader.done();
      })
      .catch((error) => {
        loader.done();
        block.removeAttribute('aria-busy');
        if (error.notFound) showMessage(text('notFound') || translate('bookingNotFound'));
        else showMessage(text('error') || translate('bookingLoadError'), load);
      });
  };
  load();
}
