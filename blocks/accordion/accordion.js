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
 * The question of a row: its first cell's text, keeping inline formatting (a heading or
 * paragraph wrapper is dropped, as a summary takes phrasing content).
 * @param {Element} cell
 * @returns {Node[]}
 */
function questionNodes(cell) {
  const holder = cell.querySelector('h1, h2, h3, h4, h5, h6, p') || cell;
  return [...holder.childNodes];
}

/**
 * Decorates the accordion block, as the source accordions (About page "Awards and Milestones"):
 * one item per row, question in column 1 and answer in column 2. Each item opens and closes on
 * its own (native details/summary: keyboard, screen readers and find-in-page work as usual).
 * Columns per row come from the block options (columns-2, columns-3); see accordion.css.
 * @param {Element} block The accordion block element
 */
export default function decorate(block) {
  const items = [...block.children].map((row) => {
    const [questionCell, answerCell] = [...row.children];
    if (!questionCell?.textContent.trim()) return null;
    const item = el('details', 'accordion-item');
    const summary = el('summary', 'accordion-question');
    const label = el('span', 'accordion-question-text');
    label.append(...questionNodes(questionCell));
    summary.append(label);
    const answer = el('div', 'accordion-answer');
    if (answerCell) answer.append(...answerCell.childNodes);
    item.append(summary, answer);
    return item;
  }).filter(Boolean);
  block.replaceChildren(...items);
}
