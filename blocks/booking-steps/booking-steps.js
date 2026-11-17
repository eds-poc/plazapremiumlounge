import buildBookingSteps from '../../scripts/booking-steps.js';

/**
 * Decorates the Booking Steps block: the booking pages' maroon steps band (the source's
 * .lounge-booking-steps), built by the shared scripts/booking-steps.js (also used by Edit Booking).
 * Row 1: the steps as a list, the current one in bold. Row 2 (optional): the current step's name
 * on phones. The band's name for screen readers is the page's title (its heading 1).
 * @param {Element} block The Booking Steps block element
 */
export default function decorate(block) {
  const cells = [...block.querySelectorAll(':scope > div > div')];
  const list = cells.find((cell) => cell.querySelector('li'));
  const phoneStep = cells.find((cell) => cell !== list && cell.textContent.trim())?.textContent.trim() || '';
  const label = document.querySelector('main h1')?.textContent.trim() || '';
  // the block is the band itself (its class is the band's, `.booking-steps`)
  block.replaceChildren(...buildBookingSteps(list, { label, phoneStep }).childNodes);
}
