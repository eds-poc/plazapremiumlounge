# Title: authoring guide

A section or page title, as the source site's titles (`title-wrapper`): an optional small line
above the heading (the eyebrow), the heading, and optional intro text. Use it for any section
title, e.g. the homepage Explore, Latest Offers and Our Brands titles.

## Table: one cell

| Title (compact, large) |
| --- |
| LATEST OFFERS<br>## Relax, eat, drink, work and refresh before flying. |

- **Heading:** write it as a heading. Heading 2 is a section title; Heading 1 is a page title
  (42px on desktop, 32px on tablet, 30px on mobile). The level you choose is kept for the page
  outline. With no heading, the first line becomes a heading 2.
- **Eyebrow (optional):** a short line before the heading, e.g. `LATEST OFFERS`. It shows small
  above the heading (20px, or 12px in maroon on mobile) and isn't part of the heading text.
- **Intro (optional):** any text after the heading, at 20px (16px on mobile) and up to 500px wide,
  as under the source About page title.

## Options

Add them in brackets after the block name, e.g. `Title (center, compact)`.

| Option | Effect | Source example |
| --- | --- | --- |
| *(none)* | Always left-aligned | Offers, FAQ titles |
| `center` | Left on mobile, centred from 768px | Explore, Our Brands |
| `compact` | At most 600px wide from 992px | Latest Offers, The Company |
| `large` | A heading 2 stays 32px on mobile, too | Latest Offers |
| `large-multiline-heading` | A large heading over several lines: 32px on mobile, 50px from 768px, with 16px above and 48px below the title. Put each line on its own soft line break (Shift+Enter); lines are 5px apart | About, Core Values |
| `text-lg` | A large title: 28px, 40px from 1200px, the same at every heading level, in the font's own line height | Offer page titles (Rogers Bank) |
| `editorial` | A campaign feature header: the eyebrow as a small gold label, a light maroon 28pt heading where *italic* words become a gold serif accent, and the intro as small grey text. The same at every width and heading level. It adds the campaign band spacing: 40px above, 8% at the sides and 40px to what follows | Offer pages, Rogers Bank "Exquisite Comfort" |
| `center-all` | Centred at every width (`center` is left-aligned on mobile) | Rogers Bank "Exquisite Comfort" |

### Example: editorial

| Title (editorial, center-all) |
| --- |
| Exquisite Comfort<br>### More than a lounge. *A legendary experience.*<br>Enjoy exclusive privileges designed to elevate every moment of your pre-departure journey: |

Leave out `center-all` for a left-aligned header, e.g. "Extended Journey Privileges". On an offer
page, put it in the `inset` section after the Planner, as on the source.

## Spacing

The title takes the global heading sizes and the space below them (25px, 35px from 992px), and
leaves at least 30px before the next content from 992px, as on the source. Put the title in the
same section as the content it introduces, before it.
