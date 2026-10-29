# Booking Steps: authoring guide

The maroon band under the header on the live site's booking pages (`.lounge-booking-steps`), full
width, from 768px (as the source, it isn't shown on phones). On a booking step page it shows the
steps in a row with an arrow between them, the current one highlighted; without steps it's the
band alone (e.g. View Booking).

## Table: one step per row (or none)

| Booking Steps |
| --- |
| Lounges |
| **Book** |
| Details |
| Confirm & Pay |

- **The current step**: in bold. The others are shown faded.
- **No rows**: the band alone.
- A bulleted list in one cell works too (one step per item).

## Where

The band's styles are shared (`styles/booking-steps.css`): a block that shows the band itself (e.g.
View Booking, at its top) uses the same `booking-steps` markup and styles.

In its own section, first on the page (right under the header): the section has no spacing of its
own, and the band spans the page's width.
