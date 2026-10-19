/* eslint-disable */
/* global WebImporter */

import brandingCardParser from './parsers/branding-card.js';
import brandingCardTestPageTransformer from './transformers/branding-card-test-page.js';

const PAGE_TEMPLATE = {
  name: 'branding-card-test',
  urls: [
    'https://www.plazapremiumlounge.com/en-uk/your-destination-before-departure',
  ],
  description: 'Branding Card test page (/en-uk/drafts/blocks/branding-card): the source\'s "Your Destination Before Departure" destination grid, plus cases for missing fields',
  blocks: [
    {
      name: 'branding-card',
      instances: [
        'section.branding .grid-wrapper',
      ],
    },
  ],
  sections: [
    {
      id: 'section-1',
      name: 'Your Destination Before Departure',
      selector: ['section.branding'],
      style: 'fixed-width',
      blocks: [
        'branding-card',
      ],
      defaultContent: [
        'section.branding > .container > h2',
      ],
    },
  ],
};

// the test page lives with the other block test pages, not at the source path
const TARGET_PATH = '/en-uk/drafts/blocks/branding-card';

const parsers = { 'branding-card': brandingCardParser };
const transformers = [brandingCardTestPageTransformer];

function executeTransformers(hookName, element, payload) {
  const enhancedPayload = { ...payload, template: PAGE_TEMPLATE };
  transformers.forEach((fn) => {
    try { fn(hookName, element, enhancedPayload); }
    catch (e) { console.error(`Transformer failed at ${hookName}:`, e); }
  });
}

function findBlocksOnPage(document, template) {
  const pageBlocks = [];
  template.blocks.forEach((blockDef) => {
    blockDef.instances.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        pageBlocks.push({ name: blockDef.name, selector, element });
      });
    });
  });
  return pageBlocks;
}

export default {
  transform: (payload) => {
    const { document, url, params } = payload;
    const main = document.body;

    executeTransformers('beforeTransform', main, payload);

    const pageBlocks = findBlocksOnPage(document, PAGE_TEMPLATE);
    pageBlocks.forEach((block) => {
      if (!block.element.parentNode) return;
      const parser = parsers[block.name];
      if (!parser) return;
      try { parser(block.element, { document, url, params }); }
      catch (e) { console.error(`Failed to parse ${block.name} (${block.selector}):`, e); }
    });

    executeTransformers('afterTransform', main, payload);

    WebImporter.rules.transformBackgroundImages(main, document);
    WebImporter.rules.adjustImageUrls(main, url, params.originalURL);

    const path = WebImporter.FileUtils.sanitizePath(TARGET_PATH);

    return [{
      element: main,
      path,
      report: { title: 'Branding Card', template: PAGE_TEMPLATE.name, blocks: pageBlocks.map((b) => b.name) },
    }];
  },
};
