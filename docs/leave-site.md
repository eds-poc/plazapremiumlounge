# The leave-site popup

The source's "See you again soon" popup, before a visitor leaves the site through a link to another
website. It goes to the link in the same tab after 5 seconds, unless the visitor cancels.

## Where it applies

Only to links inside an opt-in area. Nothing else on the site asks first.

| Area | How it opts in |
|---|---|
| A page section | Section Metadata `style` = `leave-site` (with other styles, e.g. `fixed-width, leave-site`) |
| The footer's Social column | Always (the footer code adds it to the column made only of icon links) |
| Any element a block builds | The block adds the class `leave-site` to it |

In an opted-in area, a link asks first when it goes to **another website** (http or https, another
domain). These links behave as before, without the popup:

- links on this site, `mailto:` and `tel:` links;
- links to an image file (they open in a viewer, e.g. the footer's WeChat QR code);
- links that open a video or a modal page (their own popups);
- download links.

## The popup

- Title "See you again soon", the source's text, and a **Cancel Redirect** button (plus ×). The
  texts are `leaveSiteTitle`, `leaveSiteText` and `leaveSiteCancel` in `scripts/i18n.js`, per site
  language.
- After **5 seconds** it closes and the link opens in the **same tab**, as the source (also a link
  that would otherwise open in a new tab).
- **Cancel Redirect** or **×** closes it and the visitor stays on the page; focus goes back to the
  link. **Esc** and a click beside it don't close it (the source's static popup).
- One redirect at a time: after a cancel, only the next link the visitor clicks redirects. Back
  after the redirect shows the page without the popup.

## For developers

`scripts/leave-site.js`:

- `installLeaveSitePrompt()`: one click listener for the whole page (installed from `loadLazy` in
  `scripts/scripts.js`), so links that blocks build later are covered too.
- `isLeaveSiteLink(link)`: the rule above; returns the link's URL, or `null`.
- `confirmLeaveSite(url, trigger)`: opens the popup for a URL from code (e.g. a button that leaves
  the site), on the site's modal (`scripts/modal-dialog.js`). Its button is centred by a rule in
  `styles/modal.css`.
