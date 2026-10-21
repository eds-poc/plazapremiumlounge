import { getLanguage, translate } from '../../scripts/i18n.js';
import { el } from '../../scripts/properties.js';

// the source's calendar in each language (its jQuery UI datepicker regional settings): the first
// day of the week, the weekday letters (from Sunday) and the month title
const CALENDARS = {
  en: {
    firstDay: 0,
    days: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
    title: (year, month, name) => `${name} ${year}`,
  },
  zh: {
    firstDay: 1,
    days: ['日', '一', '二', '三', '四', '五', '六'],
    months: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
    title: (year, month, name) => `${year}年 ${name}`,
  },
  ja: {
    firstDay: 1,
    days: ['日', '月', '火', '水', '木', '金', '土'],
    title: (year, month) => `${year}年 ${month + 1}月`,
  },
  pt: {
    firstDay: 1,
    days: ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'],
    title: (year, month, name) => `${year} ${name}`,
  },
};

/**
 * A date (YYYY-MM-DD) moved by a number of days.
 * @param {string} date
 * @param {number} days
 * @returns {string}
 */
function addDays(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * A date (YYYY-MM-DD) moved by a number of months, onto the month's last day when it's shorter
 * (31 Oct → 30 Nov).
 * @param {string} date
 * @param {number} months
 * @returns {string}
 */
function addMonths(date, months) {
  const [y, m, d] = date.split('-').map(Number);
  const last = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + months, Math.min(d, last))).toISOString().slice(0, 10);
}

/**
 * The booking form's date, as the source's: the date as the source writes it, and a calendar of
 * one month (the month and year, previous and next, the days; days before `min` can't be chosen,
 * and there's no last day). On desktop the calendar pops up under the date (with a "Date" title
 * and close); in the phone's Book Your Visit dialog it's always open under it (the styles decide,
 * by `.property-detail-modal`). The days are a grid with one tab stop: the arrow keys move a day
 * or a week, Home and End to the week's start and end, Page Up and Page Down a month (with Shift,
 * a year), Enter or Space choose; Escape closes the pop-up. Choosing another day closes the pop-up
 * and sets the form's `name` field (a hidden input), with a `change` event as the other fields.
 * @param {{name: string, value: string, min: string, format: Function}} options
 *   `value` and `min` as YYYY-MM-DD; `format` writes a date as the source does
 * @returns {{element: HTMLElement, trigger: HTMLButtonElement, input: HTMLInputElement,
 *   close: Function}}
 */
