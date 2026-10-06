import { applyButtonAction } from '../../scripts/button-actions.js';
import { IMAGE_LINK, enableLightbox } from '../../scripts/lightbox.js';

const HEADINGS = 'h1, h2, h3, h4, h5, h6';
const DRAG_THRESHOLD = 30;
// region names used so far on the page, so two sliders with the same title stay distinguishable
const regionNames = new Map();
// social networks shown as round icons: matched by the link's host, else by its text
const SOCIAL = [
  { name: 'facebook', hosts: ['facebook.com', 'fb.com'], words: ['facebook'] },
  { name: 'instagram', hosts: ['instagram.com'], words: ['instagram'] },
  { name: 'linkedin', hosts: ['linkedin.com'], words: ['linkedin'] },
  { name: 'x', hosts: ['x.com', 'twitter.com'], words: ['x', 'twitter'] },
  { name: 'wechat', hosts: ['wechat.com', 'weixin.qq.com'], words: ['wechat', 'weixin'] },
];

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
 * The social network a link points to, if any.
 * @param {HTMLAnchorElement} link
 * @returns {string|null}
 */
function socialName(link) {
  let host = '';
  try {
    host = new URL(link.href).hostname.replace(/^www\./, '');
  } catch { /* not a URL */ }
  const text = (link.title || link.textContent).trim().toLowerCase();
  const match = SOCIAL.find((s) => s.hosts.some((h) => host === h || host.endsWith(`.${h}`)))
    || SOCIAL.find((s) => s.words.includes(text));
  return match ? match.name : null;
}

/**
 * Turns the links of a paragraph made only of links into the round social icons.
 * @param {HTMLAnchorElement[]} links
 * @returns {HTMLUListElement}
 */
function buildSocial(links) {
  const list = el('ul', 'media-slider-social');
  links.forEach((link) => {
    const li = el('li');
    const name = socialName(link);
    const label = (link.textContent || link.title).trim();
    link.className = 'media-slider-social-link';
    if (name) {
      link.classList.add('media-slider-social-icon', `media-slider-social-${name}`);
      const text = el('span', 'visually-hidden');
      text.textContent = label;
      link.replaceChildren(text);
    }
    if (!link.title) link.title = label;
    // an image link (the WeChat QR code) opens in a lightbox; other sites open in a new tab
    if (IMAGE_LINK.test(new URL(link.href).pathname)) enableLightbox(link, `${label} QR code`);
    else applyButtonAction(link);
    li.append(link);
    list.append(li);
  });
  return list;
}

/**
 * Builds the text panel from the first row: a heading (the title), intro paragraphs and a
 * paragraph of links (the social icons). The look is fixed by role.
 * @param {Element} row
 * @returns {HTMLElement}
 */
function buildText(row) {
  const text = el('div', 'media-slider-text');
  const lines = [...row.querySelectorAll(':scope > div > *')];
  let title = false;
  lines.forEach((line) => {
    const links = [...line.querySelectorAll('a[href]')];
    const onlyLinks = links.length
      && line.textContent.replace(/\s+/g, '') === links.map((a) => a.textContent.replace(/\s+/g, '')).join('');
    if (!title && (line.matches(HEADINGS) || !links.length)) {
      // the first line is the title, whatever its level or style
      const heading = line.matches(HEADINGS) ? line : Object.assign(el('h2'), { textContent: line.textContent.trim() });
      heading.classList.add('media-slider-title');
      text.append(heading);
      title = true;
    } else if (onlyLinks) {
      text.append(buildSocial(links));
    } else if (line.textContent.trim()) {
      line.classList.add('media-slider-intro');
      text.append(line);
    }
  });
  return text;
}

/**
 * Builds a slide from a row with an image, linked when the author linked the image.
 * @param {Element} row
 * @returns {HTMLLIElement|null}
 */
function buildSlide(row) {
  const picture = row.querySelector('picture');
  if (!picture) return null;
  const item = el('li', 'media-slider-item');
  const link = picture.closest('a[href]');
  let media;
  if (link) {
    media = link;
    media.className = 'media-slider-media';
    media.replaceChildren(picture);
    if (!link.title) link.title = picture.querySelector('img')?.alt || '';
    applyButtonAction(link);
  } else {
    media = el('div', 'media-slider-media');
    media.append(picture);
  }
  item.append(media);
  return item;
}

