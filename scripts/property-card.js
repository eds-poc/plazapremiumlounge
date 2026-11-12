/*
 * Property card: a property's card, as the source city pages' (styles/property-card.css): a photo
 * slider, then the details (badge, name, location, hours, icons, note, features with "+N more",
 * price, View button, loyalty line); parts without data are left out. For the properties
 * scripts/properties.js readProperty reads. Blocks call loadPropertyCardStyles before showing
 * cards, so they don't show unstyled.
 */
import { loadCSS } from './aem.js';
import { applyButtonAction } from './button-actions.js';
import { getLanguage, translate } from './i18n.js';
import {
  buildBadge, buildSlider, el, isPreview, propertyDetailPath, propertyDetailUrl, safeNote, toUrl,
} from './properties.js';

const VISIBLE_TAGS = 5;

let styles;

/**
 * The cards' stylesheet (styles/property-card.css), loaded once per page.
 * @returns {Promise<void>}
 */
export function loadPropertyCardStyles() {
  styles = styles || loadCSS(`${window.hlx?.codeBasePath || ''}/styles/property-card.css`);
  return styles;
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
 * @param {Object} options
 * @param {string} options.id A unique prefix for ids in the card
 * @param {boolean} [options.eager] Whether its first photo loads at once (the first card shown)
 * @param {Object|null} [options.view] The View button (see readViewButton); without it, no button
 *   and the name isn't a link
 * @param {{href: string, label: string}|null} [options.signup] The loyalty line's sign-up link
 * @param {number} [options.rank] The card's position in the list as shown (1 for the first)
 * @param {function(Object, number): void} [options.onView] Called as the View button is clicked,
 *   with the property and its rank (e.g. for analytics), before the page moves on
 * @returns {HTMLElement}
 */
export function buildPropertyCard(property, {
  id, eager = false, view = null, signup = null, rank = 1, onView,
} = {}) {
  const card = el('li', 'property-card');
  if (property.first) card.classList.add('property-card-first');
  if (property.pass) card.classList.add('property-card-pass');
  const body = el('div', 'property-card-body');
  const top = el('div', 'property-card-top');
  if (property.departure) top.append(buildBadge('departure', `${id}-dep`));
  if (property.arrival) top.append(buildBadge('arrival', `${id}-arr`));
  const title = el('h3', 'property-card-title');
  // the authored View now button and the name link to the lounge's page (none without the button)
  const detail = view ? propertyDetailUrl(property.code, {
    ...view.params,
    base: view.base,
    currency: property.price?.currency || view.params.currency,
  }) : '';
  if (detail) {
    const link = el('a', '', property.name);
    link.href = detail;
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
  if (property.price || detail) {
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
    if (detail) {
      const button = el('a', 'button', view.label);
      button.href = detail;
      button.setAttribute('aria-label', `${view.label} ${property.name}`);
      const wrap = el('p', 'property-card-view');
      const viewLink = applyButtonAction(button);
      // pushed as the click happens, before the page moves on
      if (onView) viewLink.addEventListener('click', () => onView(property, rank));
      wrap.append(viewLink);
      action.append(wrap);
    }
    bottom.append(action);
  }
  if (property.loyalty) bottom.append(buildLoyalty(property.loyalty, signup));
  body.append(top, bottom);
  card.append(buildSlider(property, eager), body);
  return card;
}

/**
 * The Smart Traveller sign-up link at the end of each card's loyalty line, from a block's
 * `signup-button` cell: a link (its text the label, e.g. [Join here](…)); null without one.
 * @param {HTMLElement} value The cell
 * @returns {{href: string, label: string}|null}
 */
export function readSignupButton(value) {
  const link = value.querySelector('a[href]');
  const href = toUrl(link?.getAttribute('href'));
  const label = link?.textContent.trim();
  return href && label ? { href, label } : null;
}

/**
 * The View now button's settings from its row: a link (its text is the label, its path the lounge
 * page, whatever its host) or plain text (the label; the lounge page in the page's site folder).
 * The listing page's own `currency`, `date` and `time` are passed on to the lounge pages.
 * @param {HTMLElement} value The row's value cell
 * @param {string} [blockName] The block, for the note on preview pages
 * @returns {{label: string, base: string, params: Object<string, string>}|null}
 */
export function readViewButton(value, blockName = 'property card') {
  const link = value.querySelector('a[href]');
  const label = (link || value).textContent.trim();
  if (!label) return null;
  let base = propertyDetailPath();
  if (link) {
    const href = toUrl(link.getAttribute('href'));
    const url = href ? new URL(href) : null;
    // (the lounge page by its path, whatever the link's host: the live site's isn't known here)
    if (url && url.pathname !== '/') {
      base = `${url.pathname}${url.search}`;
    } else if (isPreview()) {
      // eslint-disable-next-line no-console
      console.warn(`${blockName}: view-button links to "${href}", not a lounge page; using ${base}`);
    }
  }
  const page = new URLSearchParams(window.location.search);
  // (the currency: `currencyCode` when there's one, as the language and currency modal's Apply
  // writes it, else `currency`)
  const read = (name) => (name === 'currency' ? page.get('currencyCode') || page.get(name) : page.get(name));
  const params = Object.fromEntries(['currency', 'date', 'time']
    .map((name) => [name, (read(name) || '').trim()]).filter(([, v]) => v));
  return { label, base, params };
}
