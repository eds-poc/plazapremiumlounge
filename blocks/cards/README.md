# Cards

A list of cards. The plain block shows each row as a card with an image and text. Add the
**text-tile** option for coloured, text-only tiles with a button (the homepage "Latest Offers").

## Default

| Cards              |                    |
|--------------------|--------------------|
| *image*            | Text, link, …      |

A cell that holds only an image is the card image; the other cell is the card text.

## Text-tile variation

`Cards (text-tile)`: text-only tiles in a row (stacked on mobile, all side by side and the same
height from 768px). Each tile has a title over a dashed line, an optional badge and info popover at
the top right, a subtitle, text and a full-width button.

| Cards (text-tile)  |               |                         |
|--------------------|---------------|-------------------------|
| *badge* · ### Title · **Subtitle** · text · [Button](/link) | blush | Info popover text |
| ### Title · **Subtitle** · text · [Button](/link) |  | Info popover text |
| ### Title · … | coral |  |

- **Cell 1, the tile content**, top to bottom:
  - **Badge (optional):** a small image before the title, e.g. the Smart Traveller logo. It's shown
    85px wide at the top right.
  - **Title:** any heading level; it always looks the same (24px display font).
  - **Subtitle (optional):** the first paragraph that is all **bold**.
  - **Text:** any paragraphs.
  - **Button:** a paragraph with just a link becomes the full-width button. Pages on this site open
    in the same tab, other websites in a new tab; `#name` opens that modal.
- **Cell 2 (optional): colour.** `blush` (pink), `coral` (red) or empty for white.
- **Cell 3 (optional): info popover text.** When there is text, an ⓘ icon appears at the top
  right; clicking it shows the text above the icon. Leave it empty for no icon.
- **Order of cells** doesn't matter: a single word is the colour, a cell with a title or link is
  the content, anything else is the popover text. Empty rows are skipped.
- **Heading:** put the section heading above the block as normal text, and use Section Metadata
  `background` = `grey`, as on the homepage.
