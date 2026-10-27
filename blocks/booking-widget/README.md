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
- The widget is added by the hero itself (no Booking Widget table needed), with the **lounge
  card** below (see next).
- Put the hero in its own section, first on the page.

## The lounge card (homepage hero only)

When the visitor chooses an airport (and again when the date, time or guests change, half a
second after the last change), the hero shows **the airport's first bookable lounge** under the
note, as the source's featured product. Book Now's dialog doesn't have it.

- **Which lounge:** the first lounge at that airport, in the booking system's order, that is
  bookable: a lounge (not a pass), online booking on, not sent to another site. The airport mustn't
  be a railway station. It's shown when it has bookable products at the chosen start; if it has
  none, the next one is tried (up to three lounges).
- **The card** (as the source's):
  - the lounge's photos (dots; a new photo every 8 seconds, paused on hover or focus)
  - its name and location line ("Near Gate 1, Departures, Hong Kong International Airport")
  - the services as tabs when there are two or more (LOUNGE, PRIVATE RESTING AREA, SHOWER last)
  - the products in a drop-down
  - four features, then "+ N MORE" with the others on hover, focus or a tap
  - the price: the price before a discount struck through, then the price ("—" without one)
  - **Book Now** (no booking yet: it announces the choice) and **More at HKG** (the city page)
- **Under the card:** "View more properties in Hong Kong International Airport (HKG)", when the
  airport has two or more lounges (not on phones, where More at is enough).
- **No card** (no bookable lounge, nothing bookable at that time, a service error or an invalid
  answer): **"View all properties in …"**, to the airport's city page with the choices.
- While it loads, a shimmering card stands in its place.
- On phones the card follows the hero's rounded photo card; from 768px it sits on the photo, under
  the note.

## The fields

- **Where:** type an airport's name or code, or its city, country or region, as the source's:
  - The list shows the airports whose name (or English name, or code) matches; if none does,
    those whose city matches ("abuja" → Nnamdi Azikiwe International Airport), then country
    ("nigeria" → Abuja and Lagos), then region code (e.g. CH).
  - A match starts a word: "hong" finds Hong Kong, not Zhongshan; with two or more words, each must
    match ("kong airport"). Case and accents don't matter; city and country also match in English
    on the other language sites ("beijing" on /zh-cn/).
  - The names are the locations service's (e.g. it calls Taiwan "Taiwan, Province of China", so
    "china" lists Taipei's airports).
  - The list opens on focus, sorted by code, and shows what matches as you type, or "No airports
    found matching …".
  - Click a location to choose it, or use the arrow keys and Enter. Escape closes the list.
  - Only a chosen location counts; typing again forgets it. A location typed out in full (its
    name or code, e.g. HKG) also counts.
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
| The lounge card is loading | A shimmering card ("Loading…" for screen readers) |
| No bookable lounge, nothing bookable, or the lounge services fail | No card; "View all properties in {airport}" |
| The lounge's details (photos, features) fail | The card without features, with the service's photo |

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
- **Events** (they bubble):
  - `booking-widget:search`, before opening the city page, with `detail` =
    `{ airport, date, time, adult, children, url }`. Cancel it (`preventDefault`) to handle the
    search in place.
  - `booking-widget:change`, half a second after the last change of the location, date, time or
    guests, with the same `detail` plus `location` (the chosen location).
  - `booking-widget:book`, from the lounge card's Book Now, with the choice plus `propertyCode`,
    `serviceCode` and `productCode` (for the booking step to come).
- **Choosing a location from a script** (e.g. a default from the visitor's position, later): send
  the block `booking-widget:set-location` with `detail.airport`:
  `block.dispatchEvent(new CustomEvent('booking-widget:set-location', { detail: { airport: 'HKG' } }))`.
  The location is chosen as if the visitor had picked it (the lounge card follows).
- **Lounge card** (`booking-widget-lounge-card.js`, option `lounge-card`, added by the hero; not
  in a dialog):
  - `apiUrl('bookingProperties')` (GetAllProperties `?iataCode=&languageCode=`) → the bookable
    lounges.
  - `apiUrl('bookingServices')` (service-list, POST) → the lounge's services and products for the
    start (the visitor's currency).
  - `apiUrl('bookingProducts')` (products, POST) → the name, location line, photos, features and
    prices. Its product codes don't match service-list's on the test system, so the prices show
    "—" there; they show when the codes match.
  - It goes in its host's place: an element with `data-booking-products` inside one marked
    `data-booking-products-host` (the hero's), else after the widget.
  - Stale answers (an earlier choice) are dropped.
