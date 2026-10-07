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

Each language site has its own nav page: `/en-uk/nav`, `/zh-cn/nav`. The header reads the page
set in the metadata `nav` (the bulk metadata sheet sets it per site folder; a page's own `nav`
metadata wins), else the nav page of the page's site folder, else `/en-uk/nav`; a site without a
nav page yet gets the English one. Each section ends
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
   - A link starting with an icon is an icon action: `[:user: Log In](/en-uk/modals/login)`,
     `[:globe: Language](/en-uk/modals/language-currency)`, `[:cart: Cart](#cart)`. The text is the screen-reader label
     (and is hidden). Icons come from the icon library, then the code icons; they take the header's
     text colour.
4. **Menu footer (mobile and tablet):** the links at the bottom of the open menu, e.g.
   `[:globe: English](/en-uk/modals/language-currency#language)` and
   `[USD](/en-uk/modals/language-currency#currency)`. A currency link written as a code shows the
   visitor's currency (the one they applied, else the one for their location). An icon action that
   links to the same page (Language) is hidden from the mobile bar.
5. **Modals (any number, anywhere):** sections with Section Metadata `modal` = a name, e.g.
   `cart`, `book-now` (plus a `name` and `description` for authors). They are not shown in the
   header. Modals used across the site (Log In, Language and currency) are pages in the site's
   `modals` folder instead (`/en-uk/modals/`, `/zh-cn/modals/`), authored once per language; each
   language's nav links to its own.

## What links do

- A page link (`/en-uk/offers`) opens the page; a link to another website opens in a new tab.
- A link to a `modals` folder page (e.g. `/en-uk/modals/login`) opens that page as a modal; the menu or any
  dropdown closes first, and focus returns to the link when the modal closes.
- `#name` opens the modal section named `name` from the nav page (or the current page). The cart
  shows its `cart` section as a dropdown on desktop and as a modal on mobile.
- `#name` with no modal of that name fires a `header:action` event on `document`
  (`event.detail.name`, `event.detail.trigger`) for other scripts to handle, e.g. a future cart.

## Logged-in user

When a user is logged in, the user icon action (the link with `:user:`) shows their initials in
a circle (e.g. "KJ") instead, and clicking it opens the account menu: a dropdown under the badge
on desktop, a "View Profile" panel on tablet and mobile (full screen on phones).

- **Account menu section** in the nav page (Section Metadata `name` = Account menu): a heading
  (the panel title, e.g. View Profile) and a bulleted list of links, e.g.
  `[Profile](/en-uk/membership/update-profile)`, `[Change Password](…)`, `[Manage Booking](…)`,
  `[Logout](#logout)`. Page links show an arrow in the panel; `#logout` (no modal of that name)
  fires `header:action` with `name: 'logout'` for the login code.
- **Not connected to a real login yet:** `scripts/logged-in-user.js` holds a temporary flag
  (off) and a sample name. Add `?logged-in` to a page address to preview the logged-in header.
  Logged out, nothing changes and the Account menu section isn't shown.

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
