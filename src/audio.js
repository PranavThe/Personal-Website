// audio.js: a live, generative Web Audio score for the site.
//
// It follows a Hindustani performance in Raga Yaman (Sa = D) as the visitor
// scrolls: alap, jor, gat, a muffled passage inside the violin, jhala and a
// closing tihai. The violin is sampled; everything else is synthesised here:
// tanpura and pizzicato (Karplus-Strong), tabla (tuned partials), the reverb
// impulse response and the sound effects.
//
// Violin samples: MusyngKite soundfont by Paul Batchelor, CC BY-SA 3.0.
// No dependencies; Web Audio API only.

// ---------------------------------------------------------------------------
// Music constants
// ---------------------------------------------------------------------------

const SA = 62; // D4
const LOOKAHEAD = 0.12; // seconds scheduled ahead of the audio clock
const TICK_MS = 25;

// Yaman swaras as semitones from Sa ('.' lower octave, "'" upper octave).
const SW = {
  'P.': -5, 'D.': -3, 'N.': -1,
  S: 0, R: 2, G: 4, M: 6, P: 7, D: 9, N: 11,
  "S'": 12, "R'": 14, "G'": 16,
};
const YAMAN_UP = [-5, -3, -1, 0, 2, 4, 6, 7, 9, 11, 12, 14, 16, 18, 19];

// Violin samples and their measured tuning error (cents to add).
const SAMPLE_SET = [
  ['G3', 55], ['Bb3', 58], ['Db4', 61], ['E4', 64], ['G4', 67], ['Bb4', 70],
  ['Db5', 73], ['E5', 76], ['G5', 79], ['Bb5', 82], ['Db6', 85],
];
const TUNING_FIX = { G3: 7, Bb3: 7, Db4: 5.5, E4: 1 };

const OPEN_HZ = [196, 293.66, 440, 659.25];
const STAGE_SET = new Set(['silent', 'alap', 'jor', 'gat', 'inside', 'jhala', 'tihai', 'free']);
const PULSED = { jor: 90, gat: 100, jhala: 132 };

// Mix levels.
const MASTER_LEVEL = 0.9;
const DRONE_BASE = 0.2;
const DRONE_LEVEL = { silent: 0, alap: 1, jor: 0.9, gat: 0.74, inside: 1, jhala: 0.68, tihai: 0.78, free: 0.62 };
const REVERB_SEND = 0.34;

// Tanpura: Pa, Sa, Sa, low Sa. The two Sa strings sit a cent apart so they shimmer.
const TANPURA = [
  { hz: 110.0, t60: 6.5, s: 0.08, pan: -0.3, vel: 0.85, seed: 11 },
  { hz: 146.83 * Math.pow(2, 0.8 / 1200), t60: 6.0, s: 0.08, pan: 0.12, vel: 0.72, seed: 23 },
  { hz: 146.83 * Math.pow(2, -0.8 / 1200), t60: 6.0, s: 0.08, pan: 0.28, vel: 0.72, seed: 37 },
  { hz: 73.42, t60: 7.0, s: 0.07, pan: -0.08, vel: 0.95, seed: 41 },
];
const TANPURA_GAPS = [1.05, 1.05, 1.05, 1.35];

// Teentaal theka and its accents (sam, tali on 5 and 13, khali on 9).
const THEKA = ['dha', 'dhin', 'dhin', 'dha', 'dha', 'dhin', 'dhin', 'dha',
  'dha', 'tin', 'tin', 'ta', 'ta', 'dhin', 'dhin', 'dha'];
const THEKA_ACC = [1, 0.62, 0.6, 0.66, 0.82, 0.62, 0.6, 0.66, 0.72, 0.58, 0.56, 0.6, 0.78, 0.62, 0.6, 0.68];

// Alap: free phrases. Token: [_]SWARA[<FROM]:seconds. '_' = same bow (legato),
// '<FROM' = meend (slide) into the note from FROM, ',' = a breath.
const ALAP = [
  'N.:1.0 _S:2.4',
  'N.:0.9 _R:1.0 _G:1.9 , R:0.9 S<R:2.3',
  'N.:0.8 _D.:0.8 _N.:0.9 _R:1.1 S<R:2.2',
  'G:1.3 M:0.8 _P:1.9 , M:0.7 _G:0.9 R<G:0.9 S<R:2.2',
  'G:1.5 R<G:0.9 , N.:0.8 _R:1.0 S<R:2.1',
  "M:0.8 _D:0.9 _N:1.1 S'<N:2.3",
  'P:1.6 M<P:0.9 G<M:1.2 , R:0.8 S<R:2.2',
  "N:0.7 _R':1.0 S'<R':1.8 , N:0.8 _D:0.8 P<D:1.7 , M:0.7 _G:0.8 R<G:0.8 S<R:2.4",
].map(parseAlap);
const ALAP_ORDER = [0, 1, 2, 1, 3, 4, 6, 5, 2, 3, 7, 5, 6, 7];

// Jor: rhythmic phrases in eighth notes ('-' holds, '.' rests).
const JOR = [
  'N. R G - R S - .',
  'N. D. N. R S - - .',
  'G M P - M G R S - .',
  "M D N S' - - N D P - - .",
  "N R' S' - N D P - M G R S - - - .",
  'S S N. N. D. D. N. R S - - .',
  'G G M M P P M G R - S - - .',
  "P M D N S' N D P M G R S - - - .",
].map(parseEighths);

// Gat: a 16-beat composition in eighths; first half + one of three second halves.
const GAT_A = 'S - N. R G - R G M - G R G - - .';
const GAT_A2 = 'S - N. D. N. R G - M P M G R - G .';
const GAT_B = [
  'M D N - D P M - G M G R N. R G R',
  "M D N S' R' S' N D P - M G N. R G R",
  "P M G M D N S' - N D P M G R N. R",
];

// Jhala: continuous melody in eighths (two notes per beat).
const JHALA = [
  'S N. R G R S N. S',
  'G M P M G R S S',
  "M D N S' N D P M",
  "G M D N S' S' N D P M G R S S N. S",
  'N. R G M P M G R',
  'P P M M G G R S',
  "M D N R' S' N D P",
].map((s) => s.trim().split(/\s+/).map((k) => SW[k]));

// Karplus-Strong flavours for plucked voices.
const KS_KIND = {
  pizz: { dur: 1.2, t60: 0.85, s: 0.38, pos: 0.2, soft: 0.55, fade: 0.2 },
  chik: { dur: 0.9, t60: 0.6, s: 0.22, pos: 0.13, soft: 0.3, fade: 0.2 },
  tick: { dur: 0.35, t60: 0.22, s: 0.3, pos: 0.18, soft: 0.4, fade: 0.08 },
};

