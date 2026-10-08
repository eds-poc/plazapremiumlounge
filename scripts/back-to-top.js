/*
 * Back to top: a round button at the bottom right of every page, as the source's #back-top.
 * It fades in once the page is scrolled more than 100px and scrolls back to the top in 500ms
 * (instantly with reduced motion); focus then moves to the top of the page.
 */
import { translate } from './i18n.js';

// as the source: shown above 100px of scroll, a 500ms jQuery "swing" scroll to the top
const SHOW_AFTER = 100;
const DURATION = 500;
const swing = (p) => 0.5 - Math.cos(p * Math.PI) / 2;

/**
 * Scrolls the window to the top: animated, unless the visitor prefers reduced motion or starts
 * scrolling themselves.
 * @returns {Promise<void>} Resolves at the top (or when the visitor takes over)
 */
function scrollToTop() {
  const start = window.scrollY;
  if (!start || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.scrollTo(0, 0);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let frame;
    const t0 = performance.now();
    const stop = () => {
      cancelAnimationFrame(frame);
      ['wheel', 'touchstart', 'keydown'].forEach((type) => window.removeEventListener(type, stop));
      resolve();
    };
    ['wheel', 'touchstart', 'keydown'].forEach((type) => window.addEventListener(type, stop, { passive: true }));
    const step = (now) => {
      const p = Math.min((now - t0) / DURATION, 1);
      window.scrollTo(0, Math.round(start * (1 - swing(p))));
      if (p < 1) frame = requestAnimationFrame(step);
      else stop();
    };
    frame = requestAnimationFrame(step);
  });
}

/**
 * Adds the back to top button to the page (once).
 */
export default function initBackToTop() {
  if (document.querySelector('.back-to-top')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'back-to-top';
  button.setAttribute('aria-label', translate('backToTop'));

  let ticking = false;
  const update = () => {
    ticking = false;
    button.classList.toggle('is-visible', window.scrollY > SHOW_AFTER);
  };
  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });

  button.addEventListener('click', async () => {
    await scrollToTop();
    // keyboard and screen reader users continue from the top of the page
    const first = [...document.querySelectorAll('header a[href], header button, main a[href], main button')]
      .find((node) => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
    if (first && window.scrollY <= SHOW_AFTER) first.focus({ preventScroll: true });
  });

  document.body.append(button);
  update();
}
