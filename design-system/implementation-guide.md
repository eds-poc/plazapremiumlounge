# Implementation Guide (Edge Delivery Services)

This guide is for a developer or AI coding agent building the new Plaza Premium Lounge site in this repository. The tokens are already declared. Your job is to **consume** them.

## 1. Where things live

| What | Where |
| --- | --- |
| Design tokens (CSS custom properties) | `styles/styles.css` → `:root` (after the baseline block), plus the `/* design token overrides (mobile-first …) */` `min-width` media queries |
| Machine-readable tokens | `design-system/design-tokens.json` (same values, plus usage/evidence/confidence) |
| Brand fonts | `styles/fonts.css` (`@font-face` rules, loaded by `scripts/scripts.js` → `loadFonts()`) and the files in `styles/fonts/`. The size-adjusted `polysans-fallback` face is in `styles/styles.css` |
| Global element styles | `styles/styles.css` (body, headings, links, buttons, sections) |
| Below-the-fold global CSS | `styles/lazy-styles.css` |
| Component styles | `blocks/{name}/{name}.css`, scoped to `.{name}` |
| Icons | `icons/*.svg`, referenced as `:icon-name:` in content |

**Current state:** steps 1–6 below are done in `styles/styles.css`: body, headings, links and focus, the three button variants plus disabled, sections, and the `grey` / `maroon` / `wide` section styles. Still open:
- **Step 7 (header height):** deferred to the header block migration. `--nav-height` is still 64px so the boilerplate header keeps its layout.
- **Blocks:** header, footer, cards, hero and columns still use the neutral `--base-*` variables. Replace those with brand tokens as each block is restyled, then delete the `--base-*` variables.

Two deliberate differences from the source, for accessibility:
- Link hover **underlines** instead of turning `#999`.
- A visible `:focus-visible` outline is kept: 2px brand maroon, white inside maroon sections.

## 2. Applying the tokens (the next phase)

