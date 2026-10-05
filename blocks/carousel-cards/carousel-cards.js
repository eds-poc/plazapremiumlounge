import { createOptimizedPicture } from '../../scripts/aem.js';
import { readNestedButtons } from '../../scripts/buttons.js';

const HEADINGS = 'h1, h2, h3, h4, h5, h6';
// the source "Explore Latest Offers" button below the offer carousel
const BUTTON_DEFAULT = ['outline'];
const DRAG_THRESHOLD = 30;

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
 * A row or cell that holds an image and no text.
 * @param {Element} node
 * @returns {boolean}
 */
function isImageOnly(node) {
  return !!node.querySelector('picture, img') && !node.textContent.trim();
}

/**
 * Rebuilds an authored image as an optimized picture, keeping the authored width and height so
 * the browser reserves its space before it loads.
 * @param {HTMLImageElement} img
 * @param {boolean} eager
 * @returns {HTMLPictureElement}
 */
function optimize(img, eager) {
  const picture = createOptimizedPicture(img.src, img.alt, eager, [
    { media: '(width >= 650px)', width: '750' },
    { width: '500' },
  ]);
  const optimized = picture.querySelector('img');
  ['width', 'height'].forEach((attr) => {
    if (img.hasAttribute(attr)) optimized.setAttribute(attr, img.getAttribute(attr));
  });
  return picture;
}

/**
 * Builds the text part of a card by role, so the look never depends on the heading level:
 * text before the first heading is the tag, a paragraph holding only a link is the card link,
 * everything else is the description.
 * @param {Element} cell
 * @returns {{tag: string, body: HTMLElement}}
 */
function buildBody(cell) {
  const body = el('div', 'carousel-cards-body');
  const children = [...cell.children];
  const heading = children.find((c) => c.matches(HEADINGS));
  const titleIndex = heading ? children.indexOf(heading) : -1;
  const description = el('div', 'carousel-cards-description');
  let tag = '';
  let link = null;
  children.forEach((child, i) => {
    if (child === heading) {
      child.classList.add('carousel-cards-title');
      body.append(child);
    } else if (i < titleIndex) {
      tag = [tag, child.textContent.trim()].filter(Boolean).join(' ');
    } else {
      const a = child.querySelector('a[href]');
      if (a && child.textContent.trim() === a.textContent.trim() && !link) {
        link = child;
        child.className = 'carousel-cards-link';
        // a plain link gets the source "Explore Offer →" look; authored buttons stay buttons
        if (!a.classList.contains('button')) a.className = '';
      } else {
        description.append(child);
      }
    }
  });
  if (description.children.length) body.append(description);
  if (link) body.append(link);
  return { tag, body };
}

/**
 * Builds one card from an authored row: an image cell and a text cell, in either order.
 * @param {Element} row
 * @param {boolean} eager
 * @returns {HTMLLIElement|null}
 */
function buildCard(row, eager) {
  const cells = [...row.children];
  const mediaCell = cells.find((c) => isImageOnly(c));
  const textCell = cells.find((c) => c !== mediaCell && c.textContent.trim());
  if (!mediaCell && !textCell) return null;
  const card = el('li', 'carousel-cards-card');
  const { tag, body } = textCell ? buildBody(textCell) : { tag: '', body: null };
  const img = mediaCell?.querySelector('img');
  if (img) {
    const media = el('div', 'carousel-cards-media');
    media.append(optimize(img, eager));
    if (tag) {
      const pill = el('span', 'carousel-cards-tag');
      pill.textContent = tag;
      media.append(pill);
    }
    card.append(media);
  }
  if (body) card.append(body);
  return card;
}

/**
 * Builds a previous/next button.
 * @param {string} dir
 * @returns {HTMLButtonElement}
 */
function arrow(dir) {
  const btn = el('button', `carousel-cards-${dir}`);
  btn.type = 'button';
  btn.setAttribute('aria-label', dir === 'prev' ? 'Previous cards' : 'Next cards');
  return btn;
}

/**
 * Turns the card list into a looping carousel like the source (Owl: loop, one card per click,
 * 250ms slide, mouse and touch drag, no dots, no autoplay). Copies of the cards sit before and
 * after the real ones (inert and hidden from assistive tech); after a move into a copy the track
 * jumps back to the same card in the real set.
 * @param {HTMLElement} block
 * @param {HTMLElement} stage The positioned area holding the cards and the arrows
 * @param {HTMLElement} viewport
 * @param {HTMLUListElement} list
 */
