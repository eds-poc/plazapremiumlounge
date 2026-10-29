# Booking List: authoring guide

The logged-in member's bookings, as the source "My Bookings" page
(`/en-uk/membership/my-booking`):
- **Tabs:** Upcoming, Past Bookings and Cancelled (the labels as authored). Upcoming shows first.
  Each tab's bookings load the first time it's opened; opening it again shows them straight away.
- **A card per booking:** the lounge's photos (a slider), the order number, the lounge and where
  it is, the date, time, guests and services, the price, and the booking's actions.
- **Pages:** 10 bookings at a time, with « 1 2 3 » buttons below the cards when there are more.
- **Not logged in:** a members' page (`/en-uk/membership/…`) sends the visitor to the home page
  (`/en-uk/`). On any other page the block shows "Log in to see your bookings." and a **Log In**
  button that opens the site's login modal; after logging in, the bookings show on the same page.
- **Login refused or expired** (the booking API answers 401 or 403): the visitor is logged out and
  goes to the home page.

## Table: all rows optional

| Booking List | |
| --- | --- |
| Upcoming tab | Upcoming |
| Past tab | Past Bookings |
| Cancelled tab | Cancelled |
| View page | [/en-uk/view-booking](/en-uk/view-booking) |
| Page size | 10 |

- **Upcoming tab**, **Past tab**, **Cancelled tab** (optional): the tabs' labels, in the page's
  language. A tab without its row shows the site's translation (`Upcoming`, `Past Bookings`,
  `Cancelled` in English).
- **View page** (optional): the page that shows one booking, as a link or path on this site.
  Each card's order number and **View Booking** / **View/Modify Booking** link go to it with
  the booking added (`/en-uk/view-booking?bookingid=HKBC-11339-64SCYL`). Without the row, the
  language site's `/view-booking` page (`/en-uk/view-booking` on `/en-uk/` pages).
- **Page size** (optional): bookings per page, a whole number. 10 without it.
- An empty `Booking List` table is enough: put it on the My Bookings page, with the page heading
  above it if the page has one.

### Testing without a login

| Booking List | |
| --- | --- |
| Source | [/blocks/booking-list/sample-bookings.json](/blocks/booking-list/sample-bookings.json) |

- **Source** (testing only): a JSON file on this site in the booking API's shape. The block shows
  its bookings **without a login and without the API**, so use it only on test pages (e.g. in
  `/drafts/`). `sample-bookings.json` next to this block has 5 sample bookings: 2 upcoming, 2 past
  and 1 cancelled.

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
| Services: `Lounge Use 3 hrs + Sakura Shrimp Spice (50g)` | each `orderItems[]`'s `productDisplayName` (and `quantity` when more than 1), joined with + |
| `HKD 1,763.64` (Includes applicable taxes and fees) | `currencyCode`, `totalPrice` |
| The tab | `bookingSchedule`: `Upcoming booking`, `Past booking`, `Cancelled` |

### Actions

| Tab | Actions |
| --- | --- |
| Upcoming | **Resend Booking Confirmation** (the API has no flag for it: every upcoming booking), **View/Modify Booking** (`isEligibleForModify`) or **View Booking**, **Cancel Booking** (`isEligibleForCancel`) |
| Past Bookings, Cancelled | **View Booking** |

- **Resend Booking Confirmation** asks the API to send it again and says so on the card.
- **Cancel Booking** asks "Cancel booking HKBC-…?" first. When it's done, the list loads again
  (the booking moves to Cancelled) with "Booking HKBC-… was cancelled." above the tabs.
- If an action fails, the card says "That didn't work. Please try again."

## The page address

| Shown | Address |
| --- | --- |
| Upcoming, page 1 (the default) | `/en-uk/membership/my-booking` |
| Past Bookings | `?status=past` |
| Cancelled | `?status=cancelled` |
| Another page | `&page=2` |

A reload or a shared link shows the same tab and page; the browser's Back and Forward buttons
work. Choosing a tab goes back to page 1.

## Interface text

The tabs (when not authored), labels, guests, the taxes note, the actions and the messages come
from the site's translations (`scripts/i18n.js`), by page language. Dates use the page language's month names
(English: `30-Nov-2026`, as the source).

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
  failure, or a `{ error }` or `{ errorCode, message }` answer, shows "We couldn't load your
  bookings." in that tab.
- A Source file is read once per tab too, its bookings sorted into the tabs by `bookingSchedule`.
- **Placeholder paths:** the resend and cancel APIs don't exist yet. `resendBookingConfirmation`
  and `cancelBooking` (`POST`, JSON `{ orderId }`, with the token) are in `scripts/endpoints.js`
  with placeholder paths, to be set to the real ones.
- The block listens for `auth:change` (login, logout) and loads again.
- The photo slider is `buildSlider` from `scripts/properties.js` (prefix `booking-list-slider`),
  the pages `createPager` from `scripts/pagination.js` (`setItems` per tab, `sync` on
  Back/Forward).
- The tabs are a tablist (the arrows, Home and End move between them); the first tab's cards are
  put together hidden and shown at once, so the page doesn't shift while the bookings load. A
  tab's request shows the site's loader (`setLoading`), the previous tab's cards staying until
  its bookings arrive. The block keeps
  `data-status` and `data-page`.
