/*
 * Travelwise Password: the source's password page for a partner's members-only pages, e.g.
 * /en-uk/travelwise for the Travelwise offer (`.password-wrapper`): an image, the sentence that
 * labels the password field ("A password is required to access this page"), the password and a
 * Log In button, in one narrow column. Any partner's password page can use it.
 * Authored rows, in any order: the image (a picture), the label text, then the button text
 * (optional, else "Log In"); other rows are left out.
 * The partner is found from the metadata (partner-member-name): this page's own, else that of the
 * page in `?returnUrl=` (metadata.json), else this page's name when metadata.json has that
 * partner (/en-uk/travelwise → travelwise). Log In sends the partner name and the password to the
 * PartnerLogin API (partnerLogin in scripts/scripts.js); the login must succeed, name the same
 * partner and give a valid partnerToken. Then the visitor goes to the returnUrl page when it's
 * this site's page for the same partner, else to the partner's page in metadata.json; on any
 * failure they stay here with the error under the button. A `?reason=expired|logout` notice is
 * shown on arrival.
 */
import { getMetadata } from '../../scripts/aem.js';
import {
  DEFAULT_SITE, getLanguage, getSiteFolder, translate,
} from '../../scripts/i18n.js';
import {
  getPartnerOfPath, getPartnerPage, partnerLogin, toPartnerName, toSitePath,
} from '../../scripts/scripts.js';
import { attachValidation, buildField, validateForm } from '../../scripts/forms.js';

// the source field's limit (maxlength 20)
const PASSWORD_MAX_LENGTH = 20;
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
    en: 'Invalid password. Please try again.', zh: '密码不正确，请重试。', 'zh-HK': '密碼不正確，請重試。', ja: 'パスワードが正しくありません。もう一度お試しください。', pt: 'Senha inválida. Tente novamente.',
  },
  // the login succeeded but its answer isn't for this page's partner, or has no valid token
  access: {
    en: 'We couldn’t confirm your access to this page. Please try again.',
    zh: '无法确认您可以访问此页面，请重试。',
    'zh-HK': '無法確認您可以存取此頁面，請重試。',
    ja: 'このページへのアクセスを確認できませんでした。もう一度お試しください。',
    pt: 'Não foi possível confirmar seu acesso a esta página. Tente novamente.',
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
// the `?reason=` notices (the partner page's session ended)
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
 * The partner this password page is for, from the metadata (see the top of this file); '' when
 * none is found.
 * @param {string} returnPath The returnUrl page as a path on this site, or ''
 * @returns {Promise<string>}
 */
async function findPartner(returnPath) {
  const own = toPartnerName(getMetadata('partner-member-name'));
  if (own) return own;
  if (returnPath) {
    const partner = await getPartnerOfPath(new URL(returnPath, window.location.origin).pathname);
    if (partner) return partner;
  }
  const name = toPartnerName(window.location.pathname.split('/').filter(Boolean).pop());
  return name && await getPartnerPage(name) ? name : '';
}

/**
 * Where to go after logging in: the returnUrl page when it's this partner's page, else the
 * partner's page in metadata.json, else the language site's home page.
 * @param {string} partner
 * @param {string} returnPath The returnUrl page as a path on this site, or ''
 * @returns {Promise<string>}
 */
async function destination(partner, returnPath) {
  if (returnPath) {
    const path = new URL(returnPath, window.location.origin).pathname;
    if (await getPartnerOfPath(path) === partner) return returnPath;
  }
  return await getPartnerPage(partner) || `/${getSiteFolder() || DEFAULT_SITE}/`;
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
 * Decorates the Travelwise Password block: the image, then a form with the labelled password
 * field, the Log In button and a message line under it (a refused login, a failed request, or the
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
  const returnPath = toSitePath(params.get(RETURN_PARAM));
  const partnerFound = findPartner(returnPath);
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
    const partner = await partnerFound;
    const result = partner ? await partnerLogin(partner, input.value) : { ok: false, reason: 'mismatch' };
    if (result.ok) {
      // replaces this page in the history: Back from the partner page doesn't return to the form
      window.location.replace(await destination(partner, returnPath));
      return;
    }
    sending = false;
    setBusy(false);
    let failure;
    if (result.reason === 'network') failure = translate('formNetworkError');
    else if (result.reason === 'mismatch' || result.reason === 'token') failure = text('access');
    else failure = result.message || text(result.reason === 'error' ? 'error' : 'invalid');
    showMessage(failure, { error: true, focus: true });
  });
}
