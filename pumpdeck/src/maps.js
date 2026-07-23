// Theme / sensor / panel-name maps for the PumpDeck widget.
// Values extracted verbatim from the PumpDeck.html mockup (designs/PumpDeck.html).

/** @typedef {import('./types.js').Theme} Theme */
/** @typedef {import('./types.js').PanelType} PanelType */
/** @typedef {import('./types.js').SensorKey} SensorKey */

/** Accent colour per theme. */
export const THEME_ACCENT = {
  amber: '#ffb020',
  ember: '#ff5a2c',
  toxic: '#7dff4d',
  cyan: '#33e1ff',
  magenta: '#ff4bd8',
  ice: '#dfe9ff',
};

/** Human label per theme, used by the configurator swatches. */
export const THEME_NAMES = {
  amber: 'Amber',
  ember: 'Ember',
  toxic: 'Toxic Green',
  cyan: 'Cyber Cyan',
  magenta: 'Magenta',
  ice: 'Ice White',
};

/** Display name per panel type. */
export const TYPE_NAMES = {
  temp: 'CPU · GPU Temp',
  load: 'System Load',
  pump: 'Pump / Fan',
  network: 'Network',
  fps: 'FPS',
  clock: 'Clock',
  text: 'Text ticker',
  gauge: 'Single gauge',
  off: 'Standby / idle',
};

/** unit / min / max / label per sensor, used by panels and the gauge. */
export const SENSOR_META = {
  cpuTemp: { label: 'CPU Temp', unit: '°C', min: 25, max: 95 },
  gpuTemp: { label: 'GPU Temp', unit: '°C', min: 25, max: 95 },
  cpuLoad: { label: 'CPU Load', unit: '%', min: 0, max: 100 },
  gpuLoad: { label: 'GPU Load', unit: '%', min: 0, max: 100 },
  rpm: { label: 'Pump RPM', unit: '', min: 0, max: 2600 },
  netDown: { label: 'Net Down', unit: 'Mbps', min: 0, max: 1000 },
  netUp: { label: 'Net Up', unit: 'Mbps', min: 0, max: 500 },
  fps: { label: 'FPS', unit: '', min: 0, max: 360 },
};

/** Canonical ordering of the eight panel types. */
export const PANEL_TYPES = /** @type {PanelType[]} */ ([
  'temp',
  'load',
  'pump',
  'network',
  'fps',
  'clock',
  'text',
  'gauge',
  'off',
]);

/** Canonical ordering of the seven sensor keys. */
export const SENSOR_KEYS = /** @type {SensorKey[]} */ ([
  'cpuTemp',
  'gpuTemp',
  'cpuLoad',
  'gpuLoad',
  'rpm',
  'netDown',
  'netUp',
  'fps',
]);

/** Which sensors each multi-metric panel can choose between (for `Panel.metrics`). */
export const PANEL_METRICS = {
  temp: /** @type {SensorKey[]} */ (['cpuTemp', 'gpuTemp']),
  load: /** @type {SensorKey[]} */ (['cpuLoad', 'gpuLoad']),
  network: /** @type {SensorKey[]} */ (['netDown', 'netUp']),
};

/** Default sensor feed — the demo values from the mockup. */
export const DEFAULT_SENSORS = {
  cpuTemp: 61,
  gpuTemp: 54,
  cpuLoad: 42,
  gpuLoad: 73,
  rpm: 1450,
  netDown: 118,
  netUp: 12,
  fps: 144,
};

/** Default rotation — the seven-slot set the mockup ships with. */
export const DEFAULT_PANELS = [
  { type: 'temp', duration: 4 },
  { type: 'load', duration: 4 },
  { type: 'pump', duration: 4 },
  { type: 'network', duration: 4 },
  { type: 'clock', duration: 5 },
  {
    type: 'text',
    duration: 7,
    text: 'SYNGENTA · AGINSIGHTS · RYZEN 5 9600X · RX 9070 XT',
  },
  { type: 'off', duration: 4 },
];

export const DEFAULT_THEME = 'amber';
export const DEFAULT_DEVICE_LABEL = 'PUMP DECK';
