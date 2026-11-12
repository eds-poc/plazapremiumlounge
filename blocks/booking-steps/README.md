# Booking Steps: authoring guide

The booking pages' maroon steps band (the source's `.lounge-booking-steps`), e.g. on the guest
checkout: "Lounges › Book › **Details** › Confirm & Pay". It has the same look and code as Edit
Booking's band (`scripts/booking-steps.js`, `styles/booking-steps.css`).

## Table: 1 or 2 rows

| Booking Steps |
| --- |
| - Lounges<br>- Book<br>- **Details**<br>- Confirm & Pay |
| Details |

- **Row 1:** the steps as a list. Make the current step **bold**; the steps before it count as done.
- **Row 2 (optional):** the current step's name on phones, when it should differ from the bold
  step. Leave it out to use the bold step's own text.

## Look

- **From 768px:** the steps' names in white across a maroon band the page's full width, the current
  one brighter and in medium weight, an arrow between them.
- **Below 768px:** a compact bar: the numbers of the steps done (faded) and the current one, then
  the current step's name.
- Screen readers hear it as a navigation named after the page's heading 1, with the current step
  marked as the current step.

## Where to put it

First in the page's first section: that section then starts right under the header, and the band
leaves 30px (50px from 768px) to what follows.
