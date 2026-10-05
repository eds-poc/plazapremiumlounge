# Buttons: authoring guide

One or more buttons, in the site's button styles. What a button does depends only on its link: go to a page, open a modal, or open another website in a new tab.

## Table: one row per button, 2 cells

| Buttons (outline) |  |
| --- | --- |
| [Book Now](/book) | primary |
| [Find a lounge](/find) |  |
| [Log in](#login) | outline large |
| [Terms](/modals/terms) | tertiary |
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
| `#name` matching a modal section on the page | Opens that section in a modal; the page stays where it is |
| A page in a `/modals/` folder (`/modals/terms`) | Opens that page's content in a modal |
| `#name` with no matching modal | Scrolls to that part of the page |
| `mailto:` / `tel:` | Opens email / calls, as normal |

### Authoring a modal

- **On the same page:** put the modal content in its own section and add **Section Metadata** with `modal` = a name, e.g. `login`. The section is hidden on the page. Any button linking to `#login` opens it.
- **Reusable on many pages:** create a page in a `/modals/` folder (e.g. `/modals/terms`) and link buttons to it.
- **The first heading** of the content becomes the modal title, in the maroon header. Any heading level looks the same.
- Modals close with the ✕, the Esc key, or a click outside.

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
