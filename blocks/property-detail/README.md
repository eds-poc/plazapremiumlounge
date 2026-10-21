# Property Detail: authoring guide

One lounge (or pass), loaded live from the Plaza Premium property detail service, as the source
lounge pages (e.g. Plaza Premium Lounge, Near Gate 60, Hong Kong). One template page per language
folder serves every lounge: `/en-uk/find/lounge`, `/zh-cn/find/lounge`, `/zh-hk/find/lounge`,
`/ja-jp/find/lounge`, `/pt-br/find/lounge`. The address picks the lounge:

`/en-uk/find/lounge?propertycode=PRPRTY814&currency=HKD&date=2026-10-21&time=1600`

- **Desktop:**
  - a grey title band: the name, location and opening hours
  - a breadcrumb: Lounges (back to the listing the visitor came from) < the lounge
  - the first four photos (each opens full size) beside the **Book your visit** panel; as on the
    source, the foot of the photo column fades to light grey until the pointer is over the photos
  - the panels: The Lounge, Lounge Features, Available Services, Details (an
    [Accordion](../accordion/README.md) with the `detail` option, the first two open)
- **Phones:**
  - a grey intro: a photo slider, the Departures/Arrivals badge, the name, location, hours and
    description
  - the panels, all shown open as on the source (no arrows; the headings don't open or close them)
  - a bar fixed at the bottom (as tall as its content: shorter without a Smart Traveller line): the lowest price, **Book your visit** (the booking form in a
    pop-up) and the Smart Traveller line
- **Plaza Premium First** lounges are green instead of maroon.

## Table: two columns, a setting per row (all optional)

| Property Detail | |
| --- | --- |
| signup-button | [Join free](https://www.plazapremiumlounge.com/en-uk/sign-up?pid=pdp) |

- **signup-button:** a link, shown after the Smart Traveller line (the pill in the booking panel,
  and the bottom bar on phones). Leave the row out for no link. Links to other websites open in a
  new tab.
- An empty block (no rows) is fine: everything else comes from the service.
- Make the template page **noindex** (page metadata Robots). The block sets the page title,
  description, share image and canonical address from the lounge.

## The page address

| Parameter | Meaning | When missing or wrong |
| --- | --- | --- |
| `propertycode` | The lounge, e.g. `PRPRTY814` | "This lounge isn't available." |
| `currency` | Sent to the services, e.g. `HKD` (the "from" prices come in the lounge's own currency) | The lounge's own currency |
| `date` | The booking date, `YYYY-MM-DD` | The first bookable day at the lounge; an earlier date moves to it |
| `time` | The booking time, `HHmm` on the half hour | The first bookable time; an earlier one moves on |

The first bookable time is the half hour after now plus the lounge's booking lead time (from the
service, e.g. 1 hour: at 12:32 the first time is 14:00), as the source. Earlier times are disabled.

The page writes the date and time it shows back into the address (no reload), so a link can be
shared. Lounge cards in the [Property List](../property-list/README.md) link here.

## Booking panel

- **Fields:** date, time ("hrs"), adults, children, service and service details, and a promo
  code.
- **Date:** the source's calendar (`date-picker.js`): one month, previous and next, days before
  the first bookable one faded and unavailable, no last day. On desktop it pops up under the date
  (with a "Date" title and close) and closes on a pick, Escape, close or a click outside; in the
  phone's Book Your Visit dialog it's always open under the date. Month names, weekdays and the
  first day of the week follow the page language, as the source (Sunday first in English, Monday
  in the others). Keyboard: the arrow keys move a day or a week, Home/End to the week's start or
  end, Page Up/Down a month (with Shift, a year), Enter or Space choose. A new date updates the
  address's `date` (and `time` when the earliest times move it), keeping its other parameters, and
  asks for that day's services.
- **Services and service details** (e.g. Lounge → Lounge Use - 2 Hours) come from the services
  service for the chosen start time. The page doesn't wait for them: the request goes out as soon
  as the lounge's details arrive, and until the answer (a few seconds) both drop-downs say
  "Loading…" and the fields are disabled. Changing the date or time asks again (the drop-downs say
  "Loading…" meanwhile), keeping the visitor's choice when it's still offered. Durations are listed shortest first. Service names follow the page language;
  the durations' names are English only (the service has no translations).
- **Get Price** asks the price service for the chosen service, duration, guests, start and promo
  code, and shows the price as the source: "Subtotal", the price before a discount struck through
  (when there's one), and the price, with **Reserve Now** in place of Get Price. Any change to the
  choices clears it again. Reserve Now has no action yet: it announces the choice and its price (a
  `property-detail:reserve` event) for the booking hand-off to come (`property-detail:get-price`
  and `property-detail:price` are announced too). When the service rejects the promo code
  (`isPromoRejected` on any item of its answer), its message shows under the promo code field
  (e.g. "No campaign found with given promocode"); the code stays in the field to be corrected,
  no price is shown and the button stays Get Price. Typing in the field hides the message.
- **No services:** a lounge without bookable services at that time (e.g. a rail lounge in the
  test data) shows a note instead of the service fields and Get Price. If the services can't be
  loaded, the note says so, with Try again.

## Where the rest comes from

| What | From |
| --- | --- |
| The service addresses | Code, not content: `scripts/endpoints.js` (the `propertyDetail` endpoint, a GET, and `propertyServices`, a POST with the start time, the lounge and its airport code, and the currency, and `propertyPrice`, a POST with the choices) |
| The language of the data | The page's language folder (as the Property List); page metadata `language-code` overrides it |
| Labels ("Date", "Get Price", panel names, "Lounge in {city}") | The site's translations, by page language, in the source pages' wording |
| Details panel | The lounge's address and phone number only; the service's email addresses aren't shown |

## Messages

| Situation | Visitors see | On the preview site, authors also see |
| --- | --- | --- |
| Loading | The site's page loader until the lounge is shown (the service can take several seconds), and again while Get Price asks for the price (over the booking dialog on phones) | |
| No `propertycode` in the address | "This lounge isn't available." | A hint with an example address |
| Unknown or inactive lounge | "This lounge isn't available." | The code that wasn't found |
| The service is unavailable or slow (15 seconds) | "We couldn't load this lounge." and Try again | |
| The services can't be loaded (an error, or 30 seconds) | "We couldn't load the services." and Try again, in the booking panel | |
| No bookable services at that time | "Online booking isn't available for this lounge." in the booking panel | |
| The promo code was rejected | The service's message in a yellow box under the promo code field; the code stays, no price, Get Price stays ("This promo code isn't valid." when the service gives no text) | |
| No price for the choices (not available then, or outside opening hours) | "This option isn't available at the selected time." above Get Price | |
| The price can't be had (an error, or 30 seconds) | "We couldn't get the price. Please try again." above Get Price | |
