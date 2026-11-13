// eslint-disable-next-line import/no-cycle
import { PAGE_VIEW, pushEvent, setPageDetails } from '../../scripts/datalayer.js';
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
  // country of residence; the number: numbers only (the number keypad on phones), at most 12
  phone: {
    type: 'phone',
    key: 'phone',
    required: true,
    settings: {
      'prefix key': 'countryPhoneCode', 'prefix default': '+1 (US)', 'value type': 'number', rule: 'digits', 'max length': 12,
    },
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
 * The data layer's "page load" page view for the sign up page: the page's name and site section,
 * and the form's first step.
 */
function trackPageLoad() {
  // the page's name and site section, for this event and every one after it
  const pageName = 'sign up | plaza premium lounge';
  setPageDetails({
    pageName,
    siteSection: 'signup',
  });
  const formName = 'signup';
  pushEvent(PAGE_VIEW, 'page load', {
    web: {
      webPageDetails: {
        name: pageName,
      },
    },
    _plazapremiumloungemanagementli: {
      formDetails: {
        formName,
        formStepName: `${formName} start`,
      },
    },
  });
}

/**
 * The data layer's link click for Create Account (the form's submit), as the form is sent (every
 * field valid): the form's create account step.
 */
function trackCreateAccount() {
  const eventName = 'create account';
  const formName = 'signup';
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
      formDetails: {
        formName,
        formStepName: `${formName} ${eventName}`,
      },
    },
  });
}

/**
 * The data layer's link click for a successful sign up (the Register API accepted it): the form's
 * success step, the sign up source and the new member's identities from the answer, when there
 * (membershipId, hashedEmail, hashedPhone).
 * @param {Object} data The Register API's answer
 */
function trackSignupSuccess(data) {
  const eventName = 'signup success';
  const identities = {};
  if (data?.membershipId) identities.stMemberId = String(data.membershipId);
  if (data?.hashedEmail) identities.hashedEmail = data.hashedEmail;
  if (data?.hashedPhone) identities.hashedPhone = data.hashedPhone;
  const details = {
    formDetails: {
      formName: 'signup',
      formStepName: eventName,
    },
    userInfo: {
      signupSource: 'ppl',
    },
  };
  if (Object.keys(identities).length) details.identities = identities;
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
    _plazapremiumloungemanagementli: details,
  });
}

/**
 * Decorates the Signup Form block: the sign up form (the source /en-uk/sign-up). One authored row
 * per field (Field | Label | Placeholder | Required | Error), one-cell rows as text, and the rows
 * submit / error. Sent to the Register API (endpoint signUp), then the confirmation page in the
 * visitor's language. Fields half width from 992px (Title alone), one column below.
 * @param {Element} block The Signup Form block element
 */
export default function decorate(block) {
  const { form } = buildForm(block, {
    fields: FIELDS,
    action: 'signUp',
    // the confirmation page in the visitor's language site (/zh-cn/… on /zh-cn/sign-up)
    redirect: 'sign-up-successful-page',
    defaultWidth: 'half',
    submit: { classes: ['tertiary'], fullWidthMobile: true },
  });
  block.replaceChildren(form);
  // the data layer's "page load", once the form is shown
  trackPageLoad();
  // the data layer's Create Account click, as the form is sent (forms:submit: after the checks)
  form.addEventListener('forms:submit', trackCreateAccount);
  // the data layer's successful sign up, with the Register API's answer (before the next page)
  form.addEventListener('forms:success', (e) => trackSignupSuccess(e.detail.data));
}
