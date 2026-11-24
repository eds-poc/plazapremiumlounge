# Carousel Cards: authoring guide

A looping row of cards, as in the homepage offers carousel: an image, a title, a short description (up to 2 lines are shown) and a link. On phones one card is shown at a time; from 650px wide, two. Arrows on the sides move one card at a time, cards can be swiped or dragged, and the row loops back to the first card after the last. With fewer cards than fit, the cards just sit side by side without arrows.

## Table: one row per card, 2 cells

| Carousel Cards |  |
| --- | --- |
| *image* | #### Offer title<br>Short description…<br>[Explore Offer](/en-uk/offers/…) |
| *image* | … |

- **Image cell:** the card image. Landscape images work best; they're shown at 5:3.
- **Text cell, top to bottom:**
  - **Tag (optional):** a short line before the title, e.g. `New`, shown as a small pill on the image. (The homepage offers carousel doesn't show one.)
  - **Title:** any heading level. It always looks the same, so pick the level that fits the page.
  - **Description:** any text. Only the first 2 lines are shown, ending with "…".
  - **Link:** a paragraph with just a link becomes "Explore Offer →". Make it **bold** or *italic* to show it as a button instead.
- **Order of cells** doesn't matter. Empty rows are skipped.

## Optional buttons below the cards

Add a row with a small **Buttons** table inside, written like a Buttons block, to show buttons centred below the cards (as "Explore Latest Offers" on the homepage):

| Buttons |
| --- |
| [Explore Latest Offers](/en-uk/offers) |

- Without options, buttons are the outline style, as on the homepage. Use `Buttons (primary)` or a style cell per button (`tint`, `large`, …) to change it; see the Buttons block guide.
- What a button does comes from its link: pages navigate, `#book-now` opens the Book Now modal, other websites open in a new tab.

## Cards from the offers index (optional)

Instead of typing the cards, the carousel can show the newest offers from a query index of the
offer pages (as on the homepage). Add these rows, before or after any Buttons row:

| Carousel Cards |  |
| --- | --- |
| Source | [/en-uk-offers.json](/en-uk-offers.json) |
| Count | 6 |
| Link text | Explore Offer |

- **Source:** the index, as a link or plain text (a path on this site, e.g. `/en-uk-offers.json`;
  another site's address isn't read). With it, the block's typed cards aren't shown.
- **Count** (optional): how many of the newest offers, a whole number. 6 without it.
- **Link text** (optional): each card's link, e.g. "Explore Offer →". Without it, the card's title
  is the link.
- **Each card** is an offer from the index: its `image`, its `title` (a trailing " | Plaza Premium
  Lounge" is dropped), its `description` and a link to its `path`. Offers without a path or a title
  are left out, and the page itself isn't shown. Newest first: by the `date` column when the index
  has one (the offer page's Date), else by `lastModified`.
- **If the index can't be read**, the typed cards show instead (none: an empty carousel), and the
  browser console says why. The page's section waits for the index before it shows, so the
  carousel appears once, already filled.
- Row names ignore capitals and spaces (`Link text`, `link-text`).

