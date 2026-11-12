import { loadCSS } from '../../scripts/aem.js';
// eslint-disable-next-line import/no-cycle
import {
  PAGE_VIEW, pushEvent, setPageDetails,
} from '../../scripts/datalayer.js';
import {
  BRAND, chosenVisit, listLabel, pushEcommerce, viewSource,
} from '../../scripts/ecommerce.js';
import apiUrl from '../../scripts/endpoints.js';
import { getLanguage, translate } from '../../scripts/i18n.js';
import {
  buildPropertyCard, loadPropertyCardStyles, readSignupButton, readViewButton,
} from '../../scripts/property-card.js';
import {
  el, fetchJson, getApiLanguage, isPreview, readProperty, setLoading, toKey,
} from '../../scripts/properties.js';
import { toUtcDateTime } from '../../scripts/utility.js';

const TIMEOUT_MS = 8000;
const MOBILE = '(width < 768px)';
const GROUPS = ['airport', 'service', 'feature'];

let blockCount = 0;

/**
 * The breadcrumb, as the source city pages: "Home < Lounges in {country}", both as text (the
 * source links neither). The country is the API's first item's `countryName`; without one, Home
 * alone. Built with the Breadcrumb block's classes, so its stylesheet (breadcrumb.css) applies.
 * @param {HTMLElement} crumb The breadcrumb's element (its content is replaced)
 * @param {string} [country]
 */
function drawCrumb(crumb, country = '') {
  const nav = el('nav');
  nav.setAttribute('aria-label', translate('breadcrumb'));
  const list = el('ol', 'breadcrumb-list');
  const name = (country || '').trim();
  const labels = [translate('propertyCrumbHome'), ...(name ? [translate('propertyCrumbCountry', { country: name })] : [])];
  labels.forEach((label, i) => {
    const li = el('li', 'breadcrumb-item', label);
    if (i === labels.length - 1) li.setAttribute('aria-current', 'page');
    list.append(li);
  });
  nav.append(list);
  crumb.replaceChildren(nav);
}

/**
 * Fetches the properties. Gives up after 8s.
 * @param {string} url
 * @returns {Promise<{items: Object[], count: number}>} the API's items and its `count`
 */
async function fetchProperties(url) {
  const json = await fetchJson(url, TIMEOUT_MS);
  if (!Array.isArray(json.items)) throw new Error('Unexpected response');
  return { items: json.items, count: json.count };
}

/**
 * The filter options found in the properties: airports (by location), service types and features,
 * each without duplicates or empty values.
 * @param {Object[]} properties
 * @returns {Object<string, {key: string, label: string}[]>}
 */
function readOptions(properties) {
  const collect = (list) => [
    ...new Map(list.filter((o) => o.key && o.label).map((o) => [o.key, o])).values(),
  ];
  const lounges = properties.filter((p) => !p.pass);
  const features = collect(properties.flatMap((p) => p.features));
  features.sort((a, b) => a.label.localeCompare(b.label, getLanguage()));
  return {
    airport: collect(lounges.map((p) => ({ key: p.location.key, label: p.location.name }))),
    service: collect(properties.flatMap((p) => p.services)),
    feature: features,
  };
}

/**
 * Whether a property matches the selected filters: within a group any selected option matches;
 * every group with a selection must match.
 * @param {Object} property
 * @param {Object<string, Set<string>>} selected
 * @returns {boolean}
 */
function matches(property, selected) {
  const values = {
    airport: [property.location.key],
    service: property.services.map((s) => s.key),
    feature: property.features.map((f) => f.key),
  };
  return GROUPS.every((group) => !selected[group].size
    || values[group].some((key) => selected[group].has(key)));
}

/**
 * The page's name and site section in the data layer, for every event on a lounge listing:
 * "<city>:listing" in "listing".
 * @param {string} city The API's `cityName` (e.g. Beijing), else the page's last path part
 */
function setListingPage(city) {
  if (city) setPageDetails({ pageName: `${city}:listing`, siteSection: 'listing' });
}