// Tabla strokes. Dayan: tuned harmonic partials [ratio, amp, decay s] + click.
const DAYAN = {
  na: { dur: 0.9, click: 0.32, clickT: 0.0035, bend: 0.015,
    parts: [[1, 0.22, 0.09], [2, 1, 0.38], [3, 0.62, 0.27], [4.02, 0.34, 0.18], [5.03, 0.2, 0.12], [6.05, 0.1, 0.08]] },
  tin: { dur: 1.0, click: 0.14, clickT: 0.003, bend: 0.01,
    parts: [[1, 1, 0.42], [2, 0.5, 0.3], [3, 0.22, 0.2], [4.02, 0.08, 0.12]] },
  ta: { dur: 0.55, click: 0.45, clickT: 0.004, bend: 0.02,
    parts: [[1, 0.18, 0.05], [2, 1, 0.19], [3, 0.7, 0.15], [4.02, 0.4, 0.1], [5.03, 0.22, 0.07]] },
  ti: { dur: 0.14, click: 0.8, clickT: 0.006, bend: 0.03,
    parts: [[1, 0.5, 0.025], [2.1, 0.4, 0.02], [3.3, 0.3, 0.015]] },
};
// Bayan: low sine gliding up from f0 to f1, with a little harmonic content and a thump.
const BAYAN = {
  ge: { dur: 1.3, f0: 82, f1: 94, glideT: 0.16, tau: 0.42, h2: 0.2, h3: 0.07, thump: 0.35 },
  boom: { dur: 2.6, f0: 74, f1: 90, glideT: 0.35, tau: 0.85, h2: 0.24, h3: 0.08, thump: 0.45 },
  heart: { dur: 0.9, f0: 64, f1: 70, glideT: 0.12, tau: 0.2, h2: 0.28, h3: 0.1, thump: 0.5 },
};
const DRUM_LEVEL = { na: 0.55, tin: 0.5, ta: 0.55, ti: 0.4, ge: 0.65, ke: 0.5, boom: 0.9, heart: 0.5 };

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const stringOf = (midi) => {
  const m = Math.round(midi);
  return m < 62 ? 0 : m < 69 ? 1 : m < 76 ? 2 : 3;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const idle = () => new Promise((r) => setTimeout(r, 0));
const rand = (a, b) => a + Math.random() * (b - a);
function pick(list, last) {
  if (list.length < 2) return list[0];
  let x;
  do x = list[Math.floor(Math.random() * list.length)]; while (x === last);
  return x;
}
function rethrowLater(e) {
  setTimeout(() => { throw e; }, 0);
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function parseAlap(str) {
  return str.split(',').map((sub) => sub.trim().split(/\s+/).map((tok) => {
    let legato = false;
    if (tok[0] === '_') { legato = true; tok = tok.slice(1); }
    const [name, d] = tok.split(':');
    let sw = name, from = null;
    if (name.includes('<')) {
      const [a, b] = name.split('<');
      sw = a; from = SW[b] - SW[a]; legato = true;
    }
    return { off: SW[sw], from, dur: +d, legato };
  }));
}

function parseEighths(str) {
  const toks = str.trim().split(/\s+/);
  const notes = [];
  toks.forEach((tk, i) => {
    const last = notes[notes.length - 1];
    if (tk === '-') {
      if (last && last.i + last.len === i) last.len++;
    } else if (tk !== '.') {
      notes.push({ i, off: SW[tk], len: 1 });
    }
  });
  return { notes, len: toks.length };
}

function nextUp(off) {
  for (const x of YAMAN_UP) if (x > off) return x;
  return off + 1;
}

function normalize(y, peak = 1) {
  let m = 0;
  for (let i = 0; i < y.length; i++) { const a = Math.abs(y[i]); if (a > m) m = a; }
  if (m > 0) { const k = peak / m; for (let i = 0; i < y.length; i++) y[i] *= k; }
  return y;
}

function fades(y, sr, inS, outS) {
  const a = Math.min(y.length, Math.floor(sr * inS));
  for (let i = 0; i < a; i++) y[i] *= i / a;
  const b = Math.min(y.length, Math.floor(sr * outS));
  for (let i = 0; i < b; i++) {
    const u = i / b;
    y[y.length - 1 - i] *= u * u;
  }
  return y;
}

function dcBlock(y, sr, hz) {
  const R = 1 - (2 * Math.PI * hz) / sr;
  let x1 = 0, y1 = 0;
  for (let i = 0; i < y.length; i++) {
    const x = y[i];
    const v = x - x1 + R * y1;
    x1 = x; y1 = v; y[i] = v;
  }
  return y;
}

// Karplus-Strong string with an allpass fractional delay for exact tuning.
// s: weight of the two-tap loop filter (small = bright, long-ringing highs).
function karplus(sr, o) {
  const hz = o.hz, t60 = o.t60, s = o.s != null ? o.s : 0.3;
  const n = Math.max(1, Math.floor(sr * o.dur));
  const y = new Float32Array(n);
  const P = sr / hz;
  const D = P - s;
  const Di = Math.max(2, Math.floor(D - 0.1));
  const fr = D - Di;
  const a = (1 - fr) / (1 + fr);
  const g = Math.pow(10, -3 / (t60 * hz));
  // Excitation: soft (low-passed) noise with a pluck-position comb.
  const L = Math.max(2, Math.round(P));
  const r = rng(o.seed || 1);
  const raw = new Float32Array(L);
  const soft = o.soft != null ? o.soft : 0.5;
  for (let i = 0; i < L; i++) {
    const w = r() * 2 - 1;
    raw[i] = i ? (1 - soft) * w + soft * raw[i - 1] : w;
  }
  const k = Math.max(1, Math.round((o.pos || 0.2) * P));
  const exc = new Float32Array(L);
  let mean = 0;
  for (let i = 0; i < L; i++) { exc[i] = raw[i] - (i >= k ? raw[i - k] : 0); mean += exc[i]; }
  mean /= L;
  for (let i = 0; i < L; i++) exc[i] -= mean;
  normalize(exc);
  let dlp = 0, app = 0;
  for (let i = 0; i < n; i++) {
    const j = i - Di;
    const dl = j >= 0 ? y[j] : 0;
    const ap = a * dl + dlp - a * app;
    const v = g * ((1 - s) * ap + s * app);
    dlp = dl; app = ap;
    y[i] = (i < L ? exc[i] : 0) + v;
  }
  normalize(y);
  return fades(y, sr, 0.0015, o.fade || 0.15);
}

function tanpuraString(sr, s) {
  const y = karplus(sr, { hz: s.hz, dur: 6.2, t60: s.t60, s: s.s, pos: 0.23, soft: 0.42, seed: s.seed, fade: 0.01 });
  // Gentle asymmetric soft clip: the jawari buzz (stronger while the string is loud).
  const drive = 1.7, bias = 0.12, off = Math.tanh(drive * bias);
  for (let i = 0; i < y.length; i++) y[i] = Math.tanh(drive * (y[i] + bias)) - off;
  dcBlock(y, sr, 12);
  normalize(y);
  return fades(y, sr, 0.003, 0.9);
}

function dayanStroke(sr, p, f0, seed) {
  const n = Math.floor(sr * p.dur);
  const y = new Float32Array(n);
  const r = rng(seed);
  const det = 1 + (r() - 0.5) * 0.004;
  const bendK = Math.exp(-1 / (0.02 * sr));
  for (const [ratio, amp0, tau0] of p.parts) {
    const fBase = f0 * ratio * det;
    if (fBase > sr * 0.45) continue;
    const decay = Math.exp(-1 / (tau0 * (0.9 + 0.2 * r()) * sr));
    let e = amp0 * (0.9 + 0.2 * r());
    let ph = r() * Math.PI * 2, bend = p.bend;
    const w = (2 * Math.PI * fBase) / sr;
    for (let i = 0; i < n && e > 1e-5; i++) {
      ph += w * (1 + bend);
      bend *= bendK;
      y[i] += e * Math.sin(ph);
      e *= decay;
    }
  }
  // Click: high-passed noise burst.
  const cn = Math.min(n, Math.floor(sr * p.clickT * 8));
  const ck = Math.exp(-1 / (p.clickT * sr));
  let ce = p.click, prev = 0;
  for (let i = 0; i < cn; i++) {
    const w = r() * 2 - 1;
    y[i] += ce * (w - prev);
    prev = w; ce *= ck;
  }
  normalize(y);
  return fades(y, sr, 0.0008, 0.02);
}

function bayanStroke(sr, p, seed) {
  const n = Math.floor(sr * p.dur);
  const y = new Float32Array(n);
  const r = rng(seed);
  const f0 = p.f0 * (1 + (r() - 0.5) * 0.03), f1 = p.f1 * (1 + (r() - 0.5) * 0.03);
  const gk = Math.exp(-1 / (p.glideT * sr));
  const dk = Math.exp(-1 / (p.tau * sr));
  let ph = 0, gl = 1, e = 1;
  for (let i = 0; i < n; i++) {
    const f = f1 + (f0 - f1) * gl;
    gl *= gk;
    ph += (2 * Math.PI * f) / sr;
    y[i] = e * (Math.sin(ph) + p.h2 * Math.sin(2 * ph + 0.3) * e + p.h3 * Math.sin(3.02 * ph) * e * e);
    e *= dk;
  }
  // Thump: low-passed noise.
  const tk = Math.exp(-1 / (0.012 * sr));
  let te = p.thump, lp = 0;
  for (let i = 0; i < Math.min(n, sr * 0.08); i++) {
    lp += 0.03 * (r() * 2 - 1 - lp);
    y[i] += te * lp * 8;
    te *= tk;
  }
  normalize(y);
  return fades(y, sr, 0.002, 0.05);
}

function keStroke(sr, seed) {
  const n = Math.floor(sr * 0.18);
  const y = new Float32Array(n);
  const r = rng(seed);
  const k = Math.exp(-1 / (0.028 * sr)), k2 = Math.exp(-1 / (0.035 * sr));
  let e = 1, e2 = 0.5, a = 0, b = 0, ph = 0;
  for (let i = 0; i < n; i++) {
    a += 0.08 * (r() * 2 - 1 - a);
    b += 0.08 * (a - b);
    ph += (2 * Math.PI * 150) / sr;
    y[i] = e * b * 6 + e2 * Math.sin(ph);
    e *= k; e2 *= k2;
  }
  normalize(y);
  return fades(y, sr, 0.001, 0.03);
}

// Stereo hall impulse response: exponentially decaying decorrelated noise that
// gets darker as it decays, with a few early reflections.
function hallIR(sr, seconds = 2.8, t60 = 2.3) {
  const n = Math.floor(sr * seconds);
  const pre = Math.floor(sr * 0.014);
  const out = [];
  for (let ch = 0; ch < 2; ch++) {
    const y = new Float32Array(n);
    const r = rng(101 + ch * 7919);
    let lp = 0;
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / sr;
      const k = 0.3 + 0.52 * Math.min(1, t / seconds);
      lp += (1 - k) * (r() * 2 - 1 - lp);
      y[i] = lp * Math.exp((-6.91 * t) / t60);
    }
    const taps = [0.007, 0.012, 0.019, 0.026, 0.035, 0.047, 0.061];
    taps.forEach((d, j) => {
      const at = pre + Math.floor(sr * (d + ch * 0.0023 * (j % 2 ? 1 : -0.6)));
      if (at > 0 && at < n) y[at] += (r() < 0.5 ? -1 : 1) * 0.5 * Math.pow(0.8, j);
    });
    const fi = Math.floor(sr * 0.004);
    for (let i = 0; i < fi; i++) y[pre + i] *= i / fi;
    fades(y, sr, 0, 0.25);
    let e = 0;
    for (let i = 0; i < n; i++) e += y[i] * y[i];
    const kk = 1 / Math.sqrt(e || 1);
    for (let i = 0; i < n; i++) y[i] *= kk;
    out.push(y);
  }
  return out;
}

async function fetchBuffer(url, ms) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => { if (ctrl) ctrl.abort(); }, ms);
  try {
    const res = await fetch(url, ctrl ? { signal: ctrl.signal } : undefined);
    if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
    return await res.arrayBuffer();
  } finally {
    clearTimeout(timer);
  }
}

