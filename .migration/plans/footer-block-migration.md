# Lounge List Block Plan (`feature/lounge-list`)

## Goal
Build a **`lounge-list`** block that reproduces the "newest lounges" image grid on https://www.plazapremiumlounge.com/en-uk. On desktop it's 3 columns: two stacked cards, one tall card in the middle, then two stacked cards. Each card has a rounded photo with a white pill label in the top-right corner (Helsinki, Bangkok, Nagoya…).

Requirements:
- **Single DOM** for mobile and desktop. The source renders two separate DOM trees; here one structure is reshaped with CSS, plus JS where needed.
- **Mobile-first CSS** using the design tokens and fonts on `main`.
- **Minimal, DA-friendly authoring.**
- **Authored on** https://da.live/edit#/eds-poc/plazapremiumlounge/drafts/blocks/lounges-list.

> Execution needs **Execute mode**. Nothing has been changed yet.

## Decisions
| Topic | Decision |
|---|---|
| Block name | **`lounge-list`**: folder `blocks/lounge-list/`, DA table header **"Lounge List"**. The DA page path stays `/drafts/blocks/lounges-list` |
| Branch | `feature/lounge-list` from an up-to-date `main` (the footer PR is merged). Preview: `feature-lounge-list--plazapremiumlounge--eds-poc.aem.page/drafts/blocks/lounges-list` |
| Card count | **The pattern repeats every 5 cards** (2 small, 1 tall, 2 small). Leftover cards fill a simple grid, so any count works |
| Breakpoints | Design-system `min-width` queries only: base mobile, then 768px and 1200px if the analysis shows changes there |
| DOM | One structure for all screen sizes (feasibility below) |
| Add-ons | None |

## Feasibility: one DOM for mobile and desktop
**Expected to be feasible.** The analysis step will confirm it before any code is written.

| Concern | How a single DOM handles it |
|---|---|
| Desktop masonry (2 + 1 tall + 2) | CSS Grid on one `<ul>`: 3 columns, 2 rows, with the 3rd card of every 5 spanning both rows (`li:nth-child(5n + 3) { grid-row: span 2 }`). `grid-auto-flow: dense` places the rest, so no JS layout is needed |
| Different mobile layout (stacked, 2-up, or a swipe carousel) | Mobile base CSS. A **swipe carousel** uses CSS scroll-snap (`overflow-x: auto; scroll-snap-type: x mandatory`) on the same `<ul>`. JS is only needed for extras the source has, such as dots or arrows |
| Different image crops on mobile | `object-fit: cover` with a per-breakpoint `aspect-ratio`. If the source uses different photos on mobile, the content model gets an **optional** second image column (see the open point below) |
| Label pill position and size changes | Same element, with sizes and padding changed per breakpoint by tokens (12px/500 uppercase on desktop, 10px on mobile, as in `components.md`) |
| Accessibility | One list in reading order on every screen size. A carousel gets `aria-roledescription`, focusable slides and visible focus |

**Open point, decided by the analysis:** if the mobile tree uses different images or a different card order, I'll add an *optional* "mobile image" cell so authors only fill it when needed. Otherwise the content model stays at 2 cells.

## What we know already (from the design-system capture)
- **Section:** `section.explore` with the H2 "Explore Our Newest Plaza Premium Lounges" (32px desktop, 18px mobile, 35/25px below). It's section default content, not part of the block.
- **Label (`.tag`):**
  - Position: absolute, top/right 15px, `z-index` 10.
  - Style: white background with brand maroon `#530e2a` text, 12px/500 uppercase, 1px letter-spacing, padding `2px 20px`, radius 20px.
  - Mobile: 10px text, padding `5px 20px`.
- **Images:** `object-fit: cover` with rounded corners (about 15–20px, to be measured).
- **Still to measure:** grid gaps, column widths, card heights and aspect ratios, hover state, whether cards link, the mobile DOM and its behaviour (carousel, dots, autoplay), and the 768/1024 layouts.

## Authoring model (DA, minimal)
One block table, **one row per lounge, 2 cells**. The heading above the block is normal text in the section.

```text
## Explore Our Newest Plaza Premium Lounges        ← default content (optional)

| Lounge List                                    |
|------------------------|-----------------------|
| [photo]                | [Helsinki](/en-uk/…)  |   ← image | label (link optional)
| [photo]                | Dallas Fort Worth     |
| [photo]                | Bangkok               |   ← 3rd of every 5 becomes the tall card automatically
| [photo]                | Nagoya                |
| [photo]                | Phnom Penh            |
```

Rules the block follows:
- **Tall cards are automatic.** The tall card's position comes from the 5-card pattern, so there are no variants or options to set.
- **Links are optional.** If the label text is linked, the whole card becomes the link. Without a link, the card isn't clickable.
- **Cells are read defensively.** Missing or swapped cells are handled, and an image without a label is still shown.
- **Alt text** comes from the image; if it's empty, the label is used.

## Approach

### 1. Branch setup
- Fetch `origin`, fast-forward `main` (it includes the merged footer), create `feature/lounge-list`, and check that the tokens, fonts and footer are present.

### 2. Analyse the source, both DOM trees (through the Cloudflare-safe browser)
- **Locate both trees** for the "newest lounges" grid: the desktop one and the mobile one. Record which classes show and hide them at which widths.
- **Measure at 375, 768, 1024, 1280 and 1440px:**
  - container width, column and row gaps
  - card sizes and aspect ratios, including the tall card
  - image radius and `object-fit`
  - label position, typography and padding
