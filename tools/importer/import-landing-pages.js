/* eslint-disable */
/* global WebImporter */

/**
 * Import script for the "landing-pages" template: the source's Smart Traveller WiFi landing pages
 * (/en-uk/Landing-Pages/connected-to-wifi, /en-uk/Landing-Pages/how-to-connect-to-wifi).
 *
 * The source page body (.container.xmas2019) is a column of Bootstrap sections; each becomes a
 * section of the page, in the source's narrower landing page width (Section Metadata style
 * fixed-width):
 * - the page banner (.pagebannerImg background image) as Image (offer-banner, border-rounded),
 *   its alt the page title;
 * - the intro (.intro2 / .intro3): a single centred line as lead-copy text, else (a heading and
 *   paragraphs) as default content;
 * - each two-column row (.giftCard / .lounge .row, a text column and an image column) as a row of
 *   Columns (text-image, halves-on-mobile, text-medium, row-spacing), in the source's order; the
 *   rows that follow one another (the WiFi steps) share one block, a heading between them
 *   (.section3 .intro-wrapper h2) stays default content above it; the source's 24px headings
 *   (h2.lg3) become heading 3 (the site's 24px h3); a source <span class="yellow">
 *   accent becomes italic (the Columns block shows italic heading words in gold); a .btn becomes a
 *   bold link (a button); a linked image keeps its link;
 * - the Travel Smart band (.social) as Columns (social): the text column (heading, text, the
 *   Facebook and Instagram links with their icons, the hashtags) and the band's background photo;
 * - the metadata (title without " | Plaza Premium Lounge", description) in its own last section.
 * In-page links to the source's own anchors (#ST, #connect) point at the headings' ids (EDS makes
 * them from the heading text); links to the page itself (the source's linked headings) are dropped.
 * Same-site images move to the DAM (/media-da/<page path>/<file name>), the page pointing at their
 * DA address; the report's `assets` lists the moves. Other hosts and links stay as they are.
 */

import { damPath, isLocal } from './parsers/embed-code.js';

const PAGE_TEMPLATE = {
  name: 'landing-pages',
  description: 'Smart Traveller WiFi landing pages: banner, intro, text and image rows, Travel Smart band',
  urlPattern: '/en-uk/Landing-Pages/*',
};

const DAM_ROOT = '/media-da';
const DA_CONTENT = 'https://content.da.live/eds-poc/plazapremiumlounge';
const TITLE_SUFFIX = /\s*\|\s*Plaza Premium Lounge\s*$/i;
const ROWS = 'Columns (text-image, halves-on-mobile, text-medium, row-spacing)';
const SOCIAL = 'Columns (social)';
// icons for the source's social links (by host), in the code /icons folder
const SOCIAL_ICONS = [[/facebook\.com$/i, 'facebook'], [/instagram\.com$/i, 'instagram']];

function meta(document, name) {
  const el = document.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
  return el ? (el.getAttribute('content') || '').trim() : '';
}

/** An image address as the page shows it: same-site ones moved to the DAM, as their DA address. */
function imageSrc(src, { originalURL, damFolder, assets }) {
  const absolute = new URL(src, originalURL).href;
  return isLocal(src, originalURL) ? `${DA_CONTENT}${damPath(absolute, damFolder, assets)}` : absolute;
}

