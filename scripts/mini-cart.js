/*
 * The cart's UI, as the source's (#cart-popup and its dialogs), in the site's dialog
 * (modal-dialog.js): the mini cart (a lounge booking with its date, time, guests and service, or
 * passes with their quantity; the totals, the promo code, Check Out, and Edit for a lounge),
 * "Checkout Cart" when the cart's rules refuse a product, the remove confirmations and the failure
 * messages. Check Out goes to this site's checkout page (/{lang}/guest-checkout) unless the page
 * metadata names another (`cart-checkout-url`); Edit to the page `cart-edit-url` names. Loaded
 * when a product is added or the header's cart opens with something in it; the cart itself is
 * cart.js, its state cart-state.js. Everything follows the cart in place (no page reload, unlike
 * the source's after a removal).
 */
import { getMetadata, loadCSS } from './aem.js';
import { DEFAULT_SITE, getSiteFolder, translate } from './i18n.js';
import { formatAmount, loungeDetails } from './cart-summary.js';
import { getCart, getCartId, onCartChange } from './cart-state.js';
import {
  PROMO_DROPPED_EVENT, addToCart, applyPromo, convertCart, refreshCart, removeFromCart, removePromo,
} from './cart.js';
import { getCurrency } from './currency.js';
// eslint-disable-next-line import/no-cycle
import { hideLoader, showLoader } from './scripts.js';

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
const promoConfirm = new CartDialog('cart-promo-remove', 'cart-confirm-modal');

// this site's preview hosts: there, a cart link that isn't set up says so (for authors)
const PREVIEW_HOST = /\.aem\.page$|^localhost$/;

// the cart links without a metadata row: Check Out goes to this site's checkout page (the
// Checkout block) in the visitor's language folder; Edit has no page of this site's yet
const DEFAULT_LINKS = { checkout: '/{lang}/guest-checkout' };

/**
 * A cart link from the page metadata, e.g. `cart-checkout-url` (set per language folder in the
 * bulk metadata sheet), else its default (Check Out: this site's /{lang}/guest-checkout), with its
 * placeholders filled: {cartId}, {lang} (the site folder, e.g. en-uk) and, from the cart's lounge,
 * {date} (YYYY-MM-DD), {time} (HHmm), {adults}, {children}, {catalogueCode}.
 * @param {'checkout'|'edit'} name
 * @param {Object} cart
 * @returns {string} The address, or '' without one (or when it isn't a web address or a path)
 */
