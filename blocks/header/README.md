# Header: authoring guide

The site header, as on plazapremiumlounge.com: logo, main menu, action buttons and icons. One
nav page drives every screen size:

- **Desktop (from 1200px):** a 108px bar that turns maroon when you point at it, and becomes a
  compact 70px maroon bar once the page scrolls. A menu item with one level below opens a
  dropdown; an item with more levels opens a full-width mega menu with one column per level (click
  a region or country to show its list). The cart icon opens a small dropdown.
- **Mobile and tablet:** a white bar with the logo, buttons, icons and a menu button. The menu
  slides in from the right: a dropdown becomes an accordion, and a mega menu becomes a
  step-by-step panel with back and close buttons. Language and currency sit at the bottom. On
  phones the first button becomes a full-width bar above the header.

## The nav page

The header reads the `/nav` page (or the page set in the page metadata `nav`). Each section ends
with Section Metadata `name` (Brand, Menu, Actions, Menu footer) and a `description` that explains
what it is for; the header finds its sections by name, so their order doesn't matter. Without
names, the sections are read in this order:

1. **Brand:** the logo image, an optional second image for mobile and tablet (the stacked logo),
   and a link to the homepage, e.g. [Plaza Premium Lounge](/en-uk). With no image, the link text
   is shown instead.
2. **Menu:** one bulleted list.
   - A line with a link is a menu link: `[Latest Offers](/en-uk/offers)`.
   - A line with nested bullets opens them: one level below (e.g. Discover More > links) is a
     dropdown; two or more levels (e.g. Locations > regions > countries > cities) is a mega menu.
     The parent line can be plain text.
   - Lounge-type badges go after a link as icons: `[Beijing (PEK/PKX)](/en-uk/find/…) :railway-lounge-white:`
     (`:airport-dining-white:` for airport dining). They are labelled from the icon name for screen readers.
3. **Actions:** one link per line.
   - **Bold** links are buttons: `**[Your Destination Before Departure](/en-uk/your-destination-before-departure)**`,
     `**[Book Now](#book-now)**`. With two or more, the first is the phone bar above the header.
   - A link starting with an icon is an icon action: `[:user: Log In](/modals/login)`,
     `[:globe: Language](#language)`, `[:cart: Cart](#cart)`. The text is the screen-reader label
     (and is hidden). Icons come from the icon library, then the code icons; they take the header's
     text colour.
4. **Menu footer (mobile and tablet):** the links at the bottom of the open menu, e.g.
   `[:globe: English](#language)` and `[USD](#currency)`. An icon action that links to the same
   place (Language) is hidden from the mobile bar.
5. **Modals (any number, anywhere):** sections with Section Metadata `modal` = a name, e.g.
   `language`, `currency`, `cart`, `book-now` (plus a `name` and `description` for authors). They
   are not shown in the header. Modals used across the site (e.g. Log In) are pages in the
   `/modals/` folder instead, authored once.

## What links do

- A page link (`/en-uk/offers`) opens the page; a link to another website opens in a new tab.
- A link to a `/modals/` page (e.g. `/modals/login`) opens that page as a modal; the menu or any
  dropdown closes first, and focus returns to the link when the modal closes.
- `#name` opens the modal section named `name` from the nav page (or the current page). The cart
  shows its `cart` section as a dropdown on desktop and as a modal on mobile.
- `#name` with no modal of that name fires a `header:action` event on `document`
  (`event.detail.name`, `event.detail.trigger`) for other scripts to handle, e.g. a future cart.

## Page options

- **Transparent header:** page metadata `header` = `transparent`. From 1200px the bar sits over
  the top of the page with a white logo, links and icons (for pages that start with a full-width
  hero image, like the homepage). Without it the bar is white with a colour logo and dark links,
  and the page starts below it.
- **Another nav:** page metadata `nav` = the path of another nav page.

## Notes

- Keep the menu to one list. Empty sections are skipped; without a menu section the header shows
  just the brand and actions.
- Escape closes an open dropdown, the cart and the mobile menu; a click elsewhere closes a
  dropdown or the cart.
