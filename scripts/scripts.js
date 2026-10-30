import {
  loadHeader,
  loadFooter,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
  buildBlock,
  getMetadata,
} from './aem.js';
// eslint-disable-next-line import/no-cycle
import { installModalLinks, registerModalSections } from './modal.js';
// icons: the DA icon library first, then the code /icons folder
import { decorateIcons } from './icons.js';
import { DEFAULT_SITE, getLanguage, getSiteFolder } from './i18n.js';
import { installVideoLinks } from './video.js';
import {
  checkSession, decodeJwt, isTokenValid, logout,
} from './auth.js';
import apiUrl from './endpoints.js';

if (window.trustedTypes && window.trustedTypes.createPolicy) {
  const innerTT = window.trustedTypes.createPolicy('tt-inner', {
    createHTML: (s) => s, // avoid stack overflow
  });

  window.trustedTypes.createPolicy('default', {
    createHTML: (input, type, sink) => {
      let processedInput = input;
      if (/srcdoc\s*=/i.test(processedInput)) {
        const doc = new DOMParser().parseFromString(innerTT.createHTML(processedInput), 'text/html');
        doc.querySelectorAll('iframe[srcdoc]').forEach((el) => el.removeAttribute('srcdoc'));
        processedInput = doc.body.innerHTML;
      }
      if (sink.includes('createContextualFragment') || sink.includes('Document write')) {
        const doc = new DOMParser().parseFromString(innerTT.createHTML(processedInput), 'text/html');
        doc.querySelectorAll('script').forEach((el) => el.remove());
        processedInput = doc.body.innerHTML;
      }
      return processedInput;
    },
    createScriptURL: (input) => input,
    createScript: (input) => input,
  });
}

const LOADER_ID = 'spinner-overlay';
let loader;

/**
 * Shows the full-page loader (styled in styles.css), creating it on first use. With a modal
 * dialog open, the loader goes inside it: a modal dialog sits in the browser's top layer, above
 * anything in the page.
 */
export function showLoader() {
  if (!loader) {
    loader = document.getElementById(LOADER_ID);
    if (!loader) {
      loader = document.createElement('div');
      loader.id = LOADER_ID;
      loader.innerHTML = '<div id="global-spinner"><img src="/icons/PPL-loading-v2.webp" width="320" height="auto" alt="Loading..."></div>';
    }
  }
  const host = [...document.querySelectorAll('dialog[open]')].pop() || document.body;
  if (loader.parentElement !== host) host.prepend(loader);
}

/**
 * Hides the full-page loader.
 */
export function hideLoader() {
  loader?.remove();
}

/**
 * Shows the loader as soon as a link click leaves the page, and hides it again when the
 * browser restores the page from its back/forward cache.
 */
function installNavigationLoader() {
  // on window, so it runs after the document-level handlers (e.g. modal links) had their say
  window.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    const link = e.target.closest('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const url = new URL(link.href, window.location.href);
    // mailto:, tel:, javascript: etc. don't leave the page
    if (!['http:', 'https:'].includes(url.protocol)) return;
    // an anchor on the current page doesn't load a new page
    const { origin, pathname, search } = window.location;
    if (url.hash && url.origin === origin && url.pathname === pathname && url.search === search) {
      return;
    }
    showLoader();
  });
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) hideLoader();
  });
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Turns `/widgets/...` links into widget blocks.
 * @param {Element} main The container element
 */
function buildWidgetAutoBlocks(main) {
  const widgetLinks = [...main.querySelectorAll('a[href*="/widgets/"]')];
  widgetLinks.forEach((link) => {
    if (link.closest('.widget')) return;
    const newLink = link.cloneNode(true);
    const widgetBlock = buildBlock('widget', { elems: [newLink] });
    const p = link.closest('p');
    if (
      p
      && p.querySelectorAll('a').length === 1
      && p.querySelector('a') === link
      && p.textContent.trim() === link.textContent.trim()
    ) {
      p.replaceWith(widgetBlock);
    } else {
      link.replaceWith(widgetBlock);
    }
  });
}

