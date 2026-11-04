/*
 * The login session: the JWT the Login API answers with, kept in localStorage as `token` once it is
 * checked (three parts, an `alg` other than `none`, an `exp` still to come, an `nbf` already past).
 * The browser can't check the signature (its key isn't in the page): the API checks the token on
 * every logged-in call. The token is checked against its expiry on login and on every page load
 * (checkSession(), only when a token is stored): an expired or broken one logs the visitor out and
 * sends them to the home page; logout() (the header's account menu) does the same.
 *
 * A guest on a members' page goes to the home page with the page in `?redirectUrl=`; there the
 * login modal opens, and once logged in (scripts/account-forms.js) the visitor goes back to it.
 * Only this site's own pages are followed (safeRedirect), so it can't send anyone elsewhere.
 */
import { getMetadata } from './aem.js';
import { DEFAULT_SITE, getSiteFolder } from './i18n.js';

const TOKEN_KEY = 'token';
// the address parameter with the members' page to go back to after logging in
const REDIRECT_PARAM = 'redirectUrl';
// a JWT part: base64url characters only (letters, digits, - and _; no +, / or = padding)
const PART = /^[A-Za-z0-9_-]+$/;

// a members' page, only for a logged-in visitor: `members-only` true in the site's metadata sheet
// (a row per URL or pattern, e.g. /**/membership/** and /**/view-booking) or in the page's own
// Metadata
function isMembersPage() {
  return /^(true|yes)$/i.test(getMetadata('members-only').trim());
}

/**
 * One base64url part of a JWT, as JSON.
 * @param {string} part
 * @returns {*}
 */
function decodePart(part) {
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
    .padEnd(Math.ceil(part.length / 4) * 4, '=');
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

/**
 * A JWT's header and payload, or null when it isn't one: three base64url parts (header, payload,
 * signature), JSON objects, and a signing `alg` other than `none` (unsigned tokens aren't trusted).
 * @param {string} token
 * @returns {{header: object, payload: object}|null}
 */
export function decodeJwt(token) {
  const parts = typeof token === 'string' ? token.split('.') : [];
  if (parts.length !== 3 || !parts.every((part) => PART.test(part))) return null;
  try {
    const header = decodePart(parts[0]);
    const payload = decodePart(parts[1]);
    if (!header || typeof header !== 'object' || !payload || typeof payload !== 'object') return null;
    if (typeof header.alg !== 'string' || header.alg.toLowerCase() === 'none') return null;
    return { header, payload };
  } catch {
    return null;
  }
}

/*
 * Dates and times, in plain terms: a JWT's `exp` (expiry), `nbf` (not before) and `iat` (issued at)
 * are Unix timestamps, the number of SECONDS since 1 January 1970 00:00:00 UTC. JavaScript's
 * Date.now() is the same count in MILLISECONDS, so `exp * 1000` and Date.now() are two moments on
 * the same UTC timeline and are compared directly. No time zone is involved: the visitor's time
 * zone (IST, GMT, …) only changes how a moment is written, not the moment itself, so the answer is
 * the same everywhere at the same instant. Never convert to local time before comparing.
 *
 * To show a timestamp to a person, convert it only for display:
 *   new Date(exp * 1000).toISOString()   // UTC: 1793127308 → "2026-10-27T18:55:08.000Z"
 *   new Date(exp * 1000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
 *                                        // IST: "28/10/2026, 12:25:08 am"
 *   new Date(exp * 1000).toString()      // the visitor's own time zone
 *
 * What does matter is the visitor's system CLOCK (not its time zone): a clock set hours wrong makes
 * the browser decide early or late. That only changes what the page shows; the API checks the
 * token's expiry with its own clock on every logged-in call.
 */

/**
 * Whether a token is a JWT that can be used now:
 * - `exp` (expiry) is required and must still be to come: `exp * 1000 > Date.now()`. A token
 *   without `exp` is refused, so none lasts forever; an expired token is refused at once.
 * - `nbf` (not before) is optional: the moment the token starts being valid. When present it must
 *   be a number and already past: `nbf * 1000 <= Date.now()`. Without `nbf` the token is valid from
 *   when it's issued. No allowance is made for a server clock a little ahead of the visitor's.
 * @param {string} token
 * @returns {boolean}
 */
export function isTokenValid(token) {
  const { payload } = decodeJwt(token) || {};
  if (!payload) return false;
  const now = Date.now();
  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= now) return false;
  if (payload.nbf !== undefined && (typeof payload.nbf !== 'number' || payload.nbf * 1000 > now)) return false;
  return true;
}

/**
 * The stored token, or '' (also when the browser's storage isn't available).
 * @returns {string}
 */
export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

/**
 * Stores a token (checked first by the caller) and tells the page (`auth:change`).
 * @param {string} token
 */
export function setToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // no storage (e.g. blocked): the visitor stays logged out
  }
  document.dispatchEvent(new CustomEvent('auth:change', { detail: { loggedIn: true } }));
}

