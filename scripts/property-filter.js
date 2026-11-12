/*
 * Property filter: the properties for lists of regions, countries, airports and property codes,
 * from the property filter service (getFilteredProperties). The lists are the request's payload,
 * and its answer is used as it is (the service answers every property of the regions; choosing
 * among them is left to the caller, e.g. by the visitor's region, country and city). One request
 * per set of lists and language, shared by every caller on the page.
 */
import apiUrl from './endpoints.js';
import { fetchJson, getApiLanguage, readProperty } from './properties.js';

// the service answers a region's properties at once: about 460KB in 5-8s
const TIMEOUT_MS = 20000;

// the payload's lists, in its order
const LISTS = ['region', 'country', 'iataCode', 'propertyCode'];

// the answers, by payload and language (a failed one is forgotten, so the next call asks again)
const answers = new Map();

const codes = (value) => [...new Set((Array.isArray(value) ? value : String(value ?? '').split(','))
  .map((code) => String(code ?? '').trim().toUpperCase())
  .filter(Boolean))];

/**
 * The filters as the service takes them: all four lists, in the payload's order, each list's
 * codes trimmed, in capitals and once each (an empty list for one without codes).
 * @param {{region?: string[]|string, country?: string[]|string, iataCode?: string[]|string,
 *   propertyCode?: string[]|string}} filters Lists, or comma-separated codes
 * @returns {{region: string[], country: string[], iataCode: string[], propertyCode: string[]}}
 */
export function readFilters(filters = {}) {
  return Object.fromEntries(LISTS.map((name) => [name, codes(filters[name])]));
}

/**
 * Whether the filters have any code (a payload without one asks for nothing).
 * @param {Object<string, string[]>} filters As readFilters gives them
 * @returns {boolean}
 */
export function hasFilters(filters) {
  return LISTS.some((name) => filters[name]?.length);
}

/**
 * The properties of the service's answer: its regions' countries' properties (a plain list or
 * `{ data }` is read too).
 * @param {*} json
 * @returns {Object[]}
 */
function readAnswer(json) {
  const groups = Array.isArray(json) ? json : json?.data;
  if (!Array.isArray(groups)) throw Object.assign(new Error('not a list of regions'), { kind: 'answer' });
  return groups.flatMap((group) => {
    if (Array.isArray(group?.country)) {
      return group.country.flatMap((country) => (Array.isArray(country?.properties)
        ? country.properties.map((item) => ({ regionCode: group.regionCode, ...item }))
        : []));
    }
    // a property already
    return group?.propertyCode ? [group] : [];
  });
}

/**
 * What went wrong, for the caller's message: `timeout`, `network`, `http` (an error status),
 * `api` (the service's error answer) or `answer` (not the expected answer).
 * @param {Error} error
 * @param {boolean} timedOut
 * @returns {Error}
 */
function describeError(error, timedOut) {
  if (error.kind) return error;
  let kind = 'answer';
  if (timedOut) kind = 'timeout';
  else if (error.service) kind = 'api';
  else if (error.status > 0) kind = 'http';
  else if (error.name === 'AbortError' || error.name === 'TypeError') kind = 'network';
  return Object.assign(error, { kind });
}

/**
 * The service's properties for the filters, asked once per page (per filters and language).
 * @param {Object<string, string[]>} payload
 * @returns {Promise<Object[]>}
 */
function load(payload) {
  const language = getApiLanguage();
  const key = `${language} ${JSON.stringify(payload)}`;
  if (!answers.has(key)) {
    const url = apiUrl('filteredProperties');
    url.searchParams.set('languageCode', language);
    const started = Date.now();
    const answer = fetchJson(url, TIMEOUT_MS, { body: payload })
      .then(readAnswer)
      .catch((error) => {
        answers.delete(key);
        throw describeError(error, Date.now() - started >= TIMEOUT_MS);
      });
    answers.set(key, answer);
  }
  return answers.get(key);
}

/**
 * The service's properties for the filters (its whole answer), as cards read them
 * (scripts/properties.js readProperty: active lounges and passes), each once, with its place as
 * the service gives it, `region` (its code), `countryName` and `cityCode` (the same for a city's
 * airports: GBLHR for Heathrow and Gatwick).
 * Rejects with an Error whose `kind` says what went wrong (see describeError).
 * @param {{region?: string[]|string, country?: string[]|string, iataCode?: string[]|string,
 *   propertyCode?: string[]|string}} filters
 * @returns {Promise<{properties: Object[]}>}
 */
export async function fetchFilteredProperties(filters) {
  const items = await load(readFilters(filters));
  const seen = new Set();
  const properties = items
    .map((item) => {
      const property = readProperty(item);
      if (!property || seen.has(property.code)) return null;
      seen.add(property.code);
      return {
        ...property,
        region: String(item.regionCode ?? '').trim().toUpperCase(),
        countryName: String(item.countryName ?? '').trim(),
        cityCode: String(item.cityCode ?? '').trim().toUpperCase(),
      };
    })
    .filter(Boolean);
  return { properties };
}
