import { translate } from '../../scripts/i18n.js';
import {
  PASSES_TIMEOUT_MS, addToCart, buildPoints, formatPrice, icon, locationName, openPassDetails,
  readCurrency, readPass,
} from '../../scripts/passes.js';
import {
  el, fetchPassList, getApiContext, isPreview, readPassList,
} from '../../scripts/properties.js';

const PAGE_SIZE = 9;
const MAX_TAGS = 4;
const MAX_PLACES = 4;
const ADD_TO_CART = 'pass-finder:add-to-cart';
const HEADINGS = 'h1, h2, h3, h4, h5, h6';
const ALL = 'All';
const MULTI = 'Multi Cities';
const SORTS = ['recommended', 'price-asc', 'price-desc'];
const SEARCH_DELAY_MS = 150;
// how far an image's shape may differ from the frame's and still be shown whole (stretched)
const WHOLE_IMAGE_TOLERANCE = 0.05;
let count = 0;

/**
 * The authored row: an optional heading and intro. The passes and everything on them come from
 * the passes service.
 * @param {Element} block
 * @returns {{header: Node[], skipped: string[]}}
 */
function readRows(block) {
  const header = [];
  const skipped = [];
  [...block.children].forEach((row) => {
    if (!header.length && row.querySelector(HEADINGS)) {
      [...row.children].forEach((cell) => header.push(...cell.childNodes));
    } else if (row.textContent.trim()) {
      skipped.push(row.textContent.trim().slice(0, 40));
    }
  });
  return { header, skipped };
}

/**
 * The choices kept in the page address, as the source: `region`, `search` and `sort`.
 * @returns {{region: string, search: string, sort: string}}
 */
function readState() {
  const params = new URLSearchParams(window.location.search);
  const sort = params.get('sort') || '';
  return {
    region: (params.get('region') || '').trim() || ALL,
    search: (params.get('search') || '').trim(),
    sort: SORTS.includes(sort) ? sort : SORTS[0],
  };
}

/**
 * Writes the choices into the page address (no reload, no new history entry; the defaults are
 * left out and the address's other parameters kept).
 * @param {{region: string, search: string, sort: string}} state
 */
function writeState({ region, search, sort }) {
  const url = new URL(window.location.href);
  const set = (name, value, empty) => {
    if (value && value !== empty) url.searchParams.set(name, value);
    else url.searchParams.delete(name);
  };
  set('region', region, ALL);
  set('search', search.trim(), '');
  set('sort', sort, SORTS[0]);
  window.history.replaceState(window.history.state, '', url);
}

/**
 * Places as a phrase: "A and B", "A, B and C", or the first four and "N more regions".
 * @param {string[]} places
 * @returns {string}
 */
function joinPlaces(places) {
  if (places.length === 1) return places[0];
  if (places.length <= MAX_PLACES) {
    return translate('passFinderAnd', { list: places.slice(0, -1).join(', '), last: places[places.length - 1] });
  }
  const rest = places.length - MAX_PLACES;
  return translate('passFinderAnd', {
    list: places.slice(0, MAX_PLACES).join(', '),
    last: translate(rest === 1 ? 'passFinderMoreRegion' : 'passFinderMoreRegions', { count: rest }),
  });
}

/**
 * The note on a card for a pass valid in several places, as the source: "One visit each at …" (a
 * visit per place) or "Access lounges across …".
 * @param {Object} pass See readPass
 * @returns {string}
 */
function readNote(pass) {
  if (pass.locations.length < 2) return '';
  const places = joinPlaces(pass.locations.map(locationName));
  const key = pass.locations.length === pass.visits ? 'passFinderOneEach' : 'passFinderAcross';
  return translate(key, { places });
}

/**
 * The passes for the choices, as the source: the search (in the name and locations) and the
 * region (one location, or Multi Cities for passes valid in several) narrow them, except the
 * global passes, which always stay; sorted as chosen (Recommended keeps the service's order), with
 * the global passes last.
 * @param {Object[]} passes
 * @param {{region: string, search: string, sort: string}} state
 * @returns {Object[]}
 */
