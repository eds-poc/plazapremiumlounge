#!/usr/bin/env node
/**
 * Fetches each page's server HTML (scripts included) and writes its import snapshot, in which
 * every <script> is a placeholder the importer leaves alone:
 *   <template data-inert-script="<base64 code>" data-inert-attrs="<base64 JSON attributes>"></template>
 * (a <template>, so that placeholders in the <head> keep it as parsed)
 * The importer drops <script> elements (and the Bright Data snapshot strips them), but the
 * authored HTML (.fr-view) comes with inline scripts that have to be carried over; the
 * embed-code parser turns the placeholders back into the original <script>s.
 *
 * Usage: node prepare-snapshots.mjs --urls <file> [--force]
 *   --force  fetch again even when the server HTML is already saved
 * Writes, per URL (<key> = <host>/<path>, as run-bulk-import.js looks snapshots up):
 *   migration-work/html-embed/source/<key>.html   the server HTML as fetched (reused next time)
 *   migration-work/source-snapshots/<key>.html    the import snapshot (pass --html-dir
 *                                                 migration-work/source-snapshots to the import)
 * Pages are fetched with a local browser; a bot-protection page (e.g. Cloudflare's "Just a
 * moment...") is fetched again over Bright Data (needs BD_ENDPOINT; metered).
 */
import fs from 'fs';
import path from 'path';

const MARKETPLACE = process.env.EXCAT_MARKETPLACE_ROOT || '/home/node/.excat-marketplaces/excat-marketplace';
const SCRAPE_SCRIPTS = `${MARKETPLACE}/excat/skills/excat-scrape-webpage/scripts`;
const { connectBrowser } = await import(`${SCRAPE_SCRIPTS}/browser-source.js`);
const { bdSnapshotKey } = await import(`${SCRAPE_SCRIPTS}/bd-scrape.js`);

const CHALLENGE = /just a moment|checking your browser|attention required|verifying you are human|access denied/i;
const SOURCE_DIR = 'migration-work/html-embed/source';
const SNAPSHOT_DIR = 'migration-work/source-snapshots';

const args = process.argv.slice(2);
const urlsFile = args[args.indexOf('--urls') + 1];
const force = args.includes('--force');
if (!args.includes('--urls') || !urlsFile) {
  console.error('Usage: node prepare-snapshots.mjs --urls <file> [--force]');
  process.exit(1);
}
const urls = fs.readFileSync(urlsFile, 'utf-8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

/** Decodes the character references in an attribute value. */
function unescapeHtml(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, ref) => {
    if (ref[0] === '#') {
      const code = ref[1].toLowerCase() === 'x' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      return Number.isNaN(code) ? m : String.fromCodePoint(code);
    }
    return named[ref.toLowerCase()] ?? m;
  });
}

function b64(text) {
  return Buffer.from(text, 'utf-8').toString('base64');
}

/**
 * The page with every <script> as a placeholder. HTML comments are kept as they are: they
 * may hold commented-out scripts, which must not be matched (a match would run on into the
 * next real script and leave the comment open, hiding the rest of the page).
 */
function inertScripts(html) {
  const attrRe = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  return html.replace(/(<!--[\s\S]*?-->)|<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi, (m, comment, attrText, code) => {
    if (comment) return comment;
    const attrs = {};
    [...attrText.matchAll(attrRe)].forEach((a) => {
      attrs[a[1].toLowerCase()] = unescapeHtml(a[2] ?? a[3] ?? a[4] ?? '');
    });
    return `<template data-inert-script="${b64(code)}" data-inert-attrs="${b64(JSON.stringify(attrs))}"></template>`;
  });
}

/** The server HTML of a page, or null when a bot-protection page came back. */
async function fetchWith(source, url) {
  const browser = await connectBrowser(source);
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    // on Bright Data, a challenge is solved in the browser and navigates to the real page
    if (source === 'bd') {
      await page.waitForFunction((re) => !new RegExp(re, 'i').test(document.title), CHALLENGE.source, { timeout: 60000 }).catch(() => {});
    }
    const title = await page.title();
    const html = response ? await response.text() : '';
    await page.close();
    if (CHALLENGE.test(title) || !html || !/<\/html>/i.test(html)) return null;
    return html;
  } finally {
    await browser.close();
  }
}

let failures = 0;
// one page at a time, each browser closed before the next
// eslint-disable-next-line no-restricted-syntax
for (const url of urls) {
  const key = bdSnapshotKey(url);
  const sourceFile = path.join(SOURCE_DIR, `${key}.html`);
  const snapshotFile = path.join(SNAPSHOT_DIR, `${key}.html`);
  try {
    let html = !force && fs.existsSync(sourceFile) ? fs.readFileSync(sourceFile, 'utf-8') : null;
    if (html) {
      console.log(`↩️  ${url}: server HTML already saved`);
    } else {
      html = await fetchWith('local', url);
      if (!html) {
        if (!process.env.BD_ENDPOINT) throw new Error('bot protection, and BD_ENDPOINT is not set for Bright Data');
        console.log(`🛡️  ${url}: blocked locally, fetching over Bright Data`);
        html = await fetchWith('bd', url);
      }
      if (!html) throw new Error('no page HTML (blocked or empty)');
      fs.mkdirSync(path.dirname(sourceFile), { recursive: true });
      fs.writeFileSync(sourceFile, html);
    }
    const snapshot = inertScripts(html);
    fs.mkdirSync(path.dirname(snapshotFile), { recursive: true });
    fs.writeFileSync(snapshotFile, snapshot);
    const scripts = (snapshot.match(/data-inert-script=/g) || []).length;
    const frViews = (snapshot.match(/class="[^"]*\bfr-view\b/g) || []).length;
    console.log(`✅ ${url}: ${snapshotFile} (${frViews} .fr-view, ${scripts} scripts)`);
  } catch (error) {
    failures += 1;
    console.error(`❌ ${url}: ${error.message}`);
  }
}
process.exit(failures ? 1 : 0);
