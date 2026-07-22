# Contributing

## Setup

```bash
nvm use          # or ensure Node >= 20
npm install
```

`npm install` downloads a Chromium build for Puppeteer (used by the screenshot,
icon-generation, and smoke-test tools) — the first install is slower and larger
(~200MB) than a typical `npm install`.

## Workflow

1. Branch from `main`: `feature/<short-description>` or `fix/<short-description>`.
2. Make your changes. If adding a widget, see
   [docs/CREATING_A_WIDGET.md](docs/CREATING_A_WIDGET.md).
3. Before opening a PR, run everything CI runs:

   ```bash
   npm run format:check
   npm run lint
   npm run validate
   npm test
   ```

4. Open a PR against `main` with a clear description of the change and, for widget
   changes, a screenshot (`npm run screenshot <widget>`) of what it looks like.

## Commit messages

Keep them short and in the imperative mood (e.g. `Add battery-status widget`, not
`Added` or `Adding`).

## Code style

- Widgets (`widgets/**`) are plain, self-contained HTML/CSS/JS — no build step, no
  external runtime dependencies (per iCUE's requirements, see
  [docs/ICUE_WIDGET_FORMAT.md](docs/ICUE_WIDGET_FORMAT.md)). They're intentionally
  excluded from ESLint since iCUE's runtime requires patterns (bare global
  assignment, no `'use strict'`) that standard lint rules would flag.
- Tooling (`tools/*.js`) is plain ESM Node, linted/formatted like any other JS.
- No comments explaining _what_ code does; only ones explaining a non-obvious _why_.
