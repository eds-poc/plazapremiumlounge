/*
 * Lounge (property) helpers shared by the property-list and property-detail blocks: reading the
 * properties API records, the API language, safe API HTML, the page loader, the photo slider and
 * the journey badge. Block-specific rendering stays in each block.
 */
import { getMetadata } from './aem.js';
import { applyButtonAction } from './button-actions.js';
import apiUrl from './endpoints.js';
import { DEFAULT_SITE, getSiteFolder, translate } from './i18n.js';
import { hideLoader, showLoader } from './scripts.js';

// property types shown, as the source pages: lounges, and passes (gift cards)
export const LOUNGE = 'LOUNGE';
export const PASS = 'GFTCRD';
const SWIPE_PX = 40;
// the API's language code by site folder; other folders are sent as they are (zh-cn, pt-br …)
const API_LANGUAGES = { 'en-uk': 'en' };
// "Plaza Premium First" as the API names it in each language (compared without spaces)
const FIRST_BRANDS = ['plazapremiumfirst', '环亚优逸庭', '環亞優逸庭', 'プラザプレミアムファースト'];

let loading = 0;

/**
 * Creates an element with an optional class name and text.
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 * @returns {HTMLElement}
 */
export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/**
 * Whether the page is shown on the preview site (or locally), where authors get setup hints.
 * @returns {boolean}
 */
export function isPreview() {
  const { hostname } = window.location;
  return hostname.endsWith('.aem.page') || hostname === 'localhost';
}

/**
 * Shows the site's full-page loader (the same as on page load) while any property block on the
 * page is loading, and hides it once the last one is done.
 * @param {boolean} busy
 */
export function setLoading(busy) {
  loading = Math.max(0, loading + (busy ? 1 : -1));
  if (loading) showLoader();
  else hideLoader();
}

/**
 * Fetches JSON, giving up after `timeout` ms. With `body`, it's a POST of that object as JSON. A
 * `signal` cancels it early (e.g. a newer request replaces it). Rejects with an Error carrying
 * `status` (HTTP status, 0 for a network failure, the timeout or a cancel); an answer that isn't
 * JSON, or a 200 with the service's error object (`{ errorCode, message }`, or nested as
 * `{ error: { errorCode, message, details } }`, kept as the Error's `service`), is a failure too.
 * @param {string} url
 * @param {number} timeout
 * @param {{body?: Object, signal?: AbortSignal}} [options]
 * @returns {Promise<Object>}
 */
export async function fetchJson(url, timeout, { body, signal } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  signal?.addEventListener('abort', () => controller.abort(), { once: true });
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      ...(body && {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    });
    if (!resp.ok) throw Object.assign(new Error(`HTTP ${resp.status}`), { status: resp.status });
    const json = await resp.json();
    const failure = json?.errorCode ? json : json?.error && typeof json.error === 'object' && json.error;
    if (failure) {
      throw Object.assign(new Error(`${failure.errorCode || 'error'}: ${failure.message || ''}`), { status: resp.status, service: failure });
    }
    return json;
  } catch (error) {
    if (error.status === undefined) error.status = 0;
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A stable filter key for a value: lower case, words joined by dashes.
 * @param {string} value
 * @returns {string}
 */
export function toKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '');
}

/**
 * An absolute URL for an API image or link (spaces encoded; the source's `~/` site prefix fixed),
 * or '' if it isn't valid.
 * @param {string} value
 * @returns {string}
 */
