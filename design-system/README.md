# Plaza Premium Lounge: Base Design System

This design system was reverse-engineered from **https://www.plazapremiumlounge.com/en-uk** on 2026-09-30, for the Edge Delivery Services rebuild.

> **Status: applied to global styles.** All tokens are declared as CSS custom properties in the `:root` of [`/styles/styles.css`](../styles/styles.css), with responsive overrides. The global rules use them: body, headings, links, focus, buttons, sections and section metadata (`grey`, `maroon`, `wide`). Blocks (header, footer, cards, hero, columns) are **not** restyled yet and still use the neutral `--base-*` variables. Brand fonts are self-hosted from `styles/fonts/` and declared in `styles/fonts.css`: PolySans, Reckless Neue and Montserrat. A size-adjusted Arial fallback limits layout shift while they load. There is no separate `design-tokens.css`, because `styles.css` is the single CSS source. This folder is excluded from publishing via `.hlxignore`.

## Files

| File | Contents |
| --- | --- |
| [design-tokens.json](design-tokens.json) | Machine-readable tokens (value, responsive overrides, usage, evidence, confidence) and breakpoints |
| [colors.md](colors.md) | Brand, surface, text, border and state colours, plus interactive states |
| [typography.md](typography.md) | Font families and faces, scale, type roles, responsive type |
| [spacing.md](spacing.md) | Spacing scale, section and component spacing |
| [layout.md](layout.md) | Containers, grid patterns, header offset |
| [responsive.md](responsive.md) | Breakpoints and per-component transformations |
| [components.md](components.md) | Header, navigation, buttons, links, hero, cards, tags, forms, accordion, breadcrumb, pagination, newsletter, footer |
| [accessibility.md](accessibility.md) | Contrast ratios, observed gaps, recommendations (no compliance claims) |
| [motion.md](motion.md) | Durations, easing, interaction patterns |
| [assets.md](assets.md) | Logos, fonts, icon system, image handling |
| [pages.md](pages.md) | Page inventory and templates |
| [implementation-guide.md](implementation-guide.md) | How to apply the tokens in this EDS project |

## Method and evidence
- **Pages:** 11 page types, including home, city/lounge listing, offers listing and detail, about, FAQ, contact, group booking, sign-up, lounge passes, and news. See [pages.md](pages.md).
- **Viewports:** the home page at 320, 375, 768, 1024, 1280, 1440 and 1920px. Other pages at 1440 and 375px, plus 768px for four of them.
- **Measurements:** computed styles from a real browser session (the site is behind Cloudflare bot protection). We sampled key elements, took frequency counts of colour, type, spacing, radius, shadow and transition values across all visible elements, and captured hover/focus states for buttons, links and inputs, the scrolled-header state, and the open mobile menu.
- **Source inspection:** `style.css` (≈13k lines), `custom.css`, `bootstrap.min.css` (v5.3.2), `all.min.css` (Font Awesome Pro 6.4.2) and `webslidemenu.css`. Where source and rendered values differed, the rendered value was used and the difference noted (e.g. mobile container padding: CSS says 20px, rendered 15px).
- **Confidence:** *High* means measured and/or found in source. *Medium* means a repeated pattern across pages. *Low* means limited evidence (1–2 occurrences).

## Summary

### Brand
- **Primary:** deep maroon `#530e2a`. Filled buttons use `#681235`, the mobile menu `#5c0f2d`. Tint is maroon at 10%.
- **Secondary and accent:** warm off-white `#f5f4f1` for sections and inputs, blush `#f3d7d3` and coral `#ea7368` for offer panels, near-black footer `#1b1b1b`, body text `#333`.
- **Typography:** **Polysans** (weights 300/400/500/800) for everything, **RecklessNeue** serif as an editorial accent, Helvetica for navigation. Headings are weight 500 with line-height 1.2. Body is 16px (14px on mobile) with line-height 1.4. Labels and tags are 12px uppercase with 1px tracking.
- **Character:** premium hospitality. Mostly white with bold maroon bands, pill-shaped controls (30px radius), soft 15–20px image radii, generous photography, and minimal shadows.

### Layout
- **Container:** 1390px (wide 1490px). Padding 12px on desktop, 15px on mobile.
- **Grid:** Bootstrap 5, 12 columns, 24px gutter. Common patterns are 2-up cards and 4-column footer.
- **Spacing:** a 5px rhythm (5/10/15/20/25/30/35/50/80px). Sections are 25, 35 or 50px.
- **Breakpoints:** 576/768/992/1200/1400px. Navigation switches at **1200px**.

### Components
Fixed transparent-to-maroon header with mega menu. Mobile header with promo strip and a maroon drawer. Pill buttons (primary filled, outline, tint secondary, tertiary). Hero carousel with booking bar. Offer, editorial, partner and help cards. Image and feature tags. Pill form inputs on a warm fill. Flush accordion. Breadcrumb. Pagination. Maroon newsletter panel. Dark footer.

### Responsive
Type steps down at 768px (body 14px, H1 30px, section H2 18px, hero 32px). H2 is fluid between 768 and 1199px. Grids collapse to 1 column. The hero swaps to a rounded mobile card with a stacked booking widget. Header CTAs become a full-width promo strip.

### Motion
0.15s (controls), 0.25s (links), 0.3s (button inversion), 0.5s (header and mega menu), all `ease-in-out`. Colour and background transitions only, with no transforms on hover.

### Technical
- **Source stack:** Kentico CMS, Bootstrap 5.3.2, jQuery UI, WebSlideMenu (navigation), Owl Carousel and Swiper, Fancybox, daterangepicker, intl-tel-input.
- **CSS:** hand-written global `style.css` with no custom properties and no methodology such as BEM.
- **Fonts:** self-hosted woff2/woff on the source. Bitter and Inter are imported there but unused. In this project the font files are in `styles/fonts/`.
- **Icons:** Font Awesome 6 Pro, light style. Commercial licence needed. Plan to replace with SVG icons.
- **Recommended EDS architecture:** tokens and globals in `styles/styles.css`, fonts in `styles/fonts.css`, one folder per component under `blocks/`, non-critical globals in `lazy-styles.css`. See [implementation-guide.md](implementation-guide.md).

## Out of scope and caveats
- The lounge passes app and the news site use different design systems and were excluded.
- Success, warning and info colours, tables, tooltips, modals (dimensions) and alerts were not observed, so no tokens were made for them.
- Accessibility findings are observations, not an audit.
