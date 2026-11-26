# Cancel Booking: authoring guide

A member's booking before it's cancelled (the live site's Review Cancel Booking Details page,
`/en-uk/cancel-your-booking?bookingid=…`): the title after an arrow back to the bookings, the booking summary (one row per booked lounge visit, tagged **To Cancel**),
the total, the cancellation fee and the refund amount, and a bar with the **Cancel Booking**
button, which shows a notice popup, then a confirmation popup, before the booking is cancelled. Authors write the texts; the booking comes from the **GetOrderDetail** API for the
address's `bookingid`, with the member's login token.

The page needs a login: give it `members-only` true (the page's Metadata, or a metadata sheet row
such as `/**/cancel-your-booking`). A guest goes to the home page with the page in
`?redirectUrl=`, and comes back after logging in. An expired login, or GetOrderDetail refusing the
token (401), logs out and goes home. A missing or unknown booking shows the `notFound` text; any
other failure shows the `error` text with Try again. The site's loader shows until the booking is
in.

## Where to put it

In the page's first section, right after a [Booking Steps](../booking-steps/README.md) block with
the page's steps (`- My Bookings`, `- **Review Cancelled Booking Details**`, `- Confirm`): the
band then sits right under the header, with the source's space below it. The section has no space
of its own under the block, so the bar sits right on the footer.

## Table: 2 columns (Key | Text)

| Cancel Booking | |
| --- | --- |
| heading | Review Cancel Booking Details |
| back | [My Bookings](/en-uk/membership/my-booking) |
| summary | BOOKING SUMMARY |
| location | Location |
| dateTime | Date & Time |
| date | Date: |
| time | Time: |
| hours | hrs |
| guests | Guests |
| adults | Adult: |
| children | Child: |
| services | Services |
| price | Price |
| toCancel | To Cancel |
| total | Total |
| fee | Cancellation Fee |
| refund | Refund Amount |
| button | Cancel Booking |
| noticeTitle | Notice |
| notice | Your refund amount of {amount} will be processed and it may take up to 4-6 weeks, depending on your card issuing company, for it to appear in your original payment method. |
| noticeConfirm | Confirm |
| noticeCancel | Cancel |
| confirmTitle | Confirmation |
| confirmText | Are you sure you wish to cancel this booking? |
| confirmYes | Yes |
| confirmNo | No |
| cancellationReason | Change of travel plans |
| confirmationPage | [/en-uk/booking-cancel-confirmation](/en-uk/booking-cancel-confirmation) |
| notCancellable | This booking can’t be cancelled online. |
| loading | Loading your booking… |
| notFound | We couldn’t find this booking. |
| error | We couldn’t load your booking. |

- **back**: the arrow before the heading links to this page; the link text is what screen readers
  announce. Leave it out for no arrow.
- **adults**, **children**: the guests' labels; a count of 0 isn't shown.
- **toCancel**: the tag under each visit's location. Leave it out for no tag.
- **total**, **fee**, **refund**: the amounts' labels; a row left out hides that amount.
- **button**: the button in the bar. It shows only when every booked item can be cancelled
  (`isEligibleForCancel`) and the **notice** and **noticeConfirm** rows are there (a booking is
  never cancelled without asking); a booking that can't be cancelled shows **notCancellable**
  instead.
- **noticeTitle**, **notice**, **noticeConfirm**, **noticeCancel**: the popup the button opens, as
  the source's: the site's confirmation popup (`scripts/confirm-dialog.js`: the maroon bar with
  the close button, then, centred, the title, the text with `{amount}` as the refund amount, "HKD
  442.32", and Confirm (outlined) and Cancel (filled)). **noticeConfirm** goes on to the confirmation; **noticeCancel**, the close
  button, Esc and a click beside the popup keep the booking (focus back on the button). Without
  **noticeTitle** the popup has no title; without **noticeCancel**, only Confirm.
- **confirmTitle**, **confirmText**, **confirmYes**, **confirmNo**: the second popup, after the
  notice's Confirm, in the same look ("Are you sure you wish to cancel this booking?", Yes
  outlined, No filled). **confirmYes** cancels the booking; **confirmNo**, the close button, Esc
  and a click beside it keep it. Without **confirmText** or **confirmYes** there's no second popup:
  the notice's Confirm cancels.
- **cancellationReason**: the reason sent with the cancellation.
- **confirmationPage** (optional): the Order Cancelled! page, a link or path on this site, opened
  once the booking is cancelled with the booking added (`?bookingid=HKBC-11339-64UJUF`). Without
  the row, the language site's `/booking-cancel-confirmation` page.
- **loading**, **notFound**, **error**: the messages (loading for screen readers, while the
  site's loader shows; error with Try again). Row names ignore capitals.

## Where the values come from (GetOrderDetail)

| Shown | GetOrderDetail | Notes |
| --- | --- | --- |
| Location | `orderItems[].propertyDisplayName`, `shortLocation`, `locationName` | the name, then "Near Gate 35, Departures, Hong Kong International Airport" |
| Date, Time | `orderItems[].startDate` | "30-Nov-2026" and "1530", the lounge's local time as given |
| Guests | `orderItems[].guestsCount.adult`, `.child` | |
| Services | `orderItems[].productDisplayName` | the lounge service (`serviceType` LOUNGE), then its add-ons ("1 x …"); the items at the same lounge and start time (`propertyCode`, `startDate`) are one row |
| Price | `orderItems[].itemPriceDetails.productTotalPrice.totalPrice` | the row's items added up, with their currency, "HKD 520.29" |
| Total | `orderTotalPrice.totalPrice` | |
| Cancellation Fee | `orderTotalPrice.cancellationCharge` | "- HKD 77.97"; 0 in the answers seen so far (before a cancellation) |
| Refund Amount | the total less the fee | in maroon |
| Cancel Booking | `orderItems[].isEligibleForCancel` | |
| The notice's `{amount}` | the Refund Amount | |

## Cancelling

**confirmYes** (or the notice's Confirm, without the confirmation) asks the cancel booking API (`apiUrl('cancelBooking')`, the booking system's
`/api/v1/web/ppg-app/cancel-booking` in `scripts/endpoints.js`) to cancel the booking: a `POST` of
JSON `{ "orderId": "HKBC-10240-64UIS3", "cancellationReason": "Change of travel plans" }` with the
member's login token (`Authorization: Bearer <token>`, `scripts/auth.js`). The site's loader shows
and the button is disabled while it runs.

- **Cancelled** (the API answers 200, with `{ "orderId": "HKBC-11339-64UJUF" }`): the page goes to
  the **confirmationPage** for the booking (`/en-uk/booking-cancel-confirmation?bookingid=…`), the
  loader staying up while it loads.
- **A refused login (401):** logs out and goes home, as when the booking itself can't be loaded.
- **Any other answer, or no answer:** the loader goes and the button is back; the browser console
  says what the API answered. A message for the member comes later.

The fee: GetOrderDetail's `cancellationCharge` is 0 for a booking not yet cancelled, so the
amounts show "- HKD 0.00" and the whole total as the refund. The source's fee (e.g. HKD 77.97, the
terms' USD 10 per person) comes from elsewhere; `readAmounts` in `cancel-booking.js` is the one
place to change when its source is known.

## Look

As the live site:
- The content 1230px wide at most, centred.
- From 992px, the visit's five parts in a row with thin lines between them (each label beside its
  value), a grey line under them; below 992px stacked, each label grey above its maroon value.
- The amounts on the right half (the full width below 992px), the refund in maroon.
- The bar in the brand tint across the page's full width, right on the footer, the button on the
  right.
