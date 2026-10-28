import { translate } from '../../scripts/i18n.js';

/**
 * A path without its `.html` and trailing slash, for comparing pages.
 * @param {string} path
 * @returns {string}
 */
function pagePath(path) {
  return path.replace(/\.html$/, '').replace(/\/+$/, '') || '/';
}

/**
 * Decorates the Side Nav block: the authored links (one per row, or a list) as a navigation list
 * beside the page's content (the account pages: Update Profile, Update Password, My Booking). The
 * link to the current page (its path, whatever the domain, `.html` or trailing slash) is active.
 * @param {Element} block The Side Nav block element
 */
export default function decorate(block) {
  const current = pagePath(window.location.pathname);
  const list = document.createElement('ul');
  list.className = 'side-nav-list';
  block.querySelectorAll('a[href]').forEach((authored) => {
    let url;
    try {
      url = new URL(authored.getAttribute('href'), window.location.href);
    } catch {
      return;
    }
    // site and web links only (e.g. no javascript:)
    if (!/^https?:$/.test(url.protocol)) return;
    const link = document.createElement('a');
    link.className = 'side-nav-link';
    link.href = url.origin === window.location.origin ? `${url.pathname}${url.search}${url.hash}` : url.href;
    link.textContent = authored.textContent.trim();
    const item = document.createElement('li');
    item.className = 'side-nav-item';
    if (pagePath(url.pathname) === current) {
      item.classList.add('is-active');
      link.setAttribute('aria-current', 'page');
    }
    item.append(link);
    list.append(item);
  });
  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', translate('accountTitle'));
  nav.append(list);
  block.replaceChildren(nav);
}
