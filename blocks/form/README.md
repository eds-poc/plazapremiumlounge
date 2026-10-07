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
| Don't have an account? [Sign up now](…)<br>[Forgot Password?](/modals/forgot-password) | | |
| Log In | submit | outline |

- **Column 1, the label:** shown above the field (in capitals), or after the checkbox.
- **Column 2, the type:** `text`, `email`, `password`, `tel`, `number` or `checkbox`; `submit` is
  the button (column 1 is its text). Empty or unknown types are text fields.
- **Column 3, options (optional), one per line:**
  - `required`, or `required: message` for the message shown when it's left empty (default
    "Please fill in …").
  - `placeholder: text` for hint text inside the field.
  - `outline` on the button for the white button with a maroon border (default: filled maroon).
- **A row with one cell** is shown as written: text and links, e.g. "Sign up now" and
  "Forgot Password?" between the fields and the button. After the button, it's centred with maroon
  links (e.g. a **Back** link).
- **Links:** a link to a `/modals/` page opens that modal in place of the current one;
  `[Back](#close)` closes the modal.
- Empty rows are skipped. Field names come from the labels.

## In a modal

Put the form on a page in the `/modals/` folder, with a heading first: the heading becomes the
modal title (e.g. `/modals/login`). Link to the page from anywhere to open it as a modal. A modal
with a form doesn't close when the backdrop is clicked (as on the source), so typed values aren't
lost; the close button and Esc close it.
