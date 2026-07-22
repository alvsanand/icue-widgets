#!/usr/bin/env node
// Rasterizes widgets/<name>/resources/icon.svg into icon.png (256) and icon@2x.png
// (512), the sizes iCUE expects for a widget's manifest.json "preview_icon" and
// picker listing.
// Usage: node tools/generate-icon.js <widget-folder-name>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SIZES = [
  { size: 256, filename: 'icon.png' },
  { size: 512, filename: 'icon@2x.png' },
];

async function renderSvgToPng(browser, svg, outPath, size) {
  const html = `<!doctype html><html><body style="margin:0"><style>html,body{width:100%;height:100%}svg{width:100%;height:100%;display:block}</style>${svg}</body></html>`;

  const page = await browser.newPage();
  await page.setViewport({ width: size, height: size });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: outPath, omitBackground: true });
  await page.close();
}

async function main() {
  const widgetName = process.argv[2];
  if (!widgetName) {
    console.error('Usage: node tools/generate-icon.js <widget-folder-name>');
    process.exit(1);
  }

  const widgetDir = path.join(REPO_ROOT, 'widgets', widgetName);
  const svgPath = path.join(widgetDir, 'resources', 'icon.svg');
  if (!fs.existsSync(svgPath)) {
    console.error(`Missing ${path.relative(REPO_ROOT, svgPath)}`);
    process.exit(1);
  }
  const svg = fs.readFileSync(svgPath, 'utf8');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    for (const { size, filename } of SIZES) {
      const outPath = path.join(widgetDir, filename);
      await renderSvgToPng(browser, svg, outPath, size);
      console.log(`Saved: ${path.relative(REPO_ROOT, outPath)}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
