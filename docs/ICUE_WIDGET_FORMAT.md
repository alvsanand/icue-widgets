# iCUE widget format

> **Sourcing note:** Corsair's own widget documentation appears to be gated behind
> an NDA "WidgetBuilder kit". Everything below was derived by examining a public,
> open-source community widget collection
> ([QuadraKev/QK-iCUE-Widgets](https://github.com/QuadraKev/QK-iCUE-Widgets)) —
> not from Corsair's own docs. The manifest schema, meta tags, and lifecycle hooks
> are load-bearing (widgets fail to load without them) and were seen consistently
> across ~20 widgets, so treat those as reliable. Anything described as a
> "convention" below is that project's own house style, not a requirement — verify
> against real iCUE behavior if in doubt.

## What a widget is

Not a compiled app, not something you run — a folder that iCUE's own embedded
browser (Qt WebEngine / Chromium) loads directly from disk. No bundler, no build
step: `index.html` must be self-contained (inline or embedded CSS/JS/fonts, no
external `<script src>`/`<link>` fetched at runtime).

```
widgets/<name>/
  index.html          required — the widget itself
  manifest.json        required — metadata (see below)
  icon.png              256x256, referenced by manifest "preview_icon"
  icon@2x.png            512x512
  resources/            optional — svg icons, images, embedded fonts live here
  modules/*.mjs          optional — ES modules with synchronous exports, usable in
                          manifest data-default/data-values expressions
  translation.json       optional — only if the widget calls tr(); see caveat below
```

## manifest.json

All fields below are required (confirmed present across every example widget):

```json
{
  "author": "yourname",
  "id": "com.yourname.widgetname",
  "name": "Widget Name",
  "description": "One sentence.",
  "version": "1.0.0",
  "preview_icon": "icon.png",
  "min_framework_version": "1.0.0",
  "os": [{ "platform": "windows" }],
  "supported_devices": [{ "type": "pump_lcd" }],
  "min_app_version": "5.45"
}
```

- `id` — lowercase reverse-domain, e.g. `com.yourname.widgetname`.
- `supported_devices[].type` — one of `pump_lcd`, `dashboard_lcd`, `keyboard_lcd`.
  Can optionally include `"features": ["sensor-screen"]` to further restrict to
  devices with that capability.
- `os` — only `{"platform":"windows"}` is accepted by iCUE 5.x import as of the
  reference project's notes (macOS entries are rejected).
- `interactive` (optional) — must be `true` here **and** the HTML must also carry
  `<meta name="x-icue-interactive">` for a touch-interactive widget to work.

## Target devices

| Device                         | `supported_devices` type | Resolution                                | Notes                                                                                   |
| ------------------------------ | ------------------------ | ----------------------------------------- | --------------------------------------------------------------------------------------- |
| Xeneon Edge (touchscreen bar)  | `dashboard_lcd`          | 2560x720, 32:9                            | touch-interactive widgets possible                                                      |
| Pump LCD (cooler pump cap)     | `pump_lcd`               | 480x480, circular                         | **non-interactive only**; keep content within ~85% radius, it gets clipped outside that |
| Keyboard LCD (VANGUARD series) | `keyboard_lcd`           | 320x170 physical, 248x170 widget viewport | 2-4 FPS only — animation is impractical                                                 |

### Xeneon Edge slot sizes

A dashboard_lcd widget gets sized to whichever slot the user picks:

| Slot | Resolution | Orientation |
| ---- | ---------- | ----------- |
| HS   | 840x344    | horizontal  |
| HM   | 840x696    | horizontal  |
| HL   | 1688x696   | horizontal  |
| HXL  | 2536x696   | horizontal  |
| VS   | 696x416    | vertical    |
| VM   | 696x840    | vertical    |
| VL   | 696x1688   | vertical    |
| VXL  | 696x2536   | vertical    |

Use `min-aspect-ratio`/`max-aspect-ratio` media queries to adapt layout — not
`min-height`/`max-height` — because iCUE's picker preview renders at a scaled-down
resolution that preserves aspect ratio but not absolute pixel size.

## HTML requirements

- **`<title>` must be `tr('...')`, not plain text.** iCUE resolves the title
  through its expression/`tr()` pipeline at import time, so
  `<title>tr('Hello World')</title>` works but `<title>Hello World</title>` does
  not — a bare multi-word string isn't a valid expression, and iCUE rejects the
  import with the misleading _"Unsupported or corrupted file. Missing title
  element."_ Every shipping widget wraps its title in `tr()`. (This corrects
  earlier guidance in this repo that claimed plain title strings were fine.)
- **Device targeting:** `<meta name="x-icue-restrictions" data-restrictions='[{"device":"pump_lcd"}]'>`
- **User-configurable settings:** one `<meta name="x-icue-property">` tag per
  setting, e.g.:
  ```html
  <meta
    name="x-icue-property"
    content="textColor"
    data-label="tr('Text Color')"
    data-type="color"
    data-default="'#000000'"
  />
  ```
  `content` (the property's variable name) must be Latin letters/digits only — no
  underscores or hyphens. Common `data-type` values: `switch`, `slider` (requires
  `data-min`/`data-max`/`data-step` together, or the widget is silently rejected
  from the picker), `color`, `combobox` (requires `key`/`value` pairs in
  `data-values`, not `title`/`value`), `tab-buttons`, `textfield`,
  `media-selector` (requires `data-filters`, e.g.
  `data-filters="['*.png','*.jpg']"`, or the _entire widget_ is silently rejected).
  Each property becomes a bare global variable at runtime (e.g. `textColor`).
- **Grouping settings:**
  ```html
  <script type="application/json" id="x-icue-groups">
    [{ "title": "tr('Settings')", "properties": ["textColor"] }]
  </script>
  ```
- **Lifecycle** — bare assignment, no `var`:
  ```html
  <script>
    function onInit() {
      /* runs once iCUE has injected property values */
    }
    function onDataUpdated() {
      /* runs whenever a property changes */
    }
    icueEvents = { onICUEInitialized: onInit, onDataUpdated: onDataUpdated };
    if (typeof iCUE_initialized === 'undefined' || iCUE_initialized) onInit();
  </script>
  ```
  The last line makes the widget also initialize itself when opened standalone in
  a plain browser (`iCUE_initialized` is only ever defined by iCUE's own runtime).
- **Never use `'use strict'`.** iCUE injects property values via `eval()`-based
  bare global assignment; strict mode breaks it silently.
- **Never declare `icueEvents`/`iCUE_initialized` with `var`** — that can
  overwrite iCUE's own bootstrap flag.
- Add `-webkit-tap-highlight-color: transparent;` to `body` — without it,
  Chromium shows a dark tap-flash overlay on any click/touch.

## Install / distribution

- **Manual (dev machine, Windows only — iCUE doesn't run elsewhere):** copy the
  widget folder into `C:\Program Files\Corsair\Corsair iCUE5 Software\widgets\`,
  restart iCUE.
- **`.icuewidget` file:** a zip of the widget's installable files (`index.html`,
  `manifest.json`, and if present `translation.json`, `resources/`, `modules/`)
  at the **zip root** (flat, no wrapping folder). Double-click in Windows Explorer
  (associated with iCUE) or import via iCUE's **+** button. `npm run package
<widget-name>` builds this. Note `icon.png` / `icon@2x.png` are **not** in the
  archive — they're listing/marketplace art (referenced by `preview_icon`), and
  iCUE's importer rejects the archive if they're present.

  **Use the `zip` CLI to build it** — iCUE's importer uses Qt's zip reader, which
  is strict in ways many zip libraries are not, and the Info-ZIP `zip` CLI is the
  encoder known to import cleanly. `tools/build-release.sh` shells out to it (as
  the reference project does); this is why `npm run package` needs `zip`
  installed. Don't reimplement packaging with a streaming zip library — two
  concrete failure modes we hit doing that:

  - **Streaming "data descriptor" records** (general-purpose flag bit 0x08 set,
    CRC/size = 0 in the local header, real values only in a trailing descriptor).
    Qt reads the zero-length local header, extracts an empty `index.html`, and
    reports the misleading _"Unsupported or corrupted file. Missing title
    element."_ `archiver` and most streaming libraries produce exactly this.
  - **Missing directory entries / non-Unix attributes.** Qt wants explicit entries
    for every subfolder (e.g. `resources/`) and Unix host + permission bits in the
    central directory — which `zip` writes and hand-rolled writers often don't.

  `icon.png` / `icon@2x.png` are listing art (referenced by manifest
  `preview_icon`), not part of the installable widget; the reference project
  omits them from the archive, so `build-release.sh` packages only `index.html`,
  `manifest.json`, and any `translation.json` / `resources/` / `modules/`.

## translation.json (required — every widget uses `tr()`)

Because the `<title>` and every `data-label` must be `tr('...')` (see HTML
requirements above), every widget ships a `translation.json`. Format: a nested
`"translation"` key per language — `{"en": {"translation": {"Key": "Value"}}}`.
Rules learned from the reference project:

- A **flat** `{"en": {"Key": "Value"}}` (no `"translation"` nesting) causes
  silent widget rejection.
- An **empty** `"en"` section (`{"en": {"translation": {}}}`) makes iCUE flood
  `Default language not found` warnings that can crash it — `en` must be
  non-empty.
- `en` does **not** need every key: `tr('X')` falls back to the literal `X` when
  a key is absent, so a couple of entries are enough to keep `en` non-empty.

`hello-world` ships a minimal `translation.json` with a populated `en` section.
