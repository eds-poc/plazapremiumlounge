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
const SITE_FOLDER = /^[a-z]{2}-[a-z]{2}$/;

/**
 * A path without its `.html` and trailing slash.
 * @param {string} path
 * @returns {string}
 */
function normalise(path) {
  return path.replace(/\.html$/, '').replace(/\/+$/, '') || '/';
}

/**
 * The pages the band is hidden on, from its section's metadata `hide-on`: `all`, or paths
 * separated by commas.
 * @param {Element} [section]
 * @returns {string[]}
 */
function hideList(section) {
  return (section?.dataset.hideOn || '').split(',').map((path) => path.trim()).filter(Boolean);
}

/**
 * Whether the page is one the band is hidden on: `all` hides it everywhere; a listed path matches
 * that page (with or without `.html` or a trailing slash); `/en-uk/drafts/*` matches every page
 * under that folder; a path without a language folder (`/sign-up-successful-page`) matches that
 * page in every language site.
 * @param {string[]} paths
 * @param {string} [pathname] The page's path
 * @returns {boolean}
 */
export function isHiddenOn(paths, pathname = window.location.pathname) {
  if (paths.some((path) => path.toLowerCase() === 'all')) return true;
  const page = normalise(pathname);
  const [, folder] = page.split('/');
  const pageInSite = SITE_FOLDER.test(folder || '') ? normalise(page.slice(folder.length + 1)) : page;
  return paths.some((authored) => {
    let path;
    try {
      path = new URL(authored, window.location.origin).pathname;
    } catch {
      return false;
    }
    const folderWide = path.endsWith('/*');
    const base = normalise(folderWide ? path.slice(0, -2) : path);
    const target = SITE_FOLDER.test(base.split('/')[1] || '') ? page : pageInSite;
    return folderWide ? target === base || target.startsWith(`${base}/`) : target === base;
  });
}

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
 * button is an arrow in the email field. Sent to the newsletter endpoint. Section metadata
 * `hide-on` (`all`, or paths) lists the pages the band isn't shown on; on those, nothing of the
 * form loads.
 * @param {Element} block The Newsletter block element
 */
export default async function decorate(block) {
  const section = block.closest('.section');
  if (isHiddenOn(hideList(section))) {
    const wrapper = block.parentElement;
    (wrapper?.classList.contains('newsletter-wrapper') ? wrapper : block).remove();
    // the section goes too when nothing but its settings is left (so the footer has no empty band)
    const rest = section ? [...section.children]
      .filter((child) => !child.matches('.section-metadata, .section-metadata-wrapper')) : [];
    if (section && !rest.length) section.remove();
    return;
  }

  // the shared form code loads only when the band is shown
  const { buildForm } = await import('../../scripts/forms.js');
  const { form, intro } = await buildForm(block, {
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
