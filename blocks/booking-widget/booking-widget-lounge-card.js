/*
 * The homepage hero's lounge card (Booking Widget option lounge-card), as the source's
 * #booking-widget-products-section: when the visitor chooses an airport (or its date, time or
 * guests change), the first bookable lounge there with its services and products; else a button
 * to all the airport's lounges.
 *
 * - The airport's lounges: the booking system's GetAllProperties (?iataCode=), in the page
 *   language. A lounge is bookable when it's a LOUNGE with online booking on (isTecoEnabled, not a
 *   redirection) at an airport (not a railway station), in the answer's order.
 * - Its services: service-list for the chosen start; the first lounge with bookable products
 *   (not a pass service) is shown, trying up to three.
 * - Its details: the products service (name, location line, photos, features, prices); the card
 *   doesn't wait for them, and does without them.
 */
import apiUrl from '../../scripts/endpoints.js';
import { getCurrency } from '../../scripts/currency.js';
import { translate } from '../../scripts/i18n.js';
import { toStartDateTime } from '../../scripts/booking.js';
import {
  buildSlider, el, fetchJson, getApiLanguage, toUrl,
} from '../../scripts/properties.js';

// the services answer in about 2-4s, the lounges in 0.1-1.5s
const PROPERTIES_TIMEOUT_MS = 10000;
const SERVICES_TIMEOUT_MS = 20000;
const PRODUCTS_TIMEOUT_MS = 20000;
// how many bookable lounges are asked for their services before giving up
const MAX_LOUNGES = 3;
// the source shows four features, then "+ N MORE"
const FEATURES_SHOWN = 4;
// the source's photo change every 8 seconds
const SLIDE_MS = 8000;
const RAILWAY = 'RLWYSTN';
const PASS = /pass/i;

const airports = new Map();
let count = 0;

/**
 * An airport's location and lounges (once per page and language; a failure is forgotten).
 * @param {string} iata
 * @returns {Promise<{location: Object, lounges: Object[], total: number}>}
 */
function loadAirport(iata) {
  const key = `${iata}|${getApiLanguage()}`;
  if (!airports.has(key)) {
    const url = apiUrl('bookingProperties');
    url.searchParams.set('iataCode', iata);
    url.searchParams.set('languageCode', getApiLanguage());
    airports.set(key, fetchJson(url, PROPERTIES_TIMEOUT_MS).then((json) => {
      const items = Array.isArray(json?.items) ? json.items : [];
      const location = items.find((item) => item?.iataCode === iata) || null;
      const properties = Array.isArray(location?.properties) ? location.properties : [];
      const all = properties.filter((p) => p?.propertyCode && p.propertyTypeCode === 'LOUNGE');
      const bookable = location && location.locationTypeCode !== RAILWAY
        ? all.filter((p) => p.isTecoEnabled !== false && !p.isRedirection) : [];
      return { location, lounges: bookable, total: all.length };
    }).catch((error) => {
      airports.delete(key);
      throw error;
    }));
  }
  return airports.get(key);
}

/**
 * A lounge's bookable services for a start: services with products, not a pass service, the
 * shower last (as the source's tabs), each with its products in the answer's order.
 * @param {Object} json service-list's answer
 * @returns {{code: string, name: string, type: string, image: string,
 *   products: {code: string, name: string}[]}[]}
 */
function readServices(json) {
  const items = Array.isArray(json?.items) ? json.items : [];
  return items
    .map((s) => ({
      code: String(s?.serviceCode || ''),
      name: String(s?.serviceDisplayName || s?.serviceName || '').trim(),
      type: String(s?.serviceType || '').trim(),
      image: toUrl(s?.images?.path) || '',
      products: (Array.isArray(s?.availableProducts) ? s.availableProducts : [])
        .map((p) => ({ code: String(p?.productCode || ''), name: String(p?.displayName || '').trim() }))
        .filter((p) => p.code && p.name),
    }))
    .filter((s) => s.code && s.products.length && !PASS.test(`${s.type} ${s.name}`))
    .sort((a, b) => Number(/shower/i.test(a.type || a.name)) - Number(/shower/i.test(b.type || b.name)));
}

