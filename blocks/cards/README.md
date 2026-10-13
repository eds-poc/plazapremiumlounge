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
- **Cell 2, card body:** a title (any heading level) and any text, lists or links.
- Cards appear in the order you write them.

## Options

| Option | Look | Cards per row | Source example |
| --- | --- | --- | --- |
| *(none)* | White cards with a thin border; the image on top (4:3), the text below | As many as fit (at least 257px wide each) | |
| `privilege` | Cream cards with rounded corners. Cell 1 shows in a 44px round badge with a faint maroon wash: an icon at 22px, or an image filling the badge. Maroon title (the same at every heading level), small grey text. Cards lift slightly on hover (not with reduced motion) | 1 on mobile, 2 from 550px, 4 from 992px | Rogers Bank offer, "Exquisite Comfort" privileges |

### Example: privilege

| Cards (privilege) | |
| --- | --- |
| :badge-check: | #### Priority Access<br>Ensure direct, uncompromised entry access even when lounges are operating at peak capacity. |
| :cocktail: | #### Welcome Drink<br>Sip on a signature Rogers Red cocktail or mocktail, exclusively prepared on us for a limited time. |

On an offer page, put it after its `Title (editorial)` header in the same campaign band section
(Section Metadata `Style` = `inset, band`, `Background` = `white`). The band adds the space at the
sides and below; the cards themselves have no outer spacing, so they work in any section.
