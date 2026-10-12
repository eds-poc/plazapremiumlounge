# Image: authoring guide

One image at the full content width, as the source site's page banners (e.g. the banner at the
top of an offer page). It can be a link.

## Table: one cell

| Image (offer-banner, border-rounded) |
| --- |
| *image* |

- **Image:** insert one image. Its alt text describes it for screen readers, so write what the
  image shows, including any text that is part of the image (e.g. the offer headline).
- **Link (optional):** select the image and add a link to it. The whole image becomes the link, with
  the alt text as its name and tooltip. Pages on this site open in the same tab, other websites in
  a new tab. (A link written under the image also works.)
- Only the first image is used. A block without an image shows nothing.

## Options

Add them in brackets after the block name. They can be combined.

| Option | Effect | Source example |
| --- | --- | --- |
| *(none)* | The image at its own shape | |
| `offer-banner` | A fixed 5:2 shape on every screen (e.g. 1366 × 546 on desktop, 335 × 134 on mobile); the image is centred and its edges are trimmed to fill it. 30px space below | Offer page banner (Rogers Bank) |
| `border-rounded` | 20px rounded corners | Offer page banner |

For `offer-banner`, keep the important parts of the image (text, logos) away from the left and
right edges. A wider image, like the 3.2:1 source banners, loses a little on each side.

## Placement

Put the block at the top of the page's first section for a page banner. The first image on the
page loads first, so the banner appears quickly.