/**
 * The booking chosen in the page address (the home page search sends
 * ?date=2026-11-10&time=1700&adult=1&children=0): the start at the place in UTC
 * ("2026-11-10T09:00:00Z" in Beijing), else null; the adults and the children.
 * @param {string} timeZone The place's time zone
 * @returns {{checkin: string|null, adults: number, children: number}} checkin as
 *   YYYY-MM-DDTHH:MM:SSZ
 */
function chosenBooking(timeZone) {
  const params = new URLSearchParams(window.location.search);
  const date = params.get('date');
  const time = params.get('time');
  return {
    checkin: date && time ? toUtcDateTime(date, time, timeZone) : null,
    adults: Number(params.get('adult')),
    children: Number(params.get('children')),
  };
}

/**
 * The data layer's page view for the listing ("page load", sent here instead of by
 * scripts/datalayer.js on a listing page, see initDataLayer): the API's `count` as the search
 * results; the booking chosen in the page address (`date` and `time` at the airport in UTC, else
 * null; `adult` and `children`); and the airport chosen there (?airport=PKX), else
 * the first lounge's: its `iataCode` and `locationName`.
 * @param {Object[]} properties
 * @param {Object<string, Set<string>>} selected The filters from the page address
 * @param {number} count The API's `count`
 */
function trackListingView(properties, selected, count) {
  const eventName = 'page load';
  const lounges = properties.filter((p) => !p.pass);
  const chosen = selected.airport.size === 1
    && lounges.find((p) => selected.airport.has(p.location.key));
  const place = chosen || lounges[0] || properties[0];
  const { checkin, adults, children } = chosenBooking(place.timeZone);
  pushEvent(PAGE_VIEW, eventName, {
    _plazapremiumloungemanagementli: {
      searchDetails: { searchResultsCount: count },
      bookingInfo: {
        checkinDateTime: checkin,
        daysToBooking: 0,
        totalGuestCount: adults + children,
        adultCount: adults,
        childCount: children,
      },
      locationDetails: { iataCode: place.iata, locationName: place.location.name },
    },
  });
}

/**
 * The GA4 `view_item_list` for the listing (window.dataLayer, scripts/ecommerce.js): the lounges
 * shown (not the passes), in their order. The list is named after the city ("Mega Menu - Beijing",
 * "Other - Beijing"); from the home page search widget, after its airport ("HP Search Widget - JFK"
 * as the id, "HP Search Widget - John F. Kennedy International Airport" as the name).
 * @param {Object[]} properties
 * @param {Object<string, Set<string>>} selected The filters from the page address
 */
function trackItemList(properties, selected) {
  // eslint-disable-next-line no-use-before-define
  const shown = groupProperties(properties.filter((p) => !p.pass && matches(p, selected)))
    .flatMap((group) => group.items);
  if (!shown.length) return;
  const source = viewSource();
  const airport = source === 'hp_search_widget_click' && selected.airport.size === 1
    ? shown.find((p) => selected.airport.has(p.location.key)) : null;
  const city = shown.find((p) => p.city)?.city || '';
  const listId = listLabel(source, airport ? airport.iata : city);
  const listName = listLabel(source, airport ? airport.location.name : city);
  pushEcommerce('view_item_list', {
    // the first lounge's own currency
    currency: shown[0].currency,
    item_list_id: listId,
    item_list_name: listName,
    view_source: source,
    items: shown.map((p, i) => {
      const visit = chosenVisit(p.timeZone);
      return {
        item_id: p.code,
        item_name: p.shortLocation ? `${p.name} (${p.shortLocation})` : p.name,
        coupon: '',
        discount: '',
        index: i + 1,
        item_brand: BRAND,
        // the product's display name: the listing has none
        item_category: '',
        // the airport or station with its code, e.g. Beijing Daxing International Airport (PKX)
        item_category2: p.iata ? `${p.location.name} (${p.iata})` : p.location.name,
        item_category3: p.name,
        item_category4: p.city,
        item_category5: p.country,
        item_list_id: listId,
        item_list_name: listName,
        // the lowest price, "" without one
        price: p.price ? p.price.amount : '',
        quantity: visit.total_guest_count,
        ...visit,
      };
    }),
  });
}

/**
 * The data layer's link click for a card's View now: the lounge, its position in the list, its
 * airport or station, and a booking that isn't chosen yet (now, no guests).
 * @param {Object} property
 * @param {number} rank The card's position in the list as shown (1 for the first)
 */
