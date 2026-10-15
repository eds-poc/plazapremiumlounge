# Dropdown widget: authoring guide

A "Show me [option ↓]" selector, as the source FAQ page filter, with its options kept in a separate
list (a DA sheet now, an API later) instead of on the page. It looks like the Dropdown block.
Choosing an option sets it in the page address, e.g. `?faqId=159`, without reloading the page; an
option with its own link (e.g. another page) opens that link instead.

It can also switch sections: a section with a Section Metadata `Section Id` shows only while its
option is selected (see below), e.g. one group of questions per FAQ category.

## On the page: one link

Add a link (on its own line) to the widget, with its settings after the `?`:

```
/widgets/dropdown/dropdown.html?namespace=faqId&label=Show me&options=/en-uk/faq/categories.json
```

| Setting | Meaning |
| --- | --- |
| `namespace` | The address parameter the options set, exactly as in the address, e.g. `faqId` gives `?faqId=159`. Needed when the sheet uses ids; when every option has a full link, it can be left out and the first parameter in the links is used. |
| `label` (optional) | The text before the dropdown, e.g. `Show me`. |
| `options` | Where the options come from: a DA sheet (its path with `.json`), or later an API address. |

The link text doesn't show; anything works, e.g. "FAQ categories".

## The options: a DA sheet

One row per option, in the order they show:

| name | id | link |
| --- | --- | --- |
| General FAQ | | |
| Lounge Reservation | 158 | |
| Lounge Usage | 159 | |
| Lounge Pass | | /en-uk/airport-lounge-passes |

- **name:** the option as visitors see it.
- **id:** the value in the address. Choosing the option sets `?faqId=<id>` on the current page,
  without reloading it (the option is a button, not a link).
- **link (optional):** only for an option that should open a page, e.g. another page. The option
  is then a link and opens it. A link that has the parameter (e.g. `…?faqId=159`) counts as that id.
- **The default option** has no id (and no link with the parameter). It's shown when the address has
  no (or an unknown) id, and choosing it removes the parameter. Without one, the first option is the
  default.
- The option in the address is shown as selected and isn't repeated in the menu, as on the source.
- Use one sheet per language for translated names; the ids stay the same.

Preview the sheet after every change, so the page gets the new list.

## Showing one section per option

Give each section that belongs to an option a Section Metadata row `Section Id`, with the option's id:

| Section Metadata | |
| --- | --- |
| Section Id | 159 |

- Only the section(s) with the selected option's id show; every other section with a `Section Id`
  is hidden. Sections without a `Section Id` (e.g. the page title, the help cards) always show.
- **The default option** (no id in the sheet) shows the section with `Section Id` = `default`.
- On load the section follows the address (`?faqId=159`); choosing another option switches it
  without reloading, and Back/Forward switch it back.
- Use `Section Id`, not `Id`: an `Id` row becomes the section's HTML id, which loses numbers like
  `159`.
- The dropdown already shows the option name, so the sections don't need their own heading.

## For developers

- The selection is in the address (`?faqId=159`): read it on load. The widget also keeps
  `data-namespace` and `data-value` (the selected id, empty for the default) on its element.
- When the selection changes without a reload (choosing an option without a link, or Back/Forward),
  the widget fires `dropdown:change` (it bubbles) with `detail` = `{ namespace, id, name }` (`id`
  empty for the default):

  ```js
  document.addEventListener('dropdown:change', ({ detail }) => {
    if (detail.namespace === 'faqId') { /* detail.id, e.g. "159" */ }
  });
  ```
- **Options from an API:** `options` can be any JSON address the browser can fetch (same origin, or
  with CORS). It reads a sheet (`{ data: [...] }`), a multi-sheet workbook (its first sheet) or a
  plain array of rows, with columns `name`/`label`/`title`, `id`/`value` and `link`/`url`/`href`.
  For another shape, add an adapter to `ADAPTERS` in `dropdown.js`.
- Without options (or when the list can't load) the widget stays hidden, and the console says why.

## Layout and spacing

The same as the Dropdown block: 24px on mobile, 30px from 768px; the menu at least 200px wide; 50px
to the content below, 25px below the page title (65px from 992px). Put the link right after the page
Title, in the same section.

Keyboard: Enter, Space or the down arrow opens the menu. The arrow keys, Home and End move through
the options, Enter chooses the focused one, and Esc closes the menu. Clicking or tabbing elsewhere
also closes it.
