# Color System

Source: https://www.plazapremiumlounge.com/en-uk. Colors come from the site's own `style.css` and `custom.css`, and from computed styles on 11 pages at 320–1920px.

**Evidence levels:** *Source* means it is declared in site CSS. *Measured* means it was read from computed styles. Frequency counts come from `style.css` (hex occurrences) and from visible elements on the home page at 1440px.

The palette is a single deep **maroon** brand color on white, with a warm off-white alternate surface and a near-black footer. There are no CSS custom properties on the source site. Every color is hard-coded, and Bootstrap 5.3.2 defaults show through for focus rings, accordion borders and validation colors.

## Brand

| Token | Value | Usage | Evidence | Confidence |
| --- | --- | --- | --- | --- |
| `--color-brand-primary` | `#530e2a` | Links, active nav/breadcrumb, scrolled header, newsletter panel, outline buttons, tag text, pagination active | Source: 163 occurrences in style.css. Measured on every page | High |
| `--color-brand-primary-action` | `#681235` | Filled `.btn-primary` background | Source `.btn-primary`. Measured `rgb(104 18 53)` | High |
| `--color-brand-primary-dark` | `#5c0f2d` | Mobile menu drawer background | Measured `.wsmenu-list` at 375px. Source 5 occurrences | Medium |
| `--color-brand-primary-deep` | `#4a0d26` | Promotional sub-banner | Source custom.css `section.sub-banner` | Low |
| `--color-brand-tint` | `rgb(104 18 53 / 10%)` | `.btn-secondary` background, pink feature tags on lounge pages | Source `.btn-secondary`. Measured 18× on city page | High |
| `--color-brand-blush` | `#f3d7d3` | Soft pink offer surfaces, sub-banner CTA | Measured on home/offers. Source `#f3d6d3` (1-unit rounding difference) | Medium |
| `--color-brand-coral` | `#ea7368` | Accent in offer promotion panels | Measured on home (1) and offers (3) | Low |

**One-offs (not tokenised):** `#711b45` (14× in CSS, never seen rendered), `#6e0f2d` (one card border), `#624d4a`, `#573b82`, `#2a5236`, `#005370` and `#a2cbfa` (sub-brand or campaign colors), and `#002639` (Smart Traveller headings only).

## Backgrounds

| Token | Value | Usage | Evidence | Confidence |
| --- | --- | --- | --- | --- |
| `--color-background` | `#fff` | Page, cards, accordion rows | Measured body | High |
| `--color-surface-warm` | `#f5f4f1` | Alternate section (`section.greyBg`), form input fill | Source 54×. Measured contact/sign-up/group-booking inputs | High |
| `--color-surface-footer` | `#1b1b1b` | Footer | Source `footer`. Measured | High |
| `--color-overlay-hero` | `rgb(0 0 0 / 35%)` | Scrim over hero photography | Measured home hero | Medium |
| `--color-overlay-nav` | `rgb(0 0 0 / 45%)` | Backdrop behind open mobile menu | Measured `.overlapblackbg` | Medium |

The navigation background is **transparent** over the hero at the top of the page, and becomes `--color-brand-primary` when you hover the header or scroll (`.fixedTop`). There is also a light theme (`.light-theme .wsmainfull`) that uses `#f5f4f1`. The mobile header is white.

The elevated surface is white with `--shadow-card` (see [components.md](components.md)). Input backgrounds are `--color-surface-warm` on light pages, and `--color-brand-primary` with a white border in the newsletter panel.

## Text

| Token | Value | Usage | Evidence | Confidence |
| --- | --- | --- | --- | --- |
| `--color-text` | `#333` | Body text, headings | Source `body`. Measured | High |
| `--color-text-strong` | `#000` | Lounge card titles, `a.txt-link` | Measured city page. Source | Medium |
| `--color-text-secondary` | `#666` | Accordion answers, secondary copy | Source `.accordion-body` | High |
| `--color-text-muted` | `#6b6b6b` | Card subtitles, meta | Measured `.bw-featured-subtitle` | Medium |
| `--color-text-subtle` | `#999` | Link hover | Source `a:hover` | High |
| `--color-text-inverse` | `#fff` | On maroon, hero, footer | Measured | High |
| `--color-link` | → brand primary | Links | Source `a { color: #530e2a; font-weight: 500 }` | High |
| `--color-link-hover` | → `#999` | Link hover (no underline) | Source `a:hover` | High |

Bootstrap components that the site hasn't restyled (cards, accordion buttons) render `#212529`. Treat that as a leak, not a token.

## Borders

| Token | Value | Usage | Confidence |
| --- | --- | --- | --- |
| `--color-border` | `#d8d8d8` | Chips and dividers in the booking card | Medium |
| `--color-border-subtle` | `#dee2e6` | Accordion separators (Bootstrap default) | High |
| `--color-border-strong` | → brand primary | Outline buttons, radio/checkbox rings | High |
| `--color-divider-inverse` | `rgb(0 0 0 / 13%)` | Mobile menu row dividers | Medium |

## States

| Token | Value | Usage | Confidence |
| --- | --- | --- | --- |
| `--color-error` | `#dc3545` | Validation text (`.text-danger`, 13px) | High |
| `--color-disabled-bg` / `--color-disabled-text` | `#ccc` / `#666` | Disabled buttons | High |
| `--color-focus-ring` | `rgb(13 110 253 / 25%)` | Input focus ring (Bootstrap default blue, not rebranded) | High |

**Not observed** (so no token was made): success, warning, info and visited colors. `#d89415`, `#f5ca45` and `#fffbeb`/`#92400e` appear 2–3× in CSS, possibly as alert styles, but were never rendered on the pages we sampled.

## Interactive states (measured)

| Component | Default | Hover | Focus | Active | Disabled |
| --- | --- | --- | --- | --- | --- |
| `.btn-primary` | bg `#681235`, text `#fff`, border transparent | bg `#fff`, text `#530e2a`, border `#530e2a` (0.3s) | Same as hover + `0 0 0 4px rgb(49 132 253 / 50%)` | bg `#681235` (`!important`) | bg `#ccc`, text `#666` |
| `.btn-primary.outline` | transparent, text/border `#530e2a` | bg `#530e2a`, text `#fff` | — | — | as above |
| `.btn-secondary` | bg brand tint, text `#530e2a` | bg `#530e2a`, text `#fff` | — | — | — |
| Header CTA (header hovered or scrolled) | Inverts to bg `#fff`, text `#530e2a` | — | — | — | — |
| Text link | `#530e2a` | `#999` | outline removed (`*:focus { outline: none }`) | — | — |
| Desktop nav link | `#fff` | underline | underline | 3px bottom border slot (transparent) | — |
| Footer link | `#fff` | no visible change | no visible change | — | — |
| Input | `#f5f4f1`, no border | — | bg `#fff`, ring `0 0 0 4px rgb(13 110 253 / 25%)` | — | — |
