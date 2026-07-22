#!/usr/bin/env node
// Loads every widget's index.html in headless Chromium and fails if it throws a
// JS error or renders nothing. This is the closest thing to a "build" check we
// have, since widgets are plain HTML/CSS/JS with no compile step.
// Usage: node tools/smoke-test.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { injectICUEMock } from './icue-mock.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WIDGETS_DIR = path.join(REPO_ROOT, 'widgets');

async function testWidget(browser, widgetName) {
  const htmlPath = path.join(WIDGETS_DIR, widgetName, 'index.html');
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  try {
    // Load the widget the way iCUE does — with the runtime present — so onInit /
    // onDataUpdated actually run and errors in them get caught, not just parse.
    await injectICUEMock(page, fs.readFileSync(htmlPath, 'utf8'));
    await page.setViewport({ width: 480, height: 480 });
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0', timeout: 30_000 });
    await new Promise((resolve) => setTimeout(resolve, 300));

    // innerText is unreliable in headless Chrome (depends on a layout pass that
    // doesn't always run for an offscreen tab); textContent doesn't, but it also
    // picks up <script>/<style> contents, so strip those first.
    const bodyText = await page.evaluate(() => {
      const clone = document.body.cloneNode(true);
      clone.querySelectorAll('script, style').forEach((el) => el.remove());
      return clone.textContent.trim();
    });

    if (errors.length > 0) {
      throw new Error(`console errors:\n${errors.map((message) => `    ${message}`).join('\n')}`);
    }
    if (bodyText.length === 0) {
      throw new Error('page rendered no visible text');
    }
  } finally {
    await page.close();
  }
}

function listWidgetNames() {
  return fs
    .readdirSync(WIDGETS_DIR)
    .filter((name) => fs.existsSync(path.join(WIDGETS_DIR, name, 'index.html')));
}

async function main() {
  const widgetNames = listWidgetNames();
  if (widgetNames.length === 0) {
    console.log('No widgets found.');
    return;
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  let hasFailure = false;
  try {
    for (const name of widgetNames) {
      try {
        await testWidget(browser, name);
        console.log(`✓ ${name}`);
      } catch (error) {
        hasFailure = true;
        console.error(`✗ ${name}: ${error.message}`);
      }
    }
  } finally {
    await browser.close();
  }

  if (hasFailure) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
