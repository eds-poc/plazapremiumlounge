# Booking List: authoring guide

The logged-in member's bookings, as the source "My Bookings" page
(`/en-uk/membership/my-booking`):
- **Tabs:** Upcoming, Past Bookings and Cancelled. Upcoming shows first.
- **A card per booking:** the lounge's photos (a slider), the order number, the lounge and where
  it is, the date, time, guests and services, the price, and the booking's actions.
- **Pages:** 10 bookings at a time, with « 1 2 3 » buttons below the cards when there are more.
- **Not logged in:** "Log in to see your bookings." and a **Log In** button that opens the site's
  login modal. After logging in, the bookings show on the same page.

## Table: all rows optional

| Booking List | |
| --- | --- |
| View page | [/en-uk/view-booking](/en-uk/view-booking) |
| Page size | 10 |

- **View page** (optional): the page that shows one booking, as a link or path on this site.
  Each card's order number and **View Booking** / **View/Modify Booking** link go to it with
  the booking added (`/en-uk/view-booking?bookingid=HKBC-11339-64SCYL`). Without the row, the
  language site's `/view-booking` page (`/en-uk/view-booking` on `/en-uk/` pages).
- **Page size** (optional): bookings per page, a whole number. 10 without it.
- An empty `Booking List` table is enough: put it on the My Bookings page, with the page heading
  above it if the page has one.

### Testing before the booking API exists

| Booking List | |
| --- | --- |
| Source | [/blocks/booking-list/sample-bookings.json](/blocks/booking-list/sample-bookings.json) |

- **Source** (testing only): a JSON file on this site in the booking API's shape. The block shows
  its bookings **without a login and without the API**, so use it only on test pages (e.g. in
  `/drafts/`). `sample-bookings.json` next to this block has 4 sample bookings: 1 upcoming, 2 past
  and 1 cancelled.

## What each card shows

| On the card | From the booking API |
| --- | --- |
| Photos | `images[]` (`path`, in `sequence` order), as the properties API |
| Order No. … | `orderId` |
| Lounge name, then its place and the airport | `propertyName`; `shortLocation`, `locationName` |
| Date: `30-Nov-2026`, Time: `1600 hrs` | `serviceDate` (`30 Nov 2026 16:00:00`), shown as given (the lounge's local time) |
| Guests: `2 Adults`, `1 Adult, 1 Child` | `guests.adult`, `guests.child` |
| Services: `Lounge Use 3 hrs + Sakura Shrimp Spice (50g)` | `services[].name` (and `quantity` when more than 1), joined with + |
| `HKD 1,763.64` (Includes applicable taxes and fees) | `currencyCode`, `totalPrice` |
| The tab | `bookingSchedule`: `Upcoming booking`, `Past booking`, `Cancelled` |

### Actions

| Tab | Actions |
| --- | --- |
| Upcoming | **Resend Booking Confirmation** (unless `isEligibleForResend` is `false`), **View/Modify Booking** (`isEligibleForModify`) or **View Booking**, **Cancel Booking** (`isEligibleForCancel`) |
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

The tabs, labels, guests, the taxes note, the actions and the messages come from the site's
translations (`scripts/i18n.js`), by page language. Dates use the page language's month names
(English: `30-Nov-2026`, as the source).

## For developers

- The bookings come from `apiUrl('bookingList')` (`scripts/endpoints.js`), `GET` with
  `languageCode` and the login token (`scripts/auth.js`) as `Authorization: Bearer <token>`.
  The response is `{ items: [...] }`. A 401 or 403 logs the visitor out (`clearToken`) and the
  block shows the login prompt. Any other failure, or `{ errorCode, message }`, shows "We couldn't
  load your bookings.".
- **Placeholder paths:** the booking APIs don't exist yet. `bookingList`,
  `resendBookingConfirmation` and `cancelBooking` (`POST`, JSON `{ orderId }`, with the token) are
  in `scripts/endpoints.js` with placeholder paths, to be set to the real ones.
- The block listens for `auth:change` (login, logout) and loads again.
- The photo slider is `buildSlider` from `scripts/properties.js` (prefix `booking-list-slider`),
  the pages `createPager` from `scripts/pagination.js` (`setItems` per tab, `sync` on
  Back/Forward).
- The tabs are a tablist (the arrows, Home and End move between them); the cards are put together
  hidden and shown at once, so the page doesn't shift while the bookings load. The block keeps
  `data-status` and `data-page`.
