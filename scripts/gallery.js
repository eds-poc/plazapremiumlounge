import { loadCSS } from './aem.js';
import { translate } from './i18n.js';

/*
 * A photo gallery over the page, as the source's (Fancybox 4): the photo with its caption, the
 * counter, zoom, slideshow, full screen, thumbnails and close in the toolbar, previous and next,
 * and a strip of thumbnails. It loops; swipe or drag to move between photos (down to close).
 * Keys as the source's: the arrow keys and Page Up/Down move, Escape closes.
 */

// the source's slideshow: a photo every 3 seconds
const SLIDESHOW_MS = 3000;
const SWIPE_PX = 40;
const CLOSE_DRAG_PX = 120;

// the toolbar's icons, drawn as the source's (24×24, stroked)
const ICONS = {
  zoom: '<circle cx="10" cy="10" r="7"/><path d="M16 16l5 5"/>',
  play: '<path d="M6 4v16M20 12L6 20M20 12L6 4"/>',
  pause: '<path d="M7 4v15M17 4v15"/>',
  fullscreen: '<path d="M3 8V3h5M21 8V3h-5M8 21H3v-5M16 21h5v-5"/>',
  fullscreenExit: '<path d="M7 2v5H2M17 2v5h5M2 17h5v5M22 17h-5v5"/>',
  thumbs: [4, 12, 20].flatMap((y) => [4, 12, 20].map((x) => `<circle cx="${x}" cy="${y}" r="1"/>`)).join(''),
  close: '<path d="M20 20L4 4m16 0L4 20"/>',
  next: '<path d="M9 3l9 9-9 9"/>',
  prev: '<path d="M15 3l-9 9 9 9"/>',
};

/**
 * An element with a class and optional text.
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 * @returns {HTMLElement}
 */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/**
 * A toolbar or navigation button with an icon; its name is also its tooltip, as the source's.
 * @param {string} className
 * @param {string} icon A key of ICONS
 * @param {string} label
 * @returns {HTMLButtonElement}
 */
