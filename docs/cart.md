# The cart

The source's cart, on this site: a product goes into the cart from the block that sells it, the
header's cart icon shows the count, and the mini cart shows what's in it. Two types sell today:
the homepage lounge card's **Book Now** (a lounge booking), and the passes page's **Add to Cart**
on Quick Buy, Pass Finder and their Learn more pop-up (lounge passes). Other products plug in the
same way (see [Adding a product type](#adding-a-product-type)).

**The cart's rules** (as the source's):
- A **lounge** only goes into an **empty** cart, so a cart holds one lounge at most.
- **Passes** stack: several passes in one cart, and the same pass again is one more of it
  (Quantity: 2).
- A **pass** doesn't join a cart with a **lounge**.

Either refusal shows **Checkout Cart**, so a lounge and passes never share a cart.

**No page reloads:** everything follows the cart in place (`cart:change`). That covers the mini
cart, the header's count, the lounge card's button and the passes' buttons. The source reloads
the page after ⊗ → Yes, and that reload adds the promotional address's pass again (see below).

## What visitors see (as the source's)

- **Book Now** on the lounge card: at once the button is off (disabled, aria-disabled) and the
  site's full-page loader shows; when the booking system has answered (the cart made and read
  back) the loader goes, the **mini cart** opens, the header's cart shows **1**, and the card's
  button reads **Remove From Cart**: no question asked, the button off and the loader while the
  booking system deletes the cart, then **Book Now** again and no count (no reload).
- **The cart's dialogs stay open on Esc and a click beside them** (they bounce), as the source's
  (`data-bs-backdrop="static" data-bs-keyboard="false"`): only their own controls close them.
