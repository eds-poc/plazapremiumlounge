/*
 * Lounge passes on the page (the quick buy and pass finder blocks): reading a pass from the passes
 * service, its price as the source writes it, the points line, the Learn more pop-up and the Add
 * to Cart button (announced; the cart takes it, scripts/cart.js), which reads Add More while the
 * pass is in the cart. The service calls are in scripts/properties.js (fetchPassList, fetchPass).
 */
import { loadCSS } from './aem.js';
import { translate } from './i18n.js';
import { openModal } from './modal-dialog.js';
import { el, safeHtml } from './properties.js';
import { isInCart, onCartChange } from './cart-state.js';
import { getCurrency } from './currency.js';

export const DEFAULT_CURRENCY = 'USD';
// the passes service answers in about 5-7s
export const PASSES_TIMEOUT_MS = 30000;
// rate plans that aren't the regular price (member and partner rates)
const OTHER_RATES = /\b(?:st\s*member|member'?s?\s*rate|partner)\b/i;
// the passes valid at every lounge (their only location)
const GLOBAL = 'global';

/**
 * The currency for the prices: the visitor's, as on the rest of the site (scripts/currency.js: the
 * page address's `currencyCode` or `currency`, else the one applied this session, else the one for
 * their location), else USD. The cart's passes follow it too (see mini-cart.js).
 * @returns {string}
 */
export function readCurrency() {
  const value = getCurrency();
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
    // for analytics (scripts/ecommerce.js), as the service gives them: the display name, the
    // service's name and the first category code ("All" is Global)
    displayName: item.productDisplayName ?? '',
    service: item.serviceDisplayName ?? '',
    category: ((code) => (code === 'All' ? 'Global' : code))(item.passCategory?.[0]?.categoryCode ?? ''),
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
 * Announces Add to Cart as an event (e.g. `quick-buy:add-to-cart`), which the cart takes
 * (scripts.js `CART_EVENTS`): the pass, by the catalogue code the cart knows it by.
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
 * Labels a pass's Add to Cart from the cart: Add More while the pass is in it (as the source's pass
 * pop-up), else Add to Cart.
 * @param {HTMLButtonElement} button
 */
function labelAdd(button) {
  const label = translate(isInCart(button.dataset.catalogueCode) ? 'quickBuyAddMore' : 'quickBuyAddToCart');
  button.textContent = label;
  if (button.dataset.passName) button.setAttribute('aria-label', `${label}: ${button.dataset.passName}`);
}

let following = false;

/**
 * A pass's Add to Cart button (its card's, or its Learn more pop-up's), announcing `eventName`.
 * Every one on the page follows the cart (an add, a removal, another tab, the stored cart).
 * @param {Object} pass
 * @param {string} className
 * @param {string} eventName
 * @param {boolean} [named] With the pass's name for screen readers (on a card)
 * @returns {HTMLButtonElement}
 */
export function buildAddButton(pass, className, eventName, named = true) {
  const add = el('button', className);
  add.type = 'button';
  // (the lounge card's Book Now has a catalogue code too: this marks a pass's)
  add.dataset.passAdd = '';
  add.dataset.catalogueCode = pass.catalogueCode;
  if (named) add.dataset.passName = pass.name;
  labelAdd(add);
  add.addEventListener('click', () => addToCart(add, pass, eventName));
  if (!following) {
    following = true;
    onCartChange(() => document.querySelectorAll('button[data-pass-add]').forEach(labelAdd));
  }
  return add;
}

/**
 * A pass's Learn more button (its card's), opening the pass's pop-up (see openPassDetails), named
 * with the pass for screen readers.
 * @param {Object} pass
 * @param {string} className
 * @param {string} eventName The pop-up's Add to Cart event
 * @returns {HTMLButtonElement}
 */
export function buildLearnButton(pass, className, eventName) {
  const learn = el('button', className, translate('quickBuyLearnMore'));
  learn.type = 'button';
  learn.setAttribute('aria-haspopup', 'dialog');
  learn.setAttribute('aria-label', `${translate('quickBuyLearnMore')}: ${pass.name}`);
  // eslint-disable-next-line no-use-before-define
  learn.addEventListener('click', () => openPassDetails(pass, learn, eventName));
  return learn;
}

// the promotional address's pass: ?selectedPassID=PRD2884 (any case)
const SELECTED_PASS = 'selectedpassid';
let selectedTaken = false;

/**
 * Puts the promotional address's pass (`?selectedPassID=`, a product code) into the cart once the
 * passes are in, as its Add to Cart would: the cart's rules first (a lounge in the cart: Checkout
 * Cart, nothing added), then the mini cart, as the source's. The parameter then leaves the address
 * (no reload), so a refresh or Back doesn't add it again (the source's adds it at every load). A
 * code that isn't in the list does nothing, as the source's; the first block that has it takes it.
 * @param {Map<string, Object>} list The passes service's passes, by product code
 * @param {HTMLElement} block
 * @param {string} eventName The block's Add to Cart event
 */
export function takeSelectedPass(list, block, eventName) {
  if (selectedTaken) return;
  const params = new URLSearchParams(window.location.search);
  const name = [...params.keys()].find((key) => key.toLowerCase() === SELECTED_PASS);
  const code = (name && params.get(name).trim().toUpperCase()) || '';
  if (!code) return;
  const item = [...list.values()].find((i) => String(i?.productCode || '').toUpperCase() === code);
  const pass = item ? readPass(item) : null;
  if (!pass?.catalogueCode) return;
  selectedTaken = true;
  params.delete(name);
  const query = params.toString();
  const { pathname, hash } = window.location;
  window.history.replaceState(window.history.state, '', `${pathname}${query ? `?${query}` : ''}${hash}`);
  // (from its card's button when the block shows it, else from the block)
  const from = [...block.querySelectorAll('button[data-pass-add]')]
    .find((b) => b.dataset.catalogueCode === pass.catalogueCode);
  addToCart(from || block, pass, eventName);
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
      info.append(description, buildAddButton(pass, 'button primary pass-modal-add', eventName, false));
      const nodes = [title, media, info];
      nodes.styles = ['pass-modal'];
      return nodes;
    },
  });
}