/**
 * The lounge's details from the products service: name, location line, photos, features, and
 * each product's price (the price before a discount, and the price).
 * @param {Object} json
 * @param {string} code The lounge
 * @returns {Object|null}
 */
function readDetails(json, code) {
  const items = Array.isArray(json?.items) ? json.items : [];
  const location = items.flatMap((i) => i?.locations || [])
    .find((l) => (l?.properties || []).some((p) => p?.code === code));
  const property = location?.properties.find((p) => p.code === code);
  if (!property) return null;
  const prices = new Map();
  items.forEach((item) => {
    const price = item?.prices?.[0];
    const base = Number(price?.basePrice);
    const sale = Number(price?.basePriceWithDiscount);
    const rates = Array.isArray(price?.baseRate) ? price.baseRate : [];
    const currency = (rates.find((r) => r?.groups === 'adult') || rates[0])?.currency || '';
    // (the test system answers 0 for unpriced products: those show no price)
    if (item?.productCode && Number.isFinite(base) && base > 0) {
      const now = Number.isFinite(sale) && sale > 0 ? sale : base;
      const was = Math.abs(base - now) > 0.009 ? base : null;
      prices.set(item.productCode, { now, was, currency });
    }
  });
  const images = (Array.isArray(property.images) ? property.images : [])
    .slice()
    .sort((a, b) => (Number(a?.sequence) || 0) - (Number(b?.sequence) || 0))
    .map((image) => toUrl(image?.path))
    .filter(Boolean);
  // the products' own photos (the source's card shows these), each once
  const productImages = [...new Set(items
    .flatMap((item) => (item?.images || []).map((image) => toUrl(image?.path))))]
    .filter(Boolean);
  return {
    name: String(property.propertyDisplayName || '').trim(),
    place: [property.shortLocation, location.locationName].map((t) => String(t || '').trim()).filter(Boolean).join(', '),
    images,
    productImages,
    features: (Array.isArray(property.featureList) ? property.featureList : [])
      .map((f) => String(typeof f === 'string' ? f : f?.name || '').trim())
      .filter(Boolean),
    prices,
  };
}

/**
 * The name and location line from the lounges' list, until the details arrive: "Plaza Premium
 * Lounge (Near Gate 1, Departures)" at Hong Kong International Airport → the name, and
 * "Near Gate 1, Departures, Hong Kong International Airport".
 * @param {Object} lounge
 * @param {Object} location
 * @returns {{name: string, place: string}}
 */
function readName(lounge, location) {
  const full = String(lounge.propertyName || '').trim();
  const match = full.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  const name = (match ? match[1] : full).trim();
  const place = [match?.[2], location?.name].map((t) => String(t || '').trim()).filter(Boolean).join(', ');
  return { name, place };
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
  more.addEventListener('click', () => more.setAttribute('aria-expanded', String(more.getAttribute('aria-expanded') !== 'true')));
  more.addEventListener('keydown', (e) => { if (e.key === 'Escape') more.setAttribute('aria-expanded', 'false'); });
  more.addEventListener('blur', () => more.setAttribute('aria-expanded', 'false'));
  const wrap = el('span', 'booking-widget-card-more-wrap');
  wrap.append(more, tip);
  host.append(wrap);
}

/**
 * Whether a photo loads (a browser refuses some, e.g. ones the image host sends as
 * application/octet-stream).
 * @param {string} src
 * @returns {Promise<boolean>}
 */
function loads(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > 0);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

/**
 * The first set of photos that loads, in order (the lounge's, the products', the service's),
 * from its first photo that loads (up to the second, so a refused set costs at most two
 * downloads); [] when none does.
 * @param {string[][]} sets
 * @returns {Promise<string[]>}
 */
