---
name: html-embed-page-migration
description: Migrate plazapremiumlounge.com pages whose body is authored HTML (Kentico Froala output in `.fr-view`, with its own inline CSS, internal CSS in the head, images, inline and external JS) to EDS. Puts each `.fr-view` as-is, with the CSS and JS that belong to it, into one existing `embed-code` block, moves same-site assets to the DAM, and maps the content outside it (page title, metadata) to existing blocks. Use for "migrate this campaign/offer page", "migrate these .fr-view / HTML snippet pages", or any page list like /en-uk/offers/beyond_the_event.
---

# HTML embed page migration

For pages whose main content is a hand-built HTML snippet pasted into the CMS (`.fr-view`).
The snippet is not re-modelled into blocks: it goes into the **existing `embed-code` block**
as-is. Reference page: `https://www.plazapremiumlounge.com/en-uk/offers/beyond_the_event` →
`content/en-uk/offers/beyond-the-event.plain.html`.

## Rules

- **No new blocks.** The `.fr-view` content goes into `embed-code`; content outside it (title,
  banner images, …) uses existing blocks (`ls blocks/`, e.g. `title`, `image`).
- **One `embed-code` block per `.fr-view`**, holding, in one cell as code:
  1. the `<style>`s that style it, wherever they are on the page (usually the `<head>`),
  2. the `.fr-view` inner HTML **as-is**, inline styles, `<link>`s and `<script>`s inside it included,
  3. the inline `<script>`s outside it that drive it.
  A style or script belongs to the `.fr-view` when it refers to a class or id of its top
  elements (e.g. `.ppg-ppl-bts2026`). Site-wide styles and scripts (bootstrap, jQuery, tag
  managers) are not taken.
- **Assets:** images and files with a root-relative, relative or same-site
  (`www.plazapremiumlounge.com`) address move to the DAM:
  `/media-da/<page path>/<file name in kebab case>`. Other hosts (`img.plazapremiumlounge.com`,
  `uat.…`, CDNs) and all links to pages are kept as they are.
- **Metadata** (title, description, share image) goes in the metadata block, in its own last
  section, or it shows on the page.
- The import only writes the local workspace. Never upload to Document Authoring or
  preview/publish unless the user asks for it in their current message.

## What's in the repo

| File | Role |
| --- | --- |
| `tools/importer/import-html-embed.js` | Import script (template `html-embed`): title → Title (text-lg) + inset section; each `.fr-view` → Embed Code; metadata in the last section. The import report's `assets` lists the DAM moves. |
| `tools/importer/parsers/embed-code.js` | Builds the Embed Code block from a `.fr-view` (styles, HTML, scripts, DAM paths). |
| `blocks/embed-code/` | Renders the pasted HTML in place, moves scripts and styles to the head, and calls the `DOMContentLoaded`/`load` listeners embedded scripts add (they would never fire otherwise). |
| `.claude/skills/html-embed-page-migration/scripts/` | The steps below. |

Scripts below are run from the repo root; `S=.claude/skills/html-embed-page-migration/scripts`
and `CI=<excat-content-import scripts dir>` (e.g.
`/home/node/.excat-marketplaces/excat-marketplace/excat/skills/excat-content-import/scripts`).

## Steps

### 0. Branch

Work on a feature branch cut from an up-to-date `main` (`git fetch origin`,
`git pull --ff-only origin main`, `git checkout -b feature/<name>`). Check `blocks/embed-code/embed-code.js`
still has `runScript` (the `DOMContentLoaded` handling); without it most snippet scripts don't run.

### 1. URL list

Write the source URLs, one per line, to `tools/importer/urls-html-embed.txt` (the pages of this
batch only).

### 2. Snapshots (server HTML, scripts kept)

```bash
node $S/prepare-snapshots.mjs --urls tools/importer/urls-html-embed.txt
```

