const DROPDOWN_EVENT = 'dropdown:change';
// the Section Metadata `Section Id` of the section shown for the default option
const DEFAULT_SECTION_ID = 'default';
let dropdownCount = 0;

/**
 * Option sources: each turns a fetched JSON response into rows, or returns null when the shape
 * isn't its own. The first match wins. To read a new API, add an adapter here.
 * @type {((json: any) => object[]|null)[]}
 */
const ADAPTERS = [
  // a DA / EDS sheet: { data: [...] }
  (json) => (Array.isArray(json?.data) ? json.data : null),
  // a DA / EDS multi-sheet workbook: { ':names': ['options', …], options: { data: [...] } }
  (json) => (Array.isArray(json?.[':names']) ? json[json[':names'][0]]?.data ?? null : null),
  // a plain array of rows
  (json) => (Array.isArray(json) ? json : null),
];

/**
 * The first non-empty value of a row, among the given column names (case-insensitive).
 * @param {object} row
 * @param {string[]} keys
 * @returns {string}
 */
function field(row, keys) {
  const entry = Object.entries(row)
    .find(([key, value]) => keys.includes(key.toLowerCase()) && `${value ?? ''}`.trim());
  return entry ? `${entry[1]}`.trim() : '';
}

/**
 * Loads the options from the `options` URL (a DA sheet now, an API later). Each row is a name
 * (`name` / `label` / `title`), an optional id (`id` / `value`) and an optional link
 * (`link` / `url` / `href`). A row with a link is a link option; its id is the row's, else the
 * link's `?<namespace>=` value. A row without a link is an in-page option. A row with neither id
 * nor link (or a link without the parameter) is the default.
 * @param {string} source
 * @param {string} namespace
 * @returns {Promise<{ name: string, id: string|null, href: string|null }[]>}
 */
async function loadOptions(source, namespace) {
  const resp = await fetch(new URL(source, window.location.href));
  if (!resp.ok) throw new Error(`options ${source}: ${resp.status}`);
  const json = await resp.json();
  const rows = ADAPTERS.reduce((found, adapt) => found || adapt(json), null) || [];
  return rows.map((row) => {
    const name = field(row, ['name', 'label', 'title']);
    const href = field(row, ['link', 'url', 'href']) || null;
    const linkId = href && namespace
      ? new URL(href, window.location.href).searchParams.get(namespace) : null;
    const id = field(row, ['id', 'value']) || linkId;
    return { name, id, href };
  }).filter((option) => option.name);
}

/**
 * The dropdown widget, authored as a link such as
 * `/widgets/dropdown/dropdown.html?namespace=faqId&label=Show me&options=/en-uk/faq-options.json`:
 * a "Show me [option ↓]" dropdown of options loaded from the `options` URL.
 * - An option with a link (from the sheet or API) is a link: choosing it follows the link.
 * - An option without a link is a button: choosing it sets `?<namespace>=<id>` in the address
 *   without reloading (the default option removes it), and fires `dropdown:change`
 *   ({ namespace, id, name }) on the widget. Back and Forward restore the selection, and fire it
 *   too.
 * On load, the option whose id is the page's `?<namespace>=` value shows as selected (else the
 * default, else the first) and is left out of the menu. Sections with a Section Metadata
 * `Section Id` show only for the matching option (`default` for the default option). The widget
 * keeps `data-namespace` and `data-value` (the selected id) for other logic.
 * @param {HTMLElement} widget The widget element, with the link's parameters as data attributes
 */
export default async function decorate(widget) {
  const { label = '', options: source } = widget.dataset;
  let { namespace = '' } = widget.dataset;
  // without options (or when they can't load) the widget stays hidden; the loader logs why
  widget.hidden = true;
  const options = source ? await loadOptions(source, namespace) : [];
  if (!options.length) throw new Error(`no options${source ? ` in ${source}` : ': add an options parameter'}`);
  widget.hidden = false;
  if (!namespace) {
    // only link options can tell the parameter
    const link = options.find((o) => o.href && new URL(o.href, window.location.href).search);
    if (link) [namespace] = new URL(link.href, window.location.href).searchParams.keys();
  }

  const defaultOption = options.find((o) => !o.id) || options[0];

  // sections with a Section Metadata `Section Id` (data-section-id): only the selected option's one
  // shows (`default` for the default option), the others are hidden; sections without one always
  // show. (Not `Id`: that becomes the section's HTML id, which drops numeric values.)
  const ownSection = widget.closest('.section');
  const sections = [...document.querySelectorAll('main .section[data-section-id]')]
    .filter((section) => section !== ownSection);
  const showSection = (option) => {
    const ids = [option.id, option === defaultOption && DEFAULT_SECTION_ID].filter(Boolean);
    sections.forEach((section) => {
      section.hidden = !ids.includes(section.dataset.sectionId.trim());
    });
  };
  const fromUrl = () => {
    const current = namespace ? new URLSearchParams(window.location.search).get(namespace) : null;
    return options.find((o) => current !== null && o.id === current) || defaultOption;
  };

  dropdownCount += 1;
  const uid = `dropdown-widget-${dropdownCount}`;
  const labelText = widget.querySelector('.dropdown-label');
  const control = widget.querySelector('.dropdown-control');
  const toggle = widget.querySelector('.dropdown-toggle');
  const value = widget.querySelector('.dropdown-value');
  const menu = widget.querySelector('.dropdown-menu');

  // the label (or nothing) before the toggle
  if (label) {
    labelText.textContent = label;
    labelText.id = `${uid}-label`;
  } else {
    labelText.nextSibling?.remove(); // the space after it
    labelText.remove();
  }
  value.id = `${uid}-value`;
  menu.id = `${uid}-menu`;
  toggle.setAttribute('aria-controls', menu.id);
  toggle.setAttribute('aria-labelledby', label ? `${labelText.id} ${value.id}` : value.id);
  widget.dataset.namespace = namespace;

  // one menu item per option: a link when the option has one, else a button
  const items = options.map((option) => {
    const item = document.createElement('li');
    item.className = 'dropdown-option';
    const choice = document.createElement(option.href ? 'a' : 'button');
    choice.className = 'dropdown-link';
    choice.textContent = option.name;
    if (option.href) choice.href = option.href;
    else choice.type = 'button';
    item.append(choice);
    return item;
  });

  /**
   * Shows an option as selected: its name on the toggle, the menu without it, and its section.
   * @param {{ name: string, id: string|null }} option
   */
  const show = (option) => {
    value.textContent = option.name;
    widget.dataset.value = option.id ?? '';
    menu.replaceChildren(...items.filter((item, i) => options[i] !== option));
    showSection(option);
  };

  const announce = (option) => widget.dispatchEvent(new CustomEvent(DROPDOWN_EVENT, {
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
    window.history.pushState(window.history.state, '', url);
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

  // close when focus or a click goes elsewhere
  control.addEventListener('focusout', (e) => {
    if (!control.contains(e.relatedTarget)) close(false);
  });
  document.addEventListener('click', (e) => {
    if (!control.contains(e.target)) close(false);
  });

  // Back and Forward restore the selection from the address
  window.addEventListener('popstate', () => {
    const option = fromUrl();
    if (widget.dataset.value === (option.id ?? '')) return;
    close(false);
    show(option);
    announce(option);
  });

  show(fromUrl());
}
