/* eslint-disable */
/* global WebImporter */

/**
 * Parser for the custom-form block, option two-columns.
 * Source: https://www.plazapremiumlounge.com/en-uk/sign-up
 * Selector: #formBookingRegistration
 * Model: a settings row (action, redirect, error), then one row per field: label | type |
 * settings (one per line: key, required message, rules, width...). The keys are the sign up API
 * payload's (title, firstName, ..., isAgree); the messages and limits are the source's own
 * (data-val-* attributes). Lines between fields are one-cell rows; the button is a submit row.
 */

// source field name -> label override, type and settings (payload key first)
const FIELDS = {
  Title: {
    type: 'select',
    settings: ['key: title', 'options: Mr. = Mr, Mrs. = Mrs, Ms. = Ms, Miss = Miss'],
  },
  FirstName: {
    type: 'text', settings: ['key: firstName', 'rule: name', 'required: Please fill in first name.', 'new row'],
  },
  LastName: { type: 'text', settings: ['key: lastName', 'rule: name'] },
  CountryOfResidence: {
    type: 'country', settings: ['key: countryOfResidence', 'value: countryId', 'value type: number'],
  },
  ContactNumber: {
    type: 'phone',
    settings: ['key: phone', 'prefix key: countryPhoneCode', 'prefix default: +1 (US)', 'value type: number'],
  },
  EmailAddress: { type: 'email', settings: ['key: email'] },
  ConfirmEmailAddress: { type: 'email', settings: ['key: confirmEmail', 'match: email'] },
  Password: { type: 'password', settings: ['key: password', 'rule: password'] },
  ConfirmPassword: { type: 'password', settings: ['key: confirmPassword', 'match: password'] },
  SubscribeNewsletter: { type: 'checkbox', settings: ['key: isReceivePromotion', 'value type: boolean'] },
  AgreeTNC: {
    type: 'checkbox',
    settings: ['key: isAgree', 'value type: boolean', 'required: Please accept the Terms & Conditions and Privacy Policy.'],
  },
};

function lines(document, list) {
  return list.map((text) => {
    const p = document.createElement('p');
    p.textContent = text;
    return p;
  });
}

function text(node) {
  return (node?.textContent || '').replace(/\s+/g, ' ').replace(/\s*\*\s*$/, '').trim();
}

export default function parse(element, { document }) {
  const cells = [];
  cells.push([
    'Form', 'settings',
    lines(document, [
      'action: signUp',
      'redirect: /en-uk/sign-up-successful-page',
      "error: Sorry, we couldn't create your account. Please try again.",
    ]),
  ]);

  // the controls in page order, each with the heading line before it (for the checkboxes)
  const controls = Array.from(element.querySelectorAll('select[name], input[name]'))
    .filter((c) => FIELDS[c.getAttribute('name')]);
  controls.forEach((control) => {
    const name = control.getAttribute('name');
    const def = FIELDS[name];
    const id = control.getAttribute('id');
    // the label: linked by for=, else the nearest one above the control (the phone widget wraps
    // its input, so its label isn't linked)
    let labelEl = (id && element.querySelector(`label[for="${id}"]`))
      || element.querySelector(`label[for="${name}"]`)
      || control.closest('.form-check')?.querySelector('label');
    // only within the control's own wrapper: stop before an ancestor holding another field
    for (let up = control.parentElement; !labelEl && up && up !== element; up = up.parentElement) {
      const others = [...up.querySelectorAll('select[name], input[name]')]
        .filter((c) => c !== control && c.type !== 'hidden');
      if (others.length) break;
      labelEl = up.querySelector('label');
    }

    // a line of text just before a checkbox (e.g. "Terms & Conditions and Privacy Policy")
    if (def.type === 'checkbox') {
      const box = control.closest('.form-check') || control.parentElement;
      let prev = box?.previousElementSibling;
      while (prev && !prev.textContent.trim()) prev = prev.previousElementSibling;
      if (prev && prev.matches('p, h4, h5, h6, strong, div') && !prev.querySelector('input')) {
        const p = document.createElement('p');
        p.textContent = text(prev);
        cells.push([p]);
      }
    }

    // the label: text, or for a checkbox its nodes (keeping its links)
    let labelCell;
    if (def.type === 'checkbox') {
      const p = document.createElement('p');
      Array.from((labelEl || control.nextElementSibling)?.childNodes || []).forEach((node) => {
        if (node.nodeType === 1 && node.matches('a[href]')) {
          const a = document.createElement('a');
          a.href = node.getAttribute('href');
          a.textContent = node.textContent.trim();
          p.append(a);
        } else {
          p.append(node.textContent.replace(/\s+/g, ' '));
        }
      });
      p.innerHTML = p.innerHTML.trim();
      labelCell = p;
    } else {
      labelCell = text(labelEl) || name;
    }

    // the source's own messages and limits
    const settings = [...def.settings];
    const required = control.getAttribute('data-val-required');
    if (required && !settings.some((s) => s.startsWith('required'))) settings.push(`required: ${required}`);
    const equalTo = control.getAttribute('data-val-equalto');
    if (equalTo) settings.push(`match message: ${equalTo}`);
    const maxLength = control.getAttribute('data-val-maxlength-max');
    if (maxLength && !['password', 'phone', 'select', 'country'].includes(def.type)) settings.push(`max length: ${maxLength}`);
    const regex = control.getAttribute('data-val-regex');
    if (regex && def.type === 'phone') settings.push(`rule message: ${regex}`);
    if (regex && name === 'Password') settings.push(`rule message: ${regex}`);

    cells.push([labelCell, def.type, lines(document, settings)]);
  });

  const button = element.querySelector('button[type="submit"]');
  cells.push([text(button) || 'Create Account', 'submit', lines(document, ['style: tertiary', 'full width mobile'])]);

  const block = WebImporter.Blocks.createBlock(document, { name: 'Custom Form (two-columns)', cells });
  element.replaceWith(block);
}
