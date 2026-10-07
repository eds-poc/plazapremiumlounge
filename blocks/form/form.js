/*
 * Form: one row per field (label | type | options), one-cell rows shown as written, and a submit
 * button. The form only checks required fields; submitting fires a `form:submit` event with the
 * values and sends nothing, so a later script can handle it.
 */

import { CURRENCY_EVENT, getCurrency, setCurrency } from '../../scripts/currency.js';

const FIELD_TYPES = ['text', 'email', 'password', 'tel', 'number', 'checkbox'];
// autofill hints by type, or by label for name fields
const AUTOCOMPLETE = { email: 'email', password: 'current-password', tel: 'tel' };
const NAME_HINTS = [[/last name|surname|family name/i, 'family-name'], [/first name|given name/i, 'given-name']];
let formCount = 0;

/**
 * A slug for names and ids ("Email Address" → "email-address").
 * @param {string} text
 * @returns {string}
 */
function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'field';
}

/**
 * Reads the options cell: one option per line, e.g. `required: Please fill in email address.`,
 * `placeholder: name@example.com`, `outline`.
 * @param {Element} [cell]
 * @returns {Map<string, string>}
 */
function readOptions(cell) {
  const options = new Map();
  if (!cell) return options;
  const lines = cell.querySelector('p') ? [...cell.querySelectorAll('p')].map((p) => p.textContent) : cell.textContent.split('\n');
  lines.forEach((line) => {
    const text = line.trim();
    if (!text) return;
    const at = text.indexOf(':');
    const key = (at > 0 ? text.slice(0, at) : text).trim().toLowerCase();
    options.set(key, at > 0 ? text.slice(at + 1).trim() : '');
  });
  return options;
}

/**
 * Builds one field: a label and an input (or a checkbox with its label after it), plus the place
 * for its error message.
 * @param {{label: string, type: string, options: Map<string, string>, id: string}} field
 * @returns {HTMLElement}
 */
function buildField({
  label, type, options, id,
}) {
  const wrap = document.createElement('div');
  wrap.className = `form-field form-field-${type}`;
  const input = document.createElement('input');
  input.type = type;
  input.id = id;
  input.name = slug(label);
  const labelEl = document.createElement('label');
  labelEl.htmlFor = id;
  labelEl.textContent = label;
  if (type === 'checkbox') {
    input.value = 'true';
    labelEl.className = 'form-check-label';
    input.className = 'form-check-input';
    wrap.append(input, labelEl);
    return wrap;
  }
  labelEl.className = 'form-label';
  input.className = 'form-input';
  const hint = AUTOCOMPLETE[type] || NAME_HINTS.find(([re]) => re.test(label))?.[1];
  if (hint) input.autocomplete = hint;
  if (options.has('placeholder')) input.placeholder = options.get('placeholder');
  if (options.has('required')) {
    input.required = true;
    input.dataset.message = options.get('required') || `Please fill in ${label.toLowerCase()}.`;
  }
  wrap.append(labelEl, input);
  return wrap;
}

/**
 * The first path segment of a link ("/en-uk/about" → "en-uk"), to find the current language.
 * @param {string} href
 * @returns {string}
 */
function firstSegment(href) {
  try {
    return new URL(href, window.location.href).pathname.split('/').filter(Boolean)[0] || '';
  } catch {
    return '';
  }
}

/**
 * Builds a choice group: its label, then one box per choice (radio buttons), three to a row. The
 * choices are the lines of column 3: text, or a link (e.g. a language and its site). The current
 * one is selected: for a group named Currency the visitor's currency, for links the one matching
 * this page's first path segment, else a choice marked "(selected)", else the first.
 * @param {{label: string, cell: Element, id: string}} group
 * @returns {HTMLElement}
 */
