# hsbcoffer: authoring guide

A full-width campaign panel, as the source Smart Traveller x HSBC offer pages (e.g. Autumn Travel):
a centred header, then cards, wide images, logos, buttons, closing text or notes. Stack several
hsbcoffer blocks in one section to build a campaign: each is its own coloured band.

## Table: one row per part, in the order they show

| hsbcoffer (navy, accent) | |
| --- | --- |
| Elevate Your Autumn Travel<br>## Your rewards deserve a journey.<br>Autumn is made for getting away… | |
| *Smart Traveller logo*<br>*HSBC Reward+ logo* HSBC Reward+ | |

Each row's role comes from what's in it:

| Row | Becomes |
| --- | --- |
| The **first row**, text only: a short line, a heading, text | The **header**: the short line is the small eyebrow, then the heading, then the intro. Without a heading, the first line is the eyebrow (e.g. `Important Information`) |
| An **image** and **text** (two cells, or one) | A **card**. Text: an optional short first line (the eyebrow), an optional `### title`, text, and a link alone on a line (a button) |
| A card row with a third cell `featured` | A **highlighted card** (gold border) |
| One cell with **one image** | A **wide image**, e.g. a steps strip |
| One cell with **several images** | **Logo pills**, with a × between them; text after a logo is its label |
| Only **links** | **Buttons**, centred |
| Only **text** (not the first row) | **Closing text**, centred; **bold** text stands out. With `notes`: small print |

- Cards next to each other form one grid: 3 per row on large screens (photo cards from 860px), 1 on
  phones. A single card is centred.
- Buttons open other websites in a new tab.
- Images keep their alt text: write it in Document Authoring.

## Options

Add them in brackets after the block name, e.g. `hsbcoffer (red, icons, centered)`.

| Option | Effect |
| --- | --- |
| *(none)* or `cream` | Cream background (`#fdf8f2`) |
| `white` | White background |
| `navy` | Navy gradient; white text, gold eyebrow, white buttons |
| `red` | Red gradient; white text, white buttons |
| `products` | Product cards: light grey, centred, the image whole (e.g. credit cards) |
| `icons` | Icon cards: a small icon in a square box (on navy: dark see-through cards). Use white icons on `navy` and `red` |
| `centered` | With `icons`: centred cards with a round icon (e.g. the red "Link Your Card") |
| `split` | A highlight: the image beside the text in a gold-tinted box, the eyebrow as a gold tag (e.g. the welcome gift) |
| `notes` | Small print: the eyebrow over a gold rule, then lines with thin rules between them |
| `accent` | A gold line along the bottom of the panel |
| `compact` | Less space above and below (40px instead of 60px) |

Fonts, colours, sizes and spacing are fixed, as the source campaign.

## Example: Autumn Travel (`/en-uk/offers/autumn-travel`)

After the banner (Image `offer-banner, border-rounded`) and the title (Title `text-lg`), one section
holds seven hsbcoffer blocks:

| Panel | Block name | Rows |
| --- | --- | --- |
| Intro | `hsbcoffer (navy, accent, compact)` | Header; logos |
| Value cards | `hsbcoffer (cream)` | 3 cards (the middle one `featured`); closing text |
| Eligible cards | `hsbcoffer (white, products)` | Header; 8 cards (card image, `### name`, card type) |
| How to bind | `hsbcoffer (cream, split)` | Header; the gift card; the steps image; a button |
| Marketplace | `hsbcoffer (navy, icons)` | Header; 1 icon card; the steps image; a button |
| Link your card | `hsbcoffer (red, icons, centered)` | Header; 3 icon cards; a button |
| Important information | `hsbcoffer (cream, notes)` | `Important Information`; the terms lines |

## HSBC Library (DA: Library → HSBC)

Each section of the page above is a ready-made library entry in `docs/library/blocks/hsbc/`, with
the Autumn Travel content as its example. To build a new HSBC campaign, insert the banner and title,
then the entries in this order, and replace the text, links and images.

| Library entry | Inserts | Use it for |
| --- | --- | --- |
| HSBC Campaign Intro | `hsbcoffer (navy, accent, compact)` | The campaign opener: eyebrow, heading, intro, partner logos |
| HSBC Promotion Cards | `hsbcoffer (cream)` | The offers: photo cards with buttons (`featured` in a third cell highlights one), closing text |
| HSBC Eligible Cards | `hsbcoffer (white, products)` | The qualifying cards: one row per card (image \| `### name`, type) |
| HSBC Step Journey → Step: Highlight | `hsbcoffer (cream, split)` | A how-to step with a highlighted benefit, a steps image and a button |
| HSBC Step Journey → Step: Feature Cards | `hsbcoffer (navy, icons)` | A how-to step with icon cards, a steps image and a button |
| HSBC Feature Highlights | `hsbcoffer (red, icons, centered)` | App or product features with one button |
| HSBC Notes & Disclaimers | `hsbcoffer (cream, notes)` | The campaign period and terms |

- Insert **HSBC Step Journey** once per step; pick the item that fits the step's highlight.
- Change an entry's look with the options above (e.g. `red` instead of `navy`); its rows stay the same.
- Keep a campaign's images in its page media folder (e.g. `en-uk/offers/.autumn-travel/`); use white
  icons on `navy` and `red`.
