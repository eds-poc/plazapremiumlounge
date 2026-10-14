# Responsive Content: authoring guide

Content shown only on some screens, centred: e.g. a QR code to scan on desktop and a button to tap
on phones and tablets, as the source's West Kowloon Smart Traveller redemption.

## Table: a device row, then content rows

| Responsive Content (scan-or-tap) | |
| --- | --- |
| desktop-content | mobile-content |
| *QR code image, linked*<br>Scan to open in the Smart Traveller App | **[Redeem Now](https://dplink.arrture.com/…)** |

- **First row, the devices:** write one device name per column:
  - `desktop-content`: shown above 1024px.
  - `mobile-content`: shown at 1024px and below (phones and tablets).
  - Capitals and spaces don't matter (`Desktop content` works too).
- **Following rows, the content:** anything (text, images, links) in the column of the device it's
  for. Several rows add up, in order.
- **Defensive rules:**
  - A column without a known device name shows on every screen.
  - A table without a device row shows everything everywhere.
  - Empty cells are skipped.
- **Links:**
  - To make an image clickable, select it and add the link. Its alt text names the link for screen readers.
  - Links to other websites open in a new tab, as everywhere on the site.
- Hidden content isn't read by screen readers, and a hidden image isn't downloaded.

## Options

| Option | Effect | Source example |
| --- | --- | --- |
| *(none)* | Only shows and hides the content, centred | |
| `scan-or-tap` | Desktop: the image as a framed 170px QR code (white, thin border, 8px corners), 16px under what's above, with the next paragraph as a 14px grey caption 12px below. Mobile: a bold link becomes a maroon button with 8px corners (darker on hover), 20px under what's above, filling the width at 600px and below. Text in Arial | West Kowloon offer, Smart Traveller redemption |

## Placement on an offer page

On the West Kowloon offer, the section is `Style` = `inset, band, panel, centered-copy, boxed-copy`,
`Background` = `mist`, in this order:
1. `Title (callout, center-all)` with the heading only.
2. `Responsive Content (scan-or-tap)`.
3. The ST Points text as plain paragraphs. `boxed-copy` draws them as the white box.
