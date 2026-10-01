# Plaza Premium Lounge: Design-System Cleanup & Extraction Plan

## Goal
Get the repo ready for the new Plaza Premium Lounge site (https://www.plazapremiumlounge.com/en-uk) in two steps:
1. **Clean up** the boilerplate design system in the global styles and bring them down to a neutral baseline.
2. **Extract** the new site's design system by following the attached *Website Base Design System Extraction* prompt. All CSS variables go into `styles/styles.css`. All documents go into a `design-system/` folder.

This phase is **extract only**. The tokens are declared, but no element, button or block is restyled with them yet. That happens in a later "apply" phase.

> You're in plan mode, so none of this has run yet. Switch to Execute mode to start.

## Decisions (from your answers)
| Topic | Decision |
|---|---|
| Cleanup depth | Reset the global styles only. Block JS and structural block CSS stay. Only the boilerplate colors and fonts are removed. |
| Apply tokens now? | No. Extract only. |
| Token location | All CSS variables go in the `:root` of `styles/styles.css`. This replaces the prompt's separate `design-tokens.css`. |
| Docs location | A `design-system/` folder with the markdown docs and `design-tokens.json`. |
| Add-ons | Turn on **Forms** and **Commerce**. |
| Serving | I'll add `design-system/` to `.hlxignore`. Markdown is already ignored, but `design-tokens.json` would otherwise be publicly served. |
| Branch | Work on a new branch, `design-system-foundation`, not `main`. I'll only commit or open a PR if you ask. Any PR will include the `{branch}--plazapremiumlounge--eds-poc.aem.page/{path}` preview link. |

## Current state (what gets cleaned up)
- **`styles/styles.css`**
  - Boilerplate tokens: `--background-color`, `--light-color`, `--dark-color`, `--text-color`, `--link-color`, `--link-hover-color`.
  - Roboto font families and their fallback `@font-face` rules.
  - Body and heading size scales at 900px.
  - Heading styling and link colors.
  - Primary, secondary and accent button colors.
  - `.light`/`.highlight` section styles.
- **`styles/fonts.css`**: four Roboto `@font-face` rules. **`fonts/`**: four Roboto `.woff2` files.
- **Blocks that use the boilerplate variables:**
  - `header.css`: `--background-color`, `--light-color`, `--body-font-family`, `--heading-font-size-s`, `--body-font-size-s`, `--nav-height`
  - `footer.css`: `--light-color`, `--body-font-size-xs`
  - `cards.css`: `--background-color`, plus a hard-coded `#dadada`
  - `hero.css`: `--background-color`

  These blocks need to keep working after the reset.
- **Keep as is:**
  - `scripts/aem.js` (vendored, never edited)
  - Block JS
  - The `body.appear` loading pattern
  - Header and footer visibility rules
  - Section and container structure
  - `.icon` sizing
  - The `decorateButtons` class hooks in `scripts/scripts.js`

## Approach

### Phase 0: Turn on the add-ons
- Create `.agents/settings.json` with `excat-forms@excat-extended` and `excat-commerce@excat-extended` turned on. They become available on the next message.

### Phase 1: Clean up the global design system
1. Create the branch `design-system-foundation`.
2. Reset `styles/styles.css` to a neutral baseline:
   - Remove the boilerplate color, font and size tokens, and the Roboto fallback `@font-face` rules.
   - Keep a small, neutral set of **baseline structural variables** that the existing blocks need, so nothing breaks. Examples: `--nav-height`, plus neutral background, surface and text values using plain white, grey and black.
   - Swap the heading and body font stacks for a neutral system font stack.
   - Remove the brand button colors and `.light`/`.highlight` colors. Keep the structural `.button` layout (display, padding, sizing, disabled cursor) and the button class names.
   - Keep the section and container layout, `body.appear`, header and footer visibility, the image and icon rules, and the form-element `font: inherit`.
3. Point the block variables (header, footer, cards, hero) at the new baseline variable names wherever a name changed. Swap the hard-coded `#dadada` in cards for a baseline border variable. No visual restyling.
4. Empty `styles/fonts.css` but keep the file, since `scripts.js` loads it. Delete the Roboto `.woff2` files from `fonts/`.
5. Check the reset:
   - Run `npm run lint` for stylelint and eslint.
   - In the local preview, confirm the page shows, and that the header and footer load and become visible.
   - Confirm no block refers to a variable that is no longer defined.

### Phase 2: Discovery on the source site
6. **Page inventory** (prompt §1): use URL discovery from the sitemap and navigation for `/en-uk`. Pick representative pages:
   - Homepage
   - Lounge listing and search
   - Lounge detail
   - Airport or location page
   - Membership and offers landing pages
   - Booking and enquiry forms
   - Content and article pages
   - Login, if it is public

   Put the results in a table with columns Page / URL / Page Type / UI Patterns.
7. **Source-code inspection** (§21, §22): pull the site's stylesheets and look for:
   - CSS custom properties
   - Framework signatures
   - `@font-face` sources
   - Breakpoints from media queries
   - Icon delivery (SVG sprite, icon font or inline)

   Only record a technology when there is evidence for it.

### Phase 3: Extract the design system
8. On each inventory page, read the computed styles at **320, 375, 768, 1024, 1280, 1440 and 1920px**. Use text inspection and JS evaluation. Screenshots are only for a final visual check.
9. Extract, with the evidence and a confidence level (High, Medium or Low) for each value, and label each as Measured, Calculated, Inferred or Estimated:
   - Colors, grouped by meaning: brand, background, text, border and state, plus interaction states (§2)
   - Typography: families and sources, the H1–H6, body and UI scales, and responsive behavior (§3)
   - The spacing scale, inferred from repeated values (§4)
   - Containers and grid (§5)
   - Real breakpoints and what changes at each one (§6)
   - Component specs: header, navigation (desktop and mobile), footer, buttons, links, cards, hero, forms, inputs, tabs, accordions, breadcrumbs, pagination, modals, badges, search and filters, CTA, image and video (§7, §13, §14)
   - Radius, shadows and elevation (§8, §9)
   - Iconography (§10), the image system (§11) and motion (§12)
   - Accessibility, split into Observed, Likely and Not verified. No compliance claims (§15)
   - Page-level templates (§18), visual measurements (§19) and an asset inventory (§20). Assets are only listed, not downloaded.
10. Only create a token for a value that repeats across pages. One-off or content-specific values get documented, not tokenised.

### Phase 4: Deliverables
11. Add the full extracted token set to the `:root` of **`styles/styles.css`**, grouped by colors, typography, spacing, radius, shadows, layout and motion, with the prompt's naming such as `--color-primary`, `--font-size-md` and `--spacing-lg`. Keep it separate from the baseline structural variables. Brand tokens are declared but not used yet.
12. Create **`design-system/`**:
    ```text
    design-system/
    ├── README.md               (overview, and a note that the CSS tokens live in styles/styles.css)
    ├── design-tokens.json      (machine-readable, same values as the :root in styles.css)
    ├── colors.md
    ├── typography.md
    ├── spacing.md
    ├── layout.md
    ├── responsive.md
    ├── components.md
    ├── accessibility.md
    ├── motion.md
    ├── assets.md
    ├── pages.md
    └── implementation-guide.md (how to apply the tokens in EDS: global styles vs block-scoped CSS, loading fonts in fonts.css, section styles)
    ```
13. Add `design-system/` to `.hlxignore`.
14. Final check:
    - `npm run lint` passes.
    - The JSON tokens match the `:root` tokens in `styles.css`.
    - The preview still renders the neutral baseline unchanged, since the tokens aren't used yet.
    - The final summary (§24) is included in `README.md`.

## Checklist
- [ ] Turn on the Forms and Commerce add-ons in `.agents/settings.json`
- [ ] Create the branch `design-system-foundation`
- [ ] Reset the `styles/styles.css` tokens, fonts, heading, link, button and section colors to a neutral baseline
- [ ] Keep the structural styles (appear, header and footer visibility, sections, `.button` layout, images, icons)
- [ ] Point the header, footer, cards and hero block CSS at the baseline variables, with no visual restyle
- [ ] Empty `styles/fonts.css` and delete the Roboto `.woff2` files
- [ ] Lint, and check in the preview that the baseline renders with no undefined variables
- [ ] Build the source-site page inventory from the sitemap and navigation
- [ ] Inspect the source CSS for variables, fonts, breakpoints, icons and frameworks
- [ ] Measure computed styles on the inventory pages at 7 viewports
- [ ] Extract colors, typography, spacing, layout, breakpoints, radius, shadows, motion, icons and images, with evidence and confidence for each
- [ ] Document the component specs, including interaction states and responsive behavior
- [ ] Document accessibility, page templates, measurements and assets
- [ ] Add the extracted tokens to the `:root` of `styles/styles.css`
- [ ] Write `design-system/` (README, design-tokens.json and the 12 markdown docs)
- [ ] Add `design-system/` to `.hlxignore`
- [ ] Final lint, check that the JSON matches the CSS tokens, and confirm the preview is unchanged
- [ ] Summarise the results. Commit or open a PR (with the aem.page preview link) only if you ask

## Out of scope for this phase
- Restyling elements or blocks with the new tokens.
- Self-hosting the brand fonts. The font sources and licensing are documented and left for the apply phase.
- Creating new blocks, importing content, and migrating the header or footer.
