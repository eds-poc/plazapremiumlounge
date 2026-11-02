# Partner Password: authoring guide

A partner's password page (e.g. `/en-uk/travelwise`): an image, a sentence that labels the
password field, the password field and a full-width button, in a 350px column. The visitor enters
the partner's password; on success they go on to the partner's pages.

- **Partner pages:** a page with the `partner-member-name` metadata (e.g. `travelwise`, set for the
  page in the bulk metadata sheet) shows only while the visitor has logged in for that partner.
  Without a login it sends them to the partner's password page, with the page they asked for as
  `?returnUrl=` and the partner as `?partner=` (and `&reason=expired` when their login ended).
- **The password page:** `/{site}/{partner}` (`/en-uk/travelwise` for `travelwise`), or the page
  set in the partner page's `partner-password-page` metadata (a path on this site), so several
  partners can share one password page.
- **Logging in:** the password goes to the partner login API with the partner's name. A refused
  password, a login for another partner and a failed request each show their message under the
  button. On success the visitor goes to the `?returnUrl=` page (a page on this site), else the
  **Partner page**, else the language site's home page (`/en-uk/`).

## Table

The image, then a row per text: a name, then the text in the page's language. Author all of the
texts: a message left out shows the login API's message, or a general form message, instead.

| Partner Password | |
| --- | --- |
| ![Travelwise](travelwise.jpg) | |
| Label | A password is required to access this page |
| Button | Log In |
| Required message | Please fill in password. |
| Max length message | Please enter no more than 20 characters. |
| Invalid message | Invalid password. Please try again. |
| Access message | We couldn't confirm your access to this page. Please try again. |
| Error message | We couldn't check your password right now. Please try again later. |
| Network message | We couldn't reach the server. Please check your connection and try again. |
| Expired message | Your session has expired. Please enter the password again. |
| Logout message | You have logged out. |
| Partner | travelwise |
| Partner page | [/en-uk/offers/travelwise](/en-uk/offers/travelwise) |
| Max length | 20 |

| Row | Where it shows |
| --- | --- |
| Label | Above the field: the field's label |
| Button | The button |
| Required message | Under the field: no password |
| Max length message | Under the field: a password longer than Max length (only with a Max length row) |
| Invalid message | Under the button: the password was refused |
| Access message | Under the button: the login isn't for this partner |
| Error message | Under the button: the login service failed |
| Network message | Under the button: the login service couldn't be reached |
| Expired message, Logout message | Under the button on arrival (`?reason=expired`, `?reason=logout`) |

- **Partner** (optional): the partner's name, as in the partner pages' `partner-member-name`.
  Without it, the address's `?partner=`, else the page's own name (`/en-uk/travelwise` →
  `travelwise`).
- **Partner page** (optional): where to go after logging in when there's no `?returnUrl=`, a link
  or path on this site.
- **Max length** (optional): the password's longest length, a whole number (e.g. `20`). Without
  it (or with `0` or text), the password has no length limit; the preview console warning lists
  it.
- Row names ignore capitals and spaces; the rows can be in any order. Rows of one cell are read as
  the Label, then the Button.

On preview pages (`*.aem.page`), the browser console lists the text rows the block didn't find and
the rows it doesn't know, so a mistyped row name shows up there.
