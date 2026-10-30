# Profile Form: authoring guide

The logged-in member's profile form (the live site's Update Profile): two boxes, Basic Information
and Optional Information, filled from the GetProfile API with the member's login token; the
newsletter checkbox and Save below. Authors write the texts; the block's code sets the fields, where
each value comes from, and the layout. **Save is disabled until the update API exists.**

The page needs a login: a guest on a members' page (`members-only` true in the metadata sheet, e.g.
a row `/**/membership/**`) is sent to the home page with the page in `?redirectUrl=`; the login
modal opens there, and after logging in the guest comes back here. An expired login, or GetProfile
refusing the token (401), logs out and goes home; any other failure shows "We couldn't load your
profile." with Try again.

## Table: 5 columns

| Profile Form |  |  |  |  |
| --- | --- | --- | --- | --- |
| ### Basic Information |  |  |  |  |
| title | Title | Select / Mr. / Mrs. / Ms. / Miss (one per line) | yes | Please select title |
| firstName | First Name |  |  |  |
| lastName | Last Name |  |  |  |
| email | Email Address |  |  |  |
| membershipNo | Smart Traveller Membership No. |  |  |  |
| points | Smart Traveller Points |  |  |  |
| ### Optional Information |  |  |  |  |
| phone | Contact Number |  |  |  |
| birthday | Birthday |  |  |  |
| ageRange | Age Range | Select / Below 18 / 18-24 / … / 65 or above (one per line) |  |  |
| countryOfResidence | Country of Residence | Select | yes | The Country of Residence field is required. |
| nationality | Nationality | Select | yes | The Nationality field is required. |
| isReceivePromotion | Send me the latest news and deals … [Privacy Policy](/privacy-policy) … |  |  |  |
| submit | Save |  |  |  |

- **One-cell rows**: the box titles; the second one (before `phone`) starts the second box.
- **Field | Label | Placeholder | Required | Error**, as in the other form blocks.
- **membershipNo, points**: shown as text (Field | Label only).

## Where the values come from (GetProfile)

| Field | GetProfile | Notes |
| --- | --- | --- |
| title | `salutation` | |
| firstName, lastName, email | `firstName`, `lastName`, `userName` | Read-only |
| membershipNo | `membershipID` | |
| points | `points`, `pointsExpiry` | "150 (valid until 12/31/2027 11:59:59 PM)", the date as given, no time zone change |
| phone | `phone`, `countryPhoneCode` | Empty number when `phone` is null; the code +1 (US) unless given |
| birthday | `dob` | Disabled (shown, not editable or sent) |
| ageRange | `ageRange` | |
| countryOfResidence | `countryName` | Matched by name in the countries service (e.g. "United States" → "United States of America") |
| nationality | `nationality` | Only by a name; stays Select until the API gives one |
| isReceivePromotion | `isReceivePromotion` | |
