import js from '@eslint/js';
import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
  // Widget HTML/inline JS is intentionally excluded: iCUE's runtime requires bare
  // global assignments (`icueEvents = {...}`, no `var`) and forbids 'use strict',
  // which standard JS lint rules would flag. See docs/ICUE_WIDGET_FORMAT.md.
  { ignores: ['dist/**', 'node_modules/**', 'widgets/**'] },
  js.configs.recommended,
  {
    // tools/*.js mixes Node code with inline page.evaluate() callbacks that run
    // in the browser (e.g. referencing `document`), so both global sets apply.
    files: ['tools/**/*.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
  },
  eslintConfigPrettier,
];
