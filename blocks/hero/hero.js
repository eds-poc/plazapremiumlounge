import { buildButton, readNestedButtons } from '../../scripts/buttons.js';
import { labelBareVideoLink, toVideoDialogButton } from '../../scripts/video.js';

const HEADINGS = 'h1, h2, h3, h4, h5, h6';
const BUTTONS_HEADER = /^buttons?\s*(?:\(([^)]*)\))?$/i;

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
 * Builds the buttons of a nested Buttons table (same rules as the Buttons block). Option video
 * dialog (`Buttons (video dialog)`) makes every button open its link in the video popup.
 * @param {HTMLTableElement} table
 * @returns {HTMLElement[]}
 */
function buildNestedButtons(table) {
  const header = table.querySelector('tr')?.textContent.trim() || '';
  const videoDialog = /video[\s-]*dialog/i.test(header.match(BUTTONS_HEADER)?.[1] || '');
  if (videoDialog) table.querySelectorAll('a[href]').forEach(labelBareVideoLink);
  // readNestedButtons reads the first table it finds, so give it this one on its own
  const holder = el('div');
  holder.append(table);
  const buttons = readNestedButtons(holder) || [];
  if (videoDialog) buttons.forEach(toVideoDialogButton);
  return buttons;
}

/**
 * Decorates option video playback, the source's destination banner
 * (`.destination-banner-wrapper` on /your-destination-before-departure): a full-width photo at
 * 5:2 with a "Watch Video" button centred near the bottom. Authored in any cells: the photo, any
 * text (shown centred over the photo; a heading before the title is a smaller line above it),
 * and the buttons, as a nested Buttons (video dialog) table or lines holding only a link.
 * Missing parts are left out; without a photo the banner is maroon.
 * @param {Element} block
 */
function decorateVideoPlayback(block) {
  const cells = [...block.querySelectorAll(':scope > div > div')];
  const picture = block.querySelector('picture');
  const content = el('div', 'hero-content');
  const actions = el('div', 'hero-actions');

  cells.forEach((cell) => {
    [...cell.children].forEach((node) => {
      if (node.matches('table')) {
        actions.append(...buildNestedButtons(node));
        return;
      }
      if (node.querySelector('table')) {
        node.querySelectorAll('table').forEach((t) => actions.append(...buildNestedButtons(t)));
        return;
      }
      if (node.querySelector('picture') || !node.textContent.trim()) return;
      // a line holding only a link is a button
      const link = node.querySelector('a[href]');
      if (link && node.textContent.trim() === link.textContent.trim() && !node.matches(HEADINGS)) {
        const button = buildButton(link, []);
        if (button) actions.append(button);
        return;
      }
      content.append(node);
    });
  });

  // a line above the title (e.g. "Your destination before departure") is smaller
  const title = content.querySelector('h1') || content.querySelector(HEADINGS);
  if (title) {
    title.classList.add('hero-title');
    let prev = title.previousElementSibling;
    while (prev) {
      prev.classList.add('hero-eyebrow');
      prev = prev.previousElementSibling;
    }
  }

  // the video popup is named after the banner (its title, else the photo's description), unless
  // the author gave the link a title of its own
  const name = title?.textContent.trim() || picture?.querySelector('img')?.alt.trim();
  actions.querySelectorAll('button[data-action="video"]').forEach((button) => {
    const own = button.dataset.videoTitle;
    if (name && (!own || own === button.textContent.trim())) {
      button.dataset.videoTitle = name;
    }
  });

  const media = el('div', 'hero-media');
  if (picture) media.append(picture);
  else block.classList.add('no-media');

  block.replaceChildren(media);
  if (content.children.length) block.append(content);
  if (actions.children.length) block.append(actions);
}

/**
 * Decorates the hero block. The default hero is styled by hero.css alone; option video playback
 * builds the destination banner with its video button.
 * @param {Element} block The hero block element
 */
export default function decorate(block) {
  if (block.classList.contains('video-playback')) decorateVideoPlayback(block);
}