function buildChoice({ label, cell, id }) {
  const name = slug(label);
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'form-field form-field-choice';
  // a modal page can open on one group (e.g. /modals/language-currency#currency)
  fieldset.dataset.modalView = name;
  fieldset.dataset.modalViewTitle = label;
  const legend = document.createElement('legend');
  legend.className = 'form-choice-label';
  legend.textContent = label;
  const list = document.createElement('ul');
  list.className = 'form-choice-list';
  // one choice per paragraph or line break
  const lines = (cell?.innerHTML || '').split(/<br\s*\/?>|<\/p>/i).map((html) => {
    const line = document.createElement('div');
    line.innerHTML = html;
    return line;
  });
  const items = lines.map((line) => {
    const link = line.querySelector('a[href]');
    const raw = line.textContent.trim();
    return {
      text: raw.replace(/\s*\(selected\)\s*$/i, ''),
      marked: /\(selected\)\s*$/i.test(raw),
      href: link?.getAttribute('href') || '',
    };
  }).filter((item) => item.text);

  const current = name === 'currency' ? getCurrency() : '';
  const segment = firstSegment(window.location.href);
  const selected = items.find((item) => current && item.text.toUpperCase() === current)
    || items.find((item) => item.href && segment && firstSegment(item.href) === segment)
    || items.find((item) => item.marked)
    || items[0];

  items.forEach((item, i) => {
    const li = document.createElement('li');
    const input = document.createElement('input');
    input.type = 'radio';
    input.className = 'form-choice-input';
    input.name = name;
    input.id = `${id}-${i}`;
    input.value = item.href || item.text;
    input.checked = item === selected;
    if (item.href) input.dataset.href = item.href;
    const box = document.createElement('label');
    box.className = 'form-choice-box';
    box.htmlFor = input.id;
    box.textContent = item.text;
    box.title = item.text;
    li.append(input, box);
    list.append(li);
  });
  fieldset.append(legend, list);
  return fieldset;
}

/**
 * Shows or clears a field's error message.
 * @param {HTMLInputElement} input
 * @param {string} message Empty to clear
 */
function setError(input, message) {
  const id = `${input.id}-error`;
  let error = document.getElementById(id);
  if (!message) {
    error?.remove();
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
    return;
  }
  if (!error) {
    error = document.createElement('p');
    error.className = 'form-error';
    error.id = id;
    input.after(error);
  }
  error.textContent = message;
  input.setAttribute('aria-invalid', 'true');
  input.setAttribute('aria-describedby', id);
}

/**
 * loads and decorates the form block
 * @param {Element} block The form block element
 */
export default function decorate(block) {
  formCount += 1;
  const form = document.createElement('form');
  form.className = 'form-form';
  form.noValidate = true;
  let afterSubmit = false;

  [...block.children].forEach((row) => {
    const cells = [...row.children];
    if (!cells.length || !row.textContent.trim()) return;
    // a one-cell row is content, shown as written (e.g. links between the fields and the button)
    if (cells.length === 1) {
      const content = document.createElement('div');
      content.className = afterSubmit ? 'form-content form-footer' : 'form-content';
      content.append(...cells[0].childNodes);
      form.append(content);
      return;
    }
    const label = cells[0].textContent.trim();
    const type = (cells[1]?.textContent.trim() || 'text').toLowerCase();
    if (type === 'choice') {
      if (label) form.append(buildChoice({ label, cell: cells[2], id: `form-${formCount}-${slug(label)}` }));
      return;
    }
    const options = readOptions(cells[2]);
    if (type === 'submit') {
      const wrap = document.createElement('div');
      // after fields (no content in between) the button has more space above it, as the source
      const prev = form.lastElementChild;
      wrap.className = `form-submit${prev && prev.classList.contains('form-field') ? ' is-after-field' : ''}`;
      const button = document.createElement('button');
      button.type = 'submit';
      button.className = `button ${options.has('outline') ? 'secondary' : 'primary'}${options.has('large') ? ' large' : ''}`;
      if (options.has('close')) form.dataset.closeOnSubmit = 'true';
      button.textContent = label || 'Submit';
      wrap.append(button);
      form.append(wrap);
      afterSubmit = true;
      return;
    }
    if (!label) return;
    form.append(buildField({
      label,
      type: FIELD_TYPES.includes(type) ? type : 'text',
      options,
      id: `form-${formCount}-${slug(label)}`,
    }));
  });

  // a currency applied elsewhere (e.g. another view of the same modal) is selected here too
  if (form.querySelector('.form-choice-input[name="currency"]')) {
    document.addEventListener(CURRENCY_EVENT, (e) => {
      form.querySelectorAll('.form-choice-input[name="currency"]').forEach((input) => {
        input.checked = input.value.toUpperCase() === e.detail.currency;
      });
    });
  }

  form.addEventListener('input', (e) => {
    if (e.target.matches('[aria-invalid="true"]') && e.target.value.trim()) setError(e.target, '');
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const invalid = [...form.querySelectorAll('input[required]')].filter((input) => {
      const empty = !input.value.trim();
      setError(input, empty ? input.dataset.message : '');
      return empty;
    });
    if (invalid.length) {
      invalid[0].focus();
      return;
    }
    // no submission yet: other scripts can listen for this event and send the values
    const values = Object.fromEntries(new FormData(form));
    // a currency choice is remembered for the visitor (the header shows it)
    if (values.currency) setCurrency(values.currency);
    form.dispatchEvent(new CustomEvent('form:submit', { bubbles: true, detail: { values, form } }));
    if (form.dataset.closeOnSubmit) form.closest('dialog')?.close();
  });

  block.replaceChildren(form);
}
