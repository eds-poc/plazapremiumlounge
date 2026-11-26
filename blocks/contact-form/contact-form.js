// eslint-disable-next-line import/no-cycle
import { PAGE_VIEW, pushEvent, setPageDetails } from '../../scripts/adobe-datalayer.js';
import { buildForm } from '../../scripts/forms.js';

/*
 * The contact us form's fields: the keys sent and the source's rules. The authoring only gives each
 * field's label, placeholder (and the dropdowns' options), required and error texts (see README).
 */
const FIELDS = {
  // which lounge (country) to reach, from the countries service (as Country of Residence), sent as
  // the country's name; the authored Placeholder cell is only its empty choice ("Select")
  location: {
    type: 'country', key: 'location', required: true, settings: { value: 'countryName' },
  },
  typeOfEnquiry: { type: 'select', key: 'typeOfEnquiry', required: true },
  title: { type: 'select', key: 'title' },
  firstName: {
    type: 'text', key: 'firstName', required: true, settings: { 'max length': 200 },
  },
  lastName: {
    type: 'text', key: 'lastName', required: true, settings: { 'max length': 200 },
  },
  // the contact number: numbers only (the number keypad on phones), at most 12, no country code
  contactNumber: {
    type: 'tel', key: 'contactNumber', required: true, settings: { rule: 'digits', 'max length': 12 },
  },
  countryOfResidence: {
    type: 'country', key: 'countryOfResidence', required: true, settings: { 'value type': 'number' },
  },
  // the second column starts here
  email: {
    type: 'email', key: 'email', required: true, newColumn: true, settings: { 'max length': 200 },
  },
  bookingReference: { type: 'text', key: 'bookingReference', settings: { 'max length': 200 } },
  message: { type: 'textarea', key: 'message', settings: { rows: 12 } },
  subscribeNewsletter: { type: 'checkbox', key: 'subscribeNewsletter', settings: { 'value type': 'boolean' } },
  consent: {
    type: 'checkbox', key: 'consent', required: true, settings: { 'value type': 'boolean' },
  },
};

/**
 * The data layer's "page load" page view for the contact us page: the page's name and site
 * section, an empty booking ID (no booking when the page opens) and the form's first step.
 */
function trackPageLoad() {
  // the page's name and site section, for this event and every one after it
  const pageName = 'contact us';
  setPageDetails({
    pageName,
    siteSection: 'home',
  });
  pushEvent(PAGE_VIEW, 'page load', {
    web: {
      webPageDetails: {
        name: pageName,
      },
    },
    _plazapremiumloungemanagementli: {
      bookingInfo: {
        bookingId: '',
      },
      formDetails: {
        formName: pageName,
        formStepName: `${pageName} start`,
      },
    },
  });
}

/**
 * The data layer's link click for Submit, as the form is sent (every field valid and the captcha
 * ticked): an empty booking ID and the form's submit step.
 */
function trackSubmit() {
  const formName = 'contact us';
  const eventName = `${formName} submit`;
  pushEvent('web.webInteraction.linkClicks', eventName, {
    web: {
      webInteraction: {
        name: eventName,
        type: 'other',
        linkClicks: {
          value: 1,
        },
      },
    },
    _plazapremiumloungemanagementli: {
      bookingInfo: {
        bookingId: '',
      },
      formDetails: {
        formName,
        formStepName: eventName,
      },
    },
  });
}

/**
 * The contact API's data: its keys first, from the form's fields (`name` the first and last name,
 * `email`, `subject` the chosen Type of Enquiry as shown, `message`), then every other field under
 * its own key and the captcha token. Changes the values sent (forms:submit's detail) in place.
 * @param {HTMLFormElement} form
 * @param {object} values
 */
function toContactApi(form, values) {
  const enquiry = form.querySelector('.form-field[data-key="typeOfEnquiry"] select');
  const api = {
    name: [values.firstName, values.lastName].filter(Boolean).join(' '),
    email: values.email,
    subject: enquiry?.selectedOptions[0]?.textContent.trim() || values.typeOfEnquiry || '',
    message: values.message,
  };
  const rest = { ...values };
  Object.keys(values).forEach((key) => delete values[key]);
  Object.assign(values, api, rest);
}

/**
 * Decorates the Contact Form block: the contact us form (the source /en-uk/contact-us). One
 * authored row per field (Field | Label | Placeholder | Required | Error), one-cell rows as text,
 * and the rows submit / success / error, and captcha (its Error cell: the message when the box
 * isn't ticked). Two columns from 768px (Email Address starts the second), a captcha before the
 * button (scripts/captcha.js), sent to the contact endpoint in the contact API's keys
 * (toContactApi).
 * @param {Element} block The Contact Form block element
 */
export default function decorate(block) {
  const { form } = buildForm(block, {
    fields: FIELDS,
    action: 'contact',
    captcha: true,
    submit: { classes: ['secondary', 'large', 'full-width'] },
  });
  block.replaceChildren(form);
  // the data layer's "page load", once the form is shown
  trackPageLoad();
  // the data layer's Submit click, as the form is sent (forms:submit comes after the checks)
  form.addEventListener('forms:submit', trackSubmit);
  // the contact API's keys, just before the data is sent
  form.addEventListener('forms:submit', (e) => toContactApi(form, e.detail.values));
}
