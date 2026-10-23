import { buildForm } from '../../scripts/forms.js';

/*
 * The sign up form's fields: the Register API's keys and value types, and the source's rules. The
 * authoring only gives each field's label, placeholder, required and error texts (see README).
 */
const FIELDS = {
  title: { type: 'select', key: 'title' },
  firstName: {
    type: 'text', key: 'firstName', required: true, settings: { rule: 'name', 'max length': 50, 'new row': '' },
  },
  lastName: {
    type: 'text', key: 'lastName', required: true, settings: { rule: 'name', 'max length': 200 },
  },
  countryOfResidence: {
    type: 'country', key: 'countryOfResidence', required: true, settings: { value: 'countryId', 'value type': 'number' },
  },
  // the code (countryPhoneCode) and the number (phone), +1 (US) to start with, following the
  // country of residence
  phone: {
    type: 'phone',
    key: 'phone',
    required: true,
    settings: { 'prefix key': 'countryPhoneCode', 'prefix default': '+1 (US)', 'value type': 'number' },
  },
  email: {
    type: 'email', key: 'email', required: true, settings: { 'max length': 200 },
  },
  confirmEmail: {
    type: 'email', key: 'confirmEmail', required: true, settings: { match: 'email', 'max length': 200 },
  },
  password: {
    type: 'password', key: 'password', required: true, settings: { rule: 'password' },
  },
  confirmPassword: {
    type: 'password', key: 'confirmPassword', required: true, settings: { match: 'password' },
  },
  isReceivePromotion: { type: 'checkbox', key: 'isReceivePromotion', settings: { 'value type': 'boolean' } },
  isAgree: {
    type: 'checkbox', key: 'isAgree', required: true, settings: { 'value type': 'boolean' },
  },
};

/**
 * Decorates the Signup Form block: the sign up form (the source /en-uk/sign-up). One authored row
 * per field (Field | Label | Placeholder | Required | Error), one-cell rows as text, and the rows
 * submit / error. Sent to the Register API (endpoint signUp), then the confirmation page in the
 * visitor's language. Fields half width from 992px (Title alone), one column below.
 * @param {Element} block The Signup Form block element
 */
export default async function decorate(block) {
  const { form } = await buildForm(block, {
    fields: FIELDS,
    action: 'signUp',
    redirect: '/en-uk/sign-up-successful-page',
    defaultWidth: 'half',
    submit: { classes: ['tertiary'], fullWidthMobile: true, text: 'Create Account' },
  });
  block.replaceChildren(form);
}
