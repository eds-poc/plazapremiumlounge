/*
 * Analytics: the Adobe Client Data Layer (`window.adobeDataLayer`) and the Adobe Launch (Tags)
 * script, whose address is the page metadata `launch-script` (set for every page in the metadata
 * sheet, e.g. the development library on the preview sites and the production one on the live
 * site). Launch brings the data layer library itself and reads the queue pushed before it loads.
 *
 * Launch reads the LATEST pushed entry with an `event`, never a merge of earlier ones, so every
 * push carries the whole payload: the event, `web` and `_plazapremiumloungemanagementli` (page,
 * device, currency, login state and, for a logged-in member, the points and identities).
 *
 * A logged-in member's points and identities are the ones kept on login (scripts/member.js), so
 * no event waits for an API. A member without them (logged in before they were kept, or the
 * profile didn't answer then) gets events without them, and they're read once in the background
 * for the next pages.
 *
 * Other scripts send events with pushEvent(), e.g. for a link click:
 *   pushEvent('web.webInteraction.linkClicks', 'link click', {
 *     web: { webInteraction: { name: 'Book Now', type: 'other', linkClicks: { value: 1 } } },
 *   });
 */
import { getMetadata, loadScript } from './aem.js';
// eslint-disable-next-line import/no-cycle
import { getToken, isTokenValid } from './auth.js';
import { getCurrency } from './currency.js';
import { getLanguage, getSiteFolder } from './i18n.js';
import { readMember, storeMember } from './member.js';

export const PAGE_VIEW = 'web.webPageDetails.pageViews';
const BRAND = 'plaza premium lounge';
// the background read of a member's missing details, once a page
let storing;
// the page's name and site section set by a block (setPageDetails)
let pageDetails = {};
// a lounge listing's address: /en-uk/find/<region>/<country>/<city> (not /en-uk/find/lounge),
// whose page view the property-list block sends
const LISTING_PATH = /^\/[^/]+\/find\/[^/]+\/[^/]+\/[^/]+\/?$/;

/**
 * A logged-in member's kept details; when there are none, they're read in the background (once a
 * page) for the next events and pages, and this event goes without them.
 * @param {string} token A valid login token
 * @returns {object|null}
 */
function memberFor(token) {
  const member = readMember(token);
  if (!member && !storing) storing = storeMember(token);
  return member;
}

/**
 * The page's name and site section: the page metadata `page-name` and `site-section` when
 * authored, else the ones a block set (setPageDetails, e.g. the lounge listing), else from the path
 * after the language folder: the home page is "homepage" in "home", /en-uk/news/some-story is
 * "news:some-story" in "news".
 * @returns {{pageName: string, siteSection: string}}
 */
function pageInfo() {
  const folder = getSiteFolder();
  const segments = window.location.pathname.replace(/\.html$/, '').split('/').filter(Boolean)
    .map((s) => s.toLowerCase());
  if (folder && segments[0] === folder) segments.shift();
  if (segments.at(-1) === 'index') segments.pop();
  const pageName = getMetadata('page-name').trim() || pageDetails.pageName
    || segments.join(':') || 'homepage';
  const siteSection = getMetadata('site-section').trim() || pageDetails.siteSection
    || segments[0] || 'home';
  return { pageName, siteSection };
}

/**
 * Sets the page's name and site section for a page type a block knows (e.g. the lounge listing:
 * "Beijing:listing" in "listing"), for every event after it; the page's own metadata `page-name`
 * and `site-section` still win.
 * @param {{pageName?: string, siteSection?: string}} details
 */
export function setPageDetails({ pageName, siteSection } = {}) {
  pageDetails = {
    pageName: (pageName || '').trim(),
    siteSection: (siteSection || '').trim(),
  };
}

/**
 * "mweb" on a phone or tablet browser, else "desktop".
 * @returns {string}
 */
function platform() {
  const mobile = navigator.userAgentData?.mobile
    ?? /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  return mobile ? 'mweb' : 'desktop';
}

/**
 * Whether a value is a plain object (not an array).
 * @param {*} value
 * @returns {boolean}
 */
function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Merges `extra` into `target`, objects by key (an event's own properties next to the base ones).
 * @param {object} target
 * @param {object} extra
 * @returns {object} target
 */
function merge(target, extra) {
  Object.entries(extra || {}).forEach(([key, value]) => {
    if (isObject(value) && isObject(target[key])) merge(target[key], value);
    else target[key] = value;
  });
  return target;
}

/**
 * The base payload for an event: the page, device, currency and login state, and for a logged-in
 * member the points and identities.
 * @param {string} event e.g. web.webPageDetails.pageViews
 * @param {string} eventName
 * @returns {object}
 */
function basePayload(event, eventName) {
  const { pageName, siteSection } = pageInfo();
  const { origin, pathname, search } = window.location;
  const token = getToken();
  const loggedIn = Boolean(token) && isTokenValid(token);
  const member = loggedIn ? memberFor(token) : null;

  const userInfo = { loginStatus: loggedIn ? 'logged-in' : 'non-logged-in' };
  if (member?.currentPoints !== undefined) userInfo.currentPoints = member.currentPoints;

  const details = {
    eventDetails: { eventName },
    pageDetails: {
      pageName,
      pageUrl: `${origin}${pathname}${search}`,
      siteSection,
      brand: BRAND,
      language: document.documentElement.lang || getLanguage(),
    },
    deviceInfo: { platform: platform() },
    bookingInfo: { paymentCurrencyCode: getCurrency() },
    userInfo,
  };
  if (member) {
    details.identities = {
      stMemberId: member.stMemberId,
      hashedEmail: member.hashedEmail,
      hashedPhone: member.hashedPhone,
    };
  }

  const webPageDetails = { pageName };
  if (event === PAGE_VIEW) webPageDetails.pageViews = { value: 1 };
  return {
    event,
    web: { webPageDetails },
    _plazapremiumloungemanagementli: details,
  };
}

/**
 * Pushes an event to the data layer with the whole payload: the base one, plus the event's own
 * properties (merged in, e.g. `{ web: { webInteraction: {...} } }`).
 * @param {string} event The event Launch listens for, e.g. web.webPageDetails.pageViews
 * @param {string} eventName The event's name in the payload
 * @param {object} [extra] More properties for this event
 * @returns {object} the pushed payload
 */
export function pushEvent(event, eventName, extra) {
  const payload = merge(basePayload(event, eventName), extra);
  window.adobeDataLayer = window.adobeDataLayer || [];
  window.adobeDataLayer.push(payload);
  return payload;
}

/**
 * Starts analytics on a page: the page view (not on a lounge listing, where the property-list
 * block sends it), then the Launch script from the metadata `launch-script` (an https address;
 * without one, the data layer is still filled).
 */
export default function initDataLayer() {
  window.adobeDataLayer = window.adobeDataLayer || [];
  if (!LISTING_PATH.test(window.location.pathname)) pushEvent(PAGE_VIEW, 'page view');

  const src = getMetadata('launch-script').trim();
  if (!src) return;
  try {
    if (new URL(src).protocol !== 'https:') return;
  } catch {
    return;
  }
  loadScript(src, { async: '' }).catch(() => {
    // eslint-disable-next-line no-console
    console.warn('Launch script failed to load', src);
  });
}
