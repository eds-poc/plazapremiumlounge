# Cart tests (dev only)

Browser checks for the cart (`scripts/cart.js`, `cart-state.js`, `mini-cart.js`, the header's
count, the lounge card's Book Now). Not served: `.hlxignore` lists `test/*`. See
[docs/cart.md](../../docs/cart.md).

Same setup as `test/booking-widget` (its harness): the local preview, or `BW_HOST`; `PLAYWRIGHT`;
`AXE_CORE` for the axe checks. The products answer is the booking widget's fixture; the cart
API's answers are routed, from the stage service's real ones (`fixtures/cart.json`, a GET answer;
the routed GET carries what was posted).

`node cart.test.mjs [width]` — the add, Checkout Cart, removing, a double click, failures, a cart
made but not read back, a stored cart, removal during a read, expiry, BKNG001, another tab,
zh-cn, axe (62 checks).
