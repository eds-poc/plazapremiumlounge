/*
 * The homepage hero's lounge card (Booking Widget option lounge-card), as the source's
 * #booking-widget-products-section: when the visitor chooses an airport (or its date, time or
 * guests change), the airport's featured lounge with its products and prices; else a button to
 * all the airport's lounges.
 *
 * One call, getbookingwidgetproducts (the source's own widget call): the booking system picks
 * the airport's lounge (or keeps the one shown, when only the date, time or guests changed) and
 * answers with its details and its products grouped by service. Railway stations get no card.
 */
import apiUrl from '../../scripts/endpoints.js';
import { translate } from '../../scripts/i18n.js';
import {
  buildSlider, el, fetchJson, getApiLanguage, toUrl,
} from '../../scripts/properties.js';

// the service answers in about 1.5-4.5s
const PRODUCTS_TIMEOUT_MS = 20000;
// the source shows four features, then "+ N MORE"
const FEATURES_SHOWN = 4;
// the source's photo change every 8 seconds
const SLIDE_MS = 8000;
const RAILWAY = 'RLWYSTN';
// a pass service isn't bookable here (as the source's)
const PASS = /pass/i;

let count = 0;

/**
 * Text from an API value, trimmed ('' for anything that isn't text).
 * @param {*} value
 * @returns {string}
 */
function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * A product's price as the source shows it: the price before a discount and the price, in the
 * adult rate's currency. A discount shows only when it's above 0 and differs from the base.
 * @param {Object} item
 * @param {string} fallbackCurrency
 * @returns {{now: number, was: number|null, currency: string}|null} null when there's no price
 */
function readPrice(item, fallbackCurrency) {
  const price = Array.isArray(item?.prices) ? item.prices[0] : null;
  const base = Number(price?.basePrice);
  if (!price || price.basePrice === null || price.basePrice === '' || !Number.isFinite(base)) return null;
  const sale = Number(price.basePriceWithDiscount);
  const rates = Array.isArray(price.baseRate) ? price.baseRate : [];
  const adult = rates.find((r) => r?.groups === 'adult') || rates[0];
  const currency = text(adult?.currency) || fallbackCurrency;
  if (Number.isFinite(sale) && sale > 0 && Math.abs(sale - base) > 0.009) {
    return { now: sale, was: base, currency };
  }
  return { now: base, was: null, currency };
}

/**
 * A tab's name, as the source's: SHOWER, LOUNGE, else the service's name in capitals.
 * @param {string} name
 * @returns {string}
 */
function tabLabel(name) {
  if (/shower/i.test(name)) return 'SHOWER';
  if (/lounge/i.test(name)) return 'LOUNGE';
  return (name || 'Service').toUpperCase();
}

/**
 * The card's data from getbookingwidgetproducts' answer.
 * - state `card`: the lounge with its bookable products (pass services left out), grouped by
 *   service (the answer's itemGroups; else by serviceCode, the shower last, as the source's)
 * - state `unavailable`: the lounge has online booking off (isTecoEnabled false): no products
 * - state `none`: no answer, an error, nothing bookable (e.g. productApiError DCPE060/061), or no
 *   lounge name
 * @param {Object} json
 * @returns {Object}
 */
