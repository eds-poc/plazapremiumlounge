import { translate } from '../../scripts/i18n.js';

/**
 * Decorates the Booking Steps block: the maroon band under the header on the booking pages (the
 * source .lounge-booking-steps), with the booking's steps in a row (Lounges → Book → Details →
 * Confirm & Pay), the current one (authored in bold) highlighted. Without steps it's the band
 * alone (e.g. View Booking).
 * @param {Element} block The Booking Steps block element
 */
export default function decorate(block) {
  // one step per row (or per list item); empty rows are left out
  const cells = [...block.querySelectorAll(':scope > div > div')];
  const steps = cells.flatMap((cell) => {
    const items = cell.querySelectorAll('li');
    return items.length ? [...items] : [cell];
  }).filter((step) => step.textContent.trim());

  if (!steps.length) {
    block.replaceChildren();
    return;
  }
  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', translate('bookingSteps'));
  const list = document.createElement('ol');
  list.className = 'booking-steps-list';
  steps.forEach((step) => {
    const item = document.createElement('li');
    item.className = 'booking-steps-item';
    item.textContent = step.textContent.trim();
    if (step.querySelector('strong, b')) {
      item.classList.add('is-active');
      item.setAttribute('aria-current', 'step');
    }
    list.append(item);
  });
  nav.append(list);
  block.replaceChildren(nav);
}
