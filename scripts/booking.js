/*
 * Booking rules shared by the booking forms (the lounge page's Book your visit panel and the
 * Booking Widget): half-hour start times, the lounge's lead time and time zone, the first bookable
 * slot, the date as the source writes it, and the guest limits.
 */
import { getLanguage } from './i18n.js';

/**
 * Whether a value is a real calendar date as YYYY-MM-DD (not e.g. 2026-02-30).
 * @param {string} value
 * @returns {boolean}
 */
export function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export const SLOT_MINUTES = 30;
export const DAY_MINUTES = 24 * 60;
// the source's guest limits: 9 guests at most, and up to two children per adult
export const MAX_GUESTS = 9;
export const CHILDREN_PER_ADULT = 2;

// time zones already checked: the locations service repeats them (about 250 locations, 70 zones),
// and making a date format to check one is slow (it loads the zone's data)
const checkedZones = new Map();
let supportedZones;

/**
 * Whether the browser knows a time zone: in its list of zones, else (an alias, e.g. Asia/Calcutta)
 * when a date format takes it. Checked once per zone.
 * @param {string} zone
 * @returns {boolean}
 */
function isTimeZone(zone) {
  if (!checkedZones.has(zone)) {
    if (!supportedZones) {
      try {
        supportedZones = new Set(Intl.supportedValuesOf('timeZone'));
      } catch {
        supportedZones = new Set();
      }
    }
    let known = supportedZones.has(zone);
    if (!known) {
      try {
        Intl.DateTimeFormat('en', { timeZone: zone });
        known = true;
      } catch { /* not a zone */ }
    }
    checkedZones.set(zone, known);
  }
  return checkedZones.get(zone);
}

/**
 * The IANA time zone in the service's text (e.g. "(GMT+8:00) Asia/Hong_Kong, …"), if valid.
 * @param {string} text
 * @returns {string|undefined}
 */
export function readTimeZone(text) {
  const zone = (text || '').match(/[A-Za-z]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?/)?.[0];
  return zone && isTimeZone(zone) ? zone : undefined;
}

// the clock's date format per time zone, made once each
const clocks = new Map();

/**
 * Today's date (YYYY-MM-DD) and the minutes since midnight at the lounge.
 * @param {string} [timeZone]
 * @returns {{date: string, minutes: number}}
 */