- **Interactions,** with real hover and click:
  - hover effect on cards and images (zoom, opacity, shadow)
  - whether cards link and where
  - on mobile: swipe, scroll-snap, dots or arrows, autoplay
- **Compare the two trees' content**: images, order and labels. This decides the optional mobile-image cell.
- **Confirm feasibility**, then write the measured spec into the block notes before coding.

### 3. Content in DA
- Download the 5 lounge photos from the source and upload them to DA, in `/drafts/blocks/.lounges-list/` next to the page.
- Author the `/drafts/blocks/lounges-list` page in DA: the H2 as default content, then the **Lounge List** table with 5 rows. Links go to the lounge pages if the source cards link.
- Preview it. The local server serves the previewed content for testing.
- I'll show you the exact content before saving it to DA, as with the footer.

### 4. Block code
- **`blocks/lounge-list/lounge-list.js`:**
  - Reads the rows defensively and builds one `<ul>` of `<li>` cards (image plus label pill).
  - Wraps the card in the label's link when one is authored.
  - Optimises images with `createOptimizedPicture`: 2 sizes, the tall card with a taller crop, and lazy loading except the first row.
  - Adds carousel controls and accessibility hooks only if the source mobile uses a carousel.
- **`blocks/lounge-list/lounge-list.css`,** mobile-first and scoped to `.lounge-list`:
  - **Base (mobile):** the measured mobile layout (stacked, 2-up, or scroll-snap carousel).
  - **768px+ (and 1200px if needed):** 3-column grid, with `li:nth-child(5n + 3)` spanning 2 rows and measured gaps.
  - Rounded images with `object-fit: cover`, the label pill using tokens, hover effects matching the source, and a visible focus outline.
- **`blocks/lounge-list/README.md`:** short authoring guide (not published).

### 5. Validation
- **Visual parity** at 375, 768, 1024, 1280 and 1440px:
  - card positions and sizes against the measured source (within a few px)
  - label pill style and radius
  - side-by-side screenshots
- **Behaviour:** hover and click on each card, and mobile swipe/scroll-snap or carousel controls, keyboard focus and screen-reader labels.
- **Authoring robustness:**
  - 3, 5, 7 and 10 rows (the pattern repeats, leftovers fill a grid)
  - a missing label
  - a linked versus unlinked label
  - swapped cells
- **Performance:** no layout shift from images (aspect ratios reserved), and only the first-row images load eagerly.
- **Lint:** `npm run lint`.
- **Checkpoint:** side-by-side desktop and mobile screenshots, then I wait for your go-ahead.

### 6. Commit, push and PR (with your OK)
- Commit on `feature/lounge-list`, push, and open a PR into `main`:
  - Before: https://main--plazapremiumlounge--eds-poc.aem.page/drafts/blocks/lounges-list
  - After: https://feature-lounge-list--plazapremiumlounge--eds-poc.aem.page/drafts/blocks/lounges-list
  - Include the authoring summary and the single-DOM approach in the description.

## Checklist
- [ ] Fetch, fast-forward `main`, create `feature/lounge-list`; check tokens, fonts and footer are present
- [ ] Locate the source's desktop and mobile DOM trees; record which classes show them at which widths
- [ ] Measure layout, cards, images and labels at 375 / 768 / 1024 / 1280 / 1440px
- [ ] Test hover and click on every card; test mobile swipe, dots, arrows and autoplay with real input
- [ ] Compare the two trees' content (images, order, labels); decide whether the optional mobile-image cell is needed
- [ ] Confirm single-DOM feasibility and write the measured spec
- [ ] Download the lounge photos and upload them to DA next to the page
- [ ] Show you the DA content, then author `/drafts/blocks/lounges-list` (H2 + Lounge List table) and preview
- [ ] `lounge-list.js`: defensive row parsing, single `<ul>` of cards, optional link wrap, optimised images, carousel hooks only if needed
- [ ] `lounge-list.css`: mobile-first base, 768px (+1200px) grid with the `5n + 3` tall card, tokens, label pill, hover, focus
- [ ] Write `blocks/lounge-list/README.md` authoring guide
- [ ] Visual parity at 5 widths (side-by-side screenshots)
- [ ] Behaviour checks: hover/click, mobile interaction, keyboard and screen reader
- [ ] Authoring robustness: 3/5/7/10 rows, missing label, linked/unlinked, swapped cells
- [ ] Performance (no layout shift, lazy loading) + `npm run lint`
- [ ] **Checkpoint: you review desktop and mobile screenshots and confirm**
- [ ] Commit, push and open the PR with before/after preview links

## Risks and notes
- **Cloudflare:** source analysis runs through the Cloudflare-safe browser, one run at a time.
- **Lounge photos** are downloaded from the source for this migration. Confirm they may be reused.
- **The content may differ from the screenshot:** the live home page currently shows different lounges (for example Langkawi) from your reference image. I'll use whatever the live source shows unless you prefer the lounges in your image.
- **Header:** still the boilerplate one, so previews show the default header.
- **If the analysis finds the mobile version is a different component** (for example a slider with extra content), I'll show you the options before building, rather than duplicating the DOM.
