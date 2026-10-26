// Partner travel package steps (source /en-uk/rockinthunder "How to Redeem"): a header row
// (eyebrow, heading), then one row per step: number | title | description. Without a number
// cell the steps are numbered in order.

const HEADING = /^H([1-6])$/;

/**
 * Creates an element with an optional class name and text.
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 * @returns {HTMLElement}
 */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

const textOf = (node) => node.textContent.replace(/\s+/g, ' ').trim();

/**
 * The header: eyebrow (lines before the heading) and the heading, at its authored level.
 * @param {Element} cell
 * @returns {{ header: HTMLElement, level: number }}
 */
function buildHeader(cell) {
  const header = el('div', 'partner-travel-package-header');
  const lines = [...cell.children].filter((line) => textOf(line));
  const index = lines.findIndex((line) => HEADING.test(line.tagName));
  let level = 2;
  lines.forEach((line, i) => {
    if (index < 0 || i < index) {
      header.append(el('p', 'partner-travel-package-eyebrow', textOf(line)));
    } else if (i === index) {
      level = Number(line.tagName[1]);
      line.classList.add('partner-travel-package-heading');
      header.append(line);
    } else {
      // text after the heading (not on the source) stays, as an intro
      line.classList.add('partner-travel-package-intro');
      header.append(line);
    }
  });
  if (!cell.children.length && textOf(cell)) {
    header.append(el('p', 'partner-travel-package-eyebrow', textOf(cell)));
  }
  return { header, level };
}

/**
 * One step: the number in a circle, the title and the description.
 * @param {Element[]} cells
 * @param {number} position 1-based position, the number when none is authored
 * @param {number} titleLevel heading level of the step titles
 * @returns {HTMLLIElement}
 */
function buildStep(cells, position, titleLevel) {
  const [numberCell, titleCell, descriptionCell] = cells.length >= 3 ? cells : [null, ...cells];
  const step = el('li', 'partner-travel-package-step');
  const number = el('span', 'partner-travel-package-number', (numberCell && textOf(numberCell)) || String(position));
  number.setAttribute('aria-hidden', 'true');
  step.append(number);
  if (titleCell && textOf(titleCell)) {
    step.append(el(`h${titleLevel}`, 'partner-travel-package-step-title', textOf(titleCell)));
  }
  if (descriptionCell && textOf(descriptionCell)) {
    const description = el('p', 'partner-travel-package-step-description');
    const paragraphs = [...descriptionCell.querySelectorAll(':scope > p')];
    if (paragraphs.length) {
      paragraphs.forEach((p, i) => {
        if (i) description.append(el('br'));
        description.append(...p.childNodes);
      });
    } else {
      description.append(...descriptionCell.childNodes);
    }
    step.append(description);
  }
  return step;
}

/**
 * Decorates the partner travel package block.
 * @param {Element} block
 */
export default function decorate(block) {
  const children = [];
  const steps = el('ol', 'partner-travel-package-steps');
  let level = 2;
  [...block.querySelectorAll(':scope > div')].forEach((row) => {
    const cells = [...row.querySelectorAll(':scope > div')].filter((cell) => textOf(cell));
    if (!cells.length) return;
    // a single-cell row before the steps is the header
    if (cells.length === 1 && !steps.children.length && !children.length) {
      const built = buildHeader(cells[0]);
      level = built.level;
      children.push(built.header);
      return;
    }
    steps.append(buildStep(cells, steps.children.length + 1, Math.min(level + 1, 6)));
  });
  if (steps.children.length) children.push(steps);
  block.replaceChildren(...children);
}
