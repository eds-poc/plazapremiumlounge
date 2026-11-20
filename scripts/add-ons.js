/*
 * A lounge booking's add-ons (Book Your Visit's Additional Services): what can be added to the
 * cart's lounge visit, read from the add-ons service, ready to show.
 *
 * The source is in one place, `requestAddOns`: for now the client API's sample answer
 * (blocks/add-ons/sample-add-ons.json; its API needs a client key that can't be in the site), later
 * the add-ons API with the same request. The request is built from the cart's lounge line
 * (`addOnsRequest`), as the client API's: { serviceCode, productCode, iataCode, currencyCode,
 * propertyCode, startDateTime, promocode }.
 *
 * The answer: `{ addons: [...], upsell: [...] }`. Each add-on has its prices, one per lounge (its
 * catalogue code names the lounge: PRD3772-Add-On-PRPRTY816-…); the one shown is the booked
 * lounge's when there is one, else the first available, as the source's page (`pickPrice`).
 * Upgrades (`upsell`) aren't shown yet.
 */

// the client API's sample answer, until the add-ons API is there
const SAMPLE = `${window.hlx?.codeBasePath || ''}/blocks/add-ons/sample-add-ons.json`;
const TIMEOUT_MS = 20000;

/**
 * The text a field holds, trimmed.
 * @param {*} value
 * @returns {string}
 */
function text(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * The add-ons request for the cart's lounge line, as the client API takes it.
 * @param {Object} line The cart's lounge line (scripts/cart.js readLine)
 * @param {{currency?: string, promoCode?: string}} cart
 * @returns {{serviceCode: string, productCode: string, iataCode: string, currencyCode: string,
 *   propertyCode: string, startDateTime: string, promocode: string}}
 */
export function addOnsRequest(line, cart = {}) {
  return {
    serviceCode: '',
    productCode: text(line?.productCode),
    iataCode: text(line?.iataCode),
    currencyCode: text(cart.currency),
    propertyCode: text(line?.propertyCode),
    startDateTime: text(line?.start),
    promocode: text(cart.promoCode),
  };
}

/**
 * The add-ons service's answer for a request. Now the sample answer (the request isn't sent);
 * with the add-ons API, a POST of the request as JSON to its endpoint (scripts/endpoints.js).
 * @param {Object} request See addOnsRequest
 * @returns {Promise<Object>}
 */
async function requestAddOns(request) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // (the request is what the add-ons API will take; the sample is the same for every request)
    if (!request) throw new Error('no request');
    const resp = await fetch(SAMPLE, { signal: controller.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The price an add-on shows, as the source's page: the booked lounge's (its property code in the
 * catalogue code) when it has one in stock, else the first one in stock.
 * @param {Object[]} prices The add-on's prices
 * @param {string} propertyCode The booked lounge's
 * @returns {Object|undefined}
 */
export function pickPrice(prices, propertyCode) {
  const usable = (prices || []).filter((p) => text(p?.catalogueCode)
    && Number.isFinite(Number(p?.totalPrice))
    && p?.isInventoryAvailable !== false
    && (p?.availableInventory === undefined || Number(p.availableInventory) > 0));
  const own = propertyCode && usable.find((p) => text(p.catalogueCode).includes(`-${propertyCode}-`));
  return own || usable[0];
}

/**
 * An image's address as a browser takes it (the service's paths can hold spaces).
 * @param {string} path
 * @returns {string}
 */
function imageUrl(path) {
  const value = text(path);
  if (!/^https?:\/\//i.test(value)) return '';
  try {
    return encodeURI(decodeURI(value));
  } catch {
    return encodeURI(value);
  }
}

/**
 * One add-on as the page shows it, or null without an available price.
 * @param {Object} item The service's add-on
 * @param {string} propertyCode The booked lounge's
 * @returns {Object|null}
 */
export function readAddOn(item, propertyCode) {
  if (item?.availability === false) return null;
  const price = pickPrice(item?.prices, propertyCode);
  if (!price) return null;
  const amount = Number(price.totalPrice);
  const inventory = Number(price.availableInventory);
  const max = Number(item.masNoOfProductsAllowed) || 1;
  return {
    productCode: text(item.productCode),
    name: text(item.productDisplayName) || text(item.productName),
    description: String(item.shortProductDescription || item.productDescription || '').trim(),
    image: imageUrl(item.images?.find((i) => text(i?.path))?.path),
    serviceCode: text(item.serviceCode),
    serviceName: text(item.serviceDisplayName) || text(item.serviceName),
    sequence: Number.isFinite(Number(item.serviceSequence))
      ? Number(item.serviceSequence) : Infinity,
    // "Per Unit" (a quantity) or "Per Person"
    perPerson: /person/i.test(text(item.basedOn) || text(item.serviceType)),
    quantityLabel: text(item.quantityLabel),
    // (at most what the product allows and what's in stock)
    max: Number.isFinite(inventory) && inventory > 0 ? Math.min(max, inventory) : max,
    catalogueCode: text(price.catalogueCode),
    price: amount,
    currency: text(price.baseRate?.[0]?.currency).toUpperCase(),
    flightRequired: item.isFlightNumberMandatory === true,
    loginRequired: item.isStLoginMandatory === true,
  };
}

/**
 * The add-ons for the cart's lounge visit, ready to show (in the service's order of services).
 * Rejects when the service can't be read.
 * @param {Object} request See addOnsRequest
 * @returns {Promise<Object[]>}
 */
export async function fetchAddOns(request) {
  const answer = await requestAddOns(request);
  const items = Array.isArray(answer?.addons) ? answer.addons : [];
  return items
    .map((item, order) => ({ order, addOn: readAddOn(item, request.propertyCode) }))
    .filter(({ addOn }) => addOn)
    .sort((a, b) => (a.addOn.sequence - b.addOn.sequence) || (a.order - b.order))
    .map(({ addOn }) => addOn);
}
