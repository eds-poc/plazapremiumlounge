/*
 * Status Page: the source's 404, 500 and Maintenance pages (`section.maroonBg .notice`), one block
 * for all three: only the authored content differs. One cell: the image, the title (a heading)
 * and the text (paragraphs, links). The block fills its section in the brand maroon.
 */
// eslint-disable-next-line import/no-cycle
import { pushEvent } from '../../scripts/datalayer.js';

const HEADINGS = 'h1, h2, h3, h4, h5, h6';
const IMAGES = 'picture, img';

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
  }).filter((line) => line.textContent.trim()
    || line.matches(IMAGES) || line.querySelector(IMAGES));
}

/**
 * The image of a line: the line itself (a picture or an image straight in the cell), else the
 * picture or image in it (e.g. in a paragraph); null when it has none.
 * @param {Element} line
 * @returns {Element|null}
 */
function imageOf(line) {
  if (line.matches(IMAGES)) return line;
  return line.querySelector('picture') || line.querySelector('img');
}

// the error pages' messages for the data layer, by code (the Maintenance page isn't an error)
const ERROR_MESSAGES = {
  404: 'Page Not Found',
  500: 'Internal Server Error',
};

/**
 * The page's error code: 404.html's (any missing address; it sets window.errorCode), else the
 * address's last part (/en-uk/404, /en-uk/500).
 * @returns {string}
 */
function readErrorCode() {
  return window.errorCode || window.location.pathname.split('/').pop();
}

/**
 * The data layer's link click for an error page.
 * @param {string} errorCode e.g. 404
 * @param {string} errorMessage e.g. Page Not Found
 */
function trackError(errorCode, errorMessage) {
  const eventName = 'error';
  pushEvent('web.webInteraction.linkClicks', eventName, {
    web: {
      webInteraction: {
        name: eventName,
        type: 'other',
        linkClicks: {
          value: 1,
        },
      },
    },
    _plazapremiumloungemanagementli: {
      errors: [
        {
          errorCode,
          errorMessage,
        },
      ],
    },
  });
}

/**
 * Decorates the Status Page block by rendering a centered image, title, and text.
 * The first image becomes the status icon, the first heading becomes the title,
 * and the remaining content is displayed as text. Missing elements are ignored.
 *
 * @param {Element} block The status-page block element.
 */
export default function decorate(block) {
  const lines = readLines(block);
  const imageLine = lines.find(imageOf);
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
    image.append(imageOf(imageLine));
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
  // the data layer's error, on the 404 and 500 pages
  const errorCode = readErrorCode();
  if (ERROR_MESSAGES[errorCode]) trackError(errorCode, ERROR_MESSAGES[errorCode]);
}
