# icue-widgets

Custom iCUE widgets for LCD pumps (e.g. pump-cap displays).

Each widget is a self-contained `index.html` + `manifest.json`, per iCUE's own
widget format (no build step, no bundler — see
[docs/ICUE_WIDGET_FORMAT.md](docs/ICUE_WIDGET_FORMAT.md)). This repo's `tools/`
scripts help you preview, package, and validate widgets without needing iCUE
installed (it only runs on Windows).

## Prerequisites

- Node.js >= 20 (see `.nvmrc`) — only needed for the `tools/` scripts, not for the
  widgets themselves.
- Linux only: the Chromium that Puppeteer downloads (used by `npm test` and
  `npm run screenshot`) needs a system audio library. If those commands fail with
  `libasound.so.2: cannot open shared object file`, install it:

  ```bash
  sudo apt install -y libasound2
  ```

- `npm run package` uses the `zip` CLI (the encoder iCUE's importer accepts). On
  Linux: `sudo apt install -y zip`. Preinstalled on macOS and the CI runner.

## Setup

```bash
npm install
```

## Quick start: see the hello-world widget

Simplest — just open it in any browser, no tooling required:

```bash
open widgets/hello-world/index.html    # or your OS's equivalent
```

Or render it at the real device resolution (480x480, pump LCD) as a PNG:

```bash
npm run screenshot hello-world
```

## Repo structure

```
widgets/
  hello-world/         example widget: index.html + manifest.json + resources/icon.svg
tools/                 Node scripts that operate on widgets/ (screenshot, icon
                       generation, packaging, manifest validation, smoke test)
docs/                  the widget format spec and how-to guides
.github/workflows/     CI (lint, validate manifests, smoke test on every push/PR)
```

## Common commands (run from repo root)

| Command                              | What it does                                                                                    |
| ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `npm run lint`                       | Lint `tools/*.js`                                                                               |
| `npm run format` / `format:check`    | Format / check formatting with Prettier                                                         |
| `npm run validate`                   | Check every `widgets/*/manifest.json` has the fields iCUE requires                              |
| `npm test`                           | Load every widget in headless Chromium, fail on JS errors or a blank render                     |
| `npm run screenshot <widget> [SLOT]` | Save a PNG of a widget at a real device resolution                                              |
| `npm run icon <widget>`              | Rasterize `resources/icon.svg` into `icon.png` / `icon@2x.png`                                  |
| `npm run package`                    | Package all widgets (`dist/<w>.zip` + `.icuewidget`) + `dist/all-widgets.zip`; `-- <w>` for one |
| `npm run test:unit`                  | Run widget logic unit tests (`widgets/*/logic.test.mjs`)                                        |

## Documentation

- [docs/ICUE_WIDGET_FORMAT.md](docs/ICUE_WIDGET_FORMAT.md) — the widget format
  itself: manifest schema, required HTML meta tags, lifecycle hooks, device/slot
  resolutions, packaging/install.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — repo layout and what the
  `tools/` scripts do.
- [docs/CREATING_A_WIDGET.md](docs/CREATING_A_WIDGET.md) — step-by-step guide to
  adding a new widget.
- [CONTRIBUTING.md](CONTRIBUTING.md) — workflow and code style.
- [CLAUDE.md](CLAUDE.md) — project conventions for AI-assisted contributions.

## License

Apache License 2.0 — see [LICENSE](LICENSE).
