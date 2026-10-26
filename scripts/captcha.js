/*
 * Captcha (hCaptcha) for the form blocks: buildForm adds one before the button with
 * `captcha: true` in the block's definition (see scripts/forms.js), and its token goes with the
 * data as `h-captcha-response`. The site key is public: it comes from the site's public
 * configuration (/config.json, `hcaptcha.siteKey`). The secret stays in the API that checks the
 * token with hCaptcha (siteverify). Without a configured key, hCaptcha's test key (no protection)
 * is used, on the local and aem.page / aem.live hosts only.
 */
import { loadScript } from './aem.js';
import { getLanguage, translate } from './i18n.js';

const TEST_SITE_KEY = '10000000-ffff-ffff-ffff-000000000001';
const TEST_HOSTS = /^(localhost|127\.0\.0\.1)$|\.aem\.(page|live)$/;
// the token's key in the data sent (hCaptcha's own field name)
export const CAPTCHA_KEY = 'h-captcha-response';
// hCaptcha's normal widget width; a narrower spot gets its compact widget
const NORMAL_WIDTH = 302;
// hCaptcha's language codes where they differ from the page's base language
const LANGUAGES = {
  'zh-CN': 'zh-CN', 'zh-HK': 'zh-TW', 'zh-TW': 'zh-TW', 'pt-BR': 'pt-BR',
};

let ready;

/**
 * The site key: the public configuration's, else the test key on the test hosts.
 * @returns {Promise<string>}
 */
function readSiteKey() {
  return fetch('/config.json')
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null)
    .then((config) => {
      const key = config?.hcaptcha?.siteKey;
      if (key) return key;
      if (TEST_HOSTS.test(window.location.hostname)) return TEST_SITE_KEY;
      throw new Error('captcha: no hCaptcha site key in the site configuration');
    });
}

/**
 * Loads hCaptcha once per page (shared by every captcha on it), in the page's language, once its
 * site key is known; after a failure the next call tries again.
 * @returns {Promise<{hcaptcha: object, sitekey: string}>}
 */
function load() {
  if (!ready) {
    const lang = getLanguage();
    const hl = LANGUAGES[lang] || lang.split('-')[0];
    const src = `https://js.hcaptcha.com/1/api.js?render=explicit&recaptchacompat=off&hl=${hl}&onload=onHcaptchaLoad`;
    ready = readSiteKey().then((sitekey) => new Promise((resolve, reject) => {
      // ready once hCaptcha calls back (its script's own load is too early to draw)
      window.onHcaptchaLoad = () => resolve({ hcaptcha: window.hcaptcha, sitekey });
      loadScript(src).catch(reject);
    }));
    ready.catch(() => {
      // loadScript skips a script already in the page, so a failed one goes before a retry
      document.head.querySelector(`script[src="${src}"]`)?.remove();
      ready = null;
    });
  }
  return ready;
}

/**
 * A captcha for a form: drawn when it comes near the screen (or the form is used). check() gives
 * its token, or shows why the send has to wait (not ticked or expired, or hCaptcha couldn't load)
 * and gives ''; a token works once, so reset() after a refused send.
 * @param {HTMLFormElement} form
 * @param {{message?: string}} [options] The authored message when the box isn't ticked
 * @returns {{element: HTMLElement, check: () => string, reset: () => void}}
 */
export function addCaptcha(form, { message } = {}) {
  const element = document.createElement('div');
  element.className = 'form-captcha';
  const widget = document.createElement('div');
  const error = document.createElement('p');
  error.className = 'form-error';
  error.setAttribute('aria-live', 'polite');
  error.hidden = true;
  element.append(widget, error);

  let widgetId = null;
  let failed = false;
  const showError = (text) => {
    error.textContent = text;
    error.hidden = !text;
    element.classList.toggle('has-error', !!text);
  };
  const draw = () => {
    if (widgetId !== null) return;
    failed = false;
    load().then(({ hcaptcha, sitekey }) => {
      if (widgetId !== null) return;
      widgetId = hcaptcha.render(widget, {
        sitekey,
        size: element.clientWidth && element.clientWidth < NORMAL_WIDTH ? 'compact' : 'normal',
        callback: () => showError(''),
      });
    }).catch(() => { failed = true; });
  };

  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    observer.disconnect();
    draw();
  }, { rootMargin: '200px' });
  observer.observe(element);
  form.addEventListener('focusin', draw, { once: true });

  return {
    element,
    check() {
      const token = widgetId !== null ? window.hcaptcha.getResponse(widgetId) : '';
      if (token) {
        showError('');
        return token;
      }
      showError(failed ? translate('formCaptchaLoadError') : message || translate('formCaptcha'));
      if (failed) draw();
      const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      element.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
      return '';
    },
    reset() {
      if (widgetId !== null) window.hcaptcha.reset(widgetId);
    },
  };
}
