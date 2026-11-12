/**
 * The Product Passes block: a grid of lounge passes to buy, as the source offer pages' passes
 * (`.offer-place-wrapper`, e.g. /en-uk/offers/ppl-pass-canada). The authored table: the property
 * and airport codes the passes service asks with (`propertycode`, `iata-code`, as Quick Buy and
 * Pass Finder author them), the passes' product codes (`Products`, sent as the request's
 * `productCode` list) and the block's texts (TEXTS). The passes and everything on them come from
 * the service, in its order: the image, name, location, price, points, location tags, Learn more
 * (the shared pass pop-up) and Add to Cart (scripts/passes.js).
 */
import { translate } from '../../scripts/i18n.js';
import {
  PASSES_TIMEOUT_MS, buildAddButton, formatPrice, locationName, openPassDetails,
  readCurrency, readPass, takeSelectedPass,
} from '../../scripts/passes.js';
import {
  el, fetchPassList, getApiContext, isPreview, readApiRow, readPassList, toKey,
} from '../../scripts/properties.js';

// the cart takes a pass announced under this name (scripts/scripts.js CART_EVENTS)
const ADD_TO_CART = 'product-passes:add-to-cart';

// the settings rows (not texts): the passes' product codes (names ignore capitals and spaces)
const SETTINGS = { products: 'Products' };

// the authored texts: the block's name for each, and its row's name; a text left out isn't shown
const TEXTS = {
  empty: 'Empty message',
};

// what a product code looks like (e.g. PRD2766); others are left out, with a note on preview pages
const PRODUCT_CODE = /^[A-Z0-9]+$/;

// placeholder cards while the passes load: a row's worth at the widest layout
const PLACEHOLDERS = 3;

/**
 * Authored text, trimmed, its runs of spaces made one.
 * @param {*} value
 * @returns {string}
 */
function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * A cell's text with its lines (paragraphs, list items, line breaks) as commas.
 * @param {HTMLElement} cell
 * @returns {string}
 */
function cellText(cell) {
  const copy = cell.cloneNode(true);
  copy.querySelectorAll('br').forEach((br) => br.replaceWith(','));
  copy.querySelectorAll('p, li').forEach((line) => line.append(','));
  return copy.textContent;
}

/**
 * The authored settings, rows of name | value (names ignore capitals and spaces):
 * - `codes`: the property and airport codes (`propertycode`, `iata-code`; see readApiRow);
 * - `productCodes`: the `Products` row's codes, comma-separated (or one per line), once each;
 * - `texts`: the authored texts by their TEXTS key ('' when not authored);
 * - `notes`: what couldn't be used (rows not found or not known, codes that don't look like
 *   product codes), for preview pages.
 * @param {HTMLElement} block
 * @returns {{codes: Object<string, string>, productCodes: string[],
 *   texts: Object<string, string>, notes: string[]}}
 */
function readSettings(block) {
  const rows = [...block.children];
  const codes = {};
  rows.forEach((row) => {
    const api = readApiRow(row);
    if (api) codes[api.name] = api.value;
  });
  const cells = rows.filter((row) => !readApiRow(row)).map((row) => [...row.children]);
  const cell = (name) => cells.find((c) => c.length >= 2
    && toKey(c[0].textContent) === toKey(name))?.[1];
  const notes = [];

  const products = cell(SETTINGS.products);
  // codes separated by commas, semicolons, spaces or lines
  const listed = products ? cellText(products).split(/[,;\s]+/)
    .map((code) => code.trim().toUpperCase()).filter(Boolean) : [];
  const wrong = listed.filter((code) => !PRODUCT_CODE.test(code));
  if (wrong.length) notes.push(`${SETTINGS.products}: "${wrong.join('", "')}" left out (not a product code)`);
  const productCodes = [...new Set(listed.filter((code) => PRODUCT_CODE.test(code)))];

  const texts = Object.fromEntries(Object.entries(TEXTS)
    .map(([key, name]) => [key, clean(cell(name)?.textContent)]));
  // a row name mistyped leaves its text out without a word: say so on preview pages
  const known = [...Object.values(SETTINGS), ...Object.values(TEXTS)].map(toKey);
  const missing = [
    ...(products ? [] : [SETTINGS.products]),
    ...Object.entries(TEXTS).filter(([key]) => !texts[key]).map(([, name]) => name),
  ];
  const unknown = cells.filter((c) => c.length >= 2)
    .map((c) => clean(c[0].textContent))
    .filter((name) => name && !known.includes(toKey(name)));
  if (missing.length || unknown.length) {
    notes.push(`rows not found: ${missing.join(', ') || 'none'}; rows not known: ${unknown.join(', ') || 'none'}`);
  }
  return {
    codes, productCodes, texts, notes,
  };
}

/**
 * A pass card, as the source offer page's: the image, the name and its first location beside the
 * price and points, a dashed line, every location as a tag, Learn more (the shared pass pop-up)
 * and Add to Cart.
 * @param {Object} pass See scripts/passes.js readPass
 * @returns {HTMLElement}
 */
