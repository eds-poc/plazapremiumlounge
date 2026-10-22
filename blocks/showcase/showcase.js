// a themed full-width campaign panel (source: the Smart Traveller x HSBC offer pages): a centred
// header, then cards, wide images, logo pills, buttons, closing text or notes, in authored order.
// Each row's role comes from its content, so authors only write text, images and links.

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

/**
 * The block-level children of a cell, with loose inline content (a cell without paragraphs)
 * wrapped in a paragraph.
 * @param {Element} cell
 * @returns {Element[]}
 */
function blocksOf(cell) {
  const out = [];
  let loose = null;
  [...cell.childNodes].forEach((node) => {
    const isBlock = node.nodeType === Node.ELEMENT_NODE
      && /^(P|DIV|UL|OL|H[1-6]|PICTURE)$/.test(node.tagName);
    if (isBlock) {
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
  return out;
}

const textOf = (node) => node.textContent.replace(/\s+/g, ' ').trim();
const hasMedia = (node) => !!node.querySelector('picture, img') || /^(PICTURE|IMG)$/.test(node.tagName);

/**
 * True when a paragraph holds only one or more links (a button line).
 * @param {Element} node
 * @returns {boolean}
 */
function isLinkLine(node) {
  if (hasMedia(node)) return false;
  const links = [...node.querySelectorAll('a[href]')];
  const squash = (s) => s.replace(/\s/g, '');
  return links.length > 0 && squash(node.textContent) === links.map((a) => squash(a.textContent)).join('');
}

/**
 * Builds the site-independent buttons of a link line.
 * @param {Element} node
 * @returns {HTMLAnchorElement[]}
 */
function buttonsOf(node) {
  return [...node.querySelectorAll('a[href]')].map((a) => {
    const button = el('a', 'showcase-button');
    button.href = a.getAttribute('href');
    button.textContent = textOf(a);
    if (a.title && a.title !== button.textContent) button.title = a.title;
    if (/^https?:/.test(button.href) && new URL(button.href).origin !== window.location.origin) {
      button.target = '_blank';
      button.rel = 'noopener';
    }
    return button;
  });
}

/**
 * The text part of a header or card: an eyebrow (the lines before the heading; without a
 * heading, the first line once there are at least `minLines` lines), the heading, the text and
 * its buttons.
 * @param {Element[]} nodes block-level nodes
 * @param {{minLines: number}} options
 * @returns {{eyebrow: Element[], heading: Element|null, text: Element[], buttons: Element[]}}
 */
function readText(nodes, { minLines }) {
  const parts = {
    eyebrow: [], heading: null, text: [], buttons: [],
  };
  const content = nodes.filter((n) => !hasMedia(n) && textOf(n));
  const headingAt = content.findIndex((n) => HEADING.test(n.tagName));
  content.forEach((node, i) => {
    if (i === headingAt) parts.heading = node;
    else if (isLinkLine(node)) parts.buttons.push(...buttonsOf(node));
    else if (headingAt > -1 && i < headingAt) parts.eyebrow.push(node);
    else parts.text.push(node);
  });
  if (headingAt === -1 && parts.text.length >= minLines) {
    parts.eyebrow.push(parts.text.shift());
  }
  return parts;
}

/**
 * The eyebrow line(s) as one small label.
 * @param {Element[]} nodes
 * @param {string} className
 * @returns {HTMLElement|null}
 */
function eyebrowOf(nodes, className) {
  if (!nodes.length) return null;
  const eyebrow = el('p', className);
  nodes.forEach((n, i) => {
    if (i) eyebrow.append(' ');
    eyebrow.append(...n.childNodes);
  });
  return eyebrow;
}

/**
 * Reads a row into its role: header, card, image, logos, buttons or text.
 * @param {Element} row
 * @param {boolean} first
 * @returns {{type: string, featured?: boolean, media?: Element, nodes: Element[]}|null}
 */
function readRow(row, first) {
  let cells = [...row.children];
  let featured = false;
  const last = cells.at(-1);
  if (cells.length > 1 && last && /^featured$/i.test(textOf(last)) && !hasMedia(last)) {
    featured = true;
    cells = cells.slice(0, -1);
  }
  const filled = cells.filter((c) => textOf(c) || hasMedia(c));
  if (!filled.length) return null;

  const nodes = filled.flatMap(blocksOf);
  const media = nodes.filter(hasMedia);
  const text = nodes.filter((n) => !hasMedia(n) && textOf(n));
  const pictures = filled.flatMap((c) => [...c.querySelectorAll('picture, img:not(picture img)')]);

  // a card: an image and text (in two cells, or one)
  if (media.length && text.length && !(filled.length === 1 && pictures.length > 1)) {
    return {
      type: 'card', featured, media: pictures[0], nodes: text,
    };
  }
  if (media.length) {
    return pictures.length > 1 || nodes.length > 1
      ? { type: 'logos', nodes }
      : { type: 'image', media: pictures[0], nodes: [] };
  }
  if (text.every(isLinkLine)) return { type: 'buttons', nodes: text };
  if (first) return { type: 'header', nodes: text };
  return { type: 'text', nodes: text };
}

/**
 * Builds the header: eyebrow, heading (its authored level is kept) and intro.
 * @param {Element[]} nodes
 * @returns {HTMLElement}
 */
function buildHeader(nodes) {
  const header = el('div', 'showcase-header');
  // a header without a heading is an eyebrow (e.g. "Important Information") and optional text
  const parts = readText(nodes, { minLines: 1 });
  const eyebrow = eyebrowOf(parts.eyebrow, 'showcase-eyebrow');
  if (eyebrow) header.append(eyebrow);
  if (parts.heading) {
    parts.heading.classList.add('showcase-title');
    header.append(parts.heading);
  }
  if (parts.text.length) {
    const intro = el('div', 'showcase-intro');
    intro.append(...parts.text);
    header.append(intro);
  }
  if (parts.buttons.length) {
    const actions = el('div', 'showcase-buttons');
    actions.append(...parts.buttons);
    header.append(actions);
  }
  return header;
}

/**
 * Builds one card: its image (or icon), then eyebrow, title, text and buttons.
 * @param {{featured: boolean, media: Element, nodes: Element[]}} row
 * @returns {HTMLElement}
 */
function buildCard({ featured, media, nodes }) {
  const card = el('div', featured ? 'showcase-card featured' : 'showcase-card');
  const figure = el('div', 'showcase-card-media');
  figure.append(media.closest('picture') || media);
  card.append(figure);

  const body = el('div', 'showcase-card-body');
  // without a title, a card's first line is its eyebrow when more text follows
  const parts = readText(nodes, { minLines: 2 });
  const eyebrow = eyebrowOf(parts.eyebrow, 'showcase-card-eyebrow');
  if (eyebrow) body.append(eyebrow);
  if (parts.heading) {
    const title = el('h3', 'showcase-card-title');
    title.append(...parts.heading.childNodes);
    body.append(title);
  }
  body.append(...parts.text);
  card.append(body);
  if (parts.buttons.length) {
    const actions = el('div', 'showcase-card-buttons');
    actions.append(...parts.buttons);
    card.append(actions);
  }
  return card;
}

/**
 * Builds the logo strip: each paragraph (or image) is a pill with its image and an optional
 * label, with a "×" between pills.
 * @param {Element[]} nodes
 * @returns {HTMLElement}
 */
function buildLogos(nodes) {
  const strip = el('div', 'showcase-logos');
  // several images in one paragraph: one pill each
  const pills = nodes.flatMap((node) => {
    const pics = [...node.querySelectorAll('picture, img:not(picture img)')];
    return pics.length > 1 ? pics : [node];
  });
  pills.forEach((node, i) => {
    if (i) {
      const x = el('span', 'showcase-logos-x');
      x.textContent = '×';
      x.setAttribute('aria-hidden', 'true');
      strip.append(x);
    }
    const pill = el('div', 'showcase-logo');
    const pic = /^(PICTURE|IMG)$/.test(node.tagName) ? node : node.querySelector('picture, img');
    if (pic) pill.append(pic);
    const label = /^(PICTURE|IMG)$/.test(node.tagName) ? '' : textOf(node);
    if (label) {
      const span = el('span', 'showcase-logo-label');
      span.textContent = label;
      pill.append(span);
    }
    strip.append(pill);
  });
  return strip;
}

/**
 * loads and decorates the showcase
 * @param {Element} block The showcase block element
 */
export default function decorate(block) {
  // undo the site's link-to-button decoration: the block draws its own buttons
  block.querySelectorAll('a.button').forEach((a) => {
    a.removeAttribute('class');
    a.closest('.button-wrapper')?.removeAttribute('class');
  });

  const body = el('div', 'showcase-body');
  let grid = null;
  [...block.children].forEach((row, i) => {
    const data = readRow(row, i === 0);
    if (!data) return;
    if (data.type !== 'card') grid = null;
    if (data.type === 'header') body.append(buildHeader(data.nodes));
    else if (data.type === 'card') {
      if (!grid) {
        grid = el('div', 'showcase-cards');
        body.append(grid);
      }
      grid.append(buildCard(data));
    } else if (data.type === 'image') {
      const figure = el('div', 'showcase-image');
      figure.append(data.media.closest('picture') || data.media);
      body.append(figure);
    } else if (data.type === 'logos') {
      body.append(buildLogos(data.nodes));
    } else if (data.type === 'buttons') {
      const actions = el('div', 'showcase-buttons');
      data.nodes.forEach((n) => actions.append(...buttonsOf(n)));
      body.append(actions);
    } else {
      const text = el('div', 'showcase-text');
      text.append(...data.nodes);
      body.append(text);
    }
  });

  // a lone card is centred and not stretched (e.g. a single marketplace card)
  body.querySelectorAll('.showcase-cards').forEach((g) => {
    if (g.children.length === 1) g.classList.add('single');
  });

  block.replaceChildren(body);
}
