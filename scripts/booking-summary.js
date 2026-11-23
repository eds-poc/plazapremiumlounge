/*
 * The Booking Summary card (the source's .booking-summary-wrapper), shared by the Checkout and
 * Book Your Visit blocks: a cart line (a lounge with its Departures / Arrivals badge, its details
 * and add-ons, or a pass), the totals (the service total and discounts when there are discounts),
 * the promo code field (scripts/mini-cart.js) and the total with its note. Its styles are
 * styles/booking-summary.css; each block adds its title, button and phones' bar.
 */
import { formatAmount, loungeDetails } from './cart-summary.js';
import { translate } from './i18n.js';
import { buildPromo } from './mini-cart.js';

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
 * A row of the summary's totals: its label and amount.
 * @param {string} className
 * @param {Node|string} label
 * @param {string} amount
 * @returns {HTMLElement}
 */
export function totalRow(className, label, amount) {
  const row = el('div', `checkout-summary-row ${className}`);
  row.append(typeof label === 'string' ? el('span', 'checkout-summary-label', label) : label, el('span', 'checkout-summary-amount', amount));
  return row;
}

// the words in a lounge's location that make it a Departures or an Arrivals lounge (the source's,
// in every language; departures first)
const SIDE_WORDS = {
  departure: ['departure', '出境', '離境', '离境', '出発', 'partida'],
  arrival: ['arrival', '入境', '到着', 'chegada'],
};

/**
 * Whether a lounge is a Departures or an Arrivals one, from its location ("Near Gate 1,
 * Departures, Hong Kong International Airport"), as the source's; '' when it says neither.
 * @param {string} place
 * @returns {'departure'|'arrival'|''}
 */
export function loungeSide(place) {
  const text = (place || '').toLowerCase();
  return Object.keys(SIDE_WORDS).find((side) => SIDE_WORDS[side].some((word) => text.includes(word))) || '';
}

let badges = 0;

/**
 * The Departures / Arrivals badge, as the source's: a plane and "Departures Lounge", its tip
 * ("Located after security & immigration …") shown on hover, keyboard focus or a click (a second
 * click, a click elsewhere or Escape hides it).
 * @param {'departure'|'arrival'} side
 * @returns {HTMLElement}
 */
export function buildBadge(side) {
  badges += 1;
  const key = side === 'departure' ? 'cartBadgeDeparture' : 'cartBadgeArrival';
  const badge = el('span', `checkout-badge checkout-badge-${side}`);
  const button = el('button', 'checkout-badge-button');
  button.type = 'button';
  const icon = el('span', 'checkout-badge-icon');
  icon.setAttribute('aria-hidden', 'true');
  button.append(icon, el('span', 'checkout-badge-label', translate(key)));
  const tip = el('span', 'checkout-badge-tip', translate(`${key}Tip`));
  tip.id = `checkout-badge-tip-${badges}`;
  tip.setAttribute('role', 'tooltip');
  button.setAttribute('aria-describedby', tip.id);
  badge.append(button, tip);
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = !badge.classList.contains('is-open');
    document.querySelectorAll('.checkout-badge.is-open').forEach((b) => b.classList.remove('is-open'));
    badge.classList.toggle('is-open', open);
    badge.classList.remove('is-dismissed');
  });
  // Escape hides the tip until the pointer or focus leaves
  button.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    badge.classList.remove('is-open');
    badge.classList.add('is-dismissed');
  });
  const reset = () => badge.classList.remove('is-dismissed');
  badge.addEventListener('mouseleave', reset);
  button.addEventListener('blur', reset);
  return badge;
}

// a click elsewhere hides an open tip
document.addEventListener('click', () => {
  document.querySelectorAll('.checkout-badge.is-open').forEach((b) => b.classList.remove('is-open'));
});

/**
 * A cart line in the summary, as the source's: a lounge (its name, location, then Date, Time,
 * Guests, Services; above its name the Departures / Arrivals badge when its location says which)
 * or a pass (its name, Quantity: N and its price, the "For me" pill: the source's for a pass not
 * bought as a gift, which this site doesn't sell yet); its details fold away on phones.
 * @param {Object} line
 * @param {string} currency
 * @param {number} index
 * @param {string} [uid] Its summary's (the details' ids)
 * @returns {HTMLElement}
 */
