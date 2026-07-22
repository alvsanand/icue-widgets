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
(`tick`, `applyData`, `mediaSession`, …), and the media-session property, then
lets you export the report.

1. `npm run probe:server` (on the same machine as iCUE)
2. Load `api-probe.html` in iCUE.
3. Click **POST to localhost:9876** — the report is saved to
   `tools/probes/api-probe-results.txt`.

Re-run this whenever iCUE's framework version changes, then reconcile any
differences into `tools/icue-mock.js` and `docs/ICUE_WIDGET_FORMAT.md`.

## viewport-probe.html — confirm device geometry

Shows the live `innerWidth × innerHeight`, aspect ratio, and DPR, and logs
`resize` / lifecycle events. Use it to verify the real resolution of a slot or
device against the table in `docs/ICUE_WIDGET_FORMAT.md`.
