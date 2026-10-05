import { createOptimizedPicture } from '../../scripts/aem.js';
import { readNestedButtons } from '../../scripts/buttons.js';

// a Buttons table nested in a row adds buttons below the lounges; without options the source
// homepage look is used: a large outline button ("Book Now", opening the booking modal)
const SOURCE_DEFAULT = ['outline', 'large'];

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
 * Turns the list into an endless mobile carousel: below 768px a copy of the card set is
 * added before and after the real cards (inert and hidden from assistive tech), and a
 * settled scroll inside a copy jumps to the same card in the real set. Dots track the
 * real card. From 768px the copies are removed and the list is the desktop grid.
 * @param {HTMLElement} block
 * @param {HTMLUListElement} list
 */
function setupCarousel(block, list) {
  const items = [...list.children];
  if (items.length < 2) return;
  const mobile = window.matchMedia('(width < 768px)');
  const dots = el('div', 'lounge-list-dots');
  const buttons = items.map((item, i) => {
    const btn = el('button', 'lounge-list-dot');
    btn.type = 'button';
    const name = item.querySelector('.lounge-list-tag')?.textContent || `${i + 1}`;
    btn.setAttribute('aria-label', `Show ${name} (${i + 1} of ${items.length})`);
    dots.append(btn);
    return btn;
  });

  const padding = () => parseFloat(getComputedStyle(list).paddingLeft) || 0;
  const scrollFor = (item) => item.offsetLeft - padding();
  const step = () => items[1].offsetLeft - items[0].offsetLeft;
  const jumpTo = (left) => list.scrollTo({ left, behavior: 'instant' });

  const makeClones = () => items.map((item) => {
    const clone = item.cloneNode(true);
    clone.classList.add('is-clone');
    clone.setAttribute('aria-hidden', 'true');
    clone.inert = true;
    return clone;
  });

  const setActive = () => {
    const s = step();
    if (!(s > 0)) return;
    const raw = Math.round((list.scrollLeft - scrollFor(items[0])) / s);
    const index = ((raw % items.length) + items.length) % items.length;
    buttons.forEach((b, i) => b.setAttribute('aria-current', i === index ? 'true' : 'false'));
  };

  const recenter = () => {
    const s = step();
    if (!mobile.matches || !(s > 0)) return;
    const setWidth = s * items.length;
    const start = scrollFor(items[0]);
    if (list.scrollLeft < start - s / 2) jumpTo(list.scrollLeft + setWidth);
    else if (list.scrollLeft > start + setWidth - s / 2) jumpTo(list.scrollLeft - setWidth);
  };

  const enable = () => {
    if (list.querySelector('.is-clone')) return;
    list.prepend(...makeClones());
    list.append(...makeClones());
    jumpTo(scrollFor(items[0]));
    setActive();
  };
  const disable = () => list.querySelectorAll('.is-clone').forEach((c) => c.remove());
  const sync = () => (mobile.matches ? enable() : disable());

  buttons.forEach((btn, i) => btn.addEventListener('click', () => {
    list.scrollTo({ left: scrollFor(items[i]), behavior: 'smooth' });
  }));

  let ticking = false;
  let settle;
  list.addEventListener('scroll', () => {
    clearTimeout(settle);
    settle = setTimeout(recenter, 120);
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { setActive(); ticking = false; });
  }, { passive: true });
  list.addEventListener('scrollend', () => { clearTimeout(settle); recenter(); });

  mobile.addEventListener('change', sync);
  block.append(dots);
  // sections stay hidden until loaded, so position the carousel once the list has a size
  let ready = false;
  new ResizeObserver(() => {
    if (!list.clientWidth) return;
    if (!ready) {
      ready = true;
      sync();
    } else if (mobile.matches) {
      setActive();
    }
  }).observe(list);
}

/**
 * loads and decorates the lounge list
 * @param {Element} block The lounge-list block element
 */
export default function decorate(block) {
  const list = el('ul', 'lounge-list-items');
  const buttons = [];
  [...block.children].forEach((row) => {
    const nested = readNestedButtons(row, SOURCE_DEFAULT);
    if (nested) {
      buttons.push(...nested);
      return;
    }
    const data = readRow(row);
    if (!data.img && !data.label) return;
    list.append(buildCard(data, false));
  });
  block.replaceChildren(list);
  setupCarousel(block, list);

  // optional buttons, centred below the grid (and below the dots on mobile)
  if (buttons.length) {
    const actions = el('div', 'lounge-list-actions');
    actions.append(...buttons);
    block.append(actions);
  }
}
