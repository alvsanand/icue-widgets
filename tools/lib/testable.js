// Extracts the pure-logic region a widget marks with `// @testable-start` and
// `// @testable-end` in its index.html, and returns the named values it defines
// — so widget logic can be unit-tested in plain Node without a browser or iCUE.
//
// Widgets are a single self-contained index.html with no build step, so there's
// nothing to `import`. Wrapping the marked region in `new Function` and asking
// for the identifiers by name is how we reach into it. Put only side-effect-free
// logic (math, parsing, formatting) between the markers — no DOM, no iCUE calls.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function extractTestable(html) {
  const m = html.match(/\/\/ @testable-start([\s\S]*?)\/\/ @testable-end/);
  return m ? m[1] : null;
}

export function loadTestable(widgetName, exportNames) {
  const htmlPath = path.join(REPO_ROOT, 'widgets', widgetName, 'index.html');
  const region = extractTestable(fs.readFileSync(htmlPath, 'utf8'));
  if (region === null) {
    throw new Error(
      `No // @testable-start.../@testable-end region in widgets/${widgetName}/index.html`,
    );
  }
  const returns = exportNames
    .map((n) => `${JSON.stringify(n)}: (typeof ${n} !== 'undefined' ? ${n} : undefined)`)
    .join(', ');
  return new Function(`${region}\nreturn { ${returns} };`)();
}
