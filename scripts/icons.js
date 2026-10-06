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

/**
 * The icon names available in the DA icon library.
 * @returns {Promise<Set<string>>}
 */
function libraryKeys() {
  if (!keysPromise) {
    keysPromise = (async () => {
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) return new Set(JSON.parse(cached));
      } catch { /* storage unavailable */ }
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
        return new Set(keys);
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
 * Adds an <img> to every undecorated icon in an element (`span.icon.icon-<name>`), as the
 * boilerplate does, and sets its source once the library index is known.
 * @param {Element} element Element containing icons
 */
// eslint-disable-next-line import/prefer-default-export
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
  libraryKeys().then((keys) => {
    imgs.forEach((img) => { img.src = iconUrl(img.dataset.iconName, keys); });
  });
}
