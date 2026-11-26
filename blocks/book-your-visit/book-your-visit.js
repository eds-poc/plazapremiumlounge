import { getMetadata } from '../../scripts/aem.js';
import {
  DAY_MINUTES, SLOT_MINUTES, isIsoDate, nowAt, readLeadTime, readTimeZone,
  toStartDateTime, toTime,
} from '../../scripts/booking.js';
import { buildBadge, buildSummaryBox, loungeSide } from '../../scripts/booking-summary.js';
import { formatAmount, formatCartDate, formatGuests } from '../../scripts/cart-summary.js';
import { getCart, getCartId, onCartChange } from '../../scripts/cart-state.js';
import { readCart, refreshCart, updateLounge } from '../../scripts/cart.js';
import buildDatePicker from '../../scripts/date-picker.js';
import apiUrl from '../../scripts/endpoints.js';
import { DEFAULT_SITE, getSiteFolder, translate } from '../../scripts/i18n.js';
import { buildPromo, trackViewCart } from '../../scripts/mini-cart.js';
import { openModal } from '../../scripts/modal-dialog.js';
import {
  fetchJson, getApiLanguage, propertyDetailUrl,
} from '../../scripts/properties.js';
import { hideLoader, holdLoader, showLoader } from '../../scripts/scripts.js';

/*
 * Book Your Visit: the source's /{lang}/book-your-visit, the cart's lounge visit to check and
 * change before the checkout (the mini cart's Edit, the checkout's back link). The lounge (its
 * Departures / Arrivals badge, name and location), its Date and Time (the only things that change
 * here, as the source's; the guests and the service are shown, locked), the Booking Summary with
 * Check Out; on phones a summary with Date and Time Edit pop-ups and a bar with the subtotal and
 * Confirm & Proceed. The date and time are saved on Check Out (the cart's lounge, then the
 * checkout); a page's Add-ons block in the same section goes under the form (its add-ons follow
 * the chosen date and time). No cart (or a cart without a lounge): the homepage, as the source's.
 */

// the block's texts (Key | Text rows), and what shows without a row
const TEXTS = {
  note: '',
  date: 'Date',
  time: 'Time',
  adults: 'Adult(s)',
  children: 'Child(ren)',
  childrennote: 'Complimentary for under 2 years old',
  service: 'Service Details',
  summary: 'Booking Summary',
  checkout: 'Check Out',
  proceed: 'Confirm & Proceed',
  subtotal: 'Subtotal',
  notimeslot: 'Only time slots at least 1 hour from now are available.',
  leadtime: 'Booking must be made at least 1 hour in advance.',
  error: 'An error occurred. Please try again.',
};
// the source's slots: every half hour; the first bookable one the half hour after now, the lead
// time and 15 minutes (a lead time of 0 is an hour, as the source's)
const LEAD_MINUTES = 60;
const MARGIN_MINUTES = 15;
// below this the page is the phones' (the form's fields in pop-ups, the bar)
const DESKTOP = '(width >= 992px)';
const DETAIL_TIMEOUT_MS = 8000;

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
 * The block's authored texts (Key | Text rows): the note's cell as it is (its link), the others'
 * text.
 * @param {Element} block
 * @returns {{texts: Object<string, string>, note: Element|null}}
 */
function readTexts(block) {
  const texts = { ...TEXTS };
  let note = null;
  [...block.children].forEach((row) => {
    const [keyCell, valueCell] = row.children;
    const key = keyCell?.textContent.trim().toLowerCase().replace(/[\s&-]+/g, '');
    if (!key || !valueCell) return;
    if (key === 'note') note = valueCell;
    else if (key in TEXTS && valueCell.textContent.trim()) {
      texts[key] = valueCell.textContent.trim();
    }
  });
  return { texts, note };
}

/**
 * The first bookable minute of the lounge's today, as the source's (now at the lounge, the lead
 * time and 15 minutes, onto the next half hour; past midnight: none today).
 * @param {string} [timeZone]
 * @param {number} leadMinutes
 * @returns {{today: string, earliest: number}}
 */
