// a directory of grouped lists, e.g. country > airport > lounges, as the source Eligible
// Lounges page: one row per group, flowed into balanced columns by CSS

const HEADING = /^H[1-6]$/;
const BOLD = ['STRONG', 'B'];
const BLOCK_TAGS = ['P', 'DIV', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'];

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
 * True when a node shows something: an element, or text that isn't only whitespace.
 * @param {Node} node
 * @returns {boolean}
 */
function isVisible(node) {
  if (node.nodeType === Node.ELEMENT_NODE) return node.tagName !== 'BR';
  return node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '';
}

/**
 * Splits inline nodes into lines at each <br>, dropping empty lines.
 * @param {Node[]} nodes
 * @returns {Node[][]}
 */
function splitLines(nodes) {
  const lines = [[]];
  nodes.forEach((node) => {
    if (node.nodeName === 'BR') lines.push([]);
    else lines.at(-1).push(node);
  });
  return lines.map((line) => line.filter(isVisible)).filter((line) => line.length);
}

/**
 * Splits a bold element that holds line breaks (e.g. a whole cell typed in bold with
 * Shift+Enter) into one bold element per line, so each line can be read on its own.
 * @param {Node[]} nodes
 * @returns {Node[]}
 */
function splitBoldBreaks(nodes) {
  return nodes.flatMap((node) => {
    if (!BOLD.includes(node.nodeName) || !node.querySelector(':scope > br')) return [node];
    const out = [];
    splitLines([...node.childNodes]).forEach((line, i) => {
      if (i) out.push(el('br'));
      const bold = el(node.tagName.toLowerCase());
      bold.append(...line);
      out.push(bold);
    });
    return out;
  });
}

/**
 * Reverts button decoration inside the block. A paragraph containing only a bold link
 * is restored as a <strong> element, while other button links are converted back to
 * regular links.
 * @param {Element} block
 */
function unbutton(block) {
  block.querySelectorAll('a.button').forEach((a) => {
    const bold = a.classList.contains('primary') || a.classList.contains('accent');
    a.removeAttribute('class');
    a.closest('.button-wrapper')?.removeAttribute('class');
    if (bold) {
      const strong = el('strong');
      a.replaceWith(strong);
      strong.append(a);
    }
  });
}

/**
 * Reads a cell into lines in authored order. A line is a title (an airport) when it's a
 * heading or text that's entirely bold; anything else is an item (a lounge): a list
 * item, a paragraph, or a line of a paragraph split by line breaks.
 * @param {Element} cell
 * @returns {{title: boolean, nodes: Node[]}[]}
 */
function readLines(cell) {
  const lines = [];
  const addInline = (nodes) => splitLines(splitBoldBreaks(nodes)).forEach((line) => {
    const title = line.length === 1 && BOLD.includes(line[0].nodeName);
    lines.push({ title, nodes: title ? [...line[0].childNodes] : line });
  });
  let inline = [];
  const flush = () => {
    if (inline.length) addInline(inline);
    inline = [];
  };

  [...cell.childNodes].forEach((node) => {
    if (!BLOCK_TAGS.includes(node.nodeName)) {
      inline.push(node);
      return;
    }
    flush();
    if (HEADING.test(node.nodeName)) {
      if (node.textContent.trim()) lines.push({ title: true, nodes: [...node.childNodes] });
    } else if (node.nodeName === 'UL' || node.nodeName === 'OL') {
      [...node.children].forEach((li) => {
        // a list item can hold a paragraph (some editors wrap them)
        const only = li.children.length === 1 && li.firstElementChild.tagName === 'P';
        const nodes = [...(only ? li.firstElementChild : li).childNodes].filter(isVisible);
        if (nodes.length) lines.push({ title: false, nodes });
      });
    } else if (node.nodeName === 'DIV' && node.querySelector(BLOCK_TAGS.join(','))) {
      readLines(node).forEach((line) => lines.push(line));
    } else {
      addInline([...node.childNodes]);
    }
  });
  flush();
  return lines;
}

/**
 * Picks the group name and the entry cells of a row. With two or more cells the first is
 * the name, unless it holds a list (then every cell is entries). A single cell can start
 * with a heading, which becomes the name.
 * @param {Element} row
 * @returns {{name: string, cells: Element[]}}
 */
function readRow(row) {
  const cells = [...row.children];
  if (cells.length > 1 && !cells[0].querySelector('ul, ol')) {
    return { name: cells[0].textContent.replace(/\s+/g, ' ').trim(), cells: cells.slice(1) };
  }
  const lead = cells[0]?.firstElementChild;
  if (cells.length === 1 && lead && HEADING.test(lead.tagName)) {
    const name = lead.textContent.replace(/\s+/g, ' ').trim();
    lead.remove();
    return { name, cells };
  }
  return { name: '', cells };
}

/**
 * The heading level for group names: one below the nearest heading before the block,
 * outside other directories (e.g. the section's h2 gives h3), at least 2 and at most 5.
 * @param {Element} block
 * @returns {number}
 */
function groupLevel(block) {
  const before = [...document.querySelectorAll('main :is(h1, h2, h3, h4, h5, h6)')]
    .filter((h) => !h.closest('.directory'))
    // eslint-disable-next-line no-bitwise
    .filter((h) => h.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING);
  const level = before.length ? Number(before.at(-1).tagName[1]) + 1 : 2;
  return Math.min(Math.max(level, 2), 5);
}

/**
 * Builds one list item; bold text after other text in it (e.g. "*Temporarily Closed") is
 * a status note.
 * @param {Node[]} nodes
 * @returns {HTMLLIElement}
 */
function buildItem(nodes) {
  const li = el('li', 'directory-item');
  nodes.forEach((node, i) => {
    if (BOLD.includes(node.nodeName) && nodes.slice(0, i).some((n) => n.textContent.trim())) {
      node.classList.add('directory-note');
    }
  });
  li.append(...nodes);
  return li;
}

/**
 * Builds a group: its name and its entries (a title with a list of items). Each entry is
 * kept whole in one column, and the name is kept with the first entry.
 * @param {{name: string, cells: Element[]}} row
 * @param {number} level
 * @returns {HTMLElement|null}
 */
function buildGroup({ name, cells }, level) {
  const lines = cells.flatMap(readLines);
  if (!name && !lines.length) return null;

  const group = el('div', 'directory-group');
  const entries = [];
  let entry;
  let list;
  lines.forEach((line) => {
    if (line.title || !entry) {
      entry = el('div', 'directory-entry');
      entries.push(entry);
      list = null;
    }
    if (line.title) {
      const title = el(`p`, 'directory-entry-title');
      title.append(...line.nodes);
      entry.append(title);
      return;
    }
    if (!list) {
      list = el('ul', 'directory-items');
      entry.append(list);
    }
    list.append(buildItem(line.nodes));
  });

  if (name) {
    const heading = el(`h${level}`, 'directory-group-title');
    heading.textContent = name;
    if (!entries.length) entries.push(el('div', 'directory-entry'));
    entries[0].prepend(heading);
  }
  group.append(...entries);
  return group;
}

/**
 * loads and decorates the directory
 * @param {Element} block The directory block element
 */
export default function decorate(block) {
  unbutton(block);
  const level = groupLevel(block);
  const groups = [...block.children]
    .map((row) => buildGroup(readRow(row), level))
    .filter(Boolean);

  const columns = el('div', 'directory-columns');
  columns.append(...groups);
  block.replaceChildren(columns);
}
