#!/usr/bin/env node
/**
 * Reports, per page, what the import will find in its snapshot (see prepare-snapshots.mjs),
 * so pages the import script doesn't handle yet show up before importing:
 * - the page title the Title block is made from
 * - each top-level .fr-view: its top classes/ids, and the <style>s and inline <script>s outside
 *   it that refer to them (these go into its Embed Code block), its same-site assets (to the
 *   DAM) and other-host assets (kept)
 * - content in the page's main area (.contentWrapper) outside the .fr-view, the title and the
 *   site-wide parts (newsletter), which the import script would drop: it needs a mapping to an
 *   existing block
 *
 * Usage: node analyze-snapshots.mjs --urls <file> [--json <out-file>]
 * Exit code 1 when a page has no .fr-view or has unhandled content.
 */
import fs from 'fs';
import path from 'path';

const MARKETPLACE = process.env.EXCAT_MARKETPLACE_ROOT || '/home/node/.excat-marketplaces/excat-marketplace';
const SCRAPE_SCRIPTS = `${MARKETPLACE}/excat/skills/excat-scrape-webpage/scripts`;
const { connectBrowser } = await import(`${SCRAPE_SCRIPTS}/browser-source.js`);
const { bdSnapshotKey } = await import(`${SCRAPE_SCRIPTS}/bd-scrape.js`);

const SNAPSHOT_DIR = 'migration-work/source-snapshots';
// the main area's parts the import script handles or leaves out on purpose
const HANDLED = ['.fr-view', '.title-wrapper', '.newsletter-wrapper', '.spacer30', '[data-inert-script]', 'style', 'noscript'];

