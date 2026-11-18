# Checkout: authoring guide

The guest checkout (the source's `/en-uk/guest-checkout`, its **Details** step) for the cart this
site holds.

The block is the part of the page that comes from the cart: the guest's details form, the boxes,
the cart's terms, and beside them (a third of the row, from 992px) the **Booking Summary** card with
**Payment**. The steps band, the way back and the banner above it are blocks of their own (see
[The guest-checkout page](#the-guest-checkout-page)).

**Below 992px:**
- The summary comes first, then the form.
- A bar at the bottom of the screen shows the total and **Payment**.
- The lounge's details fold away under an arrow (as the source's, up to 991px).

**Where the cart comes from:**
- The cart is the one in `scripts/cart-state.js`.
- It's read again from the booking system on every visit, so the prices are its own. The block doesn't wait for it (`decorate` is synchronous), so the page, its header and footer load at once, and the booking system's answer redraws the summary when it comes. A tab with the cart's data shows it meanwhile (an unreadable answer keeps it as it is). A tab without it keeps the site's loader up over the page until the cart is in (`holdLoader` in `scripts/scripts.js`, which outlasts the page's own load), then shows the summary, the homepage for an empty cart, or the error text.
- The summary follows the cart: another tab's change, or the cart emptied.
- **No cart** (none, an empty one, or emptied while on the page, e.g. from the mini cart): the
  visitor goes to the language's homepage (`/en-uk/`), as the source's (its server answers 302).
  The address is replaced, so Back doesn't return here. Not on the preview (`.aem.page`,
  localhost) or in the block library, where the page shows "Please add item" for authors. A
  cart that can't be read keeps the `error` text.

