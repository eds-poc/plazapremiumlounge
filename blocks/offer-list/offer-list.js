/**
 * The Offer List block: the offers of a JSON (a query index of the offer pages: path,
 * lastModified, title, description, image, tag and optionally date), the authored Source or else
 * the page's language site's (/en-uk-offers.json), as the source offers page (`/en-uk/offers`):
 * - a "Show me [All offers ↓] ordered by [Latest ↓]" filter line, built here and styled by the
 *   Dropdown block's CSS;
 * - the offers as Cards (large), built here and decorated by the Cards block, a page at a time
 *   (the authored Page size, else 10), with the pagination of scripts/pagination.js below them.
 * The selection and the page are kept in the page address (`?category=limited-time&sort=oldest
 * &page=2`, the defaults left out), so a reload or a shared link shows the same offers; Back and
 * Forward restore them.
 */
import {
  buildBlock, decorateBlock, loadBlock, loadCSS,
} from '../../scripts/aem.js';
import {
  DEFAULT_SITE, getLanguage, getSiteFolder, translate,
} from '../../scripts/i18n.js';
import {
  createPager, readPageSize, setPage,
} from '../../scripts/pagination.js';
import {
  el, fetchJson, isPreview, toKey,
} from '../../scripts/properties.js';

const TIMEOUT_MS = 8000;
// rows asked for in the one request (the JSON gives 1000 by default without a limit)
const ROW_LIMIT = 10000;
// the site name some page titles end with (e.g. "HSBC Autumn 2026 | Plaza Premium Lounge")
const TITLE_SUFFIX = /\s*[|｜]\s*Plaza Premium Lounge\s*$/i;
// the image the index gives a page without one (/default-meta-image.png, any size)
const DEFAULT_IMAGE = /\/default-meta-image\.png(\?|$)/;
// the cards per row from this width (the Cards block's large option): the first row's photos
// load straight away, the first one first (the largest paint)
const TWO_COLUMNS = '(width >= 768px)';
const CATEGORY_PARAM = 'category';
const SORT_PARAM = 'sort';
const OLDEST = 'oldest';

let blockCount = 0;

/**
 * The authored settings, rows of name | value (names ignore capitals and spaces):
 * - `Source`: a link (or text); else the block's only link or text; else the offers of the page's
 *   language site (e.g. /en-uk-offers.json; pages outside one use en-uk's);
 * - `Page size`: the offers per page, e.g. 10 (the default, also for anything but a number).
 * @param {HTMLElement} block
 * @returns {{ source: string, pageSize: number }}
 */
function readSettings(block) {
  const value = (cell) => (cell?.querySelector('a[href]')?.getAttribute('href') || cell?.textContent || '').trim();
  const rows = [...block.children].map((row) => [...row.children]);
  const row = (name) => rows.find((cells) => cells.length >= 2
    && toKey(cells[0].textContent) === name);
  const sourceRow = row('source');
  const authored = sourceRow ? value(sourceRow[1])
    : (rows.length === 1 && rows[0].length === 1 && value(rows[0][0])) || '';
  return {
    source: authored || `/${getSiteFolder() || DEFAULT_SITE}-offers.json`,
    pageSize: readPageSize(row('page-size')?.[1].textContent),
  };
}

/**
 * An offer's date as a time (ms): the `date` column (a date such as 2026-10-01, or seconds since
 * 1970 as the index gives dates it parses), else `lastModified` (seconds), else 0.
 * @param {Object} row
 * @returns {number}
 */
function readTime(row) {
  const date = String(row.date ?? '').trim();
  if (date) {
    const time = /^\d+$/.test(date) ? Number(date) * 1000 : Date.parse(date);
    if (!Number.isNaN(time)) return time;
  }
  return (Number(row.lastModified) || 0) * 1000;
}

/**
 * The address to fetch: the authored path (e.g. `/en-uk-offers.json`) or full address, on the
 * current site only. '' when it's invalid or another site's.
 * @param {string} source
 * @returns {string}
 */
