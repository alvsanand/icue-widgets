# iCUE probes

Diagnostic widgets you load **inside real iCUE on Windows** to observe its
runtime directly — the ground truth that [tools/icue-mock.js](../icue-mock.js) is
modelled on. They are not shipped widgets, so they live here (outside `widgets/`)
and are excluded from `npm test` and `npm run package`.

## Installing a probe

iCUE loads a bare `.html` dropped into its widgets directory (no manifest needed
for a dev probe). Copy the file in and restart iCUE:

```
C:\Program Files\Corsair\Corsair iCUE5 Software\widgets\
```

## api-probe.html — capture the live API surface

Enumerates `window.iCUE`, the Qt WebChannel backend, the globals iCUE injects
(`tick`, `applyData`, `mediaSession`, …), the media-session property, the
**Sensors Data Provider** (every method on `plugins.Sensorsdataprovider` and
which sensor categories — `temperature`, `load`, … — resolve to a real default
block on this machine), and the **FPS Data Provider**
(`plugins.Fpsdataprovider`). Then it lets you export the report.

1. `npm run probe:server` (on the same machine as iCUE)
2. Load `api-probe.html` **in iCUE** — copy it into iCUE's widgets directory and
   restart iCUE (see _Installing a probe_ above). It must run inside iCUE's
   embedded Chromium; opening the file in a normal browser (or VS Code's Simple
   Browser) shows everything as `NOT FOUND` / `undefined` because none of the
   iCUE runtime exists there.
3. Click **POST to localhost:9876** — the report is saved to
   `tools/probes/api-probe-results.txt`.

**Checking FPS:** FPS is **not** a sensor — look at the `FPS plugin` section.
`Fpsdataprovider: EXISTS` means the FPS plugin is installed; enumerate confirms
`getCurrentFps` / `getFpsAvailable` / `getCurrentProcess`. iCUE only produces a
live FPS number while a game it recognizes is rendering in the foreground, so
probe with a game running.

Re-run this whenever iCUE's framework version changes, then reconcile any
differences into `tools/icue-mock.js` and `docs/ICUE_WIDGET_FORMAT.md`.

## viewport-probe.html — confirm device geometry

Shows the live `innerWidth × innerHeight`, aspect ratio, and DPR, and logs
`resize` / lifecycle events. Use it to verify the real resolution of a slot or
device against the table in `docs/ICUE_WIDGET_FORMAT.md`.
