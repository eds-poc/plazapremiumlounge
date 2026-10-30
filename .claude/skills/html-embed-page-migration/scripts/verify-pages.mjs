#!/usr/bin/env node
/**
 * Checks each imported page in the local preview (http://localhost:3000/content/<path>):
 * - the Embed Code block shows the authored HTML (not hidden, has height)
 * - its CSS and inline scripts are in the head
 * - its scripts ran: no element still waiting for a script (e.g. [data-anim] at opacity 0
 *   after scrolling to it), no page errors
 * - every image in it loads, and none still points at the source site
 * - no metadata block shows on the page (it must be the page's last section)
 *
 * Usage: node verify-pages.mjs --urls <file> [--base http://localhost:3000]
 */
import fs from 'fs';

const MARKETPLACE = process.env.EXCAT_MARKETPLACE_ROOT || '/home/node/.excat-marketplaces/excat-marketplace';
const SCRAPE_SCRIPTS = `${MARKETPLACE}/excat/skills/excat-scrape-webpage/scripts`;
const { connectBrowser } = await import(`${SCRAPE_SCRIPTS}/browser-source.js`);

const args = process.argv.slice(2);
const urlsFile = args[args.indexOf('--urls') + 1];
const base = args.includes('--base') ? args[args.indexOf('--base') + 1] : 'http://localhost:3000';
if (!args.includes('--urls') || !urlsFile) {
  console.error('Usage: node verify-pages.mjs --urls <file> [--base http://localhost:3000]');
  process.exit(1);
}
const urls = fs.readFileSync(urlsFile, 'utf-8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

/** The local document path, as the importer names it (WebImporter.FileUtils.sanitizePath). */
function documentPath(url) {
  return new URL(url).pathname.replace(/\/$/, '').toLowerCase()
    .split('/').map((s) => s.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')).join('/');
}

async function check(page, sourceHost) {
  return page.evaluate(async (host) => {
    const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });
    for (let i = 0; i < 20 && !document.querySelector('.embed-code[data-block-status="loaded"]'); i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await wait(500);
    }
    await wait(1500);
    const blocks = [...document.querySelectorAll('main .embed-code')];
    // scroll through the page so scroll-triggered scripts get their chance
    for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight / 2) {
      window.scrollTo(0, y);
      // eslint-disable-next-line no-await-in-loop
      await wait(120);
    }
    await wait(800);
    const imgs = blocks.flatMap((b) => [...b.querySelectorAll('img')]);
    await Promise.all(imgs.map((img) => {
      img.loading = 'eager';
      return img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r; setTimeout(r, 8000); });
    }));
    const headCode = [...document.head.querySelectorAll('style, script')].map((s) => s.textContent).join('\n');
    return {
      title: document.querySelector('main .title h1, main .title h2')?.textContent.trim() || null,
      blocks: blocks.map((b) => ({
        hidden: !!b.closest('[hidden]'),
        height: Math.round(b.getBoundingClientRect().height),
        classes: [...new Set([...b.querySelectorAll('[class]')].flatMap((e) => [...e.classList]))].slice(0, 3),
      })),
      headHasCode: blocks.length > 0 && blocks.every((b) => {
        const cls = [...b.querySelectorAll('[class]')].flatMap((e) => [...e.classList]).find((c) => !/^fr-/.test(c));
        return cls ? headCode.includes(cls) : true;
      }),
      waiting: blocks.flatMap((b) => [...b.querySelectorAll('[data-anim]')])
        .filter((e) => getComputedStyle(e).opacity === '0').length,
      brokenImages: imgs.filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src')),
      sourceImages: imgs.map((i) => i.getAttribute('src')).filter((s) => {
        try {
          return new URL(s, window.location.href).hostname === host;
        } catch (e) {
          return false;
        }
      }),
      metadataShown: !!document.querySelector('main .metadata'),
    };
  }, sourceHost);
}

let failures = 0;
const browser = await connectBrowser('local');
try {
  // one page at a time, each closed before the next
  // eslint-disable-next-line no-restricted-syntax
  for (const url of urls) {
    const local = `${base}/content${documentPath(url)}`;
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      const response = await page.goto(local, { waitUntil: 'load', timeout: 60000 });
      if (!response || !response.ok()) throw new Error(`HTTP ${response?.status()} for ${local}`);
      const r = await check(page, new URL(url).hostname);
      const problems = [];
      if (!r.blocks.length) problems.push('no Embed Code block');
      r.blocks.forEach((b, i) => {
        if (b.hidden || b.height < 10) problems.push(`Embed Code block ${i + 1} shows nothing`);
      });
      if (!r.headHasCode) problems.push('the block\'s CSS/scripts are not in the head');
      if (r.waiting) problems.push(`${r.waiting} element(s) still hidden, waiting for a script (did it run?)`);
      if (r.brokenImages.length) problems.push(`broken images: ${r.brokenImages.join(', ')}`);
      if (r.sourceImages.length) problems.push(`images still on the source site: ${r.sourceImages.join(', ')}`);
      if (r.metadataShown) problems.push('the metadata block shows on the page (must be the last section on its own)');
      if (errors.length) problems.push(`page errors: ${errors.slice(0, 3).join(' | ')}`);
      console.log(`${problems.length ? '❌' : '✅'} ${url} → ${local}`);
      console.log(`   title: ${r.title ?? '(none)'} · ${r.blocks.length} Embed Code block(s), ${r.blocks.map((b) => `${b.height}px`).join(', ')}`);
      problems.forEach((p) => console.log(`   - ${p}`));
      if (problems.length) failures += 1;
    } catch (error) {
      failures += 1;
      console.log(`❌ ${url} → ${local}: ${error.message}`);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
process.exit(failures ? 1 : 0);
