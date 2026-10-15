import { toClassName } from '../../scripts/aem.js';

// rows with these names configure the block; every other row is an option
const CONFIG_KEYS = ['namespace', 'label'];
const DROPDOWN_EVENT = 'dropdown:change';
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
 * The cell text, whitespace collapsed.
 * @param {Element} [cell]
 * @returns {string}
 */
function text(cell) {
  return cell ? cell.textContent.replace(/\s+/g, ' ').trim() : '';
}

/**
 * Reads the authored rows: `Namespace | faqId`, `Label | Show me`, then one row per option,
 * `name | id`. An option without an id gets one from its name. The first option is the default.
 * @param {Element} block
 * @returns {{ namespace: string, label: string, options: { name: string, id: string }[] }}
 */
function readConfig(block) {
  const config = { namespace: '', label: '', options: [] };
  const ids = new Set();
  [...block.children].forEach((row) => {
    const [first, second] = row.children;
    const name = text(first);
    const value = text(second);
    const key = name.toLowerCase();
    if (CONFIG_KEYS.includes(key)) {
      config[key] = value;
      return;
    }
    if (!name) return;
    const id = value || toClassName(name);
    if (ids.has(id)) return; // the first option with an id wins
    ids.add(id);
    config.options.push({ name, id });
  });
  return config;
}

/**
 * The sections an option controls: a section whose Section Metadata `Name` is the option's
 * name or id. Each found option gets `panel`; returns whether any section was found.
 * @param {{ name: string, id: string, panel?: HTMLElement }[]} options
 * @param {Element} ownSection The block's own section, never a panel
 * @returns {boolean}
 */
function findPanels(options, ownSection) {
  const sections = [...document.querySelectorAll('main .section[data-name]')]
    .filter((section) => section !== ownSection);
  options.forEach((option) => {
    const keys = [toClassName(option.name), toClassName(option.id)];
    option.panel = sections.find((section) => keys.includes(toClassName(section.dataset.name)));
  });
  return options.some((option) => option.panel);
}

/**
 * Hides a panel's leading heading block when it only repeats the option name (the dropdown
 * shows it), e.g. a "General FAQ" Title above that category's accordion.
 * @param {HTMLElement} panel
 * @param {string} name
 */
function hideRepeatedHeading(panel, name) {
  const first = panel.querySelector(':scope > div');
  if (first && toClassName(text(first)) === toClassName(name)) first.hidden = true;
}

/**
 * The selected option id in the URL, if any.
 * @param {string} namespace
 * @returns {string|null}
 */
function idFromUrl(namespace) {
  return namespace ? new URLSearchParams(window.location.search).get(namespace) : null;
}

/**
 * A dropdown of options that reads and sets `?<namespace>=<id>` in the URL, e.g.
 * `?faqId=159`: on load it selects the option in the URL (else the first option), and
 * choosing an option updates the URL (the first option removes the parameter) and fires
 * `dropdown:change` ({ namespace, id, name, initial }) for other logic. Options that name a
 * section (Section Metadata `Name`) show only that section; without JavaScript every section
 * stays visible.
 * @param {Element} block
 */
export default function decorate(block) {
  const { namespace, label, options } = readConfig(block);
  if (!options.length) {
    block.replaceChildren();
    return;
  }

  dropdownCount += 1;
  const uid = `dropdown-${dropdownCount}`;
  const [defaultOption] = options;
  const filters = findPanels(options, block.closest('.section'));
  if (filters) options.forEach((o) => o.panel && hideRepeatedHeading(o.panel, o.name));

  // "Show me" + the toggle (the selected name and an arrow) + the menu of the other options
  const wrapper = el('p', 'dropdown-field');
  const labelText = el('span', 'dropdown-label');
  labelText.id = `${uid}-label`;
  labelText.textContent = label;
  const control = el('span', 'dropdown-control');
  const toggle = el('button', 'dropdown-toggle');
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', `${uid}-menu`);
  const value = el('span', 'dropdown-value');
  value.id = `${uid}-value`;
  toggle.append(value);
  toggle.setAttribute('aria-labelledby', label ? `${labelText.id} ${value.id}` : value.id);
  const menu = el('ul', 'dropdown-menu');
  menu.id = `${uid}-menu`;
  menu.hidden = true;

  const items = options.map((option) => {
    const item = el('li', 'dropdown-option');
    const link = el('a', 'dropdown-link');
    const url = new URL(window.location.href);
    if (namespace) {
      if (option === defaultOption) url.searchParams.delete(namespace);
      else url.searchParams.set(namespace, option.id);
    }
    link.href = `${url.pathname}${url.search}`;
    link.textContent = option.name;
    link.dataset.id = option.id;
    item.append(link);
    return item;
  });
  menu.append(...items);
  control.append(toggle, menu);
  wrapper.append(...(label ? [labelText, ' '] : []), control);
  block.replaceChildren(wrapper);
  block.dataset.namespace = namespace;

  const links = () => [...menu.querySelectorAll('li:not([hidden]) a')];
  const open = (focusFirst) => {
    menu.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    if (focusFirst) links()[0]?.focus();
  };
  const close = (refocus) => {
    if (menu.hidden) return;
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    if (refocus) toggle.focus();
  };

  /**
   * Shows an option as selected: the toggle text, the menu without it, its panel.
   * @param {{ name: string, id: string, panel?: HTMLElement }} option
   * @param {boolean} initial Whether this is the selection on load (or Back/Forward)
   */
  const select = (option, initial) => {
    value.textContent = option.name;
    block.dataset.value = option.id;
    items.forEach((item, i) => { item.hidden = options[i] === option; });
    if (filters) {
      options.forEach((o) => {
        if (o.panel) o.panel.hidden = o !== option;
      });
    }
    block.dispatchEvent(new CustomEvent(DROPDOWN_EVENT, {
      bubbles: true,
      detail: {
        namespace, id: option.id, name: option.name, initial,
      },
    }));
  };

  const fromUrl = () => {
    const id = idFromUrl(namespace);
    return options.find((o) => o.id === id) || defaultOption;
  };

  toggle.addEventListener('click', () => (menu.hidden ? open(false) : close(false)));
  toggle.addEventListener('keydown', (e) => {
    if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      open(true);
    }
  });

  menu.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    const option = options.find((o) => o.id === link.dataset.id);
    window.history.pushState(window.history.state, '', link.href);
    close(true);
    select(option, false);
  });

  // keyboard: arrows move through the options, Home/End jump, Esc closes
  menu.addEventListener('keydown', (e) => {
    const list = links();
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
  toggle.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(false); });

  // close when focus or a click goes elsewhere
  control.addEventListener('focusout', (e) => {
    if (!control.contains(e.relatedTarget)) close(false);
  });
  document.addEventListener('click', (e) => {
    if (!control.contains(e.target)) close(false);
  });

  // Back and Forward restore the selection from the URL
  window.addEventListener('popstate', () => select(fromUrl(), true));

  select(fromUrl(), true);
}
