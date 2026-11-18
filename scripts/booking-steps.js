/*
 * The booking steps band (the source's .lounge-booking-steps, styles/booking-steps.css), shared by
 * the booking pages that show their steps (Edit Booking, Checkout): an authored list of the steps,
 * the current one in bold. From 768px the steps' names with arrows between them; below it the
 * numbers of the steps up to the current one and the current step's name (its phone name, if
 * given), as the source's phone bar.
 */

/**
 * Creates an element with an optional class name and text.
 * @param {string} tag
 * @param {string} [className]
 * @param {string|number} [text]
 * @returns {HTMLElement}
 */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

/**
 * Builds the steps band from an authored cell holding a list (`- Lounges`, `- **Book**`, …).
 * @param {Element|undefined} cell The cell with the list (none: an empty band, as View Booking's)
 * @param {{label?: string, phoneStep?: string}} [options] label: the navigation's name for screen
 *   readers; phoneStep: the current step's name on phones (e.g. "Booking")
 * @returns {HTMLDivElement} The band (`.booking-steps`)
 */
export default function buildBookingSteps(cell, { label = '', phoneStep = '' } = {}) {
  const band = el('div', 'booking-steps');
  const steps = [...(cell?.querySelectorAll('li') || [])].filter((li) => li.textContent.trim());
  if (!steps.length) return band;
  const nav = el('nav');
  if (label) nav.setAttribute('aria-label', label);
  const list = el('ol', 'booking-steps-list');
  steps.forEach((step, i) => {
    const item = el('li', 'booking-steps-item');
    item.append(el('span', 'booking-steps-number', i + 1), el('span', 'booking-steps-name', step.textContent.trim()));
    if (step.querySelector('strong, b')) {
      item.classList.add('is-active');
      item.setAttribute('aria-current', 'step');
    }
    list.append(item);
  });
  // the steps before the current one, as done (the phone bar shows their numbers, then the
  // current step's phone name, if authored)
  const active = [...list.children].findIndex((item) => item.classList.contains('is-active'));
  [...list.children].slice(0, Math.max(active, 0)).forEach((item) => item.classList.add('is-done'));
  if (active >= 0 && phoneStep) list.children[active].append(el('span', 'booking-steps-short', phoneStep));
  nav.append(list);
  band.append(nav);
  return band;
}
