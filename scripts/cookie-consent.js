/*
 * Cookie consent banner, as the source's: shown until "I agree" sets CMSCookieLevel=1000 for a
 * year. Its content is the locale's fragment /fragments/cookie-consent/<site> (a Cookie Consent
 * table); its styles are in blocks/header/header.css. See docs/cookie-consent.md.
 */
import { DEFAULT_SITE, getSiteFolder } from './i18n.js';

const COOKIE = 'CMSCookieLevel=1000';
const ONE_YEAR = 365 * 24 * 60 * 60;

/**
 * The fragment's fields by row name, lowercase letters only ("Privacy Link URL": privacylinkurl).
 * @param {Document} doc
 * @returns {Object<string, Element>} Each field's value cell
 */
function readFields(doc) {
  return Object.fromEntries([...doc.querySelectorAll('.cookie-consent > div')].map((row) => [
    row.children[0]?.textContent.toLowerCase().replace(/[^a-z]/g, ''), row.children[1],
  ]));
}

export default async function initCookieConsent() {
  if (document.cookie.split('; ').includes(COOKIE)) return;
  const resp = await fetch(`/fragments/cookie-consent/${getSiteFolder() || DEFAULT_SITE}.plain.html`);
  if (!resp.ok) return;
  const fields = readFields(new DOMParser().parseFromString(await resp.text(), 'text/html'));
  if (!fields.message) return;
  const text = (name) => fields[name]?.textContent.trim() || '';

  const banner = document.createElement('section');
  banner.className = 'cookie-consent';
  if (text('title')) banner.setAttribute('aria-label', text('title'));

  // the message's paragraphs, the privacy link at {link} (else at its end)
  const message = document.createElement('div');
  message.append(...fields.message.querySelectorAll('p'));
  const href = fields.privacylinkurl?.querySelector('a')?.getAttribute('href') || text('privacylinkurl');
  if (href) {
    const link = document.createElement('a');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = text('privacylinktext') || href;
    const walker = document.createTreeWalker(message, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node && !node.textContent.includes('{link}')) node = walker.nextNode();
    if (node) {
      const [before, ...after] = node.textContent.split('{link}');
      node.replaceWith(before, link, after.join(''));
    } else {
      message.lastElementChild?.append(' ', link);
    }
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button primary';
  button.textContent = text('buttonlabel') || 'I agree';
  button.addEventListener('click', () => {
    document.cookie = `${COOKIE}; max-age=${ONE_YEAR}; path=/; samesite=lax; secure`;
    banner.remove();
    // the focus goes to the page's content, not lost with the banner
    const main = document.querySelector('main');
    main?.setAttribute('tabindex', '-1');
    main?.focus({ preventScroll: true });
  });

  banner.append(message, button);
  document.body.append(banner);
}
