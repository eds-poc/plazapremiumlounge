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
  // the source's contact number: digits, +, - and /, at most 15, no country code
  contactNumber: {
    type: 'text', key: 'contactNumber', required: true, settings: { rule: 'phone', 'max length': 15 },
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
}
