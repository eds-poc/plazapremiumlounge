import { applyButtonAction } from '../../scripts/button-actions.js';
import { buildButton } from '../../scripts/buttons.js';

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
 * The device a device-row cell names: `desktop-content` / `mobile-content` (any case, spaces or
 * dashes, with or without "-content"), or null.
 * @param {Element} cell
 * @returns {'desktop'|'mobile'|null}
 */
function deviceOf(cell) {
  if (cell.querySelector('picture, img, a')) return null;
  const name = cell.textContent.trim().toLowerCase().replace(/[\s_-]+/g, '-');
  const match = name.match(/^(desktop|mobile)(-content)?$/);
  return match ? match[1] : null;
}

/**
 * Whether a cell holds anything to show.
 * @param {Element} cell
 * @returns {boolean}
 */
function hasContent(cell) {
  return !!cell.textContent.trim() || !!cell.querySelector('picture, img, .icon');
}

/**
 * Links an image that's followed by a paragraph holding only a link to its own URL (how a linked
 * image can arrive from authoring), so the image itself is the link.
 * @param {Element} container
 */
function joinImageLinks(container) {
  container.querySelectorAll(':scope > p').forEach((p) => {
    const picture = p.querySelector(':scope > picture');
    const next = p.nextElementSibling;
    const link = next?.matches('p') && next.children.length === 1 ? next.querySelector(':scope > a[href]') : null;
    if (!picture || picture.closest('a') || p.textContent.trim() || !link) return;
    if (link.textContent.trim() !== link.getAttribute('href')) return;
    link.replaceChildren(picture);
    p.append(link);
    next.remove();
  });
}

/**
 * Makes a link written in bold (or italic) on its own line a button, as the site does for page text
 * (a one-line cell arrives without a paragraph, so the page's own button step misses it): bold is
 * the primary button, italic the outline one.
 * @param {Element} container
 */
function decorateButtons(container) {
  container.querySelectorAll('a[href]:not(.button)').forEach((link) => {
    const format = link.closest('strong, em, b, i');
    if (!format || !container.contains(format) || link.querySelector('img')) return;
    const line = format.parentElement.matches('p') ? format.parentElement : format;
    if (line.textContent.trim() !== link.textContent.trim()) return;
    const button = buildButton(link, format.matches('em, i') ? ['outline'] : []);
    if (button) line.replaceWith(button);
  });
}

/**
 * Finishes the links: an image link is named (and titled) by its image's alt text; every link gets
 * the site's link actions (e.g. other websites open in a new tab, said to screen readers).
 * @param {Element} block
 */
function decorateLinks(block) {
  block.querySelectorAll('a[href]').forEach((link) => {
    const img = link.querySelector('img');
    if (img && !link.textContent.trim()) {
      link.classList.add('responsive-content-image-link');
      if (!link.title.trim() && img.alt) link.title = img.alt;
    }
    const result = applyButtonAction(link);
    if (result !== link) link.replaceWith(result);
  });
}

/**
 * Decorates the responsive content block: content shown only on some screens. The first row names
 * each column's device (`desktop-content`: above 1024px, `mobile-content`: 1024px and below); the
 * following rows hold each device's content. A column without a known device name shows on every
 * screen, and without a device row everything does.
 * @param {HTMLElement} block The responsive content block element
 */
export default function decorate(block) {
  const rows = [...block.children];
  const head = rows[0] ? [...rows[0].children] : [];
  const devices = head.map(deviceOf);
  const hasDeviceRow = devices.some(Boolean);
  const columns = hasDeviceRow ? devices : [];
  const groups = new Map();
  (hasDeviceRow ? rows.slice(1) : rows).forEach((row) => {
    [...row.children].forEach((cell, i) => {
      if (!hasContent(cell)) return;
      const device = columns[i] || 'all';
      if (!groups.has(device)) groups.set(device, el('div', `responsive-content-${device}`));
      groups.get(device).append(...cell.childNodes);
    });
  });
  groups.forEach((group) => {
    joinImageLinks(group);
    decorateButtons(group);
  });
  block.replaceChildren(...groups.values());
  decorateLinks(block);
}
