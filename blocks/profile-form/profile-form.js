import { buildForm, fieldElement, getCountries } from '../../scripts/forms.js';
import apiUrl from '../../scripts/endpoints.js';
import { authHeaders, logout } from '../../scripts/auth.js';
import { getLanguage, translate } from '../../scripts/i18n.js';

/*
 * The profile form's fields, each keyed by its GetProfile name. The authoring gives each field's
 * label, placeholder (and the dropdowns' options), required and error texts (see README).
 */
const FIELDS = {
  title: { type: 'select', key: 'salutation' },
  firstName: { type: 'text', key: 'firstName', settings: { readonly: '', 'max length': 300 } },
  lastName: { type: 'text', key: 'lastName', settings: { readonly: '', 'max length': 300 } },
  email: { type: 'email', key: 'userName', settings: { readonly: '', 'max length': 200 } },
  // the second box starts here
  phone: {
    type: 'phone',
    key: 'phone',
    newColumn: true,
    settings: { 'prefix key': 'countryPhoneCode', 'prefix default': '+1 (US)', 'max length': 12 },
  },
  birthday: { type: 'text', key: 'dob', settings: { disabled: '', width: 'half' } },
  ageRange: { type: 'select', key: 'ageRange', settings: { width: 'half' } },
  countryOfResidence: { type: 'country', key: 'countryOfResidence' },
  nationality: { type: 'country', key: 'nationality' },
  isReceivePromotion: { type: 'checkbox', key: 'isReceivePromotion', settings: { 'value type': 'boolean' } },
};

// GetProfile's country names where GetCountries spells them differently
const COUNTRY_ALIASES = {
  'united states': 'united states of america',
  usa: 'united states of america',
  'hong kong': 'hong kong sar china',
  macau: 'macau sar china',
  macao: 'macau sar china',
  korea: 'south korea',
  'republic of korea': 'south korea',
  'korea republic of': 'south korea',
  turkey: 'turkiye',
  'viet nam': 'vietnam',
};

/**
 * A country name for matching: lower case, no accents or punctuation ("Türkiye" → "turkiye").
 * @param {*} name
 * @returns {string}
 */
function countryKey(name) {
  const key = String(name || '').normalize('NFD').replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return COUNTRY_ALIASES[key] || key;
}

/**
 * A date (and time) as given ("2027-12-31 23:59:59"), written in the page's language format and
 * never moved to another time zone (the answer gives none): the English pages as the live site
 * ("12/31/2027 11:59:59 PM"). Anything else is shown as given.
 * @param {*} value
 * @param {boolean} [withTime]
 * @returns {string}
 */
function formatDate(value, withTime = true) {
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return value ? String(value) : '';
  const [, y, mo, d, h = '0', mi = '0', s = '0'] = m;
  // the given wall-clock time, read and written as UTC so no time zone shifts it
  const date = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  const lang = getLanguage();
  const locale = lang.startsWith('en') ? 'en-US' : lang;
  const day = new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
  if (!withTime || m[4] === undefined) return day;
  const time = new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC', hour: 'numeric', minute: '2-digit', second: '2-digit',
  }).format(date);
  return `${day} ${time}`;
}

/**
 * The points and their expiry, e.g. "150 (valid until 12/31/2027 11:59:59 PM)".
 * @param {object} profile
 * @returns {string}
 */
function pointsText(profile) {
  if (profile.points === null || profile.points === undefined) return '';
  if (!profile.pointsExpiry) return String(profile.points);
  return translate('profilePoints', { points: profile.points, date: formatDate(profile.pointsExpiry) });
}

// rows shown as text, not fields: their GetProfile value
const DETAILS = {
  membershipNo: (profile) => profile.membershipID,
  points: (profile) => pointsText(profile),
};

/**
 * Selects the option whose value is `value`, if the dropdown has it.
 * @param {HTMLSelectElement} select
 * @param {*} value
 */
function selectValue(select, value) {
  if (select && value !== null && value !== undefined
    && [...select.options].some((o) => o.value === String(value))) select.value = String(value);
}

/**
 * Fills the form from the GetProfile answer: the fields, the text rows, and (once the countries
 * are in) the countries and the phone code.
 * @param {HTMLFormElement} form
 * @param {object} profile
 * @param {Map<string, HTMLElement>} details The text rows' value elements, by row name
 */
