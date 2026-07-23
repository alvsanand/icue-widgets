# pumpdeck

Round pump-cap LCD widget (480x480, circular). Runs a **configurable gallery of
sensor screens in a loop** — flames, bars and sparklines (each on real iCUE
sensors), a fan, a gauge, an FPS readout, a clock and a text ticker — styled like
the iCUE Pump Deck. Self-contained HTML/CSS/JS, no build step, fonts embedded as
base64 (no runtime font fetch). Content is scaled to sit inside the safe circle
(~90% of the face) and centers on whatever canvas iCUE renders it at.

## See it

Open `index.html` directly in any browser, or render at the real device size:

```bash
npm run screenshot pumpdeck
```

## Configuring the rotation (all in iCUE)

The pump LCD is non-touch, so everything is configured on the PC in iCUE's
settings panel, organised into four groups: **Common**, **Screens 1 AND 2**,
**Screens 3 AND 4**, **Screens 5 AND 6**.

**Common**

| Setting            | Type      | Default                                                                                           |
| ------------------ | --------- | ------------------------------------------------------------------------------------------------- |
| Accent theme       | combobox  | `Amber` (`amber`/`ember`/`toxic`/`cyan`/`magenta`/`ice`)                                          |
| Device label       | textfield | `PUMP DECK`                                                                                       |
| Auto-cycle screens | switch    | on — loop through the enabled screens by their duration; off = show only the first enabled screen |

**Screen 1 … Screen 6** — each has `type`, `sensor A`, `sensor B`, `text`, `seconds`:

| Field             | Type             | Notes                                                                                                                          |
| ----------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Screen N type     | combobox         | The visual, or **`None`** to disable it. A disabled screen is skipped — it is **not** replaced by a standby screen.            |
| Screen N sensor A | sensors-combobox | A real iCUE sensor (from the Sensors Data Provider). Used by every data visual.                                                 |
| Screen N sensor B | sensors-combobox | Second sensor, used only by the two-sensor visuals (Flames / Bars / Sparklines).                                               |
| Screen N text     | textfield        | Overlay label for the screen; the scrolling message for a Text ticker.                                                         |
| Screen N seconds  | slider (1–30)    | How long this screen shows before the loop advances. (A slider — iCUE has no numeric-only text field, which would take letters.) |

**Types (visuals):** `Flames (2 sensors)`, `Bars (2 sensors)`,
`Sparklines (2 sensors)` read Sensor A + Sensor B; `Fan (1 sensor)` and
`Gauge (1 sensor)` read Sensor A; `Clock` and `Text ticker` need no sensor. `FPS`
uses **no sensor at all** — it reads iCUE's separate FPS Data Provider plugin
(see _Data providers_ below), showing the live frame rate and foreground game.

> **iCUE has no network sensor.** The available sensor types are temperature,
> pump, fan, load, voltage, current, power, battery and efficiency — there is no
> network throughput sensor or network data provider. Use `Sparklines` with any
> two sensors (e.g. CPU + GPU load); it isn't network-specific.
>
> **FPS is not a sensor.** Frame rate comes from a distinct plugin
> (`window.plugins.Fpsdataprovider`), not the Sensors Data Provider, and only
> reports a value while a game iCUE recognizes is running in the foreground.

- **Enable** a screen → set its Type to anything other than `None`.
- **Disable** a screen → set its Type to `None` (it's dropped from the loop).
- **Order** in the loop = the screen number (Screen 1 first).

Out of the box **Screen 1 is Flames and Screens 2–6 are `None`**. If no screen is
enabled the face is blank.

## Data providers

The widget declares two iCUE plugins in `manifest.json`:

```json
"required_plugins": [
  "widgetbuilder.sensorsdataprovider:Sensors:1.0",
  "widgetbuilder.fpsdataprovider:Fps:1.0"
]
```

- **Sensors** — every non-FPS visual reads `window.plugins.Sensorsdataprovider`
  (`getSensorValue` / `getSensorUnits`, live `sensorValueChanged`), keyed by the
  sensor ID each `sensors-combobox` returns.
- **FPS** — the `FPS` screen reads `window.plugins.Fpsdataprovider` instead
  (`getCurrentFps` / `getFpsAvailable` / `getCurrentProcess`, using the same
  `requestId`/`asyncResponse` pattern, plus the `fpsUpdated` /
  `fpsAvailabilityChanged` / `processChanged` push signals). It shows `--` /
  `NO GAME` when no frame rate is being measured. Docs:
  <https://docs.elgato.com/icue/widgets/references/plugins/fps-data-provider>

> Declaring a plugin that isn't installed on a given iCUE can leave its pickers
> empty; both Sensors and FPS are standard iCUE widget plugins.

When the provider is not present (e.g. the file opened in a plain browser for
preview), the panels fall back to a **simulated feed** so the widget still
animates; the clock always uses the real system time.

> **Needs on-device confirmation:** the wiring follows Elgato's WidgetBuilder docs
> and a working reference widget, but `window.plugins` only exists inside iCUE, so
> only the simulated fallback and the property parsing were tested here.

For a host-driven version with a visual configurator (you pass values in,
drag-reorder, live preview, Export/Import JSON), see the standalone Web Component
in [`../../pumpdeck/`](../../pumpdeck/).

## Files

- `index.html` — the widget: self-contained HTML/CSS/JS, embedded fonts, 33 iCUE
  properties (Common + 6 screens × Type/Sensor A/Sensor B/Text/Seconds), no
  external dependencies. Generated — see note below.
- `manifest.json` — widget metadata.
- `translation.json` — `tr()` strings (title, setting labels, option names).
- `resources/icon.svg` — source art for `icon.png` / `icon@2x.png`.

> `index.html`'s repetitive property tags and embedded fonts were assembled with a
> small generator; the panel-rendering logic mirrors the standalone
> `pumpdeck/src/pump-deck.js` so the two stay visually identical.
