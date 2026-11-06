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

`node mini-cart.test.mjs [width]` — the mini cart (39 checks).
- Check Out / Edit from the page metadata (`cart-checkout-url`, `cart-edit-url`, injected) and the
  promo code.
- The promo call is answered as stage does today (400 for `{cartId, promocode}`), plus a modelled
  success (a promo amount in the GET), since no valid code exists yet.
- The add-ons hook, and axe.

**End to end** (`e2e/`, nothing routed: the real stage passes and cart APIs, so they make and delete
real stage carts). Set `HOST` to the local preview or a branch preview, plus `WIDTH` and
`PLAYWRIGHT`.
- `node e2e/passes.e2e.mjs`: a pass, Add More, a pass stage won't sell, another pass, and the
  inventory limit. Then the currency (HKD), the zh-cn homepage's cart, removing a line and the last,
  the promotional address, and two tabs at once (reported, not checked). Then a real lounge cart
  refusing a pass and the promotional address, and the homepage Book Now refused with passes in the
  cart. After each step the page is compared with a fresh GET.
- `node e2e/lounge.e2e.mjs`: the lounge journey. The modal is checked against the GET field by field,
  then Remove From Cart and ⊗ (Cancel, then Yes in place); another tab follows. It needs a bookable
  lounge card at HKG on stage.
