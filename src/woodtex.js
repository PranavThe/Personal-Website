// Wood, varnish and paper, painted on canvases at load time.
import * as THREE from 'three';
import { S, OUTLINE_SEGMENTS, outlineDrawing, offsetPolygon, fholeDrawing } from './geometry2d.js';

// Plate texture frame in scene units
export const PLATE = { x0: -1.1, x1: 1.1, y0: -0.05, y1: 3.61 };

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function valueNoise(seed) {
  const r = rng(seed);
  const P = new Float32Array(512);
  for (let i = 0; i < 512; i++) P[i] = r();
  const h = (x, y) => P[((x * 73856093) ^ (y * 19349663)) & 511];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function tex(c, { color = true, repeat = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

// Transform drawing units -> plate canvas pixels
function plateTransform(ctx, W, H) {
  const ax = (S * W) / (PLATE.x1 - PLATE.x0);
  const bx = ((-130 * S - PLATE.x0) * W) / (PLATE.x1 - PLATE.x0);
  const ay = (S * H) / (PLATE.y1 - PLATE.y0);
  const by = ((PLATE.y1 - 690 * S) * H) / (PLATE.y1 - PLATE.y0);
  ctx.setTransform(ax, 0, 0, ay, bx, by);
}

function outlinePath(ctx, pad = 0) {
  if (!pad) {
    ctx.beginPath();
    ctx.moveTo(...OUTLINE_SEGMENTS[0][0]);
    for (const s of OUTLINE_SEGMENTS) ctx.bezierCurveTo(...s[1], ...s[2], ...s[3]);
    ctx.closePath();
    return;
  }
  polyPath(ctx, offsetPolygon(outlineDrawing(64), pad));
}

function polyPath(ctx, pts) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p)));
  ctx.closePath();
}

