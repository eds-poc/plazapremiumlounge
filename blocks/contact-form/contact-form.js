// eslint-disable-next-line import/no-cycle
import { PAGE_VIEW, pushEvent, setPageDetails } from '../../scripts/datalayer.js';
import { buildForm } from '../../scripts/forms.js';

/*
 * The contact us form's fields: the keys sent and the source's rules. The authoring only gives each
 * field's label, placeholder (and the dropdowns' options), required and error texts (see README).
 */
const FIELDS = {
  location: { type: 'select', key: 'location', required: true },
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
 * Decorates the Contact Form block: the contact us form (the source /en-uk/contact-us). One
 * authored row per field (Field | Label | Placeholder | Required | Error), one-cell rows as text,
 * and the rows submit / success / error, and captcha (its Error cell: the message when the box
 * isn't ticked). Two columns from 768px (Email Address starts the second), a captcha before the
 * button (scripts/captcha.js), sent to the contact endpoint.
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
}
