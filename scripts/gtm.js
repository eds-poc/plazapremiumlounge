/*
 * Google Tag Manager: the container whose ID is the page metadata `gtm-id` (e.g. GTM-N7RMGP3M, set
 * for every page in the metadata sheet). This does what Google's container snippet does, without
 * an inline script (the page's Content Security Policy only runs scripts added by its own
 * scripts): the `gtm.js` event in `window.dataLayer`, then gtm.js in the <head>, with the page's
 * nonce so the container's Custom HTML tags may run too. Google's <noscript> iframe is added at the
 * top of the <body> as well; it only counts for browsers without JavaScript, which never get
 * here, so it's there for tools that look for it. Its iframe is text, as a browser running
 * JavaScript parses a <noscript>, so ns.html isn't loaded.
 */
import { getMetadata, loadScript } from './aem.js';

// a container ID: GTM- and letters or digits
const ID = /^GTM-[A-Z0-9]+$/;

/**
 * The page's script nonce (each page gets its own on the preview and live sites), or ''.
 * @returns {string}
 */
function pageNonce() {
  return document.querySelector('script[nonce]')?.nonce || '';
}

/**
 * Google's <noscript> iframe, first in the <body>. Its markup is the <noscript>'s text, not an
 * element: a browser running JavaScript reads a <noscript> in the page's HTML as text too, so the
 * iframe is never built and ns.html (the container for browsers without JavaScript) isn't loaded.
 * An iframe element appended here would load it, as a hidden frame on every page.
 * (textContent, not innerHTML: the page's Trusted Types policy refuses HTML strings.)
 * @param {string} id
 */
function addNoscript(id) {
  if (document.querySelector('body > noscript[data-gtm]')) return;
  const noscript = document.createElement('noscript');
  noscript.dataset.gtm = '';
  noscript.textContent = `<iframe src="https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(id)}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
  document.body.prepend(noscript);
}

/**
 * Starts Google Tag Manager on a page, when the metadata `gtm-id` is a container ID.
 */
export default function initGtm() {
  const id = getMetadata('gtm-id').trim().toUpperCase();
  if (!ID.test(id)) return;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });

  const nonce = pageNonce();
  loadScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`, {
    async: '',
    ...(nonce && { nonce }),
  }).catch(() => {
    // eslint-disable-next-line no-console
    console.warn('Google Tag Manager failed to load', id);
  });
  addNoscript(id);
}
