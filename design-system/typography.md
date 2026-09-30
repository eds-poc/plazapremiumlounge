# Typography System

## Font families

| Token | Stack | Role | Source | Confidence |
| --- | --- | --- | --- | --- |
| `--font-family-primary` | `polysans, polysans-fallback, sans-serif` | Everything: body, headings, buttons, forms | `style.css` `body`, `h1–h5`. Self-hosted `@font-face` from `assets.plazapremiumlounge.com/content/webfonts/` | High |
| `--font-family-display` | `recklessneue, sans-serif` | Editorial serif accent: offer card titles ("Online Exclusive Offer") | `@font-face RecklessNeue-Book.woff`. Source has no fallback, so generic `sans-serif` is added (project rule: all fallbacks are sans-serif) | High |
| `--font-family-nav` | `helvetica, sans-serif` | Navigation links (desktop and mobile), mega menu | Computed on `.wsmenu-list > li > a` (WebSlideMenu CSS) | High |

**Polysans faces declared** (woff2 + woff):

| File | Weight | Style |
| --- | --- | --- |
| `polysans-neutral` | 400 | normal and italic |
| `polysans-median` | 500 | normal and italic |
| `polysans-bulky` | 800 | normal and italic |
| slim/light face | 300 | normal |

Loaded at runtime (`document.fonts`): Polysans 300, 400, 500, 800 and RecklessNeue 400.

`style.css` also `@import`s **Bitter** and **Inter** from Google Fonts, but no measured element on the 11 pages used them. Treat them as unused and **do not** carry them over.

**Licensing:** Polysans (Wide Type) and Reckless Neue (Displaay) are commercial typefaces. Font Awesome 6 Pro is commercial too. The PolySans and Reckless Neue files in `styles/fonts/` were supplied by the project team. Montserrat (also supplied) is SIL OFL, with the licence in `styles/fonts/OFL.txt`. It isn't used on the source site and has no token yet.

**Divergent pages:**
- `/en-uk/airport-lounge-passes` embeds an app that uses a separate family, `"PolySans Median"`, at 38/22/18px with a different palette.
- `/en-uk/news` redirects to the Plaza Premium Group site, which uses `NeueHaasDisplay`.

Neither is part of this system.

## Units and scaling
- All sizes are **px**. Bootstrap's `h2` uses **RFS fluid sizing**, `calc(1.325rem + 0.9vw)`, below 1200px, and fixed `2rem` at 1200px and up.
- Responsive changes use media-query overrides at 768px and 1200px. There's no `clamp()` and no viewport units elsewhere.

## Scale

| Token | px | Measured usage |
| --- | ---: | --- |
| `--font-size-2xs` | 10 | Mobile tags, footer brand captions (≤767px) |
| `--font-size-xs` | 12 | Form labels, tags, eyebrows |
| `--font-size-sm` | 14 | Buttons, nav, footer links, mobile body |
| `--font-size-md` | 16 | Desktop body, breadcrumbs |
| `--font-size-lg` | 18 | Card subtitles, mobile section H2 |
| `--font-size-xl` | 20 | Accordion questions, `p.intro`, mobile menu items |
| `--font-size-2xl` | 24 | H3, card titles, newsletter heading |
| `--font-size-3xl` | 32 | Section H2 (≥1200px) |
| `--font-size-4xl` | 40 | Hero title (≥768px) |
| `--font-size-5xl` | 42 | Page title `h1.title` |

Weights: `--font-weight-light` 300, `--font-weight-regular` 400, `--font-weight-medium` 500 (the default for headings, links and `strong`), `--font-weight-bold` 800.

## Type roles (measured at 1440px, with mobile values from 375px)

| Role | Family | Size desktop → mobile | Weight | Line height | Spacing / transform | Margin-bottom | Color |
| --- | --- | --- | ---: | --- | --- | --- | --- |
| Hero title (`h2` in hero) | Polysans | 40 → 32px | 500 | 1.15 (46px) | — | 20px | `#fff` |
| H1 page title (`h1.title`) | Polysans | 42 → 30px | 500 | 1.2 | — | 8px | `#333` |
| H2 section title | Polysans | 32 → RFS 28–30 (768–1199px) → 18px | 500 | 1.2 | — | 35px (≥992px) / 25px | `#333` |
| H3 | Polysans | 24px | 500 | 1.2 | — | 8px | `#333` / brand |
| H3 editorial accent | RecklessNeue | 24px | 500 (synthesised) | 1.2 | — | 8px | brand / `#333` |
| H4 card title | Polysans | 24 → 18px (<1200px) | 500 | 1.2 | — | 8px | `#333` |
| Card subtitle (H3 small) | Polysans | 18px | 500 | 1.2 | — | 10px | brand / `#333` |
| Lounge name (city page) | Polysans | 20px | 500 | 1.1 | — | 5px | `#000` |
| Accordion question | Polysans | 20px | 500 | 1.2 | — | — | `#212529`, brand when open |
| Body | Polysans | 16 → 14px | 400 | 1.4 | — | p: 20px | `#333` |
| Intro (`p.intro`) | Polysans | 20px | 300 | 1.4 | — | 20px | — |
| Small / caption | Polysans | 14px | 300–400 | 1.4–1.5 | — | — | `#6b6b6b` |
| Label (`.form-label`) | Polysans | 12px | 500 | 1.4 | 1px, UPPERCASE | 2px (hero), 16px (forms) | `#333` / `#fff` |
| Tag / badge (`.tag`) | Polysans | 12 → 10px | 500 | 1.4 | 1px, UPPERCASE | — | brand |
| Eyebrow (footer column heading) | Polysans | 14px | 500 | 1.2 | 2px, UPPERCASE | 15px | `#fff` |
| Button | Polysans | 14px (12px in mobile header) | 400 | 1.5 | Capitalize | 15px | see components |
| Large button (form submit) | Polysans | 16px | 500 | 1.5 | Capitalize | — | brand |
| Desktop nav link | Helvetica | 14px | 500 | = header height | Capitalize | — | `#fff` |
| Mobile nav item | Helvetica | 20px | 500 | 25px | — | — | `#fff` |
| Breadcrumb | Polysans | 16px | 400, active 500 | 1.4 | — | — | `#333`, active brand |
| Footer link | Polysans | 14px | 300 | 1.4 | — | 5px | `#fff` |
| Input text | Polysans | 14px (18px/300 in hero booking bar) | 400 | 1.5 | — | — | `#212529` |
| Validation message | Polysans | 13px | 400 | 1.4 | — | — | `#dc3545` |

## Responsive tokens (declared in `styles/styles.css`)

Mobile-first: the `:root` value is the <768px value, with `min-width` overrides at 768 and 1200px.

| Token | ≥1200px | 768–1199px | <768px |
| --- | --- | --- | --- |
| `--body-font-size` | 16px | 16px | 14px |
| `--heading-page-size` | 42px | 42px | 30px |
| `--heading-section-size` | 32px | `calc(1.325rem + 0.9vw)` | 18px |
| `--heading-hero-size` | 40px | 40px | 32px |
| `--heading-card-size` | 24px | 18px | 18px |

## Heading hierarchy note
The source often uses heading levels for styling rather than structure. Examples: five `h1` elements on the home page (inside modals), `h5` for footer brand captions, `h3` for footer columns. Pick heading levels by document structure and style by role, using the tokens above.
