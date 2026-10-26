/*
 * Breadcrumb: the page's parent and the page, as the source's offer pages ("Offers < Plaza Petit:
 * Discover the World Before Departure"). Built automatically when the page has the metadata
 * `breadcrumb` = `on` (set for a whole folder in the metadata sheet). The parent is the page one
 * level up in the same language folder (/zh-cn/offers for /zh-cn/offers/ctbcreward: the page named
 * after the folder, else the folder's own index page). Each item's label is that page's own
 * `breadcrumb-title` metadata, else its title; the parent's is read from its page (kept for the
 * browser session once found). Without a parent page or label, only the page itself shows. A
 * breadcrumb authored on the page (one line per item, a link on each but the last) is used as
 * written instead.
 * Keep this folder: scripts.js adds this block to the offer pages, so deleting it on a branch
 * removes it from the site when that branch merges.
 */
import { getMetadata } from '../../scripts/aem.js';
import { getSiteFolder, translate } from '../../scripts/i18n.js';

// the site name the source adds to page titles ("… | Plaza Premium Lounge"), not part of a label
const TITLE_SUFFIX = /\s*\|\s*Plaza Premium Lounge\s*$/i;
// (only parents that were found are kept: a missing one is asked for again on the next page)
const CACHE_KEY = 'ppl-breadcrumb-parent';
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
 * A page's label: its `breadcrumb-title`, else its title (without the site name).
 * @param {(name: string) => string} meta Reads a metadata value of that page
 * @param {string} [title] The page's <title>
 * @returns {string}
 */
function labelOf(meta, title = '') {
  return (meta('breadcrumb-title') || meta('og:title') || title).replace(TITLE_SUFFIX, '').trim();
}

/**
 * The parents found earlier in this browser session, by the current page's parent path.
 * @returns {Object<string, {label: string, href: string}>}
 */
function readCache() {
  try {
    return JSON.parse(sessionStorage.getItem(CACHE_KEY)) || {};
  } catch {
    return {};
  }
}

/**
 * Keeps a found parent for this session.
 * @param {string} path
 * @param {{label: string, href: string}} parent
 */
function keep(path, parent) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...readCache(), [path]: parent }));
  } catch { /* storage blocked: asked again next time */ }
}

/**
 * A page's label from its own <head> (where EDS writes both the page's Metadata table and the
 * metadata sheet's values), or null when there's no such page.
 * @param {string} href
 * @param {AbortSignal} signal
 * @returns {Promise<string|null>} '' for a page without a label
 */
async function readPage(href, signal) {
  const resp = await fetch(href, { signal });
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const doc = new DOMParser().parseFromString(await resp.text(), 'text/html');
  const meta = (name) => (doc.head.querySelector(`meta[name="${name}"], meta[property="${name}"]`)?.content || '').trim();
  return labelOf(meta, doc.title);
}

/**
 * The page's parent: the page named after the folder one level up (/zh-cn/offers), else that
 * folder's index page (/zh-cn/offers/); its label and address, or null when neither page exists,
 * it has no label, or it can't be read in time.
 * @param {string} path The parent's path, e.g. /zh-cn/offers
 * @returns {Promise<{label: string, href: string}|null>}
 */
async function readParent(path) {
  const kept = readCache()[path];
  if (kept?.label) return kept;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    let href = path;
    let label = await readPage(href, controller.signal);
    if (label === null) {
      href = `${path}/`;
      label = await readPage(href, controller.signal);
    }
    if (!label) return null;
    const parent = { label, href };
    keep(path, parent);
    return parent;
  } catch {
    // (offline, slow or failing: the page alone this time, asked again on the next page)
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The page's parent path (one level up, in the same language folder) and the page's own name;
 * null outside a language folder or on its homepage. A page right under the language folder has
 * no parent (its homepage isn't a breadcrumb level).
 * @returns {{parent: string, current: string}|null}
 */
function readLevels() {
  const site = getSiteFolder();
  if (!site) return null;
  const segments = window.location.pathname.replace(/\.html$/, '').split('/').filter(Boolean).slice(1);
  if (!segments.length) return null;
  return {
    parent: segments.length > 1 ? `/${site}/${segments.slice(0, -1).join('/')}` : '',
    current: segments[segments.length - 1],
  };
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
export default function decorate(block) {
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
    || decodeURIComponent(levels.current).replace(/[-_]+/g, ' ');
  const kept = levels.parent ? readCache()[levels.parent] : null;
  if (!levels.parent || kept?.label) {
    block.replaceChildren(buildTrail([...(kept?.label ? [kept] : []), { label: current }]));
    return;
  }
  // the row's space is kept (the page alone, hidden) while the parent is read, so nothing moves
  // and no placeholder label shows; then the parent and the page appear together. (Not awaited:
  // the section, with the offer banner, shows without waiting for the parent's page)
  block.replaceChildren(buildTrail([{ label: current }]));
  block.classList.add('is-loading');
  readParent(levels.parent).then((parent) => {
    block.replaceChildren(buildTrail([...(parent ? [parent] : []), { label: current }]));
    block.classList.remove('is-loading');
  });
}
