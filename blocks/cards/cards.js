import { createOptimizedPicture } from '../../scripts/aem.js';

/**
 * Whether a cell holds only an icon (`:name:`), with no text or picture.
 * @param {Element} cell
 * @returns {boolean}
 */
function isIconCell(cell) {
  return !!cell.querySelector('.icon') && !cell.querySelector('picture') && !cell.textContent.trim();
}

/**
 * Whether an element (a paragraph or a heading) is written entirely in italic: a paragraph is a
 * card footnote (e.g. option connectivity), a heading marks a highlighted card (option top-accent).
 * @param {Element} node
 * @returns {boolean}
 */
function isAllItalic(node) {
  const em = node.querySelector(':scope > em, :scope > i');
  return !!em && node.children.length === 1 && node.textContent.trim() === em.textContent.trim();
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
    // an italic paragraph in the body is the card's footnote
    li.querySelectorAll('.cards-card-body > p').forEach((p) => {
      if (isAllItalic(p)) p.classList.add('cards-card-footnote');
    });
    // an italic heading marks a highlighted card
    const heading = li.querySelector('.cards-card-body > :is(h1, h2, h3, h4, h5, h6)');
    if (heading && isAllItalic(heading)) li.classList.add('cards-card-highlight');
    ul.append(li);
  });
  ul.querySelectorAll('picture > img').forEach((img) => img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }])));
  block.replaceChildren(ul);
}
