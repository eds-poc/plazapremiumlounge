import { decorateBlock, loadBlock } from '../../scripts/aem.js';

// the Custom Form options of the source newsletter band: the maroon panel, the heading and copy on
// the left of the form, first and last name side by side
const FORM_OPTIONS = ['maroon', 'two-columns', 'text-left'];
// the sign up placeholder until the newsletter API exists (scripts/endpoints.js)
const DEFAULT_ACTION = 'newsletter';
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
 * The row of a given type (the second cell), e.g. the `settings` or `submit` row.
 * @param {Element[]} rows
 * @param {string} type
 * @returns {Element|undefined}
 */
function rowOfType(rows, type) {
  return rows.find((row) => row.children.length > 1
    && row.children[1].textContent.trim().toLowerCase() === type);
}

/**
 * Moves the submit button into a field (the submit row's `inside: <key>`), as an arrow icon
 * button; its text stays as its name for screen readers.
 * @param {Element} form The Custom Form block
 * @param {string} key
 */
function moveSubmitInside(form, key) {
  const submit = form.querySelector('.form-submit');
  const button = submit?.querySelector('button');
  const wrap = form.querySelector(`.form-field[data-key="${CSS.escape(key)}"] .form-control-wrap`);
  if (!button || !wrap) return;
  button.className = 'newsletter-submit';
  wrap.append(button);
  submit.remove();
}

/**
 * Decorates the Newsletter block: a Custom Form on the maroon panel (the source's newsletter band,
 * shown above the footer on every page from the footer page), with the heading and copy beside it.
 * Rows as in Custom Form; the submit row also takes `inside: <key>` (the button as an arrow in that
 * field). Section metadata `hide-on` (`all`, or paths) lists the pages the band isn't shown on; on
 * those, nothing of the form loads. Block options are added to the Custom Form's (e.g. text-right
 * puts the form on the left).
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
  const { readSettings } = await import('../../scripts/forms.js');
  const rows = [...block.children];
  let settingsRow = rowOfType(rows, 'settings');

  // the form's action defaults to the newsletter endpoint
  if (!settingsRow) {
    settingsRow = document.createElement('div');
    settingsRow.innerHTML = '<div>Form</div><div>settings</div><div></div>';
    block.prepend(settingsRow);
  }
  if (!readSettings(settingsRow.children[2]).has('action')) {
    const action = document.createElement('p');
    action.textContent = `action: ${DEFAULT_ACTION}`;
    settingsRow.children[2].append(action);
  }
  const inside = readSettings(rowOfType(rows, 'submit')?.children[2]).get('inside');

  // the authored options (e.g. text-right) on top of the band's
  const authored = [...block.classList].filter((c) => !['newsletter', 'block'].includes(c));
  const options = FORM_OPTIONS
    .filter((o) => !(o === 'text-left' && authored.includes('text-right')))
    .concat(authored);
  const holder = document.createElement('div');
  holder.className = 'newsletter-form';
  const form = document.createElement('div');
  form.className = ['custom-form', ...new Set(options)].join(' ');
  form.append(...block.children);
  holder.append(form);
  block.replaceChildren(holder);

  decorateBlock(form);
  await loadBlock(form);
  if (inside) moveSubmitInside(form, inside);
}
