/*
 * A confirmation popup in the site's dialog (modal-dialog.js), as the source's booking
 * confirmations: the maroon bar with only the close button, then, centred, the title, the text
 * and two buttons (the yes button outlined, the no button filled). Its look is the dialog style
 * `confirm` (styles/modal.css); `wide` makes it 800px from 992px.
 */
import { openModal } from './modal-dialog.js';

// each popup's content, by its key: the dialog is built once, its content refilled for each ask
const roots = new Map();

/**
 * Creates an element with a class name and text.
 * @param {string} tag
 * @param {string} className
 * @param {string} [text]
 * @returns {HTMLElement}
 */
function el(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

/**
 * Asks a question in a confirmation popup. Resolves true for the yes button only; the no button,
 * the close button, Esc and a click beside the popup resolve false. The title stays in the
 * popup's body, as the source's (a heading would go to the maroon bar), as a paragraph with the
 * heading role that names the dialog.
 * @param {HTMLElement} trigger What opened it (focus returns there)
 * @param {Object} question
 * @param {string} question.key The popup's key (one popup per key, refilled each time)
 * @param {string} [question.title] '' for none
 * @param {Array<Node|string>} question.body The text: paragraphs (or strings, one paragraph each)
 * @param {string} question.yes The yes button's label
 * @param {string} [question.no] The no button's label; '' for none (the close button stays)
 * @param {boolean} [question.wide] 800px wide from 992px
 * @returns {Promise<boolean>}
 */
export default async function confirmDialog(trigger, {
  key, title = '', body, yes, no = '', wide = false,
}) {
  if (!roots.has(key)) roots.set(key, el('div', 'confirm-content'));
  const root = roots.get(key);
  const heading = el('p', 'confirm-title', title);
  heading.id = `${key}-title`;
  heading.setAttribute('role', 'heading');
  heading.setAttribute('aria-level', '2');
  const actions = el('div', 'confirm-actions');
  const choice = (label, look) => {
    const button = el('button', `button ${look}`, label);
    button.type = 'button';
    actions.append(button);
    return button;
  };
  const yesButton = choice(yes, 'tertiary');
  const noButton = no ? choice(no, 'primary') : null;
  const text = body.map((part) => (typeof part === 'string' ? el('p', 'confirm-text', part) : part));
  root.replaceChildren(...[title && heading, ...text, actions].filter(Boolean));

  const dialog = await openModal({
    key,
    trigger,
    content: () => Object.assign([root], { styles: ['confirm', ...(wide ? ['wide'] : [])] }),
  });
  if (!dialog) return false;
  if (title) dialog.setAttribute('aria-labelledby', heading.id);
  else dialog.removeAttribute('aria-labelledby');
  return new Promise((resolve) => {
    let confirmed = false;
    yesButton.addEventListener('click', () => {
      confirmed = true;
      dialog.close();
    });
    noButton?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => resolve(confirmed), { once: true });
  });
}