function trackViewLounge(property, rank) {
  const eventName = 'view lounge';
  pushEvent('web.webInteraction.linkClicks', eventName, {
    web: { webInteraction: { name: eventName, type: 'other', linkClicks: { value: 1 } } },
    _plazapremiumloungemanagementli: {
      searchDetails: { searchClickRank: rank },
      bookingInfo: {
        propertyCurrencyCode: property.currency,
        // now, as ISO 8601 UTC without milliseconds (2026-11-05T11:20:30Z)
        checkinDateTime: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        daysToBooking: 0,
        totalGuestCount: 0,
        adultCount: 0,
        childCount: 0,
      },
      locationDetails: { iataCode: property.iata, locationName: property.location.name },
      outletDetails: { outletId: property.outletId, outletName: property.name },
    },
  });
}

/**
 * The data layer's link click for a filter ticked or unticked in the filter form, or for its
 * Clear ("apply filter"): every filter now on ([] when none), each with its group's title
 * (`.property-list-group-title`) and its option's label (Service Type's All, which is no filter,
 * left out); the API's `count` as the search results; the booking chosen in the page address;
 * and the airport filtered on (only one), else the first lounge shown: its `iataCode` and
 * `locationName`.
 * @param {HTMLFormElement} form The filter form (`.property-list-filters`)
 * @param {Object[]} properties
 * @param {Object<string, Set<string>>} selected The filters now on
 * @param {number} count The API's `count`
 */
function trackFilters(form, properties, selected, count) {
  const shown = properties.filter((p) => matches(p, selected));
  const lounges = properties.filter((p) => !p.pass);
  const chosen = selected.airport.size === 1
    && lounges.find((p) => selected.airport.has(p.location.key));
  const place = chosen || shown.find((p) => !p.pass) || lounges[0] || properties[0];
  const { checkin, adults, children } = chosenBooking(place.timeZone);
  const filters = [...form.querySelectorAll('input[data-group]:checked')]
    .filter((input) => input.value)
    .map((input) => ({
      filterType: input.closest('.property-list-group')
        ?.querySelector('.property-list-group-title > span')?.textContent.trim() || '',
      filterValue: input.closest('.property-list-option')?.textContent.trim() || '',
    }));
  const eventName = 'apply filter';
  pushEvent('web.webInteraction.linkClicks', eventName, {
    web: { webInteraction: { name: eventName, type: 'other', linkClicks: { value: 1 } } },
    _plazapremiumloungemanagementli: {
      searchDetails: { searchResultsCount: count },
      filters,
      bookingInfo: {
        checkinDateTime: checkin,
        daysToBooking: 0,
        totalGuestCount: adults + children,
        adultCount: adults,
        childCount: children,
      },
      locationDetails: { iataCode: place.iata, locationName: place.location.name },
    },
  });
}

/**
 * The selected filters from the page address (e.g. ?airport=hkg&feature=wi-fi,bar), keeping only
 * options that exist.
 * @param {Object} options
 * @returns {Object<string, Set<string>>}
 */
function readSelection(options, useUrl) {
  const params = new URLSearchParams(useUrl ? window.location.search : '');
  return Object.fromEntries(GROUPS.map((group) => {
    const known = new Set(options[group].map((o) => o.key));
    // any case, as the keys are made (the home page search widget's links say ?airport=JFK)
    const keys = (params.get(group) || '').split(',').map(toKey).filter((k) => known.has(k));
    return [group, new Set(keys)];
  }));
}

/**
 * Writes the selected filters into the page address without reloading or adding history entries.
 * @param {Object<string, Set<string>>} selected
 */
function writeSelection(selected) {
  const url = new URL(window.location.href);
  GROUPS.forEach((group) => {
    if (selected[group].size) url.searchParams.set(group, [...selected[group]].join(','));
    else url.searchParams.delete(group);
  });
  // (commas kept readable, e.g. ?feature=wi-fi,bar)
  url.search = url.searchParams.toString().replace(/%2C/gi, ',');
  window.history.replaceState(window.history.state, '', url);
}

