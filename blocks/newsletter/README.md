# Newsletter: authoring guide

The live site's "Subscribe to our Newsletter!" band: a maroon panel with a heading and copy on the
left and a sign up form on the right. It is authored once, in the footer page (`/en-uk/footer`),
and shows above the footer on every page, except the pages with `hide-newsletter`. Authors
write the texts; the block's code sets the fields' keys and rules, the layout, the arrow button and
where it's sent (the `newsletter` endpoint, a placeholder until the newsletter API exists).

## Where: the first section of the footer page

The Newsletter table in its own section at the top of `/en-uk/footer`. Each language footer
(`/zh-cn/footer`, …) has its own; a footer without one shows no band.

## Table: 5 columns

| Newsletter |  |  |  |  |
| --- | --- | --- | --- | --- |
| ### Subscribe to our Newsletter! |  |  |  |  |
| Keep up to date with Plaza Premium Lounges |  |  |  |  |
| firstName | First Name | First Name | yes | Please fill in first name. |
| lastName | Last Name | Last Name | yes | Please fill in last name. |
| email | Email Address | Email Address | yes | Please fill in email address. |
| isAgree | By submitting my information, I agree to the [Privacy Policy](/en-uk/data-privacy-and-security-policy) of Plaza Premium Group. |  | yes | You must agree to the Privacy Policy to subscribe. |
| submit | Subscribe |  |  |  |
| success | Thank you for subscribing! |  |  |  |
| error | Sorry, we couldn't subscribe you. Please try again. |  |  |  |

- **One-cell rows before the first field**: the heading and copy on the left.
- **Field | Label | Placeholder | Required | Error**: the field's name (`firstName`, `lastName`,
  `email` ✱, `isAgree` ✱; ✱ always required), its label, placeholder, `yes` when required, and
  the message when it's left empty (a second line: when the format is wrong).
- **submit**: the button's name (read out by screen readers); it shows as an arrow in the email
  field. **success** / **error**: the messages after sending.

## hide-newsletter: pages without the band

The `hide-newsletter` column of the site's metadata sheet (`/metadata`): `true` on a page's row
hides the band on that page; a row's URL can be a page or a pattern (`/en-uk/drafts/**`).

| URL | … | hide-newsletter |
| --- | --- | --- |
| /en-uk/sign-up-successful-page |  | true |

A page's own Metadata table can set it too (`hide-newsletter | true`). The sheet's change shows
once the sheet is previewed (and on the live site once it's published). On a hidden page no
fields are built and nothing is sent.

## Look

As the live site: a maroon panel with 30px corners, 50px from the page edges and 20px above and
below; white labels, outlined white fields with faint placeholders, a white round checkbox with a
maroon tick; light pink error messages. On phones it spans the screen and the text sits above the
form.