function decode(ctx, ab) {
  return new Promise((resolve, reject) => {
    try {
      const p = ctx.decodeAudioData(ab, resolve, reject);
      if (p && typeof p.then === 'function') p.then(resolve, reject);
    } catch (e) {
      reject(e);
    }
  });
}

// ---------------------------------------------------------------------------
// Score
// ---------------------------------------------------------------------------

export class Score {
  constructor() {
    this.onNote = null;
    this.onBeat = null;

    this._ctx = null;
    this._started = false;
    this._muted = false;
    this._loaded = false;
    this._loadP = null;
    this._samples = [];
    this._ks = new Map();
    this._tanpura = null;
    this._tabla = null;
    this._open = null;
    this._noise = null;
    this._synthReady = false;

    this._stage = 'silent';
    this._requested = 'silent';
    this._pending = null;
    this._st = {};
    this._segT = Infinity;
    this._horizon = 0;
    this._q = [];
    this._qDirty = false;
    this._voices = new Set();
    this._tVoice = [null, null, null, null];
    this._droneOn = false;
    this._tNext = 0;
    this._tIdx = 0;
    this._alapI = 0;
    this._alapLast = -1;
    this._tihai = null;
    this._tuning = null;
    this._tuningActive = false;
    this._afterTune = null;
    this._insideX = 0;
    this._exprX = 0.35;
    this._ctl = { inside: -1, expr: -1 };
    this._lat = 0;
    this._timer = null;
    this._lastTickSfx = 0;
    this._errors = 0;
    this._lastError = null;

    try {
      const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
      if (AC) {
        this._ctx = new AC();
        this._build();
      }
    } catch (e) {
      this._ctx = null;
      this._fail(e);
    }
  }

  // ---- public API ---------------------------------------------------------

  async load(base = './audio/') {
    if (!this._ctx) return;
    if (!this._loadP) {
      let b = typeof base === 'string' ? base : './audio/';
      if (b && !b.endsWith('/')) b += '/';
      this._loadP = this._doLoad(b)
        .catch((e) => this._fail(e))
        .then(() => { this._loaded = true; });
    }
    return this._loadP;
  }

  async start() {
    const c = this._ctx;
    if (!c) return;
    let resumeP = null;
    try {
      if (c.state !== 'running') resumeP = c.resume();
    } catch (e) { /* ignore */ }
    this._unlock();
    const settle = () => (resumeP ? Promise.race([Promise.resolve(resumeP).catch(() => {}), wait(1500)]) : null);
    if (this._started) { await settle(); return; }
    this._started = true;
    if (!this._loadP) this.load();
    await settle();
    try {
      const t = c.currentTime, g = this._master.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(0, t);
      if (!this._muted) g.linearRampToValueAtTime(MASTER_LEVEL, t + 2);
      this._applyControls(t, true);
    } catch (e) { this._fail(e); }
    if (!this._timer) this._timer = setInterval(() => this._tick(), TICK_MS);
    this._tick();
  }

  tune(onStep) {
    if (!this._ctx || !this._started) return Promise.resolve();
    if (!this._tuning) {
      this._tuning = this._runTune(onStep)
        .catch((e) => this._fail(e))
        .then(() => { this._tuning = null; });
    }
    return this._tuning;
  }

  setStage(name) {
    if (!STAGE_SET.has(name)) return null;
    const c = this._ctx;
    if (!c || !this._started) return null;
    if (this._tuningActive) { this._afterTune = name; return null; }
    const now = c.currentTime;
    if (name === this._requested) {
      if (name === 'tihai' && this._tihai && this._tihai.sam > now) return { samInMs: this._ms(this._tihai.sam) };
      return null;
    }
    this._requested = name;
    try {
      return this._request(name, now);
    } catch (e) {
      this._fail(e);
      return null;
    }
  }

  setInside(x) {
    this._insideX = clamp(+x || 0, 0, 1);
  }

  setExpression(x) {
    this._exprX = clamp(+x || 0, 0, 1);
  }

  pluck(stringIndex, velocity = 1) {
    const c = this._ctx;
    if (!c || !this._started || !this._open) return;
    const i = Math.round(+stringIndex);
    if (!(i >= 0 && i <= 3)) return;
    const v = clamp(+velocity, 0, 1);
    if (!(v > 0)) return;
    try {
      const t = c.currentTime;
      const src = c.createBufferSource();
      src.buffer = this._open[i];
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1400 + 6000 * v;
      lp.Q.value = 0.5;
      const g = c.createGain();
      g.gain.value = 0.5 * Math.pow(v, 1.1);
      src.connect(lp); lp.connect(g); g.connect(this._pizz);
      src.onended = () => { try { g.disconnect(); } catch (e) { /* ignore */ } };
      src.start(t);
      this._note(i, v, t);
    } catch (e) { this._fail(e); }
  }

