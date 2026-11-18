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

## Table: two columns, a row per setting

| Property Filter | |
| --- | --- |
| Region | EP, IM |
| Country | IT, GB, IN |
| IATA | FCO, LHR, LGW, BLR |
| Property | PRPRTY891, PRPRTY867 |
| View button | [View](/en-uk/find/lounge) |
| Signup button | [Join here](https://www.plazapremiumlounge.com/en-uk/sign-up?pid=plp) |
| Regions label | Regions |
| Country placeholder | Select Country |
| City placeholder | Select City |
| Search label | Search |
| Countries label | Countries and cities |
| Services label | Services |
| Status | {n} results in {city} |

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
  adds its own lounge to the address, on whichever site the page is shown); plain text: that
  label, to the language folder's lounge page. Leave the row out for no button.
- **Signup button** (optional): a link, shown at the end of each card's Smart Traveller line
  (e.g. "… 20% off … per eligible visit. **Join here**"). Leave the row out for no link.

Codes are separated by commas (or spaces, or one per line); capitals don't matter. Row names
ignore capitals and spaces.

### The texts

Every text of the filters is authored, in the page's language, a row each; a text left out isn't
shown:
- **Regions label**, **Countries label**, **Services label**, **Search label:** what screen
  readers call the region tabs, the list of countries (from 992px), the service tabs and the
  Search button (it shows an icon only).
- **Country placeholder**, **City placeholder:** the dropdowns' first option ("Select Country",
  "Select City"); without them the dropdowns start at the chosen country and city.
- **Status:** said to screen readers when a city is shown; `{n}` is the number of lounges and
  `{city}` the city, e.g. `{n} results in {city}` ("10 results in London (LHR / LGW)").

The service tabs' **All**, the messages ("No lounges found.", the error and Try again) and
**Loading…** are the site's own texts, in the page's language.

### Notes on preview pages

On preview pages (`*.aem.page`), the browser console shows what the block read and what it left
out: a row it doesn't know (e.g. an old `Additional Services` row: the service tabs now come from
the service), a code that doesn't look like one (e.g. `Europe` instead of `EP`), the texts not
authored, or a table without any of the four rows of codes.

## Option: lounge name only

`Property Filter (lounge name only)` lists a card's or bank's eligible lounges **whole**, as the
source's card and bank pages (e.g. `/en-uk/cmb`, `/en-uk/Luso-International-Banking-Ltd`), instead
of letting visitors choose a city:

- **View lounges by region:** a link per region (pills), each going to its region below.
- **Per region:** a panel with the region's name, then its countries (one column on phones, two
  from 576px), per country its airports (`Beijing Daxing International Airport (PKX)`), and per
  airport its lounges as an [Accordion](../accordion/README.md) (look `lounges`): one item per
  lounge, several under an airport when it has several. A lounge opens to its **opening hours**
  and **location** (the property filter service's), each after its label; several can be open at
  once.
- **Order:** regions in the order of your `Region` row, else the site's (Mainland China…,
  Americas, Europe, Asia-Pacific, India/Middle East/Africa); countries and airports by name;
  lounges in the service's order, then by name. Region names are the service's (as the source's
  lists name them), in the page's language.

| Property Filter (lounge name only) | |
| --- | --- |
| Region | CH, AP |
| Country | CN, HK, MO, TW, ID, JP, MY, PH, SG |
| IATA | PKX, CGQ, HKG, MFM, TPE, KUL, SIN |
| Property | PRPRTY1303, PRPRTY1183, PRPRTY1184 |
| Regions label | View lounges by region: |
| Hours label | OPENING HOURS: |
| Location label | LOCATION: |
| Updated | Last updated: 04 Mar 2026 |
| View button | [View lounge](/en-uk/find/lounge) |

- **The lounges:** the same rows of codes as above; at least one is needed. The service answers
  the lounges of **any** of the lists (whole regions for `Region`, whole countries for `Country`),
  then the block keeps only those that match the `Country`, `IATA` **and** `Property` rows (a row
  left out doesn't limit):
  - **Region:** the card's or bank's regions; their order is the order of the region links and
    panels.
  - **Country**, **IATA:** the card's or bank's countries and airports, as its list shows them;
    nothing outside them is shown.
  - **Property:** the eligible lounges themselves, from the card's or bank's list: the row that
    decides which lounges show.

  For a card or bank page, write all four (e.g. `/en-uk/luso-international-banking-ltd`). The
  codes are the live site's: on a site using the test (stage) property filter service, which
  numbers lounges differently, the list shows other lounges or "No lounges found."
- **Regions label:** the text before the region links (without it, the links show without a text).
- **Hours label**, **Location label:** shown before a lounge's opening hours and location, as
  written (e.g. the source's `OPENING HOURS:`); without them the values show alone.
- **Updated** (optional): a short note under the region links, e.g. the source's
  `Last updated: 03 Jul 2026`, written as it should read.
- **View button** (optional): a link to the lounge's page under its details. Leave the row out
  for none (the source's lists have none).
- The filters' rows (Country placeholder, City placeholder, Search label, Countries label,
  Services label, Status) and the Signup button aren't used.

Put the page's other content above the block: the banner, then the title and the card's text as
`Title (text-lg, intro-full)` (the text across the full width, as the source's).
While the lounges load, the block shows an outline of the links and a region; the messages are the
same as above.

### A new card or bank page

In Document Authoring, the Library has the template **Partner Lounges Page** (Templates) and
the item **Property Filter (lounge name only)** (Blocks › Property Filter), with this guidance in
its description. To make a page such as `/en-uk/luso-international-banking-ltd`:

1. Create the page in the language folder (e.g. `en-uk/<bank-name>`, in lowercase with hyphens)
   and insert the template.
2. **Banner:** replace the placeholder image with the card's banner (alt text: the card or bank's
   name). It stays in the first section, `background` = `grey`.
3. **Title (text-lg, intro-full):** the card or bank's name as the heading 1, then its text.
4. **Property Filter (lounge name only):** the `Region`, `Country`, `IATA` and `Property` codes
   from the card's or bank's lounge list (see above), the labels in the page's language, and
   `Updated` with the list's date (`Last updated: 04 Mar 2026`).
5. **Metadata:** `Title` and `Description` (the card or bank's name), `breadcrumb` = `on` (Home ›
   the page).
6. Preview the page. On preview pages the browser console lists any row or code the block couldn't
   use.

No code change is needed for a new page.

## Where the rest comes from

| What | From |
| --- | --- |
| The lounges | The property filter service (`scripts/property-filter.js`, `filteredProperties` in `scripts/endpoints.js`), asked once for the table's lists, in the page's language |
| Regions, countries, cities and their airports | The property filter service's answer, as it places each lounge (a city's airports share its city code, e.g. `GBLHR` for Heathrow and Gatwick) |
| Service tabs | The property filter service's answer: each lounge's services (`servicetype`, named by `serviceDisplayName` in the page's language); the All tab's name from the site's translations (`propertyAll`) |
| Region names | `scripts/regions.js`, by code in each language (as the nav's Locations menu names them), else the code (`OP`, Oceania Pacific, is in English only for now). The lounge-name-only layout uses the service's names (`regionName`), else these |
| The lounge-name-only layout's lounges | The [Accordion](../accordion/README.md) block (look `lounges`), built by the block per airport |
| The cards | `scripts/property-card.js` and `styles/property-card.css` |
