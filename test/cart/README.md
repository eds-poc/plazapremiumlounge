# Cart tests (dev only)

Browser checks for the cart (`scripts/cart.js`, `cart-state.js`, `mini-cart.js`, the header's
count, the lounge card's Book Now). Not served: `.hlxignore` lists `test/*`. See
[docs/cart.md](../../docs/cart.md).

Same setup as `test/booking-widget` (its harness): the local preview, or `BW_HOST`; `PLAYWRIGHT`;
`AXE_CORE` for the axe checks. The products answer is the booking widget's fixture; the cart
API's answers are routed, from the stage service's real ones (`fixtures/cart.json`, a GET answer;
the routed GET carries what was posted).

`node cart.test.mjs [width]` — lounges (78 checks):
- the add, Checkout Cart, a double click, failures, a cart made but not read back
- removing: through DELETE (the card, ⊗ → Yes in place, failures, CRT_ERR_004), removal during a
  read
- a stored cart, expiry, BKNG001, another tab, zh-cn, axe

`node passes.test.mjs [width]` — passes on the passes page (82 checks). The passes are
`fixtures/passes.json` (the passes service's real answer, five passes). The cart API is emulated
as stage answers: POST, PUT replacing the products, GET from `fixtures/cart-pass.json`'s real pass
line, DELETE. It covers:
- each entry point, Add More, several passes, removing a line and the last (no reload)
- the labels (reload, another tab), both refusals, the failures
- `?selectedPassID=`, the currency (the session's, a cart of passes converted, a lounge's not), the
  other languages (live's Add to Cart and Add More), axe

`node embed-pass.test.mjs [width]` — a campaign page's own Add to Cart (22 checks: 11 at each of
1440 and 375). Beyond The Event's pass cards (an Embed Code block's script) call the source's global
`AddToCart(button, catalogueCode, …)`, which `scripts/scripts.js` provides. The cart API is routed
as for the passes, with each card's name and price. It covers:
- a card's Add to Cart: the button off and the loader meanwhile, one POST with the card's code
  (`data-prd`), the mini cart, the count
- the same card again (PUT, quantity 2), another card (PUT with both)
- a lounge in the cart: Checkout Cart, nothing sent
- the booking system refusing the code (as stage answers the live codes: BKNG030 "invalid
  locationCode"): the Notice, no cart kept
- a code that isn't a pass's: nothing sent, a console warning
- `?currencyCode=HKD`: the POST in HKD
- no page errors from the site's code (the local copy's section-metadata table, loaded there as a
  block, aside)

`node mini-cart.test.mjs [width]` — the mini cart (100 checks).
- The source's look (the 2026-11-12 audit's high and medium items) at 375 and 1440: the panel,
  header, promo callout and field, the cross, the arrow, the spacing, the amounts, the lines; the
  low items (with a child booking) at 375, 1100 and 1440; the cross's hover (0.5, then a steady
  0.75, black).
- Check Out / Edit from the page metadata (`cart-checkout-url`, `cart-edit-url`, injected) and the
  promo code.
- The promo service is emulated as stage answers it (see docs/cart.md): Success, then the lines
  carry the code; BKNG048 / BKNG043 / BKNG004 / BKNG001; every cart PUT takes the code off.
  PASS10PW applies to passes (15%), LOUNGE15 (made up) to the lounge.
  - lounges and passes: applied, refused (each message), the network and a 500, case sensitivity
  - Add More, another pass, a pass taken out, another currency: the code sent again; a refusal
    then (the field offers the code again with why)
  - taking it off (the cart's products sent again), a new cart afterwards, BKNG001
- The source's look: the panel's place at 414, 575, 700, 767 and 1440, the header at 375 and
  1440, the promo message's amber callout with its icon, focus after Enter and after a click.
- The add-ons hook, and axe (the field's message, the applied code, the confirmation).

`node storage.test.mjs` — where the cart is kept and when it's read again (15 checks).
- The id in localStorage (24 hours, with the count and codes); the data in sessionStorage (2 hours).
- A new tab (shown at once, read once; adds and removals read first); data past its 2 hours (the
  booking system's new price only); the tab shown again.
- Two tabs (they follow and settle); the earlier cookie moved; blocked storage.

`node reserve-now.test.mjs` — the lounge page's Reserve Now with the cart (12 checks), on
`/en-uk/find/lounge?propertycode=PRPRTY1219` (the lounge's services as they are; the cart routed).
Set `AXE_CORE` for the axe check.
- A lounge in the cart: Get Price, Reserve Now → the source's Checkout Cart dialog (its texts and
  look: centred 500px, the maroon title bar, the 21px title), the cart only read, nothing reserved;
  static (Esc), View Cart (the mini cart), ✕.
- Passes in the cart: the same dialog. No cart: no dialog, `property-detail:reserve` as before.
- 375: over the Book Your Visit dialog, which stays open after ✕. axe.

`node book-your-visit.test.mjs` — the Book Your Visit page and its Add-ons (35 checks), on the
local `/{lang}/book-your-visit` pages (`BW_HOST` with local content). The cart service is routed
(the lounge fixture a week ahead, the add-on lines the PUTs give it); the add-ons are the sample
answer (`blocks/add-ons/sample-add-ons.json`). Set `AXE_CORE` for the axe checks.
- The page at 1440: its blocks, the lounge and badge, Date and Time from the cart, the locked
  fields, the authored labels, the back arrow (the lounge page with the visit), the Booking
  Summary, the add-ons under the form; no page errors.
- An add-on: its pop-up (the booked lounge's price, 1 to the maximum), Add (one PUT with the lounge
  and the add-on), the added row and the summary's Additional Services, the count; Remove (the
  confirmation, a PUT with the lounge alone). XO Sauce: the first lounge in stock's price.
- A time change (the add-ons asked again), Check Out after it (a PUT with the new start) and
  without one (no PUT); a failed save; a failed add; today's first bookable time (now + an hour +
  15 minutes, onto the next half hour, at the lounge).
- 375: the list with Edit, the date pop-up, one promo field, the fixed bar.
- No cart, a cart of passes (the homepage); the four other languages; axe at 1440 and 375.
- The block library's pages: the sample visit, no leaving, nothing saved (also with an author's cart).

**End to end** (`e2e/`, nothing routed: the real stage passes and cart APIs, so they make and delete
real stage carts). Set `HOST` to the local preview or a branch preview, plus `WIDTH` and
`PLAYWRIGHT`.
- `node e2e/passes.e2e.mjs`: a pass, Add More, a pass stage won't sell, another pass, and the
  inventory limit. Then the currency (HKD), the zh-cn homepage's cart, removing a line and the last,
  the promotional address, and two tabs at once (reported, not checked). Then a real lounge cart
  refusing a pass and the promotional address, and the homepage Book Now refused with passes in the
  cart. After each step the page is compared with a fresh GET.
- `node e2e/promo.e2e.mjs` (`CODE`, default PASS10PW): a pass, a wrong code and the code in lower
  case refused, the code applied, Add More and another pass (still applied), the code removed, the
  passes taken out and a new cart (no code). Compared with a fresh GET each time.
- `node e2e/lounge.e2e.mjs`: the lounge journey. The modal is checked against the GET field by field,
  then Remove From Cart and ⊗ (Cancel, then Yes in place); another tab follows. It needs a bookable
  lounge card at HKG on stage.
