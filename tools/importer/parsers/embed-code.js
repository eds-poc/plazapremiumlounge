/* eslint-disable */
/* global WebImporter */

/**
 * Parser for the embed-code block, from a page's authored HTML (Kentico's Froala editor
 * output, `.fr-view`).
 * Source: https://www.plazapremiumlounge.com/en-uk/offers/beyond_the_event
 * Selector: .fr-view
 * Model (blocks/embed-code/README.md, "Pasting embed code"): 1 column, 2 rows: the block
 * name, then a single cell holding the embed code, as code. The code is the authored HTML
 * as-is: first the page's <style>s that style it (in the head or anywhere outside it), then
 * the .fr-view content, then the inline <script>s that drive it. A style or script belongs
 * to it when it refers to one of the classes or ids of the .fr-view's top elements
 * (e.g. `.ppg-ppl-bts2026`). One block per .fr-view.
 * Images and other assets with a root-relative, relative or same-site address move to the
 * DAM: <damFolder>/<file name>. Other addresses, and links to pages, are kept.
 *
 * The page is imported from a snapshot of its server HTML in which every <script> is a
 * placeholder (the importer drops scripts): <template data-inert-script="<base64 code>"
 * data-inert-attrs="<base64 JSON attributes>">. They are written back as the original
 * <script>s.
 */

const INERT_SCRIPT = '[data-inert-script]';
const ASSET_FILE = /\.(png|jpe?g|gif|svg|webp|avif|ico|bmp|mp4|webm|pdf|woff2?|ttf|otf)(\?|#|$)/i;

/** The classes and ids of the authored HTML's top elements, as CSS selectors. */
function topSelectors(element) {
  const selectors = new Set();
  [...element.children].forEach((child) => {
    child.classList.forEach((name) => {
      if (!/^fr-/.test(name)) selectors.add(`.${name}`);
    });
    if (child.id) selectors.add(`#${child.id}`);
  });
  return [...selectors];
}

/** Whether code refers to one of the selectors (not just to a longer name starting with it). */
function refersTo(code, selectors) {
  return selectors.some((selector) => {
    const name = selector.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`[.#]${name}(?![\\w-])|['"]${name}['"]`).test(code);
  });
}

/** The classes used in the authored HTML (Froala's own fr-* left out), as CSS selectors. */
function innerSelectors(element) {
  const selectors = new Set();
  element.querySelectorAll('[class]').forEach((el) => el.classList.forEach((name) => {
    if (!/^fr-/.test(name)) selectors.add(`.${name}`);
  }));
  return [...selectors];
}

/**
 * The page's <style>s for each piece of authored HTML. The site's own CSS comes in files, so
 * every inline <style> outside the .fr-views is authored for the page: it goes with the .fr-view
 * whose top elements it styles, else with the one whose classes it styles, else with the first.
 * @param {Document} document
 * @param {Element[]} frViews The page's top-level .fr-views
 * @returns {Map<Element, Element[]>}
 */
export function pageStyles(document, frViews) {
  const styles = new Map(frViews.map((el) => [el, []]));
  if (!frViews.length) return styles;
  [...document.querySelectorAll('style')]
    .filter((style) => !frViews.some((el) => el.contains(style)) && style.textContent.trim())
    .forEach((style) => {
      const css = style.textContent;
      const owner = frViews.find((el) => refersTo(css, topSelectors(el)))
        || frViews.find((el) => refersTo(css, innerSelectors(el)))
        || frViews[0];
      styles.get(owner).push(style);
    });
  return styles;
}

function decodeBase64(text) {
  return new TextDecoder().decode(Uint8Array.from(atob(text), (c) => c.charCodeAt(0)));
}

/** A script placeholder's code. */
function scriptCode(placeholder) {
  return decodeBase64(placeholder.getAttribute('data-inert-script'));
}

/** A script placeholder as the authored <script>. */
function scriptHtml(placeholder) {
  const attrs = Object.entries(JSON.parse(decodeBase64(placeholder.getAttribute('data-inert-attrs') || 'e30=')))
    .map(([name, value]) => (value === '' ? name : `${name}="${value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`));
  return `<script${attrs.length ? ` ${attrs.join(' ')}` : ''}>${scriptCode(placeholder)}</script>`;
}

