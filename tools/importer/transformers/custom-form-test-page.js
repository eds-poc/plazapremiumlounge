/* eslint-disable */
/* global WebImporter */

/**
 * Transformer for the Custom Form test page (/en-uk/drafts/blocks/custom-form).
 * beforeTransform: keeps only the source's sign up form (#formBookingRegistration, parsed into a
 * Custom Form (two-columns) block).
 * afterTransform: adds the page title, the authoring guidelines (the block's rows, the field
 * types, the field and form settings, the validation rules and the options), then sample forms
 * for each option, every field type, the validation rules and the edge cases, and the metadata.
 * The sample forms have no action: on submit they check the fields, then show their error
 * message at the top ("nothing is sent").
 */

const DEMO_ERROR = 'error: This is a sample form: the fields are checked, but nothing is sent.';

function el(document, tag, text) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  return node;
}

/** Paragraphs, one per line (a settings cell). */
function lines(document, list) {
  return list.map((text) => el(document, 'p', text));
}

/** A bulleted list; an item is text, or [bold term, explanation]. */
function list(document, items) {
  const ul = el(document, 'ul');
  items.forEach((item) => {
    const li = el(document, 'li');
    if (Array.isArray(item)) {
      li.append(el(document, 'strong', item[0]), ` ${item[1]}`);
    } else {
      li.textContent = item;
    }
    ul.append(li);
  });
  return ul;
}

/** A label with a link in it (a checkbox label). */
function linkLabel(document, before, text, href, after = '') {
  const p = el(document, 'p', before);
  const a = el(document, 'a', text);
  a.href = href;
  p.append(a, after);
  return p;
}

/**
 * A Custom Form table. Rows: [label, type, settings[]] for a field, ['settings', settings[]] for
 * the form's settings row, [text] for a line of text.
 */
function form(document, options, rows) {
  const cells = rows.map((row) => {
    if (row.length === 1) return [typeof row[0] === 'string' ? el(document, 'p', row[0]) : row[0]];
    if (row[0] === 'settings') return ['Form', 'settings', lines(document, row[1])];
    const [label, type, settings] = row;
    return settings ? [label, type, lines(document, settings)] : [label, type];
  });
  const name = options ? `Custom Form (${options})` : 'Custom Form';
  return WebImporter.Blocks.createBlock(document, { name, cells });
}

function example(document, title, note, table) {
  return [el(document, 'h3', title), el(document, 'p', note), table];
}