- **The mini cart** (a 420px panel at the top right from 768px, the screen's width on phones):
  - the lounge's name with a ⊗ (remove), its location
  - Date (`02-Nov-2026`, `2026年11月02日`), Time (`1800hrs`), Guests (`2 Adult(s) 1 Child(ren)`),
    Services (the product); on phones each label is over its value, in 14px text
  - Service Total and the discounts when there are discounts, then Total (Includes applicable
    taxes and fees); amounts as the source's (`HKD 1,755.00`)
  - **Check Out** and **Edit**: not wired yet (they announce `cart:checkout` / `cart:edit`, for
    the booking steps to come)
- **⊗**: "Would you like to remove this order from the shopping cart?" with the product, over the
  mini cart (both show).
  - **Cancel** (maroon) closes only the question.
  - **Yes** (light maroon) shows the loader while the booking system takes the line out (its whole
    quantity, as the source's).
  - The mini cart then shows the lines left, with focus on the first ⊗, or closes when the cart is
    empty. The count and the buttons follow, with **no reload**. The source reloads the page here;
    nothing on this site needs a fresh page, and a reload would lose the scroll position, the
    widget's choices and the Pass Finder's filters.
- **A pass's Add to Cart** (Quick Buy, Pass Finder, or its Learn more pop-up):
  - The loader shows and the button is off, then the mini cart opens; from Learn more, the pop-up
    closes first, as the source's.
  - The pass's line: its name with ⊗, then **Quantity: N** with the line's price beside it. No
    Date/Time/Guests, and no **Edit** in a cart of passes (as the source's).
  - **Add More:** while a pass is in the cart, every button for it on the page reads **Add More**:
    its Quick Buy card, its Pass Finder card and its Learn more pop-up. That's the source's pop-up
    wording, in all five languages (新增更多, さらに追加, Adicionar Mais). The source's cards keep
    Add to Cart. Clicking adds the pass again (Quantity +1).
  - The labels follow the cart: an add, a removal, emptying, expiry, another tab, and the stored
    cart when the page loads (no request).
- **The promotional address** `…/airport-lounge-passes?selectedPassID=PRD2884` (any case):
  - Once the passes are in, the pass with that product code goes into the cart as its Add to Cart
    would: the loader, then the mini cart (the source adds it while the page is built, then opens
    its cart).
  - The cart's rules come first: with a **lounge in the cart**, **Checkout Cart** shows and nothing
    is added. The source adds the pass anyway, beside the lounge.
  - A pass already in the cart gets one more (as the source's).
  - The parameter then leaves the address (`history.replaceState`, no reload; the rest of the query
    stays), so a refresh or Back doesn't add it again. The source's keeps it and adds the pass at
    every load.
  - A code the passes service doesn't list does nothing, as the source's.
- **Removing fails** (a 4xx/5xx, the network, a timeout, the service's error): the cart stays (and
  the mini cart, after Yes: no reload), with "Unable to remove from cart." in the site's dialog
  (the source shows a browser alert).
- **A refused product** (a lounge into a cart that isn't empty, a pass into a cart with a lounge):
  the loader while the cart is read from the booking system, then **Checkout Cart** — "Please
  proceed to checkout before adding new item into cart." — and **View Cart** (opens the mini cart).
- **The add fails** (the service's error, a 4xx/5xx, the network, a timeout, not JSON): nothing is
  kept, and the site's dialog shows a message.
  - A lounge: "Unable to add to cart." (the source shows a browser alert).
  - A pass: **Notice**, "An error occurred. Please try again later." (the source's pass page; on a
    network failure it opens its login pop-up instead).
  - A pass's button keeps its label.
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
| `scripts/cart.js` | The cart without UI. `addToCart(item)`: the type's adapter (`lounge`, `pass`), the cart's rules (`RULES`), then POST for an empty cart, or PUT for a pass joining passes. Also `refreshCart()`, `deleteCart(cartId)`, `removeFromCart(catalogueCode)` (PUT with the other lines, or DELETE for the last), `passStart()`, `registerAdapter(type, adapter)`. One add, and one removal, at a time. |
| `scripts/mini-cart.js` + `styles/cart.css` | The UI in the site's dialog (`modal-dialog.js`, with its `static` content and `stack` options): the mini cart, Checkout Cart, the remove confirmation (stacked over the mini cart), the failure message; the site's loader (`scripts/loader.js`) while the booking system answers. `addAndShow(item, trigger)`, `openMiniCart(trigger)`. |
| `scripts/scripts.js` | `installCart()`: what the blocks announce → the cart (`CART_EVENTS`: `booking-widget:book` is a `lounge`; `quick-buy:add-to-cart` and `pass-finder:add-to-cart` are a `pass`), and `cart:remove` (`detail.catalogueCode`). The button off and the loader at once; the cart's code loads on the first product or removal. |
| `scripts/passes.js` | `buildAddButton`: a pass's Add to Cart (cards and Learn more), labelled from the cart (Add More), all of them relabelled on `cart:change`. `takeSelectedPass`: the promotional address's pass, called by Quick Buy and Pass Finder once their passes are in (the first that lists it takes it). |
| `blocks/header` | The count on the cart icon; the icon opens the mini cart when the cart holds something. |
| `blocks/booking-widget` (lounge card) | Book Now announces `booking-widget:book` (the choice, `catalogueCode`, `currency`, the names and price); Remove From Cart announces `cart:remove`. |

### The API (`apiUrl('cart')`, the booking system)

- **POST** `…/ppg-app/cart`, JSON → `{ cartId }`. Every POST makes a new cart (a `cartId` in it is
  ignored).
  - A lounge: `{ currency, products: [{ catalogueCode, startDate: "YYYY-MM-DD HH:mm:ss" (the
    lounge's time), quantity: 1, guestsCount: { adult: "1", child: "0" } }], pointOfPurchase:
    "Online", channel: "B2C", isThirdPartyFulfilment: false }`.
  - A pass (your sample): `{ currency, channel: "B2C", pointOfPurchase: "Online", products: [{
    catalogueCode, quantity: "1", startDate }] }`. The `startDate` is required (BKNG022 without
    it) and must not be past in the pass's location time.
    - This site sends now + 1 hour in Hong Kong (`passStart()`), as the source's (its pass line
      reads "Hong Kong SAR" and its bookingDate is HKT + 1h).
    - The passes service gives no time zone; UTC now is refused as past.
- **PUT** `…/ppg-app/cart?cartId=…`, with the same body → `{ cartId }`.
  - It **replaces** the cart's products: a pass joining (all the passes, with the new one), one
    more of a pass (its `quantity` + 1), or a line taken out (the others).
  - It sets the cart's currency (the prices are converted).
  - An unknown cart: BKNG001. No currency: BKNG004. PATCH: 405.
- **GET** `…/ppg-app/cart?cartId=…&locale=en` → the cart: `currency`, `cartTotalPrice`
  (`totalBasePrice`, `totalDiscounts`, `totalPrice`, …), `products[]` (`catalogueCode`,
  `propertyDisplayName`, `productDisplayName`, `shortLocation`, `locationName`, `startDate`,
  `guestsCount`, `quantity`, `itemPriceDetails.discounts[]` with `name` and `value`, …). The
  locale translates the lounge, location and service names.
- **DELETE** `…/ppg-app/cart?cartId=…` → `{ code: "200", description: "Success" }`. It empties the
  cart (a GET then answers `products: []` and zero totals, which this site forgets), and answers
  Success again when repeated. An unknown cart: a 200 with `{ errorCode: "CRT_ERR_004" }`, taken
  as gone already; no `cartId`: a 400 VALIDATION_ERROR.
- Errors: a 200 with `{ errorCode, message }` (e.g. BKNG030 "invalid locationCode", BKNG001 "Cart
  not found": the cart is forgotten), or a 400 with `{ error: { code, details } }` (e.g. a past
  start). The service takes 0 adults and any currency: the lounge adapter checks the guests and
  sends the product's own currency.
- Taking one item out: `DELETE ?cartItemId=` empties the whole cart, so a line goes through PUT.
- Two passes on the **same rate plan** (e.g. Global 2-Visit and Global 5-Visit, both RTPLN3518 on
  stage) are refused together: a 200 with `PRDCT_ERR_001` "No products found for the given location
  LCTN517", even in one POST. The Notice shows and the cart stays as it was. Passes on different
  rate plans combine.
- The service checks no lounge/pass rule (it takes both in one cart): the rules are this site's.
- Not in the API yet, so not done: promo codes, add-ons, the checkout hand-off.

### The mini cart from the GET answer

| Mini cart | GET field | Note |
| --- | --- | --- |
| The lounge's name | `products[].propertyDisplayName` (else `propertyName`) | |
| Its location | `shortLocation`, `locationName` | without the source's stray comma when `shortLocation` is empty |
| Date, Time | `startDate` (the lounge's time) | `28-Nov-2026` / `2026年11月28日` / `28-nov-2026`; `1500 hrs` |
| Guests | `guestsCount.adult`, `.child` | `2 Adult(s) 1 Child(ren)`; `infant` is in `ageGroup` / `baseRate` but not in `guestsCount` |
| Services | `productDisplayName` | not translated by `locale` (the source translates it) |
| Service Total | `cartTotalPrice.totalBasePrice` | with discounts only |
| Each discount | `products[].itemPriceDetails.discounts[]` `name`, `value` | the API's name ("10% Online Discount [Lounge Booking]") is not the source's label ("10% Online Exclusive Discount (Lounge):"), nor translated |
| Total | `cartTotalPrice.totalPrice`, `currency` | |
| A pass's line (its name) | `productDisplayName` | for `propertyTypeCode` GFTCRD or `serviceType` PASS; the source shows the same name |
| A pass's Quantity: N, its price | `quantity`, `itemPriceDetails.productTotalPrice.totalPrice` | the line's total (quantity × price) |
| The header's count | the sum of `products[].quantity` | |
| Remove From Cart on the card, Add More | `products[].catalogueCode` | the passes service's catalogue code (the regular rate's) matches the cart line's |
| (kept) | `cartId` (and `products[].cartItemId`) | |

Not shown (the source's mini cart doesn't either): `images`, `disclaimer`, the terms, `productVarients`, `basedOn`, `maxNoOfProductsAllowed`, `isFlightNumberMandatory`, `isStLoginMandatory`, `ageGroup`, `amountPayable`, `totalTax`; `totalPromocodeAmount` waits for the promo code.

### Adding a product type

```js
import { registerAdapter } from './cart.js';

registerAdapter('voucher', {
  check: (item) => (item.catalogueCode ? '' : 'invalid'), // why it can't go in, or ''
  toProduct: (item) => ({ catalogueCode: item.catalogueCode, startDate: '…', quantity: '1' }),
  currency: (item) => item.currency,
  order: {}, // what its cart takes besides (a lounge's: isThirdPartyFulfilment)
  toLine: (item) => ({ catalogueCode: item.catalogueCode, kind: 'pass', name: item.name, product: item.name, start: '', adults: 0, children: 0, quantity: 1, total: item.price }),
});
```

then map its block's event in `CART_EVENTS` (`scripts/scripts.js`). The cart's rules are in
`RULES` (`scripts/cart.js`): a rule answers `'checkout-first'` to refuse. Today a lounge needs an
empty cart, and a pass refuses a cart with a lounge. A line's `kind` (`pass` or `lounge`) decides
its layout in the mini cart and the rules.

## Tests

Both suites are dev only (not served), with routed answers (the stage service's real ones). Run
them with the booking widget tests' settings: `BW_HOST`, `PLAYWRIGHT`.

- **`test/cart/cart.test.mjs`** (lounges):
  - the add (the POST and GET, the cookie and summary, the count, the mini cart, the card's
    button), Checkout Cart, a double click
  - removing: ⊗ Cancel/Yes (in place, no reload), Remove From Cart, through DELETE (failures,
    CRT_ERR_004), removal during a read
  - five failures and the network, a cart made but not read back
  - a stored cart (no request, the icon), expiry, BKNG001, another tab, zh-cn
  - axe (with `AXE_CORE`)
- **`test/cart/passes.test.mjs`** (passes, on the passes page; the cart API emulated as stage
  answers):
  - Quick Buy, Pass Finder and Learn more: the POST body and start time, the mini cart's pass
    lines, the count
  - Add More (PUT, Quantity 2), a second pass, removing one line (PUT, in place) and the last
    (DELETE)
  - the labels: after a reload, in another tab
  - both refusals, the failures (Notice; a removal's)
  - `?selectedPassID=`: an empty cart, the address cleaned, a reload, lower case, the pass already
    in the cart, a lounge in the cart, an unknown code
  - the other four languages, axe
