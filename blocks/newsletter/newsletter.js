import { getMetadata } from '../../scripts/aem.js';
import { buildForm } from '../../scripts/forms.js';

/*
 * The newsletter form's fields: the keys sent and the source's rules. The authoring only gives each
 * field's label, placeholder, required and error texts (see README).
 */
const FIELDS = {
  firstName: { type: 'text', key: 'firstName', settings: { rule: 'name', 'max length': 200 } },
  lastName: { type: 'text', key: 'lastName', settings: { rule: 'name', 'max length': 100 } },
  email: {
    type: 'email', key: 'email', required: true, settings: { 'max length': 200, width: 'full' },
  },
  isAgree: {
    type: 'checkbox', key: 'isAgree', required: true, settings: { 'value type': 'boolean' },
  },
};

/**
 * Puts the button in the email field, as the source's arrow; its text stays as its name for
 * screen readers.
 * @param {HTMLFormElement} form
 */
function arrowInEmail(form) {
  const submit = form.querySelector('.form-submit');
  const button = submit?.querySelector('button');
  const wrap = form.querySelector('.form-field[data-key="email"] .form-control-wrap');
  if (!button || !wrap) return;
  button.className = 'newsletter-submit';
  wrap.append(button);
  submit.remove();
}

/**
 * Decorates the Newsletter block: the source's newsletter band, authored once in the footer page
 * and shown above the footer on every page. A maroon panel with the heading and copy (one-cell rows
 * before the first field) on the left and the form on the right: one authored row per field
 * (Field | Label | Placeholder | Required | Error) and the rows submit / success / error; the
 * button is an arrow in the email field. Sent to the newsletter endpoint. A page with the metadata
 * `hide-newsletter` true (the metadata sheet's column, or the page's own) has no band.
 * @param {Element} block The Newsletter block element
 */
export default function decorate(block) {
  const section = block.closest('.section');
  if (getMetadata('hide-newsletter').toLowerCase() === 'true') {
    const wrapper = block.parentElement;
    (wrapper?.classList.contains('newsletter-wrapper') ? wrapper : block).remove();
    // the section goes too when nothing but its settings is left (so the footer has no empty band)
    const rest = section ? [...section.children]
      .filter((child) => !child.matches('.section-metadata, .section-metadata-wrapper')) : [];
    if (section && !rest.length) section.remove();
    return;
  }

  // in the footer page (loaded while the page's footer is), the band goes above the dark footer,
  // out of the footer's own bands; in a page's content it stays where it's authored
  const footer = document.querySelector('body > footer');
  if (section && !block.isConnected && footer?.querySelector('.footer[data-block-status="loading"]')) {
    footer.prepend(section);
  }

  const { form, intro } = buildForm(block, {
    fields: FIELDS,
    action: 'newsletter',
    defaultWidth: 'half',
    intro: true,
    submit: { text: 'Subscribe' },
  });
  arrowInEmail(form);
  const panel = document.createElement('div');
  panel.className = 'newsletter-panel';
  panel.append(...(intro ? [intro] : []), form);
  block.replaceChildren(panel);
}
