/*
 * Builds authored buttons in the site's button styles. Shared by blocks that offer buttons
 * (buttons, lounge-list, …): style words map to the global .button classes in styles.css, and
 * what a click does comes from the link (scripts/button-actions.js).
 */
import { applyButtonAction } from './button-actions.js';

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
 * Splits authored style text ("Outline, large") into known style words.
 * @param {string} text
 * @returns {string[]}
 */
export function styleWords(text) {
  return (text || '').toLowerCase().split(/[\s,]+/).filter((w) => w in STYLES || MODIFIERS.includes(w));
}

/**
 * Builds one button from an authored link. The button's own style words win over the defaults,
 * which win over primary; modifiers add up.
 * @param {HTMLAnchorElement} source The authored link
 * @param {string[]} own Style words for this button
 * @param {string[]} [defaults] Default style words (e.g. from block options)
 * @returns {HTMLElement|null} A p.button-wrapper with the button, or null without a label
 */
export function buildButton(source, own, defaults = []) {
  const label = source?.textContent.trim();
  if (!label) return null;

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
 * Builds a button from an authored row: a link cell and an optional style cell, in any order.
 * @param {Element} row
 * @param {string[]} [defaults]
 * @returns {HTMLElement|null}
 */
export function buildButtonFromRow(row, defaults = []) {
  const source = row.querySelector('a[href]');
  if (!source) return null;
  const styleCell = [...row.children].find((c) => !c.contains(source));
  return buildButton(source, styleWords(styleCell?.textContent), defaults);
}

const BUTTONS_HEADER = /^buttons?\s*(?:\(([^)]*)\))?$/i;

/**
 * Reads a Buttons table nested in a block row, with the same rules as the Buttons block: the
 * first row is "Buttons" or "Buttons (options)", then each row is a link and an optional style
 * cell. Header options are the defaults; without options, a row without its own style gets
 * `fallback` (the look the hosting block uses on the source site).
 * @param {Element} row A row of the hosting block
 * @param {string[]} [fallback]
 * @returns {HTMLElement[]|null} The buttons, or null when the row holds no Buttons table
 */
export function readNestedButtons(row, fallback = []) {
  const table = row.querySelector('table');
  const rows = table ? [...table.querySelectorAll(':scope > tbody > tr, :scope > tr')] : [];
  const match = rows[0]?.textContent.trim().match(BUTTONS_HEADER);
  if (!match) return null;
  const options = styleWords(match[1]);
  return rows.slice(1).map((tr) => {
    const source = tr.querySelector('a[href]');
    if (!source) return null;
    const styleCell = [...tr.children].find((c) => !c.contains(source));
    const own = styleWords(styleCell?.textContent);
    return options.length
      ? buildButton(source, own, options)
      : buildButton(source, own.length ? own : fallback);
  }).filter(Boolean);
}
