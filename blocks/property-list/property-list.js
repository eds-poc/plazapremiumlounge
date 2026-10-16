import { getMetadata } from '../../scripts/aem.js';
import { applyButtonAction } from '../../scripts/button-actions.js';
import apiUrl from '../../scripts/endpoints.js';
import {
  DEFAULT_SITE, getLanguage, getSiteFolder, translate,
} from '../../scripts/i18n.js';
import { hideLoader, showLoader } from '../../scripts/scripts.js';

const TIMEOUT_MS = 8000;
// property types shown, as the source city pages: lounges, then passes (gift cards) at the end
const LOUNGE = 'LOUNGE';
const PASS = 'GFTCRD';
const VISIBLE_TAGS = 5;
const SWIPE_PX = 40;
const MOBILE = '(width < 768px)';
const GROUPS = ['airport', 'service', 'feature'];
// the API's language code by site folder; other folders are sent as they are (zh-cn, pt-br …)
const API_LANGUAGES = { 'en-uk': 'en' };
// "Plaza Premium First" as the API names it in each language (compared without spaces)
const FIRST_BRANDS = ['plazapremiumfirst', '环亚优逸庭', '環亞優逸庭', 'プラザプレミアムファースト'];

let blockCount = 0;
let loading = 0;

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
  if (text) node.textContent = text;
  return node;
}

/**
 * Whether the page is shown on the preview site (or locally), where authors get setup hints.
 * @returns {boolean}
 */
function isPreview() {
  const { hostname } = window.location;
  return hostname.endsWith('.aem.page') || hostname === 'localhost';
}

/**
 * Shows the site's full-page loader (the same as on page load) while any property list on the page
 * is loading, and hides it once the last one is done.
 * @param {boolean} busy
 */
function setLoading(busy) {
  loading = Math.max(0, loading + (busy ? 1 : -1));
  if (loading) showLoader();
  else hideLoader();
}

/**
 * Fetches the properties. Gives up after 8s.
 * @param {string} url
 * @returns {Promise<Object[]>} the API's items
 */
async function fetchProperties(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    if (!Array.isArray(json.items)) throw new Error('Unexpected response');
    return json.items;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A stable filter key for a value: lower case, words joined by dashes.
 * @param {string} value
 * @returns {string}
 */
function toKey(value) {
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
function toUrl(value) {
  if (!value || typeof value !== 'string') return '';
  try {
    return new URL(value.trim().replace(/^~\//, '/'), window.location.href).href;
  } catch {
    return '';
  }
}

/**
 * The API's note (HTML) as safe content: its text, line breaks and links only.
 * @param {string} html
 * @returns {DocumentFragment}
 */
function safeNote(html) {
  const out = document.createDocumentFragment();
  const source = new DOMParser().parseFromString(html, 'text/html').body;
  const copy = (node, into) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) into.append(child.textContent);
      else if (child.nodeName === 'BR') into.append(el('br'));
      else if (child.nodeName === 'A' && toUrl(child.getAttribute('href'))) {
        const link = el('a');
        link.href = toUrl(child.getAttribute('href'));
        copy(child, link);
        into.append(applyButtonAction(link));
      } else if (child.nodeType === Node.ELEMENT_NODE) copy(child, into);
    });
  };
  copy(source, out);
  return out;
}

/**
 * Whether a property name starts with the Plaza Premium First brand, in any site language.
 * @param {string} name
 * @returns {boolean}
 */
function isFirstBrand(name) {
  const compact = name.replace(/\s+/g, '').toLowerCase();
  return FIRST_BRANDS.some((brand) => compact.startsWith(brand));
}

/**
 * The API's language code for the page: the page metadata `language-code` when set, else from
 * the page's site folder (/en-uk/ → en, /zh-hk/ → zh-hk …; pages outside one use the default site).
 * @returns {string}
 */
function getApiLanguage() {
  const authored = getMetadata('language-code').trim();
  if (authored) return authored;
  const folder = getSiteFolder() || DEFAULT_SITE;
  return API_LANGUAGES[folder] || folder;
}

/**
 * Reads one API record into what the card and the filters need, or null for a record that
 * isn't shown (not active, another type, or without a name).
 * @param {Object} item
 * @returns {Object|null}
 */
function readProperty(item) {
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
      .map((image, i) => ({ src: toUrl(image.path), order: Number(image.sequence) || i + 1 }))
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
    link: toUrl(item.targetUrl),
  };
}

