// A violin, built from measurements. Scene units: 1 = 100 mm.
// Front of the instrument faces +z, the scroll points up (+y), the G string is on -x.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { outlineScene, offsetPolygon, arch, fholeScene, BODY_LEN } from './geometry2d.js';
import { PLATE, makeTopTextures, makeBackTextures, makeMapleTexture, makeEbonyTexture, makeRawWoodTexture, makeLabelTexture } from './woodtex.js';

export const RIB = 0.15;
export const NUT_Y = 4.86;
export const BRIDGE_Y = 1.61;
export const FB_END_Y = 2.16;
export const BODY_TOP = BODY_LEN;
export const TOP_ARCH = 0.155;
export const BACK_ARCH = 0.145;
export const zFB = (Y) => 0.26 - 0.1615 * (Y - 3.56); // fingerboard top, centre line
const FB_K = 1.19; // fingerboard curvature
const BRIDGE_BASE = 0.288;
export const bridgeTop = (x) => 0.335 - 1.1 * x * x - 0.03 * x;
export const topZ = (X, Y) => RIB + arch(X, Y, TOP_ARCH);
export const backZ = (X, Y) => -(RIB + arch(X, Y, BACK_ARCH));

export const STRINGS = [
  { name: 'G', freq: 196.0, r: 0.0043, nut: -0.0825, bridge: -0.17, tail: -0.09, color: 0xa9a49a, silk: 0x6b4b2a },
  { name: 'D', freq: 293.66, r: 0.0037, nut: -0.0275, bridge: -0.0567, tail: -0.03, color: 0xc2bdb2, silk: 0x7c2a22 },
  { name: 'A', freq: 440.0, r: 0.0031, nut: 0.0275, bridge: 0.0567, tail: 0.03, color: 0xcfcbc2, silk: 0x2f4a36 },
  { name: 'E', freq: 659.25, r: 0.0024, nut: 0.0825, bridge: 0.17, tail: 0.09, color: 0xd9b468, silk: 0x7d6a3a },
];

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Loft a series of rings into a surface. Rings must have the same point count.
function loft(rings, { closed = true, capStart = false, capEnd = false } = {}) {
  const M = rings[0].length, N = rings.length;
  const pos = [], uv = [], idx = [];
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < M; i++) {
      const p = rings[j][i];
      pos.push(p.x, p.y, p.z);
      uv.push(i / (M - 1), j / (N - 1));
    }
  }
  const segs = closed ? M : M - 1;
  for (let j = 0; j < N - 1; j++) {
    for (let i = 0; i < segs; i++) {
      const a = j * M + i, b = j * M + ((i + 1) % M), c = (j + 1) * M + i, d = (j + 1) * M + ((i + 1) % M);
      idx.push(a, c, b, b, c, d);
    }
  }
  const addCap = (ring, flip) => {
    const c = ring.reduce((s, p) => s.add(p), V(0, 0, 0)).multiplyScalar(1 / ring.length);
    const ci = pos.length / 3;
    pos.push(c.x, c.y, c.z); uv.push(0.5, 0.5);
    const base = pos.length / 3;
    ring.forEach((p) => { pos.push(p.x, p.y, p.z); uv.push(0.5, 0.5); });
    for (let i = 0; i < M; i++) {
      const a = base + i, b = base + ((i + 1) % M);
      flip ? idx.push(ci, b, a) : idx.push(ci, a, b);
    }
  };
  if (capStart) addCap(rings[0], false);
  if (capEnd) addCap(rings[N - 1], true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // make sure normals face outward from each ring's centre
  const mid = rings[Math.floor(N / 2)];
  const centre = mid.reduce((s, p) => s.add(p), V(0, 0, 0)).multiplyScalar(1 / M);
  const nrm = g.getAttribute('normal');
  let score = 0;
  const off = Math.floor(N / 2) * M;
  for (let i = 0; i < M; i++) {
    const p = mid[i];
    score += (p.x - centre.x) * nrm.getX(off + i) + (p.y - centre.y) * nrm.getY(off + i) + (p.z - centre.z) * nrm.getZ(off + i);
  }
  if (score < 0) {
    for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  return g;
}

function roundedRect(w, h, r, steps = 3) {
  // points around a rounded rectangle centred at 0, as [x, y]
  const pts = [];
  const corners = [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, Math.PI / 2], [-w / 2 + r, -h / 2 + r, Math.PI], [w / 2 - r, -h / 2 + r, (3 * Math.PI) / 2]];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (i / steps) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  }
  return pts;
}