export function toUrl(value) {
  if (!value || typeof value !== 'string') return '';
  try {
    return new URL(value.trim().replace(/^~\//, '/'), window.location.href).href;
  } catch {
    return '';
  }
}

/**
 * API HTML as safe content. Inline only (the default): text, line breaks and links. With
 * `blocks`, also paragraphs, lists and bold/italic; headings are dropped (the source shows its own
 * section titles instead), as are styles, fonts and every other element (their text is kept).
 * @param {string} html
 * @param {{blocks?: boolean}} [options]
 * @returns {DocumentFragment}
 */
export function safeHtml(html, { blocks = false } = {}) {
  const out = document.createDocumentFragment();
  const source = new DOMParser().parseFromString(html || '', 'text/html').body;
  const KEEP = blocks ? ['P', 'UL', 'OL', 'LI', 'STRONG', 'B', 'EM', 'I'] : [];
  const copy = (node, into) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) into.append(child.textContent);
      else if (child.nodeName === 'BR') into.append(el('br'));
      else if (child.nodeName === 'A' && toUrl(child.getAttribute('href'))) {
        const link = el('a');
        link.href = toUrl(child.getAttribute('href'));
        copy(child, link);
        into.append(applyButtonAction(link));
      } else if (blocks && /^H[1-6]$/.test(child.nodeName)) {
        // dropped: the source hides the description's own title
      } else if (KEEP.includes(child.nodeName)) {
        const kept = el(child.nodeName.toLowerCase());
        copy(child, kept);
        if (kept.textContent.trim() || kept.querySelector('a')) into.append(kept);
      } else if (child.nodeType === Node.ELEMENT_NODE) copy(child, into);
    });
  };
  copy(source, out);
  return out;
}

/**
 * The API's note (HTML) as safe content: its text, line breaks and links only.
 * @param {string} html
 * @returns {DocumentFragment}
 */
export function safeNote(html) {
  return safeHtml(html);
}

/**
 * Whether a property name starts with the Plaza Premium First brand, in any site language.
 * @param {string} name
 * @returns {boolean}
 */
export function isFirstBrand(name) {
  const compact = name.replace(/\s+/g, '').toLowerCase();
  return FIRST_BRANDS.some((brand) => compact.startsWith(brand));
}

// the passes blocks' own rows for the codes the passes API asks for (the key's case, spaces and
// dashes don't matter: "propertycode", "Property Code", "iata-code" …)
const API_ROWS = { propertycode: 'propertyCode', iatacode: 'iataCode' };
const API_ROW_NAMES = { propertyCode: 'propertycode', iataCode: 'iata-code' };
const API_ROW_EXAMPLES = { propertyCode: 'PRPRTY1235', iataCode: 'HKG' };

/**
 * A block row holding one of the passes API's codes (`propertycode | PRPRTY1235`,
 * `iata-code | HKG`): which code and its value, or null for any other row.
 * @param {Element} row
 * @returns {{name: string, value: string}|null}
 */
export function readApiRow(row) {
  const [first, second] = row.children;
  const name = API_ROWS[toKey(first?.textContent).replace(/-/g, '')];
  return name ? { name, value: (second?.textContent || '').trim() } : null;
}

/**
 * The property and airport (IATA) codes the passes API asks for, as the block authors them (see
 * readApiRow). A value that's missing or malformed (letters and digits only) isn't guessed, and
 * the page metadata isn't read: it's listed in `problems`, for the block to report on the preview
 * site.
 * @param {{propertyCode?: string, iataCode?: string}} codes
 * @returns {{propertyCode: string, iataCode: string, problems: string[]}}
 */
export function getApiContext(codes = {}) {
  const propertyCode = (codes.propertyCode || '').trim().toUpperCase();
  const iataCode = (codes.iataCode || '').trim().toUpperCase();
  const problems = Object.entries({ propertyCode, iataCode })
    .filter(([, value]) => !/^[A-Z0-9]+$/.test(value))
    .map(([name, value]) => (value
      ? `The block's "${API_ROW_NAMES[name]}" value "${value}" isn't a valid code (letters and digits only).`
      : `The block's "${API_ROW_NAMES[name]}" row is missing (e.g. "${API_ROW_NAMES[name]} | ${API_ROW_EXAMPLES[name]}").`));
  return { propertyCode, iataCode, problems };
}

