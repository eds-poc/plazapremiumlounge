/*
 * The logged-in member's details for analytics (scripts/datalayer.js): the membership number, the
 * points and the SHA-256 hashes of the email and the phone, read from GetProfile once, when the
 * visitor logs in (scripts/account-forms.js), and kept in localStorage so no page waits for the
 * API. The email and the phone themselves are never kept. They belong to the token they were read
 * with, and go when it goes (logout, an expired token: clearToken in scripts/auth.js).
 */
import apiUrl from './endpoints.js';

const MEMBER_KEY = 'ppl-member';
// how long logging in waits for the profile before the page moves on without it
const PROFILE_TIMEOUT_MS = 5000;

/**
 * The SHA-256 of a text, as lowercase hex.
 * @param {string} text
 * @returns {Promise<string>}
 */
async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * An email as Launch's `Email_LC_SHA256` identity expects it before hashing: trimmed, lowercase.
 * @param {*} email
 * @returns {string} '' without an email
 */
function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/**
 * A phone as Launch's `Phone_SHA256_E.164` identity expects it before hashing: E.164, the country
 * code and the number as digits after a "+", without the number's leading 0 (852 + "9123 4567" →
 * "+85291234567", 44 + "07700 900123" → "+447700900123").
 * @param {*} countryCode e.g. 852, "+852"
 * @param {*} phone
 * @returns {string} '' without a country code or a number
 */
function normalizePhone(countryCode, phone) {
  const code = String(countryCode ?? '').replace(/\D/g, '');
  const number = String(phone ?? '').replace(/\D/g, '').replace(/^0+/, '');
  return code && number ? `+${code}${number}` : '';
}

/**
 * Which token the details belong to: the end of its signature (unique to each token).
 * @param {string} token
 * @returns {string}
 */
function tokenKey(token) {
  return String(token).split('.')[2]?.slice(-16) || '';
}

/**
 * The member's kept details for a token, or null (none kept, or kept for another token).
 * @param {string} token
 * @returns {{stMemberId: string, currentPoints: number|undefined, hashedEmail: string,
 *   hashedPhone: string}|null}
 */
export function readMember(token) {
  try {
    const saved = JSON.parse(localStorage.getItem(MEMBER_KEY) || 'null');
    return saved && saved.key === tokenKey(token) ? saved.member : null;
  } catch {
    return null;
  }
}

/**
 * Removes the kept details (logout).
 */
export function forgetMember() {
  try {
    localStorage.removeItem(MEMBER_KEY);
  } catch { /* nothing kept */ }
}

/**
 * Reads the member's profile (GetProfile) with a token and keeps their details for it: called on
 * login. Gives up after PROFILE_TIMEOUT_MS; nothing is kept when the profile can't be read.
 * @param {string} token A valid login token
 * @returns {Promise<object|null>} the kept details, or null
 */
export async function storeMember(token) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROFILE_TIMEOUT_MS);
  try {
    const resp = await fetch(apiUrl('getProfile'), {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    const profile = resp.ok ? await resp.json() : null;
    if (!profile || Number(profile.serviceResponseCode) >= 400) return null;
    const email = normalizeEmail(profile.userName);
    const phone = normalizePhone(profile.countryPhoneCode, profile.phone);
    const points = Number(profile.points);
    const member = {
      stMemberId: profile.membershipID ? String(profile.membershipID) : '',
      currentPoints: profile.points === null || profile.points === undefined
        || Number.isNaN(points) ? undefined : points,
      hashedEmail: email ? await sha256(email) : '',
      hashedPhone: phone ? await sha256(phone) : '',
    };
    localStorage.setItem(MEMBER_KEY, JSON.stringify({ key: tokenKey(token), member }));
    return member;
  } catch {
    // the profile didn't answer in time, or storage is blocked
    return null;
  } finally {
    clearTimeout(timer);
  }
}
