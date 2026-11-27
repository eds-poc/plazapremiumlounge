# Booking Form: authoring guide

The booking request forms of the live site:

- **Booking Form**: the lounge booking request (`/en-uk/makeabooking`, "Lounge Booking Request"),
  sent to the `bookingRequest` endpoint.
- **Booking Form (group-form)**: the group booking request (`/en-uk/group-booking`), sent to the
  `groupBooking` endpoint.

Authors write the texts and the lists; the block's code sets the field types, the keys sent, the
rules, the two-column layout and where the form is sent (both endpoints are placeholders until the
APIs exist). It works as the Contact Form: the same rows, checks and captcha.

On the page: a **Title (center, intro-wide)** with the heading and the intro text, a **Divider**,
then this block.

## Table: 5 columns

| Booking Form |  |  |  |  |
| --- | --- | --- | --- | --- |
| *Field* | *Label* | *Placeholder* | *Required* | *Error* |

- **Field**: the field's name (below). **Label**: the visible label (checkbox labels keep links).
- **Placeholder**: the hint in an empty field. For the dropdowns: the empty choice on the first
  line (`Select`), then one option per line; `Hong Kong SAR = HKG` shows the first and sends the
  second (`locationOfService`: only the empty choice, `Select`; its countries come from the
  country sheet). For `servicesRequired`: one service per line (`Lounge Use = LoungeUse`). For
  `lengthOfStay`: the unit after the number (`hours`).
- **Required**: `yes`, or empty; ✱ fields are always required.
- **Error**: line 1, the message when empty; line 2 (optional), the message when the format is wrong.
- **people** row (group-form): its Error cell is the message when adults and children together are
  fewer than 10.
- **captcha**, **submit**, **success**, **error** rows: as the Contact Form (the captcha message,
  the button text, the message after sending, the message when sending fails).

## Booking Form: the lounge booking request

41px fields, the columns 64px apart, as the Contact Us form; the captcha and the button in the
second column, side by side when it has room (as the source).

| Field | What it is |
| --- | --- |
| `locationOfService` ✱ | The countries of the `data/country` sheet that have areas, in the page's language (below); sent as the Country Code (`HK`) |
| `areaOfService` ✱ | The areas of the chosen country, from the `data/area-of-service` sheet, in the page's language (below). A choice is asked for once the list has areas; its Error cell is the message. Sent as `locationOfServiceCity` |
| `emailAddress` ✱ | Email address, at most 200 |
| `contactNumber` ✱ | Numbers only (the number keypad on phones; anything else typed or pasted is left out), at most 12 |
| `smartTravellerMembershipNumber` | Text, at most 200 |
| `title` ✱ | Title dropdown |
| `firstName` ✱, `lastName` ✱ | Names, at most 200 |
| `servicesRequired` ✱ | Checkboxes, at least one; sent as the checked values, each followed by `;` (`LoungeUse;Shower;`) |
| `numberOfPrivateRestingAreas` ✱ | Dropdown (`N/A`, 1 to 10) |
| `travelType` ✱ | Dropdown (Arrival, Departure, Transit) |
| `noOfAdults` ✱ (**starts the second column**), `noOfChildren` | Dropdowns, side by side |
| `serviceStartDate` ✱, `serviceStartTime` | Date on the site's calendar (as the Booking Widget's), starting today, days before today not pickable, sent as `2026-11-20`; − and + by half an hour from 10:00 AM, sent as `10:00` |
| `serviceEndDate` ✱, `serviceEndTime` | Date on the same calendar, not before the start date: its first day follows the start, and an end before a new start moves up to it (its Error line 2 is the message); − and + by half an hour from 11:00 AM |
| `remarks` | A 12-line text box, sent as `remark` |
| `consent` ✱ | Privacy checkbox |

## Booking Form (group-form): the group booking request

45px fields, the columns 24px apart; the captcha (left) and the button (right) under the columns.

| Field | What it is |
| --- | --- |
| `emailAddress` ✱, `title` ✱, `firstName` ✱, `lastName` ✱, `contactNumber` ✱ | As above |
| `locationOfService` ✱ | Every country of the `data/country` sheet, in the page's language; sent as the Country Code |
| `areaOfService` ✱ | As above |
| `servicesRequired` ✱ | As above |
| `noOfAdults` ✱ (**starts the second column**), `noOfChildren` | Dropdowns, side by side; together at least 10 (the `people` message) |
| `serviceStartDate` ✱ | Date on the site's calendar, starting today, days before today not pickable; sent as `2026-11-20` |
| `serviceStartTime` | − and + by half an hour from 6:00 PM, round the clock; sent as `18:00` |
| `lengthOfStay` | − and + by half an hour from 3.5, between 2 and 18; sent as a number |
| `remarks` | An 18-line text box |
| `subscribeNewsletter` | Newsletter checkbox |
| `consent` ✱ | Privacy checkbox |

## The APIs (placeholders)

- **bookingRequest**, **groupBooking** (POST, JSON): the fields above by key, and
  `h-captcha-response`.

## The countries and the areas of service: two sheets

Two sheets in Document Authoring for both forms and every language, joined by the country's ISO
code. Each language column holds the name shown on that language's pages (`en-uk`, `zh-cn`,
`zh-hk`, `ja-jp`, `pt-br`); an empty cell shows the `en-uk` name. The rows' order is the
dropdowns' order.

**`data/country`** (`/data/country.json`): one row per country.

| Country Code | en-uk | zh-cn | zh-hk | ja-jp | pt-br |
| --- | --- | --- | --- | --- | --- |
| HK | Hong Kong SAR | 中国香港特别行政区 | 中國香港特別行政區 | 香港特別行政区 | Hong Kong (RAE) |

**`data/area-of-service`** (`/data/area-of-service.json`): one row per area.

| Country Code | Value | en-uk | zh-cn | zh-hk | ja-jp | pt-br |
| --- | --- | --- | --- | --- | --- | --- |
| HK | HongKong(HKG) | Hong Kong (HKG) | 香港 (HKG) | 香港 (HKG) | 香港 (HKG) | Hong Kong (HKG) |

- **Country Code** is what's sent as `locationOfService`; **Value** is what's sent as
  `locationOfServiceCity`, the same in every language.
- The lounge booking request lists only the countries that have areas; the group booking lists every
  country. A country without areas leaves Area of Service empty and optional.
- A new country or area is a new row; it shows once the sheet is previewed (and on the live site once
  it's published). If the sheets can't be read, the dropdown keeps any list authored in its row.

## The dates

The calendar is the site's own (`scripts/date-picker.js`, the Booking Widget's and the lounge
page's), styled in this block's CSS: the date in the form's pill as the site writes it
("06 Nov 2026", "2026年11月6日"), a calendar of one month that pops up under it (Date and close,
previous and next, the days; the arrow keys, Page Up and Page Down, Enter and Escape work).
A form reset goes back to today.