export function readCard(json) {
  const none = { state: 'none', error: json?.productApiError || null };
  if (!json || typeof json !== 'object' || String(json.statusCode) !== '200') return none;
  const items = Array.isArray(json.items) ? json.items : [];
  const fromItems = items[0]?.locations?.[0]?.properties?.[0]?.name;
  const name = text(json.propertyDisplayName) || text(fromItems).replace(/\s*\([^)]*\)\s*$/, '');
  if (!name) return none;
  const currency = text(json.propertyCurrencyCode) || text(json.defaultCurrency);
  const toItem = (item) => ({
    code: text(item?.productCode),
    name: text(item?.productDisplayName) || text(item?.productName) || text(item?.productCode),
    service: text(item?.serviceCode),
    serviceName: text(item?.serviceDisplayName) || text(item?.serviceName),
    images: (Array.isArray(item?.images) ? item.images : [])
      .map((i) => toUrl(i?.path))
      .filter(Boolean),
    price: readPrice(item, currency),
    available: item?.availability !== false,
    catalogueCode: text(item?.prices?.[0]?.catalogueCode),
  });
  const bookable = (item) => item.code && item.name && !PASS.test(`${item.serviceName} ${item.service}`);
  const card = {
    name,
    // (locationDisplayName: the test system's locationName can name another airport)
    place: [json.shortLocation, json.locationDisplayName || json.locationName]
      .map(text)
      .filter(Boolean)
      .join(', '),
    propertyCode: text(json.propertyCode),
    total: Number.parseInt(json.loungePropertyCount, 10) || 0,
    images: (Array.isArray(json.images) ? json.images : [])
      .map((i) => toUrl(i?.path))
      .filter(Boolean),
    features: (Array.isArray(json.features) ? json.features : [])
      .map((f) => text(typeof f === 'string' ? f : f?.name))
      .filter(Boolean),
  };
  if (json.isTecoEnabled === false) return { ...card, state: 'unavailable', groups: [] };

  const products = items.map(toItem).filter(bookable);
  if (!products.length) return none;
  // the answer's groups when it has them (their order), else grouped here
  let groups = (Array.isArray(json.itemGroups) ? json.itemGroups : [])
    .map((g) => ({
      name: text(g?.serviceDisplayName),
      items: (Array.isArray(g?.items) ? g.items : []).map(toItem).filter(bookable),
    }))
    .filter((g) => g.items.length);
  const services = new Set(products.map((p) => p.service));
  if (!groups.length || (groups.length === 1 && services.size > 1)) {
    groups = [...services]
      .map((service) => {
        const groupItems = products.filter((p) => p.service === service);
        return { name: groupItems[0].serviceName, items: groupItems, key: service.toLowerCase() };
      })
      .sort((a, b) => Number(/shower/i.test(a.name)) - Number(/shower/i.test(b.name))
        || a.key.localeCompare(b.key));
  }
  return { ...card, state: 'card', groups };
}

/**
 * A price as the source shows it: "HKD 585.00".
 * @param {number} amount
 * @param {string} currency
 * @returns {string}
 */
function formatPrice(amount, currency) {
  return `${currency ? `${currency} ` : ''}${amount.toFixed(2)}`;
}

/**
 * The loading card (the source's skeleton), with the loading message for screen readers.
 * @returns {HTMLElement}
 */
function buildSkeleton() {
  const card = el('div', 'booking-widget-card booking-widget-card-skeleton');
  card.setAttribute('aria-hidden', 'true');
  const content = el('div', 'booking-widget-card-content');
  ['title', 'line', 'select', 'tags', 'price'].forEach((kind) => content.append(el('span', `booking-widget-skeleton booking-widget-skeleton-${kind}`)));
  card.append(el('div', 'booking-widget-card-media booking-widget-skeleton'), content);
  return card;
}

/**
 * Places the other features' tooltip as the source's Popper: above "+ N MORE", else below it when
 * there's more room there than above (under the fixed header), and moved sideways to stay in the
 * window.
 * @param {HTMLElement} wrap
 * @param {HTMLElement} tip
 */
function placeTip(wrap, tip) {
  wrap.classList.remove('is-below');
  tip.style.removeProperty('--booking-widget-card-tip-shift');
  tip.style.display = 'block';
  const more = wrap.getBoundingClientRect();
  const box = tip.getBoundingClientRect();
  const gap = more.top - box.bottom;
  const above = box.top - (document.querySelector('header .header-bar')?.offsetHeight || 0);
  const below = window.innerHeight - (more.bottom + gap + box.height);
  if (above < 0 && below > above) wrap.classList.add('is-below');
  const right = document.documentElement.clientWidth - gap;
  const shift = Math.max(gap - box.left, 0) - Math.max(box.right - right, 0);
  if (shift) tip.style.setProperty('--booking-widget-card-tip-shift', `${shift}px`);
  tip.style.removeProperty('display');
}

