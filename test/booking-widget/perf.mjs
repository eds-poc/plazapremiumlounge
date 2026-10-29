// Booking widget performance baseline / comparison (local dev server: working-tree code, preview
// content). Per profile and page, N runs: LCP, CLS with shift sources, long tasks (TBT-like, after
// FCP), API calls (incl. preflights) with timings, JS/CSS bytes, when Search is enabled, when the
// lounge card (or its button) shows, and INP-like event timing for typing in Where.
// Usage: node perf.mjs <label> [runs]
import { mkdirSync, writeFileSync } from 'node:fs';
import { PW, UA } from './harness.mjs';

const { chromium } = await import(PW);
const label = process.argv[2] || 'run';
const RUNS = Number(process.argv[3] || 3);
const HOST = 'http://localhost:3000';
const PROFILES = {
  mobile: {
    width: 375, height: 812, cpu: 4, net: { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 },
  },
  desktop: {
    width: 1440, height: 900, cpu: 1, net: { latency: 40, downloadThroughput: (10 * 1024 * 1024) / 8, uploadThroughput: (5 * 1024 * 1024) / 8 },
  },
};
const PAGES = { home: '/en-uk/', other: '/en-uk/airport-lounge-passes' };
const median = (a) => { const s = a.filter((x) => Number.isFinite(x)).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

const OUT = process.env.RESULTS || 'test/booking-widget/results';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const results = {};
async function measure(profileName, pageName) {
  const prof = PROFILES[profileName];
  const context = await browser.newContext({ viewport: { width: prof.width, height: prof.height }, userAgent: UA });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, ...prof.net });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: prof.cpu });
  const reqs = new Map();
  cdp.on('Network.requestWillBeSent', (e) => reqs.set(e.requestId, {
    url: e.request.url, method: e.request.method, type: e.type, start: e.timestamp,
  }));
  cdp.on('Network.loadingFinished', (e) => { const r = reqs.get(e.requestId); if (r) { r.bytes = e.encodedDataLength; r.end = e.timestamp; } });
  await page.addInitScript(() => {
    window.perf = {
      lcp: 0, cls: 0, shifts: [], longtasks: [], events: [],
    };
    const sel = (n) => {
      if (!n || !n.nodeType || n.nodeType !== 1) return '?';
      const c = n.className && typeof n.className === 'string' ? `.${n.className.trim().split(/\s+/).slice(0, 2).join('.')}` : '';
      return `${n.tagName.toLowerCase()}${c}`;
    };
    new PerformanceObserver((l) => l.getEntries().forEach((e) => { window.perf.lcp = e.startTime; window.perf.lcpEl = sel(e.element); })).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => l.getEntries().forEach((e) => {
      if (e.hadRecentInput) return;
      window.perf.cls += e.value;
      window.perf.shifts.push({ t: Math.round(e.startTime), v: Math.round(e.value * 1000) / 1000, src: (e.sources || []).map((s) => sel(s.node)).slice(0, 3) });
    })).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.perf.longtasks.push({ t: Math.round(e.startTime), d: Math.round(e.duration) }))).observe({ type: 'longtask', buffered: true });
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.perf.events.push({ name: e.name, d: Math.round(e.duration), t: Math.round(e.startTime) }))).observe({ type: 'event', durationThreshold: 16, buffered: true });
    const watch = setInterval(() => {
      const b = document.querySelector('main .hero .booking-widget-submit');
      if (b && !b.disabled && !window.perf.searchOn) window.perf.searchOn = performance.now();
      if (document.querySelector('.hero-products .booking-widget-card:not(.booking-widget-card-skeleton) h2, .hero-products .booking-widget-more-properties:not([hidden]) a') && !window.perf.cardAt) window.perf.cardAt = performance.now();
      if (window.perf.searchOn && window.perf.cardAt) clearInterval(watch);
    }, 25);
  });
  await page.goto(`${HOST}${PAGES[pageName]}`, { waitUntil: 'load', timeout: 120000 });
  const loadAt = await page.evaluate(() => performance.timing.loadEventStart - performance.timing.navigationStart);
  if (pageName === 'home') {
    await page.waitForFunction(() => window.perf.cardAt && window.perf.searchOn, null, { timeout: 45000 }).catch(() => {});
  }
  await page.waitForTimeout(3000);
  // typing in Where (event timing), on the homepage's widget
  if (pageName === 'home') {
    const input = page.locator('main .hero .booking-widget-where-input');
    await input.click();
    await input.fill('');
    await input.pressSequentially('hong kong int', { delay: 120 });
    await page.waitForTimeout(800);
    await page.keyboard.press('Escape');
  }
  const p = await page.evaluate(() => {
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0;
    const tbt = window.perf.longtasks.filter((x) => x.t >= fcp).reduce((s, x) => s + Math.max(0, x.d - 50), 0);
    const typing = window.perf.events.filter((e) => /key|input|pointer|click/.test(e.name));
    return {
      ...window.perf, fcp, tbt, inpLike: typing.length ? Math.max(...typing.map((e) => e.d)) : 0,
    };
  });
  const t0 = [...reqs.values()][0]?.start || 0;
  const api = [...reqs.values()].filter((r) => /getGeoLocation|getbookingwidgetproducts/.test(r.url))
    .map((r) => ({
      name: r.url.match(/(getGeoLocation|getbookingwidgetproducts)/)[1], method: r.method, start: Math.round((r.start - t0) * 1000), ms: r.end ? Math.round((r.end - r.start) * 1000) : null, kb: r.bytes ? Math.round(r.bytes / 1024) : null,
    }));
  const bytes = (re) => Math.round([...reqs.values()].filter((r) => re.test(r.url)).reduce((s, r) => s + (r.bytes || 0), 0) / 1024);
  const out = {
    lcp: Math.round(p.lcp),
    lcpEl: p.lcpEl,
    fcp: Math.round(p.fcp),
    cls: Math.round(p.cls * 1000) / 1000,
    shifts: p.shifts,
    tbt: p.tbt,
    inpLike: p.inpLike,
    load: loadAt,
    searchOn: p.searchOn ? Math.round(p.searchOn) : null,
    cardAt: p.cardAt ? Math.round(p.cardAt) : null,
    api,
    jsKB: bytes(/\.js(\?|$)/),
    cssKB: bytes(/\.css(\?|$)/),
    bwKB: bytes(/booking-widget|date-picker|scripts\/booking\.js/),
  };
  await page.close();
  await context.close();
  return out;
}
for (const profileName of Object.keys(PROFILES)) {
  for (const pageName of Object.keys(PAGES)) {
    const runs = [];
    for (let i = 0; i < RUNS; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const r = await measure(profileName, pageName);
      runs.push(r);
      console.log(label, profileName, pageName, i, JSON.stringify({
        lcp: r.lcp, lcpEl: r.lcpEl, cls: r.cls, tbt: r.tbt, inp: r.inpLike, load: r.load, searchOn: r.searchOn, cardAt: r.cardAt, js: r.jsKB, css: r.cssKB, bw: r.bwKB, api: r.api.map((a) => `${a.method} ${a.name} @${a.start} ${a.ms}ms ${a.kb}KB`),
      }));
      if (r.shifts.length) console.log('   shifts', JSON.stringify(r.shifts));
    }
    results[`${profileName} ${pageName}`] = {
      runs,
      median: Object.fromEntries(['lcp', 'fcp', 'cls', 'tbt', 'inpLike', 'load', 'searchOn', 'cardAt', 'jsKB', 'cssKB', 'bwKB'].map((k) => [k, median(runs.map((r) => r[k]))])),
    };
    console.log('MEDIAN', label, profileName, pageName, JSON.stringify(results[`${profileName} ${pageName}`].median));
  }
}
writeFileSync(`${OUT}/${label}.json`, JSON.stringify(results, null, 1));
await browser.close();
