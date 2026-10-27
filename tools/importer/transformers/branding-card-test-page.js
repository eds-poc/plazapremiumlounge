/* eslint-disable */
/* global WebImporter */

/**
 * Transformer for the Branding Card test page (/en-uk/drafts/blocks/branding-card).
 * beforeTransform: keeps only the source's branding section (the "Your Destination Before
 * Departure" grid) and its heading.
 * afterTransform: adds a page title and intro, the section's settings (grey, fixed width,
 * centred title), then a section of cases for missing fields, each built from a copy of an
 * imported card with parts left out, and the page metadata.
 */

const YOUTUBE_SAMPLE = 'https://www.youtube.com/watch?v=6x9GpYQh6kM';

function el(document, tag, text) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  return node;
}

/** The card rows of the imported block table (without its header row). */
function cardRows(table) {
  return Array.from(table.querySelectorAll(':scope > tbody > tr, :scope > tr')).slice(1);
}

/** A Branding Card table from row copies. */
function cardTable(document, rows) {
  const cells = rows.map((row) => Array.from(row.children).map((td) => Array.from(td.cloneNode(true).childNodes)));
  return WebImporter.Blocks.createBlock(document, { name: 'Branding Card', cells });
}

/** A copy of an imported card row. */
function copyRow(rows, name) {
  const row = rows.find((r) => r.querySelector('h3')?.textContent.trim() === name) || rows[0];
  return row.cloneNode(true);
}

/** The button paragraph of a row whose link text matches. */
function button(row, label) {
  return Array.from(row.querySelectorAll('p')).find((p) => p.querySelector('a') && p.textContent.trim() === label);
}

function testCase(document, title, note, table) {
  return [el(document, 'h3', title), el(document, 'p', note), table];
}

export default function transform(hookName, element, payload) {
  const { document } = payload;

  if (hookName === 'beforeTransform') {
    const section = element.querySelector('section.branding');
    if (!section) return;
    element.replaceChildren(section);
    return;
  }

  if (hookName !== 'afterTransform') return;
  const table = element.querySelector('table');
  if (!table) return;
  const rows = cardRows(table);

  // page title and intro
  const intro = [
    el(document, 'h1', 'Branding Card'),
    el(document, 'p', 'Destination cards: a photo filling the card, the title on top and buttons at the bottom. On hover, or when a button has keyboard focus, a maroon tint and the text appear. One row per card: the photo, then the title, the text and each button as a bold link on its own line. A YouTube, Vimeo or video file link plays in a popup.'),
    document.createElement('hr'),
  ];

  // the imported grid, with the source section's look
  const settings = WebImporter.Blocks.createBlock(document, {
    name: 'Section Metadata',
    cells: { style: 'fixed-width', background: 'grey', 'title-position': 'center' },
  });

  // cases for missing fields, from copies of the imported cards
  const alone = copyRow(rows, 'Nagoya');

  const noPhoto = copyRow(rows, 'Kuala Lumpur');
  noPhoto.querySelector('img')?.remove();
  const emptyRow = noPhoto.cloneNode(true);
  Array.from(emptyRow.children).forEach((td) => td.replaceChildren());

  const noButtons = copyRow(rows, 'Adelaide');
  Array.from(noButtons.querySelectorAll('p')).filter((p) => p.querySelector('a')).forEach((p) => p.remove());

  const boldTitle = copyRow(rows, 'Medan');
  const h3 = boldTitle.querySelector('h3');
  if (h3) {
    const p = el(document, 'p');
    p.append(el(document, 'strong', h3.textContent));
    h3.replaceWith(p);
  }

  const bareAddress = copyRow(rows, 'Langkawi');
  button(bareAddress, 'Discover More')?.remove();
  const watch = button(bareAddress, 'Watch Video')?.querySelector('a');
  if (watch) {
    const href = watch.getAttribute('href').split('?')[0];
    watch.href = href;
    watch.textContent = href;
  }

  const youtube = copyRow(rows, 'Dubai');
  const ytLink = button(youtube, 'Watch Video')?.querySelector('a');
  if (ytLink) ytLink.href = YOUTUBE_SAMPLE;

  const plainLink = el(document, 'p', 'A video link in plain text plays in the popup too: ');
  const textLink = el(document, 'a', 'watch the Plaza Premium Lounge film');
  textLink.href = YOUTUBE_SAMPLE;
  plainLink.append(textLink, '.');

  const cases = [
    document.createElement('hr'),
    el(document, 'h2', 'Other cases'),
    ...testCase(document, 'One card', 'A single card stays card-sized, centred.', cardTable(document, [alone])),
    ...testCase(document, 'No photo, and an empty row', 'A card without a photo is plain maroon; the empty second row is left out.', cardTable(document, [noPhoto, emptyRow])),
    ...testCase(document, 'No buttons', 'With nothing to hover or focus, the tint and the text are always shown.', cardTable(document, [noButtons])),
    ...testCase(document, 'Title in bold, no heading', 'A line in bold becomes the title.', cardTable(document, [boldTitle])),
    ...testCase(document, 'Only the video address', 'A bare video address is labelled Watch Video.', cardTable(document, [bareAddress])),
    ...testCase(document, 'YouTube video', 'YouTube plays in the same popup, through its privacy-friendly player.', cardTable(document, [youtube])),
    plainLink,
  ];

  const metadata = WebImporter.Blocks.createBlock(document, {
    name: 'Metadata',
    cells: { Title: 'Branding Card', Description: 'Test page for the Branding Card block and the video popup.' },
  });

  element.prepend(...intro);
  table.after(settings);
  settings.after(...cases, metadata);
}
