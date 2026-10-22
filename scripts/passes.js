/*
 * Lounge passes on the page (the quick buy and pass finder blocks): reading a pass from the passes
 * service, its price as the source writes it, the points line, the Learn more pop-up and the Add
 * to Cart announcement. The service calls are in scripts/properties.js (fetchPassList, fetchPass).
 */
import { loadCSS } from './aem.js';
import { translate } from './i18n.js';
import { openModal } from './modal-dialog.js';
import { el, safeHtml } from './properties.js';

export const DEFAULT_CURRENCY = 'USD';
// the passes service answers in about 5-7s
export const PASSES_TIMEOUT_MS = 30000;
// rate plans that aren't the regular price (member and partner rates)
const OTHER_RATES = /\b(?:st\s*member|member'?s?\s*rate|partner)\b/i;
// the passes valid at every lounge (their only location)
const GLOBAL = 'global';

/**
 * The currency for the prices, as the lounge pages: the page address's `currency` when it's a
 * 3-letter code, else USD.
 * @returns {string}
 */
export function readCurrency() {
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
export function icon(name, alt, className) {
  const img = el('img', className);
  img.src = `${window.hlx.codeBasePath}/icons/${name}.svg`;
  img.alt = alt;
  img.width = 17;
  img.height = 17;
  return img;
}

/**
 * A price as the source writes it, e.g. "USD 99.00".
 * @param {number} amount
 * @param {string} currency
 * @returns {string}
 */
export function formatPrice(amount, currency) {
  return `${currency} ${amount.toFixed(2)}`;
}

/**
 * The rate plan whose price a pass shows: the regular one (not a Smart Traveller member or
 * partner rate) that still has passes, else the first regular one, else the first with a price.
 * The service lists them in no fixed order and doesn't mark which is which.
 * @param {Object[]} prices
 * @returns {Object|undefined}
 */
function pickPrice(prices) {
  const priced = (prices || []).filter((p) => Number.isFinite(Number(p?.totalPrice)));
  const regular = priced.filter((p) => !OTHER_RATES.test(p.priceName || ''));
  const inStock = (p) => p.availableInventory === undefined || Number(p.availableInventory) > 0;
  return regular.find(inStock) || regular[0] || priced[0];
}

/**
 * A location as the source names it ("Global" is "Global Plaza Premium Lounge").
 * @param {string} location
 * @returns {string}
 */
export function locationName(location) {
  return location.toLowerCase() === GLOBAL ? translate('quickBuyLocation', { location }) : location;
}

/**
 * The pass's data the blocks show, from the service's item.
 * @param {Object} item
 * @returns {Object|null} null without a usable price
 */
export function readPass(item) {
  const price = pickPrice(item.prices);
  if (!price) return null;
  const total = Number(price.totalPrice);
  const visits = Number(item.numberOfVisits) || 0;
  const currency = (price.baseRate?.[0]?.currency || '').trim();
  const locations = (item.eligibleLocations || []).map((l) => String(l).trim()).filter(Boolean);
  return {
    code: item.productCode,
    name: (item.productDisplayName || item.productName || '').trim(),
    image: (item.images || []).map((i) => i?.path).find((path) => /^https?:/.test(path || '')) || '',
    total,
    visits,
    perVisit: visits > 1 ? total / visits : null,
    currency,
    points: (item.accuralPoints || '').trim(),
    description: item.productDescription || '',
    locations,
    isGlobal: locations.length === 1 && locations[0].toLowerCase() === GLOBAL,
    sequence: Number.isFinite(Number(item.productSeq)) ? Number(item.productSeq) : Infinity,
    catalogueCode: price.catalogueCode || '',
  };
}

/**
 * The points line as the source shows it: "+150 ST Points" with ST as the Smart Traveller icon.
 * @param {string} text
 * @param {string} className
 * @returns {HTMLElement}
 */
export function buildPoints(text, className) {
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
 * cart needs, the catalogue code) goes out as an event (e.g. `quick-buy:add-to-cart`) for the
 * hand-off.
 * @param {HTMLElement} from
 * @param {Object} pass
 * @param {string} eventName
 */
export function addToCart(from, pass, eventName) {
  from.dispatchEvent(new CustomEvent(eventName, {
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
 * the price and points, the location tag, the description and Add to Cart (announced as
 * `eventName`).
 * @param {Object} pass
 * @param {HTMLElement} trigger
 * @param {string} eventName
 */
export async function openPassDetails(pass, trigger, eventName) {
  await loadCSS(`${window.hlx.codeBasePath}/styles/passes.css`);
  openModal({
    key: `pass-${pass.code}-${pass.currency}-${pass.total}-${pass.catalogueCode}`,
    trigger,
    content: () => {
      const location = pass.locations.length
        ? translate('quickBuyLocation', { location: pass.locations.join(', ') }) : '';
      const title = el('h2', '', pass.name);
      const media = el('div', 'pass-modal-media');
      if (pass.image) {
        const img = el('img');
        img.src = pass.image;
        img.alt = '';
        media.append(img);
      }
      const info = el('div', 'pass-modal-info');
      const head = el('div', 'pass-modal-head');
      const naming = el('div', 'pass-modal-naming');
      // (the visible name; the dialog's title is the same text, for screen readers)
      naming.append(el('p', 'pass-modal-name', pass.name));
      if (location) naming.append(el('p', 'pass-modal-location', location));
      const pricing = el('div', 'pass-modal-pricing');
      pricing.append(el('p', 'pass-modal-price', formatPrice(pass.total, pass.currency)));
      // (the pop-up shows the icon before the whole text, as the source's)
      if (pass.points) {
        const points = el('p', 'pass-modal-points');
        points.append(icon('st-points', '', 'pass-modal-points-icon'), ` ${pass.points}`);
        pricing.append(points);
      }
      head.append(naming, pricing);
      info.append(head, el('hr', 'pass-modal-rule'));
      if (location) info.append(el('p', 'pass-modal-tag', location));
      const description = el('div', 'pass-modal-description');
      description.append(buildDescription(pass.description));
      const add = el('button', 'button primary pass-modal-add', translate('quickBuyAddToCart'));
      add.type = 'button';
      add.addEventListener('click', () => addToCart(add, pass, eventName));
      info.append(description, add);
      const nodes = [title, media, info];
      nodes.styles = ['pass-modal'];
      return nodes;
    },
  });
}