**A logged-in member** (the login pop-up's session, `scripts/auth.js`): the form is filled with
their details, as on the source (its server fills the form for a member). Nothing to author.
- Read once from GetProfile with the member's login (`readProfile` in `scripts/member.js`) and kept
  nowhere.
- **Title** ← `salutation` (matched to the authored options, "Mr" = "Mr."; on the other
  languages' pages by its place: author the options in the order Mr., Mrs., Ms., Miss), **First Name**,
  **Last Name** ← `firstName`, `lastName`, **Email Address** and **Confirm Email Address** ←
  `userName`, **Contact No.** ← `phone` (digits), **Country of Residence** ← `countryName` (matched
  by name, as the Profile Form: `findCountryByName` in `scripts/forms.js`).
- The dial code follows the country of residence, as when a visitor picks one (for a shared code
  such as +1, the country's own, e.g. "+1 (CA)"), and as on the source, whose dial code starts from
  the country its server selects. The profile's own `countryPhoneCode` isn't used. Without a
  matched country it stays +1 (US).
- The flight and partner fields stay empty (the profile has none).
- Only empty fields are filled: what the visitor typed or chose meanwhile stays (a country chosen
  meanwhile keeps its dial code).
- **First Name**, **Last Name**, **Email Address** and **Confirm Email Address** can't be edited
  once filled: they're read-only (still focusable, read out and sent with Payment), their text in
  a darker grey. A value its field's rules refuse (for example a broken email) stays editable so
  the member can put it right; the confirmation is locked only with the email. Title, Contact No.,
  Country of Residence and the rest stay editable.
  No message shows; the values are checked on Payment, as typed ones.
- A guest makes no request. A profile that can't be read (an error, refused, no answer within 5s)
  leaves the form empty, with no message; an expired login already logs out on page load.

**The summary, as the source's:**
- A lounge: its name, location, Date / Time / Guests / Services; a pass: its name, Quantity and
  price, and the "For me" pill (the source's for a pass not bought as a gift; this site doesn't
  sell gifts yet). Below 992px each line's details fold away under an arrow (→ open, ↓ folded).
- **The look, as the source's** (checked against it on 2026-11-17 at 13 widths, see
  `.migration/plans/guest-checkout-ui-audit.md`):
  - the dropdowns' arrow 12px in from the right
  - a ticked box filled maroon with a white check
  - a field with an error has no red border: a red "!" shows inside it at the right, with its
    message right under it
  - the terms' lists indented 40px, their items 8px apart
  - the summary: the discount's amount in maroon (it wraps with its label when narrow), a pass's
    price in black, "(Includes applicable taxes and fees)" 11px grey at every width, Payment light
  - the phone bar: 15px in from the edges (12px from 768px); its Payment 14px from 576px
- Above a lounge's name, the **Departures / Arrivals badge**, as the source's: a burgundy pill with
  a plane and "DEPARTURES LOUNGE" (or "ARRIVALS LOUNGE"), from the words in the lounge's location
  ("Near Gate 1, Departures, …"): departure, 出境, 離境, 离境, 出発 or partida make it Departures;
  otherwise arrival, 入境, 到着 or chegada make it Arrivals; neither, no badge. Its tip ("Located
  after security & immigration …") shows on hover, keyboard focus or a click, to its right (above
  it up to 480px); a second click, a click elsewhere or Escape hides it. The labels and tips are
  the source's in each language (`cartBadge…` in `scripts/i18n.js`). On the source a Tag Manager
  tag adds it; here the block does, with nothing to author.
- Service Total and the discounts under a line, then **the promo code** (the mini cart's field and
  texts: codes typed in capitals, Enter or the arrow applies, an applied code shows with ✕ to take
  it off), then Total with "(Includes applicable taxes and fees)" under the amount, and Payment.

**The form, as the source's:**
- Leaving an empty field shows nothing; the format messages (contact number, emails) show when
  the visitor leaves the field, and every message on Payment.
- First and last names lose trailing spaces when left (leading ones stay).
- Arrival / Departure Flight: the airlines in its row's Placeholder cell, one per line (live's 136,
  the same for every lounge), open under the field when the visitor goes into it; typing keeps the
  airlines holding what's typed (any case), a click (or ↓ ↑ and Enter) fills the field, Escape or
  leaving closes the list. Any other text stays allowed, as the source's.
- Contact No.: one rounded field, the dial code shown short ("+1", following the country) at its
  left, its part as wide as the code (55px for +1, 76px for +374, as the source's); it stays a
  real dropdown for the keyboard and screen readers.
- The Privacy Policy and newsletter boxes' links open in a new tab.

**Lounge vs pass:**
- A **lounge** checkout asks for the flight: the airline and the flight number.
- A **pass** checkout doesn't, as the source's.
- The terms under the Terms & Conditions box are the cart's own (`sortedTermsPolicies`): each policy's name, then its text.

**Payment:**
- It stays disabled (grey) until the Privacy Policy and the Terms & Conditions boxes are ticked. That's the source's rule.
- A click checks every field and moves focus to the first one in error.
- A valid form is announced as `checkout:payment` (see below), because the payment API isn't in yet.
- On the preview (`.aem.page`, localhost), the `pending` text shows at the top of the form.

Make the page `noindex` (metadata `robots: noindex, nofollow`) and give it the checkout header
(metadata `header: checkout`: no Book Now, no cart icon, as the source's).

## Table: field rows and text rows

Field rows have 5 columns: **Field | Label | Placeholder | Required | Error**, as the Signup Form's.
- **Placeholder:** Title's cell holds the empty choice ("Select"), then one option per line.
- **Error:** its first line is the message when the field is empty; its second line, when the value is wrong.

Text rows have 2 columns: **Key | Text**. A one-cell row is text in the form, e.g. the intro (it
stays in the form's column, beside the summary).

| Checkout | | | | |
| --- | --- | --- | --- | --- |
| Please fill in the information of the customer who will be enjoying our facilities. | | | | |
| title | Title | Select<br>Mr.<br>Mrs.<br>Ms.<br>Miss | yes | Please select title |
| firstName | First Name | | yes | Please fill in first name. |
| lastName | Last Name | | yes | Please fill in last name. |
| countryOfResidence | Country of Residence | Select | yes | Please fill in Country of Residence |
| phone | Contact No. | | yes | Please fill in contact number<br>Please fill in valid contact number |
| email | Email Address | | yes | Please fill in email address.<br>Please enter a valid email address |
| confirmEmail | Confirm Email Address | | yes | Please retype the email address<br>Email do not match |
| flight | Arrival / Departure Flight | Cathay Pacific (CX)<br>Hong Kong Airlines (HX)<br>Malaysia Airlines (MH)<br>… | | |
| flightNumber | Flight Number | | | (empty line)<br>Flight number must be a maximum of 4 digits. |
| partnerId | Partner / Membership ID | | | |
| partnerName | Partner Name | | | |
| consent | By submitting my information, I agree to the [Privacy Policy](/en-uk/data-privacy-and-security-policy) of Plaza Premium Group. | | yes | You must agree to the Privacy Policy to subscribe. |
| newsletter | I would like to subscribe and receive updates and news about Plaza Premium Lounge. … | | | |
| terms | I have read and agree to the [Terms & Conditions](/en-uk/terms-and-conditions) including the following: | | yes | |
| termsHeading | Terms and Conditions | | | |
| summary | Booking Summary | | | |
| payment | Payment | | | |
| empty | Please add item | | | |
| error | We couldn’t load your cart. Please try again later. | | | |
| pending | Your details are complete. Payment isn’t connected yet on this site. | | | |

- **Field order:**
  - The fields show in the order of their rows, two per row from 768px. First Name starts a new row, so Title sits alone.
  - A field whose row is left out isn't asked for.
  - A row's label cell may hold links: the boxes' Privacy Policy and Terms & Conditions.
- **The source's rules:**
  - **Names:** at most 200 characters, trimmed.
  - **Contact number:** digits only (anything else typed or pasted is left out), at most 12. The country code and the number together must be 7 to 15 digits.
  - **Country code:** +1 (US) to start with. It follows the country of residence.
  - **Emails:** the confirmation must match.
  - **Flight number:** digits only, at most 4; "7" becomes "007" when the visitor leaves it.
- **Retired rows:** `steps`, `phoneStep`, `back` and `banner` are now the Booking Steps, Title
  (back) and Promo (card) blocks. A page that still has them shows the checkout without them.
- **empty, error:** the summary's text without a cart, and when the cart can't be read.
- **The summary's own labels** come from the site's cart texts in each language: Date:, Time:, hrs, Guests:, Services:, Service Total, Quantity:, Total, (Includes applicable taxes and fees). They're the same as the mini cart's.

## The guest-checkout page

`/{lang}/guest-checkout`, one section, in this order. The texts are each language's own.

| Booking Steps |
| --- |
| - Lounges<br>- Book<br>- **Details**<br>- Confirm & Pay |
| Details |

- The steps band (see the Booking Steps guide): the **bold** step is the current one; row 2 is its
  name on phones (optional). First in the section, so it sits right under the header.

| Title (back) |
| --- |
| # [Back to Edit Booking](/en-uk/makeabooking) |

- The way back: a heading 1 written as a link, shown with the maroon arrow before it. Point it at
  the booking page (the mini cart's Edit).

| Promo (card, guests-only) |
| --- |
| **Book your visit with Smart Traveller**<br>**Smart Traveller** members get up to **20% off** and up to **150 ST points** per eligible visit. Register now and unlock a world of exciting benefits! Already a member? Login now!<br>[Log In](/en-uk/modals/login)<br>**[Sign up now](/en-uk/join-smart-traveller)** |

- The Smart Traveller banner: the first link is the outline button, a **bold** link the filled one;
  `/{lang}/modals/login` (the header's Log In page) opens the login pop-up over the checkout.
  `guests-only` leaves it out for a logged-in member, as the source's (the checkout then comes
  right under the back title). Leave the block out for no banner.

| Checkout | | | | |
| --- | --- | --- | --- | --- |
| Please fill in the information of the customer who will be enjoying our facilities. | | | | |
| title | Title | Select<br>Mr.<br>Mrs.<br>Ms.<br>Miss | yes | Please select title |
| … | | | | |

- The rest of the page, as in the table above.

| Metadata | |
| --- | --- |
| Title | Guest Checkout \| Plaza Premium Lounge |
| robots | noindex, nofollow |
| header | checkout |

- Last, inside the same section.

## Payment (no API yet)

On a valid form, the block announces on `document`:

```js
document.addEventListener('checkout:payment', (e) => {
  const { guest, cart } = e.detail;
  // guest: { title, firstName, lastName, countryOfResidence (a GetCountries countryId),
  //   contactNumber, phoneCountryCode, emailAddress, confirmEmailAddress,
  //   arrivalDepartureFlight, flightNumber (lounges only), partnerId, partnerName,
  //   consent, newsletter, termsAgreed }
  // cart: the cart's summary (scripts/cart-state.js), with its cartId
});
```

The source sends the same details to `/{lang}/purchaser/postguestcheckout`. When that succeeds it subscribes to the newsletter (if ticked), then calls `/loungereviewbooking/forwardtomag`, which answers the payment page's address.

That step needs the booking system's own APIs, which this site doesn't have yet:
- the guest details
- the payment hand-off
- the newsletter

## Not yet

- A pass bought as a gift: the "Gift" pill and the "Buying for yourself or someone else?" steps
  (the passes page has no gift mode yet).
- A login for products that require one (`isStLoginMandatory`).
- The source's "leave the booking journey" pop-up.
- Analytics.
