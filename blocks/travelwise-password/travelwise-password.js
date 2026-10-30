/*
 * Travelwise Password: the source's password page for the Travelwise partner offer
 * (/en-uk/travelwise, `.password-wrapper`): an image, the sentence that labels the password field
 * ("A password is required to access this page"), the password and a Log In button, in one narrow
 * column.
 * Authored rows, in any order: the image (a picture), the label text, then the button text
 * (optional, else "Log In"); other rows are left out.
 * The password goes to the Travelwise login endpoint (LOGIN_PATH, on the site's API domain) as
 * JSON `{ password }` with the browser's cookies; the backend checks it and keeps the session in
 * its own cookie (HttpOnly, set by the backend only). It answers 2xx when the password is right,
 * 401 when it's wrong. The endpoint isn't built yet: until it is, every attempt shows the
 * connection message. Nothing is stored or logged here. On success the visitor goes to the page
 * in `?returnUrl=` when it's this site's Travelwise offer page, else to the offer page of their
 * language site. A `?reason=expired|logout` notice is shown on arrival.
 */
import {
  DEFAULT_SITE, getLanguage, getSiteFolder, translate,
} from '../../scripts/i18n.js';
import apiUrl from '../../scripts/endpoints.js';
import { attachValidation, buildField, validateForm } from '../../scripts/forms.js';

// the Travelwise login endpoint (POST), on the API domain of scripts/endpoints.js
const LOGIN_PATH = '/api/v1/web/app_demo/TravelwiseLogin';
// the source field's limit (maxlength 20)
const PASSWORD_MAX_LENGTH = 20;
// the offer page the password opens, in the visitor's language site
const OFFER_PAGE = 'offers/travelwise';
// a page this one may send the visitor back to: a language site's Travelwise offer page
const RETURN_PAGE = /^\/[a-z]{2}-[a-z]{2}\/offers\/travelwise\/?$/;
const RETURN_PARAM = 'returnUrl';
const REASON_PARAM = 'reason';

// the block's own texts, by language (as scripts/i18n.js: the page language, its base, else en)
const TEXTS = {
  // the field's name in its messages ("Please fill in password.")
  password: {
    en: 'Password', zh: '密码', 'zh-HK': '密碼', ja: 'パスワード', pt: 'a senha',
  },
  logIn: {
    en: 'Log In', zh: '登录', 'zh-HK': '登入', ja: 'ログイン', pt: 'Entrar',
  },
  invalid: {
    en: 'Incorrect password. Please try again.', zh: '密码不正确，请重试。', 'zh-HK': '密碼不正確，請重試。', ja: 'パスワードが正しくありません。もう一度お試しください。', pt: 'Senha incorreta. Tente novamente.',
  },
  error: {
    en: 'We couldn’t check your password right now. Please try again later.',
    zh: '暂时无法验证您的密码，请稍后重试。',
    'zh-HK': '暫時無法驗證您的密碼，請稍後再試。',
    ja: '現在パスワードを確認できません。しばらくしてからもう一度お試しください。',
    pt: 'Não foi possível verificar sua senha agora. Tente novamente mais tarde.',
  },
  expired: {
    en: 'Your session has expired. Please enter the password again.', zh: '您的会话已过期，请重新输入密码。', 'zh-HK': '您的工作階段已過期，請重新輸入密碼。', ja: 'セッションの有効期限が切れました。もう一度パスワードを入力してください。', pt: 'Sua sessão expirou. Digite a senha novamente.',
  },
  logout: {
    en: 'You have logged out.', zh: '您已退出登录。', 'zh-HK': '您已登出。', ja: 'ログアウトしました。', pt: 'Você saiu.',
  },
};
// the `?reason=` notices (the offer page's session ended)
const REASONS = ['expired', 'logout'];

/**
 * One of the block's texts in the page language.
 * @param {string} key A TEXTS key
 * @returns {string}
 */
function text(key) {
  const texts = TEXTS[key];
  const lang = document.documentElement.lang || getLanguage();
  return texts[lang] ?? texts[lang.split('-')[0]] ?? texts.en;
}

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
 * The Travelwise offer page of the visitor's language site (/zh-cn/offers/travelwise on a Chinese
 * page, else the default site's).
 * @returns {string}
 */
function offerPath() {
  return `/${getSiteFolder() || DEFAULT_SITE}/${OFFER_PAGE}`;
}

