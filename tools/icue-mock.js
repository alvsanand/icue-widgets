// A stand-in for the runtime iCUE injects into every widget's page, so widgets
// can be loaded, tested, and screenshotted outside iCUE with realistic data.
//
// The contract below is not invented: it mirrors the real bootstrap script iCUE
// evals into the page (captured verbatim by tools/probes/api-probe.html — see
// tools/probes/README.md). Key points it reproduces:
//   - `iCUE_initialized`, `tick_start`/`tick_offset`, `tick()`, `updateTick()`
//   - `icueEvents = { onICUEInitialized, onDataUpdated, onUpdateRequested }`
//   - each `x-icue-property` and the media-session globals injected as bare
//     top-level lexical bindings (so the widget reads them as plain identifiers)
//   - `applyData()` re-assigns those bindings then fires onDataUpdated
//   - `window.iCUE` helper object and `window.tr()`
//
// It MUST be injected as a raw source string (page.evaluateOnNewDocument with a
// string), not a function: the widget assigns `icueEvents` with a bare global
// (no `var`), which only reaches our declaration if ours is a top-level `let` in
// a classic script sharing the global lexical environment — a function-wrapped
// injection would put `let icueEvents` in function scope and the two would never
// meet. This is the same reason CLAUDE.md forbids `var icueEvents` in widgets.

const RESERVED_GLOBALS = {
  mediaSession: 'null',
  uniqueId: '"mock-unique-id"',
  widgetPersonalizationCustomStylePresent: 'false',
};

const META_RE = /<meta\b[^>]*\bname=["']x-icue-property["'][^>]*>/gi;

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)')`, 'i'));
  if (!m) return undefined;
  return m[1] !== undefined ? m[1] : m[2];
}

export function parseWidgetProperties(html) {
  const props = [];
  for (const tag of html.match(META_RE) || []) {
    const name = attr(tag, 'content');
    if (!name) continue;
    props.push({ name, defaultExpr: attr(tag, 'data-default') });
  }
  return props;
}

// data: optional { <propName>: value, mediaSession: {...}, ... } overrides.
export function buildBootstrap({ properties = [], data = {} } = {}) {
  const decls = new Map();

  for (const [name, defaultLiteral] of Object.entries(RESERVED_GLOBALS)) {
    decls.set(name, `let ${name} = ${defaultLiteral};`);
  }

  for (const { name, defaultExpr } of properties) {
    if (Object.prototype.hasOwnProperty.call(data, name)) continue;
    if (defaultExpr) {
      // Default expressions may reference iCUE.* / tr(); guard so one bad
      // default doesn't abort the whole bootstrap and break the widget.
      decls.set(
        name,
        `let ${name}; try { ${name} = (${defaultExpr}); } catch (e) { console.warn('icue-mock: default for ${name} failed', e); }`,
      );
    } else {
      decls.set(name, `let ${name};`);
    }
  }

  for (const [name, value] of Object.entries(data)) {
    decls.set(name, `let ${name} = ${JSON.stringify(value)};`);
  }

  const applyLines = [...decls.keys()].map(
    (name) =>
      `  if (Object.prototype.hasOwnProperty.call(d, ${JSON.stringify(name)})) ${name} = d[${JSON.stringify(name)}];`,
  );

  return `
let iCUE_initialized = false;
let tick_offset = 0;
let tick_start = Date.now();
${[...decls.values()].join('\n')}
let icueEvents = { onICUEInitialized: null, onDataUpdated: null, onUpdateRequested: null };

function updateTick(value) { tick_offset = value; tick_start = Date.now(); }
function tick() { return Date.now() - tick_start + tick_offset; }

window.iCUE = {
  allTimeZones: function () { return [{ key: 'UTC', value: 'UTC' }]; },
  default24HourFormat: function () { return true; },
  defaultTimeZone: function () { return 'UTC'; },
  defaultTemperatureUnit: function () { return 'C'; },
  defaultSpeedUnit: function () { return 'kmh'; },
  formatUserLocaleDate: function (d) { return new Date(d || Date.now()).toLocaleDateString(); },
  formatUserLocaleTime: function (d) { return new Date(d || Date.now()).toLocaleTimeString(); },
  fpsLimit: 10,
  iCUELanguage: 'en',
  ipRegistryApiKey: '',
};
if (typeof window.tr !== 'function') window.tr = function (s) { return s; };

function applyData(d) {
${applyLines.join('\n')}
  if (iCUE_initialized && typeof icueEvents.onDataUpdated === 'function') icueEvents.onDataUpdated();
}
function requestUpdate() {
  if (iCUE_initialized && typeof icueEvents.onUpdateRequested === 'function') icueEvents.onUpdateRequested();
}

// Test/preview hooks: push a data update or trigger an update-request at will.
window.__icueMock = {
  apply: applyData,
  requestUpdate: requestUpdate,
  setTick: updateTick,
};

window.addEventListener('load', function () {
  iCUE_initialized = true;
  if (typeof icueEvents.onICUEInitialized === 'function') icueEvents.onICUEInitialized();
  if (typeof icueEvents.onDataUpdated === 'function') icueEvents.onDataUpdated();
});
`;
}

// Convenience: read a widget's HTML, build the matching bootstrap, and install
// it so it runs before any of the widget's own scripts. Pass `data` to override
// property values / media session.
export async function injectICUEMock(page, html, data = {}) {
  const bootstrap = buildBootstrap({ properties: parseWidgetProperties(html), data });
  await page.evaluateOnNewDocument(bootstrap);
}
