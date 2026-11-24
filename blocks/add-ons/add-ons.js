import { addOnsRequest, fetchAddOns } from '../../scripts/add-ons.js';
import { formatAmount } from '../../scripts/cart-summary.js';
import { getCart, onCartChange } from '../../scripts/cart-state.js';
import { readCart, setAddon } from '../../scripts/cart.js';
import { translate } from '../../scripts/i18n.js';
import { openModal } from '../../scripts/modal-dialog.js';
import { safeHtml } from '../../scripts/properties.js';
import { hideLoader, showLoader } from '../../scripts/scripts.js';

/*
 * Add-ons: the source's Book Your Visit "Additional Services", what can be added to the cart's
 * lounge visit (scripts/add-ons.js: the add-ons service, its sample answer for now). Each add-on:
 * its name and Add, which opens its pop-up (its description and image, the quantity from 1 to its
 * maximum, the service total, Add); one in the cart shows "2x …" and Remove (after the source's
 * confirmation). The add-ons follow the visit's date and time chosen on the page (Book Your Visit's
 * `book-your-visit:change`). Per-person add-ons aren't shown yet (no sample of them). No add-ons,
 * or no lounge in the cart: the block takes no space.
 */

// the block's texts (Key | Text rows), and what shows without a row
const TEXTS = {
  title: 'Additional Services',
  add: 'Add',
  remove: 'Remove',
  quantity: 'Quantity',
  total: 'Service total',
  failed: 'Unable to add service. Please try again.',
};

let count = 0;

/**
 * Creates an element with an optional class name and text.
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 * @returns {HTMLElement}
 */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

/**
 * The block's authored texts (Key | Text rows).
 * @param {Element} block
 * @returns {Object<string, string>}
 */
function readTexts(block) {
  const texts = { ...TEXTS };
  [...block.children].forEach((row) => {
    const [keyCell, valueCell] = row.children;
    const key = keyCell?.textContent.trim().toLowerCase().replace(/\s+/g, '');
    if (key in TEXTS && valueCell?.textContent.trim()) texts[key] = valueCell.textContent.trim();
  });
  return texts;
}

/**
 * A button.
 * @param {string} label
 * @param {string} className
 * @returns {HTMLButtonElement}
 */
function button(label, className) {
  const b = el('button', className, label);
  b.type = 'button';
  return b;
}

/**
 * Decorates the Add-ons block.
 * @param {Element} block
 */
