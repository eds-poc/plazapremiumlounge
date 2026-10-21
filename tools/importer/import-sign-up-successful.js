/* eslint-disable */
/* global WebImporter */

import signUpSuccessfulPageTransformer from './transformers/sign-up-successful-page.js';

const PAGE_TEMPLATE = {
  name: 'sign-up-successful',
  urls: [
    'https://www.plazapremiumlounge.com/en-uk/sign-up-successful-page',
  ],
  description: 'Sign up confirmation page (/en-uk/sign-up-successful-page): the thank-you heading, text and a Back to Home button, as default content',
  blocks: [],
  sections: [
    {
      id: 'section-1',
      name: 'Thank You',
      selector: ['section.thank-you-section'],
      style: null,
      blocks: [],
      defaultContent: [
        'section.thank-you-section h1.thank-you-title',
        'section.thank-you-section p.thank-you-message',
        'section.thank-you-section .verification-info-box p',
        'section.thank-you-section .action-buttons-group a',
      ],
    },
  ],
};

const parsers = {};
const transformers = [signUpSuccessfulPageTransformer];

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

    const rawPath = new URL(params.originalURL).pathname
      .replace(/\/$/, '')
      .replace(/\.html?$/, '');
    const path = WebImporter.FileUtils.sanitizePath(rawPath === '' ? '/index' : rawPath);

    return [{
      element: main,
      path,
      report: { title: 'Sign Up Successful', template: PAGE_TEMPLATE.name, blocks: pageBlocks.map((b) => b.name) },
    }];
  },
};
