# Embed Code: authoring guide

Adds third-party code to a page: **scripts** and **styles** go into the page's `<head>`, and **HTML** (including iframes) shows where the block is placed. Any HTML tag is supported, with nested markup and attributes preserved. Use it for tracking tags, chat widgets, booking forms, maps, videos and small CSS fixes.

> Code in this block runs for every visitor of the page. Only paste code from a source you trust, and test the page in preview before publishing.

## Table: one row per item

| Embed Code |  |  |  |
| --- | --- | --- | --- |
| Script | https://example.com/widget.js |  |  |
| Script | `window.dataLayer = window.dataLayer \|\| [];` |  |  |
| Style | https://example.com/theme.css |  |  |
| Style | `.promo-banner { color: #8a6d3b; }` |  |  |
| Iframe | https://example.com/booking | Booking form | 600 |
| HTML | `<div class="widget"><p>Welcome</p></div>` |  |  |

- **Cell 1:** what the row is: `Script`, `Style`, `Iframe` or `HTML` (any capitalisation).
- **Cell 2:** a file or page address, or the code itself.
- **Cells 3 and 4 (iframes only, optional):** a title and a height.
- **Rows run in order**, top to bottom. Empty rows are skipped.

## Scripts

| Cell 2 | What happens |
| --- | --- |
| A script address (`https://…/file.js`) | The file is loaded into the page's `<head>` |
| JavaScript code | The code runs from the page's `<head>` |

- **Order is kept.** A script file finishes loading before the next script row runs, so code that uses a library can go in the row after it:

  | Embed Code |  |
  | --- | --- |
  | Script | https://cdn.example.com/library.js |
  | Script | `Library.init({ id: 'abc' });` |

- **The page doesn't wait for scripts.** Content shows straight away; a slow third-party file only delays the rows after it.
- **Each script file loads only once**, even if several blocks or fragments on the page use it.
- **Code written to run on page load still runs.** The page has loaded by the time the block runs, so `DOMContentLoaded` (and `load`) listeners that script code adds are called straight after the code.

## Styles

| Cell 2 | What happens |
| --- | --- |
| A stylesheet address (`https://…/file.css`) | The stylesheet is linked in the page's `<head>` |
| CSS code | The CSS is added in a `<style>` in the page's `<head>` |

- **Styles are added first**, before the block's iframes show and before its scripts run.
- **Styles apply to the whole page**, not just this block. A broad rule such as `p { … }` changes every paragraph on the page, so prefer specific class names.
- **Each stylesheet file is linked only once**, even if several blocks use it.

## Iframes

| Cell | Content |
| --- | --- |
| 2 | The page address to show: `https://…`, or a page on this site (`/en-uk/…`) |
| 3 (optional) | A title describing the content, read out by screen readers, e.g. `Lounge location map`. Without one, the title is "Embedded content". |
| 4 (optional) | A height: a number in pixels (`600`) or any CSS size (`80vh`) |

- Iframes fill the width of their column.
- **Without a height** they keep a 16:9 video shape.
- They load only when scrolled near, so they don't slow down the top of the page.
- Several iframes in one block are stacked with a gap between them.

## Pasting embed code from a provider

Most providers (YouTube, Google Maps, chat and booking tools, tag managers) give you a snippet to copy. Paste it as-is into a **single cell**; no label is needed:

| Embed Code |
| --- |
| `<iframe src="https://www.youtube.com/embed/VIDEO_ID" width="560" height="315" allowfullscreen></iframe>` |
| `<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>` |
| `<style>.chat-launcher { bottom: 80px; }</style>` |
| `<link rel="stylesheet" href="https://example.com/widget.css">` |

- A cell can hold several tags at once, e.g. a `<script>` file followed by a `<script>` with its setup code. They run in the order they are written.
- **Kept:** the snippet's settings, such as `async`, `type`, `id`, `data-…` attributes, `media` on styles, and `allow`, `allowfullscreen`, `title` on iframes.
- **HTML is preserved:** any tag, nested content, inline event handlers and `<noscript>` content are kept. Only use trusted code.
- **Iframe size:** a `width` and `height` in the snippet (e.g. `560` × `315`) become the iframe's shape, so it still fills the column at that proportion.
- **Scripts marked `async`** don't hold up the rows after them.

## Without a label

A row with just one cell is read from its content. (In a row with more cells, the first cell must be `Script`, `Style`, `Iframe` or `HTML`; otherwise the first cell is read as the content.)

| Content | Treated as |
| --- | --- |
| Pasted HTML code | HTML in the block, with scripts and styles loaded into the head |
| An address ending in `.js` | Script file |
| An address ending in `.css` | Stylesheet |
| Any other address | Iframe |
| Anything else | JavaScript code |

When in doubt, add the label. In particular, a plain line of **CSS needs the `Style` label**, otherwise it is run as JavaScript.

## Writing code in a cell

- **Code over several lines:** use a code block, or press Enter between lines. Line breaks are kept, so `//` comments work.
- **Addresses** can be typed, pasted or added as a link.
- **Check the quotes:** if the editor turns straight quotes (`"`) into curly ones (`“ ”`), the code breaks. Paste code rather than typing it.

## Where to put the block

- **Anywhere on the page.** A block with only scripts and styles takes up no space; put it at the end of the page so it doesn't affect the layout.
- **HTML and iframes show where the block is**, so place the block where the content should appear.
- **On many pages:** put the block in a fragment and add that fragment to each page.
- Code runs when the block's section loads. Blocks near the top load first, and blocks further down load shortly after the page appears.

## What won't work

- **Scripts that use `document.write`** (some older ad and tracking tags). Ask the provider for an asynchronous version of the tag.
- **Iframes with `http://` addresses**: the site only allows secure (`https://`) iframes.
- **`srcdoc` iframes**: the site's security settings remove them. Host the content on a page and use its address instead.
- **Code that must run before the page first appears** (e.g. A/B test anti-flicker snippets). This block runs as the page loads, so that kind of code needs to go into the site code instead.
