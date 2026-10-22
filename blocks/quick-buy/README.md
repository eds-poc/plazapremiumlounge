# Quick Buy: authoring guide

A row of lounge passes to buy, as the source Lounge Passes page's quick buy ("The Smart
Traveller's Choice"). The page names the passes, their tags and their Best for lines; everything
else (the image, name, price, price per visit, points and details) comes from the passes service,
so it's always current.

## Table: an optional header row, then one row per pass, 2 columns

| Quick Buy | |
| --- | --- |
| ## The Smart Traveller's Choice<br>Discover unparalleled service and seamless worldwide access with our curated Global Passes | |
| PRD3705 | Easy Start<br>- One for departure, one for return<br>- Ideal for a single round-trip holiday |
| PRD3696 | Most Popular<br>- Admit up to 4 companions in one visit<br>- Or split across two separate trips<br>- Or gift individual lounge vouchers to friends |
| PRD3695 | Best Value<br>- Up to 10 guests admitted per visit<br>- … |

- **Header row (optional):** a heading and an intro line, shown centred above the passes. Leave
  its second cell empty.
- **Column 1:** the pass's product code (e.g. `PRD3705`). Passes appear in the order you write
  them.
- **Column 2:** the tag on the card (the first line, e.g. `Most Popular`; leave it out for no
  tag), then a bulleted list of what the pass is best for. "Best for" is added above the list
  (in the page language); without a list, the card has no Best for part.
- Don't type names, prices or points: they come from the service.

## What visitors see

- **A white panel** with the header and one card per pass: 1 per row on phones, 2 from 480px, 3
  from 700px, as the source.
- **Each card:** the tag, the pass image, the name, the price and the price per visit (e.g.
  "USD 99.00 (USD 49.50/Visit)"), the Smart Traveller points ("+150 ST Points", ST as its icon),
  the Best for lines, **Learn more** and **Add to Cart**.
- **While the passes load** (the service takes a few seconds), the cards show the tags and Best
  for lines, with quiet bars for the rest; nothing moves when the passes arrive.
- **Learn more** opens the pass's details in a pop-up, as the source: the image, name, where it's
  valid, the price and points, the description from the service, and Add to Cart.
- **Add to Cart** has no cart to add to yet: it announces the choice (a `quick-buy:add-to-cart`
  event with the product code, the catalogue code the source's cart uses, the name and the price)
  for the cart to come.

## Not authored here

| What | From |
| --- | --- |
| The service | `scripts/endpoints.js` (`productPasses`, a GET with the property code, airport code, currency and product code) |
| Property code and airport (IATA) code | Page metadata `api-property-code` and `api-iata-code`, set once in the site's **metadata sheet** (the `/**` row, or a language folder's row, or a page's own Metadata table). Every block that calls the service reads them the same way (`getApiContext()` in `scripts/properties.js`) |
| Currency | The page address's `currency` (e.g. `?currency=HKD`), else USD |
| Names, descriptions | The service's, in English (it has no translations) |

## Messages

| Situation | Visitors see | On the preview site, authors also see |
| --- | --- | --- |
| The metadata codes are missing or not valid | Nothing (the block is hidden) | Which value is missing or wrong |
| A product code isn't in the service, or has no price | The other passes | Which code was left out |
| No pass could be shown | Nothing | Why |
| The service doesn't answer | "We couldn't load the passes." with Try again | |