1. **Fonts** (done).
   - `styles/fonts.css` declares these faces, all with `font-display: swap`:
     - `polysans`: Slim 300, Neutral 400, Median 500, Bulky 800 (the site's own weight mapping)
     - `recklessneue`: 400
     - `montserrat`: variable 100–900, upright and italic (SIL OFL)
   - `styles.css` declares a `polysans-fallback` face (Arial, `size-adjust: 102.84%`, `ascent-override: 106.97%`, `descent-override: 26.26%`) to limit layout shift during the swap. These values were computed from PolySans Neutral as rendered and Arial's standard advance widths.
   - `--font-family-primary` is `polysans, polysans-fallback, sans-serif`, and `--font-family-display` is `recklessneue, serif`.
2. **Body and text.** `body { font-family: var(--font-family-primary); font-size: var(--body-font-size); line-height: var(--line-height-body); color: var(--color-text); }`
3. **Headings.**
   - `h1 { font-size: var(--heading-page-size); }`
   - `h2 { font-size: var(--heading-section-size); margin-bottom: var(--section-title-gap); }`
   - `h3 { font-size: var(--font-size-2xl); }`
   - All headings: `font-weight: var(--font-weight-medium); line-height: var(--line-height-heading);`
4. **Links.** `color: var(--color-link); font-weight: var(--font-weight-medium); transition: color var(--duration-normal) var(--ease-standard);`. For hover, prefer an underline over `--color-link-hover` (#999 has low contrast, see accessibility.md). Underline links in body copy.
5. **Buttons.** Map EDS button classes (from `decorateButtons` in `scripts/scripts.js`) onto the source variants:
   | EDS authoring | Class | Source variant |
   | --- | --- | --- |
   | **bold link** | `.button.primary` | `.btn-primary`: bg `--color-brand-primary-action`, `#fff`, radius `--radius-xl`, padding `var(--spacing-2) var(--spacing-7)`, 14px. Hover: bg `#fff`, text and border `--color-brand-primary` |
   | *italic link* | `.button.secondary` | `.btn-primary.outline`: transparent, `--color-border-strong`. Hover: filled maroon |
   | ***bold italic*** | `.button.accent` | `.btn-secondary`: bg `--color-brand-tint`, text brand. Hover: filled maroon |

   Use `transition: all var(--duration-medium) var(--ease-standard)`. Disabled: `--color-disabled-bg` / `--color-disabled-text`. **Keep a visible `:focus-visible` outline.**
6. **Sections.**
   - `main > .section { padding-block: var(--section-padding-block); margin: 0; }`
   - `main > .section > div { max-width: var(--container-max-width); padding-inline: var(--container-padding); }`
   - Add section-metadata styles: `.section.grey` → `--color-surface-warm`, `.section.maroon` → `--color-brand-primary` with `--color-text-inverse`, `.section.wide > div` → `--container-wide-max-width` / `--container-wide-padding`.
7. **Header height.** Set `--nav-height` to `var(--nav-height-mobile)` below 1200px and `var(--nav-height-desktop)` at 1200px and up, so the reserved `header { height }` matches.

## 3. Breakpoints (mobile-first)
All styles are **mobile-first**. The base rules and the `:root` token values describe the mobile layout (<768px). Larger screens are layered on with `min-width` queries (`(width >= …)`) in ascending order. Don't write `max-width` or `width <` queries. Most responsive changes should come for free from the tokens, which already switch at 768, 992 and 1200px, so reach for a block-level media query only when the layout itself changes.

CSS custom properties can't be used inside media queries, so use literal values that match the source:

| Name | Query | Use for |
| --- | --- | --- |
| md | `(width >= 768px)` | Typography step-up, 2-column grids, desktop hero |
| lg | `(width >= 992px)` | Section padding 50px, H2 margin 35px |
| xl | `(width >= 1200px)` | **Desktop navigation**, H2 32px fixed, H4 24px |
| xxl | `(width >= 1400px)` | Container cap reached |

The EDS boilerplate uses 900px. Don't use it for PPL layout decisions. The existing `@media (width >= 900px)` rules in `styles.css` and the blocks are baseline leftovers. Move them to 768/1200 as you restyle.

## 4. Block mapping (suggested)

| Source component | EDS block | Notes |
| --- | --- | --- |
| Desktop/mobile header + mega menu | `header` (nav fragment) | Transparent over the hero on home, solid maroon on scroll (add the class on scroll in `header.js`). 1200px switch. 122px mobile stack including the promo strip |
| Footer | `footer` (footer fragment) | `#1b1b1b`, 4 columns, brand family grid |
| Hero carousel + booking bar | `hero` / `carousel` variant | Booking bar is an app integration. Plan a widget |
| Offer cards | `cards` (offer variant) | 5:3 image, `--radius-md`, `--shadow-image`, H4 = `--heading-card-size` |
| Editorial offer panels | `cards` (panel variant) | Blush/coral/white surfaces, full-width white pill button |
| Partner logos | `cards` (logo variant) | White tiles, `--radius-md`, on a grey section |
| FAQ | `accordion` | Flush rows, `--color-border-subtle`, 20px/500 questions |
| Newsletter | `newsletter` block or fragment | Maroon panel, `--radius-xl`, inverse inputs |
| Contact / group booking / sign-up | `form` (AEM Forms, via the Forms add-on) | Warm pill inputs, `--radius-input`, uppercase 12px labels |
| Breadcrumb | auto-block or `breadcrumb` | Active item brand/500 |

## 5. Rules
- Scope all component CSS to the block class, and reference tokens instead of raw hex or px values.
- Don't add Bootstrap, jQuery, WebSlideMenu or Owl/Swiper. Reproduce the visual result with plain CSS.
- Don't add tokens casually. If a value isn't in `design-tokens.json`, check [colors.md](colors.md) and the other docs for documented one-offs first.
- Keep `design-tokens.json` and the `:root` block in sync. Change both together.
- Test at 375, 768, 1024, 1280 and 1440px. Pay particular attention to 1024px, which still uses the mobile navigation.
