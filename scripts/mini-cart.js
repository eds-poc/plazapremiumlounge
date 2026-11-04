/*
 * The cart's UI, as the source's (#cart-popup and its dialogs), in the site's dialog
 * (modal-dialog.js): the mini cart (a lounge booking with its date, time, guests and service, or
 * passes with their quantity; the totals, Check Out, and Edit for a lounge), "Checkout Cart" when
 * the cart's rules refuse a product, the remove confirmation and the failure messages. Loaded when
 * a product is added or the header's cart opens with something in it; the cart itself is cart.js,
 * its state cart-state.js. Everything follows the cart in place (no page reload, unlike the
 * source's after a removal).
 */
import { loadCSS } from './aem.js';
import { translate, getLanguage } from './i18n.js';
import { getCart, onCartChange } from './cart-state.js';
import { addToCart, refreshCart, removeFromCart } from './cart.js';
import { hideLoader, showLoader } from './loader.js';

const styles = loadCSS(`${window.hlx.codeBasePath}/styles/cart.css`);

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
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * A button, as the source's cart buttons (primary: filled; secondary: outlined).
 * @param {string} label
 * @param {'primary'|'secondary'|'soft'} kind
 * @param {Function} onClick
 * @returns {HTMLButtonElement}
 */
function button(label, kind, onClick) {
  const b = el('button', `cart-button cart-button-${kind}`, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

// the source's amounts, in every language: "HKD 1,755.00"
const AMOUNT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * An amount as the source shows it: "GBP 44.10", "HKD 1,755.00".
 * @param {number} amount
 * @param {string} currency
 * @returns {string}
 */
function formatAmount(amount, currency) {
  return Number.isFinite(amount) ? `${currency ? `${currency} ` : ''}${AMOUNT.format(amount)}` : '—';
}

/**
 * A booking date as the source's cart shows it: "02-Nov-2026", "02-nov-2026", "2026年11月02日".
 * @param {string} start "YYYY-MM-DD HH:mm:ss"
 * @returns {string}
 */
function formatCartDate(start) {
  const [y, m, d] = start.slice(0, 10).split('-');
  if (!d) return '';
  const lang = getLanguage();
  if (/^(zh|ja)/.test(lang)) return `${y}年${m}月${d}日`;
  const month = new Intl.DateTimeFormat(lang, { month: 'short', timeZone: 'UTC' })
    .format(new Date(`${y}-${m}-${d}T00:00:00Z`)).replace(/\.$/, '');
  return `${d}-${/^pt/.test(lang) ? month.toLowerCase() : month}-${y}`;
}

/**
 * The guests as the source's cart: "2 Adult(s) 1 Child(ren)" (its two values side by side).
 * @param {{adults: number, children: number}} line
 * @returns {string}
 */
function formatGuests(line) {
  const parts = [`${line.adults} ${translate('propertyAdults')}`];
  if (line.children > 0) parts.push(`${line.children} ${translate('propertyChildren')}`);
  return parts.join(' ');
}

/**
 * One of the cart's dialogs: its content (an optional title, which the site's dialog shows in
 * its header, then a body that is refilled each time), opened in the site's dialog.
 */
class CartDialog {
  /**
   * @param {string} key The site dialog's key (built once)
   * @param {string} className The dialog's class, for its look
   * @param {boolean} [titled]
   */
  constructor(key, className, titled = true) {
    this.key = key;
    this.className = className;
    this.root = el('div', 'cart-dialog');
    if (titled) {
      this.title = el('h2', 'cart-dialog-title');
      this.root.append(this.title);
    }
    this.body = el('div', 'cart-dialog-body');
    this.root.append(this.body);
  }

  /**
   * Fills the dialog.
   * @param {string} title
   * @param {Node[]} nodes
   */
  fill(title, nodes) {
    if (this.title) this.title.textContent = title;
    this.body.replaceChildren(...nodes);
  }

  /**
   * Opens it, closing any other site dialog (or over it, with `stack`). As the source's, only
   * its own controls close it: not Esc, not a click beside it (it bounces).
   * @param {HTMLElement} [trigger] Focus returns there when it closes
   * @param {{stack?: boolean}} [options]
   * @returns {Promise<HTMLDialogElement|null>}
   */
  async open(trigger, { stack = false } = {}) {
    await styles;
    const { openModal } = await import('./modal-dialog.js');
    return openModal({
      key: this.key,
      trigger,
      stack,
      content: () => Object.assign([this.root], { styles: [this.className], static: true }),
    });
  }

  get dialog() {
    return this.root.closest('dialog');
  }
}

const mini = new CartDialog('cart-mini', 'mini-cart-modal');
const checkoutFirst = new CartDialog('cart-checkout-first', 'cart-message-modal');
const failure = new CartDialog('cart-failure', 'cart-message-modal');
// (the source's remove confirmation has no title)
const confirm = new CartDialog('cart-remove', 'cart-confirm-modal', false);

/**
 * The remove confirmation (the source's ⊗), over the mini cart: Cancel closes it (the mini cart
 * stays); Yes shows the loader over the mini cart while the booking system takes the line out.
 * The source then loads the page again; here the mini cart shows the lines left (focus on the
 * first one's ⊗), or closes when the cart is empty, and the header and the buttons follow, in
 * place. A failure keeps the cart and the mini cart, with the source's message.
 * @param {Object} line
 * @param {HTMLElement} from The ⊗ (focus goes back there on Cancel)
 */
function confirmRemove(line, from) {
  const message = el('p', 'cart-confirm-message', translate('cartRemoveConfirm'));
  message.append(el('span', 'cart-confirm-product', line.product || line.name));
  const actions = el('div', 'cart-confirm-actions');
  actions.append(
    button(translate('cartCancel'), 'primary', () => confirm.dialog?.close()),
    button(translate('cartYes'), 'soft', async () => {
      confirm.dialog?.close();
      showLoader();
      let result;
      try {
        result = await removeFromCart(line.catalogueCode);
      } finally {
        hideLoader();
      }
      if (result.status === 'failed') {
        // (as the source: the mini cart stays, with the message)
        // eslint-disable-next-line no-use-before-define
        showFailure('cartRemoveFailed', from, { stack: true });
        return;
      }
      // (the mini cart has followed the cart: what's left, or closed, focus back to its trigger)
      if (mini.dialog?.open) (mini.dialog.querySelector('.mini-cart-remove') || mini.dialog).focus();
    }),
  );
  confirm.fill('', [message, actions]);
  confirm.open(from, { stack: true });
}

/**
 * Fills the mini cart from the cart's summary.
 * @param {Object} cart
 */
function renderMiniCart(cart) {
  const lines = el('div', 'mini-cart-lines');
  lines.append(...cart.lines.map((line) => {
    const pass = line.kind === 'pass';
    const box = el('div', `mini-cart-line${pass ? ' mini-cart-line-pass' : ''}`);
    // (a pass by its own name, as the source's; a lounge by the lounge's)
    const title = pass ? line.product || line.name : line.name || line.product;
    const name = el('h3', 'mini-cart-name', title);
    const remove = el('button', 'mini-cart-remove');
    remove.type = 'button';
    remove.setAttribute('aria-label', translate('cartRemoveItem', { name: line.product || line.name }));
    remove.addEventListener('click', () => confirmRemove(line, remove));
    name.append(remove);
    box.append(name);
    if (pass) {
      // the source's pass line: the quantity, and the line's price beside it
      const row = el('p', 'mini-cart-quantity');
      row.append(
        el('span', '', `${translate('cartQuantity')} ${line.quantity}`),
        el('span', 'mini-cart-line-amount', formatAmount(line.total, cart.currency)),
      );
      box.append(row);
      return box;
    }
    if (line.place) box.append(el('p', 'mini-cart-place', line.place));
    const details = el('dl', 'mini-cart-details');
    const time = line.start.slice(11, 16).replace(':', '');
    [
      [translate('cartDate'), formatCartDate(line.start)],
      [translate('cartTime'), time, el('span', 'mini-cart-hours', translate('cartHours'))],
      [translate('cartGuests'), formatGuests(line)],
      [translate('cartServices'), line.product],
    ].forEach(([label, value, after]) => {
      if (!value) return;
      const row = el('div', 'mini-cart-detail');
      const dd = el('dd', '', value);
      if (after) dd.append(after);
      row.append(el('dt', '', label), dd);
      details.append(row);
    });
    box.append(details);
    return box;
  }));

  const { totals = {}, currency } = cart;
  const row = (className, label, amount) => {
    const r = el('div', `mini-cart-row ${className}`);
    r.append(label, el('span', 'mini-cart-amount', amount));
    return r;
  };
  const totalsBox = el('div', 'mini-cart-totals');
  // the base and the discounts, when there are discounts (as the source's)
  if (totals.discounts?.length) {
    totalsBox.append(row('mini-cart-service-total', el('span', 'mini-cart-label', translate('cartServiceTotal')), formatAmount(totals.base, currency)));
    totals.discounts.forEach((d) => {
      totalsBox.append(row('mini-cart-discount', el('span', 'mini-cart-label', `${d.name}:`), `- ${formatAmount(d.value, currency)}`));
    });
  }
  const totalLabel = el('span', 'mini-cart-label');
  totalLabel.append(el('span', '', translate('cartTotal')), el('small', 'mini-cart-note', translate('cartTotalNote')));
  totalsBox.append(row('mini-cart-total', totalLabel, formatAmount(totals.total, currency)));

  // Check Out, and Edit for a lounge (as the source's: passes have nothing to edit): the hand-off
  // to the booking steps comes later; they are announced
  const announce = (name) => () => document.dispatchEvent(new CustomEvent(`cart:${name}`, { detail: { cart: getCart() } }));
  const actions = el('div', 'mini-cart-actions');
  actions.append(button(translate('cartCheckout'), 'primary', announce('checkout')));
  if (cart.lines.some((line) => line.kind !== 'pass')) {
    actions.append(button(translate('cartEdit'), 'secondary', announce('edit')));
  }
  mini.fill(translate('cartTitle'), [lines, totalsBox, actions]);
}

/**
 * Opens the mini cart (when the cart holds something), then reads the cart again in the
 * background, so it shows at once and stays right.
 * @param {HTMLElement} [trigger]
 * @param {{fresh?: boolean}} [options] fresh: the cart was just read (no second read)
 * @returns {Promise<HTMLDialogElement|null>}
 */
export async function openMiniCart(trigger, { fresh = false } = {}) {
  const cart = getCart();
  if (!cart) return null;
  renderMiniCart(cart);
  const dialog = await mini.open(trigger);
  // (not when the cart was just read: after an add)
  if (!fresh) refreshCart().catch(() => {});
  return dialog;
}

// the open mini cart follows the cart (a refresh, another tab); an emptied cart closes it
onCartChange((cart) => {
  if (!mini.dialog?.open) return;
  if (cart) renderMiniCart(cart);
  else mini.dialog.close();
});

/**
 * Turns the button that asked off while the cart works (as the source's: disabled and
 * aria-disabled), or back on.
 * @param {HTMLElement|null} from
 * @param {boolean} busy
 */
function setBusy(from, busy) {
  if (!from) return;
  if (from.tagName === 'BUTTON') from.disabled = busy;
  ['aria-disabled', 'aria-busy'].forEach((name) => {
    if (busy) from.setAttribute(name, 'true');
    else from.removeAttribute(name);
  });
}

/**
 * Adds a product and shows the answer, as the source: the site's loader while the booking system
 * answers (the button that asked off), then the mini cart, "Checkout Cart" (its View Cart opens
 * the mini cart), or the failure message.
 * @param {Object} item The product, as its type's adapter in cart.js takes it
 * @param {HTMLElement} [trigger] The button (or what holds it)
 */
export async function addAndShow(item, trigger) {
  // (the event may come from anything: only an element is a trigger)
  const from = trigger instanceof Element ? trigger.closest('button, a') || trigger : null;
  setBusy(from, true);
  showLoader();
  let result;
  try {
    result = await addToCart(item);
  } finally {
    hideLoader();
    setBusy(from, false);
  }
  if (result.status === 'added') {
    await openMiniCart(from, { fresh: true });
  } else if (result.reason === 'checkout-first') {
    const view = button(translate('cartViewCart'), 'primary', () => openMiniCart(from));
    checkoutFirst.fill(translate('cartCheckoutFirstTitle'), [el('p', '', translate('cartCheckoutFirst')), view]);
    await checkoutFirst.open(from);
  } else if (item.type === 'pass') {
    // (the source's pass page: its notice)
    // eslint-disable-next-line no-use-before-define
    await showFailure('cartPassAddFailed', from, { title: 'cartNotice' });
  } else {
    // eslint-disable-next-line no-use-before-define
    await showFailure('cartAddFailed', from);
  }
}

/**
 * A failure's message (the source's alert, in the site's dialog), e.g. "Unable to add to cart."
 * @param {string} key The text's key
 * @param {HTMLElement} [trigger]
 * @param {{stack?: boolean, title?: string}} [options] stack: over the open dialog (e.g. the mini
 *   cart); title: the title's key (else the cart's)
 */
async function showFailure(key, trigger, { title = 'cartTitle', ...options } = {}) {
  failure.fill(translate(title), [el('p', '', translate(key))]);
  await failure.open(trigger, options);
}

/**
 * Takes a product out at once (the lounge card's Remove From Cart, without a confirmation, as
 * the source's): the button off and the site's loader while the booking system deletes the cart;
 * a failure keeps it, with the source's message.
 * @param {string} catalogueCode
 * @param {HTMLElement} [trigger] The button
 */
export async function removeAndShow(catalogueCode, trigger) {
  const from = trigger instanceof Element ? trigger.closest('button, a') || trigger : null;
  setBusy(from, true);
  showLoader();
  let result;
  try {
    result = await removeFromCart(catalogueCode);
  } finally {
    hideLoader();
    setBusy(from, false);
  }
  if (result.status === 'failed') await showFailure('cartRemoveFailed', from);
}
