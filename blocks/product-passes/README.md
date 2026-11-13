# Product Passes: authoring guide

A grid of lounge passes to buy, as the passes on the source offer pages (e.g. the Canada pass
offer, `/en-uk/offers/ppl-pass-canada`). The page lists the passes' product codes; the passes and
everything on them (the image, name, location, price, points and locations) come from the passes
service, so they're always current.

## Table: the service's codes and the product codes, 2 columns

| Product Passes | |
| --- | --- |
| propertycode | PRPRTY1235 |
| iata-code | HKG |
| Products | PRD2766, PRD3065, PRD2541, PRD2884, PRD2542 |
| Empty message | No passes are available right now. |

- **`propertycode` and `iata-code` (required):** the property code and airport (IATA) code the
  passes service is asked with. Letters and digits only; the key's case, spaces and dashes don't
  matter (`Property Code` works too).
- **Products:** the passes' product codes (e.g. `PRD2766`), separated by commas (or one per line).
  They're sent to the service as its `productCode` list; the passes shown are the ones the service
  answers, in its order (choosing the passes by these codes is the service's).
- **Empty message** (optional): shown when the service answers no passes. Without it, nothing is
  shown then.
- Row names ignore capitals and spaces.

## What visitors see

- **Cards** (1 per row on phones, 2 from 576px, 3 from 768px):
  - the pass's image;
  - its name, with its first location under it, beside the price ("USD 129.00") and the Smart
    Traveller points ("+150 ST Points");
  - a dashed line, then every location the pass is valid at, as a tag;
  - **Learn more**, which opens the pass's details in a pop-up (the image, name, where it's valid,
    price, points, description and Add to Cart);
  - **Add To Cart** at the foot of the card (a row's buttons line up). The cart takes the pass (a
    `product-passes:add-to-cart` event, see [docs/cart.md](../../docs/cart.md)); while the pass is
    in the cart, its buttons read **Add More**.
- **While the passes load** (the service takes a few seconds), three placeholder cards. The list
  is kept for the visitor's session, so a page seen again shows its passes at once while a fresh
  list is asked for.
- **Price:** each pass's regular rate (not a member or partner rate), in the visitor's currency.
- **`?selectedPassID=<product code>`** in the page address puts that pass into the cart once the
  passes are in (see docs/cart.md).

## Not authored here

| What | From |
| --- | --- |
| The service | `scripts/endpoints.js` (`productPasses`, a POST with a JSON body of the property code, airport code, currency and the product codes) |
| Currency | The visitor's currency, as on the rest of the site (the address's `currencyCode` or `currency`, e.g. `?currencyCode=HKD`, then the one applied this session, then the one for their location; else USD) |
| Names, locations, descriptions | The service's, in English |
| Learn more, Add to Cart, the pop-up | `scripts/passes.js` and `styles/passes.css` |

## Messages

| Situation | Visitors see | On the preview site, authors also see |
| --- | --- | --- |
| The `propertycode` or `iata-code` row is missing or not valid | Nothing (the block is hidden) | Which row is missing or wrong |
| A row the block doesn't know, a missing `Products` or `Empty message` row, or a code that isn't a product code | The passes | A note in the browser console |
| The service answers no passes | The Empty message, if authored | |
| The service doesn't answer | "We couldn't load the passes." with Try again | |
