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
