# Architecture

## Widgets are not Node apps

Each widget under `widgets/<name>/` is a self-contained `index.html` (inline
CSS/JS, no bundler, no external requests at runtime) plus a `manifest.json`.
iCUE's own embedded Chromium loads that file directly — there's no server, no
build step, and no shared runtime dependency between widgets. See
[ICUE_WIDGET_FORMAT.md](./ICUE_WIDGET_FORMAT.md) for the full format (manifest
schema, required meta tags, lifecycle hooks, device/slot resolutions).

This repo previously had a Node/TypeScript `WidgetRuntime`/`IcueAdapter`
abstraction simulating widget rendering. That was built before we'd confirmed how
real iCUE widgets work, and doesn't reflect it — it's been removed in favor of
matching the real format directly.

## Repo layout

```
widgets/
  hello-world/        example widget: index.html + manifest.json + resources/icon.svg
docs/
  ICUE_WIDGET_FORMAT.md    the widget spec itself
  CREATING_A_WIDGET.md      how to add one
tools/                 Node scripts that operate ON widgets/ — none of this code
                       ships inside a widget
  screenshot.js         Puppeteer: render a widget's index.html at a real device
                        resolution and save a PNG, for previewing without iCUE
  generate-icon.js       Puppeteer: rasterize resources/icon.svg into icon.png /
                        icon@2x.png
  package-widget.js       zip a widget into dist/<name>.zip and
                        dist/<name>.icuewidget for install/distribution
  validate-manifest.js    checks every widgets/*/manifest.json has the fields
                        iCUE requires
  smoke-test.js           loads every widget in headless Chromium; fails on JS
                        errors or a blank render — this is the closest thing to
                        a "build" check, since there's no compile step
dist/                  generated zip/icuewidget output (gitignored)
```

## Why the tooling is plain Node (no TypeScript)

Widget code itself can't use a build step (iCUE loads the HTML file as-is), so
there was no reason to keep TypeScript/bundling for the repo's own tooling either
— it would be a mismatched abstraction for code that operates on plain HTML/JS.
`tools/*.js` is plain ESM Node, linted with ESLint + Prettier.

`widgets/**` is excluded from ESLint entirely: iCUE's runtime requires patterns
(bare global assignment like `icueEvents = {...}` with no `var`, no `'use strict'`)
that standard JS lint rules would flag as mistakes.
