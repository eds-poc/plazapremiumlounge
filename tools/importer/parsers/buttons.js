/* eslint-disable */
/* global WebImporter */

/**
 * Parser for the Buttons block (eligible-lounges jump links).
 *
 * Source: loose sibling pills `a.btn.btn-default`, separated by whitespace and
 * occasional <br>, directly in `.contentWrapper > div` or in a nested <div>.
 * The parser is invoked once per pill: the first pill of a run collects every
 * following sibling pill (skipping whitespace and <br>) until any other
 * element, and becomes ONE Buttons table; later pills of the run are already
 * detached/consumed and are ignored.
 *
 * Output (blocks/buttons/README.md): one row per button, 2 cells:
 *   cell 1 the link, cell 2 empty (no style: default primary). No options.
 * Hrefs are rewritten from the source anchor ids to the target heading ids.
 */

// sourceHref -> href, from migration-work/authoring-analysis.json.
const HREF_MAP = {
  '#ppl': '#lounge-pass-global-eligible-locations',
  '#americas': '#lounge-pass-americas-eligible-locations',
  '#canada': '#lounge-pass-canada-eligible-locations',
  '#australia': '#lounge-pass-australia-eligible-locations',
  '#europe': '#lounge-pass-europe-eligible-locations',
  '#auuk': '#lounge-pass-australia-south-east-asia-united-kingdom-eligible-locations',
  '#meuk': '#lounge-pass-middle-east-türkiye-united-kingdom-eligible-locations',
  '#myid': '#lounge-pass-malaysia-indonesia-saudi-arabia-eligible-locations',
  '#hktp': '#lounge-pass-hong-kong-taipei-eligible-locations',
  '#hkshg': '#lounge-pass-hong-kong-shanghai-eligible-locations',
  '#klsg': '#lounge-pass-kuala-lumpur-singapore-eligible-locations',
  '#jasg': '#lounge-pass-jakarta-singapore-eligible-locations',
  '#ddjr': '#lounge-pass-dubai-dammam-jeddah-riyadh-eligible-locations',
  '#msi': '#lounge-pass-kuala-lumpur-singapore-jakarta-medan-eligible-locations',
  '#ausi': '#lounge-pass-australia-singapore-eligible-locations',
  '#meaf': '#lounge-pass-middle-east-africa-eligible-locations',
  '#caijed': '#lounge-pass-cairo-jeddah-eligible-locations',
  '#aunz': '#lounge-pass-australia-new-zealand-eligible-locations',
  '#mc': '#lounge-pass-mainland-china-eligible-locations',
  '#asia': '#lounge-pass-asia-eligible-locations',
  '#bkk': '#lounge-pass-bangkok-eligible-locations',
  '#bni': '#buggy--intervals-pass-eligible-locations',
  '#bnl': '#buggy--lounge-pass-eligible-locations',
  '#ppf': '#plaza-premium-first-2-visit-pass-eligible-locations',
  '#vino-volo': '#vino-volo-dining-pass-eligible-locations',
};

const CONSUMED_ATTR = 'data-buttons-consumed';

function norm(text) {
  return (text || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

function isPill(node) {
  return node && node.nodeType === 1 && node.tagName === 'A'
    && node.classList.contains('btn') && node.classList.contains('btn-default');
}

// Separators between pills: whitespace, <br>, and whitespace-only inline
// wrappers (html2md's pre-pass moves the spaces between links into
// `<span> </span>` before the parsers run).
function isSkippable(node) {
  if (node.nodeType === 3) return !norm(node.textContent);
  if (node.nodeType === 8) return true;
  if (node.nodeType !== 1) return false;
  if (node.tagName === 'BR') return true;
  return node.tagName === 'SPAN' && !node.children.length && !norm(node.textContent);
}

function mapHref(href) {
  if (!href) return href;
  return Object.prototype.hasOwnProperty.call(HREF_MAP, href) ? HREF_MAP[href] : href;
}

export default function parse(element, { document }) {
  // Already folded into an earlier pill's table.
  if (!element.parentNode || element.hasAttribute(CONSUMED_ATTR)) return;

  // Collect this pill and the following sibling pills of the same run.
  const pills = [element];
  const separators = [];
  let pending = [];
  let node = element.nextSibling;
  while (node) {
    if (isPill(node)) {
      pills.push(node);
      separators.push(...pending);
      pending = [];
    } else if (isSkippable(node)) {
      if (node.nodeType === 1) pending.push(node);
      else if (node.nodeType === 3) pending.push(node);
    } else {
      break;
    }
    node = node.nextSibling;
  }

  const cells = pills.map((pill) => {
    const link = document.createElement('a');
    const href = mapHref(pill.getAttribute('href'));
    if (href) link.setAttribute('href', href);
    link.textContent = norm(pill.textContent);
    return [link, ''];
  });

  // Remove the other consumed pills and the <br>s between them.
  pills.slice(1).forEach((pill) => {
    pill.setAttribute(CONSUMED_ATTR, '');
    pill.remove();
  });
  separators.forEach((br) => br.remove());

  const block = WebImporter.Blocks.createBlock(document, { name: 'buttons (pill)', cells });
  element.replaceWith(block);
}
