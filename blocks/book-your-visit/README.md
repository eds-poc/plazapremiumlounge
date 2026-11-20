# Book Your Visit: authoring guide

The source's `/{lang}/book-your-visit`: the cart's lounge visit, to check and change before the
checkout. Visitors reach it from the mini cart's **Edit** and from the checkout's **Back to Edit
Booking**. Everything shown comes from the cart; authors write only the page's texts.

## The page

One section, in this order (`/en-uk/book-your-visit`):

| Block | What it is |
| --- | --- |
| Booking Steps | `Lounges`, **`Book`** (bold: the current step), `Details`, `Confirm & Pay`; the phones' name row `Booking` |
| Title (back) | `# [Book Your Visit](/en-uk/find/lounge)`. The arrow's link is set from the cart: the lounge's page with the visit (`?propertycode=…&currency=…&date=…&time=…`), as the source's |
| Book Your Visit | This block (its texts below) |
| Add-ons | The visit's Additional Services (see its guide). The block moves it under the form |
| Metadata | Title, `robots: noindex, nofollow` |

## Texts (Key | Text rows)

| Key | en-uk (the source's) |
| --- | --- |
| note | Bookings must be made at least 1 hour prior to your arrival; otherwise, please proceed to our lounge as a walk-in guest. Submit Group Booking requests [here](/en-uk/group-booking) (for 10 people or more). |
| date | Date |
| time | Time |
| adults | Adult(s) |
| children | Child(ren) |
| childrennote | Complimentary for under 2 years old |
| service | Service Details |
| summary | Booking Summary |
| checkout | Check Out |
| proceed | Confirm & Proceed |
| subtotal | Subtotal |
| notimeslot | Only time slots at least 1 hour from now are available. |
| leadtime | Booking must be made at least 1 hour in advance. |
| error | An error occurred. Please try again. |

A missing row shows the English text above (the note shows nothing). The labels show in capitals.

## What visitors see

- **The lounge:** its Departures / Arrivals badge (with its tip), its name and location. The arrow
  folds the details away.
- **Date and Time:** the only things that change here, as on the source.
  - **The calendar** starts at the lounge's today (its own time zone).
  - **The times** are every half hour. Today's first bookable one is the half hour after now, the
    lounge's lead time (an hour when it has none) and 15 minutes, as the source's; earlier ones are
    off. No time left today: the `notimeslot` text.
- **Adult(s), Child(ren), Service Details:** shown, locked.
- **The Booking Summary** (the checkout's, `scripts/booking-summary.js` and
  `styles/booking-summary.css`): the lines, the add-ons ("Additional Services: 2x …"), the service
  total with the discounts, the promo code, the total, **Check Out**.
- **Phones and tablets (below 992px):** a list of Date and Time (each with **Edit**: a pop-up with the
  calendar or the times, then Confirm), Guests, Services and the add-ons; the promo code; a bar fixed
  at the bottom with the subtotal (the price before discounts struck) and **Confirm & Proceed**.
- **Check Out / Confirm & Proceed:** a bookable time is checked again (else the `leadtime` text).
  - **When the date or time changed:** the cart's lounge is saved with the new start (the booking
    system's cart; the promo code put back), behind the site's loader.
  - **Then:** the checkout (`/{lang}/guest-checkout`, or the page metadata `cart-checkout-url`).
  - **A failed save:** the `error` text, and the page stays.
- **The add-ons** follow the chosen date and time (the `book-your-visit:change` event).
- **No cart, or a cart without a lounge (passes):** the homepage, as the source's.

## Data

- **The cart** (`scripts/cart.js`, `scripts/cart-state.js`): the lounge's line (name, location,
  start, guests, product, property and service codes, time zone) and its add-ons. The new start is
  saved with `updateLounge({ start })`.
- **The lead time** comes from the lounge page's service (GetPropertyDetail, `leadTime`); when it
  can't be read, an hour.
