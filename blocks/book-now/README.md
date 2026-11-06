# Book Now: authoring guide

A Book Now button for any page. It opens the site's **Book Now dialog**, the same one as the header's Book Now button: its title, the Booking Widget (Where, date, time, guests, search) and the booking note.

## Table: no rows needed

| Book Now (outline, large) |  |
| --- | --- |
| label | Book your lounge |
| airport | HKG |

- **No rows:** a primary button labelled "Book Now" in the page's language (立即预订, Reserve Agora, 今すぐ予約, 立即預訂).
- **label** (optional): the button's text. A table with only one cell is read as the label.
- **airport** (optional): an airport code. The dialog opens with that airport chosen, and its date and time follow it. Without it, the dialog behaves as from the header (the visitor's nearest airport). A code that isn't in that language site's Where list chooses nothing; a value that isn't a code (e.g. `HK!`) is ignored, with a note on the preview site.
- Row names ignore case and spaces (`Airport`, `airport`).

## Options (block name)

The Buttons block's style words: `primary` (default), `outline`, `tint`, `tertiary`, `white`, and `large`, `pill`, `arrow`, `full-width`. See the Buttons guide for how each looks. `center` centres the button.

## How it works

- **The same dialog:** the button is a link to `#book-now`. The dialog is the section with Section Metadata `modal` = `book-now` in each language's nav page, so every page using that nav has it. Nothing is copied: one dialog, one Booking Widget, and the same APIs and search, wherever the button is.
- **Several Book Now blocks** on one page all open that dialog, each with its own airport.
- **No dialog on the page** (a nav without that section): the button isn't shown, and the preview site says why.
- **Focus** goes back to the block's button when the dialog closes (✕, Esc, or a click outside).

## Where to put it

Anywhere, but preferably **not in the page's first section** on a page whose first section holds its main image: the site shows the first section, and loads its first image, only once every block in that section has loaded. Measured on a phone (slow 4G), a Book Now block first in the first section made that image show ~0.35s later; lower on the page it made no difference.

## For developers

- `book-now.js` builds the button with `scripts/buttons.js` (`buildButton`, `styleWords`), and finds the dialog with `scripts/modal.js` (`whenModal`, `markModalTrigger`), once the header has started loading. The site-wide click handler in `modal.js` opens it.
- With `airport`, a click sends the dialog's Booking Widget `booking-widget:set-location` with `detail.airport` (its existing hook), waiting for the widget to be ready if needed. The widget moves into the dialog when it first opens; the block keeps the element itself.
- No changes to the header, the nav, `modal.js` or the Booking Widget. Tests: `test/booking-widget/book-now.test.mjs`.
