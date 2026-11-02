# Booking List: authoring guide

The logged-in member's bookings, as the source "My Bookings" page
(`/en-uk/membership/my-booking`):
- **Tabs:** Upcoming, Past Bookings and Cancelled (the labels as authored). Upcoming shows first.
  Each tab's bookings load the first time it's opened; opening it again shows them straight away.
- **A card per booking:** the lounge's photos (a slider), the order number, the lounge and where
  it is, the date, time, guests, services and additional services, the price, and the booking's
  actions; a line below each card.
- **Pages:** 10 bookings at a time, with « 1 2 3 » buttons below the cards when there are more.
- **Not logged in:** a members' page (`/en-uk/membership/…`) sends the visitor to the home page
  (`/en-uk/`); the block itself shows nothing without a login.
- **Login refused or expired** (the booking API answers 401 or 403): the visitor is logged out and
  goes to the home page.

## Table

Every text the block shows is a row: a name, then the text in the page's language. A text left
out isn't shown (see [Leaving a row out](#leaving-a-row-out)), so author all of them. `{id}` is
replaced with the order number, `{n}` with the number of guests. If **Order** has no `{id}`, the
number is added at its end (`Order No.` → `Order No. HKBC-…`); if **Adults** or **Children** has no
`{n}`, the count is added at its start (`Adults` → `2 Adults`).

On preview pages (`*.aem.page`), the browser console lists the text rows the block didn't find
and the rows it doesn't know, so a mistyped row name (`Veiw` for `View`) shows up there.

| Booking List | |
| --- | --- |
| Upcoming tab | Upcoming |
| Past tab | Past Bookings |
| Cancelled tab | Cancelled |
| Tabs label | Bookings |
| Order | Order No. {id} |
| Date | Date: |
| Time | Time: |
| Guests | Guests: |
| Services | Services: |
| Additional services | Additional Services: |
| Adult | 1 Adult |
| Adults | {n} Adults |
| Child | 1 Child |
| Children | {n} Children |
| Price note | (Includes applicable taxes and fees) |
| Resend | Resend Booking Confirmation |
| View and modify | View/Modify Booking |
| View | View Booking |
| Cancel | Cancel Booking |
| Cancel confirm | Cancel booking {id}? |
| Cancelled message | Booking {id} was cancelled. |
| Resent | The booking confirmation was sent again. |
| Action error | That didn't work. Please try again. |
| No upcoming | You have no upcoming bookings. |
| No past | You have no past bookings. |
| No cancelled | You have no cancelled bookings. |
| Error | We couldn't load your bookings. |
| View page | [/en-uk/view-booking](/en-uk/view-booking) |
| Page size | 10 |

| Row | Where it shows |
| --- | --- |
| Upcoming tab, Past tab, Cancelled tab | The tabs' labels |
| Tabs label | The tabs' name for screen readers (not shown on the page) |
| Order | Each card's title, a link to the booking |
| Date, Time, Guests, Services, Additional services | The labels of the card's details |
| Adult, Adults, Child, Children | The guests: one adult, more adults, one child, more children (`2 Adults, 1 Child`) |
| Price note | Below the price |
| Resend, View and modify, View, Cancel | The card's actions (see [Actions](#actions)) |
| Cancel confirm | The question asked before cancelling |
| Cancelled message | Above the tabs once a booking is cancelled |
| Resent, Action error | On the card, after resending, or when an action fails |
| No upcoming, No past, No cancelled | Instead of the cards when a tab has no bookings |
| Error | Instead of the cards when the bookings can't be loaded |

- **View page** (optional): the page that shows one booking, as a link or path on this site.
  Each card's order number and **View Booking** / **View/Modify Booking** link go to it with
  the booking added (`/en-uk/view-booking?bookingid=HKBC-11339-64SCYL`). Without the row, the
  language site's `/view-booking` page (`/en-uk/view-booking` on `/en-uk/` pages).
- **Page size** (optional): bookings per page, a whole number. 10 without it.
- Row names ignore capitals and spaces. The block's rows can be in any order.

### Leaving a row out

| Left out | The block |
| --- | --- |
| A tab's label | Doesn't show that tab. Without any, there's no tab bar and the Upcoming bookings show |
| Tabs label | Gives the tabs no name for screen readers |
| Order | Shows the order number alone |
| A detail's label (Date, …) | Shows the value without its label |
| Adult, Adults, Child or Children | Leaves that count out of the guests |
| Price note | Shows the price alone |
| An action (Resend, View and modify, View, Cancel) | Doesn't show that action |
| Cancel confirm | Doesn't show **Cancel Booking** (a booking is never cancelled without asking) |
| A message | Shows nothing in its place |

