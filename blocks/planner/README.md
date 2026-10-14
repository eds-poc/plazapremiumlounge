# Planner: authoring guide

The pass planner from the source offer pages (e.g. Rogers Bank). On a cream band, a white card
shows a header, a guest slider and a maroon summary. Visitors move the slider (with the mouse,
touch or the arrow keys), and the summary updates as they do.

## Table: one row per setting, 2 columns

| Planner | |
| --- | --- |
| Title | Pass Configuration Tool<br>### Plan Your Next Group Departure<br>Determine how many passes will be processed based on your guest roster. |
| Slider label | Accompanying Guests |
| Badge | {guests} Companion(s) |
| Steps | - 0 (Cardholder Only)<br>- 1 Guest<br>- 2 Guests<br>- 3 Guests<br>- 4 Guests (Max) |
| Start | 2 |
| Annual passes | 6 |
| Summary | Visit Summary<br>Lounge Passes Used<br>1 Cardmember + {guests} Guest(s)<br>You receive 6 annual passes³. After this departure, you will have {remaining} pass(es) left for future travel. |

- **Column 1** is the setting name (upper or lower case both work). **Column 2** is its value.
- **Title:**
  - The line before the heading is the gold eyebrow.
  - The heading can be any level; it looks the same at every level.
  - The text after the heading is the subtitle.
- **Slider label:** shown above the slider, and read out by screen readers.
- **Badge (optional):** the pill to the right of the label.
- **Steps:** a bulleted list, one item per slider stop. The first item is no guests, so 5 items
  allow up to 4 guests. The labels show under the slider, and screen readers read them out as the
  value.
- **Start (optional):** the number of guests selected at first. It defaults to 0.
- **Annual passes:** the yearly allowance, used for `{remaining}`.
- **Summary lines:**
  1. The eyebrow.
  2. The label under the big number. The big number shows the passes used.
  3. The badge.
  4. The text. Lines can be left out.
- **Live numbers:** in the Badge and Summary texts, these show the current numbers:
  - `{guests}`: the selected guests.
  - `{passes}`: passes used, 1 cardmember + guests.
  - `{remaining}`: annual passes − passes used, never below 0.

## Layout

On mobile the slider and summary are stacked. From 768px they sit side by side (7:5), and the card
has more padding. On an offer page, put it in its own section right after the Campaign band, with
Section Metadata `Style` = `inset, band` and `Background` = `cream`, as on the source.

Campaign bands come from the section, not the block: give each band its own section with Section
Metadata `Style` = `inset, band` and `Background` = `white`, `cream`, `blush` or `mist`. Add `line` to the
style for a thin line under the band. A band section has no section spacing, so consecutive bands
touch, and its blocks get 40px above and below and 8% at the sides. Used in any other section, the
block shows with no band spacing or background.