export function cartLink(name, cart) {
  const template = getMetadata(`cart-${name}-url`).trim() || DEFAULT_LINKS[name] || '';
  if (!template) return '';
  const lounge = cart?.lines.find((line) => line.kind !== 'pass');
  const values = {
    cartId: cart?.cartId || '',
    lang: getSiteFolder() || DEFAULT_SITE,
    date: lounge?.start.slice(0, 10) || '',
    time: lounge ? lounge.start.slice(11, 16).replace(':', '') : '',
    adults: lounge ? String(lounge.adults) : '',
    children: lounge ? String(lounge.children) : '',
    catalogueCode: lounge?.catalogueCode || '',
  };
  const filled = template.replace(/\{(\w+)\}/g, (all, key) => (Object.hasOwn(values, key) ? encodeURIComponent(values[key]) : all));
  try {
    const url = new URL(filled, window.location.href);
    return /^https?:$/.test(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

// a lounge's add-ons (the source's View more options), once their source is registered: the
// add-ons API isn't there yet, so no link shows
let addons = null;

/**
 * Registers where a lounge's add-ons come from: `available(line)` says whether the lounge has any,
 * `open(line, trigger)` shows them (the source's "Enhance Your Lounge Experience").
 * @param {{available: Function, open: Function}} source available(line): boolean;
 *   open(line, trigger)
 */
export function registerAddons(source) {
  addons = source;
}

// what the visitor typed in the promo field and its message, kept while the mini cart redraws,
// for one cart: another cart (a new one after a removal, another tab's) or none starts afresh
const promo = {
  cartId: '', draft: '', message: '', error: false,
};

/**
 * Forgets the promo field's text and message when the cart isn't the one they were for.
 * @param {Object|null} cart
 */
function promoFor(cart) {
  // (the same cart while this tab reads it again after another tab's change: kept)
  const cartId = cart?.cartId || getCartId();
  if (promo.cartId === cartId) return;
  Object.assign(promo, {
    cartId, draft: '', message: '', error: false,
  });
}

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
 * The message for a promo code the booking system refused or couldn't take.
 * @param {{status: string, reason?: string}} result applyPromo's (or a dropped code's) answer
 * @returns {string}
 */
function promoMessage(result) {
  if (result.status === 'failed') return translate('cartPromoFailed');
  if (result.reason === 'not-eligible') return translate('cartPromoNotEligible');
  return translate('cartPromoInvalid');
}

/**
 * The promo code's field, as the source's: "Promo Code", the field and its arrow; Enter applies
 * too, an empty code says so without asking the booking system, and typing clears the message.
 * An applied code shows in the field (read only) with a button to take it off, after the source's
 * confirmation. Nothing reloads: the mini cart redraws from the cart.
 * @param {Object} cart
 * @returns {HTMLElement}
 */
function buildPromo(cart) {
  promoFor(cart);
  const id = 'mini-cart-promo-code';
  const box = el('div', 'mini-cart-promo');
  const label = el('label', 'mini-cart-promo-label', translate('cartPromoCode'));
  label.htmlFor = id;
  const field = el('div', 'mini-cart-promo-field');
  const input = el('input', 'mini-cart-promo-input');
  input.id = id;
  input.type = 'text';
  input.autocomplete = 'off';
  input.placeholder = translate('cartPromoPlaceholder');
  const message = el('p', 'mini-cart-promo-message', promo.message);
  message.id = `${id}-message`;
  message.setAttribute('aria-live', 'polite');
  input.setAttribute('aria-describedby', message.id);
  const show = () => {
    message.textContent = promo.message;
    message.classList.toggle('is-error', promo.error);
    if (promo.error) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  };
  show();
  // (the code the cart's lines carry)
  const applied = cart.promoCode || '';
  const action = el('button', `mini-cart-promo-${applied ? 'remove' : 'apply'}`);
  action.type = 'button';
  action.setAttribute('aria-label', translate(applied ? 'cartPromoRemove' : 'cartPromoApply'));
  field.append(input, action);
  box.append(label, field, message);
  // (after the booking system answered: the mini cart has redrawn, so focus goes back where the
  // visitor was in the new one: the field, or its button: the arrow, or the cross once applied)
  const refocus = (target = 'field') => {
    const now = getCart();
    // eslint-disable-next-line no-use-before-define
    if (mini.dialog?.open && now) renderMiniCart(now);
    const selector = target === 'button' ? '.mini-cart-promo-apply, .mini-cart-promo-remove' : '.mini-cart-promo-input';
    mini.dialog?.querySelector(selector)?.focus();
  };
  if (applied) {
    input.value = applied;
    input.readOnly = true;
    action.addEventListener('click', () => {
      const actions = el('div', 'cart-confirm-actions');
      actions.append(
        button(translate('cartCancel'), 'primary', () => promoConfirm.dialog?.close()),
        button(translate('cartConfirm'), 'soft', async () => {
          promoConfirm.dialog?.close();
          showLoader();
          let result;
          try {
            result = await removePromo();
          } finally {
            hideLoader();
          }
          promo.message = result.status === 'failed' ? translate('cartPromoFailed') : '';
          promo.error = result.status === 'failed';
          refocus();
        }),
      );
      promoConfirm.fill(translate('cartPromoRemoveTitle'), [el('p', 'cart-confirm-message', translate('cartPromoRemoveConfirm')), actions]);
      promoConfirm.open(action, { stack: true });
    });
    return box;
  }
  input.value = promo.draft;
  let busy = false;
  // from: where the visitor asked (the field by Enter, the arrow by a click), where focus goes back
  const apply = async (from) => {
    if (busy) return;
    const code = input.value.trim();
    if (!code) {
      promo.message = translate('cartPromoEmpty');
      promo.error = true;
      show();
      return;
    }
    promo.message = '';
    promo.error = false;
    show();
    busy = true;
    action.disabled = true;
    action.setAttribute('aria-busy', 'true');
    input.readOnly = true;
    let result;
    try {
      result = await applyPromo(code);
    } finally {
      busy = false;
      action.disabled = false;
      action.removeAttribute('aria-busy');
      input.readOnly = false;
    }
    // (the cart went or changed while it answered, or the booking system no longer has it:
    // nothing of this code stays)
    if (result.status === 'stale' || result.reason === 'gone' || promo.cartId !== cart.cartId) return;
    const ok = result.status === 'applied';
    promo.draft = ok ? '' : code;
    promo.message = ok ? '' : promoMessage(result);
    promo.error = !ok;
    refocus(from);
  };
  input.addEventListener('input', () => {
    promo.draft = input.value;
    if (!promo.message) return;
    promo.message = '';
    promo.error = false;
    show();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    apply('field');
  });
  action.addEventListener('click', () => apply('button'));
  return box;
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
    loungeDetails(line).forEach(({
      label, value, unit, parts,
    }) => {
      const row = el('div', 'mini-cart-detail');
      const dd = el('dd', '', parts ? undefined : value);
      if (parts) {
        parts.forEach((part, n) => {
          if (n) dd.append(' ');
          dd.append(el('span', n ? 'mini-cart-children' : 'mini-cart-adults', part));
        });
      }
      if (unit) dd.append(el('span', 'mini-cart-hours', unit));
      row.append(el('dt', '', label), dd);
      details.append(row);
    });
    // the lounge's add-ons, when the cart has them (the source's "Additional Services: 2x …")
    if (line.addons?.length) {
      const row = el('div', 'mini-cart-detail mini-cart-addons');
      const dd = el('dd');
      line.addons.forEach((a) => dd.append(el('span', 'mini-cart-addon', `${a.quantity}x ${a.name}`)));
      row.append(el('dt', '', translate('cartAdditionalServices')), dd);
      details.append(row);
    }
    box.append(details);
    if (addons?.available(line)) {
      const more = el('button', 'mini-cart-more', translate('cartViewMoreOptions'));
      more.type = 'button';
      more.setAttribute('aria-haspopup', 'dialog');
      more.addEventListener('click', () => addons.open(line, more));
      box.append(more);
    }
    return box;
  }));

  const { totals = {}, currency } = cart;
  const row = (className, label, amount) => {
    const r = el('div', `mini-cart-row ${className}`);
    r.append(label, el('span', 'mini-cart-amount', amount));
    return r;
  };
  const totalsBox = el('div', 'mini-cart-totals');
  // the base and the discounts, when there are discounts (as the source's), and a promo code's
  if (totals.discounts?.length || totals.promo > 0) {
    totalsBox.append(row('mini-cart-service-total', el('span', 'mini-cart-label', translate('cartServiceTotal')), formatAmount(totals.base, currency)));
    (totals.discounts || []).forEach((d) => {
      totalsBox.append(row('mini-cart-discount', el('span', 'mini-cart-label', `${d.name}:`), `- ${formatAmount(d.value, currency)}`));
    });
    if (totals.promo > 0) {
      totalsBox.append(row('mini-cart-discount mini-cart-promo-discount', el('span', 'mini-cart-label', translate('cartPromoDiscount', { code: cart.promoCode || '' })), `- ${formatAmount(totals.promo, currency)}`));
    }
  }
  // the promo code, then the total (the source's order)
  totalsBox.append(buildPromo(cart));
  const totalLabel = el('span', 'mini-cart-label');
  totalLabel.append(el('span', '', translate('cartTotal')), el('small', 'mini-cart-note', translate('cartTotalNote')));
  totalsBox.append(row('mini-cart-total', totalLabel, formatAmount(totals.total, currency)));

  // Check Out, and Edit for a lounge (as the source's: passes have nothing to edit): links to the
  // pages the metadata names (see cartLink), announced too (`cart:checkout`, `cart:edit`); without
  // one, only announced (and on the preview site, a note for authors)
  const announce = (name) => () => document.dispatchEvent(new CustomEvent(`cart:${name}`, { detail: { cart: getCart() } }));
  const actions = el('div', 'mini-cart-actions');
  const missing = [];
  const link = (name, label, kind) => {
    const href = cartLink(name, cart);
    if (!href) {
      missing.push(`cart-${name}-url`);
      return button(label, kind, announce(name));
    }
    const a = el('a', `cart-button cart-button-${kind}`, label);
    a.href = href;
    a.addEventListener('click', announce(name));
    return a;
  };
  actions.append(link('checkout', translate('cartCheckout'), 'primary'));
  if (cart.lines.some((line) => line.kind !== 'pass')) {
    actions.append(link('edit', translate('cartEdit'), 'secondary'));
  }
  const nodes = [lines, totalsBox, actions];
  if (missing.length && PREVIEW_HOST.test(window.location.hostname)) {
    nodes.push(el('p', 'mini-cart-hint', `Set ${missing.join(' and ')} in the metadata sheet for this link (preview only).`));
  }
  mini.fill(translate('cartTitle'), nodes);
}

