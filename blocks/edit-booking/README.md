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
- **Service**: the lounge's products for the chosen day and time (**GetServices**, as Property
  Detail: the booked service's products), refreshed when the day or time changes. At the booked
  time the booked product is always on the list; a product no longer offered moves the choice to
  the first one. If GetServices fails, the list keeps the booked service.
- **Guests**: shown, locked (as the source).
- **Additional services**: the booked add-ons (Edit) and the ones on sale for the chosen day and
  time (Add), from **GetAddOns** (below), refreshed when the day or time changes. Add or Edit opens
  a popup: the description, image and unit, the quantity (per unit, up to the stock) or the adults
  and children it's for (per person, with All guests), and the service total. An add-on no longer
  on sale after a change leaves the list (unless booked). If GetAddOns fails (or doesn't exist
  yet), the section shows the booked add-ons only (none: no section). If it answers none on sale
  for a booking with add-ons, the **addonsUnavailable** note shows (the source's message).

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
| addonsUnavailable | Unfortunately, we are unable to process your modification request. Please contact [customer service](/en-uk/contact-us) for more details and proceed with the modification. |
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
- **addonsUnavailable**: shown as authored (links kept), only when no add-ons are on sale for a
  booking that has some.
- **pending**, **notFound**, **error**, **loading** (optional): the messages; without them, the
  visitor's language's defaults.

## APIs

- **GetOrderDetail** (POST, login token): the booking, as View Booking.
- **GetServices** (POST, `{ startDateTime: "2026-12-01 17:00:00", propertyCode, iataCode,
  currencyCode }`): the lounge's services; the one with the booking's `serviceCode` (else the
  LOUNGE one) gives the products (`availableProducts[].productCode`, `displayName`).
- **GetAddOns** (POST, login token): **a placeholder** (`scripts/endpoints.js`, `getAddOns`)
  until the add-ons API exists; the block works without it. Drafted from the source's add-on data
  (its `/editbooking/getaddonsfordate` answers HTML with these values on each Add button):

  Request: `{ "orderId": "HKBC-…", "startDateTime": "2026-12-01 17:00:00", "propertyCode":
  "PRPRTY817", "iataCode": "HKG", "currencyCode": "HKD" }`

  Answer:

  ```json
  { "items": [{
    "productCode": "PRD3876",
    "catalogueCode": "PRD3876-Add-On-PRPRTY817-LOUNGE-LCTN517-RTPLN3862",
    "displayName": "Plaza Premium Lounge Sakura Shrimp Spice (50g)",
    "description": "<p>…</p>",
    "image": "https://…/product.png",
    "basedOn": "Per Unit",
    "unitLabel": "Pieces",
    "currency": "HKD",
    "unitPrice": 108,
    "adultUnitPrice": 0,
    "childUnitPrice": 0,
    "availableInventory": 30
  }] }
  ```

  `basedOn` "Per Person" uses `adultUnitPrice` and `childUnitPrice`, else `unitPrice`;
  `availableInventory` caps the quantity (plus what's booked); the description is shown as safe
  HTML (paragraphs, lists, bold, italic and web links only). An empty `items` means none on sale.
