# Offer List: authoring guide

The site's offers, loaded from a JSON file of the offer pages (a query index), as the source offers
page (`/en-uk/offers`):
- **Filter line:** "Show me [All offers ↓] ordered by [Latest ↓]", in the Dropdown block's look.
  Choosing an option shows those offers at once.
- **Cards:** the offers as large photo cards (the Cards `large` look). Each has its photo, the
  title, the description and a **Learn more →** link to the offer page.

## Table: one row (optional)

| Offer List | |
| --- | --- |
| Source | [/en-uk-offers.json](/en-uk-offers.json) |

- **Source** (optional): the JSON file with the offers, as a link or plain text, e.g.
  `/en-uk-offers.json`.
  - **Leave it out** (an empty `Offer List` table, or the row without a value) to use the
    offers of the page's language site: `/en-uk-offers.json` on an `/en-uk/` page,
    `/zh-cn-offers.json` on a `/zh-cn/` page, and so on (pages outside a language folder use
    `/en-uk-offers.json`). That language site's file must exist.
  - Use a path (`/en-uk-offers.json`): it's read from the site the page is on, so the preview
    shows the preview's offers and the live site the live ones. A full address works only when
    it's the same site as the page; another site's address (including this site's preview or
    live address seen from the other one) isn't read.
  - A table with just the link (one cell) also works.
- **Page heading:** put the page's heading above the block, e.g. a `Title` with
  "Plaza Premium Lounge offers for your next trip", in the same section.
- When the file can't be read (or the Source isn't a valid address), the block says "We couldn't
  load the offers." and the browser console says why.

## Where the cards come from

Each row of the JSON is one offer:

| Column | Used for |
| --- | --- |
| `path` | The **Learn more** link (required; rows without it are left out, and a page listed twice shows once) |
| `title` | The card title (required). A trailing " \| Plaza Premium Lounge" is dropped |
| `description` | The text under the title |
| `image` | The photo (cropped to 5:3). Without one, the card has no photo |
| `tag` | The **Show me** categories (not shown on the card, as on the source). Several tags: separate them with commas. An offer without a tag shows under **All offers** only |
| `date` (optional) | The order: **Latest** shows the newest offers first, **Oldest** the others first. A date such as `2026-10-01` (or the seconds since 1970, as the index gives dates it reads) |
| `lastModified` | The order for offers without a `date` |

- The **Show me** menu lists **All offers**, then every tag in the file once, in alphabetical
  order. A tag's spelling and capitals are shown as they are in the file, so keep them the same
  on every offer page (e.g. always `Limited Time`).
- **Give each offer page a date** (page metadata `Date`, e.g. `2026-10-01`), and add a `date`
  column to the offers index in the site's index configuration (tools.aem.live). Until then,
  offers are ordered by `lastModified`, which changes whenever an offer page is published again,
  so editing an old offer moves it to the top of **Latest**. Offers with a date and offers without
  one are ordered together, by their date or last change.

## The page address

The selection is kept in the page address, so a reload or a shared link shows the same offers,
and the browser's Back and Forward buttons work:

| Selection | Address |
| --- | --- |
| All offers, Latest (the default) | `/en-uk/offers` |
| A category | `?category=limited-time` (the tag in lower case, words joined by dashes) |
| Oldest first | `?sort=oldest` |

- Both together: `?category=limited-time&sort=oldest`. An unknown category shows all offers;
  other parameters in the address are kept.

## Interface text

"Show me", "ordered by", "All offers", "Latest", "Oldest", "Learn more" and the messages come from
the site's translations (`scripts/i18n.js`), by page language. The category
names are the tags, as written in the file.

## For developers

- `offer-list.js` reads the Source (else `/{site}-offers.json`, from `getSiteFolder()`), fetches
  every row in one request (`limit=10000`), orders by `date` (else `lastModified`), and keeps the
  selection in the address (`category`, `sort`). The listing page itself and the index's
  `/default-meta-image.png` placeholder are left out (no card, no photo).
- `decorate` doesn't wait for the JSON, so the page shows straight away. While the offers load,
  the block keeps a screen's height (`aria-busy`), and its content is put together hidden and
  shown at once, so nothing on the page moves (CLS).
- The filter line is built in this block with the Dropdown block's markup (`dropdown-field`,
  `dropdown-control`, `dropdown-toggle`, `dropdown-menu`, `dropdown-link`), and its look comes from
  `blocks/dropdown/dropdown.css`, loaded by this block. The keyboard handling matches the
  Dropdown block's.
- The cards are a `cards large` block made with `buildBlock` and decorated by the Cards block
  (`decorateBlock` and `loadBlock`), so they always match Cards (large). Filtering hides cards
  (`hidden`) and sorting reorders them; nothing is fetched again.
- Generic helpers (`el`, `fetchJson`, `toKey`, `isPreview`) come from `scripts/properties.js`.
- The block keeps `data-category` and `data-sort` (the current selection), and announces the number
  of offers shown to screen readers after each change.
