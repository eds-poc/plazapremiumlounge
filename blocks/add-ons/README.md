# Add-ons: authoring guide

The source's Book Your Visit "Additional Services": what can be added to the cart's lounge visit
(for example Dubai's Caviar Packages, Hong Kong's Sakura Shrimp Spice). Put it after the Book Your
Visit block, in the same section; that block places it under its form. The add-ons come from the
add-ons service; authors write only the texts.

## Texts (Key | Text rows)

| Key | en-uk |
| --- | --- |
| title | Additional Services |
| add | Add |
| remove | Remove |
| quantity | Quantity |
| total | Service total |
| failed | Unable to add service. Please try again. |

A missing row shows the English text above. The title shows in capitals.

## What visitors see

- **Each add-on:** its name and **Add**.
  - **Add opens its pop-up:** its description and image, the quantity (from 1 to its maximum: the
    product's, or what's in stock), the service total, and **Add**, which puts it in the cart (the
    site's loader meanwhile; a failure shows the `failed` text).
  - **In the cart:** its row shows "2x {name}" and **Remove**. Remove asks "Would you like to remove
    this order from the shopping cart?" (Cancel / Yes), as the source's. To change the quantity,
    remove it and add it again (as the source's).
- **The add-ons follow the visit's date and time** chosen on the page: each change asks the service
  again.
- **Phones:** a warm grey panel the screen's width, filled Add pills. **Tablets (768px):** no panel,
  outlined Add pills. **From 992px:** the title over a black line and a line under the list,
  outlined Add pills (180px from 1200px), an added add-on's row tinted.
- **No add-ons** (or no lounge in the cart): the block takes no space.
- **The block library** (`/docs/library/blocks/add-ons`): the add-ons of Book Your Visit's sample visit; Add closes the pop-up, nothing is saved, and an author's own cart isn't shown or changed.

## Data (`scripts/add-ons.js`)

- **The request** (from the cart's lounge line): `serviceCode`, `productCode` (the lounge's product,
  e.g. PRD3341), `iataCode`, `currencyCode`, `propertyCode`, `startDateTime` ("YYYY-MM-DD
  HH:mm:ss", the visit's start), `promocode`.
- **The source, for now:** the client API's sample answer, `blocks/add-ons/sample-add-ons.json` (its
  API needs a client key that can't be in the site). The add-ons API goes in `requestAddOns` (one
  function) with the same request.
- **The answer:** `addons[]`, each with its prices, one per lounge (the catalogue code names it:
  `PRD3772-Add-On-PRPRTY816-…`).
  - **The price shown** is the booked lounge's when it has one in stock, else the first in stock, as
    the source's page (`pickPrice`).
  - **Shown:** the display name, the short description, the first image, the service's order.
  - **Not shown:** add-ons not available or without a price in stock; per-person add-ons (none in the
    sample yet); the upgrades (`upsell[]`).
- **The cart:** an add-on is a line of the booking system's cart (`productType` Add-On), sent with its
  lounge (`setAddon` in `scripts/cart.js`: the lounge's start, the quantity).