async function firstLoading(sets) {
  const [set, ...rest] = sets.filter((x) => x.length);
  if (!set) return [];
  if (await loads(set[0])) return set;
  if (set.length > 1 && await loads(set[1])) return set.slice(1);
  return firstLoading(rest);
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
 * The lounge card: photos, the name and location line, the service tabs (two or more services),
 * the product, the features, the price, Book Now and More at {airport}.
 * @param {Object} lounge
 * @param {Object[]} services
 * @param {Object} location
 * @param {Object} choice The widget's choices (airport, url, …)
 * @param {string} id
 * @returns {{card: HTMLElement, setDetails: Function}}
 */
function buildCard(lounge, services, location, choice, id) {
  const card = el('article', 'booking-widget-card');
  const titleId = `${id}-title`;
  card.setAttribute('aria-labelledby', titleId);
  const named = readName(lounge, location);
  const media = el('div', 'booking-widget-card-media');
  const setPhotos = (images, name, place) => {
    media.replaceChildren(images.length ? buildPhotos(images, name, place) : el('div', 'booking-widget-card-slider is-empty'));
  };
  const serviceImages = services.map((s) => s.image).filter(Boolean).slice(0, 1);
  let photoSets = [serviceImages];
  let photoTurn = 0;
  /** Shows the first set of photos that loads (a later call wins over an earlier one). */
  const choosePhotos = async () => {
    photoTurn += 1;
    const turn = photoTurn;
    const images = await firstLoading(photoSets);
    // (the name and location line as shown when the photos are ready)
    const text = (sel) => card.querySelector(sel)?.textContent || '';
    if (turn === photoTurn) setPhotos(images, text('.booking-widget-card-title'), text('.booking-widget-card-place'));
  };

  const content = el('div', 'booking-widget-card-content');
  const header = el('div', 'booking-widget-card-header');
  const title = el('h2', 'booking-widget-card-title', named.name);
  title.id = titleId;
  const place = el('p', 'booking-widget-card-place', named.place);
  place.hidden = !named.place;
  header.append(title, place);

  // the services as tabs when there are two or more (LOUNGE, SHOWER, …), as the source's
  const tabs = el('div', 'booking-widget-card-tabs');
  tabs.setAttribute('role', 'tablist');
  tabs.hidden = services.length < 2;
  const select = el('select', 'booking-widget-card-product');
  select.id = `${id}-product`;
  const selectLabel = el('label', 'booking-widget-card-product-label', translate('bookingProduct'));
  selectLabel.htmlFor = select.id;
  const choiceRow = el('div', 'booking-widget-card-choice');
  choiceRow.append(selectLabel, select);
  const features = el('div', 'booking-widget-card-features');
  features.hidden = true;
  const price = el('p', 'booking-widget-card-price');
  const was = el('s', 'booking-widget-card-price-was');
  const now = el('span', 'booking-widget-card-price-now');
  price.append(was, now);

  const actions = el('div', 'booking-widget-card-actions');
  // Book Now: the booking step comes later; the choice is announced meanwhile
  const book = el('button', 'booking-widget-card-book', translate('bookingBookNow'));
  book.type = 'button';
  const more = el('a', 'booking-widget-card-more', translate('bookingMoreAt', { place: choice.airport }));
  more.href = choice.url;
  actions.append(book, more);

  const main = el('div', 'booking-widget-card-main');
  const left = el('div', 'booking-widget-card-offer');
  left.append(choiceRow, features, price);
  main.append(left, actions);
  content.append(header, tabs, main);
  card.append(media, content);

  let details = null;
  let service = services[0];
  const showPrice = () => {
    const amount = details?.prices.get(select.value);
    was.textContent = amount?.was ? formatPrice(amount.was, amount.currency) : '';
    was.hidden = !amount?.was;
    // (no price: the source's dash)
    now.textContent = amount ? formatPrice(amount.now, amount.currency) : '—';
  };
  const showService = (s) => {
    service = s;
    select.replaceChildren(...s.products.map((p) => Object.assign(el('option', '', p.name), { value: p.code })));
    [...tabs.children].forEach((tab) => tab.setAttribute('aria-selected', String(tab.dataset.service === s.code)));
    showPrice();
  };
  if (services.length > 1) {
    tabs.append(...services.map((s) => {
      const label = /shower/i.test(s.type || s.name) ? 'shower' : s.name || s.type;
      const tab = el('button', 'booking-widget-card-tab', label.toUpperCase());
      tab.type = 'button';
      tab.dataset.service = s.code;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', select.id);
      tab.addEventListener('click', () => showService(s));
      return tab;
    }));
  }
  select.addEventListener('change', showPrice);
  book.addEventListener('click', () => {
    card.dispatchEvent(new CustomEvent('booking-widget:book', {
      bubbles: true,
      detail: {
        ...choice,
        propertyCode: lounge.propertyCode,
        serviceCode: service.code,
        productCode: select.value,
      },
    }));
  });
  showService(services[0]);
  choosePhotos();

  /**
   * Fills in the lounge's details (name, location line, photos, features, prices).
   * @param {Object|null} d
   */
  const setDetails = (d) => {
    if (!d) return;
    details = d;
    if (d.name) title.textContent = d.name;
    if (d.place) {
      place.textContent = d.place;
      place.hidden = false;
    }
    photoSets = [d.images, d.productImages, serviceImages];
    choosePhotos();
    renderFeatures(features, d.features, id);
    showPrice();
  };
  return { card, setDetails };
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

  let generation = 0;
  /** Shows the first bookable lounge for the widget's choices. */
  const show = async () => {
    const choice = current();
    generation += 1;
    const asked = generation;
    if (!choice) return;
    const stale = () => asked !== generation;
    section.hidden = false;
    section.classList.remove('has-card');
    section.setAttribute('aria-busy', 'true');
    status.textContent = translate('propertyLoading');
    list.replaceChildren(buildSkeleton());
    setMore(choice, false);
    const fallback = () => {
      list.replaceChildren();
      setMore(choice, 'all');
    };
    try {
      const { location, lounges, total } = await loadAirport(choice.airport);
      if (stale()) return;
      const start = toStartDateTime(choice.date, choice.time);
      const currency = getCurrency();
      /**
       * Asks the bookable lounges for their services in turn (the next only when one has nothing
       * bookable), up to MAX_LOUNGES.
       * @param {number} i
       * @returns {Promise<Object|null>} the lounge with its services and details, or null
       */
      const tryLounge = async (i) => {
        const lounge = lounges[i];
        if (!lounge || i >= MAX_LOUNGES || stale()) return null;
        const body = {
          propertyCode: lounge.propertyCode,
          locationCode: '',
          iataCode: choice.airport,
          currencyCode: currency,
          startDateTime: start,
          journeyTypeCode: '',
          terminalTypeCode: '',
        };
        // the details come with the services request, so the card doesn't wait for them later
        const detailsBody = {
          propertyCode: lounge.propertyCode,
          iataCode: choice.airport,
          currencyCode: currency,
          startDateTime: start,
          guests: { adult: Number(choice.adult) || 1, child: Number(choice.children) || 0 },
        };
        const details = fetchJson(apiUrl('bookingProducts'), PRODUCTS_TIMEOUT_MS, { body: detailsBody })
          .then((json) => readDetails(json, lounge.propertyCode))
          .catch(() => null);
        const services = await fetchJson(apiUrl('bookingServices'), SERVICES_TIMEOUT_MS, { body })
          .then(readServices)
          .catch(() => []);
        return services.length ? { lounge, services, details } : tryLounge(i + 1);
      };
      const found = await tryLounge(0);
      if (stale()) return;
      if (!found) {
        fallback();
        return;
      }
      const { card, setDetails } = buildCard(found.lounge, found.services, location, choice, id);
      list.replaceChildren(card);
      section.classList.add('has-card');
      setMore(choice, total > 1 ? 'more' : false);
      found.details.then((d) => { if (!stale()) setDetails(d); });
    } catch (error) {
      if (stale()) return;
      // eslint-disable-next-line no-console
      console.error('booking-widget: could not load the lounges', error);
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
