// The Book Now block: authored on pages (injected into the served HTML), it opens the same Book Now
// dialog as the header, with an optional airport; without the dialog on the page, no button.
import { open, PW } from './harness.mjs';

const { chromium } = await import(PW);
const browser = await chromium.launch();
let failed = 0;
const check = (name, ok, info = '') => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info ? ` — ${info}` : ''}`); };

const block = (classes, rows = []) => `<div class="book-now${classes ? ` ${classes}` : ''}">${rows.map(([a, b]) => `<div><div>${a}</div>${b === undefined ? '' : `<div>${b}</div>`}</div>`).join('')}</div>`;

/**
 * Opens a page with Book Now blocks in a new section (first or last in main).
 * @param {string} path
 * @param {string} blocks HTML
 * @param {{first?: boolean, width?: number, noDialog?: boolean}} opts
 */
async function page(path, blocks, { first = false, width = 1440, noDialog = false } = {}) {
  return open(browser, {
    width,
    path,
    extraRoute: async (p) => {
      await p.route(new RegExp(`localhost:3000${path.replace(/\//g, '\\/')}(\\?.*)?$`), async (route) => {
        const resp = await route.fetch();
        let html = await resp.text();
        const section = `<div>${blocks}</div>`;
        html = first ? html.replace('<main>', `<main>${section}`) : html.replace('</main>', `${section}</main>`);
        await route.fulfill({ response: resp, body: html, headers: { ...resp.headers(), 'content-type': 'text/html; charset=utf-8' } });
      });
      if (noDialog) {
        await p.route(/\/nav\.plain\.html/, async (route) => {
          const resp = await route.fetch();
          const body = (await resp.text()).replace(/<div data-modal="book-now"[\s\S]*?<\/div>\s*(?=<div data-modal="cart")/, '');
          await route.fulfill({ response: resp, body });
        });
      }
    },
  });
}
const buttons = (p) => p.evaluate(() => [...document.querySelectorAll('main .book-now')].map((b) => {
  const a = b.querySelector('a.button');
  return a ? {
    text: a.textContent, cls: a.className, href: a.getAttribute('href'), popup: a.getAttribute('aria-haspopup'), hint: b.querySelector('.book-now-hint')?.textContent || '',
  } : { none: true, hint: b.querySelector('.book-now-hint')?.textContent || '' };
}));
const dialogState = (p) => p.evaluate(() => {
  const d = document.querySelector('dialog.modal[open]');
  return d && {
    title: d.querySelector('h2')?.textContent.trim(),
    widget: !!d.querySelector('.booking-widget.in-modal .booking-widget-where-input'),
    where: d.querySelector('.booking-widget-where-input')?.value || '',
    dialogs: document.querySelectorAll('dialog.modal .booking-widget').length,
  };
});
const closeDialog = async (p) => {
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  if (await p.locator('dialog.modal[open]').count()) await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
};