/**
 * The filter form: one group per filter with at least two options (airport, service, features),
 * each option a checkbox; Service Type also has All (no service chosen); Clear resets everything.
 * @param {Object} options
 * @param {Object<string, Set<string>>} selected
 * @param {Function} onChange
 * @returns {HTMLFormElement|null} null when there's nothing to filter
 */
function buildFilters(options, selected, onChange) {
  const titles = { airport: 'propertyAirport', service: 'propertyService', feature: 'propertyFeatures' };
  const groups = GROUPS.filter((group) => options[group].length > 1);
  if (!groups.length) return null;
  // (unnamed, so not a landmark; each group is a labelled fieldset)
  const form = el('form', 'property-list-filters');
  form.addEventListener('submit', (e) => e.preventDefault());
  const clear = el('button', 'property-list-clear', translate('propertyClear'));
  clear.type = 'button';
  const sync = () => {
    form.querySelectorAll('input[data-group]').forEach((input) => {
      input.checked = input.value === '' ? !selected[input.dataset.group].size
        : selected[input.dataset.group].has(input.value);
    });
  };
  const option = (group, key, label) => {
    const wrap = el('label', 'property-list-option');
    const input = el('input');
    input.type = 'checkbox';
    input.value = key;
    input.dataset.group = group;
    input.addEventListener('change', () => {
      if (key === '') selected[group].clear();
      else if (input.checked) selected[group].add(key);
      else selected[group].delete(key);
      sync();
      onChange();
    });
    wrap.append(input, el('span', '', label));
    return wrap;
  };
  groups.forEach((group, i) => {
    const fieldset = el('fieldset', 'property-list-group');
    const legend = el('legend', 'property-list-group-title');
    legend.append(el('span', '', translate(titles[group])));
    // the source's Clear pill sits at the right of the first group title
    if (i === 0) legend.append(clear);
    fieldset.append(legend);
    if (group === 'service') fieldset.append(option(group, '', translate('propertyAll')));
    options[group].forEach((o) => fieldset.append(option(group, o.key, o.label)));
    form.append(fieldset);
  });
  clear.addEventListener('click', () => {
    GROUPS.forEach((group) => selected[group].clear());
    sync();
    onChange();
  });
  sync();
  return form;
}

/**
 * The properties as the listing shows them: the location groups in order, each with its cards in
 * order, then the passes.
 * @param {Object[]} shown
 * @returns {{heading: string, items: Object[]}[]}
 */
function groupProperties(shown) {
  const groups = new Map();
  shown.filter((p) => !p.pass).forEach((p) => {
    if (!groups.has(p.location.key)) groups.set(p.location.key, { ...p.location, items: [] });
    groups.get(p.location.key).items.push(p);
  });
  const ordered = [...groups.values()].sort((a, b) => a.seq - b.seq);
  const passes = shown.filter((p) => p.pass);
  if (passes.length) ordered.push({ heading: '', items: passes });
  ordered.forEach((group) => group.items.sort((a, b) => a.seq - b.seq));
  return ordered;
}

/**
 * Renders the listing: the location groups with their cards, then the passes; the result count
 * for screen readers; the empty message (with Clear when filters are on).
 * @param {HTMLElement} results
 * @param {Object[]} properties
 * @param {Object<string, Set<string>>} selected
 * @param {HTMLElement} status
 * @param {Function} onClear
 */
function renderResults(results, properties, selected, status, onClear, prefix, settings) {
  const shown = properties.filter((p) => matches(p, selected));
  const ordered = groupProperties(shown);
  let n = 0;
  const sections = ordered.map((group) => {
    const section = el('section', 'property-list-location');
    if (group.heading) section.append(el('h2', 'property-list-heading', group.heading));
    const list = el('ul', 'property-list-cards');
    group.items.forEach((p) => {
      list.append(buildPropertyCard(p, {
        id: `${prefix}-${n}`,
        eager: n === 0,
        view: settings.view,
        signup: settings.signup,
        rank: n + 1,
        onView: trackViewLounge,
      }));
      n += 1;
    });
    section.append(list);
    return section;
  });
  if (!shown.length) {
    const empty = el('div', 'property-list-message');
    const filtered = GROUPS.some((group) => selected[group].size);
    empty.append(el('p', '', translate(filtered ? 'propertyNoMatch' : 'propertyEmpty')));
    if (filtered) {
      const clear = el('button', 'button secondary', translate('propertyClear'));
      clear.type = 'button';
      clear.addEventListener('click', onClear);
      empty.append(clear);
    }
    sections.push(empty);
  }
  results.replaceChildren(...sections);
  status.textContent = translate('propertyResults', { n: shown.length });
}

