import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

const HEADINGS = 'h1, h2, h3, h4, h5, h6';
const IMAGE_LINK = /\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i;

/**
 * Drops images whose source failed to upload (e.g. about:error) so they don't render broken.
 * @param {Element} root
 */
function removeBrokenImages(root) {
  root.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') || '';
    if (src && !src.startsWith('about:')) return;
    const holder = img.closest('picture') || img;
    const link = holder.closest('a');
    (link && link.textContent.trim() === '' ? link : holder).remove();
  });
}

/**
 * Creates an element with an optional class name.
 * @param {string} tag
 * @param {string} [className]
 * @returns {HTMLElement}
 */
function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

/**
 * Turns an icon name such as "app-store" into a readable label ("App Store").
 * @param {string} name
 * @returns {string}
 */
function labelFromIconName(name) {
  return name.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Makes a link open in a new tab.
 * @param {HTMLAnchorElement} a
 */
function openInNewTab(a) {
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
}

/**
 * Returns the media elements (icons, pictures, images) in a node, each wrapped in its
 * authored link when there is one. A link placed on its own right after an image
 * (image-then-link authoring) is attached to that image.
 * @param {Element} node
 * @returns {HTMLElement[]}
 */
function collectMedia(node) {
  const items = [];
  const media = node.querySelectorAll('span.icon, picture, img');
  media.forEach((m) => {
    if (m.tagName === 'IMG' && m.closest('picture, span.icon')) return;
    let item = m.closest('a') || m;
    if (item === m) {
      const para = m.closest('p');
      const next = para && para.nextElementSibling;
      const onlyLink = next && next.children.length === 1 && next.querySelector(':scope > a');
      if (onlyLink && next.textContent.trim() === onlyLink.textContent.trim()) {
        onlyLink.textContent = '';
        onlyLink.append(m);
        next.remove();
        item = onlyLink;
      }
    }
    if (!items.includes(item)) items.push(item);
  });
  return items;
}

/**
 * Labels icon-only links and makes media links open in a new tab.
 * @param {HTMLElement} item
 */
function decorateMediaItem(item) {
  const icon = item.matches('span.icon') ? item : item.querySelector('span.icon');
  const img = item.querySelector('img') || (item.tagName === 'IMG' ? item : null);
  const name = icon && [...icon.classList].find((c) => c.startsWith('icon-'));
  const label = (name && labelFromIconName(name.slice(5))) || (img && img.alt) || '';
  if (item.tagName === 'A') {
    openInNewTab(item);
    if (!item.textContent.trim() && !item.getAttribute('aria-label') && label) {
      item.setAttribute('aria-label', item.title || label);
    }
  } else if (icon && label) {
    icon.setAttribute('role', 'img');
    icon.setAttribute('aria-label', label);
  }
}

/**
 * Builds the list for one column: text links, icon rows, or plain text.
 * @param {Element[]} entries authored list items or elements under a heading
 * @returns {HTMLElement[]}
 */
function buildColumnBody(entries) {
  const nodes = [];
  let list = null;
  entries.forEach((entry) => {
    const media = collectMedia(entry);
    const text = entry.textContent.trim();
    if (media.length && !text) {
      const row = el('ul', 'footer-media-list');
      media.forEach((item) => {
        decorateMediaItem(item);
        const li = el('li');
        li.append(item);
        row.append(li);
      });
      nodes.push(row);
      list = null;
    } else if (entry.querySelector('a') && entry.querySelectorAll('a').length === 1
      && entry.querySelector('a').textContent.trim() === text) {
      if (!list) {
        list = el('ul', 'footer-link-list');
        nodes.push(list);
      }
      const li = el('li');
      li.append(entry.querySelector('a'));
      list.append(li);
    } else if (text) {
      const p = el('p', 'footer-column-text');
      p.append(...entry.childNodes);
      nodes.push(p);
      list = null;
    }
  });
  return nodes;
}

/**
 * Reads column groups from a nested list (li = title + nested ul) or, as a fallback,
 * from headings followed by content.
 * @param {Element} section
 * @returns {{title: string, entries: Element[]}[]}
 */
function readColumnGroups(section) {
  const content = section.querySelector(':scope > .default-content-wrapper') || section;
  const outer = content.querySelector(':scope > ul');
  if (outer && outer.querySelector(':scope > li > ul')) {
    return [...outer.children].map((li) => {
      const nested = li.querySelector(':scope > ul');
      const titleNode = li.querySelector(':scope > p') || li.firstChild;
      return {
        title: titleNode ? titleNode.textContent.trim() : '',
        entries: nested ? [...nested.children] : [],
      };
    });
  }
  const groups = [];
  [...content.children].forEach((child) => {
    if (child.matches(HEADINGS)) {
      groups.push({ title: child.textContent.trim(), entries: [] });
    } else if (groups.length) {
      const entries = child.matches('ul, ol') ? [...child.children] : [child];
      groups[groups.length - 1].entries.push(...entries);
    }
  });
  return groups;
}

/**
 * Keeps accordion toggles in sync with the viewport: below 768px each column title
 * toggles its panel; from 768px all panels are open and the toggles are inert.
 * @param {HTMLElement} band
 */
function syncColumnToggles(band) {
  const desktop = window.matchMedia('(width >= 768px)');
  const sync = () => {
    band.querySelectorAll('.footer-column-toggle').forEach((btn) => {
      const col = btn.closest('.footer-column');
      if (desktop.matches) {
        btn.setAttribute('aria-expanded', 'true');
        btn.tabIndex = -1;
      } else {
        btn.setAttribute('aria-expanded', col.classList.contains('is-open') ? 'true' : 'false');
        btn.removeAttribute('tabindex');
      }
    });
  };
  desktop.addEventListener('change', sync);
  sync();
  band.addEventListener('click', (e) => {
    const btn = e.target.closest('.footer-column-toggle');
    if (!btn || desktop.matches) return;
    const col = btn.closest('.footer-column');
    const open = !col.classList.contains('is-open');
    col.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
}

/**
 * Builds the link-column band. Each column title doubles as an accordion toggle on mobile.
 * @param {Element} section
 * @returns {HTMLElement}
 */
function buildColumns(section) {
  const band = el('div', 'footer-columns');
  readColumnGroups(section).forEach(({ title, entries }, i) => {
    const col = el('div', 'footer-column');
    const panel = el('div', 'footer-column-panel');
    panel.id = `footer-column-panel-${i + 1}`;
    const panelInner = el('div', 'footer-column-panel-inner');
    panelInner.append(...buildColumnBody(entries));
    panel.append(panelInner);
    if (title) {
      const h = el('h3', 'footer-column-title');
      const toggle = el('button', 'footer-column-toggle');
      toggle.type = 'button';
      toggle.textContent = title;
      toggle.setAttribute('aria-controls', panel.id);
      h.append(toggle);
      col.append(h);
    } else {
      col.classList.add('is-open');
    }
    col.append(panel);
    band.append(col);
  });
  syncColumnToggles(band);
  return band;
}

/**
 * Builds the brand-family band from a table (block cells) or from headings.
 * A cell/group without a heading holding an image becomes the lead logo.
 * @param {Element} section
 * @returns {HTMLElement}
 */
function buildBrands(section) {
  const band = el('div', 'footer-brand-family');
  const table = section.querySelector('.block');
  const cells = table
    ? [...table.querySelectorAll(':scope > div > div')]
    : [section.querySelector(':scope > .default-content-wrapper') || section];
  const lead = el('div', 'footer-brand-lead');
  const groups = el('div', 'footer-brand-groups');

  const addGroup = (heading, nodes) => {
    const holder = el('div');
    holder.append(...nodes);
    const logos = collectMedia(holder);
    if (!heading) {
      logos.forEach((item) => { decorateMediaItem(item); lead.append(item); });
      return;
    }
    const group = el('div', 'footer-brand-group');
    const caption = el('p', 'footer-brand-caption');
    caption.textContent = heading.textContent.trim();
    const row = el('div', 'footer-brand-logos');
    logos.forEach((item) => { decorateMediaItem(item); row.append(item); });
    group.style.setProperty('--logo-count', Math.max(logos.length, 1));
    group.append(caption, row);
    groups.append(group);
  };

  cells.forEach((cell) => {
    let heading = null;
    let nodes = [];
    [...cell.children].forEach((child) => {
      if (child.matches(HEADINGS)) {
        if (heading || nodes.length) addGroup(heading, nodes);
        heading = child;
        nodes = [];
      } else {
        nodes.push(child);
      }
    });
    if (heading || nodes.length) addGroup(heading, nodes);
  });

  if (lead.children.length) band.append(lead);
  band.append(groups);
  const wrapper = el('div', 'footer-brands');
  wrapper.append(band);
  return wrapper;
}

/**
 * Builds the legal/copyright band; its links open in a new tab.
 * @param {Element} section
 * @returns {HTMLElement}
 */
function buildLegal(section) {
  const band = el('div', 'footer-legal');
  const content = section.querySelector(':scope > .default-content-wrapper') || section;
  band.append(...content.childNodes);
  band.querySelectorAll('a').forEach(openInNewTab);
  return band;
}

/**
 * Opens links to image files (e.g. a WeChat QR code) in a lightbox dialog.
 * @param {HTMLElement} block
 */
function enableImageLightbox(block) {
  block.querySelectorAll('a[href]').forEach((a) => {
    if (!IMAGE_LINK.test(a.getAttribute('href'))) return;
    a.removeAttribute('target');
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const dialog = el('dialog', 'footer-lightbox');
      const close = el('button', 'footer-lightbox-close');
      close.type = 'button';
      close.setAttribute('aria-label', 'Close');
      const img = el('img');
      img.src = a.href;
      img.alt = a.getAttribute('aria-label') || '';
      dialog.append(close, img);
      close.addEventListener('click', () => dialog.close());
      dialog.addEventListener('click', (ev) => { if (ev.target === dialog) dialog.close(); });
      dialog.addEventListener('close', () => dialog.remove());
      block.append(dialog);
      dialog.showModal();
    });
  });
}

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  // load footer as fragment
  const footerMeta = getMetadata('footer');
  const footerPath = footerMeta ? new URL(footerMeta, window.location).pathname : '/footer';
  const fragment = await loadFragment(footerPath);
  block.textContent = '';
  if (!fragment) return;

  removeBrokenImages(fragment);
  // modal sections (section metadata "modal") are registered as modals, not footer bands
  const sections = [...fragment.querySelectorAll(':scope > .section:not([data-modal])')];
  const inner = el('div', 'footer-inner');
  sections.forEach((section, i) => {
    let band;
    if (i === 0) band = buildColumns(section);
    else if (i === sections.length - 1) band = buildLegal(section);
    else band = buildBrands(section);
    band.classList.add('footer-band');
    if (section.dataset.sectionName) band.dataset.sectionName = section.dataset.sectionName;
    inner.append(band);
    if (i < sections.length - 1) inner.append(el('hr', 'footer-divider'));
  });

  block.append(inner);
  enableImageLightbox(block);
}
