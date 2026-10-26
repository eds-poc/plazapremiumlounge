/*
 * Breadcrumb: the trail from the page's section to the page, as the source's offer pages
 * ("Offers < Plaza Petit: Discover the World Before Departure"). Built automatically when the page
 * has the metadata `breadcrumb` = `on` (set for a whole folder in the metadata sheet), from the
 * address: one level per folder under the language folder (e.g. /en-uk/offers), then the page.
 * Each level's label is that page's own `breadcrumb-title` metadata, else its title; the parents'
 * are read from their pages (once per browser session). A breadcrumb authored on the page (one
 * line per level, a link on each but the last) is used as written instead.
 */
import { getMetadata } from '../../scripts/aem.js';
import { getSiteFolder, translate } from '../../scripts/i18n.js';

// the site name the source adds to page titles ("… | Plaza Premium Lounge"), not part of a label
const TITLE_SUFFIX = /\s*\|\s*Plaza Premium Lounge\s*$/i;
const CACHE_KEY = 'ppl-breadcrumb';
const FETCH_TIMEOUT_MS = 8000;

/**
 * Creates an element with an optional class name and text.
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 * @returns {HTMLElement}
 */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/**
 * A label from a folder or page name ("lounge-passes" → "Lounge Passes"), when its page has none.
 * @param {string} slug
 * @returns {string}
 */
function labelFromSlug(slug) {
  return decodeURIComponent(slug).replace(/[-_]+/g, ' ').replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

/**
 * A page's label: its `breadcrumb-title`, else its title (without the site name).
 * @param {(name: string) => string} meta Reads a metadata value of that page
 * @param {string} [title] The page's <title>
 * @returns {string}
 */
function labelOf(meta, title = '') {
  return (meta('breadcrumb-title') || meta('og:title') || title).replace(TITLE_SUFFIX, '').trim();
}

/**
 * The labels kept for this browser session, by page path.
 * @returns {Object<string, {label: string, exists: boolean}>}
 */
function readCache() {
  try {
    return JSON.parse(sessionStorage.getItem(CACHE_KEY)) || {};
  } catch {
    return {};
  }
}

/**
 * Keeps a parent page's label for this session.
 * @param {string} path
 * @param {{label: string, exists: boolean}} entry
 */
function keep(path, entry) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...readCache(), [path]: entry }));
  } catch { /* storage blocked: asked again next time */ }
}

/**
 * A parent page's label and whether the page exists, from its own metadata (its <head>, where
 * EDS writes both the page's Metadata table and the metadata sheet's values).
 * @param {string} path
 * @returns {Promise<{label: string, exists: boolean}>}
 */
async function readParent(path) {
  const kept = readCache()[path];
  if (kept) return kept;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(path, { signal: controller.signal });
    if (!resp.ok) {
      const entry = { label: '', exists: false };
      if (resp.status === 404) keep(path, entry);
      return entry;
    }
    const doc = new DOMParser().parseFromString(await resp.text(), 'text/html');
    const meta = (name) => (doc.head.querySelector(`meta[name="${name}"], meta[property="${name}"]`)?.content || '').trim();
    const entry = { label: labelOf(meta, doc.title), exists: true };
    keep(path, entry);
    return entry;
  } catch {
    // (offline or slow: the folder's name for now, asked again on the next page)
    return { label: '', exists: false };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The trail's levels for this page: each folder under the language folder, then the page; []
 * outside a language folder or on its homepage.
 * @returns {{parents: {path: string, slug: string}[], current: string}|null}
 */
function readLevels() {
  const site = getSiteFolder();
  if (!site) return null;
  const segments = window.location.pathname.replace(/\.html$/, '').split('/').filter(Boolean).slice(1);
  if (!segments.length) return null;
  const parents = segments.slice(0, -1).map((slug, i) => ({
    path: `/${site}/${segments.slice(0, i + 1).join('/')}`,
    slug,
  }));
  return { parents, current: segments[segments.length - 1] };
}

/**
 * The trail as the source writes it: a named list, a link per level, the page last.
 * @param {{label: string, href?: string}[]} items
 * @returns {HTMLElement}
 */
function buildTrail(items) {
  const nav = el('nav');
  nav.setAttribute('aria-label', translate('breadcrumb'));
  const list = el('ol', 'breadcrumb-list');
  items.forEach(({ label, href }, i) => {
    const li = el('li', 'breadcrumb-item');
    if (i === items.length - 1) {
      li.textContent = label;
      li.setAttribute('aria-current', 'page');
    } else if (href) {
      const link = el('a', '', label);
      link.href = href;
      li.append(link);
    } else li.textContent = label;
    list.append(li);
  });
  nav.append(list);
  return nav;
}

/**
 * The authored lines: one per level (a paragraph or list item), a link on each but the last.
 * @param {Element} block
 * @returns {{label: string, href?: string}[]}
 */
function readAuthored(block) {
  return [...block.querySelectorAll('p, li')]
    .filter((line) => !line.querySelector('p, li') && line.textContent.trim())
    .map((line) => ({ label: line.textContent.trim(), href: line.querySelector('a[href]')?.getAttribute('href') }));
}

/**
 * Decorates the breadcrumb: the authored trail, else the one built from the address.
 * @param {Element} block
 */
export default async function decorate(block) {
  const authored = readAuthored(block);
  if (authored.length) {
    block.replaceChildren(buildTrail(authored));
    return;
  }
  const levels = readLevels();
  if (!levels) {
    block.closest('.breadcrumb-wrapper')?.remove();
    block.remove();
    return;
  }
  const current = labelOf((name) => getMetadata(name), document.title)
    || document.querySelector('main h1')?.textContent.trim()
    || labelFromSlug(levels.current);
  // drawn straight away (the parents' kept labels, else their folder names), then each parent's
  // own label once read
  const cache = readCache();
  const items = levels.parents.map(({ path, slug }) => ({
    path,
    slug,
    label: cache[path]?.label || labelFromSlug(slug),
    href: cache[path]?.exists === false ? '' : path,
  }));
  const draw = () => block.replaceChildren(buildTrail([...items, { label: current }]));
  draw();
  const read = await Promise.all(items.map((item) => readParent(item.path)));
  let changed = false;
  read.forEach(({ label, exists }, i) => {
    const next = { label: label || labelFromSlug(items[i].slug), href: exists ? items[i].path : '' };
    if (next.label !== items[i].label || next.href !== items[i].href) changed = true;
    Object.assign(items[i], next);
  });
  if (changed) draw();
}