function fill(form, profile, details) {
  const control = (key) => fieldElement(form, key)?.querySelector('.form-input:not(.form-phone-code), .form-check-input');
  ['firstName', 'lastName', 'userName'].forEach((key) => {
    const input = control(key);
    if (input) input.value = profile[key] ?? '';
  });
  selectValue(control('salutation'), profile.salutation);
  selectValue(control('ageRange'), profile.ageRange);
  const birthday = control('dob');
  if (birthday) birthday.value = formatDate(profile.dob, false);
  const phone = control('phone');
  if (phone) phone.value = profile.phone ?? '';
  const promotion = control('isReceivePromotion');
  if (promotion) promotion.checked = profile.isReceivePromotion === true;
  details.forEach((value, name) => { value.textContent = DETAILS[name](profile) ?? ''; });

  // the countries (GetCountries) by name, and the phone code; after the lists are filled
  getCountries().then((countries) => {
    const byName = (name) => countries.find((c) => countryKey(c.countryName) === countryKey(name));
    selectValue(control('countryOfResidence'), byName(profile.countryName)?.countryId);
    // the nationality only by a name (GetProfile gives no name for it yet)
    const nationality = profile.nationalityName
      ?? (typeof profile.nationality === 'string' ? profile.nationality : '');
    if (nationality) selectValue(control('nationality'), byName(nationality)?.countryId);
    const code = String(profile.countryPhoneCode ?? '').replace(/\D/g, '');
    const codeSelect = fieldElement(form, 'phone')?.querySelector('.form-phone-code');
    // a code several countries share (+1) keeps the default (+1 (US)) when it already is that code
    if (code && codeSelect && codeSelect.value !== `+${code}`) selectValue(codeSelect, `+${code}`);
  }).catch(() => { /* the fields show their own "couldn't load" with a retry */ });
}

/**
 * Decorates the Profile Form block: the member's profile form (the source Update Profile page),
 * filled from GetProfile with the logged-in token. Two boxes side by side (the one-cell rows before
 * the first field and before Contact Number are their titles), the membership number and points as
 * text, the newsletter checkbox and Save below. Save stays disabled until an update API exists.
 * @param {Element} block The Profile Form block element
 */
export default function decorate(block) {
  // the text rows (Field | Label): taken out before the form is built
  const detailRows = [...block.children]
    .filter((row) => DETAILS[row.children[0]?.textContent.trim()]);
  detailRows.forEach((row) => row.remove());

  const { form } = buildForm(block, {
    fields: FIELDS,
    submit: { classes: ['primary'] },
  });

  const [basic, optional] = form.querySelectorAll(':scope > .form-column');
  // the second box's title is the text row just before its first field
  if (basic?.lastElementChild?.matches('.form-content')) optional?.prepend(basic.lastElementChild);
  // each box in its own column (the source's .col-md-6 > .boxLiner)
  [basic, optional].filter(Boolean).forEach((box) => {
    const column = document.createElement('div');
    column.className = 'profile-form-column';
    box.replaceWith(column);
    column.append(box);
  });
  // the text rows, after the email field
  const details = new Map();
  const email = fieldElement(form, 'userName');
  [...detailRows].reverse().forEach((row) => {
    const name = row.children[0].textContent.trim();
    const item = document.createElement('div');
    item.className = 'profile-detail';
    const label = document.createElement('p');
    label.className = 'profile-detail-label';
    label.textContent = row.children[1]?.textContent.trim() || '';
    const value = document.createElement('p');
    value.className = 'profile-detail-value';
    item.append(label, value);
    details.set(name, value);
    if (email) email.after(item); else basic?.append(item);
  });
  // the newsletter checkbox and Save below the boxes
  const promotion = fieldElement(form, 'isReceivePromotion');
  const submit = form.querySelector('.form-submit');
  form.append(...[promotion, submit].filter(Boolean));
  // nothing is sent until the update API exists
  const save = submit?.querySelector('button');
  if (save) {
    save.disabled = true;
    save.setAttribute('aria-disabled', 'true');
  }

  const message = document.createElement('p');
  message.className = 'profile-message';
  message.setAttribute('role', 'status');
  block.replaceChildren(message, form);

  const load = () => {
    message.replaceChildren(translate('profileLoading'));
    message.hidden = false;
    form.setAttribute('aria-busy', 'true');
    fetch(apiUrl('getProfile'), { headers: authHeaders() })
      .then((res) => {
        // the token refused (invalid or expired): log out and go home
        if (res.status === 401) {
          logout();
          return null;
        }
        return res.json().then((data) => {
          if (!res.ok || !data || Number(data.serviceResponseCode) >= 400) throw new Error('profile');
          return data;
        });
      })
      .then((profile) => {
        if (!profile) return;
        fill(form, profile, details);
        message.hidden = true;
        form.removeAttribute('aria-busy');
      })
      .catch(() => {
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'profile-retry';
        retry.textContent = translate('formRetry');
        retry.addEventListener('click', load);
        message.replaceChildren(`${translate('profileLoadError')} `, retry);
        form.removeAttribute('aria-busy');
      });
  };
  load();
}
