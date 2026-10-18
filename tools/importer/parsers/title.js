/* eslint-disable */
/* global WebImporter */

/**
 * Parser for the Title block (eligible-lounges page title).
 *
 * Source (`.contentWrapper > div > h1`):
 *   <p>Plaza Premium Lounge Passes</p>
 *   <h1>Eligible Lounge Locations</h1>The following are lounges ... Read&nbsp;<a href="/en-uk/frequently-asked-questions?faqId=2855">FAQs</a>.<br><br>
 *
 * Output (blocks/title/README.md): one cell holding
 *   eyebrow paragraph, heading 1, intro paragraph.
 * The consumed <p>, loose intro nodes and the trailing <br>s are removed.
 */

const NBSP = / /g;

function norm(text) {
  return (text || '').replace(NBSP, ' ').replace(/\s+/g, ' ');
}

function isBlank(node) {
  return node.nodeType === 3 && !norm(node.textContent).trim();
}

/**
 * Appends a cleaned inline copy of `nodes` to `target`: text normalised,
 * links (href only) and strong/em kept, other wrappers unwrapped.
 */
function appendInline(target, nodes, document) {
  nodes.forEach((node) => {
    if (node.nodeType === 3) {
      target.append(document.createTextNode(norm(node.textContent)));
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    if (tag === 'br') {
      target.append(document.createTextNode(' '));
      return;
    }
    let wrapper = null;
    if (tag === 'a') {
      wrapper = document.createElement('a');
      const href = node.getAttribute('href');
      if (href) wrapper.setAttribute('href', href);
    } else if (tag === 'strong' || tag === 'b') {
      wrapper = document.createElement('strong');
    } else if (tag === 'em' || tag === 'i') {
      wrapper = document.createElement('em');
    }
    if (!wrapper) {
      appendInline(target, [...node.childNodes], document);
      return;
    }
    appendInline(wrapper, [...node.childNodes], document);
    const text = wrapper.textContent;
    if (!text.trim()) {
      if (text) target.append(document.createTextNode(' '));
      return;
    }
    // Keep whitespace outside inline formatting so markdown stays valid.
    if (/^\s/.test(text)) target.append(document.createTextNode(' '));
    trimEdges(wrapper);
    target.append(wrapper);
    if (/\s$/.test(text)) target.append(document.createTextNode(' '));
  });
}

function textNodes(root) {
  const out = [];
  const walk = (n) => {
    if (n.nodeType === 3) out.push(n);
    else n.childNodes.forEach(walk);
  };
  walk(root);
  return out;
}

/** Collapses doubled spaces across node boundaries and trims both ends. */
function trimEdges(root) {
  const nodes = textNodes(root);
  let prevSpace = true;
  nodes.forEach((t) => {
    let v = t.textContent.replace(/\s+/g, ' ');
    if (prevSpace) v = v.replace(/^ /, '');
    if (v) prevSpace = v.endsWith(' ');
    t.textContent = v;
  });
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    const v = nodes[i].textContent.replace(/ $/, '');
    nodes[i].textContent = v;
    if (v) break;
  }
}

export default function parse(element, { document }) {
  const content = [];

  // Eyebrow: the <p> right before the heading.
  const eyebrowSrc = element.previousElementSibling;
  if (eyebrowSrc && eyebrowSrc.tagName === 'P' && norm(eyebrowSrc.textContent).trim()) {
    const eyebrow = document.createElement('p');
    appendInline(eyebrow, [...eyebrowSrc.childNodes], document);
    trimEdges(eyebrow);
    content.push(eyebrow);
    eyebrowSrc.remove();
  }

  // Heading 1 (a fresh copy, so the source h1 can be replaced by the block).
  const heading = document.createElement('h1');
  appendInline(heading, [...element.childNodes], document);
  trimEdges(heading);
  content.push(heading);

  // Intro: loose text nodes and inline elements after the h1, up to the first <br>.
  const introNodes = [];
  let node = element.nextSibling;
  while (node && !(node.nodeType === 1 && node.tagName === 'BR')) {
    if (node.nodeType === 1 && !['A', 'STRONG', 'B', 'EM', 'I', 'SPAN'].includes(node.tagName)) break;
    introNodes.push(node);
    node = node.nextSibling;
  }
  if (introNodes.some((n) => norm(n.textContent).trim())) {
    const intro = document.createElement('p');
    appendInline(intro, introNodes, document);
    trimEdges(intro);
    content.push(intro);
    introNodes.forEach((n) => n.remove());
    // Drop the <br>s (and whitespace between them) that ended the intro.
    let next = element.nextSibling;
    while (next && ((next.nodeType === 1 && next.tagName === 'BR') || isBlank(next))) {
      const drop = next;
      next = next.nextSibling;
      drop.remove();
    }
  }

  const cells = [[content]];
  const block = WebImporter.Blocks.createBlock(document, { name: 'title (plum)', cells });
  element.replaceWith(block);
}
