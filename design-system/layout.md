# Layout System

**Architecture:** Bootstrap 5.3.2 grid (flexbox rows and columns, 12 columns, 24px gutter) inside fluid, max-width-capped containers. Some components use CSS Grid (the booking card). Page sections are full-bleed `<section>` elements whose content sits in a centred container. This is a *hybrid fluid* layout: fluid up to a cap, then centred.

## Containers (measured)

| Container | Max width | Inline padding | Behaviour | Confidence |
| --- | --- | --- | --- | --- |
| Standard (`.container-fluid`) | **1390px** (`--container-max-width`) | 12px (≥768px), 15px (<768px) | Fluid, centred with `margin-inline: auto` | High |
| Wide (`.container-fluid.long-container`) | **1490px** (`--container-wide-max-width`) | 50px (≥768px), 0 (<768px) | Used by the newsletter band and home feature bands | High |
| Narrow (`.container.sm-container`) | 860px (≥992px) | Bootstrap default | Reading-width content | Low |
| Width utilities | 400 / 500 / 600 / 800 / 1024px | — | `.width500` etc., centred | Medium |

Measured content widths: 1390px at 1440/1920px, 1270px at 1280px, and the full viewport at ≤1024px.

```css
.container {
  max-width: var(--container-max-width);
  margin-inline: auto;
  padding-inline: var(--container-padding);
}

.container-wide {
  max-width: var(--container-wide-max-width);
  margin-inline: auto;
  padding-inline: var(--container-wide-padding);
}
```

## Sections
- Full-width backgrounds: white (default), `--color-surface-warm` (`.greyBg`), `--color-brand-primary` (`.maroonBg`, `min-height: calc(100vh - 70px)`), and full-bleed photography (hero, feature carousel).
- Block padding is `--section-padding-block`: 25, 35 or 50px (see spacing.md).
- Section title wrapper: centred, `margin-bottom: 30px`. On mobile (<768px) it becomes left-aligned with no margin.

## Grid patterns observed

| Pattern | Columns desktop | Tablet | Mobile | Where |
| --- | --- | --- | --- | --- |
| Footer link columns | 4 (≈324px each) | 2 | 1 | All pages |
| Help/contact cards | 2 | 2 | 1 | FAQ |
| Partner/brand logo cards | 4–5 | 3 | 1 (stacked) | About, home "Our Brands" |
| Offer carousel | 2 visible (≈618–671px cards) | 2 | 1 (345px) | Home, offers |
| Offers listing | 2-column cards + pagination | 2 | 1 | `/offers` |
| Booking featured card | Image ≈ 38% + content (flex) | stacked | stacked | Home |
| Forms | Single column 651–671px (half-width `col-md-6`) | same | full width | Contact, sign-up, group booking |
| Newsletter panel | 2 columns: copy + form (form fields in 2 cols) | stacked | stacked | All pages |

## Header offset
The desktop header is `position: fixed`. It is 108px tall at the top of the page and 70px once scrolled. On the home page it overlaps the hero. Interior pages reserve 108px (`div.pageWrapper:not(.home) .main-navigation { height: 108px }`). On mobile, the header block is 122px (40px promo strip plus 82px header) and sits in normal flow.