/** The asset addresses the HTML, its CSS and its scripts use. */
function assetUrls(element, css, scripts) {
  const urls = new Set();
  const addCssUrls = (text) => {
    [...text.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi)].forEach((m) => urls.add(m[2].trim()));
  };
  element.querySelectorAll('[src], [poster], [data-src], [data-bg]').forEach((el) => {
    ['src', 'poster', 'data-src', 'data-bg'].forEach((name) => {
      if (el.hasAttribute(name)) urls.add(el.getAttribute(name).trim());
    });
  });
  element.querySelectorAll('[srcset]').forEach((el) => {
    el.getAttribute('srcset').split(',').forEach((entry) => urls.add(entry.trim().split(/\s+/)[0]));
  });
  element.querySelectorAll('a[href]').forEach((a) => {
    // links to files (e.g. a PDF), not to pages
    if (ASSET_FILE.test(a.getAttribute('href'))) urls.add(a.getAttribute('href').trim());
  });
  element.querySelectorAll('[style]').forEach((el) => addCssUrls(el.getAttribute('style')));
  addCssUrls(css);
  [...scripts.matchAll(/(['"`])([^'"`\s]+)\1/g)].forEach((m) => {
    if (ASSET_FILE.test(m[2]) || /\/getContentAsset\//i.test(m[2])) urls.add(m[2]);
  });
  return [...urls].filter((url) => url && !/^(data:|#|mailto:|tel:|javascript:)/i.test(url));
}

/** Whether an address is root-relative, relative or on the source site. */
export function isLocal(url, origin) {
  const { hostname } = new URL(origin);
  try {
    if (/^\/\//.test(url)) return new URL(`https:${url}`).hostname === hostname;
    if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return new URL(url).hostname === hostname;
  } catch (e) {
    return false;
  }
  return true;
}

/** The DAM file name for an address: its last path segment, lower case, in kebab case. */
export function damName(url) {
  const segment = new URL(url).pathname.split('/').filter(Boolean).pop() || 'asset';
  let name = segment;
  try { name = decodeURIComponent(segment); } catch (e) { /* keep as is */ }
  const dot = name.lastIndexOf('.');
  const base = (dot > 0 ? name.slice(0, dot) : name).toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const ext = dot > 0 ? name.slice(dot).toLowerCase() : '';
  return `${base || 'asset'}${ext}`;
}

/**
 * The DAM path for a same-site asset, recorded in `assets` (source address → DAM path);
 * a file name already taken by another address gets a number.
 */
export function damPath(absolute, damFolder, assets) {
  if (assets[absolute]) return assets[absolute];
  const taken = new Set(Object.values(assets));
  const name = damName(absolute);
  let path = `${damFolder}/${name}`;
  for (let i = 2; taken.has(path); i += 1) {
    path = `${damFolder}/${name.replace(/(\.[^.]+)?$/, `-${i}$1`)}`;
  }
  assets[absolute] = path;
  return path;
}

/**
 * @param {Element} element The .fr-view
 * @param {object} options
 * @param {Document} options.document
 * @param {string} options.originalURL The source page address
 * @param {string} options.damFolder The DAM folder for the page's assets, e.g.
 *   /media-da/en-uk/offers/beyond-the-event
 * @param {object} options.assets Collects the moved assets: source address → DAM path
 * @param {Element[]} [options.styles] The page's <style>s for this .fr-view (see pageStyles);
 *   without it, every inline <style> on the page
 */
export default function parse(element, {
  document, originalURL, damFolder, assets, styles: assigned,
}) {
  const selectors = topSelectors(element);

  const styles = assigned || pageStyles(document, [element]).get(element);
  const scripts = [...document.querySelectorAll(INERT_SCRIPT)]
    .filter((script) => !element.contains(script)
      && !('src' in JSON.parse(decodeBase64(script.getAttribute('data-inert-attrs') || 'e30=')))
      && refersTo(scriptCode(script), selectors));

  // scripts inside the authored HTML go back in their place
  const inner = [...element.querySelectorAll(INERT_SCRIPT)].map((script, i) => {
    script.replaceWith(document.createComment(`inert-script-${i}`));
    return scriptHtml(script);
  });
  let html = element.innerHTML.trim();
  inner.forEach((script, i) => {
    html = html.replace(`<!--inert-script-${i}-->`, () => script);
  });

  const styleCode = styles.map((style) => style.outerHTML).join('\n');
  const scriptsCode = scripts.map(scriptHtml).join('\n');
  let code = [styleCode, html, scriptsCode].filter(Boolean).join('\n');

  // same-site assets to the DAM; longest address first, so an address inside a longer one
  // (e.g. root-relative inside absolute) is replaced as part of the longer one
  assetUrls(element, styles.map((s) => s.textContent).join('\n'), scripts.map(scriptCode).join('\n'))
    .filter((url) => isLocal(url, originalURL))
    .sort((a, b) => b.length - a.length)
    .forEach((url) => {
      const path = damPath(new URL(url, originalURL).href, damFolder, assets);
      [...new Set([url, url.replace(/&/g, '&amp;')])].forEach((spelling) => {
        code = code.split(spelling).join(path);
      });
    });

  const pre = document.createElement('pre');
  const codeEl = document.createElement('code');
  codeEl.textContent = code;
  pre.append(codeEl);

  const block = WebImporter.Blocks.createBlock(document, { name: 'Embed Code', cells: [[pre]] });
  element.replaceWith(block);
}
