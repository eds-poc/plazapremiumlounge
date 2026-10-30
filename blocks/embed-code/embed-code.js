import { loadScript } from '../../scripts/aem.js';

const TYPES = ['script', 'style', 'iframe', 'html'];
const SNIPPET = /<[a-z][^\s/>]*(?:\s[^>]*|\/?)>/i;
const URL_TEXT = /^(https?:\/\/|\/)[^\s;()]+$/i;
const SCRIPT_FILE = /\.m?js(\?|#|$)/i;
const STYLE_FILE = /\.css(\?|#|$)/i;

/**
 * The text of a cell, keeping the author's line breaks (paragraphs and <br>), so that
 * multi-line code keeps working.
 * @param {Element} cell
 * @returns {string}
 */
function cellText(cell) {
  if (!cell) return '';
  const pre = cell.querySelector('pre');
  if (pre) return pre.textContent.trim();
  const lines = cell.children.length ? [...cell.children] : [cell];
  return lines.map((line) => {
    const copy = line.cloneNode(true);
    copy.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
    return copy.textContent;
  }).join('\n').trim();
}

/**
 * The URL a cell holds: a link whose text is its address, or a plain URL.
 * @param {Element} cell
 * @param {string} text The cell text
 * @returns {URL|null}
 */
function cellUrl(cell, text) {
  const link = cell?.querySelector('a[href]');
  const href = link && link.textContent.trim() === text ? link.href : text;
  if (!URL_TEXT.test(href)) return null;
  try {
    const url = new URL(href, window.location.href);
    return ['http:', 'https:'].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

/**
 * Builds an iframe; a size from the embed code (e.g. width="560" height="315") becomes its
 * aspect ratio, so it still fills the column width.
 * @param {object} attrs
 * @returns {HTMLIFrameElement|null}
 */
function buildIframe(attrs) {
  if (!attrs.src) return null;
  let url;
  try {
    url = new URL(attrs.src, window.location.href);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol)) return null;

  const iframe = document.createElement('iframe');
  Object.entries(attrs).forEach(([name, value]) => iframe.setAttribute(name, value));
  iframe.src = url.href;
  if (!iframe.title) iframe.title = 'Embedded content';
  if (!iframe.hasAttribute('loading')) iframe.loading = 'lazy';

  const width = parseFloat(attrs.width);
  const height = parseFloat(attrs.height);
  if (width > 0 && height > 0 && /^\d+(\.\d+)?(px)?$/.test(String(attrs.width).trim())) {
    iframe.style.aspectRatio = `${width} / ${height}`;
  } else if (attrs.height) {
    iframe.style.height = /^\d+(\.\d+)?$/.test(String(attrs.height).trim()) ? `${height}px` : attrs.height;
  }
  iframe.removeAttribute('width');
  iframe.removeAttribute('height');
  return iframe;
}

/**
 * Extracts scripts and styles for the head, keeping the remaining HTML and its nesting
 * for the block. Parsing doesn't run or apply anything.
 * @param {string} code
 * @returns {object[]} Items: `{ type: 'script' | 'style', attrs, code }`, a style file as
 *   `{ type: 'style', attrs: { href, … } }`, or `{ type: 'html', node }`
 */
function parseSnippet(code) {
  const doc = new DOMParser().parseFromString(code, 'text/html');
  const items = [];
  doc.querySelectorAll('script, style, link[rel~="stylesheet" i][href]').forEach((node) => {
    if (node.closest('noscript')) return;
    const attrs = Object.fromEntries([...node.attributes]
      .map(({ name, value }) => [name, value]));
    items.push({
      type: node.localName === 'link' ? 'style' : node.localName,
      attrs,
      code: node.textContent,
    });
    node.remove();
  });
  doc.querySelectorAll('iframe').forEach((node) => {
    const attrs = Object.fromEntries([...node.attributes]
      .map(({ name, value }) => [name, value]));
    const iframe = buildIframe(attrs);
    if (iframe) node.replaceWith(iframe);
  });
  // an image's width/height attributes are its size, as where the code comes from (the site's
  // `main img` rule sets both to auto): a width with the height kept in proportion (so it still
  // shrinks to fit), else a height
  doc.querySelectorAll('img[width], img[height]').forEach((img) => {
    const size = (name) => {
      const value = (img.getAttribute(name) || '').trim();
      return /^\d+(\.\d+)?(px)?$/.test(value) ? `${parseFloat(value)}px` : '';
    };
    if (img.style.width || img.style.height) return;
    if (size('width')) img.style.width = size('width');
    else if (size('height')) img.style.height = size('height');
  });
  [...doc.head.childNodes, ...doc.body.childNodes].forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) return;
    items.push({ type: 'html', node });
  });
  return items;
}

