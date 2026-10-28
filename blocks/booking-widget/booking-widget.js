import apiUrl from '../../scripts/endpoints.js';
import { translate } from '../../scripts/i18n.js';
import buildDatePicker from '../../scripts/date-picker.js';
import {
  DAY_MINUTES, SLOT_MINUTES, chooseSlot, fitGuests, formatDate, readLeadTime, readTimeZone, toTime,
} from '../../scripts/booking.js';
import { el, fetchJson, getApiLanguage } from '../../scripts/properties.js';

// the locations service answers in about 1-4s (a 130KB list, not cached: its nearest airport is
// the visitor's)
const LOCATIONS_TIMEOUT_MS = 15000;
// how long to wait for the header (its menu's city links say where a location's lounges are)
const HEADER_TIMEOUT_MS = 8000;
// the lead time before an airport is chosen: the source's usual one hour
const DEFAULT_LEAD_MINUTES = 60;
// the pause after the last change before the choices are announced (as the source's 500ms)
const ANNOUNCE_DELAY_MS = 500;
// a menu link to a city's lounges ends with its airport codes: "Beijing (PEK/PKX)"
const CITY_CODES = /\(([A-Z0-9]{3,4}(?:\/[A-Z0-9]{3,4})*)\)\s*$/;

let count = 0;
const loads = new Map();

/**
 * Text as the search compares it: lower case, without accents, spaces squeezed.
 * @param {string} value
 * @returns {string}
 */
function toSearch(value) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// the source's search order: a location's airport (name, English name, code), else its city,
// country or region; the first of these that anything matches gives the list
const TIERS = ['airport', 'city', 'country', 'region'];

/**
 * Whether the query starts a word of the text, as the source's search: at the start or after
 * anything but a letter, so "hong" finds Hong Kong but not Zhongshan. A query of two or more
 * words also matches when each of them does ("kong airport").
 * @param {string} text Search text (see toSearch)
 * @param {string} query Search text
 * @returns {boolean}
 */
function matchesWords(text, query) {
  if (!text || !query) return false;
  const starts = (needle) => {
    let i = text.indexOf(needle);
    while (i !== -1) {
      if (i === 0 || !/[a-z]/.test(text[i - 1])) return true;
      i = text.indexOf(needle, i + 1);
    }
    return false;
  };
  if (starts(query)) return true;
  const words = query.split(' ').filter(Boolean);
  return words.length > 1 && words.every(starts);
}

/**
 * The locations for a query, as the source's: all those whose airport matches; if none, all those
 * whose city does ("abuja" → Nnamdi Azikiwe International Airport); then country, then region.
 * @param {Object[]} locations
 * @param {string} query Search text
 * @returns {Object[]}
 */
function searchLocations(locations, query) {
  const tier = TIERS.find((t) => locations.some((loc) => matchesWords(loc.search[t], query)));
  return tier ? locations.filter((loc) => matchesWords(loc.search[tier], query)) : [];
}

/**
 * Resolves once the header has loaded (or after a while, without it).
 * @returns {Promise<void>}
 */
function whenHeaderLoaded() {
  const loaded = () => document.querySelector('header .header')?.dataset.blockStatus === 'loaded';
  if (loaded()) return Promise.resolve();
  return new Promise((resolve) => {
    const started = Date.now();
    const poll = setInterval(() => {
      if (!loaded() && Date.now() - started < HEADER_TIMEOUT_MS) return;
      clearInterval(poll);
      resolve();
    }, 100);
  });
}

/**
 * The city lounge pages by airport code, from the header menu's city links
 * (`[Hong Kong (HKG)](/en-uk/find/china-regions/hong-kong/hong-kong)`).
 * @returns {Promise<Map<string, string>>} code → page path
 */
async function readCityPages() {
  await whenHeaderLoaded();
  const pages = new Map();
  document.querySelectorAll('header a[href]').forEach((link) => {
    const codes = link.textContent.trim().match(CITY_CODES)?.[1];
    if (!codes) return;
    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    codes.split('/').forEach((code) => { if (!pages.has(code)) pages.set(code, url.pathname); });
  });
  return pages;
}

