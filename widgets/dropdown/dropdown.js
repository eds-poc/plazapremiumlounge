import { initDropdown } from '../../scripts/dropdown.js';

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
 * Loads the option rows from the `options` URL (a DA sheet now, an API later), as the shared
 * dropdown's `{ name, id, link }` rows: columns `name` / `label` / `title`, `id` / `value` and
 * `link` / `url` / `href`.
 * @param {string} source
 * @returns {Promise<{ name: string, id: string, link: string }[]>}
 */
async function loadRows(source) {
  if (!source) throw new Error('add an options parameter to the widget link');
  const resp = await fetch(new URL(source, window.location.href));
  if (!resp.ok) throw new Error(`options ${source}: ${resp.status}`);
  const json = await resp.json();
  return (ADAPTERS.reduce((found, adapt) => found || adapt(json), null) || []).map((row) => ({
    name: field(row, ['name', 'label', 'title']),
    id: field(row, ['id', 'value']),
    link: field(row, ['link', 'url', 'href']),
  }));
}

/**
 * The Dropdown widget, authored as a link such as `/widgets/dropdown/dropdown.html?namespace=faqId
 * &label=Show me&options=/en-uk/faq/categories.json`: the shared dropdown (/scripts/dropdown.js),
 * with its options from a JSON sheet or an API instead of the page. It doesn't wait for the
 * options: the label and the sections show straight away, and the menu fills in when they arrive.
 * @param {HTMLElement} widget The widget element, with the link's parameters as data attributes
 */
export default function decorate(widget) {
  const { label = '', namespace = '', options } = widget.dataset;
  initDropdown(widget, { label, namespace, options: loadRows(options) });
}