  creak() {
    if (!this._ready()) return;
    try {
      const c = this._ctx, sr = c.sampleRate, t = c.currentTime + 0.01;
      const dur = 0.42, n = Math.floor(sr * dur);
      const y = new Float32Array(n);
      let pos = Math.floor(sr * 0.004);
      while (pos < n - sr * 0.01) {
        const u = pos / n;
        const rate = 70 + 230 * Math.pow(Math.sin(Math.PI * u), 1.3) * rand(0.85, 1.15);
        const amp = Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.08)), 0.6) * rand(0.55, 1);
        const len = sr * rand(0.0006, 0.0012);
        for (let k = 0; k < len * 5 && pos + k < n; k++) y[pos + k] += amp * (Math.random() * 2 - 1) * Math.exp(-k / len);
        pos += Math.max(1, Math.floor(sr / rate));
      }
      fades(y, sr, 0.002, 0.03);
      const src = c.createBufferSource();
      src.buffer = this._buf(y);
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass'; bp.Q.value = 5;
      bp.frequency.setValueAtTime(1150 * rand(0.9, 1.1), t);
      bp.frequency.linearRampToValueAtTime(1550 * rand(0.9, 1.1), t + dur);
      const bp2 = c.createBiquadFilter();
      bp2.type = 'bandpass'; bp2.Q.value = 8; bp2.frequency.value = 2900 * rand(0.92, 1.08);
      const g = c.createGain(); g.gain.value = 1.8;
      const g2 = c.createGain(); g2.gain.value = 0.8;
      src.connect(bp); bp.connect(g); g.connect(this._sfx);
      src.connect(bp2); bp2.connect(g2); g2.connect(this._sfx);
      src.onended = () => { try { g.disconnect(); g2.disconnect(); } catch (e) { /* ignore */ } };
      src.start(t);
    } catch (e) { this._fail(e); }
  }

  whoosh() {
    if (!this._ready()) return;
    try {
      const c = this._ctx, t = c.currentTime + 0.01, D = 1.4;
      const noise = this._noiseBuf();
      const layer = (f0, f1, f2, q, level, offset) => {
        const src = c.createBufferSource();
        src.buffer = noise; src.loop = true;
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass'; bp.Q.value = q;
        bp.frequency.setValueAtTime(f0, t);
        bp.frequency.exponentialRampToValueAtTime(f1, t + 0.72);
        bp.frequency.exponentialRampToValueAtTime(f2, t + D);
        const g = c.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(level, t + 0.62);
        g.gain.linearRampToValueAtTime(level * 0.4, t + 1.0);
        g.gain.linearRampToValueAtTime(0, t + D);
        src.connect(bp); bp.connect(g);
        src.start(t, offset);
        src.stop(t + D + 0.05);
        src.onended = () => { try { g.disconnect(); } catch (e) { /* ignore */ } };
        return g;
      };
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 5500;
      const pan = this._panner(-0.45);
      if (pan.pan) { pan.pan.setValueAtTime(-0.45, t); pan.pan.linearRampToValueAtTime(0.45, t + D); }
      layer(240, 2400, 320, 1.1, 0.34, Math.random() * 1.5).connect(lp);
      layer(110, 420, 130, 0.9, 0.28, Math.random() * 1.5).connect(lp);
      lp.connect(pan); pan.connect(this._sfx);
      setTimeout(() => { try { pan.disconnect(); } catch (e) { /* ignore */ } }, (D + 0.5) * 1000);
    } catch (e) { this._fail(e); }
  }

  knock() {
    if (!this._ready()) return;
    try {
      const c = this._ctx, sr = c.sampleRate, t = c.currentTime + 0.005;
      const n = Math.floor(sr * 0.35);
      const y = new Float32Array(n);
      const modes = [[180, 1, 0.07], [395, 0.55, 0.045], [760, 0.3, 0.028], [1480, 0.12, 0.014]];
      for (const [f, a, tau] of modes) {
        const w = (2 * Math.PI * f * rand(0.96, 1.04)) / sr, k = Math.exp(-1 / (tau * sr));
        let e = a * rand(0.85, 1.1);
        for (let i = 0; i < n && e > 1e-5; i++) { y[i] += e * Math.sin(w * i); e *= k; }
      }
      let lp = 0, e = 0.35;
      const k = Math.exp(-1 / (0.003 * sr));
      for (let i = 0; i < sr * 0.02; i++) { lp += 0.3 * (Math.random() * 2 - 1 - lp); y[i] += e * lp; e *= k; }
      normalize(y);
      fades(y, sr, 0.0005, 0.04);
      const src = c.createBufferSource();
      src.buffer = this._buf(y);
      const f = c.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 3500;
      const g = c.createGain(); g.gain.value = 0.3;
      src.connect(f); f.connect(g); g.connect(this._sfx);
      src.onended = () => { try { g.disconnect(); } catch (err) { /* ignore */ } };
      src.start(t);
    } catch (e) { this._fail(e); }
  }

  tick() {
    if (!this._ready()) return;
    const c = this._ctx, t = c.currentTime;
    if (t - this._lastTickSfx < 0.035) return;
    this._lastTickSfx = t;
    try {
      const midi = [86, 88, 90, 93, 95][Math.floor(Math.random() * 5)];
      const buf = this._ksGet('tick', midi);
      if (!buf) return;
      const src = c.createBufferSource();
      src.buffer = buf;
      const g = c.createGain(); g.gain.value = 0.045;
      src.connect(g); g.connect(this._sfx);
      src.onended = () => { try { g.disconnect(); } catch (e) { /* ignore */ } };
      src.start(t);
    } catch (e) { this._fail(e); }
  }

  setMuted(muted) {
    this._muted = !!muted;
    const c = this._ctx;
    if (!c || !this._started) return;
    try {
      if (!this._muted && c.state !== 'running') Promise.resolve(c.resume()).catch(() => {});
      const t = c.currentTime, g = this._master.gain;
      const v = g.value;
      g.cancelScheduledValues(t);
      g.setValueAtTime(v, t);
      g.linearRampToValueAtTime(this._muted ? 0 : MASTER_LEVEL, t + 0.4);
    } catch (e) { this._fail(e); }
  }

  get analyser() {
    return this._an || null;
  }

  get running() {
    return !!(this._ctx && this._started && !this._muted);
  }

  // ---- graph --------------------------------------------------------------

  _build() {
    const c = this._ctx;
    const gain = (v = 1) => { const n = c.createGain(); n.gain.value = v; return n; };
    const biquad = (type, f, q = 0.7, g = 0) => {
      const n = c.createBiquadFilter();
      n.type = type; n.frequency.value = f; n.Q.value = q; n.gain.value = g;
      return n;
    };
    const ny = c.sampleRate * 0.45;

    // Master -> gentle limiter -> speakers; analyser on the output.
    this._master = gain(0);
    const lim = c.createDynamicsCompressor();
    lim.threshold.value = -10;
    lim.knee.value = 3;
    lim.ratio.value = 12;
    lim.attack.value = 0.002;
    lim.release.value = 0.22;
    this._limiter = lim;
    this._master.connect(lim);
    lim.connect(c.destination);
    this._an = c.createAnalyser();
    this._an.fftSize = 256;
    this._an.smoothingTimeConstant = 0.7;
    lim.connect(this._an);

    // 'Inside the violin' chain on everything musical (dry and reverb).
    this._inIn = gain(1);
    this._inLP1 = biquad('lowpass', Math.min(18000, ny), 0.6);
    this._inLP2 = biquad('lowpass', Math.min(18000, ny), 0.5);
    this._inBody = biquad('peaking', 260, 1.3, 0);
    this._inOut = gain(1);
    this._inIn.connect(this._inLP1);
    this._inLP1.connect(this._inLP2);
    this._inLP2.connect(this._inBody);
    this._inBody.connect(this._inOut);
    this._inOut.connect(this._master);

    // Music bus with a reverb send.
    this._music = gain(1);
    this._music.connect(this._inIn);
    this._revSend = gain(REVERB_SEND);
    this._revSwell = gain(1);
    this._revHP = biquad('highpass', 170, 0.7);
    this._conv = c.createConvolver();
    this._conv.normalize = false;
    this._revRet = gain(1);
    this._music.connect(this._revSend);
    this._revSend.connect(this._revSwell);
    this._revSwell.connect(this._revHP);
    this._revHP.connect(this._conv);
    this._conv.connect(this._revRet);
    this._revRet.connect(this._inIn);

    // Drone (tanpura).
    this._drone = gain(0);
    const dHP = biquad('highpass', 35, 0.7);
    const dLP = biquad('lowpass', 5200, 0.6);
    this._drone.connect(dHP); dHP.connect(dLP); dLP.connect(this._music);
    this._tPan = TANPURA.map((s) => { const p = this._panner(s.pan); p.connect(this._drone); return p; });

    // Melody (violin): expression filter and gain.
    this._melody = gain(0.27);
    this._exprLP = biquad('lowpass', 4000, 0.5);
    this._exprGain = gain(0.5);
    const mPan = this._panner(0.06);
    this._melody.connect(this._exprLP);
    this._exprLP.connect(this._exprGain);
    this._exprGain.connect(mPan);
    mPan.connect(this._music);

    // Pizzicato and plucked melody, through a small violin-body resonance.
    this._pizz = gain(0.42);
    const b1 = biquad('peaking', 275, 1.8, 5);
    const b2 = biquad('peaking', 460, 2, 3);
    const b3 = biquad('peaking', 2800, 1, 2);
    const b4 = biquad('lowpass', 7000, 0.6);
    const pPan = this._panner(-0.05);
    this._pizz.connect(b1); b1.connect(b2); b2.connect(b3); b3.connect(b4); b4.connect(pPan); pPan.connect(this._music);

    // Percussion: tabla (dayan right, bayan left) and the chikari pulse.
    this._perc = gain(0.28);
    this._perc.connect(this._music);
    this._dayan = this._panner(0.16); this._dayan.connect(this._perc);
    this._bayan = this._panner(-0.12); this._bayan.connect(this._perc);
    this._chik = gain(0.35);
    const cHP = biquad('highpass', 300, 0.7);
    const cPan = this._panner(0.22);
    this._chik.connect(cHP); cHP.connect(cPan); cPan.connect(this._perc);

    // Sound effects: straight to the master, not muffled.
    this._sfx = gain(0.5);
    this._sfx.connect(this._master);
  }

  _panner(v) {
    const c = this._ctx;
    if (c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = v;
      return p;
    }
    return c.createGain();
  }

  _buf(data) {
    const c = this._ctx;
    const b = c.createBuffer(1, data.length, c.sampleRate);
    b.getChannelData(0).set(data);
    return b;
  }

  _noiseBuf() {
    if (this._noise) return this._noise;
    const c = this._ctx, n = Math.floor(c.sampleRate * 2);
    const b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch), r = rng(7 + ch);
      for (let i = 0; i < n; i++) d[i] = r() * 2 - 1;
    }
    this._noise = b;
    return b;
  }

  // ---- loading ------------------------------------------------------------

  async _doLoad(base) {
    const samplesP = Promise.all(SAMPLE_SET.map(([name, midi], i) => this._loadSample(base, name, midi, i)));
    try { await this._synthAll(); } catch (e) { this._fail(e); }
    await samplesP;
  }

  async _loadSample(base, name, midi, i) {
    const entry = { name, midi, buf: null, gain: 1, start: 0, fix: TUNING_FIX[name] || 0 };
    this._samples[i] = entry;
    try {
      const ab = await fetchBuffer(base + 'v_' + name + '.mp3', 20000);
      const buf = await decode(this._ctx, ab);
      let peak = 0;
      const chans = [];
      for (let ch = 0; ch < buf.numberOfChannels; ch++) chans.push(buf.getChannelData(ch));
      for (const d of chans) for (let k = 0; k < d.length; k++) { const a = Math.abs(d[k]); if (a > peak) peak = a; }
      if (!(peak > 1e-5)) throw new Error('silent sample ' + name);
      let first = 0;
      const th = peak * 0.03;
      outer: for (let k = 0; k < chans[0].length; k++) {
        for (const d of chans) if (Math.abs(d[k]) > th) { first = k; break outer; }
      }
      entry.gain = 1 / peak;
      entry.start = Math.max(0, first / buf.sampleRate - 0.002);
      entry.buf = buf;
    } catch (e) {
      entry.buf = null; // this range falls back to the synthesised bowed tone
    }
  }

  async _synthAll() {
    const c = this._ctx, sr = c.sampleRate;
    const ir = hallIR(sr);
    const irb = c.createBuffer(2, ir[0].length, sr);
    irb.getChannelData(0).set(ir[0]);
    irb.getChannelData(1).set(ir[1]);
    this._conv.buffer = irb;
    await idle();
    const tan = [];
    for (const s of TANPURA) { tan.push(this._buf(tanpuraString(sr, s))); await idle(); }
    this._tanpura = tan;
    this._open = OPEN_HZ.map((hz, i) => this._buf(karplus(sr, {
      hz, dur: 1.6, t60: 1.25 - 0.13 * i, s: 0.36, pos: 0.2, soft: 0.55, seed: 300 + i, fade: 0.25,
    })));
    await idle();
    const tabla = {};
    for (const k of Object.keys(DAYAN)) {
      tabla[k] = [0, 1, 2].map((v) => this._buf(dayanStroke(sr, DAYAN[k], mtof(SA), 500 + v * 31 + k.length)));
      await idle();
    }
    for (const k of Object.keys(BAYAN)) {
      tabla[k] = (k === 'boom' ? [0] : [0, 1, 2]).map((v) => this._buf(bayanStroke(sr, BAYAN[k], 700 + v * 17 + k.length)));
      await idle();
    }
    tabla.ke = [0, 1, 2].map((v) => this._buf(keStroke(sr, 900 + v)));
    this._tabla = tabla;
    await idle();
    // Warm the pluck cache for the notes the score uses.
    this._synthReady = true;
    for (const off of YAMAN_UP) {
      if (off > 16) continue;
      this._ksGet('pizz', SA + off);
    }
    await idle();
    this._ksGet('chik', SA + 12);
    this._ksGet('chik', SA + 7);
    for (const m of [86, 88, 90, 93, 95]) this._ksGet('tick', m);
  }

  _ksGet(kind, midi) {
    const key = kind + midi;
    let b = this._ks.get(key);
    if (b) return b;
    if (!this._synthReady) return null;
    const p = KS_KIND[kind];
    b = this._buf(karplus(this._ctx.sampleRate, Object.assign({ hz: mtof(midi), seed: midi * 13 + kind.length }, p)));
    this._ks.set(key, b);
    return b;
  }

  _unlock() {
    try {
      const c = this._ctx;
      const s = c.createBufferSource();
      s.buffer = c.createBuffer(1, 1, c.sampleRate);
      s.connect(c.destination);
      s.start(0);
    } catch (e) { /* ignore */ }
  }

  _ready() {
    return !!(this._ctx && this._started);
  }

  _fail(e) {
    this._errors++;
    this._lastError = e;
  }

  // ---- callbacks ----------------------------------------------------------

  _ms(t) {
    return Math.max(0, Math.round((t - this._ctx.currentTime + this._lat) * 1000));
  }

  _note(str, vel, t) {
    const f = this.onNote;
    if (typeof f !== 'function') return;
    try { f(str, clamp(vel, 0, 1), this._ms(t)); } catch (e) { rethrowLater(e); }
  }

  _beat(strength, t) {
    const f = this.onBeat;
    if (typeof f !== 'function') return;
    try { f(clamp(strength, 0, 1), this._ms(t)); } catch (e) { rethrowLater(e); }
  }

  // ---- controls -----------------------------------------------------------

  _applyControls(now, force) {
    const c = this._ctx, ny = c.sampleRate * 0.45, tc = 0.12;
    const x = this._insideX;
    if (force || Math.abs(x - this._ctl.inside) > 0.002) {
      this._ctl.inside = x;
      const f = 18000 * Math.pow(650 / 18000, x);
      this._inLP1.frequency.setTargetAtTime(Math.min(f, ny), now, tc);
      this._inLP2.frequency.setTargetAtTime(Math.min(f * 1.5, ny), now, tc);
      this._inBody.gain.setTargetAtTime(7 * x, now, tc);
      this._inOut.gain.setTargetAtTime(1 + 0.3 * x, now, tc);
      this._revSend.gain.setTargetAtTime(REVERB_SEND * (1 + 0.5 * x), now, tc);
    }
    const e = this._exprX;
    if (force || Math.abs(e - this._ctl.expr) > 0.002) {
      this._ctl.expr = e;
      this._exprLP.frequency.setTargetAtTime(2500 * Math.pow(9000 / 2500, e), now, 0.25);
      this._exprGain.gain.setTargetAtTime(Math.pow(10, (-9 + 9 * e) / 20), now, 0.25);
    }
  }

  // ---- scheduler ----------------------------------------------------------

  _tick() {
    const c = this._ctx;
    if (!c || c.state !== 'running') return;
    try {
      const now = c.currentTime;
      this._lat = clamp((c.outputLatency || 0) + (c.baseLatency || 0), 0, 0.5);
      this._applyControls(now, false);
      const hidden = typeof document !== 'undefined' && document.hidden;
      const horizon = now + (hidden ? 1.2 : LOOKAHEAD);

      if (this._droneOn && this._tanpura) {
        if (this._tNext < now) this._tNext = now + 0.03;
        let guard = 0;
        while (this._tNext < horizon && guard++ < 16) {
          this._tanpuraPluck(this._tNext, this._tIdx, 1);
          this._tNext += TANPURA_GAPS[this._tIdx] * rand(0.98, 1.02);
          this._tIdx = (this._tIdx + 1) % 4;
        }
      }

      if (this._segT < now - 0.25) this._segT = now + 0.02;
      let guard = 0;
      while (this._segT < horizon && guard++ < 32) this._segment(this._segT);

      this._runQueue(now, horizon);
      this._horizon = horizon;
    } catch (e) {
      this._fail(e);
    }
  }

  _at(t, fn) {
    this._q.push({ t, fn });
    this._qDirty = true;
  }

  _runQueue(now, horizon) {
    if (this._qDirty) { this._q.sort((a, b) => a.t - b.t); this._qDirty = false; }
    let k = 0;
    while (k < this._q.length && this._q[k].t < horizon) k++;
    if (!k) return;
    const due = this._q.splice(0, k);
    for (const e of due) {
      try { e.fn(Math.max(e.t, now + 0.002)); } catch (err) { this._fail(err); }
    }
  }

  _segment(t) {
    if (this._pending) this._switch(t);
    let next;
    switch (this._stage) {
      case 'alap': next = this._alapSeg(t); break;
      case 'jor': next = this._jorBeat(t); break;
      case 'gat': next = this._gatBeat(t); break;
      case 'jhala': next = this._jhalaBeat(t); break;
      case 'inside': next = this._insideSeg(t); break;
      case 'tihai': next = this._tihaiSeg(t); break;
      case 'free': next = t + 1; break;
      default: next = Infinity;
    }
    this._segT = next > t ? next : t + 0.1;
  }

  _request(name, now) {
    if (name === this._stage) {
      this._pending = null;
      if (name !== 'tihai') { this._tihai = null; return null; }
      return this._tihai && this._tihai.sam > now ? { samInMs: this._ms(this._tihai.sam) } : null;
    }
    const pulsed = !!PULSED[this._stage];
    const soon = Math.max(this._horizon + 0.012, now + 0.05);
    let at = soon;
    if (pulsed && isFinite(this._segT)) {
      at = this._segT; // next beat
    } else if (this._stage === 'alap' && name !== 'tihai') {
      const st = this._st;
      if (st.busy > at) at = st.busy - now < 2.5 ? st.busy : Math.max(at, st.noteEnd || 0);
    } else if (this._stage === 'inside' && name !== 'tihai' && isFinite(this._segT)) {
      at = this._segT; // next heartbeat
    }
    this._pending = name;
    this._tihai = name === 'tihai' ? this._planTihai(at, pulsed ? this._st.bpm : 100) : null;
    if (at < this._segT) this._segT = at;
    return name === 'tihai' ? { samInMs: this._ms(this._tihai.sam) } : null;
  }

  _switch(t) {
    const to = this._pending, from = this._stage;
    this._pending = null;
    this._q = this._q.filter((e) => e.t < t - 1e-4);
    this._fadeVoices(t, 0.6);
    this._stage = to;
    this._setDrone(to, t);
    const bpm = PULSED[to] || 0;
    this._st = { from, b: 0, bpm, spb: bpm ? 60 / bpm : 0, stream: [], first: true };
    if (to === 'tihai' && !this._tihai) this._tihai = this._planTihai(t, 100);
  }

  _setDrone(stage, t) {
    const g = this._drone.gain;
    if (stage === 'silent') {
      this._droneOn = false;
      g.setTargetAtTime(0, t, 0.6);
      return;
    }
    if (!this._droneOn) {
      this._droneOn = true;
      this._tNext = t + 0.05;
      this._tIdx = 0;
    }
    g.setTargetAtTime(DRONE_BASE * DRONE_LEVEL[stage], t, stage === 'free' ? 2 : 0.8);
  }

  _fadeVoices(t, len) {
    for (const v of this._voices) {
      if (v.faded || v.end <= t + 0.25) continue;
      v.faded = true;
      try {
        v.out.gain.setValueAtTime(1, t);
        v.out.gain.linearRampToValueAtTime(0, t + len);
      } catch (e) { /* ignore */ }
    }
  }

  // ---- stages -------------------------------------------------------------

  _alapSeg(t) {
    const st = this._st;
    if (st.first) {
      st.first = false;
      st.busy = t;
      return t + (st.from === 'silent' ? 2.6 : 0.8);
    }
    if (!st.subs || !st.subs.length) {
      let idx;
      if (this._alapI < ALAP_ORDER.length) idx = ALAP_ORDER[this._alapI++];
      else {
        do idx = 1 + Math.floor(Math.random() * (ALAP.length - 1)); while (idx === this._alapLast);
      }
      this._alapLast = idx;
      st.subs = ALAP[idx].slice();
      st.scale = rand(0.9, 1.15);
      st.vel = rand(0.5, 0.62);
    }
    const sub = st.subs.shift();
    let tt = t;
    sub.forEach((n, k) => {
      const dur = n.dur * st.scale;
      const next = sub[k + 1];
      const legNext = !!(next && next.legato);
      const last = k === sub.length - 1;
      const vel = st.vel * (0.85 + 0.3 * Math.sin((Math.PI * (k + 0.5)) / sub.length));
      const opts = {
        attack: k === 0 ? 0.22 : n.legato ? 0.06 : 0.09,
        release: legNext ? 0.08 : last ? 0.6 : 0.22,
        legato: n.legato && k > 0,
        from: n.from,
        glide: n.from != null ? Math.min(0.45, dur * 0.45) : 0,
        sustain: last ? 0.62 : 0.85,
      };
      const play = legNext ? dur + 0.04 : last ? dur : dur - 0.02;
      const midi = SA + n.off;
      this._at(tt, (time) => {
        st.noteEnd = time + play;
        this._bow(time, midi, play, vel, opts, true);
      });
      tt += dur;
    });
    st.busy = tt;
    const gap = st.subs.length ? rand(0.3, 0.6) : rand(1.7, 3.3);
    return tt + gap;
  }

  _jorBeat(t) {
    const st = this._st, spb = st.spb, e8 = spb / 2, b = st.b++;
    const midi = b % 4 === 2 ? SA + 7 : SA + 12;
    const acc = b % 4 === 0 ? 0.62 : 0.45;
    this._at(t, (time) => {
      this._chikari(time, midi, acc * rand(0.92, 1.04));
      this._beat(acc, time);
    });
    const e0 = b * 2;
    if (st.nextE == null) st.nextE = 4;
    if (e0 >= st.nextE) {
      const ph = pick(JOR, st.last);
      st.last = ph;
      for (const n of ph.notes) st.stream.push({ e: e0 + n.i, off: n.off, len: n.len });
      st.nextE = e0 + ph.len + (ph.len % 2) + 2 * Math.floor(Math.random() * 3);
    }
    while (st.stream.length && st.stream[0].e < e0 + 2) {
      const n = st.stream.shift();
      const tt = t + (n.e - e0) * e8;
      const vel = (n.e % 2 === 0 ? 0.66 : 0.56) * rand(0.94, 1.04);
      const dur = n.len * e8 * 0.8;
      const m = SA + n.off;
      const opts = { attack: 0.025, release: n.len > 1 ? 0.2 : 0.12, offset: 0.06, sustain: 0.85 };
      this._at(tt, (time) => this._bow(time, m, dur, vel, opts, true));
    }
    return t + spb;
  }

  _gatPlan(st) {
    const c = st.cycle;
    const A = c === 0 ? GAT_A : Math.random() < 0.65 ? GAT_A : GAT_A2;
    const B = c === 0 ? GAT_B[0] : pick(GAT_B, st.lastB);
    st.lastB = B;
    return parseEighths(A + ' ' + B).notes;
  }

  _gatBeat(t) {
    const st = this._st, spb = st.spb, e8 = spb / 2, b = st.b++, bc = b % 16;
    if (bc === 0) {
      st.cycle = b ? (st.cycle || 0) + 1 : 0;
      st.plan = this._gatPlan(st);
      st.fill = st.cycle % 4 === 3;
    }
    if (st.fill && bc === 14) {
      ['ti', 'ra', 'ki', 'ta'].forEach((x, k) => {
        const v = 0.48 + 0.06 * k;
        this._at(t + (k * spb) / 4, (time) => this._stroke(time, x, v));
      });
    } else {
      const acc = THEKA_ACC[bc] * rand(0.95, 1.03);
      this._at(t, (time) => this._stroke(time, THEKA[bc], acc, bc === 0 ? 1 : acc));
    }
    for (const n of st.plan) {
      if (n.i < bc * 2 || n.i >= bc * 2 + 2) continue;
      const tt = t + (n.i - bc * 2) * e8;
      const m = SA + n.off;
      const vel = (n.i === 0 ? 0.7 : n.i % 2 === 0 ? 0.6 : 0.5) * rand(0.94, 1.04);
      const dur = n.len * e8 * 0.86;
      const opts = { attack: 0.025, release: n.len > 1 ? 0.16 : 0.1, offset: 0.06, sustain: 0.85 };
      if (n.len >= 2 && n.i > 0 && Math.random() < 0.25) { // kan: a grace from the note above
        opts.from = nextUp(n.off) - n.off;
        opts.glide = 0.07;
      }
      this._at(tt, (time) => this._bow(time, m, dur, vel, opts, true));
    }
    return t + spb;
  }

  _jhalaBeat(t) {
    const st = this._st, spb = st.spb, s16 = spb / 4, b = st.b++;
    if (!st.mode) st.mode = 'alt';
    if (b >= 8 && b % 4 === 0 && Math.random() < 0.3) st.mode = st.mode === 'alt' ? 'rara' : 'alt';
    while (st.stream.length < 2) {
      const ph = pick(JHALA, st.last);
      st.last = ph;
      st.stream.push(...ph);
    }
    const m1 = st.stream.shift();
    const m2 = st.mode === 'alt' ? st.stream.shift() : null;
    const pattern = [m1, null, m2, null];
    pattern.forEach((m, k) => {
      const tt = t + k * s16;
      if (m == null) {
        const v = (k === 1 ? 0.36 : 0.3) * rand(0.9, 1.06);
        this._at(tt, (time) => { this._chikari(time, SA + 12, v); this._beat(0.3, time); });
      } else {
        const v = (k === 0 ? 0.42 : 0.35) * rand(0.92, 1.05);
        this._at(tt, (time) => this._jhalaPluck(time, SA + m, v));
      }
    });
    const opts = { attack: 0.02, release: 0.12, offset: 0.07, sustain: 0.85 };
    this._at(t, (time) => this._bow(time, SA + m1, spb * 0.78, 0.4, opts, true));
    const i1 = (2 * b) % 16, i2 = i1 + 1;
    const a1 = i1 === 0 ? 0.75 : 0.44 * THEKA_ACC[i1] / 0.7, a2 = 0.4 * THEKA_ACC[i2] / 0.7;
    this._at(t, (time) => this._stroke(time, THEKA[i1], clamp(a1, 0, 0.75), i1 === 0 ? 1 : a1));
    this._at(t + spb / 2, (time) => this._stroke(time, THEKA[i2], clamp(a2, 0, 0.7), a2));
    return t + spb;
  }

  _insideSeg(t) {
    const st = this._st;
    if (st.first) {
      st.first = false;
      st.n = 0;
      st.nextLong = 2;
      return t + 0.6;
    }
    const n = st.n++;
    this._at(t, (time) => this._stroke(time, 'heart', 0.62, 0.6));
    this._at(t + 0.27, (time) => this._stroke(time, 'heart2', 0.4, 0.35));
    if (n === st.nextLong) {
      st.nextLong = n + 6 + Math.floor(Math.random() * 4);
      const pool = [62, 57, 61, 64, 66, 69];
      let m;
      do m = pool[Math.floor(Math.random() * pool.length)]; while (m === st.lastLong);
      st.lastLong = m;
      const dur = rand(4.2, 5.4);
      this._at(t + 0.15, (time) => this._long(time, m, dur, 0.26));
    }
    return t + (60 / 54) * rand(0.99, 1.01);
  }

  _planTihai(start, bpm) {
    const e = 30 / bpm; // one eighth
    const ev = [];
    const phrase = [SW.G, SW.M, SW.D, SW.N, SW["S'"]];
    const bols = ['dha', 'na', 'ta', 'na', 'dha'];
    for (let r = 0; r < 3; r++) {
      for (let k = 0; k < 5; k++) {
        if (r === 2 && k === 4) break; // the last note is the sam hit
        const tt = start + (r * 6 + k) * e;
        const vel = [0.48, 0.55, 0.62][r] + (k === 4 ? 0.04 : 0);
        const dur = k === 4 ? e * 1.85 : e * 0.82;
        const m = SA + phrase[k];
        const opts = { attack: 0.02, release: k === 4 ? 0.25 : 0.1, offset: 0.06, sustain: 0.9 };
        const bol = bols[k];
        ev.push({ t: tt, fn: (time) => this._bow(time, m, dur, vel, opts, true) });
        ev.push({ t: tt, fn: (time) => this._stroke(time, bol, vel * 0.75, vel) });
      }
    }
    const sam = start + 16 * e;
    ev.push({ t: sam, fn: (time) => this._samHit(time) });
    return { start, sam, ev, bpm };
  }

  _tihaiSeg(t) {
    const st = this._st, plan = this._tihai;
    if (st.first && plan) {
      st.first = false;
      for (const x of plan.ev) this._at(x.t, x.fn);
      return plan.sam + 0.9;
    }
    // The tihai has landed: settle into 'free' on our own.
    this._stage = 'free';
    this._st = { from: 'tihai', b: 0, bpm: 0, spb: 0, stream: [], first: true };
    this._setDrone('free', t);
    return t + 1;
  }

  _samHit(t) {
    this._long(t, SA + 12, 3.4, 0.58, 0.02, 1.8, 0.8);
    this._long(t, SA, 3.4, 0.36, 0.03, 1.8, 0.8);
    this._tanpuraPluck(t, 3, 1.05);
    this._tanpuraPluck(t + 0.012, 0, 0.9);
    this._tNext = Math.max(this._tNext, t + 2.8);
    this._tIdx = 1;
    this._drum('boom', t, 0.78);
    this._drum('na', t, 0.6);
    this._beat(1, t);
    const g = this._revSwell.gain;
    g.setTargetAtTime(1.7, t, 0.03);
    g.setTargetAtTime(1, t + 0.5, 1.2);
  }

  // ---- tuning -------------------------------------------------------------

  async _runTune(onStep) {
    this._tuningActive = true;
    try {
      if (this._loadP) await Promise.race([this._loadP, wait(6000)]);
      const c = this._ctx;
      const t0 = c.currentTime + 0.15;
      const steps = [
        { at: 0, dur: 1.45, name: 'A', freq: 440, settle: 1.2, notes: [[69, -25]] },
        { at: 1.45, dur: 1.25, name: 'D', freq: 293.66, settle: 0.95, notes: [[62, -18], [69, 0]] },
        { at: 2.75, dur: 1.25, name: 'G', freq: 196, settle: 0.95, notes: [[55, 16], [62, 0]] },
        { at: 4.05, dur: 1.35, name: 'E', freq: 659.25, settle: 0.95, notes: [[69, 0], [76, -20]] },
      ];
      steps.forEach((s, i) => {
        const ts = t0 + s.at;
        for (const [midi, cents] of s.notes) {
          this._bow(ts, midi, s.dur, 0.52, {
            attack: 0.16, release: 0.45, sustain: 0.9, tuneFrom: cents, tuneTime: s.settle,
          }, true);
        }
        setTimeout(() => {
          if (typeof onStep !== 'function') return;
          try { onStep(i, s.name, s.freq); } catch (e) { rethrowLater(e); }
        }, this._ms(ts));
      });
      await wait(Math.max(0, (t0 + 5.3 - c.currentTime) * 1000));
    } finally {
      this._tuningActive = false;
      const next = this._afterTune || (this._requested === 'silent' ? 'alap' : null);
      this._afterTune = null;
      if (next) this.setStage(next);
    }
  }

  // ---- voices -------------------------------------------------------------

  _sampleFor(midi) {
    if (!this._loaded) return null;
    let best = null, bd = 1e9;
    for (const s of this._samples) {
      if (!s) continue;
      const d = Math.abs(midi - s.midi);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  // Pitch automation on a detune param: meend (o.from semitones, o.glide s) or
  // the tuning settle (o.tuneFrom cents, o.tuneTime s).
  _pitch(param, t, base, o) {
    if (!param) return;
    const N = 32;
    let curve = null, len = 0;
    if (o.from) {
      len = Math.max(0.03, o.glide || 0.3);
      curve = new Float32Array(N);
      for (let k = 0; k < N; k++) {
        const u = k / (N - 1);
        curve[k] = base + o.from * 100 * (1 - u * u * (3 - 2 * u));
      }
    } else if (o.tuneFrom) {
      len = o.tuneTime || 1;
      curve = new Float32Array(N);
      // Slide up (or down) past the note by a hair, then settle onto it.
      const ov = -0.12 * o.tuneFrom, sm = (u) => u * u * (3 - 2 * u);
      for (let k = 0; k < N; k++) {
        const u = k / (N - 1);
        curve[k] = base + (u < 0.72
          ? o.tuneFrom + (ov - o.tuneFrom) * sm(u / 0.72)
          : ov * (1 - sm((u - 0.72) / 0.28)));
      }
    }
    try {
      if (curve) param.setValueCurveAtTime(curve, t, len);
      else param.setValueAtTime(base, t);
    } catch (e) {
      try { param.setValueAtTime(base, t); } catch (e2) { /* ignore */ }
    }
  }

  // One bowed violin note. Returns nothing; registers the voice so a stage
  // change can fade it.
  _bow(t, midi, dur, vel, o, emit) {
    if (!this._loaded) return;
    const s = this._sampleFor(midi);
    if (!s) return;
    const c = this._ctx;
    const atk0 = o.attack != null ? o.attack : 0.08;
    const rel = o.release != null ? o.release : 0.25;
    const out = c.createGain();
    out.connect(o.dest || this._melody);
    const env = c.createGain();
    env.gain.value = 0;
    env.connect(out);
    let src, endT, peak;
    if (s.buf) {
      src = c.createBufferSource();
      src.buffer = s.buf;
      const rate = Math.pow(2, (midi - s.midi) / 12);
      src.playbackRate.value = rate;
      const off = o.legato ? 0.3 : s.start + (o.offset || 0);
      const avail = (s.buf.duration - off - 0.04) / rate;
      dur = Math.max(0.05, Math.min(dur, avail - rel * 1.25));
      peak = vel * s.gain;
      src.connect(env);
      this._pitch(src.detune, t, s.fix, o);
      src.start(t, off);
    } else {
      // Fallback: sawtooth through a violin-body formant filter, delayed vibrato.
      dur = Math.min(dur, 2.8);
      src = c.createOscillator();
      src.type = 'sawtooth';
      src.frequency.value = mtof(midi);
      const f1 = c.createBiquadFilter(); f1.type = 'peaking'; f1.frequency.value = 290; f1.Q.value = 1.1; f1.gain.value = 6;
      const f2 = c.createBiquadFilter(); f2.type = 'peaking'; f2.frequency.value = 2900; f2.Q.value = 1.4; f2.gain.value = 4;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 0.7;
      src.connect(f1); f1.connect(f2); f2.connect(lp); lp.connect(env);
      const lfo = c.createOscillator();
      lfo.frequency.value = 5.3;
      const vd = c.createGain();
      vd.gain.setValueAtTime(0, t);
      vd.gain.setValueAtTime(0, t + 0.35);
      vd.gain.linearRampToValueAtTime(14, t + 0.8);
      lfo.connect(vd); vd.connect(src.detune);
      lfo.start(t);
      lfo.stop(t + dur + rel * 1.25 + 0.05);
      peak = vel * 0.55;
      this._pitch(src.detune, t, 0, o);
      src.start(t);
    }
    const atk = Math.min(atk0, dur * 0.8);
    const g = env.gain;
    g.setValueAtTime(0, t);
    g.linearRampToValueAtTime(peak, t + atk);
    const sus = o.sustain != null ? o.sustain : 0.82;
    if (sus < 1 && dur > atk + 0.15) g.setTargetAtTime(peak * sus, t + atk, Math.max(0.1, (dur - atk) * 0.7));
    g.setTargetAtTime(0, t + dur, Math.max(0.01, rel / 5));
    endT = t + dur + rel * 1.25;
    src.stop(endT);
    const v = { end: endT, out, faded: false };
    this._voices.add(v);
    src.onended = () => {
      this._voices.delete(v);
      try { out.disconnect(); } catch (e) { /* ignore */ }
    };
    if (emit) this._note(stringOf(midi), vel, t);
  }

  // A long note made of overlapping sample segments (one sample is only ~3 s).
  _long(t, midi, dur, vel, attack = 0.9, release = 1.4, sustain = 1) {
    const step = 1.45, xf = 0.6, end = t + dur;
    let tt = t, k = 0;
    while (tt < end - 0.3 && k < 6) {
      const last = tt + step >= end - 0.3;
      const d = last ? end - tt : step + xf * 0.4;
      this._bow(tt, midi, d, vel * (k === 0 ? 1 : Math.pow(sustain, k)), {
        attack: k === 0 ? attack : xf, release: last ? release : xf, legato: k > 0, sustain: 1,
      }, k === 0);
      tt += step;
      k++;
    }
  }

  _tanpuraPluck(t, i, velMul) {
    if (!this._tanpura) return;
    const c = this._ctx, S = TANPURA[i];
    const src = c.createBufferSource();
    src.buffer = this._tanpura[i];
    const bloom = c.createBiquadFilter();
    bloom.type = 'peaking';
    bloom.Q.value = 1.2;
    bloom.gain.value = 5;
    bloom.frequency.setValueAtTime(1000, t);
    bloom.frequency.exponentialRampToValueAtTime(3500, t + 3.4);
    const env = c.createGain();
    const v = S.vel * velMul * rand(0.92, 1.03);
    env.gain.setValueAtTime(v, t);
    src.connect(bloom); bloom.connect(env); env.connect(this._tPan[i]);
    src.start(t);
    const prev = this._tVoice[i];
    if (prev && !prev.damped) {
      prev.damped = true;
      try {
        prev.env.gain.setValueAtTime(prev.v, t);
        prev.env.gain.linearRampToValueAtTime(0, t + 0.25);
        prev.src.stop(t + 0.3);
      } catch (e) { /* ignore */ }
    }
    const voice = { src, env, v, damped: false };
    this._tVoice[i] = voice;
    src.onended = () => {
      try { env.disconnect(); } catch (e) { /* ignore */ }
      if (this._tVoice[i] === voice) this._tVoice[i] = null;
    };
  }

  _chikari(t, midi, vel) {
    const buf = this._ksGet('chik', midi);
    if (!buf) return;
    const c = this._ctx;
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    g.gain.value = vel;
    src.connect(g); g.connect(this._chik);
    src.onended = () => { try { g.disconnect(); } catch (e) { /* ignore */ } };
    src.start(t);
  }

  _jhalaPluck(t, midi, vel) {
    const buf = this._ksGet('pizz', midi);
    if (!buf) return;
    const c = this._ctx;
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    g.gain.setValueAtTime(vel, t);
    g.gain.setTargetAtTime(0, t + 0.3, 0.07);
    src.connect(g); g.connect(this._pizz);
    src.onended = () => { try { g.disconnect(); } catch (e) { /* ignore */ } };
    src.start(t);
    src.stop(t + 0.8);
    this._note(stringOf(midi), vel, t);
  }

  _drum(kind, t, vel, rate = 1) {
    const set = this._tabla && this._tabla[kind];
    if (!set) return;
    const c = this._ctx;
    const src = c.createBufferSource();
    src.buffer = set[Math.floor(Math.random() * set.length)];
    src.playbackRate.value = rate * (1 + (Math.random() - 0.5) * 0.008);
    const g = c.createGain();
    g.gain.value = Math.pow(clamp(vel, 0, 1.2), 1.4) * DRUM_LEVEL[kind];
    src.connect(g);
    g.connect(BAYAN[kind] || kind === 'ke' ? this._bayan : this._dayan);
    src.onended = () => { try { g.disconnect(); } catch (e) { /* ignore */ } };
    src.start(t);
  }

  _stroke(t, bol, vel, strength) {
    switch (bol) {
      case 'dha': this._drum('ge', t, vel * 0.9); this._drum('na', t, vel); break;
      case 'dhin': this._drum('ge', t, vel * 0.85); this._drum('tin', t, vel); break;
      case 'ra': this._drum('ti', t, vel * 0.8, 1.04); break;
      case 'ki': this._drum('ke', t, vel); break;
      case 'heart2': this._drum('heart', t, vel, 1.07); break;
      default: this._drum(bol, t, vel);
    }
    this._beat(strength != null ? strength : vel, t);
  }
}