/**
 * The service's text as shown: without invisible characters (a zero-width space ends one name)
 * and with single spaces ("香港国际机场  (HKG)").
 * @param {*} value
 * @returns {string}
 */
function toText(value) {
  return String(value ?? '').replace(/[\u200b-\u200d\ufeff]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * The locations a visitor can search: each airport or station with a city lounge page on this
 * site (the others are left out), named as the source ("Hong Kong International Airport (HKG)"),
 * with its time zone and lead time, sorted by code as the source. Entries without a code or a
 * name are left out, and a repeated code counts once.
 * @param {Object[]} data The locations service's `data`
 * @param {Map<string, string>} pages Code → city page (see readCityPages)
 * @returns {{code: string, label: string, page: string, timeZone: string, lead: number,
 *   search: Object<string, string>}[]} `search`: the texts searched per tier (see TIERS)
 */
function readLocations(data, pages) {
  const seen = new Set();
  return data
    .map((item) => {
      const code = toText(item?.iata || item?.id).toUpperCase();
      // the name in the page's language: `displayName` without its " (HKG)"
      let shown = toText(item?.displayName);
      if (code && shown.endsWith(`(${code})`)) shown = shown.slice(0, -code.length - 2).trim();
      const nameEN = toText(item?.nameEn);
      const name = shown || nameEN;
      if (!code || !name || seen.has(code) || item.status === 'Inactive') return null;
      seen.add(code);
      const lead = Number.parseFloat(item.maxLeadTime);
      return {
        code,
        label: `${name} (${code})`,
        name,
        nameEN,
        // ARPRT (airport) or RLWYSTN (railway station), when the service gives it
        type: toText(item.locationTypeCode),
        page: pages.get(code),
        timeZone: readTimeZone(item.timezone),
        // (hours; 0: none)
        lead: Number.isFinite(lead) ? readLeadTime(lead) : DEFAULT_LEAD_MINUTES,
        search: {
          airport: toSearch(`${name} ${nameEN} ${code}`),
          city: toSearch(`${toText(item.city)} ${toText(item.cityEn)}`),
          country: toSearch(`${toText(item.country)} ${toText(item.countryEn)}`),
          // (a name, or for some regions their code only, e.g. CH)
          region: toSearch(`${toText(item.region)} ${toText(item.regionCode)}`),
        },
      };
    })
    .filter((loc) => loc?.page)
    .sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * The airport nearest the visitor, as the service found it from their position (`defaultOption`),
 * or null when it couldn't (none, no code, inactive).
 * @param {Object} json The locations service's answer
 * @returns {{code: string, type: string}|null}
 */
function readNearest(json) {
  const option = json?.defaultOption;
  const code = toText(option?.iataCode).toUpperCase();
  if (!code || option.status === 'Inactive') return null;
  return { code, type: toText(option.locationTypeCode) };
}

/**
 * The locations in the page's language and the visitor's nearest one (when it's one of them),
 * loaded once per page (every widget on it shares them). A failed load is forgotten, so Try
 * again asks again; an answer without locations is a failure.
 * @returns {Promise<{locations: Object[], nearest: Object|null}>}
 */
function loadLocations() {
  const language = getApiLanguage();
  if (!loads.has(language)) {
    const url = apiUrl('geoLocation');
    url.searchParams.set('languageCode', language);
    const load = Promise.all([fetchJson(url, LOCATIONS_TIMEOUT_MS), readCityPages()])
      .then(([json, pages]) => {
        if (!Array.isArray(json?.data) || !json.data.length) throw new Error('no locations in the answer');
        const locations = readLocations(json.data, pages);
        const found = readNearest(json);
        const nearest = found && locations.find((loc) => loc.code === found.code);
        // (the station rule of the lounge card: the nearest one's type, until `data` has them)
        if (nearest && !nearest.type) nearest.type = found.type;
        return { locations, nearest: nearest || null };
      })
      .catch((error) => {
        loads.delete(language);
        throw error;
      });
    loads.set(language, load);
  }
  return loads.get(language);
}

/**
 * A labelled field of the form.
 * @param {string} className
 * @param {string} label
 * @param {HTMLElement[]} controls
 * @returns {{wrap: HTMLElement, label: HTMLElement}}
 */
function field(className, label, ...controls) {
  const wrap = el('div', `booking-widget-field ${className}`);
  const text = el('label', 'booking-widget-label', label);
  wrap.append(text, ...controls);
  return { wrap, label: text };
}

/**
 * Where: a search box over the locations, as the source's (the list opens on focus, filters as
 * the visitor types, and says when nothing matches). A combobox: the arrow keys move through the
 * list, Enter chooses, Escape closes. Only a chosen location counts; typing again forgets it.
 * @param {string} id
 * @param {Function} onPick Called with the chosen location
 * @returns {Object}
 */
function buildWhere(id, onPick) {
  const input = el('input', 'booking-widget-where-input');
  input.type = 'text';
  input.id = `${id}-where`;
  input.name = 'where';
  input.placeholder = translate('bookingWherePlaceholder');
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  const panel = el('div', 'booking-widget-where-panel');
  panel.hidden = true;
  const list = el('ul', 'booking-widget-options');
  list.id = `${id}-where-list`;
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', translate('bookingWhere'));
  input.setAttribute('aria-controls', list.id);
  const status = el('p', 'booking-widget-where-status');
  status.setAttribute('role', 'status');
  panel.append(list, status);
  const error = el('p', 'booking-widget-error');
  error.id = `${id}-where-error`;
  error.setAttribute('aria-live', 'polite');
  const { wrap, label } = field('booking-widget-where', translate('bookingWhere'), input, panel, error);
  label.htmlFor = input.id;

  let locations = null;
  let failed = false;
  let chosen = null;
  // whether the visitor (or a script) has typed or chosen: the nearest airport is then left out
  let touched = false;
  let shown = [];
  let active = -1;

  const isOpen = () => !panel.hidden;
  const setActive = (index) => {
    active = index;
    [...list.children].forEach((option, i) => option.classList.toggle('is-active', i === index));
    const option = list.children[index];
    if (option) {
      input.setAttribute('aria-activedescendant', option.id);
      // (scrolls only the list, not the page)
      const top = option.offsetTop;
      if (top < list.scrollTop) list.scrollTop = top;
      else if (top + option.offsetHeight > list.scrollTop + list.clientHeight) {
        list.scrollTop = top + option.offsetHeight - list.clientHeight;
      }
    } else input.removeAttribute('aria-activedescendant');
  };

  /** Draws the list for what's typed: everything while the box shows the chosen location. */
  const render = () => {
    status.replaceChildren();
    if (failed) {
      list.replaceChildren();
      shown = [];
      const again = el('button', 'booking-widget-retry', translate('propertyRetry'));
      again.type = 'button';
      again.addEventListener('click', () => {
        failed = false;
        // eslint-disable-next-line no-use-before-define
        load();
        render();
        input.focus();
      });
      status.append(translate('bookingLocationsError'), ' ', again);
      return;
    }
    if (!locations) {
      list.replaceChildren();
      shown = [];
      status.textContent = translate('propertyLoading');
      return;
    }
    const query = toSearch(input.value);
    const all = !query || (chosen && input.value === chosen.label);
    shown = all ? locations : searchLocations(locations, query);
    list.replaceChildren(...shown.map((loc) => {
      const option = el('li', 'booking-widget-option', loc.label);
      option.id = `${list.id}-${loc.code}`;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(loc === chosen));
      return option;
    }));
    if (!shown.length) status.textContent = translate('bookingNoMatch', { query: input.value.trim() });
    setActive(chosen ? shown.indexOf(chosen) : -1);
  };

  const open = () => {
    render();
    panel.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };
  const close = () => {
    panel.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  };

  const showError = (on) => {
    error.textContent = on ? translate('bookingSelectAirport') : '';
    if (on) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', error.id);
    } else {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }
  };

  const pick = (loc) => {
    touched = true;
    chosen = loc;
    input.value = loc.label;
    showError(false);
    close();
    onPick(loc);
  };

  /**
   * Starts loading the locations (once), redrawing an open list when they arrive. The visitor's
   * nearest airport is chosen then, as the source's, unless the visitor has typed or chosen, or
   * is in the box (the list they opened stays open).
   */
  const load = () => {
    loadLocations().then((answer) => {
      ({ locations } = answer);
      if (answer.nearest && !touched && document.activeElement !== input) pick(answer.nearest);
      else if (isOpen()) render();
    }).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('booking-widget: could not load the locations', err);
      failed = true;
      if (isOpen()) render();
    });
  };

  input.addEventListener('focus', () => { load(); open(); });
  input.addEventListener('click', () => { if (!isOpen()) open(); });
  input.addEventListener('input', () => {
    touched = true;
    if (chosen && input.value !== chosen.label) chosen = null;
    showError(false);
    open();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen()) open();
      if (!shown.length) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive(Math.min(shown.length - 1, Math.max(0, active + step)));
    } else if (e.key === 'Enter' && isOpen()) {
      // the highlighted location, or the only one that matches; else the form's submit goes on
      const loc = shown[active] || (shown.length === 1 ? shown[0] : null);
      if (loc) {
        e.preventDefault();
        pick(loc);
      }
    } else if (e.key === 'Escape' && isOpen()) {
      // (the key closes only the list, not a dialog around the form)
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') close();
  });
  // a click on a location (or Try again) keeps the focus in the box (else the list would close)
  panel.addEventListener('pointerdown', (e) => e.preventDefault());
  list.addEventListener('click', (e) => {
    const option = e.target.closest('[role="option"]');
    if (option) pick(shown[[...list.children].indexOf(option)]);
  });
  input.addEventListener('blur', () => {
    // a location typed out in full (its name, English name or code) counts as chosen
    if (!chosen && locations) {
      const typed = toSearch(input.value);
      const exact = (loc) => [loc.label, loc.name, loc.nameEN, loc.code]
        .some((text) => text && toSearch(text) === typed);
      const match = typed && locations.filter(exact);
      if (match?.length === 1) pick(match[0]);
    }
    close();
  });

  /**
   * Chooses the location with this code, once the locations are in (nothing when it isn't one).
   * @param {string} code e.g. HKG
   * @returns {Promise<boolean>} whether it was chosen
   */
  const pickCode = async (code) => {
    // (asked for: the nearest airport no longer applies)
    touched = true;
    try {
      ({ locations } = await loadLocations());
    } catch {
      return false;
    }
    const loc = locations.find((l) => l.code === String(code || '').trim().toUpperCase());
    if (loc) pick(loc);
    return !!loc;
  };

  return {
    element: wrap, input, load, showError, chosen: () => chosen, pickCode,
  };
}

