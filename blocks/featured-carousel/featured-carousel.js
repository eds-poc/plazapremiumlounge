import { createOptimizedPicture } from '../../scripts/aem.js';

const HEADINGS = 'h1, h2, h3, h4, h5, h6';
const AUTOPLAY_MS = 5000;
const SWIPE_PX = 50;

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
 * Rebuilds an authored image as an optimized picture.
 * @param {HTMLImageElement} img
 * @param {boolean} eager
 * @param {{media?: string, width: string}[]} breakpoints
 * @returns {HTMLPictureElement}
 */
function optimize(img, eager, breakpoints) {
  return createOptimizedPicture(img.src, img.alt, eager, breakpoints);
}

/**
 * Decorates a slide's text cell by role, so typography never depends on the heading level:
 * content before the first heading is the eyebrow (text or logo image), an all-bold line
 * right after it is the subtitle, a paragraph holding only a link is the call to action.
 * @param {Element} cell
 * @param {boolean} eager
 * @returns {HTMLElement}
 */
function buildContent(cell, eager) {
  const content = el('div', 'featured-carousel-content');
  const children = [...cell.children];
  const heading = children.find((c) => c.matches(HEADINGS));
  const titleIndex = heading ? children.indexOf(heading) : -1;
  children.forEach((child, i) => {
    const beforeTitle = i < titleIndex;
    if (child === heading) {
      child.classList.add('featured-carousel-title');
    } else if (beforeTitle) {
      child.classList.add('featured-carousel-eyebrow');
      const img = child.querySelector('img');
      if (img) {
        child.classList.add('has-image');
        child.querySelector('picture')?.replaceWith(optimize(img, eager, [{ width: '600' }]));
      }
    } else if (titleIndex > -1 && i === titleIndex + 1 && child.children.length === 1
      && child.querySelector(':scope > strong, :scope > b')
      && child.firstElementChild.textContent.trim() === child.textContent.trim()) {
      child.classList.add('featured-carousel-subtitle');
    } else {
      const link = child.querySelector(':scope > a, :scope > strong > a, :scope > em > a');
      if (link && child.querySelectorAll('a').length === 1 && link.textContent.trim() === child.textContent.trim()) {
        child.classList.add('featured-carousel-cta', 'button-wrapper');
        link.classList.add('button');
      }
    }
    content.append(child);
  });
  return content;
}

/**
 * Builds one slide from an authored row: a text cell and an image cell, in either order.
 * @param {Element} row
 * @param {boolean} eager
 * @returns {HTMLElement|null}
 */
function buildSlide(row, eager) {
  const cells = [...row.children];
  const mediaCell = cells.find((c) => isImageOnly(c));
  const textCell = cells.find((c) => c !== mediaCell && c.textContent.trim())
    || cells.find((c) => c !== mediaCell && c.querySelector('picture, img'));
  if (!mediaCell && !textCell) return null;
  const slide = el('div', 'featured-carousel-slide');
  if (textCell) slide.append(buildContent(textCell, eager));
  const img = mediaCell?.querySelector('img');
  if (img) {
    const media = el('div', 'featured-carousel-media');
    media.append(optimize(img, eager, [{ media: '(width >= 576px)', width: '750' }, { width: '500' }]));
    slide.append(media);
  } else {
    slide.classList.add('no-image');
  }
  return slide;
}

/**
 * Builds a control button.
 * @param {string} className
 * @param {string} label
 * @returns {HTMLButtonElement}
 */
function button(className, label) {
  const btn = el('button', className);
  btn.type = 'button';
  btn.setAttribute('aria-label', label);
  return btn;
}

/**
 * Turns the slides into a carousel: sliding track, previous/next, one dot per slide, swipe and
 * autoplay. Autoplay is off for reduced motion and pauses on hover, focus and when off-screen.
 * @param {HTMLElement} block
 * @param {HTMLElement[]} slides
 */
