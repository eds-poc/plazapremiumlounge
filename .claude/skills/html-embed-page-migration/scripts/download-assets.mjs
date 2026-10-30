#!/usr/bin/env node
/**
 * Copies the same-site assets the import moved to the DAM into the content folder: each
 * import report (tools/importer/reports/**\/*.report.json) of the given pages has an `assets`
 * map (JSON string: source address → DAM path, e.g. /media-da/en-uk/offers/<page>/<file>).
 *
 * A file whose content isn't what its name says (the source serves e.g. a PNG named .svg with
 * an image/png header, which works there but not once the DAM serves it by its name) is saved
 * with the right extension, and the page (content/<path>.plain.html) and the report are
 * updated to the new name. As this runs after each import, a re-import gets the same fix.
 *
 * Usage: node download-assets.mjs --urls <file> [--force]
 *   --force  download again files that are already there
 * Fails a page when an asset can't be downloaded (its code would point at a missing file).
 */
import fs from 'fs';
import path from 'path';

const REPORTS = 'tools/importer/reports';
const CONTENT = 'content';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

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

// what a file is, from its first bytes: the extension it should have and the ones that fit
const KINDS = [
  { ext: '.png', fits: ['.png'], test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: '.jpg', fits: ['.jpg', '.jpeg'], test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: '.gif', fits: ['.gif'], test: (b) => b.subarray(0, 4).toString('latin1') === 'GIF8' },
  { ext: '.webp', fits: ['.webp'], test: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
  { ext: '.avif', fits: ['.avif'], test: (b) => b.subarray(4, 12).toString('latin1') === 'ftypavif' },
  { ext: '.pdf', fits: ['.pdf'], test: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-' },
  { ext: '.svg', fits: ['.svg'], test: (b) => /<svg[\s>]/i.test(b.subarray(0, 2048).toString('utf-8')) },
];

/** The DAM path with the extension the content calls for (unchanged when it fits or is unknown). */
function fittingPath(damPath, data) {
  const kind = KINDS.find((k) => k.test(data));
  const ext = path.extname(damPath).toLowerCase();
  if (!kind || kind.fits.includes(ext)) return damPath;
  return `${damPath.slice(0, damPath.length - ext.length)}${kind.ext}`;
}

/** Replaces a DAM path in the page and the report (the page's code points at the new name). */
function rename(report, reportFile, from, to) {
  const page = path.join(CONTENT, `${report.path.replace(/^\/+/, '')}.plain.html`);
  if (fs.existsSync(page)) {
    const html = fs.readFileSync(page, 'utf-8');
    fs.writeFileSync(page, html.split(from).join(to));
  }
  const assets = JSON.parse(report.assets);
  Object.keys(assets).forEach((source) => {
    if (assets[source] === from) assets[source] = to;
  });
  report.assets = JSON.stringify(assets);
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
}

const reports = reportFiles(REPORTS)
  .map((file) => ({ file, report: JSON.parse(fs.readFileSync(file, 'utf-8')) }))
  .filter(({ report }) => urls.has(report.url));

let failures = 0;
urls.forEach((url) => {
  if (!reports.some(({ report }) => report.url === url)) {
    failures += 1;
    console.error(`❌ ${url}: no import report (import the page first)`);
  }
});

// eslint-disable-next-line no-restricted-syntax
for (const { file: reportFile, report } of reports) {
  const assets = report.assets ? JSON.parse(report.assets) : {};
  const entries = Object.entries(assets);
  console.log(`${report.url}: ${entries.length} asset(s)`);
  // eslint-disable-next-line no-restricted-syntax
  for (const [source, damPath] of entries) {
    const target = path.join(CONTENT, damPath.replace(/^\/+/, ''));
    if (!force && fs.existsSync(target) && fittingPath(damPath, fs.readFileSync(target)) === damPath) {
      console.log(`  ↩️  ${damPath} (already there)`);
      // eslint-disable-next-line no-continue
      continue;
    }
    try {
      // eslint-disable-next-line no-await-in-loop
      const response = await fetch(source, { headers: { 'User-Agent': USER_AGENT } });
      const type = response.headers.get('content-type') || '';
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (/text\/html/i.test(type)) throw new Error('got an HTML page, not the file (blocked?)');
      // eslint-disable-next-line no-await-in-loop
      const data = Buffer.from(await response.arrayBuffer());
      const fitting = fittingPath(damPath, data);
      const file = path.join(CONTENT, fitting.replace(/^\/+/, ''));
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, data);
      if (fitting !== damPath) {
        rename(report, reportFile, damPath, fitting);
        console.log(`  🔁 ${damPath} → ${fitting} (its content is ${path.extname(fitting).slice(1)}; page and report updated)`);
      } else {
        console.log(`  ✅ ${damPath} (${data.length} bytes, ${type})`);
      }
    } catch (error) {
      failures += 1;
      console.error(`  ❌ ${damPath} ← ${source}: ${error.message}`);
    }
  }
}
process.exit(failures ? 1 : 0);