const args = process.argv.slice(2);
const urlsFile = args[args.indexOf('--urls') + 1];
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
if (!args.includes('--urls') || !urlsFile) {
  console.error('Usage: node analyze-snapshots.mjs --urls <file> [--json <out-file>]');
  process.exit(1);
}
const urls = fs.readFileSync(urlsFile, 'utf-8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

function analyze({ url, handled }) {
  const decode = (s) => new TextDecoder().decode(Uint8Array.from(atob(s || ''), (c) => c.charCodeAt(0)));
  const host = new URL(url).hostname;
  const isLocal = (u) => {
    try {
      return new URL(u, url).hostname === host && !/^data:/i.test(u);
    } catch (e) {
      return false;
    }
  };
  const refersTo = (code, selectors) => selectors.some((s) => {
    const name = s.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`[.#]${name}(?![\\w-])|['"]${name}['"]`).test(code);
  });

  const title = document.querySelector('.contentWrapper .title-wrapper .title, .contentWrapper .title-wrapper h1, .contentWrapper .title-wrapper h2');
  const frViews = [...document.querySelectorAll('.fr-view')]
    .filter((el) => !el.parentElement.closest('.fr-view') && el.innerHTML.trim());

  const blocks = frViews.map((el) => {
    const selectors = new Set();
    [...el.children].forEach((child) => {
      child.classList.forEach((c) => { if (!/^fr-/.test(c)) selectors.add(`.${c}`); });
      if (child.id) selectors.add(`#${child.id}`);
    });
    const sel = [...selectors];
    const styles = [...document.querySelectorAll('style')].filter((s) => !el.contains(s) && refersTo(s.textContent, sel));
    const scripts = [...document.querySelectorAll('[data-inert-script]')].filter((s) => {
      const attrs = JSON.parse(decode(s.getAttribute('data-inert-attrs')) || '{}');
      return !el.contains(s) && !attrs.src && refersTo(decode(s.getAttribute('data-inert-script')), sel);
    });
    const imgs = [...el.querySelectorAll('img[src], source[srcset]')]
      .map((i) => i.getAttribute('src') || i.getAttribute('srcset').split(/[\s,]/)[0]);
    const bgs = [...el.querySelectorAll('[style*="url("]')]
      .flatMap((e) => [...e.getAttribute('style').matchAll(/url\(\s*(?:&quot;|["'])?([^"')&]+)/g)].map((m) => m[1]));
    const assets = [...new Set([...imgs, ...bgs])];
    return {
      topSelectors: sel,
      htmlLength: el.innerHTML.length,
      styles: styles.length,
      stylesInHead: styles.filter((s) => s.closest('head')).length,
      inlineScripts: scripts.length,
      scriptsInside: el.querySelectorAll('[data-inert-script]').length,
      externalFilesInside: [...el.querySelectorAll('link[rel~="stylesheet"][href]')].length
        + [...el.querySelectorAll('[data-inert-script]')].filter((s) => JSON.parse(decode(s.getAttribute('data-inert-attrs')) || '{}').src).length,
      sameSiteAssets: assets.filter(isLocal).length,
      otherHostAssets: assets.filter((a) => !isLocal(a)).length,
    };
  });

  // content outside what the import handles, in the main area
  const main = document.querySelector('.contentWrapper') || document.body;
  const unhandled = [];
  const walk = (node) => {
    [...node.children].forEach((child) => {
      if (handled.some((h) => child.matches(h))) return;
      if (handled.some((h) => child.querySelector(h))) {
        walk(child);
        return;
      }
      const text = child.textContent.replace(/\s+/g, ' ').trim();
      const media = child.matches('img, picture, video, iframe') || child.querySelector('img, picture, video, iframe');
      if (text || media) {
        unhandled.push({
          element: `${child.localName}${child.id ? `#${child.id}` : ''}${child.classList.length ? `.${[...child.classList].join('.')}` : ''}`,
          text: text.slice(0, 160),
          images: [...child.querySelectorAll('img')].map((i) => i.getAttribute('src')).slice(0, 5),
        });
      }
    });
  };
  walk(main);

  return {
    title: title ? title.textContent.trim() : null,
    frViews: blocks,
    unhandled,
    metadata: {
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content || '',
      image: document.querySelector('meta[property="og:image"]')?.content || '',
    },
  };
}

const results = [];
let problems = 0;
const browser = await connectBrowser('local');
try {
  // one page at a time, each closed before the next
  // eslint-disable-next-line no-restricted-syntax
  for (const url of urls) {
    const file = path.join(SNAPSHOT_DIR, `${bdSnapshotKey(url)}.html`);
    if (!fs.existsSync(file)) {
      problems += 1;
      results.push({ url, error: `no snapshot (${file}): run prepare-snapshots.mjs first` });
      // eslint-disable-next-line no-continue
      continue;
    }
    const page = await browser.newPage();
    try {
      await page.route('**/*', (route) => route.abort());
      await page.setContent(fs.readFileSync(file, 'utf-8'), { waitUntil: 'domcontentloaded', timeout: 60000 });
      const result = { url, ...(await page.evaluate(analyze, { url, handled: HANDLED })) };
      if (!result.frViews.length || result.unhandled.length) problems += 1;
      results.push(result);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}

results.forEach((r) => {
  console.log(`\n${r.url}`);
  if (r.error) {
    console.log(`  ❌ ${r.error}`);
    return;
  }
  console.log(`  title: ${r.title ?? '(none)'}`);
  if (!r.frViews.length) console.log('  ❌ no .fr-view: not a page for this approach');
  r.frViews.forEach((b, i) => {
    console.log(`  .fr-view ${i + 1}: ${b.topSelectors.join(' ') || '(no class/id on top elements)'} · ${b.htmlLength} chars`
      + ` · ${b.styles} style(s) outside (${b.stylesInHead} in head) · ${b.inlineScripts} inline script(s) outside`
      + ` · ${b.scriptsInside} script(s) and ${b.externalFilesInside} file link(s) inside`
      + ` · assets: ${b.sameSiteAssets} same-site (to DAM), ${b.otherHostAssets} other host`);
    if (!b.topSelectors.length) console.log('    ⚠️  no class/id to match the page\'s styles and scripts by: check by hand');
  });
  r.unhandled.forEach((u) => console.log(`  ⚠️  outside .fr-view, not handled: ${u.element} "${u.text}"${u.images.length ? ` images: ${u.images.join(', ')}` : ''}`));
});
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(results, null, 2));
process.exit(problems ? 1 : 0);
