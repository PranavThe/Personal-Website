import * as THREE from 'three';
import { animate, onScroll } from 'animejs';
import { createStage } from './stage.js';
import { buildViolin, topZ, backZ, BRIDGE_Y } from './violin.js';
import { STATIONS, STAGE_OF, sample } from './stations.js';
import { halfWidth, BODY_LEN } from './geometry2d.js';
import * as UI from './ui.js';

const mobile = matchMedia('(max-width: 760px)').matches;
const coarse = matchMedia('(hover: none)').matches;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const lowPower = mobile && (navigator.hardwareConcurrency || 4) <= 4;
const INSTANT = location.search.includes('instant');
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const ORDER = STATIONS.map((s) => s.key);
const N = STATIONS.length;

// ---------- audio ----------
let score = null;
let soundOn = false;
const audioLoad = import('./audio.js')
  .then((m) => {
    score = new m.Score();
    score.onNote = (i, vel, delay) => setTimeout(() => excite(i, 0.35 + vel * 0.55), Math.max(0, delay));
    score.onBeat = (strength, delay) => setTimeout(() => ripple(strength), Math.max(0, delay));
    UI.setAnalyser(score.analyser);
    return score.load('./audio/');
  })
  .catch((e) => { console.warn('sound unavailable', e); });

// ---------- page skeleton ----------
UI.buildTrack(N);
UI.buildIndex(STATIONS, (i) => goTo(i));
UI.initGate();
UI.initPanels();
UI.initNotes({});

function goTo(i) {
  const track = document.getElementById('track');
  const sec = track.children[0];
  const h = sec.getBoundingClientRect().height;
  window.scrollTo({ top: i * h, behavior: reduced ? 'auto' : 'smooth' });
}

// ---------- 3D ----------
const canvas = document.getElementById('stage');
let stage, violin;
const cam = { s: 0 };
const intro = { k: 1 };
const S = { pos: new THREE.Vector3(), tgt: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), fov: 30, fx: 0, fy: 0 };
const dustCentre = new THREE.Vector3(0, 5.4, 0);

async function build() {
  UI.setGateProgress(0.1);
  await nextFrame();
  stage = createStage(canvas, { mobile, lowPower });
  UI.setGateProgress(0.3);
  await nextFrame();
  violin = buildViolin({ lightDir: stage.lightDir });
  stage.scene.add(violin.group);
  UI.setGateProgress(0.7);
  await nextFrame();
  placeCamera(0);
  stage.renderer.compile(stage.scene, stage.camera);
  stage.composer.render();
  UI.setGateProgress(0.9);
  await Promise.race([audioLoad, new Promise((r) => setTimeout(r, 6000))]);
  UI.setGateProgress(1);
  UI.gateReady();
}

// ---------- strings: vibration and play ----------
function excite(i, vel = 1) {
  const st = violin?.strings[i];
  if (!st) return;
  st.amp = Math.max(st.amp, 0.0055 * Math.min(1.4, vel));
}
let ripSlot = 0;
let simTime = 0;
function ripple(strength) {
  if (!violin) return;
  const key = ORDER[Math.round(cam.s)];
  let pts;
  if (key === 'bridge') pts = [[-0.165, BRIDGE_Y], [0.165, BRIDGE_Y]];
  else if (key === 'fholes' || key === 'e') pts = [violin.fholes[0].notch, violin.fholes[1].notch];
  else return;
  for (const [x, y] of pts) {
    violin.ripples.uRip.value[ripSlot].set(x, y, simTime, 0.18 + strength * 0.5);
    ripSlot = (ripSlot + 1) % 6;
  }
}

function pluck(i, vel = 1) {
  excite(i, vel);
  if (soundOn && score) score.pluck(i, Math.min(1, vel));
}

