import {
  buildForm, datePickerOf, fieldElement, setFieldError, setFieldRequired,
} from '../../scripts/forms.js';
import buildDatePicker from '../../scripts/date-picker.js';
import { formatDate } from '../../scripts/booking.js';
import { DEFAULT_SITE, getSiteFolder } from '../../scripts/i18n.js';

/*
 * The forms' fields: the keys sent and the source's rules. The authoring gives each field's label,
 * placeholder (the dropdowns' and the services' options, the stepper's unit), required and error
 * texts (see README). The fields both forms share first.
 */
const PERSON = {
  emailAddress: {
    type: 'email', key: 'emailAddress', required: true, settings: { 'max length': 200 },
  },
  title: { type: 'select', key: 'title', required: true },
  firstName: {
    type: 'text', key: 'firstName', required: true, settings: { 'max length': 200 },
  },
  lastName: {
    type: 'text', key: 'lastName', required: true, settings: { 'max length': 200 },
  },
  // numbers only (the number keypad on phones), at most 12, no country code
  contactNumber: {
    type: 'tel', key: 'contactNumber', required: true, settings: { rule: 'digits', 'max length': 12 },
  },
  // the countries from the country sheet (below), sent as the Country Code; the authored
  // Placeholder cell is only the empty choice ("Select")
  locationOfService: { type: 'select', key: 'locationOfService', required: true },
  // the chosen country's areas from the area sheet (below), sent as their Value; a choice is
  // asked for once the list has areas
  areaOfService: { type: 'select', key: 'locationOfServiceCity' },
  servicesRequired: { type: 'checkboxes', key: 'servicesRequired', required: true },
  // the second column starts here
  noOfAdults: {
    type: 'select', key: 'noOfAdults', required: true, newColumn: true, settings: { width: 'half', 'value type': 'number' },
  },
  noOfChildren: {
    type: 'select', key: 'noOfChildren', settings: { width: 'half', 'value type': 'number' },
  },
  serviceStartDate: {
    type: 'date', key: 'serviceStartDate', required: true, settings: { 'min date': 'today', picker: '' },
  },
  consent: {
    type: 'checkbox', key: 'consent', required: true, settings: { 'value type': 'boolean' },
  },
};

// a time stepper: − and + by half an hour from a start (minutes in the day)
const timeAt = (key, minutes, extra = {}) => ({
  type: 'stepper',
  key,
  settings: {
    format: 'time', step: 30, default: minutes, ...extra,
  },
});

// the Location of Service countries and their areas of service: two of the site's sheets, one row
// per country (Country Code, then its name in each language: en-uk, zh-cn, …) and one per area
// (Country Code, Value as sent, then its name in each language); each read once per page
const SHEETS = { countries: '/data/country.json', areas: '/data/area-of-service.json' };
const sheets = {};

/**
 * A sheet's rows; after a failure the next call tries again.
 * @param {'countries'|'areas'} name
 * @returns {Promise<object[]>}
 */
function readSheet(name) {
  if (!sheets[name]) {
    sheets[name] = fetch(SHEETS[name])
      .then((res) => {
        if (!res.ok) throw new Error(`${SHEETS[name]}: HTTP ${res.status}`);
        return res.json();
      })
      .then((sheet) => (Array.isArray(sheet?.data) ? sheet.data : []));
    sheets[name].catch(() => { delete sheets[name]; });
  }
  return sheets[name];
}

// a row's country code, and its name in the page's language (else in English)
const codeOf = (row) => String(row['Country Code'] ?? '').trim().toUpperCase();
const nameOf = (row) => String(row[getSiteFolder()] || row[DEFAULT_SITE] || '').trim();
const option = (value, text) => Object.assign(document.createElement('option'), { value, textContent: text });

