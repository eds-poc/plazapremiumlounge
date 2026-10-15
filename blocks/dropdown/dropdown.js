import { initDropdown } from '../../scripts/dropdown.js';

/**
 * The cell text, whitespace collapsed.
 * @param {Node} [node]
 * @returns {string}
 */
function text(node) {
  return node ? node.textContent.replace(/\s+/g, ' ').trim() : '';
}

/**
 * The option lines of the Options cell: its list items (top level), else its paragraphs, else its
 * lines split at line breaks.
 * @param {Element} cell
 * @returns {Node[]} Each line as an element or a fragment
 */
function lines(cell) {
  const items = [...cell.querySelectorAll(':scope > ul > li, :scope > ol > li')];
  if (items.length) return items;
  const paragraphs = [...cell.querySelectorAll(':scope > p')];
  if (paragraphs.length) return paragraphs;
  const parts = [document.createDocumentFragment()];
  [...cell.childNodes].forEach((node) => {
    if (node.nodeName === 'BR') parts.push(document.createDocumentFragment());
    else parts[parts.length - 1].append(node.cloneNode(true));
  });
  return parts;
}

/**
 * One option from a line: `Name | id` (e.g. `Airport Dining | 2881`), just `Name` (the default
 * option), or a link (its text is the name; the link is kept).
 * @param {Node} line
 * @returns {{ name: string, id: string, link: string }}
 */
function readOption(line) {
  const link = line.querySelector?.('a[href]');
  const [name, id = ''] = text(line).split('|').map((part) => part.trim());
  return { name: name || text(link), id, link: link?.getAttribute('href') || '' };
}

/**
 * The Dropdown block: a "Show me [option ↓]" selector authored on the page, in three rows
 * (`Label | Show me`, `Namespace | faqId`, `Options | a list of Name | id`). The rendering, the
 * address (`?faqId=<id>`) and the Section Id switching are shared with the Dropdown widget, in
 * /scripts/dropdown.js.
 * @param {Element} block
 */
export default async function decorate(block) {
  const config = { label: '', namespace: '', options: [] };
  [...block.children].forEach((row) => {
    const [keyCell, valueCell] = row.children;
    const key = text(keyCell).toLowerCase();
    if (!valueCell) return;
    if (key === 'label') config.label = text(valueCell);
    else if (key === 'namespace') config.namespace = text(valueCell);
    else if (key === 'options') config.options = lines(valueCell).map(readOption);
  });
  await initDropdown(block, config);
}
