# Breadcrumb: authoring guide

The page's parent and the page, as on the source's offer pages:
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

## The two items and their labels

- **Two items: the parent and the page.** The parent is the page one level up in the same
  language folder: for `/zh-cn/offers/ctbcreward` it's `/zh-cn/offers` (the page named after the
  folder), else `/zh-cn/offers/` (the folder's own index page). Pages higher up never show.
- **Each label is that page's own metadata `breadcrumb-title`**, else its title (without
  " | Plaza Premium Lounge"). Write it once, on the page it names, in that page's language:

  | Metadata | |
  | --- | --- |
  | breadcrumb-title | 优惠 |

  The listing's (`/zh-cn/offers`) `breadcrumb-title` labels the parent on every offer page in that
  folder; an offer page's own `breadcrumb-title` (e.g. `CTBC Reward Points`) shortens its long
  title.
- Set `breadcrumb-title` on the page itself (its Metadata), not on a wildcard row of the metadata
  sheet: a row like `/zh-cn/**` would give every page in it the same label.

## When something is missing

| Case | Shows |
| --- | --- |
| The parent page doesn't exist or isn't published | The page alone (no parent item); once the parent is published, it shows on the next page view |
| The parent has no `breadcrumb-title` and no title | The page alone |
| The parent can't be read (an error, or no answer within 8s) | The page alone, for that view |
| The page has no `breadcrumb-title` | Its title, else its first heading |
| A page right under the language folder (e.g. `/en-uk/about`) | The page alone |

- While the parent is read, the breadcrumb's row is kept empty, so nothing on the page moves, and
  the parent and the page appear together. A parent found once is remembered for the browser
  session (the next offer page shows it at once); a missing one isn't, so it's looked for again.
- The page shows without waiting for its parent: the banner doesn't wait for the breadcrumb.

## An authored breadcrumb (optional)

A Breadcrumb block on a page is used as written instead (and no automatic one is added): one line
per item, a link on each but the last.

| Breadcrumb |
| --- |
| [Offers](/en-uk/offers)<br>Plaza Petit |

## Look

As the source: the items in a row with "<" between them, the parent as a grey link (no change on
hover), the page in maroon; 14px on phones, 16px from 768px. It's named for screen readers in the
page's language ("Breadcrumb", 面包屑导航 …).
