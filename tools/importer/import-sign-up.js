/* eslint-disable */
/* global WebImporter */

import customFormParser from './parsers/custom-form.js';
import signUpPageTransformer from './transformers/sign-up-page.js';

const PAGE_TEMPLATE = {
  name: 'sign-up',
  urls: [
    'https://www.plazapremiumlounge.com/en-uk/sign-up',
  ],
  description: 'Sign up page (/en-uk/sign-up): the page title and the sign up form as a Custom Form (two-columns)',
  blocks: [
    {
      name: 'custom-form',
      instances: [
        '#formBookingRegistration',
      ],
    },
  ],
  sections: [
    {
      id: 'section-1',
      name: 'Sign Up',
      selector: ['section.news'],
      style: null,
      blocks: [
        'custom-form',
      ],
      defaultContent: [
        'section.news .title-wrapper h2',
      ],
    },
  ],
};

const parsers = { 'custom-form': customFormParser };
const transformers = [signUpPageTransformer];

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
      report: { title: 'Sign Up', template: PAGE_TEMPLATE.name, blocks: pageBlocks.map((b) => b.name) },
    }];
  },
};
