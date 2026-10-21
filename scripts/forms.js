/*
 * Forms: authorable form fields and their validation, shared by form blocks (Custom Form).
 * A field is defined by a label, a type and settings (one `name: value` per line, e.g.
 * `key: firstName`, `required`, `rule: name`, `width: half`). Fields are built with
 * buildField(); attachValidation() checks them as the visitor goes, validateForm() checks them all
 * (on submit) and collectValues() gives the payload, keyed by each field's `key`.
 * Styles: styles/forms.css (the form element gets the class `form-fields`).
 */
import { translate } from './i18n.js';
import apiUrl from './endpoints.js';

const INPUT_TYPES = ['text', 'email', 'password', 'tel', 'number', 'date', 'url', 'hidden'];
const FIELD_TYPES = [...INPUT_TYPES, 'textarea', 'select', 'radio', 'checkbox', 'checkboxes', 'country', 'phone'];
const CHOICE_TYPES = ['select', 'radio', 'country', 'checkboxes'];
// autofill hints by key (sign up and contact forms), else by type
const AUTOCOMPLETE = {
  title: 'honorific-prefix',
  firstName: 'given-name',
  lastName: 'family-name',
  email: 'email',
  phone: 'tel-national',
  password: 'new-password',
  confirmPassword: 'new-password',
};
const TYPE_AUTOCOMPLETE = { email: 'email', tel: 'tel', url: 'url' };
// the phone code selected once the countries are in (the option text, else its value)
const DEFAULT_PHONE_CODE = '+1 (US)';

// rule presets: `rule: name` etc.; the source's own patterns where it has them
const RULES = {
  email: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, message: 'formEmail' },
  name: { pattern: /^[\p{L}\p{M}\s'’-]+$/u, message: 'formName' },
  // source sign up: 8 to 15 characters, at least one lower case, upper case and number
  password: {
    pattern: /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).*$/, minLength: 8, maxLength: 15, message: 'formPassword',
  },
  // source sign up: digits, +, - and /, at most 20
  phone: { pattern: /^[0-9+\-/\s]+$/, maxLength: 20, message: 'formPhone' },
  url: { pattern: /^https?:\/\/[^\s.]+\.\S+$/i, message: 'formUrl' },
  postcode: { pattern: /^[A-Za-z0-9][A-Za-z0-9 -]{1,9}$/, message: 'formPostcode' },
};

const fields = new WeakMap();
let count = 0;
let countries;

/**
 * The countries with their phone codes (endpoint `countries`), sorted by name. One request per
 * page, shared by every field that needs it; after a failure the next call tries again.
 * @returns {Promise<object[]>}
 */
export function getCountries() {
  if (!countries) {
    countries = fetch(apiUrl('countries'))
      .then((res) => {
        if (!res.ok) throw new Error(`countries: HTTP ${res.status}`);
        return res.json();
      })
      .then((list) => (Array.isArray(list) ? list : [])
        .sort((a, b) => String(a.countryName).localeCompare(String(b.countryName))));
    countries.catch(() => { countries = null; });
  }
  return countries;
}

// lists a choice field can be filled from (`source: countries`)
const SOURCES = {
  countries: {
    load: () => getCountries(),
    value: 'countryId',
    text: 'countryName',
  },
};

/**
 * Reads a settings cell: one setting per line or paragraph, `name: value` or a bare name
 * (`required`). Names are case and dash insensitive (`Min-Length` = `min length`).
 * @param {Element} [cell]
 * @returns {Map<string, string>}
 */
export function readSettings(cell) {
  const settings = new Map();
  if (!cell) return settings;
  const lines = cell.querySelector('p, li')
    ? [...cell.querySelectorAll('p, li')].map((p) => p.textContent)
    : cell.textContent.split('\n');
  lines.forEach((line) => {
    const text = line.trim();
    if (!text) return;
    const at = text.indexOf(':');
    const name = (at > 0 ? text.slice(0, at) : text).trim().toLowerCase().replace(/[\s_-]+/g, ' ');
    settings.set(name, at > 0 ? text.slice(at + 1).trim() : '');
  });
  return settings;
}

/**
 * A payload key from a label ("First Name" → "firstName"); '' for labels without Latin letters.
 * @param {string} label
 * @returns {string}
 */