/**
 * Adds the breadcrumb on pages with the metadata `breadcrumb` = `on` (set for a folder in the
 * metadata sheet, e.g. the offers), unless the page authors one: just before the page title, at
 * the end of the section before it (after the banner, as the source), else at the top of the
 * title's section. Only in the page's own main: fragments (the nav, the footer, modal pages) are
 * built with this too, but the page's metadata isn't theirs.
 * @param {Element} main The container element
 */
function buildBreadcrumbAutoBlock(main) {
  if (main !== document.querySelector('main')) return;
  if (!/^(on|true|yes)$/i.test(getMetadata('breadcrumb').trim()) || main.querySelector('.breadcrumb')) return;
  const heading = main.querySelector('h1, h2');
  const section = heading?.closest('main > div') || main.querySelector(':scope > div');
  if (!section) return;
  const breadcrumb = buildBlock('breadcrumb', '');
  const top = heading ? [...section.children].find((child) => child.contains(heading)) : null;
  const before = section.previousElementSibling;
  if (top && top !== section.firstElementChild) top.before(breadcrumb);
  else if (heading && before) before.append(breadcrumb);
  else section.prepend(breadcrumb);
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks(main) {
  try {
    // auto load `*/fragments/*` references
    const fragments = [...main.querySelectorAll('a[href*="/fragments/"]')].filter((f) => !f.closest('.fragment'));
    if (fragments.length > 0) {
      // eslint-disable-next-line import/no-cycle
      import('../blocks/fragment/fragment.js').then(({ loadFragment }) => {
        fragments.forEach(async (fragment) => {
          try {
            const { pathname } = new URL(fragment.href);
            const frag = await loadFragment(pathname);
            fragment.parentElement.replaceWith(...frag.children);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Fragment loading failed', error);
          }
        });
      });
    }
    buildWidgetAutoBlocks(main);
    buildBreadcrumbAutoBlock(main);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Decorates formatted links to style them as buttons.
 * @param {HTMLElement} main The main container element
 */
function decorateButtons(main) {
  main.querySelectorAll('p a[href]').forEach((a) => {
    a.title = a.title || a.textContent;
    const p = a.closest('p');
    const text = a.textContent.trim();

    // quick structural checks
    if (a.querySelector('img') || p.textContent.trim() !== text) return;

    // skip URL display links
    try {
      if (new URL(a.href).href === new URL(text, window.location).href) return;
    } catch { /* continue */ }

    // require authored formatting for buttonization
    const strong = a.closest('strong');
    const em = a.closest('em');
    if (!strong && !em) return;

    p.className = 'button-wrapper';
    a.className = 'button';
    if (strong && em) { // high-impact call-to-action
      a.classList.add('accent');
      const outer = strong.contains(em) ? strong : em;
      outer.replaceWith(a);
    } else if (strong) {
      a.classList.add('primary');
      strong.replaceWith(a);
    } else {
      a.classList.add('secondary');
      em.replaceWith(a);
    }
  });
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  // modal sections (section metadata "modal") in the page or any fragment, e.g. the nav
  registerModalSections(main);
  decorateBlocks(main);
  decorateButtons(main);
}

/*
 * Partner pages: a page whose metadata (usually the site's metadata.json) has a
 * `partner-member-name` (e.g. /en-uk/offers/travelwise: travelwise) is for that partner's members.
 * Without a valid partner token the visitor is sent to the partner's password page,
 * /{site}/{partner} (e.g. /en-uk/travelwise, with the Travelwise Password block), with the page in
 * `?returnUrl=`, as on the source site. The password goes to the PartnerLogin API, which answers
 * with a partnerToken; the token is kept in the browser per partner and checked on every partner
 * page load (a JWT must be unexpired and, when it names a partner, name this one).
 * The pages' content is still public (Edge Delivery serves it to anyone): this keeps visitors to
 * the partner's flow, it doesn't make the content secret.
 */
const PARTNER_META = 'partner-member-name';
const PARTNER_TOKEN_KEY = 'partner-token-';
// the password page's block: a page with it is never sent to the password page
const PARTNER_PASSWORD_BLOCK = 'travelwise-password';
// a token that isn't a JWT: one word of token characters
const OPAQUE_TOKEN = /^[\w~+/=-]{8,}$/;
// the source site's host names: a returnUrl on them (the source's own links) stays on this site
const SITE_HOSTS = ['www.plazapremiumlounge.com', 'plazapremiumlounge.com'];
let bulkMetadata;

/**
 * A partner name as compared everywhere: trimmed, lower case.
 * @param {*} value
 * @returns {string}
 */
export function toPartnerName(value) {
  return String(value ?? '').trim().toLowerCase();
}

/**
 * The stored token of a partner, or ''.
 * @param {string} partner
 * @returns {string}
 */
export function getPartnerToken(partner) {
  try {
    return localStorage.getItem(`${PARTNER_TOKEN_KEY}${partner}`) || '';
  } catch {
    return '';
  }
}

/**
 * Stores a partner's token (checked first by the caller).
 * @param {string} partner
 * @param {string} token
 */
export function setPartnerToken(partner, token) {
  try {
    localStorage.setItem(`${PARTNER_TOKEN_KEY}${partner}`, token);
  } catch {
    // no storage (e.g. blocked): the visitor will be asked for the password again
  }
}

/**
 * Removes a partner's token.
 * @param {string} partner
 */
export function clearPartnerToken(partner) {
  try {
    localStorage.removeItem(`${PARTNER_TOKEN_KEY}${partner}`);
  } catch {
    // nothing stored
  }
}

/**
 * Whether a partnerToken can be used for a partner: a JWT must be signed, unexpired
 * (scripts/auth.js) and, when it names a partner (`partnername`, `partnerName` or `partner`), name
 * this one; a token that isn't a JWT must be one word of token characters. The API checks the
 * token itself.
 * @param {*} token
 * @param {string} partner
 * @returns {boolean}
 */
export function isPartnerTokenValid(token, partner) {
  if (typeof token !== 'string' || !token || !partner) return false;
  const jwt = decodeJwt(token);
  if (!jwt) return token.split('.').length !== 3 && OPAQUE_TOKEN.test(token);
  if (!isTokenValid(token)) return false;
  const { payload } = jwt;
  const named = toPartnerName(payload.partnername ?? payload.partnerName ?? payload.partner);
  return !named || named === partner;
}

/**
 * The partner's password page in the visitor's language site: /{site}/{partner}.
 * @param {string} partner
 * @returns {string}
 */
export function partnerPasswordPath(partner) {
  return `/${getSiteFolder() || DEFAULT_SITE}/${partner}`;
}

/**
 * A page on this site from a returnUrl, as a path with its query and hash: a path, or a full
 * address on this site or the source site's host; '' for anything else (another website, `//host`,
 * `javascript:`), so a link can't send the visitor away.
 * @param {string|null} value
 * @returns {string}
 */
export function toSitePath(value) {
  if (!value) return '';
  let url;
  try {
    url = new URL(value, window.location.origin);
  } catch {
    return '';
  }
  if (!/^https?:$/.test(url.protocol)) return '';
  if (url.origin !== window.location.origin && !SITE_HOSTS.includes(url.hostname)) return '';
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * The site's metadata.json rows (one request per page; none when it can't be read).
 * @returns {Promise<object[]>}
 */
function getBulkMetadata() {
  if (!bulkMetadata) {
    bulkMetadata = fetch('/metadata.json')
      .then((res) => (res.ok ? res.json() : {}))
      .then((json) => (Array.isArray(json?.data) ? json.data : []))
      .catch(() => []);
  }
  return bulkMetadata;
}

/**
 * Whether a metadata.json URL pattern matches a path (`**` any part of the path, `*` one part).
 * @param {string} pattern
 * @param {string} path
 * @returns {boolean}
 */
function matchesUrl(pattern, path) {
  const escape = (text) => text.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const source = String(pattern || '').split('**')
    .map((part) => part.split('*').map(escape).join('[^/]*'))
    .join('.*');
  return !!source && new RegExp(`^${source}$`).test(path);
}

/**
 * The partner of a page, from metadata.json (the last matching row with a partner-member-name,
 * as later rows override earlier ones); '' when it isn't a partner page.
 * @param {string} path
 * @returns {Promise<string>}
 */
export async function getPartnerOfPath(path) {
  const rows = await getBulkMetadata();
  return rows.reduce((found, row) => {
    const partner = toPartnerName(row[PARTNER_META]);
    return partner && matchesUrl(row.URL, path) ? partner : found;
  }, '');
}

/**
 * A partner's page (its first metadata.json row with a plain URL, no pattern), e.g.
 * /en-uk/offers/travelwise for travelwise; '' when there's none.
 * @param {string} partner
 * @returns {Promise<string>}
 */
export async function getPartnerPage(partner) {
  const rows = await getBulkMetadata();
  const row = rows.find((r) => toPartnerName(r[PARTNER_META]) === partner && r.URL && !r.URL.includes('*'));
  return row ? row.URL : '';
}

/**
 * Sends a partner's password to the PartnerLogin API and checks the answer: the login must
 * succeed, a partner name in the answer must be this partner, and its partnerToken must be valid
 * (isPartnerTokenValid). A valid token is stored. Nothing is logged.
 * @param {string} partner The partner-member-name
 * @param {string} password
 * @returns {Promise<{ok: boolean, reason?: 'invalid'|'mismatch'|'token'|'error'|'network',
 *   message?: string}>} message: the API's own message for a refused login
 */
export async function partnerLogin(partner, password) {
  let response;
  try {
    response = await fetch(apiUrl('partnerLogin'), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ partnername: partner, password }),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, reason: 'network' };
  }
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  const status = Number(data?.statusCode) || response.status;
  if (!response.ok || status >= 400) {
    const message = typeof data?.message === 'string' ? data.message.trim() : '';
    return { ok: false, reason: response.status >= 500 ? 'error' : 'invalid', message };
  }
  const answered = toPartnerName(data?.partnername ?? data?.partnerName);
  if (answered && answered !== partner) return { ok: false, reason: 'mismatch' };
  if (!isPartnerTokenValid(data?.partnerToken, partner)) return { ok: false, reason: 'token' };
  setPartnerToken(partner, data.partnerToken);
  return { ok: true };
}

/**
 * Sends a visitor without a valid token for the page's partner (its `partner-member-name`) to the
 * partner's password page, with this page as the returnUrl; the history entry is replaced, so Back
 * doesn't return here. Pages without a partner, and the password page itself, are left alone.
 * @returns {boolean} Whether the page can show
 */
function checkPartnerAccess() {
  const partner = toPartnerName(getMetadata(PARTNER_META));
  if (!partner || document.querySelector(`main .${PARTNER_PASSWORD_BLOCK}`)) return true;
  if (isPartnerTokenValid(getPartnerToken(partner), partner)) return true;
  clearPartnerToken(partner);
  const login = new URL(partnerPasswordPath(partner), window.location.origin);
  login.searchParams.set('returnUrl', window.location.href);
  window.location.replace(login.href);
  return false;
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  // a logged-in visitor's token: an expired or broken one logs out and goes home (nothing is
  // checked when nobody is logged in)
  checkSession();
  // the header's account menu Logout (#logout): log out and go home
  document.addEventListener('header:action', (e) => {
    if (e.detail?.name === 'logout') logout();
  });
  // the page language: page metadata `language`, else the site folder (e.g. /zh-cn/ → zh-CN)
  document.documentElement.lang = getLanguage();
  decorateTemplateAndTheme();
  installModalLinks();
  // YouTube, Vimeo and video file links play in the video popup, wherever they are authored
  installVideoLinks();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  loadHeader(doc.querySelector('body > header'));

  const main = doc.querySelector('main');
  await loadSections(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadFooter(doc.querySelector('body > footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  import('./consent-check.js');
  // the back to top button, on every page
  import('./back-to-top.js').then(({ default: initBackToTop }) => initBackToTop());
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  // a partner page without a valid partner token goes to the partner's password page before
  // anything shows; checked again when the page comes back from the browser's back/forward cache
  if (!checkPartnerAccess()) return;
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) checkPartnerAccess();
  });
  showLoader();
  await loadEager(document);
  hideLoader();
  await loadLazy(document);
  installNavigationLoader();
  loadDelayed();
}

loadPage();