/**
 * Opens the mini cart (when the cart holds something), then reads the cart again in the
 * background, so it shows at once and stays right. A cart of passes in another currency than the
 * visitor's is priced in theirs first, behind the loader (the source shows its cart in the page's
 * currency); a lounge's cart stays in the lounge's currency.
 * @param {HTMLElement} [trigger]
 * @param {{fresh?: boolean}} [options] fresh: the cart was just read (no second read)
 * @returns {Promise<HTMLDialogElement|null>}
 */
export async function openMiniCart(trigger, { fresh = false } = {}) {
  let cart = getCart();
  let read = fresh;
  // a cart this tab hasn't read (a new tab, its data past its 2 hours, another tab's change): read
  // behind the loader first, so its prices are the booking system's
  if (!cart && getCartId()) {
    showLoader();
    try {
      cart = await refreshCart();
    } catch { /* (unreachable: nothing to show) */ } finally {
      hideLoader();
    }
    read = true;
  }
  if (!cart) return null;
  // (a new opening: the promo field's last message is gone, what was typed stays)
  promo.message = '';
  promo.error = false;
  const currency = getCurrency();
  const convert = !fresh && cart.currency !== currency && cart.lines.every((line) => line.kind === 'pass');
  if (convert) {
    showLoader();
    try {
      await convertCart(currency);
    } finally {
      hideLoader();
    }
    cart = getCart();
    if (!cart) return null;
  }
  renderMiniCart(cart);
  const dialog = await mini.open(trigger);
  // (not when the cart was just read: after an add, a first read or a conversion)
  if (!read && !convert) refreshCart().catch(() => {});
  return dialog;
}

// the open mini cart follows the cart (a refresh, another tab); an emptied cart closes it (one that
// another tab changed stays open until this tab has read it again), and the promo field's text and
// message go with it
onCartChange((cart) => {
  promoFor(cart);
  if (!mini.dialog?.open) return;
  if (cart) renderMiniCart(cart);
  else if (!getCartId()) mini.dialog.close();
});

// a cart change (one more of a pass, another pass, one taken out, another currency) that the
// booking system wouldn't keep the code for: the field offers the code again, with why
document.addEventListener(PROMO_DROPPED_EVENT, (e) => {
  const { cartId, code } = e.detail;
  if (getCartId() !== cartId) return;
  promoFor(getCart() || { cartId });
  Object.assign(promo, { draft: code, message: promoMessage(e.detail), error: true });
  if (mini.dialog?.open && getCart()) renderMiniCart(getCart());
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
