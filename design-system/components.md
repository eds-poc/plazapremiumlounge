# Component Specifications

All values were measured from computed styles at 1440px unless marked otherwise. Mobile values were measured at 375px. "Source" means the value was confirmed in the site's `style.css`. Tokens refer to `styles/styles.css`.

---

## Header (desktop, ≥1200px)

**Purpose:** Primary navigation, booking CTAs, and account/language/cart utilities.

```text
Header (.wsmainfull, fixed, full width)
 ├── Logo (225×95 SVG, white; maroon variant on light theme)
 ├── Primary nav (4 items: Locations, Lounge Passes, Latest Offers, Discover More)
 │    └── Mega menu (full-width maroon panel below header)
 ├── CTA pills ("Your Destination Before Departure", "Book Now")
 └── Utilities (account, language, cart icons, Font Awesome light)
```

| Property | Top of page | Scrolled (`.fixedTop`) or hovered |
| --- | --- | --- |
| Height | 108px (`--nav-height-desktop`) | 70px (`--nav-height-desktop-scrolled`) |
| Position | `fixed`, `z-index: 99` | same |
| Background | transparent over the hero | `--color-brand-primary` |
| Nav link | Helvetica 14px/500, `#fff`, capitalize, padding `0 15px`, line-height = bar height, 3px transparent bottom border | same. Hover adds an underline |
| CTA pill | `.btn-primary`: bg `#681235`, `#fff`, 14px/400, padding `5px 10px`, height 33px, radius 30px | inverted: bg `#fff`, text `#530e2a` |
| Transition | `all 0.5s ease-in-out` | — |

Interior pages without a hero show the solid maroon bar from the start.

**Mega menu:** `position: fixed`, `top: 105px`, full width, bg `--color-brand-primary`, padding `14px 5px`, Helvetica 15px text in `#fff`. Region tabs are `.nav-link` at 13px, padding `12px 30px 12px 0`. It reveals with a delayed 0.5s transform/opacity.

## Header (mobile, <1200px)

```text
Promo strip (40px, full-width maroon .btn-primary, 12px, square corners)
Mobile header (.wsmobileheader, 82px, white)
 ├── Logo (90×52, maroon)
 ├── "Book Now" pill (80×28, 12px, padding 4px 10px, radius 30px)
 ├── Cart + account icons (maroon)
 └── Hamburger (.wsanimated-arrow, 35×32, maroon, 0.4s ease-in-out)
```

**Drawer:** opens below the 122px header, 100% width. The list is bg `#5c0f2d` (`--color-brand-primary-dark`). Items are Helvetica 20px/500 in `#fff`, 50px tall, padding `12px 32px 12px 17px`, with a 1px `rgb(0 0 0 / 13%)` divider. Sub-menus expand with a chevron. The backdrop is `rgb(0 0 0 / 45%)`. `body.wsactive` locks scroll.

---

## Buttons

| Variant | Background | Text | Border | Size | Padding | Radius | Hover |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Primary (`.btn-primary`) | `#681235` | `#fff` 14px/400, capitalize | 1px transparent | h 33px, min-width 120px | `5px 20px` | 30px | bg `#fff`, text and border `#530e2a` (0.3s) |
| Primary outline (`.btn-primary.outline[.red]`) | transparent | `#530e2a` | 1px `#530e2a` | h 33px (44px with `.btnLg`, 16px/500) | `5px 20px` / `9px 20px` | 30px | bg `#530e2a`, text `#fff` |
| Outline white (`.outline.white`) | transparent | `#fff` | 1px `#fff` | — | — | 30px | opacity 0.8 |
| Secondary (`.btn-secondary`) | `--color-brand-tint` | `#530e2a` 14px/500 | transparent | — | `15px 30px` | 30px | bg `#530e2a`, text `#fff` |
| Tertiary (`.btn-tertiary`) | `#fff` | `#530e2a` 15px/500 | 1px `#530e2a` | h 35px, max-width 240px | `5px 20px` | 24px | bg `#530e2a`, text `#fff` |
| Disabled (any) | `#ccc` | `#666` | transparent | — | — | — | none |

Focus: the primary button shows the hover look plus `0 0 0 4px rgb(49 132 253 / 50%)`. Every button has `margin-bottom: 15px`. On mobile, form submit buttons are full width (`w-100`). Arrow icons (`fa-arrow-right`) are placed inline after the label, as in "Book Now →".

## Links

