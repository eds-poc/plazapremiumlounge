# Pass Finder: authoring guide

Every lounge pass to search and choose from, as the source Lounge Passes page's "Explore Regional
Passes". The passes come from the passes service (all of them, in its order), so new passes and
prices appear without editing the page. The page adds the heading, any passes to leave out, and
notes for particular passes.

## Table: all rows optional, 2 columns

| Pass Finder | |
| --- | --- |
| ## Explore Regional Passes<br>Discover your pre-flight retreat. Choose a regional pass for personalized care and exclusive privileges on your frequent routes. | |
| hide | PRD3700, PRD3701 |
| PRD3684 | Try our elevated lounge concept with personalized hospitality, a-la-carte gourmet dining |
| PRD3678 | 2 visits to our Dubai lounge, including a one-time Caviar Experience. |

- **Header row:** a heading and an intro line, shown centred above the finder. Leave its second
  cell empty.
- **`hide` row:** product codes to leave out (e.g. passes not for sale here), separated by commas.
- **A pass's note:** its product code, then the note. It's shown on the card in gold, in place of
  the "One visit each at …" / "Access lounges across …" line.
- Don't type names, prices, locations or points: they come from the service.

## What visitors see

- **A white panel** with the header, then the search, the region and the sort:
  - **Search** finds passes by name or location.
  - **Region:** All, Multi Cities (passes valid in several places), Global Plaza Premium Lounge,
    then every location A–Z, with a box to filter the list.
  - **"N passes found"** and **Sort by:** Recommended (the service's order), Price low to high,
    Price high to low.
- **The global passes are always shown**, last, whatever the search or region, as the source.
- **Cards** (1 per row on phones, 2 from 560px, 3 from 1000px, as the source):
  - the image, the name, the price and price per visit, the Smart Traveller points
  - up to 4 location tags, then "+N more" (hover for the rest)
  - the note: the pass's own note, else for passes valid in several places "One visit each at …"
    (a visit per place) or "Access lounges across …"
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
| The service, property and airport codes, currency | As Quick Buy: `scripts/endpoints.js`, the metadata sheet's `api-property-code` / `api-iata-code`, and the address's `currency` (else USD) |
| Names, locations, descriptions | The service's, in English |
| The card parts and the pop-up | `scripts/passes.js` and `styles/passes.css`, shared with Quick Buy |

## Messages

| Situation | Visitors see | On the preview site, authors also see |
| --- | --- | --- |
| The metadata codes are missing or not valid | Nothing (the block is hidden) | Which value is missing or wrong |
| A row that isn't a heading, `hide` or a note | The finder | That the row was left out |
| A `hide` or note code isn't in the service | The finder | Which codes |
| The service doesn't answer | "We couldn't load the passes." with Try again | |
