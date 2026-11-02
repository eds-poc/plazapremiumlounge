import { buildButton, styleWords } from '../../scripts/buttons.js';
import { translate } from '../../scripts/i18n.js';
import { markModalTrigger, whenModal } from '../../scripts/modal.js';

// the site's Book Now dialog: the nav's section with Section Metadata `modal` = book-now (the
// header's Book Now button opens it too)
const MODAL = 'book-now';
// how long to wait for the dialog's Booking Widget to be ready before giving up on the airport
const WIDGET_TIMEOUT_MS = 10000;
// how long to wait for the header (with its nav, the dialog) to start loading
const HEADER_TIMEOUT_MS = 10000;

// (no properties.js: in a page's first section, its imports would hold the section, and the LCP
// image with it, a few more round trips)
const isPreview = () => /\.aem\.page$|^localhost$/.test(window.location.hostname);

/**
 * A preview-site note under the button (why it's hidden, or a value that's ignored).
 * @param {Element} block
 * @param {string} text
 */
function hint(block, text) {
  if (!isPreview()) return;
  const note = document.createElement('p');
  note.className = 'book-now-hint';
  note.textContent = text;
  block.append(note);
}

/**
 * The block's rows as settings (`label | Book now`, `airport | HKG`); a single-cell table is its
 * label. Row names ignore case and spaces.
 * @param {Element} block
 * @returns {{label: string, airport: string}}
 */
function readSettings(block) {
  const settings = { label: '', airport: '' };
  const rows = [...block.children];
  rows.forEach((row) => {
    const [first, second] = row.children;
    if (rows.length === 1 && !second) {
      settings.label = first?.textContent.trim() || '';
      return;
    }
    const name = (first?.textContent || '').toLowerCase().replace(/[^a-z]/g, '');
    if (name in settings) settings[name] = (second?.textContent || '').trim();
  });
  return settings;
}

/**
 * Resolves once a block has loaded (its decoration done), or false after a while.
 * @param {Element} block
 * @returns {Promise<boolean>}
 */
function whenLoaded(block) {
  if (block.dataset.blockStatus === 'loaded') return Promise.resolve(true);
  return new Promise((resolve) => {
    let timer;
    const observer = new MutationObserver(() => {
      if (block.dataset.blockStatus !== 'loaded') return;
      observer.disconnect();
      clearTimeout(timer);
      resolve(true);
    });
    timer = setTimeout(() => {
      observer.disconnect();
      resolve(false);
    }, WIDGET_TIMEOUT_MS);
    observer.observe(block, { attributes: true, attributeFilter: ['data-block-status'] });
  });
}

/**
 * The site's Book Now dialog (its section), or null when the page has none. Asked once the header
 * has started loading: before that (e.g. from the page's first section), modal.js would take the
 * page as settled, with no header or footer loading yet, and answer null.
 * @returns {Promise<HTMLElement|null>}
 */
function whenDialog() {
  const started = () => document.querySelector('header .header');
  if (started()) return whenModal(MODAL);
  return new Promise((resolve) => {
    let timer;
    const observer = new MutationObserver(() => {
      if (!started()) return;
      observer.disconnect();
      clearTimeout(timer);
      resolve(whenModal(MODAL));
    });
    timer = setTimeout(() => {
      observer.disconnect();
      resolve(whenModal(MODAL));
    }, HEADER_TIMEOUT_MS);
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

/**
 * Decorates the Book Now block: a button in the site's button styles (block options as the
 * Buttons block's: outline, large, pill …) that opens the site's Book Now dialog, the same one
 * as the header's Book Now, with its Booking Widget. Optional rows: `label` (else the site's
 * "Book Now" in the page's language) and `airport` (an IATA code: the dialog opens with that
 * airport chosen, through the widget's booking-widget:set-location). Without the dialog on the
 * page (a nav without it), the button isn't shown; the preview site says why.
 * @param {Element} block
 */
export default function decorate(block) {
  const { label, airport } = readSettings(block);
  const code = airport.toUpperCase();
  const valid = /^[A-Z0-9]{3,4}$/.test(code);
  const source = document.createElement('a');
  source.textContent = label || translate('bookingBookNow');
  source.href = `#${MODAL}`;
  const button = buildButton(source, [], styleWords([...block.classList].join(' ')));
  block.replaceChildren(button);
  const link = button.querySelector('a');
  if (airport && !valid) hint(block, `The "airport" value "${airport}" isn't an airport code (e.g. HKG); it's ignored.`);

  // the dialog's widget (it moves into the dialog when that first opens: the element is kept)
  let widget = null;
  const findWidget = (section) => section?.querySelector('.booking-widget')
    || document.querySelector('dialog.modal .booking-widget.in-modal');
  // in the background, not holding the page: the dialog comes with the nav, which loads after
  // the page's first section; no dialog on this page, no button
  whenDialog().then((section) => {
    if (!section) {
      button.remove();
      hint(block, 'This page has no Book Now dialog: its nav needs the section with Section Metadata "modal" = "book-now".');
      return;
    }
    markModalTrigger(link);
    widget = findWidget(section);
  });

  if (airport && valid) {
    // with the click (the dialog's own click handling opens it): the widget shows that airport
    link.addEventListener('click', async () => {
      widget ||= findWidget(await whenDialog());
      if (!widget || !(await whenLoaded(widget))) return;
      widget.dispatchEvent(new CustomEvent('booking-widget:set-location', { detail: { airport: code } }));
    });
  }
}