// the passes service: one product code per call, or every pass when no code is given (the same
// data per pass). Each answer is asked for once per page
const passes = new Map();

/**
 * Fetches a passes service answer once per page (a failure isn't kept, so it can be asked again).
 * @param {Object<string, string>} query
 * @param {number} timeout ms
 * @returns {Promise<Object[]>} the answer's items
 */
function fetchPassItems(query, timeout) {
  const url = apiUrl('productPasses');
  Object.entries(query).forEach(([name, value]) => url.searchParams.set(name, value));
  if (!passes.has(url.href)) {
    const request = fetchJson(url.href, timeout)
      .then((json) => (Array.isArray(json?.items) ? json.items : []))
      .catch((error) => {
        passes.delete(url.href);
        throw error;
      });
    passes.set(url.href, request);
  }
  return passes.get(url.href);
}

/**
 * One pass (product) from the passes service, in a currency: its item, or null when the service
 * doesn't know the code. Rejects as fetchJson does.
 * @param {string} productCode e.g. PRD3705
 * @param {{propertyCode: string, iataCode: string}} context See getApiContext
 * @param {string} currency e.g. USD
 * @param {number} timeout ms
 * @returns {Promise<Object|null>}
 */
export function fetchPass(productCode, { propertyCode, iataCode }, currency, timeout) {
  return fetchPassItems({
    propertyCode, iataCode, currencyCode: currency, productCode,
  }, timeout).then((items) => items.find((item) => item?.productCode === productCode) || null);
}

/**
 * Every pass from the passes service, in a currency, by product code: one call (the service takes
 * one code per call, so for several passes this is quicker and lighter than a call each). The list
 * is also kept for the session (see readPassList).
 * @param {{propertyCode: string, iataCode: string}} context See getApiContext
 * @param {string} currency e.g. USD
 * @param {number} timeout ms
 * @returns {Promise<Map<string, Object>>}
 */
export function fetchPassList({ propertyCode, iataCode }, currency, timeout) {
  const query = { propertyCode, iataCode, currencyCode: currency };
  return fetchPassItems(query, timeout).then((items) => {
    const list = new Map(items.filter((item) => item?.productCode)
      .map((item) => [item.productCode, item]));
    // eslint-disable-next-line no-use-before-define
    keepPassList({ propertyCode, iataCode }, currency, list);
    return list;
  });
}

// the passes list kept for the session: a page seen again shows the passes straight away (the
// service answers in 5-7s) while a fresh list is asked for; older than this, it isn't used
const PASS_LIST_KEY = 'ppl-pass-list';
const PASS_LIST_MAX_AGE = 30 * 60 * 1000;
const passListKey = ({ propertyCode, iataCode }, currency) => `${PASS_LIST_KEY}:${propertyCode}:${iataCode}:${currency}`;

/**
 * A pass with only what the pass blocks show (an answer's pass is about 2.4KB, this about 0.4KB).
 * @param {Object} item
 * @returns {Object}
 */
function slimPass(item) {
  return {
    productCode: item.productCode,
    productDisplayName: item.productDisplayName,
    productName: item.productName,
    productSeq: item.productSeq,
    images: (item.images || []).slice(0, 1).map((image) => ({ path: image?.path })),
    numberOfVisits: item.numberOfVisits,
    accuralPoints: item.accuralPoints,
    productDescription: item.productDescription,
    eligibleLocations: item.eligibleLocations,
    prices: (item.prices || []).slice(0, 1).map((price) => ({
      totalPrice: price?.totalPrice,
      baseRate: (price?.baseRate || []).slice(0, 1).map((rate) => ({ currency: rate?.currency })),
      catalogueCode: price?.catalogueCode,
    })),
  };
}

/**
 * Keeps the passes list for the session (nothing happens when storage isn't available).
 * @param {{propertyCode: string, iataCode: string}} context
 * @param {string} currency
 * @param {Map<string, Object>} list
 */
