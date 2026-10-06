import { createOptimizedPicture } from '../../scripts/aem.js';
import { applyButtonAction } from '../../scripts/button-actions.js';

const HEADINGS = 'h1, h2, h3, h4, h5, h6';
// text-tile colours (the source "pink" and "red" offer cards); empty or "white" is the default
const TILE_COLOURS = ['blush', 'coral', 'white'];
// gap between the popover arrow tip and the info icon, and the popover's distance from the edges
const POPOVER_GAP = 8;
const VIEWPORT_MARGIN = 8;
const supportsPopover = Object.prototype.hasOwnProperty.call(HTMLElement.prototype, 'popover');
let popoverCount = 0;

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
 * A cell holding a single word and no heading, link or image: the tile colour (known or not).
 * @param {Element} cell
 * @returns {boolean}
 */
function isColourCell(cell) {
  const text = cell.textContent.trim();
  return !!text && !/\s/.test(text) && !cell.querySelector(`${HEADINGS}, a[href], picture`);
}

/**
 * Places the popover centred above the info button (below it when there is no room above),
 * kept inside the viewport; the arrow follows the button.
 * @param {HTMLButtonElement} button
 * @param {HTMLElement} popover
 */
function placePopover(button, popover) {
  const b = button.getBoundingClientRect();
  const width = popover.offsetWidth;
  const height = popover.offsetHeight;
  const centre = b.left + b.width / 2;
  const maxLeft = document.documentElement.clientWidth - width - VIEWPORT_MARGIN;
  const left = Math.max(VIEWPORT_MARGIN, Math.min(centre - width / 2, maxLeft));
  const below = b.top - height - POPOVER_GAP < VIEWPORT_MARGIN;
  const top = below ? b.bottom + POPOVER_GAP : b.top - height - POPOVER_GAP;
  popover.classList.toggle('is-below', below);
  popover.style.left = `${left + window.scrollX}px`;
  popover.style.top = `${top + window.scrollY}px`;
  popover.style.setProperty('--arrow-x', `${centre - left}px`);
}

/**
 * Builds the info button and its popover from the authored popover text. Uses the native popover
 * (light dismiss, Esc, top layer) where supported, and a small click/Esc/outside-click fallback.
 * @param {Element} cell The authored popover cell
 * @param {string} title The tile title, for the button's accessible name
 * @returns {HTMLElement[]} The button and the popover
 */
function buildInfo(cell, title) {
  popoverCount += 1;
  const id = `cards-tile-popover-${popoverCount}`;
  const button = el('button', 'cards-tile-info');
  button.type = 'button';
  button.setAttribute('aria-label', title ? `More information: ${title}` : 'More information');
  const popover = el('div', 'cards-tile-popover');
  popover.id = id;
  if (cell.children.length) popover.append(...cell.childNodes);
  else popover.append(Object.assign(el('p'), { textContent: cell.textContent.trim() }));

  if (supportsPopover) {
    popover.popover = 'auto';
    button.setAttribute('popovertarget', id);
    popover.addEventListener('toggle', (e) => {
      if (e.newState === 'open') placePopover(button, popover);
    });
  } else {
    // fallback: toggle on click, close on Esc or a click elsewhere
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', id);
    const close = () => {
      popover.classList.remove('is-open');
      button.setAttribute('aria-expanded', 'false');
    };
    button.addEventListener('click', () => {
      const open = !popover.classList.contains('is-open');
      if (!open) { close(); return; }
      document.body.append(popover);
      popover.classList.add('is-open');
      button.setAttribute('aria-expanded', 'true');
      placePopover(button, popover);
    });
    document.addEventListener('click', (e) => {
      if (!button.contains(e.target) && !popover.contains(e.target)) close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && popover.classList.contains('is-open')) { close(); button.focus(); }
    });
  }
  window.addEventListener('resize', () => {
    const open = supportsPopover ? popover.matches(':popover-open') : popover.classList.contains('is-open');
    if (open) placePopover(button, popover);
  });
  return [button, popover];
}

/**
 * Builds one text tile from an authored row: a content cell (optional badge image, title,
 * optional bold subtitle, text, link), plus an optional colour cell and an optional popover cell,
 * told apart by their content.
 * @param {Element} row
 * @returns {HTMLLIElement|null}
 */
function buildTile(row) {
  const cells = [...row.children].filter((c) => c.textContent.trim() || c.querySelector('picture'));
  const content = cells.find((c) => c.querySelector(`${HEADINGS}, a[href], picture`)) || cells[0];
  if (!content) return null;
  const colourCell = cells.find((c) => c !== content && isColourCell(c));
  const infoCell = cells.find((c) => c !== content && c !== colourCell);

  const tile = el('li', 'cards-tile');
  const colour = colourCell?.textContent.trim().toLowerCase();
  if (colour && TILE_COLOURS.includes(colour)) tile.classList.add(`cards-tile-${colour}`);

  const head = el('div', 'cards-tile-head');
  const body = el('div', 'cards-tile-body');
  const tags = el('div', 'cards-tile-tags');
  let title = null;
  let subtitle = null;
  let action = null;
  [...content.children].forEach((child) => {
    const pic = child.querySelector('picture') || (child.matches('picture') ? child : null);
    const link = child.querySelector('a[href]');
    if (child.matches(HEADINGS) && !title) {
      title = child;
      child.classList.add('cards-tile-title');
    } else if (pic && !child.textContent.trim() && !tags.querySelector('.cards-tile-badge')) {
      // a small image in the content cell is the badge, shown next to the info icon
      const badge = el('span', 'cards-tile-badge');
      badge.append(pic);
      tags.append(badge);
    } else if (link && !action && child.textContent.trim() === link.textContent.trim()) {
      action = el('p', 'cards-tile-action');
      link.className = 'cards-tile-button';
      action.append(applyButtonAction(link));
    } else if (title && !subtitle && !body.children.length && child.matches('p')
      && child.querySelector('strong, b') && child.textContent.trim() === child.querySelector('strong, b').textContent.trim()) {
      // the first all-bold paragraph after the title is the subtitle
      subtitle = el('p', 'cards-tile-subtitle');
      subtitle.textContent = child.textContent.trim();
      body.append(subtitle);
    } else {
      body.append(child);
    }
  });

  if (infoCell) {
    const [button, popover] = buildInfo(infoCell, title?.textContent.trim() || '');
    // the space between badge and icon, as on the source
    if (tags.children.length) tags.append(' ');
    tags.append(button, popover);
  }
  if (title) head.append(title);
  else head.append(el('div', 'cards-tile-title'));
  head.append(tags);
  tile.append(head);
  if (body.children.length) tile.append(body);
  if (action) tile.append(action);
  return tile;
}

/**
 * Text-tile variation: text-only coloured tiles (homepage "Latest Offers"), one per row.
 * @param {Element} block
 */
function decorateTextTiles(block) {
  const ul = el('ul');
  [...block.children].forEach((row) => {
    const tile = buildTile(row);
    if (tile) ul.append(tile);
  });
  block.replaceChildren(ul);
}

export default function decorate(block) {
  if (block.classList.contains('text-tile')) {
    decorateTextTiles(block);
    return;
  }

  /* change to ul, li */
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    while (row.firstElementChild) li.append(row.firstElementChild);
    [...li.children].forEach((div) => {
      if (div.children.length === 1 && div.querySelector('picture')) div.className = 'cards-card-image';
      else div.className = 'cards-card-body';
    });
    ul.append(li);
  });
  ul.querySelectorAll('picture > img').forEach((img) => img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }])));
  block.replaceChildren(ul);
}