/**
 * Reads one row: `Script | file URL or code`, `Style | file URL or CSS`,
 * `Iframe | URL | title | height`, `HTML | markup`, or code pasted in a single cell.
 * Without a label, a
 * `.js` URL is a script file, a `.css` URL a style file, any other URL an iframe, and anything
 * else script code.
 * @param {Element} row
 * @returns {object[]} The row's items
 */
function readRow(row) {
  const cells = [...row.children];
  const label = cells.length > 1 ? cells[0].textContent.trim().toLowerCase() : '';
  const labelled = TYPES.includes(label);
  const [valueCell, titleCell, heightCell] = labelled ? cells.slice(1) : cells;
  const text = cellText(valueCell);
  if (!text) return [];
  if (label === 'html' || SNIPPET.test(text)) return parseSnippet(text);

  const url = cellUrl(valueCell, text);
  let type = label;
  if (!labelled) {
    if (!url || SCRIPT_FILE.test(url.pathname)) type = 'script';
    else type = STYLE_FILE.test(url.pathname) ? 'style' : 'iframe';
  }
  if (type === 'style') {
    return url ? [{ type, attrs: { href: url.href } }] : [{ type, attrs: {}, code: text }];
  }
  if (type === 'iframe') {
    if (!url) return [];
    const attrs = { src: url.href };
    const title = cellText(titleCell);
    const height = cellText(heightCell);
    if (title) attrs.title = title;
    if (height) attrs.height = height;
    return [{ type, attrs }];
  }
  return url ? [{ type, attrs: { src: url.href } }] : [{ type, attrs: {}, code: text }];
}

/**
 * Runs script code from the head. The page has loaded by the time the block runs, so the
 * DOMContentLoaded (and, once loaded, load) listeners the code adds would never be called:
 * they are called straight after the code instead.
 * @param {HTMLScriptElement} script
 */
function runScript(script) {
  const listeners = [];
  const targets = [document, window];
  targets.forEach((target) => {
    const add = target.addEventListener;
    target.addEventListener = (type, listener, options) => {
      if (type === 'DOMContentLoaded' || (type === 'load' && document.readyState === 'complete')) {
        listeners.push({ target, type, listener });
      } else {
        add.call(target, type, listener, options);
      }
    };
  });
  try {
    document.head.append(script);
  } finally {
    targets.forEach((target) => delete target.addEventListener);
  }
  listeners.forEach(({ target, type, listener }) => {
    try {
      const event = new Event(type);
      if (typeof listener === 'function') listener.call(target, event);
      else listener?.handleEvent?.(event);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('embed-code: script error', error);
    }
  });
}

/**
 * Adds the scripts to the head in authored order. A script file is waited for before the
 * next script runs (code that uses it can follow it), unless it is marked `async`.
 * @param {object[]} scripts
 */
async function injectScripts(scripts) {
  // eslint-disable-next-line no-restricted-syntax
  for (const { attrs, code } of scripts) {
    const { src, ...rest } = attrs;
    if (src) {
      const loading = loadScript(new URL(src, window.location.href).href, rest).catch(() => {
        // eslint-disable-next-line no-console
        console.error(`embed-code: failed to load ${src}`);
      });
      // eslint-disable-next-line no-await-in-loop
      if (!('async' in rest)) await loading;
    } else if (code.trim()) {
      const script = document.createElement('script');
      Object.entries(rest).forEach(([name, value]) => script.setAttribute(name, value));
      script.textContent = code;
      runScript(script);
    }
  }
}

/**
 * Adds the styles to the head in authored order: style files as stylesheet links (each file
 * once, also across blocks), CSS code as <style> elements.
 * @param {object[]} styles
 */
function injectStyles(styles) {
  styles.forEach(({ attrs, code }) => {
    const { href, ...rest } = attrs;
    let style;
    if (href) {
      const url = new URL(href, window.location.href).href;
      if (document.querySelector(`head > link[href="${url}"]`)) return;
      style = document.createElement('link');
      style.rel = 'stylesheet';
      style.href = url;
    } else if (code.trim()) {
      style = document.createElement('style');
      style.textContent = code;
    } else {
      return;
    }
    Object.entries(rest).forEach(([name, value]) => style.setAttribute(name, value));
    document.head.append(style);
  });
}

/**
 * Decorates the embed code block: scripts and styles go to the document head, HTML stays
 * where the block is. A block without HTML takes no space on the page.
 * @param {Element} block The embed code block element
 */
export default function decorate(block) {
  const items = [...block.children].flatMap(readRow);
  const content = items.flatMap((item) => {
    if (item.type === 'html') return [item.node];
    if (item.type === 'iframe') return [buildIframe(item.attrs)].filter(Boolean);
    return [];
  });

  // styles first, so they apply before the block's content shows
  injectStyles(items.filter((item) => item.type === 'style'));
  block.replaceChildren(...content);
  if (!content.length) (block.closest('.embed-code-wrapper') || block).hidden = true;

  // not awaited: slow third-party scripts don't hold up the page
  injectScripts(items.filter((item) => item.type === 'script'));
}
