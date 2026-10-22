import { loadCSS } from '../../scripts/aem.js';
import apiUrl from '../../scripts/endpoints.js';
import { getSiteFolder, translate } from '../../scripts/i18n.js';
import { styleWords } from '../../scripts/buttons.js';
import {
  attachValidation, buildField, collectValues, fieldElement, linkFields, readSettings, resetForm,
  setFieldError, validateForm,
} from '../../scripts/forms.js';

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
 * The address to post to: an endpoint name from scripts/endpoints.js (`signUp`), or a URL.
 * @param {string} action
 * @returns {URL|null}
 */
function actionUrl(action) {
  if (!action) return null;
  try {
    if (/^(https?:)?\//.test(action)) return new URL(action, window.location.href);
    return apiUrl(action);
  } catch {
    return null;
  }
}

/**
 * The confirmation page in the visitor's language site: an authored /en-uk/… path becomes /zh-cn/…
 * on a Chinese page.
 * @param {string} redirect
 * @returns {string}
 */
function localRedirect(redirect) {
  const url = new URL(redirect, window.location.href);
  const folder = getSiteFolder();
  const parts = url.pathname.split('/');
  if (url.origin === window.location.origin && folder && /^[a-z]{2}-[a-z]{2}$/.test(parts[1] || '')) {
    parts[1] = folder;
    url.pathname = parts.join('/');
  }
  return url.href;
}

/**
 * Shows field errors an API returned, by key: `{errors: {key: message}}` or
 * `{errors: [{field, message}]}`.
 * @param {HTMLFormElement} form
 * @param {object} data
 * @returns {number} How many fields got an error
 */
function showApiErrors(form, data) {
  const list = Array.isArray(data?.errors)
    ? data.errors.map((e) => [e.field || e.key, e.message])
    : Object.entries(data?.errors || {});
  return list.filter(([key, text]) => {
    const wrap = key && fieldElement(form, key);
    if (wrap && text) setFieldError(wrap, String(text));
    return wrap && text;
  }).length;
}

/**
 * Decorates the custom form block: an authorable form. One row per field (label | type |
 * settings, see scripts/forms.js), a `settings` row for the form (`action`, `redirect`,
 * `error`, `success`), one-cell rows shown as text, and a `submit` row. Options: two-columns (as
 * the source sign up form: fields half width from 992px), narrow, centered, compact, maroon (the
 * form on a maroon panel, in white), text-left / text-right (the text rows above the first field
 * beside the form, as the source newsletter band). On submit
 * every field is checked; a valid form is posted as JSON (keys from each field's `key`) and the
 * visitor goes to the `redirect` page, or sees the error.
 * @param {Element} block The custom form block element
 */
export default async function decorate(block) {
  // the shared field styles, before the fields show
  const css = loadCSS(`${window.hlx.codeBasePath}/styles/forms.css`);
  const twoColumns = block.classList.contains('two-columns');
  // options text-left / text-right: the text rows above the first field sit beside the form
  const split = block.classList.contains('text-left') || block.classList.contains('text-right');
  const form = el('form', 'form-fields');
  const intro = el('div', 'form-intro');
  let settings = new Map();
  let submit = null;

  [...block.children].forEach((row) => {
    const cells = [...row.children];
    if (!row.textContent.trim() && !row.querySelector('img, picture')) return;
    if (cells.length === 1) {
      if (split && !form.querySelector('.form-field')) {
        intro.append(...cells[0].childNodes);
        return;
      }
      const content = el('div', 'form-content');
      content.append(...cells[0].childNodes);
      form.append(content);
      return;
    }
    const [labelCell, typeCell, settingsCell] = cells;
    const type = typeCell.textContent.trim().toLowerCase();
    if (type === 'settings') {
      settings = readSettings(settingsCell);
      return;
    }
    const fieldSettings = readSettings(settingsCell);
    const label = labelCell.textContent.trim();
    if (type === 'submit') {
      submit = el('div', 'form-submit');
      const button = el('button', 'button');
      button.type = 'submit';
      const words = styleWords(fieldSettings.get('style') || [...fieldSettings.keys()].join(' '));
      const style = words.find((w) => ['primary', 'outline', 'tint', 'tertiary', 'white'].includes(w)) || 'tertiary';
      button.classList.add({ outline: 'secondary', tint: 'accent' }[style] || style);
      words.filter((w) => ['large', 'arrow'].includes(w)).forEach((w) => button.classList.add(w));
      if (fieldSettings.has('full width mobile')) submit.classList.add('full-width-mobile');
      button.textContent = label || 'Submit';
      submit.append(button);
      return;
    }
    if (!label) return;
    // a checkbox keeps its label's links (e.g. the terms and the privacy policy)
    const paragraphs = labelCell.querySelectorAll('p');
    const labelNodes = type === 'checkbox'
      ? [...(paragraphs.length === 1 ? paragraphs[0] : labelCell).childNodes] : undefined;
    const field = buildField({
      label, labelNodes, type, settings: fieldSettings,
    }, { defaultWidth: twoColumns ? 'half' : 'full' });
    if (field) form.append(field);
  });

  // the form's message (e.g. the API's "An account with the given email already exists."),
  // announced, at the top of the form, with a button to close it
  const status = el('div', 'form-status');
  status.hidden = true;
  const statusText = el('p', 'form-status-text');
  statusText.setAttribute('role', 'alert');
  const statusClose = el('button', 'form-status-close');
  statusClose.type = 'button';
  statusClose.setAttribute('aria-label', translate('close'));
  status.append(statusText, statusClose);
  // the error count after a submit with errors, for screen readers
  const summary = el('p', 'visually-hidden');
  summary.setAttribute('aria-live', 'polite');
  form.prepend(status);
  form.append(summary);
  if (submit) form.append(submit);

  const showStatus = (text) => {
    statusText.textContent = text;
    status.hidden = !text;
    if (text) {
      const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      status.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
    }
  };
  statusClose.addEventListener('click', () => {
    showStatus('');
    // focus moves on to the form, not back to the top of the page
    form.querySelector('input:not([type="hidden"]), select, textarea')?.focus();
  });

  const button = submit?.querySelector('button');
  const label = button?.textContent;
  let submitting = false;
  // the button stays disabled from the click until the answer (or a failed check) is in
  const setBusy = (busy, sending = false) => {
    submitting = busy;
    form.toggleAttribute('aria-busy', busy);
    if (!button) return;
    button.disabled = busy;
    button.textContent = sending ? translate('formSending') : label;
  };

  attachValidation(form);
  linkFields(form);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    // a second click (or Enter) while the first is still on its way does nothing
    if (submitting) return;
    setBusy(true);
    showStatus('');
    const invalid = validateForm(form);
    summary.textContent = invalid.length ? translate('formSummary', { n: invalid.length }) : '';
    if (invalid.length) {
      // validateForm has moved focus to the first invalid field
      setBusy(false);
      return;
    }

    const values = collectValues(form);
    const before = new CustomEvent('custom-form:submit', { bubbles: true, cancelable: true, detail: { values, form } });
    const url = actionUrl(settings.get('action'));
    if (!form.dispatchEvent(before) || !url) {
      setBusy(false);
      if (!url) showStatus(settings.get('error') || translate('formError'));
      return;
    }

    setBusy(true, true);
    try {
      const res = await fetch(url, {
        method: (settings.get('method') || 'POST').toUpperCase(),
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(values),
      });
      let data = null;
      try {
        data = await res.json();
      } catch {
        // an empty or non-JSON answer
      }
      // a refusal: an HTTP error, `success: false`, or the API's own `serviceResponseCode` of 400
      // or more (it can answer 200 with a 400 inside, e.g. an email that is already registered)
      if (!res.ok || data?.success === false || Number(data?.serviceResponseCode) >= 400) {
        showApiErrors(form, data);
        showStatus(data?.serviceResponseMsg || data?.message || settings.get('error')
          || translate('formError'));
        const code = Number(data?.serviceResponseCode) || res.status;
        form.dispatchEvent(new CustomEvent('custom-form:error', { bubbles: true, detail: { status: code, data, form } }));
        return;
      }
      form.dispatchEvent(new CustomEvent('custom-form:success', { bubbles: true, detail: { data, values, form } }));
      // sent: the form is emptied and its button back to normal (also when the visitor comes
      // back to the page)
      resetForm(form);
      if (settings.get('redirect')) {
        window.location.assign(localRedirect(settings.get('redirect')));
        return;
      }
      if (settings.get('success')) {
        const done = el('p', 'form-success');
        done.setAttribute('role', 'status');
        done.textContent = settings.get('success');
        form.replaceWith(done);
      }
    } catch {
      showStatus(translate('formNetworkError'));
      form.dispatchEvent(new CustomEvent('custom-form:error', { bubbles: true, detail: { status: 0, form } }));
    } finally {
      setBusy(false);
    }
  });

  await css;
  block.replaceChildren(...(split && intro.childNodes.length ? [intro] : []), form);
}
