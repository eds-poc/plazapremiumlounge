/*
 * Kwanko UniJS: the affiliate tag (KWKUniJS), loaded with the other tags in the delayed phase from
 * the address in the page metadata `kwanko-script` (set for every page in the metadata sheet, e.g.
 * https://lkh.plazapremiumlounge.com/js/na/na/u/45bd0b8913.js), and its page tags
 * (KWKUniJS.ptag):
 * - the home page: `{ zone: 'homepage' }`, once UniJS is in;
 * - a lounge listing page (the Property List block): `{ zone: 'listing', products: [property
 *   codes], categoryId: '' }`, sent by the block once its lounges are in (listingTag). It waits
 *   for UniJS, so the block never loads it before the delayed phase.
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
