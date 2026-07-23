// <pump-deck-configurator> — the PC-side setup screen for <pump-deck>.
// Mirrors designs/PumpDeck.html: nav bar, round preview + controls on the left,
// screen-slot editor on the right. Edits update the preview live and persist to
// localStorage; supports Export / Import JSON.

import './pump-deck.js';
import {
  THEME_ACCENT,
  THEME_NAMES,
  TYPE_NAMES,
  SENSOR_META,
  PANEL_TYPES,
  SENSOR_KEYS,
  DEFAULT_SENSORS,
  DEFAULT_PANELS,
  DEFAULT_THEME,
  DEFAULT_DEVICE_LABEL,
} from './maps.js';

function h(tag, props, children) {
  const el = document.createElement(tag);
  if (props) {
    for (const k in props) {
      const v = props[k];
      if (v == null || k === 'key') continue;
      if (k === 'ref') v(el);
      else if (k === 'style' && typeof v === 'object') {
        for (const sk in v) {
          const sv = v[sk];
          if (sv == null) continue;
          if (sk.charCodeAt(0) === 45) el.style.setProperty(sk, String(sv));
          else el.style[sk] = sv;
        }
      } else if (k.length > 2 && k[0] === 'o' && k[1] === 'n' && k[2] >= 'A' && k[2] <= 'Z') {
        el.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (k === 'value') {
        el.value = v;
      } else if (k === 'selected' || k === 'disabled') {
        if (v) el.setAttribute(k, '');
      } else {
        el.setAttribute(k, v);
      }
    }
  }
  appendKids(el, children);
  return el;
}
function appendKids(el, kids) {
  if (kids == null) return;
  if (Array.isArray(kids)) kids.forEach((c) => appendKids(el, c));
  else if (kids instanceof Node) el.appendChild(kids);
  else el.appendChild(document.createTextNode(String(kids)));
}

// Strip the internal `id` field so the public config matches the Panel shape.
function publicPanel(p) {
  const o = {};
  for (const k in p) if (k !== 'id') o[k] = p[k];
  return o;
}

// The two selectable metrics for each multi-metric panel, and their chip labels.
const METRIC_KEYS = {
  temp: ['cpuTemp', 'gpuTemp'],
  load: ['cpuLoad', 'gpuLoad'],
  network: ['netDown', 'netUp'],
};
const CHIP_LABEL = {
  cpuTemp: 'CPU',
  gpuTemp: 'GPU',
  cpuLoad: 'CPU',
  gpuLoad: 'GPU',
  netDown: 'Down',
  netUp: 'Up',
};

export class PumpDeckConfigurator extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.storageKey = 'pumpdeck.config';
    this._uid = 1;
    this._sensors = { ...DEFAULT_SENSORS };
    this._theme = DEFAULT_THEME;
    this._deviceLabel = DEFAULT_DEVICE_LABEL;
    this._autoCycle = true;
    this._panels = DEFAULT_PANELS.map((p) => ({ id: this._uid++, ...p }));
    this._selectedId = this._panels[0] ? this._panels[0].id : null;
    this._liveIndex = 0;
  }

  connectedCallback() {
    if (this.getAttribute('storage-key')) this.storageKey = this.getAttribute('storage-key');
    this._load();
    this._render();
  }

  // ---- public API ----
  getConfig() {
    return {
      panels: this._panels.map(publicPanel),
      theme: this._theme,
      deviceLabel: this._deviceLabel,
      autoCycle: this._autoCycle,
    };
  }
  setConfig(cfg) {
    if (!cfg) return;
    if (Array.isArray(cfg.panels))
      this._panels = cfg.panels.slice(0, 8).map((p) => ({ id: this._uid++, ...p }));
    if (cfg.theme && THEME_ACCENT[cfg.theme]) this._theme = cfg.theme;
    if (typeof cfg.deviceLabel === 'string') this._deviceLabel = cfg.deviceLabel;
    if (typeof cfg.autoCycle === 'boolean') this._autoCycle = cfg.autoCycle;
    if (!this._panels.find((p) => p.id === this._selectedId))
      this._selectedId = this._panels[0] ? this._panels[0].id : null;
    this._persist();
    this._render();
  }

  // ---- persistence ----
  _load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const cfg = JSON.parse(raw);
        if (Array.isArray(cfg.panels))
          this._panels = cfg.panels.slice(0, 8).map((p) => ({ id: this._uid++, ...p }));
        if (cfg.theme && THEME_ACCENT[cfg.theme]) this._theme = cfg.theme;
        if (typeof cfg.deviceLabel === 'string') this._deviceLabel = cfg.deviceLabel;
        if (typeof cfg.autoCycle === 'boolean') this._autoCycle = cfg.autoCycle;
        this._selectedId = this._panels[0] ? this._panels[0].id : null;
      }
    } catch {
      /* corrupt storage — fall back to defaults */
    }
  }
  _persist() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.getConfig()));
    } catch {
      /* storage unavailable — ignore */
    }
  }

  // ---- state mutations ----
  _selectedIndex() {
    return Math.max(
      0,
      this._panels.findIndex((p) => p.id === this._selectedId),
    );
  }
  _commit(rerender = true) {
    this._persist();
    if (rerender) this._render();
    else this._syncPreview();
  }
  _selectSlot(id) {
    this._selectedId = id;
    this._render();
    // jump the preview to this slot, then let auto-cycle resume from there
    const i = this._selectedIndex();
    if (this._preview) {
      this._preview.activeIndex = i;
      if (this._autoCycle) setTimeout(() => (this._preview.activeIndex = null), 0);
    }
  }
  _updateSlot(id, patch) {
    this._panels = this._panels.map((p) => (p.id === id ? { ...p, ...patch } : p));
    this._commit();
  }
  _addSlot() {
    if (this._panels.length >= 8) return;
    const id = this._uid++;
    this._panels = [...this._panels, { id, type: 'gauge', sensor: 'gpuTemp', duration: 4 }];
    this._selectedId = id;
    this._commit();
  }
  _removeSlot(id) {
    this._panels = this._panels.filter((p) => p.id !== id);
    if (this._selectedId === id) this._selectedId = this._panels[0] ? this._panels[0].id : null;
    this._commit();
  }
  _moveSlot(id, dir) {
    const arr = [...this._panels];
    const i = arr.findIndex((p) => p.id === id);
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    this._panels = arr;
    this._commit();
  }
  _setTheme(k) {
    this._theme = k;
    this._commit();
  }
  _setSensor(k, v) {
    const m = SENSOR_META[k];
    v = Math.max(m.min, Math.min(m.max, Math.round(v)));
    this._sensors = { ...this._sensors, [k]: v };
    if (this._preview) this._preview.sensors = this._sensors;
    // update slider + readout in place (no full re-render, keeps focus/animation)
    if (this._sliderEls && this._sliderEls[k]) this._sliderEls[k].value = v;
    if (this._sensorReadouts && this._sensorReadouts[k])
      this._sensorReadouts[k].textContent =
        `${v}${m.unit === '%' ? '%' : m.unit ? ' ' + m.unit : ''}`;
  }

  /** Live demo sensor feed — stands in for iCUE's real sensor values. */
  get sensors() {
    return { ...this._sensors };
  }
  set sensors(obj) {
    if (!obj) return;
    for (const k in obj) if (SENSOR_KEYS.includes(k)) this._setSensor(k, obj[k]);
  }
  _toggleAuto() {
    this._autoCycle = !this._autoCycle;
    this._commit();
  }

  // ---- import / export ----
  _export() {
    const blob = new Blob([JSON.stringify(this.getConfig(), null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: 'pumpdeck-config.json' });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  _import() {
    const input = h('input', {
      type: 'file',
      accept: 'application/json,.json',
      style: { display: 'none' },
    });
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          this.setConfig(JSON.parse(String(reader.result)));
        } catch {
          alert('Could not parse that JSON file.');
        }
      };
      reader.readAsText(file);
    });
    input.click();
  }

  _syncPreview() {
    if (!this._preview) return;
    this._preview.panels = this._panels.map(publicPanel);
    this._preview.theme = this._theme;
    this._preview.deviceLabel = this._deviceLabel;
    this._preview.autoCycle = this._autoCycle;
    this._preview.sensors = this._sensors;
  }

  // ---- render ----
  _render() {
    const root = this.shadowRoot;
    root.textContent = '';
    const a = THEME_ACCENT[this._theme];

    const style = document.createElement('style');
    style.textContent = `
      :host{display:block}
      *{box-sizing:border-box}
      input[type=range]{-webkit-appearance:none;appearance:none;height:4px;background:#33333a;border-radius:3px;outline:none}
      input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:15px;height:15px;border-radius:50%;background:var(--accent,#ffb020);box-shadow:0 0 8px var(--accent,#ffb020);cursor:pointer}
      input[type=range]::-moz-range-thumb{width:15px;height:15px;border:none;border-radius:50%;background:var(--accent,#ffb020);cursor:pointer}
      select,input,button{font-family:'Barlow Condensed',sans-serif}
      select:focus,input:focus{outline:1px solid var(--accent,#ffb020)}
    `;
    root.appendChild(style);

    const selectStyle = {
      appearance: 'none',
      WebkitAppearance: 'none',
      background: '#1b1b20',
      color: '#ece3cf',
      border: '1px solid #000',
      borderRadius: '6px',
      padding: '7px 9px',
      fontSize: '14px',
      letterSpacing: '.02em',
      boxShadow: 'inset 0 1px 0 #2c2c33',
      cursor: 'pointer',
      width: '100%',
    };
    const numStyle = {
      background: '#1b1b20',
      color: '#ece3cf',
      border: '1px solid #000',
      borderRadius: '6px',
      padding: '7px 8px',
      fontSize: '14px',
      width: '54px',
      boxShadow: 'inset 0 1px 0 #2c2c33',
    };
    const textStyle = {
      background: '#1b1b20',
      color: '#ece3cf',
      border: '1px solid #000',
      borderRadius: '6px',
      padding: '7px 9px',
      fontSize: '14px',
      width: '100%',
      boxShadow: 'inset 0 1px 0 #2c2c33',
    };
    const arrowStyle = {
      background: '#22222a',
      color: '#c9c0aa',
      border: '1px solid #000',
      borderRadius: '5px',
      width: '26px',
      height: '26px',
      fontSize: '11px',
      cursor: 'pointer',
      padding: 0,
      lineHeight: 1,
    };
    const delStyle = { ...arrowStyle, color: '#c97b7b' };
    const labelStyle = {
      display: 'block',
      fontSize: '16px',
      letterSpacing: '.14em',
      textTransform: 'uppercase',
      color: '#8a8a93',
      marginBottom: '4px',
    };
    const btn = (on) => ({
      fontFamily: "'Barlow Condensed'",
      letterSpacing: '.08em',
      textTransform: 'uppercase',
      fontSize: '13px',
      border: '1px solid #000',
      borderRadius: '6px',
      padding: '8px 14px',
      cursor: 'pointer',
      color: on ? '#0c0c0e' : '#ece3cf',
      background: on ? a : '#22222a',
      boxShadow: on ? `0 0 12px ${a}66` : 'inset 0 1px 0 #35353d',
    });

    // preview element
    this._sensorReadouts = {};
    this._sliderEls = {};
    this._preview = h('pump-deck', {});
    this._syncPreview();
    this._preview.addEventListener('activechange', (e) => {
      this._liveIndex = e.detail.index;
      this._refreshLiveBadges();
    });
    // seed initial live index for badges
    this._liveIndex = this._selectedIndex();

    // ----- nav bar -----
    const nav = h(
      'div',
      {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '18px',
          padding: '12px 26px',
          background: '#0e0e12',
          borderBottom: '1px solid #000',
          boxShadow: '0 1px 0 #23232a inset',
        },
      },
      [
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '9px' } }, [
          h('div', {
            style: {
              width: '16px',
              height: '16px',
              borderRadius: '4px',
              background: 'linear-gradient(135deg,#ffb020,#ff7a1a)',
              boxShadow: '0 0 10px rgba(255,176,32,.5)',
            },
          }),
          h(
            'span',
            { style: { fontWeight: 700, letterSpacing: '.18em', fontSize: '15px' } },
            'iCUE',
          ),
        ]),
        h(
          'div',
          {
            style: {
              display: 'flex',
              gap: '22px',
              fontSize: '13px',
              letterSpacing: '.16em',
              textTransform: 'uppercase',
              color: '#7a7a83',
            },
          },
          [
            h('span', {}, 'Home'),
            h('span', {}, 'Lighting'),
            h('span', {}, 'Performance'),
            h('span', { style: { color: '#ece3cf', position: 'relative' } }, [
              'Screen',
              h('span', {
                style: {
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: '-13px',
                  height: '2px',
                  background: a,
                  borderRadius: '2px',
                },
              }),
            ]),
            h('span', {}, 'Settings'),
          ],
        ),
        h(
          'div',
          { style: { marginLeft: 'auto', display: 'flex', gap: '8px' } },
          [0, 1, 2].map(() =>
            h('span', {
              style: { width: '11px', height: '11px', borderRadius: '50%', background: '#2a2a31' },
            }),
          ),
        ),
      ],
    );

    const heading = h(
      'div',
      { style: { display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '20px' } },
      [
        h(
          'h1',
          { style: { margin: 0, fontWeight: 600, letterSpacing: '.02em', fontSize: '24px' } },
          'LCD Setup — Pump Deck',
        ),
        h(
          'span',
          {
            style: {
              letterSpacing: '.28em',
              textTransform: 'uppercase',
              fontSize: '12px',
              color: '#7a7a83',
            },
          },
          '480×480 round · non-touch',
        ),
      ],
    );

    // ----- left column: preview + controls -----
    const previewWrap = h(
      'div',
      { style: { display: 'flex', justifyContent: 'center', padding: '6px 0' } },
      this._preview,
    );

    const controls = h(
      'div',
      {
        style: {
          background: '#141417',
          border: '1px solid #000',
          borderRadius: '12px',
          padding: '16px 18px',
          boxShadow: 'inset 0 1px 0 #2c2c33',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        },
      },
      [
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } }, [
          h(
            'button',
            { onClick: () => this._toggleAuto(), style: btn(this._autoCycle) },
            this._autoCycle ? '⏸ Auto-cycle ON' : '▶ Auto-cycle OFF',
          ),
          h(
            'span',
            { style: { fontSize: '12px', color: '#6c6c74', lineHeight: 1.4 } },
            'Cycles slots by their set duration. Click a slot to jump & edit.',
          ),
        ]),
        // theme
        h('div', {}, [
          h(
            'div',
            {
              style: {
                fontSize: '12px',
                letterSpacing: '.2em',
                textTransform: 'uppercase',
                color: '#8a8a93',
                marginBottom: '9px',
              },
            },
            'Display theme',
          ),
          h(
            'div',
            { style: { display: 'flex', gap: '11px', alignItems: 'center' } },
            Object.keys(THEME_ACCENT).map((k) =>
              h('button', {
                title: THEME_NAMES[k],
                onClick: () => this._setTheme(k),
                style: {
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: THEME_ACCENT[k],
                  cursor: 'pointer',
                  padding: 0,
                  border: k === this._theme ? '2px solid #fff' : '2px solid #000',
                  boxShadow:
                    k === this._theme
                      ? `0 0 12px ${THEME_ACCENT[k]}`
                      : 'inset 0 0 0 1px rgba(0,0,0,.6)',
                },
              }),
            ),
          ),
        ]),
        // device label
        h('div', {}, [
          h(
            'div',
            {
              style: {
                fontSize: '12px',
                letterSpacing: '.2em',
                textTransform: 'uppercase',
                color: '#8a8a93',
                marginBottom: '6px',
              },
            },
            'Device label',
          ),
          h('input', {
            type: 'text',
            value: this._deviceLabel,
            onChange: (e) => {
              this._deviceLabel = e.target.value;
              this._commit(false);
            },
            style: textStyle,
          }),
        ]),
        // sensors
        h('div', {}, [
          h(
            'div',
            {
              style: {
                fontSize: '12px',
                letterSpacing: '.2em',
                textTransform: 'uppercase',
                color: '#8a8a93',
                marginBottom: '4px',
              },
            },
            [
              'Live sensors ',
              h(
                'span',
                { style: { color: '#5c5c64', letterSpacing: 0, textTransform: 'none' } },
                '— demo feed (iCUE reads these for real)',
              ),
            ],
          ),
          h(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: '11px', marginTop: '8px' } },
            SENSOR_KEYS.map((k) => {
              const m = SENSOR_META[k];
              const readout = h(
                'b',
                {
                  style: {
                    width: '64px',
                    textAlign: 'right',
                    fontFamily: "'Share Tech Mono',monospace",
                    color: a,
                    fontSize: '14px',
                  },
                },
                `${this._sensors[k]}${m.unit === '%' ? '%' : m.unit ? ' ' + m.unit : ''}`,
              );
              this._sensorReadouts[k] = readout;
              const slider = h('input', {
                type: 'range',
                min: m.min,
                max: m.max,
                value: this._sensors[k],
                onInput: (e) => this._setSensor(k, +e.target.value),
                style: { flex: 1 },
              });
              this._sliderEls[k] = slider;
              return h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } }, [
                h(
                  'label',
                  {
                    style: {
                      width: '78px',
                      fontSize: '13px',
                      letterSpacing: '.06em',
                      color: '#9a9aa2',
                    },
                  },
                  m.label,
                ),
                slider,
                readout,
              ]);
            }),
          ),
        ]),
      ],
    );

    const leftCol = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '18px' } }, [
      previewWrap,
      controls,
    ]);

    // ----- right column: slot editor -----
    const addBtnStyle = {
      ...btn(false),
      marginLeft: 'auto',
      padding: '6px 12px',
      fontSize: '12px',
    };
    const ioBtnStyle = { ...btn(false), padding: '6px 12px', fontSize: '12px' };

    this._badgeEls = {};
    const slotCards = this._panels.map((s, i) =>
      this._slotCard(s, i, {
        selectStyle,
        numStyle,
        textStyle,
        arrowStyle,
        delStyle,
        labelStyle,
        a,
      }),
    );

    const rightCol = h(
      'div',
      {
        style: {
          background: '#141417',
          border: '1px solid #000',
          borderRadius: '12px',
          padding: '18px 20px 20px',
          boxShadow: 'inset 0 1px 0 #2c2c33',
        },
      },
      [
        h(
          'div',
          {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '4px',
              flexWrap: 'wrap',
            },
          },
          [
            h(
              'h2',
              {
                style: {
                  margin: 0,
                  fontSize: '14px',
                  letterSpacing: '.22em',
                  textTransform: 'uppercase',
                  color: '#c9c0aa',
                  fontWeight: 600,
                },
              },
              'Screen slots',
            ),
            h(
              'span',
              { style: { fontSize: '12px', color: '#6c6c74' } },
              `${this._panels.length} / 8`,
            ),
            h('button', { onClick: () => this._export(), style: ioBtnStyle }, 'Export JSON'),
            h('button', { onClick: () => this._import(), style: ioBtnStyle }, 'Import JSON'),
            h(
              'button',
              {
                onClick: () => this._addSlot(),
                disabled: this._panels.length >= 8,
                style: {
                  ...addBtnStyle,
                  opacity: this._panels.length >= 8 ? 0.4 : 1,
                  cursor: this._panels.length >= 8 ? 'not-allowed' : 'pointer',
                },
              },
              '+ Add slot',
            ),
          ],
        ),
        h(
          'p',
          { style: { margin: '0 0 16px', fontSize: '12px', color: '#6c6c74', lineHeight: 1.5 } },
          'Each slot is one screen in the rotation. Set its type, source and how long it shows. Reorder with the ▲▼ arrows.',
        ),
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, slotCards),
        h(
          'p',
          { style: { margin: '18px 0 0', fontSize: '12px', color: '#5c5c64', lineHeight: 1.6 } },
          [
            h('b', { style: { color: '#8a8a93' } }, 'Note: '),
            "the pump LCD has no touch — everything is configured here on the PC. This panel mirrors what you'd set in iCUE; the preview updates live as you edit.",
          ],
        ),
      ],
    );

    const grid = h(
      'div',
      {
        style: {
          display: 'grid',
          gridTemplateColumns: '500px 1fr',
          gap: '26px',
          alignItems: 'start',
        },
      },
      [leftCol, rightCol],
    );
    const body = h(
      'div',
      { style: { maxWidth: '1240px', margin: '0 auto', padding: '26px 26px 0' } },
      [heading, grid],
    );
    const page = h(
      'div',
      {
        style: {
          minHeight: '100vh',
          background: 'radial-gradient(1100px 800px at 50% -6%, #17171b, #050506 72%)',
          color: '#ece3cf',
          fontFamily: "'Barlow Condensed',system-ui,sans-serif",
          paddingBottom: '56px',
          '--accent': a,
        },
      },
      [nav, body],
    );

    root.appendChild(page);
    this._refreshLiveBadges();
  }

  _slotCard(s, i, st) {
    const a = st.a;
    const sel = s.id === this._selectedId;
    const typeName = TYPE_NAMES[s.type] || s.type;
    const hasLabel = ['temp', 'load', 'pump', 'network', 'gauge'].includes(s.type);
    const isGauge = s.type === 'gauge';
    const isText = s.type === 'text';
    const metricKeys = METRIC_KEYS[s.type];
    const defLabel =
      { temp: 'CPU · GPU', load: 'SYSTEM LOAD', pump: 'PUMP', network: 'NETWORK', gauge: '' }[
        s.type
      ] || '';

    const badge = h(
      'span',
      {
        style: {
          fontSize: '18px',
          letterSpacing: '.12em',
          color: a,
          textTransform: 'uppercase',
          display: i === this._liveIndex ? 'inline' : 'none',
        },
      },
      '● Live',
    );
    this._badgeEls[s.id] = { el: badge, index: i };

    const header = h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' } },
      [
        h(
          'span',
          {
            style: {
              fontFamily: "'Share Tech Mono',monospace",
              fontSize: '13px',
              color: '#6c6c74',
            },
          },
          String(i + 1).padStart(2, '0'),
        ),
        h(
          'span',
          {
            style: {
              fontSize: '14px',
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              color: '#ded5bf',
            },
          },
          typeName,
        ),
        badge,
        h('div', { style: { marginLeft: 'auto', display: 'flex', gap: '5px' } }, [
          h(
            'button',
            {
              onClick: (e) => {
                e.stopPropagation();
                this._moveSlot(s.id, -1);
              },
              style: st.arrowStyle,
            },
            '▲',
          ),
          h(
            'button',
            {
              onClick: (e) => {
                e.stopPropagation();
                this._moveSlot(s.id, 1);
              },
              style: st.arrowStyle,
            },
            '▼',
          ),
          h(
            'button',
            {
              onClick: (e) => {
                e.stopPropagation();
                this._removeSlot(s.id);
              },
              style: st.delStyle,
            },
            '✕',
          ),
        ]),
      ],
    );

    const typeSelect = h(
      'select',
      {
        value: s.type,
        onChange: (e) => this._updateSlot(s.id, { type: e.target.value }),
        style: st.selectStyle,
      },
      PANEL_TYPES.map((v) => h('option', { value: v, selected: v === s.type }, TYPE_NAMES[v])),
    );

    const typeRow = h('div', { style: { display: 'flex', gap: '12px' } }, [
      h('div', { style: { flex: 2 } }, [h('label', { style: st.labelStyle }, 'Type'), typeSelect]),
      h('div', { style: { width: '96px' } }, [
        h('label', { style: st.labelStyle }, 'Duration'),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } }, [
          h('input', {
            type: 'number',
            min: 1,
            max: 30,
            value: s.duration,
            onChange: (e) =>
              this._updateSlot(s.id, { duration: Math.max(1, Math.min(30, +e.target.value || 1)) }),
            style: st.numStyle,
          }),
          h('span', { style: { fontSize: '13px', color: '#8a8a93' } }, 's'),
        ]),
      ]),
    ]);

    const fields = [typeRow];

    if (isGauge) {
      fields.push(
        h('div', {}, [
          h('label', { style: st.labelStyle }, 'Sensor source'),
          h(
            'select',
            {
              value: s.sensor || 'cpuTemp',
              onChange: (e) => this._updateSlot(s.id, { sensor: e.target.value }),
              style: st.selectStyle,
            },
            SENSOR_KEYS.map((v) =>
              h(
                'option',
                { value: v, selected: v === (s.sensor || 'cpuTemp') },
                SENSOR_META[v].label,
              ),
            ),
          ),
        ]),
      );
    }

    if (metricKeys) {
      const selected =
        Array.isArray(s.metrics) && s.metrics.length
          ? metricKeys.filter((k) => s.metrics.includes(k))
          : metricKeys.slice();
      const chips = metricKeys.map((k) => {
        const on = selected.includes(k);
        return h(
          'button',
          {
            onClick: (e) => {
              e.stopPropagation();
              this._toggleMetric(s.id, metricKeys, k);
            },
            style: {
              flex: 1,
              padding: '7px 10px',
              borderRadius: '6px',
              border: '1px solid #000',
              cursor: 'pointer',
              fontSize: '13px',
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              color: on ? '#0c0c0e' : '#9a9aa2',
              background: on ? a : '#1b1b20',
              boxShadow: on ? `0 0 10px ${a}55` : 'inset 0 1px 0 #2c2c33',
            },
          },
          CHIP_LABEL[k],
        );
      });
      fields.push(
        h('div', {}, [
          h('label', { style: st.labelStyle }, 'Metrics — pick one or both'),
          h('div', { style: { display: 'flex', gap: '8px' } }, chips),
        ]),
      );
    }

    if (hasLabel) {
      fields.push(
        h('div', {}, [
          h('label', { style: st.labelStyle }, 'Label'),
          h('input', {
            type: 'text',
            value: s.label || '',
            placeholder: defLabel,
            onChange: (e) => this._updateSlot(s.id, { label: e.target.value }),
            style: st.textStyle,
          }),
        ]),
      );
    }

    if (isText) {
      fields.push(
        h('div', {}, [
          h('label', { style: st.labelStyle }, 'Ticker text'),
          h('input', {
            type: 'text',
            value: s.text || '',
            onChange: (e) => this._updateSlot(s.id, { text: e.target.value }),
            style: st.textStyle,
          }),
        ]),
      );
    }

    const card = h(
      'div',
      {
        onClick: () => this._selectSlot(s.id),
        style: {
          position: 'relative',
          background: sel ? '#191920' : '#141417',
          border: '1px solid #000',
          borderRadius: '10px',
          padding: '12px 14px 14px 16px',
          boxShadow: sel ? `inset 0 0 0 1px ${a}55` : 'inset 0 1px 0 #2c2c33',
          cursor: 'pointer',
          overflow: 'hidden',
        },
      },
      [
        sel
          ? h('div', {
              style: {
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: '4px',
                background: a,
                boxShadow: `0 0 10px ${a}`,
              },
            })
          : null,
        header,
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, fields),
      ],
    );
    return card;
  }

  _toggleMetric(id, keys, k) {
    const s = this._panels.find((p) => p.id === id);
    if (!s) return;
    let sel =
      Array.isArray(s.metrics) && s.metrics.length
        ? keys.filter((x) => s.metrics.includes(x))
        : keys.slice();
    if (sel.includes(k)) {
      if (sel.length > 1) sel = sel.filter((x) => x !== k); // keep at least one selected
    } else {
      sel = keys.filter((x) => sel.includes(x) || x === k); // add, keep canonical order
    }
    // store undefined when both are on (means "both") to keep the config clean
    this._updateSlot(id, { metrics: sel.length === keys.length ? undefined : sel });
  }

  _refreshLiveBadges() {
    if (!this._badgeEls) return;
    for (const id in this._badgeEls) {
      const { el, index } = this._badgeEls[id];
      el.style.display = index === this._liveIndex ? 'inline' : 'none';
    }
  }
}

if (!customElements.get('pump-deck-configurator')) {
  customElements.define('pump-deck-configurator', PumpDeckConfigurator);
}
