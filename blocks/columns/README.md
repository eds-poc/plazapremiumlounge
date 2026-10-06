# Columns

Content side by side. The plain block puts each cell of a row in its own column (stacked on
mobile, side by side from 900px). Add the **media-image** option for an evenly sized image grid,
such as logos.

## Default

| Columns            |                    |
|--------------------|--------------------|
| Text, image, …     | Text, image, …     |

A cell that holds only an image is shown first on mobile.

## Media-image variation

A centred grid of evenly sized image cards, for partner or brand logos, airlines, awards or any
other set of small images. Each card is white with rounded corners, the image fits inside it
(max 125 × 100px), and the card grows slightly on hover. Built from the source "Our Brands" /
"Our Services" sections.

| Columns (media-image) |                    |                    |
|-----------------------|--------------------|--------------------|
| *image*               | *image*            | *image*            |
| *image*               | *image*            |                    |

- **One cell per image.** The image alt text is the name (e.g. "Plaza Premium First").
- **Link (optional):** select the image and add a link to it; no separate link text is needed.
  The whole card becomes the link, with the alt text as its name and tooltip. Pages on this site
  open in the same tab, other websites in a new tab. (A link written under the image in the same
  cell also works.)
- **Rows don't matter:** use as many rows and cells as you like; empty cells and cells without an
  image are skipped. The layout comes from the screen size: 1 image per row on small phones, 2 from
  576px, 3 from 768px, up to 850px wide. A short last row is centred.
- **Heading and section look:** put the heading (e.g. "Our Brands") above the block as normal text,
  and use Section Metadata `background` = `grey` and `title-position` = `center`, as on the source.

### Option: slider

`Columns (media-image, slider)`: below 768px the images become a looping, swipeable row with dots
(cards 250px wide, 300px from 520px), as on the source homepage. From 768px it is the grid again.

- Swipe or drag to move; the dots go straight to an image; arrow keys work when an image is
  focused.
- With reduced motion the slider jumps instead of sliding.
- A single image, or images that all fit on screen, stay still with no dots.
