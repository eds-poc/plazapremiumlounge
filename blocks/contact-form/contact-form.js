import { loadScript } from '../../scripts/aem.js';
import { buildForm } from '../../scripts/forms.js';
import { getLanguage, translate } from '../../scripts/i18n.js';

/*
 * The contact us form's fields: the keys sent and the source's rules. The authoring only gives each
 * field's label, placeholder (and the dropdowns' options), required and error texts (see README).
 */
const FIELDS = {
  location: { type: 'select', key: 'location', required: true },
  typeOfEnquiry: { type: 'select', key: 'typeOfEnquiry', required: true },
  title: { type: 'select', key: 'title' },
  firstName: {
    type: 'text', key: 'firstName', required: true, settings: { 'max length': 200 },
  },
  lastName: {
    type: 'text', key: 'lastName', required: true, settings: { 'max length': 200 },
  },
  // the source's contact number: digits, +, - and /, at most 15, no country code
  contactNumber: {
    type: 'text', key: 'contactNumber', required: true, settings: { rule: 'phone', 'max length': 15 },
  },
  countryOfResidence: {
    type: 'country', key: 'countryOfResidence', required: true, settings: { 'value type': 'number' },
  },
  // the second column starts here
  email: {
    type: 'email', key: 'email', required: true, newColumn: true, settings: { 'max length': 200 },
  },
  bookingReference: { type: 'text', key: 'bookingReference', settings: { 'max length': 200 } },
  message: { type: 'textarea', key: 'message', settings: { rows: 12 } },
  subscribeNewsletter: { type: 'checkbox', key: 'subscribeNewsletter', settings: { 'value type': 'boolean' } },
  consent: {
    type: 'checkbox', key: 'consent', required: true, settings: { 'value type': 'boolean' },
  },
};

/*
 * hCaptcha (as the source contact us form). The site key is public; the Contact API checks the
 * token with the secret. For now hCaptcha's test key (it works on every domain and always passes);
 * the live key once it allows our domains (see README).
 */
const HCAPTCHA_SITE_KEY = '10000000-ffff-ffff-ffff-000000000001';
// the token's key in the data sent (hCaptcha's own field name)
const CAPTCHA_KEY = 'h-captcha-response';
// the widget's width in its normal size; narrower spots get the compact one
const CAPTCHA_WIDTH = 302;

let hcaptchaLoaded;

/**
 * Loads hCaptcha once per page (shared by every Contact Form on it), in the page's language; after
 * a failure the next call tries again.
 * @returns {Promise<object>} window.hcaptcha
 */
function loadHcaptcha() {
  if (!hcaptchaLoaded) {
    const lang = getLanguage();
    const hl = /^zh-(hk|tw)/i.test(lang) ? 'zh-TW' : lang.split('-')[0];
    const src = `https://js.hcaptcha.com/1/api.js?render=explicit&recaptchacompat=off&hl=${hl}&onload=onHcaptchaLoad`;
    // ready once hCaptcha calls back (its script's own load is too early to draw)
    hcaptchaLoaded = new Promise((resolve, reject) => {
      window.onHcaptchaLoad = () => resolve(window.hcaptcha);
      loadScript(src).catch(reject);
    });
    hcaptchaLoaded.catch(() => {
      // loadScript skips a script already in the page, so the failed one goes before a retry
      document.head.querySelector(`script[src="${src}"]`)?.remove();
      hcaptchaLoaded = null;
    });
  }
  return hcaptchaLoaded;
}

/**
 * Adds the captcha before the form's button: the widget is drawn when the form comes near the
 * screen (or is used); a send waits for its tick, and its token goes with the data. Each token
 * works once, so a refused send resets it.
 * @param {HTMLFormElement} form
 * @param {string} [message] The authored message when the box isn't ticked
 */
function addCaptcha(form, message) {
  const captcha = document.createElement('div');
  captcha.className = 'contact-form-captcha';
  const widget = document.createElement('div');
  const error = document.createElement('p');
  error.className = 'form-error';
  error.setAttribute('aria-live', 'polite');
  error.hidden = true;
  captcha.append(widget, error);
  form.querySelector('.form-submit')?.before(captcha);

  let widgetId = null;
  let failed = false;
  const showError = (text) => {
    error.textContent = text;
    error.hidden = !text;
    captcha.classList.toggle('has-error', !!text);
  };
  const draw = () => {
    if (widgetId !== null) return;
    failed = false;
    loadHcaptcha().then((hcaptcha) => {
      if (widgetId !== null) return;
      widgetId = hcaptcha.render(widget, {
        sitekey: HCAPTCHA_SITE_KEY,
        size: captcha.clientWidth && captcha.clientWidth < CAPTCHA_WIDTH ? 'compact' : 'normal',
        callback: () => showError(''),
      });
    }).catch(() => { failed = true; });
  };

  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    observer.disconnect();
    draw();
  }, { rootMargin: '200px' });
  observer.observe(captcha);
  form.addEventListener('focusin', draw, { once: true });

  // the fields are checked; the send waits for the tick (an expired one is empty again)
  form.addEventListener('forms:submit', (e) => {
    const token = widgetId !== null ? window.hcaptcha.getResponse(widgetId) : '';
    if (token) {
      e.detail.values[CAPTCHA_KEY] = token;
      showError('');
      return;
    }
    e.preventDefault();
    showError(failed ? translate('formCaptchaLoadError') : message || translate('formCaptcha'));
    if (failed) draw();
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    captcha.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
  });
  form.addEventListener('forms:error', () => {
    if (widgetId !== null) window.hcaptcha.reset(widgetId);
  });
}

/**
 * Decorates the Contact Form block: the contact us form (the source /en-uk/contact-us). One
 * authored row per field (Field | Label | Placeholder | Required | Error), one-cell rows as text,
 * and the rows submit / success / error, and captcha (its Error cell: the message when the box
 * isn't ticked). Two columns from 768px (Email Address starts the second), an hCaptcha before the
 * button, sent to the contact endpoint.
 * @param {Element} block The Contact Form block element
 */
export default function decorate(block) {
  const captchaRow = [...block.children]
    .find((row) => row.children[0]?.textContent.trim() === 'captcha');
  const captchaMessage = captchaRow?.children[4]?.textContent.trim();
  captchaRow?.remove();
  const { form } = buildForm(block, {
    fields: FIELDS,
    action: 'contact',
    submit: { classes: ['secondary', 'large', 'full-width'] },
  });
  block.replaceChildren(form);
  addCaptcha(form, captchaMessage);
}
