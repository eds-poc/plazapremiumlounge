# Responsive Design

**Breakpoints:** Bootstrap 5.3.2 defaults are confirmed in `style.css` media queries: **576 / 768 / 992 / 1200 / 1400px**. Most rules use the `max-width: *.98px` form. There are also small-screen tweaks at 520, 480, 400, 380, 350 and 340px, and one at 650px. Only 576/768/992/1200 carry design-system changes. The rest are component fixes.

The **navigation switches from mobile to desktop at 1200px**. At 1024px the site still shows the mobile header and hamburger.

Measured at 320, 375, 768, 1024, 1280, 1440 and 1920px (home), and at 375/768/1440px (7 other page types).

| Breakpoint | Layout | Columns (typical) | Container | Navigation | Typography |
| --- | --- | ---: | --- | --- | --- |
| 320–575px | Single column, stacked cards, full-width buttons | 1 | 100% width, 15px padding, wide container 0 | Mobile: 40px promo strip + 82px white header (logo 90px, "Book Now" pill, cart, account, hamburger) | Body 14px. H1 30px. Section H2 18px. Hero 32px. H4 18px. Tags 10px |
| 576–767px | Same as above, some 2-up grids | 1–2 | as above | Mobile | as above |
| 768–991px | 2-column grids, sections 35px | 2 | 12px padding, wide 50px | Mobile (hamburger) | Body 16px. H2 fluid ≈28–29px. Hero 40px. H4 18px |
| 992–1199px | Sections 50px, H2 margin 35px | 2–3 | 12px padding | Mobile (hamburger) | H2 fluid ≈30–32px |
| 1200–1399px | Full desktop | 4 (footer) | ≤1390px | Desktop: fixed, transparent over hero, 108px → 70px on scroll, mega menu | H2 32px. H4 24px |
| ≥1400px | Content capped at 1390 (standard) / 1490 (wide) | 4 | 1390 / 1490px, centred | Desktop | as above |

## Transformations by component
- **Navigation:** at <1200px the desktop link bar is replaced by a hamburger. The drawer opens below the 122px mobile header: full width, `#5c0f2d` background, 50px rows of 20px/500 Helvetica, dividers at `rgb(0 0 0 / 13%)`, and a `rgb(0 0 0 / 45%)` backdrop. `body.wsactive` locks the page. A fixed `.mobile-bottom-menu` (language switch) is shown on mobile.
- **Hero:** on desktop (≥768px) a full-bleed carousel `.fw-home-banner` is 817px tall at 1440px, with `object-fit: cover`. On mobile a separate `.mobileBanner` shows a rounded image card inset 15px with the booking widget stacked inside it. Mobile-specific hero images are served (`PPL_Home_Hero_Mobile_*.jpg`).
- **Booking bar:** a horizontal maroon bar (Where | Date/Time | Adults/Children | search) on desktop becomes a vertical stack with a full-width "Search Lounges" button on mobile.
- **Header CTAs:** "Your Destination Before Departure" is a pill in the desktop header. On mobile it becomes the 40px full-width maroon promo strip at the top of the page, with square corners and 12px text.
- **Section titles:** centred on desktop, left-aligned from 767px down.
- **Cards and carousels:** 2-up becomes 1-up. Owl/Swiper carousels keep swipe with dots.
- **Footer:** 4 columns become stacked accordion-style lists. The brand logo band shrinks.
- **Buttons:** font-size drops to 12px and padding to `4px 10px` in the mobile header. Form submit buttons become `w-100`.
- **Visibility helpers:** Bootstrap `d-none d-md-block` / `d-md-none` pairs swap desktop and mobile variants of the hero, CTA and booking widget.
