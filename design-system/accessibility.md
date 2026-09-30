# Accessibility Observations

This is **not** a WCAG audit. We make no compliance claims. Findings are grouped as *Observed* (measured or seen in the DOM), *Likely* (inferred from patterns) and *Not verified*.

## Colour contrast (Calculated from the token values with the WCAG 2.x relative-luminance formula)

| Pair | Ratio | Note |
| --- | ---: | --- |
| `#333` text on `#fff` | 12.63:1 | Body text |
| `#333` on `#f5f4f1` | 11.49:1 | Text on warm sections and inputs |
| `#fff` on `#681235` | 12.16:1 | Primary button |
| `#530e2a` on `#fff` | 14.34:1 | Links, outline buttons |
| `#fff` on `#530e2a` / `#5c0f2d` | 14.34 / 13.45:1 | Header, newsletter, mobile menu |
| `#530e2a` on brand tint (≈`#f0e7eb`) | 11.84:1 | Secondary button, feature tags |
| `#fff` on `#1b1b1b` | 17.22:1 | Footer |
| `#666` on `#fff` | 5.74:1 | Accordion answers |
| `#6b6b6b` on `#fff` | 5.33:1 | Subtitles |
| `#dc3545` on `#fff` | 4.53:1 | Error text, 13px (just above 4.5:1) |
| **`#999` on `#fff`** | **2.85:1** | **Link hover colour. Below 4.5:1** |
| **`#666` on `#ccc`** | **3.58:1** | **Disabled button. Exempt as a disabled state, but weak** |

White text over hero photography relies on a 35% black scrim. Contrast there depends on the image and was not verified.

## Observed
- `lang="en"` is set on `<html>`.
- **Focus indicators are removed globally** (`*:focus { outline: none }`, `a:focus { outline: none }`, `input:focus { box-shadow: none }` in some contexts). Only Bootstrap's input focus ring and the primary-button hover-style focus remain. Keyboard focus on links and nav items is not visible.
- There's no skip link.
- 5–6 `<h1>` elements per page, mostly inside hidden modals (Log In, Forgot Password). The visible page title is often an `h2` (FAQ, Group Booking) or `h1.title` (About, Contact). Footer headings use `h3`/`h5` for styling.
- Around 49–53 `<img>` per page have no `alt` attribute. Most are third-party tracking pixels. Content images mostly have alt text; hero images use `alt=""`.
- 14–21 inputs per page have no associated `<label>` or `aria-label`. These are mostly the hero booking bar, the newsletter, and hidden modal forms. Content forms do use `.form-label`.
- ARIA is present (300+ `aria-*`/`role` attributes per page, from Bootstrap collapse, modals and carousels).
- Buttons and links are visually distinct: buttons are pills, while links are maroon and weight 500 with no underline. Links in body copy are **not underlined**, so they rely on colour alone.
- Touch targets: mobile menu rows are 50px tall and the hamburger is 35×32px. The mobile "Book Now" pill is 80×28px, which is **under 44px** tall. Checkboxes/radios are 14–16px, and the label is the tap target.

## Likely
- Keyboard users can operate Bootstrap accordions, modals and carousels (Bootstrap's built-in behaviour). The WebSlideMenu mega menu opens on hover, so keyboard access is uncertain.
- Server-side validation messages are injected next to fields without `aria-describedby`.

## Not verified
- Screen-reader announcement of the booking widget, carousels and the mega menu.
- Reduced-motion handling.
- Zoom/reflow at 400%.
- Error summaries and focus management after form submit.

## Recommendations for the new build (do not copy these source defects)
1. Keep a visible focus style. For example, `outline: 2px solid var(--color-brand-primary); outline-offset: 2px` on light surfaces and `#fff` on dark ones.
2. Replace the `#999` link hover with an underline, or with a colour of at least 4.5:1.
3. Make mobile header tap targets at least 44px.
4. Use one visible `h1` per page and choose heading levels by structure.
5. Underline links in running text.
