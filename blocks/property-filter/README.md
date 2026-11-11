# Property Filter: authoring guide

Lounges by Region, Country and City, as the lounge finder on the source offer pages (e.g. the
Skytrax offer page):
- **Region tabs** across the top: the regions the property filter service answers lounges in.
- **Country and City:** two dropdowns and a search button on phones and tablets; from 992px wide,
  a list of countries (each opening to its cities) beside the lounges.
- **The lounges, per airport:** the airport's name and code (`London Heathrow Airport (LHR)`),
  its service tabs and its lounge cards (photos, name, location, opening hours,
  features, price and View).
- **Service tabs** (All / Lounge / Shower), from the property filter service: All, then each
  service the airport's lounges offer, named as the service names it in the page's language. All
  is chosen; a service's tab shows only the lounges that offer it. No tabs when the lounges offer
  no service. Nothing to author.
- **When the page opens,** the first region, country and city are chosen and their lounges shown.
  Regions are in the order of your `Region` row (any others after them); countries and cities are
  in alphabetical order. A city lists its airports' codes, its main airport first:
  `London (LHR / LGW)`.
- **Choosing:** a region tab shows its first country and city. Below 992px, choosing a country
  offers its cities and **Search** shows the chosen one (the country's first city when none is
  chosen); from 992px, a city in the list shows it at once.

While the lounges load, the block shows a shimmering outline of the filters and two cards in their
place (the rest of the page stays usable). If they don't load, it says so with **Try again**; with
no lounges to show, it says "No lounges found."

### The page address

The choice is kept in the page address, so a reload or a shared link shows the same city:
`?region=ep&country=it&city=fco` (the city by one of its airport codes). A value that isn't
offered (a region without lounges in the answer, a mistyped code) gives the first one instead.

## Table: two columns, a row per list

| Property Filter | |
| --- | --- |
| Region | EP, IM |
| Country | IT, GB, IN |
| IATA | FCO, LHR, LGW, BLR |
| Property | PRPRTY891, PRPRTY867 |
| View button | [View](/en-uk/find/lounge) |
| Signup button | [Join here](https://www.plazapremiumlounge.com/en-uk/sign-up?pid=plp) |

The first four rows are **what the block asks the property filter service for**: their codes
are sent as they are (a row left out or empty sends no codes for that level). The Region, Country
and City filters then offer **every** region, country and city in the service's answer, and the
cards are the chosen city's lounges. Today the service answers every lounge in the regions asked
for (and in the countries' regions), so `Region` EP, IM with `Country` IT, GB, IN offers all of
Europe and India/Middle East/Africa, not just Italy, the United Kingdom and India.

At least one of the four is needed.

- **Region:** region codes, e.g. `EP` (Europe), `IM` (India/Middle East/Africa), `AP` (Asia
  Pacific).
- **Country:** two-letter country codes, e.g. `IT`, `GB`, `IN`.
- **IATA:** airport (or station) codes, e.g. `FCO`, `LHR`, `BLR`.
- **Property:** lounge codes, e.g. `PRPRTY891`.
- **View button** (optional): the button on each card that opens the lounge's page. A link: its
  text is the label, its address the lounge page, e.g. `[View](/en-uk/find/lounge)` (each card
  adds its own lounge to the address); plain text: that label, to the language folder's lounge
  page. Without the row: **View** (in the page's language) to the language folder's lounge page.
- **Signup button** (optional): a link, shown at the end of each card's Smart Traveller line
  (e.g. "… 20% off … per eligible visit. **Join here**"). Leave the row out for no link.

Codes are separated by commas (or spaces, or one per line); capitals don't matter. Row names may
also be written `Region code`, `Country code`, `IATA code` / `Airport`, `Property code`
(`view-button` and `signup-button` work too).

### Notes on preview pages

On preview pages (`*.aem.page`), the browser console shows what the block read and what it left
out: a row it doesn't know (e.g. an old `Additional Services` row: the service tabs now come from
the service), a code that doesn't look like one (e.g. `Europe` instead of `EP`), or a table
without any of the four rows.

## Where the rest comes from

| What | From |
| --- | --- |
| The lounges | The property filter service (`scripts/property-filter.js`, `filteredProperties` in `scripts/endpoints.js`), asked once for the table's lists, in the page's language |
| Regions, countries, cities and their airports | The property filter service's answer, as it places each lounge (a city's airports share its city code, e.g. `GBLHR` for Heathrow and Gatwick) |
| Service tabs | The property filter service's answer: each lounge's services (`servicetype`, named by `serviceDisplayName` in the page's language); the All tab's name from the site's translations (`propertyAll`) |
| Region names | The site's translations (`region<CODE>` in `scripts/i18n.js`, e.g. `regionEP`, as the nav's Locations menu names them), else the code (`OP`, Oceania Pacific, is in English only for now) |
| The cards | `scripts/property-card.js` and `styles/property-card.css` |