/**
 * Removes the token (logout) and tells the page (`auth:change`).
 */
export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // nothing stored
  }
  document.dispatchEvent(new CustomEvent('auth:change', { detail: { loggedIn: false } }));
}

/**
 * The visitor's home page: their language site's (/en-uk/), else the default site's.
 * @returns {string}
 */
function homePath() {
  return `/${getSiteFolder() || DEFAULT_SITE}/`;
}

/**
 * Whether a path is a home page (/en-uk/, /en-uk, /).
 * @param {string} path
 * @returns {boolean}
 */
function isHomePath(path) {
  return /^\/(?:[a-z]{2}-[a-z]{2}\/?)?(?:index(?:\.html)?)?$/.test(path);
}

/**
 * A page to go back to after logging in, or '' when it isn't one of this site's pages: at most
 * 2,000 characters, on this site's address (not another site, `//other.site` or `javascript:`),
 * not a `/modals/` page or a home page. The result is the path, query and hash only.
 * @param {string} value
 * @returns {string}
 */
export function safeRedirect(value) {
  if (typeof value !== 'string' || !value || value.length > 2000) return '';
  let url;
  try {
    url = new URL(value, window.location.origin);
  } catch {
    return '';
  }
  if (url.origin !== window.location.origin) return '';
  if (url.pathname.split('/').includes('modals') || isHomePath(url.pathname)) return '';
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * The page to go back to after logging in (the address's `redirectUrl`, when safe), or ''.
 * @returns {string}
 */
export function redirectTarget() {
  return safeRedirect(new URLSearchParams(window.location.search).get(REDIRECT_PARAM) || '');
}

/**
 * Opens the login modal of the page's language once the page has loaded (so it doesn't hold up the
 * page); closed without logging in, `redirectUrl` leaves the address, so a refresh doesn't open it
 * again (another modal opened from it, e.g. Forgot password, keeps it).
 */
function openLogin() {
  // (loaded only here: modal.js reaches this script through the page's own scripts)
  // eslint-disable-next-line import/no-cycle
  const open = () => import('./modal.js')
    .then(({ openPageModal }) => openPageModal(new URL(`${homePath()}modals/login`, window.location.origin)));
  if (document.readyState === 'complete') open();
  else window.addEventListener('load', open, { once: true });
  // a dialog's close doesn't bubble: caught on the way down
  document.addEventListener('close', (e) => {
    if (!e.target.matches?.('dialog.modal') || document.querySelector('dialog.modal[open]') || getToken()) return;
    const url = new URL(window.location.href);
    url.searchParams.delete(REDIRECT_PARAM);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, true);
}

/**
 * Logs out and goes to the home page. Already there, it reloads when the header is built (so it
 * shows Log In again); on page load it doesn't need to, so it can't loop.
 * @param {{reload?: boolean, replace?: boolean}} [options] reload: when already home; replace:
 *   the history entry (an expiry) rather than a new one (a logout)
 */
function endSession({ reload = false, replace = false } = {}) {
  clearToken();
  const home = homePath();
  const path = window.location.pathname.replace(/\/index(\.html)?$/, '/');
  if (path === home || path === home.slice(0, -1) || path === '/') {
    if (reload) window.location.reload();
  } else if (replace) {
    window.location.replace(home);
  } else {
    window.location.assign(home);
  }
}

/**
 * Logout (the header's account menu): removes the token and goes to the home page.
 */
export function logout() {
  endSession({ reload: true });
}

/**
 * Checks the stored token against its expiry on page load. An expired or broken token logs out and
 * goes home (replacing the history entry, so Back doesn't return to the page). A guest on a
 * members' page (isMembersPage) goes home with the page in `?redirectUrl=`, to come back after
 * logging in. A page with a safe `redirectUrl` opens the login modal for a guest, and goes straight
 * there when the visitor is already logged in. A page left open past the expiry is checked on the
 * next page load.
 */
export function checkSession() {
  const token = getToken();
  if (token && !isTokenValid(token)) {
    endSession({ replace: true });
    return;
  }
  const { pathname, search, hash } = window.location;
  if (!token && isMembersPage() && !isHomePath(pathname)) {
    const home = new URL(homePath(), window.location.origin);
    const back = safeRedirect(`${pathname}${search}${hash}`);
    if (back) home.searchParams.set(REDIRECT_PARAM, back);
    window.location.replace(`${home.pathname}${home.search}`);
    return;
  }
  const target = redirectTarget();
  if (!target) return;
  if (token) window.location.replace(target);
  else openLogin();
}

/**
 * The headers for a logged-in API call: the stored token as `Authorization: Bearer <jwt>`.
 * @returns {Object<string, string>}
 */
export function authHeaders() {
  return { Accept: 'application/json', Authorization: `Bearer ${getToken()}` };
}
