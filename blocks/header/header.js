import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';
import { applyButtonAction } from '../../scripts/button-actions.js';
import {
  modalNameFromHref, openNamedModal, whenModal,
} from '../../scripts/modal.js';
import { CURRENCY_EVENT, getCurrency } from '../../scripts/currency.js';

// desktop layout from 1200px, as the source (webslidemenu breakpoint)
const desktop = window.matchMedia('(width >= 1200px)');
// the bar turns compact and maroon once the page has scrolled this far (source: 100px)
const SCROLL_THRESHOLD = 100;
let uid = 0;

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
 * A unique id for aria-controls.
 * @param {string} prefix
 * @returns {string}
 */
function nextId(prefix) {
  uid += 1;
  return `header-${prefix}-${uid}`;
}

/**
 * An icon element for UI chrome (arrows, close), drawn from the code icons with currentColor.
 * @param {string} name
 * @returns {HTMLSpanElement}
 */
function chromeIcon(name) {
  const icon = el('span', `header-chrome-icon header-chrome-${name}`);
  icon.setAttribute('aria-hidden', 'true');
  return icon;
}

/**
 * Lets authored `:name:` icons (from the icon library or the code icons) take the text colour:
 * once an icon image has its source, the image becomes a CSS mask filled with currentColor.
 * @param {Element} root
 */
function maskIcons(root) {
  root.querySelectorAll('span.icon').forEach((span) => {
    const img = span.querySelector('img');
    if (!img) return;
    // load now (icons in closed menus would wait), and mask once loaded so no empty box shows
    img.loading = 'eager';
    const mask = () => {
      span.style.setProperty('--header-icon', `url("${img.src}")`);
      span.classList.add('is-masked');
    };
    const apply = () => {
      if (!img.getAttribute('src')) return false;
      if (img.complete && img.naturalWidth) mask();
      else img.addEventListener('load', mask, { once: true });
      return true;
    };
    if (apply()) return;
    const observer = new MutationObserver(() => { if (apply()) observer.disconnect(); });
    observer.observe(img, { attributes: true, attributeFilter: ['src'] });
  });
}

/**
 * A readable label from an icon name (`railway-lounge-white` → "Railway lounge").
 * @param {string} name
 * @returns {string}
 */
