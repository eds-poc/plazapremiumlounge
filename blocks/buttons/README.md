# Buttons: authoring guide

One or more buttons, in the site's button styles. What a button does depends only on its link: go to a page, open a modal, or open another website in a new tab.

## Table: one row per button, 2 cells

| Buttons (outline) |  |
| --- | --- |
| [Book Now](/book) | primary |
| [Find a lounge](/find) |  |
| [Log in](#login) | outline large |
| [Terms](/en-uk/modals/terms) | tertiary |
| [Our story](https://www.plazapremiumgroup.com/) | white arrow |

- **Cell 1:** the button, written as a link. The link text is the label.
- **Cell 2 (optional):** style words for this button. Leave it empty to use the block's style.
- **Block options** (in the block name, e.g. `Buttons (outline, large)`) set the style for every button that doesn't set its own. With no style anywhere, buttons are `primary`.
- **Order of cells** doesn't matter. A row without a link is skipped.

## What the link does

| Link | Click |
| --- | --- |
| A page on this site (`/offers`) | Goes to the page |
| Another website (`https://…`) | Opens in a new tab (screen readers hear "opens in a new tab") |
| `#name` matching a modal section (on the page, or in the nav or footer) | Opens that section in a modal; the page stays where it is |
| A page in a `modals` folder (`/en-uk/modals/terms`) | Opens that page's content in a modal |
| `#name` with no matching modal | Scrolls to that part of the page |
| `mailto:` / `tel:` | Opens email / calls, as normal |

### Authoring a modal

- **In a section:** put the modal content in its own section and add **Section Metadata** with `modal` = a name, e.g. `book-now`. The section is hidden. Any link to `#book-now` opens it: a Buttons block, a nav menu item, a footer link or a link in body text.
- **Where the section can live:**
  - **On the page:** the modal is only available on that page.
  - **In the nav (or footer):** the modal is available on **every page that uses that nav**. Example: put the Book Now block in a `modal = book-now` section of the nav page; the nav's Book Now button and any `[Book Now](#book-now)` on any page open that same modal.
- **On its own page:** create a page in the site's `modals` folder (e.g. `/en-uk/modals/terms`) and link to it. Its content loads only when the modal opens, so this suits large or rarely used modals.
- **One modal per name:** every link to the same name opens the same modal. If a page and the nav both define a modal with the same name, the page's one is used.
- **Names vs headings:** a `#name` link opens a matching modal instead of scrolling, so don't reuse a modal name as a heading anchor.
- **The first heading** of the content becomes the modal title, in the maroon header. Any heading level looks the same.
- Modals close with the ✕, the Esc key, or a click outside. Ctrl/Cmd-click keeps the normal browser behaviour.

## Style words

| Word | Look |
| --- | --- |
| `primary` | Filled maroon (default) |
| `outline` | Maroon outline, fills on hover |
| `tint` | Light maroon tint, fills on hover |
| `tertiary` | White with a maroon outline, 240px wide |
| `white` | White outline, for maroon or photo backgrounds |
| `large` | Bigger button (44px tall, at least 260px wide) |
| `arrow` | Adds an arrow after the label |
| `full-width` | Fills the available width |
| `disabled` | Grey and not clickable |

Combine a colour word with any of the others, e.g. `outline large arrow`.

## Layout options (block name only)

| Option | Effect |
| --- | --- |
| `center` | Centres the buttons |
| `stacked` | One button per line |
| `full-width-mobile` | Every button fills the width on phones (below 768px) |

Links to `/widgets/…` pages become widgets before buttons are built, so don't use them as button links.
