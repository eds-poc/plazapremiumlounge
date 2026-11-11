import { buildForm, fieldElement } from '../../scripts/forms.js';
import { loadFragment } from '../fragment/fragment.js';
import buildBookingSteps from '../../scripts/booking-steps.js';
import safeDescription from '../../scripts/safe-description.js';
import { formatAmount, loungeDetails } from '../../scripts/cart-summary.js';
import { getCart, getCartId, onCartChange } from '../../scripts/cart-state.js';
import { refreshCart } from '../../scripts/cart.js';
import { translate } from '../../scripts/i18n.js';
import { isPreview } from '../../scripts/properties.js';
import { hideLoader, showLoader } from '../../scripts/scripts.js';

/*
 * The guest form's fields: their keys and the source guest checkout's rules
 * (/en-uk/guest-checkout, its ppl-contact-validation and guestcheckout scripts). The authoring only
 * gives each field's label, placeholder (Title's options), required and error texts (see README).
 */
const FIELDS = {
  title: { type: 'select', key: 'title', required: true },
  firstName: {
    type: 'text', key: 'firstName', required: true, settings: { 'max length': 200, 'new row': '', autocomplete: 'given-name' },
  },
  lastName: {
    type: 'text', key: 'lastName', required: true, settings: { 'max length': 200, autocomplete: 'family-name' },
  },
  countryOfResidence: {
    type: 'country', key: 'countryOfResidence', required: true, settings: { value: 'countryId', 'value type': 'number' },
  },
  // the dial code (+1 (US) to start with, following the country of residence) and the number:
  // digits only, at most 12; the code's and the number's digits together 7 to 15
  phone: {
    type: 'phone',
    key: 'contactNumber',
    required: true,
    settings: {
      'prefix key': 'phoneCountryCode', 'prefix default': '+1 (US)', rule: 'digits', 'max length': 12, 'total length': '7-15',
    },
  },
  email: {
    type: 'email', key: 'emailAddress', required: true, settings: { 'max length': 200 },
  },
  confirmEmail: {
    type: 'email', key: 'confirmEmailAddress', required: true, settings: { match: 'emailAddress', 'max length': 200, autocomplete: 'email' },
  },
  // a lounge's flight (not a pass's): the airline, and the flight number's digits (at most 4,
  // "7" becomes "007")
  flight: { type: 'text', key: 'arrivalDepartureFlight', settings: { 'max length': 200 } },
  flightNumber: { type: 'text', key: 'flightNumber', settings: { rule: 'flight', pad: 3 } },
  partnerId: { type: 'text', key: 'partnerId', settings: { 'max length': 200 } },
  partnerName: { type: 'text', key: 'partnerName', settings: { 'max length': 200 } },
  consent: {
    type: 'checkbox', key: 'consent', required: true, settings: { 'value type': 'boolean' },
  },
  newsletter: { type: 'checkbox', key: 'newsletter', settings: { 'value type': 'boolean' } },
  terms: {
    type: 'checkbox', key: 'termsAgreed', required: true, settings: { 'value type': 'boolean' },
  },
};

// the fields only a lounge's checkout has (the source's pass checkout has no flight)
const LOUNGE_KEYS = ['arrivalDepartureFlight', 'flightNumber'];
// the boxes Payment waits for (the source's: Privacy Policy and Terms & Conditions)
const AGREE_KEYS = ['consent', 'termsAgreed'];
// the block's texts (Key | Text rows; the field rows are the form's)
const TEXT_KEYS = ['steps', 'phonestep', 'back', 'banner', 'termsheading', 'summary', 'payment', 'empty', 'error', 'pending'];

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
 * The block's texts: its Key | Text rows (by key, lower case), taken out of the block so the form
 * keeps only its own rows.
 * @param {Element} block
 * @returns {Map<string, Element>}
 */
function takeTexts(block) {
  const texts = new Map();
  [...block.children].forEach((row) => {
    const [keyCell, valueCell] = row.children;
    const key = keyCell?.textContent.trim().toLowerCase().replace(/\s+/g, '');
    if (row.children.length === 2 && TEXT_KEYS.includes(key)) {
      texts.set(key, valueCell);
      row.remove();
    }
  });
  return texts;
}

/**
 * A Payment button (the summary's and the phone bar's): it submits the guest form.
 * @param {string} label
 * @param {string} formId
 * @param {string} className
 * @returns {HTMLButtonElement}
 */
function paymentButton(label, formId, className) {
  const b = el('button', `button primary checkout-payment ${className}`, label);
  b.type = 'submit';
  b.setAttribute('form', formId);
  return b;
}

/**
 * A row of the summary's totals: its label and amount.
 * @param {string} className
 * @param {Node|string} label
 * @param {string} amount
 * @returns {HTMLElement}
 */
function totalRow(className, label, amount) {
  const row = el('div', `checkout-summary-row ${className}`);
  row.append(typeof label === 'string' ? el('span', 'checkout-summary-label', label) : label, el('span', 'checkout-summary-amount', amount));
  return row;
}