/**
 * Time: the half-hour start times as the source's list (0000 to 2330 with "hrs"); times before
 * the first bookable one are unavailable. A button opens the list (a listbox: the arrow keys,
 * Home and End move, Enter or Space choose, Escape closes).
 * @param {string} id
 * @param {Function} [onChange] Called when the visitor chooses another time
 * @returns {Object}
 */
function buildTime(id, onChange = () => {}) {
  const input = el('input');
  input.type = 'hidden';
  input.name = 'time';
  const button = el('button', 'booking-widget-time-text');
  button.type = 'button';
  button.id = `${id}-time`;
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');
  const value = el('span', 'booking-widget-time-value');
  button.append(value, el('span', 'booking-widget-time-unit', translate('propertyHours')));
  const list = el('ul', 'booking-widget-times');
  list.id = `${id}-times`;
  list.setAttribute('role', 'listbox');
  // (a tab stop while open: the list scrolls)
  list.tabIndex = 0;
  list.hidden = true;
  button.setAttribute('aria-controls', list.id);
  for (let m = 0; m < DAY_MINUTES; m += SLOT_MINUTES) {
    const option = el('li', 'booking-widget-time-option', toTime(m));
    option.id = `${list.id}-${toTime(m)}`;
    option.dataset.value = toTime(m);
    option.setAttribute('role', 'option');
    list.append(option);
  }
  const { wrap, label } = field('booking-widget-time', translate('propertyTime'), input, button, list);
  label.id = `${id}-time-label`;
  label.htmlFor = button.id;
  button.setAttribute('aria-labelledby', `${label.id} ${button.id}`);
  list.setAttribute('aria-labelledby', label.id);

  const options = [...list.children];
  const enabled = () => options.filter((o) => o.getAttribute('aria-disabled') !== 'true');
  let active = null;
  const setActive = (option) => {
    active = option;
    options.forEach((o) => o.classList.toggle('is-active', o === option));
    if (!option) return;
    list.setAttribute('aria-activedescendant', option.id);
    const top = option.offsetTop - (list.clientHeight - option.offsetHeight) / 2;
    list.scrollTop = Math.max(0, top);
  };
  const set = (time) => {
    input.value = time;
    value.textContent = time;
    options.forEach((o) => o.setAttribute('aria-selected', String(o.dataset.value === time)));
  };
  const close = (refocus) => {
    if (list.hidden) return;
    list.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (refocus) button.focus();
  };
  const open = () => {
    list.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    setActive(options.find((o) => o.dataset.value === input.value) || enabled()[0]);
    list.focus();
  };
  const choose = (option) => {
    if (!option || option.getAttribute('aria-disabled') === 'true') return;
    const changed = option.dataset.value !== input.value;
    set(option.dataset.value);
    close(true);
    if (changed) onChange();
  };

  button.addEventListener('click', () => (list.hidden ? open() : close()));
  list.addEventListener('click', (e) => choose(e.target.closest('[role="option"]')));
  list.addEventListener('keydown', (e) => {
    const on = enabled();
    const at = on.indexOf(active);
    const moves = {
      ArrowDown: () => on[Math.min(on.length - 1, at + 1)],
      ArrowUp: () => on[Math.max(0, at - 1)],
      Home: () => on[0],
      End: () => on[on.length - 1],
    };
    if (moves[e.key]) {
      e.preventDefault();
      setActive(moves[e.key]());
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(active);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === 'Tab') close();
  });
  list.addEventListener('focusout', (e) => { if (!wrap.contains(e.relatedTarget)) close(); });
  document.addEventListener('pointerdown', (e) => { if (!wrap.contains(e.target)) close(); });

  /**
   * Marks the times before the first bookable one (on that day) unavailable, keeping the chosen
   * time when it's still bookable, else the first one that is.
   * @param {string} keep HHmm
   * @param {number|null} earliest The first bookable minute, or null for the whole day
   */
  const fill = (keep, earliest) => {
    options.forEach((o) => {
      const [h, m] = [o.dataset.value.slice(0, 2), o.dataset.value.slice(2)].map(Number);
      o.setAttribute('aria-disabled', String(earliest !== null && h * 60 + m < earliest));
    });
    const kept = enabled().find((o) => o.dataset.value === keep);
    set((kept || enabled()[0])?.dataset.value || keep);
  };

  return {
    element: wrap, input, fill, close,
  };
}