// Profile in (z, Y) extruded across x. Returns geometry spanning x in [x0, x1].
function sideExtrude(points, x0, x1, bevel = 0.006) {
  const s = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
  const depth = x1 - x0 - bevel * 2;
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 16 });
  // shape (sx, sy, sz) -> scene (x = -sz, y = sy, z = sx); determinant +1 keeps winding
  const m = new THREE.Matrix4().set(0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1);
  g.applyMatrix4(m);
  g.translate(x1 - bevel, 0, 0);
  g.computeVertexNormals();
  return g;
}

export function buildViolin({ lightDir }) {
  const group = new THREE.Group();
  group.name = 'violin';

  const top = makeTopTextures();
  const back = makeBackTextures();
  const mapleTex = makeMapleTexture(41, 512, 512);
  const ribTex = makeMapleTexture(43, 1024, 128, { flameFreq: 0.22, slope: 0.05 });
  ribTex.repeat.set(5, 1);
  const neckTex = makeMapleTexture(47, 256, 512, { flameFreq: 0.1, base: [120, 66, 28], light: [168, 104, 52], dark: [98, 52, 22] });
  const ebonyTex = makeEbonyTexture();
  const rawTex = makeRawWoodTexture();
  const labelTex = makeLabelTexture();

  // ---- materials ----
  const ripples = { uTime: { value: 0 }, uRip: { value: Array.from({ length: 6 }, () => new THREE.Vector4(0, 0, -99, 0)) } };
  const topMat = new THREE.MeshPhysicalMaterial({
    map: top.color, alphaMap: top.alpha, alphaTest: 0.5, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.06,
    bumpMap: top.bump, bumpScale: 0.35,
    sheen: 0.5, sheenColor: new THREE.Color(0x7a2a08), sheenRoughness: 0.45,
  });
  topMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, ripples);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;\nuniform float uTime;\nuniform vec4 uRip[6];')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        for (int i = 0; i < 6; i++) {
          float age = uTime - uRip[i].z;
          if (age > 0.0 && age < 3.0) {
            float d = distance(vLocal.xy, uRip[i].xy);
            float r = age * 0.75;
            float w = 0.018 + age * 0.03;
            float ring = exp(-pow((d - r) / w, 2.0)) * exp(-age * 1.6) * uRip[i].w;
            totalEmissiveRadiance += vec3(1.0, 0.72, 0.38) * ring;
          }
        }`);
  };
  const topInnerMat = new THREE.MeshStandardMaterial({ map: top.raw, alphaMap: top.alpha, alphaTest: 0.5, roughness: 0.92, side: THREE.BackSide });
  const backMat = new THREE.MeshPhysicalMaterial({ map: back.color, alphaMap: back.alpha, alphaTest: 0.5, roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.1 });
  const backInnerMat = new THREE.MeshStandardMaterial({ map: back.raw, alphaMap: back.alpha, alphaTest: 0.5, roughness: 0.9, side: THREE.BackSide });
  const mapleMat = new THREE.MeshPhysicalMaterial({ map: mapleTex, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.1 });
  const ribMat = new THREE.MeshPhysicalMaterial({ map: ribTex, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.1 });
  const ribInnerMat = new THREE.MeshStandardMaterial({ map: rawTex, roughness: 0.9, side: THREE.BackSide });
  const neckMat = new THREE.MeshPhysicalMaterial({ map: neckTex, roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.35 });
  const ebonyMat = new THREE.MeshPhysicalMaterial({ map: ebonyTex, roughness: 0.5, clearcoat: 0.22, clearcoatRoughness: 0.4 });
  const rawMat = new THREE.MeshStandardMaterial({ map: rawTex, roughness: 0.88 });
  const bridgeMat = new THREE.MeshStandardMaterial({ map: rawTex, color: 0xf3e2bf, roughness: 0.62 });
  const boneMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc2, roughness: 0.45 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0xd2d2d6, metalness: 1, roughness: 0.22 });
  const blackMetal = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, metalness: 0.8, roughness: 0.35 });
  const gutMat = new THREE.MeshStandardMaterial({ color: 0x1b1611, roughness: 0.7 });
  const labelMat = new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.95 });
  const tapeMat = new THREE.MeshStandardMaterial({ color: 0xf1ede2, roughness: 0.85 });

  const add = (geo, mat, { cast = true, receive = true, name } = {}) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast; m.receiveShadow = receive;
    if (name) m.name = name;
    group.add(m);
    return m;
  };

  // ---- plates ----
  const plateGeo = (sign, A) => {
    const g = new THREE.PlaneGeometry(PLATE.x1 - PLATE.x0, PLATE.y1 - PLATE.y0, 220, 366);
    g.translate(0, (PLATE.y0 + PLATE.y1) / 2, 0);
    if (sign < 0) g.scale(-1, 1, 1);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const X = p.getX(i), Y = p.getY(i);
      p.setZ(i, sign * (RIB + arch(X, Y, A)));
    }
    g.computeVertexNormals();
    return g;
  };
  const topGeo = plateGeo(1, TOP_ARCH);
  const topMesh = add(topGeo, topMat, { name: 'top' });
  topMesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaMap: top.alpha, alphaTest: 0.5 });
  const topInner = add(topGeo, topInnerMat, { cast: false });
  topInner.customDepthMaterial = topMesh.customDepthMaterial;
  const backGeo = plateGeo(-1, BACK_ARCH);
  const backMesh = add(backGeo, backMat, { name: 'back' });
  backMesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaMap: back.alpha, alphaTest: 0.5 });
  add(backGeo, backInnerMat, { cast: false });

  // ---- ribs and edges ----
  const outline = outlineScene(48);
  {
    const n = outline.length;
    const pos = [], uv = [], idx = [];
    let L = 0;
    const cum = [0];
    for (let i = 1; i <= n; i++) {
      const a = outline[i - 1], b = outline[i % n];
      L += Math.hypot(b[0] - a[0], b[1] - a[1]);
      cum.push(L);
    }
    for (let i = 0; i <= n; i++) {
      const [x, y] = outline[i % n];
      pos.push(x, y, -RIB, x, y, RIB);
      uv.push(cum[i] / L, 0, cum[i] / L, 1);
    }
    for (let i = 0; i < n; i++) {
      const a = 2 * i, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    // outward check at the widest point of the lower bout
    const nrm = g.getAttribute('normal');
    let s = 0;
    for (let i = 0; i < n; i += 10) s += outline[i][0] * nrm.getX(2 * i) + (outline[i][1] - 1.78) * nrm.getY(2 * i);
    if (s < 0) {
      for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }
      g.setIndex(idx); g.computeVertexNormals();
    }
    add(g, ribMat, { name: 'ribs' });
    add(g, ribInnerMat, { cast: false });

    const curve = (z, inset = 0) => new THREE.CatmullRomCurve3(
      (inset ? offsetPolygon(outline, -inset) : outline).map(([x, y]) => V(x, y, z)), true, 'centripetal');
    add(new THREE.TubeGeometry(curve(RIB + 0.004), 720, 0.019, 10, true), ribMat);
    add(new THREE.TubeGeometry(curve(-RIB - 0.004), 720, 0.019, 10, true), ribMat);
    // linings inside
    add(new THREE.TubeGeometry(curve(RIB - 0.018, 0.012), 360, 0.012, 6, true), rawMat, { cast: false });
    add(new THREE.TubeGeometry(curve(-RIB + 0.018, 0.012), 360, 0.012, 6, true), rawMat, { cast: false });
  }

  // ---- blocks inside ----
  const block = (x, y, w, h) => {
    const m = add(new RoundedBoxGeometry(w, h, RIB * 2 - 0.02, 2, 0.01), rawMat, { cast: false });
    m.position.set(x, y, 0);
  };
  block(0, 3.485, 0.34, 0.08);
  block(0, 0.06, 0.3, 0.07);
  for (const s of [-1, 1]) {
    block(s * 0.595, 2.215, 0.08, 0.11);
    block(s * 0.61, 1.515, 0.08, 0.11);
  }

  // ---- bass bar and sound post ----
  {
    const X = -0.155, y0 = 0.42, y1 = 3.12, rings = [];
    for (let i = 0; i <= 40; i++) {
      const Y = y0 + ((y1 - y0) * i) / 40;
      const t = (Y - y0) / (y1 - y0);
      const d = 0.018 + 0.1 * Math.pow(Math.sin(Math.PI * t), 0.8);
      const zt = topZ(X, Y) - 0.004;
      rings.push(roundedRect(0.05, d, 0.008, 2).map(([x, z]) => V(X + x, Y, zt - d / 2 + z)));
    }
    add(loft(rings, { capStart: true, capEnd: true }), rawMat, { name: 'bassbar', cast: false });
  }
  const POST = { x: 0.115, y: BRIDGE_Y - 0.045 };
  {
    const zt = topZ(POST.x, POST.y) - 0.004, zb = backZ(POST.x, POST.y) + 0.004;
    const m = add(new THREE.CylinderGeometry(0.031, 0.031, zt - zb, 24), rawMat, { name: 'soundpost' });
    m.rotation.x = Math.PI / 2;
    m.position.set(POST.x, POST.y, (zt + zb) / 2);
  }
  // maker's label under the bass f-hole
  {
    const lx = -0.29, ly = 1.66;
    const m = add(new THREE.PlaneGeometry(0.36, 0.14), labelMat, { cast: false });
    m.position.set(lx, ly, backZ(lx, ly) + 0.006);
    m.rotation.z = 0.06;
  }

  // ---- neck ----
  const fbThick = (Y) => 0.058 + 0.02 * ((NUT_Y - Y) / (NUT_Y - FB_END_Y));
  {
    const rings = [];
    for (let i = 0; i <= 36; i++) {
      const Y = 3.44 + ((NUT_Y + 0.02 - 3.44) * i) / 36;
      const topz = zFB(Y) - fbThick(Y) + 0.006;
      const w = 0.236 + 0.064 * Math.min(1, (NUT_Y - Y) / 1.3);
      let depth = 0.175 + 0.025 * Math.min(1, (NUT_Y - Y) / 1.0);
      if (Y < 3.86) {
        const k = (3.86 - Y) / (3.86 - 3.44);
        const target = topz - (-RIB - 0.02);
        depth = depth + (target - depth) * (1 - Math.cos(Math.min(1, k) * Math.PI)) / 2;
      }
      const ring = [];
      const M = 22;
      for (let k = 0; k <= M; k++) {
        const a = (k / M) * Math.PI;
        ring.push(V((w / 2) * Math.cos(a), Y, topz - depth * Math.pow(Math.sin(a), 0.85)));
      }
      ring.push(V(-w / 2 + 0.01, Y, topz + 0.004), V(w / 2 - 0.01, Y, topz + 0.004));
      rings.push(ring);
    }
    add(loft(rings), neckMat, { name: 'neck' });
    // the button: a half disc of the back that the neck heel meets
    const btn = add(new THREE.CylinderGeometry(0.11, 0.11, 0.035, 32, 1, false, Math.PI / 2, Math.PI), mapleMat);
    btn.rotation.x = Math.PI / 2;
    btn.position.set(0, BODY_TOP - 0.01, -RIB - 0.004);
  }

  // ---- fingerboard ----
  {
    const rings = [];
    for (let i = 0; i <= 50; i++) {
      const Y = NUT_Y + 0.015 - ((NUT_Y + 0.015 - FB_END_Y) * i) / 50;
      const w = 0.24 + 0.18 * ((NUT_Y - Y) / (NUT_Y - FB_END_Y));
      const zc = zFB(Y);
      const bottom = zc - fbThick(Y);
      const ring = [];
      const A = 14;
      for (let k = 0; k <= A; k++) {
        const x = w / 2 - (w * k) / A;
        ring.push(V(x, Y, zc - FB_K * x * x));
      }
      ring.push(V(-w / 2 + 0.004, Y, bottom + 0.004), V(w / 2 - 0.004, Y, bottom + 0.004));
      rings.push(ring);
    }
    add(loft(rings, { capEnd: true }), ebonyMat, { name: 'fingerboard' });
  }

  // finger tapes (hidden until the fingerboard chapter)
  const tapes = [0.34, 0.64, 0.8, 1.07].map((d) => {
    const Y = NUT_Y - d;
    const w = 0.24 + 0.18 * (d / (NUT_Y - FB_END_Y)) + 0.004;
    const g = new THREE.PlaneGeometry(w, 0.032, 24, 1);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      p.setZ(i, zFB(Y) - FB_K * x * x + 0.0016);
      p.setY(i, Y + p.getY(i));
    }
    g.computeVertexNormals();
    const m = add(g, tapeMat, { cast: false });
    m.scale.x = 0.0001;
    return m;
  });

  // ---- nut ----
  {
    const m = add(new RoundedBoxGeometry(0.245, 0.03, 0.034, 2, 0.007), ebonyMat, { name: 'nut' });
    m.position.set(0, NUT_Y + 0.014, zFB(NUT_Y) - 0.009);
  }

  // ---- pegbox ----
  // Two tapered cheeks and a curved back, lofted so the edges stay soft.
  const pegbox = new THREE.Group();
  {
    const Y0 = 4.855, Y1 = 5.6;
    const front = (Y) => 0.056 - 0.075 * ((Y - Y0) / (Y1 - Y0));
    const backE = (Y) => -0.2 - 0.075 * Math.pow((Y - Y0) / (Y1 - Y0), 1.2);
    const outer = (Y) => 0.118 - 0.016 * ((Y - Y0) / (Y1 - Y0));
    const cheek = (side) => {
      const rings = [];
      for (let i = 0; i <= 28; i++) {
        const Y = Y0 + ((Y1 - Y0) * i) / 28;
        const xo = outer(Y), t = 0.034;
        const zf = front(Y), zb = backE(Y);
        const h = zf - zb, cz = (zf + zb) / 2;
        rings.push(roundedRect(t, h, 0.012, 3).map(([x, z]) => V(side * (xo - t / 2 + x), Y, cz + z)));
      }
      return loft(rings, { capStart: true, capEnd: true });
    };
    pegbox.add(new THREE.Mesh(cheek(1), mapleMat), new THREE.Mesh(cheek(-1), mapleMat));
    const rings = [];
    for (let i = 0; i <= 28; i++) {
      const Y = Y0 + ((Y1 - Y0) * i) / 28;
      const w = 2 * (outer(Y) - 0.02);
      const zb = backE(Y);
      rings.push(roundedRect(w, 0.05, 0.016, 3).map(([x, z]) => V(x, Y, zb + 0.025 + z)));
    }
    pegbox.add(new THREE.Mesh(loft(rings, { capStart: true, capEnd: true }), mapleMat));
    pegbox.children.forEach((m) => { m.castShadow = m.receiveShadow = true; });
    group.add(pegbox);
  }

  // ---- scroll ----
  // The volute widens toward the eyes, and its outer turn carries the fluted throat.
  const SC = { y: 5.725, z: -0.12 };
  {
    const r0 = 0.236, turns = 2.15, b = Math.log(r0 / 0.04) / (turns * Math.PI * 2);
    const a0 = Math.atan2(-0.15, -0.17);
    const section = (W, T, flute) => {
      const r = Math.min(0.013, T * 0.28);
      const pts = [];
      const arc = (cx, cy, from, to) => { for (let i = 0; i <= 3; i++) { const a = from + ((to - from) * i) / 3; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
      arc(W / 2 - r, -r, 0, Math.PI / 2);
      for (let i = 1; i < 14; i++) {
        const x = W / 2 - r - ((W - 2 * r) * i) / 14;
        const u = x / (W / 2);
        pts.push([x, -flute * Math.exp(-Math.pow((Math.abs(u) - 0.5) / 0.2, 2))]);
      }
      arc(-W / 2 + r, -r, Math.PI / 2, Math.PI);
      arc(-W / 2 + r, -T + r, Math.PI, Math.PI * 1.5);
      arc(W / 2 - r, -T + r, Math.PI * 1.5, Math.PI * 2);
      return pts;
    };
    const rings = [];
    const steps = 170;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const da = t * turns * Math.PI * 2;
      const a = a0 + da;
      const r = r0 * Math.exp(-b * da);
      const W = 0.214 + 0.13 * Math.pow(t, 1.15);
      const T = 0.562 * r + 0.004;
      const flute = 0.013 * Math.max(0, 1 - t / 0.42);
      const cy = Math.cos(a), cz = Math.sin(a);
      rings.push(section(W, T, flute).map(([x, off]) => {
        const rr = r + off;
        return V(x, SC.y + cy * rr, SC.z + cz * rr);
      }));
    }
    add(loft(rings, { capEnd: true }), mapleMat, { name: 'scroll' });
    const eyeGeo = new THREE.CylinderGeometry(0.044, 0.044, 0.352, 36);
    const eye = add(eyeGeo, mapleMat);
    eye.rotation.z = Math.PI / 2;
    eye.position.set(0, SC.y, SC.z);
  }

  // ---- pegs ----
  const pegs = [];
  const PEGS = [
    { name: 'G', side: -1, y: 4.99 }, { name: 'D', side: -1, y: 5.28 },
    { name: 'A', side: 1, y: 5.28 }, { name: 'E', side: 1, y: 4.99 },
  ];
  {
    const prof = [[0, -0.135], [0.011, -0.132], [0.014, -0.11], [0.019, 0.1], [0.026, 0.118], [0.034, 0.124], [0.036, 0.14], [0.03, 0.146], [0.026, 0.158], [0.03, 0.17]]
      .map(([r, y]) => new THREE.Vector2(r, y));
    const shaftGeo = new THREE.LatheGeometry(prof, 24);
    const headGeo = new THREE.SphereGeometry(1, 28, 18);
    headGeo.scale(0.088, 0.07, 0.026);
    headGeo.translate(0, 0.232, 0);
    const pipGeo = new THREE.SphereGeometry(0.009, 12, 8);
    pipGeo.translate(0, 0.312, 0);
    const collarGeo = new THREE.TorusGeometry(0.032, 0.004, 8, 24);
    collarGeo.rotateX(Math.PI / 2);
    collarGeo.translate(0, 0.142, 0);
    for (const p of PEGS) {
      const g = new THREE.Group();
      const shaft = new THREE.Mesh(shaftGeo, ebonyMat);
      const head = new THREE.Mesh(headGeo, ebonyMat);
      const pip = new THREE.Mesh(pipGeo, boneMat);
      const collar = new THREE.Mesh(collarGeo, boneMat);
      const spin = new THREE.Group();
      spin.add(shaft, head, pip, collar);
      spin.children.forEach((m) => { m.castShadow = true; m.receiveShadow = true; });
      g.add(spin);
      g.rotation.z = p.side > 0 ? -Math.PI / 2 : Math.PI / 2;
      g.position.set(0, p.y, -0.085);
      spin.rotation.y = p.side * 0.5;
      group.add(g);
      pegs.push({ ...p, group: g, spin });
    }
  }

  // ---- bridge ----
  {
    const R = [
      [0.0, 0.052], [0.055, 0.047], [0.098, 0.027], [0.118, 0.004], [0.12, 0], [0.212, 0], [0.212, 0.012],
      [0.2, 0.036], [0.168, 0.07], [0.138, 0.098], [0.134, 0.122], [0.15, 0.148], [0.182, 0.172], [0.204, 0.21],
      [0.207, 0.255],
    ];
    const topArc = [];
    for (let i = 0; i <= 16; i++) { const x = 0.198 - (0.198 * i) / 16; topArc.push([x, bridgeTop(x)]); }
    const right = [...R, ...topArc];
    const left = right.slice(1, -1).reverse().map(([x, h]) => [-x, h]);
    // left side needs its own top heights (the G side sits higher)
    const leftFixed = left.map(([x, h]) => (h > 0.28 ? [x, bridgeTop(x)] : [x, h]));
    const shape = new THREE.Shape([...right, ...leftFixed].map(([x, y]) => new THREE.Vector2(x, y)));
    const heart = new THREE.Path();
    heart.moveTo(0, 0.118);
    heart.bezierCurveTo(0.03, 0.15, 0.04, 0.2, 0.012, 0.208);
    heart.bezierCurveTo(0.004, 0.21, 0, 0.2, 0, 0.196);
    heart.bezierCurveTo(0, 0.2, -0.004, 0.21, -0.012, 0.208);
    heart.bezierCurveTo(-0.04, 0.2, -0.03, 0.15, 0, 0.118);
    shape.holes.push(heart);
    for (const s of [-1, 1]) {
      const k = new THREE.Path();
      k.absellipse(s * 0.088, 0.218, 0.036, 0.011, 0, Math.PI * 2, false, s * 0.32);
      shape.holes.push(k);
    }
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.003, bevelSegments: 2, curveSegments: 24 });
    g.rotateX(Math.PI / 2);
    const m = add(g, bridgeMat, { name: 'bridge' });
    m.position.set(0, BRIDGE_Y + 0.018, BRIDGE_BASE);
  }

  // ---- tailpiece, fine tuners, saddle, gut, end button ----
  const tail = new THREE.Group();
  const tuners = [];
  {
    const s = new THREE.Shape();
    s.moveTo(-0.2, -0.02);
    s.quadraticCurveTo(0, 0.04, 0.2, -0.02);
    s.bezierCurveTo(0.2, -0.25, 0.122, -0.74, 0.105, -0.97);
    s.quadraticCurveTo(0, -1.05, -0.105, -0.97);
    s.bezierCurveTo(-0.122, -0.74, -0.2, -0.25, -0.2, -0.02);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.034, bevelEnabled: true, bevelThickness: 0.013, bevelSize: 0.012, bevelSegments: 4, curveSegments: 32 });
    const m = new THREE.Mesh(g, ebonyMat);
    m.castShadow = m.receiveShadow = true;
    tail.add(m);
    // fret (the ridge strings pass over)
    const fret = new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.02, 0.02, 2, 0.006), boneMat);
    fret.position.set(0, -0.005, 0.05);
    tail.add(fret);
    STRINGS.forEach((st) => {
      const t = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.019, 0.026, 18), blackMetal);
      body.rotation.x = Math.PI / 2;
      body.position.set(0, -0.08, 0.06);
      const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.05, 16), metalMat);
      screw.rotation.x = Math.PI / 2;
      screw.position.set(0, -0.125, 0.07);
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.012, 20), metalMat);
      knob.rotation.x = Math.PI / 2;
      knob.position.set(0, -0.125, 0.098);
      const lever = new THREE.Mesh(new RoundedBoxGeometry(0.012, 0.07, 0.012, 1, 0.004), metalMat);
      lever.position.set(0, -0.05, 0.078);
      lever.rotation.x = -0.35;
      t.add(body, screw, knob, lever);
      t.children.forEach((c) => { c.castShadow = true; });
      t.position.x = st.tail;
      tail.add(t);
      tuners.push({ group: t, knob });
    });
    tail.position.set(0, 1.135, 0.315);
    tail.rotation.x = 0.107;
    group.add(tail);
    tail.updateMatrix();

    const saddle = add(new RoundedBoxGeometry(0.32, 0.03, 0.045, 2, 0.008), ebonyMat);
    saddle.position.set(0, 0.012, RIB + 0.012);

    const btn = new THREE.LatheGeometry([[0.0, 0], [0.068, 0], [0.068, -0.012], [0.036, -0.022], [0.038, -0.05], [0.05, -0.068], [0.046, -0.088], [0.02, -0.098], [0, -0.1]].map(([r, y]) => new THREE.Vector2(r, y)), 28);
    const eb = add(btn, ebonyMat);
    eb.position.set(0, -0.004, 0);
    const pip = add(new THREE.SphereGeometry(0.012, 12, 8), boneMat);
    pip.position.set(0, -0.104, 0);

    const tailBottom = V(0, -0.98, 0.0).applyMatrix4(tail.matrix);
    const gut = new THREE.CatmullRomCurve3([
      V(-0.03, tailBottom.y + 0.02, tailBottom.z + 0.01), V(-0.025, 0.06, 0.215), V(-0.02, 0.02, RIB + 0.04),
      V(-0.03, -0.02, 0.06), V(-0.04, -0.035, 0), V(0, -0.04, -0.045), V(0.04, -0.035, 0), V(0.03, -0.02, 0.06),
      V(0.02, 0.02, RIB + 0.04), V(0.025, 0.06, 0.215), V(0.03, tailBottom.y + 0.02, tailBottom.z + 0.01),
    ]);
    add(new THREE.TubeGeometry(gut, 80, 0.0065, 8, false), gutMat);
  }

  // ---- chinrest ----
  {
    const s = new THREE.Shape();
    s.moveTo(-0.17, 0.0);
    s.bezierCurveTo(-0.17, 0.12, 0.05, 0.135, 0.125, 0.085);
    s.bezierCurveTo(0.19, 0.035, 0.175, -0.1, 0.065, -0.1);
    s.bezierCurveTo(-0.015, -0.1, -0.04, -0.055, -0.1, -0.07);
    s.bezierCurveTo(-0.15, -0.082, -0.17, -0.05, -0.17, 0.0);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.022, bevelSize: 0.02, bevelSegments: 5, curveSegments: 40 });
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i);
      if (z > 0.045) {
        const x = p.getX(i), y = p.getY(i);
        const r2 = (x * x) / 0.019 + ((y - 0.01) * (y - 0.01)) / 0.008;
        p.setZ(i, z - 0.034 * Math.max(0, 1 - r2));
      }
    }
    g.computeVertexNormals();
    const m = add(g, ebonyMat, { name: 'chinrest' });
    m.position.set(-0.47, 0.29, 0.2);
    m.rotation.z = 0.32;
  }

  // ---- strings ----
  tail.updateMatrixWorld(true);
  const strings = STRINGS.map((st, i) => {
    const nutP = V(st.nut, NUT_Y + 0.012, zFB(NUT_Y) + 0.0085);
    const brP = V(st.bridge, BRIDGE_Y + 0.003, BRIDGE_BASE + bridgeTop(st.bridge) + 0.002);
    const hook = V(0, -0.05, 0.088).applyMatrix4(new THREE.Matrix4().makeTranslation(st.tail, 0, 0)).applyMatrix4(tail.matrix);
    const peg = PEGS.find((p) => p.name === st.name);
    const wind = V(peg.side * (i === 0 || i === 3 ? 0.035 : -0.02), peg.y, -0.07);

    const uniforms = { uAmp: { value: 0 }, uPhase: { value: 0 }, uGlow: { value: 0 } };
    const mat = new THREE.MeshStandardMaterial({ color: st.color, metalness: 1, roughness: 0.26 });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uAmp;\nuniform float uPhase;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float sv = sin(3.14159265 * uv.x);
          transformed.x += uAmp * sv * sin(uPhase);
          transformed.z += uAmp * 0.3 * sv * cos(uPhase * 1.013);`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uGlow;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.74, 0.4) * uGlow;');
    };
    const vib = add(new THREE.TubeGeometry(new THREE.LineCurve3(nutP, brP), 120, st.r, 6, false), mat, { receive: false });
    const plain = new THREE.MeshStandardMaterial({ color: st.color, metalness: 1, roughness: 0.3 });
    add(new THREE.TubeGeometry(new THREE.LineCurve3(brP, hook), 6, st.r, 6, false), plain, { receive: false });
    add(new THREE.TubeGeometry(new THREE.LineCurve3(nutP, wind), 6, st.r, 6, false), plain, { receive: false });
    // silk wrapping just above the tailpiece
    const silkA = hook.clone().lerp(brP, 0.08), silkB = hook.clone().lerp(brP, 0.2);
    add(new THREE.TubeGeometry(new THREE.LineCurve3(silkA, silkB), 4, st.r * 1.6, 6, false), new THREE.MeshStandardMaterial({ color: st.silk, roughness: 0.8 }), { receive: false });
    return { ...st, index: i, mesh: vib, uniforms, a: nutP, b: brP, amp: 0, phase: Math.random() * 6, speed: 0 };
  });

  // ---- light through the f-holes (seen from inside) ----
  const shaftUniforms = { uOpacity: { value: 0 } };
  const shaftMat = new THREE.ShaderMaterial({
    uniforms: shaftUniforms,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `attribute float aH; varying float vH; varying float vFacing;
      void main(){ vH = aH; vec4 mv = modelViewMatrix * vec4(position,1.0);
        vec3 n = normalize(normalMatrix * normal); vFacing = abs(dot(n, normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uOpacity; varying float vH; varying float vFacing;
      void main(){ float a = uOpacity * pow(1.0 - vH, 2.0) * pow(vFacing, 2.5) * 0.3; gl_FragColor = vec4(vec3(1.0, 0.78, 0.48) * a, a); }`,
  });
  const fholes = [fholeScene(-1), fholeScene(1)];
  const ld = lightDir.clone().normalize();
  for (const f of fholes) {
    const pos = [], h = [], idx = [];
    const n = f.poly.length;
    f.poly.forEach(([x, y]) => {
      const z0 = topZ(x, y);
      const drop = z0 - (backZ(x, y) + 0.01);
      const k = drop / Math.max(0.2, -ld.z);
      pos.push(x, y, z0, x + ld.x * k, y + ld.y * k, z0 + ld.z * k);
      h.push(0, 1);
    });
    for (let i = 0; i < n; i++) {
      const a = 2 * i, b = a + 1, c = (2 * (i + 1)) % (2 * n), d = c + 1;
      idx.push(a, b, c, c, b, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aH', new THREE.Float32BufferAttribute(h, 1));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, shaftMat);
    m.renderOrder = 10;
    group.add(m);
  }

  // f-hole walls, so the cut has thickness when you pass through it
  for (const f of fholes) {
    const pos = [], idx = [];
    const n = f.poly.length;
    f.poly.forEach(([x, y]) => { const z = topZ(x, y); pos.push(x, y, z + 0.002, x, y, z - 0.028); });
    for (let i = 0; i < n; i++) {
      const a = 2 * i, b = a + 1, c = (2 * (i + 1)) % (2 * n), d = c + 1;
      idx.push(a, b, c, c, b, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    add(g, new THREE.MeshStandardMaterial({ map: rawTex, color: 0x4a2a14, roughness: 0.9, side: THREE.DoubleSide }), { cast: false });
  }

  return {
    group, strings, pegs, tapes, tuners, ripples, shaftUniforms, fholes,
    anchors: {
      scroll: V(0, SC.y, SC.z), post: V(POST.x, POST.y, 0),
      bridge: V(0, BRIDGE_Y, BRIDGE_BASE + 0.18),
    },
  };
}
