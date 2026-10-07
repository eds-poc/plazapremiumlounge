/*
 * Icons (`:name:` in content): looked up in the DA icon library first, then in the code
 * `/icons/` folder. The library index (/docs/library/icons.json, the same sheet the DA Library
 * panel uses) lists the icon keys; it is loaded once per visit and only on pages with icons.
 * Without the index (not published yet, offline), every icon comes from the code.
 */
const LIBRARY_INDEX = '/docs/library/icons.json';
const LIBRARY_FOLDER = '/docs/library/icons';
const CACHE_KEY = 'icon-library';

let keysPromise;
let knownKeys;

/**
 * The icon library names already known this visit (from the session cache), or undefined.
 * @returns {Set<string>|undefined}
 */
function cachedKeys() {
  if (!knownKeys) {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) knownKeys = new Set(JSON.parse(cached));
    } catch { /* storage unavailable */ }
  }
  return knownKeys;
}

/**
 * The icon names available in the DA icon library.
 * @returns {Promise<Set<string>>}
 */
function libraryKeys() {
  if (!keysPromise) {
    keysPromise = (async () => {
      if (cachedKeys()) return knownKeys;
      try {
        const resp = await fetch(LIBRARY_INDEX);
        if (!resp.ok) return new Set();
        const { data = [] } = await resp.json();
        // keys may be written as `name` or `:name:`
        const keys = data
          .map((row) => String(row.key || '').trim().replace(/^:+|:+$/g, ''))
          .filter(Boolean);
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(keys));
        } catch { /* storage full */ }
        knownKeys = new Set(keys);
        return knownKeys;
      } catch {
        return new Set();
      }
    })();
  }
  return keysPromise;
}

/**
 * The URL of an icon: the DA library file when the library has it, else the code icon.
 * @param {string} name Icon name
 * @param {Set<string>} keys Library icon names
 * @returns {string}
 */
function iconUrl(name, keys) {
  return keys.has(name)
    ? `${LIBRARY_FOLDER}/${name}.svg`
    : `${window.hlx.codeBasePath}/icons/${name}.svg`;
}

/**
 * Sets the source of every icon image in an element that has none yet (by its data-icon-name),
 * now if the library index is known, else once it has loaded. Code that copies icons before
 * their source is set (e.g. the header building its menus from the nav) calls this on the
 * copies.
 * @param {Element} root
 */
export function setIconSources(root) {
  const pending = () => [...root.querySelectorAll('img[data-icon-name]:not([src])')];
  const known = cachedKeys();
  if (known) {
    pending().forEach((img) => { img.src = iconUrl(img.dataset.iconName, known); });
    return;
  }
  libraryKeys().then((keys) => {
    pending().forEach((img) => { img.src = iconUrl(img.dataset.iconName, keys); });
  });
}

/**
 * Adds an <img> to every undecorated icon in an element (`span.icon.icon-<name>`), as the
 * boilerplate does, and sets its source once the library index is known.
 * @param {Element} element Element containing icons
 */
export function decorateIcons(element) {
  const imgs = [...element.querySelectorAll('span.icon')]
    .filter((span) => !span.hasChildNodes())
    .map((span) => {
      const name = [...span.classList].find((c) => c.startsWith('icon-'))?.substring(5);
      if (!name) return null;
      const img = document.createElement('img');
      img.dataset.iconName = name;
      img.alt = '';
      img.loading = 'lazy';
      img.width = 16;
      img.height = 16;
      span.append(img);
      return img;
    })
    .filter(Boolean);
  if (!imgs.length) return;
  // after the first page of a visit the index is cached: set the sources straight away
  const known = cachedKeys();
  if (known) {
    imgs.forEach((img) => { img.src = iconUrl(img.dataset.iconName, known); });
    return;
  }
  libraryKeys().then((keys) => {
    imgs.forEach((img) => { img.src = iconUrl(img.dataset.iconName, keys); });
    // and any copies of them already on the page (copied before the index arrived)
    setIconSources(document);
  });
}
