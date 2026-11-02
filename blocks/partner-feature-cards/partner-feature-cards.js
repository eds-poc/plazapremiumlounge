// Partner offer cards (source /en-uk/rockinthunder pricing grid): one row per card with the
// content (eyebrow, title, description) | the price (currency, price, price label) | the benefits
// (bold title, then the description) | optional badge, which also highlights the card.

const HEADING = /^H[1-6]$/;

/**
 * Creates an element with an optional class name and text.
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 * @returns {HTMLElement}
 */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

const textOf = (node) => node.textContent.replace(/\s+/g, ' ').trim();

/**
 * The lines of a cell: its paragraphs, headings and list items, or its text split at line
 * breaks when the author typed it without paragraphs.
 * @param {Element} cell
 * @returns {Element[]}
 */
function linesOf(cell) {
  const blocks = [...cell.querySelectorAll(':scope > p, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6, :scope > ul > li, :scope > ol > li')];
  const lines = blocks.length ? blocks : [cell];
  return lines.flatMap((line) => {
    if (!line.querySelector('br')) return [line];
    return line.innerHTML.split(/<br\s*\/?>/i).map((part) => {
      const p = el('p');
      p.innerHTML = part;
      return p;
    });
  }).filter((line) => textOf(line));
}

/**
 * Eyebrow (lines before the heading), title and description.
 * @param {Element} cell
 * @returns {HTMLElement[]}
 */
function buildContent(cell) {
  const lines = linesOf(cell);
  const index = lines.findIndex((line) => HEADING.test(line.tagName));
  const out = [];
  lines.forEach((line, i) => {
    if (i < index) {
      out.push(el('p', 'partner-feature-cards-eyebrow', textOf(line)));
    } else if (i === index) {
      const title = el(line.tagName.toLowerCase(), 'partner-feature-cards-title');
      title.append(...line.childNodes);
      out.push(title);
    } else {
      const description = el('p', 'partner-feature-cards-description');
      description.append(...line.childNodes);
      out.push(description);
    }
  });
  return out;
}

/**
 * Currency, price and price label from three lines, or from one line such as
 * "CAD 111.20 / Pass Bundle".
 * @param {Element} cell
 * @returns {HTMLElement|null}
 */
function buildPrice(cell) {
  const lines = linesOf(cell).map(textOf);
  let parts;
  if (lines.length >= 3) {
    parts = lines.slice(0, 3);
  } else if (lines.length === 2) {
    parts = /\d/.test(lines[0]) ? ['', ...lines] : [...lines, ''];
  } else if (lines.length === 1) {
    const match = lines[0].match(/^([^\d\s]*)\s*([\d.,]+)\s*(.*)$/);
    parts = match ? match.slice(1) : ['', lines[0], ''];
  } else {
    return null;
  }
  const price = el('p', 'partner-feature-cards-price');
  ['currency', 'amount', 'label'].forEach((name, i) => {
    if (parts[i]) price.append(el('span', `partner-feature-cards-${name}`, parts[i]));
  });
  return price;
}

/**
 * The benefits list: each line's leading bold text is the benefit title, the rest its
 * description.
 * @param {Element} cell
 * @returns {HTMLUListElement|null}
 */
function buildBenefits(cell) {
  const lines = linesOf(cell);
  if (!lines.length) return null;
  const list = el('ul', 'partner-feature-cards-benefits');
  lines.forEach((line) => {
    const item = el('li', 'partner-feature-cards-benefit');
    const first = [...line.childNodes].find((node) => node.textContent.trim());
    if (first && first.nodeType === Node.ELEMENT_NODE && /^(STRONG|B)$/.test(first.tagName)) {
      item.append(el('strong', 'partner-feature-cards-benefit-title', textOf(first)));
      first.remove();
      const description = textOf(line);
      if (description) item.append(' ', el('span', 'partner-feature-cards-benefit-description', description));
    } else {
      item.append(el('span', 'partner-feature-cards-benefit-description', textOf(line)));
    }
    list.append(item);
  });
  return list;
}

/**
 * Decorates the partner feature cards block.
 * @param {Element} block
 */
export default function decorate(block) {
  const cards = [...block.querySelectorAll(':scope > div')].map((row) => {
    const [content, price, benefits, badge] = [...row.querySelectorAll(':scope > div')];
    if (!content || !textOf(row)) return null;
    const card = el('div', 'partner-feature-cards-card');
    if (badge && textOf(badge)) {
      card.classList.add('featured');
      card.append(el('p', 'partner-feature-cards-badge', textOf(badge)));
    }
    card.append(...buildContent(content));
    const priceLine = price && buildPrice(price);
    if (priceLine) card.append(priceLine);
    const list = benefits && buildBenefits(benefits);
    if (list) card.append(list);
    return card;
  }).filter(Boolean);
  block.replaceChildren(...cards);
}
