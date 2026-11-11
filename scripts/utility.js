/*
 * Utilities: small general helpers shared by blocks and scripts (no page state, no network
 * calls), e.g. date and time conversions.
 */

/**
 * A date and time at a place as ISO 8601 UTC without milliseconds: 2026-11-20 at 1600 in Hong
 * Kong is "2026-11-20T08:00:00Z". Without a time zone, the browser's.
 * @param {string} date YYYY-MM-DD
 * @param {string} time HHmm
 * @param {string} [timeZone] The place's IANA time zone, e.g. Asia/Hong_Kong
 * @returns {string}
 */
// eslint-disable-next-line import/prefer-default-export
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
