/*
 * Kwanko UniJS: the affiliate tag (KWKUniJS), loaded with the other tags in the delayed phase from
 * the address in the page metadata `kwanko-script` (set for every page in the metadata sheet, e.g.
 * https://lkh.plazapremiumlounge.com/js/na/na/u/45bd0b8913.js), and its page tags
 * (KWKUniJS.ptag):
 * - the home page: `{ zone: 'homepage' }`, once UniJS is in;
 * - a listing page (the Property List, Property Filter, Product Passes, Quick Buy and Pass Finder
 *   blocks): `{ zone: 'listing', products: [codes], categoryId: '' }`, the lounges' property codes
 *   or the passes' product codes, sent by the block once they're shown (listingTag); a page's
 *   listings share one tag (Kwanko keeps the last). It waits for UniJS, so a block never loads it
 *   before the delayed phase.
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

// the products every listing on this page has tagged, in the order they were tagged: Kwanko keeps
// one listing tag a page (the last), so each tag carries them all
const taggedProducts = [];

/**
 * A listing's page tag: the products shown (lounges' property codes, passes' catalogue codes), in
 * their order, with those of the page's other listings tagged before (e.g. the passes page's
 * Quick Buy and Pass Finder).
 * @param {string[]} codes e.g. ['PRPRTY1368', 'PRPRTY1205']
 * @returns {Promise<void>}
 */
export function listingTag(codes) {
  // this listing's products not tagged yet on this page
  const newProducts = codes.filter((code) => code && !taggedProducts.includes(code));
  if (!newProducts.length) return Promise.resolve();
  taggedProducts.push(...new Set(newProducts));
  return pageTag({ zone: 'listing', products: [...taggedProducts], categoryId: '' });
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
