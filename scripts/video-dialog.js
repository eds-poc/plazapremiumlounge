import { loadCSS } from './aem.js';
import { translate } from './i18n.js';

const PROVIDER_NAMES = { youtube: 'YouTube', vimeo: 'Vimeo' };
// YouTube player errors: bad ID, HTML5 error, not found or private, embedding not allowed
const YOUTUBE_ERRORS = [2, 5, 100, 101, 150];
const YOUTUBE_ORIGIN = 'https://www.youtube-nocookie.com';

/**
 * Builds the fallback shown instead of a player: a message and a link that opens the video's own
 * page in a new tab ("Watch on Vimeo", "Watch on YouTube", else "Open the video"), announced to
 * screen readers.
 * @param {{href: string, provider?: string}} video
 * @returns {HTMLElement}
 */
function buildFallback(video) {
  const panel = document.createElement('div');
  panel.className = 'video-dialog-fallback';
  panel.setAttribute('role', 'status');
  const message = document.createElement('p');
  message.textContent = translate('videoUnavailable');
  const link = document.createElement('a');
  link.className = 'button white';
  link.href = video.href;
  link.target = '_blank';
  link.rel = 'noopener';
  const provider = PROVIDER_NAMES[video.provider];
  link.textContent = provider ? translate('watchOn', { provider }) : translate('openVideo');
  const note = document.createElement('span');
  note.className = 'visually-hidden';
  note.textContent = translate('opensInNewTab');
  link.append(note);
  panel.append(message, link);
  return panel;
}

/**
 * Asks Vimeo whether the video can play on this website: its oEmbed answer has
 * `domain_status_code` 403 when the video may only be embedded on other sites, and the request
 * fails for private or deleted videos. The answer also has the video's title.
 * @param {{src: string, href: string}} video
 * @returns {Promise<{playable: boolean, title?: string}>} playable when Vimeo can't be asked
 */
async function checkVimeo(video) {
  const player = new URL(video.src);
  const id = player.pathname.split('/').pop();
  const hash = player.searchParams.get('h');
  const page = `https://vimeo.com/${id}${hash ? `/${hash}` : ''}`;
  try {
    const res = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(page)}`);
    if (!res.ok) return { playable: false };
    const data = await res.json();
    return { playable: !(data.domain_status_code >= 400), title: data.title };
  } catch {
    return { playable: true };
  }
}

/**
 * Builds the player: an embedded player (YouTube, Vimeo) or a native video for a video file.
 * @param {{type: 'iframe'|'file', provider: string, src: string}} video
 * @param {string} title
 * @returns {HTMLIFrameElement|HTMLVideoElement}
 */
function buildPlayer(video, title) {
  if (video.type === 'file') {
    const player = document.createElement('video');
    player.src = video.src;
    player.controls = true;
    player.autoplay = true;
    player.playsInline = true;
    player.setAttribute('aria-label', title);
    return player;
  }
  const player = document.createElement('iframe');
  const src = new URL(video.src);
  // YouTube reports player errors to the page once asked to (see watchPlayer)
  if (video.provider === 'youtube') {
    src.searchParams.set('enablejsapi', '1');
    src.searchParams.set('origin', window.location.origin);
  }
  player.src = src.href;
  player.title = title;
  player.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
  player.referrerPolicy = 'strict-origin-when-cross-origin';
  return player;
}

/**
 * Swaps the player for the fallback when it reports that the video can't play: a video file's
 * error event, or a YouTube player error. Stops listening when the popup closes.
 * @param {HTMLElement} player
 * @param {object} video
 * @param {HTMLDialogElement} dialog
 */
function watchPlayer(player, video, dialog) {
  const fail = () => {
    if (player.isConnected) player.replaceWith(buildFallback(video));
  };
  if (video.type === 'file') {
    player.addEventListener('error', fail, { once: true });
    return;
  }
  if (video.provider !== 'youtube') return;
  const onMessage = (e) => {
    if (e.origin !== YOUTUBE_ORIGIN || e.source !== player.contentWindow) return;
    let data;
    try {
      data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
    } catch {
      return;
    }
    if (data?.event === 'onError' && YOUTUBE_ERRORS.includes(Number(data.info))) fail();
  };
  window.addEventListener('message', onMessage);
  player.addEventListener('load', () => {
    player.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), YOUTUBE_ORIGIN);
  });
  dialog.addEventListener('close', () => window.removeEventListener('message', onMessage), { once: true });
}

/**
 * Fills the frame: the fallback for a link that isn't a video we can play, else the player. A
 * Vimeo video is checked first, so a video that may not play on this website shows the fallback
 * instead of Vimeo's own error screen; its title names the popup when the trigger gave none.
 * @param {HTMLElement} frame
 * @param {object} video
 * @param {string} title
 * @param {HTMLDialogElement} dialog
 */
async function fillFrame(frame, video, title, dialog) {
  if (video.type === 'unavailable') {
    frame.append(buildFallback(video));
    return;
  }
  let name = title;
  if (video.provider === 'vimeo') {
    const check = await checkVimeo(video);
    if (!dialog.open) return;
    if (!name && check.title) {
      name = check.title;
      dialog.setAttribute('aria-label', name);
    }
    if (!check.playable) {
      frame.append(buildFallback(video));
      return;
    }
  }
  const player = buildPlayer(video, name || translate('video'));
  watchPlayer(player, video, dialog);
  frame.append(player);
}

/**
 * Opens a video in a popup, as the source's Fancybox video: a 16:9 frame of at most 960x540px,
 * centred over a dark backdrop, with the close button just above its top right corner. Closes on
 * the button, Esc (native cancel) and a click on the backdrop. The popup is removed on close, so
 * the video stops; focus returns to the trigger. When the video can't play here, the frame shows
 * a message and a link to watch it on its own site.
 * @param {{type: 'iframe'|'file'|'unavailable', provider?: string, src?: string, href: string}}
 *   video From openVideo() in video.js
 * @param {Object} [options]
 * @param {HTMLElement} [options.trigger] The element that opened it
 * @param {string} [options.title] What the video is, for screen readers
 */
// eslint-disable-next-line import/prefer-default-export
export async function openVideoDialog(video, { trigger, title } = {}) {
  await loadCSS(`${window.hlx.codeBasePath}/styles/video-dialog.css`);
  document.querySelectorAll('dialog.video-dialog').forEach((d) => d.close());

  const dialog = document.createElement('dialog');
  dialog.className = 'video-dialog';
  dialog.setAttribute('aria-label', title || translate('video'));

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'video-dialog-close';
  close.setAttribute('aria-label', translate('close'));

  // the close button sits in the frame, so it stays with the frame's corner at every size
  const frame = document.createElement('div');
  frame.className = 'video-dialog-frame';
  frame.append(close);

  dialog.append(frame);
  close.addEventListener('click', () => dialog.close());
  // a click outside the player lands on the dialog itself, which is the backdrop area
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    dialog.remove();
    document.body.classList.remove('video-dialog-open');
    trigger?.focus();
  });

  document.body.append(dialog);
  document.body.classList.add('video-dialog-open');
  dialog.showModal();
  close.focus();
  fillFrame(frame, video, title, dialog);
}
