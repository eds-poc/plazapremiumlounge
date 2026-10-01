import { createOptimizedPicture } from '../../scripts/aem.js';

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
 * Reads one authored row defensively: the image can be in either cell, the label is the
 * text of the cell without the image, and a link anywhere in the row is optional.
 * @param {Element} row
 * @returns {{img: HTMLImageElement|null, label: string, link: HTMLAnchorElement|null}}
 */
function readRow(row) {
  const img = row.querySelector('img');
  const cells = [...row.children];
  const textCell = cells.find((c) => !c.querySelector('picture, img') && c.textContent.trim());
  const link = (textCell || row).querySelector('a[href]');
  const label = (textCell ? textCell.textContent : '').trim() || (img && img.alt) || '';
  return { img, label, link };
}

/**
 * Builds one card: image plus label pill, wrapped in the authored link when there is one.
 * @param {{img: HTMLImageElement|null, label: string, link: HTMLAnchorElement|null}} data
 * @param {boolean} eager
 * @returns {HTMLLIElement}
 */
function buildCard({ img, label, link }, eager) {
  const li = el('li', 'lounge-list-item');
  const card = link ? el('a', 'lounge-list-card') : el('div', 'lounge-list-card');
  if (link) {
    card.href = link.href;
    if (link.title) card.title = link.title;
  }
  if (img) {
    // the label names the card, so the image is decorative when a label exists
    const alt = label ? '' : img.alt;
    const picture = createOptimizedPicture(img.src, alt, eager, [
      { media: '(width >= 768px)', width: '750' },
      { width: '500' },
    ]);
    picture.classList.add('lounge-list-media');
    card.append(picture);
  }
  if (label) {
    const tag = el('span', 'lounge-list-tag');
    tag.textContent = label;
    card.append(tag);
  }
  li.append(card);
  return li;
}

/**
 * Adds carousel dots for the mobile swipe layout; the active dot follows the scroll position.
 * @param {HTMLElement} block
 * @param {HTMLUListElement} list
 */
function addDots(block, list) {
  const items = [...list.children];
  if (items.length < 2) return;
  const dots = el('div', 'lounge-list-dots');
  const buttons = items.map((item, i) => {
    const btn = el('button', 'lounge-list-dot');
    btn.type = 'button';
    const name = item.querySelector('.lounge-list-tag')?.textContent || `${i + 1}`;
    btn.setAttribute('aria-label', `Show ${name} (${i + 1} of ${items.length})`);
    btn.addEventListener('click', () => {
      list.scrollTo({ left: item.offsetLeft - list.offsetLeft - parseFloat(getComputedStyle(list).paddingLeft), behavior: 'smooth' });
    });
    dots.append(btn);
    return btn;
  });

  const setActive = () => {
    const step = items[1].offsetLeft - items[0].offsetLeft;
    const maxScroll = list.scrollWidth - list.clientWidth;
    let index = 0;
    if (step > 0 && maxScroll > 0) {
      index = list.scrollLeft >= maxScroll - 2
        ? items.length - 1
        : Math.round(list.scrollLeft / step);
    }
    buttons.forEach((b, i) => b.setAttribute('aria-current', i === index ? 'true' : 'false'));
  };
  let ticking = false;
  list.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { setActive(); ticking = false; });
  }, { passive: true });
  new ResizeObserver(setActive).observe(list);
  block.append(dots);
}

/**
 * loads and decorates the lounge list
 * @param {Element} block The lounge-list block element
 */
export default function decorate(block) {
  const list = el('ul', 'lounge-list-items');
  [...block.children].forEach((row) => {
    const data = readRow(row);
    if (!data.img && !data.label) return;
    list.append(buildCard(data, false));
  });
  block.replaceChildren(list);
  addDots(block, list);
}