const FORMS = {
  // option group-form, the source /en-uk/group-booking: at least 10 people, a start and a length
  // of stay; the captcha and the button under the two columns
  'group-form': {
    action: 'groupBooking',
    minPeople: 10,
    fields: {
      ...PERSON,
      // from 6:00 PM; by half an hour from 3.5 to between 2 and 18 hours
      serviceStartTime: timeAt('serviceStartTime', 1080, { width: 'half' }),
      lengthOfStay: {
        type: 'stepper',
        key: 'lengthOfStay',
        settings: {
          min: 2, max: 18, step: 0.5, default: 3.5, width: 'half', 'value type': 'number',
        },
      },
      remarks: { type: 'textarea', key: 'remarks', settings: { rows: 18 } },
      subscribeNewsletter: { type: 'checkbox', key: 'subscribeNewsletter', settings: { 'value type': 'boolean' } },
    },
  },
  // the block itself, the source /en-uk/makeabooking (Lounge Booking Request): a start and an end,
  // the membership number, the private resting areas and the travel type; the captcha and the
  // button stay in the second column
  'booking-request': {
    action: 'bookingRequest',
    keepCaptcha: true,
    // only the countries with areas of service (as the source)
    areasOnly: true,
    // the source's large button (44px)
    submit: ['secondary', 'large', 'full-width'],
    fields: {
      ...PERSON,
      smartTravellerMembershipNumber: {
        type: 'text', key: 'smartTravellerMembershipNumber', settings: { 'max length': 200 },
      },
      numberOfPrivateRestingAreas: { type: 'select', key: 'numberOfPrivateRestingAreas', required: true },
      travelType: { type: 'select', key: 'travelType', required: true },
      // from 10:00 AM and 11:00 AM
      serviceStartTime: timeAt('serviceStartTime', 600),
      serviceEndDate: {
        type: 'date', key: 'serviceEndDate', required: true, settings: { 'min date': 'today', picker: '' },
      },
      serviceEndTime: timeAt('serviceEndTime', 660),
      remarks: { type: 'textarea', key: 'remark', settings: { rows: 12 } },
    },
  },
};

/**
 * Decorates the Booking Form block: the lounge booking request form (the source
 * /en-uk/makeabooking), or with the option `group-form` the group booking request form (the source
 * /en-uk/group-booking). One authored row per field (Field | Label | Placeholder | Required |
 * Error), and the rows submit / success / error / captcha, as the Contact Form; the row `people`
 * (its Error cell) is the group booking's message when there are fewer than 10 people. Two columns
 * from 768px (No. of Adults starts the second); the group booking's captcha and button under them.
 * The countries and their areas of service come from the data/country and data/area-of-service
 * sheets, in the page's language.
 * @param {Element} block The Booking Form block element
 */