export default function transform(hookName, element, payload) {
  const { document } = payload;

  if (hookName === 'beforeTransform') {
    const signUp = element.querySelector('#formBookingRegistration');
    if (!signUp) return;
    element.replaceChildren(signUp);
    return;
  }

  if (hookName !== 'afterTransform') return;
  const signUp = element.querySelector('table');
  if (!signUp) return;
  const hr = () => document.createElement('hr');
  const h2 = (text) => el(document, 'h2', text);
  const p = (text) => el(document, 'p', text);

  // page title and intro
  const intro = [
    el(document, 'h1', 'Custom Form'),
    p('An authorable form: each row of the block is a field, so authors add, remove and reorder fields, set their rules and messages, and choose the keys the form sends. Fields are checked as the visitor leaves them and again on submit; a valid form is posted as JSON to the form’s action, then the visitor goes to the redirect page, or sees the error message at the top of the form.'),
    hr(),
  ];

  // authoring guidelines
  const guide = [
    h2('Authoring guidelines'),
    el(document, 'h3', 'The block'),
    list(document, [
      ['Name:', 'Custom Form, with options in brackets, e.g. Custom Form (two-columns) or Custom Form (centered, compact).'],
      ['A field:', 'one row of three cells: the label | the type | the settings, one per line (key: firstName, required, rule: name...). A field without settings needs only the label and the type.'],
      ['The form’s settings:', 'one row whose second cell is settings (the first cell is free text, e.g. Form): action, redirect, success, error and method.'],
      ['Text between fields:', 'a row with one cell, e.g. a heading over the checkboxes.'],
      ['The button:', 'a row of the button text | submit | its style (primary, outline, tint, tertiary or white; tertiary when left out), large, arrow, and full width mobile to fill the width on phones.'],
      ['Order:', 'fields show in the order of the rows. Empty rows and fields without a label are left out.'],
    ]),
    el(document, 'h3', 'Field types'),
    list(document, [
      ['text, email, password, tel, number, date, url:', 'a one-line input. email, url and tel check their format; a password with the setting toggle gets a show/hide eye.'],
      ['textarea:', 'a box for a longer message.'],
      ['select:', 'a drop-down, with options: Mr. = Mr, Mrs. = Mrs (text = value; the value is the text when left out) and an optional placeholder for the empty first choice.'],
      ['radio:', 'one choice from options; checkboxes: several choices from options (sent as a list).'],
      ['checkbox:', 'a single tick box (e.g. the terms). Its label keeps its links.'],
      ['country:', 'a drop-down of the countries from the countries service, loaded with the page; sends the countryId unless value: says otherwise.'],
      ['phone:', 'the country code drop-down and the number in one field; the code shows +1 (US) once the countries are in. It sends two keys: the number (key) and the code (prefix key).'],
      ['hidden:', 'not shown; sends its value: (e.g. a source or campaign code).'],
      ['Any other type', 'is shown as text.'],
    ]),
    el(document, 'h3', 'Field settings'),
    list(document, [
      ['key:', 'the name the value is sent under (e.g. firstName). Left out, it is made from the label (First Name → firstName).'],
      ['value type:', 'string (default), number or boolean, e.g. the country id as a number, a checkbox as true or false.'],
      ['send: no', 'checks the field but leaves it out of what is sent (e.g. a confirmation field the service doesn’t want).'],
      ['width:', 'full, half or third, from 992px wide; new row starts the field on a new line. In a two-columns form fields are half width, except checkboxes, radios and text boxes.'],
      ['placeholder:, help:, default:', 'the hint in an empty field, a line of help under it, and its starting value (a choice by its text or value; true for a ticked checkbox).'],
      ['readonly, autocomplete:', 'a field visitors can’t change; the browser’s autofill hint (set for the usual sign up keys).'],
      ['phone only:', 'prefix key: (the code’s key, default the key + Code), prefix default: (+44 (GB), +44, or none), prefix value: and prefix text: (which country data gives the code’s value and text: phoneCode and phoneCodeCountryCode), prefix type: (the code’s value type).'],
      ['country only:', 'value: and text: (which country data gives the option value and text: countryId and countryName).'],
    ]),
    el(document, 'h3', 'Validation'),
    list(document, [
      ['required', 'or required: your message. A required field shows a red * and its error when the visitor leaves it empty.'],
      ['required if: key = value', 'is required only when another field has that value (e.g. required if: enquiryType = booking).'],
      ['rule:', 'name (letters, spaces, apostrophes and hyphens), email, password (8 to 15 characters with a lower case, an upper case letter and a number), phone (digits, +, - and /, at most 20), url, or postcode; rule message: replaces its message.'],
      ['min length:, max length:', 'the number of characters.'],
      ['pattern:', 'a regular expression the value must match, with pattern message:.'],
      ['min:, max:', 'for a number; min date:, max date: (YYYY-MM-DD or today) and min age: for a date.'],
      ['min selected:', 'the fewest checkboxes to tick.'],
      ['match: key', 'must equal another field (confirm email, confirm password), with match message:.'],
      ['message:', 'one message for every rule of the field; a rule’s own message (e.g. min length message:) wins.'],
      ['The form’s messages', 'come in the visitor’s language (English, Chinese, Japanese and Portuguese) unless authored.'],
    ]),
    el(document, 'h3', 'Form settings'),
    list(document, [
      ['action:', 'where the form is sent: a service name (signUp) or an address.'],
      ['method:', 'POST (default) or PUT.'],
      ['redirect:', 'the page shown after a successful send (e.g. /en-uk/sign-up-successful-page); on a Chinese page the visitor stays in the Chinese site.'],
      ['success:', 'without a redirect, a message that replaces the form after a successful send.'],
      ['error:', 'the message at the top of the form when the send fails. The service’s own message (e.g. An account with the given email already exists.) is shown when it gives one. The button is disabled from the click until the answer is in.'],
    ]),
    el(document, 'h3', 'Options'),
    list(document, [
      ['two-columns:', 'fields side by side, half width each, from 992px wide (the sign up form).'],
      ['narrow:', 'at most 650px wide, on the left.'],
      ['centered:', 'at most 650px wide, in the middle of the page.'],
      ['compact:', 'less space between the rows.'],
      ['No option:', 'one field per row, the full width of the page.'],
    ]),
    hr(),
  ];

  // the imported sign up form
  const signUpIntro = [
    h2('Sign Up (two-columns)'),
    p('The sign up form from the live site. It is sent to the sign up service: an email that is already registered shows the service’s message at the top, and a new account goes to the confirmation page.'),
  ];

  // options and field types
  const contact = form(document, '', [
    ['settings', [DEMO_ERROR]],
    ['Full Name', 'text', ['key: name', 'rule: name', 'required']],
    ['Email Address', 'email', ['key: email', 'required', 'help: We reply within two working days.']],
    ['Enquiry Type', 'select', ['key: enquiryType', 'placeholder: Please select', 'options: Lounge booking = booking, Membership = membership, Feedback = feedback, Other = other', 'required: Please select an enquiry type.']],
    ['Booking Reference', 'text', ['key: bookingReference', 'required if: enquiryType = booking', 'pattern: ^[A-Za-z0-9]{6,10}$', 'pattern message: A booking reference has 6 to 10 letters and numbers.', 'help: Needed for a lounge booking.']],
    ['Preferred Contact', 'radio', ['key: preferredContact', 'options: Email = email, Phone = phone', 'default: email']],
    ['Contact Number', 'phone', ['key: phone', 'prefix key: phoneCode', 'prefix default: +44 (GB)', 'required if: preferredContact = phone', 'rule: phone']],
    ['Message', 'textarea', ['key: message', 'required', 'min length: 20', 'max length: 500']],
    [linkLabel(document, 'I have read the ', 'Data Privacy & Security Policy', '/en-uk/data-privacy-and-security-policy', '.'), 'checkbox', ['key: isAgree', 'value type: boolean', 'required: Please accept the policy.']],
    ['Send Enquiry', 'submit', ['style: primary']],
  ]);

  const allTypes = form(document, 'two-columns', [
    ['settings', [DEMO_ERROR]],
    ['Text', 'text', ['key: text', 'placeholder: Any text']],
    ['Email', 'email', ['key: email']],
    ['Password', 'password', ['key: password', 'toggle', 'help: Use the eye to show it.']],
    ['Telephone', 'tel', ['key: tel']],
    ['Number of Guests', 'number', ['key: guests', 'value type: number', 'min: 1', 'max: 9']],
    ['Travel Date', 'date', ['key: travelDate', 'min date: today']],
    ['Website', 'url', ['key: website', 'placeholder: https://']],
    ['Campaign', 'hidden', ['key: campaign', 'value: drafts-test-page']],
    ['Lounge', 'select', ['key: lounge', 'placeholder: Please select', 'options: Hong Kong, London Heathrow, Singapore Changi']],
    ['Country of Residence', 'country', ['key: countryOfResidence', 'value type: number', 'default: United Kingdom']],
    ['Contact Number', 'phone', ['key: phone', 'prefix key: countryPhoneCode', 'value type: number']],
    ['City', 'text', ['key: city', 'width: third', 'new row']],
    ['Postcode', 'text', ['key: postcode', 'rule: postcode', 'width: third']],
    ['Member Number', 'text', ['key: memberNumber', 'width: third', 'readonly', 'default: ST-000123']],
    ['Comments', 'textarea', ['key: comments', 'placeholder: Anything else?']],
    ['Cabin Class', 'radio', ['key: cabin', 'options: Economy, Business, First']],
    ['Interests', 'checkboxes', ['key: interests', 'options: Dining = dining, Showers = showers, Spa = spa, Work space = work']],
    ['Send me offers and news', 'checkbox', ['key: isReceivePromotion', 'value type: boolean', 'default: true']],
    ['Check Fields', 'submit', ['style: outline']],
  ]);

  const rules = form(document, '', [
    ['settings', [DEMO_ERROR]],
    ['First Name', 'text', ['key: firstName', 'rule: name', 'required: Please fill in first name.']],
    ['Date of Birth', 'date', ['key: dateOfBirth', 'max date: today', 'min age: 18', 'min age message: You must be 18 or over to sign up.']],
    ['Membership Code', 'text', ['key: code', 'min length: 4', 'max length: 8', 'message: The code has 4 to 8 characters.']],
    ['Website', 'url', ['key: website', 'rule message: Please enter an address starting with https://']],
    ['Password', 'password', ['key: password', 'rule: password', 'required', 'toggle']],
    ['Confirm Password', 'password', ['key: confirmPassword', 'match: password', 'match message: The passwords do not match.', 'send: no', 'required']],
    ['Interests', 'checkboxes', ['key: interests', 'options: Dining, Showers, Spa, Work space', 'min selected: 2', 'required']],
    ['Check Fields', 'submit', ['style: tertiary', 'full width mobile']],
  ]);

  const narrow = form(document, 'narrow', [
    ['settings', [DEMO_ERROR]],
    ['Email Address', 'email', ['key: email', 'required']],
    ['Password', 'password', ['key: password', 'required', 'toggle']],
    ['Log In', 'submit', ['style: primary', 'full width mobile']],
  ]);

  const centered = form(document, 'centered', [
    ['settings', [DEMO_ERROR]],
    ['Full Name', 'text', ['key: name', 'rule: name', 'required']],
    ['Contact Number', 'phone', ['key: phone', 'prefix key: countryPhoneCode', 'required']],
    ['Best Time to Call', 'select', ['key: callTime', 'options: Morning, Afternoon, Evening', 'default: Afternoon']],
    ['Request a Call Back', 'submit', ['style: primary large']],
  ]);

  const compact = form(document, 'centered, compact', [
    ['settings', [DEMO_ERROR]],
    ['Sign up to our newsletter for the latest offers.'],
    ['Email Address', 'email', ['key: email', 'required', 'placeholder: name@example.com']],
    [linkLabel(document, 'I agree to the ', 'Terms & Conditions', '/en-uk/website-terms-of-use'), 'checkbox', ['key: isAgree', 'value type: boolean', 'required']],
    ['Subscribe', 'submit', ['style: tertiary arrow']],
  ]);

  // edge cases
  const noSettings = form(document, '', [
    ['Your Name', ''],
    ['Favourite Colour', 'colour', ['required']],
    ['', 'text', ['key: noLabel']],
    ['Send', 'submit'],
  ]);
  const noCode = form(document, 'narrow', [
    ['settings', [DEMO_ERROR]],
    ['Contact Number', 'phone', ['key: phone', 'prefix default: none', 'required']],
    ['Send', 'submit'],
  ]);

  const examples = [
    h2('Options'),
    ...example(document, 'No option: one column', 'An enquiry form at the full width. Booking Reference is required only for a lounge booking, and Contact Number only when Phone is the preferred contact; the phone code starts at +44 (GB).', contact),
    ...example(document, 'narrow', 'At most 650px wide, on the left, with a password eye and a button that fills the width on phones.', narrow),
    ...example(document, 'centered', 'At most 650px wide, in the middle, with a large button.', centered),
    ...example(document, 'centered, compact', 'Options combine: a centred newsletter form with less space between the rows and a line of text above the fields.', compact),
    hr(),
    h2('Every field type (two-columns)'),
    p('One field of each type. City, Postcode and Member Number are a third wide each; the hidden Campaign field is sent but not shown.'),
    allTypes,
    hr(),
    h2('Validation rules'),
    p('Leave a field or submit to see its message: an authored required message, a minimum age, a length with one message for every rule, a rule message, the password rule, a match (Confirm Password is checked but not sent) and a minimum number of choices.'),
    rules,
    hr(),
    h2('Other cases'),
    ...example(document, 'No settings row, missing cells and an unknown type', 'Your Name has no settings (key yourName), Favourite Colour has an unknown type and shows as text, and the row without a label is left out. Without an action, the form shows the default error message.', noSettings),
    ...example(document, 'Phone without a preset code', 'prefix default: none leaves the code empty; a number without a code asks for the country code.', noCode),
  ];

  const metadata = WebImporter.Blocks.createBlock(document, {
    name: 'Metadata',
    cells: { Title: 'Custom Form', Description: 'Test page and authoring guidelines for the Custom Form block.' },
  });

  element.prepend(...intro, ...guide, ...signUpIntro);
  signUp.after(hr(), ...examples, metadata);
}
