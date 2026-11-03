/*
 * The site's full-page loader (the source's #spinner-overlay, styled in styles.css), for the page's
 * first load, links that leave the page, and blocks and scripts that wait for a service (e.g. the
 * cart). scripts.js offers it too, as before; modules that scripts.js loads (the cart) take it from
 * here, so they don't import scripts.js back.
 */

const LOADER_ID = 'spinner-overlay';
let loader;

/**
 * Shows the full-page loader, creating it on first use. With a modal dialog open, the loader goes
 * inside it: a modal dialog sits in the browser's top layer, above anything in the page.
 */
export function showLoader() {
  if (!loader) {
    loader = document.getElementById(LOADER_ID);
    if (!loader) {
      loader = document.createElement('div');
      loader.id = LOADER_ID;
      loader.innerHTML = '<div id="global-spinner"><img src="/icons/PPL-loading-v2.webp" width="320" height="auto" alt="Loading..."></div>';
    }
  }
  const host = [...document.querySelectorAll('dialog[open]')].pop() || document.body;
  if (loader.parentElement !== host) host.prepend(loader);
}

/**
 * Hides the full-page loader.
 */
export function hideLoader() {
  loader?.remove();
}
