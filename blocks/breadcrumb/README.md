# Breadcrumb: authoring guide

The trail from a page's section to the page, as on the source's offer pages:
**Offers < Plaza Petit: Discover the World Before Departure**. It's built automatically, so pages
don't author it.

## Where it shows

- **On every page whose metadata `breadcrumb` is `on`.** The bulk **metadata sheet** sets it for a
  whole folder: today one row, `**/offers/**` = `on`, covers the offer pages of every language
  (but not the `/<lang>/offers` listing itself).
- To show it in another section, add a row (e.g. `**/guides/**` = `on`). To hide it on one page,
  add `breadcrumb` = `off` to that page's Metadata.
- It's placed just before the page title: at the end of the section before it (after the offer
  banner), else at the top of the title's section.
- Not on a language homepage or on pages outside a language folder.

## The trail and its labels

- One level per folder under the language folder, then the page: `/en-uk/offers/petit` → **Offers**
  (`/en-uk/offers`) < **the page**. Each language's pages make that language's trail.
- **Each level's label is that page's own metadata `breadcrumb-title`**, else its title (without
  " | Plaza Premium Lounge"). Write it once on the page it names:

  | Metadata | |
  | --- | --- |
  | breadcrumb-title | Offers |

  The listing's (`/en-uk/offers`) `breadcrumb-title` labels the Offers level on every offer page; an
  offer page's own `breadcrumb-title` (e.g. `CTBC Reward Points`) shortens its long title in the
  trail.
- The levels before the page are links to their pages. A folder without a page shows its name as
  text (e.g. "Offers"); once the page is published, it becomes a link with that page's label.
- The parents' labels are read from their pages once per browser session, after the page shows.

## An authored breadcrumb (optional)

A Breadcrumb block on a page is used as written instead (and no automatic one is added): one line
per level, a link on each but the last.

| Breadcrumb |
| --- |
| [Offers](/en-uk/offers)<br>Plaza Petit |

## Look

As the source: the levels in a row with "<" between them, earlier levels as grey links (no change on
hover), the page in maroon; 14px on phones, 16px from 768px. It's named for screen readers in the
page's language ("Breadcrumb", 面包屑导航 …).
