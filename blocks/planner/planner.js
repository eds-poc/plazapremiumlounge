const HEADINGS = 'h1, h2, h3, h4, h5, h6';
const PLACEHOLDER = /\{(guests|passes|remaining)\}/g;

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
 * @param {Element} [cell]
 * @returns {Element[]}
 */
function lines(cell) {
  if (!cell) return [];
  const children = [...cell.children];
  if (!children.length && cell.textContent.trim()) {
    return [Object.assign(el('p'), { textContent: cell.textContent.trim() })];
  }
  return children.filter((line) => line.textContent.trim());
}

/**
 * The header: the line(s) before the heading are the eyebrow, the heading keeps its level, and
 * the text after it is the subtitle. Without a heading every line is subtitle text.
 * @param {Element[]} items
 * @returns {HTMLElement}
 */
function buildHeader(items) {
  const header = el('div', 'planner-header');
  const index = items.findIndex((line) => line.matches(HEADINGS));
  items.forEach((line, i) => {
    if (index >= 0 && i < index) line.className = 'planner-eyebrow';
    else if (i === index) line.classList.add('planner-heading');
    else line.classList.add('planner-sub');
    header.append(line);
  });
  return header;
}

/**
 * Turns `{guests}`, `{passes}` and `{remaining}` in an element's text into live values.
 * @param {Element} node
 */
function bindPlaceholders(node) {
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  const texts = [];
  while (walker.nextNode()) texts.push(walker.currentNode);
  texts.filter((text) => text.nodeValue.match(PLACEHOLDER)).forEach((text) => {
    // split keeps the captured names at the odd positions
    const nodes = text.nodeValue.split(PLACEHOLDER).map((part, i) => {
      if (i % 2 === 0) return document.createTextNode(part);
      const value = el('span', 'planner-value');
      value.dataset.value = part;
      return value;
    });
    text.replaceWith(...nodes);
  });
}

/**
 * Decorates the planner block, the source offer pages' pass planner (`.planner-card`, e.g. Rogers
 * Bank): a guest slider with a summary that updates as it moves. Rows are `name | value`: Title,
 * Slider label, Badge, Steps (one list item per stop, the first is no guests), Start, Annual
 * passes and Summary (eyebrow, number label, badge, text). Texts can use {guests}, {passes} and
 * {remaining}: passes used are 1 cardmember + guests, remaining are annual passes - used.
 * @param {Element} block The planner block element
 */
export default function decorate(block) {
  const config = {};
  [...block.children].forEach((row) => {
    const [key, value] = [...row.children];
    const name = key?.textContent.trim().toLowerCase().replace(/\s+/g, ' ');
    if (name && value) config[name] = value;
  });
  const text = (name) => config[name]?.textContent.trim() || '';
  const steps = [...(config.steps?.querySelectorAll('li') || [])].map((li) => li.textContent.trim());
  const max = Math.max(steps.length - 1, 0);
  const annual = parseInt(text('annual passes'), 10) || 0;
  const start = Math.min(Math.max(parseInt(text('start'), 10) || 0, 0), max);

  const card = el('div', 'planner-card');
  card.append(buildHeader(lines(config.title)));

  // the slider: label and badge, the range, then the stop labels
  const controls = el('div', 'planner-controls');
  const labelRow = el('div', 'planner-slider-row');
  const id = `planner-slider-${[...document.querySelectorAll('.planner.block')].indexOf(block) + 1}`;
  const label = Object.assign(el('label', 'planner-slider-label'), { htmlFor: id, textContent: text('slider label') });
  labelRow.append(label);
  if (text('badge')) labelRow.append(Object.assign(el('span', 'planner-slider-badge'), { textContent: text('badge') }));
  const slider = Object.assign(el('input', 'planner-slider'), {
    type: 'range', id, min: 0, max, step: 1, value: start,
  });
  const ticks = el('div', 'planner-ticks');
  ticks.setAttribute('aria-hidden', 'true');
  ticks.append(...steps.map((step) => Object.assign(el('span'), { textContent: step })));
  controls.append(labelRow, slider, ticks);

  // the summary: eyebrow, the passes used, its label, the badge, then the text
  const summary = el('div', 'planner-summary');
  summary.setAttribute('aria-live', 'polite');
  const [eyebrow, numberLabel, badge, ...rest] = lines(config.summary);
  const number = Object.assign(el('p', 'planner-summary-number'), { textContent: '{passes}' });
  [
    [eyebrow, 'planner-summary-eyebrow'], [number], [numberLabel, 'planner-summary-label'],
    [badge, 'planner-summary-badge'], ...rest.map((line) => [line, 'planner-summary-text']),
  ].forEach(([line, className]) => {
    if (!line) return;
    if (className) line.className = className;
    summary.append(line);
  });

  const grid = el('div', 'planner-grid');
  grid.append(controls, summary);
  card.append(grid);
  block.replaceChildren(card);
  bindPlaceholders(block);

  const update = () => {
    const guests = parseInt(slider.value, 10);
    const passes = 1 + guests;
    const values = { guests, passes, remaining: Math.max(annual - passes, 0) };
    block.querySelectorAll('.planner-value').forEach((span) => {
      span.textContent = values[span.dataset.value];
    });
    slider.setAttribute('aria-valuetext', steps[guests] || String(guests));
  };
  slider.addEventListener('input', update);
  update();
}
