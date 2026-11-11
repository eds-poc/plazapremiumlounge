/**
 * The Property Filter block: lounges by Region, Country and City, as the source offer pages'
 * lounge widget (#offerLoungeBookingWidgetForm). The authored table: rows of name | codes,
 * `Region`, `Country`, `IATA` and `Property` (codes comma-separated), the property filter
 * service's payload (scripts/property-filter.js). The region tabs, then Country
 * and City (two selects and Search below 992px; a list of countries opening to their cities from
 * 992px), offer every region, country and city of the service's answer (region names from the
 * site's translations), and the chosen city's lounges are shown; the first region,
 * country and city are chosen when the page opens, and the choice is kept in the page address
 * (?region=ep&country=it&city=fco).
 */
import { translate } from '../../scripts/i18n.js';
import {
  buildPropertyCard, loadPropertyCardStyles, readSignupButton, readViewButton,
} from '../../scripts/property-card.js';
import { fetchFilteredProperties, hasFilters, readFilters } from '../../scripts/property-filter.js';
import {
  el, isPreview, propertyDetailPath, toKey,
} from '../../scripts/properties.js';

// the address's parameters for the choice
const PARAMS = ['region', 'country', 'city'];

// the cards' button rows (as the Property List's): View, and the sign-up link on the loyalty line
const VIEW_ROW = 'view-button';
const SIGNUP_ROW = 'signup-button';

// the loading skeleton: how many of each part it outlines, and a card's lines, top to bottom
const SKELETON = {
  regions: 2, selects: 2, countries: 6, services: 3, cards: 2,
};
const SKELETON_CARD = ['badge', 'name', 'line', 'line', 'tags', 'price'];

// the rows' names (any of them; capitals, spaces and hyphens don't matter) and the payload's lists
const ROWS = {
  region: ['region', 'regions', 'region-code', 'region-codes'],
  country: ['country', 'countries', 'country-code', 'country-codes'],
  iataCode: ['iata', 'iata-code', 'iata-codes', 'airport', 'airports'],
  propertyCode: ['property', 'properties', 'property-code', 'property-codes'],
};
// what a code looks like, per list (the others are left out, with a note on preview pages), and
// the list's name in the notes
const CODE = {
  region: [/^[A-Z]{2}$/, 'a region'],
  country: [/^[A-Z]{2}$/, 'a country'],
  iataCode: [/^[A-Z0-9]{3,4}$/, 'an IATA'],
  propertyCode: [/^[A-Z0-9_-]+$/, 'a property'],
};

let blockCount = 0;

/**
 * A cell's text with its lines (paragraphs, list items, line breaks) as commas.
 * @param {HTMLElement} cell
 * @returns {string}
 */
function cellText(cell) {
  const copy = cell.cloneNode(true);
  copy.querySelectorAll('br').forEach((br) => br.replaceWith(','));
  copy.querySelectorAll('p, li').forEach((line) => line.append(','));
  return copy.textContent;
}

/**
 * The authored settings, rows of name | value:
 * - `filters`: the property filter service's payload (see scripts/property-filter.js
 *   readFilters): `region`, `country`, `iataCode` and `propertyCode`, each a list of codes;
 * - `view`: the cards' View button (`view-button`: a link to the lounge page, its text the label,
 *   or plain text for the language folder's lounge page), else View to that page;
 * - `signup`: the sign-up link at the end of the cards' loyalty line (`signup-button`), or null;
 * - `notes`: what couldn't be used (unknown rows, codes that don't look like codes), for preview.
 * @param {HTMLElement} block
 * @returns {{filters: Object<string, string[]>, view: Object, signup: Object|null,
 *   notes: string[]}}
 */