/** An element's background image address (a quoted address may hold brackets), or ''. */
function backgroundUrl(el) {
  const match = (el?.getAttribute('style') || '').match(/url\(\s*(?:(['"]|&quot;)(.*?)\1|([^'")\s]+))\s*\)/i);
  return match ? (match[2] || match[3] || '') : '';
}

function image(document, src, alt, options) {
  const img = document.createElement('img');
  img.src = imageSrc(src, options);
  img.alt = alt || '';
  return img;
}

/** A section break and its Section Metadata (style). */
function sectionMetadata(document, style) {
  return WebImporter.Blocks.createBlock(document, { name: 'Section Metadata', cells: [['style', style]] });
}

/** A heading's id as EDS makes it from its text (lower case, words joined by dashes). */
function headingId(text) {
  return text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Source content cleaned for authoring: spacers, scripts and styles out; a .btn becomes a bold
 * link; span.yellow becomes italic; links to the page itself are unwrapped, in-page anchors
 * point at the heading ids; class, style and id attributes removed; images moved to the DAM.
 */
function clean(node, options) {
  const { document, anchors, pagePath } = options;
  node.querySelectorAll('script, style, noscript, [class^="spacer"], [class*=" spacer"]').forEach((el) => el.remove());
  node.querySelectorAll('br').forEach((br) => {
    // a heading's leading line break (the source's top spacing) isn't content
    if (br.parentElement?.matches('h1, h2, h3, h4, h5, h6') && !br.previousSibling) br.remove();
  });
  // the source's smaller heading style (.lg3, 24px at every width) is a heading 3, as the site's h3
  node.querySelectorAll('h2.lg3').forEach((h2) => {
    const h3 = document.createElement('h3');
    h3.append(...h2.childNodes);
    h2.replaceWith(h3);
  });
  node.querySelectorAll('.yellow').forEach((span) => {
    const em = document.createElement('em');
    em.append(...span.childNodes);
    span.replaceWith(em);
  });
  node.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href');
    if (href.startsWith('#')) {
      if (anchors[href.slice(1)]) a.setAttribute('href', `#${anchors[href.slice(1)]}`);
      return;
    }
    let url;
    try { url = new URL(href, options.originalURL); } catch (e) { return; }
    if (isLocal(href, options.originalURL) && url.pathname.toLowerCase().replace(/\/$/, '') === pagePath) {
      a.replaceWith(...a.childNodes);
      return;
    }
    if (a.matches('.btn')) {
      const strong = document.createElement('strong');
      a.replaceWith(strong);
      strong.append(a);
    }
    a.removeAttribute('target');
    a.removeAttribute('alt');
  });
  node.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') || img.getAttribute('data-src');
    if (!src || /^(data|blob):/i.test(src)) { img.remove(); return; }
    img.setAttribute('src', imageSrc(src, options));
    ['srcset', 'width', 'height', 'align'].forEach((name) => img.removeAttribute(name));
  });
  node.querySelectorAll('span').forEach((span) => {
    if (!span.attributes.length || span.getAttribute('style')) span.replaceWith(...span.childNodes);
  });
  node.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach(({ name }) => {
      if (['class', 'style', 'id'].includes(name) || /^on|^data-/i.test(name)) el.removeAttribute(name);
    });
  });
  return node;
}

/** The block cells of a text column: its text wrapper's children (or the column's own). */
function textCell(col, options) {
  const wrapper = col.querySelector('.txtWrapper') || col;
  const cell = options.document.createElement('div');
  cell.append(...clean(wrapper.cloneNode(true), options).childNodes);
  // empty paragraphs (<p><br></p>) aren't content
  cell.querySelectorAll('p').forEach((p) => { if (!p.textContent.trim() && !p.querySelector('img')) p.remove(); });
  // a lone button link in the text sits in its own paragraph
  cell.querySelectorAll(':scope > strong').forEach((strong) => {
    const p = options.document.createElement('p');
    strong.replaceWith(p);
    p.append(strong);
  });
  return cell;
}

/** An image column's cell: its image, linked when the source linked it; alt from the link. */
function imageCell(col, options) {
  const cell = options.document.createElement('div');
  const img = col.querySelector('img');
  if (!img) return cell;
  const link = img.closest('a[href]');
  const alt = img.getAttribute('alt') || link?.getAttribute('alt') || '';
  const picture = image(options.document, img.getAttribute('src'), alt, options);
  if (link) {
    const a = options.document.createElement('a');
    a.href = new URL(link.getAttribute('href'), options.originalURL).href;
    a.append(picture);
    cell.append(a);
  } else {
    cell.append(picture);
  }
  return cell;
}

/** A source two-column row as a Columns row, in the source order (text or image first). */
function columnsRow(row, options) {
  return [...row.children].filter((col) => col.textContent.trim() || col.querySelector('img'))
    .map((col) => ((col.querySelector('img') && !col.querySelector('.txtWrapper, h2, p'))
      ? imageCell(col, options) : textCell(col, options)));
}

/** The Travel Smart band: its text (with the social links' icons) and its background photo. */
function socialBlock(band, alt, options) {
  const { document } = options;
  const text = document.createElement('div');
  const wrapper = band.querySelector('.intro-wrapper') || band;
  const heading = wrapper.querySelector('h2');
  if (heading) text.append(clean(heading.cloneNode(true), options));
  wrapper.querySelectorAll(':scope > p').forEach((p) => text.append(clean(p.cloneNode(true), options)));
  // the links (with an icon for each network) and the hashtags, a paragraph each
  wrapper.querySelectorAll('.row a[href]').forEach((a) => {
    const p = document.createElement('p');
    const link = document.createElement('a');
    link.href = a.getAttribute('href');
    const host = new URL(link.href).hostname;
    const icon = SOCIAL_ICONS.find(([pattern]) => pattern.test(host));
    link.textContent = `${icon ? `:${icon[1]}: ` : ''}${a.textContent.replace(/\s+/g, ' ').trim()}`;
    p.append(link);
    text.append(p);
  });
  wrapper.querySelectorAll('.row > div').forEach((col) => {
    if (col.querySelector('a')) return;
    col.textContent.split(/\s+/).filter((tag) => tag.startsWith('#')).forEach((tag) => {
      const p = document.createElement('p');
      p.textContent = tag;
      text.append(p);
    });
  });
  const cells = [text];
  const photo = backgroundUrl(band);
  if (photo) {
    const cell = document.createElement('div');
    cell.append(image(document, photo, alt, options));
    cells.push(cell);
  }
  return WebImporter.Blocks.createBlock(document, { name: SOCIAL, cells: [cells] });
}

