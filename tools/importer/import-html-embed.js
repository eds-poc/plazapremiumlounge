/* eslint-disable */
/* global WebImporter */

import embedCodeParser, { damPath } from './parsers/embed-code.js';

const PAGE_TEMPLATE = {
  name: 'html-embed',
  urls: [
    'https://www.plazapremiumlounge.com/en-uk/offers/beyond_the_event',
  ],
  description: 'Page whose body is authored HTML (Kentico Froala, .fr-view, with its own CSS and JS): the page title, then the HTML as-is in an Embed Code block',
  blocks: [
    {
      name: 'title',
      instances: [
        '.contentWrapper .title-wrapper',
      ],
    },
    {
      name: 'embed-code',
      instances: [
        '.fr-view',
      ],
    },
  ],
  sections: [
    {
      id: 'section-1',
      name: 'Page title',
      selector: ['.contentWrapper .title-wrapper'],
      style: 'inset',
      blocks: [
        'title',
      ],
      defaultContent: [],
    },
    {
      id: 'section-2',
      name: 'Authored HTML',
      selector: ['.fr-view'],
      style: null,
      blocks: [
        'embed-code',
      ],
      defaultContent: [],
    },
  ],
};

const DAM_ROOT = '/media-da';

function meta(document, name) {
  const el = document.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
  return el ? el.getAttribute('content').trim() : '';
}

/** The page title, as the Title block (text-lg), like the other offer pages. */
function titleBlock(document) {
  const source = document.querySelector('.contentWrapper .title-wrapper .title, .contentWrapper .title-wrapper h1, .contentWrapper .title-wrapper h2');
  if (!source || !source.textContent.trim()) return null;
  const h2 = document.createElement('h2');
  h2.textContent = source.textContent.trim();
  return WebImporter.Blocks.createBlock(document, { name: 'Title (text-lg)', cells: [[h2]] });
}

export default {
  transform: (payload) => {
    const { document, url, params } = payload;
    const originalURL = params.originalURL || url;
    const path = WebImporter.FileUtils.sanitizePath(new URL(originalURL).pathname.replace(/\/$/, ''));
    const damFolder = `${DAM_ROOT}${path}`;
    // same-site assets moved to the DAM: source address → DAM path
    const assets = {};

    const main = document.createElement('main');

    // section 1: the page title (outside the authored HTML)
    const title = titleBlock(document);
    if (title) {
      main.append(title, WebImporter.Blocks.createBlock(document, {
        name: 'Section Metadata',
        cells: { style: 'inset' },
      }));
    }

    // section 2: each piece of authored HTML, as-is, in its own Embed Code block
    const blocks = [];
    [...document.querySelectorAll('.fr-view')]
      .filter((element) => !element.parentElement.closest('.fr-view') && element.innerHTML.trim())
      .forEach((element) => {
        const holder = document.createElement('div');
        element.replaceWith(holder);
        holder.append(element);
        try {
          embedCodeParser(element, { document, originalURL, damFolder, assets });
          blocks.push(...holder.childNodes);
        } catch (e) {
          console.error('Failed to parse embed-code (.fr-view):', e);
        }
      });
    if (blocks.length) {
      if (main.children.length) main.append(document.createElement('hr'));
      main.append(...blocks);
    }

    // page metadata; a same-site share image moves to the DAM too
    const metadata = {};
    const pageTitle = (document.title || meta(document, 'og:title')).trim();
    if (pageTitle) metadata.Title = pageTitle;
    const description = meta(document, 'description') || meta(document, 'og:description');
    if (description) metadata.Description = description;
    const ogImage = meta(document, 'og:image');
    if (ogImage) {
      const absolute = new URL(ogImage, originalURL).href;
      const img = document.createElement('img');
      img.src = new URL(absolute).hostname === new URL(originalURL).hostname
        ? damPath(absolute, damFolder, assets)
        : absolute;
      img.alt = '';
      metadata.Image = img;
    }
    // in its own section at the end, like the other pages
    if (main.children.length) main.append(document.createElement('hr'));
    main.append(WebImporter.Blocks.getMetadataBlock(document, metadata));

    return [{
      element: main,
      path,
      report: {
        title: metadata.Title || '',
        template: PAGE_TEMPLATE.name,
        blocks: [...(title ? ['title'] : []), ...blocks.map(() => 'embed-code')],
        assets: JSON.stringify(assets),
      },
    }];
  },
};
