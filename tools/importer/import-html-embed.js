/* eslint-disable */
/* global WebImporter */

import embedCodeParser, { damPath, isLocal, pageStyles } from './parsers/embed-code.js';

const PAGE_TEMPLATE = {
  name: 'html-embed',
  urls: [
    'https://www.plazapremiumlounge.com/en-uk/offers/beyond_the_event',
  ],
  description: 'Page whose body is authored HTML (Kentico Froala, .fr-view, with its own CSS and JS): the page banner, the page title, then the HTML as-is in an Embed Code block',
  blocks: [
    {
      name: 'image',
      instances: [
        '.contentWrapper .pageBanner .pagebannerImg',
      ],
    },
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
      id: 'section-banner',
      name: 'Page banner',
      selector: ['.contentWrapper .pageBanner'],
      style: null,
      blocks: [
        'image',
      ],
      defaultContent: [],
    },
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

/**
 * The page banner (the source's .pageBanner background image) as the Image block
 * (offer-banner, border-rounded), like the other offer pages; a same-site image moves to the
 * DAM. Its breadcrumb is not taken: the site adds one to every page.
 */
function bannerBlock(document, alt, { originalURL, damFolder, assets }) {
  const banner = document.querySelector('.contentWrapper .pageBanner .pagebannerImg, .pageBanner .pagebannerImg');
  const match = (banner?.getAttribute('style') || '').match(/url\(\s*(['"]?)([^'")]+)\1\s*\)/i);
  if (!match) return null;
  const img = document.createElement('img');
  img.src = isLocal(match[2], originalURL)
    ? damPath(new URL(match[2], originalURL).href, damFolder, assets)
    : new URL(match[2], originalURL).href;
  img.alt = alt;
  return WebImporter.Blocks.createBlock(document, { name: 'Image (offer-banner, border-rounded)', cells: [[img]] });
}

/** The page title text (outside the authored HTML). */
function titleText(document) {
  const source = document.querySelector('.contentWrapper .title-wrapper .title, .contentWrapper .title-wrapper h1, .contentWrapper .title-wrapper h2');
  return source ? source.textContent.trim() : '';
}

/** The page title, as the Title block (text-lg), like the other offer pages. */
function titleBlock(document, text) {
  if (!text) return null;
  const h2 = document.createElement('h2');
  h2.textContent = text;
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

    // the page title, also the banner's alt text
    const text = titleText(document);
    const title = titleBlock(document, text);

    // first section: the page banner
    const banner = bannerBlock(document, text, { originalURL, damFolder, assets });
    if (banner) main.append(banner, document.createElement('hr'));

    // next section: the page title
    if (title) {
      main.append(title, WebImporter.Blocks.createBlock(document, {
        name: 'Section Metadata',
        cells: { style: 'inset' },
      }));
    }

    // section 2: each piece of authored HTML, as-is, in its own Embed Code block
    const blocks = [];
    const frViews = [...document.querySelectorAll('.fr-view')]
      .filter((element) => !element.parentElement.closest('.fr-view') && element.innerHTML.trim());
    // the page's inline <style>s, each with the .fr-view it styles (before any is replaced)
    const styles = pageStyles(document, frViews);
    frViews.forEach((element) => {
      const holder = document.createElement('div');
      element.replaceWith(holder);
      holder.append(element);
      try {
        embedCodeParser(element, {
          document, originalURL, damFolder, assets, styles: styles.get(element),
        });
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
        blocks: [...(banner ? ['image'] : []), ...(title ? ['title'] : []), ...blocks.map(() => 'embed-code')],
        assets: JSON.stringify(assets),
      },
    }];
  },
};
