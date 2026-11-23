/**
 * The Cancel Booking Confirmation block: a cancelled booking's summary, as the source "Order
 * Cancelled!" page (`/en-uk/booking-cancel-confirmation?bookingid=…`): the title and message (left
 * from 992px), the Cancellation Details card (right): the order number, the lead guest, each
 * cancelled lounge visit (date and time, guests, services), what was paid, the cancellation fee and
 * the refund; then the Back To Home button. The block fills its section in the brand maroon (no
 * Section Metadata needed). The summary comes from the cancellation summary API
 * for the address's `bookingid`, with the member's login token; every text is authored, a Key |
 * Text row each.
 */
import { authHeaders, getToken, logout } from '../../scripts/auth.js';
import {
  bookingId, bookingLoader, groupItems, money, orderCurrency, readTexts, visitTime,
} from '../../scripts/bookings.js';
import apiUrl from '../../scripts/endpoints.js';
import { translate } from '../../scripts/i18n.js';

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
 * The cancelled booking's summary: a GET with the order id (`?orderId=`) and the login token. A
 * refused token (401) logs out and goes home (the promise then gives null); a missing booking
 * rejects with `notFound`, any other failure without.
 * @param {string} orderId
 * @returns {Promise<object|null>}
 */
async function fetchSummary(orderId) {
  const url = apiUrl('cancellationSummary');
  url.searchParams.set('orderId', orderId);
  const res = await fetch(url, { headers: authHeaders() });
  if (res.status === 401) {
    logout();
    return null;
  }
  const data = await res.json().catch(() => ({}));
  if (res.ok && data?.orderId && !data.error && !data.errorCode) return data;
  throw Object.assign(new Error('cancellation summary'), { notFound: res.ok || res.status === 404 });
}

/**
 * The guests as the authored texts write them: "1 Adult", "2 Adults, 1 Child" (`{n}` the count);
 * a count without its text is left out.
 * @param {{adult?: number, child?: number}} guests
 * @param {function(string): string} text
 * @returns {string}
 */
function guestsText(guests, text) {
  const part = (count, one, many) => {
    const n = Number(count) || 0;
    if (!n) return '';
    return (n === 1 ? text(one) : text(many)).replaceAll('{n}', n);
  };
  return [part(guests?.adult, 'adult', 'adults'), part(guests?.child, 'child', 'children')]
    .filter(Boolean).join(', ');
}

/**
 * Decorates the Cancel Booking Confirmation block. Rows: Key | Text (see README); the message row
 * holds rich text (e.g. a Contact Us link), the back row a link.
 * @param {Element} block The Cancel Booking Confirmation block element
 */