/**
 * The filter options found in the properties: airports (by location), service types and features,
 * each without duplicates or empty values.
 * @param {Object[]} properties
 * @returns {Object<string, {key: string, label: string}[]>}
 */
function readOptions(properties) {
  const collect = (list) => [
    ...new Map(list.filter((o) => o.key && o.label).map((o) => [o.key, o])).values(),
  ];
  const lounges = properties.filter((p) => !p.pass);
  const features = collect(properties.flatMap((p) => p.features));
  features.sort((a, b) => a.label.localeCompare(b.label, getLanguage()));
  return {
    airport: collect(lounges.map((p) => ({ key: p.location.key, label: p.location.name }))),
    service: collect(properties.flatMap((p) => p.services)),
    feature: features,
  };
}

/**
 * Whether a property matches the selected filters: within a group any selected option matches;
 * every group with a selection must match.
 * @param {Object} property
 * @param {Object<string, Set<string>>} selected
 * @returns {boolean}
 */
function matches(property, selected) {
  const values = {
    airport: [property.location.key],
    service: property.services.map((s) => s.key),
    feature: property.features.map((f) => f.key),
  };
  return GROUPS.every((group) => !selected[group].size
    || values[group].some((key) => selected[group].has(key)));
}

/**
 * The photo slider of a card: one photo at a time, previous/next, one dot per photo, swipe; loops.
 * @param {Object} property
 * @param {boolean} eager Load the first photo straight away (the first card)
 * @returns {HTMLElement}
 */
