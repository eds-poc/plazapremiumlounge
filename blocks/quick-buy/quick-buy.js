import { translate } from '../../scripts/i18n.js';
import {
  PASSES_TIMEOUT_MS as TIMEOUT_MS, addToCart, buildPoints, formatPrice, icon, openPassDetails,
  readCurrency, readPass,
} from '../../scripts/passes.js';
import {
  el, fetchPass, fetchPassList, getApiContext, isPreview, readApiRow, readPassList,
} from '../../scripts/properties.js';

const ADD_TO_CART = 'quick-buy:add-to-cart';
const PRODUCT_CODE = /^[A-Z0-9]+$/;
const HEADINGS = 'h1, h2, h3, h4, h5, h6';

/**
 * The authored rows: an optional header row (a heading and intro, no product code), the passes
 * service's codes (`propertycode | …`, `iata-code | …`) and one row per pass: the product code |
 * the tag (the first line) and the Best for lines (a list).
 * @param {Element} block
 * @returns {{header: Node[], codes: Object<string, string>,
 *   products: {code: string, tag: string, lines: string[]}[], skipped: string[]}}
 */
function readRows(block) {
  const header = [];
  const codes = {};
  const products = [];
  const skipped = [];
  [...block.children].forEach((row) => {
    const [first, second] = row.children;
    const code = (first?.textContent || '').trim().toUpperCase();
    // (read first: "PROPERTYCODE" looks like a product code)
    const api = readApiRow(row);
    if (api) {
      codes[api.name] = api.value;
    } else if (code && PRODUCT_CODE.test(code) && second) {
      const lines = [...second.querySelectorAll('li')]
        .map((li) => li.textContent.trim())
        .filter(Boolean);
      const texts = [...second.children]
        .filter((node) => !node.matches('ul, ol'))
        .map((node) => node.textContent.trim())
        .filter(Boolean);
      const loose = second.children.length ? '' : second.textContent.trim();
      if (loose) texts.push(loose);
      // without a list, the lines after the tag are the Best for lines
      if (!lines.length) lines.push(...texts.slice(1));
      products.push({ code, tag: texts[0] || '', lines });
    } else if (!products.length && row.querySelector(HEADINGS)) {
      [...row.children].forEach((cell) => header.push(...cell.childNodes));
    } else if (row.textContent.trim()) {
      skipped.push(row.textContent.trim().slice(0, 40));
    }
  });
  return {
    header, codes, products, skipped,
  };
}

/**
 * A pass card: the tag and Best for lines from the page straight away, the rest (image, name,
 * price, points, Learn more and Add to Cart) once the service answers.
 * @param {{code: string, tag: string, lines: string[]}} product
 * @returns {{card: HTMLElement, fill: Function}}
 */
function buildCard(product) {
  const card = el('li', 'quick-buy-card');
  card.setAttribute('aria-busy', 'true');
  if (product.tag) card.append(el('p', 'quick-buy-tag', product.tag));
  const media = el('div', 'quick-buy-media');
  const body = el('div', 'quick-buy-body');
  // the name over the price and points
  const head = el('div', 'quick-buy-head');
  const name = el('h3', 'quick-buy-name');
  const pricing = el('div', 'quick-buy-pricing');
  const price = el('p', 'quick-buy-price');
  pricing.append(price);
  head.append(name, pricing);
  body.append(head);
  const bestFor = [];
  if (product.lines.length) {
    const list = el('ul', 'quick-buy-lines');
    list.append(...product.lines.map((line) => {
      const item = el('li');
      item.append(icon('check-line', '', 'quick-buy-check'), el('span', '', line));
      return item;
    }));
    bestFor.push(el('p', 'quick-buy-best-for', translate('quickBuyBestFor')), list);
  }
  const actions = el('div', 'quick-buy-actions');
  card.append(media, body);
  body.append(...bestFor, actions);

  let shown = '';
  /**
   * Shows the pass's data (again when it changes, e.g. a fresh price after the session's kept one;
   * the same data leaves the card as it is).
   * @param {Object} pass See readPass
   */
  const fill = (pass) => {
    const data = JSON.stringify(pass);
    if (data === shown) return;
    shown = data;
    media.replaceChildren();
    price.replaceChildren();
    pricing.querySelector('.quick-buy-points')?.remove();
    actions.replaceChildren();
    if (pass.image) {
      const img = el('img');
      img.src = pass.image;
      img.alt = pass.name;
      img.loading = 'lazy';
      img.decoding = 'async';
      media.append(img);
    }
    name.textContent = pass.name;
    price.append(el('b', '', formatPrice(pass.total, pass.currency)));
    if (pass.perVisit) {
      price.append(' ', el('span', 'quick-buy-per-visit', `(${formatPrice(pass.perVisit, pass.currency)}${translate('quickBuyPerVisit')})`));
    }
    if (pass.points) price.after(buildPoints(pass.points, 'quick-buy-points'));
    const learn = el('button', 'quick-buy-learn', translate('quickBuyLearnMore'));
    learn.type = 'button';
    learn.setAttribute('aria-haspopup', 'dialog');
    learn.setAttribute('aria-label', `${translate('quickBuyLearnMore')}: ${pass.name}`);
    learn.addEventListener('click', () => openPassDetails(pass, learn, ADD_TO_CART));
    const add = el('button', 'quick-buy-add', translate('quickBuyAddToCart'));
    add.type = 'button';
    add.setAttribute('aria-label', `${translate('quickBuyAddToCart')}: ${pass.name}`);
    add.addEventListener('click', () => addToCart(add, pass, ADD_TO_CART));
    actions.append(learn, add);
    card.removeAttribute('aria-busy');
  };
  return { card, fill, isFilled: () => !!shown };
}