export default function decorate(block) {
  const texts = readTexts(block);
  const text = (key) => texts.get(key.toLowerCase())?.textContent.trim() || '';

  // the title and the message (the authored cell's paragraphs and links, as authored)
  const intro = el('div', 'cancel-booking-confirmation-intro');
  if (text('heading')) intro.append(el('h1', 'cancel-booking-confirmation-title', text('heading')));
  const message = texts.get('message');
  if (message) {
    const body = el('div', 'cancel-booking-confirmation-text');
    body.append(...[...message.childNodes].map((node) => node.cloneNode(true)));
    intro.append(body);
  }
  const card = el('section', 'cancel-booking-confirmation-card');
  card.hidden = true;
  const status = el('p', 'cancel-booking-confirmation-status');
  status.setAttribute('role', 'status');
  status.hidden = true;
  const columns = el('div', 'cancel-booking-confirmation-columns');
  columns.append(intro, card);
  block.replaceChildren(columns, status);

  // Back To Home: the authored link as the site's button (white on the block's maroon)
  const backLink = texts.get('back')?.querySelector('a[href]');
  if (backLink) {
    const actions = el('p', 'cancel-booking-confirmation-actions');
    const back = el('a', 'button primary cancel-booking-confirmation-back', backLink.textContent.trim());
    back.href = backLink.href;
    actions.append(back);
    block.append(actions);
  }

  const showStatus = (content, retry) => {
    status.replaceChildren(content);
    if (retry) {
      const button = el('button', 'cancel-booking-confirmation-retry', translate('formRetry'));
      button.type = 'button';
      button.addEventListener('click', retry);
      status.append(' ', button);
    }
    status.hidden = false;
  };
  const orderId = bookingId();
  if (!orderId) {
    showStatus(text('notFound'));
    return;
  }
  // no login: the page's login check is already sending the visitor home
  if (!getToken()) return;

  /**
   * A label and its value, as the card's lines: "First Name: Abc" (`inline`) or the label above
   * its maroon value.
   * @param {string} label
   * @param {string} value
   * @param {string} [className]
   * @returns {HTMLElement|null}
   */
  const detail = (label, value, className = '') => {
    if (!value) return null;
    const row = el('div', `cancel-booking-confirmation-detail ${className}`.trim());
    row.append(el('dt', '', label), el('dd', '', value));
    return row;
  };

  /**
   * Fills the card from the cancellation summary.
   * @param {object} summary
   */
  const fill = (summary) => {
    const items = Array.isArray(summary.orderItems) ? summary.orderItems : [];
    const currency = summary.orderCurrency || orderCurrency(summary);
    const parts = [];

    const head = el('div', 'cancel-booking-confirmation-head');
    if (text('title')) head.append(el('h2', 'cancel-booking-confirmation-card-title', text('title')));
    head.append(el('p', 'cancel-booking-confirmation-order', `${text('orderNo')} ${summary.orderId || orderId}`.trim()));
    parts.push(head);

    // the lead guest (the answer's contactInfo); no section without it
    const contact = summary.contactInfo || {};
    const guest = el('dl', 'cancel-booking-confirmation-guest');
    [['firstName', contact.firstName], ['lastName', contact.lastName], ['email', contact.emailId]]
      .forEach(([key, value]) => {
        const row = detail(text(key), String(value || '').trim(), 'is-inline');
        if (row) guest.append(row);
      });
    if (guest.children.length) {
      const section = el('div', 'cancel-booking-confirmation-section');
      if (text('leadGuest')) section.append(el('h3', 'cancel-booking-confirmation-section-title', text('leadGuest')));
      section.append(guest);
      parts.push(section);
    }

    // each cancelled lounge visit: the lounge, then its date and time, guests and services
    groupItems(items).forEach(({ main: item, addOns }) => {
      const visit = el('div', 'cancel-booking-confirmation-section cancel-booking-confirmation-visit');
      const lounge = el('p', 'cancel-booking-confirmation-lounge');
      lounge.append(
        el('b', '', String(item.propertyDisplayName || item.propertyName || '').trim()),
        el('span', '', [item.shortLocation, item.locationName]
          .map((part) => String(part || '').trim()).filter(Boolean).join(', ')),
      );
      const { date, time } = visitTime(item.startDate);
      const when = [date, time && `${time} ${text('hours')}`.trim()].filter(Boolean).join(', ');
      const services = [item, ...addOns].map((part, i) => {
        const name = String(part.productDisplayName || part.productName || '').trim();
        return i ? `${Number(part.quantity) || 1} x ${name}` : name;
      }).filter(Boolean).join(', ');
      const list = el('dl', 'cancel-booking-confirmation-visit-details');
      [
        detail(text('dateTime'), when),
        detail(text('guests'), guestsText(item.guestsCount, text)),
        detail(text('services'), services, 'is-wide'),
      ].filter(Boolean).forEach((row) => list.append(row));
      visit.append(lounge, list);
      parts.push(visit);
    });

    // what was paid and the fee, then the refund
    const amount = (value) => money(Number(value) || 0, currency);
    const paid = el('dl', 'cancel-booking-confirmation-amounts');
    [
      detail(text('paid'), amount(summary.orderTotalPrice?.totalPrice)),
      detail(text('fee'), `- ${amount(summary.cancellationCharge)}`),
    ].filter((row) => row && row.querySelector('dt').textContent).forEach((row) => paid.append(row));
    if (paid.children.length) parts.push(paid);
    if (text('refund')) {
      const refund = el('dl', 'cancel-booking-confirmation-refund');
      const row = detail(text('refund'), amount(summary.totalRefund));
      if (text('taxes')) row.querySelector('dd').append(el('span', 'cancel-booking-confirmation-note', text('taxes')));
      refund.append(row);
      parts.push(refund);
    }
    card.replaceChildren(...parts);
    card.hidden = false;
  };

  // the site's full-page loader until the summary is in (the text for screen readers); a refused
  // token logs out and goes home (the loader stays meanwhile)
  const loader = bookingLoader();
  const load = () => {
    loader.start();
    showStatus(text('loading'));
    block.setAttribute('aria-busy', 'true');
    fetchSummary(orderId)
      .then((summary) => {
        if (!summary) return;
        fill(summary);
        status.hidden = true;
        block.removeAttribute('aria-busy');
        loader.done();
      })
      .catch((error) => {
        loader.done();
        block.removeAttribute('aria-busy');
        if (error.notFound) showStatus(text('notFound'));
        else showStatus(text('error'), load);
      });
  };
  load();
}
