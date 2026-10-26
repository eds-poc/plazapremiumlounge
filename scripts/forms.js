/*
 * Forms: form fields, their validation and sending, shared by the form blocks (Signup Form,
 * Newsletter, Contact Form). A field is defined by a label, a type and settings (e.g.
 * `key: firstName`, `required`, `rule: name`, `width: half`). Fields are built with
 * buildField(); attachValidation() checks them as the visitor goes, validateForm() checks them all
 * (on submit) and collectValues() gives the payload, keyed by each field's `key`. linkFields()
 * makes a phone code follow the country field; resetForm() empties the form.
 * buildForm() builds a whole form from a block's authored rows (Field | Label | Placeholder |
 * Required | Error) and the block's own definition (the fields' types, keys and rules, the action,
 * the redirect), and sends it.
 * Styles: styles/forms.css (the form element gets the class `form-fields`), imported by each form
 * block's CSS so it's loaded before the block shows.
 */
import { DEFAULT_SITE, getSiteFolder, translate } from './i18n.js';
import apiUrl from './endpoints.js';

const INPUT_TYPES = ['text', 'email', 'password', 'tel', 'number', 'date', 'url'];
const FIELD_TYPES = [...INPUT_TYPES, 'textarea', 'select', 'checkbox', 'country', 'phone'];
const CHOICE_TYPES = ['select', 'country'];
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
  // a list (one option per authored line, see buildForm) or a comma-separated setting
  const items = Array.isArray(text) ? text : (text || '').split(/\s*[,;]\s*/);
  return items.map((item) => item.trim()).filter(Boolean).map((item) => {
    const [label, value] = item.split(/\s*=\s*/);
    return { text: label, value: value ?? label };
  });
}

/**
 * Fills a select with options, after its empty first option, and selects the preset one: the
 * option whose text is the preset (e.g. `+1 (US)`), else the first whose value is (e.g. `+1`).
 * @param {HTMLSelectElement} control
 * @param {{text: string, value: string}[]} options
 * @param {object} state The field state
 * @param {string} [preset] The default (the field's `default` setting unless given)
 */
