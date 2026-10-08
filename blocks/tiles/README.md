# Tiles: authoring guide

Text-only coloured tiles, as in the homepage "Latest Offers": a title over a dashed line, an
optional tag image and info popover at the top right, then a subtitle, text and a full-width
button. On mobile the tiles are stacked; from 768px they sit side by side in one row, all the same
height.

## Table: one row per tile, 3 columns

| Tiles | | |
| --- | --- | --- |
| Online Exclusive Offer<br>*popover text* | **Book online, enjoy more for less**<br>Text…<br>[Learn More](/en-uk/offers) | blush |
| Plaza Premium Lounge Pass<br>*popover text* | **Smarter value for frequent travellers.**<br>Text…<br>[Explore Offer](/en-uk/airport-lounge-passes) | |
| *tag image*<br>Smart Traveller Member Offer<br>*popover text* | **Turn every visit into rewards…**<br>Text…<br>[Join Now](/en-uk/offers/smart-traveller-benefit) | coral |

- **Column 1, the tile head:**
  - **Title:** the first line of text. Write it as a heading or plain text; it always looks the
    same (24px display font).
  - **Tag (optional):** an image, e.g. the Smart Traveller logo, shown 85px wide at the top right.
  - **Popover text (optional):** every line after the title. An ⓘ icon appears next to the tag;
    clicking it shows this text above the icon (Esc or a click elsewhere closes it). No text, no icon.
- **Column 2, the tile body:**
  - **Subtitle (optional):** the first line, if it is all **bold** or a heading.
  - **Text:** any paragraphs.
  - **Button:** a line with just a link becomes the full-width button. Pages on this site open in
    the same tab, other websites in a new tab; `#name` opens that modal.
- **Column 3, colour (optional):** `blush` (pink), `coral` (red), or empty for white.
- **The look is fixed:** headings, bold or other formatting in the title and subtitle don't change
  their size or style.
- **Heading and section:** put a [Title](../title/README.md) block above the tiles, e.g.
  `Title (left, short, large)` with the `LATEST OFFERS` eyebrow, and use Section Metadata
  `background` = `grey`, as on the homepage.
- Empty rows are skipped.
