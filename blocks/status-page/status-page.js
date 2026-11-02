/*
 * Status Page: the source's 404, 500 and Maintenance pages (`section.maroonBg .notice`), one block
 * for all three: only the authored content differs. One cell: the image, the title (a heading)
 * and the text (paragraphs, links). The block fills its section in the brand maroon.
 */
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
  }).filter((line) => line.textContent.trim() || line.querySelector('picture, img'));
}

/**
 * Decorates the Status Page block: the image, the title and the text, centred in a column of at
 * most 800px, in the middle of a 720px high area. The first line with an image is the image; the
 * first heading is the title (its authored level kept; with no heading, the first text line
 * becomes an h1); every other line is the text. A part left out isn't shown.
 * @param {Element} block The status-page block element
 */
export default function decorate(block) {
  const lines = readLines(block);
  const imageLine = lines.find((line) => line.querySelector('picture, img'));
  const others = lines.filter((line) => line !== imageLine);
  let title = others.find((line) => line.matches(HEADINGS));
  if (!title && others.length) {
    title = el('h1');
    title.append(...others[0].childNodes);
    others[0] = title;
  }

  const notice = el('div', 'status-page-notice');
  if (imageLine) {
    const image = el('div', 'status-page-image');
    image.append(imageLine.querySelector('picture') || imageLine.querySelector('img'));
    notice.append(image);
  }
  if (title) {
    title.classList.add('status-page-title');
    notice.append(title);
  }
  const rest = others.filter((line) => line !== title);
  if (rest.length) {
    const text = el('div', 'status-page-text');
    text.append(...rest);
    notice.append(text);
  }
  block.replaceChildren(notice);
}
