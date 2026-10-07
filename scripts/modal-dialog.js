import { loadCSS } from './aem.js';
import { translate } from './i18n.js';

const modals = new Map();
let count = 0;

/**
 * Builds a modal dialog: maroon header with the title and a close button, then the content.
 * Closes on the close button, Esc (native cancel), a `#close` link in the content and a click on
 * the backdrop. A modal with a form keeps open on a backdrop click (as the source's static login
 * modal), so typed values aren't lost; it gives a small bounce instead.
 * @param {string} key Unique key for this modal, so it is built once and reused
 * @param {Node[]} content Nodes to show in the modal body; `content.styles` are extra classes
 *   for the dialog (a modal page's section style, e.g. `square`)
 * @returns {HTMLDialogElement}
 */
function buildModal(key, content) {
  count += 1;
  const dialog = document.createElement('dialog');
  dialog.className = 'modal';
  if (content.styles) dialog.classList.add(...content.styles);
  dialog.id = `modal-${count}`;

  const panel = document.createElement('div');
  panel.className = 'modal-content';
  const header = document.createElement('div');
  header.className = 'modal-header';
  const body = document.createElement('div');
  body.className = 'modal-body';
  body.append(...content);

  // the first heading of the content becomes the modal title
  const heading = body.querySelector('h1, h2, h3, h4, h5, h6');
  if (heading) {
    heading.classList.add('modal-title');
    heading.id = `${dialog.id}-title`;
    header.append(heading);
    dialog.setAttribute('aria-labelledby', heading.id);
  }

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'modal-close';
  close.setAttribute('aria-label', translate('close'));
  close.addEventListener('click', () => dialog.close());
  header.append(close);

  panel.append(header, body);
  dialog.append(panel);

  const isStatic = !!body.querySelector('form');
  if (isStatic) dialog.classList.add('is-static');
  // a click outside the panel lands on the dialog itself, which is the backdrop area
  dialog.addEventListener('click', (e) => {
    if (e.target !== dialog) {
      // `#close` links in the content (e.g. Back) close the modal
      const link = e.target.closest('a[href]');
      if (link && link.getAttribute('href') === '#close') {
        e.preventDefault();
        dialog.close();
      }
      return;
    }
    if (!isStatic) {
      dialog.close();
      return;
    }
    dialog.classList.remove('is-bouncing');
    // restart the animation
    // eslint-disable-next-line no-unused-expressions
    dialog.offsetWidth;
    dialog.classList.add('is-bouncing');
  });
  dialog.addEventListener('animationend', () => dialog.classList.remove('is-bouncing'));
  dialog.addEventListener('close', () => {
    // when another modal replaced this one, keep the lock and leave focus in the new modal
    if (document.querySelector('dialog.modal[open]')) return;
    document.body.classList.remove('modal-open');
    dialog.trigger?.focus();
  });

  document.body.append(dialog);
  modals.set(key, dialog);
  return dialog;
}

/**
 * Opens a modal, building it on first use.
 * @param {Object} options
 * @param {string} options.key Unique key for the modal (a section name or page path)
 * @param {() => Promise<Node[]>|Node[]} options.content Returns the modal content on first open
 * @param {HTMLElement} [options.trigger] The element that opened it; focus returns here
 * @returns {Promise<HTMLDialogElement|null>}
 */
// eslint-disable-next-line import/prefer-default-export
export async function openModal({ key, content, trigger }) {
  await loadCSS(`${window.hlx.codeBasePath}/styles/modal.css`);
  // opened from inside another modal (e.g. Forgot Password? in the login modal): when this one
  // closes, focus goes back to what opened the first modal
  const host = trigger?.closest('dialog.modal');
  const returnTo = host?.trigger || trigger;
  let dialog = modals.get(key);
  if (!dialog) {
    const nodes = await content();
    if (!nodes || !nodes.length) return null;
    dialog = buildModal(key, nodes);
  }
  // one modal at a time: opening another closes the current one
  document.querySelectorAll('dialog.modal[open]').forEach((d) => { if (d !== dialog) d.close(); });
  if (dialog.open) return dialog;
  dialog.trigger = returnTo;
  if (trigger) trigger.setAttribute('aria-controls', dialog.id);
  document.body.classList.add('modal-open');
  dialog.showModal();
  dialog.querySelector('.modal-body').scrollTop = 0;
  return dialog;
}
