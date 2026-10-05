import { buildButtonFromRow, styleWords } from '../../scripts/buttons.js';

/**
 * loads and decorates the buttons block: one row per button (a link cell and an optional style
 * cell); the block options set the default style for every row
 * @param {Element} block The buttons block element
 */
export default function decorate(block) {
  const defaults = styleWords([...block.classList].join(' '));
  const buttons = [...block.children]
    .map((row) => buildButtonFromRow(row, defaults))
    .filter(Boolean);
  block.replaceChildren(...buttons);
}
