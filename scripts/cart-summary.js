/*
 * How the cart's lines and totals read, as the source's cart and checkout show them, shared by the
 * mini cart (mini-cart.js) and the Checkout block: amounts ("HKD 1,755.00"), the booking date
 * ("02-Nov-2026", "2026年11月02日"), the guests ("2 Adult(s) 1 Child(ren)") and a lounge line's
 * details (Date, Time, Guests, Services).
 */
import { getLanguage, translate } from './i18n.js';

// the source's amounts, in every language: "HKD 1,755.00"
const AMOUNT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * An amount as the source shows it: "GBP 44.10", "HKD 1,755.00".
 * @param {number} amount
 * @param {string} currency
 * @returns {string}
 */
export function formatAmount(amount, currency) {
  return Number.isFinite(amount) ? `${currency ? `${currency} ` : ''}${AMOUNT.format(amount)}` : '—';
}

/**
 * A booking date as the source's cart shows it: "02-Nov-2026", "02-nov-2026", "2026年11月02日".
 * @param {string} start "YYYY-MM-DD HH:mm:ss"
 * @returns {string}
 */
export function formatCartDate(start) {
  const [y, m, d] = start.slice(0, 10).split('-');
  if (!d) return '';
  const lang = getLanguage();
  if (/^(zh|ja)/.test(lang)) return `${y}年${m}月${d}日`;
  const month = new Intl.DateTimeFormat(lang, { month: 'short', timeZone: 'UTC' })
    .format(new Date(`${y}-${m}-${d}T00:00:00Z`)).replace(/\.$/, '');
  return `${d}-${/^pt/.test(lang) ? month.toLowerCase() : month}-${y}`;
}

/**
 * The guests' two values, as the source's cart: "2 Adult(s)", then "1 Child(ren)" when there are
 * children (the mini cart puts a line between them from 768px, as the source's b+b).
 * @param {{adults: number, children: number}} line
 * @returns {string[]}
 */
export function guestParts(line) {
  const parts = [`${line.adults} ${translate('propertyAdults')}`];
  if (line.children > 0) parts.push(`${line.children} ${translate('propertyChildren')}`);
  return parts;
}

/**
 * The guests as the source's cart: "2 Adult(s) 1 Child(ren)" (its two values side by side).
 * @param {{adults: number, children: number}} line
 * @returns {string}
 */
export function formatGuests(line) {
  return guestParts(line).join(' ');
}

/**
 * A lounge line's details, in the source's order: Date, Time ("1500", followed by "hrs"), Guests,
 * Services; the ones without a value left out.
 * @param {Object} line A cart line (cart.js)
 * The guests also come as their `parts` ("2 Adult(s)", "1 Child(ren)").
 * @returns {{label: string, value: string, unit?: string, parts?: string[]}[]}
 */
export function loungeDetails(line) {
  return [
    { label: translate('cartDate'), value: formatCartDate(line.start) },
    { label: translate('cartTime'), value: line.start.slice(11, 16).replace(':', ''), unit: translate('cartHours') },
    { label: translate('cartGuests'), value: formatGuests(line), parts: guestParts(line) },
    { label: translate('cartServices'), value: line.product },
  ].filter((detail) => detail.value);
}