export function buildLine(line, currency, index, uid = '0') {
  const pass = line.kind === 'pass';
  const box = el('div', `checkout-summary-line${pass ? ' checkout-summary-line-pass' : ''}`);
  const head = el('div', 'checkout-summary-line-head');
  const side = pass ? '' : loungeSide(line.place);
  if (side) head.append(buildBadge(side));
  head.append(el('h3', 'checkout-summary-name', pass ? line.product || line.name : line.name || line.product));
  box.append(head);
  const details = el(pass ? 'div' : 'dl', 'checkout-summary-details');
  details.id = `checkout-summary-details-${uid}-${index}`;
  if (pass) {
    const row = el('p', 'checkout-summary-quantity');
    row.append(el('span', '', `${translate('cartQuantity')} ${line.quantity}`), el('span', 'checkout-summary-line-amount', formatAmount(line.total, currency)));
    details.append(row, el('span', 'checkout-summary-intent', translate('cartPassForMe')));
  } else if (line.place) head.append(el('p', 'checkout-summary-place', line.place));
  if (!pass) {
    loungeDetails(line).forEach(({ label, value, unit }) => {
      const row = el('div', 'checkout-summary-detail');
      const dd = el('dd', '', value);
      if (unit) dd.append(el('span', 'checkout-summary-unit', unit));
      row.append(el('dt', '', label), dd);
      details.append(row);
    });
    // the lounge's add-ons (the source's "Additional Services: 2x Caviar Package …")
    if (line.addons?.length) {
      const row = el('div', 'checkout-summary-detail checkout-summary-addons');
      const dd = el('dd');
      line.addons.forEach((a, n) => {
        if (n) dd.append(', ');
        dd.append(el('span', 'checkout-summary-addon', `${a.quantity}x ${a.name}`));
      });
      row.append(el('dt', '', translate('cartAdditionalServices')), dd);
      details.append(row);
    }
  }
  // phones: the arrow folds the details away (the source's collapse), open to start with
  const toggle = el('button', 'checkout-summary-toggle');
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', 'true');
  toggle.setAttribute('aria-controls', details.id);
  toggle.setAttribute('aria-label', line.name || line.product);
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    box.classList.toggle('is-folded', !open);
  });
  head.append(toggle);
  box.append(details);
  return box;
}

/**
 * The summary's box: the cart's lines, the totals (the service total and each discount, when there
 * are discounts, as the source's), the promo code field, then the total with its note.
 * @param {Object} cart See scripts/cart.js readCart
 * @param {{uid?: string, redraw: Function, root: Function}} options The details' ids' prefix; the
 *   promo field's redraw (with the cart after a code) and the element it shows its messages in
 * @returns {HTMLElement}
 */
export function buildSummaryBox(cart, { uid = '0', redraw, root }) {
  const { currency, totals = {} } = cart;
  const box = el('div', 'checkout-summary-box');
  const lines = el('div', 'checkout-summary-lines');
  lines.append(...cart.lines.map((line, i) => buildLine(line, currency, i, uid)));
  const sums = el('div', 'checkout-summary-totals');
  if (totals.discounts?.length || totals.promo > 0) {
    sums.append(totalRow('checkout-summary-service', `${translate('cartServiceTotal')}:`, formatAmount(totals.base, currency)));
    (totals.discounts || []).forEach((d) => sums.append(totalRow('checkout-summary-discount', `${d.name}:`, `- ${formatAmount(d.value, currency)}`)));
    if (totals.promo > 0) sums.append(totalRow('checkout-summary-discount checkout-summary-promo-discount', translate('cartPromoDiscount', { code: cart.promoCode || '' }), `- ${formatAmount(totals.promo, currency)}`));
  }
  // the promo code (the mini cart's field), before the total, as the source's
  const promo = buildPromo(cart, { prefix: 'checkout', redraw, root });
  // (the note under the amount, as the source's)
  const total = totalRow('checkout-summary-total', el('span', 'checkout-summary-label', translate('cartTotal')), formatAmount(totals.total, currency));
  total.querySelector('.checkout-summary-amount').append(el('small', 'checkout-summary-note', translate('cartTotalNote')));
  box.append(lines, sums, promo, total);
  return box;
}