| State | Style |
| --- | --- |
| Default | `--color-link` (#530e2a), weight 500, no underline, `transition: all 0.25s ease-in-out` |
| Hover | `#999`, no underline |
| Focus | outline removed site-wide (`*:focus { outline: none }`). This is an accessibility gap, so don't copy it |
| Underline variants | `a.link` / `a.underline`: `#000`, underlined. Hover → brand |
| On dark | `#fff`. Footer links show no hover change |

---

## Hero (home)

```text
Hero (.fw-home-banner, carousel-fade)
 ├── Background image (object-fit: cover, 1430×817 at 1440px, scrim rgb(0 0 0 / 35%))
 ├── Title (Polysans 40px/500, #fff, centred, line-height 1.15)
 ├── Booking bar (maroon, radius 30px, uppercase 12px labels, 18px/300 inputs)
 ├── Notice text (14px/100–300, rgb(255 255 255 / 90%))
 └── Carousel dots
```

- **Desktop:** full-bleed, about 817px tall at 1440px (1.75:1). The booking bar sits 230px from the top and overlaps the image.
- **Mobile:** an inset rounded card (15px margin, about 20px radius) with the title at 32px. The booking widget is stacked inside it on a maroon panel with white rows. "Search Lounges" is a full-width maroon button.

## Booking widget / product card

```text
Card (article.card, flex row)
 ├── Image carousel (≈38% width, radius 16px on the outer corners)
 └── Content
      ├── Title (24px/500) + location subtitle (14px, #6b6b6b), hairline divider
      ├── Segmented pills (LOUNGE / SHOWER; active = maroon filled, inactive = outline, radius 30px, 12px uppercase)
      ├── Select (15px/500, padding 12px 14px, 1px #d0d0d0, radius 12px, h 46px)
      ├── Amenity chips (12px uppercase, 1px #d8d8d8 border, pill radius)
      ├── Price (strikethrough old price + 28px/500 maroon price)
      └── CTAs (primary filled + outline, full-width stack, radius 30px)
```

Card: bg `#fff`, radius 16px, `--shadow-card` (`0 4px 24px rgb(0 0 0 / 10%)`), 1376×361px at 1440px.

## Cards

| Card | Structure | Dimensions | Styles |
| --- | --- | --- | --- |
| Offer card (`.offerCarousel-item`) | Image (`.offerImg`, 60% padding-bottom → 5:3) → tag → H4 title (24px) → description → link | ≈618–671px wide on desktop, 345px on mobile | Image radius 15px (`--radius-md`), `--shadow-image` (`0 5px 12px rgb(0 0 0 / 30%)`), image margin-bottom 20px. No card background |
| Editorial offer (latest offers) | RecklessNeue 24px title + Polysans 18px subtitle, in brand or `#333` | 3-up | Coloured panels (`--color-brand-blush`, `--color-brand-coral`) on some |
| Partner / brand card (`.partners-card`) | Centred logo | 267×165px | bg `#fff`, padding `50px 30px`, radius 15px, no shadow. Sits on a `#f5f4f1` section |
| Help card (`.helpCard.card`) | Icon + text + link | 671×98px desktop, 345×110px mobile | Bootstrap card: 1px `rgb(0 0 0 / 17.6%)`, radius 6px, padding 20px |
| Lounge card (city page) | Image → name (20px/500 `#000`) → terminal → feature tags | — | `--shadow-sm`, radius 20px |

## Tags / badges

| Variant | Style |
| --- | --- |
| Image tag (`.tag`) | Absolute top/right 15px. bg `#fff`, `#530e2a` 12px/500 uppercase, letter-spacing 1px, padding `2px 20px`, radius 20px. Mobile: 10px, padding `5px 20px` |
| Feature tag (`.tag.pink.xs`) | bg `--color-brand-tint`, `#530e2a` 9px/500, padding `6px 12px`, radius 20px, h 21px |
| Amenity chip | 12px uppercase, 1px `#d8d8d8`, pill radius, padding about `6px 12px` |
| Badge (`.badge`) | 12px/700 `#fff`, radius 6px (Bootstrap) |

---

## Forms

| Element | Content forms (contact, sign-up, group booking) | Newsletter (on maroon) | Hero booking bar |
| --- | --- | --- | --- |
| Label | 12px/500 UPPERCASE, 1px tracking, `#333`, margin-bottom 16px. Required marked with ` *` or a red star | 12px/500 uppercase `#fff` | 12px/500 uppercase `#fff`, mb 2px |
| Input | h 41–45px, padding `10–12px 20–25px`, bg `#f5f4f1`, **no border**, radius 25px, 14px/400 `#212529` | h 35px, padding `6px 25px`, bg `#530e2a`, 1px `#fff` border, radius 20px, 14px `#fff` | Transparent, borderless, 18px/300 `#fff` |
| Select | Same as input (14px/500), Bootstrap chevron | — | Booking card: 1px `#d0d0d0`, radius 12px |
| Textarea | Same as input, 272px tall | — | — |
| Radio/checkbox | 14–16px circle, 1px `#530e2a`. Checked = filled `#530e2a` (radius 50% even for checkboxes) | same | — |
| Focus | bg becomes `#fff`, ring `0 0 0 4px rgb(13 110 253 / 25%)` (Bootstrap blue) | same ring | — |
| Error | Message below the field: 13px `#dc3545` (`.text-danger`) | — | — |
| Submit | `.btn-primary.outline.red.btnLg`, 44px, 16px/500, full width on mobile | Icon button inside the field | Square icon block / full-width button on mobile |
| Layout | Single column, fields about 651–671px (`col-md-6`), about 20px vertical rhythm | 2-column (first/last name), then email full width | Horizontal segments separated by 1px white dividers |

Success and disabled states were not observed. Validation runs on the server (ASP.NET unobtrusive `field-validation-*` classes).

## Accordion (FAQ)

```text
Accordion (.accordion-flush)
 └── Item (bg #fff, border-bottom 1px #dee2e6)
      ├── Button (20px/500, padding 25px 0, #212529; open → #530e2a, no bg change, chevron rotates)
      └── Body (16px/400 #666, padding 10px 0 20px)
```

On mobile the question stays at 20px and wraps (row height about 98–123px).

## Breadcrumbs
`ol.breadcrumb`, padding `10px 0`. Items are 16px/400 `#333` with padding `2px 5px`. The active item is 500 weight in `#530e2a`. Uses the Bootstrap separator.

## Pagination
Centred, block padding 35px. `.page-link` is 16px/500, padding `6px 12px`, radius 6px. The active one is bg `#530e2a` with `#fff` text and a 1px `#530e2a` border. Inactive ones use `#530e2a` text.

## Tabs / region selector
Inside the Locations mega menu: `.nav-link`, Helvetica 13px, `#fff`, padding `12px 30px 12px 0`, no background. The active state is shown by weight or colour only. No content-area tab component was found on the sampled pages.

## Newsletter band (every page, above the footer)
Wide container (1490px). The panel is `.newsletter`: bg `#530e2a`, `#fff` text, padding `30px 50px`, radius 30px. It has two columns: heading (24px/500, `1.5rem`) plus copy, and the form. On mobile it goes edge to edge and stacks.

## Footer

```text
Footer (bg #1b1b1b, #fff, padding 50px 0 15px)
 ├── 4 columns: Company | Support | Social (icon row) | Downloads (app badges)
 │    ├── Heading: 14px/500 uppercase, 2px tracking, mb 15px
 │    └── Links: 14px/300, padding 2px 0, mb 5px
 ├── Divider
 ├── Group logo (224×136) + brand family grid (Airport Lounge, Passenger Services, Hotel, Dining, Digital)
 │    └── Captions 12px/300 (10px on mobile)
 └── Copyright row
```

On mobile the columns stack into single-column lists.

## Carousel controls
Owl Carousel and Swiper both appear. Dots are small circles (50% radius), white on imagery and grey/maroon on light surfaces. Arrows are Font Awesome light icons. The offer carousel has 50px inline padding for its arrows.

## Back to top
Source `#back-top`: a 40px circle, bg `#681235` (`--color-brand-primary-action`), white Font Awesome light `angle-up` (25px), `position: fixed`, 5px from the right and 120px from the bottom at every width, `z-index: 500`. It fades in (jQuery, 400ms) once the page is scrolled more than 100px and out again at 100px or less. Clicking scrolls to the top in 500ms (jQuery "swing"), with no `#top` in the URL. Hover and focus don't change its look. Below 1200px the source scrolls `body`, so its button only reacts to touch scrolling there.

**In this project:** `scripts/back-to-top.js` (loaded on every page from `loadDelayed`) and `styles/lazy-styles.css`. It's a `<button>` named "Back to top" in the page language, with an SVG chevron (`icons/angle-up.svg`). It works the same on every device and stays out of the tab order while hidden. Reduced motion jumps to the top. After use, focus moves to the first visible item at the top of the page. It sits just below the header (`calc(var(--z-header) - 1)`), so the mobile menu and modals cover it.

## Modal
Bootstrap modals (Log In, Forgot Password): title 20px/500, fixed centred. They weren't opened during the audit, so their dimensions are not verified.

## Not observed on the sampled pages
Tables, tooltips (only `.icon-tooltip` markup, not triggered), alerts, and a site search input. Video blocks: one GIF/video in a circle with a 10px `#f3d6d3` border (custom.css `.sub-banner`) is referenced but wasn't rendered on these pages.
