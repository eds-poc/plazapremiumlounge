/* eslint-disable */
/* global WebImporter */

/**
 * Parser for the Directory block (eligible-lounges pass lists).
 *
 * Source (`.contentWrapper > div > h3 + div`): a wrapper of column divs, each
 * a stream of `<h5>` country names, airport titles (`<strong>`, or a `<p>`
 * holding only a `<strong>`, possibly after a `<br>`) and `<ul>` lounge lists,
 * with `<br>` spacers and nested divs. Some lists continue in loose siblings
 * after the wrapper (e.g. Shanghai in the hkshg list, extra rows in asia,
 * caijed and ppf) up to the next `<hr>`; those are consumed and removed.
 *
 * Output (blocks/directory/README.md): one row per group, 2 cells:
 *   cell 1 the country name (plain text; empty for content before any h5),
 *   cell 2 the entries: `<p><strong>Airport</strong></p>` + `<ul>` per airport.
 * Empty and "<Country> (Con't)" h5s continue the current row.
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

const NBSP = / /g;

function norm(text) {
  return (text || '').replace(NBSP, ' ').replace(/\s+/g, ' ');
}

function clean(text) {
  return norm(text).trim();
}

function mapHref(href) {
  if (!href) return href;
  return Object.prototype.hasOwnProperty.call(HREF_MAP, href) ? HREF_MAP[href] : href;
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
  // Merge adjacent text nodes so a separating space stays attached to its text.
  root.normalize();
}

/**
 * Appends a cleaned inline copy of `nodes` to `target`: text normalised,
 * links (mapped href only) and strong/em kept, classes and other wrappers
 * (span etc.) dropped.
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
      const href = mapHref(node.getAttribute('href'));
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

function isSignificantText(node) {
  return node.nodeType === 3 && !!clean(node.textContent);
}

/**
 * Flattens a source subtree into an ordered stream of items:
 * { type: 'h5' | 'title' | 'ul' | 'p', node }.
 */
function flatten(node, items) {
  if (node.nodeType === 3) {
    if (isSignificantText(node)) items.push({ type: 'p', node });
    return;
  }
  if (node.nodeType !== 1) return;
  const tag = node.tagName;
  if (tag === 'BR' || tag === 'HR' || tag === 'SCRIPT' || tag === 'STYLE') return;
  if (tag === 'H5' || tag === 'H4' || tag === 'H6') {
    items.push({ type: 'h5', node });
    return;
  }
  if (tag === 'STRONG' || tag === 'B') {
    if (clean(node.textContent)) items.push({ type: 'title', node });
    return;
  }
  if (tag === 'UL' || tag === 'OL') {
    items.push({ type: 'ul', node });
    return;
  }
  if (tag === 'P') {
    if (!clean(node.textContent)) return;
    const els = [...node.children].filter((c) => c.tagName !== 'BR'
      && !(c.tagName === 'SPAN' && !c.children.length && !clean(c.textContent)));
    const looseText = [...node.childNodes].some(isSignificantText);
    if (els.length === 1 && (els[0].tagName === 'STRONG' || els[0].tagName === 'B') && !looseText) {
      items.push({ type: 'title', node: els[0] });
    } else {
      items.push({ type: 'p', node });
    }
    return;
  }
  if (tag === 'A') {
    if (clean(node.textContent)) items.push({ type: 'p', node });
    return;
  }
  // div, span and other wrappers: walk their children in order.
  node.childNodes.forEach((child) => flatten(child, items));
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isContinuation(text, country) {
  if (!country) return false;
  const re = new RegExp(`^${escapeRegExp(country)}\\s*\\(Con['’]t\\)$`, 'i');
  return re.test(text);
}

function buildList(ul, document) {
  const list = document.createElement('ul');
  [...ul.children].forEach((li) => {
    if (li.tagName !== 'LI') return;
    const item = document.createElement('li');
    appendInline(item, [...li.childNodes], document);
    trimEdges(item);
    if (clean(item.textContent)) list.append(item);
  });
  return list.children.length ? list : null;
}

function buildParagraph(node, document, bold) {
  const p = document.createElement('p');
  if (bold) {
    const strong = document.createElement('strong');
    appendInline(strong, [...node.childNodes], document);
    trimEdges(strong);
    p.append(strong);
  } else {
    appendInline(p, node.nodeType === 3 ? [node] : [node], document);
    trimEdges(p);
  }
  return clean(p.textContent) ? p : null;
}

function nextSignificant(node) {
  let n = node.nextSibling;
  while (n && ((n.nodeType === 3 && !clean(n.textContent))
    || n.nodeType === 8
    || (n.nodeType === 1 && (n.tagName === 'BR'
      || (n.tagName === 'SPAN' && !n.children.length && !clean(n.textContent)))))) {
    n = n.nextSibling;
  }
  return n;
}

/**
 * True where this pass list ends: a section break or heading, an existing
 * block table, the jump-links area (pills, or a wrapper holding them), or a
 * loose bold label that does not introduce a list (e.g. "View ... Eligible
 * Locations"). html2md drops every source <hr> before parsing, and the
 * sections transformer only restores breaks before the pass sections, so the
 * last list is followed directly by the bottom jump links.
 */
function isListEnd(node) {
  if (node.nodeType !== 1) return false;
  const tag = node.tagName;
  if (['HR', 'H1', 'H2', 'H3', 'TABLE'].includes(tag)) return true;
  if (tag === 'A' && node.classList.contains('btn')) return true;
  if (node.querySelector('table, a.btn, h3')) return true;
  if (tag === 'STRONG' || tag === 'B') {
    const next = nextSignificant(node);
    return !(next && next.nodeType === 1 && (next.tagName === 'UL' || next.tagName === 'OL'));
  }
  return false;
}

export default function parse(element, { document }) {
  // Loose siblings after the wrapper that still belong to this list.
  const trailing = [];
  let sib = element.nextSibling;
  while (sib && !isListEnd(sib)) {
    trailing.push(sib);
    sib = sib.nextSibling;
  }

  const items = [];
  flatten(element, items);
  trailing.forEach((n) => flatten(n, items));

  const rows = [];
  let current = { country: '', entries: [] };
  rows.push(current);

  items.forEach((item) => {
    if (item.type === 'h5') {
      const text = clean(item.node.textContent);
      if (!text || isContinuation(text, current.country)) return;
      current = { country: text, entries: [] };
      rows.push(current);
      return;
    }
    let out = null;
    if (item.type === 'title') {
      // Airport title (followed by a list) or a lone bold line: both bold paragraphs.
      out = buildParagraph(item.node, document, true);
    } else if (item.type === 'ul') {
      out = buildList(item.node, document);
    } else {
      out = buildParagraph(item.node, document, false);
    }
    if (out) current.entries.push(out);
  });

  const cells = rows
    .filter((row) => row.entries.length)
    .map((row) => [row.country, row.entries]);

  trailing.forEach((n) => n.remove());

  const block = WebImporter.Blocks.createBlock(document, { name: 'directory', cells });
  element.replaceWith(block);
}
