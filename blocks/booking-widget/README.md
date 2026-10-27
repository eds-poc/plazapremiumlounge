# Booking Widget: authoring guide

The source's booking search: **Where**, **Date**, **Time**, **Adult(s)** and **Child(ren)**, then
a search that opens the lounges of the chosen city on this site. One form, used in two places:

- **The homepage hero** (a [Hero](#the-homepage-hero-hero-booking) with the option `booking`):
  a maroon bar over the photo from 768px; a card on phones (Where on maroon, the rest on white,
  **Search Lounges** along its foot).
- **Book Now** (the header button, and the phone bar above the header): a full-screen maroon
  dialog. From 1200px it shows the same bar; below 1200px it's the source's **Book Your Visit**
  form (the fields one under the other, the calendar always open, a white **Book Now** button).

The layout follows where the form is and the screen width; the form itself is the same.

## Table: no rows

| Booking Widget |
| --- |

The block has no settings: the locations come from the locations service, in the page's language.

## The Book Now dialog

In each language's nav page, the section with Section Metadata `modal` = `book-now`:

1. A heading: the dialog's title, e.g. `Book Your Visit` (shown below 1200px; screen readers
   only from 1200px).
2. The Booking Widget table.
3. Any text after it, e.g. the booking note with its Group Booking link (white, centred).

Every Book Now button that links to `#book-now` opens it.

## The homepage hero (Hero, booking)

| Hero (booking) |
| --- |
| *photo* |
| *title heading*, then the note |

- **Photo:** behind the hero. From 1200px it fills the top of the page at 2:1, under the
  transparent header (page metadata `header` = `transparent`). From 768px it starts under the
  header, 595px tall. On phones it's a rounded card.
- **Title:** any heading level, e.g. `Your destination before departure`. It's 40px, centred from
  992px, and 32px on phones.
- **Text after the title** goes under the widget, e.g. "Bookings must be made at least 1 hour
  prior to your arrival; … Submit Group Booking Requests [here](/en-uk/group-booking) for 10
  people or more."
- The widget is added by the hero itself (no Booking Widget table needed).
- Put the hero in its own section, first on the page.

## The fields

- **Where:** type part of an airport's name or code ("hong", "HKG").
  - The list opens on focus, sorted by code, and shows what matches as you type, or "No airports
    found matching …".
  - Click a location to choose it, or use the arrow keys and Enter. Escape closes the list.
  - Only a chosen location counts; typing again forgets it. A location typed out in full also
    counts.
- **Date:** the source's calendar (as the lounge page's): one month, previous and next, and no
  days before the location's today. Keyboard: the arrow keys, Home/End, Page Up/Down, and Enter
  to choose.
- **Time:** half-hour times from 0000 to 2330 ("hrs"). On the location's first bookable day the
  times before **now + the location's lead time** (at the location, in its time zone) can't be
  chosen. Choosing a location or a date moves an unbookable time to the first bookable one.
- **Guests,** as the lounge page's: at least 1 adult, up to two children per adult, 9 guests in
  all. Fewer adults take the children down with them. Child(ren) are complimentary under 2 years
  old (the note shows in the Book Your Visit form).

## The search

Search Lounges (or Book Now) opens the chosen location's **city page on this site**, with the
choices in the address:

`/en-uk/find/china-regions/hong-kong/hong-kong?airport=HKG&date=2026-10-30&time=1600&adult=2&children=1`

- The city page is found in the **header menu**: its city links end with their airport codes,
  e.g. `[Hong Kong (HKG)](/en-uk/find/china-regions/hong-kong/hong-kong)` or `Beijing (PEK/PKX)`.
  So a location shows in Where only when the menu has its city. Add the city to the menu (with
  its codes) and it appears.
- On the city page, `airport` selects that airport in the filters (when there are several), and
  `date` and `time` go on to the lounge pages' View now links. `adult` and `children` are kept
  in the address for the booking steps to come.

## Messages

| Situation | Visitors see |
| --- | --- |
| Search without a chosen location | "Please select an airport" under Where (white), and the focus goes back to Where |
| The locations are loading | "Loading…" in the open list |
| Nothing matches | "No airports found matching "…"" |
| The locations service fails (an error, or 15 seconds) | "We couldn't load the airports." and Try again |

## For developers

- **Data:** `apiUrl('locations')` in `scripts/endpoints.js` is the booking system's service (its
  own domain, with the live site's property codes), with `propertyTypeCode=LOUNGE` and the page's
  API language.
  - It's loaded once per page, when the visitor first comes to a form (pointer, focus or touch),
    not with the page.
  - The browser keeps it for an hour.
  - Each location's lead time is the longest of its lounges' `leadTime`; its time zone is read
    from `timeZone`.
- **Shared code:** the calendar is `scripts/date-picker.js` (with the prefix `booking-widget`).
  The slots, lead time, date format and guest rules are `scripts/booking.js`. The lounge page's
  booking panel uses both too.
- **In a dialog** the block is marked `in-modal` (it's inside a `modal` section). The dialog's look
  is in this block's CSS (`dialog.modal:has(.booking-widget)`).
- **Event:** before opening the city page the block fires `booking-widget:search` (it bubbles)
  with `detail` = `{ airport, date, time, adult, children, url }`. Cancel it (`preventDefault`) to
  handle the search in place, e.g. live's lounge card with prices, which needs a price service
  that takes the live property codes.