/**
 * Makes the images a looping, draggable row, as on the source (Owl: loop, images at their own
 * width, 15px apart, mouse and touch drag, no arrows, dots or autoplay). Copies of the images
 * sit before and after the real ones and are hidden from assistive tech; after a move into a copy
 * the track jumps back to the same image in the real set. A focused image is brought into view,
 * so keyboard users reach every image.
 * @param {HTMLElement} viewport
 * @param {HTMLElement} list
 */
function setupSlider(viewport, list) {
  const slides = [...list.children];
  const total = slides.length;
  let enabled = false;
  let index = 0; // position of the first visible image in the extended list
  let items = slides;

  const offset = (i) => items[i].offsetLeft - items[0].offsetLeft;
  const place = (animate) => {
    list.classList.toggle('is-animating', !!animate);
    list.style.transform = `translateX(${-offset(index)}px)`;
  };
  const fits = () => {
    const last = slides[total - 1];
    return last.offsetLeft + last.offsetWidth - slides[0].offsetLeft <= viewport.clientWidth;
  };
  const enable = () => {
    if (enabled) return;
    enabled = true;
    const copy = () => slides.map((slide) => {
      const clone = slide.cloneNode(true);
      clone.classList.add('is-clone');
      clone.setAttribute('aria-hidden', 'true');
      clone.inert = true;
      return clone;
    });
    list.prepend(...copy());
    list.append(...copy());
    items = [...list.children];
    index = total;
    viewport.classList.add('is-slider');
    // focusable, so the arrow keys work even when the images aren't links
    viewport.tabIndex = 0;
    place(false);
  };
  const disable = () => {
    if (!enabled) return;
    enabled = false;
    list.querySelectorAll('.is-clone').forEach((c) => c.remove());
    items = slides;
    index = 0;
    list.style.transform = '';
    list.classList.remove('is-animating');
    viewport.classList.remove('is-slider');
    viewport.removeAttribute('tabindex');
  };
  const sync = () => (fits() ? disable() : enable());

  // after sliding into the copies, jump to the same image in the real set
  const normalize = () => {
    if (index >= total * 2) index -= total;
    else if (index < total) index += total;
    place(false);
  };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const go = (step) => {
    if (!enabled) return;
    // fast repeated moves: jump back to the real set first so the copies never run out
    if (index + step < 0 || index + step >= items.length - total) {
      normalize();
      list.getBoundingClientRect(); // apply the jump before animating the step
    }
    index += step;
    if (reducedMotion.matches) {
      normalize();
      return;
    }
    place(true);
  };
  list.addEventListener('transitionend', (e) => {
    if (e.target === list) normalize();
  });

  // keyboard: a focused image that is out of view slides in; arrow keys move one image
  list.addEventListener('focusin', (e) => {
    const slide = e.target.closest('.media-slider-item');
    if (!enabled || !slide || slide.classList.contains('is-clone')) return;
    viewport.scrollLeft = 0;
    const left = slide.offsetLeft - items[0].offsetLeft - offset(index);
    if (left < 0 || left + slide.offsetWidth > viewport.clientWidth) {
      index = items.indexOf(slide);
      place(!reducedMotion.matches);
    }
  });
  viewport.addEventListener('keydown', (e) => {
    if (!enabled) return;
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

  // sections stay hidden until loaded, so set up once the row has a size, and on resize
  new ResizeObserver(() => {
    if (!viewport.clientWidth) return;
    sync();
    if (enabled) place(false);
  }).observe(viewport);
}

/**
 * loads and decorates the media slider: a text panel (title, intro, social icons) beside a
 * looping row of square images (the homepage "Let's connect!")
 * @param {Element} block The media-slider block element
 */
export default function decorate(block) {
  const rows = [...block.children];
  // the text panel is the first row without an image (normally the first row)
  const textRow = rows.find((r) => !r.querySelector('picture') && r.textContent.trim());
  const list = el('ul', 'media-slider-list');
  rows.forEach((row) => {
    if (row === textRow) return;
    const slide = buildSlide(row);
    if (slide) list.append(slide);
  });
  const viewport = el('div', 'media-slider-viewport');
  viewport.append(list);
  const slider = el('div', 'media-slider-slider');
  slider.append(viewport);
  const text = textRow ? buildText(textRow) : null;
  block.replaceChildren(...[text, slider].filter(Boolean));
  if (text) {
    const title = text.querySelector('.media-slider-title');
    const name = title ? `${title.textContent.trim()}: images` : 'Images';
    const count = (regionNames.get(name) || 0) + 1;
    regionNames.set(name, count);
    viewport.setAttribute('role', 'region');
    viewport.setAttribute('aria-label', count > 1 ? `${name} (${count})` : name);
  }
  if (list.children.length > 1) setupSlider(viewport, list);
}
