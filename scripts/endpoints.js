/*
 * API endpoints: the API domain is kept here, in one place (the same for the preview and live
 * sites), and each endpoint is an absolute path only. Blocks call apiUrl('<name>') and add their
 * own query parameters.
 */

const API_DOMAIN = 'https://236246-402whitedonkey-dev.adobeio-static.net';

// endpoint paths, joined to the API domain
const ENDPOINTS = {
  properties: '/api/v1/web/app_demo/GetAllProperties',
  // countries with their phone codes, for the forms' country and phone fields
  countries: '/api/v1/web/app_demo/GetCountries',
  // the Signup Form submit (account registration)
  signUp: '/api/v1/web/app_demo/Register',
  // the Newsletter submit: a placeholder path until the newsletter API exists
  newsletter: '/api/v1/web/app_demo/Newsletter',
  // the Contact Form submit: a placeholder path until the contact API exists
  contact: '/api/v1/web/app_demo/Contact',
  // the login modal's submit (POST, JSON: username, password); answers with a JWT
  login: '/api/v1/web/app_demo/Login',
  // the forgot password modal's submit (POST, JSON: lastName, email)
  forgotPassword: '/api/v1/web/app_demo/ForgotPassword',
  // the logged-in member's profile (GET, Authorization: Bearer <jwt>)
  getProfile: '/api/v1/web/app_demo/GetProfile',
  propertyDetail: '/api/v1/web/app_demo/GetPropertyDetail',
  // a lounge's bookable services and their products for a start time (POST, JSON body)
  propertyServices: '/api/v1/web/app_demo/GetServices',
  // the price of a service's product for a start time and guests (POST, JSON body)
  propertyPrice: '/api/v1/web/app_demo/GetPrice',
  // a pass (product) with its prices, for a product code and currency (GET)
  productPasses: '/api/v1/web/app_demo/GetProductPasses',
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
