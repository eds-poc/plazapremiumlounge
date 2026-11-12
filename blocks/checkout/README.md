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
- On phones the lounge's details fold away under an arrow.

**Where the cart comes from:**
- The cart is the one in `scripts/cart-state.js`.
- It's read again from the booking system on every visit, so the prices are its own. A tab without the cart's data shows the site's loader first.
- The summary follows the cart: another tab's change, or the cart emptied.

**Lounge vs pass:**
- A **lounge** checkout asks for the flight: the airline and the flight number.
- A **pass** checkout doesn't, as the source's.
- The terms under the Terms & Conditions box are the cart's own (`sortedTermsPolicies`): each policy's name, then its text.

**Payment:**
- It stays disabled (grey) until the Privacy Policy and the Terms & Conditions boxes are ticked. That's the source's rule.
- A click checks every field and moves focus to the first one in error.
- A valid form is announced as `checkout:payment` (see below), because the payment API isn't in yet.
- On the preview (`.aem.page`, localhost), the `pending` text shows at the top of the form.

Make the page `noindex` (metadata `robots: noindex, nofollow`).

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
| flight | Arrival / Departure Flight | | | |
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

| Promo (card) |
| --- |
| **Book your visit with Smart Traveller**<br>**Smart Traveller** members get up to **20% off** and up to **150 ST points** per eligible visit. Register now and unlock a world of exciting benefits! Already a member? Login now!<br>[Log In](#login)<br>**[Sign up now](/en-uk/join-smart-traveller)** |

- The Smart Traveller banner: the first link is the outline button, a **bold** link the filled one;
  `#login` opens the login pop-up. Leave the block out for no banner.

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

- The promo code (the mini cart's, PR #97).
- The "DEPARTURES LOUNGE" badge (no cart field known for it).
- A login for products that require one (`isStLoginMandatory`).
- The source's "leave the booking journey" pop-up.
- Analytics.