/**
 * A note in place of the passes (the service failed), with Try again, and a hint for authors
 * on the preview site.
 * @param {HTMLElement} at
 * @param {string} text
 * @param {Function} [retry]
 * @param {string[]} [hints]
 */
function showMessage(at, text, retry, hints = []) {
  const box = el('div', 'quick-buy-message');
  box.setAttribute('role', 'alert');
  if (text) box.append(el('p', '', text));
  if (isPreview()) hints.forEach((hint) => box.append(el('p', 'quick-buy-hint', hint)));
  if (retry) {
    const again = el('button', 'button secondary', translate('propertyRetry'));
    again.type = 'button';
    again.addEventListener('click', retry);
    box.append(again);
  }
  at.replaceChildren(box);
}

/**
 * Decorates the quick buy block: a row of passes from the passes service, as the source lounge
 * passes page's quick buy. The page authors the product codes, each pass's tag and its Best for
 * lines (and an optional heading and intro), and the property and airport codes the service asks
 * for (see getApiContext); the name, image, price, points and details come from the service, in
 * the page address's currency (`currencyCode`, else USD).
 * @param {Element} block
 */
export default function decorate(block) {
  const {
    header, codes, products, skipped,
  } = readRows(block);
  const context = getApiContext(codes);
  const hints = skipped.map((text) => `A row without a product code was left out: "${text}".`);
  block.replaceChildren();
  if (header.length) {
    const head = el('div', 'quick-buy-header');
    head.append(...header);
    head.querySelector(HEADINGS)?.classList.add('quick-buy-title');
    block.append(head);
  }
  const results = el('div', 'quick-buy-results');
  block.append(results);
  if (context.problems.length || !products.length) {
    // nothing to show visitors; authors see why on the preview site
    if (!products.length) hints.push('Add a row per pass: the product code, then its tag and Best for list.');
    hints.push(...context.problems);
    if (isPreview()) showMessage(results, '', null, hints);
    else block.hidden = true;
    return;
  }

  const currency = readCurrency();
  const load = () => {
    const grid = el('ul', 'quick-buy-grid');
    const cards = products.map((product) => ({ product, ...buildCard(product) }));
    grid.append(...cards.map(({ card }) => card));
    results.replaceChildren(grid);
    /**
     * Fills the cards whose passes are in a list.
     * @param {Map<string, Object>} list By product code
     */
    const show = (list) => cards.forEach(({ product, fill }) => {
      const item = list.get(product.code);
      const pass = item ? readPass(item) : null;
      if (pass) fill(pass);
    });
    // a page seen again in this session: the passes straight away, refreshed below
    const kept = readPassList(context, currency);
    if (kept) show(kept);
    // the passes the service says it doesn't have
    const gone = new Set();
    /**
     * Leaves out the passes the service doesn't have (or has no price for), with a hint. A pass
     * shown from the session whose own call failed stays.
     */
    const finish = (list) => {
      const missing = [];
      cards.forEach(({ product, card, isFilled }) => {
        const item = list.get(product.code);
        if (item && readPass(item)) return;
        if (item || gone.has(product.code) || !isFilled()) {
          card.remove();
          missing.push(product.code);
        }
      });
      const notes = [...hints, ...missing.map((code) => `${code} isn't in the passes service, or has no price.`)];
      if (!grid.children.length) {
        if (isPreview()) showMessage(results, '', null, notes);
        else block.hidden = true;
      } else if (notes.length && isPreview()) {
        const note = el('div');
        showMessage(note, '', null, notes);
        results.append(note.firstChild);
      }
    };
    // one call for all the passes (the service takes one code per call; its whole list answers as
    // fast as one code); a pass the list doesn't have is asked for on its own
    fetchPassList(context, currency, TIMEOUT_MS)
      .then((list) => {
        show(list);
        const others = cards.filter(({ product }) => !list.has(product.code));
        const askOne = ({ product, fill }) => fetchPass(product.code, context, currency, TIMEOUT_MS)
          .then((item) => {
            const pass = item ? readPass(item) : null;
            if (!pass) {
              gone.add(product.code);
              return;
            }
            list.set(product.code, item);
            fill(pass);
          });
        return Promise.allSettled(others.map(askOne)).then(() => finish(list));
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error('quick-buy: could not load the passes', error);
        // the session's passes stay when they're all there; otherwise, Try again
        if (!cards.every(({ isFilled }) => isFilled())) showMessage(results, translate('quickBuyError'), load, hints);
      });
  };
  load();
}