function setupCarousel(block, stage, viewport, list) {
  const cards = [...list.children];
  const total = cards.length;
  const prev = arrow('prev');
  const next = arrow('next');
  stage.append(prev, next);

  const perView = () => parseInt(getComputedStyle(block).getPropertyValue('--cc-per-view'), 10) || 1;
  let enabled = false;
  let index = 0; // position of the first visible card in the extended list
  let items = cards;

  const offset = (i) => items[i].offsetLeft - items[0].offsetLeft;
  const place = (animate) => {
    list.classList.toggle('is-animating', !!animate);
    list.style.transform = `translateX(${-offset(index)}px)`;
  };
  // only the cards in view are interactive and announced, whether they are originals or copies
  // (after looping, a copy can be the visible card); everything else is inert and hidden
  const updateInert = () => {
    const view = perView();
    items.forEach((item, i) => {
      const shown = i >= index && i < index + view;
      item.inert = !shown;
      if (shown) item.removeAttribute('aria-hidden');
      else item.setAttribute('aria-hidden', 'true');
    });
  };

  const enable = () => {
    if (enabled) return;
    enabled = true;
    const copy = () => cards.map((card) => {
      const clone = card.cloneNode(true);
      clone.classList.add('is-clone');
      clone.setAttribute('aria-hidden', 'true');
      return clone;
    });
    list.prepend(...copy());
    list.append(...copy());
    items = [...list.children];
    index = total;
    block.classList.add('is-carousel');
    place(false);
    updateInert();
  };
  const disable = () => {
    if (!enabled) return;
    enabled = false;
    list.querySelectorAll('.is-clone').forEach((c) => c.remove());
    items = cards;
    index = 0;
    list.style.transform = '';
    cards.forEach((c) => { c.inert = false; c.removeAttribute('aria-hidden'); });
    block.classList.remove('is-carousel');
  };
  const sync = () => (total > perView() ? enable() : disable());

  // after sliding into the copies, jump to the same card in the real set
  const normalize = () => {
    if (index >= total * 2) index -= total;
    else if (index < total) index += total;
    place(false);
    updateInert();
  };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const go = (step) => {
    if (!enabled) return;
    // fast repeated clicks: jump back to the real set first so the copies never run out
    if (index + step < 0 || index + step > items.length - perView()) {
      normalize();
      list.getBoundingClientRect(); // apply the jump before animating the step
    }
    index += step;
    if (reducedMotion.matches) {
      normalize();
      return;
    }
    place(true);
    updateInert();
  };
  list.addEventListener('transitionend', (e) => {
    if (e.target === list) normalize();
  });

  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  block.addEventListener('keydown', (e) => {
    if (!enabled || e.target.closest('.carousel-cards-viewport') === null) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
  });

  // drag with mouse or touch: the track follows the pointer, then snaps to the nearest card
  let startX = null;
  let dragged = 0;
  viewport.addEventListener('pointerdown', (e) => {
    if (!enabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    startX = e.clientX;
    dragged = 0;
    list.classList.remove('is-animating');
    viewport.classList.add('is-grabbing');
  });
  viewport.addEventListener('pointermove', (e) => {
    if (startX === null) return;
    dragged = e.clientX - startX;
    if (Math.abs(dragged) > 5 && !viewport.hasPointerCapture(e.pointerId)) {
      try {
        viewport.setPointerCapture(e.pointerId);
      } catch { /* the pointer is already gone */ }
    }
    list.style.transform = `translateX(${-offset(index) + dragged}px)`;
  });
  const endDrag = () => {
    if (startX === null) return;
    startX = null;
    viewport.classList.remove('is-grabbing');
    const step = offset(index + 1) - offset(index) || 1;
    let moved = Math.round(-dragged / step);
    if (moved === 0 && Math.abs(dragged) > DRAG_THRESHOLD) moved = dragged < 0 ? 1 : -1;
    if (moved) go(moved);
    else place(true);
  };
  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);
  // no native image or link drag ghost while dragging the cards
  viewport.addEventListener('dragstart', (e) => e.preventDefault());
  // a drag is not a click on a card link
  viewport.addEventListener('click', (e) => {
    if (Math.abs(dragged) > 5) { e.preventDefault(); e.stopPropagation(); }
    dragged = 0;
  }, true);

  // sections stay hidden until loaded, so set up once the list has a size, and on resize
  let lastView = 0;
  new ResizeObserver(() => {
    if (!viewport.clientWidth) return;
    const view = perView();
    if (view !== lastView) {
      lastView = view;
      sync();
    }
    if (enabled) { place(false); updateInert(); }
  }).observe(viewport);
}

/**
 * loads and decorates the carousel cards block
 * @param {Element} block The carousel-cards block element
 */
export default function decorate(block) {
  const eager = !!block.closest('main > .section:first-child');
  const list = el('ul', 'carousel-cards-list');
  const buttons = [];
  [...block.children].forEach((row) => {
    const nested = readNestedButtons(row, BUTTON_DEFAULT);
    if (nested) {
      buttons.push(...nested);
      return;
    }
    const card = buildCard(row, eager && list.children.length < 2);
    if (card) list.append(card);
  });
  // the stage keeps the source's 50px side gutters for the arrows
  const stage = el('div', 'carousel-cards-stage');
  const viewport = el('div', 'carousel-cards-viewport');
  viewport.append(list);
  stage.append(viewport);
  block.replaceChildren(stage);
  block.setAttribute('role', 'region');
  block.setAttribute('aria-roledescription', 'carousel');
  const heading = block.closest('.section')?.querySelector('.default-content-wrapper :is(h1, h2, h3)');
  block.setAttribute('aria-label', heading?.textContent.trim() || 'Cards');
  [...list.children].forEach((card, i, all) => {
    card.setAttribute('role', 'group');
    card.setAttribute('aria-roledescription', 'slide');
    card.setAttribute('aria-label', `${i + 1} of ${all.length}`);
  });
  if (list.children.length > 1) setupCarousel(block, stage, viewport, list);

  // optional buttons, centred below the cards (source "Explore Latest Offers")
  if (buttons.length) {
    const actions = el('div', 'carousel-cards-actions');
    actions.append(...buttons);
    block.append(actions);
  }
}
