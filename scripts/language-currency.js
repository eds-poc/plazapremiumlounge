/*
 * Applying the language and currency modal's choices, as the source's Apply does: the same page
 * in the chosen language site, the address's query kept with `currencyCode` set (and `currency`
 * dropped), the currency remembered for the session, then the page replaced (no new history
 * entry). A page the chosen site doesn't have opens in the default site instead, as the source's
 * server redirects it.
 */
import { getCurrency, setCurrency } from './currency.js';
import { DEFAULT_SITE, getSiteFolder } from './i18n.js';

/**
 * The first path segment of a link ("/zh-cn/" → "zh-cn").
 * @param {string} href
 * @returns {string}
 */
function folderOf(href) {
  try {
    return new URL(href, window.location.href).pathname.split('/').filter(Boolean)[0]?.toLowerCase() || '';
  } catch {
    return '';
  }
}

/**
 * The current page's path in another site folder ("/en-uk/eligible-lounges" → "/zh-cn/eligible-
 * lounges"); a homepage keeps its trailing slash ("/zh-cn/"), as the language sites need.
 * @param {string} folder
 * @returns {string}
 */
export function pathInSite(folder) {
  const { pathname } = window.location;
  const current = getSiteFolder();
  const rest = current ? pathname.slice(current.length + 1) : pathname;
  return !rest || rest === '/' ? `/${folder}/` : `/${folder}${rest.startsWith('/') ? '' : '/'}${rest}`;
}

/**
 * The address's query with the applied choices, as the source writes it: `currencyCode` set (in
 * place, or added), `currency` dropped; a language parameter only updated when there's one
 * (`langCode`, else `language`). Other parameters are kept as they are.
 * @param {string} search
 * @param {{folder: string, currency: string}} choices
 * @returns {string} '' or `?…`
 */
export function appliedQuery(search, { folder, currency }) {
  const entries = [...new URLSearchParams(search).entries()];
  const has = (name) => entries.some(([key]) => key.toLowerCase() === name);
  const langKey = has('langcode') ? 'langcode' : has('language') && 'language';
  let currencySet = false;
  const out = [];
  entries.forEach(([key, value]) => {
    const name = key.toLowerCase();
    if (name === 'currency') return;
    if (name === 'currencycode') {
      if (currency && !currencySet) out.push(['currencyCode', currency]);
      currencySet = true;
      return;
    }
    if (langKey === 'langcode' && name === 'language') return;
    out.push([key, langKey && name === langKey && folder ? folder : value]);
  });
  if (currency && !currencySet) out.push(['currencyCode', currency]);
  const query = new URLSearchParams(out).toString();
  return query ? `?${query}` : '';
}

/**
 * Whether a page exists on this site (a network failure counts as yes: the page is then opened
 * and shows what it shows).
 * @param {string} path
 * @returns {Promise<boolean>}
 */
async function exists(path) {
  try {
    const resp = await fetch(path, { method: 'HEAD', credentials: 'same-origin' });
    return resp.status !== 404;
  } catch {
    return true;
  }
}

/**
 * Applies the modal's choices: remembers the currency, then opens the page for the language
 * (the same page in that site, else in the default site) with the applied query.
 * @param {{language?: string, currency?: string}} values The checked choices: the language's link
 *   (e.g. `/zh-cn/`) and the currency code (e.g. HKD). A missing one stays as it is: the
 *   page's language, and the visitor's currency (which the address still gets, as the source's
 *   Language-only view on phones)
 * @returns {Promise<string>} The address opened
 */
export async function applyLanguageAndCurrency({ language = '', currency = '' }) {
  const current = getSiteFolder();
  const folder = folderOf(language) || current || DEFAULT_SITE;
  const code = (currency || getCurrency()).trim().toUpperCase();
  let path = pathInSite(folder);
  if (folder !== current && folder !== DEFAULT_SITE && !(await exists(path))) {
    path = pathInSite(DEFAULT_SITE);
  }
  const url = `${path}${appliedQuery(window.location.search, { folder, currency: code })}`;
  if (code) setCurrency(code);
  window.location.replace(url);
  return url;
}
