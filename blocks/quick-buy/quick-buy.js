import { translate } from '../../scripts/i18n.js';
import { openModal } from '../../scripts/modal-dialog.js';
import {
  el, fetchPass, getApiContext, isPreview, safeHtml,
} from '../../scripts/properties.js';

// the passes service answers in about 5-7s
const TIMEOUT_MS = 30000;
const DEFAULT_CURRENCY = 'USD';
const PRODUCT_CODE = /^[A-Z0-9]+$/;
const HEADINGS = 'h1, h2, h3, h4, h5, h6';

/**
 * The currency for the prices, as the lounge pages: the page address's `currency` when it's a
 * 3-letter code, else USD.
 * @returns {string}
 */
function readCurrency() {
  const value = (new URLSearchParams(window.location.search).get('currency') || '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(value) ? value : DEFAULT_CURRENCY;
}

/**
 * An icon from /icons as an image.
 * @param {string} name
 * @param {string} alt
 * @param {string} className
 * @returns {HTMLImageElement}
 */
function icon(name, alt, className) {
  const img = el('img', className);
  img.src = `${window.hlx.codeBasePath}/icons/${name}.svg`;
  img.alt = alt;
  img.width = 17;
  img.height = 17;
  return img;
}

/**
 * The authored rows: an optional header row (a heading and intro, no product code) and one row
 * per pass: the product code | the tag (the first line) and the Best for lines (a list).
 * @param {Element} block
 * @returns {{header: Node[], products: {code: string, tag: string, lines: string[]}[],
 *   skipped: string[]}}
 */
function readRows(block) {
  const header = [];
  const products = [];
  const skipped = [];
  [...block.children].forEach((row) => {
    const [first, second] = row.children;
    const code = (first?.textContent || '').trim().toUpperCase();
    if (code && PRODUCT_CODE.test(code) && second) {
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
  return { header, products, skipped };
}

/**
 * A price as the source writes it, e.g. "USD 99.00".
 * @param {number} amount
 * @param {string} currency
 * @returns {string}
 */
function formatPrice(amount, currency) {
  return `${currency} ${amount.toFixed(2)}`;
}

/**
 * The pass's data the cards show, from the service's item.
 * @param {Object} item
 * @returns {Object|null} null without a usable price
 */
function readPass(item) {
  const price = (item.prices || []).find((p) => Number.isFinite(Number(p?.totalPrice)));
  if (!price) return null;
  const total = Number(price.totalPrice);
  const visits = Number(item.numberOfVisits) || 0;
  const currency = (price.baseRate?.[0]?.currency || '').trim();
  return {
    code: item.productCode,
    name: (item.productDisplayName || item.productName || '').trim(),
    image: (item.images || []).map((i) => i?.path).find((path) => /^https?:/.test(path || '')) || '',
    total,
    perVisit: visits > 1 ? total / visits : null,
    currency,
    points: (item.accuralPoints || '').trim(),
    description: item.productDescription || '',
    locations: (item.eligibleLocations || []).map((l) => String(l).trim()).filter(Boolean),
    catalogueCode: price.catalogueCode || '',
  };
}

/**
 * The points line as the source shows it: "+150 ST Points" with ST as the Smart Traveller icon.
 * @param {string} text
 * @param {string} className
 * @returns {HTMLElement}
 */
function buildPoints(text, className) {
  const line = el('p', className);
  const [before, after] = text.split(/\bST\b/);
  if (after === undefined) {
    line.textContent = text;
    return line;
  }
  line.append(before, icon('st-points', 'ST', `${className}-icon`), after);
  return line;
}

/**
 * The description as safe content; list items the service sent without their list get one.
 * @param {string} html
 * @returns {DocumentFragment}
 */
function buildDescription(html) {
  const content = safeHtml(html, { blocks: true });
  let list = null;
  [...content.childNodes].forEach((node) => {
    if (node.nodeName === 'LI') {
      if (!list) {
        list = el('ul');
        node.before(list);
      }
      list.append(node);
    } else if (node.nodeType !== Node.TEXT_NODE || node.textContent.trim()) list = null;
  });
  return content;
}

/**
 * Announces Add to Cart: there's no cart on this site yet, so the choice (and what the source's
 * cart needs, the catalogue code) goes out as a `quick-buy:add-to-cart` event for the hand-off.
 * @param {HTMLElement} from
 * @param {Object} pass
 */
function addToCart(from, pass) {
  from.dispatchEvent(new CustomEvent('quick-buy:add-to-cart', {
    bubbles: true,
    detail: {
      productCode: pass.code,
      catalogueCode: pass.catalogueCode,
      name: pass.name,
      price: pass.total,
      currency: pass.currency,
    },
  }));
}

/**
 * The Learn more pop-up, as the source's pass pop-up: the image, the name and where it's valid,
 * the price and points, the location tag, the description and Add to Cart.
 * @param {Object} pass
 * @param {HTMLElement} trigger
 */
function openDetails(pass, trigger) {
  openModal({
    key: `quick-buy-${pass.code}-${pass.currency}`,
    trigger,
    content: () => {
      const location = pass.locations.length
        ? translate('quickBuyLocation', { location: pass.locations.join(', ') }) : '';
      const title = el('h2', '', pass.name);
      const media = el('div', 'quick-buy-modal-media');
      if (pass.image) {
        const img = el('img');
        img.src = pass.image;
        img.alt = '';
        media.append(img);
      }
      const info = el('div', 'quick-buy-modal-info');
      const head = el('div', 'quick-buy-modal-head');
      const naming = el('div', 'quick-buy-modal-naming');
      // (the visible name; the dialog's title is the same text, for screen readers)
      naming.append(el('p', 'quick-buy-modal-name', pass.name));
      if (location) naming.append(el('p', 'quick-buy-modal-location', location));
      const pricing = el('div', 'quick-buy-modal-pricing');
      pricing.append(el('p', 'quick-buy-modal-price', formatPrice(pass.total, pass.currency)));
      // (the pop-up shows the icon before the whole text, as the source's)
      if (pass.points) {
        const points = el('p', 'quick-buy-modal-points');
        points.append(icon('st-points', '', 'quick-buy-modal-points-icon'), ` ${pass.points}`);
        pricing.append(points);
      }
      head.append(naming, pricing);
      info.append(head, el('hr', 'quick-buy-modal-rule'));
      if (location) info.append(el('p', 'quick-buy-modal-tag', location));
      const description = el('div', 'quick-buy-modal-description');
      description.append(buildDescription(pass.description));
      const add = el('button', 'button primary quick-buy-modal-add', translate('quickBuyAddToCart'));
      add.type = 'button';
      add.addEventListener('click', () => addToCart(add, pass));
      info.append(description, add);
      const nodes = [title, media, info];
      nodes.styles = ['quick-buy-modal'];
      return nodes;
    },
  });
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

  /**
   * Shows the pass's data.
   * @param {Object} pass See readPass
   */
  const fill = (pass) => {
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
    learn.addEventListener('click', () => openDetails(pass, learn));
    const add = el('button', 'quick-buy-add', translate('quickBuyAddToCart'));
    add.type = 'button';
    add.setAttribute('aria-label', `${translate('quickBuyAddToCart')}: ${pass.name}`);
    add.addEventListener('click', () => addToCart(add, pass));
    actions.append(learn, add);
    card.removeAttribute('aria-busy');
  };
  return { card, fill };
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
 * lines (and an optional heading and intro); the name, image, price, points and details come
 * from the service, with the property and airport codes from the page metadata (see
 * getApiContext) and the currency from the page address (else USD).
 * @param {Element} block
 */
export default function decorate(block) {
  const { header, products, skipped } = readRows(block);
  const context = getApiContext();
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
    context.problems.forEach((problem) => hints.push(`The page metadata ${problem} (set it in the site's metadata sheet).`));
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
    const ask = ({ product }) => fetchPass(product.code, context, currency, TIMEOUT_MS);
    const requests = cards.map(ask);
    Promise.allSettled(requests)
      .then((answers) => {
        const missing = [];
        let failed = false;
        answers.forEach((answer, i) => {
          const { product, card, fill } = cards[i];
          const pass = answer.status === 'fulfilled' && answer.value ? readPass(answer.value) : null;
          if (pass) {
            fill(pass);
            return;
          }
          card.remove();
          if (answer.status === 'rejected') {
            failed = true;
            // eslint-disable-next-line no-console
            console.error('quick-buy: could not load', product.code, answer.reason);
          } else missing.push(product.code);
        });
        const notes = [...hints, ...missing.map((code) => `${code} isn't in the passes service, or has no price.`)];
        if (failed) {
          showMessage(results, translate('quickBuyError'), load, notes);
        } else if (!grid.children.length) {
          if (isPreview()) showMessage(results, '', null, notes);
          else block.hidden = true;
        } else if (notes.length && isPreview()) {
          const note = el('div');
          showMessage(note, '', null, notes);
          results.append(note.firstChild);
        }
      });
  };
  load();
}
