# Directory: authoring guide

Grouped lists in balanced columns, as the source Eligible Lounges page: a group name (e.g. a
country), then titles (e.g. airports), each with a bulleted list (e.g. lounges). Use it for any
long list sorted into groups, e.g. lounges by country, or services by airport.

## Table: one row per group, 2 cells

| Directory | |
| --- | --- |
| Canada | **Edmonton International Airport (YEG)**<br>- Plaza Premium Lounge (US Departures)<br>- Plaza Premium Lounge (Non-US Departures)<br>**Toronto Pearson International Airport (YYZ)**<br>- Plaza Premium Lounge (Terminal 1) **\*Temporarily Closed**<br>- Plaza Premium Lounge (Terminal 3) |
| United Kingdom | **London Heathrow Airport (LHR)**<br>- Plaza Premium Lounge (Arrivals, Terminal 2) |

- **Cell 1, the group name:** plain text, e.g. `Canada`. It shows in maroon above the group. Leave
  it empty to continue the group above without repeating the name.
- **Cell 2, the entries:** for each entry, a **bold line** (the title, e.g. the airport) followed
  by a bulleted list (the lounges). Repeat for every airport of the group.
- **Links:** make a lounge (or a title) a link to open its page, e.g. the lounge details page.
- **Status notes:** bold text after a lounge's name, e.g. `**\*Temporarily Closed**`, shows as a
  dark red note. A lounge written all in bold stays a lounge (it isn't a title).
- **Order:** groups, titles and lounges show in the order they're written.

## Also accepted

- Lounges written as separate lines or paragraphs instead of bullets.
- A heading instead of a bold line for a title.
- A list with no title above it (e.g. a short list straight under the group name).
- One cell only, starting with a heading: the heading is the group name.
- Empty rows are skipped.

## Options

Add one in brackets after the block name, e.g. `Directory (three)`. Without one, the block is two
columns, as the source.

| Option | Columns |
| --- | --- |
| *(none)* or `two` | 1, then 2 when the block is at least 830px wide |
| `one` | Always 1, e.g. for a short list or a narrow section |
| `three` | 1, then 2 from 830px, then 3 from 1260px (a wide section) |

A column is never narrower than 400px, so a column count only shows when there's room for it.

## Layout

- **One column** on mobile and tablet, **two columns** when the block is at least 830px wide (as
  the source's two 400px columns with 30px between them). The columns are balanced automatically:
  don't split groups by hand or add blank lines or "(Con't)" names.
- A title always stays together with its list in one column; a long group can continue in the next
  column between two titles.
- Text, as the source: group names 15px bold maroon, titles 14px, lounges 14px grey with bullets.
  None of this is authorable.

## Building a page like Eligible Lounges

1. The page title: a **Title (plum)** block (eyebrow `Plaza Premium Lounge Passes`, heading 1,
   intro).
2. The jump links: a bold label line, then a **Buttons (pill)** block with one `#name` link per
   list, e.g. `[Canada](#lounge-pass-canada-eligible-locations)`. A `#name` link scrolls to the
   heading with that name: the heading's text in lower case, with spaces and punctuation as `-`
   (an `&` gives `--`, accents stay, e.g. `türkiye`). Check the links in the preview.
3. One section per list: its heading 2 (e.g. `Lounge Pass Canada Eligible Locations`), then a
   Directory block.
4. Every section, including the first: Section Metadata `Style` = `fixed-width, divided`. This
   gives the source's page width, the 26px maroon list headings and the 14px bold labels.
5. The line between lists: a **Divider** block at the start of each section after the first,
   before its heading. Delete the Divider table to remove a line; add one to add a line.

Group names and titles become headings one level below the heading above the block (heading 3 and
4 under a heading 2), so screen reader users can jump between countries and airports.