/**
 * The features: the first four as pills, then "+ N MORE" with the others in a tooltip (on
 * hover, focus or a tap), as the source's.
 * @param {HTMLElement} host
 * @param {string[]} features
 * @param {string} id
 */
function renderFeatures(host, features, id) {
  host.replaceChildren(...features.slice(0, FEATURES_SHOWN).map((f) => el('span', 'booking-widget-card-feature', f)));
  host.hidden = !features.length;
  const rest = features.slice(FEATURES_SHOWN);
  if (!rest.length) return;
  const more = el('button', 'booking-widget-card-feature booking-widget-card-feature-more', translate('bookingFeaturesMore', { n: rest.length }));
  more.type = 'button';
  more.setAttribute('aria-expanded', 'false');
  more.setAttribute('aria-describedby', `${id}-features`);
  const tip = el('span', 'booking-widget-card-tip');
  tip.id = `${id}-features`;
  tip.setAttribute('role', 'tooltip');
  const list = el('ul');
  list.append(...rest.map((f) => el('li', '', f)));
  tip.append(el('span', 'booking-widget-card-tip-title', translate('bookingOtherFeatures')), list);
  const wrap = el('span', 'booking-widget-card-more-wrap');
  ['pointerenter', 'focus'].forEach((type) => more.addEventListener(type, () => placeTip(wrap, tip)));
  more.addEventListener('click', () => {
    placeTip(wrap, tip);
    more.setAttribute('aria-expanded', String(more.getAttribute('aria-expanded') !== 'true'));
  });
  more.addEventListener('keydown', (e) => { if (e.key === 'Escape') more.setAttribute('aria-expanded', 'false'); });
  more.addEventListener('blur', () => more.setAttribute('aria-expanded', 'false'));
  wrap.append(more, tip);
  host.append(wrap);
}

/**
 * The photos: the shared slider (dots, swipe), changing every 8 seconds as the source's, except
 * while the pointer or the focus is on it, the page is hidden, or motion is reduced.
 * @param {string[]} images
 * @param {string} name
 * @param {string} place
 * @returns {HTMLElement}
 */
