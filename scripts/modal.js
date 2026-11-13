/*
 * Modal registry: modal content authored once, opened from anywhere on the page.
 * A section with section metadata `modal` = `name`, in the page, the nav, the footer or any
 * fragment, registers as the modal `name`; any `#name` link or button opens it. Pages in a
 * `/modals/` folder open as modals too. The dialog itself (modal-dialog.js) loads on first use.
 */

const sources = new Map();
const waiters = new Map();
const SETTLE_TIMEOUT = 5000;

/**
 * Normalises a modal name, so "#Book Now" matches section metadata "book-now".
 * @param {string} name
 * @returns {string}
 */
export function toModalName(name) {
  let decoded = name || '';
  try {
    decoded = decodeURIComponent(decoded);
  } catch { /* keep as authored */ }
  return decoded.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Parses an href against the current page.
 * @param {string} href
 * @returns {URL|null}
 */
function parse(href) {
  try {
    return new URL(href, window.location.href);
  } catch {
    return null;
  }
}

/**
 * The modal name a same-page `#name` link points to, or '' for any other link.
 * @param {string} href
 * @returns {string}
 */
export function modalNameFromHref(href) {
  const url = parse(href);
  if (!url || !url.hash || url.origin !== window.location.origin
    || url.pathname !== window.location.pathname || url.search !== window.location.search) return '';
  return toModalName(url.hash.slice(1));
}

/**
 * Whether a URL is a same-site page in a `/modals/` folder.
 * @param {string} href
 * @returns {URL|null} The parsed URL when it is a modal page
 */
export function modalPageUrl(href) {
  const url = parse(href);
  return url && url.origin === window.location.origin && url.pathname.split('/').includes('modals')
    ? url : null;
}

/**
 * Whether a modal with this name is registered.
 * @param {string} name
 * @returns {boolean}
 */
export function hasModal(name) {
  return sources.has(name);
}

/**
 * Marks a link or button that opens a registered modal, so it is announced as opening a dialog.
 * @param {HTMLElement} el
 * @returns {HTMLElement}
 */
export function markModalTrigger(el) {
  const name = modalNameFromHref(el.getAttribute('href') || el.dataset.href || '');
  if (name && sources.has(name)) {
    el.setAttribute('aria-haspopup', 'dialog');
    el.dataset.modalTrigger = name;
  }
  return el;
}

/**
 * Registers every modal section in a page body or fragment. The first section with a name wins;
 * sections stay where they are (hidden by CSS), so their blocks load normally.
 * @param {Element} root A main element (the page, or a fragment such as the nav)
 */
export function registerModalSections(root) {
  root.querySelectorAll('.section[data-modal]').forEach((section) => {
    const name = toModalName(section.dataset.modal);
    if (!name || sources.get(name) === section) return;
    if (sources.has(name)) {
      // eslint-disable-next-line no-console
      console.warn(`Modal "${name}" is defined more than once; the first one is used.`);
      return;
    }
    sources.set(name, section);
    // triggers already on the page, and in this fragment before it is attached
    [document, root].forEach((scope) => {
      scope.querySelectorAll('a[href*="#"], button[data-href*="#"]').forEach(markModalTrigger);
    });
    (waiters.get(name) || []).forEach((resolve) => resolve(section));
    waiters.delete(name);
  });
}

/**
 * Whether the header, footer and fragments have finished loading, so no more modals can register.
 * @returns {boolean}
 */
function settled() {
  return [...document.querySelectorAll('header .header, footer .footer, main .fragment')]
    .every((b) => b.dataset.blockStatus === 'loaded');
}

/**
 * Resolves with the modal section once it is registered, or null when the page has finished
 * loading without it (or after a timeout).
 * @param {string} name
 * @returns {Promise<HTMLElement|null>}
 */
export function whenModal(name) {
  if (sources.has(name)) return Promise.resolve(sources.get(name));
  if (settled()) return Promise.resolve(null);
  return new Promise((resolve) => {
    const list = waiters.get(name) || [];
    let done = false;
    const finish = (value) => { if (!done) { done = true; resolve(value); } };
    list.push(finish);
    waiters.set(name, list);
    const started = Date.now();
    const poll = setInterval(() => {
      if (sources.has(name)) finish(sources.get(name));
      else if (settled() || Date.now() - started > SETTLE_TIMEOUT) finish(null);
      if (done) clearInterval(poll);
    }, 100);
  });
}

/**
 * Opens a registered modal section by name.
 * @param {string} name
 * @param {HTMLElement} [trigger]
 */
export async function openNamedModal(name, trigger) {
  const section = sources.get(name);
  if (!section) return;
  const { openModal } = await import('./modal-dialog.js');
  openModal({ key: `#${name}`, content: () => [...section.children], trigger });
}

const pages = new Map();

/**
 * Starts loading a `/modals/` page (once), e.g. when the pointer reaches its link, so the modal
 * opens without waiting.
 * @param {URL} url
 * @returns {Promise<HTMLElement|null>} The loaded page content
 */
export function preloadPageModal(url) {
  // each view (`#name`) is its own copy of the page, so both can be open in turn
  const key = url.pathname + url.hash;
  if (!pages.has(key)) {
    pages.set(key, (async () => {
      // eslint-disable-next-line import/no-cycle
      const { loadFragment } = await import('../blocks/fragment/fragment.js');
      return loadFragment(url.pathname);
    })());
  }
  return pages.get(key);
}

/**
 * Shows one view of a modal page: `#name` keeps only the part marked `data-modal-view="name"`
 * (e.g. the Currency group of /en-uk/modals/language-currency), titled with its label.
 * @param {HTMLElement} fragment
 * @param {string} view
 */
function applyView(fragment, view) {
  const parts = [...fragment.querySelectorAll('[data-modal-view]')];
  const match = parts.find((p) => p.dataset.modalView === view);
  if (!match) return;
  parts.filter((p) => p !== match).forEach((p) => p.remove());
  match.classList.add('is-modal-view');
  const heading = fragment.querySelector('h1, h2, h3, h4, h5, h6');
  if (heading && match.dataset.modalViewTitle) heading.textContent = match.dataset.modalViewTitle;
}

/**
 * Opens a page from a `/modals/` folder as a modal. The page's section style (Section Metadata
 * `style`, e.g. `square`) styles the modal; `#name` opens one view of it.
 * @param {URL} url
 * @param {HTMLElement} [trigger]
 */
export async function openPageModal(url, trigger) {
  const { openModal } = await import('./modal-dialog.js');
  const key = url.pathname + url.hash;
  openModal({
    key,
    trigger,
    content: async () => {
      const fragment = await preloadPageModal(url);
      if (!fragment) {
        pages.delete(key);
        return [];
      }
      if (url.hash.length > 1) applyView(fragment, toModalName(url.hash.slice(1)));
      const section = fragment.querySelector(':scope > .section');
      const styles = [...(section?.classList || [])].filter((c) => c !== 'section' && !c.endsWith('-container'));
      const nodes = [...fragment.querySelectorAll(':scope > .section > div')];
      nodes.styles = styles;
      return nodes;
    },
  });
}

/**
 * Scrolls to a same-page anchor, as the browser would have.
 * @param {string} hash
 */
function scrollToAnchor(hash) {
  const id = decodeURIComponent(hash.slice(1));
  const target = document.getElementById(id);
  if (window.location.hash !== hash) window.history.pushState(null, '', hash);
  target?.scrollIntoView();
}

let installed = false;

/**
 * Lets any link on the site open a modal: `#name` opens the registered modal `name` (waiting for
 * the nav and footer if needed, else scrolling to the anchor), and `/modals/…` pages open as
 * modals. Modifier clicks keep their normal browser behaviour.
 */
export function installModalLinks() {
  if (installed) return;
  installed = true;
  document.addEventListener('click', async (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    const link = e.target.closest('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const href = link.getAttribute('href');

    const pageUrl = modalPageUrl(href);
    if (pageUrl) {
      e.preventDefault();
      openPageModal(pageUrl, link);
      return;
    }

    const name = modalNameFromHref(href);
    if (!name) return;
    if (sources.has(name)) {
      e.preventDefault();
      openNamedModal(name, link);
    } else if (!settled()) {
      // the modal may still arrive with the nav or footer
      e.preventDefault();
      const section = await whenModal(name);
      if (section) openNamedModal(name, link);
      else scrollToAnchor(new URL(href, window.location.href).hash);
    }
  });
}
