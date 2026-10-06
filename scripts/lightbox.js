import { loadCSS } from './aem.js';

// links to image files (e.g. a WeChat QR code) open in a lightbox instead of navigating
export const IMAGE_LINK = /\.(?:jpe?g|png|gif|webp|svg)(?:[?#]|$)/i;

/**
 * Opens an image in a lightbox dialog: the image on a white card with a close button.
 * Closes on the button, Esc (native cancel) and a click on the backdrop; focus returns to the
 * trigger.
 * @param {string} src Image URL
 * @param {string} alt Image description
 * @param {HTMLElement} [trigger] The element that opened it
 */
export async function openLightbox(src, alt, trigger) {
  await loadCSS(`${window.hlx.codeBasePath}/styles/lightbox.css`);
  const dialog = document.createElement('dialog');
  dialog.className = 'lightbox';
  dialog.setAttribute('aria-label', alt || 'Image');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'lightbox-close';
  close.setAttribute('aria-label', 'Close');
  const img = document.createElement('img');
  img.src = src;
  img.alt = alt || '';
  dialog.append(close, img);
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    dialog.remove();
    trigger?.focus();
  });
  document.body.append(dialog);
  dialog.showModal();
}

/**
 * Makes a link to an image open in the lightbox.
 * @param {HTMLAnchorElement} link
 * @param {string} [alt] Description of the image (defaults to the link's name)
 */
export function enableLightbox(link, alt) {
  link.removeAttribute('target');
  link.setAttribute('aria-haspopup', 'dialog');
  link.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    openLightbox(link.href, alt || link.getAttribute('aria-label') || link.textContent.trim(), link);
  });
}
