# Asset Inventory

We didn't download or copy any assets. The locations below are for reference, so the right owner-supplied files can be requested for the new build.

Most CMS assets are served from `https://www.plazapremiumlounge.com/getContentAsset/{guid}/{guid}/{file}?language=en-uk` (Kentico). Static theme assets come from `https://assets.plazapremiumlounge.com/content/`.

| Asset | Type | Location | Dimensions (rendered) | Usage |
| --- | --- | --- | --- | --- |
| PPL secondary logo (palm mark + wordmark) | SVG | `getContentAsset/.../PPL-Secondary-Logo_Plam-3.svg` | 225×95 (desktop header) | Desktop header, white. Inverted with a filter on hover |
| PPL logo, mobile | Image | mobile header | 90×52 | Mobile header, maroon |
| Plaza Premium Group logo (white) | PNG | `.../PPG_ft_new_white_1.png` | 224×136 | Footer |
| Brand family logos (PPL, PPF, ALLWAYS, YQNOW, Aerotel, Smart Traveller, Airport Dining, Intervals) | PNG | `getContentAsset/ef5b9fe0-.../*.png` | 105×70 (footer), 101–125×36–100 (home "Our Brands") | Footer brand grid, partner cards |
| Skytrax award banner | PNG/JPG | `.../Skytrax-2016-2026-original_1-line.png` | 1366×276 | Home awards band |
| App store badges | SVG | `.../app-store.svg`, `.../google-play.svg` | 127×44, 142×43 | Footer downloads |
| Hero photography | JPG | `.../PPL_Home_Hero_{n}.jpg`, `PPL_Home_Hero_Mobile_{n}.jpg` | 1430×817 (desktop), separate mobile crops | Home hero carousel |
| Polysans webfonts | WOFF2/WOFF | `assets.plazapremiumlounge.com/content/webfonts/polysans-{neutral,median,bulky,...}-webfont.*` | — | Primary typeface (commercial licence) |
| RecklessNeue Book | WOFF | `.../webfonts/RecklessNeue-Book.woff` | — | Display serif (commercial licence) |
| Font Awesome 6 Pro (light 300 + brands) | Icon font | `.../css/all.min.css`, `.../webfonts/fa-light-300.woff2` | 1em | All UI icons (commercial licence) |
| Favicon | PNG | `assets.plazapremiumlounge.com/images/favicon-16.png` | 16×16 | Browser tab |
| Loading spinner image | Image | `#global-spinner img` | up to 600px | Page loading overlay |

## Iconography
- **Library:** **Font Awesome 6 Pro 6.4.2** (confirmed by the file header in `all.min.css`). The site mostly uses the **light (300)** style (`fa-light`, 439 instances on the home page), with some `fa-solid` and `fa-brands` for social icons.
- **Style:** outline/light strokes, monochrome, inheriting `currentColor`.
- **Common icons:** `fa-arrow-right` / `fa-arrow-right-long` (after CTA labels), `fa-xmark`, chevrons, user, globe, cart, magnifier. Social: Facebook, Instagram, WeChat, X, Weibo, drawn as outlined rounded-square glyphs.
- **Sizes:** 1em of the surrounding text (14–16px), and about 20–24px in header utilities.
- **Icon-to-text gap:** about 5px (`ms-1` / `margin-left: 0.25rem`).
- **Colours:** `#fff` on dark surfaces, `#530e2a` on light.
- **Other:** 3–8 SVGs are loaded as `<img>` (logos, app badges). Inline SVG appears only in the Lounge Passes embedded app.

For the new site, replace Font Awesome Pro with SVG icons in `/icons/` (EDS `:icon-name:` convention), unless a Font Awesome Pro licence is available.

## Images
- **Aspect ratios observed:** hero about 1.75:1 (desktop), offer images 5:3 (`padding-bottom: 60%`), promo banners about 0.93:1 (579×620), brand logo tiles 3:2 (105×70).
- **Object fit:** `cover` for hero and background images. `contain` for logos. Offer images are CSS `background-size: cover; background-position: center`.
- **Radius:** offer images 15px. Lounge and booking images 16–20px. Hero is square-edged on desktop and rounded on mobile.
- **Overlays:** hero scrim `rgb(0 0 0 / 35%)`. Lounge cards use an inset shadow `inset 0 -25px 25px rgb(0 0 0 / 65%)` behind captions.
- **Loading:** no `loading="lazy"` and no `srcset` on the sampled images. Separate mobile hero crops are swapped with Bootstrap visibility classes.
- **Decorative:** no illustration system. Imagery is all photography plus brand logos.
