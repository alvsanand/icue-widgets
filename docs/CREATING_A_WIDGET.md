# Creating a widget

1. Copy the `hello-world` template:

   ```bash
   cp -r widgets/hello-world widgets/<your-widget>
   ```

2. Edit `widgets/<your-widget>/manifest.json`:
   - `id`: `com.yourname.yourwidget` (lowercase reverse-domain)
   - `name`, `description`, `version` (start at `1.0.0`)
   - `supported_devices`: `pump_lcd`, `dashboard_lcd`, or `keyboard_lcd` — see
     [ICUE_WIDGET_FORMAT.md](./ICUE_WIDGET_FORMAT.md#target-devices) for
     resolutions per device

3. Edit `widgets/<your-widget>/index.html`:
   - Update the `x-icue-restrictions` meta tag's device to match your manifest
   - Replace the content — keep it self-contained (no external `<script src>` or
     `<link>` fetched at runtime; embed everything)
   - If you need user-configurable settings, add `x-icue-property` meta tags —
     see the reference doc for the required attributes per type

4. Replace `resources/icon.svg` with your own mark, then generate the PNGs:

   ```bash
   npm run icon <your-widget>
   ```

5. Look at it:

   ```bash
   # simplest — just open it in any browser:
   open widgets/<your-widget>/index.html      # or your OS's equivalent

   # or an exact-size PNG at a real device resolution:
   npm run screenshot <your-widget>            # defaults to PUMP (480x480)
   npm run screenshot <your-widget> HM          # or a dashboard_lcd slot, etc.
   ```

   Both `npm test` and `npm run screenshot` load the widget through a mock of
   iCUE's runtime ([tools/icue-mock.js](../tools/icue-mock.js)) — `onInit` /
   `onDataUpdated` fire and your `x-icue-property` values are injected just like
   on-device. Feed test values with `--data`:

   ```bash
   npm run screenshot <your-widget> PUMP --data '{"textColor":"#ff0000"}'
   ```

6. (Optional) Unit-test the widget's logic. Wrap side-effect-free code (math,
   parsing, formatting — no DOM, no iCUE calls) in markers inside `index.html`:

   ```js
   // @testable-start
   function formatValue(n) {
     /* ... */
   }
   // @testable-end
   ```

   Add `widgets/<your-widget>/logic.test.mjs`:

   ```js
   import { loadTestable } from '../../tools/lib/testable.js';
   import { check } from '../../tools/lib/assert.js';

   const { formatValue } = loadTestable('<your-widget>', ['formatValue']);
   check('formats zero', formatValue(0) === '0');
   ```

   Run with `npm run test:unit`.

7. Validate the manifest:

   ```bash
   npm run validate
   ```

8. Package it for install/distribution (needs the `zip` CLI —
   `sudo apt install -y zip` on Linux):

   ```bash
   npm run package -- <your-widget>    # or: npm run package (packages all widgets)
   ```

   This produces `dist/<your-widget>.zip` (folder-wrapped, for manual copy into
   iCUE's widgets directory) and `dist/<your-widget>.icuewidget` (flat, for
   iCUE's import button or double-click install). iCUE only runs on Windows —
   actually installing and testing on the device requires a Windows machine with
   iCUE installed.

9. Before committing, run the full check:

   ```bash
   npm run format:check && npm run lint && npm run validate && npm test && npm run test:unit
   ```
