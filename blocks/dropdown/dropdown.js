/**
 * The Dropdown block: a "Show me [option ↓]" selector authored on the page, that keeps its
 * selection in the page address (e.g. `?faqId=159`) and shows only the sections of the selected
 * option.
 *
 * - An option with a link is a link: choosing it follows the link. A link that has the parameter
 *   (e.g. `…?faqId=159`) counts as that id.
 * - An option without a link is a button: choosing it sets `?<namespace>=<id>` without reloading
 *   (the default option removes it) and fires `dropdown:change` ({ namespace, id, name }) on the
 *   block. Back and Forward restore the selection, and fire it too.
 * - The default option has no id (and no link with the parameter); without one, it's the first.
 * - Sections with a Section Metadata `Section Id` of one of the options (or `default`, for the
 *   default option) show only while that option is selected; other sections always show.
 * The block keeps `data-namespace` and `data-value` (the selected id) for other logic.
 */
const DROPDOWN_EVENT = 'dropdown:change';
// the Section Metadata `Section Id` of the section shown for the default option
const DEFAULT_SECTION_ID = 'default';
// link protocols an option may use (e.g. no javascript: links)
const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];
let dropdownCount = 0;

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
 * A link from the options, resolved against the page, or null when it's malformed or uses a
 * protocol other than SAFE_PROTOCOLS (both are skipped with a warning).
 * @param {string} href
 * @returns {URL|null}
 */
function safeUrl(href) {
  try {
    const url = new URL(href, window.location.href);
    if (SAFE_PROTOCOLS.includes(url.protocol)) return url;
  } catch { /* malformed */ }
  // eslint-disable-next-line no-console
  console.warn(`dropdown: skipped the link "${href}"`);
  return null;
}

/**
 * Turns the authored rows into options: names trimmed, ids taken from the row or from the
 * link's `?<namespace>=` value, rows without a name or with an unsafe or malformed link skipped.
 * Without a namespace, it's the first parameter in the links.
 * @param {{ name?: string, id?: string, link?: string }[]} rows
 * @param {string} namespace
 * @returns {{ namespace: string, options: { name: string, id: string|null,
 *   href: string|null }[] }}
 */
function normalizeOptions(rows, namespace = '') {
  const clean = (rows || [])
    .map((row) => {
      const href = `${row.link ?? ''}`.trim();
      return {
        name: `${row.name ?? ''}`.trim(),
        id: `${row.id ?? ''}`.trim() || null,
        href: href || null,
        url: href ? safeUrl(href) : null,
      };
    })
    .filter((row) => row.name && (!row.href || row.url));
  const linked = clean.find((row) => row.url?.search);
  const name = namespace || (linked ? [...linked.url.searchParams.keys()][0] : '');
  const options = clean.map((row) => ({
    name: row.name,
    id: row.id || (name && row.url ? row.url.searchParams.get(name) : null),
    href: row.href,
  }));
  return { namespace: name, options };
}

/**
 * Shows the sections of one selection: the sections with a Section Metadata `Section Id` among
 * `ids` show, the others in `sections` are hidden.
 * @param {HTMLElement[]} sections
 * @param {string[]} ids
 */
function showSections(sections, ids) {
  sections.forEach((section) => {
    section.hidden = !ids.includes(section.dataset.sectionId.trim());
  });
}

/**
 * Renders the dropdown into `root` and wires it up. The sections follow the address straight
 * away. If there are no options, the dropdown is hidden and only the `default` section shows.
 * @param {HTMLElement} root The block (its children are replaced)
 * @param {{ label?: string, namespace?: string, options: object[] }} config
 *   Rows `{ name, id, link }`
 */
