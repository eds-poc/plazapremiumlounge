# Dropdown: authoring guide

A "Show me [option ↓]" selector, as the source FAQ page filter: a label, the selected option in
maroon over a thin maroon line with a down arrow, and a white menu of the other options. The
selection is kept in the page address, e.g. `?faqId=159`, so a chosen option can be shared,
bookmarked and reached with the browser's Back and Forward buttons.

If an option names a section on the page, the dropdown shows only that section. Use this to switch
between FAQ categories.

## Table: settings, then one row per option, 2 columns

| Dropdown | |
| --- | --- |
| Namespace | faqId |
| Label | Show me |
| General FAQ | |
| Lounge Reservation | 158 |
| Lounge Usage | 159 |
| Promotional Code | 2884 |

- **Namespace:** the name of the address parameter, e.g. `faqId` gives `?faqId=159`. Write it exactly
  as it should appear in the address (upper and lower case matter). Other code uses it too: the
  block has `data-namespace="faqId"`.
- **Label (optional):** the text before the dropdown, e.g. `Show me`.
- **Options:** every other row, in the order they show.
  - **Column 1:** the option name, as visitors see it.
  - **Column 2:** its id, the value in the address, e.g. `159`. Without an id, one is made from the
    name (`General FAQ` → `general-faq`).
- **The first option is the default.** It's selected when the address has no (or an unknown) id,
  and choosing it removes the parameter from the address, as on the source.
- The selected option isn't repeated in the menu, as on the source.
- `Namespace` and `Label` are setting names, so don't use them as option names.

## Showing one section at a time

Give each section the dropdown should switch between Section Metadata `Name` = the option name (or
its id). When at least one option matches a section:

- only the selected option's section shows, and the others are hidden;
- if a section starts with a heading block that just repeats the option name (e.g. a `Title`
  "General FAQ"), that heading is hidden while the dropdown is in use, because the dropdown shows it.

Sections that no option names always show. Without JavaScript, every section shows.

Example, the FAQ page: the page Title and the Dropdown in the first section, then one section per
category (`Name` = `General FAQ`, `Lounge Reservation`, …), each with a `Title` and an `Accordion`.

## For developers

Choosing an option (and the selection on load, or after Back/Forward) fires `dropdown:change` on the
block (it bubbles), with `detail` = `{ namespace, id, name, initial }`. `initial` is `true` for the
selection on load and after Back/Forward. The block also keeps `data-namespace` and `data-value`
(the selected id) up to date.

```js
document.addEventListener('dropdown:change', ({ detail }) => {
  if (detail.namespace === 'faqId') { /* detail.id, e.g. "159" */ }
});
```

## Layout and spacing

24px on mobile, 30px from 768px. The menu is at least 200px wide (as wide as the selected option
when that's wider). The block leaves 50px to the content below, and 25px below the page title (65px
from 992px), as on the source. Put it right after the page Title, in the same section.

Keyboard: Enter, Space or the down arrow opens the menu. The arrow keys, Home and End move through
the options, and Esc closes it. Clicking or tabbing elsewhere also closes it.