const screenStrings = [0, 1, 2, 3].map(() => ({ ax: 0, ay: 0, bx: 0, by: 0, last: 0 }));
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
function projectStrings() {
  const W = innerWidth, H = innerHeight;
  violin.strings.forEach((st, i) => {
    tmpA.copy(st.a).lerp(st.b, 0.04).applyMatrix4(violin.group.matrixWorld).project(stage.camera);
    tmpB.copy(st.b).lerp(st.a, 0.04).applyMatrix4(violin.group.matrixWorld).project(stage.camera);
    const s = screenStrings[i];
    s.ok = tmpA.z < 1 && tmpB.z < 1 && tmpA.z > -1 && tmpB.z > -1;
    s.ax = (tmpA.x * 0.5 + 0.5) * W; s.ay = (-tmpA.y * 0.5 + 0.5) * H;
    s.bx = (tmpB.x * 0.5 + 0.5) * W; s.by = (-tmpB.y * 0.5 + 0.5) * H;
  });
}
function crosses(p, q, s) {
  const d = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d1 = d(s.ax, s.ay, s.bx, s.by, p.x, p.y), d2 = d(s.ax, s.ay, s.bx, s.by, q.x, q.y);
  const d3 = d(p.x, p.y, q.x, q.y, s.ax, s.ay), d4 = d(p.x, p.y, q.x, q.y, s.bx, s.by);
  return d1 * d2 < 0 && d3 * d4 < 0;
}
let lastPt = null;
addEventListener('pointermove', (e) => {
  if (!violin || document.body.classList.contains('is-gated')) return;
  const key = ORDER[Math.round(cam.s)];
  if (e.pointerType === 'touch' && key !== 'finale') { lastPt = null; return; }
  const p = { x: e.clientX, y: e.clientY, t: performance.now() };
  if (lastPt) {
    const now = p.t;
    const speed = Math.hypot(p.x - lastPt.x, p.y - lastPt.y) / Math.max(8, now - lastPt.t);
    screenStrings.forEach((s, i) => {
      if (s.ok && now - s.last > 70 && crosses(lastPt, p, s)) {
        s.last = now;
        pluck(i, 0.45 + Math.min(0.6, speed * 0.35));
      }
    });
  }
  lastPt = p;
}, { passive: true });
addEventListener('pointerleave', () => { lastPt = null; });
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || document.body.classList.contains('is-gated')) return;
  const i = 'asdf'.indexOf(e.key.toLowerCase());
  if (i >= 0) pluck(i, 0.9);
});

// ---------- chapters ----------
let activeKey = null;
let stageKey = null;
let linksHeld = false;
function onChapter(key) {
  if (key === activeKey) return;
  const prev = activeKey;
  activeKey = key;
  if (key) {
    UI.showPanel(key, { holdLinks: key === 'finale' && linksHeld });
    chapterEffects(key, prev);
  } else {
    UI.hidePanel();
  }
}

function setStage(key) {
  const st = STAGE_OF[key] || 'alap';
  if (st === stageKey) return;
  stageKey = st;
  UI.setRaga(st);
  if (soundOn && score) {
    const r = score.setStage(st);
    if (st === 'tihai' && r && r.samInMs != null) {
      linksHeld = true;
      setTimeout(() => { linksHeld = false; UI.revealFinaleLinks(0); }, Math.max(0, r.samInMs - 250));
    }
  }
}

const glowTarget = [0, 0, 0, 0];
function chapterEffects(key) {
  const sfx = soundOn && score;
  glowTarget.fill(0);
  const si = { g: 0, d: 1, a: 2, e: 3 }[key];
  if (si != null) { glowTarget[si] = 0.55; setTimeout(() => pluck(si, 0.8), 250); }
  if (key === 'pegs') {
    if (sfx) score.creak();
    violin.pegs.forEach((p, i) => animate(p.spin.rotation, { y: p.spin.rotation.y + p.side * 0.5, duration: 1400, delay: i * 120, ease: 'outElastic(1, .6)' }));
  }
  if (key === 'fingerboard') {
    violin.tapes.forEach((t, i) => animate(t.scale, { x: [t.scale.x, 1], duration: 1000, delay: 250 + i * 160, ease: 'outExpo' }));
  }
  if (key === 'nut' || key === 'hero' || key === 'pegs') {
    violin.tapes.forEach((t) => animate(t.scale, { x: 0.0001, duration: 400, ease: 'inQuad' }));
  }
  if (key === 'dive' && sfx) score.whoosh();
  if (key === 'exit' && sfx) score.whoosh();
  if (key === 'soundpost' && sfx) score.knock();
  if (key === 'tailpiece') {
    violin.tuners.forEach((t, i) => animate(t.knob.rotation, { y: t.knob.rotation.y + Math.PI, duration: 1200, delay: i * 110, ease: 'inOutQuart' }));
  }
}

