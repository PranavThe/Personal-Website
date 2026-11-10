// Plan-view drawing of the violin, shared by the textures and the meshes.
// The outline is drawn in "drawing units" (the same numbers as the storyboard SVG)
// and converted to scene units, where 1 unit = 100 mm.

export const S = 3.56 / 410; // body length 356 mm over 410 drawing units
export const BODY_LEN = 3.56;

export const toScene = (x, y) => [(x - 130) * S, (690 - y) * S];

const RIGHT = [
  [[130, 280], [175, 280], [222, 300], [227, 362]],
  [[227, 362], [229, 395], [225, 420], [212, 430]],
  [[212, 430], [196, 436], [192, 452], [194, 473]],
  [[194, 473], [196, 494], [200, 512], [218, 520]],
  [[218, 520], [240, 525], [250, 560], [250, 600]],
  [[250, 600], [250, 655], [190, 690], [130, 690]],
];

const mirror = ([x, y]) => [260 - x, y];
const LEFT = RIGHT.slice().reverse().map((seg) => seg.slice().reverse().map(mirror));
export const OUTLINE_SEGMENTS = [...RIGHT, ...LEFT];

export function bezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
}

// Outline sampled in drawing units, clockwise from the top centre. No duplicate end point.
export function outlineDrawing(perSeg = 48) {
  const pts = [];
  for (const seg of OUTLINE_SEGMENTS) {
    for (let i = 0; i < perSeg; i++) pts.push(bezier(...seg, i / perSeg));
  }
  return pts;
}

export function outlineScene(perSeg = 48) {
  return outlineDrawing(perSeg).map(([x, y]) => toScene(x, y));
}

// Offset a closed polygon along its averaged normals (positive = outward).
export function offsetPolygon(pts, d) {
  const n = pts.length;
  // signed area tells us the winding
  let area = 0;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % n];
    area += x1 * y2 - x2 * y1;
  }
  const sign = area > 0 ? 1 : -1;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const len = Math.hypot(tx, ty) || 1;
    tx /= len; ty /= len;
    // outward normal for this winding
    const nx = ty * sign, ny = -tx * sign;
    return [p[0] + nx * d, p[1] + ny * d];
  });
}

// ---- half width of the body as a function of height (scene units) ----
const HW_BINS = 400;
const halfWidthTable = (() => {
  const t = new Float32Array(HW_BINS + 1);
  const pts = outlineScene(96).filter(([x]) => x >= -1e-6);
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const lo = Math.min(y1, y2), hi = Math.max(y1, y2);
    const b0 = Math.ceil((lo / BODY_LEN) * HW_BINS), b1 = Math.floor((hi / BODY_LEN) * HW_BINS);
    for (let b = Math.max(0, b0); b <= Math.min(HW_BINS, b1); b++) {
      const y = (b / HW_BINS) * BODY_LEN;
      const k = hi - lo < 1e-9 ? 0 : (y - y1) / (y2 - y1);
      const x = x1 + (x2 - x1) * k;
      if (x > t[b]) t[b] = x;
    }
  }
  return t;
})();

export function halfWidth(Y) {
  const f = (Y / BODY_LEN) * HW_BINS;
  if (f <= 0 || f >= HW_BINS) return 0;
  const i = Math.floor(f), k = f - i;
  return halfWidthTable[i] * (1 - k) + halfWidthTable[i + 1] * k;
}

// Arching of a plate: height above the rib edge at (X, Y).
export function arch(X, Y, A = 0.155) {
  const t = Y / BODY_LEN;
  if (t <= 0 || t >= 1) return 0;
  const w = halfWidth(Y);
  if (w <= 0) return 0;
  const u = Math.abs(X) / (w * 0.985);
  if (u >= 1) return 0;
  const longi = Math.pow(Math.sin(Math.PI * t), 0.6);
  const cross = Math.pow(1 - u * u, 1.45);
  // a slight scoop (the "channel") just inside the edge
  const scoop = 0.012 * Math.exp(-Math.pow((u - 0.9) / 0.05, 2));
  return Math.max(0, A * longi * cross - scoop * longi);
}

// ---- f-holes ----
// Centre line from the upper eye to the lower eye, in drawing units (bass side).
const F_LINE = [[101, 448], [89, 472], [101, 512], [82, 542]];
const R_UPPER = 4.3, R_LOWER = 5.6;

export function fholeDrawing(side) {
  const m = side < 0 ? (p) => p : (p) => [260 - p[0], p[1]];
  const P = F_LINE.map(m);
  const N = 90;
  const c = [];
  for (let i = 0; i <= N; i++) c.push(bezier(...P, i / N));
  const cum = [0];
  for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]));
  const L = cum[N];
  const sideA = [], sideB = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, s = cum[i];
    const stem = 1.05 + 1.25 * Math.pow(Math.sin(Math.PI * t), 1.6);
    const eU = Math.sqrt(Math.max(0, R_UPPER * R_UPPER - s * s));
    const eL = Math.sqrt(Math.max(0, R_LOWER * R_LOWER - (L - s) * (L - s)));
    const hw = Math.max(stem, eU, eL);
    const a = c[Math.max(0, i - 1)], b = c[Math.min(N, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const len = Math.hypot(tx, ty) || 1;
    tx /= len; ty /= len;
    sideA.push([c[i][0] - ty * hw, c[i][1] + tx * hw]);
    sideB.push([c[i][0] + ty * hw, c[i][1] - tx * hw]);
  }
  // round cap that bulges away from the stem
  const cap = (center, r, from, to, away, steps = 22) => {
    const out = [];
    const a0 = Math.atan2(from[1] - center[1], from[0] - center[0]);
    const a1 = Math.atan2(to[1] - center[1], to[0] - center[0]);
    let d1 = a1 - a0;
    while (d1 <= 0) d1 += Math.PI * 2;
    const d2 = d1 - Math.PI * 2;
    const angDist = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    const d = angDist(a0 + d1 / 2, away) < angDist(a0 + d2 / 2, away) ? d1 : d2;
    for (let i = 1; i < steps; i++) {
      const a = a0 + (d * i) / steps;
      out.push([center[0] + Math.cos(a) * r, center[1] + Math.sin(a) * r]);
    }
    return out;
  };
  const endDir = Math.atan2(c[N][1] - c[N - 1][1], c[N][0] - c[N - 1][0]);
  const startDir = Math.atan2(c[0][1] - c[1][1], c[0][0] - c[1][0]);
  const poly = [
    ...sideA,
    ...cap(c[N], R_LOWER, sideA[N], sideB[N], endDir),
    ...sideB.slice().reverse(),
    ...cap(c[0], R_UPPER, sideB[0], sideA[0], startDir),
  ];
  return { poly, centre: c, eyes: { upper: c[0], lower: c[N] } };
}

export function fholeScene(side) {
  const f = fholeDrawing(side);
  return {
    poly: f.poly.map(([x, y]) => toScene(x, y)),
    upper: toScene(...f.eyes.upper),
    lower: toScene(...f.eyes.lower),
    notch: toScene(...f.centre[Math.round(f.centre.length * 0.52)]),
  };
}

export function pointInPolygon([x, y], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
