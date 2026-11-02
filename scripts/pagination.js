/*
 * Pagination for list blocks, as the source offers page's (`ul.pagination`): « and » when there's
 * a page before or after, every page number (with … gaps when there are many), the current page
 * filled. The block keeps its items and shows one page of them; this draws the buttons, keeps the
 * page in the address (`?page=2`) and brings the visitor back to the top of the list on a change.
 * Its look is styles/pagination.css, loaded here; its class names (`pagination`, `pagination-…`)
 * are global, so "pagination" can't be used as a block name.
 */
import { loadCSS } from './aem.js';
import { translate } from './i18n.js';

export const PAGE_PARAM = 'page';
export const DEFAULT_PAGE_SIZE = 10;
// up to this many pages, every number shows; above it, the first, the last and the current
// page's neighbours, with … between
const ALL_NUMBERS = 7;

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
 * A page size from authored text (e.g. `10`): a whole number of at least 1, else the default.
 * @param {string} value
 * @param {number} [fallback]
 * @returns {number}
 */
export function readPageSize(value, fallback = DEFAULT_PAGE_SIZE) {
  const size = Number.parseInt(String(value ?? '').trim(), 10);
  return size >= 1 ? size : fallback;
}

/**
 * The number of pages for a number of items (at least 1).
 * @param {number} count
 * @param {number} size
 * @returns {number}
 */
export function pageCount(count, size) {
  return Math.max(1, Math.ceil(count / size));
}

/**
 * The page in the address: `?page=2`; 1 when there's none or it isn't a whole number of at
 * least 1. Callers keep it within their page count.
 * @returns {number}
 */
export function readPage(param = PAGE_PARAM) {
  const params = new URLSearchParams(window.location.search);
  const page = Number.parseInt(params.get(param) ?? '', 10);
  return page >= 1 ? page : 1;
}

/**
 * Sets the page in an address (page 1 removes it); writePage puts it in the page address.
 * @param {URL} url The address to change (e.g. one a filter is also writing to)
 * @param {number} page
 * @returns {URL} the same address
 */
export function setPage(url, page, param = PAGE_PARAM) {
  if (page > 1) url.searchParams.set(param, page);
  else url.searchParams.delete(param);
  return url;
}

/**
 * Writes the page into the page address (see setPage), as a new history entry; with `replace`,
 * in place (e.g. to correct a page past the last, without a Back step).
 * @param {number} page
 * @param {{ replace?: boolean, param?: string }} [options]
 */
export function writePage(page, { replace = false, param = PAGE_PARAM } = {}) {
  const url = setPage(new URL(window.location.href), page, param);
  if (url.href === window.location.href) return;
  if (replace) window.history.replaceState(window.history.state, '', url);
  else window.history.pushState(window.history.state, '', url);
}

/**
 * The page numbers to show, with null for a … gap: every page up to ALL_NUMBERS, else the first,
 * the last and the current page with its neighbours (five in a row at either end).
 * @param {number} page
 * @param {number} pages
 * @returns {(number|null)[]}
 */
export function pageNumbers(page, pages) {
  const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
  if (pages <= ALL_NUMBERS) return range(1, pages);
  if (page <= 4) return [...range(1, 5), null, pages];
  if (page >= pages - 3) return [1, null, ...range(pages - 4, pages)];
  return [1, null, page - 1, page, page + 1, null, pages];
}

/**
 * The pagination of a list: a navigation landmark of page buttons, hidden while there's one page.
 * Choosing a page calls `onSelect(page)` (the block shows that page, and calls `show` again),
 * announces "Page 2 of 13", brings `target` (the list) back into view below the header, and
 * moves focus to `focus()` (e.g. the page's first title; else `target`).
 * @param {{ onSelect: function(number): void, target?: HTMLElement,
 *   focus?: function(): (HTMLElement|null), label?: string }} options
 *   `label` names the landmark when a page has several lists (default "Pagination")
 * @returns {{ element: HTMLElement, show: function(number, number): void, ready: Promise }}
 *   `show(page, pages)` draws the buttons for a page; `ready` settles when the look is loaded
 */
