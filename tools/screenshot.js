#!/usr/bin/env node
// Renders a widget's index.html at a real iCUE slot resolution and saves a PNG,
// so you can see a widget without installing iCUE.
// Usage: node tools/screenshot.js <widget-folder-name> [SLOT] [--eval "js"] [--delay ms] [--data '<json>']
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { injectICUEMock } from './icue-mock.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// See docs/ICUE_WIDGET_FORMAT.md for what each slot corresponds to on-device.
// The P* slots are iCUE's picker-preview sizes — the scaled-down resolutions the
// widget renders at inside the settings picker, useful for checking that
// aspect-ratio media queries pick the right layout.
const SLOTS = {
  HS: { width: 840, height: 344 },
  HM: { width: 840, height: 696 },
  HL: { width: 1688, height: 696 },
  HXL: { width: 2536, height: 696 },
  VS: { width: 696, height: 416 },
  VM: { width: 696, height: 840 },
  VL: { width: 696, height: 1688 },
  VXL: { width: 696, height: 2536 },
  PUMP: { width: 480, height: 480 },
  KB: { width: 248, height: 170 },
  PS: { width: 316, height: 130 },
  PM: { width: 316, height: 262 },
  PL: { width: 634, height: 262 },
  PXL: { width: 952, height: 262 },
  PVS: { width: 262, height: 157 },
  PVM: { width: 262, height: 316 },
  PVL: { width: 196, height: 475 },
  PVXL: { width: 262, height: 952 },
  PPUMP: { width: 165, height: 165 },
};

function parseArgs(argv) {
  const result = { widgetName: null, slotName: 'PUMP', evalCode: null, delay: 500, data: {} };
  let i = 2;
  while (i < argv.length) {
    if (argv[i] === '--eval' && i + 1 < argv.length) {
      result.evalCode = argv[++i];
    } else if (argv[i] === '--delay' && i + 1 < argv.length) {
      result.delay = Number.parseInt(argv[++i], 10) || 500;
    } else if (argv[i] === '--data' && i + 1 < argv.length) {
      result.data = JSON.parse(argv[++i]);
    } else if (!result.widgetName) {
      result.widgetName = argv[i];
    } else {
      result.slotName = argv[i].toUpperCase();
    }
    i += 1;
  }
  return result;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.widgetName) {
    console.error(
      `Usage: node tools/screenshot.js <widget-folder-name> [${Object.keys(SLOTS).join('|')}] [--eval "js"] [--delay ms]`,
    );
    process.exit(1);
  }

  const slot = SLOTS[args.slotName];
  if (!slot) {
    console.error(`Unknown slot "${args.slotName}" — use one of ${Object.keys(SLOTS).join(', ')}`);
    process.exit(1);
  }

  const htmlPath = path.join(REPO_ROOT, 'widgets', args.widgetName, 'index.html');
  const outPath = path.join(REPO_ROOT, 'widgets', args.widgetName, `preview_${args.slotName}.png`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await injectICUEMock(page, fs.readFileSync(htmlPath, 'utf8'), args.data);
    await page.setViewport({ width: slot.width, height: slot.height });
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0', timeout: 30_000 });

    if (args.evalCode) {
      await page.evaluate(new Function(args.evalCode));
    }

    await new Promise((resolve) => setTimeout(resolve, args.delay));
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`Saved: ${path.relative(REPO_ROOT, outPath)}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