function keepPassList(context, currency, list) {
  try {
    sessionStorage.setItem(passListKey(context, currency), JSON.stringify({
      time: Date.now(),
      items: [...list.values()].map(slimPass),
    }));
  } catch {
    // storage full or blocked: the list is just asked for again next time
  }
}

/**
 * The passes list kept for this session (see fetchPassList), when it's recent, by product code.
 * @param {{propertyCode: string, iataCode: string}} context
 * @param {string} currency
 * @returns {Map<string, Object>|null}
 */
export function readPassList(context, currency) {
  try {
    const kept = JSON.parse(sessionStorage.getItem(passListKey(context, currency)));
    const recent = Date.now() - (Number(kept?.time) || 0) < PASS_LIST_MAX_AGE;
    if (!recent || !Array.isArray(kept.items)) return null;
    return new Map(kept.items.map((item) => [item.productCode, item]));
  } catch {
    return null;
  }
}

/**
 * The API's language code for the page: the page metadata `language-code` when set, else from
 * the page's site folder (/en-uk/ → en, /zh-hk/ → zh-hk …; pages outside one use the default site).
 * @returns {string}
 */
export function getApiLanguage() {
  const authored = getMetadata('language-code').trim();
  if (authored) return authored;
  const folder = getSiteFolder() || DEFAULT_SITE;
  return API_LANGUAGES[folder] || folder;
}

/**
 * Whether a value is a real calendar date as YYYY-MM-DD (not e.g. 2026-02-30).
 * @param {string} value
 * @returns {boolean}
 */
export function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/**
 * The lounge template page for the current site folder (e.g. /en-uk/find/lounge).
 * @returns {string}
 */
export function propertyDetailPath() {
  return `/${getSiteFolder() || DEFAULT_SITE}/find/lounge`;
}

/**
 * A lounge's detail page on this site, as the source's links: the lounge page (`base`, else the
 * template page in the current site folder) with `propertycode`, and `currency`, `date` and `time`
 * when given and valid (the detail page picks the date and time itself otherwise, at the lounge's
 * own time zone). A query already on `base` is kept.
 * @param {string} code The property code
 * @param {{base?: string, currency?: string, date?: string, time?: string}} [options]
 * @returns {string} A site-relative URL, or '' without a valid property code
 */
export function propertyDetailUrl(code, {
  base, currency, date, time,
} = {}) {
  const value = (code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]+$/.test(value)) return '';
  const url = new URL(base || propertyDetailPath(), window.location.origin);
  url.searchParams.set('propertycode', value);
  const money = (currency || '').trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(money)) url.searchParams.set('currency', money);
  if (isIsoDate(date)) url.searchParams.set('date', date);
  if (/^([01]\d|2[0-3])[0-5]\d$/.test(time || '')) url.searchParams.set('time', time);
  return `${url.pathname}${url.search}`;
}

/**
 * Reads one API record (a listing item or a property detail) into what the cards, the filters and
 * the detail page need, or null for a record that isn't shown (not active, another type, or
 * without a name).
 * @param {Object} item
 * @returns {Object|null}
 */