/**
 * Shows a message in the listing: an error (with Try again) or, on the preview site, a setup hint.
 * @param {HTMLElement} results
 * @param {string} text
 * @param {Function} [retry]
 * @param {string} [hint] Shown on the preview site only
 */
function showMessage(results, text, retry, hint) {
  const box = el('div', 'property-list-message');
  box.setAttribute('role', 'alert');
  box.append(el('p', '', text));
  if (hint && isPreview()) box.append(el('p', 'property-list-hint', hint));
  if (retry) {
    const again = el('button', 'button secondary', translate('propertyRetry'));
    again.type = 'button';
    again.addEventListener('click', retry);
    box.append(again);
  }
  results.replaceChildren(box);
}

/**
 * The authored settings: rows of name | value, `city-code` (e.g. HKHKG), `view-button` (a link,
 * e.g. [View now](/en-uk/find/lounge), or plain text) and `signup-button` (a link, e.g.
 * [Join here](…)); names ignore capitals and spaces. A table with a single value is read as the
 * city code.
 * @param {HTMLElement} block
 * @returns {{city: string, view: Object|null, signup: {href: string, label: string}|null}}
 */
function readSettings(block) {
  const rows = [...block.children].map((row) => [...row.children]);
  const settings = { city: '', view: null, signup: null };
  const pairs = rows.filter((cells) => cells.length >= 2);
  if (!pairs.length) {
    settings.city = block.textContent.trim().replace(/\s+/g, '').toUpperCase();
    return settings;
  }
  pairs.forEach(([name, value]) => {
    const key = toKey(name.textContent);
    if (key === 'city-code') settings.city = value.textContent.trim().replace(/\s+/g, '').toUpperCase();
    if (key === 'view-button') settings.view = readViewButton(value, 'property-list');
    if (key === 'signup-button') settings.signup = readSignupButton(value);
  });
  return settings;
}

/**
 * Decorates the property list block: the authored city code (e.g. HKHKG) is all it needs (plus an
 * optional sign-up link for the loyalty line). The API address comes from scripts/endpoints.js
 * (the API domain + the `properties` path), the language from the page's site folder (or the
 * page metadata `language-code`); the block fetches the city's properties and renders them in
 * location groups, with filters (airport, service type, features). The first property list on a
 * page keeps its filters in the page address (others keep them to themselves) and shows the
 * breadcrumb above the filters and cards ("Home < Lounges in {country}", see drawCrumb).
 * @param {HTMLElement} block The property list block element
 */
