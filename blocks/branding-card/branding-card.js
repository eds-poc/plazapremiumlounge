import { createOptimizedPicture } from '../../scripts/aem.js';
import { buildButton } from '../../scripts/buttons.js';
import { applyButtonAction } from '../../scripts/button-actions.js';
import { getVideo } from '../../scripts/video.js';
import { translate } from '../../scripts/i18n.js';

const HEADINGS = 'h1, h2, h3, h4, h5, h6';
let count = 0;

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
 * The authored lines of a row, from all its cells, without empty ones. Loose text becomes a
 * paragraph.
 * @param {Element} row
 * @returns {Element[]}
 */
function lines(row) {
  return [...row.children].flatMap((cell) => {
    const children = [...cell.children];
    if (!children.length && cell.textContent.trim()) {
      return [Object.assign(el('p'), { textContent: cell.textContent.trim() })];
    }
    return children;
  }).filter((line) => line.textContent.trim() || line.querySelector('picture'));
}

/**
 * The link a line holds on its own (a button), or null for a line of text.
 * @param {Element} line
 * @returns {HTMLAnchorElement|null}
 */
function onlyLink(line) {
  const link = line.querySelector('a[href]');
  return link && !line.querySelector('picture') && line.textContent.trim() === link.textContent.trim()
    ? link : null;
}

/**
 * Whether a paragraph is written entirely in bold (a title authored without a heading style).
 * @param {Element} line
 * @returns {boolean}
 */
function isBoldLine(line) {
  const bold = line.querySelector(':scope > strong, :scope > b');
  return line.matches('p') && line.children.length === 1 && !!bold && !bold.querySelector('a')
    && line.textContent.trim() === bold.textContent.trim();
}

/**
 * Builds a card button from an authored link: a video link plays in the video popup (its label
 * defaults to "Watch Video" when the author left only the address), any other link navigates.
 * @param {HTMLAnchorElement} link
 * @returns {HTMLElement|null}
 */
function buildAction(link) {
  const text = link.textContent.trim();
  if (getVideo(link.href) && (!text || text === link.href || text === link.getAttribute('href'))) {
    link.textContent = translate('watchVideo');
  }
  return buildButton(link, []);
}

/**
 * Builds the card's photo: the picture, linked when the author linked the image (a video link
 * plays the video and shows a play icon).
 * @param {HTMLPictureElement} picture
 * @param {string} name The card title, naming a linked image
 * @returns {HTMLElement}
 */
function buildMedia(picture, name) {
  const img = picture.querySelector('img');
  const optimized = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
  const link = picture.closest('a[href]');
  if (!link) {
    const media = el('div', 'branding-card-media');
    media.append(optimized);
    return media;
  }
  const media = el('a', 'branding-card-media');
  media.href = link.getAttribute('href');
  media.append(optimized);
  const video = !!getVideo(link.href);
  const label = img.alt || name;
  if (video) media.setAttribute('aria-label', translate('playVideo', { name: label || translate('video') }));
  else if (label) media.setAttribute('aria-label', label);
  const action = applyButtonAction(media);
  if (video) action.dataset.videoTitle = name;
  return action;
}

/**
 * Builds one card from an authored row: the photo, the title (a heading, or a line in bold),
 * the text, then a button for each line that holds only a link.
 * @param {Element} row
 * @returns {HTMLLIElement|null} null for an empty row
 */
function buildCard(row) {
  const all = lines(row);
  if (!all.length) return null;
  count += 1;

  const picture = row.querySelector('picture');
  let title = all.find((line) => line.matches(HEADINGS));
  if (!title) {
    const bold = all.find(isBoldLine);
    if (bold) {
      title = el('h3');
      title.textContent = bold.textContent.trim();
      bold.replaceWith(title);
      all[all.indexOf(bold)] = title;
    }
  }
  const name = title?.textContent.trim() || '';

  const card = el('li', 'branding-card-item');
  if (picture) card.append(buildMedia(picture, name));
  else card.classList.add('no-media');

  const body = el('div', 'branding-card-body');
  if (title) {
    title.classList.add('branding-card-title');
    title.id = `branding-card-title-${count}`;
    body.append(title);
  }
  const text = el('div', 'branding-card-text');
  const actions = el('div', 'branding-card-actions');
  all.forEach((line) => {
    if (line === title || line.querySelector('picture')) return;
    const link = onlyLink(line);
    if (!link) {
      text.append(line);
      return;
    }
    const button = buildAction(link);
    if (!button) return;
    const control = button.querySelector('a, button');
    if (title) control.setAttribute('aria-describedby', title.id);
    if (name && control.dataset.action === 'video') control.dataset.videoTitle = name;
    actions.append(button);
  });
  if (text.children.length) body.append(text);
  if (body.children.length) card.append(body);
  if (actions.children.length) card.append(actions);
  // nothing to hover or focus: the text is always shown
  else card.classList.add('no-actions');
  return card;
}

/**
 * Decorates the branding card block, the source's "Your Destination Before Departure" grid
 * (`section.branding .gridBox`): each row is a card with a photo filling it, the title on top and
 * buttons at the bottom; on hover, or when a button has keyboard focus, a maroon tint and the
 * text appear. Any number of cards; missing photos, titles, text or buttons are left out.
 * @param {Element} block The branding card block element
 */
export default function decorate(block) {
  const list = el('ul', 'branding-card-list');
  list.append(...[...block.children].map(buildCard).filter(Boolean));
  block.replaceChildren(list);
}