export function readProperty(item) {
  const type = item.propertyTypeCode;
  const name = (item.propertyDisplayName || item.propertyName || '').trim();
  if (item.status !== 'Active' || ![LOUNGE, PASS].includes(type) || !name) return null;
  const descriptions = Array.isArray(item.loungeDescription) ? item.loungeDescription : [];
  const describe = (kind) => descriptions.find((d) => d.type === kind);
  const iata = (item.iataCode || '').trim();
  const locationName = (item.locationName || '').trim();
  const shortLocation = (item.shortLocation || '').trim();
  const prices = (item.availableServices || [])
    .map((s) => ({ amount: Number(s.lowestPrice), currency: s.currency }))
    .filter((p) => p.amount > 0 && p.currency);
  const slots = item.operationalHours?.[0]?.timeSlots || [];
  const journeys = (item.journeyDetails || []).map((j) => (j.journeyTypeName || '').toLowerCase());
  return {
    code: item.propertyCode,
    name,
    pass: type === PASS,
    seq: Number(item.propertySeq) || 0,
    location: {
      key: toKey(type === PASS ? '' : iata || item.locationCode),
      name: locationName,
      // airports show their 3-letter code, e.g. "Hong Kong International Airport (HKG)"
      heading: /^[A-Z]{3}$/.test(iata) && locationName ? `${locationName} (${iata})` : locationName,
      seq: Number(item.locationSeq) || 0,
    },
    line: [shortLocation, locationName].filter((part, i, all) => part && (i === 0 || !all[0].includes(part))).join(', '),
    hours: describe('OperatingHours')?.desc?.trim() || slots.map((s) => [s.from, s.to].filter(Boolean).join(' - ')).filter(Boolean).join(', '),
    promo: describe('OnlinePromo'),
    loyalty: describe('LoyaltyPoints')?.desc?.trim() || '',
    icons: (item.icons || []).map((i) => ({ src: toUrl(i.path), alt: i.iconDesc || i.name || '' })).filter((i) => i.src),
    images: (item.images || [])
      .map((image, i) => ({
        src: toUrl(image.path),
        order: Number(image.sequence) || i + 1,
        // the photo's name, the source gallery's caption
        caption: (image.name || '').trim(),
      }))
      .filter((image) => image.src)
      .sort((a, b) => a.order - b.order),
    features: (item.featureList || [])
      .map((f) => ({ key: toKey(f.nameEn || f.name), label: (f.name || f.nameEn || '').trim() }))
      .filter((f) => f.key && f.label),
    services: (item.availableServices || [])
      .map((s) => ({ key: toKey(s.servicetype), label: (s.serviceDisplayName || s.name || '').trim() }))
      .filter((s) => s.key && s.label),
    price: prices.sort((a, b) => a.amount - b.amount)[0],
    // the green Plaza Premium First look follows the brand in the name, as the source pages
    // (the API's colorCode also marks some Plaza Premium Lounges PPF)
    first: isFirstBrand(name),
    // passes aren't places, so they get no journey badge
    departure: type !== PASS && journeys.includes('departure'),
    arrival: type !== PASS && journeys.includes('arrival'),
    note: (item.note || '').trim(),
  };
}

/**
 * A photo slider: one photo at a time, previous/next, one dot per photo, swipe; loops.
 * @param {Object} property The read property (images, name, line)
 * @param {boolean} eager Load the first photo straight away
 * @param {string} [prefix] The class name prefix (`property-slider`); the block styles the slider
 * @param {{onOpen?: Function}} [options] `onOpen(index, link)`: a tap or click on a photo opens
 *   it (e.g. in a gallery); the photos are then links to their files
 * @returns {HTMLElement}
 */
