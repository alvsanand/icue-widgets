# CLAUDE.md

Guidance for Claude Code when working in this repo.

## What this is

Custom iCUE widgets for LCD pumps (pump-cap screens). Widgets follow iCUE's real
widget format: each is a self-contained `index.html` + `manifest.json` under
`widgets/<name>/`, loaded directly by iCUE's embedded Chromium — no build step, no
bundler, no shared runtime dependency between widgets.

**Full spec:** [docs/ICUE_WIDGET_FORMAT.md](docs/ICUE_WIDGET_FORMAT.md). Read it
before writing or editing a widget — it documents the manifest schema, required
meta tags, lifecycle hooks, and device/slot resolutions, all confirmed by
examining a public open-source widget collection (Corsair's own docs are
apparently NDA-gated). Anything not in that doc should be treated as unconfirmed;
don't invent iCUE API details.

## Do not repeat this mistake

An earlier version of this repo (and this file) claimed there was "no confirmed
public Corsair API" for LCD widgets and built a fictional Node.js
`WidgetRuntime`/`IcueAdapter` abstraction as a workaround. That was wrong — iCUE
does have a real widget framework, just not a callable SDK; it's a webview/manifest
system (closer to a browser extension than an API). That abstraction has been
removed. Don't reintroduce a Node "runtime" layer for widget rendering — widgets
are plain HTML/CSS/JS, full stop.

Note the distinction: `tools/icue-mock.js` is **test-only** tooling. It
reproduces the real bootstrap script iCUE injects (captured verbatim via
`tools/probes/api-probe.html`) so widgets can be loaded in headless Chromium for
`npm test`/`npm run screenshot`. Widgets never import it or depend on it at
runtime — it exists only to stand in for iCUE outside iCUE. That is not the
forbidden abstraction.

## Conventions

- Widget code (`widgets/**`): plain HTML/CSS/JS, no build step, self-contained (no
  external `<script src>`/`<link>` fetched at runtime — embed everything). Must
  follow iCUE's runtime requirements: bare global assignment for `icueEvents` (no
  `var`), never `'use strict'` (breaks iCUE's `eval()`-based property injection).
  Excluded from **both ESLint and Prettier** (`widgets/**` in `.prettierignore`):
  Prettier lowercases `<!DOCTYPE html>` and rewrites void tags as self-closing
  (`<meta ... />`), which iCUE's import parser can't read — it fails with
  "Missing title element". Widget HTML must match known-good widgets: uppercase
  `<!DOCTYPE html>`, non-self-closed void tags (`<meta ...>`, `<link ...>`), and a
  `tr('...')`-wrapped `<title>`.
- Tooling (`tools/*.js`): plain ESM Node, linted/formatted normally.
- No comments explaining _what_ code does — only non-obvious _why_.

## Commands

```bash
npm install                      # installs tool deps (puppeteer, archiver, eslint, prettier)
npm run lint                     # eslint tools/*.js
npm run format:check             # prettier --check .
npm run validate                 # check every widgets/*/manifest.json
npm test                         # load every widget in headless Chromium (through the iCUE mock), fail on JS errors
npm run test:unit                # run widgets/*/logic.test.mjs against each widget's @testable region
npm run screenshot <widget> [SLOT] [--data '<json>']   # PNG preview at a real device resolution (default PUMP 480x480)
npm run icon <widget>             # rasterize resources/icon.svg -> icon.png / icon@2x.png
npm run package                  # package every widget (dist/<w>.zip + .icuewidget) + dist/all-widgets.zip
npm run package -- <widget>      # package just one widget (uses the `zip` CLI; see build-release.sh)
npm run probe:server             # receive API-probe results from tools/probes/api-probe.html running in real iCUE
```

## Adding a widget

Follow [docs/CREATING_A_WIDGET.md](docs/CREATING_A_WIDGET.md): copy
`widgets/hello-world`, edit `manifest.json` + `index.html`, generate icons,
preview, validate, package.
