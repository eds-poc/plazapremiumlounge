/*
 * The source's leave-site popup ("See you again soon"), for links to other websites inside an
 * opt-in container: any element with the class `leave-site`. A page section opts in with the
 * Section Metadata style `leave-site`; the footer's Social column opts in from its code; blocks
 * can add the class to any element. A click on such a link shows the popup, which goes to the
 * link in this tab after 5 seconds unless the visitor cancels (Cancel Redirect or ×; not Esc,
 * not a click beside it), as the source. See docs/leave-site.md.
 */
import { translate } from './i18n.js';

// the opt-in containers
const SCOPE = '.leave-site';
// the source's popup redirects on its own after 5 seconds
const DELAY = 5000;
// links to images open in their own viewer (e.g. the footer's WeChat QR lightbox)
const IMAGE_LINK = /\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i;
// links another feature opens itself (button actions: the video and modal page popups)
const OWN_ACTIONS = ['video', 'modal-page'];

let installed = false;

/**
 * Whether a link leaves the site and should ask first: http(s) on another origin, and not an
 * image, a download or a link another feature handles.
 * @param {HTMLAnchorElement} link
 * @returns {URL|null} the link's URL when it should ask first
 */
export function isLeaveSiteLink(link) {
  const href = link.getAttribute('href');
  if (!href || IMAGE_LINK.test(href) || link.hasAttribute('download')) return null;
  if (OWN_ACTIONS.includes(link.dataset.action)) return null;
  let url;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol) || url.origin === window.location.origin) return null;
  return url;
}

/**
 * Shows the leave-site popup, then goes to the URL in this tab after 5 seconds unless the
 * visitor cancels. One redirect at a time (the latest link's), stopped when the popup closes.
 * @param {string} url
 * @param {HTMLElement} [trigger] Focus returns there when it closes
 */
export async function confirmLeaveSite(url, trigger) {
  const { openModal } = await import('./modal-dialog.js');
  const dialog = await openModal({
    key: 'leave-site',
    trigger,
    content: () => {
      const title = document.createElement('h2');
      title.textContent = translate('leaveSiteTitle');
      const text = document.createElement('p');
      text.textContent = translate('leaveSiteText');
      const actions = document.createElement('p');
      actions.className = 'leave-site-actions';
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'button primary';
      cancel.textContent = translate('leaveSiteCancel');
      cancel.addEventListener('click', () => cancel.closest('dialog').close());
      actions.append(cancel);
      return Object.assign([title, text, actions], { styles: ['leave-site'], static: true });
    },
  });
  if (!dialog) return;
  clearTimeout(dialog.leaveTimer);
  dialog.leaveTimer = setTimeout(() => {
    if (!dialog.open) return;
    // closed first, so the page the Back button brings back has no popup (or scroll lock) left
    dialog.close();
    window.location.href = url;
  }, DELAY);
  if (!dialog.leaveWired) {
    dialog.leaveWired = true;
    dialog.addEventListener('close', () => clearTimeout(dialog.leaveTimer));
    // a page restored from the back/forward cache: no popup and no redirect left over
    window.addEventListener('pageshow', (e) => {
      if (!e.persisted) return;
      clearTimeout(dialog.leaveTimer);
      if (dialog.open) dialog.close();
    });
  }
  dialog.querySelector('.leave-site-actions button')?.focus();
}

/**
 * Asks before links to other websites inside a `leave-site` container: one click listener for
 * the whole page, so links that blocks build or rebuild later are covered too. Installed once.
 */
export function installLeaveSitePrompt() {
  if (installed) return;
  installed = true;
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented) return;
    const link = e.target.closest?.('a[href]');
    if (!link || !link.closest(SCOPE)) return;
    const url = isLeaveSiteLink(link);
    if (!url) return;
    e.preventDefault();
    confirmLeaveSite(url.href, link);
  });
}
