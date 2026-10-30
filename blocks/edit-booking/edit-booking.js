import apiUrl from '../../scripts/endpoints.js';
import { authHeaders, getToken } from '../../scripts/auth.js';
import { translate } from '../../scripts/i18n.js';
import { openModal } from '../../scripts/modal-dialog.js';
import { safeHtml, toUrl } from '../../scripts/properties.js';
import {
  bookingId, bookingLoader, dayText, fetchOrder, groupItems, itemPrice, money, orderCurrency,
  readTexts,
} from '../../scripts/bookings.js';

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
 * A button with a class and text.
 * @param {string} className
 * @param {string} text
 * @returns {HTMLButtonElement}
 */
function button(className, text) {
  const node = el('button', className, text);
  node.type = 'button';
  return node;
}

/**
 * The lounge's time zone from the booking ("(GMT+8:00) Asia/Hong_Kong, Hong Kong Standard Time"),
 * or '' (then the visitor's own).
 * @param {object} order
 * @returns {string}
 */
function loungeZone(order) {
  const zone = String(order.timeZone || '').match(/[A-Za-z]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?/)?.[0] || '';
  try {
    if (zone) new Intl.DateTimeFormat('en', { timeZone: zone }).format();
    return zone;
  } catch {
    return '';
  }
}

/**
 * Today and the time now at the lounge: { day: '2026-11-30', minutes: 960 }.
 * @param {string} zone
 * @returns {{day: string, minutes: number}}
 */
function loungeNow(zone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    ...(zone ? { timeZone: zone } : {}),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date()).map((p) => [p.type, p.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, minutes: (+parts.hour) * 60 + (+parts.minute) };
}

