#!/usr/bin/env node
// Runs every widget's logic unit tests. A widget opts in by putting side-effect-
// free logic between `// @testable-start` / `// @testable-end` in index.html and
// adding widgets/<name>/logic.test.mjs (which uses tools/lib/testable.js +
// tools/lib/assert.js). See docs/CREATING_A_WIDGET.md.
// Usage: node tools/test-unit.js
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { results } from './lib/assert.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WIDGETS_DIR = path.join(REPO_ROOT, 'widgets');

function findTestFiles() {
  return fs
    .readdirSync(WIDGETS_DIR)
    .map((name) => path.join(WIDGETS_DIR, name, 'logic.test.mjs'))
    .filter((file) => fs.existsSync(file));
}

async function main() {
  const files = findTestFiles();
  if (files.length === 0) {
    console.log('No widget unit tests found (widgets/*/logic.test.mjs).');
    return;
  }

  for (const file of files) {
    console.log(`\n${path.relative(REPO_ROOT, file)}`);
    await import(pathToFileURL(file).href);
  }

  const { ran, failed } = results();
  console.log(`\n${ran - failed}/${ran} checks passed.`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
