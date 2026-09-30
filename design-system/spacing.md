# Spacing System

The site has no formal spacing scale. It uses hand-authored px values that cluster on a **5px rhythm** (5, 10, 15, 20, 25, 30, 35, 50). On top of that sit Bootstrap 5 defaults: the 12px half-gutter, `.25rem`-based utilities, and 8px/12px/16px in components.

The scale below lists the values that repeat across pages. Frequencies come from the padding and margin values of visible elements on the home page at 1440px.

| Token | Value | Frequency (home, padding+margin) | Typical usage | Confidence |
| --- | ---: | ---: | --- | --- |
| `--spacing-1` | 2px | 57 | Label→input gap in hero booking bar, tag/list-item block padding | High |
| `--spacing-2` | 5px | 46 | Button block padding, breadcrumb item padding, footer link gap | High |
| `--spacing-3` | 8px | 32 | H3/H4 margin-bottom, icon gaps (flex `gap: 8px`) | High |
| `--spacing-4` | 10px | 41 | Header CTA inline padding, small gaps | High |
| `--spacing-5` | 12px | 82 | Container inline padding (Bootstrap), select padding | High |
| `--spacing-6` | 15px | 57 | Footer heading margin, mobile container padding, `.btn` margin-bottom | High |
| `--spacing-7` | 20px | 93 | `p` margin-bottom, card padding, button inline padding | High |
| `--spacing-8` | 25px | 10 | Input inline padding, accordion row block padding, mobile section padding | High |
| `--spacing-9` | 30px | 26 | Title-wrapper margin-bottom, large button padding, newsletter inline padding | High |
| `--spacing-10` | 35px | 8 | Section H2 margin-bottom (≥992px), default section padding (768–991px) | High |
| `--spacing-11` | 50px | 31 | Section block padding (≥992px), wide container padding, footer top padding | High |
| `--spacing-12` | 80px | 8 | Large feature sections | Medium |

## Semantic spacing (responsive)

| Token | <768px | 768–991px | ≥992px | Source |
| --- | --- | --- | --- | --- |
| `--section-padding-block` | 25px | 35px | 50px | `section { padding: 35px 0 }`, `@max 767.98 → 25px`, `@min 992 → 50px` |
| `--section-title-gap` | 25px | 25px | 35px | `section h2 { margin-bottom: 25px }`, `@min 992 → 35px` |
| `--container-padding` | 15px | 12px | 12px | Measured `.container-fluid` |
| `--container-wide-padding` | 0 | 50px | 50px | Measured `.long-container` |

## Component spacing (measured)

| Element | Value |
| --- | --- |
| Heading → content | H2 section: 35px/25px. H3/H4: 8px. Card subtitle: 10px |
| Paragraph | margin-bottom 20px. List items padding `2px 5px` |
| Buttons | `.btn` padding `5px 20px`. Header CTA `5px 10px`. Large submit `9px 20px`. `.btn-secondary` `15px 30px`. margin-bottom 15px |
| Cards | Help card padding 20px. Partner card `50px 30px`. Newsletter panel `30px 50px` |
| Forms | Input padding `10–12px 20–25px`. Label → input 16px (content forms). Field gap ≈ 20px |
| Grid | Bootstrap gutter 24px (1.5rem). Flex gaps 8/10/12/16px |
| Footer | padding `50px 0 15px`. Column heading margin 15px. Link spacing 5px |

Spacing is not fluid. It only changes at the 768px and 992px breakpoints listed above.
