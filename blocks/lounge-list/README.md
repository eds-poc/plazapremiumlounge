# Lounge List: authoring guide

A grid of lounge photos with a city label. On desktop (768px and up) every 5 lounges form a group (two stacked cards, one tall card, two stacked cards). On mobile the same list becomes an endless swipeable row of square cards with dots (it loops back to the first lounge after the last).

## Table: one row per lounge, 2 cells

| Lounge List |  |
| --- | --- |
| *photo* | [Helsinki](/en-uk/find/europe/finland/helsinki) |
| *photo* | [Bangkok](/en-uk/find/asia/thailand/bangkok) |

- **Cell 1:** the lounge photo. Landscape photos work best; they're cropped to fit.
- **Cell 2:** the label shown on the card. If you link it, the whole card links there. Leave it unlinked for a card that isn't clickable.
- **Tall cards:** the 3rd, 8th, 13th lounge and so on become the tall card automatically. To change which lounge is tall, change the row order.
- **Any number of lounges** works. A group that isn't full fills the left columns.
- **Order of cells** doesn't matter, and if the label is empty the photo's alt text is used.
- **Heading:** put a heading (e.g. "Explore Our Newest Plaza Premium Lounges") above the table in the same section. It isn't part of the block.

## Optional buttons (a Buttons table inside the Lounge List)

Add a row and put a small **Buttons** table inside its cell, written exactly like a Buttons block. The buttons show centred below the lounges (below the dots on mobile):

| Lounge List |  |
| --- | --- |
| *photo* | [Helsinki](/en-uk/find/europe/finland/helsinki) |
| *nested table:* Buttons / [Book Now](#book-now) |  |

Inside the nested table:

| Buttons (options) |  |
| --- | --- |
| [Book Now](#book-now) | *style (optional)* |

- **First row:** `Buttons`, optionally with options like a Buttons block, e.g. `Buttons (primary)` or `Buttons (outline, large)`. These set the style for every button in it.
- **One row per button:** the link, plus an optional style cell, e.g. `tint`, `primary large` or `white arrow`. See the Buttons block guide for all the style words.
- **Default look:** with no options and no style cell, the button is a large outline button, as on the original homepage. If you type a style for a button (and the header has no options), exactly that style is used, so `primary` gives a normal-size primary button.
- **What it does comes from the link:**
  - `#book-now` opens the Book Now modal, the same one the nav's Book Now button opens. This needs a nav page with a `modal = book-now` section; on pages without it, the link does nothing visible.
  - A page link goes to that page. A link to another website opens in a new tab.
- **Several buttons** sit side by side, in table order. The row with the nested table can be anywhere in the Lounge List, and it never becomes a lounge card.
