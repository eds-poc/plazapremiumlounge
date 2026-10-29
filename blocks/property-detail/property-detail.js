import {
  buildBlock, decorateBlock, getMetadata, loadBlock,
} from '../../scripts/aem.js';
import { applyButtonAction } from '../../scripts/button-actions.js';
import apiUrl from '../../scripts/endpoints.js';
import { translate } from '../../scripts/i18n.js';
import openGallery from '../../scripts/gallery.js';
import { openModal } from '../../scripts/modal-dialog.js';
import {
  DAY_MINUTES, MAX_GUESTS, SLOT_MINUTES, chooseSlot, fitGuests, formatDate,
  readLeadTime, readTimeZone, toStartDateTime, toTime,
} from '../../scripts/booking.js';
import buildDatePicker from '../../scripts/date-picker.js';
import {
  buildBadge, buildSlider, el, fetchJson, getApiLanguage, isPreview, readProperty,
  safeHtml, setLoading, toKey, toUrl,
} from '../../scripts/properties.js';

// the detail service answers in about 0.2-2s; the services one in 3-7s (at times far longer)
const DETAIL_TIMEOUT_MS = 15000;
const SERVICES_TIMEOUT_MS = 30000;
// the price service answers in about 1-4s
const PRICE_TIMEOUT_MS = 30000;
// a pause after a date or time change before asking for that slot's services
const SERVICES_DELAY_MS = 400;
const MOBILE = '(width < 768px)';
// desktop shows the first four photos, as the source
const DESKTOP_PHOTOS = 4;
const DEFAULT_CURRENCY = 'USD';

/**
 * The page address's lounge and booking choices, as the source detail pages use them
 * (`?propertycode=PRPRTY754&currency=HKD&date=2026-10-21&time=1600`). The currency is
 * `currencyCode` when there's one (the language and currency modal's Apply writes it), else
 * `currency`. Unknown parameters are kept.
 * @returns {{code: string, currency: string, date: string, time: string}}
 */
function readParams() {
  const params = new URLSearchParams(window.location.search);
  const get = (name) => (params.get(name) || '').trim();
  return {
    code: get('propertycode').toUpperCase(),
    currency: (get('currencyCode') || get('currency')).toUpperCase(),
    date: get('date'),
    time: get('time'),
  };
}

/**
 * Writes the booking choices back into the page address (no reload, no new history entry).
 * @param {Object<string, string>} values
 */
function writeParams(values) {
  const url = new URL(window.location.href);
  Object.entries(values).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  window.history.replaceState(window.history.state, '', url);
}

/**
 * A price as the source shows it, e.g. "HKD 650.00".
 * @param {{amount: number, currency: string}} price
 * @returns {string}
 */
function formatPrice(price) {
  return `${price.currency} ${price.amount.toFixed(2)}`;
}

/**
 * The bookable services in a services response, each with its products (durations); services
 * without products (e.g. the "Pass Service" every lounge lists) aren't bookable here. The service
 * answers in English only, so a service's name comes from the lounge's own (translated) list when
 * it has it (SRVC1619 there is serviceId 1619).
 * @param {Object} json
 * @param {Object<string, string>} [names] Translated service names by serviceId
 * @returns {{code: string, name: string,
 *   products: {code: string, name: string, minutes: number}[]}[]}
 */
function readServices(json, names = {}) {
  const items = Array.isArray(json?.items) ? json.items : [];
  const order = (x) => Number(x.sequence) || 0;
  return [...items].sort((a, b) => order(a) - order(b)).map((s) => ({
    code: s.serviceCode,
    name: (names[String(s.serviceCode || '').replace(/^SRVC/, '')] || s.serviceDisplayName || s.serviceName || '').trim(),
    // the service lists the products in no fixed order: shortest first, as the source
    products: (s.availableProducts || [])
      .map((p) => ({ code: p.productCode, name: (p.displayName || '').trim(), minutes: Number(p.durationInMinutes) || 0 }))
      .filter((p) => p.code && p.name)
      // (a product before its bundle of the same length, e.g. "5 Hours" before "5 Hours + Sakura…")
      .sort((a, b) => a.minutes - b.minutes || a.name.length - b.name.length),
  })).filter((s) => s.code && s.name && s.products.length);
}

/**
 * The service's promo code rejection in a price response: the `isPromoRejected` of any item (its
 * message, e.g. "No campaign found with given promocode"; `true` gets the site's own wording).
 * @param {Object} json
 * @returns {string} '' when the promo code wasn't rejected
 */
function readPromoRejection(json) {
  const items = Array.isArray(json?.items) ? json.items : [];
  const rejected = items.find((i) => i?.isPromoRejected)?.isPromoRejected;
  if (!rejected) return '';
  return typeof rejected === 'string' && rejected.trim() ? rejected.trim() : translate('propertyPromoRejected');
}

/**
 * The price in a price response (the first product's first price): the total, the price before
 * discounts and the currency. Null when there's none (not available for that start or guests).
 * @param {Object} json
 * @param {string} currency The currency asked for
 * @returns {{total: number, base: number, currency: string, catalogueCode: string}|null}
 */
