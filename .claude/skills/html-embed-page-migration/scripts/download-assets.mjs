#!/usr/bin/env node
/**
 * Copies the same-site assets the import moved to the DAM into the content folder: each
 * import report (tools/importer/reports/**\/*.report.json) of the given pages has an `assets`
 * map (JSON string: source address → DAM path, e.g. /media-da/en-uk/offers/<page>/<file>).
 *
 * Usage: node download-assets.mjs --urls <file> [--force]
 *   --force  download again files that are already there
 * Fails a page when an asset can't be downloaded (its code would point at a missing file).
 */
import fs from 'fs';
import path from 'path';

const REPORTS = 'tools/importer/reports';
const CONTENT = 'content';

const args = process.argv.slice(2);
const urlsFile = args[args.indexOf('--urls') + 1];
const force = args.includes('--force');
if (!args.includes('--urls') || !urlsFile) {
  console.error('Usage: node download-assets.mjs --urls <file> [--force]');
  process.exit(1);
}
const urls = new Set(fs.readFileSync(urlsFile, 'utf-8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')));

function reportFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return reportFiles(file);
    return entry.name.endsWith('.report.json') ? [file] : [];
  });
}

const reports = reportFiles(REPORTS)
  .map((file) => JSON.parse(fs.readFileSync(file, 'utf-8')))
  .filter((report) => urls.has(report.url));

let failures = 0;
urls.forEach((url) => {
  if (!reports.some((r) => r.url === url)) {
    failures += 1;
    console.error(`❌ ${url}: no import report (import the page first)`);
  }
});

// eslint-disable-next-line no-restricted-syntax
for (const report of reports) {
  const assets = report.assets ? JSON.parse(report.assets) : {};
  const entries = Object.entries(assets);
  console.log(`${report.url}: ${entries.length} asset(s)`);
  // eslint-disable-next-line no-restricted-syntax
  for (const [source, damPath] of entries) {
    const target = path.join(CONTENT, damPath.replace(/^\/+/, ''));
    if (!force && fs.existsSync(target)) {
      console.log(`  ↩️  ${damPath} (already there)`);
      // eslint-disable-next-line no-continue
      continue;
    }
    try {
      // eslint-disable-next-line no-await-in-loop
      const response = await fetch(source, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' } });
      const type = response.headers.get('content-type') || '';
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (/text\/html/i.test(type)) throw new Error('got an HTML page, not the file (blocked?)');
      // eslint-disable-next-line no-await-in-loop
      const data = Buffer.from(await response.arrayBuffer());
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, data);
      console.log(`  ✅ ${damPath} (${data.length} bytes, ${type})`);
    } catch (error) {
      failures += 1;
      console.error(`  ❌ ${damPath} ← ${source}: ${error.message}`);
    }
  }
}
process.exit(failures ? 1 : 0);