function buildCard(pass) {
  const card = el('li', 'product-passes-card');
  const media = el('div', 'product-passes-media');
  if (pass.image) {
    const img = el('img');
    img.src = pass.image;
    img.alt = pass.name;
    img.loading = 'lazy';
    img.decoding = 'async';
    media.append(img);
  }
  const body = el('div', 'product-passes-body');
  const head = el('div', 'product-passes-head');
  const title = el('div', 'product-passes-title');
  title.append(el('h3', 'product-passes-name', pass.name));
  const names = pass.locations.map(locationName);
  if (names.length) title.append(el('p', 'product-passes-location', names[0]));
  const pricing = el('div', 'product-passes-pricing');
  pricing.append(el('p', 'product-passes-price', formatPrice(pass.total, pass.currency)));
  // (as the source offer card writes it: "+150 ST Points", text only)
  if (pass.points) pricing.append(el('p', 'product-passes-points', pass.points));
  head.append(title, pricing);
  body.append(head);
  if (names.length) {
    const tags = el('ul', 'product-passes-tags');
    tags.append(...names.map((name) => el('li', 'product-passes-tag', name)));
    body.append(tags);
  }
  const learn = el('button', 'product-passes-learn', translate('quickBuyLearnMore'));
  learn.type = 'button';
  learn.setAttribute('aria-haspopup', 'dialog');
  learn.setAttribute('aria-label', `${translate('quickBuyLearnMore')}: ${pass.name}`);
  learn.addEventListener('click', () => openPassDetails(pass, learn, ADD_TO_CART));
  body.append(learn);
  // (the site's primary button, as the source's Add To Cart)
  const actions = el('div', 'product-passes-actions');
  actions.append(buildAddButton(pass, 'button primary product-passes-add', ADD_TO_CART));
  card.append(media, body, actions);
  return card;
}

/**
 * A placeholder card while the passes load: the image and three lines, shimmering.
 * @returns {HTMLElement}
 */
function buildPlaceholder() {
  const card = el('li', 'product-passes-card product-passes-placeholder');
  card.setAttribute('aria-hidden', 'true');
  const body = el('div', 'product-passes-body');
  body.append(...['title', 'line', 'button']
    .map((kind) => el('span', `product-passes-bone product-passes-bone-${kind}`)));
  card.append(el('div', 'product-passes-media product-passes-bone'), body);
  return card;
}

/**
 * A message in place of the passes (the service failed, or answered none), with Try again for a
 * failure, and the notes for authors on preview pages.
 * @param {HTMLElement} at
 * @param {string} text
 * @param {Function} [retry]
 * @param {string[]} [notes]
 */
function showMessage(at, text, retry, notes = []) {
  const box = el('div', 'product-passes-message');
  box.setAttribute('role', 'status');
  if (text) box.append(el('p', '', text));
  if (isPreview()) notes.forEach((note) => box.append(el('p', 'product-passes-hint', note)));
  if (retry) {
    const again = el('button', 'button secondary', translate('propertyRetry'));
    again.type = 'button';
    again.addEventListener('click', retry);
    box.append(again);
  }
  at.replaceChildren(box);
}

/**
 * Decorates the Product Passes block from its table (see readSettings). The passes load in the
 * background: the page doesn't wait for them. Without valid property and airport codes the block
 * is hidden (on preview pages it says why).
 * @param {HTMLElement} block
 */
export default function decorate(block) {
  const settings = readSettings(block);
  const api = getApiContext(settings.codes);
  const context = { ...api, productCodes: settings.productCodes };
  const notes = [...settings.notes, ...api.problems];
  block.replaceChildren();
  if (isPreview()) {
    // eslint-disable-next-line no-console
    notes.forEach((note) => console.warn(`product-passes: ${note}`));
  }
  if (api.problems.length) {
    if (isPreview()) showMessage(block, '', null, notes);
    else block.hidden = true;
    return;
  }

  const grid = el('ul', 'product-passes-grid');
  let shown = '';
  let count = 0;
  /**
   * Shows the passes from a list (the same list again leaves the cards as they are).
   * @param {Map<string, Object>} list By product code
   */
  const show = (list) => {
    const passes = [...list.values()].map(readPass).filter(Boolean);
    const data = JSON.stringify(passes);
    if (data === shown) return;
    shown = data;
    count = passes.length;
    block.removeAttribute('aria-busy');
    if (!count) {
      if (settings.texts.empty) showMessage(block, settings.texts.empty);
      else block.replaceChildren();
      return;
    }
    grid.replaceChildren(...passes.map(buildCard));
    block.replaceChildren(grid);
  };
  const load = () => {
    const currency = readCurrency();
    const kept = readPassList(context, currency);
    if (kept) show(kept);
    else {
      block.setAttribute('aria-busy', 'true');
      grid.replaceChildren(...Array.from({ length: PLACEHOLDERS }, buildPlaceholder));
      block.replaceChildren(grid);
    }
    fetchPassList(context, currency, PASSES_TIMEOUT_MS)
      .then((list) => {
        show(list);
        // the promotional address's pass (?selectedPassID=) into the cart
        takeSelectedPass(list, block, ADD_TO_CART);
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error('product-passes: could not load the passes', error);
        block.removeAttribute('aria-busy');
        // the session's passes stay; without them, Try again
        if (!count) showMessage(block, translate('quickBuyError'), load);
      });
  };
  load();
}
