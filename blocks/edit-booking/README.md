# Edit Booking: authoring guide

A member's booking to change (the live site's Edit Your Booking page,
`/en-uk/edit-booking?bookingid=…`): the booking steps band, the title, the intro, the lounge, the
date, the start time and the service, the booking's additional services, and the Booking Summary
card, which follows the choices. Authors write the texts; the booking comes from the
**GetOrderDetail** API for the address's `bookingid`, with the member's login token (as View
Booking).

The page needs a login: add a row `/**/edit-booking` with `members-only` true to the metadata
sheet. A guest then goes to the home page with the page in `?redirectUrl=`, logs in there and
comes back to the booking. An expired login, or GetOrderDetail refusing the token (401), logs out
and goes home. A missing booking shows the `notFound` text; any other failure shows the `error`
text with Try again. The site's loader shows until the booking is in.

## What the visitor can change

- **Date**: from today at the lounge (its time zone from the booking); the day shows as the source
  writes it (`01-Dec-2026`), the browser's date picker opens over it.
- **Time**: the half hours 0000 to 2330; on the lounge's today, the times before now plus the
  lounge's lead time (`propertyLeadTime`, 1 hour by default) can't be picked. A day change that
  leaves the time in the past moves it to the first bookable one.
- **Service**: the booked service. The other services on sale need the products API.
- **Guests**: shown, locked (as the source).
- **Additional services**: the booking's add-ons, each with Edit: a popup with the quantity (per
  unit) or the adults and children it's for (per person, with All guests), and its total. The
  add-ons on sale but not booked need the add-ons API.

Once something changed, **Submit & Review Changes** shows: a popup lists each change (before →
after) under the confirmation text. Its Confirm button stays disabled until the booking change
API is in (the `pending` text says so).

Below 992px the choices show as rows (label, value, Edit), each Edit opening a popup with its field
and Confirm; the lounge's details fold away with the arrow; the summary card follows the page.

## Table: 2 columns (Key | Text)

| Edit Booking | |
| --- | --- |
| steps | - Lounges<br>- **Book**<br>- Details<br>- Confirm & Pay |
| phoneStep | Booking |
| heading | Edit Your Booking |
| back | [My Booking](/en-uk/membership/my-booking) |
| intro | Bookings cancellation / amendments only could be made up to 6 hours before … |
| date | Date |
| time | Time |
| hours | hrs |
| adults | Adult(s) |
| children | Child(ren) |
| childrenNote | Complimentary for under 2 years old |
| service | Service Details |
| lengthOfStay | Length of Stay |
| edit | Edit |
| additionalService | Additional Service |
| add | Add |
| update | Update |
| quantity | Quantity |
| allGuests | All Guests |
| serviceTotal | Service total: |
| submit | Submit & Review Changes |
| summary | Booking Summary |
| summaryDate | Date: |
| summaryTime | Time: |
| summaryGuests | Guests: |
| summaryServices | Services: |
| confirmTitle | Confirmation |
| confirmText | Are you sure? Do you want to update the booking? |
| cancel | Cancel |
| confirm | Confirm |

- **steps**: a list; the current step in bold. From 768px the band shows the names with arrows;
  below it the numbers up to the current step and the current step's **phoneStep** name (else its
  own name).
- **back**: the arrow before the heading links to this page; the link text is what screen readers
  announce.
- **lengthOfStay**: the title of the phone's service popup (optional; else **service**).
- **pending**, **notFound**, **error**, **loading** (optional): the messages; without them, the
  visitor's language's defaults.