// the half-hour start times, as the source: 0000 to 2330
const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}${i % 2 ? '30' : '00'}`);

/**
 * A time ("1630") as minutes in the day.
 * @param {string} time
 * @returns {number}
 */
function minutesOf(time) {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(2));
}

/**
 * An API value as a number, or undefined when it isn't one (empty, missing, text).
 * @param {*} value
 * @returns {number|undefined}
 */
function toNumber(value) {
  if (value === '' || value === null || value === undefined) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

/**
 * A POST to an API endpoint (JSON both ways; with the login token when `login`): its answer, or a
 * rejection when it fails, answers an error or is cancelled.
 * @param {string} name An endpoints.js key
 * @param {object} body
 * @param {AbortSignal} signal
 * @param {boolean} [login]
 * @returns {Promise<object>}
 */
function postJson(name, body, signal, login = false) {
  return fetch(apiUrl(name), {
    method: 'POST',
    headers: { ...(login ? authHeaders() : {}), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  }).then((res) => {
    if (!res.ok) throw new Error(`${name} ${res.status}`);
    return res.json();
  });
}

/**
 * An add-on's description (API HTML) as safe content: paragraphs, lists, bold and italic, and
 * links to web pages only (opening in a new tab).
 * @param {string} html
 * @returns {DocumentFragment}
 */
function safeDescription(html) {
  // scripts, styles and frames dropped with their text (the rest keeps only its text)
  const source = new DOMParser().parseFromString(html || '', 'text/html').body;
  source.querySelectorAll('script, style, template, noscript, iframe, object').forEach((n) => n.remove());
  const content = safeHtml(source.innerHTML, { blocks: true });
  content.querySelectorAll('a').forEach((a) => {
    if (!/^https?:$/.test(new URL(a.href, window.location.href).protocol)) {
      a.replaceWith(...a.childNodes);
      return;
    }
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  });
  return content;
}

/**
 * Decorates the Edit Booking block: a member's booking to change (the source Edit Your Booking
 * page), from GetOrderDetail for the address's `bookingid`, with the member's login token: the
 * date, the start time and the service (the lounge's products for that time, GetServices), and
 * the additional services (the booked ones and the ones on sale for that time, GetAddOns), with a
 * summary that follows the choices. Once something changed, Submit & Review Changes asks for a
 * confirmation; saving waits for the booking change API (the confirmation's button stays
 * disabled). Authors write the texts (Key | Text rows, see README).
 * @param {Element} block The Edit Booking block element
 */
export default function decorate(block) {
  const texts = readTexts(block);
  const text = (key) => texts.get(key.toLowerCase())?.textContent.trim() || '';
  const link = (key) => texts.get(key.toLowerCase())?.querySelector('a[href]');

  // the booking steps band, the current step (authored in bold) highlighted
  // (styles/booking-steps.css)
  const band = el('div', 'booking-steps');
  const steps = [...(texts.get('steps')?.querySelectorAll('li') || [])].filter((li) => li.textContent.trim());
  if (steps.length) {
    const nav = el('nav');
    nav.setAttribute('aria-label', text('heading'));
    const list = el('ol', 'booking-steps-list');
    steps.forEach((step, i) => {
      const item = el('li', 'booking-steps-item');
      item.append(el('span', 'booking-steps-number', i + 1), el('span', 'booking-steps-name', step.textContent.trim()));
      if (step.querySelector('strong, b')) {
        item.classList.add('is-active');
        item.setAttribute('aria-current', 'step');
      }
      list.append(item);
    });
    // the steps before the current one, as done (the phone bar shows their numbers, then the
    // current step's phone name, "Booking", if authored)
    const active = [...list.children].findIndex((item) => item.classList.contains('is-active'));
    [...list.children].slice(0, Math.max(active, 0)).forEach((item) => item.classList.add('is-done'));
    if (active >= 0 && text('phoneStep')) {
      list.children[active].append(el('span', 'booking-steps-short', text('phoneStep')));
    }
    nav.append(list);
    band.append(nav);
  }

  // the title, after the arrow back to the bookings list
  const heading = el('h1', 'edit-booking-title');
  const back = link('back');
  if (back) {
    const arrow = el('a', 'edit-booking-back');
    arrow.href = back.href;
    arrow.setAttribute('aria-label', back.textContent.trim() || back.href);
    heading.append(arrow);
  }
  heading.append(text('heading'));

  const message = el('p', 'edit-booking-message');
  message.setAttribute('role', 'status');
  message.hidden = true;
  const body = el('div', 'edit-booking-body');
  body.hidden = true;
  block.replaceChildren(band, heading, message, body);

  const showMessage = (content, retry) => {
    message.replaceChildren(content);
    if (retry) {
      const again = button('edit-booking-retry', translate('formRetry'));
      again.addEventListener('click', retry);
      message.append(' ', again);
    }
    message.hidden = false;
  };
  const orderId = bookingId();
  if (!orderId) {
    showMessage(text('notFound') || translate('bookingNotFound'));
    return;
  }
  // no login: the page's login check is already sending the visitor home
  if (!getToken()) return;

  /**
   * Builds the page from the GetOrderDetail answer.
   * @param {object} order
   */
  const fill = (order) => {
    const items = Array.isArray(order.orderItems) ? order.orderItems : [];
    const visit = groupItems(items)[0] || { main: items[0] || {}, addOns: [] };
    const { main: item, addOns: booked } = visit;
    const currency = orderCurrency(order);
    const zone = loungeZone(order);
    const leadMinutes = (Number(item.propertyLeadTime) || 1) * 60;
    const start = String(item.startDate || '').match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    const guests = item.guestsCount || {};
    const adults = Number(guests.adult) || 0;
    const children = Number(guests.child) || 0;
    const address = [item.shortLocation, item.locationName].map((p) => String(p || '').trim()).filter(Boolean).join(', ');
    // the services to choose from: the booked one until GetServices answers for the time
    const bookedService = { code: item.productCode || 'booked', name: item.productDisplayName || item.productName || '' };
    let services = [bookedService];

    // the additional services by product code: the booked ones (their price as booked), then the
    // ones on sale for the chosen time (GetAddOns: their prices, stock, description and image)
    const addOnCode = (addOn) => addOn.productCode || addOn.productDisplayName;
    const catalog = new Map(booked.map((addOn) => {
      const qty = Number(addOn.quantity) || 1;
      const rates = addOn.itemPriceDetails?.baseRate || [];
      const rate = (group) => {
        const r = rates.find((x) => x.groups === group);
        return r && Number(r.count) ? Number(r.price) / Number(r.count) : 0;
      };
      return [addOnCode(addOn), {
        name: addOn.productDisplayName || addOn.productName || '',
        basedOn: addOn.basedOn || '',
        unitPrice: itemPrice(addOn) / qty,
        adultPrice: rate('adult'),
        childPrice: rate('child'),
        booked: true,
      }];
    }));
    let addOnsUnavailable = false;

    // the booking as booked, and as the visitor changes it
    const original = {
      day: start?.[1] || '',
      time: start?.[2] ? `${start[2]}${start[3]}` : '',
      service: bookedService.code,
      addOns: new Map(booked.map((addOn) => [addOnCode(addOn), Number(addOn.quantity) || 1])),
    };
    const state = { ...original, addOns: new Map(original.addOns) };
    const serviceName = (code) => [...services, bookedService].find((x) => x.code === code)?.name || '';
    const guestsText = (withChildren) => [
      adults ? `${adults} ${text('adults') || ''}`.trim() : '',
      children || withChildren ? `${children} ${text('children') || ''}`.trim() : '',
    ].filter(Boolean).join(', ');

    // the times that can still be booked on a day: from today, the lounge's lead time (1 hour) on
    const bookable = (day, time) => {
      const now = loungeNow(zone);
      if (day < now.day) return false;
      return day > now.day || minutesOf(time) >= now.minutes + leadMinutes;
    };
    const timeSelect = (className) => {
      const select = el('select', className);
      TIMES.forEach((time) => {
        const option = el('option', '', time);
        option.value = time;
        select.append(option);
      });
      return select;
    };
    const fitTimes = (select, day) => {
      [...select.options].forEach((option) => { option.disabled = !bookable(day, option.value); });
    };
    const serviceSelects = [];
    const fillServices = (select) => {
      select.replaceChildren(...services.map((x) => {
        const option = el('option', '', x.name);
        option.value = x.code;
        return option;
      }));
    };
    const serviceSelect = (className) => {
      const select = el('select', className);
      fillServices(select);
      serviceSelects.push(select);
      return select;
    };
    const field = (label, control, className = '') => {
      count += 1;
      const wrap = el('div', `form-field edit-booking-field ${className}`.trim());
      const name = el('label', 'form-label', label);
      const target = control.matches('input, select') ? control : control.querySelector('input, select');
      if (target) {
        target.id = target.id || `edit-booking-${count}`;
        name.htmlFor = target.id;
      }
      wrap.append(name, control);
      return wrap;
    };
    // the day picker: the day as the source writes it ("01-Dec-2026"), the browser's own date
    // picker over it
    const dayPicker = () => {
      const wrap = el('div', 'edit-booking-date');
      const shown = el('span', 'form-input edit-booking-date-text');
      shown.setAttribute('aria-hidden', 'true');
      const input = el('input', 'edit-booking-date-input');
      input.type = 'date';
      input.min = loungeNow(zone).day;
      input.addEventListener('click', () => { try { input.showPicker?.(); } catch { /* the field itself */ } });
      wrap.append(shown, input);
      return { wrap, input, shown };
    };

    const main = el('div', 'edit-booking-main');
    const intro = texts.get('intro');
    if (intro) {
      const introBox = el('div', 'edit-booking-intro');
      introBox.append(...[...intro.childNodes].map((n) => n.cloneNode(true)));
      main.append(introBox);
    }

    // the lounge, its details folding away on phones (as the source's accordion)
    const lounge = el('div', 'edit-booking-lounge');
    const toggle = button('edit-booking-toggle');
    toggle.setAttribute('aria-expanded', 'true');
    // the lounge as the source names it: "Plaza Premium First (Near Gate 35, West Hall)"
    const loungeName = String(item.propertyName || '').trim() || [
      String(item.propertyDisplayName || '').trim(),
      item.shortLocation ? `(${String(item.shortLocation).trim()})` : '',
    ].filter(Boolean).join(' ');
    toggle.append(
      el('span', 'edit-booking-lounge-name', loungeName),
      el('span', 'edit-booking-lounge-address', address),
    );
    lounge.append(toggle);
    const panel = el('div', 'edit-booking-panel');
    count += 1;
    panel.id = `edit-booking-panel-${count}`;
    toggle.setAttribute('aria-controls', panel.id);
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      panel.classList.toggle('is-collapsed', !open);
    });

    // from 992px: the form
    const form = el('form', 'form-fields edit-booking-form');
    form.addEventListener('submit', (e) => e.preventDefault());
    const date = dayPicker();
    const time = timeSelect('form-input form-select');
    const timeWrap = el('div', 'edit-booking-time');
    timeWrap.append(time, el('span', 'edit-booking-hrs', text('hours')));
    const guestPill = (value) => el('output', 'edit-booking-count', value);
    const childLabel = el('span', '', text('children'));
    const service = serviceSelect('form-input form-select');
    form.append(
      field(text('date'), date.wrap, 'width-half'),
      field(text('time'), timeWrap, 'width-half'),
      field(text('adults'), guestPill(adults), 'width-half'),
      field(text('children'), guestPill(children), 'width-half'),
      field(text('service'), service, 'width-half new-row'),
    );
    // the children's note in its label ("Complimentary for under 2 years old")
    const childField = form.children[3].querySelector('.form-label');
    if (text('childrenNote')) {
      childField.replaceChildren(childLabel, ' ', el('span', 'edit-booking-note', text('childrenNote')));
    }

    // below 992px: the choices as rows, each with Edit (a popup)
    const rows = el('dl', 'edit-booking-rows');
    const row = (label, editable) => {
      const line = el('div', 'edit-booking-row');
      const value = el('dd', 'edit-booking-row-value');
      line.append(el('dt', '', label), value);
      let edit;
      if (editable) {
        edit = button('edit-booking-edit', text('edit'));
        line.append(edit);
      }
      rows.append(line);
      return { value, edit };
    };
    const rowDate = row(text('summaryDate') || text('date'), true);
    const rowTime = row(text('summaryTime') || text('time'), true);
    const rowGuests = row(text('summaryGuests'), false);
    const rowService = row(text('summaryServices') || text('service'), true);
    panel.append(form, rows);
    lounge.append(panel);
    main.append(lounge);

    // the additional services: a title over a line, then one row per add-on with Add or Edit
    const extras = el('section', 'edit-booking-addons');
    const addOnList = el('ul', 'edit-booking-addon-list');
    const addOnNote = el('div', 'edit-booking-addons-note');
    const addOnActions = new Map();
    main.append(extras);

    const submit = button('button primary edit-booking-submit', text('submit'));
    submit.hidden = true;
    main.append(submit);

    // the summary, following the choices
    const summary = el('aside', 'edit-booking-summary');
    summary.append(el('h2', 'edit-booking-summary-title', text('summary')), el('p', 'edit-booking-summary-location', address));
    const summaryRows = el('dl', 'edit-booking-summary-rows');
    const summaryRow = (label) => {
      const line = el('div', 'edit-booking-summary-row');
      const value = el('dd');
      line.append(el('dt', '', label), value);
      summaryRows.append(line);
      return value;
    };
    const sumDate = summaryRow(text('summaryDate'));
    const sumTime = summaryRow(text('summaryTime'));
    const sumGuests = summaryRow(text('summaryGuests'));
    const sumServices = summaryRow(text('summaryServices'));
    summary.append(summaryRows);

    const timeValue = (value, node) => {
      node.replaceChildren(value);
      if (value && text('hours')) node.append(el('span', 'edit-booking-unit', text('hours')));
    };
    const qtyOf = (code, map = state.addOns) => map.get(code) || 0;
    const changed = () => state.day !== original.day || state.time !== original.time
      || state.service !== original.service
      || [...catalog.keys()].some((code) => qtyOf(code) !== qtyOf(code, original.addOns));
    const servicesNodes = () => {
      const nodes = [el('span', 'edit-booking-service', serviceName(state.service))];
      catalog.forEach((entry, code) => {
        if (qtyOf(code) > 0) nodes.push(el('span', 'edit-booking-service', `${qtyOf(code)} x ${entry.name}`));
      });
      return nodes;
    };

    // the page from the state: the form, the rows, the summary, the add-ons and Submit
    const refresh = () => {
      date.input.value = state.day;
      date.shown.textContent = dayText(state.day);
      fitTimes(time, state.day);
      time.value = state.time;
      serviceSelects.forEach((select) => { select.value = state.service; });
      rowDate.value.textContent = dayText(state.day);
      timeValue(state.time, rowTime.value);
      rowGuests.value.textContent = guestsText(true);
      rowService.value.textContent = serviceName(state.service);
      sumDate.textContent = dayText(state.day);
      timeValue(state.time, sumTime);
      sumGuests.textContent = guestsText(false);
      sumServices.replaceChildren(...servicesNodes());
      addOnActions.forEach((action, code) => {
        action.textContent = qtyOf(code) > 0 ? text('edit') : text('add');
      });
      submit.hidden = !changed();
    };

    /**
     * A popup (the site's modal): its title, its content, and a Confirm button.
     * @param {string} key
     * @param {string} title
     * @param {() => Node[]} nodes Its content, built on the first open (the modal is kept)
     * @param {HTMLElement} trigger
     */
    const popup = (key, title, nodes, trigger) => openModal({
      key: `edit-booking-${key}-${orderId}`,
      trigger,
      content: () => {
        // the modal sits outside the block: its content in a box of the block's own (the form
        // styles for its fields)
        const box = el('div', 'form-fields edit-booking-popup');
        box.append(el('h2', '', title), ...nodes());
        return [box];
      },
    });
    const confirmButton = (onConfirm) => {
      const ok = button('button primary edit-booking-confirm', text('confirm'));
      ok.addEventListener('click', () => {
        onConfirm();
        ok.closest('dialog')?.close();
      });
      return ok;
    };

    /**
     * An add-on's popup (built on its first open): its description, image and unit, the quantity
     * (per unit, up to its stock) or the adults and children it's for (per person, with All
     * guests), and its total from the unit prices.
     * @param {string} code
     * @returns {() => void} opens it
     */
    const addOnPopups = new Map();
    const addOnPopup = (code) => {
      if (addOnPopups.has(code)) return addOnPopups.get(code);
      const entry = catalog.get(code);
      const perPerson = /person/i.test(entry.basedOn);
      const total = el('b', 'edit-booking-total');
      const stepper = (label, limit) => {
        const wrap = el('div', 'edit-booking-stepper');
        const minus = button('edit-booking-step', '−');
        const plus = button('edit-booking-step', '+');
        const value = el('output', 'edit-booking-qty', 0);
        minus.setAttribute('aria-label', `${label} −`);
        plus.setAttribute('aria-label', `${label} +`);
        const set = (n) => {
          value.value = String(Math.max(0, Math.min(limit(), n)));
          minus.disabled = Number(value.value) <= 0;
          plus.disabled = Number(value.value) >= limit();
        };
        const step = (by) => {
          set(Number(value.value) + by);
          wrap.dispatchEvent(new Event('change', { bubbles: true }));
        };
        minus.addEventListener('click', () => step(-1));
        plus.addEventListener('click', () => step(1));
        const line = el('div', 'edit-booking-quantity');
        line.append(el('span', 'edit-booking-quantity-label', label), wrap);
        wrap.append(minus, value, plus);
        return { line, set, get: () => Number(value.value) };
      };
      // per unit: up to the stock left plus the booked quantity (99 when the stock isn't known)
      const stock = () => (entry.stock === undefined
        ? 99 : entry.stock + qtyOf(code, original.addOns));
      const lines = perPerson
        ? [stepper(text('adults'), () => adults), stepper(text('children'), () => children)]
        : [stepper(text('quantity'), stock)];
      const all = el('label', 'form-check-label edit-booking-all');
      const allBox = el('input', 'form-check-input');
      allBox.type = 'checkbox';
      all.prepend(allBox, ` ${text('allGuests')}`);
      const updateTotal = () => {
        const amount = perPerson
          ? lines[0].get() * entry.adultPrice + lines[1].get() * entry.childPrice
          : lines[0].get() * entry.unitPrice;
        total.textContent = money(amount, entry.currency || currency);
        if (perPerson) allBox.checked = lines[0].get() === adults && lines[1].get() === children;
      };
      allBox.addEventListener('change', () => {
        lines[0].set(allBox.checked ? adults : 0);
        lines[1].set(allBox.checked ? children : 0);
        updateTotal();
      });
      const details = el('div', 'edit-booking-addon-details');
      const box = el('div', 'edit-booking-addon-popup');
      box.addEventListener('change', updateTotal);
      const totalLine = el('p', 'edit-booking-total-line');
      totalLine.append(el('span', '', text('serviceTotal')), ' ', total);
      box.append(...lines.map((l) => l.line));
      if (perPerson && text('allGuests')) box.append(all);
      box.append(totalLine);
      const save = button('button tertiary edit-booking-addon-save');
      save.addEventListener('click', () => {
        state.addOns.set(code, perPerson ? lines[0].get() + lines[1].get() : lines[0].get());
        refresh();
        save.closest('dialog')?.close();
      });
      const open = () => {
        // the details as the latest answer gives them
        details.replaceChildren();
        if (entry.description) details.append(el('div', 'edit-booking-addon-description'));
        details.firstChild?.append(safeDescription(entry.description));
        if (entry.image) {
          const img = el('img', 'edit-booking-addon-image');
          img.src = entry.image;
          img.alt = entry.name;
          img.loading = 'lazy';
          details.append(img);
        }
        if (entry.unitLabel) details.append(el('p', 'edit-booking-addon-unit', entry.unitLabel));
        const qty = qtyOf(code);
        if (perPerson) {
          lines[0].set(Math.min(qty, adults));
          lines[1].set(Math.max(0, qty - adults));
        } else lines[0].set(qty);
        save.textContent = qty > 0 ? text('update') : text('add');
        updateTotal();
        popup(`addon-${code}`, entry.name, () => [details, box, save], addOnActions.get(code));
      };
      addOnPopups.set(code, open);
      return open;
    };

    // the add-ons' rows (the section shows when there are add-ons, or the note that they can't be
    // changed)
    const renderAddOns = () => {
      addOnActions.clear();
      addOnList.replaceChildren(...[...catalog].map(([code, entry]) => {
        const li = el('li', 'edit-booking-addon');
        const action = button('edit-booking-addon-button');
        action.addEventListener('click', () => addOnPopup(code)());
        addOnActions.set(code, action);
        li.append(el('span', 'edit-booking-addon-name', entry.name), action);
        return li;
      }));
      // the note as authored (its link to customer service kept)
      const note = addOnsUnavailable ? texts.get('addonsunavailable') : null;
      addOnNote.replaceChildren(...[...(note?.childNodes || [])].map((n) => n.cloneNode(true)));
      extras.replaceChildren(el('h2', 'edit-booking-addons-title', text('additionalService')), el('hr'));
      if (note) extras.append(addOnNote);
      extras.append(addOnList);
      extras.hidden = !catalog.size && !note;
    };

    // the lounge's products and add-ons for the chosen day and time (a newer request cancels an
    // older one). On a failure the lists stay as they are (the booked service, the booked add-ons)
    let pending;
    const loadOptions = () => {
      pending?.abort();
      pending = new AbortController();
      const { signal } = pending;
      const startDateTime = `${state.day} ${state.time.slice(0, 2)}:${state.time.slice(2)}:00`;
      const where = {
        propertyCode: item.propertyCode, iataCode: item.iataCode, currencyCode: currency,
      };
      const atBooking = state.day === original.day && state.time === original.time;

      postJson('propertyServices', { startDateTime, ...where }, signal).then((json) => {
        const list = Array.isArray(json?.items) ? json.items : [];
        const match = list.find((x) => x.serviceCode && x.serviceCode === item.serviceCode)
          || list.find((x) => String(x.serviceType).toUpperCase() === 'LOUNGE');
        const products = (match?.availableProducts || [])
          .filter((p) => p.productCode)
          .map((p) => ({ code: p.productCode, name: p.displayName || p.productCode }));
        // the booked product stays on the list at the booked time
        if (atBooking && !products.some((p) => p.code === bookedService.code)) {
          products.unshift(bookedService);
        }
        if (!products.length) return;
        services = products;
        if (!services.some((p) => p.code === state.service)) state.service = services[0].code;
        serviceSelects.forEach(fillServices);
        refresh();
      }).catch(() => { /* the list as it is */ });

      postJson('getAddOns', { orderId, startDateTime, ...where }, signal, true).then((json) => {
        const list = (Array.isArray(json?.items) ? json.items : []).filter((x) => x.productCode);
        // the ones on sale before, not booked and no longer on sale, leave (and their quantity)
        [...catalog].forEach(([code, entry]) => {
          if (!entry.booked && !list.some((x) => x.productCode === code)) {
            catalog.delete(code);
            state.addOns.delete(code);
            addOnPopups.delete(code);
          }
        });
        list.forEach((x) => {
          const entry = catalog.get(x.productCode) || { booked: false };
          Object.assign(entry, {
            name: String(x.displayName || entry.name || x.productCode),
            basedOn: String(x.basedOn || entry.basedOn || ''),
            unitPrice: toNumber(x.unitPrice) ?? (entry.unitPrice || 0),
            adultPrice: toNumber(x.adultUnitPrice) ?? (entry.adultPrice || 0),
            childPrice: toNumber(x.childUnitPrice) ?? (entry.childPrice || 0),
            stock: toNumber(x.availableInventory),
            currency: String(x.currency || ''),
            description: String(x.description || ''),
            image: toUrl(x.image),
            unitLabel: String(x.unitLabel || ''),
          });
          catalog.set(x.productCode, entry);
        });
        // none on sale for a booking with add-ons: the source's note that they can't be changed
        addOnsUnavailable = !list.length && booked.length > 0;
        renderAddOns();
        refresh();
      }).catch(() => { /* the booked add-ons only */ });
    };

    // a day changed: a start time no longer bookable moves to the first that is
    const setDay = (day) => {
      if (!day) return;
      state.day = day;
      if (!bookable(day, state.time)) {
        state.time = TIMES.find((t) => bookable(day, t)) || state.time;
      }
      refresh();
      loadOptions();
    };
    const setTime = (value) => {
      state.time = value;
      refresh();
      loadOptions();
    };

    date.input.addEventListener('change', () => setDay(date.input.value));
    time.addEventListener('change', () => setTime(time.value));
    service.addEventListener('change', () => { state.service = service.value; refresh(); });

    // the phone popups: date, time, service
    const popDate = el('input', 'form-input edit-booking-popup-date');
    popDate.type = 'date';
    popDate.min = loungeNow(zone).day;
    rowDate.edit.addEventListener('click', () => {
      popDate.value = state.day;
      popup('date', text('date'), () => [
        field(text('date'), popDate), confirmButton(() => setDay(popDate.value)),
      ], rowDate.edit);
    });
    const popTime = timeSelect('form-input form-select');
    rowTime.edit.addEventListener('click', () => {
      fitTimes(popTime, state.day);
      popTime.value = state.time;
      popup('time', text('time'), () => [
        field(text('time'), popTime), confirmButton(() => setTime(popTime.value)),
      ], rowTime.edit);
    });
    const popService = serviceSelect('form-input form-select');
    rowService.edit.addEventListener('click', () => {
      popService.value = state.service;
      const title = text('lengthOfStay') || text('service');
      popup('service', title, () => [
        field(title, popService),
        confirmButton(() => { state.service = popService.value; refresh(); }),
      ], rowService.edit);
    });

    // Submit & Review Changes: the changes, old → new, to confirm (saving waits for the API)
    const changesList = el('ul', 'edit-booking-changes');
    const cancel = button('button secondary edit-booking-cancel', text('cancel'));
    cancel.addEventListener('click', () => cancel.closest('dialog')?.close());
    const send = button('button primary edit-booking-send', text('confirm'));
    send.disabled = true;
    const actions = el('p', 'edit-booking-confirm-actions');
    actions.append(cancel, send);
    const confirmNodes = [
      el('p', 'edit-booking-confirm-text', text('confirmText')),
      changesList,
      el('p', 'edit-booking-pending', text('pending') || translate('bookingChangesPending')),
      actions,
    ];
    submit.addEventListener('click', () => {
      const lines = [];
      if (state.day !== original.day) lines.push([text('summaryDate'), dayText(original.day), dayText(state.day)]);
      if (state.time !== original.time) lines.push([text('summaryTime'), original.time, state.time]);
      if (state.service !== original.service) lines.push([text('summaryServices'), serviceName(original.service), serviceName(state.service)]);
      catalog.forEach((entry, code) => {
        const before = qtyOf(code, original.addOns);
        if (qtyOf(code) !== before) lines.push([`${entry.name}:`, before, qtyOf(code)]);
      });
      changesList.replaceChildren(...lines.map(([label, before, after]) => {
        const li = el('li');
        li.append(el('span', 'edit-booking-change-label', label), ` ${before} → `, el('b', '', after));
        return li;
      }));
      popup('confirm', text('confirmTitle'), () => confirmNodes, submit);
    });

    renderAddOns();
    refresh();
    loadOptions();
    const layout = el('div', 'edit-booking-layout');
    layout.append(main, summary);
    body.replaceChildren(layout);
    body.hidden = false;
  };

  // the site's full-page loader until the booking is in; a refused token logs out and goes home
  const loader = bookingLoader();
  const load = () => {
    loader.start();
    showMessage(text('loading') || translate('bookingLoading'));
    block.setAttribute('aria-busy', 'true');
    fetchOrder(orderId)
      .then((order) => {
        if (!order) return;
        fill(order);
        message.hidden = true;
        block.removeAttribute('aria-busy');
        loader.done();
      })
      .catch((error) => {
        loader.done();
        block.removeAttribute('aria-busy');
        if (error.notFound) showMessage(text('notFound') || translate('bookingNotFound'));
        else showMessage(text('error') || translate('bookingLoadError'), load);
      });
  };
  load();
}