## What each card shows

The API's response is a list of bookings; each booking's `orderItems` are its services, and they
carry the lounge.

| On the card | From the booking API |
| --- | --- |
| Photos | `orderItems[].images[]` (`path`, in the given order), of the first item with photos |
| Order No. … | `orderId` |
| Lounge name | `orderItems[].propertyDisplayName` (`Plaza Premium First`), else `propertyName` |
| Its place and the airport | `orderItems[].shortLocation`, `orderItems[].locationName` (else the booking's `locationName`) |
| Date: `30-Nov-2026`, Time: `1600 hrs` | `serviceDate` (`30 Nov 2026 16:00:00`), shown as given (the lounge's local time) |
| Guests: `2 Adults`, `2 Adults, 1 Child` | `guests.adult`, `guests.child` |
| Services: `Lounge Use - 3 Hours` | the first order item's `productDisplayName` (else `productName`) |
| Additional Services: `1 x Sakura Shrimp Spice (50g)`, one per line below the label | the other order items: `quantity` x `productDisplayName`; no row without any |
| `HKD 1,763.64` (Includes applicable taxes and fees) | `currencyCode`, `totalPrice` |

### Actions

| Tab | Actions |
| --- | --- |
| Upcoming | **Resend Booking Confirmation** (the API has no flag for it: every upcoming booking), **View/Modify Booking** (`isEligibleForModify`) or **View Booking**, **Cancel Booking** (`isEligibleForCancel`) |
| Past Bookings, Cancelled | **View Booking** |

- **Resend Booking Confirmation** asks the API to send it again and shows the **Resent** text on
  the card.
- **Cancel Booking** asks the **Cancel confirm** question first. When it's done, the list loads
  again (the booking moves to Cancelled) with the **Cancelled message** above the tabs.
- If an action fails, the card shows the **Action error** text.

## The page address

| Shown | Address |
| --- | --- |
| Upcoming, page 1 (the default) | `/en-uk/membership/my-booking` |
| Past Bookings | `?status=past` |
| Cancelled | `?status=cancelled` |
| Another page | `&page=2` |

A reload or a shared link shows the same tab and page; the browser's Back and Forward buttons
work. Choosing a tab goes back to page 1. A tab that isn't shown (its label left out) opens the
first tab instead.

## Interface text

The texts are the block's rows, authored per language page. Only `hrs` (after the time) is the
site's translation (`propertyHours` in `scripts/i18n.js`). Dates use the page language's month
names (English: `30-Nov-2026`, as the source).

## For developers

- The bookings come from `apiUrl('bookingList')` (`scripts/endpoints.js`), a tab at a time: a
  `POST` of JSON `{ "languageCode": "en", "propertyTypeCode": "LOUNGE", "status": "Upcoming booking" }`
  with the login token (`scripts/auth.js`) as `Authorization: Bearer <token>`. `status` is the
  tab's, as the API spells it (case-sensitive): `Upcoming booking`, `Past booking` or
  `Cancelled`. The response is the tab's list of bookings (`{ items: [...] }` works too).
- Each tab is asked for once, the first time it's shown, and kept for the page; a failed request
  isn't kept, so opening the tab again asks again. A cancellation loads the list again (the
  current tab asked for anew).
- A 401 or 403 (`{ "error": "…" }`) logs the visitor out and goes home (`logout`). Any other
  failure, or a `{ error }` or `{ errorCode, message }` answer, shows the **Error** text in that
  tab.
- The texts' rows are `TEXTS` in `booking-list.js` (the block's name for each, then its row name);
  `VALUE_AT` adds a missing `{id}` / `{n}` to Order, Adults and Children.
- `decorate` doesn't wait for the bookings: the section (the side nav beside the block) and the
  footer show straight away, the block keeping its room (`aria-busy`, at least the window's height)
  and the site's loader showing until the first tab's bookings are in.
- **Placeholder paths:** the resend and cancel APIs don't exist yet. `resendBookingConfirmation`
  and `cancelBooking` (`POST`, JSON `{ orderId }`, with the token) are in `scripts/endpoints.js`
  with placeholder paths, to be set to the real ones.
- The photo slider is `buildSlider` from `scripts/properties.js` (prefix `booking-list-slider`),
  the pages `createPager` from `scripts/pagination.js` (`setItems` per tab, `sync` on
  Back/Forward).
- The tabs are a tablist (the arrows, Home and End move between them); the first tab's cards are
  put together hidden and shown at once, so the page doesn't shift while the bookings load. A
  tab's request shows the site's loader (`setLoading`), the previous tab's cards staying until
  its bookings arrive. The block keeps `data-status` and `data-page`.
