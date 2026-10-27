/*
 * Video links: a link to a YouTube or Vimeo video, or to a video file, plays in a popup instead of
 * leaving the page, wherever it is authored (a block button, a linked image or plain text). The
 * popup (video-dialog.js) loads on first use. Links that aren't videos are left alone, except in a
 * video dialog button (Buttons (video dialog)), which always opens the popup.
 */
import { translate } from './i18n.js';

const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'];
const VIMEO_HOSTS = ['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'];
const VIDEO_FILE = /\.(?:mp4|webm|ogv|mov)$/i;
const YOUTUBE_ID = /^[\w-]{11}$/;

/**
 * The YouTube video ID of a URL: watch?v=, youtu.be/, /shorts/, /embed/ or /live/ links.
 * @param {URL} url
 * @returns {string} '' when it isn't a YouTube video
 */
function youtubeId(url) {
  let id = '';
  if (url.hostname === 'youtu.be') [, id] = url.pathname.split('/');
  else if (YOUTUBE_HOSTS.includes(url.hostname)) {
    const [, kind, value] = url.pathname.split('/');
    if (kind === 'watch') id = url.searchParams.get('v') || '';
    else if (['shorts', 'embed', 'live'].includes(kind)) id = value || '';
  }
  return YOUTUBE_ID.test(id) ? id : '';
}

/**
 * The Vimeo video ID (and the private-link hash, if any) of a URL: vimeo.com/123,
 * vimeo.com/123/abcdef or player.vimeo.com/video/123.
 * @param {URL} url
 * @returns {{id: string, hash: string}|null}
 */
function vimeoVideo(url) {
  if (!VIMEO_HOSTS.includes(url.hostname)) return null;
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] === 'video') parts.shift();
  const [id, hash] = parts;
  if (!/^\d+$/.test(id || '')) return null;
  return { id, hash: /^[\da-f]+$/i.test(hash || '') ? hash : url.searchParams.get('h') || '' };
}

/**
 * How a link plays as a video: an embedded player (`iframe`) or a video file (`file`), with the
 * provider and the original link (for the popup's fallback link).
 * @param {string} href
 * @returns {{type: 'iframe'|'file', provider: 'youtube'|'vimeo'|'file', src: string,
 *   href: string}|null} null when the link isn't a video
 */
export function getVideo(href) {
  let url;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol)) return null;

  const youtube = youtubeId(url);
  if (youtube) {
    const src = new URL(`https://www.youtube-nocookie.com/embed/${youtube}`);
    src.searchParams.set('autoplay', '1');
    src.searchParams.set('rel', '0');
    // a start time in seconds (?t=90 or ?t=90s)
    const start = (url.searchParams.get('t') || url.searchParams.get('start') || '').match(/^(\d+)s?$/);
    if (start) src.searchParams.set('start', start[1]);
    return {
      type: 'iframe', provider: 'youtube', src: src.href, href: url.href,
    };
  }

  const vimeo = vimeoVideo(url);
  if (vimeo) {
    const src = new URL(`https://player.vimeo.com/video/${vimeo.id}`);
    if (vimeo.hash) src.searchParams.set('h', vimeo.hash);
    src.searchParams.set('autoplay', '1');
    src.searchParams.set('dnt', '1');
    return {
      type: 'iframe', provider: 'vimeo', src: src.href, href: url.href,
    };
  }

  if (VIDEO_FILE.test(url.pathname)) {
    return {
      type: 'file', provider: 'file', src: url.href, href: url.href,
    };
  }
  return null;
}

/**
 * Opens a video link in the video popup. A link that isn't a video we can play (only possible from
 * a Buttons (video dialog) button) opens the popup's fallback: a message and a link to open it.
 * @param {string} href The video link
 * @param {HTMLElement} [trigger] The element that opened it; focus returns here
 * @param {string} [title] What the video is (e.g. the card heading), for screen readers
 */
export async function openVideo(href, trigger, title) {
  const video = getVideo(href)
    || { type: 'unavailable', href: new URL(href, window.location.href).href };
  const { openVideoDialog } = await import('./video-dialog.js');
  openVideoDialog(video, { trigger, title });
}

/**
 * The name of a video for screen readers: an explicit `data-video-title`, else the link's title
 * when it says more than its label.
 * @param {HTMLElement} el The link or button
 * @returns {string}
 */
function videoTitle(el) {
  const label = el.textContent.trim();
  if (el.dataset.videoTitle) return el.dataset.videoTitle;
  return el.title && el.title !== label ? el.title : '';
}

/**
 * Makes a video link a button that opens the video popup (the `video` button action). The button
 * keeps the link's classes, label and aria attributes; the video URL stays in `data-href`.
 * @param {HTMLAnchorElement} link
 * @returns {HTMLButtonElement}
 */
export function buildVideoButton(link) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = link.className;
  btn.append(...link.childNodes);
  if (link.title) btn.title = link.title;
  [...link.attributes]
    .filter((a) => a.name.startsWith('aria-') || a.name.startsWith('data-'))
    .forEach((a) => btn.setAttribute(a.name, a.value));
  btn.dataset.href = link.getAttribute('href');
  btn.setAttribute('aria-haspopup', 'dialog');
  btn.addEventListener('click', () => openVideo(btn.dataset.href, btn, videoTitle(btn)));
  return btn;
}

/**
 * For a video dialog button (Buttons (video dialog), or a nested Buttons (video dialog) table): a
 * link written as its own address (a bare video URL) gets the label "Watch Video", without the
 * address as its title.
 * @param {HTMLAnchorElement} [link] The authored link
 */
export function labelBareVideoLink(link) {
  if (!link) return;
  const text = link.textContent.trim();
  if (text && text !== link.href && text !== link.getAttribute('href')) return;
  link.textContent = translate('watchVideo');
  if (link.title === text) link.removeAttribute('title');
}

/**
 * Makes a built button (from scripts/buttons.js) a video dialog button: it opens its link in the
 * video popup. A video link already is one; any other link becomes one too, and the popup shows
 * its fallback (a message and a link to open it). Disabled buttons stay as they are. The video's
 * name for screen readers is the link's title, else the label.
 * @param {HTMLElement} wrapper A p.button-wrapper from buildButton()
 */
export function toVideoDialogButton(wrapper) {
  let control = wrapper?.querySelector('a, button');
  if (!control || control.getAttribute('aria-disabled') === 'true') return;
  // the label, without the "opens in a new tab" note of an external link
  const label = [...control.childNodes]
    .filter((node) => !node.classList?.contains('visually-hidden'))
    .map((node) => node.textContent).join('').trim();
  if (control.dataset.action !== 'video') {
    const link = document.createElement('a');
    link.href = control.getAttribute('href') || control.dataset.href;
    link.className = control.className;
    link.textContent = label;
    if (control.title) link.title = control.title;
    const button = buildVideoButton(link);
    button.dataset.action = 'video';
    control.replaceWith(button);
    control = button;
  }
  if (!control.dataset.videoTitle) {
    control.dataset.videoTitle = control.title && control.title !== label ? control.title : label;
  }
}

let installed = false;

/**
 * Lets any video link on the site play in the popup, including links in plain text that no block
 * turned into a button. Modifier clicks keep their normal browser behaviour (e.g. a new tab).
 */
export function installVideoLinks() {
  if (installed) return;
  installed = true;
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    const link = e.target.closest('a[href]');
    if (!link || link.hasAttribute('download') || !getVideo(link.href)) return;
    e.preventDefault();
    openVideo(link.href, link, videoTitle(link));
  });
}
