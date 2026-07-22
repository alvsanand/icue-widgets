# hello-world

Minimal example widget for the pump LCD (480x480, circular). Big bold black text
on a white background. Use this as the template for new widgets — see
[docs/CREATING_A_WIDGET.md](../../docs/CREATING_A_WIDGET.md).

## See it

Simplest: open `index.html` directly in any browser.

Exact-size PNG (matches the real device resolution):

```bash
npm run screenshot hello-world
```

## Files

- `index.html` — the widget itself: self-contained HTML/CSS/JS, no build step, no
  external dependencies (per iCUE's requirements).
- `manifest.json` — widget metadata (id, name, target device, versions).
- `resources/icon.svg` — vector source for the widget's icon. Run
  `npm run icon hello-world` to (re)generate `icon.png` / `icon@2x.png` from it.