function readPrice(json, currency) {
  const item = Array.isArray(json?.items) ? json.items[0] : null;
  const price = Array.isArray(item?.prices) ? item.prices[0] : null;
  const total = Number(price?.totalPrice);
  if (!price || item.availability === false || price.isInventoryAvailable === false
    || !Number.isFinite(total)) return null;
  const base = Number(price.basePrice);
  return {
    total,
    base: Number.isFinite(base) ? base : total,
    currency: price.baseRate?.[0]?.currency || currency,
    catalogueCode: price.catalogueCode || '',
  };
}

/**
 * Reads the detail service's response into the page's model: the listing's fields (shared with
 * the property list) plus the detail-only ones. Null for a lounge that isn't shown.
 * @param {Object} json
 * @returns {Object|null}
 */
function readDetail(json) {
  const detail = json?.propertyDetail;
  if (!detail || typeof detail !== 'object') return null;
  const base = readProperty(detail);
  if (!base) return null;
  const iata = (detail.iataCode || '').trim();
  const locationName = (detail.locationName || '').trim();
  const shortLocation = (detail.shortLocation || '').trim();
  const place = /^[A-Z]{3}$/.test(iata) && locationName ? `${locationName} (${iata})` : locationName;
  return {
    ...base,
    fullName: (detail.propertyName || base.name).trim(),
    place: [shortLocation, place].filter((part, i, all) => part && (i === 0 || !all[0].includes(part))).join(', '),
    crumb: [translate('propertyLoungeIn', { city: (detail.cityName || '').trim() }), place].filter(Boolean).join(' | '),
    address: (detail.address || '').trim(),
    // the phone only: the service's contact emails aren't for visitors
    phone: (detail.contactInfo?.primaryNumber || '').trim(),
    // the lounge's factsheet (a PDF): the first of the service's files
    factsheet: (Array.isArray(detail.factsheetLink) ? detail.factsheetLink : [])
      .map((file, i) => ({ href: toUrl(file?.path), order: Number(file?.sequence) || i + 1 }))
      .filter((file) => /^https?:/.test(file.href || ''))
      .sort((a, b) => a.order - b.order)[0]?.href || '',
    description: detail.description || '',
    timeZone: readTimeZone(detail.timeZone),
    iata,
    leadMinutes: readLeadTime(detail.leadTime),
    defaultCurrency: (detail.defaultCurrency || '').trim().toUpperCase(),
    // the translated service names, for the services call's English ones
    serviceNames: Object.fromEntries((detail.availableServices || [])
      .filter((s) => s.serviceId && s.serviceDisplayName)
      .map((s) => [String(s.serviceId), s.serviceDisplayName.trim()])),
  };
}

/**
 * The authored settings: rows of name | value, as property-list (`signup-button`, a link).
 * @param {Element} block
 * @returns {{signup: HTMLAnchorElement|null}}
 */
function readSettings(block) {
  const settings = { signup: null };
  [...block.children].forEach((row) => {
    const [name, value] = row.children;
    if (toKey(name?.textContent) === 'signup-button') {
      const link = value?.querySelector('a[href]');
      const href = toUrl(link?.getAttribute('href'));
      if (href) {
        settings.signup = el('a', '', link.textContent.trim() || href);
        settings.signup.href = href;
      }
    }
  });
  return settings;
}

/**
 * The Smart Traveller line: the service's text with percentages in bold, then the authored link.
 * @param {string} text
 * @param {HTMLAnchorElement|null} signup
 * @returns {HTMLElement|null}
 */
function buildLoyalty(text, signup) {
  if (!text) return null;
  const line = el('p', 'property-detail-loyalty');
  text.split(/(\d+(?:\.\d+)?\s?%)/).forEach((part, i) => {
    if (!part) return;
    line.append(i % 2 ? el('b', '', part) : part);
  });
  if (signup) {
    const link = signup.cloneNode(true);
    line.append(' ', applyButtonAction(link));
  }
  return line;
}

/**
 * The title band: the lounge's name (the page's h1) with its location, and the opening hours.
 * On phones the journey badge sits above the name.
 * @param {Object} lounge
 * @returns {HTMLElement}
 */
function buildHero(lounge) {
  const hero = el('div', 'property-detail-hero');
  if (lounge.departure || lounge.arrival) {
    hero.append(buildBadge(lounge.departure ? 'departure' : 'arrival', 'property-detail-badge-tip', 'property-detail-badge'));
  }
  const title = el('h1', 'property-detail-title', lounge.name);
  if (lounge.place) title.append(el('small', 'property-detail-place', lounge.place));
  hero.append(title);
  if (lounge.hours) hero.append(el('p', 'property-detail-hours', lounge.hours));
  return hero;
}

/**
 * The breadcrumb: Lounges (back to the listing the visitor came from) < this lounge.
 * @param {Object} lounge
 * @returns {HTMLElement}
 */
function buildCrumbs(lounge) {
  const nav = el('nav', 'property-detail-crumbs');
  nav.setAttribute('aria-label', 'Breadcrumb');
  const list = el('ol');
  const back = el('li');
  let from = '';
  try {
    const ref = new URL(document.referrer);
    const { origin, pathname } = window.location;
    if (ref.origin === origin && ref.pathname !== pathname) from = ref.href;
  } catch { /* no referrer */ }
  if (from) {
    const link = el('a', '', translate('propertyLounges'));
    link.href = from;
    back.append(link);
  } else back.append(translate('propertyLounges'));
  const current = el('li', '', lounge.crumb);
  current.setAttribute('aria-current', 'page');
  list.append(back, current);
  nav.append(list);
  return nav;
}

