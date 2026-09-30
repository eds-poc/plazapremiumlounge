# Motion and Animation

Motion is restrained. There are colour and background transitions on hover, a header that fades to solid, a slide-in mega menu, and fading carousels. We found no scroll-triggered animation library. The one keyframe animation we observed (`widgetOnLoad`, 0.2s) belongs to the third-party chat widget.

| Token | Value | Observed on | Evidence | Confidence |
| --- | --- | --- | --- | --- |
| `--duration-fast` | 0.15s | Form controls, button colour/border/shadow (Bootstrap) | Computed `.btn`, `.form-control` | High |
| `--duration-normal` | 0.25s | Links and most interactive elements (`all 0.25s ease-in-out`, 58 elements on home) | `style.css a` | High |
| `--duration-medium` | 0.3s | Button hover inversion (`.btn-primary:hover`, outline buttons) | `style.css` | High |
| `--duration-slow` | 0.5s | Header background, desktop nav links, mega menu transform/opacity | Computed `.wsmainfull`, `.wsmegamenu` | High |
| `--ease-standard` | `ease-in-out` | Default everywhere | Computed | High |
| `--ease-emphasized` | `cubic-bezier(0.22, 0.61, 0.36, 1)` | One slide transform (0.65s) | Computed (1 element) | Low |

## Patterns
- **Header:** `transition: all 0.5s ease-in-out`. The background goes from transparent to `#530e2a` on hover or scroll, and the height from 108px to 70px when `.fixedTop` is applied. On hover the logo inverts to white (`filter: invert(1) grayscale(1) brightness(100)`).
- **Mega menu:** `transform 0.5s ease-in-out 0.3s, opacity 0.5s ease-in-out 0.3s, visibility 0s linear 0.8s`, a delayed reveal on hover.
- **Mobile drawer:** `0.15s–0.4s ease-in-out` on the list and toggle. The backdrop fades with `opacity 1.5s ease-in-out`.
- **Buttons:** colour inversion over 0.3s. No transform or scale.
- **Carousel:** Bootstrap `carousel-fade`, with the item `opacity 0.6s ease-in-out`. A slow 3s opacity fade appears on one hero element.
- **Accordion:** Bootstrap collapse, with the button `0.15s ease-in-out` and the chevron rotating.
- **Loading:** a full-screen spinner overlay `rgb(244 243 240 / 95%)` with a branded image.

`prefers-reduced-motion` has no site-specific handling beyond Bootstrap's defaults. The new build should add it.
