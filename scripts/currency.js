/*
 * Currency: the visitor's currency, as the source does it: the one they applied (saved in this
 * browser), else one from their location. The location comes from the device time zone (no
 * network call), e.g. Europe/London → GBP; anywhere else, or if unknown, USD.
 */

const STORAGE_KEY = 'ppl-currency';
const FALLBACK = 'USD';
export const CURRENCY_EVENT = 'currency:change';

// time zones (exact, or by prefix ending in "/") → the source's 24 currencies
const ZONES = [
  ['Europe/London', 'GBP'], ['Europe/Belfast', 'GBP'], ['Europe/Jersey', 'GBP'], ['Europe/Guernsey', 'GBP'], ['Europe/Isle_of_Man', 'GBP'],
  ['Europe/Copenhagen', 'DKK'], ['Europe/Stockholm', 'SEK'], ['Europe/Istanbul', 'TRY'], ['Asia/Istanbul', 'TRY'],
  ['Europe/Oslo', 'EUR'], ['Europe/Zurich', 'EUR'], ['Europe/Moscow', 'USD'], ['Europe/', 'EUR'], ['Atlantic/Madeira', 'EUR'], ['Atlantic/Azores', 'EUR'], ['Atlantic/Canary', 'EUR'],
  ['Asia/Dubai', 'AED'], ['Asia/Riyadh', 'SAR'], ['Asia/Muscat', 'OMR'],
  ['Asia/Kolkata', 'INR'], ['Asia/Calcutta', 'INR'],
  ['Asia/Hong_Kong', 'HKD'], ['Asia/Macau', 'MOP'], ['Asia/Macao', 'MOP'], ['Asia/Taipei', 'TWD'],
  ['Asia/Shanghai', 'CNY'], ['Asia/Chongqing', 'CNY'], ['Asia/Harbin', 'CNY'], ['Asia/Urumqi', 'CNY'], ['PRC', 'CNY'],
  ['Asia/Tokyo', 'JPY'], ['Japan', 'JPY'], ['Asia/Singapore', 'SGD'], ['Singapore', 'SGD'],
  ['Asia/Kuala_Lumpur', 'MYR'], ['Asia/Kuching', 'MYR'], ['Asia/Manila', 'PHP'], ['Asia/Bangkok', 'THB'],
  ['Asia/Jakarta', 'IDR'], ['Asia/Pontianak', 'IDR'], ['Asia/Makassar', 'IDR'], ['Asia/Jayapura', 'IDR'],
  ['Australia/', 'AUD'], ['Africa/Johannesburg', 'ZAR'],
  ['America/Sao_Paulo', 'BRL'], ['America/Bahia', 'BRL'], ['America/Fortaleza', 'BRL'], ['America/Recife', 'BRL'], ['America/Manaus', 'BRL'], ['America/Belem', 'BRL'], ['America/Cuiaba', 'BRL'], ['America/Campo_Grande', 'BRL'], ['America/Porto_Velho', 'BRL'], ['America/Boa_Vista', 'BRL'], ['America/Rio_Branco', 'BRL'], ['America/Maceio', 'BRL'], ['America/Araguaina', 'BRL'], ['America/Santarem', 'BRL'], ['America/Noronha', 'BRL'], ['Brazil/', 'BRL'],
  ['America/Toronto', 'CAD'], ['America/Vancouver', 'CAD'], ['America/Edmonton', 'CAD'], ['America/Winnipeg', 'CAD'], ['America/Halifax', 'CAD'], ['America/St_Johns', 'CAD'], ['America/Regina', 'CAD'], ['America/Moncton', 'CAD'], ['America/Montreal', 'CAD'], ['Canada/', 'CAD'],
];

/**
 * The currency for the visitor's location (device time zone).
 * @returns {string}
 */
export function locationCurrency() {
  let zone = '';
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch { /* unknown */ }
  const hit = ZONES.find(([key]) => (key.endsWith('/') ? zone.startsWith(key) : zone === key));
  return hit ? hit[1] : FALLBACK;
}

/**
 * The visitor's currency: the one they applied, else the one for their location.
 * @returns {string}
 */
export function getCurrency() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved;
  } catch { /* storage blocked */ }
  return locationCurrency();
}

/**
 * Saves the visitor's currency and tells the page (e.g. the header label updates).
 * @param {string} code
 */
export function setCurrency(code) {
  if (!code) return;
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch { /* storage blocked: still applies to this page */ }
  document.dispatchEvent(new CustomEvent(CURRENCY_EVENT, { detail: { currency: code } }));
}
