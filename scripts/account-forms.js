/*
 * Account forms: the Form blocks whose button row has an `action:`, sent as JSON to their API on
 * submit (blocks/form/form.js loads this script on the first send). The button is busy until the
 * answer is in; a refusal's message shows under the button.
 * - `action: login`: `{ username, password }` to the Login API. A success answers `{ jwt, … }`: a
 *   `jwt` that is well formed and not expired (scripts/auth.js) logs the visitor in (the token is
 *   stored and the modal closes). A refusal answers `{ errorCode, message }` or `{ error }`.
 * - `action: forgot-password`: `{ lastName, email }` to the ForgotPassword API. A refusal answers
 *   `{ resetCode: 'E…', resetMsg }` (with HTTP 200) or `{ error, fields }`; otherwise the email is
 *   sent: the fields give way to the success message (the row's `success:`, else the default).
 */
import apiUrl from './endpoints.js';
import { translate } from './i18n.js';
import { isTokenValid, setToken } from './auth.js';

/**
 * Posts a form's data as JSON with its button busy, then hands the answer to `done`; a network
 * failure shows the connection message.
 * @param {HTMLFormElement} form
 * @param {string} endpoint An endpoint name (scripts/endpoints.js)
 * @param {object} body
 * @param {(answer: {res: Response, data: *}, show: (text: string) => void) => void} done
 * @returns {Promise<void>}
 */
function send(form, endpoint, body, done) {
  const button = form.querySelector('button[type="submit"]');
  const status = form.querySelector('.form-status');
  if (!button || button.disabled) return Promise.resolve();
  const show = (text, success = false) => {
    if (!status) return;
    status.textContent = text;
    status.hidden = !text;
    status.classList.toggle('is-success', success);
  };
  const label = button.textContent;
  button.disabled = true;
  button.textContent = translate('formSending');
  show('');

  return fetch(apiUrl(endpoint), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
    .then((res) => res.json().catch(() => null).then((data) => done({ res, data }, show)))
    .catch(() => show(translate('formNetworkError')))
    .finally(() => {
      button.disabled = false;
      button.textContent = label;
    });
}

/**
 * The value of the form's field of a type (by type, so whatever its label in each language).
 * @param {HTMLFormElement} form
 * @param {string} type
 * @returns {string}
 */
function valueOf(form, type) {
  return form.querySelector(`input[type="${type}"]`)?.value.trim() || '';
}

/**
 * Login: the email as `username` and the password; logged in by a valid `jwt`.
 * @param {HTMLFormElement} form
 * @returns {Promise<void>}
 */
function login(form) {
  const password = form.querySelector('input[type="password"]');
  if (!password) return Promise.resolve();
  return send(form, 'login', { username: valueOf(form, 'email'), password: password.value }, ({ res, data }, show) => {
    const token = typeof data?.jwt === 'string' ? data.jwt : '';
    if (res.ok && token && isTokenValid(token)) {
      setToken(token);
      password.value = '';
      form.closest('dialog')?.close();
      return;
    }
    // a refusal (its message), or an answer whose token is missing, broken or expired
    show((!token && (data?.message || data?.error)) || translate('loginError'));
  });
}

/**
 * Forgot password: the last name and email; on success the fields give way to the success message,
 * and the form is fresh again once the modal closes.
 * @param {HTMLFormElement} form
 * @returns {Promise<void>}
 */
function forgotPassword(form) {
  const body = { lastName: valueOf(form, 'text'), email: valueOf(form, 'email') };
  return send(form, 'forgotPassword', body, ({ res, data }, show) => {
    const refused = !res.ok || data?.error || data?.errorCode || /^E/i.test(data?.resetCode || '');
    if (refused) {
      show(data?.resetMsg || data?.message || data?.error || translate('formError'));
      return;
    }
    form.classList.add('is-sent');
    show(form.dataset.success || translate('forgotPasswordSent'), true);
    form.closest('dialog')?.addEventListener('close', () => {
      form.reset();
      form.classList.remove('is-sent');
      show('');
    }, { once: true });
  });
}

const ACTIONS = { login, 'forgot-password': forgotPassword };

/**
 * Sends a form by its `action:` (data-action); an unknown action does nothing.
 * @param {HTMLFormElement} form
 * @returns {Promise<void>}
 */
// eslint-disable-next-line import/prefer-default-export
export function submitAction(form) {
  return ACTIONS[form.dataset.action]?.(form) || Promise.resolve();
}