/**
 * Where to go after logging in: the `?returnUrl=` page when it's a path on this site (starting with
 * one /, no backslash) to a Travelwise offer page, with its query and hash; anything else (another
 * website, `//host`, `javascript:`, another page) gives the offer page, so the link can't send the
 * visitor elsewhere.
 * @param {string|null} value
 * @returns {string}
 */
function returnPath(value) {
  const fallback = offerPath();
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  let url;
  try {
    url = new URL(value, window.location.origin);
  } catch {
    return fallback;
  }
  if (url.origin !== window.location.origin || !RETURN_PAGE.test(url.pathname)) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Sends the password and reads the answer by its status only (the body isn't read or kept):
 * 'ok' (2xx, the backend has set its session cookie), 'invalid' (401, a wrong password), 'error'
 * (any other status) or 'network' (no answer).
 * @param {string} password
 * @returns {Promise<'ok'|'invalid'|'error'|'network'>}
 */
async function sendPassword(password) {
  let response;
  try {
    response = await fetch(new URL(LOGIN_PATH, apiUrl('login')), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        // the backend accepts the request only with this header (its cross-site request check)
        'X-Requested-With': 'travelwise',
      },
      body: JSON.stringify({ password }),
      credentials: 'include',
      cache: 'no-store',
    });
  } catch {
    return 'network';
  }
  if (response.ok) return 'ok';
  return response.status === 401 ? 'invalid' : 'error';
}

/**
 * The block's rows: the first picture, the first row of text (the label) and the next one (the
 * button text).
 * @param {Element} block
 * @returns {{picture: HTMLPictureElement|null, label: string, button: string}}
 */
function readRows(block) {
  const picture = block.querySelector('picture');
  const texts = [...block.children]
    .filter((row) => !row.querySelector('picture'))
    .map((row) => row.textContent.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return { picture, label: texts[0] || '', button: texts[1] || '' };
}

/**
 * Decorates the Travelwise Password block: the image, then a form with the labelled password field,
 * the Log In button and a message line under it (a wrong password, a failed request, or the
 * `?reason=` notice), as the source's `#spanResult`. The field is checked as the visitor goes and
 * on submit (required, at most 20 characters); while the password is being checked the button is
 * disabled and further submits are ignored.
 * @param {Element} block The travelwise-password block element
 */
export default function decorate(block) {
  const { picture, label, button: buttonText } = readRows(block);
  const fieldName = text('password');
  const buttonLabel = buttonText || text('logIn');

  const form = el('form', 'travelwise-password-form form-fields');
  const field = buildField({
    label: fieldName,
    labelNodes: [document.createTextNode(label || fieldName)],
    type: 'password',
    settings: new Map([
      ['key', 'password'],
      // not the sign up password rule (8 to 15 characters, mixed case and a digit) that a
      // password field gets by default: the shared password is only required, at most 20 long
      ['rule', 'none'],
      ['required', ''],
      ['max length', String(PASSWORD_MAX_LENGTH)],
      ['autocomplete', 'current-password'],
    ]),
  });
  // the source has no required star (the only field)
  field.querySelector('.form-required')?.remove();
  const input = field.querySelector('input');

  const submit = el('div', 'form-submit');
  const button = el('button', 'button primary');
  button.type = 'submit';
  button.textContent = buttonLabel;
  submit.append(button);

  // the form's message: a live region, focused when the login fails
  const message = el('p', 'travelwise-password-message');
  message.id = `${input.id}-message`;
  message.tabIndex = -1;
  message.hidden = true;
  message.setAttribute('role', 'alert');

  form.append(field, submit, message);
  attachValidation(form);

  const content = el('div', 'travelwise-password-content');
  if (picture) {
    const media = el('div', 'travelwise-password-media');
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
  const reason = params.get(REASON_PARAM);
  // after the live region is in the page, so it's announced
  if (REASONS.includes(reason)) requestAnimationFrame(() => showMessage(text(reason)));

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
    const result = await sendPassword(input.value);
    if (result === 'ok') {
      // replaces this page in the history: Back from the offer page doesn't return to the form
      window.location.replace(returnPath(params.get(RETURN_PARAM)));
      return;
    }
    sending = false;
    setBusy(false);
    const failure = result === 'network' ? translate('formNetworkError') : text(result);
    showMessage(failure, { error: true, focus: true });
  });
}