function iconLabel(name) {
  const words = name.replace(/-(white|black)$/, '').split('-').join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The text of a list item without its nested list.
 * @param {HTMLLIElement} li
 * @returns {{label: string, link: HTMLAnchorElement|null, icons: HTMLElement[]}}
 */
function readItem(li) {
  const own = [...li.childNodes].filter((n) => !(n.nodeType === 1 && n.matches('ul, ol')));
  const holder = el('div');
  holder.append(...own.map((n) => n.cloneNode(true)));
  const link = holder.querySelector('a[href]');
  const icons = [...holder.querySelectorAll('span.icon')];
  icons.forEach((i) => i.remove());
  const label = (link ? link.textContent : holder.textContent).replace(/\s+/g, ' ').trim();
  return { label, link, icons };
}

/**
 * The nested list of a list item, if any.
 * @param {HTMLLIElement} li
 * @returns {HTMLLIElement[]}
 */
function children(li) {
  const list = li.querySelector(':scope > ul, :scope > ol');
  return list ? [...list.children].filter((c) => c.tagName === 'LI') : [];
}

/**
 * How many levels of nesting a list item has below it (0 = plain link).
 * @param {HTMLLIElement} li
 * @returns {number}
 */
function depth(li) {
  const kids = children(li);
  return kids.length ? 1 + Math.max(...kids.map(depth)) : 0;
}

/**
 * A menu link: the authored link (with its link behaviour) or plain text.
 * @param {{label: string, link: HTMLAnchorElement|null, icons: HTMLElement[]}} item
 * @param {string} className
 * @returns {HTMLElement}
 */
function menuLink(item, className) {
  let node;
  if (item.link) {
    node = el('a', className);
    node.href = item.link.getAttribute('href');
    node.textContent = item.label;
    if (item.link.title && item.link.title !== item.label) node.title = item.link.title;
    node = applyButtonAction(node);
  } else {
    node = el('span', className);
    node.textContent = item.label;
  }
  if (!item.icons.length) return node;
  // lounge-type badges after the label (e.g. :railway-lounge-white:)
  const wrap = el('span', 'header-link-wrap');
  wrap.append(node);
  item.icons.forEach((icon) => {
    const badge = icon.cloneNode(true);
    const name = [...icon.classList].find((c) => c.startsWith('icon-'))?.slice(5) || '';
    badge.classList.add('header-badge');
    badge.setAttribute('role', 'img');
    badge.setAttribute('aria-label', iconLabel(name));
    badge.title = iconLabel(name);
    wrap.append(badge);
  });
  return wrap;
}

/**
 * Builds one column of the desktop mega menu from a list: items with children are buttons that
 * show their own column to the right (one active at a time, first one active); leaves are links.
 * @param {HTMLLIElement[]} items
 * @param {number} level 1 for the first column
 * @returns {HTMLElement}
 */
function megaColumn(items, level) {
  const wrap = el('div', `header-mega-level header-mega-level-${level}`);
  const list = el('ul', 'header-mega-list');
  const panels = el('div', 'header-mega-panels');
  const buttons = [];
  items.forEach((li, i) => {
    const item = readItem(li);
    const kids = children(li);
    const entry = el('li', 'header-mega-item');
    if (kids.length) {
      const button = el('button', 'header-mega-tab');
      button.type = 'button';
      button.textContent = item.label;
      button.append(chromeIcon('arrow-right-long'));
      const panel = megaColumn(kids, level + 1);
      panel.id = nextId('mega');
      panel.classList.add('header-mega-panel');
      button.setAttribute('aria-controls', panel.id);
      button.setAttribute('aria-expanded', i === 0 ? 'true' : 'false');
      panel.hidden = i !== 0;
      button.addEventListener('click', () => {
        buttons.forEach((b) => {
          const on = b === button;
          b.setAttribute('aria-expanded', on ? 'true' : 'false');
          document.getElementById(b.getAttribute('aria-controls')).hidden = !on;
        });
      });
      buttons.push(button);
      entry.append(button);
      panels.append(panel);
    } else {
      entry.classList.add('header-mega-leaf');
      entry.append(menuLink(item, 'header-mega-link'));
    }
    list.append(entry);
  });
  wrap.append(list);
  if (panels.children.length) wrap.append(panels);
  return wrap;
}

/**
 * Builds a step-by-step panel (mobile and tablet) for an item with nested levels: each level is a
 * page with a back button; items with children open the next page, leaves are links.
 * @param {HTMLLIElement} li
 * @param {Function} closeAll Closes the panel and the menu
 * @returns {HTMLElement}
 */
function drillPanel(li, closeAll) {
  const panel = el('div', 'header-drill');
  panel.id = nextId('drill');
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', readItem(li).label);
  const pages = [];
  const show = (page) => {
    pages.forEach((p) => { p.hidden = p !== page; });
    (page.querySelector('.header-drill-list button, .header-drill-list a') || page.querySelector('.header-drill-close'))?.focus();
  };
  const buildPage = (items, parent) => {
    const page = el('div', 'header-drill-page');
    page.hidden = true;
    const toolbar = el('div', 'header-drill-toolbar');
    const back = el('button', 'header-drill-back');
    back.type = 'button';
    back.setAttribute('aria-label', 'Back');
    back.append(chromeIcon('arrow-left'));
    if (!parent) back.classList.add('is-hidden');
    back.addEventListener('click', () => (parent ? show(parent) : null));
    const close = el('button', 'header-drill-close');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close');
    close.append(chromeIcon('close'));
    close.addEventListener('click', closeAll);
    toolbar.append(back, close);
    const list = el('ul', 'header-drill-list');
    items.forEach((child) => {
      const item = readItem(child);
      const kids = children(child);
      const entry = el('li');
      if (kids.length) {
        const next = buildPage(kids, page);
        const button = el('button', 'header-drill-item');
        button.type = 'button';
        button.append(Object.assign(el('span', 'header-drill-label'), { textContent: item.label }), chromeIcon('arrow-right'));
        button.addEventListener('click', () => show(next));
        entry.append(button);
      } else {
        entry.append(menuLink(item, 'header-drill-link'));
      }
      list.append(entry);
    });
    page.append(toolbar, list);
    pages.push(page);
    panel.append(page);
    return page;
  };
  const first = buildPage(children(li), null);
  panel.open = () => { panel.hidden = false; show(first); };
  return panel;
}

/**
 * Builds the main navigation: desktop menu items with a dropdown (one level below) or a mega
 * menu (more levels); on mobile the same items become the slide-in menu, with an accordion for a
 * dropdown and a step-by-step panel for a mega menu.
 * @param {HTMLElement} section The navigation section
 * @param {HTMLElement} header
 * @returns {{menu: HTMLUListElement, drills: HTMLElement[]}}
 */
function buildMenu(section, header) {
  const source = section.querySelector('ul, ol');
  const menu = el('ul', 'header-menu');
  const drills = [];
  if (!source) return { menu, drills };
  [...source.children].filter((c) => c.tagName === 'LI').forEach((li) => {
    const item = readItem(li);
    const d = depth(li);
    const entry = el('li', 'header-item');
    if (!d) {
      entry.append(menuLink(item, 'header-link'));
      menu.append(entry);
      return;
    }
    entry.classList.add(d > 1 ? 'has-mega' : 'has-dropdown');
    const trigger = el('button', 'header-link header-trigger');
    trigger.type = 'button';
    trigger.textContent = item.label;
    trigger.append(chromeIcon('arrow-right'));
    trigger.setAttribute('aria-expanded', 'false');
    entry.append(trigger);
    let panel;
    if (d > 1) {
      panel = el('div', 'header-mega');
      const inner = el('div', 'header-mega-inner');
      inner.append(megaColumn(children(li), 1));
      panel.append(inner);
      const drill = drillPanel(li, () => header.closeMenu());
      drills.push(drill);
      trigger.dataset.drill = drill.id;
    } else {
      panel = el('ul', 'header-dropdown');
      children(li).forEach((child) => {
        const sub = el('li');
        sub.append(menuLink(readItem(child), 'header-dropdown-link'));
        panel.append(sub);
      });
    }
    panel.id = nextId('panel');
    trigger.setAttribute('aria-controls', panel.id);
    entry.append(panel);
    trigger.addEventListener('click', () => {
      if (!desktop.matches && trigger.dataset.drill) {
        document.getElementById(trigger.dataset.drill).open();
        header.classList.add('is-drill-open');
        return;
      }
      const open = trigger.getAttribute('aria-expanded') !== 'true';
      header.closeDropdowns(open ? entry : null);
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      entry.classList.toggle('is-open', open);
    });
    menu.append(entry);
  });
  return { menu, drills };
}

/**
 * Sorts the actions section into buttons (bold links, authored buttons) and icon actions (links
 * with an icon, e.g. [:user: Log In](#login)).
 * @param {HTMLElement} section
 * @returns {{buttons: HTMLElement[], utilities: HTMLElement[]}}
 */
function buildActions(section) {
  const buttons = [];
  const utilities = [];
  if (!section) return { buttons, utilities };
  section.querySelectorAll('a[href]').forEach((a) => {
    const icon = a.querySelector('span.icon');
    if (icon) {
      const link = el('a', 'header-utility');
      link.href = a.getAttribute('href');
      const label = a.textContent.replace(/\s+/g, ' ').trim()
        || iconLabel([...icon.classList].find((c) => c.startsWith('icon-'))?.slice(5) || '');
      link.append(icon, Object.assign(el('span', 'header-utility-label'), { textContent: label }));
      link.setAttribute('aria-label', a.title || label);
      utilities.push(applyButtonAction(link));
    } else {
      const button = el('a', 'header-button');
      button.href = a.getAttribute('href');
      button.textContent = a.textContent.trim();
      buttons.push(applyButtonAction(button));
    }
  });
  return { buttons, utilities };
}

/**
 * Builds the menu footer (mobile and tablet): the language and currency links at the bottom.
 * @param {HTMLElement} section
 * @returns {HTMLElement|null}
 */
function buildMenuFooter(section) {
  if (!section) return null;
  const links = [...section.querySelectorAll('a[href]')];
  if (!links.length) return null;
  const footer = el('div', 'header-menu-footer');
  links.forEach((a) => {
    const link = el('a', 'header-menu-footer-link');
    link.href = a.getAttribute('href');
    link.append(...[...a.childNodes].map((n) => n.cloneNode(true)), chromeIcon('arrow-up'));
    footer.append(applyButtonAction(link));
  });
  return footer;
}

/**
 * The cart dropdown (desktop): shows the content of the `cart` modal section under the cart icon.
 * @param {HTMLAnchorElement} trigger
 * @param {HTMLElement} header
 * @returns {Promise<boolean>} Whether the dropdown handled the click
 */
async function toggleCartDropdown(trigger, header) {
  const existing = header.querySelector('.header-cart-dropdown');
  if (existing) { existing.remove(); trigger.setAttribute('aria-expanded', 'false'); return true; }
  const section = await whenModal('cart');
  if (!section) return false;
  const dropdown = el('div', 'header-cart-dropdown');
  dropdown.id = nextId('cart');
  dropdown.append(...[...section.children].map((c) => c.cloneNode(true)));
  trigger.after(dropdown);
  trigger.setAttribute('aria-expanded', 'true');
  trigger.setAttribute('aria-controls', dropdown.id);
  return true;
}

/**
 * Wires a header action link: `#name` opens the modal `name` (the cart as a dropdown on
 * desktop); a `#name` without a modal fires a `header:action` event for other scripts. Other
 * links keep their normal link behaviour (pages, new tab for other sites).
 * @param {HTMLElement} link
 * @param {HTMLElement} header
 */
function wireAction(link, header) {
  // a `/modals/` page link is a button that opens its modal itself; first (capture, so before
  // its own handler) close the menu and any dropdown, leaving focus for the modal
  if (link.dataset.action === 'modal-page') {
    link.addEventListener('click', () => {
      header.closeDropdowns();
      header.closeMenu(false);
    }, { capture: true });
    return;
  }
  const name = modalNameFromHref(link.getAttribute('href') || '');
  if (!name) return;
  link.addEventListener('click', async (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (name === 'cart' && desktop.matches && await toggleCartDropdown(link, header)) return;
    header.closeMenu();
    const section = await whenModal(name);
    if (section) openNamedModal(name, link);
    else document.dispatchEvent(new CustomEvent('header:action', { detail: { name, trigger: link } }));
  });
}

/**
 * The brand: the logo link; a second image is the mobile and tablet logo.
 * @param {HTMLElement} section
 * @returns {HTMLElement}
 */
function buildBrand(section) {
  const brand = el('div', 'header-brand');
  const link = el('a', 'header-brand-link');
  const authored = section?.querySelector('a[href]');
  link.href = authored?.getAttribute('href') || '/';
  const pictures = section ? [...section.querySelectorAll('picture')] : [];
  if (pictures.length) {
    pictures[0].classList.add('header-logo', 'header-logo-desktop');
    link.append(pictures[0]);
    if (pictures[1]) {
      pictures[1].classList.add('header-logo', 'header-logo-mobile');
      link.append(pictures[1]);
      link.classList.add('has-mobile-logo');
    }
    const img = pictures[0].querySelector('img');
    link.setAttribute('aria-label', img?.alt || authored?.textContent.trim() || 'Home');
    link.querySelectorAll('img').forEach((i) => { i.loading = 'eager'; });
  } else {
    link.textContent = authored?.textContent.trim() || section?.textContent.trim() || 'Home';
    link.classList.add('is-text');
  }
  brand.append(link);
  return brand;
}

/**
 * loads and decorates the header: logo, main navigation (dropdowns and mega menus), action
 * buttons and icons, the mobile menu and the scroll state, all from the one nav page
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
  const fragment = await loadFragment(navPath);
  block.textContent = '';
  if (!fragment) return;

  const header = block.closest('header') || block;
  // page metadata `header` = `transparent`: the bar sits over the page's hero (the source homepage)
  header.classList.toggle('is-transparent', getMetadata('header').toLowerCase() === 'transparent');
  // modal sections stay in the fragment (registered by decorateMain); the others carry the header
  const sections = [...fragment.querySelectorAll(':scope > .section:not([data-modal])')];
  // sections are found by their Section Metadata `name` (Brand, Menu, Actions, Menu footer), or
  // else by order: the brand, the section with the list, then the actions and the menu footer
  const named = (name) => sections.find((s) => (s.dataset.name || '').trim().toLowerCase().replace(/\s+/g, '-') === name);
  const navIndex = sections.findIndex((s) => s.querySelector('ul, ol'));
  const byOrder = {
    brand: navIndex !== 0 ? sections[0] : null,
    menu: navIndex >= 0 ? sections[navIndex] : null,
    actions: navIndex >= 0 ? sections[navIndex + 1] : sections[1],
    'menu-footer': navIndex >= 0 ? sections[navIndex + 2] : sections[2],
  };
  const hasNames = sections.some((s) => s.dataset.name);
  const pick = (name) => (hasNames ? named(name) : byOrder[name]) || null;
  const brandSection = pick('brand');
  const navSection = pick('menu');
  const actionsSection = pick('actions');
  const footerSection = pick('menu-footer');

  const bar = el('div', 'header-bar');
  const inner = el('div', 'header-inner');
  const brand = buildBrand(brandSection);
  const nav = el('nav', 'header-nav');
  nav.id = nextId('nav');
  nav.setAttribute('aria-label', 'Main');
  const { menu, drills } = navSection ? buildMenu(navSection, header) : { menu: el('ul', 'header-menu'), drills: [] };
  nav.append(menu);
  const menuFooter = buildMenuFooter(footerSection);
  if (menuFooter) nav.append(menuFooter);

  const { buttons, utilities } = buildActions(actionsSection);
  const actions = el('div', 'header-actions');
  buttons.forEach((b, i) => {
    b.classList.add(i === 0 && buttons.length > 1 ? 'is-first' : 'is-more');
    actions.append(b);
  });
  // actions also offered in the menu footer (e.g. language) are shown there on mobile instead
  // links that open a modal page are buttons, with the link in data-href; a `#view` of a modal
  // page counts as the page (e.g. /modals/language-currency#language)
  const hrefOf = (node) => node.getAttribute('href') || node.dataset.href || '';
  const pageOf = (href) => href.split('#')[0] || href;
  const footerLinks = [...(menuFooter?.querySelectorAll('.header-menu-footer-link') || [])];
  const footerHrefs = new Set(footerLinks.map((l) => pageOf(hrefOf(l))));
  if (utilities.length) {
    const wrap = el('div', 'header-utilities');
    utilities.forEach((u) => {
      if (footerHrefs.has(pageOf(hrefOf(u)))) u.classList.add('is-in-menu-footer');
      wrap.append(u);
    });
    actions.append(wrap);
  }

  // a menu footer link to the currency (authored as a code, e.g. USD) shows the visitor's currency
  const currencyLabels = footerLinks.filter((l) => hrefOf(l).toLowerCase().endsWith('#currency'))
    .map((l) => [...l.childNodes].find((n) => n.nodeType === 3 && /^[A-Z]{3}$/.test(n.textContent.trim())))
    .filter(Boolean);
  const showCurrency = () => currencyLabels.forEach((t) => { t.textContent = getCurrency(); });
  showCurrency();
  if (currencyLabels.length) document.addEventListener(CURRENCY_EVENT, showCurrency);

  // the first button is also the full-width bar above the header on phones (source "ydbd")
  let promo = null;
  if (buttons.length > 1) {
    promo = el('div', 'header-promo');
    const link = buttons[0].cloneNode(true);
    link.className = 'header-promo-link';
    link.append(chromeIcon('arrow-right'));
    promo.append(link);
  }

  const toggle = el('button', 'header-toggle');
  toggle.type = 'button';
  toggle.setAttribute('aria-controls', nav.id);
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'Open menu');
  toggle.append(el('span', 'header-toggle-lines'));

  inner.append(brand, nav, actions, toggle);
  if (promo) bar.append(promo);
  bar.append(inner);
  block.append(bar, ...drills);
  maskIcons(block);

  // --- behaviour -----------------------------------------------------------------------------
  header.closeDropdowns = (except = null) => {
    menu.querySelectorAll('.header-item.is-open').forEach((item) => {
      if (item === except) return;
      item.classList.remove('is-open');
      item.querySelector('.header-trigger')?.setAttribute('aria-expanded', 'false');
    });
    if (!except) {
      header.querySelector('.header-cart-dropdown')?.remove();
      header.querySelectorAll('.header-utility[aria-expanded="true"]').forEach((u) => u.setAttribute('aria-expanded', 'false'));
    }
  };
  const setMenu = (open) => {
    header.classList.toggle('is-menu-open', open);
    document.body.classList.toggle('header-menu-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    if (!open) {
      drills.forEach((d) => { d.hidden = true; });
      header.classList.remove('is-drill-open');
      header.closeDropdowns();
    }
  };
  header.closeMenu = (focus = true) => {
    if (!header.classList.contains('is-menu-open') && !header.classList.contains('is-drill-open')) return;
    setMenu(false);
    if (focus) toggle.focus();
  };
  toggle.addEventListener('click', () => setMenu(!header.classList.contains('is-menu-open')));

  [...buttons, ...utilities, ...(promo ? [promo.firstElementChild] : []), ...(menuFooter?.querySelectorAll('.header-menu-footer-link') || [])]
    .forEach((link) => wireAction(link, header));

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = menu.querySelector('.header-item.is-open .header-trigger') || header.querySelector('.header-utility[aria-expanded="true"]');
    if (open) { header.closeDropdowns(); open.focus(); return; }
    header.closeMenu();
  });
  document.addEventListener('click', (e) => {
    if (!block.contains(e.target)) header.closeDropdowns();
  });

  // desktop hover opens dropdowns (with the source's 0.3s delay, in CSS); keyboard and touch use
  // the buttons. Leaving desktop closes the mobile menu.
  desktop.addEventListener('change', () => { setMenu(false); header.closeDropdowns(); });

  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY >= SCROLL_THRESHOLD);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}
