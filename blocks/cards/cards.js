import { createOptimizedPicture } from '../../scripts/aem.js';

/**
 * Whether a cell holds only an icon (`:name:`), with no text or picture.
 * @param {Element} cell
 * @returns {boolean}
 */
function isIconCell(cell) {
  return !!cell.querySelector('.icon') && !cell.querySelector('picture') && !cell.textContent.trim();
}

export default function decorate(block) {
  /* change to ul, li */
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    while (row.firstElementChild) li.append(row.firstElementChild);
    [...li.children].forEach((div) => {
      if (div.children.length === 1 && div.querySelector('picture')) div.className = 'cards-card-image';
      // an icon instead of an image (e.g. option privilege's round badge)
      else if (isIconCell(div)) div.className = 'cards-card-image cards-card-icon';
      // an empty media cell (a card without an image or icon)
      else if (!div.textContent.trim() && !div.querySelector('picture, .icon')) div.remove();
      else div.className = 'cards-card-body';
    });
    ul.append(li);
  });
  ul.querySelectorAll('picture > img').forEach((img) => img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }])));
  block.replaceChildren(ul);
}
