// Partner festival intro (source /en-uk/rockinthunder): an eyebrow pill, the heading, the
// description and small print, then the campaign CTAs (label | value), the first light, the
// others dark; the authored images form a column beside the text. Rows are read by content, so
// authors may add or leave out any of them.

const HEADING = /^H[1-6]$/;

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

const textOf = (node) => node.textContent.replace(/\s+/g, ' ').trim();

/**
 * The block-level lines of a cell, with loose inline content wrapped in a paragraph.
 * @param {Element} cell
 * @returns {Element[]}
 */
function linesOf(cell) {
  const out = [];
  let loose = null;
  [...cell.childNodes].forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE && /^(P|DIV|UL|OL|H[1-6])$/.test(node.tagName)) {
      loose = null;
      out.push(node);
    } else if (node.nodeType === Node.ELEMENT_NODE || node.textContent.trim()) {
      if (!loose) {
        loose = el('p');
        out.push(loose);
      }
      loose.append(node);
    }
  });
  return out.filter((line) => textOf(line));
}

/**
 * True when a paragraph is all italic (the small print, e.g. "Offer valid for a limited time").
 * @param {Element} line
 * @returns {boolean}
 */
function isNote(line) {
  const em = line.querySelector('em, i');
  return line.tagName === 'P' && !!em && textOf(em) === textOf(line);
}

/**
 * The intro content: eyebrow (the line before the heading), heading, description and notes.
 * @param {Element[]} lines
 * @returns {HTMLElement}
 */
function buildContent(lines) {
  const content = el('div', 'partner-festival-content-content');
  const index = lines.findIndex((line) => HEADING.test(line.tagName));
  lines.forEach((line, i) => {
    if (i < index) {
      const eyebrow = el('p', 'partner-festival-content-eyebrow');
      eyebrow.textContent = textOf(line);
      content.append(eyebrow);
    } else if (i === index) {
      line.classList.add('partner-festival-content-heading');
      content.append(line);
    } else {
      if (isNote(line)) line.classList.add('partner-festival-content-note');
      content.append(line);
    }
  });
  return content;
}

/**
 * A CTA: label over value; a link in the row makes the whole CTA a link.
 * @param {Element[]} cells
 * @returns {HTMLElement}
 */
function buildCta(cells) {
  const link = cells.map((cell) => cell.querySelector('a[href]')).find(Boolean);
  const cta = el(link ? 'a' : 'div', 'partner-festival-content-cta');
  if (link) {
    cta.href = link.getAttribute('href');
    if (/^https?:/.test(cta.href) && new URL(cta.href).origin !== window.location.origin) {
      cta.target = '_blank';
      cta.rel = 'noopener';
    }
  }
  const [labelCell, valueCell] = cells.length > 1 ? cells : [null, cells[0]];
  if (labelCell && textOf(labelCell)) {
    const label = el('span', 'partner-festival-content-cta-label');
    label.textContent = textOf(labelCell);
    cta.append(label);
  }
  const value = el('span', 'partner-festival-content-cta-value');
  value.textContent = textOf(valueCell);
  cta.append(value);
  return cta;
}

/**
 * Decorates the partner festival content block.
 * @param {Element} block
 */
export default function decorate(block) {
  // the images, wherever they are authored (usually a second cell beside the content), become the
  // image column; they are taken out first so the rest reads as text
  const media = [...block.querySelectorAll('picture, img:not(picture img)')].map((picture) => {
    const item = el('div', 'partner-festival-content-image');
    item.append(picture);
    return item;
  });

  const rows = [...block.querySelectorAll(':scope > div')];
  const contentLines = [];
  const ctas = [];
  rows.forEach((row) => {
    const cells = [...row.querySelectorAll(':scope > div')].filter((cell) => textOf(cell));
    if (!cells.length) return;
    const lines = cells.flatMap(linesOf);
    // a row with a heading, or a single cell before any CTA, is the intro content
    if (lines.some((line) => HEADING.test(line.tagName)) || (cells.length === 1 && !ctas.length
      && !cells[0].querySelector('a[href]'))) {
      contentLines.push(...lines);
    } else {
      ctas.push(buildCta(cells));
    }
  });

  const text = el('div', 'partner-festival-content-text');
  if (contentLines.length) text.append(buildContent(contentLines));
  if (ctas.length) {
    const list = el('div', 'partner-festival-content-ctas');
    list.append(...ctas);
    text.append(list);
  }
  const children = [text];
  if (media.length) {
    const column = el('div', 'partner-festival-content-media');
    column.append(...media);
    children.push(column);
    block.classList.add('has-media');
  }
  block.replaceChildren(...children);
}
