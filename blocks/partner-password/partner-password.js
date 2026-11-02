/*
 * Partner Password: a partner's password page (e.g. /en-uk/travelwise). Partner pages (metadata
 * `partner-member-name`) send visitors here without a login (scripts/auth.js checkPartnerAccess).
 * An image, the label, the password field, the button and a message line. Every text is authored,
 * a row of the block's table each (see TEXTS and the README).
 *
 * Partner login:
 * - The partner: the authored Partner row, else the address's `?partner=`, else the page's name
 *   (/en-uk/travelwise → travelwise, the password page the partner pages go to by default).
 * - { partnername, password } goes to the PartnerLogin API; the login must succeed, a partner
 *   named in the answer must be this one, and its token must be a signed, unexpired JWT for it.
 * - The login is stored for the partner's pages (scripts/auth.js setPartnerToken), then the visitor
 *   goes to the `?returnUrl=` page on this site, else the authored Partner page, else the language
 *   site's home page; otherwise the form shows a message.
 * - `?reason=expired` and `?reason=logout` show their authored notice.
 * No data is logged.
 */
import {
  decodeJwt, isPartnerTokenValid, setPartnerToken, toPartnerName,
} from '../../scripts/auth.js';
import apiUrl from '../../scripts/endpoints.js';
import { DEFAULT_SITE, getSiteFolder, translate } from '../../scripts/i18n.js';
import { attachValidation, buildField, validateForm } from '../../scripts/forms.js';

const PARTNER_PARAM = 'partner';
const RETURN_PARAM = 'returnUrl';
const REASON_PARAM = 'reason';
// the authored texts: the block's name for each, and its row's name (names ignore capitals and
// spaces). Without its row, a text isn't shown, except where the API or the shared form texts
// have one (scripts/i18n.js).
const TEXTS = {
  label: 'Label',
  button: 'Button',
  required: 'Required message',
  tooLong: 'Max length message',
  invalid: 'Invalid message',
  access: 'Access message',
  error: 'Error message',
  network: 'Network message',
  expired: 'Expired message',
  logout: 'Logout message',
};
// the settings rows (not texts)
const SETTINGS = { partner: 'Partner', partnerPage: 'Partner page', maxLength: 'Max length' };
// the `?reason=` notices (the partner page's session ended)
const REASONS = ['expired', 'logout'];

/**
 * Creates an element with an optional class name.
 * @param {string} tag
 * @param {string} [className]
 * @returns {HTMLElement}
 */
function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

/**
 * Authored text, trimmed, its runs of spaces made one.
 * @param {*} value
 * @returns {string}
 */
function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * A row name as compared: lower case, without spaces.
 * @param {string} value
 * @returns {string}
 */
function toRowKey(value) {
  return clean(value).toLowerCase().replace(/\s/g, '');
}

/**
 * A page on this site from an address, as a path with its query and hash; '' for anything else
 * (another website, `//host`, `javascript:`), so a link can't send the visitor away.
 * @param {string|null} value
 * @returns {string}
 */
function toSitePath(value) {
  if (!value) return '';
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin ? `${url.pathname}${url.search}${url.hash}` : '';
  } catch {
    return '';
  }
}

/**
 * The block's rows: the first picture, the texts (TEXTS) and the settings (SETTINGS), rows of
 * name | value. Rows of one cell are the label, then the button text, in order.
 * @param {Element} block
 * @returns {{picture: HTMLPictureElement|null, texts: Object<string, string>, partner: string,
 *   partnerPage: string, maxLength: number}} maxLength: the authored Max length (a positive
 *   whole number), else 0 (no limit)
 */