export default function buildDatePicker({
  name, value, min, format,
}) {
  const lang = getLanguage();
  const base = lang.split('-')[0];
  const calendar = CALENDARS[base] || CALENDARS.en;
  const monthName = (month) => {
    if (calendar.months) return calendar.months[month];
    const text = new Intl.DateTimeFormat(lang, { month: 'long', timeZone: 'UTC' })
      .format(new Date(Date.UTC(2000, month, 1)));
    return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
  };
  const dayName = (day) => new Intl.DateTimeFormat(lang, { weekday: 'long', timeZone: 'UTC' })
    .format(new Date(Date.UTC(2023, 0, 1 + day)));
  const fullDate = new Intl.DateTimeFormat(lang, { dateStyle: 'full', timeZone: 'UTC' });

  const element = el('div', 'property-detail-date');
  const input = el('input');
  input.type = 'hidden';
  input.name = name;
  input.value = value;
  const id = `property-detail-calendar-${Math.random().toString(36).slice(2, 8)}`;
  const trigger = el('button', 'property-detail-date-text', format(value));
  trigger.type = 'button';
  trigger.id = `${id}-trigger`;
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', id);
  // the dialog's version: the date as plain text over the open calendar
  const shown = el('p', 'property-detail-date-value', format(value));
  shown.setAttribute('aria-hidden', 'true');

  const popup = el('div', 'property-detail-calendar');
  popup.id = id;
  popup.setAttribute('role', 'group');
  const top = el('div', 'property-detail-calendar-top');
  const heading = el('p', 'property-detail-calendar-heading', translate('propertyDate'));
  heading.id = `${id}-heading`;
  const close = el('button', 'property-detail-calendar-close');
  close.type = 'button';
  close.setAttribute('aria-label', translate('close'));
  top.append(heading, close);
  popup.setAttribute('aria-labelledby', heading.id);
  const header = el('div', 'property-detail-calendar-header');
  const navButton = (label, className) => {
    const btn = el('button', `property-detail-calendar-nav ${className}`);
    btn.type = 'button';
    btn.setAttribute('aria-label', label);
    return btn;
  };
  const prev = navButton(translate('propertyCalendarPrev'), 'property-detail-calendar-prev');
  const next = navButton(translate('propertyCalendarNext'), 'property-detail-calendar-next');
  const title = el('p', 'property-detail-calendar-title');
  title.id = `${id}-title`;
  title.setAttribute('aria-live', 'polite');
  header.append(prev, title, next);
  const grid = el('table', 'property-detail-calendar-grid');
  grid.setAttribute('role', 'grid');
  grid.setAttribute('aria-labelledby', title.id);
  const head = el('thead');
  const weekdays = el('tr');
  for (let i = 0; i < 7; i += 1) {
    const day = (calendar.firstDay + i) % 7;
    const th = el('th');
    th.scope = 'col';
    th.append(el('span', '', calendar.days[day]));
    th.firstElementChild.setAttribute('aria-hidden', 'true');
    th.append(el('span', 'visually-hidden', dayName(day)));
    weekdays.append(th);
  }
  head.append(weekdays);
  const body = el('tbody');
  grid.append(head, body);
  popup.append(top, header, grid);
  element.append(input, trigger, shown, popup);

  // the day with the grid's tab stop (the chosen one, until the keys move it)
  let active = value;
  const isOpen = () => element.classList.contains('is-open');

  /**
   * Draws the month of the active day.
   * @param {boolean} [focus] Moves the focus onto the active day
   */
  const render = (focus) => {
    const [y, m] = active.split('-').map(Number);
    const first = `${active.slice(0, 7)}-01`;
    title.textContent = calendar.title(y, m - 1, monthName(m - 1));
    prev.disabled = first <= min;
    const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() - calendar.firstDay + 7) % 7;
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const rows = [];
    for (let cell = 0; cell < lead + days; cell += 7) {
      const row = el('tr');
      for (let i = cell; i < cell + 7; i += 1) {
        const td = el('td');
        const day = i - lead + 1;
        if (day >= 1 && day <= days) {
          const date = `${active.slice(0, 7)}-${String(day).padStart(2, '0')}`;
          td.dataset.date = date;
          td.tabIndex = date === active ? 0 : -1;
          td.setAttribute('aria-label', fullDate.format(new Date(`${date}T00:00:00Z`)));
          td.setAttribute('aria-selected', String(date === input.value));
          if (date < min) td.setAttribute('aria-disabled', 'true');
          td.append(el('span', 'property-detail-calendar-day', String(day)));
        }
        row.append(td);
      }
      rows.push(row);
    }
    body.replaceChildren(...rows);
    if (focus) body.querySelector('[tabindex="0"]')?.focus();
  };

  /** Shows the pop-up (on desktop) at the chosen date's month, the focus on the chosen day. */
  const open = () => {
    active = input.value;
    render();
    element.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    body.querySelector('[tabindex="0"]')?.focus();
  };
  /**
   * Hides the pop-up.
   * @param {boolean} [refocus] Puts the focus back on the date
   */
  const hide = (refocus) => {
    if (!isOpen()) return;
    element.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
    if (refocus) trigger.focus();
  };

  /**
   * Chooses a day (not one before `min`).
   * @param {string} date
   */
  const pick = (date) => {
    if (!date || date < min) return;
    const changed = date !== input.value;
    input.value = date;
    active = date;
    trigger.textContent = format(date);
    shown.textContent = format(date);
    if (isOpen()) hide(true);
    else render(true);
    // (a change of the form's field, as any other)
    if (changed) input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  /**
   * Moves the active day (never before `min`), drawing its month when it changes.
   * @param {string} date
   */
  const moveTo = (date) => {
    active = date < min ? min : date;
    render(true);
  };

  trigger.addEventListener('click', () => (isOpen() ? hide() : open()));
  close.addEventListener('click', () => hide(true));
  prev.addEventListener('click', () => {
    active = addMonths(active, -1);
    if (active < min) active = min;
    render();
    // (the button is off at the first month: the focus goes on to Next)
    if (prev.disabled) next.focus();
  });
  next.addEventListener('click', () => {
    active = addMonths(active, 1);
    render();
  });
  body.addEventListener('click', (e) => {
    const td = e.target.closest('td[data-date]');
    if (td && td.getAttribute('aria-disabled') !== 'true') pick(td.dataset.date);
  });
  body.addEventListener('keydown', (e) => {
    const td = e.target.closest('td[data-date]');
    if (!td) return;
    const weekday = (new Date(`${active}T00:00:00Z`).getUTCDay() - calendar.firstDay + 7) % 7;
    const moves = {
      ArrowLeft: () => addDays(active, -1),
      ArrowRight: () => addDays(active, 1),
      ArrowUp: () => addDays(active, -7),
      ArrowDown: () => addDays(active, 7),
      Home: () => addDays(active, -weekday),
      End: () => addDays(active, 6 - weekday),
      PageUp: () => addMonths(active, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(active, e.shiftKey ? 12 : 1),
    };
    if (moves[e.key]) {
      e.preventDefault();
      moveTo(moves[e.key]());
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick(td.dataset.date);
    }
  });
  // the pop-up closes on Escape, a click outside it, or the focus leaving it
  element.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !isOpen()) return;
    // (the key closes only the pop-up, not the dialog around the form)
    e.preventDefault();
    e.stopPropagation();
    hide(true);
  });
  document.addEventListener('pointerdown', (e) => {
    if (isOpen() && !element.contains(e.target)) hide();
  });
  element.addEventListener('focusout', (e) => {
    if (isOpen() && e.relatedTarget && !element.contains(e.relatedTarget)) hide();
  });
  render();

  return {
    element, trigger, input, close: () => hide(),
  };
}
