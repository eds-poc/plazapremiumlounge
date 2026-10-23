# Contact Form: authoring guide

The contact us form (the live site's `/en-uk/contact-us`). Authors write the texts and the dropdown
lists; the block's code sets the field types, the keys sent, the rules, the two-column layout and
where the form is sent (the `contact` endpoint, a placeholder until the contact API exists).

## Table: 5 columns

| Contact Form |  |  |  |  |
| --- | --- | --- | --- | --- |
| *Field* | *Label* | *Placeholder* | *Required* | *Error* |

- **Field**: the field's name (below). **Label**: the visible label (checkbox labels keep links).
- **Placeholder**: the hint in an empty field. For the dropdowns (`location`, `typeOfEnquiry`,
  `title`): the empty choice on the first line (`Select`), then one option per line;
  `Hong Kong SAR = HongKongSAR` shows the first and sends the second.
- **Required**: `yes`, or empty; ✱ fields are always required.
- **Error**: line 1, the message when empty; line 2 (optional), the message when the format is wrong.
- **submit**, **success**, **error** rows: the button text, the message after sending, the message
  when sending fails. A one-cell row is a line of text.

## Fields

| Field | What it is |
| --- | --- |
| `location` ✱ | Which Plaza Premium Lounge: dropdown, authored list |
| `typeOfEnquiry` ✱ | Type of enquiry: dropdown, authored list |
| `title` | Title dropdown |
| `firstName` ✱, `lastName` ✱ | Names, at most 200 |
| `contactNumber` ✱ | Digits, +, - and /, at most 15 |
| `countryOfResidence` ✱ | Country, from the countries service |
| `email` ✱ | Email address, at most 200; **starts the second column** |
| `bookingReference` | At most 200 |
| `message` | A 12-line text box |
| `subscribeNewsletter` | Newsletter checkbox |
| `consent` ✱ | Privacy checkbox |

## Look

Two columns from 768px, as the live site: the first seven fields on the left; Email Address,
Booking Reference, Message, the checkboxes and the button (in the right half) on the right. One
column on phones, the button full width.