function choose(passes, { region, search, sort }) {
  const query = search.trim().toLowerCase();
  const texts = (pass) => [pass.name, ...pass.locations, ...pass.locations.map(locationName)];
  const has = (text) => text.toLowerCase().includes(query);
  const matches = (pass) => !query || texts(pass).some(has);
  const inRegion = (pass) => {
    if (region === ALL) return true;
    if (region === MULTI) return pass.locations.length > 1;
    return pass.locations.map(locationName).includes(region);
  };
  const chosen = passes.filter((pass) => pass.isGlobal || (matches(pass) && inRegion(pass)));
  const order = {
    recommended: (a, b) => a.sequence - b.sequence || a.index - b.index,
    'price-asc': (a, b) => a.total - b.total || a.index - b.index,
    'price-desc': (a, b) => b.total - a.total || a.index - b.index,
  }[sort];
  return chosen.sort((a, b) => (a.isGlobal - b.isGlobal) || order(a, b));
}

/**
 * The regions to choose from, by the name passes show (the service writes "Global" and "Global
 * Plaza Premium Lounge" for the same): All, Multi Cities, "Global Plaza Premium Lounge", then every
 * other location A-Z.
 * @param {Object[]} passes
 * @returns {{value: string, label: string}[]}
 */
function readRegions(passes) {
  const global = locationName('Global');
  const names = [...new Set(passes.flatMap((pass) => pass.locations.map(locationName)))];
  const rest = names.filter((name) => name !== global).sort((a, b) => a.localeCompare(b));
  return [
    { value: ALL, label: translate('passFinderAll') },
    { value: MULTI, label: translate('passFinderMultiCities') },
    ...[...(names.includes(global) ? [global] : []), ...rest]
      .map((name) => ({ value: name, label: name })),
  ];
}

/**
 * A pass card, as the source: the image, name, price and price per visit, points, up to four
 * location tags (+N more), the note, Learn more and Add to Cart; Best Value on the best price per
 * visit.
 * @param {Object} pass See readPass
 * @param {string} note
 * @param {boolean} bestValue
 * @returns {HTMLElement}
 */
function buildCard(pass, note, bestValue) {
  const card = el('li', 'pass-finder-card');
  if (bestValue) card.append(el('p', 'pass-finder-badge', translate('passFinderBestValue')));
  const media = el('div', 'pass-finder-media');
  if (pass.image) {
    const img = el('img');
    // most pass images are card artwork with their own rounded corners: one near the frame's
    // shape is shown whole, so nothing is cut off; any other (a photo) fills it from the centre
    img.addEventListener('load', () => {
      const frame = media.clientWidth / media.clientHeight;
      const shape = img.naturalWidth / img.naturalHeight;
      img.classList.toggle('pass-finder-image-whole', Math.abs(shape / frame - 1) <= WHOLE_IMAGE_TOLERANCE);
      media.classList.add('is-loaded');
    }, { once: true });
    img.src = pass.image;
    img.alt = pass.name;
    img.loading = 'lazy';
    img.decoding = 'async';
    media.append(img);
  }
  const body = el('div', 'pass-finder-body');
  const head = el('div', 'pass-finder-head');
  const pricing = el('div', 'pass-finder-pricing');
  const price = el('p', 'pass-finder-price');
  price.append(el('b', '', formatPrice(pass.total, pass.currency)));
  if (pass.perVisit) {
    price.append(' ', el('span', 'pass-finder-per-visit', `(${formatPrice(pass.perVisit, pass.currency)}${translate('quickBuyPerVisit')})`));
  }
  pricing.append(price);
  if (pass.points) pricing.append(buildPoints(pass.points, 'pass-finder-points'));
  head.append(el('h3', 'pass-finder-name', pass.name), pricing);
  body.append(head);
  if (pass.locations.length) {
    const tags = el('ul', 'pass-finder-tags');
    const names = pass.locations.map(locationName);
    tags.append(...names.slice(0, MAX_TAGS).map((name) => el('li', 'pass-finder-tag', name)));
    const more = names.slice(MAX_TAGS);
    if (more.length) {
      const tag = el('li', 'pass-finder-tag pass-finder-tag-more');
      tag.title = more.join(', ');
      tag.append(el('span', '', translate('passFinderMore', { count: more.length })));
      tag.firstChild.setAttribute('aria-hidden', 'true');
      tag.append(el('span', 'visually-hidden', more.join(', ')));
      tags.append(tag);
    }
    body.append(tags);
  }
  if (note) {
    const line = el('p', 'pass-finder-note');
    line.append(icon('pin-line', '', 'pass-finder-note-icon'), el('span', '', note));
    body.append(line);
  }
  const actions = el('div', 'pass-finder-actions');
  const learn = el('button', 'pass-finder-learn', translate('quickBuyLearnMore'));
  learn.type = 'button';
  learn.setAttribute('aria-haspopup', 'dialog');
  learn.setAttribute('aria-label', `${translate('quickBuyLearnMore')}: ${pass.name}`);
  learn.addEventListener('click', () => openPassDetails(pass, learn, ADD_TO_CART));
  const add = el('button', 'pass-finder-add', translate('quickBuyAddToCart'));
  add.type = 'button';
  add.setAttribute('aria-label', `${translate('quickBuyAddToCart')}: ${pass.name}`);
  add.addEventListener('click', () => addToCart(add, pass, ADD_TO_CART));
  actions.append(learn, add);
  body.append(actions);
  card.append(media, body);
  return card;
}

