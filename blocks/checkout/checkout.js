import {
  buildForm, fieldElement, findCountryByName, getCountries, isFieldValid,
} from '../../scripts/forms.js';
import { getToken, isTokenValid } from '../../scripts/auth.js';
import { readProfile } from '../../scripts/member.js';
import safeDescription from '../../scripts/safe-description.js';
import { formatAmount } from '../../scripts/cart-summary.js';
import { buildSummaryBox } from '../../scripts/booking-summary.js';
import { getCart, getCartId, onCartChange } from '../../scripts/cart-state.js';
import { refreshCart } from '../../scripts/cart.js';
import { DEFAULT_SITE, getSiteFolder, translate } from '../../scripts/i18n.js';
import { trackViewCart } from '../../scripts/mini-cart.js';
import { isPreview } from '../../scripts/properties.js';
import { holdLoader } from '../../scripts/scripts.js';

/*
 * The guest form's fields: their keys and the source guest checkout's rules
 * (/en-uk/guest-checkout, its ppl-contact-validation and guestcheckout scripts). The authoring only
 * gives each field's label, placeholder (Title's options), required and error texts (see README).
 */
const FIELDS = {
  title: { type: 'select', key: 'title', required: true },
  firstName: {
    type: 'text',
    key: 'firstName',
    required: true,
    settings: {
      'max length': 200, 'new row': '', autocomplete: 'given-name', 'trim end': '',
    },
  },
  lastName: {
    type: 'text', key: 'lastName', required: true, settings: { 'max length': 200, autocomplete: 'family-name', 'trim end': '' },
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
  flight: { type: 'text', key: 'arrivalDepartureFlight', settings: { 'max length': 200, suggestions: '' } },
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
const TEXT_KEYS = ['termsheading', 'summary', 'payment', 'empty', 'error', 'pending'];
// rows the page now has as blocks of their own (Booking Steps, Title (back), Promo (card)): left
// out if a page still has them
const RETIRED_KEYS = ['steps', 'phonestep', 'back', 'banner'];

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
    } else if (RETIRED_KEYS.includes(key)) {
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
 * A title as compared with the dropdown's options: lower case, no full stops or spaces ("Mr." and
 * "MR" are the same).
 * @param {*} value
 * @returns {string}
 */
function titleKey(value) {
  return String(value ?? '').toLowerCase().replace(/[.\s]/g, '');
}

// the titles in the order every language's page authors them (Mr., Mrs., Ms., Miss: 先生, 太太,
// 女士, 小姐 …), for a profile's English title on a page in another language
const TITLE_ORDER = ['mr', 'mrs', 'ms', 'miss'];

/**
 * A logged-in member's details in the form, as the source's guest checkout shows them for a member
 * (its server fills the form; here GetProfile, read once with the stored login, kept nowhere):
 * - the title (`salutation`: by its text, else, on a page in another language, by its place in
 *   the authored order Mr., Mrs., Ms., Miss)
 * - the names (`firstName`, `lastName`), the email in both email fields (`userName`)
 * - the contact number (`phone`, digits)
 * - the country of residence (`countryName`, matched by name in the countries list), and with it
 *   the dial code: it follows the country, as when a visitor picks one (linkFields in
 *   scripts/forms.js; a shared +1 by the country's own, e.g. "+1 (CA)"), and as the source's, whose
 *   dial code starts from the country its server selects. The profile's own `countryPhoneCode` is
 *   not used.
 * The filled names and email (both email fields) are disabled, unless a value fails its field's
 * rules (then it stays editable, to be put right).
 * Only empty fields are filled, so what the visitor has typed or chosen meanwhile stays (a country
 * already chosen has set its dial code). The values are set without the form's change events
 * reaching the form, so no message shows (they're checked on Payment, as typed ones). A guest, or a
 * profile that can't be read, leaves the form as it is.
 * @param {HTMLFormElement} form
 * @returns {Promise<void>}
 */
async function prefillMember(form) {
  const token = getToken();
  if (!token || !isTokenValid(token)) return;
  const profile = await readProfile(token);
  if (!profile) return;
  const control = (key) => fieldElement(form, key)?.querySelector('.form-input:not(.form-phone-code)');
  const text = (value) => (typeof value === 'string' ? value.trim() : '');
  // (within the field's own maximum length)
  const fit = (input, value) => value.slice(0, input.maxLength > 0 ? input.maxLength : undefined);
  // (the field filled, or null when it already had a value or the profile has none)
  const fill = (key, value) => {
    const input = control(key);
    if (!input || input.value || !text(value)) return null;
    input.value = fit(input, text(value));
    return input;
  };
  // the member's own names and email, once filled, can't be used: disabled, as the source's
  // locked fields (no focus, no clicks, out of the Tab order; still read out by a screen reader,
  // and still checked and sent on Payment, which reads the values themselves: collectValues). A
  // value its field's rules refuse stays editable, so the member can put it right before Payment.
  const lock = (input) => {
    if (!input || !isFieldValid(input.closest('.form-field'))) return false;
    input.disabled = true;
    input.classList.add('checkout-locked');
    return true;
  };
  lock(fill('firstName', profile.firstName));
  lock(fill('lastName', profile.lastName));
  const email = fill('emailAddress', profile.userName);
  const confirm = fill('confirmEmailAddress', profile.userName);
  // (the confirmation only with the email: alone it could hold a value the email doesn't match)
  if (lock(email)) lock(confirm);
  const title = control('title');
  const titleWanted = titleKey(profile.salutation);
  if (title && !title.value && titleWanted) {
    const options = [...title.options].filter((o) => o.value);
    const option = options.find((o) => titleKey(o.value) === titleWanted
      || titleKey(o.textContent) === titleWanted)
      || (options.length === TITLE_ORDER.length ? options[TITLE_ORDER.indexOf(titleWanted)] : null);
    if (option) title.value = option.value;
  }
  const number = control('contactNumber');
  const digits = String(profile.phone ?? '').replace(/\D/g, '');
  if (number && !number.value && digits) number.value = fit(number, digits);

  // the country, and with it the dial code, once the countries are in (their lists are filled by
  // then)
  let countries;
  try {
    countries = await getCountries();
  } catch {
    return;
  }
  const country = findCountryByName(countries, profile.countryName);
  const residence = control('countryOfResidence');
  if (residence && !residence.value && country
    && [...residence.options].some((o) => o.value === String(country.countryId))) {
    residence.value = String(country.countryId);
    // the dial code follows it, as for a visitor's choice (linkFields listens on the field). Not
    // bubbling: the form doesn't check the field, so no message; the dial code's own change
    // updates its short code.
    residence.dispatchEvent(new Event('change'));
  }
}

/**
 * Decorates the Checkout block: the guest checkout (the source /{lang}/guest-checkout) for the
 * cart this site holds (cart-state.js, read again from the booking system): the guest's details
 * (the authored form rows: Field | Label | Placeholder | Required | Error, see README), the Privacy
 * Policy, newsletter and Terms & Conditions boxes and the cart's own terms; beside it (above it
 * below 992px) the Booking Summary with Payment, and on phones a bar with the total and Payment at
 * the bottom of the screen. A lounge's checkout asks for the flight, a pass's doesn't. Payment
 * waits for the Privacy Policy and the Terms & Conditions; a valid form is announced as
 * `checkout:payment` (the guest details and the cart) until the payment API is in. The page's steps
 * band, back title and banner are blocks of their own (Booking Steps, Title (back), Promo (card)).
 * It doesn't wait for the booking system (the page's section waits for its blocks): see the end.
 * @param {Element} block The Checkout block element
 */
export default function decorate(block) {
  // no cart: the language's homepage, as the source's (its server answers 302), the address
  // replaced so Back doesn't come back here. Not on the preview site or in the block library,
  // where authors look at the page itself
  const live = !isPreview() && !window.location.pathname.includes('/docs/library/');
  const leave = () => {
    if (live) window.location.replace(`/${getSiteFolder() || DEFAULT_SITE}/`);
    return live;
  };
  if (!getCartId() && leave()) return;
  count += 1;
  const texts = takeTexts(block);
  const text = (key) => texts.get(key)?.textContent.trim() || '';
  const formId = `checkout-form-${count}`;
  let lastCart = null;
  // the GA4 view_cart ("full_page") went out: once a page, the first time the cart shows
  let viewed = false;

  const { form } = buildForm(block, {
    fields: FIELDS,
    defaultWidth: 'half',
    // as the source's: an empty field left shows nothing; Payment shows every message
    quietEmpty: true,
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
  // the contact number's dial code shown short ("+1"), as the source's, in a box as wide as the
  // code (+1, +374, +44-1534); the select stays the control, over it
  const code = form.querySelector('.form-phone-code');
  if (code) {
    const dial = el('span', 'checkout-dial');
    dial.setAttribute('aria-hidden', 'true');
    const dialBox = el('span', 'checkout-dial-box');
    code.before(dialBox);
    dialBox.append(code, dial);
    const show = () => { dial.textContent = (code.selectedOptions[0]?.textContent || '').trim().split(/\s+/)[0] || ''; };
    code.addEventListener('change', show);
    // (its list arrives later, with its preset)
    new MutationObserver(() => queueMicrotask(show))
      .observe(code, { childList: true, subtree: true });
    show();
  }
  // the Privacy Policy and newsletter boxes' links open in a new tab, as the source's
  ['consent', 'newsletter'].forEach((key) => {
    fieldElement(form, key)?.querySelectorAll('label a[href]').forEach((a) => {
      a.target = '_blank';
      a.rel = 'noopener';
      const note = el('span', 'visually-hidden', translate('opensInNewTab'));
      a.append(note);
    });
  });
  // the form's own button gives way to Payment (in the summary and the phone bar)
  form.querySelector('.form-submit')?.remove();
  // a logged-in member's details in the form (in the background; a guest's form stays empty)
  prefillMember(form);

  const summary = el('aside', 'checkout-summary');
  summary.setAttribute('aria-labelledby', `${formId}-summary`);
  const bar = el('div', 'checkout-bar');
  const details = el('div', 'checkout-details');
  details.append(form);
  const layout = el('div', 'checkout-layout');
  layout.append(details, summary);
  block.replaceChildren(layout, bar);

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
    if (lastCart && !viewed) {
      viewed = true;
      trackViewCart(lastCart, 'full_page');
    }
    const title = el('h2', 'checkout-summary-title', text('summary'));
    title.id = `${formId}-summary`;
    if (!lastCart) {
      const box = el('div', 'checkout-summary-box');
      box.append(el('p', 'checkout-summary-empty', failure || text('empty')));
      summary.replaceChildren(title, box, paymentButton(text('payment'), formId, 'checkout-payment-summary'));
      bar.replaceChildren(paymentButton(text('payment'), formId, 'checkout-payment-bar'));
    } else {
      const { currency, totals = {} } = lastCart;
      // the lines, the totals, the promo field, the total (scripts/booking-summary.js)
      const box = buildSummaryBox(lastCart, {
        uid: String(count),
        // eslint-disable-next-line no-use-before-define
        redraw: (now) => render(now),
        root: () => summary,
      });
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
  // the cart emptied meanwhile (the mini cart's removal, another tab): the homepage, as the
  // source's
  onCartChange((cart) => {
    if (((!cart && !getCartId()) || (cart && !cart.lines.length)) && leave()) return;
    render(cart);
  });

  // the booking system's cart (fresh prices), without holding up the page (its section, the
  // header and footer after it, wait for this block): the answer redraws the summary when it comes.
  // A tab with the cart's data shows it meanwhile (an unreadable answer keeps it). A tab without
  // it keeps the loader up over the page until the cart is in (held past the page's first load,
  // which hides its own loader), then shows the summary, the homepage for an empty cart, or the
  // error text.
  if (!getCartId()) return;
  const refresh = refreshCart().then((cart) => {
    if (!cart?.lines.length && leave()) return;
    render(cart);
  });
  if (getCart()) refresh.catch(() => {});
  else holdLoader(refresh.catch(() => render(null, text('error'))));
}
