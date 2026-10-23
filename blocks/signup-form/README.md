# Signup Form: authoring guide

The sign up form (the live site's `/en-uk/sign-up`). Authors write the texts; the block's code sets
everything else: the field types, the keys sent to the Register API, the rules, the layout, and the
redirect to the confirmation page (`/en-uk/sign-up-successful-page`, in the visitor's language).

## Table: 5 columns

| Signup Form |  |  |  |  |
| --- | --- | --- | --- | --- |
| *Field* | *Label* | *Placeholder* | *Required* | *Error* |

- **Field**: the field's name (from the list below). Rows with other names are left out.
- **Label**: the visible label. Checkbox labels keep their links.
- **Placeholder**: the hint in an empty field. For **Title**: the empty choice on the first line
  (`Select`), then one option per line; `Mr. = Mr` shows "Mr." and sends "Mr".
- **Required**: `yes`, or empty. Fields marked ✱ are always required.
- **Error**: line 1, the message when the field is left empty; line 2 (optional), the message when
  the format is wrong (or, for the confirm fields, when they don't match).
- **A one-cell row**: a line of text shown in place (e.g. the line above a checkbox).
- **submit**, **error** rows: the button text, and the message when the account can't be created.
- Rows show in the order authored; an optional row can be deleted.

## Fields

| Field | What it is |
| --- | --- |
| `title` | Title dropdown |
| `firstName` ✱ | First name: letters, apostrophes and hyphens, at most 200 |
| `lastName` ✱ | Last name: the same rule |
| `countryOfResidence` ✱ | Country, from the countries service |
| `phone` ✱ | Country code (+1 (US) to start with, then the country of residence's) and number |
| `email` ✱ | Email address, at most 200 |
| `confirmEmail` ✱ | Must match the email address |
| `password` ✱ | 8 to 15 characters with a lower case, an upper case letter and a number |
| `confirmPassword` ✱ | Must match the password |
| `isReceivePromotion` | Newsletter checkbox |
| `isAgree` ✱ | Terms and privacy checkbox |

## Example

| Signup Form |  |  |  |  |
| --- | --- | --- | --- | --- |
| title | Title | Select<br>Mr. = Mr<br>Mrs. = Mrs<br>Ms. = Ms<br>Miss | yes | Please select title |
| firstName | First Name |  | yes | Please fill in first name. |
| phone | Contact No. |  | yes | Please fill in contact number<br>Please fill in valid contact number |
| confirmEmail | Confirm Email Address |  | yes | Please retype the email address<br>Email do not match |
| isAgree | I accept and agree to the [Terms & Conditions](/en-uk/terms-and-conditions) … |  | yes | Please accept the Terms & Conditions and Privacy Policy. |
| submit | Create Account |  |  |  |
| error | Sorry, we couldn't create your account. Please try again. |  |  |  |

## Look and behaviour

Fields side by side from 992px (Title alone, First Name starting a new row), one column below.
Each field is checked when the visitor leaves it and on submit; the button is disabled while
sending; the Register API's own message (e.g. an email already registered) shows at the top of the
form and can be closed; after a successful sign up the visitor goes to the confirmation page.