export function createPagination({
  onSelect, target, focus, label,
}) {
  // settles either way: without the look, the buttons still work
  const ready = loadCSS(`${window.hlx.codeBasePath}/styles/pagination.css`).catch(() => {});
  const nav = el('nav', 'pagination');
  nav.setAttribute('aria-label', label || translate('paginationLabel'));
  const list = el('ul', 'pagination-list');
  // "Page 2 of 13" after a change (the buttons alone don't say the page changed)
  const status = el('p', 'pagination-status visually-hidden');
  status.setAttribute('aria-live', 'polite');
  nav.append(list, status);
  nav.hidden = true;
  if (target) target.classList.add('pagination-target');

  // focus without a focus ring for a mouse click (an element that isn't otherwise focusable)
  const moveFocus = (element) => {
    if (!element) return;
    if (!element.matches('a[href], button, input, select, textarea, [tabindex]')) {
      element.tabIndex = -1;
      element.classList.add('pagination-focus');
    }
    element.focus({ preventScroll: true });
  };

  let current = 1;
  let total = 1;

  const button = (text, page, name, className) => {
    const item = el('li', 'pagination-item');
    const b = el('button', `pagination-button${className ? ` ${className}` : ''}`, text);
    b.type = 'button';
    b.dataset.page = page;
    b.setAttribute('aria-label', name);
    item.append(b);
    return item;
  };

  const show = (page, pages) => {
    total = Math.max(1, pages);
    current = Math.min(Math.max(1, page), total);
    nav.hidden = total <= 1;
    if (nav.hidden) {
      list.replaceChildren();
      return;
    }
    const items = pageNumbers(current, total).map((n) => {
      if (n === null) {
        const gap = el('li', 'pagination-item pagination-gap', '…');
        gap.setAttribute('aria-hidden', 'true');
        return gap;
      }
      const item = button(String(n), n, translate('paginationPage', { n }));
      if (n === current) item.firstElementChild.setAttribute('aria-current', 'page');
      return item;
    });
    if (current > 1) {
      items.unshift(button('«', current - 1, translate('paginationPrevious'), 'pagination-prev'));
    }
    if (current < total) {
      items.push(button('»', current + 1, translate('paginationNext'), 'pagination-next'));
    }
    list.replaceChildren(...items);
  };

  nav.addEventListener('click', (e) => {
    const b = e.target.closest('.pagination-button');
    const page = Number(b?.dataset.page);
    if (!page || page === current) return;
    onSelect(page);
    // the chosen page (onSelect is expected to call show; if it didn't, the page asked for)
    const shown = current === page ? current : Math.min(page, total);
    status.textContent = translate('paginationStatus', { n: shown, total });
    // back to the top of the list (below the header, see the CSS), focus on its new first item
    if (target) {
      const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
    }
    moveFocus(focus?.() || target);
  });

  return { element: nav, show, ready };
}

/**
 * A paginated view over a list's items: owns the page, its place in the address (optional, with
 * its own param), Back/Forward, which items show and the page buttons. A block gives it the items
 * to page through (already filtered and in order) with `setItems`; items off the page get
 * `hidden`, so a block hides filtered-out items by leaving them out of `setItems`.
 * @param {{ size?: number, param?: string|null, target?: HTMLElement,
 *   focus?: function(): (HTMLElement|null), label?: string,
 *   onChange?: function({ page: number, pages: number, items: HTMLElement[],
 *     source: string }): void }} [options]
 *   `param: null` keeps the page out of the address (e.g. a second list on the page);
 *   `onChange` runs after every render (`source`: 'init', 'items', 'select' or 'history')
 * @returns {{ element: HTMLElement, ready: Promise, page: number, pages: number,
 *   setItems: function(HTMLElement[], { reset?: boolean, push?: boolean }=): void,
 *   goTo: function(number, { push?: boolean }=): void, sync: function(): boolean,
 *   destroy: function(): void }}
 */
export function createPager({
  size = DEFAULT_PAGE_SIZE, param = PAGE_PARAM, target, focus, label, onChange,
} = {}) {
  let items = [];
  let page = param ? readPage(param) : 1;
  let pages = 1;
  let ui;

  const render = (source) => {
    pages = pageCount(items.length, size);
    // a page past the last (e.g. a shared ?page=99) shows the last, and the address says so
    if (page > pages) {
      page = pages;
      if (param) writePage(page, { replace: true, param });
    }
    const start = (page - 1) * size;
    const onPage = items.slice(start, start + size);
    const visible = new Set(onPage);
    items.forEach((item) => { item.hidden = !visible.has(item); });
    ui.show(page, pages);
    onChange?.({
      page, pages, items: onPage, source,
    });
  };

  const goTo = (next, { push = true, source = 'select' } = {}) => {
    page = Math.max(1, next);
    if (param) writePage(page, { replace: !push, param });
    render(source);
  };

  ui = createPagination({
    onSelect: (next) => goTo(next),
    target,
    focus: focus || (() => items.find((item) => !item.hidden) || null),
    label,
  });

  return {
    element: ui.element,
    ready: ui.ready,
    get page() { return page; },
    get pages() { return pages; },
    /**
     * The items to page through, in order. `reset` goes back to page 1: in the address in place
     * (`push: false`, the default, e.g. when the caller already pushed its own history entry).
     */
    setItems(next, { reset = false, push = false } = {}) {
      items = [...next];
      if (reset) goTo(1, { push, source: 'items' });
      else render('items');
    },
    goTo,
    /**
     * Reads the page from the address again (after Back/Forward); true when it changed.
     * `render: false` only reads it (the caller then calls setItems with its new items).
     */
    sync({ render: draw = true } = {}) {
      if (!param) return false;
      const next = readPage(param);
      if (next === page) return false;
      page = next;
      if (draw) render('history');
      return true;
    },
    destroy() {
      ui.element.remove();
    },
  };
}