/**
 * A placeholder card while the passes load.
 * @returns {HTMLElement}
 */
function buildPlaceholder() {
  const card = el('li', 'pass-finder-card pass-finder-placeholder');
  card.setAttribute('aria-hidden', 'true');
  const body = el('div', 'pass-finder-body');
  body.append(el('span', 'pass-finder-bar'), el('span', 'pass-finder-bar pass-finder-bar-short'));
  card.append(el('div', 'pass-finder-media'), body);
  return card;
}

/**
 * A note in place of the passes (the service failed), with Try again, and hints for authors on
 * the preview site.
 * @param {HTMLElement} at
 * @param {string} text
 * @param {Function} [retry]
 * @param {string[]} [hints]
 */
function showMessage(at, text, retry, hints = []) {
  const box = el('div', 'pass-finder-message');
  box.setAttribute('role', 'alert');
  if (text) box.append(el('p', '', text));
  if (isPreview()) hints.forEach((hint) => box.append(el('p', 'pass-finder-hint', hint)));
  if (retry) {
    const again = el('button', 'button secondary', translate('propertyRetry'));
    again.type = 'button';
    again.addEventListener('click', retry);
    box.append(again);
  }
  at.replaceChildren(box);
}

/**
 * The search, region and sort controls.
 * @param {Object} state The choices (changed in place)
 * @param {Function} onChange Called with what changed ('search', 'region' or 'sort')
 * @returns {{element: HTMLElement, count: HTMLElement, setRegions: Function}}
 */