function readRows(block) {
  const picture = block.querySelector('picture');
  const rows = [...block.children].filter((row) => !row.querySelector('picture'))
    .map((row) => [...row.children]);
  const cell = (name) => rows.find((cells) => cells.length >= 2
    && toRowKey(cells[0].textContent) === toRowKey(name))?.[1];
  const value = (c) => clean(c?.querySelector('a[href]')?.getAttribute('href') || c?.textContent);

  const texts = Object.fromEntries(Object.entries(TEXTS)
    .map(([key, name]) => [key, clean(cell(name)?.textContent)]));
  const [label, button] = rows.filter((cells) => cells.length === 1)
    .map(([c]) => clean(c.textContent)).filter(Boolean);
  texts.label ||= label || '';
  texts.button ||= button || '';
  const authoredMax = value(cell(SETTINGS.maxLength));
  const maxLength = /^\d+$/.test(authoredMax) ? Number(authoredMax) : 0;

  const { hostname } = window.location;
  if (hostname.endsWith('.aem.page') || hostname === 'localhost') {
    // a row name mistyped leaves its text out without a word: say so on preview pages
    const known = [...Object.values(TEXTS), ...Object.values(SETTINGS)].map(toRowKey);
    const missing = Object.entries(TEXTS).filter(([key]) => !texts[key]).map(([, name]) => name);
    // without a Max length (a positive whole number), the password has no length limit
    if (!maxLength) missing.push(SETTINGS.maxLength);
    const unknown = rows.filter((cells) => cells.length >= 2)
      .map((cells) => clean(cells[0].textContent))
      .filter((name) => name && !known.includes(toRowKey(name)));
    if (missing.length || unknown.length) {
      // eslint-disable-next-line no-console
      console.warn(`partner-password: rows not found: ${missing.join(', ') || 'none'}; rows not known: ${unknown.join(', ') || 'none'}`);
    }
  }

  return {
    picture,
    texts,
    partner: toPartnerName(value(cell(SETTINGS.partner))),
    partnerPage: toSitePath(value(cell(SETTINGS.partnerPage))),
    maxLength,
  };
}

/**
 * The partner this password page is for: the authored Partner, else the address's `?partner=`,
 * else the page's name; '' when there's none.
 * @param {string} authored
 * @param {URLSearchParams} params
 * @returns {string}
 */
function findPartner(authored, params) {
  return authored || toPartnerName(params.get(PARTNER_PARAM))
    || toPartnerName(window.location.pathname.split('/').filter(Boolean).pop());
}

/**
 * When a login ends (milliseconds): the token's `exp`, or sooner when the answer's `expiresIn`
 * (seconds from now) ends first.
 * @param {string} token A valid token (isPartnerTokenValid)
 * @param {*} expiresIn
 * @returns {number}
 */
function tokenExpiry(token, expiresIn) {
  const exp = decodeJwt(token).payload.exp * 1000;
  const seconds = Number(expiresIn);
  return seconds > 0 ? Math.min(exp, Date.now() + seconds * 1000) : exp;
}

/**
 * Sends a partner's password to the PartnerLogin API and checks the answer: the login must
 * succeed (its status and `statusCode`), a partner name in the answer must be this partner, and
 * its token (`token`, else `partnerToken`) must be valid (isPartnerTokenValid). A valid login is
 * stored. Nothing is logged.
 * @param {string} partner The partner-member-name
 * @param {string} password
 * @returns {Promise<{ok: boolean, reason?: 'invalid'|'mismatch'|'token'|'error'|'network',
 *   message?: string}>} message: the API's own message for a refused login
 */
async function partnerLogin(partner, password) {
  let response;
  try {
    response = await fetch(apiUrl('partnerLogin'), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ partnername: partner, password }),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, reason: 'network' };
  }
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  const status = Number(data?.statusCode) || response.status;
  if (!response.ok || status >= 400) {
    const message = typeof data?.message === 'string' ? data.message.trim() : '';
    return { ok: false, reason: response.status >= 500 ? 'error' : 'invalid', message };
  }
  const answered = toPartnerName(data?.partnername ?? data?.partnerName);
  if (answered && answered !== partner) return { ok: false, reason: 'mismatch' };
  const token = data?.token ?? data?.partnerToken;
  if (!isPartnerTokenValid(token, partner)) return { ok: false, reason: 'token' };
  const expiresAt = tokenExpiry(token, data?.expiresIn);
  if (expiresAt <= Date.now()) return { ok: false, reason: 'token' };
  setPartnerToken(partner, token, expiresAt);
  return { ok: true };
}

/**
 * The message for a failed login: the authored text, else the API's message (a refused login or
 * a server error), else the shared form text.
 * @param {{reason: string, message?: string}} result
 * @param {Object<string, string>} texts
 * @returns {string}
 */
function failureMessage({ reason, message }, texts) {
  if (reason === 'network') return texts.network || translate('formNetworkError');
  if (reason === 'mismatch' || reason === 'token') return texts.access || translate('loginError');
  if (reason === 'error') return texts.error || message || translate('formError');
  return texts.invalid || message || translate('loginError');
}

