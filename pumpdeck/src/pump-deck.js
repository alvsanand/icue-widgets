// <pump-deck> — a round 480x480 pump-head LCD widget, framework-agnostic.
// Extracted from designs/PumpDeck.html; the panel builders below mirror that
// mockup's renderPanel/flameCluster/vBar/spark/netBlock so the look matches 1:1.
//
// Usage:
//   <script type="module" src="pump-deck.js"></script>
//   <pump-deck theme="amber"></pump-deck>
//   el.panels = [...]; el.sensors = {...};

import {
  THEME_ACCENT,
  SENSOR_META,
  DEFAULT_SENSORS,
  DEFAULT_PANELS,
  DEFAULT_THEME,
  DEFAULT_DEVICE_LABEL,
} from './maps.js';

// The design was authored at a 460px bezel; everything else scales from that.
const DESIGN_SIZE = 460;
const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700&family=Share+Tech+Mono&display=swap';

// React.createElement-compatible DOM builder so the ported panel code reads 1:1.
function h(tag, props, children) {
  const el = document.createElement(tag);
  if (props) {
    for (const k in props) {
      const v = props[k];
      if (v == null || k === 'key') continue;
      if (k === 'ref') {
        v(el);
      } else if (k === 'style' && typeof v === 'object') {
        for (const sk in v) {
          const sv = v[sk];
          if (sv == null) continue;
          if (sk.charCodeAt(0) === 45 /* '-' */) el.style.setProperty(sk, String(sv));
          else el.style[sk] = sv;
        }
      } else if (k.length > 2 && k[0] === 'o' && k[1] === 'n' && k[2] >= 'A' && k[2] <= 'Z') {
        el.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (k === 'value') {
        el.value = v;
        el.setAttribute('value', v);
      } else {
        el.setAttribute(k, v);
      }
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  if (children == null) return;
  if (Array.isArray(children)) {
    for (const c of children) append(el, c);
  } else if (children instanceof Node) {
    el.appendChild(children);
  } else {
    el.appendChild(document.createTextNode(String(children)));
  }
}

let fontsInjected = false;
function injectFonts() {
  if (fontsInjected || document.querySelector('link[data-pump-deck-fonts]')) return;
  fontsInjected = true;
  const pre1 = h('link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' });
  const pre2 = h('link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' });
  const link = h('link', { rel: 'stylesheet', href: FONTS_HREF });
  link.setAttribute('data-pump-deck-fonts', '');
  document.head.append(pre1, pre2, link);
}

const KEYFRAMES = `
  @keyframes pd-flick{0%,42%{filter:brightness(.1)}100%{filter:brightness(1)}}
  @keyframes pd-breathe{0%,100%{opacity:.22}50%{opacity:.85}}
  @keyframes pd-scroll{from{transform:translate(0,-50%)}to{transform:translate(-1400px,-50%)}}
`;

export class PumpDeck extends HTMLElement {
  static get observedAttributes() {
    return ['theme', 'device-label', 'auto-cycle', 'size', 'active-index'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    this._panels = DEFAULT_PANELS.map((p) => ({ ...p }));
    this._sensors = { ...DEFAULT_SENSORS };
    this._theme = DEFAULT_THEME;
    this._deviceLabel = DEFAULT_DEVICE_LABEL;
    this._autoCycle = true;
    this._size = DESIGN_SIZE;
    this._controlledIndex = null; // set => controlled
    this._active = 0;
    this.onActiveChange = null;

    this._ang = 0;
    this._last = null;
    this._fanEl = null;
    this._tickerEl = null;
    this._raf = 0;
    this._tickT = 0;
    this._cycleT = 0;
    this._cycleStart = 0; // performance.now() when current panel began
  }

  // ---- properties ----
  get panels() {
    return this._panels;
  }
  set panels(v) {
    this._panels = Array.isArray(v) ? v.map((p) => ({ ...p })) : [];
    if (this._active >= this._panels.length) this._active = 0;
    this._renderPanel(true);
    this._reschedule();
  }

  get sensors() {
    return this._sensors;
  }
  set sensors(v) {
    this._sensors = { ...DEFAULT_SENSORS, ...(v || {}) };
    this._liveRedraw();
  }

  get theme() {
    return this._theme;
  }
  set theme(v) {
    if (!THEME_ACCENT[v]) return;
    this._theme = v;
    this._applyAccent();
    this._renderPanel(false);
  }

  get deviceLabel() {
    return this._deviceLabel;
  }
  set deviceLabel(v) {
    this._deviceLabel = v == null ? '' : String(v);
    if (this._deviceLabelEl) this._deviceLabelEl.textContent = this._deviceLabel;
  }

  get autoCycle() {
    return this._autoCycle;
  }
  set autoCycle(v) {
    this._autoCycle = !!v;
    this._reschedule();
  }

  get size() {
    return this._size;
  }
  set size(v) {
    const n = Number(v);
    this._size = Number.isFinite(n) && n > 0 ? n : DESIGN_SIZE;
    this._applySize();
  }

  get activeIndex() {
    return this._controlledIndex != null ? this._controlledIndex : this._active;
  }
  set activeIndex(v) {
    if (v == null || v === '') {
      this._controlledIndex = null;
      this._reschedule();
      return;
    }
    const n = Math.max(0, Math.min(this._panels.length - 1, Number(v) | 0));
    this._controlledIndex = n;
    this._setActive(n, true);
    this._reschedule();
  }

  // ---- lifecycle ----
  attributeChangedCallback(name, _old, value) {
    if (name === 'theme') this.theme = value || DEFAULT_THEME;
    else if (name === 'device-label') this.deviceLabel = value;
    else if (name === 'auto-cycle') this.autoCycle = value != null && value !== 'false';
    else if (name === 'size') this.size = value;
    else if (name === 'active-index') this.activeIndex = value;
  }

  connectedCallback() {
    injectFonts();
    this._build();
    this._applyAccent();
    this._applySize();
    this._renderPanel(true);
    this._cycleStart = performance.now();
    this._reschedule();
    this._tickT = setInterval(() => this._liveRedraw(), 450);
    this._raf = requestAnimationFrame(this._spin);
  }

  disconnectedCallback() {
    clearInterval(this._tickT);
    clearTimeout(this._cycleT);
    cancelAnimationFrame(this._raf);
  }

  // ---- helpers ported from the mockup ----
  _acc() {
    return THEME_ACCENT[this._theme] || '#ffb020';
  }
  _clamp(x) {
    return Math.max(0, Math.min(1, x));
  }
  _heat(t) {
    const g = [93, 255, 138],
      y = [255, 210, 59],
      r = [255, 64, 51];
    const mix = (a, b, k) => Math.round(a + (b - a) * k);
    let c;
    if (t < 0.5) {
      const k = t / 0.5;
      c = [mix(g[0], y[0], k), mix(g[1], y[1], k), mix(g[2], y[2], k)];
    } else {
      const k = (t - 0.5) / 0.5;
      c = [mix(y[0], r[0], k), mix(y[1], r[1], k), mix(y[2], r[2], k)];
    }
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }
  _seg(size) {
    const a = this._acc();
    return {
      fontFamily: "'Share Tech Mono',monospace",
      color: a,
      lineHeight: 0.9,
      fontSize: size,
      textShadow: `0 0 12px ${a}99,0 0 2px ${a}`,
    };
  }

  _flameCluster(t, kp, rows, contH) {
    const COLS = 9,
      ROWS = rows || 12,
      cols = [];
    for (let c = 0; c < COLS; c++) {
      const jit = Math.round(Math.random() * 2 - 1);
      const lit = Math.max(0, Math.min(ROWS, Math.round(t * ROWS) - Math.abs(c - 4) * 0.7 + jit));
      const leds = [];
      for (let r = 0; r < ROWS; r++) {
        const on = r < lit,
          heat = Math.min(1, t * 0.5 + (r / ROWS) * 0.7);
        leds.push(
          h('div', {
            key: r,
            style: {
              flex: 1,
              minHeight: '4px',
              borderRadius: '2px',
              background: on ? this._heat(heat) : '#1c1c20',
              boxShadow: on ? `0 0 7px ${this._heat(heat)}` : 'none',
            },
          }),
        );
      }
      cols.push(
        h(
          'div',
          {
            key: c,
            style: {
              flex: 1,
              maxWidth: '12px',
              display: 'flex',
              flexDirection: 'column-reverse',
              gap: '2px',
              height: '100%',
            },
          },
          leds,
        ),
      );
    }
    return h(
      'div',
      {
        key: kp,
        style: {
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'center',
          gap: '4px',
          height: contH || '118px',
          width: '100%',
        },
      },
      cols,
    );
  }

  _vBar(val) {
    const n = 20,
      lit = Math.round((val / 100) * n),
      cells = [];
    for (let i = 0; i < n; i++) {
      const tc = i / (n - 1),
        on = i < lit;
      cells.push(
        h('div', {
          key: i,
          style: {
            flex: 1,
            minHeight: '3px',
            borderRadius: '2px',
            background: on ? this._heat(tc) : '#1c1c20',
            boxShadow: on ? `0 0 6px ${this._heat(tc)}` : 'inset 0 0 0 1px #000',
          },
        }),
      );
    }
    return h(
      'div',
      {
        style: {
          flex: 1,
          width: '52px',
          display: 'flex',
          flexDirection: 'column-reverse',
          gap: '3px',
        },
      },
      cells,
    );
  }

  _spark(val, max, color) {
    const n = 22,
      bars = [],
      base = this._clamp(val / max);
    for (let i = 0; i < n; i++) {
      const hh = this._clamp(base * (0.7 + Math.random() * 0.6));
      bars.push(
        h('div', {
          key: i,
          style: {
            flex: 1,
            alignSelf: 'flex-end',
            height: `${38 + hh * 62}%`,
            background: color,
            borderRadius: '3px',
            opacity: 0.6 + hh * 0.4,
            boxShadow: `0 0 9px ${color}77`,
          },
        }),
      );
    }
    return h(
      'div',
      {
        style: {
          height: '74px',
          display: 'flex',
          alignItems: 'flex-end',
          gap: '4px',
          width: '100%',
        },
      },
      bars,
    );
  }

  _netBlock(icon, tag, val, max, color) {
    return h(
      'div',
      { key: tag, style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
      [
        h(
          'div',
          {
            key: 'h',
            style: { display: 'flex', alignItems: 'baseline', gap: '12px', flex: '0 0 auto' },
          },
          [
            h('span', { key: 'i', style: { color, fontSize: '26px' } }, icon),
            h(
              'span',
              { key: 't', style: { letterSpacing: '.26em', fontSize: '16px', color: '#b9b09a' } },
              tag,
            ),
            h(
              'span',
              {
                key: 'v',
                style: {
                  marginLeft: 'auto',
                  fontFamily: "'Share Tech Mono',monospace",
                  color,
                  fontSize: '46px',
                  lineHeight: 0.9,
                  textShadow: `0 0 12px ${color}77`,
                },
              },
              [
                String(Math.round(val)),
                h(
                  'span',
                  { key: 'u', style: { fontSize: '18px', color: '#b9b09a', marginLeft: '6px' } },
                  'Mbps',
                ),
              ],
            ),
          ],
        ),
        this._spark(val, max, color),
      ],
    );
  }

  _labelEl(text) {
    if (!text) return null;
    return h(
      'div',
      {
        key: '__lb',
        style: {
          position: 'absolute',
          top: '52px',
          left: 0,
          right: 0,
          textAlign: 'center',
          letterSpacing: '.34em',
          textTransform: 'uppercase',
          fontSize: '13px',
          color: '#b9b09a',
        },
      },
      text,
    );
  }

  // ---- panel dispatch ----
  _renderPanelContent(slot) {
    const S = this._sensors,
      a = this._acc();
    if (!slot) return [];
    const t = slot.type;

    if (t === 'temp') {
      const chosen = this._metricsFor(slot, ['cpuTemp', 'gpuTemp']);
      const cluster = (nm, key, big) => {
        const v = S[key],
          f = this._clamp((v - 25) / 70);
        return h(
          'div',
          {
            key: nm,
            style: {
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '14px',
              padding: '0 6%',
            },
          },
          [
            this._flameCluster(f, nm + this._tick(), 16, '100%'),
            h('div', { key: 'v', style: this._seg(big ? '76px' : '52px') }, [
              String(Math.round(v)),
              h(
                'span',
                {
                  key: 'u',
                  style: { fontSize: big ? '30px' : '22px', verticalAlign: 'super', opacity: 0.85 },
                },
                '°C',
              ),
            ]),
          ],
        );
      };
      const big = chosen.length === 1;
      const cols = chosen.map((key, i) =>
        h(
          'div',
          {
            key: key,
            style: {
              flex: 1,
              display: 'flex',
              borderRight: !big && i === 0 ? '1px solid rgba(255,255,255,.07)' : 'none',
            },
          },
          cluster(key === 'gpuTemp' ? 'GPU' : 'CPU', key, big),
        ),
      );
      return [
        this._labelEl(slot.label || 'CPU · GPU'),
        h(
          'div',
          {
            key: 'c',
            style: {
              position: 'absolute',
              inset: '78px 30px 44px',
              display: 'flex',
              alignItems: 'stretch',
            },
          },
          cols,
        ),
      ];
    }

    if (t === 'load') {
      const chosen = this._metricsFor(slot, ['cpuLoad', 'gpuLoad']);
      const big = chosen.length === 1;
      const col = (nm, key) =>
        h(
          'div',
          {
            key: nm,
            style: {
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              padding: '0 5%',
            },
          },
          [
            h(
              'div',
              { key: 'v', style: this._seg(big ? '52px' : '34px') },
              Math.round(S[key]) + '%',
            ),
            this._vBar(S[key]),
            h(
              'div',
              { key: 't', style: { letterSpacing: '.24em', fontSize: '13px', color: '#b9b09a' } },
              nm,
            ),
          ],
        );
      const cols = chosen.map((key) => col(key === 'gpuLoad' ? 'GPU' : 'CPU', key));
      return [
        this._labelEl(slot.label || 'SYSTEM LOAD'),
        h(
          'div',
          {
            key: 'b',
            style: {
              position: 'absolute',
              inset: big ? '78px 34% 44px' : '78px 22% 44px',
              display: 'flex',
              justifyContent: 'space-around',
              alignItems: 'stretch',
            },
          },
          cols,
        ),
      ];
    }

    if (t === 'pump') {
      const blades = [];
      for (let i = 0; i < 7; i++)
        blades.push(
          h('div', {
            key: i,
            style: {
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: '32px',
              height: '150px',
              margin: '-150px 0 0 -16px',
              transformOrigin: '16px 150px',
              transform: `rotate(${i * (360 / 7)}deg)`,
              background: 'linear-gradient(180deg,#6a6a72,#25252b)',
              borderRadius: '16px 16px 5px 5px',
              boxShadow: 'inset 0 0 0 1px #000',
              opacity: 0.9,
            },
          }),
        );
      return [
        this._labelEl(slot.label || 'PUMP'),
        h(
          'div',
          {
            key: 'fan',
            ref: (el) => (this._fanEl = el),
            style: {
              position: 'absolute',
              left: '50%',
              top: '52%',
              width: '316px',
              height: '316px',
              transform: 'translate(-50%,-50%)',
            },
          },
          blades,
        ),
        h(
          'div',
          {
            key: 'n',
            style: {
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 3,
              marginTop: '8px',
            },
          },
          [
            h('div', { key: 'r', style: this._seg('84px') }, String(Math.round(S.rpm))),
            h(
              'div',
              {
                key: 's',
                style: {
                  letterSpacing: '.32em',
                  fontSize: '15px',
                  color: '#b9b09a',
                  marginTop: '6px',
                },
              },
              'RPM',
            ),
          ],
        ),
      ];
    }

    if (t === 'network') {
      const chosen = this._metricsFor(slot, ['netDown', 'netUp']);
      const blockFor = (key) =>
        key === 'netDown'
          ? this._netBlock('▼', 'DOWN', S.netDown, 220, a)
          : this._netBlock('▲', 'UP', S.netUp, 45, '#8a8a93');
      return [
        this._labelEl(slot.label || 'NETWORK'),
        h(
          'div',
          {
            key: 'n',
            style: {
              position: 'absolute',
              inset: '96px 17% 108px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: '16px',
            },
          },
          chosen.map(blockFor),
        ),
      ];
    }

    if (t === 'clock') {
      const d = new Date();
      const tm =
        String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      const ds = d
        .toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' })
        .toUpperCase();
      const ticks = [];
      for (let i = 0; i < 12; i++)
        ticks.push(
          h('div', {
            key: i,
            style: {
              position: 'absolute',
              left: '50%',
              top: '10px',
              width: '2px',
              height: '10px',
              background: '#3a3a42',
              transformOrigin: '50% 206px',
              transform: `translateX(-50%) rotate(${i * 30}deg)`,
            },
          }),
        );
      return [
        h('div', { key: 'tk', style: { position: 'absolute', inset: 0 } }, ticks),
        h(
          'div',
          {
            key: 'wrap',
            style: {
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '14px',
            },
          },
          [
            h('div', { key: 'c', style: this._seg('110px') }, tm),
            h(
              'div',
              {
                key: 'd',
                style: {
                  fontFamily: "'Share Tech Mono',monospace",
                  fontSize: '26px',
                  letterSpacing: '.3em',
                  color: '#b9b09a',
                },
              },
              ds,
            ),
          ],
        ),
      ];
    }

    if (t === 'text') {
      return [
        h(
          'div',
          {
            key: 'tx',
            ref: (el) => (this._tickerEl = el),
            style: {
              position: 'absolute',
              top: '50%',
              left: 0,
              whiteSpace: 'nowrap',
              fontSize: '68px',
              letterSpacing: '.02em',
              fontFamily: "'Share Tech Mono',monospace",
              color: a,
              textShadow: `0 0 18px ${a}88`,
              transform: 'translate(416px,-50%)',
            },
          },
          slot.text || '',
        ),
      ];
    }

    if (t === 'gauge') {
      const key = slot.sensor || 'cpuTemp',
        m = SENSOR_META[key],
        v = S[key],
        f = this._clamp((v - m.min) / (m.max - m.min));
      return [
        this._labelEl(m.label.toUpperCase()),
        h(
          'div',
          {
            key: 'g',
            style: {
              position: 'absolute',
              inset: '80px 13% 48px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '30px',
            },
          },
          [
            h('div', { key: 'v', style: this._seg('118px') }, [
              String(Math.round(v)),
              m.unit
                ? h(
                    'span',
                    { key: 'u', style: { fontSize: '34px', marginLeft: '8px', opacity: 0.85 } },
                    m.unit,
                  )
                : null,
            ]),
            h(
              'div',
              {
                key: 'bar',
                style: {
                  width: '100%',
                  height: '22px',
                  background: '#1c1c20',
                  borderRadius: '11px',
                  overflow: 'hidden',
                  boxShadow: 'inset 0 0 0 1px #000',
                },
              },
              h('div', {
                style: {
                  width: `${f * 100}%`,
                  height: '100%',
                  background: a,
                  boxShadow: `0 0 14px ${a}`,
                  borderRadius: '11px',
                },
              }),
            ),
          ],
        ),
      ];
    }

    if (t === 'fps') {
      const fv = S.fps,
        ff = this._clamp(fv / 240);
      return [
        this._labelEl(slot.label || 'FPS'),
        h(
          'div',
          {
            key: 'g',
            style: {
              position: 'absolute',
              inset: '80px 12% 48px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '26px',
            },
          },
          [
            h('div', { key: 'v', style: this._seg('124px') }, [
              String(Math.round(fv)),
              h(
                'span',
                { key: 'u', style: { fontSize: '30px', marginLeft: '10px', opacity: 0.85 } },
                'FPS',
              ),
            ]),
            h(
              'div',
              {
                key: 'bar',
                style: {
                  width: '100%',
                  height: '22px',
                  background: '#1c1c20',
                  borderRadius: '11px',
                  overflow: 'hidden',
                  boxShadow: 'inset 0 0 0 1px #000',
                },
              },
              h('div', {
                style: {
                  width: `${ff * 100}%`,
                  height: '100%',
                  background: a,
                  boxShadow: `0 0 14px ${a}`,
                  borderRadius: '11px',
                },
              }),
            ),
          ],
        ),
      ];
    }

    // off / standby
    return [
      h(
        'div',
        {
          key: 'sb',
          style: {
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
          },
        },
        [
          h('div', {
            key: 'd',
            style: {
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: a,
              boxShadow: `0 0 18px ${a}`,
              animation: 'pd-breathe 3s ease-in-out infinite',
            },
          }),
          h(
            'div',
            {
              key: 's',
              style: {
                letterSpacing: '.44em',
                textTransform: 'uppercase',
                fontSize: '26px',
                color: '#565660',
                marginTop: '6px',
              },
            },
            'Standby',
          ),
        ],
      ),
    ];
  }

  _metricsFor(slot, all) {
    if (Array.isArray(slot.metrics) && slot.metrics.length) {
      const set = slot.metrics.filter((k) => all.includes(k));
      if (set.length) return all.filter((k) => set.includes(k)); // keep canonical order
    }
    return all;
  }

  _tick() {
    // Nudged each 450ms redraw so flame/spark jitter re-rolls; kept for parity
    // with the mockup's `state.tick`.
    return this._tickN || 0;
  }

  // ---- frame / DOM plumbing ----
  _build() {
    const root = this.shadowRoot;
    root.textContent = '';
    const style = document.createElement('style');
    style.textContent =
      `:host{display:inline-block;line-height:0}*{box-sizing:border-box}` + KEYFRAMES;
    root.appendChild(style);

    this._stage = h('div', {
      style: {
        position: 'relative',
        width: DESIGN_SIZE + 'px',
        height: DESIGN_SIZE + 'px',
        transformOrigin: 'top left',
      },
    });

    this._bezel = h('div', {
      style: {
        width: '460px',
        height: '460px',
        borderRadius: '50%',
        position: 'relative',
        padding: '22px',
        background:
          'conic-gradient(from 210deg,#3a3a42,#1a1a1e 30%,#2e2e35 55%,#161619 80%,#3a3a42),#202024',
        boxShadow: '0 30px 70px -22px #000, inset 0 2px 3px #47474f, inset 0 -3px 6px #000',
      },
    });

    // machined inner texture
    this._bezel.appendChild(
      h('div', {
        style: {
          position: 'absolute',
          inset: '14px',
          borderRadius: '50%',
          background:
            'repeating-radial-gradient(circle at 50% 50%,rgba(255,255,255,.03) 0 1px,transparent 1px 3px)',
          boxShadow: 'inset 0 0 0 1px #000, inset 0 0 22px #000',
        },
      }),
    );

    // four screws N/S/E/W
    const screw = (pos) =>
      h('span', {
        style: {
          width: '9px',
          height: '9px',
          borderRadius: '50%',
          position: 'absolute',
          background: 'radial-gradient(circle at 40% 35%,#57575e,#141416)',
          boxShadow: 'inset 0 0 0 1px #000',
          ...pos,
        },
      });
    this._bezel.append(
      screw({ top: '9px', left: '50%', transform: 'translateX(-50%)' }),
      screw({ bottom: '9px', left: '50%', transform: 'translateX(-50%)' }),
      screw({ right: '9px', top: '50%', transform: 'translateY(-50%)' }),
      screw({ left: '9px', top: '50%', transform: 'translateY(-50%)' }),
    );

    // accent power LED at 12 o'clock
    this._led = h('span', {
      style: {
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        position: 'absolute',
        top: '26px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 6,
      },
    });
    this._bezel.appendChild(this._led);

    // glass
    this._glass = h('div', {
      style: {
        position: 'absolute',
        inset: '22px',
        borderRadius: '50%',
        overflow: 'hidden',
        background: 'radial-gradient(120% 120% at 50% 15%, #15161b 0%, #08090b 62%)',
        boxShadow: 'inset 0 0 0 2px #000, inset 0 0 46px 8px #000',
      },
    });
    this._panelHost = h('div', { style: { position: 'absolute', inset: 0 } });
    this._glass.appendChild(this._panelHost);
    this._glass.appendChild(
      h('div', {
        style: {
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 5,
          background:
            'repeating-linear-gradient(0deg,rgba(0,0,0,.16) 0 1px,transparent 1px 3px),radial-gradient(130% 80% at 50% -20%,rgba(255,255,255,.07),transparent 55%)',
        },
      }),
    );
    this._bezel.appendChild(this._glass);

    this._deviceLabelEl = h(
      'div',
      {
        style: {
          position: 'absolute',
          bottom: '30px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 6,
          letterSpacing: '.3em',
          fontSize: '18px',
          color: '#7b7b84',
        },
      },
      this._deviceLabel,
    );
    this._bezel.appendChild(this._deviceLabelEl);

    this._stage.appendChild(this._bezel);
    root.appendChild(this._stage);
  }

  _applyAccent() {
    const a = this._acc();
    this.style.setProperty('--accent', a);
    if (this._led) this._led.style.background = a === '#ffb020' ? '#ffb020' : a;
    if (this._led) this._led.style.boxShadow = `0 0 10px ${a},0 0 2px #fff`;
  }

  _applySize() {
    if (!this._stage) return;
    const s = this._size / DESIGN_SIZE;
    this._stage.style.transform = `scale(${s})`;
    this.style.width = this._size + 'px';
    this.style.height = this._size + 'px';
  }

  _renderPanel(flick) {
    if (!this._panelHost) return;
    if (flick) this._tickN = 0;
    else this._tickN = (this._tickN || 0) + 1;

    const slot = this._panels[this.activeIndex] || this._panels[0] || null;
    this._fanEl = null;
    this._tickerEl = null;
    const wrap = h(
      'div',
      {
        style: {
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          animation: flick ? 'pd-flick .24s ease' : 'none',
        },
      },
      this._renderPanelContent(slot),
    );
    this._panelHost.textContent = '';
    this._panelHost.appendChild(wrap);
    if (this._fanEl) this._fanEl.style.transform = `translate(-50%,-50%) rotate(${this._ang}deg)`;
    if (this._tickerEl) this._startTicker(this._tickerEl);
  }

  _startTicker(el) {
    const containerW = (this._panelHost && this._panelHost.clientWidth) || 416;
    const textW = el.scrollWidth || el.offsetWidth || containerW;
    const start = containerW;
    const end = -textW - 20;
    const dur = Math.max(4000, ((start - end) / 90) * 1000); // ~90px/sec constant speed
    if (el.animate) {
      el.animate(
        [{ transform: `translate(${start}px,-50%)` }, { transform: `translate(${end}px,-50%)` }],
        { duration: dur, iterations: Infinity, easing: 'linear' },
      );
    }
  }

  _liveRedraw() {
    // text/off run their own CSS/WAAPI animation; re-rendering them each tick
    // would restart it (the "stuck ticker" / stuttering-breathe bug), so skip.
    const slot = this._panels[this.activeIndex];
    const t = slot ? slot.type : 'off';
    if (t === 'text' || t === 'off') return;
    this._renderPanel(false);
  }

  // ---- cycling + spin ----
  _spin = (now) => {
    if (this._last == null) this._last = now;
    const dt = (now - this._last) / 1000;
    this._last = now;
    this._ang = (this._ang + (this._sensors.rpm / 60) * 360 * dt * 0.05) % 360;
    if (this._fanEl) this._fanEl.style.transform = `translate(-50%,-50%) rotate(${this._ang}deg)`;
    this._raf = requestAnimationFrame(this._spin);
  };

  _reschedule() {
    clearTimeout(this._cycleT);
    if (this._controlledIndex != null || !this._autoCycle || this._panels.length < 2) return;
    const cur = this._panels[this._active];
    const dur = ((cur && cur.duration) || 4) * 1000;
    // self-correcting: schedule against when the panel actually became active.
    const elapsed = performance.now() - this._cycleStart;
    const wait = Math.max(50, dur - (elapsed % dur));
    this._cycleT = setTimeout(() => this._next(), wait);
  }

  _next() {
    if (!this._panels.length) return;
    this._setActive((this._active + 1) % this._panels.length, false);
    this._reschedule();
  }

  _setActive(i, silent) {
    if (i === this._active && this._controlledIndex == null) {
      // still re-flick when explicitly re-selected
    }
    this._active = i;
    this._cycleStart = performance.now();
    this._renderPanel(true);
    if (!silent) {
      if (typeof this.onActiveChange === 'function') this.onActiveChange(i);
      this.dispatchEvent(new CustomEvent('activechange', { detail: { index: i } }));
    }
  }
}

if (!customElements.get('pump-deck')) {
  customElements.define('pump-deck', PumpDeck);
}