function toSourceUrl(source) {
  if (!source) return '';
  try {
    const url = new URL(source, window.location.href);
    return url.origin === window.location.origin ? url.href : '';
  } catch {
    return '';
  }
}

/**
 * Every row of the JSON, in a single request.
 * @param {string} source An absolute address
 * @returns {Promise<Object[]>}
 */
async function fetchRows(source) {
  const url = new URL(source);
  url.searchParams.set('limit', ROW_LIMIT);
  const json = await fetchJson(url.href, TIMEOUT_MS);
  if (!Array.isArray(json?.data)) throw new Error('Unexpected response: no data');
  return json.data;
}

/**
 * A link to a page on this site, as a path. '' when it isn't one.
 * @param {string} value
 * @returns {string}
 */
function toPagePath(value) {
  // (an empty value would resolve to the current page)
  if (!value) return '';
  try {
    const url = new URL(value, window.location.href);
    if (url.origin !== window.location.origin) return '';
    return url.pathname === '/' ? '' : `${url.pathname}${url.search}`;
  } catch {
    return '';
  }
}

/**
 * An image of the offers JSON as a full address, from any source (a path is on this site). The
 * Cards block keeps its host and path and adds its own size query. '' when it isn't valid (an
 * invalid address would stop the Cards block).
 * @param {string} value
 * @returns {string}
 */
function toImagePath(value) {
  try {
    return new URL(value, window.location.href).href;
  } catch {
    return '';
  }
}

/**
 * The offers of the rows, in the file's order: each with a page link and a title (rows without
 * one, or repeating a page, are left out); the tags are the `tag` column split at commas.
 * @param {Object[]} rows
 * @returns {{ path: string, title: string, description: string, image: string,
 *   tags: { key: string, name: string }[], time: number, index: number }[]}
 */
function readOffers(rows) {
  // the listing page itself is left out (an index of the offers folder can include it)
  const seen = new Set([window.location.pathname.replace(/\/$/, '')]);
  return rows.map((row) => {
    const path = toPagePath(String(row.path ?? '').trim());
    const title = String(row.title ?? '').replace(TITLE_SUFFIX, '').trim();
    if (!path || !title || seen.has(path)) return null;
    seen.add(path);
    const tags = String(row.tag ?? '')
      .split(',')
      .map((name) => ({ key: toKey(name), name: name.trim() }))
      .filter((tag) => tag.key);
    // the image from any source (the Cards block adds the sizes); the index's placeholder for a
    // page without an image (which this site doesn't have) is no image
    const raw = String(row.image ?? '').trim();
    const image = DEFAULT_IMAGE.test(raw) ? '' : raw;
    return {
      path,
      title,
      description: String(row.description ?? '').trim(),
      image: image && toImagePath(image),
      tags,
      time: readTime(row),
    };
  }).filter(Boolean).map((offer, index) => ({ ...offer, index }));
}

/**
 * The category options: All offers (the default, no id), then every tag of the offers once, in
 * alphabetical order.
 * @param {Object[]} offers
 * @returns {{ id: string, name: string }[]}
 */
function categoryOptions(offers) {
  const tags = new Map();
  offers.forEach((offer) => offer.tags.forEach((tag) => {
    if (!tags.has(tag.key)) tags.set(tag.key, tag.name);
  }));
  const options = [...tags].map(([id, name]) => ({ id, name }));
  options.sort((a, b) => a.name.localeCompare(b.name, getLanguage()));
  return [{ id: '', name: translate('offerAll') }, ...options];
}

/**
 * The selection in the page address: the category (`?category=limited-time`) when it's one of the
 * options, and the order (`?sort=oldest`). Anything else is the default: all offers, latest first.
 * @param {Set<string>} categories The category ids
 * @returns {{ category: string, sort: string }}
 */
function readSelection(categories) {
  const params = new URLSearchParams(window.location.search);
  const category = toKey(params.get(CATEGORY_PARAM));
  const oldest = (params.get(SORT_PARAM) || '').toLowerCase() === OLDEST;
  return { category: categories.has(category) ? category : '', sort: oldest ? OLDEST : '' };
}

