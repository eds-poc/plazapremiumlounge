/*
 * Google Tag Manager: the container whose ID is the page metadata `gtm-id` (e.g. GTM-N7RMGP3M, set
 * for every page in the metadata sheet). This does what Google's container snippet does, without
 * an inline script (the page's Content Security Policy only runs scripts added by its own
 * scripts): the `gtm.js` event in `window.dataLayer`, then gtm.js in the <head>, with the page's
 * nonce so the container's Custom HTML tags may run too. Google's <noscript> iframe is added at the
 * top of the <body> as well; it only counts for browsers without JavaScript, which never get
 * here, so it's there for tools that look for it.
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
 * Google's <noscript> iframe, first in the <body>.
 * @param {string} id
 */
function addNoscript(id) {
  if (document.querySelector('body > noscript[data-gtm]')) return;
  const noscript = document.createElement('noscript');
  noscript.dataset.gtm = '';
  const iframe = document.createElement('iframe');
  iframe.src = `https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(id)}`;
  iframe.height = '0';
  iframe.width = '0';
  iframe.style.display = 'none';
  iframe.style.visibility = 'hidden';
  noscript.append(iframe);
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