function buildControls(state, onChange) {
  count += 1;
  const id = `pass-finder-${count}`;
  const element = el('div', 'pass-finder-controls');
  const toolbar = el('div', 'pass-finder-toolbar');

  const searchBox = el('div', 'pass-finder-search');
  const search = el('input');
  search.type = 'search';
  search.id = `${id}-search`;
  search.placeholder = translate('passFinderSearch');
  search.setAttribute('aria-label', translate('passFinderSearch'));
  search.value = state.search;
  search.autocomplete = 'off';
  let timer;
  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.search = search.value;
      onChange('search');
    }, SEARCH_DELAY_MS);
  });
  searchBox.append(search);

  // the region: a button opening a list (with its own search), as the source
  const region = el('div', 'pass-finder-region');
  const button = el('button', 'pass-finder-region-button');
  button.type = 'button';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', `${id}-regions`);
  const buttonText = el('span', 'pass-finder-region-text');
  const arrow = el('span', 'pass-finder-region-arrow', '▼');
  arrow.setAttribute('aria-hidden', 'true');
  button.append(buttonText, arrow);
  const panel = el('div', 'pass-finder-region-panel');
  panel.id = `${id}-regions`;
  panel.hidden = true;
  const filter = el('input', 'pass-finder-region-search');
  filter.type = 'search';
  filter.placeholder = translate('passFinderSearchLocation');
  filter.setAttribute('aria-label', translate('passFinderSearchLocation'));
  filter.autocomplete = 'off';
  const list = el('ul', 'pass-finder-region-list');
  list.setAttribute('aria-label', translate('passFinderRegion'));
  panel.append(filter, list);
  region.append(button, panel);
  let regions = [];
  const label = () => regions.find((r) => r.value === state.region)?.label || translate('passFinderAll');
  const drawOptions = () => {
    const query = filter.value.trim().toLowerCase();
    const shownRegions = regions.filter((r) => !query || r.label.toLowerCase().includes(query));
    list.replaceChildren(...shownRegions.map((r) => {
      const item = el('li');
      const option = el('button', 'pass-finder-region-option', r.label);
      option.type = 'button';
      option.setAttribute('aria-pressed', String(r.value === state.region));
      option.dataset.region = r.value;
      item.append(option);
      return item;
    }));
  };
  const close = (refocus) => {
    if (panel.hidden) return;
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (refocus) button.focus();
  };
  button.addEventListener('click', () => {
    if (!panel.hidden) {
      close();
      return;
    }
    filter.value = '';
    drawOptions();
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    filter.focus();
  });
  filter.addEventListener('input', drawOptions);
  list.addEventListener('click', (e) => {
    const option = e.target.closest('.pass-finder-region-option');
    if (!option) return;
    state.region = option.dataset.region;
    buttonText.textContent = label();
    close(true);
    onChange('region');
  });
  region.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) {
      e.preventDefault();
      close(true);
    }
  });
  document.addEventListener('pointerdown', (e) => {
    if (!region.contains(e.target)) close();
  });
  region.addEventListener('focusout', (e) => {
    if (e.relatedTarget && !region.contains(e.relatedTarget)) close();
  });
  toolbar.append(searchBox, region);

  const summary = el('div', 'pass-finder-summary');
  const found = el('p', 'pass-finder-count');
  found.setAttribute('aria-live', 'polite');
  const sortBox = el('div', 'pass-finder-sort');
  const sortLabel = el('label', '', translate('passFinderSortBy'));
  const sort = el('select');
  sort.id = `${id}-sort`;
  sortLabel.htmlFor = sort.id;
  const sorts = {
    recommended: 'passFinderSortRecommended',
    'price-asc': 'passFinderSortPriceUp',
    'price-desc': 'passFinderSortPriceDown',
  };
  Object.entries(sorts).forEach(([value, key]) => {
    const option = el('option', '', translate(key));
    option.value = value;
    sort.append(option);
  });
  sort.value = state.sort;
  sort.addEventListener('change', () => {
    state.sort = sort.value;
    onChange('sort');
  });
  sortBox.append(sortLabel, sort);
  summary.append(found, sortBox);
  element.append(toolbar, summary);

  /**
   * The regions to offer (from the passes); a region the passes don't have falls back to All.
   * @param {{value: string, label: string}[]} options
   */
  const setRegions = (options) => {
    regions = options;
    if (!regions.some((r) => r.value === state.region)) state.region = ALL;
    buttonText.textContent = label();
    if (!panel.hidden) drawOptions();
  };
  buttonText.textContent = label();
  return { element, count: found, setRegions };
}

/**
 * Decorates the pass finder block: every lounge pass from the passes service, with the source
 * Lounge Passes page's search, region and sort (kept in the page address), cards and pages of
 * nine. Every pass the service lists is shown as it gives it; the page authors only the heading and
 * intro. The property and airport codes come from the page metadata (see getApiContext), the
 * currency from the page address (else USD). The passes list is the same as the quick buy's (one
 * call, kept for the session).
 * @param {Element} block
 */
