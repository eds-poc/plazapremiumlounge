import {
  loadHeader,
  loadFooter,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
  buildBlock,
  getMetadata,
} from './aem.js';
// eslint-disable-next-line import/no-cycle
import { installModalLinks, registerModalSections } from './modal.js';
// icons: the DA icon library first, then the code /icons folder
import { decorateIcons } from './icons.js';
import { getLanguage } from './i18n.js';
import { installVideoLinks } from './video.js';
import { checkPartnerAccess, checkSession, logout } from './auth.js';
import { STALE_EVENT, needsRead } from './cart-state.js';

if (window.trustedTypes && window.trustedTypes.createPolicy) {
  const innerTT = window.trustedTypes.createPolicy('tt-inner', {
    createHTML: (s) => s, // avoid stack overflow
  });

  window.trustedTypes.createPolicy('default', {
    createHTML: (input, type, sink) => {
      let processedInput = input;
      if (/srcdoc\s*=/i.test(processedInput)) {
        const doc = new DOMParser().parseFromString(innerTT.createHTML(processedInput), 'text/html');
        doc.querySelectorAll('iframe[srcdoc]').forEach((el) => el.removeAttribute('srcdoc'));
        processedInput = doc.body.innerHTML;
      }
      if (sink.includes('createContextualFragment') || sink.includes('Document write')) {
        const doc = new DOMParser().parseFromString(innerTT.createHTML(processedInput), 'text/html');
        doc.querySelectorAll('script').forEach((el) => el.remove());
        processedInput = doc.body.innerHTML;
      }
      return processedInput;
    },
    createScriptURL: (input) => input,
    createScript: (input) => input,
  });
}

const LOADER_ID = 'spinner-overlay';
let loader;

/**
 * Shows the full-page loader (the source's #spinner-overlay, styled in styles.css), creating it on
 * first use, for the page's first load, links that leave the page, and blocks and scripts that wait
 * for a service (e.g. the cart). With a modal dialog open, the loader goes inside it: a modal
 * dialog sits in the browser's top layer, above anything in the page.
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

/**
 * Shows the loader as soon as a link click leaves the page, and hides it again when the
 * browser restores the page from its back/forward cache.
 */
function installNavigationLoader() {
  // on window, so it runs after the document-level handlers (e.g. modal links) had their say
  window.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    const link = e.target.closest('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const url = new URL(link.href, window.location.href);
    // mailto:, tel:, javascript: etc. don't leave the page
    if (!['http:', 'https:'].includes(url.protocol)) return;
    // an anchor on the current page doesn't load a new page
    const { origin, pathname, search } = window.location;
    if (url.hash && url.origin === origin && url.pathname === pathname && url.search === search) {
      return;
    }
    showLoader();
  });
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) hideLoader();
  });
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Turns `/widgets/...` links into widget blocks.
 * @param {Element} main The container element
 */
function buildWidgetAutoBlocks(main) {
  const widgetLinks = [...main.querySelectorAll('a[href*="/widgets/"]')];
  widgetLinks.forEach((link) => {
    if (link.closest('.widget')) return;
    const newLink = link.cloneNode(true);
    const widgetBlock = buildBlock('widget', { elems: [newLink] });
    const p = link.closest('p');
    if (
      p
      && p.querySelectorAll('a').length === 1
      && p.querySelector('a') === link
      && p.textContent.trim() === link.textContent.trim()
    ) {
      p.replaceWith(widgetBlock);
    } else {
      link.replaceWith(widgetBlock);
    }
  });
}

/**
 * Adds the breadcrumb on pages with the metadata `breadcrumb` = `on` (set for a folder in the
 * metadata sheet, e.g. the offers), unless the page authors one: just before the page title, at
 * the end of the section before it (after the banner, as the source), else at the top of the
 * title's section. Only in the page's own main: fragments (the nav, the footer, modal pages) are
 * built with this too, but the page's metadata isn't theirs.
 * @param {Element} main The container element
 */
