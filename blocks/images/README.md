# Images: authoring guide

Several images at the full content width, as a stack or (option `carousel`) a fading slideshow, as
the source's West Kowloon lounge photo gallery. For a single banner image, use the Image block.

## Table: one row per image

| Images (carousel) |
| --- |
| *image* |
| *image* |
| *image* |

- **Images:** insert one image per row (several in one cell also work); they're shown in the order
  you write them. Write alt text for each one: what the photo shows.
- **Link (optional):** select an image and add a link to make it clickable.
- Rows without an image are skipped. A block without images shows nothing.

## Options

| Option | Effect | Source example |
| --- | --- | --- |
| *(none)* | The images one under another, each at its own shape, 20px apart | |
| `carousel` | One image at a time in a 16:7 frame with 8px corners (each photo trimmed to fill it), fading to the next every 4 seconds and looping. A round pause/play button sits at the bottom right. It also waits while the pointer is on it, and doesn't start on its own for visitors who turned on reduced motion (they can press play). With one image, it's simply shown in the frame | West Kowloon offer, lounge photo gallery |

## Placement on an offer page

On the West Kowloon offer, the carousel sits under the lounge description in a mist band section
(Section Metadata `Style` = `inset, band`, `Background` = `mist`). The band adds the space around
it; the block itself has no outer spacing.
