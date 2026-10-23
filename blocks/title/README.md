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
| `editorial` | A campaign feature header: the eyebrow as a small gold label, a light maroon 28pt heading where *italic* words become a gold serif accent, and the intro as small grey text. The same at every width and heading level, with 40px to what follows. In a campaign band section (Section Metadata `Style` = `inset, band`), the band adds 40px above and 8% at the sides | Offer pages, Rogers Bank "Exquisite Comfort" |
| `plum` | A list page title: the eyebrow as a 12px bold UPPERCASE maroon line, a 36px regular maroon heading, and the intro across the full width. The same at every width and heading level | Eligible Lounges |
| `gap-small` | 30px to what follows instead of the usual space (e.g. `editorial`'s 40px) | Rogers Bank "Extended Journey Privileges", above its cards |
| `center-all` | Centred at every width (`center` is left-aligned on mobile) | Rogers Bank "Exquisite Comfort" |
| `tagline` | A lead-in: a maroon Georgia heading (22px on mobile up to 30px, growing with the screen), at most 640px wide, 10px above grey 15px Arial text at most 620px wide, as the source shows them. The same at every heading level. Use with `center-all`, in a `panel` band section | West Kowloon offer lead-in |
| `callout` | A call-to-action header, at most 720px wide and centred: a maroon Georgia heading (20px on mobile up to 26px), 16px above the intro, which sits in a white box with a thin border and 8px corners (16px grey Arial text; **bold** in maroon). The same at every heading level. With the heading only, it has no space below, so a block can follow straight under it (e.g. Responsive Content). Use with `center-all`, in a `panel` band section | West Kowloon offer Smart Traveller redemption |
| `fluid` | A campaign page title: a maroon heading that grows with the screen, 26px on phones up to 38px (from about 633px), at most 840px wide, 14px above what follows. The same at every heading level. Use with `center-all` | Lounge Passes page title |
| `highlight` | A lead-in with a highlighted offer: a maroon heading that grows with the screen (16px on phones up to 22px), where the words you make **bold** sit in a cream highlight with rounded corners, a little larger and bolder; then grey 15.5px text. At most 820px wide, 8px above what follows. The same at every heading level. Use with `center-all` | Lounge Passes "Save up to 50% off" |
| `headline` | A partner campaign section header: a bold navy heading (22px on mobile, 24px from 481px, 28px from 769px) 15px above grey 16px Arial text at most 800px wide, with 30px to what follows (e.g. Cards). The same at every heading level. Use with `center-all`, in a `medium-width` section | CTBC Reward offer "How It Works", "Travel Benefits" |

### Example: editorial

| Title (editorial, center-all) |
| --- |
| Exquisite Comfort<br>### More than a lounge. *A legendary experience.*<br>Enjoy exclusive privileges designed to elevate every moment of your pre-departure journey: |

Leave out `center-all` for a left-aligned header, e.g. "Extended Journey Privileges". On an offer
page, put it in its own band section after the Planner (`Style` = `inset, band`, `Background` =
`white`), with the cards that follow it, as on the source.

### Example: tagline and callout

| Title (tagline, center-all) |
| --- |
| ### Enjoy a premium lounge haven experience before your high speed rail journey.<br>Setting a new benchmark in rail hospitality… |

| Title (callout, center-all) |
| --- |
| ### Redeem a … lounge experience with 1,400 ST Points in the Smart Traveller App<br>Enjoy **100 ST Points** with every visit…<br>Haven’t downloaded the Smart Traveller App yet? Download it now… |

On an offer page, put each in its own band section with `Style` = `inset, band, panel` (`Background`
= `white` for the lead-in, `mist` for the callout).

### Example: fluid and highlight

| Title (fluid, center-all) |
| --- |
| # One pass to unlock your access to global airport lounges |

| Title (highlight, center-all) |
| --- |
| ## **Save up to 50% off** walk-in rates with exclusive online-only passes<br>One pass, infinite freedom. Whether you are flying solo or with a small group… |

On the Lounge Passes page they open its grey section (Section Metadata `Background` = `grey`),
followed by `Image (fixed-height)` and `Cards (icon-list)`.

### Example: headline

| Title (headline, center-all) |
| --- |
| ## How It Works<br>Follow these simple steps to convert points and unlock travel benefits |

On an offer page, put it with the cards it introduces in a section with `Style` = `inset, medium-width`.

## Spacing

The title takes the global heading sizes and the space below them (25px, 35px from 992px), and
leaves at least 30px before the next content from 992px, as on the source. Put the title in the
same section as the content it introduces, before it.
