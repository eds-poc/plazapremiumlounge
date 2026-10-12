import { applyButtonAction } from '../../scripts/button-actions.js';

/**
 * Creates an element with an optional class name.
 * @param {string} tag
 * @param {string} [className]
 * @returns {HTMLElement}
 */
function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

/**
 * Decorates the image block: one authored image, optionally linked, as the source's page banners
 * (e.g. the offer page banner, `.pagebannerImg`). The first picture in any cell is used; a link
 * around it, or anywhere in the block, makes the whole image the link (the site's link actions
 * apply, e.g. other websites open in a new tab). Without a picture the block is emptied.
 * @param {Element} block The image block element
 */
export default function decorate(block) {
  const picture = block.querySelector('picture');
  if (!picture) {
    block.replaceChildren();
    return;
  }
  const media = el('div', 'image-media');
  const link = picture.closest('a[href]') || block.querySelector('a[href]');
  if (link) {
    // the image is the link; its accessible name is the image alt text, also shown as the tooltip
    const name = picture.querySelector('img')?.alt;
    // (decorateButtons titles links with their text, which is blank for an image link)
    if (!link.title.trim() && name) link.title = name;
    link.className = 'image-link';
    link.replaceChildren(picture);
    media.append(applyButtonAction(link));
  } else {
    media.append(picture);
  }
  block.replaceChildren(media);
}