/**
 * Decorates the Partner Password block: the image, then a form with the labelled password field,
 * the button and a message line under it (a refused login, a failed request, or the `?reason=`
 * notice). The field is checked as the visitor goes and on submit (required, and at most Max length
 * characters when that row is authored); while the password is being checked the button is
 * disabled and further submits are ignored.
 * @param {Element} block The partner-password block element
 */
export default function decorate(block) {
  const {
    picture, texts, partner: authoredPartner, partnerPage, maxLength,
  } = readRows(block);
  const buttonLabel = texts.button || translate('formSubmit');

  const settings = new Map([
    ['key', 'password'],
    // not the sign up password rule (8 to 15 characters, mixed case and a digit) that a password
    // field gets by default: the shared password is only required, and at most Max length long
    // when that row is authored
    ['rule', 'none'],
    ['required', texts.required],
    ['autocomplete', 'current-password'],
  ]);
  if (maxLength) {
    settings.set('max length', String(maxLength));
    if (texts.tooLong) settings.set('max length message', texts.tooLong);
  }
  const form = el('form', 'partner-password-form form-fields');
  const field = buildField({
    label: texts.label,
    labelNodes: [document.createTextNode(texts.label)],
    type: 'password',
    settings,
  });
  // no required star (the only field)
  field.querySelector('.form-required')?.remove();
  const input = field.querySelector('input');
  // without a Max length, no limit: not the sign up password's maxlength (15) that forms.js gives
  // a password field by default
  if (!maxLength) input.removeAttribute('maxlength');

  const submit = el('div', 'form-submit');
  const button = el('button', 'button primary');
  button.type = 'submit';
  button.textContent = buttonLabel;
  submit.append(button);

  // the form's message: a live region, focused when the login fails
  const message = el('p', 'partner-password-message');
  message.id = `${input.id}-message`;
  message.tabIndex = -1;
  message.hidden = true;
  message.setAttribute('role', 'alert');

  form.append(field, submit, message);
  attachValidation(form);

  const content = el('div', 'partner-password-content');
  if (picture) {
    const media = el('div', 'partner-password-media');
    media.append(picture);
    content.append(media);
  }
  content.append(form);
  block.replaceChildren(content);

  /**
   * Shows the message (or hides it with ''), linking it to the field while it's an error.
   * @param {string} value
   * @param {{error?: boolean, focus?: boolean}} [options]
   */
  const showMessage = (value, { error = false, focus = false } = {}) => {
    message.textContent = value;
    message.hidden = !value;
    message.classList.toggle('is-error', error);
    // first, as leaving the field rechecks it (attachValidation), which unlinks its errors
    if (focus && value) message.focus();
    if (error && value) {
      input.setAttribute('aria-describedby', message.id);
      input.setAttribute('aria-invalid', 'true');
    } else if (input.getAttribute('aria-describedby') === message.id) {
      input.removeAttribute('aria-describedby');
      input.removeAttribute('aria-invalid');
    }
  };

  /**
   * Sets the form's busy state while the password is checked.
   * @param {boolean} busy
   */
  const setBusy = (busy) => {
    form.toggleAttribute('aria-busy', busy);
    input.readOnly = busy;
    button.disabled = busy;
    button.textContent = busy ? translate('formSending') : buttonLabel;
  };

  const params = new URLSearchParams(window.location.search);
  const partner = findPartner(authoredPartner, params);
  const returnPath = toSitePath(params.get(RETURN_PARAM));
  const reason = params.get(REASON_PARAM);
  // after the live region is in the page, so it's announced
  if (REASONS.includes(reason) && texts[reason]) {
    requestAnimationFrame(() => showMessage(texts[reason]));
  }

  // typing again clears a login error (the field's own errors are handled by attachValidation)
  input.addEventListener('input', () => {
    if (message.classList.contains('is-error')) showMessage('');
  });

  let sending = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return;
    showMessage('');
    if (validateForm(form).length) return;
    sending = true;
    setBusy(true);
    const result = partner ? await partnerLogin(partner, input.value) : { ok: false, reason: 'mismatch' };
    if (result.ok) {
      // replaces this page in the history: Back from the partner page doesn't return to the form
      window.location.replace(returnPath || partnerPage || `/${getSiteFolder() || DEFAULT_SITE}/`);
      return;
    }
    sending = false;
    setBusy(false);
    showMessage(failureMessage(result, texts), { error: true, focus: true });
  });
}
