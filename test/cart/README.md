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

`node passes.test.mjs [width]` — passes on the passes page (73 checks). The passes are
`fixtures/passes.json` (the passes service's real answer, five passes). The cart API is emulated
as stage answers: POST, PUT replacing the products, GET from `fixtures/cart-pass.json`'s real pass
line, DELETE. It covers:
- each entry point, Add More, several passes, removing a line and the last (no reload)
- the labels (reload, another tab), both refusals, the failures
- `?selectedPassID=`, the other languages, axe