export function readSettings(block) {
  const notes = [];
  const lists = {};
  let view = null;
  let signup = null;
  [...block.children].forEach((row) => {
    const [name, value] = [...row.children];
    if (!name || !value) return;
    const key = toKey(name.textContent);
    if (!key) return;
    if (key === VIEW_ROW) {
      view = readViewButton(value, 'property-filter');
      return;
    }
    if (key === SIGNUP_ROW) {
      signup = readSignupButton(value);
      return;
    }
    const list = Object.keys(ROWS).find((l) => ROWS[l].includes(key));
    if (!list) {
      notes.push(`row "${name.textContent.trim()}" isn't one the block knows (Region, Country, IATA, Property, View button, Signup button)`);
      return;
    }
    // codes separated by commas, semicolons, spaces or lines
    const codes = readFilters({ [list]: cellText(value).split(/[,;\s]+/) })[list];
    const [pattern, what] = CODE[list];
    const wrong = codes.filter((code) => !pattern.test(code));
    if (wrong.length) notes.push(`${name.textContent.trim()}: "${wrong.join('", "')}" left out (not ${what} code)`);
    lists[list] = [...(lists[list] || []), ...codes.filter((code) => pattern.test(code))];
  });
  const filters = readFilters(lists);
  if (!hasFilters(filters)) notes.push('no Region, Country, IATA or Property codes: at least one row is needed');
  return {
    filters,
    view: view || { label: translate('propertyFilterView'), base: propertyDetailPath(), params: {} },
    signup,
    notes,
  };
}

/**
 * What can be chosen: the regions, countries and cities of the lounges, each city with its
 * airports' codes and its lounges, all as the property filter service places them: the region by
 * its code (named by the site's translations, `region<CODE>`, else the code), the country by its
 * code and name, the city by its code (the same for a city's airports: GBLHR for Heathrow and
 * Gatwick) and name. Regions are in the authored Region row's order (the others after),
 * countries and cities by name; a city's airports start with the one its code is named after
 * (London: LHR / LGW), then by code.
 * @param {Object[]} properties The lounges (scripts/property-filter.js)
 * @param {string[]} regionOrder The authored region codes
 * @returns {Object[]} regions: {code, name, countries: {code, name, cities: {key, name, codes,
 *   label, properties}[]}[]}
 */
function readChoices(properties, regionOrder = []) {
  const regions = new Map();
  properties.forEach((property) => {
    const { region: regionCode, country: countryCode } = property;
    if (!regionCode || !countryCode) return;
    const cityKey = property.cityCode || `${countryCode}-${toKey(property.city || property.iata)}`;
    if (!regions.has(regionCode)) {
      regions.set(regionCode, {
        code: regionCode,
        name: translate(`region${regionCode}`) || regionCode,
        countries: new Map(),
      });
    }
    const region = regions.get(regionCode);
    if (!region.countries.has(countryCode)) {
      region.countries.set(countryCode, {
        code: countryCode, name: property.countryName || countryCode, cities: new Map(),
      });
    }
    const country = region.countries.get(countryCode);
    if (!country.cities.has(cityKey)) {
      country.cities.set(cityKey, {
        key: cityKey, name: property.city || property.iata, codes: [], properties: [],
      });
    }
    const city = country.cities.get(cityKey);
    city.properties.push(property);
    if (property.iata && !city.codes.includes(property.iata)) city.codes.push(property.iata);
  });

  const byName = (a, b) => a.name.localeCompare(b.name, document.documentElement.lang || undefined);
  // (a region not in the authored order goes after those that are)
  const rank = (code) => {
    const at = regionOrder.indexOf(code);
    return at < 0 ? regionOrder.length : at;
  };
  return [...regions.values()]
    .map((region) => ({
      ...region,
      countries: [...region.countries.values()].map((country) => ({
        ...country,
        cities: [...country.cities.values()].map((city) => {
          // (the airport the city's code is named after first: GBLHR, LHR)
          const main = (code) => (city.key.endsWith(code) ? 0 : 1);
          city.codes.sort((a, b) => main(a) - main(b) || a.localeCompare(b));
          const label = city.codes.length ? `${city.name} (${city.codes.join(' / ')})` : city.name;
          return { ...city, label };
        }).sort(byName),
      })).sort(byName),
    }))
    .sort((a, b) => rank(a.code) - rank(b.code) || byName(a, b));
}

