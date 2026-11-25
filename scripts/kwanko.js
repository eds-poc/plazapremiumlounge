/*
 * Kwanko UniJS: the affiliate tag (KWKUniJS), loaded with the other tags in the delayed phase from
 * the address in the page metadata `kwanko-script` (set for every page in the metadata sheet, e.g.
 * https://lkh.plazapremiumlounge.com/js/na/na/u/45bd0b8913.js), and its page tags
 * (KWKUniJS.ptag):
 * - the home page: `{ zone: 'homepage' }`, once UniJS is in;
 * - a lounge listing page (the Property List block): `{ zone: 'listing', products: [property
 *   codes], categoryId: '' }`, sent by the block once its lounges are in (listingTag);
 * - a product page, the lounge detail page (the Property Detail block): `{ zone: 'product',
 *   productId: property code, categoryId: '' }`, sent by the block once the lounge is in
 *   (productTag);
 * - the basket pages (the Book Your Visit and Checkout blocks): `{ zone: 'basket', products: [{
 *   id, price, quantity }], currency }`, sent by the block once it shows the cart (basketTag).
 * The blocks' tags wait for UniJS, so a block never loads it before the delayed phase.
 * Without the metadata (or with an address that isn't https), nothing loads and no tag is sent.
 */
import { getMetadata, loadScript } from './aem.js';
// eslint-disable-next-line import/no-cycle
import { isHomePath } from './auth.js';

// UniJS, once loaded (or failed, or not set up): page tags wait for it
let markReady;
const ready = new Promise((resolve) => { markReady = resolve; });

/**
 * Sends a page tag, once UniJS is in (nothing happens when it didn't load).
 * @param {object} params e.g. { zone: 'homepage' }
 * @returns {Promise<void>}
 */
async function pageTag(params) {
  await ready;
  if (typeof window.KWKUniJS === 'undefined') return;
  try {
    window.KWKUniJS.ptag(params);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Kwanko page tag failed', params.zone, error);
  }
}

/**
 * The lounge listing's page tag: the property codes shown on the page, in their order.
 * @param {string[]} codes e.g. ['PRPRTY1368', 'PRPRTY1205']
 * @returns {Promise<void>}
 */
export function listingTag(codes) {
  const products = [...new Set(codes.filter(Boolean))];
  if (!products.length) return Promise.resolve();
  return pageTag({ zone: 'listing', products, categoryId: '' });
}

/**
 * A product page's page tag (the lounge detail page): its property code as the product, and its
 * category ('' by default, as the listing's).
 * @param {string} productId e.g. 'PRPRTY815'
 * @param {string} [categoryId]
 * @returns {Promise<void>}
 */
export function productTag(productId, categoryId = '') {
  if (!productId) return Promise.resolve();
  return pageTag({ zone: 'product', productId, categoryId });
}

/**
 * The UniJS address from the metadata `kwanko-script`, or '' when it isn't an https address.
 * @returns {string}
 */
function scriptSrc() {
  const src = getMetadata('kwanko-script').trim();
  try {
    return new URL(src).protocol === 'https:' ? src : '';
  } catch {
    return '';
  }
}

/**
 * Loads UniJS, then sends the home page's tag on a home page.
 */
export default async function initKwanko() {
  const src = scriptSrc();
  if (!src) {
    markReady();
    return;
  }
  try {
    await loadScript(src);
  } catch {
    // eslint-disable-next-line no-console
    console.warn('Kwanko UniJS failed to load', src);
  }
  markReady();
  if (isHomePath(window.location.pathname)) pageTag({ zone: 'homepage' });
}

// an amount as Kwanko takes it: a number to the cent (a dot for decimals, no thousands separator)
const amount = (value) => Math.round((Number(value) || 0) * 100) / 100;

/**
 * A basket page's page tag (the Book Your Visit and Checkout blocks, once they show the cart):
 * each of the cart's products in its order, with its unit price (after discounts) and quantity,
 * in the cart's currency (ISO 4217). A product is its lounge's or pass's property code (as the
 * listing and product tags); a lounge's add-ons follow it, by their product code.
 * @param {Object} cart The cart's summary (see readCart in cart.js)
 * @returns {Promise<void>}
 */
export function basketTag(cart) {
  const product = (id, total, quantity) => ({
    id, price: amount(total / (quantity || 1)), quantity: quantity || 1,
  });
  const products = (cart?.lines || []).flatMap((line) => [
    product(line.propertyCode || line.catalogueCode, line.total, line.quantity),
    ...(line.addons || [])
      .map((a) => product(a.productCode || a.catalogueCode, a.total, a.quantity)),
  ]).filter((p) => p.id);
  const currency = String(cart?.currency || '').toUpperCase();
  if (!products.length || !/^[A-Z]{3}$/.test(currency)) return Promise.resolve();
  return pageTag({ zone: 'basket', products, currency });
}
