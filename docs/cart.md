# The cart

The source's cart, on this site: a product goes into the cart from the block that sells it, the
header's cart icon shows the count, and the mini cart shows what's in it. Today the homepage
lounge card's **Book Now** sells (a lounge booking); lounge passes and other products plug in
the same way (see [Adding a product type](#adding-a-product-type)).

## What visitors see (as the source's)

- **Book Now** on the lounge card: at once the button is off (disabled, aria-disabled) and the
  site's full-page loader shows; when the booking system has answered (the cart made and read
  back) the loader goes, the **mini cart** opens, the header's cart shows **1**, and the card's
  button reads **Remove From Cart** (it takes the booking out at once, no question asked).
- **The cart's dialogs stay open on Esc and a click beside them** (they bounce), as the source's
  (`data-bs-backdrop="static" data-bs-keyboard="false"`): only their own controls close them.
- **The mini cart** (a 420px panel at the top right from 768px, the screen's width on phones):
  - the lounge's name with a ⊗ (remove), its location
  - Date (`02-Nov-2026`, `2026年11月02日`), Time (`1800hrs`), Guests (`2 Adult(s), 1 Child(ren)`),
    Services (the product); on phones each label is over its value, in 14px text
  - Service Total and the discounts when there are discounts, then Total (Includes applicable
    taxes and fees)
  - **Check Out** and **Edit**: not wired yet (they announce `cart:checkout` / `cart:edit`, for
    the booking steps to come)
- **⊗**: "Would you like to remove this order from the shopping cart?" with the product, over the
  mini cart (both show); **Cancel** (maroon) closes only the question; **Yes** (light maroon)
  takes the booking out, shows the loader and loads the page again, as the source's.
- **A second booking while one is in the cart**: the loader while the cart is read from the
  booking system, then **Checkout Cart** — "Please proceed to checkout before adding new item into
  cart." — and **View Cart** (opens the mini cart). As the source's, a lounge goes into an empty
  cart only.
- **The add fails** (the service's error, a 4xx/5xx, the network, a timeout, not JSON): the
  site's dialog with "Unable to add to cart." (the source shows a browser alert). Nothing is kept.
- **The header's cart**: the count on the icon on the desktop bar (from 1200px; the source's phone
  and tablet header shows none), the count for screen readers on every screen; with something in
  the cart it opens the mini cart, empty it shows the nav's `cart` section ("Your cart is empty")
  as before.
- Texts in the five languages, as the source's (see `cart*` in `scripts/i18n.js`).

Not there yet (no API for them): the source's **View more options** (add-ons) and the **promo
code** field, Check Out's add-ons step and the checkout itself.

## How it works

| File | What it does |
| --- | --- |
| `scripts/cart-state.js` | The cart on this site (small: the header loads it on every page): the cart id in the cookie `cartid` (a day, as the source's) and a summary of the cart's last answer in localStorage `ppl-cart` (lines, totals, currency), so the count and the mini cart show without a request. `getCart`, `cartCount`, `isInCart`, `saveCart`, `forgetCart`, `onCartChange` (`cart:change` on document, other tabs too). A summary without its cookie, past its day, or whose bookings are over is forgotten. |
| `scripts/cart.js` | The cart without UI: `addToCart(item)` (the type's adapter, the cart's rules, the API), `refreshCart()`, `removeFromCart(catalogueCode)`, `registerAdapter(type, adapter)`. One add at a time. |
| `scripts/mini-cart.js` + `styles/cart.css` | The UI in the site's dialog (`modal-dialog.js`, with its `static` content and `stack` options): the mini cart, Checkout Cart, the remove confirmation (stacked over the mini cart), the failure message; the site's loader (`scripts/loader.js`) while the booking system answers. `addAndShow(item, trigger)`, `openMiniCart(trigger)`. |
| `scripts/scripts.js` | `installCart()`: what the blocks announce → the cart (`CART_EVENTS`: `booking-widget:book` is a `lounge`), and `cart:remove` (`detail.catalogueCode`). The cart's code loads on the first product. |
| `blocks/header` | The count on the cart icon; the icon opens the mini cart when the cart holds something. |
| `blocks/booking-widget` (lounge card) | Book Now announces `booking-widget:book` (the choice, `catalogueCode`, `currency`, the names and price); Remove From Cart announces `cart:remove`. |

### The API (`apiUrl('cart')`, the booking system)

- **POST** `…/ppg-app/cart`, JSON:
  `{ currency, products: [{ catalogueCode, startDate: "YYYY-MM-DD HH:mm:ss" (the lounge's time),
  quantity: 1, guestsCount: { adult: "1", child: "0" } }], pointOfPurchase: "Online", channel:
  "B2C", isThirdPartyFulfilment: false }` → `{ cartId }`. Every POST makes a new cart.
- **GET** `…/ppg-app/cart?cartId=…&locale=en` → the cart: `currency`, `cartTotalPrice`
  (`totalBasePrice`, `totalDiscounts`, `totalPrice`, …), `products[]` (`catalogueCode`,
  `propertyDisplayName`, `productDisplayName`, `shortLocation`, `locationName`, `startDate`,
  `guestsCount`, `quantity`, `itemPriceDetails.discounts[]` with `name` and `value`, …). The
  locale translates the lounge, location and service names.
- Errors: a 200 with `{ errorCode, message }` (e.g. BKNG030 "invalid locationCode", BKNG001 "Cart
  not found": the cart is forgotten), or a 400 with `{ error: { code, details } }` (e.g. a past
  start). The service takes 0 adults and any currency: the lounge adapter checks the guests and
  sends the product's own currency.
- Not in the API yet, so not done: adding to an existing cart, taking an item out (the cart is
  forgotten on this site instead), quantities, promo codes, add-ons, the checkout hand-off.

### Adding a product type

```js
import { registerAdapter } from './cart.js';

registerAdapter('pass', {
  check: (item) => (item.catalogueCode ? '' : 'invalid'), // why it can't go in, or ''
  toProduct: (item) => ({ catalogueCode: item.catalogueCode, startDate: '…', quantity: 1 }),
  currency: (item) => item.currency,
  toLine: (item) => ({ catalogueCode: item.catalogueCode, name: item.name, product: item.name, start: '', adults: 0, children: 0, quantity: 1, total: item.price }),
});
```

then map its block's event in `CART_EVENTS` (`scripts/scripts.js`), e.g.
`'quick-buy:add-to-cart': 'pass'`. The cart's rules are in `RULES` (`scripts/cart.js`): the
source's for passes (passes stack, a pass doesn't join a lounge) go there once the API can add to
a cart.

## Tests

`test/cart/cart.test.mjs` (dev only, not served): the add (the POST and GET, the cookie and
summary, the count, the mini cart, the card's button), Checkout Cart, removing (⊗ Cancel/Yes,
Remove From Cart), a double click, five failures and the network, a cart made but not read back,
a stored cart (no request, the icon), removal during a read, expiry, BKNG001, another tab, zh-cn,
and axe (with `AXE_CORE`). Answers are routed (the stage service's real ones). Run with the
booking widget tests' settings: `BW_HOST`, `PLAYWRIGHT`.
