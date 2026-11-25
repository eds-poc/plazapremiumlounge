/*
 * The site's offers, from a query index of the offer pages (e.g. /en-uk-offers.json: path,
 * lastModified, title, description, image, tag and optionally date and showOnHomepage): the
 * language site's index, reading it in one request, its rows as offers (a page link, a title, a
 * description, an image, the tags, a date and whether it's a homepage offer), and the newest
 * first.
 */
import { DEFAULT_SITE, getSiteFolder } from './i18n.js';
import { fetchJson, toKey } from './utility.js';

const TIMEOUT_MS = 8000;
// rows asked for in the one request (the JSON gives 1000 by default without a limit)
const ROW_LIMIT = 10000;
// the site name some page titles end with (e.g. "HSBC Autumn 2026 | Plaza Premium Lounge")
const TITLE_SUFFIX = /\s*[|｜]\s*Plaza Premium Lounge\s*$/i;
// the image the index gives a page without one (/default-meta-image.png, any size)
const DEFAULT_IMAGE = /\/default-meta-image\.png(\?|$)/;

/**
 * The offers index of the page's language site (pages outside one use en-uk's).
 * @returns {string} e.g. /en-uk-offers.json
 */
export function defaultOffersSource() {
  return `/${getSiteFolder() || DEFAULT_SITE}-offers.json`;
}

/**
 * The address to fetch: the authored path (e.g. `/en-uk-offers.json`) or full address, on the
 * current site only. '' when it's invalid or another site's.
 * @param {string} source
 * @returns {string}
 */
export function toSourceUrl(source) {
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
export async function fetchRows(source) {
  const url = new URL(source);
  url.searchParams.set('limit', ROW_LIMIT);
  const json = await fetchJson(url.href, TIMEOUT_MS);
  if (!Array.isArray(json?.data)) throw new Error('Unexpected response: no data');
  return json.data;
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
 * An image of the offers JSON as a full address, from any source (a path is on this site). '' when
 * it isn't valid.
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
 * one, or repeating a page, are left out, as is the page showing them, e.g. the offers listing
 * page an index of the offers folder can include); the tags are the `tag` column split at commas;
 * `showOnHomepage` is the column's `true` (the offer page's metadata).
 * @param {Object[]} rows
 * @returns {{ path: string, title: string, description: string, image: string,
 *   tags: { key: string, name: string }[], time: number, showOnHomepage: boolean,
 *   index: number }[]}
 */
export function readOffers(rows) {
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
    // the image from any source (the blocks add their own sizes); the index's placeholder for a
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
      showOnHomepage: String(row.showOnHomepage ?? '').trim().toLowerCase() === 'true',
    };
  }).filter(Boolean).map((offer, index) => ({ ...offer, index }));
}

/**
 * The offers newest first (ties keep the file's order).
 * @param {Object[]} offers See readOffers
 * @returns {Object[]} A new list
 */
export function newestFirst(offers) {
  return [...offers].sort((a, b) => b.time - a.time || a.index - b.index);
}
