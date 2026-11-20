/**
 * The Cancel Booking block: a member's booking before cancelling it, as the source "Review Cancel
 * Booking Details" page (`/en-uk/cancel-your-booking?bookingid=…`), under the page's Booking Steps
 * block (My Bookings › Review Cancelled Booking Details › Confirm):
 * - the title after an arrow back to the bookings;
 * - the booking summary: a row per booked lounge visit (location with the To Cancel tag, date and
 *   time, guests, services, its add-ons, price);
 * - the total, the cancellation fee and the refund amount;
 * - a bar with the Cancel Booking button (no action yet).
 * The booking comes from GetOrderDetail (scripts/bookings.js) for the address's `bookingid`, with
 * the member's login token. Every text the block shows is authored, a Key | Text row each.
 */
import { getToken } from '../../scripts/auth.js';
import {
  bookingId, bookingLoader, fetchOrder, groupItems, itemPrice, money, orderCurrency, readTexts,
  visitTime,
} from '../../scripts/bookings.js';
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
 * The booking's amounts: its total (as paid), the cancellation fee and what's refunded (the total
 * less the fee). GetOrderDetail gives the fee as `orderTotalPrice.cancellationCharge`; it is 0
 * before the booking is cancelled, so the refund is then the whole total.
 * @param {object} order
 * @returns {{total: number, fee: number, refund: number}}
 */
function readAmounts(order) {
  const prices = order.orderTotalPrice || {};
  const total = Number(prices.totalPrice) || 0;
  const fee = Math.max(0, Number(prices.cancellationCharge) || 0);
  return { total, fee, refund: Math.max(0, total - fee) };
}

/**
 * Decorates the Cancel Booking block. Rows: Key | Text (see README); the back row holds a link.
 * @param {Element} block The Cancel Booking block element
 */