export function buildSlider(property, eager, prefix = 'property-slider', { onOpen } = {}) {
  const { images, name, line } = property;
  const slider = el('div', prefix);
  if (!images.length) {
    slider.classList.add('is-empty');
    return slider;
  }
  const track = el('div', `${prefix}-track`);
  const slides = images.map((image, i) => {
    const slide = el('div', `${prefix}-slide`);
    const img = el('img');
    // photos after the first load when they're about to be shown
    if (i === 0) img.src = image.src;
    else img.dataset.src = image.src;
    img.alt = i === 0 ? [name, line].filter(Boolean).join(', ') : `${name}, ${translate('propertyPhoto', { n: i + 1, total: images.length })}`;
    img.loading = eager && i === 0 ? 'eager' : 'lazy';
    img.decoding = 'async';
    if (onOpen) {
      const link = el('a', `${prefix}-open`);
      link.href = image.src;
      link.setAttribute('aria-haspopup', 'dialog');
      link.draggable = false;
      link.append(img);
      link.addEventListener('click', (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        // eslint-disable-next-line no-use-before-define
        if (!swiped) onOpen(i, link);
      });
      slide.append(link);
    } else slide.append(img);
    track.append(slide);
    return slide;
  });
  // (the end of a swipe isn't a tap on the photo)
  let swiped = false;
  slider.append(track);
  if (slides.length < 2) return slider;

  slider.setAttribute('role', 'group');
  slider.setAttribute('aria-roledescription', 'carousel');
  slider.setAttribute('aria-label', name);
  slides.forEach((slide, i) => {
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', 'slide');
    slide.setAttribute('aria-label', translate('propertyPhoto', { n: i + 1, total: slides.length }));
  });
  const button = (className, label) => {
    const btn = el('button', className);
    btn.type = 'button';
    btn.setAttribute('aria-label', label);
    return btn;
  };
  const prev = button(`${prefix}-prev`, translate('propertyPrevious'));
  const next = button(`${prefix}-next`, translate('propertyNext'));
  const dots = el('div', `${prefix}-dots`);
  const dotButtons = slides.map((slide, i) => {
    const dot = button(`${prefix}-dot`, translate('propertyPhoto', { n: i + 1, total: slides.length }));
    dots.append(dot);
    return dot;
  });
  slider.append(prev, next, dots);

  let index = 0;
  const load = (i) => {
    const img = slides[(i + slides.length) % slides.length].querySelector('img[data-src]');
    if (img) {
      img.src = img.dataset.src;
      delete img.dataset.src;
    }
  };
  const show = (i) => {
    index = (i + slides.length) % slides.length;
    [index, index + 1, index - 1].forEach(load);
    track.style.transform = `translateX(-${index * 100}%)`;
    slides.forEach((slide, n) => { slide.inert = n !== index; });
    dotButtons.forEach((dot, n) => dot.setAttribute('aria-current', n === index ? 'true' : 'false'));
  };
  prev.addEventListener('click', () => show(index - 1));
  next.addEventListener('click', () => show(index + 1));
  dotButtons.forEach((dot, n) => dot.addEventListener('click', () => show(n)));
  let startX = null;
  track.addEventListener('pointerdown', (e) => { startX = e.clientX; swiped = false; });
  track.addEventListener('pointercancel', () => { startX = null; });
  track.addEventListener('pointerup', (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) > SWIPE_PX) {
      swiped = true;
      show(index + (dx < 0 ? 1 : -1));
    }
  });
  slides.forEach((slide, n) => { slide.inert = n !== 0; });
  dotButtons.forEach((dot, n) => dot.setAttribute('aria-current', n === 0 ? 'true' : 'false'));
  // the neighbours load once the visitor reaches the slider
  slider.addEventListener('pointerenter', () => [1, -1].forEach(load), { once: true });
  slider.addEventListener('focusin', () => [1, -1].forEach(load), { once: true });
  return slider;
}

/**
 * The journey badge (e.g. "Departures Lounge") with its explanation shown on hover or focus.
 * @param {'departure'|'arrival'} kind
 * @param {string} id A unique id for the explanation
 * @param {string} [prefix] The class name prefix (`property-card-badge`)
 * @returns {HTMLElement}
 */
export function buildBadge(kind, id, prefix = 'property-card-badge') {
  const label = translate(kind === 'departure' ? 'propertyDeparture' : 'propertyArrival');
  const tip = translate(kind === 'departure' ? 'propertyDepartureTip' : 'propertyArrivalTip');
  const badge = el('span', `${prefix} ${prefix}-${kind}`);
  badge.tabIndex = 0;
  badge.setAttribute('aria-describedby', id);
  const tipEl = el('span', `${prefix}-tip`, tip);
  tipEl.id = id;
  tipEl.setAttribute('role', 'tooltip');
  badge.append(el('span', `${prefix}-icon`), el('span', `${prefix}-label`, label), tipEl);
  return badge;
}
