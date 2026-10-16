# Dropdown: authoring guide

A "Show me [option ↓]" selector, as the source FAQ page filter, with its options written on the
page. Choosing an option sets it in the page address, e.g. `?faqId=159`, without reloading, and
shows only the sections of that option (e.g. one group of questions per FAQ category). The
address can be shared and bookmarked, and the browser's Back and Forward buttons work.

## Table: 3 rows, 2 columns

| Dropdown | |
| --- | --- |
| Label | Show me |
| Namespace | faqId |
| Options | - General FAQ<br>- Lounge Reservation \| 158<br>- Lounge Usage \| 159<br>- Airport Dining \| 2881 |

- **Label (optional):** the text before the dropdown, e.g. `Show me`.
- **Namespace:** the address parameter the options set, exactly as it should appear in the address
  (upper and lower case matter): `faqId` gives `?faqId=159`. Other code can read it from the block:
  `data-namespace="faqId"`.
- **Options:** a bulleted list, one option per item, in the order they show (separate paragraphs or
  lines also work):
  - `Name | id`, e.g. `Airport Dining | 2881`: the name visitors see, a `|`, and the id that goes in
    the address.
  - `Name` alone (no id) is **the default option**, e.g. `General FAQ`: it's shown when the address
    has no (or an unknown) id, and choosing it removes the parameter. Without one, the first option
    is the default.
  - A **link** instead (e.g. to another page) makes that option a link that opens it. A link that
    has the parameter (e.g. `…?faqId=159`) counts as that id.
- The selected option isn't repeated in the menu, as on the source.

## Showing one section per option

Give each section that belongs to an option a Section Metadata row `Section Id`, with the option's id:

| Section Metadata | |
| --- | --- |
| Section Id | 159 |

- Only the section(s) of the selected option show; the other sections with one of the dropdown's
  ids are hidden. The **default option** shows the section with `Section Id` = `default`.
- Sections without a `Section Id` (e.g. the page title, the help cards) always show. A `Section Id`
  that's none of the options' ids also always shows, and the browser console warns about it, so a
  typo is easy to spot.
- Use `Section Id`, not `Id`: an `Id` row becomes the section's HTML id, which loses numbers like
  `159`.
- The dropdown already shows the option name, so the sections don't need their own heading.

Example, the FAQ page: the page Title and the Dropdown in the first section, then one section per
category (`Section Id` = `default`, `158`, `159`, …) with its Accordion, then the help cards.

## Layout and spacing

24px on mobile, 30px from 768px. The menu is at least 200px wide (as wide as the selected option
when that's wider). 50px to the content below, and 25px below the page title (65px from 992px), as
on the source. Put it right after the page Title, in the same section.

Keyboard: Enter, Space or the down arrow opens the menu. The arrow keys, Home and End move through
the options, Enter chooses the focused one, and Esc closes the menu. Clicking or tabbing elsewhere
also closes it.

## For developers

- Everything is in this block (`dropdown.js`, `dropdown.css`): reading the table, the rendering,
  the address and the Section Id switching. The options become rows `{ name, id, link }`
  (`normalizeOptions`) before rendering, so options from another source (e.g. a JSON sheet or an
  API, read in `decorate`) could be added there later without changing the rest.
- The selection is in the address: read `?faqId=` on load. The block also keeps `data-namespace` and
  `data-value` (the selected id, empty for the default).
- When the selection changes without a reload (an option without a link, or Back/Forward), the block
  fires `dropdown:change` (it bubbles) with `detail` = `{ namespace, id, name }`.
- Links in the options are checked: only `http(s)`, `mailto:` and `tel:` links (and paths on this
  site) are used; others (e.g. `javascript:`) are skipped with a console warning.
