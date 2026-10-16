/*
 * API endpoints: the API domain per environment is kept here, in one place, and each endpoint is
 * an absolute path only. Blocks call apiUrl('<name>') and add their own query parameters.
 */

// the API domain per environment; the live site uses the dev App Builder domain until a
// production one exists
const API_DOMAINS = {
  preview: 'https://236246-402whitedonkey-dev.adobeio-static.net',
  live: 'https://236246-402whitedonkey-dev.adobeio-static.net',
};

// endpoint paths, joined to the environment's API domain
const ENDPOINTS = {
  properties: '/api/v1/web/app_demo/GetAllProperties',
};

/**
 * The environment of the current page: 'preview' locally and on the preview site (*.aem.page),
 * 'live' everywhere else (*.aem.live and the production domain).
 * @param {string} [hostname]
 * @returns {'preview'|'live'}
 */
export function getEnvironment(hostname = window.location.hostname) {
  return hostname === 'localhost' || hostname.endsWith('.aem.page') ? 'preview' : 'live';
}

/**
 * The full address of an API endpoint for the current environment.
 * @param {string} name An ENDPOINTS key, e.g. 'properties'
 * @returns {URL} a new URL each call, so callers can add search parameters
 */
export function apiUrl(name) {
  const path = ENDPOINTS[name];
  if (!path?.startsWith('/')) throw new Error(`Unknown endpoint "${name}"`);
  return new URL(path, API_DOMAINS[getEnvironment()]);
}