export function nowAt(timeZone) {
  // the visitor's own time: the same date and minutes without a date format (the first one made on
  // a page is slow)
  if (!timeZone) {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, minutes: d.getHours() * 60 + d.getMinutes() };
  }
  const key = timeZone;
  if (!clocks.has(key)) {
    clocks.set(key, new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }));
  }
  const parts = Object.fromEntries(clocks.get(key).formatToParts(new Date())
    .map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

/**
 * The day after a date (YYYY-MM-DD).
 * @param {string} date
 * @returns {string}
 */
export function nextDay(date) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * A booking time as HHmm (e.g. 930 → "0930").
 * @param {number} minutes
 * @returns {string}
 */
export function toTime(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}${String(minutes % 60).padStart(2, '0')}`;
}

/**
 * A start as the services call takes it: "2026-10-21 14:00:00" (the lounge's local time).
 * @param {string} date YYYY-MM-DD
 * @param {string} time HHmm
 * @returns {string}
 */
export function toStartDateTime(date, time) {
  return `${date} ${time.slice(0, 2)}:${time.slice(2)}:00`;
}

/**
 * How far a time zone is ahead of UTC at an instant, in milliseconds (e.g. Asia/Hong_Kong: 8 h).
 * @param {number} instant Milliseconds since the epoch
 * @param {string} [timeZone] The visitor's own without one
 * @returns {number}
 */
function zoneOffset(instant, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(instant)).map((p) => [p.type, Number(p.value)]));
  const local = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return local - Math.floor(instant / 1000) * 1000;
}

/**
 * A start at the lounge in UTC, as ISO 8601 without milliseconds: 2026-11-10 at 1400 in
 * Asia/Hong_Kong is "2026-11-10T06:00:00Z" (the lounge's own offset that day, summer time too).
 * @param {string} date YYYY-MM-DD
 * @param {string} time HHmm
 * @param {string} [timeZone] The lounge's (see readTimeZone); the visitor's own without one
 * @returns {string} '' for a date or time that can't be read
 */
export function toUtcDateTime(date, time, timeZone) {
  const [year, month, day] = (date || '').split('-').map(Number);
  const hour = Number((time || '').slice(0, 2));
  const minute = Number((time || '').slice(2, 4));
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  if (!Number.isFinite(wall)) return '';
  // the offset at the wall time, then again at the instant found (a summer time change between)
  let instant = wall - zoneOffset(wall, timeZone);
  instant = wall - zoneOffset(instant, timeZone);
  return new Date(instant).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * The booking date and time to show, as the source: the address's date and time when valid,
 * else the first bookable slot; an earlier date or time moves forward to it (the time onto the
 * half-hour grid). The first bookable slot is the half hour after now plus the lounge's lead time
 * at the lounge (e.g. 12:32 with 1 hour's lead → 14:00), which can be the next day.
 * @param {{date: string, time: string}} params
 * @param {string} [timeZone]
 * @param {number} [leadMinutes] How far ahead bookings must start
 * @returns {{date: string, time: string, firstDay: string, earliest: number}} `earliest` is the
 *   first bookable minute of `firstDay`
 */
export function chooseSlot(params, timeZone, leadMinutes = 0) {
  const now = nowAt(timeZone);
  let first = Math.ceil((now.minutes + leadMinutes + 1) / SLOT_MINUTES) * SLOT_MINUTES;
  let firstDay = now.date;
  while (first >= DAY_MINUTES) {
    firstDay = nextDay(firstDay);
    first -= DAY_MINUTES;
  }
  let date = isIsoDate(params.date) && params.date >= firstDay ? params.date : firstDay;
  const asked = /^\d{4}$/.test(params.time) ? Number(params.time.slice(0, 2)) * 60 + Number(params.time.slice(2)) : NaN;
  let minutes = asked >= 0 && asked < DAY_MINUTES
    ? Math.ceil(asked / SLOT_MINUTES) * SLOT_MINUTES : first;
  if (date === firstDay && minutes < first) minutes = first;
  if (minutes >= DAY_MINUTES) {
    date = nextDay(date);
    minutes -= DAY_MINUTES;
  }
  return {
    date, time: toTime(minutes), firstDay, earliest: first,
  };
}

/**
 * The lounge's booking lead time in minutes, from the service's hours ("1.0", "01.00", "0.0").
 * @param {string|number} value
 * @returns {number}
 */
export function readLeadTime(value) {
  const hours = Number.parseFloat(value);
  return Number.isFinite(hours) && hours > 0 ? Math.round(hours * 60) : 0;
}

/**
 * A date as the source shows it in each language: "21 Oct 2026", "22 Out 2026", "2026年10月22日".
 * @param {string} date YYYY-MM-DD
 * @returns {string}
 */
export function formatDate(date) {
  const lang = getLanguage();
  const d = new Date(`${date}T00:00:00Z`);
  if (/^(zh|ja)/.test(lang)) {
    const [y, m, day] = date.split('-').map(Number);
    return `${y}年${m}月${day}日`;
  }
  const month = new Intl.DateTimeFormat(lang, { month: 'short', timeZone: 'UTC' }).format(d).replace(/\.$/, '');
  return `${String(d.getUTCDate()).padStart(2, '0')} ${month.charAt(0).toUpperCase()}${month.slice(1)} ${d.getUTCFullYear()}`;
}

/**
 * The guests within the source's limits: at least one adult, up to two children per adult, nine
 * in all. A change that breaks a limit is pulled back to it: the changed count stops at what's
 * left, and fewer adults take children down with them (3 + 6, then 2 adults: 2 + 4).
 * @param {number} adults
 * @param {number} children
 * @param {string} [changed] `adults` or `children`, the count the visitor changed
 * @returns {{adults: number, children: number, maxAdults: number, maxChildren: number}}
 */
export function fitGuests(adults, children, changed) {
  let a = Math.min(MAX_GUESTS, Math.max(1, adults));
  let c = Math.max(0, children);
  if (changed === 'adults') a = Math.max(1, Math.min(a, MAX_GUESTS - c));
  c = Math.min(c, CHILDREN_PER_ADULT * a, MAX_GUESTS - a);
  a = Math.min(a, MAX_GUESTS - c);
  return {
    adults: a,
    children: c,
    maxAdults: MAX_GUESTS - c,
    maxChildren: Math.min(CHILDREN_PER_ADULT * a, MAX_GUESTS - a),
  };
}
