/* eslint-disable */
/* global WebImporter */

/**
 * Sections transformer for plazapremiumlounge.com.
 *
 * The source already separates every pass list with a direct-child <hr> of
 * `.contentWrapper > div`, and those hr elements are exactly the section
 * boundaries. In beforeTransform each non-first section is resolved from
 * payload.template.sections; the existing source <hr> is reused as its break
 * (either the matched element itself or its previous element sibling) and a
 * new <hr> is inserted only when none exists. Consecutive <hr> elements are
 * collapsed so no empty sections are produced.
 *
 * Section Metadata is emitted in afterTransform only for sections with a
 * style (none on the eligible-lounges template, so no metadata blocks).
 */

const MARKER = 'data-excat-section-id';

function findSectionElement(document, section) {
  const selectors = Array.isArray(section.selector) ? section.selector : [section.selector];
  for (const sel of selectors) {
    if (!sel) continue;
    try {
      const el = document.querySelector(sel);
      if (el) return el;
    } catch (e) {
      // invalid selector in this runtime; try the next one
    }
  }
  return null;
}

function prevSiblingHr(el) {
  const prev = el.previousElementSibling;
  return prev && prev.tagName === 'HR' ? prev : null;
}

function collapseConsecutiveHrs(document) {
  document.querySelectorAll('hr').forEach((hr) => {
    if (!hr.isConnected) return;
    let next = hr.nextElementSibling;
    while (next && next.tagName === 'HR') {
      const dup = next;
      next = next.nextElementSibling;
      // keep a marked hr over an unmarked one
      if (dup.hasAttribute(MARKER) && !hr.hasAttribute(MARKER)) {
        hr.setAttribute(MARKER, dup.getAttribute(MARKER));
      }
      dup.remove();
    }
  });
}

export default function transform(hookName, element, payload) {
  const document = (payload && payload.document) || element.ownerDocument;
  const template = payload && payload.template;
  const sections = (template && template.sections) || [];
  if (sections.length < 2) return;

  if (hookName === 'beforeTransform') {
    // Reverse order so earlier insertions never shift later lookups.
    for (let i = sections.length - 1; i >= 0; i -= 1) {
      const section = sections[i];
      const el = findSectionElement(document, section);
      if (!el) continue;

      if (i === 0) {
        // First section never gets a break; a styled first section gets a
        // temporary marker hr that afterTransform removes.
        if (section.style) {
          const marker = document.createElement('hr');
          marker.setAttribute(MARKER, section.id);
          el.before(marker);
        }
        continue;
      }

      let hr = el.tagName === 'HR' ? el : prevSiblingHr(el);
      if (!hr) {
        hr = document.createElement('hr');
        el.before(hr);
      }
      if (section.style) hr.setAttribute(MARKER, section.id);
    }

    // The first section must not start with a break.
    const first = findSectionElement(document, sections[0]);
    if (first && !sections[0].style) {
      const lead = prevSiblingHr(first);
      if (lead && !lead.hasAttribute(MARKER)) lead.remove();
    }

    collapseConsecutiveHrs(document);
  }

  if (hookName === 'afterTransform') {
    for (let i = sections.length - 1; i >= 0; i -= 1) {
      const section = sections[i];
      const marker = document.querySelector(`hr[${MARKER}="${section.id}"]`);
      if (!section.style) {
        if (marker) marker.removeAttribute(MARKER);
        continue;
      }

      const meta = WebImporter.Blocks.createBlock(document, {
        name: 'Section Metadata',
        cells: { style: section.style },
      });

      // Place metadata at the end of the section: just before the next break.
      let anchor = marker || findSectionElement(document, section);
      if (!anchor) continue;
      let node = anchor.nextElementSibling;
      let last = anchor;
      while (node && node.tagName !== 'HR') {
        last = node;
        node = node.nextElementSibling;
      }
      last.after(meta);

      if (marker) {
        if (i === 0) marker.remove();
        else marker.removeAttribute(MARKER);
      }
    }

    collapseConsecutiveHrs(document);
  }
}