/**
 * Puts the selection in the page address (the defaults removed) and goes back to the first page,
 * as a new history entry when it changes.
 * @param {{ category: string, sort: string }} selection
 */
function writeSelection({ category, sort }) {
  const url = setPage(new URL(window.location.href), 1);
  if (category) url.searchParams.set(CATEGORY_PARAM, category);
  else url.searchParams.delete(CATEGORY_PARAM);
  if (sort) url.searchParams.set(SORT_PARAM, sort);
  else url.searchParams.delete(SORT_PARAM);
  if (url.href !== window.location.href) {
    window.history.pushState(window.history.state, '', url);
  }
}

/**
 * A dropdown control, with the Dropdown block's markup (and so its look): a toggle showing the
 * selected option over a menu of the others. Keyboard: Enter, Space or the down arrow opens it;
 * the arrows, Home and End move through the options; Esc closes it.
 * @param {{ id: string, labelId: string, options: { id: string, name: string }[],
 *   onSelect: function(string): void }} config
 * @returns {{ control: HTMLElement, show: function(string): void }}
 */
function buildControl({
  id, labelId, options, onSelect,
}) {
  const control = el('span', 'dropdown-control');
  const toggle = el('button', 'dropdown-toggle');
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', 'false');
  const value = el('span', 'dropdown-value');
  value.id = `${id}-value`;
  toggle.append(value);
  toggle.setAttribute('aria-labelledby', `${labelId} ${value.id}`);
  const menu = el('ul', 'dropdown-menu');
  menu.id = `${id}-menu`;
  menu.hidden = true;
  toggle.setAttribute('aria-controls', menu.id);
  control.append(toggle, menu);

  const items = options.map((option) => {
    const item = el('li', 'dropdown-option');
    const choice = el('button', 'dropdown-link', option.name);
    choice.type = 'button';
    choice.dataset.id = option.id;
    item.append(choice);
    return item;
  });

  // the selected option on the toggle; the menu has the others
  const show = (selected) => {
    const option = options.find((o) => o.id === selected) || options[0];
    value.textContent = option.name;
    menu.replaceChildren(...items.filter((item, i) => options[i] !== option));
  };

  const focusables = () => [...menu.querySelectorAll('.dropdown-link')];
  const open = (focusFirst) => {
    menu.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    if (focusFirst) focusables()[0]?.focus();
  };
  const close = (refocus) => {
    if (menu.hidden) return;
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    if (refocus) toggle.focus();
  };

  toggle.addEventListener('click', () => (menu.hidden ? open(false) : close(false)));
  toggle.addEventListener('keydown', (e) => {
    if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      open(true);
    } else if (e.key === 'Escape') {
      close(false);
    }
  });
  menu.addEventListener('click', (e) => {
    const choice = e.target.closest('.dropdown-link');
    if (!choice) return;
    close(true);
    show(choice.dataset.id);
    onSelect(choice.dataset.id);
  });
  menu.addEventListener('keydown', (e) => {
    const list = focusables();
    const index = list.indexOf(document.activeElement);
    const moves = {
      ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: list.length - 1,
    };
    if (e.key in moves) {
      e.preventDefault();
      list[(moves[e.key] + list.length) % list.length].focus();
    } else if (e.key === 'Escape') {
      close(true);
    }
  });
  // close when focus moves elsewhere (Safari doesn't focus a clicked button: the click below)
  control.addEventListener('focusout', (e) => {
    if (e.relatedTarget && !control.contains(e.relatedTarget)) close(false);
  });
  document.addEventListener('click', (e) => {
    if (!control.contains(e.target)) close(false);
  });

  return { control, show };
}

/**
 * The filter line, "Show me [category ↓] ordered by [order ↓]", in the Dropdown block's markup.
 * @param {string} prefix Unique per block, for the ids
 * @param {{ id: string, name: string }[]} categories
 * @param {function({ category?: string, sort?: string }): void} onSelect
 * @returns {{ filters: HTMLElement, show: function({ category: string, sort: string }): void }}
 */
