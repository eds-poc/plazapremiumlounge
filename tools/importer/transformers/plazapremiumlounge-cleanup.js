/* eslint-disable */
/* global WebImporter */

/**
 * Cleanup transformer for plazapremiumlounge.com.
 *
 * beforeTransform: strips site chrome, overlays, widgets and trackers so they
 * cannot be matched by block parsers or leak into the imported document.
 * afterTransform: converts the pass-list headings (h3 > a[id]) into plain h2
 * headings and drops leftover non-authorable nodes. Runs after the parsers, so
 * the directory parser selector `.contentWrapper > div > h3 + div` still
 * matches the untouched h3 during parsing.
 */

// Site chrome, overlays and widgets (selectors taken from the captured DOM).
const CHROME_SELECTORS = [
  // header / navigation (desktop + mobile menus)
  '.main-navigation',
  '.wsmobileheader',
  '.wsmainfull',
  '.mobile-booknow-link',
  // footer, incl. ppl-group partner brand strip and the "New Footer" area
  'footer',
  '.ft-link-wrapper',
  '.ppl-group-wrapper',
  '.footer-end',
  // newsletter sign-up
  'section.newsletter-wrapper',
  // cookie consent
  '#tracking-consent-banner',
  '.consent',
  // cart / booking / account modals and overlays
  '#cartmodal',
  '.modal',
  '.bw-addon-upsell-modal',
  '[class*="bw-addon-upsell-modal"]',
  '.sm-cart-wrapper',
  '.bookingWidget-wrapper',
  '.mobileBooking-wrapper',
  '#loungeLocationsPanel',
  '.lounge-locations-overlay',
  '#ui-datepicker-div',
  // misc non-authorable UI
  '#spinner-overlay',
  '#back-top',
  'input#langcurrencyredirect',
  // tracking containers / beacons
  '[id^="_trackers-"]',
  '[id^="batBeacon"]',
  // scripts, styles, frames
  'script',
  'style',
  'noscript',
  'link',
  'iframe',
];

const TRACKING_IMG_PATTERN = /(bat\.bing\.com|doubleclick\.net|facebook\.com\/tr|google-analytics\.com|googletagmanager\.com|googleadservices\.com|analytics\.|pixel)/i;

const TRACKING_ATTRS = [
  'onclick',
  'onload',
  'onerror',
  'data-gtm',
  'data-ga',
  'data-track',
  'data-tracking',
  'data-analytics',
];

function removeAll(root, selectors) {
  selectors.forEach((sel) => {
    try {
      root.querySelectorAll(sel).forEach((el) => el.remove());
    } catch (e) {
      // unsupported selector in this runtime; ignore
    }
  });
}

function removeChatWidget(document) {
  // Messaging/chat launcher lives in a body-level div wrapping iframe#launcher.
  document.querySelectorAll('iframe#launcher, iframe[title*="messaging" i]').forEach((frame) => {
    let node = frame;
    while (node.parentElement && node.parentElement !== document.body) {
      node = node.parentElement;
    }
    node.remove();
  });
}

function removeTrackingPixels(root) {
  root.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') || '';
    const w = img.getAttribute('width');
    const h = img.getAttribute('height');
    if (TRACKING_IMG_PATTERN.test(src) || (w === '1' && h === '1')) {
      img.remove();
    }
  });
}

function stripTrackingAttributes(root) {
  root.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (TRACKING_ATTRS.some((t) => name === t || name.startsWith(`${t}-`))) {
        el.removeAttribute(attr.name);
      }
    });
  });
}

/**
 * Pass-list headings: <h3><a id="..">Name</a>(<a>&nbsp;Eligible Locations</a>)</h3>
 * become <h2>Name Eligible Locations</h2> with no anchors left inside.
 */
function convertPassHeadings(document) {
  const scope = document.querySelector('.contentWrapper') || document.body || document;
  scope.querySelectorAll('h3').forEach((h3) => {
    const anchors = [...h3.querySelectorAll('a')];
    if (!anchors.some((a) => a.hasAttribute('id'))) return;
    const text = anchors
      .map((a) => a.textContent)
      .join(' ')
      .replace(/[\s ]+/g, ' ')
      .trim();
    if (!text) return;
    const h2 = document.createElement('h2');
    h2.textContent = text;
    h3.replaceWith(h2);
  });
}

export default function transform(hookName, element, payload) {
  const document = (payload && payload.document) || element.ownerDocument;

  if (hookName === 'beforeTransform') {
    removeAll(document, CHROME_SELECTORS);
    removeChatWidget(document);
    removeTrackingPixels(document);
    stripTrackingAttributes(document);
  }

  if (hookName === 'afterTransform') {
    // Parsers have run; the directory blocks are in place, so the h3 headings
    // can be renamed without affecting `.contentWrapper > div > h3 + div`.
    convertPassHeadings(document);
    // Final sweep for anything re-introduced or missed.
    removeAll(document, ['script', 'style', 'noscript', 'link', 'iframe']);
    removeTrackingPixels(document);
  }
}