export default async function decorate(block) {
  const settings = readSettings(block);
  const { city } = settings;
  // the cards' stylesheet, loading while the lounges are asked for
  const cardStyles = loadPropertyCardStyles();
  blockCount += 1;
  const prefix = `property-list-${blockCount}`;
  const useUrl = blockCount === 1;
  const layout = el('div', 'property-list-layout');
  // (not a landmark: several lists on a page would repeat the same one)
  const sidebar = el('div', 'property-list-sidebar');
  const main = el('div', 'property-list-main');
  const toggle = el('button', 'property-list-toggle', translate('propertyFilters'));
  toggle.type = 'button';
  toggle.hidden = true;
  const status = el('p', 'property-list-status visually-hidden');
  status.setAttribute('aria-live', 'polite');
  const results = el('div', 'property-list-results');
  main.append(status, results);
  layout.append(sidebar, main);
  // the first list's breadcrumb (Home straight away, the country once the lounges arrive), above
  // the filters and cards; the phones' Filters button above it, as the source
  const crumb = useUrl ? el('div', 'breadcrumb') : null;
  // the data layer's page name for the listing: the page's last path part until the API's city
  // name arrives (the first list on the page)
  if (useUrl) setListingPage(window.location.pathname.split('/').filter(Boolean).pop());
  if (crumb) {
    // (a missing stylesheet leaves the breadcrumb unstyled, never the lounges unloaded)
    await loadCSS(`${window.hlx.codeBasePath}/blocks/breadcrumb/breadcrumb.css`).catch((error) => {
      // eslint-disable-next-line no-console
      console.error('property-list: the breadcrumb styles did not load', error);
    });
    drawCrumb(crumb);
  }
  block.replaceChildren(...[toggle, crumb, layout].filter(Boolean));

  const dialog = el('dialog', 'property-list-dialog');
  dialog.setAttribute('aria-label', translate('propertyFilters'));
  const close = el('button', 'property-list-dialog-close');
  close.type = 'button';
  close.setAttribute('aria-label', translate('close'));
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  dialog.append(close);
  block.append(dialog);

  let load;
  // the Kwanko listing tag went out (once a page, not on a retry)
  let tagged = false;
  const render = async () => {
    if (!city) {
      showMessage(results, translate('propertyEmpty'), null, 'Add a "city-code" row (e.g. city-code | HKHKG) in the block.');
      return;
    }
    const url = apiUrl('properties');
    url.searchParams.set('cityCode', city);
    url.searchParams.set('languageCode', getApiLanguage());
    let items;
    let count;
    try {
      ({ items, count } = await fetchProperties(url.href));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('property-list: could not load', url.href, error);
      if (crumb) drawCrumb(crumb);
      showMessage(results, translate('propertyError'), () => load());
      return;
    }
    if (crumb) drawCrumb(crumb, items[0]?.countryName);
    if (useUrl) setListingPage((items.find((item) => item.cityName)?.cityName || '').trim());
    const properties = items.map(readProperty).filter(Boolean);
    if (!properties.length) {
      showMessage(results, translate('propertyEmpty'), null, `City code "${city}" returned no lounges.`);
      return;
    }
    // (cards without their stylesheet would show unstyled, then move: wait for it; a missing one
    // leaves them unstyled, never the lounges unloaded)
    await cardStyles.catch((error) => {
      // eslint-disable-next-line no-console
      console.error('property-list: the card styles did not load', error);
    });
    const options = readOptions(properties);
    const selected = readSelection(options, useUrl);
    let form = null;
    const clearAll = () => form?.querySelector('.property-list-clear')?.click();
    const update = () => {
      if (useUrl) writeSelection(selected);
      renderResults(results, properties, selected, status, clearAll, prefix, settings);
    };
    form = buildFilters(options, selected, update);
    sidebar.replaceChildren();
    if (form) {
      // the form sits in the sidebar, or in the Filters dialog on phones
      const mobile = window.matchMedia(MOBILE);
      const place = () => {
        if (mobile.matches) dialog.append(form);
        else {
          if (dialog.open) dialog.close();
          sidebar.append(form);
        }
        toggle.hidden = !mobile.matches;
      };
      mobile.addEventListener('change', place);
      place();
      toggle.onclick = () => dialog.showModal();
    }
    layout.classList.toggle('no-filters', !form);
    renderResults(results, properties, selected, status, clearAll, prefix, settings);
    // the Kwanko listing tag: all the city's property codes, in the listing's order (once a page;
    // the tag waits for Kwanko UniJS, which loads with the other tags)
    if (!tagged) {
      tagged = true;
      const codes = groupProperties(properties).flatMap((group) => group.items.map((p) => p.code));
      import('../../scripts/kwanko.js').then(({ listingTag }) => listingTag(codes));
      // the GA4 view_item_list, for the first list on the page
      if (useUrl) trackItemList(properties, selected);
      // the data layer's page view, for the first list on the page
      if (useUrl) trackListingView(properties, selected, count);
    }
    // the data layer's "apply filter" as a filter is ticked or unticked, or Clear removes them all
    // (the listing has redrawn by then: the form's own listeners run first)
    form?.addEventListener('change', (e) => {
      if (e.target.matches('input[data-group]')) trackFilters(form, properties, selected, count);
    });
    form?.querySelector('.property-list-clear')
      ?.addEventListener('click', () => trackFilters(form, properties, selected, count));
  };
  // the page's loader stays up until the lounges are shown (the first load is awaited, so the
  // page doesn't hide its loader before)
  load = async () => {
    setLoading(true);
    try {
      await render();
    } finally {
      setLoading(false);
    }
  };
  await load();
}
