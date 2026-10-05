import { loadCSS } from './aem.js';

const modals = new Map();
let count = 0;

/**
 * Builds a modal dialog: maroon header with the title and a close button, then the content.
 * Closes on the close button, Esc (native cancel) and a click on the backdrop.
 * @param {string} key Unique key for this modal, so it is built once and reused
 * @param {Node[]} content Nodes to show in the modal body
 * @returns {HTMLDialogElement}
 */
function buildModal(key, content) {
  count += 1;
  const dialog = document.createElement('dialog');
  dialog.className = 'modal';
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
  close.setAttribute('aria-label', 'Close');
  close.addEventListener('click', () => dialog.close());
  header.append(close);

  panel.append(header, body);
  dialog.append(panel);

  // a click outside the panel lands on the dialog itself, which is the backdrop area
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
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
export async function openModal({ key, content, trigger }) {
  await loadCSS(`${window.hlx.codeBasePath}/styles/modal.css`);
  let dialog = modals.get(key);
  if (!dialog) {
    const nodes = await content();
    if (!nodes || !nodes.length) return null;
    dialog = buildModal(key, nodes);
  }
  if (dialog.open) return dialog;
  dialog.trigger = trigger;
  if (trigger) trigger.setAttribute('aria-controls', dialog.id);
  document.body.classList.add('modal-open');
  dialog.showModal();
  dialog.querySelector('.modal-body').scrollTop = 0;
  return dialog;
}

/**
 * Whether a modal is already built for this key.
 * @param {string} key
 * @returns {boolean}
 */
export function hasModal(key) {
  return modals.has(key);
}
