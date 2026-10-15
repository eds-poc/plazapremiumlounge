# Property List: authoring guide

A city's lounges, loaded live from the Plaza Premium properties service, as the source city pages
(e.g. `/en-uk/find/china-regions/hong-kong/hong-kong`):
- **Filters:** a sidebar with Airport / Rail Station, Service Type and Features (a **Filters**
  button on phones).
- **Cards:** grouped by airport or station. Each card has a photo slider, the lounge's name,
  location, opening hours, features, price and a **View** button.

## Table: one cell, the city code

| Property List |
| --- |
| HKHKG |

- **City code:** the code the properties service uses for the city, e.g. `HKHKG` (Hong Kong) or
  `SGSIN` (Singapore). Capitals don't matter.
- That's all. Everything else comes from the service or the site settings:
  - photos, names, locations, hours, features, prices, links
  - the location groups and the filter options
- **Page heading:** put the page's heading and any intro above the block, as normal page content.

## Where the rest comes from

| What | From |
| --- | --- |
| The service address | Site configuration sheet `/config`, key `property-list-url` |
| The language of the data | Page metadata `language-code` (e.g. `en`; set in the bulk metadata sheet). Empty: English |
| Interface text ("Filters", "View", "+5 more", messages) | The site's translations, by page language |
| Which properties show | Active lounges, grouped by location, then passes (gift cards) at the end. Other kinds (e.g. airport dining, external partners) aren't shown |
| **View** link | The service's page link for the property. Without one, the card has no View button |
| Green look | Plaza Premium First properties |

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
| Loading | The Plaza Premium loading animation | |
| No city code in the block | "No lounges found." | A hint to add the city code |
| Unknown city, or nothing to show | "No lounges found." | The city code that returned nothing |
| No property matches the filters | "No lounges match these filters." and Clear | |
| The service is unavailable or slow (8 seconds) | "We couldn't load the lounges." and Try again | |
| No service address in the configuration sheet | "We couldn't load the lounges." | A hint to add `property-list-url` |

Missing details are simply left out of a card, e.g. no price line or no hours. A property without
photos shows a plain panel.
