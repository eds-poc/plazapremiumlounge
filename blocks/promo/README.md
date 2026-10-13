# Promo: authoring guide

A call-to-action box, as on the source offer pages (Rogers Bank "Apply Now"). It's a
maroon-to-plum gradient box with a centred light heading, pink text and a gold button with an
arrow.

## Table: one cell (or one row per line)

| Promo |
| --- |
| ### Unlock even more travel and lifestyle benefits with the *Rogers Red World Legend™ Mastercard*.<br>Explore the exclusive suite of global privileges and apply today to upgrade your upcoming travels.<br>[Apply Now](https://www.rogersbank.com/…) |

- **Heading:** any level; it looks the same at every level. Make words *italic* for the gold serif
  accent.
- **Text:** any paragraphs, centred and at most 600px wide.
- **Button:** a paragraph holding only a link becomes the gold button with an arrow. Links to other
  websites open in a new tab.
- Every part is optional. A promo without a link has no button.

## Layout

- **Box padding:** 60px above and below and 24px at the sides on mobile, then 80px and 40px from
  768px.
- **Heading:** 20pt on mobile, 24pt from 768px, at most 800px wide.
- **Text:** 12pt on mobile, 13pt from 768px, at most 600px wide.
- **Button hover:** the button lightens and its shadow grows, without animation when reduced
  motion is on.

## Placement

On an offer page, put it in its own section after the campaign bands, with Section Metadata
`Style` = `inset, band, flush`. `flush` keeps the band section's no-gap stacking but drops the band
padding and side margins, because the promo draws its own box. No `Background` is needed.
