// The camera's route down the instrument. Each station is one chapter.
// `via` points shape the path between chapters (through the f-holes) and hold no text.
import * as THREE from 'three';

// frame: where the subject sits on screen, as a fraction of the viewport ([x, y]),
// so the text can take the other side. d = desktop, m = phone.
export const PATH = [
  { key: 'hero', pos: [2.45, 5.86, 0.62], tgt: [0.0, 5.5, -0.1], fov: 28, frame: { d: [0.2, 0], m: [0, 0.2] } },
  { key: 'pegs', pos: [-1.0, 5.62, 1.02], tgt: [0.02, 5.18, -0.06], fov: 30, frame: { d: [-0.2, 0], m: [0, 0.2] } },
  { key: 'nut', pos: [0.78, 5.42, 0.74], tgt: [0.0, 4.8, 0.06], fov: 30, frame: { d: [0.2, 0], m: [0, 0.2] } },
  { key: 'fingerboard', pos: [-0.2, 5.0, 0.62], tgt: [0.0, 3.2, 0.42], fov: 34, up: [0, 0.35, 1], frame: { d: [-0.18, 0], m: [0, 0.18] } },
  { key: 'g', pos: [-0.24, 1.38, 0.7], tgt: [-0.06, 3.9, 0.5], fov: 36, up: [0, 0, 1], frame: { d: [-0.2, 0], m: [0, 0.32] } },
  { key: 'd', pos: [-0.1, 1.36, 0.69], tgt: [-0.02, 3.9, 0.5], fov: 36, up: [0, 0, 1], frame: { d: [-0.2, 0], m: [0, 0.32] } },
  { key: 'a', pos: [0.1, 1.36, 0.69], tgt: [0.02, 3.9, 0.5], fov: 36, up: [0, 0, 1], frame: { d: [0.2, 0], m: [0, 0.32] } },
  { key: 'e', pos: [0.24, 1.38, 0.7], tgt: [0.06, 3.9, 0.5], fov: 36, up: [0, 0, 1], frame: { d: [0.2, 0], m: [0, 0.32] } },
  { key: 'bridge', pos: [0.42, 0.9, 0.66], tgt: [0.0, 1.75, 0.46], fov: 34, up: [0, 0, 1], frame: { d: [0.2, 0], m: [0, 0.2] } },
  { key: 'fholes', pos: [0.86, 1.3, 1.22], tgt: [0.39, 1.6, 0.24], fov: 32, frame: { d: [0.2, 0], m: [0, 0.2] } },
  { via: true, pos: [0.47, 1.24, 0.5], tgt: [0.41, 1.3, 0.1], fov: 40, frame: { d: [0, 0], m: [0, 0] } },
  { key: 'dive', pos: [0.418, 1.292, 0.255], tgt: [0.39, 1.36, -0.2], fov: 52, frame: { d: [0, 0], m: [0, 0] } },
  { via: true, pos: [0.4, 1.3, 0.06], tgt: [0.25, 1.48, -0.05], fov: 58, up: [0, 0.5, 1], frame: { d: [0, 0], m: [0, 0] } },
  { key: 'soundpost', pos: [0.52, 0.92, -0.01], tgt: [0.1, 1.62, 0.02], fov: 56, up: [0, 0, 1], frame: { d: [0.16, 0], m: [0, 0.18] } },
  { key: 'bassbar', pos: [0.18, 0.5, -0.06], tgt: [-0.2, 2.1, 0.06], fov: 56, up: [0, 0, 1], frame: { d: [-0.16, 0], m: [0, 0.18] } },
  { via: true, pos: [-0.36, 1.2, 0.02], tgt: [-0.42, 1.3, 0.6], fov: 58, up: [0, 0.6, 1], frame: { d: [0, 0], m: [0, 0] } },
  { key: 'exit', pos: [-0.418, 1.292, 0.28], tgt: [-0.12, 0.45, 0.42], fov: 52, up: [0, 0, 1], frame: { d: [0, 0], m: [0, 0] } },
  { via: true, pos: [-0.5, 0.9, 0.62], tgt: [-0.2, 1.0, 0.3], fov: 40, up: [0, 0.6, 1], frame: { d: [0, 0], m: [0, 0] } },
  { key: 'tailpiece', pos: [-0.3, -0.22, 0.74], tgt: [0.02, 1.15, 0.38], fov: 34, up: [0, 0, 1], frame: { d: [-0.2, 0], m: [0, 0.2] } },
  { key: 'finale', pos: [0.0, 2.9, 11.9], tgt: [0.0, 2.9, 0.0], fov: 30, mfov: 56, frame: { d: [0.23, 0], m: [0, 0.25] } },
];

export const STATIONS = PATH.map((p, i) => ({ ...p, index: i })).filter((p) => !p.via);

export const STAGE_OF = {
  hero: 'alap', pegs: 'alap', nut: 'alap', fingerboard: 'alap',
  g: 'jor', d: 'jor', a: 'jor', e: 'jor',
  bridge: 'gat', fholes: 'gat',
  dive: 'inside', soundpost: 'inside', bassbar: 'inside', exit: 'inside',
  tailpiece: 'jhala', finale: 'tihai',
};

const v3 = (a) => new THREE.Vector3(...a);
const posCurve = new THREE.CatmullRomCurve3(PATH.map((p) => v3(p.pos)), false, 'centripetal');
const tgtCurve = new THREE.CatmullRomCurve3(PATH.map((p) => v3(p.tgt)), false, 'centripetal');
const UPS = PATH.map((p) => v3(p.up || [0, 1, 0]).normalize());

// Ease within each chapter so the camera lingers at a chapter and moves between them.
function ease(u) {
  const s = u * u * u * (u * (u * 6 - 15) + 10);
  return 0.12 * u + 0.88 * s;
}

// s runs from 0 to STATIONS.length - 1
export function sample(s, mobile, out) {
  const n = STATIONS.length;
  const sc = Math.min(n - 1, Math.max(0, s));
  const i = Math.min(n - 2, Math.floor(sc));
  const u = ease(sc - i);
  const a = STATIONS[i].index, b = STATIONS[i + 1].index;
  const k = a + (b - a) * u; // index along PATH
  const t = k / (PATH.length - 1);
  posCurve.getPoint(t, out.pos);
  tgtCurve.getPoint(t, out.tgt);
  const j = Math.min(PATH.length - 2, Math.floor(k)), f = k - j;
  const A = PATH[j], B = PATH[j + 1];
  const fa0 = mobile ? A.mfov || A.fov * 1.22 : A.fov, fb0 = mobile ? B.mfov || B.fov * 1.22 : B.fov;
  out.fov = fa0 + (fb0 - fa0) * f;
  out.up.copy(UPS[j]).lerp(UPS[j + 1], f).normalize();
  const fa = mobile ? A.frame.m : A.frame.d, fb = mobile ? B.frame.m : B.frame.d;
  out.fx = fa[0] + (fb[0] - fa[0]) * f;
  out.fy = fa[1] + (fb[1] - fa[1]) * f;
  return out;
}