export default function decorate(block) {
  count += 1;
  const uid = `add-ons-${count}`;
  const texts = readTexts(block);
  const wrapper = block.closest('.add-ons-wrapper') || block;
  const title = el('h2', 'add-ons-title', texts.title);
  title.id = `${uid}-title`;
  const list = el('ul', 'add-ons-list');
  list.setAttribute('aria-labelledby', title.id);
  block.replaceChildren(title, list);
  wrapper.hidden = true;

  let items = [];
  let start = '';
  let asked = 0;

  // the cart's lounge; in the block library, its sample visit only (the author's own cart is
  // neither shown nor changed there)
  const library = window.location.pathname.includes('/docs/library/');
  let fromPage = null;
  const lounge = () => (library ? fromPage?.line
    : getCart()?.lines.find((l) => l.kind !== 'pass')) || null;
  const inCart = (code) => lounge()?.addons?.find((a) => a.catalogueCode === code);

  /**
   * Saves an add-on's quantity (0 takes it out), behind the site's loader.
   * @param {Object} item
   * @param {number} quantity
   * @returns {Promise<boolean>}
   */
  const save = async (item, quantity) => {
    // (the block library's sample: nothing saved, the pop-up closes)
    if (library) return true;
    showLoader();
    // the cart as it is: a removed add-on is gone after (for GA4's remove_from_cart)
    const cartBeforeSave = getCart();
    try {
      const result = await setAddon({
        catalogueCode: item.catalogueCode, name: item.name, quantity,
      });
      const saved = result.status === 'updated';
      // GA4's remove_from_cart for an add-on taken out, as the cart had it; the mini cart's code
      // only loads now
      const line = saved && quantity === 0 && cartBeforeSave?.lines.find((l) => l.kind !== 'pass');
      const addon = line?.addons?.find((a) => a.catalogueCode === item.catalogueCode);
      if (addon) {
        import('../../scripts/mini-cart.js')
          .then(({ trackCartRemove }) => {
            trackCartRemove(cartBeforeSave, [{ line, quantity: addon.quantity, addon }]);
          })
          .catch(() => { /* (no analytics without it) */ });
      }
      return saved;
    } finally {
      hideLoader();
    }
  };

  /**
   * An add-on's pop-up: its name, description and image, the quantity (1 to its maximum) with the
   * service total, then Add.
   * @param {Object} item
   * @param {HTMLElement} trigger
   */
  const openAdd = (item, trigger) => {
    let quantity = 1;
    const box = el('div', 'add-ons-popup');
    // (the dialog's title, for screen readers: its bar shows only the close, as the source's)
    const heading = el('h2', 'visually-hidden', item.name);
    const name = el('p', 'add-ons-popup-name', item.name);
    const description = el('div', 'add-ons-popup-description');
    description.append(safeHtml(item.description, { blocks: true }));
    box.append(heading, name, description);
    if (item.image) {
      const img = el('img', 'add-ons-popup-image');
      img.src = item.image;
      img.alt = '';
      img.loading = 'lazy';
      // (an image that doesn't load leaves no gap)
      img.addEventListener('error', () => img.remove());
      box.append(img);
    }
    const qtyRow = el('div', 'add-ons-popup-quantity');
    const qtyId = `${uid}-qty-${item.productCode}`;
    const label = el('label', 'add-ons-popup-label', texts.quantity);
    label.htmlFor = qtyId;
    const stepper = el('div', 'add-ons-stepper');
    const minus = button('−', 'add-ons-step add-ons-minus');
    const plus = button('+', 'add-ons-step add-ons-plus');
    minus.setAttribute('aria-label', `${texts.quantity} −`);
    plus.setAttribute('aria-label', `${texts.quantity} +`);
    const input = el('input', 'add-ons-qty');
    input.id = qtyId;
    input.type = 'text';
    input.inputMode = 'numeric';
    input.readOnly = true;
    input.value = '1';
    stepper.append(minus, input, plus);
    qtyRow.append(label, stepper);
    const foot = el('div', 'add-ons-popup-foot');
    const total = el('p', 'add-ons-popup-total');
    const amount = el('strong', 'add-ons-popup-amount');
    total.append(`${texts.total}: `, amount);
    total.setAttribute('aria-live', 'polite');
    const add = button(texts.add, 'add-ons-popup-add');
    const error = el('p', 'add-ons-popup-error');
    error.setAttribute('role', 'alert');
    foot.append(total, add);
    box.append(qtyRow, foot, error);
    const update = () => {
      input.value = String(quantity);
      amount.textContent = formatAmount(item.price * quantity, item.currency);
      minus.disabled = quantity <= 1;
      plus.disabled = quantity >= item.max;
    };
    minus.addEventListener('click', () => { quantity = Math.max(1, quantity - 1); update(); });
    plus.addEventListener('click', () => { quantity = Math.min(item.max, quantity + 1); update(); });
    update();
    openModal({
      key: `${uid}-${item.catalogueCode}-${Date.now()}`,
      trigger,
      content: () => Object.assign([box], { styles: ['add-ons-modal'] }),
    }).then((dialog) => {
      add.addEventListener('click', async () => {
        error.textContent = '';
        add.disabled = true;
        const ok = await save(item, quantity);
        add.disabled = false;
        if (ok) dialog?.close();
        else error.textContent = texts.failed;
      });
    });
  };

  /**
   * The source's remove confirmation: "Would you like to remove this order from the shopping
   * cart?" with the add-on's name, Cancel and Yes.
   * @param {Object} item
   * @param {HTMLElement} trigger
   */
  const openRemove = (item, trigger) => {
    const box = el('div', 'add-ons-confirm');
    box.append(el('p', 'add-ons-confirm-text', translate('cartRemoveConfirm')), el('p', 'add-ons-confirm-name', item.name));
    const actions = el('div', 'add-ons-confirm-actions');
    const cancel = button(translate('cartCancel'), 'button primary add-ons-cancel');
    const yes = button(translate('cartYes'), 'button secondary add-ons-yes');
    actions.append(cancel, yes);
    box.append(actions);
    openModal({
      key: `${uid}-remove-${item.catalogueCode}-${Date.now()}`,
      trigger,
      content: () => Object.assign([box], { styles: ['add-ons-modal', 'add-ons-confirm-modal'] }),
    }).then((dialog) => {
      cancel.addEventListener('click', () => dialog?.close());
      yes.addEventListener('click', async () => {
        dialog?.close();
        await save(item, 0);
      });
    });
  };

  const render = () => {
    list.replaceChildren(...items.map((item) => {
      const added = inCart(item.catalogueCode);
      const li = el('li', `add-ons-item${added ? ' is-added' : ''}`);
      const text = el('div', 'add-ons-item-text');
      text.append(el('span', 'add-ons-item-name', item.name));
      if (added) text.append(el('span', 'add-ons-item-detail', `${added.quantity}x ${item.name}`));
      const b = button(added ? texts.remove : texts.add, 'add-ons-item-button');
      b.setAttribute('aria-label', `${added ? texts.remove : texts.add}: ${item.name}`);
      if (!added) b.setAttribute('aria-haspopup', 'dialog');
      b.addEventListener('click', () => (added ? openRemove(item, b) : openAdd(item, b)));
      li.append(text, b);
      return li;
    }));
    wrapper.hidden = !items.length;
  };

  // the add-ons for the lounge visit (its start as chosen on the page): the latest answer shown
  const load = async () => {
    const line = lounge();
    if (!line) {
      items = [];
      render();
      return;
    }
    asked += 1;
    const mine = asked;
    const cart = library ? fromPage?.cart : getCart();
    const request = addOnsRequest({ ...line, start: start || line.start }, cart);
    try {
      const found = await fetchAddOns(request);
      if (mine !== asked) return;
      // (per-person add-ons aren't shown yet)
      items = found.filter((item) => !item.perPerson);
    } catch {
      if (mine !== asked) return;
      items = [];
    }
    render();
  };

  document.addEventListener('book-your-visit:change', (e) => {
    if (e.detail?.line) fromPage = e.detail;
    const next = e.detail?.start || '';
    if (next === start) return;
    start = next;
    load();
  });
  let loaded = false;
  onCartChange(() => {
    if (!loaded && lounge()) {
      loaded = true;
      load();
    } else render();
  });
  if (lounge()) {
    loaded = true;
    load();
  } else if (library) {
    // the block library on its own (no Book Your Visit block, no cart): its sample visit
    fetch(`${window.hlx?.codeBasePath || ''}/blocks/book-your-visit/library-cart.json`)
      .then((resp) => (resp.ok ? resp.json() : null))
      .then((json) => {
        if (!json || fromPage) return;
        const cart = readCart(json);
        fromPage = { cart, line: cart.lines.find((l) => l.kind !== 'pass') };
        load();
      })
      .catch(() => {});
  }
}
