/*
 * Button actions: what a button does is decided by its authored link.
 * Each action has `matches(url, link)` and `apply(link, url)`; the first match wins.
 * Register more with registerButtonAction() to support new behaviours without touching blocks.
 * Modal links (`#name`, `/modals/…`) are opened by the site-wide handler in modal.js, so a modal
 * that registers later (for example from the nav) still opens.
 */
import { markModalTrigger, modalPageUrl, openPageModal } from './modal.js';

const actions = [];

/**
 * Same origin as the current page.
 * @param {URL} url
 * @returns {boolean}
 */
function isSameSite(url) {
  return url.origin === window.location.origin;
}

/**
 * Same page as the current one, so only the hash differs.
 * @param {URL} url
 * @returns {boolean}
 */
function isSamePage(url) {
  return isSameSite(url) && url.pathname === window.location.pathname
    && url.search === window.location.search;
}

/**
 * Adds an action. By default it goes before the catch-all `navigate` action.
 * @param {{name: string, matches: Function, apply: Function}} action
 * @param {{before?: string}} [options] Insert before the action with this name
 */
export function registerButtonAction(action, { before = 'navigate' } = {}) {
  const at = actions.findIndex((a) => a.name === before);
  if (at === -1) actions.push(action);
  else actions.splice(at, 0, action);
}

/**
 * Applies the matching action to a link and returns the element to place in the page
 * (the link itself, or a replacement such as a button).
 * @param {HTMLAnchorElement} link
 * @returns {HTMLElement}
 */
export function applyButtonAction(link) {
  let url;
  try {
    url = new URL(link.getAttribute('href'), window.location.href);
  } catch {
    return link;
  }
  const action = actions.find((a) => a.matches(url, link));
  if (!action) return link;
  const el = action.apply(link, url) || link;
  el.dataset.action = action.name;
  return el;
}

// built-in actions, in priority order

// a page under a /modals/ folder: a button that opens that page in a modal
registerButtonAction({
  name: 'modal-page',
  matches: (url) => !!modalPageUrl(url.href),
  apply: (link, url) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = link.className;
    btn.append(...link.childNodes);
    if (link.title) btn.title = link.title;
    btn.dataset.href = link.getAttribute('href');
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.addEventListener('click', () => openPageModal(url, btn));
    return btn;
  },
});

// #name on the same page: a modal when one is registered under that name (now or once the nav
// loads), otherwise a normal anchor; the site-wide handler decides on click
registerButtonAction({
  name: 'anchor',
  matches: (url) => !!url.hash && isSamePage(url),
  apply: (link) => markModalTrigger(link),
});

// another website: open in a new tab and say so
registerButtonAction({
  name: 'external',
  matches: (url) => /^https?:$/.test(url.protocol) && !isSameSite(url),
  apply: (link) => {
    link.target = '_blank';
    link.rel = 'noopener';
    if (!link.querySelector('.visually-hidden')) {
      const note = document.createElement('span');
      note.className = 'visually-hidden';
      note.textContent = ' (opens in a new tab)';
      link.append(note);
    }
    return link;
  },
});

// everything else (internal pages, mailto:, tel:): a normal link
registerButtonAction({
  name: 'navigate',
  matches: () => true,
  apply: (link) => link,
});
