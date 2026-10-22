# Newsletter: authoring guide

The live site's "Subscribe to our Newsletter!" band: a maroon panel with a heading and a line of
copy on the left and a sign up form on the right. It is authored once, in the footer page
(`/en-uk/footer`), and shows above the footer on every page, except the pages listed in the
section's `hide-on`.

The form is a Custom Form (its guide is the test page `/en-uk/drafts/blocks/custom-form`): the
same rows, field types, settings and messages. The
Newsletter adds the maroon panel, the text beside the form, `hide-on` and the arrow button.

## Where: the first section of the footer page

Put the Newsletter table in its own section at the top of `/en-uk/footer` (before the footer
navigation). Each language footer (`/zh-cn/footer`, …) has its own; a footer without one shows no
band. The table can also be used in any page, where it shows in place.

## Table

| Newsletter |  |  |
| --- | --- | --- |
| ### Subscribe to our Newsletter! |  |  |
| Keep up to date with Plaza Premium Lounges |  |  |
| Form | settings | action: newsletter<br>success: Thank you for subscribing!<br>error: Sorry, we couldn't subscribe you. Please try again. |
| First Name | text | key: firstName<br>rule: name<br>placeholder: First Name<br>max length: 200<br>required: Please fill in first name. |
| Last Name | text | key: lastName<br>rule: name<br>placeholder: Last Name<br>max length: 100<br>required: Please fill in last name. |
| Email Address | email | key: email<br>placeholder: Email Address<br>max length: 200<br>width: full<br>required: Please fill in email address. |
| By submitting my information, I agree to the [Privacy Policy](/en-uk/data-privacy-and-security-policy) of Plaza Premium Group. | checkbox | key: isAgree<br>value type: boolean<br>required: You must agree to the Privacy Policy to subscribe. |
| Subscribe | submit | inside: email |

- **Text rows** (one cell, above the first field): the heading and copy on the left of the form.
  Leave them out for a form alone.
- **Field rows**: label | type | settings, as in Custom Form. First Name and Last Name sit side by
  side; `width: full` gives a field the whole row.
- **settings row**: `action` (default `newsletter`), `success` (the message that replaces the
  form) and `error` (the message at the top when sending fails).
- **submit row**: the button text (read out by screen readers), with `inside: email` to show it as an
  arrow inside the Email Address field. Without `inside` it's a button under the
  form; add `style: white` for the white outline.

## hide-on: pages without the band

The section's Section Metadata, under the Newsletter table:

| Section Metadata |  |
| --- | --- |
| section-name | footer-newsletter |
| hide-on | /en-uk/sign-up-successful-page |

`hide-on` lists the pages the band isn't shown on, separated by commas; add a page by adding its
path. `all` hides it on every page (to switch the band off without deleting it).

| Written as | Hides the band on |
| --- | --- |
| `all` | every page |
| `/en-uk/sign-up-successful-page` | that page (with or without `.html` or a trailing `/`) |
| `/en-uk/drafts/*` | every page under `/en-uk/drafts/` |
| `/sign-up-successful-page` (no language folder) | that page in every language site |

On a hidden page only the Newsletter's own small script and styles load: no form, no fields.

## Options

Added to the block name, e.g. `Newsletter (text-right)`:

- `text-right`: the form on the left, the text on the right.
- Any Custom Form option, e.g. `compact`.

## Look

As the live site: a maroon panel with 30px corners, 50px from the page edges and 20px above and
below; white labels, outlined white fields, a white round checkbox; light pink error messages. On
phones it spans the screen and the text sits above the form.
