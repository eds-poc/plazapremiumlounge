# Footer: authoring guide

The footer is a Document Authoring (DA) document per language site: `/en-uk/footer`, `/zh-cn/footer`. A page uses the one set in the metadata `footer` (the bulk metadata sheet sets it per site folder; a page's own `footer` metadata wins), else the footer of its site folder, else `/en-uk/footer`; a site without a footer page yet gets the English one. The block loads it with `loadFragment`, so write plain content. You don't need class names, and you don't need any tables except the brand table.

## Structure: 3 sections, in this order (separate them with `---`)

### 1. Link columns: one bulleted list
Each top-level bullet is a column. Its first line is the column title, and a nested list holds the column content.

```
- Company
  - [About](/en-uk/about-us)
  - [Offers](/en-uk/offers)
- Social
  - [:facebook:](https://www.facebook.com/…) [:instagram:](https://www.instagram.com/…) [:wechat:](/.footer/wechat-qr.jpeg)
- Downloads
  - Join Smart Traveller, the largest global travel membership.
  - [:appstore:](https://apps.apple.com/…) [:playstore:](https://play.google.com/…)
```

- **Links in a nested list** become the column's link list, which opens in the same tab.
- **Icons** are written as `:name:`. They use the SVGs in `/icons/`: `facebook`, `instagram`, `wechat`, `twitter`, `rednote`, `appstore`, `playstore`. Put several icons on one line to make an icon row. Link each icon, because icon links open in a new tab and get an accessible label from the icon name or the link title.
- **Plain text** becomes a paragraph, such as the Downloads tagline.
- **A link to an image file** (`.jpg`, `.png`, `.webp`), such as the WeChat QR code, opens that image in a lightbox instead of navigating.
- Headings (any level) followed by lists also work, if you prefer them to a nested list.

### 2. Brand family: a `Columns (footer-brands)` table
- **A cell with only an image** is the group logo, shown on the left on desktop and on top on mobile.
- **A cell with a heading** is a brand group: the heading is the caption, followed by one or more logos.
- **To link a logo**, link the image itself, or put the URL on its own line directly under the image.
- Give every logo **alt text** (the brand name).
- **Order matters**, as on the source: the groups are laid out by position (the 1st and 2nd share the first row, 60% and 35%; the 3rd, 4th and 5th share the second, 35/35/25%), and each position has the source's logo sizes. A 6th or later group gets the 35% width and the default logo size.

### 3. Legal: one paragraph
The copyright text, with inline links. These links open in a new tab.

## Behaviour
- **Desktop (768px and up):** 4 columns, then the brand band, then the legal row. From 992px the brand band is full width: the group logo at the left, then the captioned groups in two rows with dividers. From 768px to 991px the group logo sits above the groups, without dividers.
- **Mobile:** the column titles become accordions (several can be open at once), and the brand band stacks, one group per row with an underlined caption (320px wide from 576px, 220px below).
- **Hover:** links and logos fade to 80% opacity.
- **Adding or removing** a column, brand group or logo only needs a content edit, never code.
