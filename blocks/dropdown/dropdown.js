// rows with these names configure the block; every other row is an option
const CONFIG_KEYS = ['namespace', 'label'];
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
 * Reads the authored rows: `Namespace | faqId`, `Label | Show me`, then one row per option, a
 * link (e.g. `?faqId=159`). Rows without a link are skipped. Without a Namespace row, it's the
 * first parameter found in the option links.
 * @param {Element} block
 * @returns {{ namespace: string, label: string, options: { name: string, href: string,
 *   url: URL }[] }}
 */
function readConfig(block) {
  const config = { namespace: '', label: '', options: [] };
  [...block.children].forEach((row) => {
    const [first, second] = row.children;
    const key = text(first).toLowerCase();
    if (CONFIG_KEYS.includes(key)) {
      config[key] = text(second);
      return;
    }
    const link = row.querySelector('a[href]');
    const name = text(link);
    if (!name) return;
    config.options.push({ name, href: link.getAttribute('href'), url: new URL(link.href) });
  });
  if (!config.namespace) {
    const withParam = config.options.find((o) => o.url.searchParams.size);
    if (withParam) [config.namespace] = withParam.url.searchParams.keys();
  }
  return config;
}

/**
 * A "Show me [option ↓]" dropdown of option links, e.g. `?faqId=159`. Choosing an option follows
 * its link. On load, the option whose link has the page's `?<namespace>=` value is shown as
 * selected (else the option without the parameter, else the first), and left out of the menu.
 * The block keeps `data-namespace` and `data-value` (the selected id) for other logic.
 * @param {Element} block
 */
export default function decorate(block) {
  const { namespace, label, options } = readConfig(block);
  if (!options.length) {
    block.replaceChildren();
    return;
  }

  const idOf = (option) => (namespace ? option.url.searchParams.get(namespace) : null);
  const current = namespace ? new URLSearchParams(window.location.search).get(namespace) : null;
  const selected = options.find((o) => current !== null && idOf(o) === current)
    || options.find((o) => idOf(o) === null)
    || options[0];

  dropdownCount += 1;
  const uid = `dropdown-${dropdownCount}`;

  // the label + the toggle (the selected name and an arrow) + the menu of the other options
  const field = el('p', 'dropdown-field');
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
  value.textContent = selected.name;
  toggle.append(value);
  toggle.setAttribute('aria-labelledby', label ? `${labelText.id} ${value.id}` : value.id);

  const menu = el('ul', 'dropdown-menu');
  menu.id = `${uid}-menu`;
  menu.hidden = true;
  options.filter((o) => o !== selected).forEach((option) => {
    const item = el('li', 'dropdown-option');
    const link = el('a', 'dropdown-link');
    link.href = option.href;
    link.textContent = option.name;
    item.append(link);
    menu.append(item);
  });

  control.append(toggle, menu);
  field.append(...(label ? [labelText, ' '] : []), control);
  block.replaceChildren(field);
  block.dataset.namespace = namespace;
  block.dataset.value = idOf(selected) ?? '';

  const links = () => [...menu.querySelectorAll('a')];
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

  toggle.addEventListener('click', () => (menu.hidden ? open(false) : close(false)));
  toggle.addEventListener('keydown', (e) => {
    if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      open(true);
    } else if (e.key === 'Escape') {
      close(false);
    }
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

  // close when focus moves to something else (Safari doesn't focus a clicked link, so focus
  // leaving to nothing is a click, handled by the click listener below)
  control.addEventListener('focusout', (e) => {
    if (e.relatedTarget && !control.contains(e.relatedTarget)) close(false);
  });
  document.addEventListener('click', (e) => {
    if (!control.contains(e.target)) close(false);
  });
}
