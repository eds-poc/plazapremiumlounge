# Pass Finder: authoring guide

Every lounge pass to search and choose from, as the source Lounge Passes page's "Explore Regional
Passes". Everything comes from the passes service: which passes, in its order, and their images,
names, prices, locations and points. So new passes and prices appear without editing the page. The
page adds only the heading and the codes the service is asked with.

## Table: an optional header row and the service's codes, 2 columns

| Pass Finder | |
| --- | --- |
| ## Explore Regional Passes<br>Discover your pre-flight retreat. Choose a regional pass for personalized care and exclusive privileges on your frequent routes. | |
| propertycode | PRPRTY1235 |
| iata-code | HKG |

- **Header row (optional):** a heading and an intro line, shown centred above the finder. Leave its
  second cell empty.
- **`propertycode` and `iata-code` rows (required):** the property code and airport (IATA)
  code the passes service is asked with, e.g. `propertycode | PRPRTY1235` and `iata-code | HKG`.
  Letters and digits only; the key's case, spaces and dashes don't matter (`Property Code` works
  too). They can go anywhere in the table. The page metadata isn't used for these.
- Nothing else is authored. Any other row is left out (the preview site says so).
- To leave a pass out or change one, change it in the passes service.

## What visitors see

- **A white panel** with the header, then the search, the region and the sort:
  - **Search** finds passes by name or location.
  - **Region:** All, Multi Cities (passes valid in several places), Global Plaza Premium Lounge,
    then every location A–Z, with a box to filter the list.
  - **"N passes found"** and **Sort by:** Recommended (the service's order), Price low to high,
    Price high to low.
- **The global passes are always shown**, last, whatever the search or region, as the source.
- **Cards** (1 per row on phones, 2 from 768px, 3 from 992px: the site's breakpoints; the search,
  region and sort sit in one row from 768px):
  - the image, the name, the price and price per visit, the Smart Traveller points
  - up to 4 location tags, then "+N more" (hover for the rest)
  - for passes valid in several places, a note: "One visit each at …" (a visit per place) or
    "Access lounges across …"
  - **Learn more** (the pop-up Quick Buy uses) and **Add to Cart**
  - **Best Value** on the pass with the lowest price per visit among those found
- **Pages of nine**, with ← 1 2 →; changing page scrolls back to the top of the finder.
- **The choices stay in the page address** (`?region=…&search=…&sort=…`), so a shared or reloaded
  link shows the same passes.
- **No match:** "No passes found" with a hint to change the search.
- **While the passes load**, three quiet placeholder cards. The finder and Quick Buy share one call
  to the service, and the list is kept for the visitor's session (see the Quick Buy guide).
- **Price:** each pass's regular rate (not a member or partner rate), as Quick Buy.
- **Add to Cart** announces the choice (a `pass-finder:add-to-cart` event with the product code,
  catalogue code, name and price) for the cart to come.

## Not authored here

| What | From |
| --- | --- |
| The service, currency | As Quick Buy: `scripts/endpoints.js`, and the address's `currencyCode` (e.g. `?currencyCode=HKD`; else USD) |
| Names, locations, descriptions | The service's, in English |
| The card parts and the pop-up | `scripts/passes.js` and `styles/passes.css`, shared with Quick Buy |

## Messages

| Situation | Visitors see | On the preview site, authors also see |
| --- | --- | --- |
| The `propertycode` or `iata-code` row is missing or not valid | Nothing (the block is hidden) | Which row is missing or wrong |
| A row other than the heading or the codes | The finder | That the row was left out |
| The service doesn't answer | "We couldn't load the passes." with Try again | |
