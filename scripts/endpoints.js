/*
 * API endpoints: the API domain is kept here, in one place (the same for the preview and live
 * sites), and each endpoint is an absolute path only. Blocks call apiUrl('<name>') and add their
 * own query parameters.
 */

const API_DOMAIN = 'https://236246-402whitedonkey-dev.adobeio-static.net';

// endpoint paths, joined to the API domain
const ENDPOINTS = {
  properties: '/api/v1/web/app_demo/GetAllProperties',
  // countries with their phone codes, for the Custom Form country and phone fields
  countries: '/api/v1/web/app_demo/GetCountries',
  // the Custom Form sign up submit (account registration)
  signUp: '/api/v1/web/app_demo/Register',
  propertyDetail: '/api/v1/web/app_demo/GetPropertyDetail',
  // a lounge's bookable services and their products for a start time (POST, JSON body)
  propertyServices: '/api/v1/web/app_demo/GetServices',
  // the price of a service's product for a start time and guests (POST, JSON body)
  propertyPrice: '/api/v1/web/app_demo/GetPrice',
};

/**
 * The full address of an API endpoint.
 * @param {string} name An ENDPOINTS key, e.g. 'properties'
 * @returns {URL} a new URL each call, so callers can add search parameters
 */
export default function apiUrl(name) {
  const path = ENDPOINTS[name];
  if (!path?.startsWith('/')) throw new Error(`Unknown endpoint "${name}"`);
  return new URL(path, API_DOMAIN);
}
