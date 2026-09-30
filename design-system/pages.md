# Page Inventory and Page-Level Patterns

## Inventory (analysed 2026-09-30)

Every page was rendered through a real browser because the site sits behind Cloudflare bot protection. The home page was measured at 7 viewports. The others were measured at 1440px and 375px, plus 768px for some.

| Page | URL | Page type | Important UI patterns |
| --- | --- | --- | --- |
| Home | `/en-uk` | Landing | Transparent fixed header, full-bleed hero carousel with booking bar, featured booking card, "Explore" lounge tiles, latest offers (editorial panels), offer carousel, awards band, brand partner cards, newsletter, footer |
| City / lounge listing | `/en-uk/find/{region}/{country}/{city}` (e.g. Dubai) | Listing + detail | Breadcrumb, H3 airport heading (28px), lounge cards with feature tags (`.tag.pink`), booking CTAs |
| Offers listing | `/en-uk/offers` | Listing | Section H2, 2-column offer cards (image 5:3, shadow, H4), pagination, latest offers panels |
| Offer detail | `/en-uk/offers/smart-traveller` | Detail / campaign | Breadcrumb, campaign-specific typography (Helvetica Neue, navy `#002639`), accordion, forms |
| About | `/en-uk/about-us` | Content | H1 42px, core values, leadership (maroon section), partner cards |
| FAQ | `/en-uk/frequently-asked-questions` | Content | H2 title, flush accordion, 2 help cards |
| Contact | `/en-uk/contact-us` | Form | H1 42px, selects/inputs/textarea (warm fill, 25px radius), radio groups, outline submit, maroon "Need Help?" band |
| Group booking | `/en-uk/group-booking` | Form | Long single-column form, checkboxes, outline full-width submit |
| Sign up | `/en-uk/account/signupview` → `/en-uk/sign-up` | Authentication | H2 40px, form fields 45px tall, tertiary buttons |
| Lounge passes | `/en-uk/airport-lounge-passes` | Product listing (**embedded app**) | Different sub-system: "PolySans Median", `#7c0040`, `#f2d6d3`, 8px/12px radii, sort select. **Excluded from core tokens** |
| News | `/en-uk/news` → Plaza Premium Group media site | External | Different site (NeueHaasDisplay, black and white). **Excluded** |

Other public routes found in the navigation and footer but not analysed: `/your-destination-before-departure`, `/smart-traveller`, `/guest-checkout`, `/partner-portal`, `/plaza-premium-group-entertainment`, `/terms-and-conditions`, `/website-terms-of-use` and `/data-privacy-and-security-policy` (legal text pages), and `/membership/*` (behind login). There's no site search interface. The closest thing is the lounge location picker in the booking bar.

## Global chrome (every page)

```text
Page
 ├── Header (fixed desktop / 122px mobile stack)
 ├── [page content]
 ├── Newsletter band (wide container, maroon rounded panel)
 ├── Footer (#1b1b1b, 4 columns + brand family grid)
 ├── Cookie banner (fixed bottom, white, maroon "I Agree" pill)
 └── Chat launcher + back-to-top (fixed bottom-right, third party)
```

## Templates

### Landing (home, campaign hubs)
```text
Hero carousel (full-bleed, 817px @1440, title 40px) + booking bar
Featured booking card (elevated, overlaps hero)
Explore section (H2 32px centred, lounge tiles with image tags)
Latest offers (greyBg, 3 editorial panels: blush / coral / white, full-width pill buttons)
Featured offer carousel (2-up offer cards, shadowed images)
Awards / carousel band (full-bleed imagery, white H2)
Our brands (greyBg, logo cards)
Let's connect (social)
Award badges (greyBg)
```
Rules: sections alternate white and `#f5f4f1`. Section padding is 50/35/25px. Titles are centred on desktop and left-aligned on mobile.

### Listing (offers, city lounges)
```text
Breadcrumb (16px, active maroon)
Section title (H2 32px, or H3 28px on city pages)
Card grid: 2 columns desktop → 1 column mobile
Pagination (centred, maroon active)
```

### Content (about, FAQ)
```text
Page title (h1.title 42px / 30px mobile) or H2 title
Body sections (standard container 1390px)
Accordion or card pairs
Full-bleed maroon feature section (white text)
```

### Form (contact, group booking, sign-up)
```text
Page title
Intro copy
Single-column form (≈650–670px fields, 12px uppercase labels, warm pill inputs)
Outline full-width submit (44px)
Supporting maroon band ("Need Help?")
```

### Detail / campaign (offer detail)
Breadcrumb, then campaign hero and copy, then accordion or terms, then form. Campaign pages may bring their own typography (e.g. Smart Traveller). Treat this as a campaign theme, not core.