/**
 * The photos: the first four stacked on desktop, a slider on phones. A photo opens the gallery
 * of all the lounge's photos at that one, as the source (captioned with the photos' names).
 * @param {Object} lounge
 * @param {boolean} mobile Which one loads its first photo straight away
 * @returns {{photos: HTMLElement, slider: HTMLElement}}
 */
function buildGallery(lounge, mobile) {
  const altFor = (i) => (i === 0 ? [lounge.name, lounge.place].filter(Boolean).join(', ') : `${lounge.name}, ${translate('propertyPhoto', { n: i + 1, total: lounge.images.length })}`);
  const images = lounge.images.map((image, i) => ({ ...image, alt: altFor(i) }));
  const open = (i, link) => openGallery(images, i, { label: lounge.name, trigger: link });
  const photos = el('ul', 'property-detail-photos');
  lounge.images.slice(0, DESKTOP_PHOTOS).forEach((image, i) => {
    const item = el('li');
    const link = el('a');
    link.href = image.src;
    link.setAttribute('aria-haspopup', 'dialog');
    const img = el('img');
    img.src = image.src;
    img.alt = altFor(i);
    img.loading = !mobile && i === 0 ? 'eager' : 'lazy';
    img.decoding = 'async';
    link.append(img);
    link.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      open(i, link);
    });
    item.append(link);
    photos.append(item);
  });
  const slider = buildSlider({ ...lounge, line: lounge.place }, mobile, 'property-detail-slider', { onOpen: open });
  return { photos, slider };
}

/**
 * A labelled field of the booking form.
 * @param {string} label
 * @param {HTMLElement} control
 * @param {string} [note] A small note after the label
 * @returns {HTMLElement}
 */
function field(label, control, note) {
  const wrap = el('div', 'property-detail-field');
  const text = el('label', 'property-detail-label', label);
  const input = control.matches('input, select')
    ? control : control.querySelector('.property-detail-date-text, input:not([type="hidden"]), select');
  if (input) {
    input.id = input.id || `property-detail-${toKey(label)}`;
    text.htmlFor = input.id;
  }
  if (note) text.append(el('span', 'property-detail-label-note', note));
  wrap.append(text, control);
  return wrap;
}

/**
 * A number field with minus and plus buttons (adults, children); the buttons stay within the
 * field's `min` and `max` (the booking form moves `max` with the other count, see fixGuests), and
 * a step that changes nothing announces nothing.
 * @param {string} name
 * @param {string} group The label, for the buttons' names
 * @param {number} value
 * @param {number} min
 * @returns {HTMLElement}
 */