export default function decorate(block) {
  const name = block.classList.contains('group-form') ? 'group-form' : 'booking-request';
  const config = FORMS[name];
  // the authored Error lines of a row (for the checks made here, not by the form)
  const errorsOf = (row) => {
    const cell = [...block.children]
      .find((r) => r.firstElementChild?.textContent.trim() === row)?.children[4];
    if (!cell) return [];
    const lines = cell.querySelectorAll('p');
    return (lines.length ? [...lines] : [cell]).map((p) => p.textContent.trim()).filter(Boolean);
  };
  const peopleMessage = errorsOf('people')[0]
    || `Please select a minimum total of ${config.minPeople} people (adults and children combined)`;
  const areaMessage = errorsOf('areaOfService')[0];
  const endMessage = errorsOf('serviceEndDate')[1]
    || 'Please select a service end date on or after the service start date';

  const { form } = buildForm(block, {
    fields: config.fields,
    action: config.action,
    captcha: true,
    // the dates on the site's calendar, from today (as the Booking Widget's)
    datePicker: { build: buildDatePicker, format: formatDate },
    submit: { classes: config.submit || ['secondary', 'full-width'] },
  });

  // the group booking's captcha and button under the two columns, side by side from 768px (as
  // the source)
  if (!config.keepCaptcha) {
    form.querySelectorAll(':scope > .form-column :is(.form-captcha, .form-submit)')
      .forEach((part) => form.querySelector(':scope > .visually-hidden').before(part));
  }

  // the countries, in the page's language (the lounge booking request: only those with areas);
  // the field keeps its empty choice, and its authored list if the sheets can't be read
  const location = fieldElement(form, 'locationOfService')?.querySelector('select');
  if (location) {
    Promise.all([readSheet('countries'), readSheet('areas')]).then(([countries, areaRows]) => {
      const withAreas = new Set(areaRows.map(codeOf));
      const list = countries.filter((row) => codeOf(row) && nameOf(row)
        && (!config.areasOnly || withAreas.has(codeOf(row))));
      if (!list.length) return;
      [...location.options].slice(1).forEach((old) => old.remove());
      location.append(...list.map((row) => option(codeOf(row), nameOf(row))));
    }).catch(() => { /* the authored list, if any, stays */ });
  }

  // the areas of the chosen country; the field asks for a choice once its list has areas (its *
  // as on the other required fields)
  const areaField = fieldElement(form, 'locationOfServiceCity');
  const area = areaField?.querySelector('select');
  const star = Object.assign(document.createElement('span'), { className: 'form-required', textContent: ' *' });
  star.setAttribute('aria-hidden', 'true');
  areaField?.querySelector('.form-label').append(star);
  // (only the latest choice fills the list, if the sheet answers after a second change)
  let choice = 0;
  location?.addEventListener('change', () => {
    choice += 1;
    const current = choice;
    [...area.options].slice(1).forEach((old) => old.remove());
    setFieldRequired(areaField, null);
    if (!location.value) return;
    readSheet('areas').then((rows) => {
      if (current !== choice) return;
      const list = rows.filter((row) => codeOf(row) === location.value && row.Value);
      area.append(...list.map((row) => {
        const value = String(row.Value).trim();
        return option(value, nameOf(row) || value);
      }));
      // with areas, a choice is required, checked with the other fields
      if (list.length) setFieldRequired(areaField, areaMessage || '');
    }).catch(() => { /* no areas: the field stays empty and optional */ });
  });

  // the group booking: at least 10 people, adults and children together (as the visitor chooses,
  // and on submit)
  const adults = fieldElement(form, 'noOfAdults');
  const children = fieldElement(form, 'noOfChildren');
  const enough = () => !config.minPeople || Number(adults.querySelector('select').value || 0)
    + Number(children.querySelector('select').value || 0) >= config.minPeople;
  if (config.minPeople) {
    [adults, children].forEach((wrap) => wrap.addEventListener('change', () => {
      if (!adults.querySelector('select').value) return;
      setFieldError(adults, enough() ? '' : peopleMessage);
    }));
  }

  // the booking request: the end date not before the start date (its calendar starts there, and
  // an end date before a new start moves up to it)
  const start = fieldElement(form, 'serviceStartDate')?.querySelector('input');
  const endField = fieldElement(form, 'serviceEndDate');
  const end = endField?.querySelector('input');
  const endTooEarly = () => !!(end?.value && start.value && end.value < start.value);
  if (end) {
    // after the form's own check of the field (which would clear the message)
    const checkEnd = () => setTimeout(() => {
      if (endTooEarly()) setFieldError(endField, endMessage);
    });
    start.addEventListener('change', () => {
      if (!start.value) return;
      datePickerOf(endField)?.update({
        min: start.value, value: end.value && end.value < start.value ? start.value : undefined,
      });
      checkEnd();
    });
    end.addEventListener('change', checkEnd);
  }

  form.addEventListener('forms:submit', (e) => {
    if (!enough()) setFieldError(adults, peopleMessage);
    if (endTooEarly()) setFieldError(endField, endMessage);
    const first = [!enough() && adults.querySelector('select'), endTooEarly() && end].find(Boolean);
    if (first) {
      e.preventDefault();
      first.focus();
    }
  });

  block.replaceChildren(form);
}
