import { applyButtonAction } from '../../scripts/button-actions.js';

const HEADINGS = 'h1, h2, h3, h4, h5, h6';
// tile colours (the source "pink" and "red" offer cards); empty or "white" is the default
const COLOURS = ['blush', 'coral', 'white'];
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
 * The text lines of a cell: its block children, or the bare text when the cell has none.
 * @param {Element} cell
 * @returns {Element[]}
 */
function lines(cell) {
  if (!cell) return [];
  const children = [...cell.children];
  if (!children.length && cell.textContent.trim()) {
    return [Object.assign(el('p'), { textContent: cell.textContent.trim() })];
  }
  return children;
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
 * Builds the info button and its popover. Uses the native popover (light dismiss, Esc, top
 * layer) where supported, and a small click/Esc/outside-click fallback elsewhere.
 * @param {Element[]} content The popover text lines
 * @param {string} title The tile title, for the button's accessible name
 * @returns {HTMLElement[]} The button and the popover
 */
function buildInfo(content, title) {
  popoverCount += 1;
  const id = `tiles-popover-${popoverCount}`;
  const button = el('button', 'tiles-info');
  button.type = 'button';
  button.setAttribute('aria-label', title ? `More information: ${title}` : 'More information');
  const popover = el('div', 'tiles-popover');
  popover.id = id;
  popover.append(...content);

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
      if (popover.classList.contains('is-open')) { close(); return; }
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
 * Builds the tile head from column 1: the first text line is the title (always shown in the
 * title style, whatever was authored), an image is the tag, any later text is the popover text.
 * @param {Element} cell
 * @returns {HTMLElement}
 */
function buildHead(cell) {
  const head = el('div', 'tiles-head');
  const title = el('h3', 'tiles-title');
  const tags = el('div', 'tiles-tags');
  const popoverLines = [];
  lines(cell).forEach((line) => {
    const pic = line.matches('picture') ? line : line.querySelector('picture');
    if (pic && !tags.querySelector('.tiles-tag')) {
      const tag = el('span', 'tiles-tag');
      tag.append(pic);
      tags.append(tag);
      if (!line.textContent.trim()) return;
    }
    const text = line.textContent.trim();
    if (!text) return;
    if (!title.textContent) {
      // the authored heading level is kept for the outline; its look is fixed by the class
      const heading = line.matches(HEADINGS) ? el(line.tagName.toLowerCase(), 'tiles-title') : title;
      heading.textContent = text;
      head.append(heading);
      title.textContent = text;
    } else {
      const p = el('p');
      p.append(...line.childNodes);
      popoverLines.push(p);
    }
  });
  // no title text: keep the title column without an empty heading
  if (!head.querySelector('.tiles-title')) head.append(el('div', 'tiles-title'));
  if (popoverLines.length) {
    const [button, popover] = buildInfo(popoverLines, title.textContent);
    // the space between tag and icon, as on the source
    if (tags.children.length) tags.append(' ');
    tags.append(button, popover);
  }
  head.append(tags);
  return head;
}

/**
 * Builds the tile body from column 2: a bold or heading first line is the subtitle, a line with
 * just a link is the button, everything else is text.
 * @param {Element} cell
 * @returns {{body: HTMLElement|null, action: HTMLElement|null}}
 */
function buildBody(cell) {
  const body = el('div', 'tiles-body');
  let action = null;
  lines(cell).forEach((line, i) => {
    const text = line.textContent.trim();
    if (!text && !line.querySelector('picture')) return;
    const link = line.querySelector('a[href]');
    const bold = line.querySelector('strong, b');
    if (link && !action && text === link.textContent.trim()) {
      action = el('p', 'tiles-action');
      link.className = 'tiles-button';
      action.append(applyButtonAction(link));
    } else if (i === 0 && (line.matches(HEADINGS) || (bold && text === bold.textContent.trim()))) {
      const subtitle = el('p', 'tiles-subtitle');
      subtitle.textContent = text;
      body.append(subtitle);
    } else {
      body.append(line);
    }
  });
  return { body: body.children.length ? body : null, action };
}

/**
 * Builds one tile from a row: column 1 head, column 2 body, column 3 colour.
 * @param {Element} row
 * @returns {HTMLLIElement|null}
 */
function buildTile(row) {
  const [headCell, bodyCell, colourCell] = [...row.children];
  const hasContent = (c) => !!c && (!!c.textContent.trim() || !!c.querySelector('picture'));
  if (!hasContent(headCell) && !hasContent(bodyCell)) return null;
  const tile = el('li', 'tiles-tile');
  const colour = colourCell?.textContent.trim().toLowerCase();
  if (colour && COLOURS.includes(colour)) tile.classList.add(`tiles-${colour}`);
  tile.append(buildHead(headCell));
  const { body, action } = buildBody(bodyCell);
  if (body) tile.append(body);
  if (action) tile.append(action);
  return tile;
}

/**
 * loads and decorates the tiles block: text-only coloured tiles (homepage "Latest Offers")
 * @param {Element} block The tiles block element
 */
export default function decorate(block) {
  const list = el('ul', 'tiles-list');
  [...block.children].forEach((row) => {
    const tile = buildTile(row);
    if (tile) list.append(tile);
  });
  block.replaceChildren(list);
}
