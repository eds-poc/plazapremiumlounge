/*
 * Login: the login modal's form (Form block with `action: login` on its button row) sent to the
 * Login API as JSON `{ username, password }`. A refusal answers `{ errorCode, message }` or
 * `{ error }`: its message shows under the button. A success answers `{ jwt, memberStatusCode,
 * membershipID }`: a `jwt` that is well formed and not expired (scripts/auth.js) logs the visitor
 * in (only the token is stored, the modal closes).
 */
import apiUrl from './endpoints.js';
import { translate } from './i18n.js';
import { isTokenValid, setToken } from './auth.js';

/**
 * The token in the Login API's answer: its `jwt`.
 * @param {*} data
 * @returns {string}
 */
function tokenFrom(data) {
  return typeof data?.jwt === 'string' ? data.jwt : '';
}

/**
 * Sends the login form: the email field as `username` and the password; the button is busy until
 * the answer is in.
 * @param {HTMLFormElement} form
 * @returns {Promise<void>}
 */
// eslint-disable-next-line import/prefer-default-export
export function login(form) {
  const button = form.querySelector('button[type="submit"]');
  const password = form.querySelector('input[type="password"]');
  const status = form.querySelector('.form-status');
  if (!button || !password || button.disabled) return Promise.resolve();
  const show = (text) => {
    if (!status) return;
    status.textContent = text;
    status.hidden = !text;
  };
  const label = button.textContent;
  button.disabled = true;
  button.textContent = translate('formSending');
  show('');

  return fetch(apiUrl('login'), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: form.querySelector('input[type="email"]')?.value.trim() || '',
      password: password.value,
    }),
  })
    .then((res) => res.json().catch(() => null).then((data) => ({ res, data })))
    .then(({ res, data }) => {
      const token = tokenFrom(data);
      if (res.ok && token && isTokenValid(token)) {
        setToken(token);
        password.value = '';
        form.closest('dialog')?.close();
        return;
      }
      // a refusal (its message), or an answer whose token is missing, broken or expired
      show((!token && (data?.message || data?.error)) || translate('loginError'));
    })
    .catch(() => show(translate('formNetworkError')))
    .finally(() => {
      button.disabled = false;
      button.textContent = label;
    });
}
