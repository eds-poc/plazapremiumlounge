# Booking Widget tests (dev only)

Browser checks for the Booking Widget block, its homepage lounge card and the Book Now dialog.
They run against the local preview (this branch's code with the previewed content) and are not
served: `.hlxignore` lists `test/*`.

## Setup

- The local preview: `npx -y @adobe/aem-cli up` (or set `BW_HOST`, e.g. a branch preview).
- Playwright is not a dependency of the site. Point `PLAYWRIGHT` at its module (or install it and
  leave the default, `playwright`).
- For `axe.test.mjs`: `AXE_CORE`, the path to `axe-core/axe.min.js`.
- The homepage needs the Hero (booking) and the navs the Book Now widget, as previewed.

## Suites

| File | Checks |
| --- | --- |
| `widget.test.mjs` | Where search tiers, no-match message, keyboard pick, time list, guest limits, search address, the Book Now dialog (13) |
| `lounge-card.test.mjs` | The lounge card from getbookingwidgetproducts: real airports, routed answers and errors, request flow (46) |
| `locations.test.mjs` | getGeoLocation: the Where list and the nearest airport, real and routed answers, failures, flows (25) |
| `search-button.test.mjs` | Search disabled until the locations and the nearest airport are in (22) |
| `axe.test.mjs` | axe on the card, unavailable and Filling Up states |
| `perf.mjs` | LCP, CLS (with shift sources), TBT, typing delay, API calls and bytes, when Search turns on and the card shows; mobile (4x CPU, slow 4G) and desktop; `node perf.mjs <label> [runs]` |
| `snapshot.mjs` | Computed styles and boxes of the hero, card and dialog at five widths with fixed answers, to prove a CSS change is visually identical; `node snapshot.mjs <label>` |

Results and screenshots go to `RESULTS` (default `test/booking-widget/results`, not committed).
The fixtures are the service answers the backend team provided.
