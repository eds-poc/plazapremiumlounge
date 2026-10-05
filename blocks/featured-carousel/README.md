# Featured Carousel: authoring guide

A maroon feature card with text and an image side by side. With one slide it's a single card. With two or more it becomes a carousel that changes slide every 5 seconds and loops. It has previous/next arrows, dots and a pause button. On mobile (below 576px) the card spans the full width and the text and image stack.

## Table: optional background row, then one row per slide

| Featured Carousel |  |
| --- | --- |
| *background image* |  |
| *eyebrow, title, text, link* | *image* |
| *eyebrow, title, text, link* | *image* |

- **Background (optional):** if the first row holds only an image, that image becomes the card background. Leave this row out for a plain maroon card. A block with a single row is always treated as a slide.
- **Text cell, top to bottom:**
  - **Eyebrow (optional):** a short line above the title, e.g. "SKYTRAX 2026". It can also be a logo image, shown 400px wide on every screen (as on the original site).
  - **Title:** any heading level. It looks the same whether it's H2, H3 or H4, so pick the level that fits the page outline.
  - **Subtitle (optional):** a line right below the title that is all **bold**.
  - **Text:** any number of paragraphs.
  - **Link (optional):** a paragraph with just a link becomes the white outline button.
- **Image cell:** the slide image. It can be an animated GIF, which stays animated.
- **Order of cells** doesn't matter. A slide without an image shows the text full width.
- **One row = one card, more rows = carousel.** No setting needed.

## Options

Add these to the block name, e.g. `Featured Carousel (image-narrow, rounded, text-first, text-large)`. They can be combined.

| Option | Effect | Used on |
| --- | --- | --- |
| *(none)* | Equal text and image columns. On mobile the image is on top, edge to edge. | Home |
| `image-narrow` | Wider text column (7/12), narrower image (5/12), from 768px | About us |
| `image-inset` | Portrait image at a fixed height (220px on mobile, growing with the screen up to 550px), centred. Extra space above the button | Your destination before departure |
| `rounded` | Rounded image corners | About us |
| `text-first` | On mobile the text is shown above the image | About us |
| `text-large` | Larger, light body text (20px from 768px), more space under the title, extra space after the text, text centred in its column | About us |
