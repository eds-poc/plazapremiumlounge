/*
 * Logged-in user, for the header's initials badge and account menu.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────────────────┐
 * │ TEMPORARY: there is no login yet. This file only lets the logged-in header be styled and │
 * │ tested. Nothing here authenticates, reads a session or calls an API.                     │
 * │                                                                                          │
 * │ When real login is connected:                                                            │
 * │  1. Replace TEMP_IS_LOGGED_IN (and the ?logged-in preview switch) with the real check of │
 * │     whether the visitor is logged in.                                                    │
 * │  2. Remove TEMP_USER_FULL_NAME. Get the logged-in user's full name from the real source  │
 * │     (session storage, the existing login mechanism, or wherever it turns out to be; the  │
 * │     source is not known yet).                                                            │
 * │  3. Keep getLoggedInUser()'s shape ({ fullName } or null) and initialsFrom(): if only    │
 * │     the full name is available, initialsFrom() makes the first and last name initials.   │
 * └──────────────────────────────────────────────────────────────────────────────────────────┘
 */

// TEMPORARY: the login state flag. Remove it and use the real logged-in check.
const TEMP_IS_LOGGED_IN = false;

// TEMPORARY: a sample name for styling and testing ("KJ"). Remove it and use the real user's name.
const TEMP_USER_FULL_NAME = 'Kunal Jaiswal';

/**
 * TEMPORARY: `?logged-in` in the page URL shows the logged-in header on any preview without a
 * code change. Remove it together with TEMP_IS_LOGGED_IN.
 * @returns {boolean}
 */
function tempPreviewLoggedIn() {
  try {
    return new URLSearchParams(window.location.search).has('logged-in');
  } catch {
    return false;
  }
}

/**
 * The logged-in user, or null when nobody is logged in.
 * TEMPORARY implementation: replace its body with the real logged-in check and user data.
 * @returns {{fullName: string}|null}
 */
export function getLoggedInUser() {
  if (!TEMP_IS_LOGGED_IN && !tempPreviewLoggedIn()) return null;
  return { fullName: TEMP_USER_FULL_NAME };
}

/**
 * The first and last name initials of a full name ("Kim Jones" → "KJ", "Mary Ann Lee" → "ML",
 * "Cher" → "C"); empty when there is no name. Keep this when the real data source is connected.
 * @param {string} fullName
 * @returns {string}
 */
export function initialsFrom(fullName) {
  const words = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  const first = words[0].charAt(0);
  const last = words.length > 1 ? words[words.length - 1].charAt(0) : '';
  return `${first}${last}`.toUpperCase();
}
