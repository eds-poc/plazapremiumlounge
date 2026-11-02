/*
 * The login session: the JWT the Login API answers with, kept in localStorage as `token` once it is
 * checked (three parts, an `alg` other than `none`, an `exp` still to come, an `nbf` already past).
 * The browser can't check the signature (its key isn't in the page): the API checks the token on
 * every logged-in call. The token is checked against its expiry on login and on every page load
 * (checkSession(), only when a token is stored): an expired or broken one logs the visitor out and
 * sends them to the home page; logout() (the header's account menu) does the same.
 * Partner pages have their own login, a partner token per partner (see checkPartnerAccess()).
 */
import { getMetadata } from './aem.js';
import { DEFAULT_SITE, getSiteFolder } from './i18n.js';

const TOKEN_KEY = 'token';
// a JWT part: base64url characters only (letters, digits, - and _; no +, / or = padding)
const PART = /^[A-Za-z0-9_-]+$/;
// the members' pages (a language folder, then membership): only for a logged-in visitor
const MEMBERS_PAGE = /^\/[a-z]{2}-[a-z]{2}\/membership\//;
// partner pages: the metadata naming the page's partner, and the optional one for its password page
const PARTNER_META = 'partner-member-name';
const PARTNER_PAGE_META = 'partner-password-page';
// a partner's stored login: this prefix and the partner name, `{ token, expiresAt }`
const PARTNER_TOKEN_KEY = 'partner-token-';
// the password page's block: a page with it is never sent to the password page
const PARTNER_PASSWORD_BLOCK = 'partner-password';

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
 * Checks the stored token against its expiry on page load; nothing to check when nobody is logged
 * in, except on a members' page (MEMBERS_PAGE), which needs a valid token. An expired or broken
 * token, or none on a members' page, logs out and goes home (it replaces the history entry, so
 * Back doesn't return to the page). A page left open past the expiry is checked on the next page
 * load.
 */
export function checkSession() {
  const token = getToken();
  if (token ? !isTokenValid(token) : MEMBERS_PAGE.test(window.location.pathname)) {
    endSession({ replace: true });
  }
}

/**
 * The headers for a logged-in API call: the stored token as `Authorization: Bearer <jwt>`.
 * @returns {Object<string, string>}
 */
export function authHeaders() {
  return { Accept: 'application/json', Authorization: `Bearer ${getToken()}` };
}

/**
 * A partner name as compared everywhere: trimmed, lower case.
 * @param {*} value
 * @returns {string}
 */
export function toPartnerName(value) {
  return String(value ?? '').trim().toLowerCase();
}

/**
 * Whether a token can be used for a partner: a signed, unexpired JWT (isTokenValid) that names the
 * partner in its partner claim (`partnerName`, else `partnername` or `partner`). The API checks
 * the signature itself.
 * @param {*} token
 * @param {string} partner
 * @returns {boolean}
 */
export function isPartnerTokenValid(token, partner) {
  if (typeof token !== 'string' || !token || !partner || !isTokenValid(token)) return false;
  const { payload } = decodeJwt(token);
  return toPartnerName(payload.partnerName ?? payload.partnername ?? payload.partner) === partner;
}

/**
 * Stores a partner's login (checked first by the caller) for the partner's pages.
 * @param {string} partner
 * @param {string} token
 * @param {number} expiresAt When the login ends (milliseconds)
 */
export function setPartnerToken(partner, token, expiresAt) {
  try {
    localStorage.setItem(`${PARTNER_TOKEN_KEY}${partner}`, JSON.stringify({ token, expiresAt }));
  } catch {
    // no storage (e.g. blocked): the partner's pages will ask for the password again
  }
}

/**
 * When a stored partner login expires (milliseconds), or 0 when there's none or it can't be read.
 * @param {string|null} stored The stored record (JSON)
 * @returns {number}
 */
function partnerTokenExpiry(stored) {
  try {
    const login = JSON.parse(stored);
    const usable = typeof login?.token === 'string' && login.token && Number.isFinite(login.expiresAt);
    return usable ? login.expiresAt : 0;
  } catch {
    return 0;
  }
}

/**
 * The partner's password page: the page's `partner-password-page` metadata (a path or link on this
 * site), else /{site}/{partner}.
 * @param {string} partner
 * @returns {URL}
 */
function partnerPasswordPage(partner) {
  const authored = getMetadata(PARTNER_PAGE_META).trim();
  const fallback = `/${getSiteFolder() || DEFAULT_SITE}/${partner}`;
  try {
    const url = new URL(authored || fallback, window.location.origin);
    return url.origin === window.location.origin ? url : new URL(fallback, window.location.origin);
  } catch {
    return new URL(fallback, window.location.origin);
  }
}

/**
 * Partner pages: a page with `partner-member-name` metadata (e.g. set for the page in the bulk
 * metadata sheet) shows only while an unexpired login for that partner is stored (its password
 * page stores it). Otherwise the record is removed and the visitor goes to the password page with
 * `?partner=<partner>&returnUrl=<page>` (and `&reason=expired` when a login had been stored),
 * replacing the history entry. Checked on page load only: a page already open (or restored with
 * Back) stays until the next page load. The content is still public (Edge Delivery serves it to
 * anyone): this keeps visitors to the partner's flow.
 * @returns {boolean} Whether the page can show
 */
export function checkPartnerAccess() {
  const partner = toPartnerName(getMetadata(PARTNER_META));
  if (!partner || document.querySelector(`main .${PARTNER_PASSWORD_BLOCK}`)) return true;
  const key = `${PARTNER_TOKEN_KEY}${partner}`;
  let stored = null;
  try {
    stored = localStorage.getItem(key);
  } catch {
    stored = null;
  }
  if (partnerTokenExpiry(stored) > Date.now()) return true;
  try {
    localStorage.removeItem(key);
  } catch {
    // nothing stored
  }
  const login = partnerPasswordPage(partner);
  login.searchParams.set('partner', partner);
  login.searchParams.set('returnUrl', window.location.href);
  if (stored) login.searchParams.set('reason', 'expired');
  window.location.replace(login.href);
  return false;
}
