// Public type surface for the PumpDeck widget.
// The runtime is plain JS (no build step); these types document the API and give
// editors/TS consumers full IntelliSense when the package is imported.

export type Theme = 'amber' | 'ember' | 'toxic' | 'cyan' | 'magenta' | 'ice';

export type PanelType =
  'temp' | 'load' | 'pump' | 'network' | 'fps' | 'clock' | 'text' | 'gauge' | 'off';

export type SensorKey =
  'cpuTemp' | 'gpuTemp' | 'cpuLoad' | 'gpuLoad' | 'rpm' | 'netDown' | 'netUp' | 'fps';

export interface Panel {
  /** One of the panel types. */
  type: PanelType;
  /** Seconds this panel shows before auto-cycle advances, 1–30. */
  duration: number;
  /** Optional overlay label (temp / load / pump / network / gauge). */
  label?: string;
  /** Ticker text (only used when `type === 'text'`). */
  text?: string;
  /** Sensor source (only used when `type === 'gauge'`). */
  sensor?: SensorKey;
  /**
   * Which metrics a multi-metric panel shows. Applies to `temp`
   * (`cpuTemp`/`gpuTemp`), `load` (`cpuLoad`/`gpuLoad`) and `network`
   * (`netDown`/`netUp`). Omit for "both". A single selected metric renders larger.
   */
  metrics?: SensorKey[];
}

export type Sensors = Record<SensorKey, number>;

export interface PumpDeckProps {
  /** Rotation order, up to 8 panels. */
  panels: Panel[];
  /** Live sensor values, updated by the host. */
  sensors: Sensors;
  /** Accent theme. Default `'amber'`. */
  theme?: Theme;
  /** Small label near the bottom of the bezel. */
  deviceLabel?: string;
  /** Advance by each panel's duration. Default `true`. */
  autoCycle?: boolean;
  /** Rendered px of the bezel. Default `460`; glass ≈ size − 44. */
  size?: number;
  /** Controlled panel index. When set, auto-cycle is disabled. */
  activeIndex?: number;
  /** Fired when the visible panel changes. */
  onActiveChange?: (index: number) => void;
}

export interface ThemeMeta {
  amber: string;
  ember: string;
  toxic: string;
  cyan: string;
  magenta: string;
  ice: string;
}

export interface SensorMeta {
  label: string;
  unit: string;
  min: number;
  max: number;
}

export const THEME_ACCENT: Record<Theme, string>;
export const THEME_NAMES: Record<Theme, string>;
export const TYPE_NAMES: Record<PanelType, string>;
export const SENSOR_META: Record<SensorKey, SensorMeta>;
export const PANEL_TYPES: PanelType[];
export const SENSOR_KEYS: SensorKey[];
export const PANEL_METRICS: { temp: SensorKey[]; load: SensorKey[]; network: SensorKey[] };
export const DEFAULT_SENSORS: Sensors;
export const DEFAULT_PANELS: Panel[];
export const DEFAULT_THEME: Theme;
export const DEFAULT_DEVICE_LABEL: string;

/**
 * `<pump-deck>` custom element. Configure via properties (rich data) or
 * attributes (scalars). Emits an `activechange` CustomEvent<{ index: number }>.
 */
export class PumpDeck extends HTMLElement {
  panels: Panel[];
  sensors: Sensors;
  theme: Theme;
  deviceLabel: string;
  autoCycle: boolean;
  size: number;
  /** Controlled index; `null` for uncontrolled (auto-cycle). */
  activeIndex: number | null;
  onActiveChange: ((index: number) => void) | null;
}

/** `<pump-deck-configurator>` — the PC-side setup UI wired to a live preview. */
export class PumpDeckConfigurator extends HTMLElement {
  /** Storage key for localStorage persistence. Default `'pumpdeck.config'`. */
  storageKey: string;
  /** Current config (panels + theme + deviceLabel + autoCycle). */
  getConfig(): {
    panels: Panel[];
    theme: Theme;
    deviceLabel: string;
    autoCycle: boolean;
  };
  setConfig(config: {
    panels?: Panel[];
    theme?: Theme;
    deviceLabel?: string;
    autoCycle?: boolean;
  }): void;
}
