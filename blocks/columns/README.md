# Columns

Content side by side. The plain block puts each cell of a row in its own column (stacked on
mobile, side by side from 900px). Add the **media-image** option for an evenly sized image grid,
such as logos.

## Default

| Columns            |                    |
|--------------------|--------------------|
| Text, image, …     | Text, image, …     |

A cell that holds only an image is shown first on mobile.

## Text-image variation

A text column and a narrower image column, as the source About page ("The Company") and landing pages
(e.g. "How to Connect to WiFi"). The column holding only an image is the narrow one (5 of 12) and
the other column the wide one (7 of 12), whichever side the image is on. On mobile the columns
stack in the order you wrote them; from 768px they sit side by side.

| Columns (text-image, vertical-center, stack-on-tablet, text-large) |                |
|-----------------------------------------------|----------------|
| ## The Company<br>Text…<br>*image*             | *image*        |

| Columns (text-image, halves-on-mobile, text-medium, row-spacing) |                 |
|------------------------------------------------|-----------------|
| ### Elevate your Travels…<br>Text…<br>**[Join Smart Traveller Today](…)** | *image* |
| *image*                                         | Step 1:<br>Text… |

- **Each row is a pair of columns.** Put the image first or second; it decides the order, not the
  widths. Without an image-only column, the second column is the narrow one.
- **Images** keep their own size (never wider than their column). An image on its own in a column
  is aligned to the column's outer edge: left in the first column, right in the second.
- **An image after text** in the same column sits 50px below it.

### Options

Add any of them after `text-image`, e.g. `Columns (text-image, vertical-center, text-large)`.

| Option | Effect | Source example |
| --- | --- | --- |
| `vertical-center` | Columns centred vertically (default: aligned to the top) | About, The Company |
| `stack-on-tablet` | Stay stacked until 992px | About, The Company |
| `halves-on-mobile` | Side by side as two halves from 576px (7/5 from 768px) | WiFi page |
| `text-large` | Text 16px on mobile, 20px from 768px | About, The Company |
| `text-medium` | Text 18px | WiFi page |
| `row-spacing` | Landing page spacing: 30px below an image-only column, 40px between rows, text up to 700px wide, and 50px between an image and the text after it from 992px | WiFi page |

For the source landing pages' narrower page width, use Section Metadata `style` = `fixed-width`.

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