function fillOptions(control, options, state, preset = state.def.settings.get('default')) {
  const chosen = preset && (options.find((o) => o.text === preset)
    || options.find((o) => o.value === preset));
  const keep = control.querySelector('option[value=""]');
  control.replaceChildren(...(keep ? [keep] : []));
  // each option's source data (e.g. a country's phone code), for linked fields
  state.data = new Map();
  options.forEach((item) => {
    const option = el('option');
    option.value = item.value;
    option.textContent = item.text;
    // the preset is also what a form reset goes back to
    if (item === chosen) option.defaultSelected = true;
    if (item.data && !state.data.has(item.value)) state.data.set(item.value, item.data);
    control.append(option);
  });
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
      text: String(item[map.text] ?? ''), value: String(item[map.value] ?? ''), data: item,
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
 * @returns {HTMLLabelElement}
 */
function buildLabel(def) {
  const label = el('label', 'form-label');
  label.htmlFor = def.id;
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
  // as the default value, so a form reset goes back to it
  if (settings.has('default') && 'defaultValue' in control) control.defaultValue = settings.get('default');
  if (settings.has('readonly')) control.readOnly = true;
  const autocomplete = settings.get('autocomplete') || AUTOCOMPLETE[def.key] || TYPE_AUTOCOMPLETE[def.type];
  if (autocomplete) control.autocomplete = autocomplete;
  const rule = RULES[settings.get('rule')] || RULES[def.type];
  const max = settings.get('max length') || rule?.maxLength;
  if (max && control.matches('input:not([type="date"]):not([type="number"]), textarea')) control.maxLength = Number(max);
  if (settings.has('required')) control.required = true;
}

/**
 * Links a field's error text to its controls for screen readers.
 * @param {object} state
 * @param {boolean} invalid
 */
function describe(state, invalid) {
  [...state.controls, state.code].filter(Boolean).forEach((control) => {
    if (invalid) {
      control.setAttribute('aria-describedby', state.error.id);
      control.setAttribute('aria-invalid', 'true');
    } else {
      control.removeAttribute('aria-describedby');
      control.removeAttribute('aria-invalid');
    }
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
  const fullByDefault = ['checkbox', 'textarea'].includes(type);
  wrap.classList.add(`width-${settings.get('width') || (fullByDefault ? 'full' : defaultWidth)}`);
  if (settings.has('new row')) wrap.classList.add('new-row');
  const state = { def, wrap, controls: [] };

  if (type === 'checkbox') {
    const input = el('input', 'form-check-input');
    input.type = 'checkbox';
    setControlAttributes(input, def);
    if (settings.has('default')) input.defaultChecked = /^(true|yes|checked|on)$/i.test(settings.get('default'));
    const text = buildLabel(def);
    text.className = 'form-check-label';
    wrap.append(input, text);
    state.controls = [input];
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
    if (type === 'textarea') {
      control = el('textarea', 'form-input form-textarea');
      // its height in lines of text (`rows: 12`)
      if (Number(settings.get('rows')) > 0) control.rows = Number(settings.get('rows'));
    } else if (CHOICE_TYPES.includes(type)) {
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
 * A field's current value: text, the checked state of a checkbox, or the number of a phone field.
 * @param {object} state
 * @returns {string|boolean}
 */
function valueOf(state) {
  if (state.def.type === 'checkbox') return state.controls[0].checked;
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
 * pattern, number and date limits, minimum age, and match.
 * @param {object} state
 * @returns {string} The first failing rule's message, or '' when the field is valid
 */
function check(state) {
  const { def } = state;
  const { settings, type } = def;
  const value = valueOf(state);
  const empty = value === '' || value === false;

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
  if (empty || typeof value !== 'string') return '';

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
  if (!state) return true;
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
 * Links each phone field's country code to a country field: choosing a country of residence
 * selects that country's code, which the visitor can still change on its own. The phone field
 * follows the form's first country field, or the one its `prefix follows: key` names (`none` to
 * turn it off).
 * @param {HTMLFormElement} form
 */
export function linkFields(form) {
  const states = [...form.querySelectorAll('.form-field')].map((wrap) => fields.get(wrap)).filter(Boolean);
  states.filter((s) => s.def.type === 'phone' && s.code).forEach((phone) => {
    const follows = phone.def.settings.get('prefix follows');
    if (/^(none|no)$/i.test(follows || '')) return;
    const country = follows
      ? fieldByKey(form, follows)
      : states.find((s) => s.def.type === 'country');
    const select = country?.controls[0];
    if (!select?.matches('select')) return;
    const { settings } = phone.def;
    const textKey = settings.get('prefix text') || 'phoneCodeCountryCode';
    const valueKey = settings.get('prefix value') || 'phoneCode';
    select.addEventListener('change', () => {
      const item = country.data?.get(select.value);
      if (!item) return;
      // by its text first: +1 (US) and +1 (CA) share a value
      const options = [...phone.code.options];
      const option = options.find((o) => o.textContent === String(item[textKey] ?? ''))
        || options.find((o) => o.value === String(item[valueKey] ?? ''));
      if (!option || option.selected) return;
      option.selected = true;
      phone.code.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
}

/**
 * Empties a form back to its defaults (e.g. after a successful send): the authored defaults and
 * presets (such as the +1 (US) phone code), no errors.
 * @param {HTMLFormElement} form
 */
export function resetForm(form) {
  form.reset();
  form.querySelectorAll('.form-field').forEach((wrap) => {
    wrap.classList.remove('is-touched');
    setFieldError(wrap, '');
  });
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
  if (type === 'number') return toNumber(value);
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

/* ---------------------------------------------------------------------------------------------
 * Form blocks: a form built from authored rows and a block's definition, and sent as JSON.
 * ------------------------------------------------------------------------------------------- */

const REQUIRED_WORDS = /^(yes|y|true|required|x|✓)$/i;

/**
 * The lines of an authored cell: its paragraphs or list items, or its text split at line breaks.
 * @param {Element} [cell]
 * @returns {string[]}
 */
function cellLines(cell) {
  if (!cell) return [];
  const copy = cell.cloneNode(true);
  copy.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  const parts = copy.querySelector('p, li') ? [...copy.querySelectorAll('p, li')] : [copy];
  return parts.flatMap((part) => part.textContent.split('\n')).map((line) => line.trim()).filter(Boolean);
}

/**
 * The nodes of a label cell, keeping its links (e.g. the Privacy Policy in a checkbox label).
 * @param {Element} cell
 * @returns {Node[]}
 */
function labelNodesOf(cell) {
  const paragraphs = cell.querySelectorAll('p');
  return [...(paragraphs.length === 1 ? paragraphs[0] : cell).childNodes];
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
 * A page path in the visitor's language site: a page name without the language folder
 * (`sign-up-successful-page`) goes in the visitor's site folder (/zh-cn/… on a Chinese page, else
 * the default site's); /en-uk/… becomes /zh-cn/… on a Chinese page.
 * @param {string} path
 * @returns {string}
 */
function localPath(path) {
  const site = getSiteFolder() || DEFAULT_SITE;
  const url = new URL(/^(https?:)?\//.test(path) ? path : `/${site}/${path}`, window.location.href);
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
 */
function showApiErrors(form, data) {
  const list = Array.isArray(data?.errors)
    ? data.errors.map((e) => [e.field || e.key, e.message])
    : Object.entries(data?.errors || {});
  list.forEach(([key, text]) => {
    const wrap = key && fieldElement(form, key);
    if (wrap && text) setFieldError(wrap, String(text));
  });
}

/**
 * The settings of one field: the block's definition (type, key, rules, limits…) with the authored
 * placeholder or options, required and error messages on top.
 * @param {object} field The block's definition of the field
 * @param {Element[]} cells The authored row: Field | Label | Placeholder | Required | Error
 * @returns {Map<string, *>}
 */
function fieldSettings(field, cells) {
  const settings = new Map(Object.entries(field.settings || {}).map(([k, v]) => [k, String(v)]));
  settings.set('key', field.key);
  const [, , placeholderCell, requiredCell, errorCell] = cells;
  const placeholder = cellLines(placeholderCell);
  if (field.type === 'select') {
    // dropdowns: the empty choice, then one option per line
    if (placeholder.length) settings.set('placeholder', placeholder[0]);
    if (placeholder.length > 1) settings.set('options', placeholder.slice(1));
  } else if (placeholder.length) {
    settings.set('placeholder', placeholder[0]);
  }
  const [emptyMessage, formatMessage] = cellLines(errorCell);
  const required = field.required || REQUIRED_WORDS.test(cellLines(requiredCell)[0] || '');
  if (required) settings.set('required', emptyMessage || '');
  if (formatMessage) settings.set(settings.has('match') ? 'match message' : 'message', formatMessage);
  return settings;
}

/**
 * Builds a form block's form: one authored row per field (Field | Label | Placeholder | Required |
 * Error), the field's name in the first cell, matched to the block's definition; one-cell rows are
 * text (before the first field, in `intro` when the definition asks for it); the rows `submit`,
 * `success` and `error` give the button text and the messages. On submit every field is checked;
 * a valid form is posted as JSON to the definition's action and the visitor goes to its redirect,
 * or sees the success message, or the error at the top of the form.
 * @param {Element} block The block, its rows as authored
 * @param {object} definition The block's form:
 *   `fields` (by name: `{ type, key, required, settings, newColumn }`),
 *   `action`, `redirect` (a page name such as `sign-up-successful-page`, opened in the visitor's
 *   language site, or a path), `method`, `defaultWidth` ('full' or 'half'), `intro` (true: text
 *   rows before the first field go beside the form), `submit` (`{ classes, fullWidthMobile }`; its
 *   text is the authored `submit` row, else "Submit" in the visitor's language)
 * @returns {{form: HTMLFormElement, intro: HTMLElement|null}}
 */
export function buildForm(block, definition) {
  const form = el('form', 'form-fields');
  const intro = definition.intro ? el('div', 'form-intro') : null;
  const texts = {};
  let buttonText = translate('formSubmit');

  [...block.children].forEach((row) => {
    const cells = [...row.children];
    if (!row.textContent.trim() && !row.querySelector('img, picture')) return;
    const name = cells[0]?.textContent.trim();
    const field = cells.length > 1 ? definition.fields[name] : null;
    if (!field) {
      if (cells.length > 1 && ['submit', 'success', 'error'].includes(name)) {
        const text = cells[1]?.textContent.trim();
        if (name === 'submit' && text) buttonText = text;
        else if (text) texts[name] = text;
        return;
      }
      // a line of text (a one-cell row, or a row with only its first cell filled)
      if (cells.slice(1).some((cell) => cell.textContent.trim())) return;
      const target = intro && !form.querySelector('.form-field') ? intro : el('div', 'form-content');
      target.append(...cells[0].childNodes);
      if (target !== intro) form.append(target);
      return;
    }
    const label = cells[1]?.textContent.trim();
    if (!label) return;
    const built = buildField({
      label,
      labelNodes: field.type === 'checkbox' ? labelNodesOf(cells[1]) : undefined,
      type: field.type,
      settings: fieldSettings(field, cells),
    }, { defaultWidth: definition.defaultWidth || 'full' });
    if (!built) return;
    if (field.newColumn) built.classList.add('new-column');
    form.append(built);
  });

  // the button
  const submit = el('div', 'form-submit');
  if (definition.submit?.fullWidthMobile) submit.classList.add('full-width-mobile');
  const button = el('button', ['button', ...(definition.submit?.classes || ['tertiary'])].join(' '));
  button.type = 'submit';
  button.textContent = buttonText;
  submit.append(button);

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
  form.append(summary, submit);

  // a field with `newColumn`: the rows before it fill the first column, it and the rows after it
  // (and the button) the second, side by side from 768px
  const secondStart = form.querySelector(':scope > .new-column');
  if (secondStart) {
    const columns = [el('div', 'form-column'), el('div', 'form-column')];
    let column = 0;
    [...form.children].filter((child) => child !== status && child !== summary).forEach((child) => {
      if (child === secondStart) column = 1;
      columns[column].append(child);
    });
    form.classList.add('has-columns');
    summary.before(...columns);
  }

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

  let submitting = false;
  // the button stays disabled from the click until the answer (or a failed check) is in; a button
  // shown as an icon keeps its text as its name
  const setBusy = (busy, sending = false) => {
    submitting = busy;
    form.toggleAttribute('aria-busy', busy);
    button.disabled = busy;
    button.textContent = sending ? translate('formSending') : buttonText;
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
    const before = new CustomEvent('forms:submit', { bubbles: true, cancelable: true, detail: { values, form } });
    const url = actionUrl(definition.action);
    if (!form.dispatchEvent(before) || !url) {
      setBusy(false);
      if (!url) showStatus(texts.error || translate('formError'));
      return;
    }

    setBusy(true, true);
    try {
      const res = await fetch(url, {
        method: definition.method || 'POST',
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
        showStatus(data?.serviceResponseMsg || data?.message || texts.error || translate('formError'));
        const code = Number(data?.serviceResponseCode) || res.status;
        form.dispatchEvent(new CustomEvent('forms:error', { bubbles: true, detail: { status: code, data, form } }));
        return;
      }
      form.dispatchEvent(new CustomEvent('forms:success', { bubbles: true, detail: { data, values, form } }));
      // sent: the form is emptied and its button back to normal (also when the visitor comes back)
      resetForm(form);
      if (definition.redirect) {
        window.location.assign(localPath(definition.redirect));
        return;
      }
      if (texts.success) {
        const done = el('p', 'form-success');
        done.setAttribute('role', 'status');
        done.textContent = texts.success;
        form.replaceWith(done);
      }
    } catch {
      showStatus(translate('formNetworkError'));
      form.dispatchEvent(new CustomEvent('forms:error', { bubbles: true, detail: { status: 0, form } }));
    } finally {
      setBusy(false);
    }
  });

  return { form, intro: intro?.childNodes.length ? intro : null };
}