/**
 * The choice in the page address (?region=ep&country=it&city=fco: the city by one of its airport
 * codes), else the first region, its first country and that country's first city; a code that
 * isn't offered gives the first of its level.
 * @param {Object[]} regions
 * @returns {{region: Object, country: Object, city: Object}}
 */
function readChoice(regions) {
  const params = new URLSearchParams(window.location.search);
  const want = (name) => (params.get(name) || '').trim().toUpperCase();
  const region = regions.find((r) => r.code === want('region')) || regions[0];
  const country = region.countries.find((c) => c.code === want('country')) || region.countries[0];
  const city = country.cities.find((c) => c.codes.includes(want('city'))) || country.cities[0];
  return { region, country, city };
}

/**
 * Puts the choice in the page address, without a new history entry.
 * @param {{region: Object, country: Object, city: Object}} choice
 */
function writeChoice({ region, country, city }) {
  const url = new URL(window.location.href);
  const values = [region.code, country.code, city.codes[0] || toKey(city.name)];
  PARAMS.forEach((name, i) => url.searchParams.set(name, values[i].toLowerCase()));
  if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url);
}

/**
 * The region tabs: a tablist (the arrows, Home and End move between them, choosing).
 * @param {Object[]} regions
 * @param {string} prefix
 * @param {function(Object): void} onChoose Called with the region chosen
 * @returns {{element: HTMLElement, show: function(Object): void}}
 */
