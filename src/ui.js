// Everything on the glass: gate, chapter panels, index, raga label, notes, small visuals.
import { animate, createTimeline, stagger, splitText, utils } from 'animejs';

export const NAMES = {
  hero: 'The scroll', pegs: 'The pegs', nut: 'The nut', fingerboard: 'The fingerboard',
  g: 'G string', d: 'D string', a: 'A string', e: 'E string', bridge: 'The bridge', fholes: 'The f-holes',
  soundpost: 'The sound post', bassbar: 'The bass bar', tailpiece: 'The tailpiece', finale: 'Your turn',
};
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV'];

const RAGA = {
  silent: ['आलाप', 'ālāp'], alap: ['आलाप', 'ālāp'], jor: ['जोड़', 'jor'], gat: ['गत', 'gat'],
  inside: ['विराम', 'virām'], jhala: ['झाला', 'jhālā'], tihai: ['तिहाई', 'tihāī'], free: ['तिहाई', 'tihāī'],
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- track ----------
export function buildTrack(count) {
  const track = $('#track');
  for (let i = 0; i < count; i++) {
    const s = document.createElement('section');
    s.className = 'st';
    track.appendChild(s);
  }
}

// ---------- index ----------
export function buildIndex(stations, onGo) {
  const list = $('#indexList');
  let n = 0;
  stations.forEach((st, i) => {
    if (!NAMES[st.key]) return;
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.key = st.key;
    b.innerHTML = `<span class="tick"></span><span class="nm">${ROMAN[n]} · ${NAMES[st.key]}</span>`;
    b.setAttribute('aria-label', `${ROMAN[n]}. ${NAMES[st.key]}`);
    b.addEventListener('click', () => onGo(i));
    li.appendChild(b);
    list.appendChild(li);
    n++;
  });
  $$('[data-go]').forEach((el) => el.addEventListener('click', () => onGo(stations.findIndex((s) => s.key === el.dataset.go))));
}

export function setIndex(key, order) {
  const pos = order.indexOf(key);
  $$('#indexList button').forEach((b) => {
    const p = order.indexOf(b.dataset.key);
    b.classList.toggle('on', b.dataset.key === key);
    b.classList.toggle('pass', p < pos);
  });
}

// ---------- raga ----------
let ragaNow = null;
export function setRaga(stage) {
  const r = RAGA[stage] || RAGA.alap;
  if (ragaNow === r[0]) return;
  ragaNow = r[0];
  const dev = $('#ragaDev'), tr = $('#ragaTr');
  animate([dev, tr], {
    opacity: [1, 0], y: [0, -6], duration: 280, ease: 'inQuad',
    onComplete: () => {
      dev.textContent = r[0];
      tr.textContent = r[1];
      animate([dev, tr], { opacity: [0, 1], y: [8, 0], duration: 700, ease: 'outExpo' });
    },
  });
}

// ---------- panels ----------
const panels = new Map();
export function initPanels() {
  $$('.panel').forEach((p) => {
    const inner = document.createElement('div');
    inner.className = 'panel-in';
    while (p.firstChild) inner.appendChild(p.firstChild);
    p.appendChild(inner);
    const entry = { el: p, inner, key: p.dataset.key, side: p.dataset.side, splits: [] };
    const title = $('.title', p);
    if (title) entry.splits.push(['title', splitText(title, { lines: { wrap: 'clip' } })]);
    const name = $('.name', p);
    if (name) entry.splits.push(['name', splitText(name, { chars: { wrap: 'clip' } })]);
    $$('.lede', p).forEach((l) => entry.splits.push(['lede', splitText(l, { lines: true })]));
    panels.set(entry.key, entry);
  });
}

let current = null;
let currentTl = null;
export function showPanel(key, { holdLinks = false } = {}) {
  if (current === key) return;
  hidePanel();
  const e = panels.get(key);
  if (!e) return;
  current = key;
  document.body.dataset.side = e.side === 'center' ? '' : e.side;
  e.el.classList.add('is-on');
  if (reduced) {
    animate(e.inner, { opacity: [0, 1], duration: 400 });
    startViz(key);
    return;
  }
  const tl = createTimeline({ defaults: { ease: 'outExpo' } });
  tl.set(e.inner, { opacity: 1, y: 0 });
  const eyebrow = $('.eyebrow', e.el);
  if (eyebrow) tl.add(eyebrow, { opacity: [0, 1], x: [-16, 0], duration: 1000 }, 0);
  for (const [kind, sp] of e.splits) {
    if (kind === 'title') tl.add(sp.lines, { y: ['108%', '0%'], duration: 1300, delay: stagger(95) }, 90);
    if (kind === 'name') tl.add(sp.chars, { y: ['112%', '0%'], duration: 1500, delay: stagger(38) }, 60);
  }
  const ledes = e.splits.filter(([k]) => k === 'lede').flatMap(([, sp]) => sp.lines);
  if (ledes.length) tl.add(ledes, { opacity: [0, 1], y: [16, 0], duration: 1000, delay: stagger(60) }, 300);
  const rows = $$(holdLinks ? '.facts li, .aside, .viz, .credits' : '.facts li, .links li, .aside, .viz, .credits', e.el);
  if (holdLinks) utils.set($$('.links li', e.el), { opacity: 0 });
  if (rows.length) tl.add(rows, { opacity: [0, 1], y: [12, 0], duration: 900, delay: stagger(70) }, 480);
  currentTl = tl;
  startViz(key);
}

export function hidePanel() {
  if (!current) return;
  const e = panels.get(current);
  current = null;
  if (currentTl) currentTl.pause();
  stopViz();
  document.body.dataset.side = '';
  animate(e.inner, {
    opacity: 0, y: -12, duration: 360, ease: 'inQuad',
    onComplete: () => { if (current !== e.key) e.el.classList.remove('is-on'); },
  });
}

export function revealFinaleLinks(delay) {
  const e = panels.get('finale');
  if (!e) return;
  const rows = $$('.links li', e.el);
  animate(rows, { opacity: [0, 1], x: [-18, 0], duration: 1100, delay: stagger(90, { start: delay }), ease: 'outExpo' });
}

// ---------- small visuals ----------
let vizStop = null;
let analyserRef = null;
export function setAnalyser(a) { analyserRef = a; }

function startViz(key) {
  stopViz();
  if (key === 'g') vizStop = pointsViz();
  if (key === 'd') vizStop = ledgerViz();
  if (key === 'e') vizStop = waveViz();
}
function stopViz() { if (vizStop) { vizStop(); vizStop = null; } }

// tracked points on an object being lifted and turned, the way P3-PO sees a demo
function pointsViz() {
  const svg = $('#vizPoints');
  if (!svg) return null;
  const NS = 'http://www.w3.org/2000/svg';
  svg.innerHTML = '';
  const shape = [[-22, -14], [22, -14], [26, 10], [-26, 10], [0, -26], [0, 14], [34, -4]];
  const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [1, 4], [3, 5], [2, 5], [1, 6], [2, 6]];
  const lines = edges.map(() => { const l = document.createElementNS(NS, 'line'); l.setAttribute('stroke', 'rgba(241,231,214,0.22)'); l.setAttribute('stroke-width', '1'); svg.appendChild(l); return l; });
  const trails = shape.map(() => { const p = document.createElementNS(NS, 'polyline'); p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'rgba(226,180,103,0.35)'); p.setAttribute('stroke-width', '1'); svg.appendChild(p); return p; });
  const dots = shape.map(() => { const c = document.createElementNS(NS, 'circle'); c.setAttribute('r', '2.6'); c.setAttribute('fill', '#f3d9a4'); svg.appendChild(c); return c; });
  const hist = shape.map(() => []);
  const st = { t: 0 };
  const anim = animate(st, {
    t: [0, 1], duration: 3800, loop: true, alternate: true, ease: 'inOutSine',
    onUpdate: () => {
      const t = st.t;
      const cx = 50 + t * 220, cy = 62 - Math.sin(t * Math.PI) * 34;
      const a = -0.35 + t * 0.7;
      const cos = Math.cos(a), sin = Math.sin(a);
      shape.forEach(([x, y], i) => {
        const px = cx + x * cos - y * sin, py = cy + x * sin + y * cos;
        dots[i].setAttribute('cx', px.toFixed(1));
        dots[i].setAttribute('cy', py.toFixed(1));
        hist[i].push(`${px.toFixed(1)},${py.toFixed(1)}`);
        if (hist[i].length > 26) hist[i].shift();
        trails[i].setAttribute('points', hist[i].join(' '));
      });
      edges.forEach(([i, j], k) => {
        lines[k].setAttribute('x1', dots[i].getAttribute('cx')); lines[k].setAttribute('y1', dots[i].getAttribute('cy'));
        lines[k].setAttribute('x2', dots[j].getAttribute('cx')); lines[k].setAttribute('y2', dots[j].getAttribute('cy'));
      });
    },
  });
  return () => anim.pause();
}

