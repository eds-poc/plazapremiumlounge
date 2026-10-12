const HEADINGS = 'h1, h2, h3, h4, h5, h6';

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
 * The authored lines of a cell, without empty ones. Loose text becomes a paragraph.
 * @param {Element} cell
 * @returns {Element[]}
 */
function lines(cell) {
  if (!cell) return [];
  const children = [...cell.children];
  if (!children.length && cell.textContent.trim()) {
    return [Object.assign(el('p'), { textContent: cell.textContent.trim() })];
  }
  return children.filter((line) => line.textContent.trim() || line.querySelector('.icon'));
}

/**
 * Whether a line holds only an icon (`:name:`).
 * @param {Element} line
 * @returns {boolean}
 */
function isIconLine(line) {
  return !!line.querySelector('.icon') && !line.textContent.trim();
}

/**
 * The intro text: the line(s) before the heading are the eyebrow pill, the heading keeps its
 * level, the first paragraph after it is the larger intro and the rest is text. Without a heading
 * every line is text.
 * @param {Element[]} items
 * @returns {HTMLElement}
 */
function buildMain(items) {
  const main = el('div', 'campaign-main');
  const index = items.findIndex((line) => line.matches(HEADINGS));
  items.forEach((line, i) => {
    if (index >= 0 && i < index) line.className = 'campaign-tag';
    else if (i === index) line.classList.add('campaign-heading');
    else line.classList.add(index >= 0 && i === index + 1 ? 'campaign-intro' : 'campaign-text');
    main.append(line);
  });
  return main;
}

/**
 * The panel: an optional title, then icon items. A line with only an icon, or a heading, starts
 * an item; the text after the item's heading is its description.
 * @param {Element[]} items
 * @returns {HTMLElement}
 */
function buildPanel(items) {
  const panel = el('div', 'campaign-panel');
  if (items.length && !isIconLine(items[0])) {
    const title = items.shift();
    title.className = 'campaign-panel-title';
    panel.append(title);
  }
  const list = el('ul', 'campaign-items');
  let body;
  const start = () => {
    const item = el('li', 'campaign-item');
    body = el('div', 'campaign-item-body');
    item.append(body);
    list.append(item);
    return item;
  };
  items.forEach((line) => {
    if (isIconLine(line)) {
      const icon = el('span', 'campaign-icon');
      icon.append(...line.querySelectorAll('.icon'));
      start().prepend(icon);
      return;
    }
    if (line.matches(HEADINGS)) {
      if (!body || body.querySelector('.campaign-item-title')) start();
      line.classList.add('campaign-item-title');
    } else if (!body) {
      start();
    }
    body.append(line);
  });
  if (list.children.length) panel.append(list);
  return panel;
}

/**
 * Decorates the campaign block, the intro of a partner campaign (the source offer pages'
 * `#ppl-campaign-container` first band, e.g. Rogers Bank): the intro text beside a panel with a
 * title and icon items. Column 1 is the text, column 2 the panel (optional).
 * @param {Element} block The campaign block element
 */
export default function decorate(block) {
  const [mainCell, panelCell] = [...(block.firstElementChild?.children || [])];
  const content = [buildMain(lines(mainCell))];
  const panelLines = lines(panelCell);
  if (panelLines.length) content.push(buildPanel(panelLines));
  block.replaceChildren(...content);
}
