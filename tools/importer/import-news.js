/* eslint-disable */
/* global WebImporter */

/**
 * Import script for the "news" template: the press releases at /en-uk/News/* (63 pages).
 *
 * Each page, as the offer pages:
 * - the page banner (.pageBanner) as the Image block (offer-banner, border-rounded), its alt the
 *   page title;
 * - the title (.title-wrapper h2, made a heading 1) and the lead paragraph (.news-content) as the
 *   Title block (text-lg, lead), the lead its intro;
 * - the article (.fr-view) as default content;
 * - the metadata (title without " | Plaza Premium Lounge", description, share image) in its own
 *   last section.
 * Same-site images (www.plazapremiumlounge.com, e.g. /getContentAsset/...) move to the DAM:
 * /media-da/<page path>/<file name>, the page pointing at its DA address
 * (https://content.da.live/<org>/<site>/media-da/...; the local preview can't show those, as
 * content.da.live needs a login); the report's `assets` lists the moves. Other hosts
 * (assets.plazapremiumlounge.com) and all links stay as they are. Images broken on the source
 * itself (its /getmedia/... addresses lead to its 404 page) keep their DAM path, so they show as
 * broken as there; the asset download lists them as missing. No nav or footer rows: the
 * header and footer already use the page's language site (/en-uk/nav, /en-uk/footer).
 */

import { damPath, isLocal } from './parsers/embed-code.js';

const PAGE_TEMPLATE = {
  name: 'news',
  description: 'Plaza Premium Lounge press release / news article: banner image, title and lead, body text',
  urlPattern: '/en-uk/News/*',
};

const DAM_ROOT = '/media-da';
// a page's images as their full DA addresses: previewing a DA page fetches each <img> to store it
// with the page, which a site path (/media-da/...) can't be (it becomes about:error)
const DA_CONTENT = 'https://content.da.live/eds-poc/plazapremiumlounge';
const TITLE_SUFFIX = /\s*\|\s*Plaza Premium Lounge\s*$/i;

function meta(document, name) {
  const el = document.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
  return el ? (el.getAttribute('content') || '').trim() : '';
}

/**
 * An image address as the page shows it: same-site ones moved to the DAM, as their DA address
 * (the report's `assets` keeps the DAM path, where the file is uploaded).
 */
function imageSrc(src, { originalURL, damFolder, assets }) {
  const absolute = new URL(src, originalURL).href;
  return isLocal(src, originalURL) ? `${DA_CONTENT}${damPath(absolute, damFolder, assets)}` : absolute;
}

/**
 * The page banner as the Image block (offer-banner, border-rounded). The source shows it as an
 * <img> in .pagebannerImg, or (after its scripts ran) as that element's background image.
 */
function bannerBlock(document, alt, options) {
  const banner = document.querySelector('section.pageBanner .pagebannerImg, .pageBanner .pagebannerImg');
  if (!banner) return null;
  const source = banner.querySelector('img');
  let src = source && (source.getAttribute('src') || source.getAttribute('data-src'));
  if (!src) {
    // a quoted address may hold brackets ("…-01-(2).jpg"), an unquoted one doesn't
    const match = (banner.getAttribute('style') || '').match(/url\(\s*(?:(['"])(.*?)\1|([^'")\s]+))\s*\)/i);
    src = match && (match[2] || match[3]);
  }
  if (!src) return null;
  const img = document.createElement('img');
  img.src = imageSrc(src, options);
  img.alt = alt;
  return WebImporter.Blocks.createBlock(document, { name: 'Image (offer-banner, border-rounded)', cells: [[img]] });
}

/** The article title text. */
function titleText(document) {
  const source = document.querySelector('section.news .title-wrapper h2, section.news .title-wrapper h1, .title-wrapper h2');
  return source ? source.textContent.replace(/\s+/g, ' ').trim() : '';
}

/**
 * The title (a heading 1: the page's title) and the lead paragraph, as the Title block
 * (text-lg, lead).
 */
function titleBlock(document, text) {
  if (!text) return null;
  const cell = document.createElement('div');
  const h1 = document.createElement('h1');
  h1.textContent = text;
  cell.append(h1);
  document.querySelectorAll('section.news .news-content > p').forEach((p) => {
    if (p.closest('.fr-view') || !p.textContent.trim()) return;
    const intro = document.createElement('p');
    intro.innerHTML = p.innerHTML;
    cell.append(intro);
  });
  return WebImporter.Blocks.createBlock(document, { name: 'Title (text-lg, lead)', cells: [[cell]] });
}

/**
 * The article (.fr-view) as default content: its paragraphs, lists, headings, images and links;
 * inline styles, classes and scripts left out, same-site images moved to the DAM.
 */
function articleContent(document, options) {
  const article = document.querySelector('section.news .fr-view, .fr-view');
  if (!article) return [];
  const body = article.cloneNode(true);
  body.querySelectorAll('script, style, link, iframe, noscript, form').forEach((el) => el.remove());
  body.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') || img.getAttribute('data-src');
    if (!src || /^(data|blob):/i.test(src)) { img.remove(); return; }
    img.setAttribute('src', imageSrc(src, options));
    // style, class and data-* go with every element's below
    ['srcset', 'width', 'height'].forEach((name) => img.removeAttribute(name));
  });
  body.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach(({ name }) => {
      if (name === 'style' || name === 'class' || name === 'id' || /^on/i.test(name) || /^data-/i.test(name)) {
        el.removeAttribute(name);
      }
    });
  });
  return [...body.childNodes];
}

export default {
  transform: (payload) => {
    const { document, url, params } = payload;
    const originalURL = params.originalURL || url;
    // decoded first, so typographic quotes are dropped from the path, not kept as %E2%80%99
    const rawPath = decodeURIComponent(new URL(originalURL).pathname).replace(/\/$/, '').replace(/\.html?$/, '');
    const path = WebImporter.FileUtils.sanitizePath(rawPath || '/index');
    const damFolder = `${DAM_ROOT}${path}`;
    // same-site images moved to the DAM: source address → DAM path
    const assets = {};
    const options = { originalURL, damFolder, assets };

    const main = document.createElement('main');
    const text = titleText(document);
    const banner = bannerBlock(document, text, options);
    const title = titleBlock(document, text);
    const article = articleContent(document, options);
    main.append(...[banner, title].filter(Boolean), ...article);

    // page metadata, in its own last section; a same-site share image moves to the DAM too
    const metadata = {};
    const pageTitle = (document.title || meta(document, 'og:title')).replace(TITLE_SUFFIX, '').trim() || text;
    if (pageTitle) metadata.Title = pageTitle;
    const description = meta(document, 'description') || meta(document, 'og:description');
    if (description) metadata.Description = description;
    const ogImage = meta(document, 'og:image');
    if (ogImage) {
      const img = document.createElement('img');
      img.src = imageSrc(ogImage, options);
      img.alt = '';
      metadata.Image = img;
    }
    main.append(document.createElement('hr'), WebImporter.Blocks.getMetadataBlock(document, metadata));

    return [{
      element: main,
      path,
      report: {
        title: metadata.Title || '',
        template: PAGE_TEMPLATE.name,
        blocks: [...(banner ? ['image'] : []), ...(title ? ['title'] : [])],
        assets: JSON.stringify(assets),
      },
    }];
  },
};