export function firstSlot(timeZone, leadMinutes) {
  const now = nowAt(timeZone);
  const later = now.minutes + (leadMinutes > 0 ? leadMinutes : LEAD_MINUTES) + MARGIN_MINUTES;
  const rest = later % SLOT_MINUTES;
  return { today: now.date, earliest: later + (rest ? SLOT_MINUTES - rest : SLOT_MINUTES) };
}

/**
 * Whether a slot (HHmm) can be booked on a date.
 * @param {string} date YYYY-MM-DD
 * @param {string} time HHmm
 * @param {{today: string, earliest: number}} first
 * @returns {boolean}
 */
function bookable(date, time, first) {
  if (date < first.today) return false;
  if (date > first.today) return true;
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(2)) >= first.earliest;
}

/**
 * The lounge's lead time and time zone from its detail (the lounge page's service); none when it
 * can't be read (the source's default hour then).
 * @param {Object} line
 * @param {string} currency
 * @returns {Promise<{leadMinutes: number, timeZone?: string}>}
 */
async function readLounge(line, currency) {
  if (!line.propertyCode) return { leadMinutes: 0 };
  const url = apiUrl('propertyDetail');
  url.searchParams.set('propertyCode', line.propertyCode);
  url.searchParams.set('currencyCode', currency || 'USD');
  url.searchParams.set('languageCode', getApiLanguage());
  try {
    const detail = (await fetchJson(url.href, DETAIL_TIMEOUT_MS))?.propertyDetail || {};
    return { leadMinutes: readLeadTime(detail.leadTime), timeZone: readTimeZone(detail.timeZone) };
  } catch {
    return { leadMinutes: 0 };
  }
}

/**
 * The checkout's address: the page metadata `cart-checkout-url` (its {lang}), else this site's
 * checkout page in the visitor's language folder.
 * @returns {string}
 */
function checkoutUrl() {
  const lang = getSiteFolder() || DEFAULT_SITE;
  return (getMetadata('cart-checkout-url') || '/{lang}/guest-checkout').replace('{lang}', lang);
}

// the block library's sample visit (the booking system's cart answer: a lounge at Hong Kong)
const LIBRARY_CART = `${window.hlx?.codeBasePath || ''}/blocks/book-your-visit/library-cart.json`;

/**
 * Whether the page is the block library's (authors look at the block there: no cart, nothing
 * saved, no leaving).
 * @returns {boolean}
 */
function inLibrary() {
  return window.location.pathname.includes('/docs/library/');
}

/**
 * Leaves for the homepage (an empty cart, or one without a lounge), as the source's.
 */
function leave() {
  window.location.replace(`/${getSiteFolder() || DEFAULT_SITE}/`);
}

/**
 * Decorates the Book Your Visit block.
 * @param {Element} block
 */
