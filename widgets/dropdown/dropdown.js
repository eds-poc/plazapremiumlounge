const DROPDOWN_EVENT = 'dropdown:change';
// the Section Metadata `Section Id` of the section shown for the default option
const DEFAULT_SECTION_ID = 'default';
// link protocols an option may use (a sheet or API can't add e.g. javascript: links)
const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];
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
 * Loads the options from the `options` URL (a DA sheet now, an API later). Each row is a name
 * (`name` / `label` / `title`), an optional id (`id` / `value`) and an optional link
 * (`link` / `url` / `href`). A row with a link is a link option; its id is the row's, else the
 * link's `?<namespace>=` value. A row without a link is an in-page option. A row with neither id
 * nor link (or a link without the parameter) is the default. Without a namespace, it's the first
 * parameter in the links. Rows without a name, or with an unsafe or malformed link, are skipped.
 * @param {string} source
 * @param {string} namespace
 * @returns {Promise<{ namespace: string, options: { name: string, id: string|null,
 *   href: string|null }[] }>}
 */
async function loadOptions(source, namespace) {
  const resp = await fetch(new URL(source, window.location.href));
  if (!resp.ok) throw new Error(`options ${source}: ${resp.status}`);
  const json = await resp.json();
  const rows = (ADAPTERS.reduce((found, adapt) => found || adapt(json), null) || [])
    .map((row) => {
      const href = field(row, ['link', 'url', 'href']);
      return {
        name: field(row, ['name', 'label', 'title']),
        id: field(row, ['id', 'value']) || null,
        href: href || null,
        url: href ? safeUrl(href) : null,
      };
    })
    .filter((row) => row.name && (!row.href || row.url));
  // without a namespace, the first parameter in the links (before the ids are read from them)
  const linked = rows.find((row) => row.url?.search);
  const name = namespace || (linked ? [...linked.url.searchParams.keys()][0] : '');
  const options = rows.map((row) => ({
    name: row.name,
    id: row.id || (name && row.url ? row.url.searchParams.get(name) : null),
    href: row.href,
  }));
  return { namespace: name, options };
}

/**
 * Shows the sections of one selection: the sections with a Section Metadata `Section Id` among
 * `ids` show, the other sections this dropdown controls are hidden.
 * @param {HTMLElement[]} sections The sections this dropdown controls
 * @param {string[]} ids
 */
function showSections(sections, ids) {
  sections.forEach((section) => {
    section.hidden = !ids.includes(section.dataset.sectionId.trim());
  });
}

/**
 * The dropdown widget, authored as a link such as `/widgets/dropdown/dropdown.html?namespace=faqId
 * &label=Show me&options=/en-uk/faq/categories.json`: a "Show me [option ↓]" dropdown of options
 * loaded from the `options` URL.
 * - An option with a link (from the sheet or API) is a link: choosing it follows the link.
 * - An option without a link is a button: choosing it sets `?<namespace>=<id>` in the address
 *   without reloading (the default option removes it), and fires `dropdown:change`
 *   ({ namespace, id, name }) on the widget. Back and Forward restore the selection, and fire it
 *   too.
 * On load, the option whose id is the page's `?<namespace>=` value shows as selected (else the
 * default, else the first) and is left out of the menu. Sections with a Section Metadata
 * `Section Id` of one of the options (or `default`, for the default option) show only for that
 * option. The widget keeps `data-namespace` and `data-value` (the selected id) for other logic.
 *
 * The widget doesn't wait for the options: the page shows straight away (the sections already
 * follow the address), and the menu fills in when the options arrive.
 * @param {HTMLElement} widget The widget element, with the link's parameters as data attributes
 */
export default function decorate(widget) {
  const { label = '', options: source } = widget.dataset;
  const ownSection = widget.closest('.section');
  const tagged = [...document.querySelectorAll('main .section[data-section-id]')]
    .filter((section) => section !== ownSection);

  // until the options arrive (or if they can't load): the section of the address's id, else the
  // default section, so the page never shows every section at once
  const firstParam = (namespace) => (namespace
    ? new URLSearchParams(window.location.search).get(namespace) : null);
  const early = firstParam(widget.dataset.namespace);
  const earlyMatch = early && tagged.some((s) => s.dataset.sectionId.trim() === early);
  showSections(tagged, [earlyMatch ? early : DEFAULT_SECTION_ID]);

  dropdownCount += 1;
  const uid = `dropdown-widget-${dropdownCount}`;
  const labelText = widget.querySelector('.dropdown-label');
  const control = widget.querySelector('.dropdown-control');
  const toggle = widget.querySelector('.dropdown-toggle');
  const value = widget.querySelector('.dropdown-value');
  const menu = widget.querySelector('.dropdown-menu');

  // the label (or nothing) before the toggle, shown straight away; the toggle waits for options
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
  toggle.disabled = true;
  widget.setAttribute('aria-busy', 'true');

  const fail = (error) => {
    widget.hidden = true;
    showSections(tagged, [DEFAULT_SECTION_ID]);
    // eslint-disable-next-line no-console
    console.error('dropdown: no options', error);
  };
  if (!source) {
    fail(new Error('add an options parameter to the widget link'));
    return;
  }

  loadOptions(source, widget.dataset.namespace || '').then(({ namespace, options }) => {
    if (!options.length) throw new Error(`no options in ${source}`);
    const defaultOption = options.find((o) => !o.id) || options[0];
    const fromUrl = () => {
      const current = firstParam(namespace);
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
     * Shows an option as selected: its name on the toggle, the menu without it, its section.
     * @param {{ name: string, id: string|null }} option
     */
    const show = (option) => {
      value.textContent = option.name;
      widget.dataset.value = option.id ?? '';
      menu.replaceChildren(...items.filter((item, i) => options[i] !== option));
      showSections(sections, [option.id, option === defaultOption && DEFAULT_SECTION_ID]
        .filter(Boolean));
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
      if (widget.dataset.value === (option.id ?? '')) return;
      close(false);
      show(option);
      announce(option);
    });

    widget.dataset.namespace = namespace;
    show(fromUrl());
    toggle.disabled = false;
    widget.removeAttribute('aria-busy');
  }).catch(fail);
}