function counter(name, group, value, min) {
  const wrap = el('div', 'property-detail-counter');
  const input = el('input');
  input.type = 'number';
  input.name = name;
  input.min = min;
  input.max = MAX_GUESTS;
  input.value = value;
  input.inputMode = 'numeric';
  const step = (delta, label, className, text) => {
    const btn = el('button', className, text);
    btn.type = 'button';
    btn.setAttribute('aria-label', label);
    btn.addEventListener('click', () => {
      const now = Number.parseInt(input.value, 10) || min;
      const next = Math.min(Number(input.max), Math.max(min, now + delta));
      if (next === Number(input.value)) return;
      input.value = next;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    return btn;
  };
  wrap.append(
    step(-1, translate('propertyFewer', { group }), 'property-detail-step property-detail-step-minus', '-'),
    input,
    step(1, translate('propertyMoreOf', { group }), 'property-detail-step property-detail-step-plus', '+'),
  );
  return wrap;
}

/**
 * The booking panel (desktop) / form (in the phone's Book Your Visit dialog), as the source:
 * date, time, adults, children, service, service details, promo code and Get Price. Changing the
 * date or time updates the page address and calls `onSlotChange` (the services depend on the
 * start time). Get Price asks for the price of the chosen service, duration, guests and start
 * (`requestPrice`, with the page's loader up meanwhile) and shows it as the source: Subtotal,
 * the price before a discount struck through, the price, and Reserve Now instead of Get Price.
 * Any change clears it again. Reserve Now has no action yet: it announces the choice and its
 * price (`property-detail:reserve`) for the booking hand-off to come; `property-detail:get-price`
 * and `property-detail:price` are announced too.
 * @param {Object} lounge
 * @param {Object} slot The chosen date and time (see chooseSlot)
 * @param {Object} settings
 * @param {{currency: string, onSlotChange: Function, requestPrice: Function}} options
 * @returns {{panel: HTMLElement, heading: HTMLElement, form: HTMLFormElement,
 *   setServices: Function, startDateTime: Function, closeCalendar: Function}}
 */
function buildBooking(lounge, slot, settings, { currency, onSlotChange, requestPrice }) {
  const panel = el('section', 'property-detail-booking');
  const header = el('div', 'property-detail-booking-header');
  const heading = el('h2', 'property-detail-booking-title', translate('propertyBookVisit'));
  header.append(heading);
  const loyalty = buildLoyalty(lounge.loyalty, settings.signup);
  if (loyalty) header.append(loyalty);
  panel.setAttribute('aria-labelledby', 'property-detail-booking-title');
  heading.id = 'property-detail-booking-title';

  const form = el('form', 'property-detail-form');
  form.noValidate = true;
  form.addEventListener('submit', (e) => e.preventDefault());
  const fields = el('div', 'property-detail-fields');

  // date: the date as the source writes it, with the source's calendar (see buildDatePicker); a
  // day before the first bookable one can't be chosen
  const time = el('select');
  const picker = buildDatePicker({
    name: 'date',
    value: slot.date,
    min: slot.firstDay,
    format: formatDate,
  });
  const date = picker.input;

  // time: every half hour; times before the first bookable slot are unavailable
  const timeWrap = el('div', 'property-detail-time');
  time.name = 'time';
  const fillTimes = () => {
    const keep = time.value || slot.time;
    time.replaceChildren();
    for (let m = 0; m < DAY_MINUTES; m += SLOT_MINUTES) {
      const option = el('option', '', toTime(m));
      option.value = toTime(m);
      option.disabled = date.value === slot.firstDay && m < slot.earliest;
      time.append(option);
    }
    const first = [...time.options].find((o) => !o.disabled);
    const kept = [...time.options].some((o) => o.value === keep && !o.disabled);
    time.value = kept ? keep : first?.value;
  };
  fillTimes();
  time.value = slot.time;
  timeWrap.append(time, el('span', 'property-detail-time-unit', translate('propertyHours')));

  const dateField = field(translate('propertyDate'), picker.element);
  // the date's name: the label, then the date
  const dateLabel = dateField.querySelector('.property-detail-label');
  dateLabel.id = `${picker.trigger.id}-label`;
  picker.trigger.setAttribute('aria-labelledby', `${dateLabel.id} ${picker.trigger.id}`);
  fields.append(
    dateField,
    field(translate('propertyTime'), timeWrap),
    field(translate('propertyAdults'), counter('adults', translate('propertyAdults'), 1, 1)),
    field(translate('propertyChildren'), counter('children', translate('propertyChildren'), 0, 0), translate('propertyChildNote')),
  );

  // the guests, as the source: at least one adult, up to two children per adult, nine in all.
  // A change that breaks a limit is pulled back to it: the changed count stops at what's left, and
  // fewer adults take children down with them (3 + 6, then 2 adults: 2 + 4)
  const adults = fields.querySelector('[name="adults"]');
  const children = fields.querySelector('[name="children"]');
  const count = (input, fallback) => {
    const n = Number.parseInt(input.value, 10);
    return Number.isFinite(n) ? n : fallback;
  };
  /**
   * Keeps the guest counts within the limits, and each field's `max` and its buttons' state too.
   * @param {string} [changed] `adults` or `children`, the count the visitor changed
   */
  const fixGuests = (changed) => {
    const fit = fitGuests(count(adults, 1), count(children, 0), changed);
    const a = fit.adults;
    const c = fit.children;
    if (adults.value !== String(a)) adults.value = a;
    if (children.value !== String(c)) children.value = c;
    adults.max = fit.maxAdults;
    children.max = fit.maxChildren;
    // (the buttons look the same at a limit, as the source's; they're marked for screen readers)
    [[adults, a], [children, c]].forEach(([input, value]) => {
      const wrap = input.closest('.property-detail-counter');
      const off = (button, state) => button.setAttribute('aria-disabled', String(state));
      off(wrap.querySelector('.property-detail-step-minus'), value <= Number(input.min));
      off(wrap.querySelector('.property-detail-step-plus'), value >= Number(input.max));
    });
  };
  [adults, children].forEach((input) => {
    // typing: fixed as it goes (a field left empty becomes the least it can be)
    input.addEventListener('input', () => { if (input.value !== '') fixGuests(input.name); });
    input.addEventListener('change', () => fixGuests(input.name));
  });
  fixGuests();

  // service and its products (e.g. Lounge → Lounge Use - 2 Hours); they come from the services
  // call for the chosen start time (see setServices), so the fields wait, disabled, until then
  const service = el('select');
  service.name = 'service';
  const product = el('select');
  product.name = 'product';
  const promo = el('input');
  promo.type = 'text';
  promo.name = 'promo';
  promo.placeholder = translate('propertyPromoPlaceholder');
  promo.autocomplete = 'off';
  const serviceFields = [
    field(translate('propertyServices'), service),
    field(translate('propertyServiceDetails'), product),
    field(translate('propertyPromo'), promo),
  ];
  fields.append(...serviceFields);
  // the service's promo code rejection, under the promo code field
  const promoNotice = el('p', 'property-detail-promo-notice');
  promoNotice.setAttribute('role', 'alert');
  promoNotice.hidden = true;
  serviceFields[2].append(promoNotice);
  /**
   * Shows the promo code rejection (the code stays in the field, for the visitor to correct).
   * @param {string} text
   */
  const rejectPromo = (text) => {
    promoNotice.textContent = text;
    promoNotice.hidden = false;
  };
  form.append(fields);

  const action = el('div', 'property-detail-action');
  // the price, announced when it arrives: Subtotal | the price before a discount | the price
  const result = el('div', 'property-detail-price');
  result.setAttribute('role', 'status');
  const total = el('div', 'property-detail-total');
  const message = el('p', 'property-detail-price-message');
  result.append(total, message);
  const button = el('button', 'property-detail-get-price', translate('propertyGetPrice'));
  button.type = 'submit';
  const reserve = el('button', 'property-detail-get-price property-detail-reserve', translate('propertyReserveNow'));
  reserve.type = 'button';
  action.append(result, button, reserve);
  form.append(action);

  let priced = null;
  let pricing = null;
  /** Back to Get Price: no price, no message, and any price request still out is dropped. */
  const clearPrice = () => {
    pricing?.abort();
    pricing = null;
    priced = null;
    total.replaceChildren();
    total.hidden = true;
    message.replaceChildren();
    message.hidden = true;
    promoNotice.replaceChildren();
    promoNotice.hidden = true;
    button.hidden = false;
    reserve.hidden = true;
    form.removeAttribute('aria-busy');
  };
  clearPrice();
  /**
   * The price as the source shows it, with Reserve Now in place of Get Price.
   * @param {Object} request
   * @param {{total: number, base: number, currency: string}} price
   */
  const showPrice = (request, price) => {
    priced = { request, price };
    const was = el('s', 'property-detail-total-was');
    // (compared to the cent: the service's prices can carry more decimals, e.g. converted ones)
    if (Math.round(price.base * 100) > Math.round(price.total * 100)) {
      was.textContent = formatPrice({ amount: price.base, currency: price.currency });
    }
    total.replaceChildren(
      el('span', 'property-detail-total-label', translate('propertySubtotal')),
      was,
      el('b', 'property-detail-total-now', formatPrice({ amount: price.total, currency: price.currency })),
    );
    total.hidden = false;
    button.hidden = true;
    reserve.hidden = false;
    form.dispatchEvent(new CustomEvent('property-detail:price', { bubbles: true, detail: priced }));
  };
  // any change to the choices clears the price, as the source
  form.addEventListener('change', clearPrice);
  form.addEventListener('input', (e) => { if (e.target.name === 'promo') clearPrice(); });
  reserve.addEventListener('click', () => {
    if (priced) form.dispatchEvent(new CustomEvent('property-detail:reserve', { bubbles: true, detail: priced }));
  });

  let services = [];
  const fillProducts = (keep) => {
    const chosen = services.find((x) => x.code === service.value) || services[0];
    product.replaceChildren(...(chosen?.products || []).map((p) => {
      const option = el('option', '', p.name);
      option.value = p.code;
      return option;
    }));
    if (keep && chosen?.products.some((p) => p.code === keep)) product.value = keep;
  };
  service.addEventListener('change', () => fillProducts());
  // the visitor's service and service details, kept while a new list loads
  let chosen = null;
  const loading = () => {
    const option = el('option', '', translate('propertyLoading'));
    option.value = '';
    return option;
  };
  /**
   * Shows the bookable services: null while they're loading (both drop-downs say Loading…, the
   * fields are disabled), [] when there are none (a note instead of the fields and Get Price), or,
   * with `retry`, a note that they couldn't be loaded and Try again. The visitor's service and
   * service details stay chosen when the new list still has them.
   * @param {Object[]|null} list
   * @param {Function} [retry]
   */
  const setServices = (list, retry) => {
    const waiting = list === null;
    clearPrice();
    form.classList.toggle('is-waiting', waiting);
    [service, product, promo, button].forEach((control) => { control.disabled = waiting; });
    if (waiting && services.length) chosen = { service: service.value, product: product.value };
    services = list || [];
    if (waiting) {
      service.replaceChildren(loading());
      product.replaceChildren(loading());
    } else {
      service.replaceChildren(...services.map((x) => {
        const option = el('option', '', x.name);
        option.value = x.code;
        return option;
      }));
      if (services.some((x) => x.code === chosen?.service)) service.value = chosen.service;
      fillProducts(chosen?.product);
    }
    const none = !waiting && !services.length;
    serviceFields.forEach((f) => { f.hidden = none; });
    action.hidden = none;
    fields.querySelector('.property-detail-no-services')?.remove();
    if (!none) return;
    const note = el('div', 'property-detail-no-services');
    note.setAttribute('role', 'status');
    note.append(el('p', '', translate(retry ? 'propertyServicesError' : 'propertyNoServices')));
    if (retry) {
      const again = el('button', 'button secondary', translate('propertyRetry'));
      again.type = 'button';
      again.addEventListener('click', retry);
      note.append(again);
    }
    fields.append(note);
  };
  setServices(null);

  /** The chosen start as the services call takes it (see toStartDateTime). */
  const startDateTime = () => toStartDateTime(date.value, time.value);
  date.addEventListener('change', () => {
    fillTimes();
    writeParams({ date: date.value, time: time.value });
    onSlotChange();
  });
  time.addEventListener('change', () => {
    writeParams({ time: time.value });
    onSlotChange();
  });
  form.addEventListener('submit', async () => {
    if (form.classList.contains('is-waiting') || !service.value || !product.value) return;
    fixGuests();
    const data = new FormData(form);
    const request = {
      serviceCode: service.value,
      productCode: product.value,
      guests: {
        adult: Math.max(1, Number.parseInt(data.get('adults'), 10) || 1),
        child: Math.max(0, Number.parseInt(data.get('children'), 10) || 0),
      },
      iataCode: lounge.iata,
      currencyCode: currency,
      propertyCode: lounge.code,
      startDateTime: startDateTime(),
      promocode: promo.value.trim(),
    };
    form.dispatchEvent(new CustomEvent('property-detail:get-price', { bubbles: true, detail: request }));
    clearPrice();
    const controller = new AbortController();
    pricing = controller;
    // the page's loader while the price comes (over the booking dialog on phones)
    setLoading(true);
    form.setAttribute('aria-busy', 'true');
    try {
      const price = await requestPrice(request, controller.signal);
      if (controller.signal.aborted) return;
      // a rejected promo code: only its message; no price, and Get Price stays
      if (price.promoRejected) rejectPromo(price.promoRejected);
      else showPrice(request, price);
    } catch (error) {
      if (controller.signal.aborted) return;
      // eslint-disable-next-line no-console
      console.error('property-detail: could not get the price', request, error);
      message.textContent = translate(error.unavailable ? 'propertyPriceUnavailable' : 'propertyPriceError');
      message.hidden = false;
      if (error.promoRejected) rejectPromo(error.promoRejected);
    } finally {
      setLoading(false);
      if (pricing === controller) form.removeAttribute('aria-busy');
    }
  });
  panel.append(header, form);
  return {
    panel, heading, form, setServices, startDateTime, closeCalendar: picker.close,
  };
}

/**
 * Tags (features, services) as the source's pills (services are rows on phones; see the CSS).
 * @param {{label: string}[]} items
 * @param {'features'|'services'} kind
 * @returns {HTMLElement}
 */
function buildTags(items, kind) {
  const list = el('ul', `property-detail-tags property-detail-tags-${kind}`);
  // a space between the pills, as the source's markup (part of the gap between them)
  items.forEach((item, i) => list.append(...(i ? [' '] : []), el('li', 'property-detail-tag', item.label)));
  return list;
}

/**
 * The Details panel: the location, the phone number and the factsheet.
 * @param {Object} lounge
 * @returns {HTMLElement}
 */
function buildDetails(lounge) {
  const wrap = el('div', 'property-detail-contact');
  const part = (title, ...content) => {
    const box = el('div', 'property-detail-contact-part');
    box.append(el('p', 'property-detail-contact-title', title), ...content);
    wrap.append(box);
  };
  if (lounge.address) part(translate('propertyLocation'), el('p', '', lounge.address));
  if (lounge.phone) part(translate('propertyContact'), el('p', '', `${translate('propertyPhone')}: ${lounge.phone}`));
  // the factsheet, under both, in a new tab as the source
  if (lounge.factsheet) {
    const link = el('a', 'property-detail-factsheet', translate('propertyFactsheet'));
    link.href = lounge.factsheet;
    link.target = '_blank';
    link.rel = 'noopener';
    link.append(el('span', 'visually-hidden', translate('opensInNewTab')));
    wrap.append(link);
  }
  return wrap;
}

/**
 * The page's title, description and canonical address, from the lounge (the template page itself
 * isn't indexed; its canonical keeps just the lounge, not the booking choices).
 * @param {Object} lounge
 * @param {Node} description The lounge's description (its text becomes the page description)
 */
function setHead(lounge, description) {
  document.title = lounge.fullName;
  const text = description.textContent.replace(/\s+/g, ' ').trim().slice(0, 160);
  const meta = (attr, name, value) => {
    let tag = document.head.querySelector(`meta[${attr}="${name}"]`);
    if (!tag) {
      tag = el('meta');
      tag.setAttribute(attr, name);
      document.head.append(tag);
    }
    tag.content = value;
  };
  meta('property', 'og:title', lounge.fullName);
  if (text) {
    meta('name', 'description', text);
    meta('property', 'og:description', text);
  }
  if (lounge.images[0]) meta('property', 'og:image', lounge.images[0].src);
  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = el('link');
    canonical.rel = 'canonical';
    document.head.append(canonical);
  }
  const url = new URL(window.location.pathname, window.location.origin);
  url.searchParams.set('propertycode', lounge.code);
  canonical.href = url.href;
}

/**
 * A message in place of the lounge (not found, error), with Try again and a setup hint shown on
 * the preview site only.
 * @param {Element} block
 * @param {string} text
 * @param {Function|null} retry
 * @param {string} [hint]
 */
function showMessage(block, text, retry, hint) {
  const box = el('div', 'property-detail-message');
  box.setAttribute('role', 'status');
  box.append(el('p', '', text));
  if (retry) {
    const btn = el('button', 'button secondary', translate('propertyRetry'));
    btn.type = 'button';
    btn.addEventListener('click', retry);
    box.append(btn);
  }
  if (hint && isPreview()) box.append(el('p', 'property-detail-hint', hint));
  block.replaceChildren(box);
}

/**
 * The four panels (The Lounge, Lounge Features, Available Services, Details), as an Accordion
 * block (option detail), the first two open, as the source.
 * @param {Object} lounge
 * @param {HTMLElement} description
 * @returns {Promise<HTMLElement>} the accordion's wrapper
 */
async function buildPanels(lounge, description) {
  const rows = [['lounge', translate('propertyPanelLounge'), description]];
  if (lounge.features.length) rows.push(['features', translate('propertyPanelFeatures'), buildTags(lounge.features, 'features')]);
  if (lounge.services.length) rows.push(['services', translate('propertyPanelServices'), buildTags(lounge.services, 'services')]);
  const details = buildDetails(lounge);
  if (details.children.length) rows.push(['details', translate('propertyPanelDetails'), details]);
  const accordion = buildBlock('accordion', rows.map(([, title, content]) => [el('p', '', title), content]));
  accordion.classList.add('detail');
  const wrapper = el('div', 'accordion-wrapper');
  wrapper.append(accordion);
  decorateBlock(accordion);
  await loadBlock(accordion);
  // each panel named by its content (property-detail-panel-services is a card on phones); the
  // first two open on desktop, as the source
  [...accordion.querySelectorAll(':scope > details')].forEach((item, i) => {
    if (rows[i]) item.classList.add(`property-detail-panel-${rows[i][0]}`);
    item.dataset.desktopOpen = i < 2;
    item.open = i < 2;
  });
  // phones show every panel open, and their headings don't close them (see setPanelsMode)
  accordion.addEventListener('click', (e) => {
    if (accordion.classList.contains('is-static') && e.target.closest('summary')) e.preventDefault();
  });
  return wrapper;
}

/**
 * The panels on phones, as the source: every panel open, no arrows, and the headings don't open
 * or close anything (out of the tab order); on desktop, accordions again, the first two open.
 * @param {HTMLElement} panels The accordion's wrapper
 * @param {boolean} mobile
 */
function setPanelsMode(panels, mobile) {
  const accordion = panels.querySelector('.accordion');
  accordion.classList.toggle('is-static', mobile);
  accordion.querySelectorAll(':scope > details').forEach((item) => {
    item.open = mobile || item.dataset.desktopOpen === 'true';
    const summary = item.querySelector(':scope > summary');
    if (mobile) summary.tabIndex = -1;
    else summary.removeAttribute('tabindex');
  });
}

/**
 * The phone's bottom bar: the lowest price and Book Your Visit, which opens the booking form in
 * the site's dialog, over the Smart Traveller line.
 * @param {Object} lounge
 * @param {{heading: HTMLElement, form: HTMLFormElement}} booking
 * @param {Object} settings
 * @returns {HTMLElement}
 */
function buildBar(lounge, booking, settings) {
  const bar = el('div', 'property-detail-bar');
  const row = el('div', 'property-detail-bar-row');
  const price = el('p', 'property-detail-bar-price');
  if (lounge.price) price.append(el('span', '', translate('propertyPriceFrom')), ' ', el('b', '', formatPrice(lounge.price)));
  const button = el('button', 'property-detail-bar-book', translate('propertyBookVisitButton'));
  button.type = 'button';
  button.setAttribute('aria-haspopup', 'dialog');
  button.addEventListener('click', async () => {
    const dialog = await openModal({
      key: `property-detail-${lounge.code}`,
      content: () => {
        const nodes = [el('h2', '', translate('propertyBookVisit')), booking.form];
        nodes.styles = ['property-detail-modal'];
        return nodes;
      },
      trigger: button,
    });
    // the form moves back to the panel on wider screens; bring it in again
    const body = dialog?.querySelector('.modal-body');
    if (body && !body.contains(booking.form)) body.append(booking.form);
  });
  row.append(price, button);
  bar.append(row);
  const loyalty = buildLoyalty(lounge.loyalty, settings.signup);
  if (loyalty) bar.append(loyalty);
  return bar;
}

/**
 * Decorates the property detail block: one lounge, loaded from the detail service by the page
 * address's `propertycode` (with `currency`, `date` and `time`), as the source detail pages. The
 * block itself only holds optional settings (signup-button); everything else comes from the
 * service. One template page serves every lounge.
 * @param {HTMLElement} block The property detail block element
 */
export default async function decorate(block) {
  const settings = readSettings(block);
  const params = readParams();
  block.replaceChildren();
  if (!/^[A-Z0-9]+$/.test(params.code)) {
    showMessage(block, translate('propertyNotFound'), null, 'Open this page with a lounge in the address, e.g. ?propertycode=PRPRTY814&currency=HKD.');
    return;
  }
  // the detail service needs the code and the language (the currency doesn't change its answer)
  const url = apiUrl('propertyDetail');
  url.searchParams.set('propertyCode', params.code);
  url.searchParams.set('currencyCode', params.currency || DEFAULT_CURRENCY);
  url.searchParams.set('languageCode', getApiLanguage());

  let load;
  const render = async () => {
    let lounge;
    try {
      lounge = readDetail(await fetchJson(url.href, DETAIL_TIMEOUT_MS));
    } catch (error) {
      if (error.status === 404) {
        showMessage(block, translate('propertyNotFound'), null, `Property code "${params.code}" isn't in the service.`);
        return;
      }
      // eslint-disable-next-line no-console
      console.error('property-detail: could not load', url.href, error);
      showMessage(block, translate('propertyDetailError'), () => load());
      return;
    }
    if (!lounge) {
      showMessage(block, translate('propertyNotFound'), null, `Property "${params.code}" isn't active or isn't a lounge or pass.`);
      return;
    }
    const mobile = window.matchMedia(MOBILE);
    const slot = chooseSlot(params, lounge.timeZone, lounge.leadMinutes);
    writeParams({ date: slot.date, time: slot.time });
    const currency = params.currency || lounge.defaultCurrency || DEFAULT_CURRENCY;
    let requestServices = () => {};

    // the bookable services for a start time (a POST, with the lounge's own airport code; it takes
    // a few seconds): a newer request replaces an older one. The first one goes out now, before the
    // page is built
    let pending;
    const fetchServices = (start) => {
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      const request = fetchJson(apiUrl('propertyServices').href, SERVICES_TIMEOUT_MS, {
        signal: controller.signal,
        body: {
          startDateTime: start,
          propertyCode: lounge.code,
          iataCode: lounge.iata,
          currencyCode: currency,
        },
      });
      return { controller, request };
    };
    const early = lounge.iata ? fetchServices(toStartDateTime(slot.date, slot.time)) : null;

    const description = el('div', 'property-detail-description');
    if (lounge.note) description.append(el('p', 'property-detail-note'));
    if (lounge.note) description.querySelector('.property-detail-note').append(safeHtml(lounge.note));
    description.append(safeHtml(lounge.description, { blocks: true }));

    const hero = buildHero(lounge);
    const band = el('div', 'property-detail-band');
    const crumbs = buildCrumbs(lounge);
    const { photos, slider } = buildGallery(lounge, mobile.matches);
    const intro = el('div', 'property-detail-intro');
    const gallery = el('div', 'property-detail-gallery');
    gallery.append(photos);
    const booking = buildBooking(lounge, slot, settings, {
      currency,
      onSlotChange: () => requestServices(true),
      // the price of the choices: a POST; no price for them (or the service's "not available"
      // kind of error) is marked `unavailable`
      requestPrice: async (body, signal) => {
        let json;
        try {
          json = await fetchJson(apiUrl('propertyPrice').href, PRICE_TIMEOUT_MS, { body, signal });
        } catch (error) {
          if (error.service && error.service.errorCode !== '500') error.unavailable = true;
          throw error;
        }
        // a rejected promo code comes with the price without it (or with no price at all)
        const promoRejected = body.promocode ? readPromoRejection(json) : '';
        const price = readPrice(json, body.currencyCode);
        if (!price) {
          throw Object.assign(new Error('No price for these choices'), { unavailable: true, promoRejected });
        }
        return { ...price, promoRejected };
      },
    });
    const panels = await buildPanels(lounge, description);
    const content = el('div', 'property-detail-content');
    content.append(booking.panel, panels);
    const main = el('div', 'property-detail-main');
    main.append(gallery, content);
    const body = el('div', 'property-detail-body');
    body.append(crumbs, main);
    const bar = buildBar(lounge, booking, settings);
    block.classList.toggle('property-detail-first', lounge.first);
    block.replaceChildren(band, intro, body, bar);
    // the page ends with room for the bar, as tall as it is (no Smart Traveller line: shorter)
    new ResizeObserver(() => {
      block.style.setProperty('--property-detail-bar-space', `${bar.offsetHeight}px`);
    }).observe(bar);

    // phones: the slider, the name and the description share the grey intro; desktop: the name in
    // the band, the photos beside the booking panel, the description in The Lounge panel
    const loungeAnswer = panels.querySelector('details .accordion-answer');
    const place = () => {
      // (the date's pop-up is desktop's; the dialog's calendar is always open)
      booking.closeCalendar();
      if (mobile.matches) {
        intro.append(slider, hero, description);
      } else {
        band.append(hero);
        loungeAnswer?.append(description);
        if (!booking.panel.contains(booking.form)) {
          booking.form.closest('dialog')?.close();
          booking.panel.append(booking.form);
        }
      }
      block.classList.toggle('is-mobile', mobile.matches);
      setPanelsMode(panels, mobile.matches);
    };
    mobile.addEventListener('change', place);
    place();
    setHead(lounge, safeHtml(lounge.description, { blocks: true }));

    // the services' answer into the booking form (an answer replaced by a newer request is dropped)
    const showServices = ({ controller, request }) => request.then((json) => {
      if (controller.signal.aborted) return;
      booking.setServices(readServices(json, lounge.serviceNames));
    }).catch((error) => {
      if (controller.signal.aborted) return;
      // eslint-disable-next-line no-console
      console.error('property-detail: could not load the services', error);
      booking.setServices([], () => requestServices(false));
    });
    // asked for again, after a short pause, when the date or time changes (and on Try again)
    let timer;
    requestServices = (delayed) => {
      clearTimeout(timer);
      pending?.abort();
      if (!lounge.iata) {
        booking.setServices([]);
        return;
      }
      booking.setServices(null);
      const ask = () => showServices(fetchServices(booking.startDateTime()));
      timer = setTimeout(ask, delayed ? SERVICES_DELAY_MS : 0);
    };
    if (early) showServices(early);
    else booking.setServices([]);
  };
  load = async () => {
    setLoading(true);
    try {
      await render();
    } finally {
      setLoading(false);
    }
  };
  // the page's loader stays up until the lounge is shown
  await load();
  if (getMetadata('language-code')) block.dataset.language = getMetadata('language-code');
}