function buildCarousel(block, slides) {
  const viewport = el('div', 'featured-carousel-viewport');
  const track = el('div', 'featured-carousel-track');
  track.setAttribute('aria-live', 'off');
  slides.forEach((slide, i) => {
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', 'slide');
    slide.setAttribute('aria-label', `${i + 1} of ${slides.length}`);
    track.append(slide);
  });
  viewport.append(track);

  const prev = button('featured-carousel-prev', 'Previous slide');
  const next = button('featured-carousel-next', 'Next slide');
  const controls = el('div', 'featured-carousel-controls');
  const dots = slides.map((slide, i) => {
    const title = slide.querySelector('.featured-carousel-title')?.textContent.trim();
    return button('featured-carousel-dot', `Show slide ${i + 1}${title ? `: ${title}` : ''}`);
  });
  controls.append(...dots);

  block.setAttribute('role', 'region');
  block.setAttribute('aria-roledescription', 'carousel');
  const firstTitle = slides[0].querySelector('.featured-carousel-title')?.textContent.trim();
  if (firstTitle) block.setAttribute('aria-label', firstTitle);
  block.append(viewport, prev, next, controls);

  let index = 0;
  let timer = null;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let hovering = false;
  let focused = false;
  let visible = true;

  const show = (i) => {
    index = (i + slides.length) % slides.length;
    track.style.transform = `translateX(-${index * 100}%)`;
    slides.forEach((s, n) => { s.inert = n !== index; });
    dots.forEach((d, n) => d.setAttribute('aria-current', n === index ? 'true' : 'false'));
  };
  const stop = () => { clearInterval(timer); timer = null; };
  const sync = () => {
    stop();
    const running = !reducedMotion && !hovering && !focused && visible && !document.hidden;
    if (running) timer = setInterval(() => show(index + 1), AUTOPLAY_MS);
    track.setAttribute('aria-live', running ? 'off' : 'polite');
  };
  const go = (i) => { show(i); sync(); };

  prev.addEventListener('click', () => go(index - 1));
  next.addEventListener('click', () => go(index + 1));
  dots.forEach((d, n) => d.addEventListener('click', () => go(n)));

  block.addEventListener('mouseenter', () => { hovering = true; sync(); });
  block.addEventListener('mouseleave', () => { hovering = false; sync(); });
  block.addEventListener('focusin', () => { focused = true; sync(); });
  block.addEventListener('focusout', (e) => { if (!block.contains(e.relatedTarget)) { focused = false; sync(); } });
  block.addEventListener('keydown', (e) => {
    if (!e.target.closest('.featured-carousel-controls, .featured-carousel-prev, .featured-carousel-next')) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
  });
  document.addEventListener('visibilitychange', sync);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }).observe(block);

  let startX = null;
  viewport.addEventListener('pointerdown', (e) => { startX = e.clientX; });
  viewport.addEventListener('pointercancel', () => { startX = null; });
  viewport.addEventListener('pointerup', (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) > SWIPE_PX) go(index + (dx < 0 ? 1 : -1));
  });

  show(0);
  sync();
}

/**
 * loads and decorates the featured carousel
 * @param {Element} block The featured-carousel block element
 */
export default function decorate(block) {
  const eager = !!block.closest('main > .section:first-child');
  const rows = [...block.children];
  const bgRow = rows.length > 1 && isImageOnly(rows[0]) ? rows.shift() : null;

  const slides = rows.map((row, i) => buildSlide(row, eager && i === 0)).filter(Boolean);
  block.textContent = '';

  const bgImg = bgRow?.querySelector('img');
  if (bgImg) {
    const bg = el('div', 'featured-carousel-bg');
    bg.append(optimize(bgImg, eager, [{ media: '(width >= 1200px)', width: '2000' }, { media: '(width >= 576px)', width: '1200' }, { width: '750' }]));
    bg.querySelector('img').alt = '';
    block.append(bg);
    block.classList.add('has-background');
  }

  if (slides.length > 1) {
    block.classList.add('is-carousel');
    buildCarousel(block, slides);
  } else if (slides.length === 1) {
    block.classList.add('is-single');
    block.append(slides[0]);
  }
}
