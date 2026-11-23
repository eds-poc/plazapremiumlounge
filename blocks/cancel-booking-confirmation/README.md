# Cancel Booking Confirmation: authoring guide

A cancelled booking's summary (the live site's "Order Cancelled!" page,
`/en-uk/booking-cancel-confirmation?bookingid=…`): the title and message on the left, the
**Cancellation Details** card on the right (the order number, the lead guest, each cancelled lounge
visit, what was paid, the cancellation fee and the refund), then the **Back To Home** button.
Authors write the texts; the summary comes from the **cancellation summary** API for the address's
`bookingid`, with the member's login token.

## The page

- **The section:** put the block alone in the page's first section. The block fills the section
  in the brand maroon (white text, the white button): no Section Metadata needed.
- **Page metadata:** `members-only` = `true` (a guest goes to the home page and comes back after
  logging in) and `header` = `transparent` (from 1200px the header's bar is white on the maroon
  section, as the source).
- An expired login, or the API refusing the token (401), logs out and goes home. A missing booking
  shows the **notFound** text; any other failure the **error** text with Try again. The site's
  loader shows until the summary is in.

## Table: 2 columns (Key | Text)

| Cancel Booking Confirmation | |
| --- | --- |
| heading | Order Cancelled! |
| message | Your Booking has been cancelled successfully. … please [Contact Us](/en-uk/contact-us). |
| title | Cancellation Details |
| orderNo | Order No: |
| leadGuest | Lead Guest Details |
| firstName | First Name: |
| lastName | Last Name: |
| email | Email: |
| dateTime | Date & Time: |
| hours | hrs |
| guests | Guests: |
| adult | 1 Adult |
| adults | {n} Adults |
| child | 1 Child |
| children | {n} Children |
| services | Services: |
| paid | Paid: |
| fee | Cancellation Fee |
| refund | Total Refund |
| taxes | (Includes applicable taxes and fees) |
| back | [Back To Home](/en-uk/) |
| loading | Loading your cancellation… |
| notFound | We couldn’t find this booking. |
| error | We couldn’t load your cancellation. |

- **message**: rich text: paragraphs, bold and links (e.g. Contact Us) are kept as authored.
- **adult**, **adults**, **child**, **children**: the guests, one or more (`{n}` the count): "1
  Adult", "2 Adults, 1 Child". A count without its text is left out.
- **firstName**, **lastName**, **email**: the lead guest's lines; the section shows only with a
  name or email in the answer.
- **paid**, **fee**, **refund**, **taxes**: the amounts' labels (and the refund's note); a row left
  out hides that line.
- **back**: the button's link (the language site's home). Leave it out for no button.
- Row names ignore capitals.

## The cancellation summary API

`apiUrl('cancellationSummary')`: the booking system's `/api/v1/web/ppg-app/cancellation-summary`
(`scripts/endpoints.js`), a `GET` with the order in the address (`?orderId=HKBC-11339-64UJVG`) and
the member's login token (`Authorization: Bearer <token>`).

**Not live yet.** Until it is, on the preview and local sites only (`.aem.page`, localhost) a
failure shows the sample answer `sample-cancellation-summary.json` (the order HKBC-11339-64UIPS),
with a console warning, so the page can be reviewed. Never on `.aem.live` or the real site.

| Shown | The answer | Notes |
| --- | --- | --- |
| Order No | `orderId` | |
| Lead Guest Details | `contactInfo.firstName`, `.lastName`, `.emailId` | assumed, as GetOrderDetail's `contactInfo` (not in the first sample) |
| The lounge | `orderItems[].propertyDisplayName`, `shortLocation`, `locationName` | the items at the same lounge and start time are one visit |
| Date & Time | `orderItems[].startDate` | "25-Nov-2026, 1930 hrs", the lounge's local time as given |
| Guests | `orderItems[].guestsCount.adult`, `.child` | |
| Services | `orderItems[].productDisplayName` | the add-ons after it, "1 x …" |
| Paid | `orderTotalPrice.totalPrice` | with `orderCurrency`, "HKD 1,763.64" |
| Cancellation Fee | `cancellationCharge` | "- HKD 77.97" |
| Total Refund | `totalRefund` | |

`waiverAmount` and `itemCancellationCharge` aren't shown (the design has no place for them).

## Look

As the source: the content 1230px wide at most, centred. From 992px the message (white, 20px) and
the card side by side; below it the card under the message. The card: warm grey, rounded, the
labels grey; the visit's values maroon and bold, date and time beside the guests (from 576px),
the services below; thin lines above the amounts and above the refund. The button white with
maroon text, centred, 215px wide. The source's petal pattern on the maroon isn't in yet (plain
maroon for now).
