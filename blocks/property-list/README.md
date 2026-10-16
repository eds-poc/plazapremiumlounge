# Property List: authoring guide

A city's lounges, loaded live from the Plaza Premium properties service, as the source city pages
(e.g. `/en-uk/find/china-regions/hong-kong/hong-kong`):
- **Filters:** a sidebar with Airport / Rail Station, Service Type and Features (a **Filters**
  button on phones).
- **Cards:** grouped by airport or station. Each card has a photo slider, the lounge's name,
  location, opening hours, features, price and a **View** button.

## Table: two columns, a setting per row

| Property List | |
| --- | --- |
| city-code | HKHKG |
| signup-button | [Join here](https://www.plazapremiumlounge.com/en-uk/sign-up?pid=plp) |

- **city-code** (required): the code the properties service uses for the city, e.g. `HKHKG`
  (Hong Kong) or `SGSIN` (Singapore). Capitals don't matter.
- **signup-button** (optional): a link. Its text and address are shown at the end of each card's
  Smart Traveller line (e.g. "… 20% off … per eligible visit. **Join here**"). Leave the row out for
  no link. Links to other websites open in a new tab.
- Setting names ignore capitals and spaces (`City code` works too). A table with just one value
  (the city code) also works.
- Everything else comes from the service or the site settings:
  - photos, names, locations, hours, features, prices, links
  - the location groups and the filter options
- **Page heading:** put the page's heading and any intro above the block, as normal page content.

## Where the rest comes from

| What | From |
| --- | --- |
| The service address | Code, not content: `scripts/endpoints.js` keeps the API domain (the same for preview and live) and the `properties` endpoint path |
| The language of the data | The page's language folder: `/en-uk/` → `en`; `/zh-cn/`, `/zh-hk/`, `/pt-br/`, `/ja-jp/` → the same code. Pages outside a language folder: `en`. Page metadata `language-code` overrides it |
| Interface text ("Filters", "View", "+5 more", messages) | The site's translations, by page language |
| Which properties show | Active lounges, grouped by location, then passes (gift cards) at the end. Other kinds (e.g. airport dining, external partners) aren't shown |
| **View** link | The service's page link for the property. Without one, the card has no View button |
| Green look | Plaza Premium First lounges (by the brand in the lounge's name, in each language: Plaza Premium First, 环亚优逸庭, 環亞優逸庭, プラザプレミアムファースト); every other card is maroon |

## Filters (for visitors)

- **Groups:**
  - **Airport / Rail Station:** the locations in the city.
  - **Service Type:** e.g. Lounge, Shower, with All to clear the choice.
  - **Features:** e.g. Wi-Fi, Bar, VIP Room.
  - Options come from the data, without duplicates. A group with a single option is hidden.
- **Combining:** ticking several options in a group shows the properties that match any of them.
  The groups apply together.
- **Behaviour:**
  - Results change instantly, without reloading.
  - The choice is kept in the page address (e.g. `?airport=hkg&feature=wi-fi`), so a filtered
    view can be shared.
  - **Clear** resets every group.

## Messages

| Situation | Visitors see | On the preview site, authors also see |
| --- | --- | --- |
| Loading | The site's page loader (the same as on every page load), until the lounges are shown | |
| No city code in the block | "No lounges found." | A hint to add the city code |
| Unknown city, or nothing to show | "No lounges found." | The city code that returned nothing |
| No property matches the filters | "No lounges match these filters." and Clear | |
| The service is unavailable or slow (8 seconds) | "We couldn't load the lounges." and Try again | |

Missing details are simply left out of a card, e.g. no price line or no hours. A property without
photos shows a plain panel.
