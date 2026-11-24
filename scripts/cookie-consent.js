/*
 * Cookie consent banner, as the source's: shown until "I agree" sets CMSCookieLevel=1000 for a
 * year. Its content is the site's /<site>/cookie-consent page. See docs/cookie-consent.md.
 */
import { loadCSS } from './aem.js';
import { getSharedPagePath } from './i18n.js';

const COOKIE = 'CMSCookieLevel=1000';
const ONE_YEAR = 365 * 24 * 60 * 60;

export default async function initCookieConsent() {
  if (document.cookie.split('; ').includes(COOKIE)) return;
  // the content and the styles load together; the banner shows once both are there
  const [resp] = await Promise.all([
    fetch(`${getSharedPagePath('cookie-consent')}.plain.html`),
    loadCSS(`${window.hlx.codeBasePath}/styles/cookie-consent.css`),
  ]);
  if (!resp.ok) return;

  const banner = document.createElement('section');
  banner.className = 'cookie-consent';
  banner.innerHTML = await resp.text();

  // the page's heading names the banner, its bold last line is the button
  const heading = banner.querySelector('h1, h2, h3, h4, h5, h6');
  if (heading) banner.setAttribute('aria-label', heading.textContent.trim());
  heading?.remove();
  const label = banner.querySelector('p:last-child > strong:only-child');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button primary';
  button.textContent = label?.textContent.trim() || 'I agree';
  label?.parentElement.remove();
  banner.append(button);

  banner.querySelectorAll('a').forEach((link) => {
    link.target = '_blank';
    link.rel = 'noopener';
  });

  button.addEventListener('click', () => {
    document.cookie = `${COOKIE}; max-age=${ONE_YEAR}; path=/; samesite=lax; secure`;
    banner.remove();
    // the focus goes to the page's content, not lost with the banner
    const main = document.querySelector('main');
    main?.setAttribute('tabindex', '-1');
    main?.focus({ preventScroll: true });
  });

  document.body.append(banner);
}