function buildFilters(prefix, categories, onSelect) {
  const label = (id, text) => {
    const span = el('span', 'dropdown-label', text);
    span.id = id;
    return span;
  };
  const showLabel = label(`${prefix}-category-label`, translate('offerShowMe'));
  const sortLabel = label(`${prefix}-sort-label`, translate('offerOrderedBy'));
  const category = buildControl({
    id: `${prefix}-category`,
    labelId: showLabel.id,
    options: categories,
    onSelect: (id) => onSelect({ category: id }),
  });
  const sort = buildControl({
    id: `${prefix}-sort`,
    labelId: sortLabel.id,
    options: [{ id: '', name: translate('offerLatest') }, { id: OLDEST, name: translate('offerOldest') }],
    onSelect: (id) => onSelect({ sort: id }),
  });
  const field = el('div', 'dropdown-field');
  field.append(showLabel, ' ', category.control, ' ', sortLabel, ' ', sort.control);
  const filters = el('div', 'dropdown offer-list-filters');
  filters.append(field);
  return {
    filters,
    show: (selection) => {
      category.show(selection.category);
      sort.show(selection.sort);
    },
  };
}

/**
 * The offers as a Cards (large) block, decorated by the Cards block: the photo, the title, the
 * description and a Learn more link. Placed in `container` (it must be in the page, for the
 * Cards block to load).
 * @param {Object[]} offers
 * @param {HTMLElement} container
 * @param {string} prefix Unique per block, for the ids
 * @returns {Promise<HTMLElement[]>} the card of each offer, in the same order
 */
async function renderCards(offers, container, prefix) {
  // one row per offer: the photo (or nothing), then the title, description and Learn more
  const rows = offers.map((offer, i) => {
    let picture = '';
    if (offer.image) {
      picture = el('picture');
      const img = el('img');
      // lazy before the src: this image is only read by the Cards block, which replaces it with
      // its optimized picture, so it mustn't download (a lazy image out of the page doesn't)
      img.loading = 'lazy';
      img.alt = '';
      img.src = offer.image;
      picture.append(img);
    }
    const heading = el('h3', '', offer.title);
    heading.id = `${prefix}-offer-${i + 1}`;
    const link = el('a', 'offer-list-link', translate('offerLearnMore'));
    link.href = offer.path;
    // the offer's name for screen readers, so each Learn more is told apart
    link.setAttribute('aria-describedby', heading.id);
    const more = el('p', 'offer-list-more');
    more.append(link);
    const text = offer.description ? el('p', '', offer.description) : '';
    return [picture, { elems: [heading, text, more] }];
  });
  const cards = buildBlock('cards', rows);
  cards.classList.add('large');
  container.replaceChildren(cards);
  decorateBlock(cards);
  await loadBlock(cards);
  return [...cards.querySelectorAll(':scope > ul > li')];
}

/**
 * Fills the Offer List block once its offers have loaded: the filter line and the offers,
 * newest first. Run in the background by decorate.
 * @param {HTMLElement} block
 */