// ---------- scroll ----------
let scrollV = 0, lastY = scrollY, lastT = performance.now(), expr = 0;
addEventListener('scroll', () => {
  const now = performance.now();
  const v = Math.abs(scrollY - lastY) / Math.max(4, now - lastT);
  scrollV = Math.max(scrollV, v);
  lastY = scrollY; lastT = now;
  document.body.classList.toggle('at-top', scrollY < 40);
}, { passive: true });

function bindScroll() {
  animate(cam, {
    s: [0, N - 1],
    ease: 'linear',
    duration: 1000,
    autoplay: onScroll({ target: '#track', enter: 'top top', leave: 'bottom bottom', sync: reduced || INSTANT ? true : 0.35 }),
  });
}

// ---------- camera ----------
const insidePoint = (p) => {
  if (p.y <= 0.02 || p.y >= BODY_LEN - 0.02) return 0;
  const w = halfWidth(p.y);
  if (Math.abs(p.x) > w * 0.97) return 0;
  const below = topZ(p.x, p.y) - p.z;
  const above = p.z - backZ(p.x, p.y);
  if (above < 0) return 0;
  return smoothstep(-0.01, 0.06, below);
};
const nearPlate = (p) => {
  if (p.y <= 0 || p.y >= BODY_LEN) return 1;
  if (Math.abs(p.x) > halfWidth(p.y) + 0.05) return 1;
  return Math.abs(p.z - topZ(p.x, p.y));
};

const back = new THREE.Vector3();
function placeCamera(dt) {
  sample(cam.s, mobile, S);
  const c = stage.camera;
  c.position.copy(S.pos);
  if (intro.k > 0) {
    back.copy(S.pos).sub(S.tgt).normalize().multiplyScalar(intro.k * 1.6);
    c.position.add(back);
    c.position.y += intro.k * 0.35;
  }
  c.up.copy(S.up);
  c.lookAt(S.tgt);
  c.fov = S.fov;
  const d = nearPlate(c.position);
  c.near = Math.min(0.03, Math.max(0.0012, d * 0.35));
  const W = innerWidth, H = innerHeight;
  c.setViewOffset(W, H, -S.fx * W, -S.fy * H, W, H);
  c.updateProjectionMatrix();
  void dt;
}