function buildPhotos(images, name, place) {
  if (!images.length) return el('div', 'booking-widget-card-slider is-empty');
  const slider = buildSlider({ images: images.map((src) => ({ src })), name, line: place }, false, 'booking-widget-card-slider');
  const next = slider.querySelector('.booking-widget-card-slider-next');
  if (!next || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return slider;
  let paused = false;
  ['pointerenter', 'focusin'].forEach((type) => slider.addEventListener(type, () => { paused = true; }));
  slider.addEventListener('pointerleave', () => { paused = false; });
  slider.addEventListener('focusout', (e) => { if (!slider.contains(e.relatedTarget)) paused = false; });
  const timer = setInterval(() => {
    if (!slider.isConnected) {
      clearInterval(timer);
      return;
    }
    if (!paused && !document.hidden) next.click();
  }, SLIDE_MS);
  return slider;
}

/**
 * The lounge card, as the source's: photos (the chosen product's, else the lounge's), the name
 * and location line, the service tabs (two or more), the product, its "Filling Up" status, the
 * features, the price, Book Now and More at {airport}. With online booking off: the lounge, its
 * features and a disabled "Currently Unavailable" instead of the product and Book Now.
 * @param {Object} data See readCard
 * @param {Object} choice The widget's choices (airport, url, …)
 * @param {string} id
 * @returns {HTMLElement}
 */
function buildCard(data, choice, id) {
  const card = el('article', 'booking-widget-card');
  const titleId = `${id}-title`;
  card.setAttribute('aria-labelledby', titleId);
  const media = el('div', 'booking-widget-card-media');
  const setPhotos = (images) => media.replaceChildren(buildPhotos(images, data.name, data.place));

  const content = el('div', 'booking-widget-card-content');
  const header = el('div', 'booking-widget-card-header');
  const title = el('h2', 'booking-widget-card-title', data.name);
  title.id = titleId;
  const place = el('p', 'booking-widget-card-place', data.place);
  place.hidden = !data.place;
  header.append(title, place);

  const features = el('div', 'booking-widget-card-features');
  renderFeatures(features, data.features, id);
  const left = el('div', 'booking-widget-card-offer');
  const actions = el('div', 'booking-widget-card-actions');
  const more = el('a', 'booking-widget-card-more', translate('bookingMoreAt', { place: choice.airport }));
  more.href = choice.url;
  const main = el('div', 'booking-widget-card-main');
  main.append(left, actions);
  card.append(media, content);

  if (data.state === 'unavailable') {
    card.classList.add('is-unavailable');
    left.append(features);
    const off = el('button', 'booking-widget-card-unavailable', translate('bookingUnavailable'));
    off.type = 'button';
    off.disabled = true;
    actions.append(off, more);
    content.append(header, main);
    setPhotos(data.images);
    return card;
  }

  // the services as tabs when there are two or more (LOUNGE, SHOWER, …), as the source's
  const tabs = el('div', 'booking-widget-card-tabs');
  tabs.setAttribute('role', 'tablist');
  tabs.hidden = data.groups.length < 2;
  const select = el('select', 'booking-widget-card-product');
  select.id = `${id}-product`;
  const selectLabel = el('label', 'booking-widget-card-product-label', translate('bookingProduct'));
  selectLabel.htmlFor = select.id;
  const status = el('span', 'booking-widget-card-status', translate('bookingFillingUp'));
  status.hidden = true;
  const choiceRow = el('div', 'booking-widget-card-choice');
  choiceRow.append(selectLabel, select, status);
  const price = el('p', 'booking-widget-card-price');
  const was = el('s', 'booking-widget-card-price-was');
  const now = el('span', 'booking-widget-card-price-now');
  price.append(was, now);
  left.append(choiceRow, features, price);
  // Book Now: the booking step comes later; the choice is announced meanwhile
  const book = el('button', 'booking-widget-card-book', translate('bookingBookNow'));
  book.type = 'button';
  actions.append(book, more);
  content.append(header, tabs, main);

  let group = data.groups[0];
  const product = () => group.items.find((p) => p.code === select.value) || group.items[0];
  /** Shows the chosen product: its price, its status and its photos (else the lounge's). */
  const showProduct = () => {
    const p = product();
    was.textContent = p.price?.was ? formatPrice(p.price.was, p.price.currency) : '';
    was.hidden = !p.price?.was;
    // (no price: the source's dash)
    now.textContent = p.price ? formatPrice(p.price.now, p.price.currency) : '—';
    status.hidden = p.available;
    setPhotos(p.images.length ? p.images : data.images);
  };
  const showGroup = (g) => {
    group = g;
    select.replaceChildren(...g.items.map((p) => Object.assign(el('option', '', p.name), { value: p.code })));
    [...tabs.children].forEach((tab, i) => tab.setAttribute('aria-selected', String(data.groups[i] === g)));
    showProduct();
  };
  if (data.groups.length > 1) {
    tabs.append(...data.groups.map((g) => {
      const tab = el('button', 'booking-widget-card-tab', tabLabel(g.name));
      tab.type = 'button';
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', select.id);
      tab.addEventListener('click', () => showGroup(g));
      return tab;
    }));
  }
  select.addEventListener('change', showProduct);
  book.addEventListener('click', () => {
    const p = product();
    card.dispatchEvent(new CustomEvent('booking-widget:book', {
      bubbles: true,
      detail: {
        ...choice,
        propertyCode: data.propertyCode,
        serviceCode: p.service,
        productCode: p.code,
        catalogueCode: p.catalogueCode,
      },
    }));
  });
  showGroup(group);
  return card;
}

/**
 * Adds the lounge card: in its host's place for it (`data-booking-products` inside an element
 * marked `data-booking-products-host`, e.g. the hero's), else after the widget's place.
 * @param {Element} block The Booking Widget
 * @param {{current: Function}} widget The widget's current choices
 */
export default function decorateLoungeCard(block, { current }) {
  count += 1;
  const id = `booking-widget-card-${count}`;
  const section = el('div', 'booking-widget-products');
  section.hidden = true;
  const list = el('div', 'booking-widget-products-list');
  list.setAttribute('role', 'region');
  list.setAttribute('aria-label', translate('bookingProducts'));
  const status = el('p', 'booking-widget-products-status');
  status.setAttribute('role', 'status');
  const moreWrap = el('div', 'booking-widget-more-properties');
  const moreLink = el('a', 'booking-widget-more-properties-link');
  moreWrap.append(moreLink);
  moreWrap.hidden = true;
  section.append(status, list, moreWrap);
  // the place its host gives it (the hero's, after the photo card), else after the widget's place
  const slot = block.closest('[data-booking-products-host]')?.querySelector('[data-booking-products]');
  (slot || block.closest('.booking-widget-wrapper')?.parentElement || block.parentElement).append(section);

  /**
   * The button to the airport's lounges: "View more properties in …" under a card (when the
   * airport has two or more lounges), "View all properties in …" instead of one.
   * @param {Object} choice
   * @param {'more'|'all'|false} kind
   */
  const setMore = (choice, kind) => {
    moreWrap.hidden = !kind;
    if (!kind) return;
    moreLink.href = choice.url;
    moreLink.textContent = translate(kind === 'more' ? 'bookingMoreProperties' : 'bookingAllProperties', { place: choice.location.label });
  };

  // the lounge shown, so a new date, time or guests keep it (as the source's)
  let shown = null;
  let generation = 0;
  /** Shows the airport's featured lounge for the widget's choices. */
  const show = async () => {
    const choice = current();
    generation += 1;
    const asked = generation;
    if (!choice) return;
    const stale = () => asked !== generation;
    section.hidden = false;
    section.classList.remove('has-card');
    setMore(choice, false);
    const fallback = () => {
      shown = null;
      list.replaceChildren();
      setMore(choice, 'all');
    };
    // (railway stations get no lounge card)
    if (choice.location.type === RAILWAY) {
      fallback();
      return;
    }
    section.setAttribute('aria-busy', 'true');
    status.textContent = translate('propertyLoading');
    list.replaceChildren(buildSkeleton());
    const body = {
      selectedAirport: choice.airport,
      selectedDate: choice.date,
      selectedTime: choice.time,
      adult: Number.parseInt(choice.adult, 10) || 1,
      children: Number.parseInt(choice.children, 10) || 0,
      promocode: '',
      // (a lounge of another airport is unknown there: the service answers 404)
      propertyCode: shown?.airport === choice.airport ? shown.code : '',
      languageCode: getApiLanguage(),
    };
    try {
      const data = readCard(await fetchJson(apiUrl('bookingWidgetProducts'), PRODUCTS_TIMEOUT_MS, { body }));
      if (stale()) return;
      if (data.state === 'none') {
        // eslint-disable-next-line no-console
        if (data.error) console.info('booking-widget: no bookable products', data.error.errorCode, data.error.message);
        fallback();
        return;
      }
      shown = { airport: choice.airport, code: data.propertyCode };
      list.replaceChildren(buildCard(data, choice, id));
      section.classList.add('has-card');
      setMore(choice, data.total > 1 ? 'more' : false);
    } catch (error) {
      if (stale()) return;
      // eslint-disable-next-line no-console
      console.error('booking-widget: could not load the lounge', error);
      fallback();
    } finally {
      if (!stale()) {
        section.removeAttribute('aria-busy');
        status.textContent = '';
      }
    }
  };

  block.addEventListener('booking-widget:change', show);
  // a location chosen before this loaded (e.g. by a script)
  if (current()) show();
}
