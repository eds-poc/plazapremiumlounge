# Status Page: authoring guide

The source's 404, 500 and Maintenance pages (`/en-uk/404`, `/en-uk/500`, `/en-uk/Maintenance`)
are the same design with different content, so one block serves all three:
- **The section** is the brand maroon with white text (the block sets it: no Section Metadata
  needed), with the site's section padding.
- **A 720px high area** with, in its middle, a centred column of at most 800px: the image (81px
  wide), the title, then the text.
- **Sizes:** the title is 32px, 60px from 1200px; the text is 16px, 20px from 768px.

Put the block alone in its section, with the page's Metadata block in a section of its own after
it. Header, footer and newsletter come from the site as on every page.

## Table: one cell

| Row content | Required | What it is |
| --- | --- | --- |
| Image | optional | The icon above the title, 81px wide. Its alt text is the image's alt text (author it). |
| Title | yes | A heading, normally Heading 1 (its level is kept). Without a heading, the first text line becomes the title. |
| Text | optional | One or more paragraphs; bold, italic and links work. |

The parts can also be split over several rows or cells; the block reads them in order. The first
line with an image is the image, the first heading is the title, everything else is the text. A
part left out isn't shown (no empty space).

## Examples

**404** (`/en-uk/404`)

| Status Page |
| --- |
| ![Not Found](404-icon.svg)<br># Not Found<br>It seems the page you're looking for doesn't exist, has been moved or is currently undergoing maintenance. You will be redirected to our homepage in a few moments, or you can click here to get there sooner. |

**500** (`/en-uk/500`)

| Status Page |
| --- |
| ![Internal Server Error](maintenance.svg)<br># Internal Server Error<br>An unexpected error occurred. Please try again later. |

**Maintenance** (`/en-uk/maintenance`)

| Status Page |
| --- |
| ![Maintenance](maintenance.svg)<br># Maintenance<br>To enhance service quality, the system is currently undergoing maintenance.<br>We apologise for any inconvenience caused and thank you for your understanding and support. |

(`<br>` here stands for a new paragraph in the cell.)

## Notes

- The 404 text is the source's: the source page doesn't redirect and "click here" isn't a link.
  To make it one, link the words in DA.
- These are ordinary pages. The site's code 404 page (`404.html`, shown for any missing address)
  is separate and isn't changed by this block.
