/*
 * Logged-in user, for the header's initials badge and account menu: the visitor is logged in when
 * the stored token (scripts/auth.js) is a valid, unexpired JWT; the name is its `firstName` and
 * `lastName` claims. The name is only shown (as text), never trusted: the APIs check the token.
 */
import { decodeJwt, getToken, isTokenValid } from './auth.js';

/**
 * A name claim, or '' when it's missing (some answers carry the text "null").
 * @param {*} value
 * @returns {string}
 */
function nameOf(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text === 'null' ? '' : text;
}

/**
 * The logged-in user, or null when nobody is logged in (no token, or one that isn't valid): the
 * full name and the initials of the first and last name ("Abc" "Xyz" → "AX"; '' without a name).
 * @returns {{fullName: string, initials: string}|null}
 */
// eslint-disable-next-line import/prefer-default-export
export function getLoggedInUser() {
  const token = getToken();
  if (!token || !isTokenValid(token)) return null;
  const { payload } = decodeJwt(token);
  const firstName = nameOf(payload.firstName);
  const lastName = nameOf(payload.lastName);
  return {
    fullName: [firstName, lastName].filter(Boolean).join(' '),
    initials: `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase(),
  };
}