function buildSlider(property, eager) {
  const { images, name, line } = property;
  const slider = el('div', 'property-slider');
  if (!images.length) {
    slider.classList.add('is-empty');
    return slider;
  }
  const track = el('div', 'property-slider-track');
  const slides = images.map((image, i) => {
    const slide = el('div', 'property-slider-slide');
    const img = el('img');
    // photos after the first load when they're about to be shown
    if (i === 0) img.src = image.src;
    else img.dataset.src = image.src;
    img.alt = i === 0 ? [name, line].filter(Boolean).join(', ') : `${name}, ${translate('propertyPhoto', { n: i + 1, total: images.length })}`;
    img.loading = eager && i === 0 ? 'eager' : 'lazy';
    img.decoding = 'async';
    slide.append(img);
    track.append(slide);
    return slide;
  });
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
  const prev = button('property-slider-prev', translate('propertyPrevious'));
  const next = button('property-slider-next', translate('propertyNext'));
  const dots = el('div', 'property-slider-dots');
  const dotButtons = slides.map((slide, i) => {
    const dot = button('property-slider-dot', translate('propertyPhoto', { n: i + 1, total: slides.length }));
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
  track.addEventListener('pointerdown', (e) => { startX = e.clientX; });
  track.addEventListener('pointercancel', () => { startX = null; });
  track.addEventListener('pointerup', (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) > SWIPE_PX) show(index + (dx < 0 ? 1 : -1));
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
 * @returns {HTMLElement}
 */
function buildBadge(kind, id) {
  const label = translate(kind === 'departure' ? 'propertyDeparture' : 'propertyArrival');
  const tip = translate(kind === 'departure' ? 'propertyDepartureTip' : 'propertyArrivalTip');
  const badge = el('span', `property-card-badge property-card-badge-${kind}`);
  badge.tabIndex = 0;
  badge.setAttribute('aria-describedby', id);
  const tipEl = el('span', 'property-card-badge-tip', tip);
  tipEl.id = id;
  tipEl.setAttribute('role', 'tooltip');
  badge.append(el('span', 'property-card-badge-icon'), el('span', 'property-card-badge-label', label), tipEl);
  return badge;
}

/**
 * Places the open "+N more" panel as the source's tooltip: centred above the button; when that
 * doesn't fit the screen's width, at the right of the button (vertically centred), else at its
 * left. The arrow points at the button.
 * @param {HTMLElement} item The list item holding the button and the panel
 * @param {HTMLElement} toggle
 * @param {HTMLElement} panel
 */
function placePanel(item, toggle, panel) {
  const GAP = 6;
  const EDGE = 4;
  panel.style.left = '0px';
  panel.style.top = '0px';
  const viewport = document.documentElement.clientWidth;
  const t = toggle.getBoundingClientRect();
  const p = panel.getBoundingClientRect();
  const base = item.getBoundingClientRect();
  const centreX = t.left + t.width / 2;
  const centreY = t.top + t.height / 2;
  let placement = 'top';
  let left = centreX - p.width / 2;
  let top = t.top - p.height - (GAP / 4);
  if (left < EDGE || left + p.width > viewport - EDGE) {
    if (t.right + GAP + p.width <= viewport - EDGE) {
      placement = 'right';
      left = t.right + GAP;
    } else if (t.left - GAP - p.width >= EDGE) {
      placement = 'left';
      left = t.left - GAP - p.width;
    } else {
      left = Math.min(Math.max(left, EDGE), viewport - EDGE - p.width);
    }
    if (placement !== 'top') top = centreY - p.height / 2;
  }
  panel.dataset.placement = placement;
  panel.style.left = `${left - base.left}px`;
  panel.style.top = `${top - base.top}px`;
  // the arrow's position along the panel edge, at the button's centre
  panel.style.setProperty('--arrow', `${placement === 'top' ? centreX - left : centreY - top}px`);
}

/**
 * The feature tags: the first five, then a "+N more" button that shows the others.
 * @param {Object[]} features
 * @param {string} id A unique id for the other features
 * @returns {HTMLElement}
 */
function buildFeatures(features, id) {
  const list = el('ul', 'property-card-features');
  features.slice(0, VISIBLE_TAGS).forEach((f) => list.append(el('li', 'property-card-tag', f.label)));
  const rest = features.slice(VISIBLE_TAGS);
  if (rest.length) {
    const item = el('li', 'property-card-more');
    const toggle = el('button', 'property-card-tag', translate('propertyMore', { n: rest.length }));
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', id);
    const panel = el('div', 'property-card-more-panel');
    panel.id = id;
    panel.hidden = true;
    const others = el('ul');
    rest.forEach((f) => {
      const li = el('li');
      li.append(el('span', 'property-card-more-check'), f.label);
      others.append(li);
    });
    panel.append(el('p', 'property-card-more-title', translate('propertyOtherFeatures')), others);
    // shown while the pointer is over it (as the source's tooltip); a click (or Enter) pins it open
    // or closes it again; Escape closes it
    let pinned = false;
    let hovering = false;
    const set = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      panel.hidden = !open;
      if (open) placePanel(item, toggle, panel);
    };
    toggle.addEventListener('click', () => {
      pinned = !pinned;
      set(pinned || hovering);
    });
    item.addEventListener('mouseenter', () => { hovering = true; set(true); });
    item.addEventListener('mouseleave', () => { hovering = false; set(pinned); });
    item.addEventListener('focusout', (e) => {
      if (!item.contains(e.relatedTarget)) { pinned = false; set(hovering); }
    });
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !panel.hidden) {
        pinned = false;
        hovering = false;
        set(false);
        toggle.focus();
      }
    });
    item.append(toggle, panel);
    list.append(item);
  }
  return list;
}

/**
 * The loyalty line: the API's text with percentages in bold (e.g. "20%"), then the authored
 * sign-up link (e.g. "Join here"), as the source's "ST members save 20% … — Join free".
 * @param {string} text
 * @param {{href: string, label: string}|null} signup
 * @returns {HTMLElement}
 */
function buildLoyalty(text, signup) {
  const line = el('p', 'property-card-loyalty');
  text.split(/(\d+(?:[.,]\d+)?\s?%)/).forEach((part, i) => {
    if (!part) return;
    line.append(i % 2 ? el('b', '', part) : part);
  });
  if (signup) {
    line.append(/[.!?]$/.test(text) ? ' ' : ' — ');
    const link = el('a', '', signup.label);
    link.href = signup.href;
    line.append(applyButtonAction(link));
  }
  return line;
}

/**
 * One property card: photos, then the details (badge, name, location, hours, icons, note,
 * features, price, View and the loyalty line). Parts without data are left out.
 * @param {Object} property
 * @param {string} id A unique prefix for ids in the card
 * @param {boolean} eager
 * @param {Object} settings The authored settings (e.g. the sign-up link)
 * @returns {HTMLElement}
 */