function iconButton(className, icon, label) {
  const button = el('button', `gallery-button ${className}`);
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.title = label;
  button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[icon]}</svg>`;
  return button;
}

/**
 * Opens the gallery at a photo. Focus returns to `trigger` when it closes.
 * @param {{src: string, alt?: string, caption?: string}[]} images
 * @param {number} [start] The photo to show first
 * @param {{label?: string, trigger?: HTMLElement}} [options] `label` names the gallery
 * @returns {Promise<HTMLDialogElement|null>}
 */
export default async function openGallery(images, start = 0, { label, trigger } = {}) {
  const photos = (images || []).filter((image) => image?.src);
  if (!photos.length) return null;
  await loadCSS(`${window.hlx.codeBasePath}/styles/gallery.css`);
  const count = photos.length;
  const several = count > 1;
  const wrap = (i) => ((i % count) + count) % count;
  const photoName = (i) => translate('propertyPhoto', { n: i + 1, total: count });

  const dialog = el('dialog', 'gallery');
  dialog.setAttribute('aria-label', label || translate('galleryPhotos'));
  const progress = el('div', 'gallery-progress');
  const toolbar = el('div', 'gallery-toolbar');
  const counter = el('p', 'gallery-counter');
  counter.setAttribute('aria-hidden', 'true');
  const current = el('span');
  counter.append(current, ' / ', el('span', '', String(count)));
  const tools = el('div', 'gallery-tools');
  const zoom = iconButton('gallery-zoom', 'zoom', translate('galleryZoom'));
  zoom.setAttribute('aria-pressed', 'false');
  const slideshow = iconButton('gallery-slideshow', 'play', translate('gallerySlideshowPlay'));
  const fullscreen = iconButton('gallery-fullscreen', 'fullscreen', translate('galleryFullscreen'));
  const thumbsToggle = iconButton('gallery-thumbs-toggle', 'thumbs', translate('galleryThumbs'));
  thumbsToggle.setAttribute('aria-pressed', 'true');
  const close = iconButton('gallery-close', 'close', translate('close'));
  tools.append(zoom);
  if (several) tools.append(slideshow);
  if (document.fullscreenEnabled) tools.append(fullscreen);
  if (several) tools.append(thumbsToggle);
  tools.append(close);
  toolbar.append(counter, tools);

  const stage = el('div', 'gallery-stage');
  const track = el('div', 'gallery-track');
  stage.append(track);
  const prev = iconButton('gallery-nav gallery-prev', 'prev', translate('propertyPrevious'));
  const next = iconButton('gallery-nav gallery-next', 'next', translate('propertyNext'));
  if (several) stage.append(next, prev);
  // the photo and its caption, announced as it changes
  const status = el('p', 'visually-hidden');
  status.setAttribute('aria-live', 'polite');

  const thumbs = el('div', 'gallery-thumbs');
  const strip = el('div', 'gallery-thumbs-track');
  const thumbButtons = photos.map((photo, i) => {
    const button = el('button', 'gallery-thumb');
    button.type = 'button';
    button.setAttribute('aria-label', photoName(i));
    const img = el('img');
    img.src = photo.src;
    img.alt = '';
    img.loading = 'lazy';
    button.append(img);
    strip.append(button);
    return button;
  });
  thumbs.append(strip);
  // (everything in a frame: a dialog itself can't go full screen)
  const frame = el('div', 'gallery-frame');
  frame.append(progress, toolbar, stage, status);
  if (several) frame.append(thumbs);
  dialog.append(frame);

  let index = wrap(start);
  let moving = false;
  let zoomed = null;

  /**
   * A slide: the photo, fitted into the slide (never enlarged), with its caption.
   * @param {number} i
   * @returns {HTMLElement}
   */
  const buildSlide = (i) => {
    const photo = photos[i];
    const slide = el('figure', 'gallery-slide');
    const content = el('div', 'gallery-content');
    const img = el('img', 'gallery-image');
    img.src = photo.src;
    img.alt = photo.alt || '';
    img.draggable = false;
    content.append(img);
    slide.append(content);
    if (photo.caption) slide.append(el('figcaption', 'gallery-caption', photo.caption));
    return slide;
  };
  /**
   * Sizes a slide's photo to fit the room left beside its caption.
   * @param {HTMLElement} slide
   */
  const fit = (slide) => {
    const img = slide.querySelector('.gallery-image');
    if (!img.naturalWidth) return;
    const style = getComputedStyle(slide);
    const px = (name) => parseFloat(style[name]) || 0;
    const caption = slide.querySelector('.gallery-caption');
    const width = slide.clientWidth - px('paddingLeft') - px('paddingRight');
    const height = slide.clientHeight - px('paddingTop') - px('paddingBottom')
      - (caption?.offsetHeight || 0);
    const scale = Math.min(1, width / img.naturalWidth, height / img.naturalHeight);
    img.style.width = `${Math.floor(img.naturalWidth * scale)}px`;
    img.style.height = `${Math.floor(img.naturalHeight * scale)}px`;
  };
  const slideAt = (offset) => track.querySelector(`[data-offset="${offset}"]`);

  /** The thumbnails' strip: the chosen one centred, the ends against the edges. */
  const placeThumbs = () => {
    if (!several || thumbs.hidden) return;
    const room = thumbs.clientWidth;
    const width = strip.scrollWidth;
    const button = thumbButtons[index];
    let x = (room - width) / 2;
    if (width > room) {
      x = room / 2 - (button.offsetLeft + button.offsetWidth / 2);
      x = Math.min(0, Math.max(room - width, x));
    }
    strip.style.transform = `translateX(${x}px)`;
  };

  /** Draws the photo and its neighbours, and the counter, thumbnails and announcement. */
  const render = () => {
    zoomed = null;
    zoom.setAttribute('aria-pressed', 'false');
    const offsets = several ? [-1, 0, 1] : [0];
    track.replaceChildren(...offsets.map((offset) => {
      const slide = buildSlide(wrap(index + offset));
      slide.dataset.offset = offset;
      slide.inert = offset !== 0;
      const img = slide.querySelector('img');
      if (img.complete) requestAnimationFrame(() => fit(slide));
      else img.addEventListener('load', () => fit(slide), { once: true });
      return slide;
    }));
    track.style.transition = 'none';
    track.style.transform = '';
    current.textContent = String(index + 1);
    thumbButtons.forEach((button, i) => {
      button.setAttribute('aria-current', i === index ? 'true' : 'false');
    });
    placeThumbs();
    status.textContent = [photoName(index), photos[index].caption].filter(Boolean).join(', ');
  };

  // the slideshow: a photo every SLIDESHOW_MS, the progress bar filling meanwhile; it loops
  let timer = null;
  const runTimer = () => {
    clearTimeout(timer);
    progress.style.transition = 'none';
    progress.style.transform = 'scaleX(0)';
    // (a reflow, so the bar fills from the start again)
    progress.getBoundingClientRect();
    progress.style.transition = `transform ${SLIDESHOW_MS}ms linear`;
    progress.style.transform = 'scaleX(1)';
    // eslint-disable-next-line no-use-before-define
    timer = setTimeout(() => go(index + 1), SLIDESHOW_MS);
  };
  const playing = () => dialog.classList.contains('is-playing');
  const setPlaying = (on) => {
    dialog.classList.toggle('is-playing', on);
    const name = translate(on ? 'gallerySlideshowPause' : 'gallerySlideshowPlay');
    slideshow.setAttribute('aria-label', name);
    slideshow.title = name;
    slideshow.querySelector('svg').innerHTML = ICONS[on ? 'pause' : 'play'];
    if (on) runTimer();
    else clearTimeout(timer);
  };

  /**
   * Moves to a photo: its neighbour slides in (any other is drawn beside first); with reduced
   * motion it just changes.
   * @param {number} target
   */
  const go = (target) => {
    if (!several || moving) return;
    const to = wrap(target);
    if (to === index) return;
    const offset = target > index ? 1 : -1;
    // a jump (a thumbnail): that photo takes the neighbour's place
    const neighbour = slideAt(offset);
    if (wrap(index + offset) !== to) {
      const slide = buildSlide(to);
      slide.dataset.offset = offset;
      slide.inert = true;
      neighbour.replaceWith(slide);
      const img = slide.querySelector('img');
      if (img.complete) fit(slide);
      else img.addEventListener('load', () => fit(slide), { once: true });
    }
    // (the slideshow's next photo is due a full interval after this one starts to show)
    if (playing()) runTimer();
    const done = () => {
      moving = false;
      index = to;
      render();
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      done();
      return;
    }
    moving = true;
    track.style.transition = '';
    track.style.transform = `translateX(${-offset * 100}%)`;
    const end = (e) => {
      if (e.target !== track) return;
      track.removeEventListener('transitionend', end);
      done();
    };
    track.addEventListener('transitionend', end);
  };

  /**
   * Zooms the photo to its full size (when it's shown smaller), or back to fit.
   * @param {{x: number, y: number}} [at] The point to zoom on (the centre otherwise)
   */
  const toggleZoom = (at) => {
    const img = slideAt(0)?.querySelector('.gallery-image');
    if (!img) return;
    if (zoomed) {
      zoomed = null;
      img.style.transform = '';
      img.classList.remove('is-zoomed');
      zoom.setAttribute('aria-pressed', 'false');
      return;
    }
    const scale = img.naturalWidth / img.offsetWidth;
    if (!(scale > 1)) return;
    const box = img.getBoundingClientRect();
    const px = at ? at.x - (box.left + box.width / 2) : 0;
    const py = at ? at.y - (box.top + box.height / 2) : 0;
    zoomed = {
      img, scale, x: -px * (scale - 1), y: -py * (scale - 1),
    };
    // eslint-disable-next-line no-use-before-define
    pan(0, 0);
    img.classList.add('is-zoomed');
    zoom.setAttribute('aria-pressed', 'true');
  };
  /**
   * Moves the zoomed photo, never past its edges.
   * @param {number} dx
   * @param {number} dy
   */
  const pan = (dx, dy) => {
    const { img, scale } = zoomed;
    const room = stage.getBoundingClientRect();
    const maxX = Math.max(0, (img.offsetWidth * scale - room.width) / 2);
    const maxY = Math.max(0, (img.offsetHeight * scale - room.height) / 2);
    zoomed.x = Math.max(-maxX, Math.min(maxX, zoomed.x + dx));
    zoomed.y = Math.max(-maxY, Math.min(maxY, zoomed.y + dy));
    img.style.transform = `translate(${zoomed.x}px, ${zoomed.y}px) scale(${scale})`;
  };

  zoom.addEventListener('click', () => toggleZoom());
  slideshow.addEventListener('click', () => setPlaying(!playing()));
  fullscreen.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else frame.requestFullscreen().catch(() => {});
  });
  const onFullscreen = () => {
    const on = document.fullscreenElement === frame;
    const name = translate(on ? 'galleryFullscreenExit' : 'galleryFullscreen');
    fullscreen.setAttribute('aria-label', name);
    fullscreen.title = name;
    fullscreen.querySelector('svg').innerHTML = ICONS[on ? 'fullscreenExit' : 'fullscreen'];
  };
  document.addEventListener('fullscreenchange', onFullscreen);
  thumbsToggle.addEventListener('click', () => {
    thumbs.hidden = !thumbs.hidden;
    thumbsToggle.setAttribute('aria-pressed', String(!thumbs.hidden));
    placeThumbs();
  });
  close.addEventListener('click', () => dialog.close());
  next.addEventListener('click', () => go(index + 1));
  prev.addEventListener('click', () => go(index - 1));
  thumbButtons.forEach((button, i) => button.addEventListener('click', () => go(i)));

  // keys as the source's (Escape is the dialog's own)
  const keys = {
    ArrowRight: 1, ArrowUp: 1, PageUp: 1, ArrowLeft: -1, ArrowDown: -1, PageDown: -1,
  };
  dialog.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (keys[e.key]) {
      e.preventDefault();
      go(index + keys[e.key]);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      dialog.close();
    }
  });

  // drag: sideways to the next or previous photo, down (or up) to close; a zoomed photo pans;
  // a click (no drag) on the photo zooms
  let drag = null;
  stage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('button') || moving) return;
    drag = {
      x: e.clientX,
      y: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      axis: null,
      // (the stage captures the pointer: the photo is known from where it went down)
      onImage: !!e.target.closest('.gallery-image'),
    };
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (zoomed) {
      pan(e.clientX - drag.lastX, e.clientY - drag.lastY);
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      drag.axis = 'pan';
      return;
    }
    if (!drag.axis && Math.hypot(dx, dy) > 6) drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    track.style.transition = 'none';
    if (drag.axis === 'x' && several) track.style.transform = `translateX(${dx}px)`;
    if (drag.axis === 'y') {
      track.style.transform = `translateY(${dy}px)`;
      track.style.opacity = String(Math.max(0.3, 1 - Math.abs(dy) / (CLOSE_DRAG_PX * 3)));
    }
  });
  const endDrag = (e) => {
    if (!drag) return;
    const { axis, onImage } = drag;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag = null;
    track.style.opacity = '';
    if (!axis) {
      if (e.type === 'pointerup' && onImage) toggleZoom({ x: e.clientX, y: e.clientY });
      return;
    }
    if (axis === 'pan') return;
    if (axis === 'y' && Math.abs(dy) > CLOSE_DRAG_PX) {
      dialog.close();
      return;
    }
    if (axis === 'x' && Math.abs(dx) > SWIPE_PX && e.type === 'pointerup') {
      // from where the finger left it
      track.style.transition = '';
      go(index + (dx < 0 ? 1 : -1));
      return;
    }
    track.style.transition = '';
    track.style.transform = '';
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  const resize = new ResizeObserver(() => {
    track.querySelectorAll('.gallery-slide').forEach(fit);
    if (zoomed) toggleZoom();
    placeThumbs();
  });
  dialog.addEventListener('close', () => {
    clearTimeout(timer);
    resize.disconnect();
    document.removeEventListener('fullscreenchange', onFullscreen);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    dialog.remove();
    trigger?.focus();
  });

  document.body.append(dialog);
  dialog.showModal();
  // (the keys work straight away; Tab goes on to the toolbar)
  dialog.tabIndex = -1;
  dialog.focus();
  render();
  resize.observe(stage);
  return dialog;
}
