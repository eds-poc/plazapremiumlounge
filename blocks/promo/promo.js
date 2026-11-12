import { applyButtonAction } from '../../scripts/button-actions.js';

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
 * The authored lines of the block, from every row and cell, without empty ones. Loose text
 * becomes a paragraph.
 * @param {Element} block
 * @returns {Element[]}
 */
function lines(block) {
  return [...block.querySelectorAll(':scope > div > div')].flatMap((cell) => {
    const children = [...cell.children];
    if (!children.length && cell.textContent.trim()) {
      return [Object.assign(el('p'), { textContent: cell.textContent.trim() })];
    }
    return children;
  }).filter((line) => line.textContent.trim());
}

/**
 * Builds the button from a paragraph holding only a link: the label, then an arrow (CSS); the
 * site's link actions apply (e.g. other websites open in a new tab).
 * @param {HTMLAnchorElement} link
 * @returns {HTMLElement}
 */
function buildButton(link) {
  const action = el('p', 'promo-action');
  const label = el('span', 'promo-button-label');
  label.textContent = link.textContent.trim();
  link.className = 'promo-button';
  if (!link.title.trim()) link.title = label.textContent;
  link.replaceChildren(label);
  action.append(applyButtonAction(link));
  return action;
}

/**
 * Decorates the promo block, a call-to-action box as the source offer pages' `premium-cta-box`
 * (Rogers Bank "Apply Now"): a gradient box with a centred heading (italic words become a gold
 * serif accent), text and a gold button from a paragraph holding only a link.
 * @param {Element} block The promo block element
 */
export default function decorate(block) {
  const card = block.classList.contains('card');
  const content = lines(block).map((line) => {
    const link = line.querySelector('a[href]');
    if (link && line.textContent.trim() === link.textContent.trim()) {
      // option card: a bold link is the filled button, a plain one the outlined button
      // (the site's buttons have already made a bold link a primary button)
      const solid = card && (!!link.closest('strong, b') || link.classList.contains('primary'));
      const action = buildButton(link);
      if (card) action.classList.add(solid ? 'is-solid' : 'is-outline');
      return action;
    }
    if (line.matches(HEADINGS)) line.classList.add('promo-heading');
    else line.className = 'promo-text';
    return line;
  });
  if (card) {
    // the buttons side by side (stacked on phones), after the text
    const actions = el('div', 'promo-actions');
    actions.append(...content.filter((node) => node.classList.contains('promo-action')));
    block.replaceChildren(...content.filter((node) => !node.classList.contains('promo-action')), ...(actions.children.length ? [actions] : []));
    return;
  }
  block.replaceChildren(...content);
}
