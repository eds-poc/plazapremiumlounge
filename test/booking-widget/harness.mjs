// Local test harness (no content changes): serves the local dev server's pages with
// - the homepage's main starting with a Hero (booking) block (photo, title, note) and the
//   transparent header metadata,
// - the nav page's book-now section holding a Booking Widget (title Book Your Visit + note).
// Usage: const { open } = await import('./harness.mjs'); const page = await open(browser, { width, path })
// the local preview (npx -y @adobe/aem-cli up), or another address in BW_HOST
export const HOST = process.env.BW_HOST || 'http://localhost:3000';
// (the image CDN refuses the HeadlessChrome user agent)
export const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
// Playwright isn't a dependency of the site: its module path (or name, when installed) in PLAYWRIGHT
export const PW = process.env.PLAYWRIGHT || 'playwright';

const NOTE = {
  'en-uk': '<p>Bookings must be made at least 1 hour prior to your arrival; otherwise, please proceed to our lounge as a walk-in guest. Submit Group Booking Requests <a href="/en-uk/group-booking">here</a> for 10 people or more.</p>',
  'zh-cn': '<p>预订须至少提前1个小时办理；将在1小时以内抵达者，请直接前往贵宾室办理。团体预订请到<a href="/zh-cn/group-booking">这里</a>办理（至少10人）。</p>',
};
const TITLE = { 'en-uk': 'Your destination before departure', 'zh-cn': '您每段旅程的第一站' };
const DIALOG = { 'en-uk': 'Book Your Visit', 'zh-cn': '预订您的行程' };

function heroHtml(lang) {
  return `<div><div class="hero booking"><div><div><picture><img src="/en-uk/media_1a2a1d454f278d7440ff7b6ff2799db7683f93338.jpg?width=2000&format=jpg&optimize=medium" alt="" width="1600" height="800" loading="eager"></picture></div></div>
<div><div><h1>${TITLE[lang]}</h1>${NOTE[lang]}</div></div></div></div>`;
}

export async function open(browser, {
  width = 1440, height = 900, path = '/en-uk/', hero = false, nav = false, extraRoute,
} = {}) {
  const page = await browser.newPage({ viewport: { width, height }, userAgent: UA });
  page.setDefaultTimeout(15000);
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(`pageerror ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(`console ${m.text().slice(0, 200)}`); });
  const lang = path.split('/')[1] || 'en-uk';
  await page.route(/localhost:3000\/[a-z]{2}-[a-z]{2}\/(index)?(\?.*)?$/, async (route) => {
    const resp = await route.fetch();
    let body = await resp.text();
    if (hero) {
      body = body.replace('<main>', `<main>${heroHtml(lang)}`);
      body = body.replace('</head>', '<meta name="header" content="transparent"></head>');
    }
    await route.fulfill({ response: resp, body, headers: { ...resp.headers(), 'content-type': 'text/html' } });
  });
  if (nav) {
    await page.route(/\/[a-z]{2}-[a-z]{2}\/nav\.plain\.html/, async (route) => {
      const resp = await route.fetch();
      let body = await resp.text();
      body = body.replace(
        /(<div data-modal="book-now"[^>]*>)[\s\S]*?(<\/div>\s*<div data-modal="cart")/,
        `$1\n  <h2>${DIALOG[lang]}</h2>\n  <div class="booking-widget"><div><div></div></div></div>\n  ${NOTE[lang]}\n</div>\n<div data-modal="cart"`,
      );
      await route.fulfill({ response: resp, body });
    });
  }
  if (extraRoute) await extraRoute(page);
  await page.goto(`${HOST}${path}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => document.querySelector('header .header')?.dataset.blockStatus === 'loaded', null, { timeout: 30000 });
  await page.waitForTimeout(800);
  return page;
}