export function toKey(label) {
  const words = label.normalize('NFKD').replace(/[^\w\s]/g, ' ').trim()
    .split(/\s+/)
    .filter(Boolean);
  return words.map((w, i) => (i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())).join('');
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
 * The options of an authored list (`options: Mr., Mrs., Ms.` or `Label = value` per item).
 * @param {string} text
 * @returns {{text: string, value: string}[]}
 */
function readOptions(text) {
  return (text || '').split(/\s*[,;]\s*/).filter(Boolean).map((item) => {
    const [label, value] = item.split(/\s*=\s*/);
    return { text: label, value: value ?? label };
  });
}

/**
 * Fills a select (or a radio/checkbox group) with options, after its empty first option, and
 * selects the preset one: the option whose text is the preset (e.g. `+1 (US)`), else the first
 * whose value is (e.g. `+1`).
 * @param {HTMLElement} control
 * @param {{text: string, value: string}[]} options
 * @param {object} state The field state
 * @param {string} [preset] The default (the field's `default` setting unless given)
 */
function fillOptions(control, options, state, preset = state.def.settings.get('default')) {
  const { def } = state;
  const chosen = preset && (options.find((o) => o.text === preset)
    || options.find((o) => o.value === preset));
  if (control.matches('select')) {
    const keep = control.querySelector('option[value=""]');
    control.replaceChildren(...(keep ? [keep] : []));
    options.forEach((item) => {
      const option = el('option');
      option.value = item.value;
      option.textContent = item.text;
      if (item === chosen) option.selected = true;
      control.append(option);
    });
    return;
  }
  const type = def.type === 'radio' ? 'radio' : 'checkbox';
  const items = options.map(({ text, value }, i) => {
    const item = el('div', 'form-check');
    const input = el('input', 'form-check-input');
    input.type = type;
    input.name = def.key;
    input.id = `${def.id}-${i}`;
    input.value = value;
    if (chosen?.value === value) input.checked = true;
    const label = el('label', 'form-check-label');
    label.htmlFor = input.id;
    label.textContent = text;
    item.append(input, label);
    return item;
  });
  control.replaceChildren(...items);
  state.controls = [...control.querySelectorAll('input')];
}

/**
 * Fills a choice field from its data source (countries), with a "Loading…" option meanwhile and
 * a message with a retry button if the list can't be loaded.
 * @param {object} state
 * @param {HTMLSelectElement} select
 * @param {{value: string, text: string, preset?: string}} map Which fields of the data give the
 *   value and text, and the option to select once loaded
 */
function loadSource(state, select, map) {
  const source = SOURCES[state.def.settings.get('source') || 'countries'];
  if (!source) return;
  const loading = el('option');
  loading.value = '';
  loading.textContent = translate('formLoading');
  const placeholder = select.querySelector('option[value=""]');
  select.disabled = true;
  placeholder.replaceWith(loading);
  state.wrap.querySelector('.form-load-error')?.remove();
  source.load().then((list) => {
    loading.replaceWith(placeholder);
    fillOptions(select, list.map((item) => ({
      text: String(item[map.text] ?? ''), value: String(item[map.value] ?? ''),
    })).filter((o) => o.text && o.value), state, map.preset);
    select.disabled = false;
    state.loaded = true;
  }).catch(() => {
    loading.textContent = translate('formLoadError');
    const retry = el('button', 'form-load-error');
    retry.type = 'button';
    retry.textContent = translate('formRetry');
    retry.addEventListener('click', () => loadSource(state, select, map));
    select.closest('.form-control-wrap, .form-phone')?.after(retry);
  });
}

/**
 * Builds a field's label: the authored text (or nodes, e.g. a checkbox label with links) and a
 * red * when required.
 * @param {object} def
 * @param {string} tag
 * @returns {HTMLElement}
 */
function buildLabel(def, tag = 'label') {
  const label = el(tag, tag === 'legend' ? 'form-label form-legend' : 'form-label');
  if (tag === 'label') label.htmlFor = def.id;
  if (def.labelNodes?.length) label.append(...def.labelNodes);
  else label.textContent = def.label;
  if (def.settings.has('required')) {
    const star = el('span', 'form-required');
    star.setAttribute('aria-hidden', 'true');
    star.textContent = ' *';
    label.append(star);
  }
  return label;
}

/**
 * Sets the attributes every text-like control shares: name, id, placeholder, autofill, limits.
 * @param {HTMLElement} control
 * @param {object} def
 */
function setControlAttributes(control, def) {
  const { settings } = def;
  control.id = def.id;
  control.name = def.key;
  if (settings.has('placeholder')) control.placeholder = settings.get('placeholder');
  if (settings.has('default') && 'value' in control) control.value = settings.get('default');
  if (settings.has('readonly')) control.readOnly = true;
  const autocomplete = settings.get('autocomplete') || AUTOCOMPLETE[def.key] || TYPE_AUTOCOMPLETE[def.type];
  if (autocomplete) control.autocomplete = autocomplete;
  const rule = RULES[settings.get('rule')] || RULES[def.type];
  const max = settings.get('max length') || rule?.maxLength;
  if (max && control.matches('input:not([type="date"]):not([type="number"]), textarea')) control.maxLength = Number(max);
  if (settings.has('required')) control.required = true;
}

/**
 * Builds the password visibility toggle (setting `toggle`).
 * @param {HTMLInputElement} input
 * @returns {HTMLButtonElement}
 */
function buildPasswordToggle(input) {
  const button = el('button', 'form-password-toggle');
  button.type = 'button';
  button.setAttribute('aria-controls', input.id);
  const sync = () => {
    const shown = input.type === 'text';
    button.setAttribute('aria-pressed', String(shown));
    button.setAttribute('aria-label', translate(shown ? 'formHidePassword' : 'formShowPassword'));
  };
  button.addEventListener('click', () => {
    input.type = input.type === 'password' ? 'text' : 'password';
    sync();
  });
  sync();
  return button;
}

/**
 * Links a field's help and error text to its controls for screen readers.
 * @param {object} state
 * @param {boolean} invalid
 */
function describe(state, invalid) {
  const ids = [state.helpId, invalid ? state.error.id : ''].filter(Boolean).join(' ');
  const targets = state.group ? [state.group] : [...state.controls, state.code].filter(Boolean);
  targets.forEach((control) => {
    if (ids) control.setAttribute('aria-describedby', ids);
    else control.removeAttribute('aria-describedby');
    if (invalid) control.setAttribute('aria-invalid', 'true');
    else control.removeAttribute('aria-invalid');
  });
}

/**
 * Builds one field from its definition.
 * @param {{label: string, labelNodes?: Node[], type: string, settings: Map<string, string>}} input
 *   The authored label (text, and its nodes for rich checkbox labels), type and settings
 * @param {{defaultWidth?: string}} [options]
 * @returns {HTMLElement|null} The field, or null for an unknown type without a label
 */
export function buildField({
  label, labelNodes, type: authoredType, settings,
}, { defaultWidth = 'full' } = {}) {
  count += 1;
  const type = FIELD_TYPES.includes(authoredType) ? authoredType : 'text';
  const key = settings.get('key') || toKey(label) || `field${count}`;
  const def = {
    label, labelNodes, type, settings, key, id: `form-field-${count}`,
  };
  const wrap = el('div', `form-field form-field-${type}`);
  wrap.dataset.key = key;
  const fullByDefault = ['checkbox', 'checkboxes', 'radio', 'textarea'].includes(type);
  wrap.classList.add(`width-${settings.get('width') || (fullByDefault ? 'full' : defaultWidth)}`);
  if (settings.has('new row')) wrap.classList.add('new-row');
  const state = { def, wrap, controls: [] };

  if (type === 'hidden') {
    const input = el('input');
    input.type = 'hidden';
    setControlAttributes(input, def);
    input.value = settings.get('value') ?? settings.get('default') ?? '';
    wrap.append(input);
    wrap.hidden = true;
    state.controls = [input];
  } else if (type === 'checkbox') {
    const input = el('input', 'form-check-input');
    input.type = 'checkbox';
    setControlAttributes(input, def);
    if (settings.has('default')) input.checked = /^(true|yes|checked|on)$/i.test(settings.get('default'));
    const text = buildLabel(def);
    text.className = 'form-check-label';
    wrap.append(input, text);
    state.controls = [input];
  } else if (type === 'radio' || type === 'checkboxes') {
    const fieldset = el('fieldset', 'form-group');
    fieldset.id = def.id;
    const group = el('div', 'form-check-list');
    fieldset.append(buildLabel(def, 'legend'), group);
    wrap.append(fieldset);
    fillOptions(group, readOptions(settings.get('options')), state);
    state.group = fieldset;
  } else if (type === 'phone') {
    const box = el('div', 'form-phone');
    const code = el('select', 'form-input form-select form-phone-code');
    code.id = `${def.id}-code`;
    code.name = settings.get('prefix key') || `${key}Code`;
    code.setAttribute('aria-label', translate('formPhoneCode'));
    code.autocomplete = 'tel-country-code';
    code.append(Object.assign(el('option'), { value: '', textContent: '' }));
    const number = el('input', 'form-input form-phone-number');
    number.type = 'tel';
    number.inputMode = 'tel';
    setControlAttributes(number, def);
    if (settings.has('required')) code.required = true;
    box.append(code, number);
    wrap.append(buildLabel(def), box);
    state.controls = [number];
    state.code = code;
    loadSource(state, code, {
      value: settings.get('prefix value') || 'phoneCode',
      text: settings.get('prefix text') || 'phoneCodeCountryCode',
      // the code chosen once the list is in: +1 (US) unless authored (`prefix default: +65 (SG)`,
      // `+44`), none with `prefix default: none`
      preset: settings.has('prefix default')
        ? settings.get('prefix default').replace(/^none$/i, '') : DEFAULT_PHONE_CODE,
    });
  } else {
    let control;
    if (type === 'textarea') control = el('textarea', 'form-input form-textarea');
    else if (CHOICE_TYPES.includes(type)) {
      control = el('select', 'form-input form-select');
      control.append(Object.assign(el('option'), { value: '', textContent: settings.get('placeholder') || '' }));
    } else {
      control = el('input', 'form-input');
      control.type = type;
      if (type === 'number') control.inputMode = 'numeric';
    }
    setControlAttributes(control, def);
    if (control.matches('select')) control.removeAttribute('placeholder');
    const box = el('div', 'form-control-wrap');
    box.append(control);
    if (type === 'password' && settings.has('toggle')) box.append(buildPasswordToggle(control));
    wrap.append(buildLabel(def), box);
    state.controls = [control];
    if (type === 'select') fillOptions(control, readOptions(settings.get('options')), state);
    if (type === 'country' || (type === 'select' && settings.has('source'))) {
      loadSource(state, control, {
        value: settings.get('value') || 'countryId',
        text: settings.get('text') || 'countryName',
        preset: settings.get('default'),
      });
    }
  }

  if (settings.has('help')) {
    const help = el('p', 'form-help');
    help.id = `${def.id}-help`;
    help.textContent = settings.get('help');
    wrap.append(help);
    state.helpId = help.id;
  }
  const error = el('p', 'form-error');
  error.id = `${def.id}-error`;
  error.hidden = true;
  wrap.append(error);
  state.error = error;
  describe(state, false);
  fields.set(wrap, state);
  return wrap;
}

/**
 * A field's current value: text, the checked state of a checkbox, the chosen radio, the chosen
 * values of a checkbox group, or the number of a phone field.
 * @param {object} state
 * @returns {string|boolean|string[]}
 */
function valueOf(state) {
  const { type } = state.def;
  if (type === 'checkbox') return state.controls[0].checked;
  if (type === 'checkboxes') return state.controls.filter((c) => c.checked).map((c) => c.value);
  if (type === 'radio') return state.controls.find((c) => c.checked)?.value || '';
  return state.controls[0]?.value.trim() ?? '';
}

/**
 * The message for a failed rule: the field's `<rule> message`, else its `message`, else the
 * default text.
 * @param {object} def
 * @param {string} name The rule's setting name (e.g. `min length`)
 * @param {string} textKey The default text (i18n key)
 * @param {object} [values]
 * @returns {string}
 */
function message(def, name, textKey, values = {}) {
  return def.settings.get(`${name} message`) || def.settings.get('message')
    || translate(textKey, { label: def.label.toLowerCase(), ...values });
}

/**
 * The age in whole years on a date (YYYY-MM-DD) today.
 * @param {string} date
 * @returns {number}
 */
function ageOn(date) {
  const born = new Date(date);
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  if (now < new Date(now.getFullYear(), born.getMonth(), born.getDate())) age -= 1;
  return age;
}

/**
 * A date setting as YYYY-MM-DD (`today` allowed).
 * @param {string} value
 * @returns {string}
 */
function dateSetting(value) {
  return value === 'today' ? new Date().toISOString().slice(0, 10) : value;
}

/**
 * The field the visitor's form has under a key (for `match` and `required if`).
 * @param {HTMLFormElement} form
 * @param {string} key
 * @returns {object|undefined}
 */
function fieldByKey(form, key) {
  const wrap = form.querySelector(`.form-field[data-key="${CSS.escape(key)}"]`);
  return wrap && fields.get(wrap);
}

/**
 * Whether a field is required now: `required`, or `required if: otherKey = value` when that other
 * field has that value.
 * @param {object} state
 * @returns {boolean}
 */
function isRequired(state) {
  const { settings } = state.def;
  if (settings.has('required')) return true;
  const condition = settings.get('required if')?.match(/^(\S+)\s*=\s*(.+)$/);
  if (!condition) return false;
  const other = fieldByKey(state.wrap.closest('form'), condition[1]);
  return !!other && String(valueOf(other)) === condition[2].trim();
}

/**
 * Checks one field against its rules, in order: required, the type's or preset rule, length,
 * pattern, number and date limits, minimum age, minimum selections, and match.
 * @param {object} state
 * @returns {string} The first failing rule's message, or '' when the field is valid
 */
function check(state) {
  const { def } = state;
  const { settings, type } = def;
  const value = valueOf(state);
  const empty = Array.isArray(value) ? !value.length : value === '' || value === false;

  if (isRequired(state)) {
    // a phone number without its country code asks for the code
    if (type === 'phone' && state.code && !state.code.value && !empty) {
      return translate('formRequiredChoice', { label: translate('formPhoneCode').toLowerCase() });
    }
    if (empty) {
      if (settings.get('required')) return settings.get('required');
      if (type === 'checkbox') return translate('formRequiredCheck');
      const key = CHOICE_TYPES.includes(type) ? 'formRequiredChoice' : 'formRequired';
      return translate(key, { label: def.label.toLowerCase() });
    }
  }
  if (empty) return '';
  if (typeof value !== 'string') {
    const min = Number(settings.get('min selected'));
    if (Array.isArray(value) && min && value.length < min) return message(def, 'min selected', 'formMinSelected', { n: min });
    return '';
  }

  const presetName = settings.get('rule') || (RULES[type] ? type : '');
  const preset = RULES[presetName];
  const minLength = Number(settings.get('min length') || preset?.minLength || 0);
  const maxLength = Number(settings.get('max length') || preset?.maxLength || 0);
  if (preset && minLength && value.length < minLength) return message(def, 'rule', preset.message);
  if (preset && maxLength && value.length > maxLength) return message(def, 'rule', preset.message);
  if (preset && !preset.pattern.test(value)) return message(def, 'rule', preset.message);
  if (minLength && value.length < minLength) return message(def, 'min length', 'formMinLength', { n: minLength });
  if (maxLength && value.length > maxLength) return message(def, 'max length', 'formMaxLength', { n: maxLength });
  if (settings.has('pattern')) {
    let pattern;
    try {
      pattern = new RegExp(settings.get('pattern'), 'u');
    } catch {
      pattern = null;
    }
    if (pattern && !pattern.test(value)) return message(def, 'pattern', 'formPattern');
  }
  if (type === 'number') {
    const n = Number(value);
    if (settings.has('min') && n < Number(settings.get('min'))) return message(def, 'min', 'formMin', { n: settings.get('min') });
    if (settings.has('max') && n > Number(settings.get('max'))) return message(def, 'max', 'formMax', { n: settings.get('max') });
  }
  if (type === 'date') {
    const minDate = dateSetting(settings.get('min date') || '');
    const maxDate = dateSetting(settings.get('max date') || '');
    if (minDate && value < minDate) return message(def, 'min date', 'formMinDate', { n: minDate });
    if (maxDate && value > maxDate) return message(def, 'max date', 'formMaxDate', { n: maxDate });
    const minAge = Number(settings.get('min age'));
    if (minAge && ageOn(value) < minAge) return message(def, 'min age', 'formMinAge', { n: minAge });
  }
  if (settings.has('match')) {
    const other = fieldByKey(state.wrap.closest('form'), settings.get('match'));
    if (other && valueOf(other) !== value) return message(def, 'match', 'formMatch', { label: def.label });
  }
  return '';
}

/**
 * Shows or clears a field's error.
 * @param {HTMLElement} wrap The field
 * @param {string} text The message; '' clears it
 */
export function setFieldError(wrap, text) {
  const state = fields.get(wrap);
  if (!state) return;
  state.error.textContent = text;
  state.error.hidden = !text;
  wrap.classList.toggle('has-error', !!text);
  describe(state, !!text);
}

/**
 * Checks one field and shows its error.
 * @param {HTMLElement} wrap
 * @returns {boolean} Whether it's valid
 */
export function validateField(wrap) {
  const state = fields.get(wrap);
  if (!state || wrap.hidden) return true;
  const text = check(state);
  setFieldError(wrap, text);
  return !text;
}

/**
 * Checks a form's fields as the visitor goes: a field is checked when they leave it (a required
 * field left empty shows its error), and its error clears (or updates) while they type; a field
 * another one must match is rechecked too.
 * @param {HTMLFormElement} form
 */
export function attachValidation(form) {
  form.noValidate = true;
  const wrapOf = (target) => target.closest?.('.form-field');
  const recheck = (wrap) => {
    validateField(wrap);
    // fields that must match this one (e.g. Confirm Email), once the visitor has used them
    form.querySelectorAll('.form-field.is-touched').forEach((other) => {
      const state = fields.get(other);
      if (other !== wrap && state?.def.settings.get('match') === wrap.dataset.key) validateField(other);
    });
  };
  // leaving a field checks it, empty or not, so a required field left empty shows its error
  form.addEventListener('focusout', (e) => {
    const wrap = wrapOf(e.target);
    if (!wrap || !fields.has(wrap) || wrap.contains(e.relatedTarget)) return;
    wrap.classList.add('is-touched');
    recheck(wrap);
  });
  const onChange = (e) => {
    const wrap = wrapOf(e.target);
    if (!wrap) return;
    if (e.type === 'change') wrap.classList.add('is-touched');
    if (wrap.classList.contains('has-error') || (e.type === 'change' && wrap.classList.contains('is-touched'))) recheck(wrap);
  };
  form.addEventListener('input', onChange);
  form.addEventListener('change', onChange);
}

/**
 * Checks every field (on submit) and shows all errors; moves focus to the first invalid field.
 * @param {HTMLFormElement} form
 * @returns {HTMLElement[]} The invalid fields
 */
export function validateForm(form) {
  const invalid = [...form.querySelectorAll('.form-field')].filter((wrap) => {
    wrap.classList.add('is-touched');
    return !validateField(wrap);
  });
  if (invalid.length) {
    const state = fields.get(invalid[0]);
    const target = state.def.type === 'phone' && !state.code.value ? state.code : state.controls[0];
    target?.focus();
  }
  return invalid;
}

/**
 * Converts a value to a number: as written, else its digits only ("+1-441" → 1441).
 * @param {string} value
 * @returns {number|null}
 */
function toNumber(value) {
  if (value === '') return null;
  const n = Number(value);
  if (Number.isFinite(n)) return n;
  const digits = String(value).replace(/\D/g, '');
  return digits ? Number(digits) : null;
}

/**
 * Converts a field value to its `value type`: string (default), number or boolean.
 * @param {*} value
 * @param {string} [type]
 * @returns {*}
 */
function convert(value, type) {
  if (type === 'number') return Array.isArray(value) ? value.map(toNumber) : toNumber(value);
  if (type === 'boolean') return typeof value === 'boolean' ? value : /^(true|yes|1|on)$/i.test(value);
  return value;
}

/**
 * The form's values, keyed by each field's `key`, in each field's `value type`. A phone field
 * gives two keys (the number and its `prefix key`); fields with `send: no` are left out.
 * @param {HTMLFormElement} form
 * @returns {object}
 */
export function collectValues(form) {
  const values = {};
  form.querySelectorAll('.form-field').forEach((wrap) => {
    const state = fields.get(wrap);
    if (!state) return;
    const { def } = state;
    if (/^(no|false)$/i.test(def.settings.get('send') || '')) return;
    const valueType = def.settings.get('value type');
    let value = valueOf(state);
    if (def.type === 'checkbox' && def.settings.has('value') && valueType !== 'boolean') {
      value = value ? def.settings.get('value') : '';
    }
    values[def.key] = convert(value, valueType);
    if (def.type === 'phone' && state.code) {
      values[state.code.name] = convert(state.code.value, def.settings.get('prefix type') || valueType);
    }
  });
  return values;
}

/**
 * The field elements of a form, by key (e.g. to show errors returned by an API).
 * @param {HTMLFormElement} form
 * @param {string} key
 * @returns {HTMLElement|null}
 */
export function fieldElement(form, key) {
  return form.querySelector(`.form-field[data-key="${CSS.escape(key)}"]`);
}
