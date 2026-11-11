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
- the banner's Promo card, and axe (with `AXE_CORE`; the shared steps band is left out, see below)

```sh
BW_HOST=http://localhost:3000 PLAYWRIGHT=/path/to/playwright/index.mjs AXE_CORE=/path/to/axe.min.js node test/checkout/checkout.test.mjs
```

The page must exist on the preview being tested (or in a local `content/` folder served with
`aem up --html-folder content --html-mount / --prefer-plain-html`).

The shared steps band (styles/booking-steps.css, as on Edit Booking) fades the steps that aren't
current, as the source does (2.84:1 contrast), so axe leaves it out here.
