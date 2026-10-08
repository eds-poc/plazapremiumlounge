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
 * The authored lines of the block, from every row and cell (authors may split them), without
 * empty ones.
 * @param {Element} block
 * @returns {Element[]}
 */
function readLines(block) {
  return [...block.querySelectorAll(':scope > div > div')].flatMap((cell) => {
    const children = [...cell.children];
    if (!children.length && cell.textContent.trim()) {
      return [Object.assign(el('p'), { textContent: cell.textContent.trim() })];
    }
    return children;
  }).filter((line) => line.textContent.trim() || line.querySelector('picture'));
}

/**
 * Decorates the title block, the source's section and page titles (`title-wrapper`): an
 * optional eyebrow line, the heading, and optional intro text. The heading keeps its authored
 * level; with no heading, the first line becomes an h2.
 * @param {Element} block The title block element
 */
export default function decorate(block) {
  const lines = readLines(block);
  let index = lines.findIndex((line) => line.matches(HEADINGS));
  if (index < 0 && lines.length) {
    const h2 = el('h2');
    h2.append(...lines[0].childNodes);
    lines[0] = h2;
    index = 0;
  }
  const content = [];
  if (index > 0) {
    // the line(s) above the heading are the eyebrow (e.g. LATEST OFFERS)
    const eyebrow = el('p', 'title-eyebrow');
    lines.slice(0, index).forEach((line, i) => {
      if (i) eyebrow.append(' ');
      eyebrow.append(...line.childNodes);
    });
    content.push(eyebrow);
  }
  if (index >= 0) {
    const heading = lines[index];
    heading.classList.add('title-heading');
    content.push(heading);
  }
  const rest = lines.slice(index + 1);
  if (rest.length) {
    const intro = el('div', 'title-intro');
    intro.append(...rest);
    content.push(intro);
  }
  block.replaceChildren(...content);
}