Fetches each page's **server** HTML (as authored, before the site's scripts change it) and writes
`migration-work/source-snapshots/<host>/<path>.html`, with every `<script>` as an inert
placeholder (the importer drops `<script>`s, so they'd be lost otherwise). The site is behind
Cloudflare: blocked pages are fetched over Bright Data (needs `BD_ENDPOINT`; metered, one page
at a time). The fetched HTML is kept in `migration-work/html-embed/source/` and reused; pass
`--force` to fetch again after the source page changed.

The import reads these snapshots first only because the site is flagged bot-protected
(`.migration/project.json`, `botProtected: true`). If that flag is ever cleared, the importer
fetches pages live and the scripts are lost: don't clear it for this workflow.

### 3. Analyse

```bash
node $S/analyze-snapshots.mjs --urls tools/importer/urls-html-embed.txt --json migration-work/html-embed/analysis.json
```

Per page: the title, each `.fr-view` with the styles and scripts matched to it and its asset
counts, and **content outside `.fr-view` the import script doesn't handle**. Act on it:

- **No `.fr-view`** → not a page for this skill: leave it out of the list (use the regular
  migration).
- **0 styles / 0 inline scripts** where the page clearly has them, or a `.fr-view` whose top
  elements have no class/id → open the snapshot and check how its CSS/JS refer to the markup;
  extend the matching in `parsers/embed-code.js` (`topSelectors` / `refersTo`) if needed.
- **Unhandled content outside `.fr-view`** (e.g. a banner image, an intro paragraph) → map it to
  an **existing** block in `tools/importer/import-html-embed.js`, the way the other offer pages
  do (e.g. a banner as `Image (offer-banner, border-rounded)` before the title, as in
  `content/en-uk/offers/autumn-travel.plain.html`). Keep the code generic (selectors, not page
  checks), and update `PAGE_TEMPLATE` and the `html-embed` entry of
  `tools/importer/page-templates.json` to match. If the analysis flags a site-wide part as
  unhandled, add it to `HANDLED` in `analyze-snapshots.mjs` instead.

Re-run until each page reports only what you expect.

### 4. Bundle and import

```bash
$CI/aem-import-bundle.sh --importjs tools/importer/import-html-embed.js
node $CI/run-bulk-import.js --import-script tools/importer/import-html-embed.bundle.js \
  --urls tools/importer/urls-html-embed.txt --html-dir migration-work/source-snapshots --force
node $CI/add-urls-to-template.js --template html-embed --urls tools/importer/urls-html-embed.txt
```

Re-bundle after every change to the import script or parser. Each log line must say
`importing from snapshot` with the `migration-work/source-snapshots` path. A low "content
completeness" (≈30%) is expected: the snippet's text is inside the block's code.

Check each `content/<path>.plain.html`: one `embed-code` per `.fr-view`, its code starting with
`&lt;style&gt;` and ending with the `&lt;script&gt;`s, no `getContentAsset`/same-site image
addresses left, and the metadata in its own last `<div>`.

### 5. Assets to the DAM

```bash
node $S/download-assets.mjs --urls tools/importer/urls-html-embed.txt
```

Downloads every asset in the import reports' `assets` maps into `content/media-da/<page path>/`.
Any failure must be fixed (the code points at that file).

### 6. Verify in the preview

```bash
node $S/verify-pages.mjs --urls tools/importer/urls-html-embed.txt
```

Opens each page at `http://localhost:3000/content/<path>` and checks the block shows, its CSS and
scripts are in the head and ran (no `[data-anim]` left at opacity 0), images load from the DAM,
no metadata block shows and there are no page errors. Then look at one or two pages in the
browser for the snippet's own interactions (filters, tabs, carousels), e.g. with a quick
`browser_evaluate`. In this local preview, `Style | inset` text and an empty page title also
show on the existing pages: that's the preview, not the migration.

### 7. Report

Per page: the local path, the blocks used, the assets moved, anything left out or not working
(e.g. buttons calling source-site functions such as `AddToCart()`), and that the change is in
the local workspace only (not in Document Authoring, not previewed or published). Re-running the
import overwrites the pages.

## Troubleshooting

- **Script missing from the block** → check the snapshot with the analysis; a commented-out
  `<script>` must stay a comment (handled by `prepare-snapshots.mjs`); scripts with no reference
  to the `.fr-view`'s classes/ids aren't matched.
- **Snippet's script doesn't run** → it probably waits for an event the page already fired; see
  `runScript` in `blocks/embed-code/embed-code.js`.
- **Metadata or `Style` text on the page** → the metadata block must be alone in the last section.
- **Images 404** → re-run step 5; check the report's `assets` map against the code.
