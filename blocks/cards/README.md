# Cards: authoring guide

A grid of cards. Every Cards variation uses the same table: one row per card, with the card's
image (or icon) in the first cell and its text in the second. Options only change the look.

## Table: one row per card, 2 columns

| Cards | |
| --- | --- |
| *image* | ### Card title<br>Text… |
| *image* | ### Card title<br>Text… |

- **Cell 1, image:** an image, or an icon (pick it from the Icons library, or type its name between
  colons, e.g. `:cocktail:`). Leave the cell empty for a card without one.
- **Cell 2, card body:** a title (any heading level) and any text, lists or links. A paragraph
  written entirely in *italic* is the card's footnote (shown by options that have one, e.g.
  `connectivity`).
- Cards appear in the order you write them.

## Options

| Option | Look | Cards per row | Source example |
| --- | --- | --- | --- |
| *(none)* | White cards with a thin border; the image on top (4:3), the text below | As many as fit (at least 257px wide each) | |
| `connectivity` | White cards with 16px corners and a soft shadow. Cell 1 shows in a 44px gold-tinted box with 8px corners (an icon at 24px, or an image filling it). Maroon title, grey text, and the footnote (an italic paragraph) under a thin line at the bottom, shown upright. Cards in a row are the same height | 1 on mobile, 2 from 768px | Rogers Bank offer, "Extended Journey Privileges" |
| `privilege` | Cream cards with rounded corners. Cell 1 shows in a 44px round badge with a faint maroon wash: an icon at 22px, or an image filling the badge. Maroon title (the same at every heading level), small grey text. Cards lift slightly on hover (not with reduced motion) | 1 on mobile, 2 from 550px, 4 from 992px | Rogers Bank offer, "Exquisite Comfort" privileges |
| `badge` | Small white cards with a thin border and 10px corners: cell 1 (a badge image, e.g. a facility badge, or an icon) at 40px beside a short 14px label in medium weight, centred, 12px below what comes before. Write the label as a paragraph or a heading; it looks the same | 1 on mobile, 2 above 600px, 3 above 768px, at most 900px wide and centred | West Kowloon offer, facilities |

### Example: privilege

| Cards (privilege) | |
| --- | --- |
| :badge-check: | #### Priority Access<br>Ensure direct, uncompromised entry access even when lounges are operating at peak capacity. |
| :cocktail: | #### Welcome Drink<br>Sip on a signature Rogers Red cocktail or mocktail, exclusively prepared on us for a limited time. |

### Example: badge

| Cards (badge) | |
| --- | --- |
| *facility badge image* | Light Refreshments |
| :wifi: | Free WiFi Access |

On an offer page, put it in its own white band section (Section Metadata `Style` = `inset, band`,
`Background` = `white`).

### Example: connectivity

| Cards (connectivity) | |
| --- | --- |
| :globe-outline: | #### No FX Fees¹<br>Earn rich cash back rewards globally with no foreign transaction fees charged on international spending, wherever you go.<br>*¹ Subject to terms and conditions. Please refer to Rogers Bank benefit disclosures.* |
| :wifi: | #### Roam Effortlessly²<br>Stay connected worldwide with 10 Roam Like Home days loaded annually at no extra cost for eligible Rogers wireless accounts.<br>*² Eligible accounts and coverage maps defined by Rogers Communications network specifications.* |

On an offer page, put it after a `Title (editorial, gap-small)` header in a blush band section
(Section Metadata `Style` = `inset, band`, `Background` = `blush`).

### Placement of the privilege cards

On an offer page, put it after its `Title (editorial)` header in the same campaign band section
(Section Metadata `Style` = `inset, band`, `Background` = `white`). The band adds the space at the
sides and below; the cards themselves have no outer spacing, so they work in any section.
