# Pagination (`scripts/pagination.js`)

Reusable pagination for list blocks: page buttons (`«`, numbers with `…` gaps, `»`), the page in the address (`?page=2`), Back/Forward, scrolling back to the list and moving focus.

The look is in `styles/pagination.css`, which the script loads itself. Its class names (`pagination`, `pagination-…`) are global, so don't use **pagination** as a block name.

## Quick start: `createPager` (recommended)

`createPager` handles the paging state. Your block only decides **which items** to page through and **in which order**.

```js
import { createPager, readPageSize } from '../../scripts/pagination.js';

export default async function decorate(block) {
  const items = [...block.querySelectorAll('li')];

  const pager = createPager({
    size: readPageSize(block.dataset.pageSize), // 10 by default
    target: block, // scrolled into view on a page change
  });
  block.append(pager.element);

  await pager.ready; // the CSS is loaded, so nothing shifts
  pager.setItems(items); // shows the page from ?page=, or page 1

  window.addEventListener('popstate', () => pager.sync());
}
```

### Options

| Option | Default | Description |
|---|---|---|
| `size` | `10` | Items per page. |
| `param` | `'page'` | The address parameter. Use another name for a second list on a page, or `null` to keep the page out of the address. |
| `target` | — | Element scrolled into view (below the header) after a page change. |
| `focus` | first visible item | `() => HTMLElement` that gets focus after a page change. |
| `label` | "Pagination" (translated) | `aria-label` of the `<nav>`. Set it when a page has several lists. |
| `onChange` | — | `({ page, pages, items, source }) => void`, called after every render. `source` is `'items'`, `'select'` or `'history'`. |

### Returned API

| Member | Description |
|---|---|
| `element` | The `<nav>` to place in the block. It is hidden while there's only one page. |
| `ready` | A promise that settles when `pagination.css` has loaded (or failed to load). |
| `page` / `pages` | The current page and the page count (read-only). |
| `setItems(items, { reset, push })` | The items to page through, already filtered and in order. With `reset: true`, it goes back to page 1. That replaces the address entry unless you pass `push: true`. |
| `goTo(page, { push })` | Shows a page and pushes it into the address (pass `push: false` to replace the entry instead). |
| `sync({ render })` | Reads the page from the address again, after Back/Forward. Returns `true` if the page changed. With `render: false` it only reads the page; you then call `setItems` yourself. |
| `destroy()` | Removes the buttons. |

### Rules

- Items that are off the current page get `hidden`. **To filter items out, leave them out of `setItems`** and hide them yourself. Don't change `hidden` on the items you pass in, because the pager sets it.
- To change the order, reorder the DOM yourself (e.g. `list.append(...sorted)`) and pass the same order to `setItems`.
- A page past the last (e.g. a shared `?page=99`) shows the last page, and the address is corrected in place.

## Filters and sorting together

When a filter writes its own history entry, use `setPage(url, 1)` to remove the page in **that same** entry. Then call `setItems(..., { reset: true })`, which replaces the entry rather than adding one, so Back takes one step. `blocks/offer-list/offer-list.js` follows this pattern:

```js
const update = (reset = false) => {
  const shown = filterAndSort(); // your logic
  allItems.forEach((item) => { if (!shown.includes(item)) item.hidden = true; });
  list.append(...shown);
  pager.setItems(shown, { reset });
};

onFilterChange(() => {
  const url = setPage(new URL(window.location.href), 1);
  url.searchParams.set('category', selection.category);
  window.history.pushState(window.history.state, '', url);
  update(true);
});

window.addEventListener('popstate', () => {
  if (selectionUnchanged()) { pager.sync(); return; }
  readSelectionFromUrl();
  pager.sync({ render: false }); // read the page, then render with the new items
  update();
});
```

## Two lists on one page

Give each list its own address parameter, or none, and its own label:

```js
createPager({ param: 'offers-page', label: 'Offers pages', target: offersBlock });
createPager({ param: null, label: 'Lounges pages', target: loungesBlock });
```

## Lower-level helpers

Use these when you need custom behaviour, such as items fetched page by page:

| Export | Description |
|---|---|
| `createPagination({ onSelect, target, focus, label })` | Only the buttons. Returns `{ element, show(page, pages), ready }`. `onSelect(page)` must call `show` again; you handle the address and the items yourself. |
| `readPageSize(text, fallback)` | An authored page size, or the fallback. |
| `pageCount(count, size)` | The number of pages (at least 1). |
| `readPage(param)` | The page in the address (at least 1). |
| `setPage(url, page, param)` | Sets the page on a `URL` object. Page 1 removes it. |
| `writePage(page, { replace, param })` | Pushes the page into the address, or replaces the current entry. |
| `pageNumbers(page, pages)` | The numbers to show, with `null` for a `…` gap. |

## Accessibility

- The buttons sit in a `<nav>` landmark, and the current page has `aria-current="page"`.
- "Page 2 of 13" is announced in a polite live region.
- After a page change, focus moves to `focus()` (or `target`) without scrolling. Elements that can't normally take focus get `tabindex="-1"` and the `pagination-focus` class, so no focus ring shows.
- Scrolling respects `prefers-reduced-motion`.

## Translations

These keys are in `scripts/i18n.js`: `paginationLabel`, `paginationPage` (`{n}`), `paginationPrevious`, `paginationNext`, `paginationStatus` (`{n}`, `{total}`).