export default function decorate(block) {
  count += 1;
  const uid = `book-your-visit-${count}`;
  const { texts, note } = readTexts(block);
  const desktop = window.matchMedia(DESKTOP);

  // the state: the cart, its lounge, the visit's date and time as chosen here
  let cart = null;
  let line = null;
  let date = '';
  let time = '';
  let lounge = { leadMinutes: 0 };
  let first = firstSlot(undefined, 0);

  const main = el('div', 'book-your-visit-main');
  const aside = el('aside', 'checkout-summary book-your-visit-summary');
  aside.setAttribute('aria-labelledby', `${uid}-summary`);
  const layout = el('div', 'book-your-visit-layout');
  layout.append(main, aside);
  const bar = el('div', 'book-your-visit-bar');
  block.replaceChildren(layout, bar);
  // the page's Add-ons block (in this section): under the form, as the source's
  const addons = block.closest('.section')?.querySelector('.add-ons-wrapper');

  const noteBox = el('div', 'book-your-visit-note');
  if (note) noteBox.append(...note.childNodes);
  const message = el('p', 'book-your-visit-error');
  message.setAttribute('role', 'alert');
  message.hidden = true;
  const head = el('div', 'book-your-visit-lounge');
  const fields = el('div', 'book-your-visit-fields');
  fields.id = `${uid}-fields`;
  const phone = el('div', 'book-your-visit-phone');
  main.append(noteBox, message, head, fields, phone);
  if (addons) main.append(addons);

  const showError = (text) => {
    message.textContent = text;
    message.hidden = !text;
    const top = document.querySelector('.booking-steps') || block;
    if (text) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // the time list: every half hour, today's past ones (with the lead time) off
  const timeSelect = el('select', 'book-your-visit-time-select');
  timeSelect.id = `${uid}-time`;
  for (let m = 0; m < DAY_MINUTES; m += SLOT_MINUTES) {
    const value = toTime(m);
    timeSelect.append(new Option(value, value));
  }
  const fillTimes = (select) => {
    [...select.options].forEach((o) => { o.disabled = !bookable(date, o.value, first); });
    select.value = time;
  };
  // the date: the site's calendar (the lounge's today the first day)
  // the field's date as the source's ("20-Nov-2026", the cart's format)
  const format = (value) => formatCartDate(`${value} 00:00:00`);
  let picker = null;

  // the visit's date or time chosen: an unbookable time moves to the day's first; the add-ons
  // follow
  const choose = (nextDate, nextTime = time) => {
    date = nextDate;
    const slots = [...timeSelect.options].map((o) => o.value)
      .filter((v) => bookable(date, v, first));
    time = slots.includes(nextTime) ? nextTime : slots[0] || '';
    fillTimes(timeSelect);
    picker?.update({ value: date, min: first.today });
    showError(time ? '' : texts.notimeslot);
    // eslint-disable-next-line no-use-before-define
    renderPhone();
    document.dispatchEvent(new CustomEvent('book-your-visit:change', {
      detail: { start: time ? toStartDateTime(date, time) : '', line, cart },
    }));
  };
  timeSelect.addEventListener('change', () => choose(date, timeSelect.value));

  /**
   * A labelled field of the form (desktop), with its control.
   * @param {string} label
   * @param {HTMLElement} control
   * @param {string} [noteText] A note after the label (Child(ren)'s)
   * @returns {HTMLElement}
   */
  const field = (label, control, noteText = '') => {
    const wrap = el('div', 'book-your-visit-field');
    const lab = el('label', 'book-your-visit-label', label);
    const target = control.id ? control : control.querySelector('select[id], input[id]');
    if (target) lab.htmlFor = target.id;
    if (noteText) lab.append(' ', el('span', 'book-your-visit-label-note', noteText));
    wrap.append(lab, control);
    return wrap;
  };
  const locked = (value, id) => {
    const input = el('input', 'book-your-visit-locked');
    input.type = 'text';
    input.id = `${uid}-${id}`;
    input.value = value;
    input.readOnly = true;
    input.disabled = true;
    return input;
  };

  // the lounge: its badge, name and location; the arrow folds the fields away (open to start with)
  const renderHead = () => {
    const side = loungeSide(line.place);
    const toggle = el('button', 'book-your-visit-toggle');
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-controls', fields.id);
    const name = el('span', 'book-your-visit-name', line.name || line.product);
    toggle.append(name, el('span', 'book-your-visit-place', line.place));
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      fields.hidden = !open;
      phone.hidden = !open;
    });
    head.replaceChildren(...[side ? buildBadge(side) : null, toggle].filter(Boolean));
  };

  const renderFields = () => {
    picker = buildDatePicker({
      name: 'date', value: date, min: first.today, format, prefix: 'book-your-visit',
    });
    picker.trigger.id = `${uid}-date`;
    picker.input.addEventListener('change', () => choose(picker.input.value));
    const timeBox = el('div', 'book-your-visit-time');
    timeBox.append(timeSelect, el('span', 'book-your-visit-hrs', translate('cartHours')));
    fillTimes(timeSelect);
    fields.replaceChildren(
      field(texts.date, picker.element),
      field(texts.time, timeBox),
      field(texts.adults, locked(String(line.adults || 1), 'adults')),
      field(texts.children, locked(String(line.children || 0), 'children'), texts.childrennote),
      field(texts.service, locked(line.product, 'service')),
    );
    // (the date's label names its button)
    fields.querySelector('.book-your-visit-label').htmlFor = picker.trigger.id;
  };

  /**
   * A pop-up for the phones' Edit: its content, then Confirm (which applies it).
   * @param {string} key
   * @param {HTMLElement} trigger
   * @param {Function} build Returns [content, apply]
   */
  const editPopup = (key, trigger, build) => {
    const [content, apply] = build();
    const confirm = el('button', 'button primary book-your-visit-confirm', translate('cartConfirm'));
    confirm.type = 'button';
    const box = el('div', 'book-your-visit-popup');
    box.append(content, confirm);
    openModal({
      key: `${uid}-${key}-${Date.now()}`,
      trigger,
      content: () => Object.assign([box], { styles: ['book-your-visit-modal'] }),
    }).then((dialog) => {
      confirm.addEventListener('click', () => {
        apply();
        dialog?.close();
      });
    });
  };

  // phones: Date and Time (each with Edit), Guests, Services, the add-ons, the promo field
  const renderPhone = () => {
    if (!line) return;
    const row = (label, value, edit) => {
      const r = el('div', 'book-your-visit-phone-row');
      const dd = el('dd', '', value);
      r.append(el('dt', '', label), dd);
      if (edit) {
        const b = el('button', 'book-your-visit-edit', translate('cartEdit'));
        b.type = 'button';
        b.setAttribute('aria-label', `${translate('cartEdit')}: ${label.replace(/:$/, '')}`);
        b.addEventListener('click', () => edit(b));
        dd.append(b);
      }
      return r;
    };
    const list = el('dl', 'book-your-visit-phone-list');
    list.append(
      row(translate('cartDate'), date ? formatCartDate(`${date} 00:00:00`) : '', (b) => editPopup('date', b, () => {
        const p = buildDatePicker({
          name: 'phone-date', value: date, min: first.today, format, prefix: 'book-your-visit',
        });
        p.element.classList.add('book-your-visit-date-inline');
        return [p.element, () => choose(p.input.value)];
      })),
      row(translate('cartTime'), time ? `${time} ${translate('cartHours')}` : texts.notimeslot, (b) => editPopup('time', b, () => {
        const select = timeSelect.cloneNode(true);
        select.id = `${uid}-phone-time`;
        fillTimes(select);
        const label = el('label', 'book-your-visit-label', texts.time);
        label.htmlFor = select.id;
        const box = el('div', 'book-your-visit-time');
        box.append(select, el('span', 'book-your-visit-hrs', translate('cartHours')));
        const wrap = el('div', 'book-your-visit-field');
        wrap.append(label, box);
        return [wrap, () => choose(date, select.value)];
      })),
      row(translate('cartGuests'), formatGuests(line)),
      row(translate('cartServices'), line.product),
    );
    if (line.addons?.length) {
      list.append(row(translate('cartAdditionalServices'), line.addons.map((a) => `${a.quantity}x ${a.name}`).join(', ')));
    }
    // (the promo field, when the phones' summary has it, stays)
    phone.replaceChildren(...[list, phone.querySelector('.book-your-visit-promo')].filter(Boolean));
  };

  // the summary (desktop) or the phones' bar; the promo field in whichever shows
  const proceedButton = (label, className) => {
    const b = el('button', `button primary ${className}`, label);
    b.type = 'button';
    // eslint-disable-next-line no-use-before-define
    b.addEventListener('click', () => proceed(b));
    return b;
  };
  const renderSummary = () => {
    if (!cart || !line) return;
    const title = el('h2', 'checkout-summary-title', texts.summary);
    title.id = `${uid}-summary`;
    if (desktop.matches) {
      const box = buildSummaryBox(cart, {
        uid,
        redraw: (now) => { cart = now || cart; renderSummary(); },
        root: () => aside,
      });
      aside.replaceChildren(title, box, proceedButton(texts.checkout, 'checkout-payment checkout-payment-summary'));
    } else {
      aside.replaceChildren();
      phone.querySelector('.book-your-visit-promo')?.remove();
      const promo = el('div', 'book-your-visit-promo');
      promo.append(buildPromo(cart, {
        prefix: 'checkout',
        redraw: (now) => { cart = now || cart; renderSummary(); },
        root: () => phone,
      }));
      phone.append(promo);
    }
    const { currency, totals = {} } = cart;
    const price = el('p', 'book-your-visit-bar-price');
    price.append(el('span', 'book-your-visit-bar-label', texts.subtotal), el('strong', 'book-your-visit-bar-amount', formatAmount(totals.total, currency)));
    if (Number(totals.base) > Number(totals.total)) price.append(el('del', 'book-your-visit-bar-base', formatAmount(totals.base, currency)));
    bar.replaceChildren(price, proceedButton(texts.proceed, 'book-your-visit-proceed'));
  };
  desktop.addEventListener('change', renderSummary);

  // Check Out / Confirm & Proceed: a bookable time, the visit saved when it changed, the checkout
  const proceed = async (button) => {
    if (inLibrary()) return;
    showError('');
    first = firstSlot(lounge.timeZone || line.timeZone, lounge.leadMinutes);
    if (!time) {
      showError(texts.notimeslot);
      return;
    }
    if (!bookable(date, time, first)) {
      showError(texts.leadtime);
      choose(date);
      return;
    }
    const start = toStartDateTime(date, time);
    if (start !== line.start) {
      button.disabled = true;
      showLoader();
      const result = await updateLounge({ start });
      hideLoader();
      button.disabled = false;
      if (result.status !== 'updated') {
        showError(texts.error);
        return;
      }
    }
    showLoader();
    window.location.assign(checkoutUrl());
  };

  // the page's back title: the lounge's page, with the visit (as the source's)
  const linkBack = () => {
    const back = document.querySelector('main .title.back a[href]');
    const href = propertyDetailUrl(line.propertyCode, {
      currency: cart.currency, date, time,
    });
    if (back && href) back.href = href;
  };

  /**
   * Shows the cart's lounge visit (a first time, or the cart again: another tab, an add-on).
   * @param {Object|null} now
   * @returns {boolean} false: no lounge to show (the page leaves)
   */
  const show = (now) => {
    const lounge0 = now?.lines?.find((l) => l.kind !== 'pass');
    if (!lounge0) {
      leave();
      return false;
    }
    const firstShow = !line;
    cart = now;
    line = lounge0;
    // GA4's view_cart for the cart's own page, once, as it first shows the cart (not the block
    // library's sample)
    if (firstShow && !inLibrary()) trackViewCart(now, 'cart_page');
    if (firstShow) {
      const [d, t] = [line.start.slice(0, 10), line.start.slice(11, 16).replace(':', '')];
      first = firstSlot(line.timeZone, lounge.leadMinutes);
      date = isIsoDate(d) && d >= first.today ? d : first.today;
      time = t;
      renderHead();
      renderFields();
      choose(date, time);
      linkBack();
      // the Kwanko basket page tag, once, as the page first shows the cart (not the block
      // library's sample; the tag waits for Kwanko UniJS, which loads with the other tags)
      if (!inLibrary()) import('../../scripts/kwanko.js').then(({ basketTag }) => basketTag(now));
    }
    renderPhone();
    renderSummary();
    return true;
  };

  // the block library: the sample visit (no cart there), nothing read or saved
  if (inLibrary()) {
    fetch(LIBRARY_CART)
      .then((resp) => (resp.ok ? resp.json() : null))
      .then((json) => { if (json) show(readCart(json)); })
      .catch(() => {});
    return;
  }

  onCartChange((now) => {
    if (now) show(now);
    else if (!getCartId()) leave();
  });

  if (!getCartId()) {
    leave();
    return;
  }
  const stored = getCart();
  if (stored) show(stored);
  // the booking system's cart (fresh prices); a tab without the cart's data waits for it behind the
  // loader; then the lounge's lead time (its first slot)
  const read = refreshCart()
    .then((fresh) => {
      if (!fresh) {
        leave();
        return null;
      }
      return show(fresh) ? fresh : null;
    })
    .catch(() => stored || null)
    .then(async (now) => {
      if (!now) {
        if (!stored) showError(texts.error);
        return;
      }
      lounge = await readLounge(line, now.currency);
      first = firstSlot(lounge.timeZone || line.timeZone, lounge.leadMinutes);
      choose(date, time);
    });
  if (!stored) holdLoader(read);
}
