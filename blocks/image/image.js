import { applyButtonAction } from '../../scripts/button-actions.js';

const AUTOPLAY_MS = 4000;

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
 * One carousel slide for an authored picture; a link around the picture makes the slide image the
 * link (named and titled by its alt text, with the site's link actions).
 * @param {HTMLPictureElement} picture
 * @returns {HTMLElement}
 */
function buildSlide(picture) {
  const slide = el('div', 'image-slide');
  const link = picture.closest('a[href]');
  if (link) {
    const name = picture.querySelector('img')?.alt;
    if (!link.title.trim() && name) link.title = name;
    link.className = 'image-link';
    link.replaceChildren(picture);
    slide.append(applyButtonAction(link));
  } else {
    slide.append(picture);
  }
  return slide;
}

/**
 * Turns the slides into a slideshow (option carousel), as the source's West Kowloon lounge photo
 * gallery: one image at a time, fading to the next every 4 seconds and looping. A pause/play
 * button stops it; it also waits while the pointer is on it, while a linked image has focus, when
 * it's off-screen or the tab is hidden, and starts paused for reduced motion.
 * @param {HTMLElement} block
 * @param {HTMLElement[]} slides
 */
function buildCarousel(block, slides) {
  const viewport = el('div', 'image-viewport');
  viewport.append(...slides);
  block.replaceChildren(viewport);
  if (slides.length < 2) {
    slides[0]?.classList.add('active');
    return;
  }
  slides.forEach((slide, i) => {
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', 'slide');
    slide.setAttribute('aria-label', `${i + 1} of ${slides.length}`);
  });
  // a group, not a region: several slideshows on a page would otherwise be same-named landmarks
  block.setAttribute('role', 'group');
  block.setAttribute('aria-roledescription', 'carousel');
  block.setAttribute('aria-label', 'Photo gallery');

  const toggle = el('button', 'image-toggle');
  toggle.type = 'button';
  block.append(toggle);

  let index = 0;
  let timer = null;
  let paused = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let hovering = false;
  let focused = false;
  let visible = true;

  const show = (i) => {
    index = (i + slides.length) % slides.length;
    slides.forEach((slide, n) => {
      slide.classList.toggle('active', n === index);
      slide.inert = n !== index;
    });
  };
  const sync = () => {
    clearInterval(timer);
    timer = null;
    if (!paused && !hovering && !focused && visible && !document.hidden) {
      timer = setInterval(() => show(index + 1), AUTOPLAY_MS);
    }
    block.classList.toggle('paused', paused);
    toggle.setAttribute('aria-label', paused ? 'Play slideshow' : 'Pause slideshow');
  };

  toggle.addEventListener('click', () => { paused = !paused; sync(); });
  viewport.addEventListener('mouseenter', () => { hovering = true; sync(); });
  viewport.addEventListener('mouseleave', () => { hovering = false; sync(); });
  viewport.addEventListener('focusin', () => { focused = true; sync(); });
  viewport.addEventListener('focusout', (e) => {
    if (!viewport.contains(e.relatedTarget)) { focused = false; sync(); }
  });
  document.addEventListener('visibilitychange', sync);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }).observe(block);

  show(0);
  sync();
}

/**
 * Decorates the image block: one authored image, optionally linked, as the source's page banners
 * (e.g. the offer page banner, `.pagebannerImg`). The first picture in any cell is used; a link
 * around it, or anywhere in the block, makes the whole image the link (the site's link actions
 * apply, e.g. other websites open in a new tab). Without a picture the block is emptied. Option
 * carousel uses every picture instead, one slide each (see buildCarousel).
 * @param {Element} block The image block element
 */
export default function decorate(block) {
  if (block.classList.contains('carousel')) {
    const slides = [...block.querySelectorAll('picture')].map(buildSlide);
    if (slides.length) buildCarousel(block, slides);
    else block.replaceChildren();
    return;
  }
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
