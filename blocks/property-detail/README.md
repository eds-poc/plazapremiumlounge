# Property Detail: authoring guide

One lounge (or pass), loaded live from the Plaza Premium property detail service, as the source
lounge pages (e.g. Plaza Premium Lounge, Near Gate 60, Hong Kong). One template page per language
folder serves every lounge: `/en-uk/find/lounge`, `/zh-cn/find/lounge`, `/zh-hk/find/lounge`,
`/ja-jp/find/lounge`, `/pt-br/find/lounge`. The address picks the lounge:

`/en-uk/find/lounge?propertycode=PRPRTY814&currency=HKD&date=2026-10-21&time=1600`

- **Desktop:**
  - a grey title band: the name, location and opening hours
  - a breadcrumb: Lounges (back to the listing the visitor came from) < the lounge
  - the first four photos (each opens full size) beside the **Book your visit** panel
  - the panels: The Lounge, Lounge Features, Available Services, Details (an
    [Accordion](../accordion/README.md) with the `detail` option, the first two open)
- **Phones:**
  - a grey intro: a photo slider, the Departures/Arrivals badge, the name, location, hours and
    description
  - the panels
  - a bar fixed at the bottom: the lowest price, **Book your visit** (the booking form in a
    pop-up) and the Smart Traveller line
- **Plaza Premium First** lounges are green instead of maroon.

## Table: two columns, a setting per row (all optional)

| Property Detail | |
| --- | --- |
| signup-button | [Join free](https://www.plazapremiumlounge.com/en-uk/sign-up?pid=pdp) |

- **signup-button:** a link, shown after the Smart Traveller line (the pill in the booking panel,
  and the bottom bar on phones). Leave the row out for no link. Links to other websites open in a
  new tab.
- An empty block (no rows) is fine: everything else comes from the service.
- Make the template page **noindex** (page metadata Robots). The block sets the page title,
  description, share image and canonical address from the lounge.

## The page address

| Parameter | Meaning | When missing or wrong |
| --- | --- | --- |
| `propertycode` | The lounge, e.g. `PRPRTY814` | "This lounge isn't available." |
| `currency` | Sent to the service, e.g. `HKD` (prices come in the lounge's own currency) | `USD` |
| `date` | The booking date, `YYYY-MM-DD` | Today at the lounge; a past date moves to today |
| `time` | The booking time, `HHmm` on the half hour | The next half hour at the lounge; a past time moves on |

The page writes the date and time it shows back into the address (no reload), so a link can be
shared. Lounge cards in the [Property List](../property-list/README.md) link here.

## Booking panel

- **Fields:** date, time ("hrs"), adults, children, service and service details (from the
  service), and a promo code.
- **Get Price** has no action yet. It sends a `property-detail:get-price` event with the choices,
  as a hook for the booking hand-off to come.
- **No services:** a lounge without bookable services (e.g. a rail lounge in the test data) shows
  a note instead of the service fields and Get Price.

## Where the rest comes from

| What | From |
| --- | --- |
| The service address | Code, not content: `scripts/endpoints.js` (the `propertyDetail` endpoint path) |
| The language of the data | The page's language folder (as the Property List); page metadata `language-code` overrides it |
| Labels ("Date", "Get Price", panel names, "Lounge in {city}") | The site's translations, by page language, in the source pages' wording |
| Details panel | The lounge's address and phone number only; the service's email addresses aren't shown |

## Messages

| Situation | Visitors see | On the preview site, authors also see |
| --- | --- | --- |
| Loading | The site's page loader until the lounge is shown (the service can take several seconds) | |
| No `propertycode` in the address | "This lounge isn't available." | A hint with an example address |
| Unknown or inactive lounge | "This lounge isn't available." | The code that wasn't found |
| The service is unavailable or slow (30 seconds) | "We couldn't load this lounge." and Try again | |

The bookable services arrive with a second call in the background. Their fields wait, disabled,
until then.