export default {
  transform: (payload) => {
    const { document, url, params } = payload;
    const originalURL = params.originalURL || url;
    const rawPath = decodeURIComponent(new URL(originalURL).pathname).replace(/\/$/, '').replace(/\.html?$/, '');
    const path = WebImporter.FileUtils.sanitizePath(rawPath || '/index');
    const assets = {};
    const body = document.querySelector('.container.xmas2019');
    // the source's in-page anchors (an id on a heading's link) → the heading's EDS id
    const anchors = {};
    body?.querySelectorAll('h2 [id], h2[id]').forEach((el) => {
      anchors[el.id] = headingId(el.closest('h2').textContent.replace(/\s+/g, ' ').trim());
    });
    // (the heading ids don't depend on the level, so a .lg3 heading made an h3 keeps its anchor)
    const options = {
      document, originalURL, damFolder: `${DAM_ROOT}${path}`, assets, anchors, pagePath: path.toLowerCase(),
    };
    const pageTitle = (document.title || meta(document, 'og:title')).replace(TITLE_SUFFIX, '').trim();
    const main = document.createElement('main');
    const blocks = [];
    if (!body) return [{ element: main, path, report: { title: pageTitle, template: PAGE_TEMPLATE.name } }];

    let rows = [];
    const flushRows = () => {
      if (!rows.length) return;
      main.append(WebImporter.Blocks.createBlock(document, { name: ROWS, cells: rows }));
      blocks.push('columns');
      rows = [];
    };
    const endSection = (style) => {
      flushRows();
      if (main.childNodes.length && main.lastChild.nodeName !== 'HR') {
        if (style) main.append(sectionMetadata(document, style));
        main.append(document.createElement('hr'));
      }
    };

    [...body.children].forEach((part) => {
      if (part.matches('.pagebannerImg')) {
        const src = backgroundUrl(part) || part.querySelector('img')?.getAttribute('src');
        if (!src) return;
        main.append(WebImporter.Blocks.createBlock(document, {
          name: 'Image (offer-banner, border-rounded)', cells: [[image(document, src, pageTitle, options)]],
        }));
        blocks.push('image');
        endSection('fixed-width');
        return;
      }
      if (part.matches('.social')) {
        endSection('fixed-width');
        main.append(socialBlock(part, '', options));
        blocks.push('columns');
        endSection('fixed-width');
        return;
      }
      const row = part.querySelector('.row');
      if (row && (part.matches('.giftCard, .lounge'))) {
        rows.push(columnsRow(row, options));
        return;
      }
      const intro = part.querySelector('.intro-wrapper');
      if (!intro) return;
      const content = clean(intro.cloneNode(true), options);
      const nodes = [...content.childNodes].filter((n) => n.nodeType === 1 && (n.textContent.trim() || n.querySelector('img')));
      if (!nodes.length) return;
      const single = nodes.length === 1 && nodes[0].matches('p');
      if (single) {
        // a single centred line (the source's .intro-wrapper.text-center)
        endSection('fixed-width');
        main.append(...nodes);
        endSection('lead-copy');
      } else {
        // a heading with text: default content; a lone heading starts the rows that follow
        endSection('fixed-width');
        main.append(...nodes);
      }
    });
    endSection('fixed-width');

    const metadata = {};
    if (pageTitle) metadata.Title = pageTitle;
    const description = meta(document, 'description') || meta(document, 'og:description');
    if (description) metadata.Description = description;
    main.append(WebImporter.Blocks.getMetadataBlock(document, metadata));

    return [{
      element: main,
      path,
      report: {
        title: metadata.Title || '',
        template: PAGE_TEMPLATE.name,
        blocks: [...new Set(blocks)],
        assets: JSON.stringify(assets),
      },
    }];
  },
};