/**
 * A cart line in the summary, as the source's: a lounge (its name, location, then Date, Time,
 * Guests, Services, folding away on phones) or a pass (its name, Quantity: N and its price).
 * @param {Object} line
 * @param {string} currency
 * @param {number} index
 * @returns {HTMLElement}
 */
function buildLine(line, currency, index) {
  const pass = line.kind === 'pass';
  const box = el('div', `checkout-summary-line${pass ? ' checkout-summary-line-pass' : ''}`);
  const head = el('div', 'checkout-summary-line-head');
  head.append(el('h3', 'checkout-summary-name', pass ? line.product || line.name : line.name || line.product));
  box.append(head);
  if (pass) {
    const row = el('p', 'checkout-summary-quantity');
    row.append(el('span', '', `${translate('cartQuantity')} ${line.quantity}`), el('span', 'checkout-summary-line-amount', formatAmount(line.total, currency)));
    box.append(row);
    return box;
  }
  if (line.place) head.append(el('p', 'checkout-summary-place', line.place));
  const details = el('dl', 'checkout-summary-details');
  details.id = `checkout-summary-details-${count}-${index}`;
  loungeDetails(line).forEach(({ label, value, unit }) => {
    const row = el('div', 'checkout-summary-detail');
    const dd = el('dd', '', value);
    if (unit) dd.append(el('span', 'checkout-summary-unit', unit));
    row.append(el('dt', '', label), dd);
    details.append(row);
  });
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
 * The cart's terms (each policy's name, then its text), under the Terms & Conditions box.
 * @param {{name: string, html: string}[]} terms
 * @param {string} heading
 * @returns {HTMLElement|null}
 */
function buildTerms(terms, heading) {
  if (!terms?.length) return null;
  const box = el('div', 'checkout-terms');
  if (heading) box.append(el('h2', 'checkout-terms-heading', heading));
  terms.forEach((policy) => {
    if (policy.name) box.append(el('h3', 'checkout-terms-name', policy.name));
    const body = el('div', 'checkout-terms-text');
    body.append(safeDescription(policy.html));
    box.append(body);
  });
  return box;
}

/**
 * Decorates the Checkout block: the guest checkout (the source /{lang}/guest-checkout) for the
 * cart this site holds (cart-state.js, read again from the booking system). The booking steps band,
 * the way back to the booking, a banner fragment (the Smart Traveller box), the guest's details
 * (the authored form rows: Field | Label | Placeholder | Required | Error, see README), the Privacy
 * Policy, newsletter and Terms & Conditions boxes and the cart's own terms; beside it (above it
 * below 992px) the Booking Summary with Payment, and on phones a bar with the total and Payment at
 * the bottom of the screen. A lounge's checkout asks for the flight, a pass's doesn't. Payment
 * waits for the Privacy Policy and the Terms & Conditions; a valid form is announced as
 * `checkout:payment` (the guest details and the cart) until the payment API is in.
 * @param {Element} block The Checkout block element
 */
