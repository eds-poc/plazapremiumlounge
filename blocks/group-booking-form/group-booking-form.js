import { buildForm, fieldElement, setFieldError } from '../../scripts/forms.js';
import apiUrl from '../../scripts/endpoints.js';
import { getApiLanguage } from '../../scripts/properties.js';

/*
 * The group booking form's fields: the keys sent and the source's rules. The authoring gives each
 * field's label, placeholder (the dropdowns' and the services' options, the stepper's unit),
 * required and error texts (see README).
 */
const FIELDS = {
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
  locationOfService: { type: 'select', key: 'locationOfService', required: true },
  // filled for the chosen location (below); a choice is asked for once the list has areas
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
    type: 'date', key: 'serviceStartDate', required: true, settings: { 'min date': 'today' },
  },
  // − and + by half an hour from 6:00 PM; by half an hour from 3.5 to between 2 and 18 hours
  serviceStartTime: {
    type: 'stepper',
    key: 'serviceStartTime',
    settings: {
      format: 'time', step: 30, default: 1080, width: 'half',
    },
  },
  lengthOfStay: {
    type: 'stepper',
    key: 'lengthOfStay',
    settings: {
      min: 2, max: 18, step: 0.5, default: 3.5, width: 'half', 'value type': 'number',
    },
  },
  remarks: { type: 'textarea', key: 'remarks', settings: { rows: 18 } },
  subscribeNewsletter: { type: 'checkbox', key: 'subscribeNewsletter', settings: { 'value type': 'boolean' } },
  consent: {
    type: 'checkbox', key: 'consent', required: true, settings: { 'value type': 'boolean' },
  },
};

// the source's smallest group: adults and children together
const MIN_PEOPLE = 10;

/**
 * Decorates the Group Booking Form block: the group booking request form (the source
 * /en-uk/group-booking). One authored row per field (Field | Label | Placeholder | Required |
 * Error), and the rows submit / success / error / captcha, as the Contact Form; the row `people`
 * (its Error cell) is the message when there are fewer than 10 people. Two columns from 768px (No.
 * of Adults starts the second), the captcha and the button under them, sent to the groupBooking
 * endpoint. The areas of service follow the chosen location (the groupBookingAreas endpoint).
 * @param {Element} block The Group Booking Form block element
 */
export default function decorate(block) {
  // the authored Error texts of the people row and the area field (checked here, not by the form)
  const errorOf = (name) => [...block.children]
    .find((row) => row.firstElementChild?.textContent.trim() === name)?.children[4]?.textContent.trim() || '';
  const peopleMessage = errorOf('people')
    || `Please select a minimum total of ${MIN_PEOPLE} people (adults and children combined)`;
  const areaMessage = errorOf('areaOfService');

  const { form } = buildForm(block, {
    fields: FIELDS,
    action: 'groupBooking',
    captcha: true,
    submit: { classes: ['secondary', 'full-width'] },
  });

  // the captcha and the button under the two columns, side by side from 768px (as the source)
  form.querySelectorAll(':scope > .form-column :is(.form-captcha, .form-submit)')
    .forEach((part) => form.querySelector(':scope > .visually-hidden').before(part));

  // the areas of the chosen location; the field asks for a choice once its list has areas (its *
  // as on the other required fields)
  const location = fieldElement(form, 'locationOfService')?.querySelector('select');
  const areaField = fieldElement(form, 'locationOfServiceCity');
  const area = areaField?.querySelector('select');
  const star = Object.assign(document.createElement('span'), { className: 'form-required', textContent: ' *' });
  star.setAttribute('aria-hidden', 'true');
  areaField?.querySelector('.form-label').append(star);
  let pending;
  location?.addEventListener('change', () => {
    pending?.abort();
    pending = new AbortController();
    [...area.options].slice(1).forEach((option) => option.remove());
    if (!location.value) return;
    fetch(apiUrl('groupBookingAreas'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationOfService: location.value, languageCode: getApiLanguage() }),
      signal: pending.signal,
    })
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => (Array.isArray(data?.items) ? data.items : []).forEach((item) => {
        if (!item?.value) return;
        area.append(Object.assign(document.createElement('option'), {
          value: String(item.value), textContent: String(item.text || item.value),
        }));
      }))
      .catch(() => { /* no areas: the field stays empty and optional */ });
  });

  // at least 10 people, adults and children together (as the visitor chooses, and on submit)
  const adults = fieldElement(form, 'noOfAdults');
  const children = fieldElement(form, 'noOfChildren');
  const enough = () => {
    const total = Number(adults.querySelector('select').value || 0)
      + Number(children.querySelector('select').value || 0);
    return total >= MIN_PEOPLE;
  };
  [adults, children].forEach((wrap) => wrap.addEventListener('change', () => {
    if (!adults.querySelector('select').value) return;
    setFieldError(adults, enough() ? '' : peopleMessage);
  }));
  form.addEventListener('forms:submit', (e) => {
    const missingArea = area?.options.length > 1 && !area.value;
    if (missingArea) setFieldError(areaField, areaMessage || area.options[0].textContent);
    if (!enough()) setFieldError(adults, peopleMessage);
    if (missingArea || !enough()) {
      e.preventDefault();
      (missingArea ? area : adults.querySelector('select')).focus();
    }
  });

  block.replaceChildren(form);
}
