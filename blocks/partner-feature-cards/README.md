# Partner Feature Cards: authoring guide

Partner offer cards (source `/en-uk/rockinthunder`, "Americas 2-Visit Pass" and "Vino Volo Set
Meal"): white rounded cards with the price in a grey box and a list of benefits.

## Table: one row per card

| Partner Feature Cards | | | |
| --- | --- | --- | --- |
| AMERICAS COMFORT<br>### Americas 2-Visit Pass<br>The essential passport for airport lounge relaxation | CAD<br>111.20<br>/ Pass Bundle | - **2 Lounge Visits:** Redeemable at participating Plaza Premium Lounges across the Americas.<br>- **12-Month Validity:** Enjoy full flexibility…<br>- **Fully Shareable:** Bring along festival friends… | |
| PREMIUM DINING<br>### Vino Volo Set Meal<br>Boutique airport wine lounge & dining before you depart | CAD<br>48.65<br>/ Meal Ticket | - **Custom Set Meal:** Curated chef-prepared meal options…<br>- **Canada-Wide Locations:** …<br>- **Warm Airport Oasis:** … | Exclusive Dining Offer |

| Cell | Fields |
| --- | --- |
| 1. Content | **Eyebrow** (the line before the heading), **Title** (a heading, heading 3 on the source), **Description** (the line after it) |
| 2. Price | **Currency**, **Price**, **Price Label**: one per line. One line also works, e.g. `CAD 111.20 / Pass Bundle` |
| 3. Benefits | One per list item or line: the **bold** start is the **Benefit Title**, the rest the **Benefit Description** |
| 4. Badge (optional) | Text for the badge, e.g. `Exclusive Dining Offer`. It also highlights the card: maroon border, deep shadow, maroon eyebrow and price |

Add or delete rows to change the number of cards. Leave out a cell and its part is left out.

## Layout

Mobile first: one card per row, the badge above the eyebrow. From 768px two cards side by side,
32px in from the section sides; from 1024px the badge sits top right and the price is 48px, as
on the source. Put the block in a section without a background, after Partner Festival Content.
