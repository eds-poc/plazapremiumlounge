# HSBC offer page: authoring guide

The Smart Traveller x HSBC offer pages (e.g. `/en-uk/offers/autumn-travel`), built only from existing
blocks. The page's campaign look (navy, cream and red bands, red buttons, the card styles) comes from
this template's stylesheet, `hsbc-offer.css`, which loads only on pages that set the template.

## 1. Page Metadata

| Metadata | |
| --- | --- |
| Title | HSBC Autumn 2026 \| Plaza Premium Lounge |
| Description | *one sentence about the offer* |
| Image | *the banner* |
| Template | hsbc-offer |

## 2. Sections, top to bottom

Each section ends with a **Section Metadata** table with its `Style`:

| Section Metadata | |
| --- | --- |
| Style | hsbc-band, hsbc-navy |

| # | Section | Blocks, in order | Section Metadata `Style` |
| --- | --- | --- | --- |
| 1 | Banner and title (as other offer pages) | **Image** (`offer-banner, border-rounded`); a breadcrumb line `[Offers](/en-uk/offers) < **HSBC Autumn 2026**`; **Title** (`text-lg`) with the page name as heading 2 | `inset` |
| 2 | Intro | **Title** (`center-all`): eyebrow line, heading 2, intro; **Cards** (`logos`): one row per partner logo (image \| optional label) | `hsbc-band, hsbc-navy, hsbc-accent` |
| 3 | Value cards | **Cards** (`offer, featured`): image \| eyebrow line, text, **bold link** (button); then the closing text as paragraphs, the last one **bold** | `hsbc-band, hsbc-cream` |
| 4 | Eligible cards | **Title** (`center-all`); **Cards** (`products`): card image \| `### name`, type | `hsbc-band` |
| 5 | How to bind | **Title** (`center-all`); **Columns** (`highlight`): image \| tag line, `### title`, text; **Image** (the steps strip); **Buttons** (`center`) | `hsbc-band, hsbc-cream` |
| 6 | Marketplace | **Title** (`center-all`); **Cards** (`icons`): icon \| `### title`, text; **Image**; **Buttons** (`center`), style `white` | `hsbc-band, hsbc-navy` |
| 7 | Link your card | **Title** (`center-all`); **Cards** (`icons, centered`); **Buttons** (`center`), style `white` | `hsbc-band, hsbc-red` |
| 8 | Important information | Paragraphs: the first is the title (`Important Information`), the others the terms | `hsbc-band, hsbc-cream, hsbc-notes` |

## 3. Section styles

| Style | Effect |
| --- | --- |
| `hsbc-band` | A campaign band: the content width, 960px content, centred headers, red buttons. White unless a colour is added |
| `hsbc-cream` | Cream band |
| `hsbc-navy` | Navy band: white text, gold eyebrow, white buttons |
| `hsbc-red` | Red band: white text, white buttons |
| `hsbc-accent` | A gold line along the bottom of the band |
| `hsbc-notes` | Small print: the first paragraph is a small title over a gold rule, the others are separated by thin lines |
| `hsbc-compact` | Less space above and below the band (40px instead of 60px) |

## 4. Block options used (only on this template)

| Block | Option | Look |
| --- | --- | --- |
| Cards | `offer` | Photo cards: the image 200px tall on top, the first line as a small red eyebrow, the text, a red button at the bottom. 3 per row from 860px, stacked below |
| Cards | `featured` | With `offer`: the middle card gets a gold border |
| Cards | `products` | Light grey centred cards, the image whole (e.g. credit cards); as many per row as fit |
| Cards | `icons` | Icon cards: a small icon in a square box (dark see-through cards on navy). A single card is centred. Use white icons |
| Cards | `centered` | With `icons`: centred cards with a round icon; 3 per row from 641px |
| Cards | `logos` | Logo pills with a × between them; text after a logo is its label |
| Columns | `highlight` | The image beside the text in a gold-tinted box; the first line is a gold tag. Stacked on phones |

- **Buttons:** in a Cards text cell, a **bold link** alone on a line becomes a button. In a Buttons
  block, cell 2 `white` gives the white button used on navy and red bands.
- **Images:** keep the campaign images in the page's media folder, e.g. `en-uk/offers/.autumn-travel/`.
- Fonts, colours and spacing are fixed by the template; everything else is ordinary content.