// two ledgers that never disagree
function ledgerViz() {
  const a = $('#ledA'), b = $('#ledB');
  if (!a || !b) return null;
  const v = { x: 50 };
  const step = () => {
    const delta = utils.random(-0.42, 0.61, 4);
    animate(v, {
      x: v.x + delta, duration: 700, ease: 'outQuart',
      onUpdate: () => { const s = v.x.toFixed(4); a.textContent = s; b.textContent = s; },
    });
  };
  const id = setInterval(step, 1300);
  step();
  return () => clearInterval(id);
}

// what the E string is doing right now
function waveViz() {
  const c = $('#vizWave');
  if (!c) return null;
  const ctx = c.getContext('2d');
  let raf = 0;
  const buf = new Uint8Array(256);
  const draw = (t) => {
    const W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = '#e2b467';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const live = analyserRef && analyserRef.context && analyserRef.context.state === 'running';
    if (live) analyserRef.getByteTimeDomainData(buf);
    for (let i = 0; i <= 128; i++) {
      const x = (i / 128) * W;
      let y;
      if (live) y = H / 2 + ((buf[i * 2 % 256] - 128) / 128) * H * 1.6;
      else y = H / 2 + Math.sin((i / 128) * Math.PI) * Math.sin(i * 0.5 + t * 0.012) * H * 0.22;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);
  return () => cancelAnimationFrame(raf);
}

// ---------- sound meter ----------
const meterBuf = new Uint8Array(128);
export function updateMeter(analyser, on) {
  const bars = $$('.meter i');
  if (!on || !analyser) { bars.forEach((b) => (b.style.height = '2px')); return; }
  analyser.getByteFrequencyData(meterBuf);
  const bands = [[1, 4], [4, 10], [10, 24], [24, 60]];
  bands.forEach(([a, z], i) => {
    let s = 0;
    for (let k = a; k < z; k++) s += meterBuf[k];
    const v = s / (z - a) / 255;
    bars[i].style.height = `${2 + Math.min(9, v * 16)}px`;
  });
}

export function setSoundLabel(on) {
  const b = $('#soundBtn');
  b.setAttribute('aria-pressed', on ? 'true' : 'false');
  $('.sound-lbl', b).textContent = on ? 'Sound on' : 'Sound off';
}

// ---------- gate ----------
const gate = { paths: [], labels: [], amps: [0, 0, 0, 0], raf: 0, t0: 0, lit: [false, false, false, false] };
const GATE_STRINGS = [['G', 196.0], ['D', 293.66], ['A', 440.0], ['E', 659.25]];

export function initGate() {
  const svg = $('#gateStrings');
  const NS = 'http://www.w3.org/2000/svg';
  GATE_STRINGS.forEach(([n, f]) => {
    const p = document.createElementNS(NS, 'path');
    svg.appendChild(p);
    gate.paths.push(p);
    const t = document.createElementNS(NS, 'text');
    t.textContent = `${n} · ${f.toFixed(2)}`;
    svg.appendChild(t);
    gate.labels.push(t);
  });
  splitText($('.gate-name'), { chars: { wrap: 'clip' } });
  const tick = (now) => {
    drawGate(now);
    gate.raf = requestAnimationFrame(tick);
  };
  gate.raf = requestAnimationFrame(tick);
  if (!reduced) {
    const tl = createTimeline({ defaults: { ease: 'outExpo' } });
    tl.add('.gate-name [data-char]', { y: ['112%', '0%'], duration: 1600, delay: stagger(45) }, 200)
      .add(['.gate-hz', '.gate-sub', '.gate-actions', '.gate-status'], { opacity: [0, 1], y: [14, 0], duration: 1200, delay: stagger(110) }, 700)
      .add(gate.paths, { opacity: [0, 1], duration: 1600, delay: stagger(140) }, 400);
  }
}

function drawGate(now) {
  const W = window.innerWidth, H = window.innerHeight;
  const svg = $('#gateStrings');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const mobile = W < 761;
  const base = mobile ? H * 0.8 : H * 0.79;
  const gap = mobile ? 14 : 18;
  GATE_STRINGS.forEach((_, i) => {
    const y = base + i * gap;
    const amp = gate.amps[i];
    const pts = [];
    const n = 80;
    const w = W - (mobile ? 24 : 150);
    for (let k = 0; k <= n; k++) {
      const x = (k / n) * w;
      const env = Math.sin((k / n) * Math.PI);
      const off = amp * env * Math.sin(now * 0.09 + i) * (0.7 + 0.3 * Math.sin(k * 0.9 + now * 0.05));
      pts.push(`${k ? 'L' : 'M'}${x.toFixed(1)},${(y + off).toFixed(1)}`);
    }
    gate.paths[i].setAttribute('d', pts.join(''));
    gate.paths[i].classList.toggle('lit', gate.lit[i]);
    const lab = gate.labels[i];
    lab.setAttribute('x', String(w + 18));
    lab.setAttribute('y', String(y + 4));
    lab.style.display = mobile ? 'none' : '';
    lab.classList.toggle('lit', gate.lit[i]);
    gate.amps[i] *= 0.985;
  });
}

export function setGateProgress(p, label) {
  $('#gateProgress').style.transform = `scaleX(${p})`;
  if (label) $('#gateStatusText').textContent = label;
}

export function gateReady() {
  $('#beginSound').disabled = false;
  $('#beginSilent').disabled = false;
  animate('#gateStatus', { opacity: 0, duration: 600, ease: 'outQuad' });
}

// one string being brought into tune
export function gateStep(i, name, freq) {
  const order = { G: 0, D: 1, A: 2, E: 3 };
  const idx = order[name] ?? i;
  gate.amps[idx] = 16;
  const hz = $('#gateHz');
  const v = { f: freq * Math.pow(2, -28 / 1200) };
  animate(v, {
    f: freq, duration: 1100, ease: 'outCubic',
    onUpdate: () => { hz.textContent = `${name} · ${v.f.toFixed(2)} Hz`; },
    onComplete: () => { gate.lit[idx] = true; },
  });
}

export function gateSilentTune() {
  const order = ['A', 'D', 'G', 'E'];
  const f = { A: 440, D: 293.66, G: 196, E: 659.25 };
  return new Promise((res) => {
    order.forEach((n, k) => setTimeout(() => gateStep(k, n, f[n]), k * 420));
    setTimeout(res, order.length * 420 + 900);
  });
}

export function gateOut() {
  return new Promise((res) => {
    const tl = createTimeline({ defaults: { ease: 'inOutQuart' }, onComplete: () => { cancelAnimationFrame(gate.raf); $('#gate').hidden = true; res(); } });
    tl.add('.gate-inner', { opacity: [1, 0], y: [0, -24], duration: 900 }, 0)
      .add(gate.paths, { opacity: [1, 0], duration: 900, delay: stagger(70) }, 200)
      .add('#gate', { opacity: [1, 0], duration: 1200 }, 600);
  });
}

// ---------- program notes ----------
export function initNotes({ onOpen, onClose }) {
  const notes = $('#notes');
  const open = () => {
    if (!notes.hidden) return;
    notes.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    animate(notes, { opacity: [0, 1], duration: 500, ease: 'outQuad' });
    animate($$('.notes-head > *, .notes-grid section', notes), { opacity: [0, 1], y: [18, 0], duration: 900, delay: stagger(70, { start: 120 }), ease: 'outExpo' });
    $('#notesClose').focus();
    onOpen?.();
  };
  const close = () => {
    if (notes.hidden) return;
    animate(notes, {
      opacity: 0, duration: 350, ease: 'inQuad',
      onComplete: () => { notes.hidden = true; document.documentElement.style.overflow = ''; },
    });
    onClose?.();
  };
  $('#notesBtn').addEventListener('click', open);
  $$('[data-open-notes]').forEach((b) => b.addEventListener('click', open));
  $('#notesClose').addEventListener('click', close);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  return { open, close };
}
