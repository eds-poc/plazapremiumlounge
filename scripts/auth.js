/*
 * The login session: the JWT the Login API answers with, kept in localStorage as `token` once it is
 * checked (three parts, an `alg` other than `none`, an `exp` still to come, an `nbf` already past).
 * The browser can't check the signature (its key isn't in the page): the API checks the token on
 * every logged-in call. checkSession() runs on every page load, only when a token is stored: an
 * expired or broken one logs the visitor out and sends them to the home page; logout() (the
 * header's account menu) does the same.
 */
import { DEFAULT_SITE, getSiteFolder } from './i18n.js';

const TOKEN_KEY = 'token';
// the clock difference allowed for `nbf` (a token issued by a server a little ahead of us)
const LEEWAY_SECONDS = 30;
// the longest a browser timer can wait (about 24.8 days)
const MAX_TIMER = 2 ** 31 - 1;
const PART = /^[A-Za-z0-9_-]+$/;

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

/**
 * Whether a token is a JWT that hasn't expired: an `exp` (seconds) still to come, and an `nbf`, if
 * any, already past. A token without `exp` is refused, so none lasts forever.
 * @param {string} token
 * @returns {boolean}
 */
export function isTokenValid(token) {
  const { payload } = decodeJwt(token) || {};
  if (!payload) return false;
  const now = Date.now() / 1000;
  if (typeof payload.exp !== 'number' || payload.exp <= now) return false;
  if (payload.nbf !== undefined && (typeof payload.nbf !== 'number' || payload.nbf > now + LEEWAY_SECONDS)) return false;
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
 * Checks the stored token on page load; nothing to check when nobody is logged in. An expired or
 * broken token logs out and goes home; a valid one is checked again when it expires, if the page is
 * still open then.
 */
export function checkSession() {
  const token = getToken();
  if (!token) return;
  if (!isTokenValid(token)) {
    endSession({ replace: true });
    return;
  }
  const wait = decodeJwt(token).payload.exp * 1000 - Date.now();
  if (wait < MAX_TIMER) {
    setTimeout(() => {
      if (getToken() === token) endSession({ reload: true, replace: true });
    }, wait);
  }
}