/**
 * A number field with minus and plus buttons (adults, children), as the lounge page's.
 * @param {string} name
 * @param {string} group The label, for the buttons' names
 * @param {number} value
 * @param {number} min
 * @returns {HTMLElement}
 */
function counter(name, group, value, min) {
  const wrap = el('div', 'booking-widget-counter');
  const input = el('input');
  input.type = 'number';
  input.name = name;
  input.min = min;
  input.value = value;
  input.inputMode = 'numeric';
  const step = (delta, label, className, text) => {
    const btn = el('button', className, text);
    btn.type = 'button';
    btn.setAttribute('aria-label', label);
    btn.addEventListener('click', () => {
      const now = Number.parseInt(input.value, 10) || min;
      const next = Math.min(Number(input.max), Math.max(min, now + delta));
      if (next === Number(input.value)) return;
      input.value = next;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    return btn;
  };
  wrap.append(
    step(-1, translate('propertyFewer', { group }), 'booking-widget-step booking-widget-step-minus', '-'),
    input,
    step(1, translate('propertyMoreOf', { group }), 'booking-widget-step booking-widget-step-plus', '+'),
  );
  return wrap;
}

/**
 * Guests, as the lounge page's: at least one adult, up to two children per adult, nine in all.
 * @param {string} id
 * @returns {{element: HTMLElement, fix: Function}}
 */
function buildGuests(id) {
  const group = el('fieldset', 'booking-widget-guests');
  const legend = el('legend', 'booking-widget-guests-title', translate('bookingGuests'));
  const adultsLabel = translate('propertyAdults');
  const childrenLabel = translate('propertyChildren');
  const adults = field('booking-widget-adults', adultsLabel, counter('adult', adultsLabel, 1, 1));
  const children = field('booking-widget-children', childrenLabel, counter('children', childrenLabel, 0, 0));
  children.label.append(el('span', 'booking-widget-label-note', translate('propertyChildNote')));
  [[adults, 'adults'], [children, 'children']].forEach(([f, name]) => {
    const input = f.wrap.querySelector('input');
    input.id = `${id}-${name}`;
    f.label.htmlFor = input.id;
  });
  group.append(legend, adults.wrap, children.wrap);

  const a = adults.wrap.querySelector('input');
  const c = children.wrap.querySelector('input');
  const read = (input, fallback) => {
    const n = Number.parseInt(input.value, 10);
    return Number.isFinite(n) ? n : fallback;
  };
  /**
   * Keeps the counts within the limits, with each field's `max` and its buttons' state.
   * @param {string} [changed] `adult` or `children`, the count the visitor changed
   */
  const fix = (changed) => {
    const fit = fitGuests(read(a, 1), read(c, 0), changed === 'adult' ? 'adults' : changed);
    if (a.value !== String(fit.adults)) a.value = fit.adults;
    if (c.value !== String(fit.children)) c.value = fit.children;
    a.max = fit.maxAdults;
    c.max = fit.maxChildren;
    [[a, fit.adults], [c, fit.children]].forEach(([input, n]) => {
      const wrap = input.closest('.booking-widget-counter');
      wrap.querySelector('.booking-widget-step-minus').setAttribute('aria-disabled', String(n <= Number(input.min)));
      wrap.querySelector('.booking-widget-step-plus').setAttribute('aria-disabled', String(n >= Number(input.max)));
    });
  };
  [a, c].forEach((input) => {
    input.addEventListener('input', () => { if (input.value !== '') fix(input.name); });
    input.addEventListener('change', () => fix(input.name));
  });
  fix();
  return { element: group, fix };
}

/**
 * Decorates the Booking Widget: the source's booking search (the homepage hero and Book Now).
 * Where, date, time and guests, then a search that opens the city's lounges on this site with the
 * choices in the address (`?airport=HKG&date=2026-10-30&time=1600&adult=2&children=1`). One form
 * for every place it's used: in a dialog (Book Now) it's marked `in-modal`, and the styles lay it
 * out (a bar, a card on phones, or the dialog's stacked form). The block has no rows; the
 * locations come from the locations service, in the page's language, with the airport nearest
 * the visitor, which is chosen for them.
 *
 * The choices are announced (`booking-widget:change`, half a second after the last change, with
 * the location, date, time, guests and the search address), and a script can choose a location
 * (`booking-widget:set-location` with `detail.airport`). Option `lounge-card` (the homepage hero
 * adds it) shows the first bookable lounge of the chosen airport under the form (see
 * booking-widget-lounge-card.js).
 * @param {Element} block
 */
export default function decorate(block) {
  count += 1;
  const id = `booking-widget-${count}`;
  const inModal = !!block.closest('.section[data-modal], dialog');
  block.classList.toggle('in-modal', inModal);

  const form = el('form', 'booking-widget-form');
  form.noValidate = true;
  form.setAttribute('aria-label', translate(inModal ? 'bookingBookNow' : 'bookingSearch'));

  let slot = chooseSlot({}, undefined, DEFAULT_LEAD_MINUTES);
  let place = { timeZone: undefined, lead: DEFAULT_LEAD_MINUTES };

  const picker = buildDatePicker({
    name: 'date', value: slot.date, min: slot.firstDay, format: formatDate, prefix: 'booking-widget',
  });
  const date = field('booking-widget-date', translate('propertyDate'), picker.element);
  date.label.id = `${picker.trigger.id}-label`;
  date.label.htmlFor = picker.trigger.id;
  picker.trigger.setAttribute('aria-labelledby', `${date.label.id} ${picker.trigger.id}`);

  // the first bookable slot at the chosen place (its time zone and lead time), keeping the
  // visitor's date and time when they're still bookable
  // (the change announcement, see below)
  let announce = () => {};
  const time = buildTime(id, () => announce());
  const refresh = () => {
    const asked = { date: picker.input.value, time: time.input.value };
    slot = chooseSlot(asked, place.timeZone, place.lead);
    picker.update({ value: slot.date, min: slot.firstDay });
    time.fill(slot.time, slot.date === slot.firstDay ? slot.earliest : null);
  };
  time.fill(slot.time, slot.earliest);
  picker.input.addEventListener('change', () => {
    refresh();
    announce();
  });

  const where = buildWhere(id, (loc) => {
    place = loc;
    refresh();
    announce();
  });
  const guests = buildGuests(id);
  guests.element.addEventListener('change', () => announce());

  const when = el('div', 'booking-widget-when');
  when.append(date.wrap, time.element);
  const fields = el('div', 'booking-widget-fields');
  fields.append(where.element, when, guests.element);

  const submit = el('button', 'booking-widget-submit');
  submit.type = 'submit';
  const action = translate(inModal ? 'bookingBookNow' : 'bookingSearch');
  submit.append(el('span', 'booking-widget-submit-label', action));
  form.append(fields, submit);

  // the locations load when the visitor first comes to the form (not with the page)
  const start = () => where.load();
  ['pointerover', 'focusin', 'touchstart'].forEach((type) => form.addEventListener(type, start, { once: true, passive: true }));
  // outside a dialog (the homepage hero), once the page has loaded, so the visitor's nearest
  // airport is chosen without them (the Book Now dialog's form chooses it when they come to it)
  if (!inModal) {
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
  }

  /**
   * The visitor's choices and the search address (the city page with them), or null without a
   * chosen location.
   * @returns {Object|null}
   */
  const current = () => {
    const loc = where.chosen();
    if (!loc) return null;
    const data = new FormData(form);
    const choice = {
      airport: loc.code,
      date: data.get('date'),
      time: data.get('time'),
      adult: data.get('adult'),
      children: data.get('children'),
    };
    const url = new URL(loc.page, window.location.origin);
    Object.entries(choice).forEach(([key, value]) => url.searchParams.set(key, value));
    return {
      ...choice, location: loc, url: url.href,
    };
  };

  // the choices, half a second after the last change (as the source's results)
  let timer;
  announce = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const detail = current();
      if (detail) block.dispatchEvent(new CustomEvent('booking-widget:change', { bubbles: true, detail }));
    }, ANNOUNCE_DELAY_MS);
  };
  block.addEventListener('booking-widget:set-location', (e) => where.pickCode(e.detail?.airport));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!where.chosen()) {
      where.showError(true);
      where.input.focus();
      return;
    }
    refresh();
    guests.fix();
    const { location, ...detail } = current();
    // other scripts can take the search over (e.g. results in place) by cancelling the event
    const event = new CustomEvent('booking-widget:search', { bubbles: true, cancelable: true, detail });
    if (block.dispatchEvent(event)) window.location.assign(detail.url);
  });

  block.replaceChildren(form);

  // the homepage hero's lounge card (not in Book Now)
  if (block.classList.contains('lounge-card') && !inModal) {
    import('./booking-widget-lounge-card.js')
      .then((mod) => mod.default(block, { current }))
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error('booking-widget: the lounge card did not load', error);
      });
  }
}