export default async function decorate(block) {
  count += 1;
  const texts = takeTexts(block);
  const text = (key) => texts.get(key)?.textContent.trim() || '';
  const formId = `checkout-form-${count}`;
  let lastCart = null;

  const { form } = buildForm(block, {
    fields: FIELDS,
    defaultWidth: 'half',
    // the valid form: the guest and the cart, for the payment step (no API yet)
    onSubmit: (values) => {
      const cart = getCart();
      if (!cart?.lines.length) return text('empty');
      const guest = { ...values };
      if (cart.lines.every((line) => line.kind === 'pass')) LOUNGE_KEYS.forEach((key) => delete guest[key]);
      document.dispatchEvent(new CustomEvent('checkout:payment', { detail: { guest, cart } }));
      // (the preview says why nothing else happens)
      return isPreview() ? text('pending') : '';
    },
  });
  form.id = formId;
  form.classList.add('checkout-form');
  // the form's own button gives way to Payment (in the summary and the phone bar)
  form.querySelector('.form-submit')?.remove();

  // the way back: an arrow before the title (the link's text)
  const back = texts.get('back')?.querySelector('a[href]');
  const heading = el('h1', 'checkout-title');
  if (back) {
    const arrow = el('a', 'checkout-back');
    arrow.href = back.href;
    arrow.setAttribute('aria-label', back.textContent.trim());
    heading.append(arrow);
  }
  heading.append(back?.textContent.trim() || '');

  const banner = el('div', 'checkout-banner');
  const summary = el('aside', 'checkout-summary');
  summary.setAttribute('aria-labelledby', `${formId}-summary`);
  const bar = el('div', 'checkout-bar');
  const details = el('div', 'checkout-details');
  details.append(form);
  const layout = el('div', 'checkout-layout');
  layout.append(details, summary);
  block.replaceChildren(
    buildBookingSteps(texts.get('steps'), { label: heading.textContent, phoneStep: text('phonestep') }),
    heading,
    banner,
    layout,
    bar,
  );

  // the banner (e.g. the Smart Traveller box): a fragment page. The site loads `/fragments/` links
  // by itself (scripts.js auto blocks): its content when it's already in, else the page loaded here
  // (never this page itself)
  const bannerCell = texts.get('banner');
  if (bannerCell?.querySelector('.section')) {
    banner.append(...bannerCell.childNodes);
  } else if (bannerCell) {
    const href = bannerCell.querySelector('a[href]')?.getAttribute('href') || bannerCell.textContent.trim();
    let path = '';
    try {
      path = href ? new URL(href, window.location.href).pathname : '';
    } catch { /* not an address */ }
    if (path && path !== window.location.pathname) {
      loadFragment(path).then((fragment) => {
        if (fragment) banner.append(...fragment.childNodes);
      }).catch(() => {});
    }
  }

  // Payment waits for the two boxes (and the cart); disabled meanwhile, as the source's
  const agreed = () => AGREE_KEYS.every((key) => fieldElement(form, key)?.querySelector('input')?.checked !== false);
  const updatePayment = () => {
    const ready = agreed() && !!lastCart?.lines.length && !form.hasAttribute('aria-busy');
    block.querySelectorAll('.checkout-payment').forEach((b) => {
      b.disabled = !ready;
      b.setAttribute('aria-disabled', String(!ready));
    });
  };
  form.addEventListener('change', updatePayment);
  // (busy while the form is being taken)
  new MutationObserver(updatePayment).observe(form, { attributes: true, attributeFilter: ['aria-busy'] });

  // the cart's terms after the Terms & Conditions box
  const termsSlot = el('div', 'checkout-terms-slot');
  (fieldElement(form, 'termsAgreed') || form.lastElementChild)?.after(termsSlot);

  /**
   * Shows the cart (or its absence): the summary, the phone bar, the lounge's flight fields and
   * the terms.
   * @param {Object|null} cart
   * @param {string} [failure] A message instead of the empty cart's
   */
  const render = (cart, failure = '') => {
    lastCart = cart?.lines.length ? cart : null;
    const title = el('h2', 'checkout-summary-title', text('summary'));
    title.id = `${formId}-summary`;
    const box = el('div', 'checkout-summary-box');
    const totalLabel = el('span', 'checkout-summary-label');
    totalLabel.append(el('span', '', translate('cartTotal')), el('small', 'checkout-summary-note', translate('cartTotalNote')));
    if (!lastCart) {
      box.append(el('p', 'checkout-summary-empty', failure || text('empty')));
      summary.replaceChildren(title, box, paymentButton(text('payment'), formId, 'checkout-payment-summary'));
      bar.replaceChildren(paymentButton(text('payment'), formId, 'checkout-payment-bar'));
    } else {
      const { currency, totals = {} } = lastCart;
      const lines = el('div', 'checkout-summary-lines');
      lines.append(...lastCart.lines.map((line, i) => buildLine(line, currency, i)));
      const sums = el('div', 'checkout-summary-totals');
      // the base and the discounts, when there are discounts (as the source's)
      if (totals.discounts?.length) {
        sums.append(totalRow('checkout-summary-service', `${translate('cartServiceTotal')}:`, formatAmount(totals.base, currency)));
        totals.discounts.forEach((d) => sums.append(totalRow('checkout-summary-discount', `${d.name}:`, `- ${formatAmount(d.value, currency)}`)));
      }
      const total = totalRow('checkout-summary-total', totalLabel, formatAmount(totals.total, currency));
      box.append(lines, sums, total);
      summary.replaceChildren(title, box, paymentButton(text('payment'), formId, 'checkout-payment-summary'));
      // the phone bar: "Total: USD 67.50 (Includes applicable taxes and fees)", then Payment
      const barTotal = el('p', 'checkout-bar-total');
      barTotal.append(
        el('span', 'checkout-bar-label', `${translate('cartTotal')}:`),
        el('strong', 'checkout-bar-amount', formatAmount(totals.total, currency)),
        el('small', 'checkout-bar-note', translate('cartTotalNote')),
      );
      bar.replaceChildren(barTotal, paymentButton(text('payment'), formId, 'checkout-payment-bar'));
    }
    // a lounge asks for the flight; a pass doesn't (its fields out of the form and its data)
    const lounge = !lastCart || lastCart.lines.some((line) => line.kind !== 'pass');
    LOUNGE_KEYS.forEach((key) => {
      const wrap = fieldElement(form, key);
      if (!wrap) return;
      wrap.hidden = !lounge;
      wrap.querySelectorAll('input, select').forEach((control) => { control.disabled = !lounge; });
    });
    termsSlot.replaceChildren(...[buildTerms(lastCart?.terms, text('termsheading'))].filter(Boolean));
    updatePayment();
  };

  render(getCart());
  onCartChange((cart) => render(cart));

  // the booking system's cart (fresh prices): behind the loader when this tab has none yet, else
  // in the background (the summary shows at once)
  if (getCartId()) {
    const first = !getCart();
    if (first) showLoader();
    try {
      render(await refreshCart());
    } catch {
      if (first) render(null, text('error'));
    } finally {
      if (first) hideLoader();
    }
  }
}