function grainLines(ctx, W, H, { seed, color, lightColor, spacing = [5, 11], alpha = [0.12, 0.32], centreTight = true }) {
  const r = rng(seed);
  const n = valueNoise(seed + 7);
  let x = -10;
  while (x < W + 10) {
    const fromCentre = Math.abs(x / W - 0.5) * 2;
    const sp = spacing[0] + (spacing[1] - spacing[0]) * (centreTight ? fromCentre : 0.5) + r() * 2.5;
    x += sp;
    const a = alpha[0] + r() * (alpha[1] - alpha[0]);
    const w = 0.8 + r() * 1.9;
    ctx.strokeStyle = color;
    ctx.globalAlpha = a;
    ctx.lineWidth = w;
    ctx.beginPath();
    for (let y = -20; y <= H + 20; y += 24) {
      const dx = (n(x * 0.004, y * 0.0016) - 0.5) * 14 + Math.sin(y * 0.003 + x * 0.01) * 2;
      y === -20 ? ctx.moveTo(x + dx, y) : ctx.lineTo(x + dx, y);
    }
    ctx.stroke();
    if (lightColor && r() < 0.5) {
      ctx.strokeStyle = lightColor;
      ctx.globalAlpha = a * 0.35;
      ctx.lineWidth = w * 1.6;
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

function speckle(ctx, W, H, seed, amount, color) {
  const r = rng(seed);
  ctx.fillStyle = color;
  for (let i = 0; i < amount; i++) {
    ctx.globalAlpha = 0.03 + r() * 0.06;
    const w = 1 + r() * 2.5;
    ctx.fillRect(r() * W, r() * H, w, w * (1 + r() * 3));
  }
  ctx.globalAlpha = 1;
}

// ---------- top plate ----------
export function makeTopTextures(W = 1280) {
  const H = Math.round((W * (PLATE.y1 - PLATE.y0)) / (PLATE.x1 - PLATE.x0));
  const fL = fholeDrawing(-1), fR = fholeDrawing(1);

  // varnished outer face
  const c = canvas(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = '#5e220a';
  ctx.fillRect(0, 0, W, H);
  // warm, worn centre of each bout
  for (const [cx, cy, r, a] of [[0.5, 0.27, 0.4, 0.5], [0.5, 0.74, 0.46, 0.55], [0.5, 0.5, 0.26, 0.2], [0.47, 0.8, 0.16, 0.25]]) {
    const g = ctx.createRadialGradient(cx * W, cy * H, 0, cx * W, cy * H, r * W);
    g.addColorStop(0, `rgba(196,108,42,${a})`);
    g.addColorStop(1, 'rgba(196,108,42,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  grainLines(ctx, W, H, { seed: 11, color: '#2a0d03', lightColor: '#e8a45c', spacing: [5, 12], alpha: [0.18, 0.4] });
  grainLines(ctx, W, H, { seed: 23, color: '#5a2309', spacing: [2.5, 6], alpha: [0.04, 0.1] });
  speckle(ctx, W, H, 5, 2600, '#2a0d03');

  // edges: varnish pools darker towards the purfling
  ctx.save();
  plateTransform(ctx, W, H);
  outlinePath(ctx);
  ctx.clip();
  ctx.strokeStyle = 'rgba(40,12,3,0.42)';
  ctx.lineWidth = 26;
  ctx.filter = 'blur(10px)';
  outlinePath(ctx);
  ctx.stroke();
  ctx.filter = 'none';
  ctx.strokeStyle = 'rgba(30,9,2,0.35)';
  ctx.lineWidth = 6;
  outlinePath(ctx);
  ctx.stroke();
  // purfling: black, maple, black
  const pts = outlineDrawing(64);
  for (const [d, col, w] of [[-4.0, '#140703', 0.62], [-4.62, '#e9d3a6', 0.5], [-5.22, '#140703', 0.62]]) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    polyPath(ctx, offsetPolygon(pts, d));
    ctx.stroke();
  }
  // f-hole lips and notches
  for (const f of [fL, fR]) {
    ctx.strokeStyle = 'rgba(25,8,2,0.55)';
    ctx.lineWidth = 1.4;
    polyPath(ctx, f.poly);
    ctx.stroke();
    ctx.fillStyle = '#120602';
    polyPath(ctx, f.poly);
    ctx.fill();
    const k = Math.round(f.centre.length * 0.52);
    const [x0, y0] = f.centre[k - 1], [x1, y1] = f.centre[k + 1];
    const tx = x1 - x0, ty = y1 - y0, l = Math.hypot(tx, ty);
    const nx = -ty / l, ny = tx / l;
    ctx.strokeStyle = '#120602';
    ctx.lineWidth = 0.7;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(f.centre[k][0] + nx * s * 2.0, f.centre[k][1] + ny * s * 2.0);
      ctx.lineTo(f.centre[k][0] + nx * s * 4.2, f.centre[k][1] + ny * s * 4.2 - 0.6);
      ctx.stroke();
    }
  }
  ctx.restore();

  // alpha: body minus f-holes
  const a = canvas(W, H), actx = a.getContext('2d');
  actx.fillStyle = '#000';
  actx.fillRect(0, 0, W, H);
  plateTransform(actx, W, H);
  actx.fillStyle = '#fff';
  outlinePath(actx, 1.2);
  actx.fill();
  actx.fillStyle = '#000';
  for (const f of [fL, fR]) { polyPath(actx, f.poly); actx.fill(); }

  // raw inner face
  const r = canvas(W >> 1, H >> 1), rctx = r.getContext('2d');
  rctx.fillStyle = '#93714a';
  rctx.fillRect(0, 0, r.width, r.height);
  grainLines(rctx, r.width, r.height, { seed: 11, color: '#8a6034', spacing: [2.5, 6], alpha: [0.12, 0.3] });
  speckle(rctx, r.width, r.height, 9, 900, '#6b4520');

  // bump: the grain stands slightly proud under the varnish
  const b = canvas(W >> 1, H >> 1), bctx = b.getContext('2d');
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, b.width, b.height);
  grainLines(bctx, b.width, b.height, { seed: 11, color: '#ffffff', spacing: [2.5, 6], alpha: [0.25, 0.5] });
  const bump = tex(b, { color: false });

  return { color: tex(c), alpha: tex(a, { color: false }), raw: tex(r), bump };
}

// ---------- flamed maple ----------
function flamePixels(W, H, { seed, base, light, dark, flameFreq = 0.09, slope = 0.35, bookmatch = false, grainFreq = 0.6 }) {
  const c = canvas(W, H), ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  const d = img.data;
  const n = valueNoise(seed), n2 = valueNoise(seed + 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const xx = bookmatch ? Math.abs(x - W / 2) : x;
      const warp = (n(xx * 0.02, y * 0.01) - 0.5) * 18;
      const f = Math.sin((y + xx * slope + warp) * flameFreq);
      const flame = Math.pow(Math.abs(f), 0.6) * Math.sign(f);
      const g = (n2(xx * grainFreq, y * 0.01) - 0.5) * 0.35;
      const k = 0.5 + 0.2 * flame + g * 0.35;
      const i = (y * W + x) * 4;
      const mix = (a, b, t) => a + (b - a) * t;
      const t = Math.min(1, Math.max(0, k));
      d[i] = mix(dark[0], light[0], t) * 0.6 + base[0] * 0.4;
      d[i + 1] = mix(dark[1], light[1], t) * 0.6 + base[1] * 0.4;
      d[i + 2] = mix(dark[2], light[2], t) * 0.6 + base[2] * 0.4;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function makeBackTextures() {
  const W = 512, H = Math.round((W * (PLATE.y1 - PLATE.y0)) / (PLATE.x1 - PLATE.x0));
  const c = flamePixels(W, H, { seed: 31, base: [90, 32, 10], light: [190, 104, 44], dark: [70, 24, 7], flameFreq: 0.2, slope: 0.45, bookmatch: true });
  const ctx = c.getContext('2d');
  ctx.save();
  plateTransform(ctx, W, H);
  ctx.strokeStyle = 'rgba(30,9,2,0.5)';
  ctx.lineWidth = 18;
  ctx.filter = 'blur(6px)';
  outlinePath(ctx);
  ctx.stroke();
  ctx.filter = 'none';
  const pts = outlineDrawing(48);
  for (const [dd, col, w] of [[-4.0, '#140703', 0.7], [-4.7, '#e9d3a6', 0.55], [-5.4, '#140703', 0.7]]) {
    ctx.strokeStyle = col; ctx.lineWidth = w;
    polyPath(ctx, offsetPolygon(pts, dd)); ctx.stroke();
  }
  ctx.restore();
  const a = canvas(W, H), actx = a.getContext('2d');
  actx.fillStyle = '#000'; actx.fillRect(0, 0, W, H);
  plateTransform(actx, W, H);
  actx.fillStyle = '#fff'; outlinePath(actx, 1.2); actx.fill();

  const r = flamePixels(256, Math.round(H / 2), { seed: 31, base: [140, 104, 66], light: [168, 132, 90], dark: [118, 86, 52], flameFreq: 0.3, slope: 0.45, bookmatch: true });
  return { color: tex(c), alpha: tex(a, { color: false }), raw: tex(r) };
}

export function makeMapleTexture(seed = 41, W = 512, H = 512, opts = {}) {
  const c = flamePixels(W, H, { seed, base: [86, 30, 9], light: [176, 92, 38], dark: [70, 24, 7], flameFreq: 0.24, slope: 0.15, ...opts });
  const t = tex(c, { repeat: true });
  return t;
}

export function makeEbonyTexture() {
  const W = 256, H = 512;
  const c = canvas(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = '#121010';
  ctx.fillRect(0, 0, W, H);
  grainLines(ctx, W, H, { seed: 77, color: '#2a2420', spacing: [3, 7], alpha: [0.2, 0.5], centreTight: false });
  speckle(ctx, W, H, 78, 500, '#3a302a');
  return tex(c, { repeat: true });
}

export function makeRawWoodTexture(seed = 90) {
  const W = 256, H = 256;
  const c = canvas(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = '#9a7a50';
  ctx.fillRect(0, 0, W, H);
  grainLines(ctx, W, H, { seed, color: '#6e4e2a', spacing: [3, 7], alpha: [0.15, 0.35], centreTight: false });
  return tex(c, { repeat: true });
}

// The maker's label, glued inside the back under the bass f-hole.
export function makeLabelTexture() {
  const W = 1024, H = 400;
  const c = canvas(W, H), ctx = c.getContext('2d');
  const r = rng(404);
  ctx.fillStyle = '#d8c39a';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 14; i++) {
    const g = ctx.createRadialGradient(r() * W, r() * H, 0, r() * W, r() * H, 60 + r() * 220);
    g.addColorStop(0, 'rgba(120,80,30,0.16)');
    g.addColorStop(1, 'rgba(120,80,30,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  speckle(ctx, W, H, 405, 1400, '#5a3b16');
  ctx.strokeStyle = '#2b1a0c';
  ctx.lineWidth = 5;
  ctx.strokeRect(26, 26, W - 52, H - 52);
  ctx.lineWidth = 1.6;
  ctx.strokeRect(40, 40, W - 80, H - 80);
  ctx.fillStyle = '#24150a';
  ctx.textAlign = 'center';
  ctx.font = 'italic 600 64px "Bodoni Moda", "Bodoni 72", Didot, Georgia, serif';
  ctx.fillText('Pranavus Puranik Marylandiensis', W / 2, 170);
  ctx.font = '500 52px "Bodoni Moda", "Bodoni 72", Didot, Georgia, serif';
  ctx.fillText('Faciebat Anno 2026', W / 2, 262);
  // a small brand in a circle
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(W - 120, 300, 36, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = 'italic 600 34px "Bodoni Moda", Georgia, serif';
  ctx.fillText('PP', W - 120, 312);
  return tex(c);
}
