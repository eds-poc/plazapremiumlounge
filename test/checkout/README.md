# Checkout tests

`checkout.test.mjs` checks the Checkout block (`blocks/checkout`) on `/en-uk/guest-checkout`, with
routed answers: the cart API as stage answers it (`test/cart/fixtures`: a lounge cart and a pass
cart) and the countries as GetCountries answers them (`fixtures/countries.json`). Nothing reaches
the booking system.

It covers:
- the summary, the terms and the flight fields for both carts
- Payment off until the Privacy Policy and Terms & Conditions boxes are ticked
- the source's rules: the required fields, the contact number, the emails, the flight number
- the `checkout:payment` announcement and the preview's note
- no cart, a cart that can't be read, a cart emptied meanwhile, a tab's stored data
- the phone layout (the summary first, the bar, the fold) and the desktop one
- the page's other blocks: Booking Steps (the band itself, its steps, done and current, its phone
  name with and without row 2, 30px / 50px after it), Title (back) (the heading 1 link, its arrow's
  size, colour and hover, 18px / 32px), the banner's Promo card; the order of the four blocks
- old Checkout rows (`steps`, `back`, `banner`) left out of the checkout
- the other four languages' pages
- axe on the checkout, the title and the banner (with `AXE_CORE`; the steps band is left out, see
  below)

- the header without Book Now and the cart (the homepage keeps them); no cart on a live host
  (http://checkout.test, answered by the preview server): the homepage, also when the cart is
  emptied on the page
- quiet empty fields, trailing trim, new-tab links, the short dial code, the promo field (an
  empty code, capitals, stage's BKNG048)

- the Arrival / Departure Flight list (opens on focus with the 136 airlines, filters, a click or
  ↓ Enter fills, Escape or leaving closes, free text kept; its look) at 1440 and 375

- a 3-digit dial code (+852) widening the dial code's part, the number after the line

- the Smart Traveller card's Log In opening the login modal over the checkout

- the Departures / Arrivals badge above a lounge's name: departures (the fixture), arrivals, none
  for a location that says neither or a pass; its look and plane; its tip (hidden, hover, a click,
  Escape, a click elsewhere; to its right, above it on a phone); the zh-hk page's words and texts

The header checks wait for the header to load (its navigation comes after the checkout).

113 checks.

```sh
BW_HOST=http://localhost:3000 PLAYWRIGHT=/path/to/playwright/index.mjs AXE_CORE=/path/to/axe.min.js node test/checkout/checkout.test.mjs
```

The pages must be the split ones (Booking Steps, Title (back), Promo (card), Checkout) on the
preview being tested, or in a local `content/` folder served with
`aem up --html-folder content --html-mount / --prefer-plain-html`.

The shared steps band (styles/booking-steps.css, as on Edit Booking) fades the steps that aren't
current, as the source does (2.84:1 contrast), so axe leaves it out here.
