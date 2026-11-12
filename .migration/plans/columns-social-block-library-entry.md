# Block Library: Columns Variants from PR #94 (Smart Traveller WiFi Landing Pages)

> **Plan mode is on, so I've only read files.** Execution needs **Execute mode**. Writes to DA also need you to ask for them explicitly in your message; earlier, an upload only went through after a message like "Upload the docs/library page to DA". Nothing in the code changes: PR #94 stays as it is.

## What PR #94 introduced

| Variant / behaviour | Where it's used | In the Block Library today? |
|---|---|---|
| **Columns (social)**, the new option: the "Travel Smart, Travel Better" band, mobile first (centred text, photo below on phones and bottom-left from 768px, links and hashtags side by side, Newsletter directly below) | Both WiFi pages, last section | **No** |
| **Gold heading accent** in text-image Columns: italic words in headings show in #ffb54a, upright | "Elevate your Travels with *Smart Traveller*" | **No.** The existing text-image example has a plain heading. |
| Columns (text-image, halves-on-mobile, text-medium, row-spacing) | The Smart Traveller and step rows | Yes, from earlier work. Unchanged by PR #94. |
| Section Metadata (fixed width) | Every landing page section | Yes |

## Existing library conventions this follows

- **Where it goes:** one doc per block. Columns already has `docs/library/blocks/columns` (local copy `content/docs/library/blocks/columns.plain.html`, 5 examples) and a **Columns** row in the `docs/library/blocks` sheet. The new examples go into that doc, so no new sheet row is needed and they appear under **Blocks → Columns** in the DA Library panel.
- **Shape of an example:** a section with an `<h2>` label (not inserted), the block table, any Section Metadata the example needs, then `library-metadata` with **name** and **description**. The description is the authoring guidance shown in the panel.
- **Labels:** examples are named after the block and its options, e.g. `Columns (text-image, halves-on-mobile, text-medium, row-spacing)`.
- **Images:** this doc uses `/media-da/docs/library/blocks/columns/<file>` addresses. The new photo follows the same pattern.
- **Plugin:** the optional block-library plugin can automate this, but you asked earlier not to enable plugins for library work, so this plan follows the manual convention.

## Planned library changes

### 1. New example: **Columns (social)**
- **Label and name:** `Columns (social)`.
- **Table:** one row of two cells, as on the WiFi pages:
  - **Text cell:** `## Travel Smart, Travel Better`, the "Tag us when you travel…" paragraph, `:facebook: Plaza Premium Lounge` (linked to the Facebook page), `:instagram: PlazaPremiumLounge` (linked to Instagram), `#ppgsmarttraveller`, `#travelsmarttravelbetter`.
  - **Photo cell:** the person photo, `/media-da/docs/library/blocks/columns/person-with-smartphone-788x941.png`. Its alt text is empty, because the photo is decorative, as on the source.
- **Section Metadata:** `style | fixed-width`, as on the pages.
- **Description (authoring guidance):** *The Travel Smart band of the landing pages. One row: the text (heading, a paragraph, one line per social link starting with its icon, e.g. :facebook:, one line per hashtag), then the photo. Text centred; on phones the photo below it (250px, 300px from 576px); from 768px the photo at the bottom left and the links and hashtags side by side. Put it last on the page in a fixed-width section: the Newsletter sits directly under it and covers the bottom of the photo (50px, 30px from 768px), so use a photo whose subject stands high enough.*

### 2. Gold accent: update the existing text-image example (recommended), not a separate one
- In the existing **Columns (text-image, halves-on-mobile, text-medium, row-spacing)** example, make "Smart Traveller" in the heading italic, so the example shows the gold accent exactly as the WiFi pages use it.
- Add to its description: *Italic words in a heading show in the landing pages' gold (e.g. "Elevate your Travels with *Smart Traveller*"). A heading 3 is 24px at every width (the source's smaller titles); a heading 2 follows the site's heading scale.*
- The accent is a behaviour of text-image headings, not a new option, so it belongs in that example rather than a separate library item.

### 3. Discovery and indexing
- **The Blocks sheet already lists Columns**, so the new example appears automatically. The sheet stays unchanged, keeping its 44 rows.
- **The Columns README** already documents both the `social` option and the gold accent (in PR #94), so no code or documentation change is needed.

## Things to know
- **Rendering depends on PR #94's CSS.** Until PR #94 is merged, the `social` example only looks right on the `feature-landing-pages--…` preview. On `main--…`, and in DA's own preview of the library, it shows as plain columns. That's expected and fixes itself once PR #94 merges.
- **The `/media-da/` photo must be served by EDS.** Upload it to DA at that path and preview it. Other images in this doc work the same way. I'll check that an existing one, e.g. `web_ST_banner.gif`, is served, to confirm the pattern.

---

## Checklist

> Needs **Execute mode**. Steps 1–5 are local only; steps 6–7 write to DA and need your explicit request; step 8 (Preview) is yours.

### Prepare (local)
- [ ] 1. Read the current DA `docs/library/blocks/columns` and confirm it matches the local copy. If it doesn't, start from the DA version, so no one else's edits are lost, and keep a backup.
- [ ] 2. Check that the existing `/media-da/docs/library/blocks/columns/…` images (e.g. `web_ST_banner.gif`) are in DA and served on the preview, which confirms the image pattern.
- [ ] 3. In the local copy, add the **Columns (social)** example after the text-image examples, with the table, Section Metadata `fixed-width` and the library-metadata above. Copy the person photo from `content/media-da/en-uk/landing-pages/connected-to-wifi/` to `content/media-da/docs/library/blocks/columns/person-with-smartphone-788x941.png`.
- [ ] 4. In the local copy, make "Smart Traveller" italic in the existing text-image row-spacing example's heading, and extend its description, as described above.

### Verify (local, the PR #94 code)
- [ ] 5. Render the updated library doc in the local preview, with the photo pointed at the local copy. At **375px, 768px and 1440px**, check:
  - [ ] the social example: text centred; photo below on phones and bottom-left from 768px; links and hashtags side by side from 768px; 30px icons; no horizontal scrolling;
  - [ ] the text-image example: "Smart Traveller" gold and upright; rows stacked on phones, halves from 576px, 7/5 from 768px;
  - [ ] the library-metadata name and description read correctly, and no other example changed (diff against the backup).

### Publish (DA, only on your explicit request)
- [ ] 6. Upload `person-with-smartphone-788x941.png` to DA at `/media-da/docs/library/blocks/columns/` and confirm the read-back is byte-for-byte the same.
- [ ] 7. Upload the updated `docs/library/blocks/columns` doc and confirm the read-back matches the local copy. Keep the backup of the previous version. The `blocks` sheet needs no change.
- [ ] 8. **You:** preview the photo and `docs/library/blocks/columns` in DA. Then check **Library → Blocks → Columns** shows **Columns (social)** and the updated text-image example.
- [ ] 9. Check the previewed doc on `https://feature-landing-pages--plazapremiumlounge--eds-poc.aem.page/docs/library/blocks/columns` at 375px, 768px and 1440px, against step 5.

### Report
- [ ] 10. Summarise what changed in which place (local, DA, preview) and the backup location. Note that the social example renders fully on `main` once PR #94 is merged. No code changes and no PR changes.