function buildRegionTabs(regions, prefix, onChoose) {
  const list = el('div', 'property-filter-regions');
  list.setAttribute('role', 'tablist');
  list.setAttribute('aria-label', translate('propertyFilterRegions'));
  const tabs = regions.map((region) => {
    const tab = el('button', 'property-filter-region', region.name);
    tab.type = 'button';
    tab.id = `${prefix}-region-${toKey(region.code)}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', `${prefix}-panel`);
    tab.addEventListener('click', () => {
      if (tab.getAttribute('aria-selected') !== 'true') onChoose(region);
    });
    list.append(tab);
    return tab;
  });
  list.addEventListener('keydown', (e) => {
    const index = tabs.indexOf(document.activeElement);
    const moves = {
      ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1,
    };
    if (index < 0 || !(e.key in moves)) return;
    e.preventDefault();
    const next = (moves[e.key] + tabs.length) % tabs.length;
    tabs[next].focus();
    if (tabs[next].getAttribute('aria-selected') !== 'true') onChoose(regions[next]);
  });
  const show = (region) => tabs.forEach((tab, i) => {
    const selected = regions[i] === region;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  return { element: list, show };
}

/**
 * Below 992px: the Country and City selects and Search, as the source's. Choosing a country
 * offers its cities ("Select City" first); Search shows the chosen city (the country's first when
 * none is chosen).
 * @param {string} prefix
 * @param {function(Object, Object|null): void} onSearch Called with the country and city
 * @returns {{element: HTMLElement, show: function(Object): void}}
 */
function buildSelects(prefix, onSearch) {
  const form = el('form', 'property-filter-selects');
  const select = (name, label) => {
    const control = el('select', `property-filter-select property-filter-select-${name}`);
    control.id = `${prefix}-${name}`;
    control.setAttribute('aria-label', label);
    return control;
  };
  const countrySelect = select('country', translate('propertyFilterCountry'));
  const citySelect = select('city', translate('propertyFilterCity'));
  const search = el('button', 'property-filter-search');
  search.type = 'submit';
  search.setAttribute('aria-label', translate('propertyFilterSearch'));
  const icon = el('span', 'property-filter-search-icon');
  icon.setAttribute('aria-hidden', 'true');
  search.append(icon);
  form.append(countrySelect, citySelect, search);
  let region = null;
  const option = (value, text, selected = false) => {
    const o = el('option', '', text);
    o.value = value;
    o.selected = selected;
    return o;
  };
  const fillCities = (country, city = null) => {
    citySelect.replaceChildren(option('', translate('propertyFilterCity')), ...(country?.cities || [])
      .map((c) => option(c.key, c.label, c === city)));
  };
  countrySelect.addEventListener('change', () => {
    fillCities(region.countries.find((c) => c.code === countrySelect.value) || null);
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const country = region.countries.find((c) => c.code === countrySelect.value);
    if (!country) return;
    onSearch(country, country.cities.find((c) => c.key === citySelect.value) || null);
  });
  const show = (choice) => {
    ({ region } = choice);
    countrySelect.replaceChildren(option('', translate('propertyFilterCountry')), ...region.countries
      .map((c) => option(c.code, c.name, c === choice.country)));
    fillCities(choice.country, choice.city);
  };
  return { element: form, show };
}

/**
 * From 992px: the region's countries, each opening to its cities; choosing a city shows it. The
 * list is built once per region: a choice in the same region only opens the chosen city's country
 * and marks the city, so the countries the visitor opened stay open and focus stays put.
 * @param {string} prefix
 * @param {function(Object, Object): void} onChoose Called with the country and city
 * @returns {{element: HTMLElement, show: function(Object): void}}
 */
function buildCountryList(prefix, onChoose) {
  const nav = el('nav', 'property-filter-countries');
  nav.setAttribute('aria-label', translate('propertyFilterCountries'));
  let region = null;
  let items = [];
  const expand = (item, open) => {
    item.toggle.setAttribute('aria-expanded', String(open));
    item.cities.hidden = !open;
  };
  const build = (country) => {
    const element = el('div', 'property-filter-country');
    const heading = el('h2', 'property-filter-country-title');
    const toggle = el('button', 'property-filter-country-toggle', country.name);
    toggle.type = 'button';
    const listId = `${prefix}-cities-${toKey(country.code)}`;
    toggle.setAttribute('aria-controls', listId);
    heading.append(toggle);
    const cities = el('ul', 'property-filter-cities');
    cities.id = listId;
    const links = country.cities.map((city) => {
      const li = el('li');
      const button = el('button', 'property-filter-city-link', city.label);
      button.type = 'button';
      button.addEventListener('click', () => onChoose(country, city));
      li.append(button);
      cities.append(li);
      return { city, button };
    });
    element.append(heading, cities);
    const item = {
      country, element, toggle, cities, links,
    };
    toggle.addEventListener('click', () => expand(item, toggle.getAttribute('aria-expanded') !== 'true'));
    return item;
  };
  const show = (choice) => {
    if (choice.region !== region) {
      ({ region } = choice);
      items = region.countries.map(build);
      nav.replaceChildren(...items.map((item) => item.element));
      items.forEach((item) => expand(item, false));
    }
    const chosen = items.find((item) => item.country === choice.country);
    if (chosen) expand(chosen, true);
    items.forEach((item) => item.links.forEach(({ city, button }) => {
      if (city === choice.city) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    }));
  };
  return { element: nav, show };
}

/**
 * An airport's service tabs, as the source's: All, then each service its lounges offer, by the
 * service's type (servicetype: LOUNGE, SHOWER, NAPROOM) and named as the service names it in the
 * page's language (serviceDisplayName), in the order the lounges list them. Toggle buttons, the
 * chosen one pressed, showing only the cards whose lounge offers it. None when the lounges offer
 * no service.
 * @param {{property: Object, card: HTMLElement}[]} cards The airport's lounges and their cards
 * @returns {HTMLElement|null}
 */
function buildServiceTabs(cards) {
  const tabs = [];
  cards.forEach(({ property }) => property.services.forEach(({ key, label }) => {
    if (!tabs.some((tab) => tab.key === key)) tabs.push({ key, label });
  }));
  if (!tabs.length) return null;
  const offers = (property, key) => property.services.some((service) => service.key === key);
  const group = el('div', 'property-filter-services');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', translate('propertyFilterServices'));
  const buttons = [{ key: '', label: translate('propertyAll') }, ...tabs].map(({ key, label }) => {
    const button = el('button', 'property-filter-service', label);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(!key));
    button.addEventListener('click', () => {
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      cards.forEach(({ property, card }) => { card.hidden = !!key && !offers(property, key); });
    });
    return button;
  });
  group.append(...buttons);
  return group;
}

/**
 * The chosen city's lounges, by airport: its name and code, its service tabs, then
 * its cards (the shared cards, with the authored View button and sign-up link).
 * @param {HTMLElement} listing
 * @param {Object} city
 * @param {{view: Object, signup: Object|null}} settings
 * @param {string} prefix
 */
function renderListing(listing, city, { view, signup }, prefix) {
  const airports = new Map();
  city.properties.forEach((p) => {
    const key = p.location.key || p.iata;
    if (!airports.has(key)) airports.set(key, { heading: p.location.heading, items: [] });
    airports.get(key).items.push(p);
  });
  let n = 0;
  listing.replaceChildren(...[...airports.values()].map((airport) => {
    const group = el('section', 'property-filter-airport');
    if (airport.heading) group.append(el('h2', 'property-filter-airport-title', airport.heading));
    const list = el('ul', 'property-filter-cards');
    const cards = airport.items
      .sort((a, b) => a.seq - b.seq || a.name.localeCompare(b.name))
      .map((property) => {
        const card = buildPropertyCard(property, {
          id: `${prefix}-card-${n}`, eager: n === 0, view, signup, rank: n + 1,
        });
        n += 1;
        return { property, card };
      });
    list.append(...cards.map(({ card }) => card));
    const tabs = buildServiceTabs(cards);
    if (tabs) group.append(tabs);
    group.append(list);
    return group;
  }));
}

/**
 * A message instead of the filters and lounges (nothing to show, or the lounges didn't load), with
 * Try again for a failure.
 * @param {HTMLElement} block
 * @param {string} text
 * @param {function(): void} [retry]
 */
function showMessage(block, text, retry) {
  const box = el('div', 'property-filter-message');
  box.setAttribute('role', 'status');
  box.append(el('p', '', text));
  if (retry) {
    const button = el('button', 'button', translate('propertyRetry'));
    button.type = 'button';
    button.addEventListener('click', retry);
    box.append(button);
  }
  block.replaceChildren(box);
}

/**
 * While the lounges load: a shimmering outline of the filters and two cards, in the block's own
 * layout (the selects below 992px, the countries beside the cards from 992px), so the page keeps
 * its shape and the filters take its place without a jump. Hidden from screen readers, which
 * hear the loading message instead.
 * @returns {HTMLElement[]}
 */
function buildSkeleton() {
  const bones = (n, kind, tag = 'span') => Array.from({ length: n }, () => el(tag, `property-filter-bone property-filter-bone-${kind}`));
  const outline = el('div', 'property-filter-skeleton');
  outline.setAttribute('aria-hidden', 'true');
  const regions = el('div', 'property-filter-regions');
  regions.append(...bones(SKELETON.regions, 'region'));
  const selects = el('div', 'property-filter-selects');
  selects.append(...bones(SKELETON.selects, 'select'), ...bones(1, 'search'));
  const countries = el('div', 'property-filter-countries');
  countries.append(...bones(SKELETON.countries, 'country'));
  const listing = el('div', 'property-filter-listing');
  const services = el('div', 'property-filter-services');
  services.append(...bones(SKELETON.services, 'service'));
  const cards = Array.from({ length: SKELETON.cards }, () => {
    const card = el('div', 'property-filter-skeleton-card');
    const body = el('div', 'property-filter-skeleton-body');
    body.append(...SKELETON_CARD.map((kind) => bones(1, kind)[0]));
    card.append(bones(1, 'photo', 'div')[0], body);
    return card;
  });
  listing.append(...bones(1, 'title'), services, ...cards);
  const layout = el('div', 'property-filter-layout');
  layout.append(countries, listing);
  outline.append(regions, selects, layout);
  return [outline, el('p', 'visually-hidden', translate('propertyLoading'))];
}

/**
 * Loads the lounges (a skeleton meanwhile), then builds the filters and shows the chosen city's
 * lounges; a failure shows a message with Try again.
 * @param {HTMLElement} block
 * @param {Object} settings
 * @param {string} prefix
 */
async function load(block, settings, prefix) {
  block.setAttribute('aria-busy', 'true');
  block.replaceChildren(...buildSkeleton());
  // (without their stylesheet the cards show unstyled, never the lounges unloaded)
  const cardStyles = loadPropertyCardStyles().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('property-filter: the card styles did not load', error);
  });
  let properties;
  try {
    [{ properties }] = await Promise.all([fetchFilteredProperties(settings.filters), cardStyles]);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`property-filter: the lounges didn't load (${error.kind || error.message})`, error);
    showMessage(block, translate('propertyError'), () => load(block, settings, prefix));
    return;
  } finally {
    block.removeAttribute('aria-busy');
  }
  const regions = readChoices(properties, settings.filters.region);
  if (!regions.length) {
    showMessage(block, translate('propertyEmpty'));
    return;
  }

  const panel = el('div', 'property-filter-panel');
  panel.id = `${prefix}-panel`;
  panel.setAttribute('role', 'tabpanel');
  const listing = el('div', 'property-filter-listing');
  // what the choice shows, said to screen readers (not the whole listing)
  const status = el('p', 'visually-hidden');
  status.setAttribute('role', 'status');
  let choice;
  // the filters (each calls apply, which shows the choice in all of them)
  const filters = {};
  const apply = (next) => {
    choice = next;
    filters.tabs.show(choice.region);
    panel.setAttribute('aria-labelledby', `${prefix}-region-${toKey(choice.region.code)}`);
    filters.selects.show(choice);
    filters.countries.show(choice);
    renderListing(listing, choice.city, settings, prefix);
    status.textContent = translate('propertyFilterStatus', {
      n: choice.city.properties.length, city: choice.city.label,
    });
    writeChoice(choice);
    block.dataset.region = choice.region.code;
    block.dataset.city = choice.city.codes[0] || '';
  };
  filters.tabs = buildRegionTabs(regions, prefix, (region) => apply({
    region, country: region.countries[0], city: region.countries[0].cities[0],
  }));
  filters.selects = buildSelects(prefix, (country, city) => apply({
    region: choice.region, country, city: city || country.cities[0],
  }));
  filters.countries = buildCountryList(prefix, (country, city) => apply({
    region: choice.region, country, city,
  }));
  const layout = el('div', 'property-filter-layout');
  layout.append(filters.countries.element, listing);
  panel.append(filters.selects.element, layout, status);
  block.replaceChildren(filters.tabs.element, panel);
  apply(readChoice(regions));
}

/**
 * Decorates the Property Filter block from its table (see readSettings). The lounges load in the
 * background: the page doesn't wait for them.
 * @param {HTMLElement} block
 */
export default function decorate(block) {
  const settings = readSettings(block);
  blockCount += 1;
  const prefix = `property-filter-${blockCount}`;
  block.replaceChildren();
  if (isPreview()) {
    // eslint-disable-next-line no-console
    settings.notes.forEach((note) => console.warn(`property-filter: ${note}`));
  }
  if (!hasFilters(settings.filters)) {
    showMessage(block, translate('propertyEmpty'));
    return;
  }
  load(block, settings, prefix).catch((error) => {
    // eslint-disable-next-line no-console
    console.error('property-filter: could not show the lounges', error);
  });
}
