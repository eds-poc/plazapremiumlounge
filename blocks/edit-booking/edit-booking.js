import { getToken } from '../../scripts/auth.js';
import { translate } from '../../scripts/i18n.js';
import { openModal } from '../../scripts/modal-dialog.js';
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
 * Decorates the Edit Booking block: a member's booking to change (the source Edit Your Booking
 * page), from GetOrderDetail for the address's `bookingid`, with the member's login token: the
 * date, the start time and the service, and the booking's additional services, with a summary that
 * follows the choices. Once something changed, Submit & Review Changes asks for a confirmation;
 * saving waits for the booking change API (the confirmation's button stays disabled). Authors
 * write the texts (Key | Text rows, see README).
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
    const services = [{ code: item.productCode || 'booked', name: item.productDisplayName || item.productName || '' }];

    // the booking as booked, and as the visitor changes it
    const original = {
      day: start?.[1] || '',
      time: start?.[2] ? `${start[2]}${start[3]}` : '',
      service: services[0].code,
      addOns: new Map(booked.map((addOn) => [
        addOn.productCode || addOn.productDisplayName, Number(addOn.quantity) || 1,
      ])),
    };
    const state = { ...original, addOns: new Map(original.addOns) };
    const serviceName = (code) => services.find((s) => s.code === code)?.name || '';
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
    const serviceSelect = (className) => {
      const select = el('select', className);
      services.forEach((service) => {
        const option = el('option', '', service.name);
        option.value = service.code;
        select.append(option);
      });
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
    const guestPill = (value) => {
      const pill = el('output', 'edit-booking-count', value);
      return pill;
    };
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

    // the additional services: the booking's add-ons (the ones on sale need the add-ons API)
    const extras = el('section', 'edit-booking-addons');
    const addOnRows = new Map();
    if (booked.length) {
      extras.append(el('h2', 'edit-booking-addons-title', text('additionalService')), el('hr'));
      const list = el('ul', 'edit-booking-addon-list');
      booked.forEach((addOn) => {
        const code = addOn.productCode || addOn.productDisplayName;
        const li = el('li', 'edit-booking-addon');
        const name = el('span', 'edit-booking-addon-name', addOn.productDisplayName || addOn.productName || '');
        const action = button('edit-booking-addon-button');
        li.append(name, action);
        list.append(li);
        addOnRows.set(code, { addOn, action });
      });
      extras.append(list);
      main.append(extras);
    }

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
    const changed = () => state.day !== original.day || state.time !== original.time
      || state.service !== original.service
      || [...state.addOns].some(([code, qty]) => original.addOns.get(code) !== qty);
    const servicesNodes = () => {
      const nodes = [el('span', 'edit-booking-service', serviceName(state.service))];
      state.addOns.forEach((qty, code) => {
        if (qty > 0) {
          const { addOn } = addOnRows.get(code);
          nodes.push(el('span', 'edit-booking-service', `${qty} x ${addOn.productDisplayName || addOn.productName || ''}`));
        }
      });
      return nodes;
    };

    // the page from the state: the form, the rows, the summary, the add-ons and Submit
    const refresh = () => {
      date.input.value = state.day;
      date.shown.textContent = dayText(state.day);
      fitTimes(time, state.day);
      time.value = state.time;
      service.value = state.service;
      rowDate.value.textContent = dayText(state.day);
      timeValue(state.time, rowTime.value);
      rowGuests.value.textContent = guestsText(true);
      rowService.value.textContent = serviceName(state.service);
      sumDate.textContent = dayText(state.day);
      timeValue(state.time, sumTime);
      sumGuests.textContent = guestsText(false);
      sumServices.replaceChildren(...servicesNodes());
      addOnRows.forEach(({ action }, code) => {
        action.textContent = (state.addOns.get(code) || 0) > 0 ? text('edit') : text('add');
      });
      submit.hidden = !changed();
    };
    // a day changed: a start time no longer bookable moves to the first that is
    const setDay = (day) => {
      if (!day) return;
      state.day = day;
      if (!bookable(day, state.time)) {
        state.time = TIMES.find((t) => bookable(day, t)) || state.time;
      }
      refresh();
    };

    date.input.addEventListener('change', () => setDay(date.input.value));
    time.addEventListener('change', () => { state.time = time.value; refresh(); });
    service.addEventListener('change', () => { state.service = service.value; refresh(); });

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
        field(text('time'), popTime),
        confirmButton(() => { state.time = popTime.value; refresh(); }),
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

    // an add-on's popup: the quantity (per unit) or the guests it's for (per person), its total
    addOnRows.forEach(({ addOn, action }, code) => {
      const perPerson = /person/i.test(addOn.basedOn || '');
      const bookedQty = Number(addOn.quantity) || 1;
      const rates = addOn.itemPriceDetails?.baseRate || [];
      const rate = (group) => {
        const r = rates.find((x) => x.groups === group);
        return r && Number(r.count) ? Number(r.price) / Number(r.count) : 0;
      };
      const unit = itemPrice(addOn) / bookedQty;
      const total = el('b', 'edit-booking-total');
      const stepper = (label, max) => {
        const wrap = el('div', 'edit-booking-stepper');
        const minus = button('edit-booking-step', '−');
        const plus = button('edit-booking-step', '+');
        const value = el('output', 'edit-booking-qty', 0);
        minus.setAttribute('aria-label', `${label} −`);
        plus.setAttribute('aria-label', `${label} +`);
        const set = (n) => {
          value.value = String(Math.max(0, Math.min(max, n)));
          minus.disabled = Number(value.value) <= 0;
          plus.disabled = Number(value.value) >= max;
        };
        minus.addEventListener('click', () => { set(Number(value.value) - 1); wrap.dispatchEvent(new Event('change', { bubbles: true })); });
        plus.addEventListener('click', () => { set(Number(value.value) + 1); wrap.dispatchEvent(new Event('change', { bubbles: true })); });
        const line = el('div', 'edit-booking-quantity');
        line.append(el('span', 'edit-booking-quantity-label', label), wrap);
        wrap.append(minus, value, plus);
        return { line, set, get: () => Number(value.value) };
      };
      const lines = perPerson
        ? [stepper(text('adults'), adults), stepper(text('children'), children)]
        : [stepper(text('quantity'), 99)];
      const all = el('label', 'form-check-label edit-booking-all');
      const allBox = el('input', 'form-check-input');
      allBox.type = 'checkbox';
      all.prepend(allBox, ` ${text('allGuests')}`);
      const updateTotal = () => {
        const amount = perPerson
          ? lines[0].get() * rate('adult') + lines[1].get() * rate('child')
          : lines[0].get() * unit;
        total.textContent = money(amount, currency);
        if (perPerson) allBox.checked = lines[0].get() === adults && lines[1].get() === children;
      };
      allBox.addEventListener('change', () => {
        lines[0].set(allBox.checked ? adults : 0);
        lines[1].set(allBox.checked ? children : 0);
        updateTotal();
      });
      const box = el('div', 'edit-booking-addon-popup');
      box.addEventListener('change', updateTotal);
      const totalLine = el('p', 'edit-booking-total-line');
      totalLine.append(el('span', '', text('serviceTotal')), ' ', total);
      box.append(...lines.map((l) => l.line));
      if (perPerson && text('allGuests')) box.append(all);
      box.append(totalLine);
      const save = button('button edit-booking-addon-save', text('update'));
      save.addEventListener('click', () => {
        const qty = perPerson ? lines[0].get() + lines[1].get() : lines[0].get();
        state.addOns.set(code, qty);
        refresh();
        save.closest('dialog')?.close();
      });
      action.addEventListener('click', () => {
        const qty = state.addOns.get(code) || 0;
        if (perPerson) {
          lines[0].set(Math.min(qty, adults));
          lines[1].set(Math.max(0, qty - adults));
        } else lines[0].set(qty);
        updateTotal();
        popup(`addon-${code}`, addOn.productDisplayName || addOn.productName || '', () => [box, save], action);
      });
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
      state.addOns.forEach((qty, code) => {
        const before = original.addOns.get(code) || 0;
        if (qty !== before) lines.push([`${addOnRows.get(code).addOn.productDisplayName || ''}:`, before, qty]);
      });
      changesList.replaceChildren(...lines.map(([label, before, after]) => {
        const li = el('li');
        li.append(el('span', 'edit-booking-change-label', label), ` ${before} → `, el('b', '', after));
        return li;
      }));
      popup('confirm', text('confirmTitle'), () => confirmNodes, submit);
    });

    refresh();
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
