/*
 * Button actions: what a button does is decided by its authored link.
 * Each action has `matches(url, link)` and `apply(link, url)`; the first match wins.
 * Register more with registerButtonAction() to support new behaviours without touching blocks.
 */

const actions = [];

/**
 * Normalises a modal name, so "#Log In" matches section metadata "log-in".
 * @param {string} name
 * @returns {string}
 */
export function toModalName(name) {
  return decodeURIComponent(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Finds an on-page modal section by name (section metadata `modal`).
 * @param {string} name
 * @returns {HTMLElement|undefined}
 */
function findModalSection(name) {
  return [...document.querySelectorAll('main .section[data-modal]')]
    .find((s) => toModalName(s.dataset.modal) === name);
}

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
 * Replaces a link with a button that keeps its label and classes, for actions that
 * stay on the page.
 * @param {HTMLAnchorElement} link
 * @returns {HTMLButtonElement}
 */
function toButton(link) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = link.className;
  btn.append(...link.childNodes);
  if (link.title) btn.title = link.title;
  btn.dataset.href = link.getAttribute('href');
  return btn;
}

/**
 * Turns a link into a modal trigger.
 * @param {HTMLAnchorElement} link
 * @param {string} key
 * @param {() => Promise<Node[]>} content
 * @returns {HTMLButtonElement}
 */
function modalTrigger(link, key, content) {
  const btn = toButton(link);
  btn.setAttribute('aria-haspopup', 'dialog');
  btn.addEventListener('click', async () => {
    const { openModal } = await import('./modal.js');
    openModal({ key, content, trigger: btn });
  });
  return btn;
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

// a page under a /modals/ folder: load that page into a modal
registerButtonAction({
  name: 'modal-page',
  matches: (url) => isSameSite(url) && url.pathname.split('/').includes('modals'),
  apply: (link, url) => modalTrigger(link, url.pathname, async () => {
    // eslint-disable-next-line import/no-cycle
    const { loadFragment } = await import('../blocks/fragment/fragment.js');
    const fragment = await loadFragment(url.pathname);
    return fragment ? [...fragment.querySelectorAll(':scope > .section > div')] : [];
  }),
});

// #name matching an on-page modal section: open that section in a modal
registerButtonAction({
  name: 'modal-section',
  matches: (url) => !!url.hash && isSamePage(url)
    && !!findModalSection(toModalName(url.hash.slice(1))),
  apply: (link, url) => {
    const name = toModalName(url.hash.slice(1));
    return modalTrigger(link, `#${name}`, () => {
      const section = findModalSection(name);
      return section ? [...section.children] : [];
    });
  },
});

// #id on the same page: let the browser scroll to it
registerButtonAction({
  name: 'anchor',
  matches: (url) => !!url.hash && isSamePage(url),
  apply: (link) => link,
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
