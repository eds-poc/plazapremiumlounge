import { loadCSS } from './aem.js';
import { translate } from './i18n.js';

/**
 * Builds the player: an embedded player (YouTube, Vimeo) or a native video for a video file.
 * @param {{type: 'iframe'|'file', src: string}} video
 * @param {string} title
 * @returns {HTMLElement}
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
  player.src = video.src;
  player.title = title;
  player.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
  player.referrerPolicy = 'strict-origin-when-cross-origin';
  return player;
}

/**
 * Opens a video in a popup, as the source's Fancybox video: a 16:9 player over a dark backdrop
 * with a close button above it. Closes on the button, Esc (native cancel) and a click on the
 * backdrop. The popup is removed on close, so the video stops; focus returns to the trigger.
 * @param {{type: 'iframe'|'file', src: string}} video From getVideo() in video.js
 * @param {Object} [options]
 * @param {HTMLElement} [options.trigger] The element that opened it
 * @param {string} [options.title] What the video is, for screen readers
 */
// eslint-disable-next-line import/prefer-default-export
export async function openVideoDialog(video, { trigger, title } = {}) {
  await loadCSS(`${window.hlx.codeBasePath}/styles/video-dialog.css`);
  document.querySelectorAll('dialog.video-dialog').forEach((d) => d.close());

  const name = title || translate('video');
  const dialog = document.createElement('dialog');
  dialog.className = 'video-dialog';
  dialog.setAttribute('aria-label', name);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'video-dialog-close';
  close.setAttribute('aria-label', translate('close'));

  const frame = document.createElement('div');
  frame.className = 'video-dialog-frame';
  frame.append(buildPlayer(video, name));

  dialog.append(close, frame);
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
}