async function load(block) {
  blockCount += 1;
  const prefix = `offer-list-${blockCount}`;
  const { source, pageSize } = readSettings(block);
  const url = toSourceUrl(source);
  const message = el('p', 'offer-list-message');
  const status = el('p', 'offer-list-status visually-hidden');
  status.setAttribute('aria-live', 'polite');
  const results = el('div', 'offer-list-results');
  // the page shows while the offers load: the filter line, the line and the cards are put together
  // hidden, in their final order, and shown at once (building them in view shifted the cards)
  results.hidden = true;
  block.replaceChildren(results, message, status);
  message.hidden = true;

  const fail = (text, problem) => {
    results.replaceChildren();
    message.textContent = text;
    message.hidden = false;
    if (problem) {
      // eslint-disable-next-line no-console
      console.error(`offer-list: ${problem}`);
    }
  };

  if (!url) {
    fail(translate('offerError'), `the Source "${source}" isn't a valid address`);
    return;
  }

  block.setAttribute('aria-busy', 'true');
  let offers;
  try {
    // the dropdown look comes with the data, so the filter line never shows unstyled
    const [rows] = await Promise.all([
      fetchRows(url),
      loadCSS(`${window.hlx.codeBasePath}/blocks/dropdown/dropdown.css`),
    ]);
    offers = readOffers(rows);
  } catch (error) {
    block.removeAttribute('aria-busy');
    fail(translate('offerError'), `couldn't load "${url}" (${error.message})`);
    return;
  }
  if (!offers.length) {
    block.removeAttribute('aria-busy');
    fail(translate('offerEmpty'), isPreview() && `"${url}" has no offers with a path and a title`);
    return;
  }

  const categories = categoryOptions(offers);
  const cardsWrap = el('div', 'offer-list-cards');
  results.append(cardsWrap);
  const items = await renderCards(offers, cardsWrap, prefix);
  const list = items[0]?.parentElement;

  const categoryIds = new Set(categories.map((c) => c.id).filter(Boolean));
  let selection = readSelection(categoryIds);

  // one page of the shown offers at a time, the page in the address (pagination.js); after a
  // page change, back to the top of the block with focus on the page's first offer
  const pager = createPager({
    size: pageSize,
    target: block,
    focus: () => block.querySelector('.cards li:not([hidden])'),
    onChange: ({ page }) => { block.dataset.page = page; },
  });
  results.append(pager.element);

  // the offers of the selection, in its order (ties keep the file's order), paged by the pager;
  // the others are hidden. `reset` goes back to the first page (a new selection)
  const update = (announce, reset = false) => {
    const direction = selection.sort === OLDEST ? 1 : -1;
    const shown = offers
      .filter((offer) => !selection.category
        || offer.tags.some((tag) => tag.key === selection.category))
      .sort((a, b) => direction * (a.time - b.time) || a.index - b.index);
    const shownItems = shown.map((offer) => items[offer.index]);
    const shownSet = new Set(shownItems);
    items.forEach((item) => { if (!shownSet.has(item)) item.hidden = true; });
    list?.append(...shownItems);
    pager.setItems(shownItems, { reset });
    message.textContent = shown.length ? '' : translate('offerNoMatch');
    message.hidden = !!shown.length;
    block.dataset.category = selection.category;
    block.dataset.sort = selection.sort || 'latest';
    if (announce) {
      status.textContent = translate(shown.length === 1 ? 'offerCountOne' : 'offerCount', { n: shown.length });
    }
  };

  const filters = buildFilters(prefix, categories, (change) => {
    selection = { ...selection, ...change };
    // writeSelection pushes one history entry with the page already removed
    writeSelection(selection);
    update(true, true);
  });
  results.prepend(filters.filters, el('hr', 'offer-list-divider'));
  filters.show(selection);
  // the page buttons' look first, then the first page and its buttons, all still hidden: the
  // block is shown once, complete (no layout shift)
  await pager.ready;
  update(false);
  // the first row's photos (the largest paint) load now, while the block is still hidden; the
  // first is asked for first
  const firstRow = window.matchMedia(TWO_COLUMNS).matches ? 2 : 1;
  [...block.querySelectorAll('.cards li:not([hidden]) .cards-card-image img')]
    .slice(0, firstRow)
    .forEach((img, i) => {
      img.loading = 'eager';
      if (i === 0) img.fetchPriority = 'high';
    });
  results.hidden = false;
  block.removeAttribute('aria-busy');

  // Back and Forward restore the selection and the page from the address
  window.addEventListener('popstate', () => {
    const next = readSelection(categoryIds);
    const sameSelection = next.category === selection.category && next.sort === selection.sort;
    if (sameSelection) {
      pager.sync();
      return;
    }
    selection = next;
    filters.show(selection);
    pager.sync({ render: false });
    update(true);
  });
}

/**
 * Decorates the Offer List block: an optional Source (a JSON of the offers; the page's language
 * site's /{site}-offers.json without one). Not async: the offers load in the background, so the
 * page's other blocks and sections don't wait for the JSON.
 * @param {HTMLElement} block
 */
export default function decorate(block) {
  load(block).catch((error) => {
    block.removeAttribute('aria-busy');
    // eslint-disable-next-line no-console
    console.error('offer-list: could not load', error);
  });
}
