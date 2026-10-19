# Accordion: authoring guide

Questions that open to show their answers, as the source site's accordions (e.g. the About page
"Awards and Milestones"): a line under each item, a 20px question with an arrow at the right,
and grey answer text. Each item opens and closes on its own; the arrow turns down and the
question turns maroon while it's open. The answer slides open in browsers that support it (and
opens instantly elsewhere, or with reduced motion).

## Table: one row per item, 2 columns

| Accordion (columns-3) | |
| --- | --- |
| 2014 | **Awards**<br>- International Award – DHL/SCMP Hong Kong Business Awards 2014<br>- Most Improved Outlet – ASQ Survey… |
| 2015 | **Awards**<br>- … |

- **Column 1, the question:** plain text (bold or italic is kept). It's what visitors click.
- **Column 2, the answer:** any content: paragraphs, bulleted or numbered lists (also nested),
  links, images. Lists are indented 20px, with a little padding around each item, and no space below them.
- A row without a question is skipped; a question without an answer opens to nothing.
- Browser "find in page" also searches closed answers and opens the one that matches.

## Columns

Add an option after the block name. Items fill the rows in the order you write them.

| Block name | Items per row |
| --- | --- |
| `Accordion` | 1 |
| `Accordion (columns-2)` | 1 on mobile, 2 from 576px (each half the width) |
| `Accordion (columns-3)` | 1 on mobile, 2 from 576px, 3 from 768px (each 30% wide, as the source) |

The first row has a darker line above it. An open item makes its whole row as tall as its answer,
as on the source.

## Detail

`Accordion (detail)` is the lounge page's panels (The Lounge, Lounge Features, Available Services,
Details), as the source lounge detail pages. The [Property Detail](../property-detail/README.md)
block builds it itself; authors don't normally add it. It has:
- no line above the first item or below the last
- medium-weight questions (dark grey when closed, the text colour when open)
- on phones: 14px uppercase questions, no lines, and 30px between items

Put the section title above the block, e.g. a [Title](../title/README.md) block.