// ---------- loop ----------
let last = performance.now();
let inside = 0;
let running = false;
let indexKey = null;
let audioStarted = false;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  simTime += dt;
  placeCamera(dt);

  const target = insidePoint(stage.camera.position);
  inside += (target - inside) * Math.min(1, dt * 6);
  stage.shaft.visible = inside > 0.02;
  stage.shaft.intensity = 150 * inside;
  stage.inner.intensity = 0.05 * inside;
  violin.shaftUniforms.uOpacity.value = inside * 0.5;
  stage.beam.uniforms.uOpacity.value = 0.05 * (1 - inside);
  stage.dust.uniforms.uInside.value = inside;
  stage.scene.children.forEach((o) => { if (o.material?.uniforms?.uInside && o !== stage.dust.pts) o.material.uniforms.uInside.value = inside; });

  // scroll speed -> bow pressure
  scrollV *= Math.exp(-dt * 3.5);
  const targetExpr = Math.min(1, scrollV / 2.2);
  expr += (targetExpr - expr) * Math.min(1, dt * (targetExpr > expr ? 6 : 1.2));
  stage.dust.uniforms.uSwirl.value = expr;
  if (soundOn && score) { score.setExpression(expr); score.setInside(inside); }

  // chapters
  const nearest = Math.round(cam.s);
  const key = ORDER[nearest];
  setStage(key);
  if (key !== indexKey) { indexKey = key; UI.setIndex(key, ORDER); }
  onChapter(Math.abs(cam.s - nearest) < 0.3 ? key : null);
  document.body.classList.toggle('in-finale', key === 'finale');

  // strings
  violin.strings.forEach((st, i) => {
    st.amp *= Math.exp(-dt * 2.6);
    st.phase += dt * (70 + i * 9);
    st.uniforms.uAmp.value = reduced ? 0 : st.amp;
    st.uniforms.uPhase.value = st.phase;
    const g = st.uniforms.uGlow.value;
    st.uniforms.uGlow.value = g + (glowTarget[i] + st.amp * 40 - g) * Math.min(1, dt * 4);
  });
  violin.ripples.uTime.value = simTime;
  // in the finale the instrument turns slowly so the varnish catches the light
  const fin = smoothstep(N - 1.6, N - 1, cam.s);
  violin.group.rotation.y = fin * (reduced ? 0 : Math.sin(simTime * 0.22) * 0.32);
  violin.group.updateMatrixWorld();
  projectStrings();

  dustCentre.lerp(S.tgt, Math.min(1, dt * 1.5));
  stage.dust.uniforms.uCentre.value.copy(dustCentre);
  stage.dust.uniforms.uTime.value = simTime;
  stage.film.uniforms.uTime.value = simTime;

  UI.updateMeter(score?.analyser, soundOn);
  stage.composer.render();
  requestAnimationFrame(frame);
}

addEventListener('resize', () => { if (stage) stage.resize(); });

// ---------- begin ----------
async function begin(withSound) {
  document.getElementById('beginSound').disabled = true;
  document.getElementById('beginSilent').disabled = true;
  if (withSound && score) {
    try {
      await score.start();
      audioStarted = true;
      soundOn = true;
      UI.setSoundLabel(true);
      await score.tune((i, name, freq) => UI.gateStep(i, name, freq));
    } catch (e) {
      soundOn = false;
      UI.setSoundLabel(false);
      await UI.gateSilentTune();
    }
  } else {
    await UI.gateSilentTune();
  }
  scrollTo(0, 0);
  document.body.classList.remove('is-gated');
  document.body.classList.add('is-live', 'at-top');
  bindScroll();
  if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
  stage.film.uniforms.uFade.value = 0;
  animate(stage.film.uniforms.uFade, { value: 1, duration: 2200, ease: 'outQuad' });
  animate(intro, { k: 0, duration: reduced ? 10 : 3200, ease: 'outQuart' });
  await UI.gateOut();
}

document.getElementById('beginSound').addEventListener('click', () => begin(true));
document.getElementById('beginSilent').addEventListener('click', () => begin(false));

document.getElementById('soundBtn').addEventListener('click', async () => {
  if (!score) return;
  if (!soundOn) {
    try {
      if (!audioStarted) { await score.start(); audioStarted = true; }
      score.setMuted(false);
      soundOn = true;
      const st = stageKey;
      stageKey = null;
      setStage(ORDER[Math.round(cam.s)] || 'hero');
      void st;
    } catch (e) { soundOn = false; }
  } else {
    score.setMuted(true);
    soundOn = false;
  }
  UI.setSoundLabel(soundOn);
});

// hover ticks on links and buttons
document.addEventListener('pointerenter', (e) => {
  const t = e.target;
  if (soundOn && score && t instanceof Element && t.matches('a, button')) score.tick();
}, true);

build().catch((e) => {
  console.error(e);
  UI.setGateProgress(1, 'This browser could not start the 3D stage');
});

// hooks for automated checks
window.__site = { cam, goTo, get stage() { return stage; }, get violin() { return violin; }, intro };
void coarse;
