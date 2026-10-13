# Campaign: authoring guide

The intro of a partner campaign on an offer page, as the source's Rogers Bank campaign: an eyebrow
pill, a light maroon heading with a gold serif accent, an intro and text, beside a cream panel with
icon items. The text is in Arial and the headings in the site font, as the source shows them.

## Table: one row, 2 columns

| Campaign | |
| --- | --- |
| Cardmember Privilege<br>## Travel like a *legend*, every time you fly.<br>Intro paragraph<br>Text… | ### Access Parameters<br>:users:<br>#### Up to 4 Guests per Visit<br>Text…<br>:clock:<br>#### Stays of up to 3 Hours<br>Text… |

- **Column 1, the text:**
  - **Eyebrow:** the line before the heading, shown as a pill in small capitals.
  - **Heading:** any level; it looks the same at every level. Make words *italic* for the gold
    serif accent.
  - **Intro:** the first paragraph after the heading, shown larger and grey.
  - **Text:** the other paragraphs. **Bold** words show in maroon.
- **Column 2, the panel (optional):**
  - **Panel title:** e.g. `Access Parameters`, shown as a gold label.
  - **Items:** for each one, an icon on its own line (e.g. `:users:`, or pick it from the Icons
    library), a title (a heading, e.g. Heading 4) and its text. The icon is optional.
- **Layout:** stacked on mobile. From 768px the text and panel sit side by side (7:5), centred
  vertically.

## Placement

On an offer page, put the page title, using `Title (text-lg)`, in a section with Section Metadata
`Style` = `inset`, which gives the source's narrower offer body. Then put the campaign in the next
section, with `Style` = `inset, band, line` and `Background` = `white`. It starts 30px below the
title, automatically.

Campaign bands come from the section, not the block: give each band its own section with Section
Metadata `Style` = `inset, band` and `Background` = `white`, `cream` or `blush`. Add `line` to the
style for a thin line under the band. A band section has no section spacing, so consecutive bands
touch, and its blocks get 40px above and below and 8% at the sides. Used in any other section, the
block shows with no band spacing or background.
