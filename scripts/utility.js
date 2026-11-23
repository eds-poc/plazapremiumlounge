/*
 * Utilities: small general helpers shared by blocks and scripts (no page state, no network
 * calls), e.g. date and time conversions and reading authored cells.
 */

/**
 * Text, trimmed, its runs of spaces made one.
 * @param {*} value
 * @returns {string}
 */
export function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * An authored cell's text with its lines (paragraphs, list items, line breaks) as commas, for a
 * list written one item per line or comma-separated.
 * @param {HTMLElement} cell
 * @returns {string}
 */
export function cellText(cell) {
  const copy = cell.cloneNode(true);
  copy.querySelectorAll('br').forEach((br) => br.replaceWith(','));
  copy.querySelectorAll('p, li').forEach((line) => line.append(','));
  return copy.textContent;
}

/**
 * A date and time at a place as ISO 8601 UTC without milliseconds: 2026-11-20 at 1600 in Hong
 * Kong is "2026-11-20T08:00:00Z". Without a time zone, the browser's.
 * @param {string} date YYYY-MM-DD
 * @param {string} time HHmm
 * @param {string} [timeZone] The place's IANA time zone, e.g. Asia/Hong_Kong
 * @returns {string}
 */
export function toUtcDateTime(date, time, timeZone) {
  const [year, month, day] = date.split('-').map(Number);
  const wanted = Date.UTC(year, month - 1, day, Number(time.slice(0, 2)), Number(time.slice(2)));
  // the zone's offset from UTC at an instant (ms), from the time it shows then
  const offset = (at) => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(at)).map((p) => [p.type, p.value]));
    const shown = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    return shown - at;
  };
  // (twice: the first guess can be on the other side of a daylight saving change)
  const guess = wanted - offset(wanted);
  return new Date(wanted - offset(guess)).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * The days from today at a place to a date: 0 for today, 2 for the day after tomorrow. Without a
 * time zone, today is the browser's.
 * @param {string} date YYYY-MM-DD
 * @param {string} [timeZone] The place's IANA time zone, e.g. Asia/Hong_Kong
 * @returns {number}
 */
export function daysUntil(date, timeZone) {
  // today's date at the place as YYYY-MM-DD (as en-CA writes a date)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.round((Date.parse(date) - Date.parse(today)) / dayMs);
}

/**
 * The SHA-256 of a text, as lowercase hex.
 * @param {string} text
 * @returns {Promise<string>}
 */
export async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// the months as the GA4 events write a date (see toCheckInDate)
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * A date as the GA4 events write it: DD-MMM-YYYY (2026-11-19 → 19-Nov-2026), '' for another value.
 * @param {string} date YYYY-MM-DD
 * @returns {string}
 */
export function toCheckInDate(date) {
  const [, y, m, d] = String(date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/) || [];
  return y && MONTHS[Number(m) - 1] ? `${d}-${MONTHS[Number(m) - 1]}-${y}` : '';
}
