import { applyButtonAction } from '../../scripts/button-actions.js';

// authored style word -> global button class (styles/styles.css)
const STYLES = {
  primary: 'primary',
  outline: 'secondary',
  tint: 'accent',
  tertiary: 'tertiary',
  white: 'white',
};
const MODIFIERS = ['large', 'arrow', 'full-width', 'disabled'];

/**
 * Splits authored style text ("Outline, large") into known words.
 * @param {string} text
 * @returns {string[]}
 */
function words(text) {
  return (text || '').toLowerCase().split(/[\s,]+/).filter((w) => w in STYLES || MODIFIERS.includes(w));
}

/**
 * Builds one button from an authored row: a link cell and an optional style cell, in either
 * order. The row's style wins over the block default, which wins over primary; modifiers add up.
 * @param {Element} row
 * @param {string[]} defaults Style words from the block options
 * @returns {HTMLElement|null} The button wrapper, or null for a row without a link
 */
function buildButton(row, defaults) {
  const source = row.querySelector('a[href]');
  const label = source?.textContent.trim();
  if (!label) return null;
  const styleCell = [...row.children].find((c) => !c.contains(source));
  const own = words(styleCell?.textContent);

  const style = own.find((w) => w in STYLES) || defaults.find((w) => w in STYLES) || 'primary';
  const modifiers = new Set([...defaults, ...own].filter((w) => MODIFIERS.includes(w)));

  const link = document.createElement('a');
  link.href = source.getAttribute('href');
  link.textContent = label;
  if (source.title && source.title !== label) link.title = source.title;
  link.classList.add('button', STYLES[style], ...[...modifiers].filter((m) => m !== 'disabled'));

  let el = link;
  if (modifiers.has('disabled')) {
    link.removeAttribute('href');
    link.setAttribute('aria-disabled', 'true');
    link.setAttribute('role', 'link');
  } else {
    el = applyButtonAction(link);
  }

  const wrapper = document.createElement('p');
  wrapper.className = 'button-wrapper';
  wrapper.append(el);
  return wrapper;
}

/**
 * loads and decorates the buttons block
 * @param {Element} block The buttons block element
 */
export default function decorate(block) {
  const defaults = words([...block.classList].join(' '));
  const buttons = [...block.children].map((row) => buildButton(row, defaults)).filter(Boolean);
  block.replaceChildren(...buttons);
}
