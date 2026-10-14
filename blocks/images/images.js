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
 * Turns the images into a slideshow (option carousel), as the source's West Kowloon lounge photo
 * gallery: one image at a time, fading to the next every 4 seconds and looping. A pause/play
 * button stops it; it also waits while the pointer is on it, while a linked image has focus, when
 * it's off-screen or the tab is hidden, and starts paused for reduced motion.
 * @param {HTMLElement} block
 * @param {HTMLElement[]} slides
 */
function buildCarousel(block, slides) {
  const viewport = el('div', 'images-viewport');
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

  const toggle = el('button', 'images-toggle');
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
 * Decorates the images block: every authored image, in order, each optionally linked (the image is
 * the link). By default they're stacked at the full content width; option carousel shows them one
 * at a time as a fading slideshow.
 * @param {HTMLElement} block The images block element
 */
export default function decorate(block) {
  const items = [...block.querySelectorAll('picture')].map((picture) => {
    const item = el('div', 'images-item');
    const link = picture.closest('a[href]');
    if (link) {
      // the image is the link; its name is the image alt text, also shown as the tooltip
      const name = picture.querySelector('img')?.alt;
      if (!link.title.trim() && name) link.title = name;
      link.className = 'images-link';
      link.replaceChildren(picture);
      item.append(link);
    } else {
      item.append(picture);
    }
    return item;
  });
  if (block.classList.contains('carousel')) buildCarousel(block, items);
  else block.replaceChildren(...items);
}
