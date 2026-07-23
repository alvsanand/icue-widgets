# PumpDeck

A round **480×480 pump-head LCD widget** styled after the iCUE look, extracted
from the `PumpDeck.html` mockup and turned into a reusable, embeddable component
plus a matching configurator UI.

> This is a standalone **visual recreation** of that style of pump LCD. It is
> **not** the actual iCUE software and does not talk to real Corsair hardware —
> sensor values are just inputs you pass in.

## Stack — and why

Plain **vanilla Web Components** (Custom Elements), authored as ES modules, **no
build step**:

- `<pump-deck>` — the round LCD widget
- `<pump-deck-configurator>` — the PC-side setup screen wired to a live preview

Why: the brief called for a _small, dependency-light, droppable_ widget with
inline styling and all state internal. A framework-agnostic custom element drops
into any page (React, Vue, plain HTML) with a single `<script type="module">`,
ships zero runtime dependencies, uses Shadow DOM so its styles never leak, and
needs no bundler. Types are provided as a hand-written `src/types.d.ts` for
TypeScript consumers. (This also matches the host repo's no-build widget ethos.)

## Run the demo

Because the files are ES modules, serve the folder over HTTP (module imports are
blocked on `file://`):

```bash
cd pumpdeck
python3 -m http.server 8000     # or: npx serve .
# open http://localhost:8000/
```

The demo mounts the configurator (which contains a live `<pump-deck>` preview)
and runs a `setInterval` that gently wanders the demo sensor feed so every panel
animates on its own.

## Files

| File                            | What                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------- |
| `src/pump-deck.js`              | The `<pump-deck>` widget — bezel, glass, all 8 panels, auto-cycle, fan spin. |
| `src/pump-deck-configurator.js` | The `<pump-deck-configurator>` setup UI.                                     |
| `src/maps.js`                   | `THEME_ACCENT`, `THEME_NAMES`, `TYPE_NAMES`, `SENSOR_META`, defaults.        |
| `src/types.d.ts`                | Public TypeScript types.                                                     |
| `index.html`                    | Demo page (configurator + sensor nudger).                                    |

## Fonts

The readouts use **Barlow Condensed** and **Share Tech Mono** (Google Fonts).
`<pump-deck>` injects the Google Fonts `<link>` into `document.head` on first
connect, so it works with no host setup. To avoid a flash you may preload them
yourself:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700&family=Share+Tech+Mono&display=swap"
/>
```

## Embedding just the widget (no configurator)

```html
<script type="module" src="pumpdeck/src/pump-deck.js"></script>

<pump-deck id="deck" theme="cyan" device-label="PUMP DECK"></pump-deck>

<script type="module">
  const deck = document.getElementById('deck');

  // Rich data goes through properties:
  deck.panels = [
    { type: 'temp', duration: 4 },
    { type: 'load', duration: 4, metrics: ['cpuLoad'] }, // CPU-only, renders larger
    { type: 'gauge', duration: 5, sensor: 'rpm' },
    { type: 'clock', duration: 5 },
    { type: 'text', duration: 7, text: 'HELLO PUMPDECK' },
  ];

  // Feed live values from your own source (poll, WebSocket, etc.):
  deck.sensors = {
    cpuTemp: 61,
    gpuTemp: 54,
    cpuLoad: 42,
    gpuLoad: 73,
    rpm: 1450,
    netDown: 118,
    netUp: 12,
  };

  deck.addEventListener('activechange', (e) => console.log('now showing panel', e.detail.index));
</script>
```

## `<pump-deck>` API

Rich data (`panels`, `sensors`, `onActiveChange`) is set via **properties**;
scalars are also settable via **attributes**.

| Property         | Attribute      | Type                        | Default         | Notes                                                                             |
| ---------------- | -------------- | --------------------------- | --------------- | --------------------------------------------------------------------------------- |
| `panels`         | —              | `Panel[]`                   | 7-slot demo set | Rotation order, up to 8.                                                          |
| `sensors`        | —              | `Record<SensorKey, number>` | demo values     | Live values; re-read on each render.                                              |
| `theme`          | `theme`        | `Theme`                     | `'amber'`       | `amber`\|`ember`\|`toxic`\|`cyan`\|`magenta`\|`ice`. Recolors all glow instantly. |
| `deviceLabel`    | `device-label` | `string`                    | `'PUMP DECK'`   | Small label near the bottom of the bezel.                                         |
| `autoCycle`      | `auto-cycle`   | `boolean`                   | `true`          | Advance by each panel's `duration` (self-correcting timer).                       |
| `size`           | `size`         | `number`                    | `460`           | Rendered px of the bezel; glass ≈ size − 44. Scales proportionally.               |
| `activeIndex`    | `active-index` | `number` \| `null`          | `null`          | When set, the widget is **controlled** and auto-cycle is disabled.                |
| `onActiveChange` | —              | `(i: number) => void`       | `null`          | Also dispatched as `activechange` `CustomEvent<{index}>`.                         |

### `Panel`

```ts
interface Panel {
  type: 'temp' | 'load' | 'pump' | 'network' | 'clock' | 'text' | 'gauge' | 'off';
  duration: number; // seconds, 1–30
  label?: string; // overlay label (temp/load/pump/network/gauge)
  text?: string; // ticker text (type === 'text')
  sensor?: SensorKey; // source (type === 'gauge')
  metrics?: SensorKey[]; // temp/load/network: pick a subset; a single metric renders larger
}
```

### Sensor metadata

| Key                  | Unit | Min | Max  |
| -------------------- | ---- | --- | ---- |
| `cpuTemp`, `gpuTemp` | °C   | 25  | 95   |
| `cpuLoad`, `gpuLoad` | %    | 0   | 100  |
| `rpm`                | —    | 0   | 2600 |
| `netDown`            | Mbps | 0   | 1000 |
| `netUp`              | Mbps | 0   | 500  |

### Panels

- **temp** — two vertical LED "flame" clusters (CPU / GPU) with a °C readout each.
  `metrics: ['cpuTemp']` (or `['gpuTemp']`) shows one, larger.
- **load** — two tall LED bar columns (CPU / GPU), % on top, name below. `metrics`
  narrows to one column.
- **pump** — spinning 7-blade fan (speed derived from `rpm`), RPM readout centered.
- **fps** — large frames-per-second readout for the `fps` sensor + an accent bar.
- **network** — stacked DOWN (accent) + UP (grey) blocks, each with a live
  sparkline. `metrics: ['netDown']` / `['netUp']` shows one.
- **clock** — HH:MM + weekday/date, 12 rim ticks.
- **text** — horizontally scrolling ticker (`text`).
- **gauge** — one big value + unit for `sensor`, plus an accent progress bar.
- **off** — breathing accent dot + "STANDBY".

## `<pump-deck-configurator>` API

Drop it in and it renders the whole setup screen (nav bar, preview + controls,
slot editor):

```html
<pump-deck-configurator storage-key="pumpdeck.config"></pump-deck-configurator>
```

- Persists the config (`panels` / `theme` / `deviceLabel` / `autoCycle`) to
  `localStorage` and restores it on load.
- **Export / Import JSON** buttons in the slot-editor header.
- `getConfig()` / `setConfig(cfg)` — read/replace the config programmatically.
- `sensors` get/set — the demo sensor feed (what the sliders drive); set it to
  animate the preview from your own loop.
