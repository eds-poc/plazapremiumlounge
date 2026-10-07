# Form: authoring guide

A simple form, as in the source login and forgot-password modals: uppercase labels over rounded
grey fields, a round checkbox, text or links between the fields, and a full-width button. It
checks required fields and shows their messages; **sending the form is not built yet** (it fires a
`form:submit` event that a later script can handle).

## Table: one row per field

| Form | | |
| --- | --- | --- |
| Email Address | email | required: Please fill in email address. |
| Password | password | required: Please fill in password. |
| Remember me | checkbox | |
| Don't have an account? [Sign up now](…)<br>[Forgot Password?](/en-uk/modals/forgot-password) | | |
| Log In | submit | outline |

- **Column 1, the label:** shown above the field (in capitals), or after the checkbox.
- **Column 2, the type:** `text`, `email`, `password`, `tel`, `number` or `checkbox`; `choice`
  for a group of boxes to pick one from; `submit` is the button (column 1 is its text). Empty or
  unknown types are text fields.
- **Column 3, options (optional), one per line:**
  - `required`, or `required: message` for the message shown when it's left empty (default
    "Please fill in …").
  - `placeholder: text` for hint text inside the field.
  - `outline` on the button for the white button with a maroon border (default: filled maroon);
    `large` for the large light button (e.g. Apply); `close` to close the modal after submitting.
  - `name: field-name` for the field's name, for labels without Latin letters (e.g. Chinese:
    `电子邮件地址` with `name: email-address`), so every language sends the same names.
- **Choice rows (e.g. Language, Currency):** column 3 lists the choices, one per line: text
  (`GBP`) or a link (`[English](/en-uk)`). They show as boxes, three to a row. The selected one is:
  for a group named **Currency**, the visitor's currency (the one they applied, else the one for
  their location); for links, the one for this page's site (e.g. `/en-uk/…`); else a choice ending
  in `(selected)`; else the first. A line `name: currency` (or `name: language`) names the group,
  for labels in other languages (e.g. 货币). Applying a Currency remembers it for the visitor and updates the
  header.
- **A row with one cell** is shown as written: text and links, e.g. "Sign up now" and
  "Forgot Password?" between the fields and the button. After the button, it's centred with maroon
  links (e.g. a **Back** link).
- **Links:** a link to a `modals` folder page opens that modal in place of the current one;
  `[Back](#close)` closes the modal.
- Empty rows are skipped. Field names come from the `name:` option, else the label; each name is
  used once per form (a repeat gets `-2`).

## In a modal

Put the form on a page in the site's `modals` folder, with a heading first: the heading becomes
the modal title (e.g. `/en-uk/modals/login`, `/zh-cn/modals/login`). Link to the page from anywhere to open it as a modal. A modal
with a form doesn't close when the backdrop is clicked (as on the source), so typed values aren't
lost; the close button and Esc close it.

- **One group of a page:** add `#` and the group name to the link, e.g.
  `/en-uk/modals/language-currency#currency` opens only the Currency group, titled "Currency" (the phone
  menu's currency label does this).
- **Square modal:** Section Metadata `style` = `square` on the modal page gives the square corners
  and larger title of the source Language and currency modal.
