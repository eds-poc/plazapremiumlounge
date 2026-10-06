import { applyButtonAction } from '../../scripts/button-actions.js';

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
 * Builds one image card from an authored cell: its picture, linked when the author linked the
 * image (or, as a fallback, put a link next to it). Cells without an image are skipped.
 * @param {Element} cell
 * @returns {HTMLLIElement|null}
 */
function buildImage(cell) {
  const picture = cell.querySelector('picture');
  if (!picture) return null;
  const item = el('li', 'columns-media-image-item');
  const link = picture.closest('a[href]') || cell.querySelector('a[href]');
  let card;
  if (link) {
    // the image is the link; its accessible name is the image alt text, also shown as the tooltip
    const name = picture.querySelector('img')?.alt;
    // (decorateButtons titles links with their text, which is blank for an image link)
    if (!link.title.trim() && name) link.title = name;
    link.className = 'columns-media-image-card columns-media-image-link';
    link.replaceChildren(picture);
    card = applyButtonAction(link);
  } else {
    card = el('div', 'columns-media-image-card');
    card.append(picture);
  }
  item.append(card);
  return item;
}

/**
 * Builds the dot buttons of the slider, one per image.
 * @param {HTMLElement[]} items
 * @returns {{dots: HTMLElement, buttons: HTMLButtonElement[]}}
 */
function buildDots(items) {
  const dots = el('div', 'columns-media-image-dots');
  const buttons = items.map((item, i) => {
    const btn = el('button', 'columns-media-image-dot');
    btn.type = 'button';
    const name = item.querySelector('img')?.alt;
    btn.setAttribute('aria-label', `Show image ${i + 1}${name ? `: ${name}` : ''}`);
    return btn;
  });
  dots.append(...buttons);
  return { dots, buttons };
}

/**
 * Turns the image list into a looping slider while the CSS asks for it (option `slider`,
 * below 768px), as on the source homepage (Owl: loop, cards at their own width, 15px apart,
 * one dot per image, mouse and touch drag, 250ms slide, no arrows, no autoplay). Copies of the
 * images sit before and after the real ones; after a move into a copy the track jumps back to the
 * same image in the real set. Images out of view are inert and hidden from assistive tech.
 * @param {HTMLElement} block
 * @param {HTMLElement} viewport
 * @param {HTMLElement} list
 * @param {string} label Accessible name of the slider
 */