// 1. options, labels, hints, same dialog as the header, focus back, airport preselect
{
  const p = await page('/en-uk/airport-lounge-passes', [
    block('', []),
    block('outline large', [['label', 'Book your lounge']]),
    block('', [['airport', 'HKG']]),
    block('', [['Airport', 'DXB']]),
    block('', [['airport', 'hk!']]),
  ].join(''));
  await p.waitForTimeout(1500);
  const b = await buttons(p);
  check('default: primary "Book Now" to #book-now, opens a dialog', b[0].text === 'Book Now' && /button primary/.test(b[0].cls) && b[0].href === '#book-now' && b[0].popup === 'dialog', JSON.stringify(b[0]));
  check('options + label: outline (secondary) large "Book your lounge"', b[1].text === 'Book your lounge' && /secondary/.test(b[1].cls) && /large/.test(b[1].cls), b[1].cls);
  check('malformed airport: ignored, preview hint', /isn't an airport code/.test(b[4].hint) && b[4].text === 'Book Now', b[4].hint);

  await p.locator('main .book-now a.button').nth(0).click();
  await p.waitForSelector('dialog.modal[open] .booking-widget-where-input', { timeout: 15000 });
  await p.waitForTimeout(2500);
  const d0 = await dialogState(p);
  check('block opens the Book Now dialog with its widget', d0?.title === 'Book Your Visit' && d0.widget, JSON.stringify(d0));
  await closeDialog(p);
  const focusBack = await p.evaluate(() => document.activeElement?.closest('.book-now') === document.querySelectorAll('main .book-now')[0]);
  check('Escape closes; focus back on the block\'s button', !(await p.locator('dialog.modal[open]').count()) && focusBack);

  await p.locator('header a[href$="#book-now"]:visible').first().click();
  await p.waitForSelector('dialog.modal[open]', { timeout: 15000 });
  const dh = await dialogState(p);
  check('header Book Now opens the same dialog (one widget instance)', dh?.dialogs === 1 && dh.title === 'Book Your Visit', JSON.stringify(dh));
  await closeDialog(p);

  await p.locator('main .book-now a.button').nth(2).click();
  await p.waitForSelector('dialog.modal[open]', { timeout: 15000 });
  await p.waitForFunction(() => /\(HKG\)$/.test(document.querySelector('dialog.modal[open] .booking-widget-where-input')?.value || ''), null, { timeout: 20000 }).catch(() => {});
  const dk = await dialogState(p);
  check('airport HKG: the dialog opens with HKG chosen', /\(HKG\)$/.test(dk?.where || ''), dk?.where);
  // the search flow from there
  const url = await p.evaluate(() => new Promise((resolve) => {
    const w = document.querySelector('dialog.modal[open] .booking-widget');
    w.addEventListener('booking-widget:search', (e) => { e.preventDefault(); resolve(e.detail.url); }, { once: true });
    const submit = w.querySelector('.booking-widget-submit');
    const go = () => (submit.disabled ? setTimeout(go, 200) : submit.click());
    go();
  }));
  check('search from it → the Hong Kong city page with the airport', /\/en-uk\/find\/china-regions\/hong-kong\/hong-kong\?airport=HKG/.test(url), url.slice(0, 100));
  await closeDialog(p);

  await p.locator('main .book-now a.button').nth(3).click();
  await p.waitForSelector('dialog.modal[open]', { timeout: 15000 });
  await p.waitForFunction(() => /\(DXB\)$/.test(document.querySelector('dialog.modal[open] .booking-widget-where-input')?.value || ''), null, { timeout: 20000 }).catch(() => {});
  const dd = await dialogState(p);
  check('another block, airport DXB (row name "Airport"): DXB chosen', /\(DXB\)$/.test(dd?.where || ''), dd?.where);
  await closeDialog(p);
  check('no page errors', !p.errors.length, p.errors.join(' | ').slice(0, 200));
  await p.close();
}

// 2. phone: the dialog from the block
{
  const p = await page('/en-uk/airport-lounge-passes', block('', [['airport', 'HKG']]), { width: 375 });
  await p.waitForTimeout(1000);
  await p.locator('main .book-now a.button').click();
  await p.waitForFunction(() => /\(HKG\)$/.test(document.querySelector('dialog.modal[open] .booking-widget-where-input')?.value || ''), null, { timeout: 20000 }).catch(() => {});
  const d = await dialogState(p);
  check('phone: dialog with HKG chosen', d?.widget && /\(HKG\)$/.test(d.where), d?.where);
  await p.close();
}

// 3. no dialog on the page (a nav without it): no button, preview hint
{
  const p = await page('/en-uk/airport-lounge-passes', block('', []), { noDialog: true });
  await p.waitForTimeout(7000);
  const b = await buttons(p);
  check('no dialog: no button, preview hint', b[0].none && /no Book Now dialog/.test(b[0].hint), JSON.stringify(b[0]));
  await p.close();
}

// 4. in the page's first section: the page isn't held up waiting for the nav
{
  const p = await page('/en-uk/airport-lounge-passes', block('', []), { first: true });
  const shown = await p.evaluate(() => {
    const s = document.querySelector('main > .section');
    return { status: s?.dataset.sectionStatus, button: !!s?.querySelector('.book-now a.button') };
  });
  const timing = await p.evaluate(() => Math.round(performance.getEntriesByType('navigation')[0].loadEventStart));
  check('first section: shown with the button, page load not delayed', shown.status === 'loaded' && shown.button && timing < 4000, `${JSON.stringify(shown)} load ${timing}ms`);
  await p.close();
}

// 5. the default label in each language
for (const [lang, label] of [['zh-cn', '立即预订'], ['pt-br', 'Reserve Agora'], ['ja-jp', '今すぐ予約'], ['zh-hk', '立即預訂']]) {
  // eslint-disable-next-line no-await-in-loop
  const p = await page(`/${lang}/`, block('', []));
  // eslint-disable-next-line no-await-in-loop
  await p.waitForTimeout(800);
  // eslint-disable-next-line no-await-in-loop
  const b = await buttons(p);
  check(`${lang}: default label "${label}"`, b[0]?.text === label, b[0]?.text);
  // eslint-disable-next-line no-await-in-loop
  await p.locator('main .book-now a.button').click();
  // eslint-disable-next-line no-await-in-loop
  await p.waitForSelector('dialog.modal[open] .booking-widget-where-input', { timeout: 15000 }).catch(() => {});
  // eslint-disable-next-line no-await-in-loop
  const d = await dialogState(p);
  check(`${lang}: opens the dialog with the widget`, d?.widget, d?.title);
  // eslint-disable-next-line no-await-in-loop
  await p.close();
}

console.log(`\n${failed} failed`);
await browser.close();
