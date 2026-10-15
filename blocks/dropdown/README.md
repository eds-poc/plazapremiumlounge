# Dropdown: authoring guide

A "Show me [option ↓]" selector, as the source FAQ page filter: a label, the selected option in
maroon over a thin maroon line with a down arrow, and a white menu of the other options. Each option
is a link. Choosing one opens its link, e.g. the same page with `?faqId=159`, and on that page the
dropdown shows the option as selected.

The dropdown only shows the options and the selection. What the page does with the selection (for
example showing one group of questions) is up to other code, which reads the same address parameter.

## Table: settings, then one row per option

| Dropdown | |
| --- | --- |
| Namespace | faqId |
| Label | Show me |
| [General FAQ](/en-uk/frequently-asked-questions) | |
| [Lounge Reservation](?faqId=158) | |
| [Lounge Usage](?faqId=159) | |
| [Promotional Code](?faqId=2884) | |

- **Namespace:** the address parameter the options set, written exactly as in the links (upper and
  lower case matter), e.g. `faqId`. Other code can read it from the block: `data-namespace="faqId"`.
  Without this row, the first parameter in the option links is used.
- **Label (optional):** the text before the dropdown, e.g. `Show me`.
- **Options:** every other row, in the order they show. Each is a link:
  - **The link text** is the option name, as visitors see it.
  - **The link** sets the parameter, e.g. `?faqId=159` (the same page with that id). It can also be
    a full path such as `/en-uk/frequently-asked-questions?faqId=159`, or another page.
  - **The default option** is the one whose link has no parameter, e.g. the page itself. It's shown
    when the address has no (or an unknown) id. Without one, the first option is the default.
- The option in the address is shown as selected and isn't repeated in the menu, as on the source.
- Rows without a link are skipped. `Namespace` and `Label` are setting names, so don't use them as
  option names.

## For developers

The selection is in the address (`?faqId=159`), so code that reacts to it reads the parameter on
load. The block also keeps `data-namespace` and `data-value` (the selected id, empty for the
default option).

```js
const id = new URLSearchParams(window.location.search).get('faqId'); // e.g. "159", or null
```

## Layout and spacing

24px on mobile, 30px from 768px. The menu is at least 200px wide (as wide as the selected option
when that's wider). The block leaves 50px to the content below, and 25px below the page title (65px
from 992px), as on the source. Put it right after the page Title, in the same section.

Keyboard: Enter, Space or the down arrow opens the menu. The arrow keys, Home and End move through
the options, Enter opens the focused one, and Esc closes the menu. Clicking or tabbing elsewhere
also closes it.