function initDropdown(root, { label = '', namespace: givenNamespace = '', options: rows }) {
  const ownSection = root.closest('.section');
  const tagged = [...document.querySelectorAll('main .section[data-section-id]')]
    .filter((section) => section !== ownSection);
  const param = (namespace) => (namespace
    ? new URLSearchParams(window.location.search).get(namespace) : null);

  // straight away (and if there are no options): the section of the address's id, else the
  // default section, so the page never shows every section at once
  const early = param(givenNamespace);
  const earlyMatch = early && tagged.some((s) => s.dataset.sectionId.trim() === early);
  showSections(tagged, [earlyMatch ? early : DEFAULT_SECTION_ID]);

  // the label, then the toggle (the selected name and an arrow) over the menu of the others
  dropdownCount += 1;
  const uid = `dropdown-${dropdownCount}`;
  const field = el('div', 'dropdown-field');
  const labelText = el('span', 'dropdown-label');
  labelText.id = `${uid}-label`;
  labelText.textContent = label;
  const control = el('span', 'dropdown-control');
  const toggle = el('button', 'dropdown-toggle');
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', 'false');
  const value = el('span', 'dropdown-value');
  value.id = `${uid}-value`;
  toggle.append(value);
  toggle.setAttribute('aria-labelledby', label ? `${labelText.id} ${value.id}` : value.id);
  const menu = el('ul', 'dropdown-menu');
  menu.id = `${uid}-menu`;
  menu.hidden = true;
  toggle.setAttribute('aria-controls', menu.id);
  control.append(toggle, menu);
  field.append(...(label ? [labelText, ' '] : []), control);
  root.replaceChildren(field);

  const { namespace, options } = normalizeOptions(rows, givenNamespace);
  if (!options.length) {
    root.hidden = true;
    showSections(tagged, [DEFAULT_SECTION_ID]);
    // eslint-disable-next-line no-console
    console.error('dropdown: no options (add an Options row with a list of Name | id)');
    return;
  }
  const defaultOption = options.find((o) => !o.id) || options[0];
  const fromUrl = () => {
    const current = param(namespace);
    return options.find((o) => current !== null && o.id === current) || defaultOption;
  };

  // the sections this dropdown controls: those with one of its ids (or `default`)
  const ids = new Set([DEFAULT_SECTION_ID, ...options.map((o) => o.id).filter(Boolean)]);
  const sections = tagged.filter((section) => ids.has(section.dataset.sectionId.trim()));
  tagged.filter((section) => !sections.includes(section)).forEach((section) => {
    section.hidden = false;
    // eslint-disable-next-line no-console
    console.warn(`dropdown: no option for Section Id "${section.dataset.sectionId}"`);
  });

  // one menu item per option: a link when the option has one, else a button
  const items = options.map((option) => {
    const item = el('li', 'dropdown-option');
    const choice = el(option.href ? 'a' : 'button', 'dropdown-link');
    choice.textContent = option.name;
    if (option.href) choice.href = option.href;
    else choice.type = 'button';
    item.append(choice);
    return item;
  });

  /**
   * Shows an option as selected: its name on the toggle, the menu without it, its section.
   * @param {{ name: string, id: string|null }} option
   */
  const show = (option) => {
    value.textContent = option.name;
    root.dataset.value = option.id ?? '';
    menu.replaceChildren(...items.filter((item, i) => options[i] !== option));
    showSections(sections, [option.id, option === defaultOption && DEFAULT_SECTION_ID]
      .filter(Boolean));
  };

  const announce = (option) => root.dispatchEvent(new CustomEvent(DROPDOWN_EVENT, {
    bubbles: true,
    detail: { namespace, id: option.id ?? '', name: option.name },
  }));

  const focusables = () => [...menu.querySelectorAll('.dropdown-link')];
  const open = (focusFirst) => {
    menu.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    if (focusFirst) focusables()[0]?.focus();
  };
  const close = (refocus) => {
    if (menu.hidden) return;
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    if (refocus) toggle.focus();
  };

  toggle.addEventListener('click', () => (menu.hidden ? open(false) : close(false)));
  toggle.addEventListener('keydown', (e) => {
    if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      open(true);
    } else if (e.key === 'Escape') {
      close(false);
    }
  });

  // a button option: set the parameter in place (the default removes it) and announce it
  menu.addEventListener('click', (e) => {
    const button = e.target.closest('button.dropdown-link');
    if (!button) return;
    const option = options[items.indexOf(button.closest('li'))];
    const url = new URL(window.location.href);
    if (namespace) {
      if (option.id && option !== defaultOption) url.searchParams.set(namespace, option.id);
      else url.searchParams.delete(namespace);
    }
    // a new history entry only when the address changes
    if (url.href !== window.location.href) {
      window.history.pushState(window.history.state, '', url);
    }
    close(true);
    show(option);
    announce(option);
  });

  // keyboard: arrows move through the options, Home/End jump, Esc closes
  menu.addEventListener('keydown', (e) => {
    const list = focusables();
    const index = list.indexOf(document.activeElement);
    const moves = {
      ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: list.length - 1,
    };
    if (e.key in moves) {
      e.preventDefault();
      list[(moves[e.key] + list.length) % list.length].focus();
    } else if (e.key === 'Escape') {
      close(true);
    }
  });

  // close when focus moves to something else (Safari doesn't focus a clicked button or link,
  // so focus leaving to nothing is a click, handled by the click listener below)
  control.addEventListener('focusout', (e) => {
    if (e.relatedTarget && !control.contains(e.relatedTarget)) close(false);
  });
  document.addEventListener('click', (e) => {
    if (!control.contains(e.target)) close(false);
  });

  // Back and Forward restore the selection from the address
  window.addEventListener('popstate', () => {
    const option = fromUrl();
    if (root.dataset.value === (option.id ?? '')) return;
    close(false);
    show(option);
    announce(option);
  });

  root.dataset.namespace = namespace;
  show(fromUrl());
}

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
 * (`Label | Show me`, `Namespace | faqId`, `Options | a list of Name | id`).
 * @param {Element} block
 */
export default function decorate(block) {
  const config = { label: '', namespace: '', options: [] };
  [...block.children].forEach((row) => {
    const [keyCell, valueCell] = row.children;
    const key = text(keyCell).toLowerCase();
    if (!valueCell) return;
    if (key === 'label') config.label = text(valueCell);
    else if (key === 'namespace') config.namespace = text(valueCell);
    else if (key === 'options') config.options = lines(valueCell).map(readOption);
  });
  initDropdown(block, config);
}