function setupSlider(block, viewport, list, label) {
  const images = [...list.children];
  const total = images.length;
  const { dots, buttons } = buildDots(images);
  block.append(dots);

  const wanted = () => getComputedStyle(block).getPropertyValue('--columns-media-image-slider').trim() === '1';
  let enabled = false;
  let index = 0; // position of the first visible image in the extended list
  let items = images;

  const offset = (i) => items[i].offsetLeft - items[0].offsetLeft;
  const place = (animate) => {
    list.classList.toggle('is-animating', !!animate);
    list.style.transform = `translateX(${-offset(index)}px)`;
  };
  // images at least partly in view are interactive and announced, originals or copies alike
  const update = () => {
    const start = offset(index);
    const width = viewport.clientWidth;
    items.forEach((item, i) => {
      const left = offset(i) - start;
      const shown = left < width && left + item.offsetWidth > 0;
      item.inert = !shown;
      if (shown) item.removeAttribute('aria-hidden');
      else item.setAttribute('aria-hidden', 'true');
    });
    const current = (((index - total) % total) + total) % total;
    buttons.forEach((b, i) => b.setAttribute('aria-current', i === current ? 'true' : 'false'));
  };
  // all images fit: nothing to slide
  const fits = () => {
    const last = images[total - 1];
    return last.offsetLeft + last.offsetWidth - images[0].offsetLeft <= viewport.clientWidth;
  };

  const enable = () => {
    if (enabled) return;
    enabled = true;
    const copy = () => images.map((image) => {
      const clone = image.cloneNode(true);
      clone.classList.add('is-clone');
      clone.setAttribute('aria-hidden', 'true');
      return clone;
    });
    list.prepend(...copy());
    list.append(...copy());
    items = [...list.children];
    index = total;
    block.classList.add('is-slider');
    block.setAttribute('role', 'region');
    block.setAttribute('aria-roledescription', 'carousel');
    block.setAttribute('aria-label', label);
    place(false);
    update();
  };
  const disable = () => {
    if (!enabled) return;
    enabled = false;
    list.querySelectorAll('.is-clone').forEach((c) => c.remove());
    items = images;
    index = 0;
    list.style.transform = '';
    list.classList.remove('is-animating');
    images.forEach((l) => { l.inert = false; l.removeAttribute('aria-hidden'); });
    block.classList.remove('is-slider');
    ['role', 'aria-roledescription', 'aria-label'].forEach((a) => block.removeAttribute(a));
  };
  const sync = () => {
    if (!wanted()) { disable(); return; }
    if (!enabled && fits()) return;
    enable();
  };

  // after sliding into the copies, jump to the same image in the real set
  const normalize = () => {
    if (index >= total * 2) index -= total;
    else if (index < total) index += total;
    place(false);
    update();
  };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const to = (target) => {
    if (!enabled) return;
    index = target;
    if (reducedMotion.matches) {
      normalize();
      return;
    }
    place(true);
    update();
  };
  const go = (step) => {
    if (!enabled) return;
    // fast repeated moves: jump back to the real set first so the copies never run out
    if (index + step < 0 || index + step >= items.length - total) {
      normalize();
      list.getBoundingClientRect(); // apply the jump before animating the step
    }
    to(index + step);
  };
  list.addEventListener('transitionend', (e) => {
    if (e.target === list) normalize();
  });

  buttons.forEach((btn, i) => btn.addEventListener('click', () => {
    normalize();
    list.getBoundingClientRect();
    to(total + i);
  }));
  block.addEventListener('keydown', (e) => {
    if (!enabled || !e.target.closest('.columns-media-image-viewport')) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
  });

  // drag with mouse or touch: the track follows the pointer, then snaps to the nearest image
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
  // no native image or link drag ghost while dragging the images
  viewport.addEventListener('dragstart', (e) => e.preventDefault());
  // a drag is not a click on an image link
  viewport.addEventListener('click', (e) => {
    if (Math.abs(dragged) > 5) { e.preventDefault(); e.stopPropagation(); }
    dragged = 0;
  }, true);

  // sections stay hidden until loaded, so set up once the list has a size, and on resize
  new ResizeObserver(() => {
    if (!viewport.clientWidth) return;
    sync();
    if (enabled) { place(false); update(); }
  }).observe(viewport);
}

/**
 * Media-image variation: every authored cell with an image becomes an evenly sized image card
 * (e.g. a logo) in a centred, wrapping grid (rows and empty cells don't matter). With `slider`,
 * the grid becomes a looping, swipeable slider with dots on small screens.
 * @param {Element} block
 */
function decorateMediaImage(block) {
  const list = el('ul', 'columns-media-image-list');
  [...block.children].forEach((row) => {
    [...row.children].forEach((cell) => {
      const image = buildImage(cell);
      if (image) list.append(image);
    });
  });
  const viewport = el('div', 'columns-media-image-viewport');
  viewport.append(list);
  block.replaceChildren(viewport);
  if (block.classList.contains('slider') && list.children.length > 1) {
    const heading = block.closest('.section')?.querySelector('.default-content-wrapper :is(h1, h2, h3)');
    setupSlider(block, viewport, list, heading?.textContent.trim() || 'Images');
  }
}

export default function decorate(block) {
  if (block.classList.contains('media-image')) {
    decorateMediaImage(block);
    return;
  }

  const cols = [...block.firstElementChild.children];
  block.classList.add(`columns-${cols.length}-cols`);

  // setup image columns
  [...block.children].forEach((row) => {
    [...row.children].forEach((col) => {
      const pic = col.querySelector('picture');
      if (pic) {
        const picWrapper = pic.closest('div');
        if (picWrapper && picWrapper.children.length === 1) {
          // picture is only content in column
          picWrapper.classList.add('columns-img-col');
        }
      }
    });
  });
}