export default function decorate(block) {
  const { header, skipped } = readRows(block);
  const context = getApiContext();
  const leftOut = 'A row that isn\'t the heading was left out (the passes come from the service)';
  const hints = skipped.map((text) => `${leftOut}: "${text}".`);
  block.replaceChildren();
  if (header.length) {
    const head = el('div', 'pass-finder-header');
    head.append(...header);
    head.querySelector(HEADINGS)?.classList.add('pass-finder-title');
    block.append(head);
  }
  const results = el('div', 'pass-finder-results');
  if (context.problems.length) {
    context.problems.forEach((problem) => hints.push(`The page metadata ${problem} (set it in the site's metadata sheet).`));
    block.append(results);
    if (isPreview()) showMessage(results, '', null, hints);
    else block.hidden = true;
    return;
  }

  const state = { ...readState(), page: 1 };
  let passes = [];
  let shown = '';
  const grid = el('ul', 'pass-finder-grid');
  const empty = el('div', 'pass-finder-empty');
  empty.hidden = true;
  empty.append(el('p', 'pass-finder-empty-title', translate('passFinderEmpty')), el('p', '', translate('passFinderEmptyHint')));
  const pager = el('nav', 'pass-finder-pager');
  pager.setAttribute('aria-label', translate('passFinderPages'));

  /**
   * Draws the passes for the choices, and the pages.
   * @param {string} [focusPage] The pager button to focus afterwards (after a page change)
   */
  const render = (focusPage) => {
    const chosen = choose(passes, state);
    const pages = Math.max(1, Math.ceil(chosen.length / PAGE_SIZE));
    state.page = Math.min(state.page, pages);
    const perVisit = (pass) => (pass.visits > 0 ? pass.total / pass.visits : Infinity);
    const best = Math.min(...chosen.map(perVisit));
    // eslint-disable-next-line no-use-before-define
    controls.count.textContent = chosen.length === 1
      ? translate('passFinderFoundOne') : translate('passFinderFound', { count: chosen.length });
    const onPage = chosen.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
    const card = (pass) => buildCard(pass, readNote(pass), perVisit(pass) === best);
    grid.replaceChildren(...onPage.map(card));
    grid.hidden = !chosen.length;
    empty.hidden = !!chosen.length;
    pager.replaceChildren();
    if (pages > 1) {
      const button = (text, page, labelText, extra) => {
        const b = el('button', `pass-finder-page${extra ? ` ${extra}` : ''}`, text);
        b.type = 'button';
        b.dataset.page = page;
        if (labelText) b.setAttribute('aria-label', labelText);
        return b;
      };
      const prev = button('←', 'prev', translate('passFinderPrevious'), 'pass-finder-page-prev');
      prev.disabled = state.page === 1;
      const next = button('→', 'next', translate('passFinderNextPage'), 'pass-finder-page-next');
      next.disabled = state.page === pages;
      const numbers = Array.from({ length: pages }, (_, i) => {
        const b = button(String(i + 1), String(i + 1), translate('passFinderPage', { n: i + 1 }));
        if (i + 1 === state.page) b.setAttribute('aria-current', 'page');
        return b;
      });
      pager.append(prev, ...numbers, next);
      if (focusPage) {
        const target = pager.querySelector(`[data-page="${focusPage}"]:not(:disabled)`)
          || pager.querySelector('[aria-current="page"]');
        target?.focus({ preventScroll: true });
      }
    }
  };
  pager.addEventListener('click', (e) => {
    const b = e.target.closest('.pass-finder-page');
    if (!b || b.disabled) return;
    const { page } = b.dataset;
    if (page === 'prev') state.page -= 1;
    else if (page === 'next') state.page += 1;
    else state.page = Number(page);
    render(page);
    // back to the top of the passes, as the source
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    block.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  });
  const controls = buildControls(state, () => {
    state.page = 1;
    writeState(state);
    render();
  });
  results.append(grid, empty, pager);
  block.append(controls.element, results);

  /**
   * Shows the passes from a list (the same list again leaves the cards as they are).
   * @param {Map<string, Object>} list By product code
   */
  const show = (list) => {
    const next = [...list.values()]
      .map(readPass)
      .filter(Boolean)
      .map((pass, index) => ({ ...pass, index }));
    const data = JSON.stringify(next);
    if (data === shown) return;
    shown = data;
    passes = next;
    controls.setRegions(readRegions(passes));
    results.classList.remove('is-loading');
    render();
  };

  const load = () => {
    results.replaceChildren(grid, empty, pager);
    const kept = readPassList(context, readCurrency());
    if (kept) show(kept);
    else {
      results.classList.add('is-loading');
      grid.replaceChildren(...Array.from({ length: 3 }, buildPlaceholder));
      controls.count.textContent = '';
    }
    fetchPassList(context, readCurrency(), PASSES_TIMEOUT_MS)
      .then((list) => {
        show(list);
        if (hints.length && isPreview()) {
          const note = el('div');
          showMessage(note, '', null, hints);
          results.append(note.firstChild);
        }
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error('pass-finder: could not load the passes', error);
        // the session's passes stay; without them, Try again
        if (!passes.length) showMessage(results, translate('quickBuyError'), load, hints);
      });
  };
  load();
}