function buildCard(property, id, eager, settings) {
  const card = el('li', 'property-card');
  if (property.first) card.classList.add('property-card-first');
  if (property.pass) card.classList.add('property-card-pass');
  const body = el('div', 'property-card-body');
  const top = el('div', 'property-card-top');
  if (property.departure) top.append(buildBadge('departure', `${id}-dep`));
  if (property.arrival) top.append(buildBadge('arrival', `${id}-arr`));
  const title = el('h3', 'property-card-title');
  if (property.link) {
    const link = el('a', '', property.name);
    link.href = property.link;
    title.append(applyButtonAction(link));
  } else {
    title.textContent = property.name;
  }
  top.append(title);
  if (property.line) top.append(el('p', 'property-card-location', property.line));
  if (property.hours) top.append(el('p', 'property-card-hours', property.hours));
  const promoSrc = toUrl(property.promo?.image);
  if (property.icons.length || promoSrc) {
    const icons = el('div', 'property-card-icons');
    property.icons.forEach((icon) => {
      const img = el('img', 'property-card-icon');
      img.src = icon.src;
      img.alt = icon.alt;
      img.loading = 'lazy';
      icons.append(img);
    });
    if (promoSrc) {
      const img = el('img', 'property-card-promo');
      img.src = promoSrc;
      img.alt = property.promo.desc || '';
      img.loading = 'lazy';
      icons.append(img);
    }
    top.append(icons);
  }
  if (property.note) {
    const note = el('p', 'property-card-note');
    note.append(safeNote(property.note));
    if (note.textContent.trim()) top.append(note);
  }
  const bottom = el('div', 'property-card-bottom');
  if (property.features.length) bottom.append(buildFeatures(property.features, `${id}-more`));
  if (property.price || property.link) {
    const action = el('div', 'property-card-action');
    if (property.price) {
      const price = el('p', 'property-card-price', `${translate('propertyFrom')} `);
      const amount = new Intl.NumberFormat(getLanguage(), {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(property.price.amount);
      price.append(el('strong', '', `${property.price.currency} ${amount}`));
      action.append(price);
    }
    if (property.link) {
      const view = el('a', 'button', translate('propertyView'));
      view.href = property.link;
      view.setAttribute('aria-label', `${translate('propertyView')} ${property.name}`);
      const wrap = el('p', 'property-card-view');
      wrap.append(applyButtonAction(view));
      action.append(wrap);
    }
    bottom.append(action);
  }
  if (property.loyalty) bottom.append(buildLoyalty(property.loyalty, settings.signup));
  body.append(top, bottom);
  card.append(buildSlider(property, eager), body);
  return card;
}

/**
 * The selected filters from the page address (e.g. ?airport=hkg&feature=wi-fi,bar), keeping only
 * options that exist.
 * @param {Object} options
 * @returns {Object<string, Set<string>>}
 */
function readSelection(options, useUrl) {
  const params = new URLSearchParams(useUrl ? window.location.search : '');
  return Object.fromEntries(GROUPS.map((group) => {
    const known = new Set(options[group].map((o) => o.key));
    const keys = (params.get(group) || '').split(',').map((k) => k.trim()).filter((k) => known.has(k));
    return [group, new Set(keys)];
  }));
}

/**
 * Writes the selected filters into the page address without reloading or adding history entries.
 * @param {Object<string, Set<string>>} selected
 */
function writeSelection(selected) {
  const url = new URL(window.location.href);
  GROUPS.forEach((group) => {
    if (selected[group].size) url.searchParams.set(group, [...selected[group]].join(','));
    else url.searchParams.delete(group);
  });
  // (commas kept readable, e.g. ?feature=wi-fi,bar)
  url.search = url.searchParams.toString().replace(/%2C/gi, ',');
  window.history.replaceState(window.history.state, '', url);
}

/**
 * The filter form: one group per filter with at least two options (airport, service, features),
 * each option a checkbox; Service Type also has All (no service chosen); Clear resets everything.
 * @param {Object} options
 * @param {Object<string, Set<string>>} selected
 * @param {Function} onChange
 * @returns {HTMLFormElement|null} null when there's nothing to filter
 */
function buildFilters(options, selected, onChange) {
  const titles = { airport: 'propertyAirport', service: 'propertyService', feature: 'propertyFeatures' };
  const groups = GROUPS.filter((group) => options[group].length > 1);
  if (!groups.length) return null;
  // (unnamed, so not a landmark; each group is a labelled fieldset)
  const form = el('form', 'property-list-filters');
  form.addEventListener('submit', (e) => e.preventDefault());
  const clear = el('button', 'property-list-clear', translate('propertyClear'));
  clear.type = 'button';
  const sync = () => {
    form.querySelectorAll('input[data-group]').forEach((input) => {
      input.checked = input.value === '' ? !selected[input.dataset.group].size
        : selected[input.dataset.group].has(input.value);
    });
  };
  const option = (group, key, label) => {
    const wrap = el('label', 'property-list-option');
    const input = el('input');
    input.type = 'checkbox';
    input.value = key;
    input.dataset.group = group;
    input.addEventListener('change', () => {
      if (key === '') selected[group].clear();
      else if (input.checked) selected[group].add(key);
      else selected[group].delete(key);
      sync();
      onChange();
    });
    wrap.append(input, el('span', '', label));
    return wrap;
  };
  groups.forEach((group, i) => {
    const fieldset = el('fieldset', 'property-list-group');
    const legend = el('legend', 'property-list-group-title');
    legend.append(el('span', '', translate(titles[group])));
    // the source's Clear pill sits at the right of the first group title
    if (i === 0) legend.append(clear);
    fieldset.append(legend);
    if (group === 'service') fieldset.append(option(group, '', translate('propertyAll')));
    options[group].forEach((o) => fieldset.append(option(group, o.key, o.label)));
    form.append(fieldset);
  });
  clear.addEventListener('click', () => {
    GROUPS.forEach((group) => selected[group].clear());
    sync();
    onChange();
  });
  sync();
  return form;
}

/**
 * Renders the listing: the location groups with their cards, then the passes; the result count
 * for screen readers; the empty message (with Clear when filters are on).
 * @param {HTMLElement} results
 * @param {Object[]} properties
 * @param {Object<string, Set<string>>} selected
 * @param {HTMLElement} status
 * @param {Function} onClear
 */
function renderResults(results, properties, selected, status, onClear, prefix, settings) {
  const shown = properties.filter((p) => matches(p, selected));
  const groups = new Map();
  shown.filter((p) => !p.pass).forEach((p) => {
    if (!groups.has(p.location.key)) groups.set(p.location.key, { ...p.location, items: [] });
    groups.get(p.location.key).items.push(p);
  });
  const ordered = [...groups.values()].sort((a, b) => a.seq - b.seq);
  const passes = shown.filter((p) => p.pass);
  if (passes.length) ordered.push({ heading: '', items: passes });
  let n = 0;
  const sections = ordered.map((group) => {
    const section = el('section', 'property-list-location');
    if (group.heading) section.append(el('h2', 'property-list-heading', group.heading));
    const list = el('ul', 'property-list-cards');
    group.items.sort((a, b) => a.seq - b.seq).forEach((p) => {
      list.append(buildCard(p, `${prefix}-${n}`, n === 0, settings));
      n += 1;
    });
    section.append(list);
    return section;
  });
  if (!shown.length) {
    const empty = el('div', 'property-list-message');
    const filtered = GROUPS.some((group) => selected[group].size);
    empty.append(el('p', '', translate(filtered ? 'propertyNoMatch' : 'propertyEmpty')));
    if (filtered) {
      const clear = el('button', 'button secondary', translate('propertyClear'));
      clear.type = 'button';
      clear.addEventListener('click', onClear);
      empty.append(clear);
    }
    sections.push(empty);
  }
  results.replaceChildren(...sections);
  status.textContent = translate('propertyResults', { n: shown.length });
}

/**
 * Shows a message in the listing: an error (with Try again) or, on the preview site, a setup hint.
 * @param {HTMLElement} results
 * @param {string} text
 * @param {Function} [retry]
 * @param {string} [hint] Shown on the preview site only
 */
function showMessage(results, text, retry, hint) {
  const box = el('div', 'property-list-message');
  box.setAttribute('role', 'alert');
  box.append(el('p', '', text));
  if (hint && isPreview()) box.append(el('p', 'property-list-hint', hint));
  if (retry) {
    const again = el('button', 'button secondary', translate('propertyRetry'));
    again.type = 'button';
    again.addEventListener('click', retry);
    box.append(again);
  }
  results.replaceChildren(box);
}

/**
 * The authored settings: rows of name | value, `city-code` (e.g. HKHKG) and `signup-button` (a
 * link, e.g. [Join here](…)); names ignore capitals and spaces. A table with a single value is read
 * as the city code.
 * @param {HTMLElement} block
 * @returns {{city: string, signup: {href: string, label: string}|null}}
 */
function readSettings(block) {
  const rows = [...block.children].map((row) => [...row.children]);
  const settings = { city: '', signup: null };
  const pairs = rows.filter((cells) => cells.length >= 2);
  if (!pairs.length) {
    settings.city = block.textContent.trim().replace(/\s+/g, '').toUpperCase();
    return settings;
  }
  pairs.forEach(([name, value]) => {
    const key = toKey(name.textContent);
    if (key === 'city-code') settings.city = value.textContent.trim().replace(/\s+/g, '').toUpperCase();
    if (key === 'signup-button') {
      const link = value.querySelector('a[href]');
      const href = toUrl(link?.getAttribute('href'));
      const label = link?.textContent.trim();
      if (href && label) settings.signup = { href, label };
    }
  });
  return settings;
}

/**
 * Decorates the property list block: the authored city code (e.g. HKHKG) is all it needs (plus an
 * optional sign-up link for the loyalty line). The API address comes from scripts/endpoints.js
 * (the API domain + the `properties` path), the language from the page's site folder (or the
 * page metadata `language-code`); the block fetches the city's properties and renders them in
 * location groups, with filters (airport, service type, features). The first property list on a
 * page keeps its filters in the page address; others keep them to themselves.
 * @param {HTMLElement} block The property list block element
 */
export default async function decorate(block) {
  const settings = readSettings(block);
  const { city } = settings;
  blockCount += 1;
  const prefix = `property-list-${blockCount}`;
  const useUrl = blockCount === 1;
  const layout = el('div', 'property-list-layout');
  // (not a landmark: several lists on a page would repeat the same one)
  const sidebar = el('div', 'property-list-sidebar');
  const main = el('div', 'property-list-main');
  const toggle = el('button', 'property-list-toggle', translate('propertyFilters'));
  toggle.type = 'button';
  toggle.hidden = true;
  const status = el('p', 'property-list-status visually-hidden');
  status.setAttribute('aria-live', 'polite');
  const results = el('div', 'property-list-results');
  main.append(toggle, status, results);
  layout.append(sidebar, main);
  block.replaceChildren(layout);

  const dialog = el('dialog', 'property-list-dialog');
  dialog.setAttribute('aria-label', translate('propertyFilters'));
  const close = el('button', 'property-list-dialog-close');
  close.type = 'button';
  close.setAttribute('aria-label', translate('close'));
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  dialog.append(close);
  block.append(dialog);

  let load;
  const render = async () => {
    if (!city) {
      showMessage(results, translate('propertyEmpty'), null, 'Add a "city-code" row (e.g. city-code | HKHKG) in the block.');
      return;
    }
    const url = apiUrl('properties');
    url.searchParams.set('cityCode', city);
    url.searchParams.set('languageCode', getApiLanguage());
    let items;
    try {
      items = await fetchProperties(url.href);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('property-list: could not load', url.href, error);
      showMessage(results, translate('propertyError'), () => load());
      return;
    }
    const properties = items.map(readProperty).filter(Boolean);
    if (!properties.length) {
      showMessage(results, translate('propertyEmpty'), null, `City code "${city}" returned no lounges.`);
      return;
    }
    const options = readOptions(properties);
    const selected = readSelection(options, useUrl);
    let form = null;
    const clearAll = () => form?.querySelector('.property-list-clear')?.click();
    const update = () => {
      if (useUrl) writeSelection(selected);
      renderResults(results, properties, selected, status, clearAll, prefix, settings);
    };
    form = buildFilters(options, selected, update);
    sidebar.replaceChildren();
    if (form) {
      // the form sits in the sidebar, or in the Filters dialog on phones
      const mobile = window.matchMedia(MOBILE);
      const place = () => {
        if (mobile.matches) dialog.append(form);
        else {
          if (dialog.open) dialog.close();
          sidebar.append(form);
        }
        toggle.hidden = !mobile.matches;
      };
      mobile.addEventListener('change', place);
      place();
      toggle.onclick = () => dialog.showModal();
    }
    layout.classList.toggle('no-filters', !form);
    renderResults(results, properties, selected, status, clearAll, prefix, settings);
  };
  // the page's loader stays up until the lounges are shown (the first load is awaited, so the
  // page doesn't hide its loader before)
  load = async () => {
    setLoading(true);
    try {
      await render();
    } finally {
      setLoading(false);
    }
  };
  await load();
}
