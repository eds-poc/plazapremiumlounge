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

66 checks.

```sh
BW_HOST=http://localhost:3000 PLAYWRIGHT=/path/to/playwright/index.mjs AXE_CORE=/path/to/axe.min.js node test/checkout/checkout.test.mjs
```

The pages must be the split ones (Booking Steps, Title (back), Promo (card), Checkout) on the
preview being tested, or in a local `content/` folder served with
`aem up --html-folder content --html-mount / --prefer-plain-html`.

The shared steps band (styles/booking-steps.css, as on Edit Booking) fades the steps that aren't
current, as the source does (2.84:1 contrast), so axe leaves it out here.
