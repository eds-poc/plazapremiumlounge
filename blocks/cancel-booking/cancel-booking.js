/**
 * The Cancel Booking block: a member's booking before cancelling it, as the source "Review Cancel
 * Booking Details" page (`/en-uk/cancel-your-booking?bookingid=…`), under the page's Booking Steps
 * block (My Bookings › Review Cancelled Booking Details › Confirm):
 * - the title after an arrow back to the bookings;
 * - the booking summary: a row per booked lounge visit (location with the To Cancel tag, date and
 *   time, guests, services, its add-ons, price);
 * - the total, the cancellation fee and the refund amount;
 * - a bar with the Cancel Booking button: a notice popup (the refund and when it comes), then a
 *   confirmation popup, whose Yes asks the cancel booking API to cancel it; once it has (a 200),
 *   the Order Cancelled! page for the booking.
 * The booking comes from GetOrderDetail (scripts/bookings.js) for the address's `bookingid`, with
 * the member's login token. Every text the block shows is authored, a Key | Text row each.
 */
import { authHeaders, getToken, logout } from '../../scripts/auth.js';
import apiUrl from '../../scripts/endpoints.js';
import {
  bookingHref, bookingId, bookingLoader, bookingPage, fetchOrder, groupItems, itemPrice, money,
  orderCurrency, readTexts, visitTime,
} from '../../scripts/bookings.js';
import { translate } from '../../scripts/i18n.js';
import { setLoading } from '../../scripts/properties.js';

// the Order Cancelled! page, in the language site without a confirmationPage row (the booking
// added as `?bookingid=`)
const CONFIRMATION_PAGE = 'booking-cancel-confirmation';
// the popups before cancelling (the notice, then the confirmation): one popup, built once (its
// key) and refilled for each
const POPUP_KEY = 'cancel-booking-popup';

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
 * Asks the cancel booking API to cancel a booking: a POST of the order and the reason, with the
 * member's login token. It answers 200 (and `{ orderId }`) once the booking is cancelled; a
 * refused token (401) logs out and goes home, as the booking's own request does.
 * @param {string} orderId
 * @param {string} reason The authored cancellationReason
 * @returns {Promise<number>} The answer's HTTP status
 */
async function cancelBooking(orderId, reason) {
  const res = await fetch(apiUrl('cancelBooking'), {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, cancellationReason: reason }),
  });
  if (res.status === 401) logout();
  return res.status;
}

/**
 * Asks one question before cancelling, in the site's confirmation popup
 * (scripts/confirm-dialog.js): the notice, then the confirmation, in one popup refilled for each.
 * Resolves true for its yes button only.
 * @param {HTMLElement} trigger The Cancel Booking button (focus returns there)
 * @param {{title: string, text: string, yes: string, no: string}} question The authored texts
 * @returns {Promise<boolean>}
 */
async function ask(trigger, {
  title, text, yes, no,
}) {
  const { default: confirmDialog } = await import('../../scripts/confirm-dialog.js');
  return confirmDialog(trigger, {
    key: POPUP_KEY, title, body: [text], yes, no,
  });
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

    // the bar with the button (it needs the notice and its Confirm: a booking is never cancelled
    // without asking); a booking the API won't let cancel says so instead
    const cancellable = items.length > 0
      && items.every((item) => item.isEligibleForCancel !== false);
    const bar = el('div', 'cancel-booking-bar');
    if (cancellable && text('button') && text('notice') && text('noticeConfirm')) {
      const button = el('button', 'button primary cancel-booking-button', text('button'));
      button.type = 'button';
      button.setAttribute('aria-haspopup', 'dialog');
      button.addEventListener('click', async () => {
        // the notice, then (when it's authored) the confirmation: both must be accepted
        const notice = {
          title: text('noticeTitle'),
          text: text('notice').replaceAll('{amount}', money(refund, currency)),
          yes: text('noticeConfirm'),
          no: text('noticeCancel'),
        };
        if (!(await ask(button, notice))) return;
        const confirmation = {
          title: text('confirmTitle'),
          text: text('confirmText'),
          yes: text('confirmYes'),
          no: text('confirmNo'),
        };
        if (confirmation.text && confirmation.yes && !(await ask(button, confirmation))) return;
        // the site's loader while the booking is cancelled; once it is (a 200), the Order
        // Cancelled! page (the loader stays while it loads). Otherwise the button again (what the
        // page says about a failure comes later)
        const id = order.orderId || orderId;
        button.disabled = true;
        setLoading(true);
        try {
          const status = await cancelBooking(id, text('cancellationReason'));
          if (status === 200) {
            const page = bookingPage(link('confirmationPage')?.getAttribute('href'), CONFIRMATION_PAGE);
            window.location.assign(bookingHref(page, id));
            return;
          }
          // a refused login is logging out (the loader stays meanwhile)
          if (status === 401) return;
          // eslint-disable-next-line no-console
          console.error(`cancel-booking: the cancel request answered ${status}`);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('cancel-booking: the cancel request failed', error);
        }
        setLoading(false);
        button.disabled = false;
      });
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
