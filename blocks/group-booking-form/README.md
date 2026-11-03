# Group Booking Form: authoring guide

The group booking request form (the live site's `/en-uk/group-booking`). Authors write the texts
and the lists; the block's code sets the field types, the keys sent, the rules, the two-column
layout and where the form is sent (the `groupBooking` endpoint, a placeholder until the group
booking API exists). It works as the Contact Form: the same rows, checks and captcha.

On the page: a **Title (center, intro-wide)** with the heading and the intro text, a **Divider**,
then this block.

## Table: 5 columns

| Group Booking Form |  |  |  |  |
| --- | --- | --- | --- | --- |
| *Field* | *Label* | *Placeholder* | *Required* | *Error* |

- **Field**: the field's name (below). **Label**: the visible label (checkbox labels keep links).
- **Placeholder**: the hint in an empty field. For the dropdowns: the empty choice on the first
  line (`Select`), then one option per line; `Hong Kong SAR = HKG` shows the first and sends the
  second. For `servicesRequired`: one service per line (`Lounge Use = LoungeUse`). For
  `lengthOfStay`: the unit after the number (`hours`).
- **Required**: `yes`, or empty; ✱ fields are always required.
- **Error**: line 1, the message when empty; line 2 (optional), the message when the format is wrong.
- **people** row: its Error cell is the message when adults and children together are fewer than
  10.
- **captcha**, **submit**, **success**, **error** rows: as the Contact Form (the captcha message,
  the button text, the message after sending, the message when sending fails).

## Fields

| Field | What it is |
| --- | --- |
| `emailAddress` ✱ | Email address, at most 200 |
| `title` ✱ | Title dropdown |
| `firstName` ✱, `lastName` ✱ | Names, at most 200 |
| `contactNumber` ✱ | Numbers only (the number keypad on phones; anything else typed or pasted is left out), at most 12 |
| `locationOfService` ✱ | Location dropdown, authored list |
| `areaOfService` ✱ | The areas of the chosen location, from the `groupBookingAreas` endpoint (a placeholder). A choice is asked for once the list has areas; its Error cell is the message. Sent as `locationOfServiceCity` |
| `servicesRequired` ✱ | Checkboxes, at least one; sent as the checked values, each followed by `;` (`LoungeUse;Shower;`) |
| `noOfAdults` ✱, `noOfChildren` | Dropdowns, side by side (**starts the second column**); together at least 10 (the `people` message) |
| `serviceStartDate` ✱ | Date, from today (the browser's date picker); sent as `2026-11-20` |
| `serviceStartTime` | − and + by half an hour from 6:00 PM, round the clock; sent as `18:00` |
| `lengthOfStay` | − and + by half an hour from 3.5, between 2 and 18; sent as a number |
| `remarks` | An 18-line text box |
| `subscribeNewsletter` | Newsletter checkbox |
| `consent` ✱ | Privacy checkbox |

## The APIs (placeholders)

- **groupBooking** (POST, JSON): the fields above by key, and `h-captcha-response`.
- **groupBookingAreas** (POST, JSON `{ locationOfService, languageCode }`): answers
  `{ items: [{ value, text }] }`. Until it exists, Area of Service stays empty and optional.

## Option `booking-request`: the Lounge Booking Request form

`Group Booking Form (booking request)` is the live site's `/en-uk/makeabooking` form: the same
block, rows and checks, with its own fields, sent to the `bookingRequest` endpoint (a placeholder
until the API exists). On the page: a **Title (center, intro-wide)**, a **Divider**, then the block.
No `people` row (there is no minimum) and no newsletter checkbox; the captcha and the button stay
in the second column, side by side when it has room (as the source). 41px fields, the columns 64px
apart, as the Contact Us form.

| Field | What it is |
| --- | --- |
| `locationOfService` ✱, `areaOfService` ✱ | As above (the areas request adds `form: "bookingRequest"`) |
| `emailAddress` ✱, `contactNumber` ✱ | As above |
| `smartTravellerMembershipNumber` | Text, at most 200 |
| `title` ✱, `firstName` ✱, `lastName` ✱, `servicesRequired` ✱ | As above |
| `numberOfPrivateRestingAreas` ✱ | Dropdown (`N/A`, 1 to 10) |
| `travelType` ✱ | Dropdown (Arrival, Departure, Transit) |
| `noOfAdults` ✱ (**starts the second column**), `noOfChildren` | Dropdowns, side by side |
| `serviceStartDate` ✱, `serviceStartTime` | Date from today; − and + by half an hour from 10:00 AM |
| `serviceEndDate` ✱, `serviceEndTime` | Date not before the start date (its picker starts there; its Error line 2 is the message); − and + by half an hour from 11:00 AM |
| `remarks` | A 12-line text box, sent as `remark` |
| `consent` ✱ | Privacy checkbox |
