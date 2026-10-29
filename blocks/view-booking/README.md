# View Booking: authoring guide

A member's booking (the live site's Review your Booking page, `/en-uk/view-booking?bookingid=…`):
the order number, one box per booked item (location, date and time, guests, services, price), the
purchaser, the totals and the terms. Authors write the texts; the booking comes from the
**GetOrderDetail** API for the address's `bookingid`, with the member's login token.

The page needs a login: a visitor without a valid token on `/<lang>/view-booking` is sent to the
home page (as the members' pages). If GetOrderDetail refuses the token (401), the visitor is logged
out and sent home. A missing or unknown booking shows the `notFound` text; any other failure shows
the `error` text with Try again. The site's loader shows until the booking is in.

## Table: 2 columns (Key | Text)

| View Booking | |
| --- | --- |
| heading | Review your Booking |
| back | [My Booking](/en-uk/membership/my-booking) |
| orderNo | Order No: |
| details | BOOKING DETAILS |
| location | Location |
| dateTime | Date & Time |
| date | Date: |
| time | Time: |
| hours | hrs |
| guests | Guests |
| adults | Adult(s): |
| children | Child(ren): |
| services | Services |
| price | Price |
| edit | [Edit Booking](/en-uk/edit-booking) |
| cancel | [Cancel Booking](/en-uk/cancel-your-booking) |
| purchaser | Purchaser Information |
| title | Title |
| firstName | First Name |
| lastName | Last Name |
| countryOfResidence | Country of Residence |
| contactNumber | Contact No. |
| email | Email Address |
| subtotal | Subtotal |
| total | Total |
| taxes | (Includes applicable taxes and fees) |
| terms | Terms and Conditions |
| notFound | We couldn’t find this booking. |
| error | We couldn’t load your booking. |

- **back**: the arrow before the heading links to this page; the link text is what screen readers
  announce.
- **edit**, **cancel**: the pages the links open; the block adds `?bookingid=<this booking>`. Each
  shows only when the booking allows it (`isEligibleForModify`, `isEligibleForCancel`). Delete a
  row to hide that link.
- **children**: optional (else the API's own "Child(ren)"); a guest line with 0 isn't shown.
- **A purchaser row** (title … email) left out hides that field. **subtotal** left out hides the
  subtotal; the discounts show with the API's names (e.g. "10% Discount [PPL Pass]:").
- **notFound**, **error**, **loading** (optional): the messages; without them, the visitor's
  language's defaults.

## Where the values come from (GetOrderDetail)

| Shown | GetOrderDetail | Notes |
| --- | --- | --- |
| Order No | `orderId` | |
| Location | `orderItems[].propertyDisplayName`, `shortLocation`, `locationName` | the name, then "Near Gate 35, West Hall. Hong Kong International Airport"; a link only if the answer gives a `propertyUrl` |
| Date, Time | `orderItems[].startDate` | "30-Nov-2026" and "1600", the lounge's local time as given |
| Guests | `orderItems[].guestsCount.adult`, `.child` | |
| Services | `orderItems[].productDisplayName` | |
| Price | `orderItems[].itemPriceDetails.productTotalPrice.totalPrice` | with the item's currency, "HKD 1,763.64" |
| Purchaser | `contactInfo` (`title`, `firstName`, `lastName`, `countryCode` + `contactNumber`, `emailId`), `orderItems[0].countryOfResidence` | read-only; the phone as "(+1) 78787888" |
| Subtotal, Total | `orderTotalPrice.totalBasePrice`, `.totalPrice` | |
| Discounts | `orderItems[].itemPriceDetails.discounts[]` (`name`, `value`) | "- HKD 195.96" |
| Terms | `sortedTermsPolicies[]` (`termsName`, `description`) | the description's HTML is cleaned: only text, paragraphs, lists, bold and italic, lines and web links are kept |

## Look

As the live site: the booking pages' maroon band at the top, right under the header (drawn by the
block, from 768px; the same styles as the Booking Steps block, `styles/booking-steps.css`); the item's five parts in a row with thin lines between them from 992px (each
label beside its value), stacked below (each label grey above its maroon value); the purchaser's
fields two to a row from 992px; the totals on the right, the subtotal and discounts only from 992px
(as the source); the terms in grey under a black line.