export default function decorate(block) {
  const texts = readTexts(block);
  const text = (key) => texts.get(key.toLowerCase())?.textContent.trim() || '';
  const link = (key) => texts.get(key.toLowerCase())?.querySelector('a[href]');

  // the title, after the arrow back to the bookings
  const heading = el('h1', 'cancel-booking-title');
  const back = link('back');
  if (back) {
    const arrow = el('a', 'cancel-booking-back');
    arrow.href = back.href;
    arrow.setAttribute('aria-label', back.textContent.trim() || back.href);
    heading.append(arrow);
  }
  heading.append(text('heading'));

  const message = el('p', 'cancel-booking-message');
  message.setAttribute('role', 'status');
  message.hidden = true;
  const body = el('div', 'cancel-booking-body');
  body.hidden = true;
  block.replaceChildren(heading, message, body);

  const orderId = bookingId();
  const showMessage = (content, retry) => {
    message.replaceChildren(content);
    if (retry) {
      const button = el('button', 'cancel-booking-retry', translate('formRetry'));
      button.type = 'button';
      button.addEventListener('click', retry);
      message.append(' ', button);
    }
    message.hidden = false;
  };
  if (!orderId) {
    showMessage(text('notFound'));
    return;
  }
  // no login: the page's login check is already sending the visitor home
  if (!getToken()) return;

  /**
   * One booked visit's row: location (with the To Cancel tag), date and time, guests, services,
   * its add-ons (when there are any), price (the visit and its add-ons).
   * @param {{main: object, addOns: object[]}} group
   * @param {string} currency
   * @returns {HTMLElement}
   */
  const itemBox = ({ main: item, addOns }, currency) => {
    const box = el('div', 'cancel-booking-box');
    const cell = (name, title) => {
      const part = el('div', `cancel-booking-cell cancel-booking-${name}`);
      if (title) part.append(el('p', 'cancel-booking-cell-title', title));
      box.append(part);
      return part;
    };
    const details = (rows) => {
      const list = el('dl', 'cancel-booking-details');
      rows.filter(([, value]) => value !== '' && value !== null && value !== undefined)
        .forEach(([label, value, unit]) => {
          const row = el('div', 'cancel-booking-detail');
          const dd = el('dd', '', value);
          if (unit) dd.append(el('span', 'cancel-booking-unit', unit));
          row.append(el('dt', '', label), dd);
          list.append(row);
        });
      return list;
    };

    // the lounge: its name, then where it is (its place in the airport, then the airport)
    const location = cell('location', text('location'));
    const place = el('p', 'cancel-booking-lounge');
    place.append(
      el('span', 'cancel-booking-lounge-name', String(item.propertyDisplayName || item.propertyName || '').trim()),
      el('span', 'cancel-booking-lounge-address', [item.shortLocation, item.locationName]
        .map((part) => String(part || '').trim()).filter(Boolean).join(', ')),
    );
    location.append(place);
    if (text('toCancel')) location.append(el('p', 'cancel-booking-tag', text('toCancel')));

    const { date, time } = visitTime(item.startDate);
    cell('date-time', text('dateTime')).append(details([
      [text('date'), date], [text('time'), time, time && text('hours')],
    ]));

    const guests = item.guestsCount || {};
    cell('guests', text('guests')).append(details([
      [text('adults'), Number(guests.adult) > 0 ? guests.adult : ''],
      [text('children'), Number(guests.child) > 0 ? guests.child : ''],
    ]));

    const services = el('ul', 'cancel-booking-service-list');
    services.append(el('li', '', item.productDisplayName || item.productName || ''));
    // the add-ons after the service: "1 x Plaza Premium Lounge Sakura Shrimp Spice (50g)"
    addOns.forEach((addOn) => {
      services.append(el('li', '', `${Number(addOn.quantity) || 1} x ${addOn.productDisplayName || addOn.productName || ''}`));
    });
    cell('services', text('services')).append(services);

    const amount = [item, ...addOns].reduce((sum, part) => sum + itemPrice(part), 0);
    cell('price', text('price')).append(el('p', 'cancel-booking-price-amount', money(amount, currency)));
    return box;
  };

  /**
   * Fills the booking from the GetOrderDetail answer: the summary, the amounts and the button
   * (only for a booking that can be cancelled; otherwise the notCancellable text).
   * @param {object} order
   */
  const fill = (order) => {
    const items = Array.isArray(order.orderItems) ? order.orderItems : [];
    const currency = orderCurrency(order);
    const parts = [];
    if (text('summary')) parts.push(el('p', 'cancel-booking-label', text('summary')));
    const summary = el('div', 'cancel-booking-summary');
    summary.append(...groupItems(items).map((group) => itemBox(group, currency)));
    parts.push(summary);

    // the total, then the fee taken off it and what's refunded
    const { total, fee, refund } = readAmounts(order);
    const totals = el('dl', 'cancel-booking-totals');
    [
      ['total', total, ''],
      ['fee', fee, '- '],
      ['refund', refund, ''],
    ].forEach(([key, value, sign]) => {
      if (!text(key)) return;
      const row = el('div', `cancel-booking-total-row is-${key}`);
      row.append(el('dt', '', text(key)), el('dd', '', `${sign}${money(value, currency)}`));
      totals.append(row);
    });
    if (totals.children.length) parts.push(totals);

    // the bar with the button; a booking the API won't let cancel says so instead
    const cancellable = items.length > 0
      && items.every((item) => item.isEligibleForCancel !== false);
    const bar = el('div', 'cancel-booking-bar');
    if (cancellable && text('button')) {
      const button = el('button', 'button primary cancel-booking-button', text('button'));
      button.type = 'button';
      bar.append(button);
    } else if (!cancellable && text('notCancellable')) {
      bar.append(el('p', 'cancel-booking-note', text('notCancellable')));
    }
    if (bar.children.length) parts.push(bar);
    body.replaceChildren(...parts);
    body.hidden = false;
  };

  // the site's full-page loader until the booking is in (the text for screen readers); a refused
  // token logs out and goes home (the loader stays meanwhile)
  const loader = bookingLoader();
  const load = () => {
    loader.start();
    showMessage(text('loading'));
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
        if (error.notFound) showMessage(text('notFound'));
        else showMessage(text('error'), load);
      });
  };
  load();
}