function buildBreadcrumbAutoBlock(main) {
  if (main !== document.querySelector('main')) return;
  if (!/^(on|true|yes)$/i.test(getMetadata('breadcrumb').trim()) || main.querySelector('.breadcrumb')) return;
  const heading = main.querySelector('h1, h2');
  const section = heading?.closest('main > div') || main.querySelector(':scope > div');
  if (!section) return;
  const breadcrumb = buildBlock('breadcrumb', '');
  const top = heading ? [...section.children].find((child) => child.contains(heading)) : null;
  const before = section.previousElementSibling;
  if (top && top !== section.firstElementChild) top.before(breadcrumb);
  else if (heading && before) before.append(breadcrumb);
  else section.prepend(breadcrumb);
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks(main) {
  try {
    // auto load `*/fragments/*` references
    const fragments = [...main.querySelectorAll('a[href*="/fragments/"]')].filter((f) => !f.closest('.fragment'));
    if (fragments.length > 0) {
      // eslint-disable-next-line import/no-cycle
      import('../blocks/fragment/fragment.js').then(({ loadFragment }) => {
        fragments.forEach(async (fragment) => {
          try {
            const { pathname } = new URL(fragment.href);
            const frag = await loadFragment(pathname);
            fragment.parentElement.replaceWith(...frag.children);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Fragment loading failed', error);
          }
        });
      });
    }
    buildWidgetAutoBlocks(main);
    buildBreadcrumbAutoBlock(main);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Decorates formatted links to style them as buttons.
 * @param {HTMLElement} main The main container element
 */
function decorateButtons(main) {
  main.querySelectorAll('p a[href]').forEach((a) => {
    a.title = a.title || a.textContent;
    const p = a.closest('p');
    const text = a.textContent.trim();

    // quick structural checks
    if (a.querySelector('img') || p.textContent.trim() !== text) return;

    // skip URL display links
    try {
      if (new URL(a.href).href === new URL(text, window.location).href) return;
    } catch { /* continue */ }

    // require authored formatting for buttonization
    const strong = a.closest('strong');
    const em = a.closest('em');
    if (!strong && !em) return;

    p.className = 'button-wrapper';
    a.className = 'button';
    if (strong && em) { // high-impact call-to-action
      a.classList.add('accent');
      const outer = strong.contains(em) ? strong : em;
      outer.replaceWith(a);
    } else if (strong) {
      a.classList.add('primary');
      strong.replaceWith(a);
    } else {
      a.classList.add('secondary');
      em.replaceWith(a);
    }
  });
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  // modal sections (section metadata "modal") in the page or any fragment, e.g. the nav
  registerModalSections(main);
  decorateBlocks(main);
  decorateButtons(main);
}

// the cart: what the blocks that sell announce, and the cart type each product is (the cart's code
// loads on the first one; see scripts/cart.js and scripts/mini-cart.js)
const CART_EVENTS = {
  // the homepage lounge card's Book Now
  'booking-widget:book': 'lounge',
  // a pass's Add to Cart (or Add More): its card's or its Learn more pop-up's
  'quick-buy:add-to-cart': 'pass',
  'pass-finder:add-to-cart': 'pass',
};

let reading = null;

/**
 * Reads the cart from the booking system in the background when this tab hasn't its data (a new
 * tab, its data past its 2 hours, another tab's change): the count, the buttons' labels and the
 * mini cart then follow (`cart:change`). The cart's code loads only then; one read at a time.
 */
function readCartIfNeeded() {
  if (reading || !needsRead()) return;
  reading = import('./cart.js')
    .then(({ refreshCart }) => refreshCart())
    .catch(() => { /* (read again when it's needed) */ })
    .finally(() => { reading = null; });
}

/**
 * Puts announced products into the cart (`CART_EVENTS`), and takes them out on `cart:remove`
 * (`detail.catalogueCode`, e.g. the lounge card's Remove From Cart). A cart this tab hasn't read is
 * read once the page has loaded, when the tab is shown again, and when another tab changed it.
 */
function installCart() {
  window.addEventListener('load', () => setTimeout(readCartIfNeeded, 0), { once: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') readCartIfNeeded();
  });
  document.addEventListener(STALE_EVENT, () => {
    if (document.visibilityState === 'visible') readCartIfNeeded();
  });
  Object.entries(CART_EVENTS).forEach(([name, type]) => {
    document.addEventListener(name, (e) => {
      // (as the source's, at once: the button off and the site's loader, while the cart's code
      // loads; the cart keeps them until the booking system has answered)
      const from = e.target.closest?.('button');
      if (from) {
        from.disabled = true;
        from.setAttribute('aria-disabled', 'true');
      }
      showLoader();
      // (the cart's UI takes the loader from here: loaded only after this script has run)
      // eslint-disable-next-line import/no-cycle
      import('./mini-cart.js')
        .then(({ addAndShow }) => addAndShow({ ...e.detail, type }, e.target))
        .finally(() => {
          hideLoader();
          if (!from) return;
          from.disabled = false;
          from.removeAttribute('aria-disabled');
        });
    });
  });
  document.addEventListener('cart:remove', (e) => {
    // (as adding: the button off and the loader at once)
    const from = e.target.closest?.('button');
    if (from) {
      from.disabled = true;
      from.setAttribute('aria-disabled', 'true');
    }
    showLoader();
    // eslint-disable-next-line import/no-cycle
    import('./mini-cart.js')
      .then(({ removeAndShow }) => removeAndShow(e.detail?.catalogueCode, e.target))
      .finally(() => {
        hideLoader();
        if (!from) return;
        from.disabled = false;
        from.removeAttribute('aria-disabled');
      });
  });
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  // a logged-in visitor's token: an expired or broken one logs out and goes home (nothing is
  // checked when nobody is logged in)
  checkSession();
  // a partner page without its partner's login goes to the partner's password page (auth.js)
  if (!checkPartnerAccess()) return false;
  // the header's account menu Logout (#logout): log out and go home
  document.addEventListener('header:action', (e) => {
    if (e.detail?.name === 'logout') logout();
  });
  // the page language: page metadata `language`, else the site folder (e.g. /zh-cn/ → zh-CN)
  document.documentElement.lang = getLanguage();
  decorateTemplateAndTheme();
  installModalLinks();
  // YouTube, Vimeo and video file links play in the video popup, wherever they are authored
  installVideoLinks();
  installCart();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
  return true;
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  loadHeader(doc.querySelector('body > header'));

  const main = doc.querySelector('main');
  await loadSections(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadFooter(doc.querySelector('body > footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // the leave-site popup before links to other websites in `leave-site` sections (and the
  // footer's Social column)
  import('./leave-site.js').then(({ installLeaveSitePrompt }) => installLeaveSitePrompt());
  import('./consent-check.js');
  // the back to top button, on every page
  import('./back-to-top.js').then(({ default: initBackToTop }) => initBackToTop());
  // Kwanko UniJS (the affiliate tag)
  import('./kwanko.js').then(({ default: initKwanko }) => { initKwanko(); });
  // consenTag (metadata `consentag-id`)
  import('./consentag.js').then(({ default: initConsenTag }) => initConsenTag());
  // analytics: the page view in the data layer, then the Launch script (metadata
  // `launch-script`)
  import('./datalayer.js').then(({ default: initDataLayer }) => initDataLayer());
  // Google Tag Manager (metadata `gtm-id`)
  import('./gtm.js').then(({ default: initGtm }) => initGtm());
  // GA4 ecommerce: how the visitor comes to a listing (a mega menu or search widget link click)
  import('./ecommerce.js').then(({ trackViewSource }) => trackViewSource());
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  showLoader();
  // false: a partner page is going to its password page (the loader stays up until it does)
  if (!await loadEager(document)) return;
  hideLoader();
  await loadLazy(document);
  installNavigationLoader();
  // the tags and the rest 3 seconds after the page shows (as the boilerplate), so they don't
  // compete with it
  window.setTimeout(loadDelayed, 3000);
}

loadPage();
