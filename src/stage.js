// Renderer, lights, haze, rosin dust and the final film pass.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export const KEY_POS = new THREE.Vector3(3.3, 6.4, 5.0);
export const KEY_TARGET = new THREE.Vector3(0, 2.5, 0);

const FilmShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: 0.055 },
    uVignette: { value: 0.9 },
    uFade: { value: 1 },
    uAspect: { value: 1 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uGrain, uVignette, uFade, uAspect; varying vec2 vUv;
    float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    void main(){
      vec2 c = vUv - 0.5;
      float r = length(c * vec2(uAspect, 1.0));
      // a touch of lateral colour at the edges, like an old lens
      vec2 off = c * 0.0025 * r;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      float vig = smoothstep(1.15, 0.25, r * uVignette);
      col *= mix(0.55, 1.0, vig);
      float g = hash(vUv * 1000.0 + fract(uTime * 7.31)) - 0.5;
      col += g * uGrain * (0.6 + 0.4 * (1.0 - dot(col, vec3(0.333))));
      gl_FragColor = vec4(col * uFade, 1.0);
    }`,
};

function makeDust(count) {
  const geo = new THREE.BufferGeometry();
  const p = new Float32Array(count * 3), s = new Float32Array(count), ph = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    p[i * 3] = Math.random(); p[i * 3 + 1] = Math.random(); p[i * 3 + 2] = Math.random();
    s[i] = Math.pow(Math.random(), 2.2);
    ph[i] = Math.random() * 6.283;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(s, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
  const uniforms = {
    uTime: { value: 0 }, uCentre: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(3.2, 3.2, 3.2) },
    uLightPos: { value: KEY_POS.clone() }, uLightDir: { value: KEY_TARGET.clone().sub(KEY_POS).normalize() },
    uSwirl: { value: 0 }, uPixel: { value: 1 }, uOpacity: { value: 1 }, uInside: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aSize; attribute float aPhase;
      uniform float uTime, uSwirl, uPixel, uInside; uniform vec3 uCentre, uBox, uLightPos, uLightDir;
      varying float vLit; varying float vTw;
      void main(){
        vec3 drift = vec3(sin(uTime * 0.05 + aPhase) * 0.02, uTime * 0.012 + aPhase * 0.01, cos(uTime * 0.04 + aPhase) * 0.02);
        vec3 q = position + drift / uBox;
        q.x += sin(q.y * 9.0 + uTime * 0.3 + aPhase) * 0.004 * (1.0 + uSwirl * 6.0);
        q.z += cos(q.x * 7.0 + uTime * 0.27) * 0.004 * (1.0 + uSwirl * 6.0);
        vec3 box = uBox * mix(1.0, 0.22, uInside);
        vec3 w = (fract(q - uCentre / box) - 0.5) * box + uCentre;
        vec4 mv = modelViewMatrix * vec4(w, 1.0);
        gl_Position = projectionMatrix * mv;
        vec3 L = normalize(w - uLightPos);
        float cone = smoothstep(0.86, 0.97, dot(L, uLightDir));
        vLit = 0.18 + cone * 1.2 + uInside * 0.6;
        vTw = 0.55 + 0.45 * sin(uTime * (0.6 + aSize * 1.4) + aPhase * 3.0);
        float size = (0.004 + aSize * 0.011) * mix(1.0, 0.35, uInside);
        float fadeNear = smoothstep(0.03, 0.25, -mv.z);
        gl_PointSize = fadeNear <= 0.0 ? 0.0 : min(26.0 * uPixel, size * uPixel * 900.0 / max(0.05, -mv.z));
        vLit *= fadeNear;
      }`,
    fragmentShader: `
      uniform float uOpacity; varying float vLit; varying float vTw;
      void main(){
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        float a = smoothstep(0.5, 0.0, d);
        a = a * a * vLit * vTw * uOpacity * 0.5;
        gl_FragColor = vec4(vec3(1.0, 0.86, 0.62) * a, a);
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 20;
  return { pts, uniforms };
}

function makeBackdrop() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uInside: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uInside; varying vec3 vDir;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
      void main(){
        vec3 base = vec3(0.012, 0.009, 0.008);
        float up = smoothstep(-0.2, 0.9, vDir.y);
        float front = smoothstep(-0.3, 1.0, dot(vDir, normalize(vec3(0.35, 0.55, 0.75))));
        vec3 haze = vec3(0.05, 0.03, 0.018) * pow(front, 2.0) * (0.4 + 0.6 * up);
        vec3 col = base + haze * (1.0 - uInside);
        col += (hash(vDir * 400.0) - 0.5) / 255.0;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(40, 48, 24), mat);
}

function makeBeam() {
  const len = KEY_POS.distanceTo(KEY_TARGET) * 1.15;
  const geo = new THREE.ConeGeometry(Math.tan(0.46) * len, len, 64, 1, true);
  geo.translate(0, -len / 2, 0);
  const uniforms = { uOpacity: { value: 0.05 }, uLen: { value: len } };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV;
      void main(){ vY = position.y; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uOpacity, uLen; varying float vY; varying vec3 vN; varying vec3 vV;
      void main(){ float t = clamp(-vY / uLen, 0.0, 1.0); float edge = pow(abs(dot(vN, vV)), 1.5);
        float a = uOpacity * edge * smoothstep(0.0, 0.25, t) * (1.0 - t * 0.7);
        gl_FragColor = vec4(vec3(1.0, 0.8, 0.55) * a, a); }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(KEY_POS);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), KEY_TARGET.clone().sub(KEY_POS).normalize());
  m.renderOrder = 5;
  return { mesh: m, uniforms };
}

export function createStage(canvas, { mobile = false, lowPower = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
  const maxDpr = lowPower ? 1 : mobile ? 1.5 : 1.75;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x070504, 0.03);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.24;
  scene.add(makeBackdrop());

  const camera = new THREE.PerspectiveCamera(30, 1, 0.02, 80);

  // key light: a theatre spot from above and in front
  const key = new THREE.SpotLight(0xffd3a3, 210, 0, 0.5, 0.75, 2);
  key.position.copy(KEY_POS);
  key.target.position.copy(KEY_TARGET);
  key.castShadow = true;
  key.shadow.mapSize.set(lowPower ? 1024 : 2048, lowPower ? 1024 : 2048);
  key.shadow.camera.near = 3;
  key.shadow.camera.far = 14;
  key.shadow.bias = -0.00015;
  key.shadow.normalBias = 0.012;
    scene.add(key, key.target);

  // narrow spot used only while inside: sharp light through the f-holes
  const shaft = new THREE.SpotLight(0xffc98f, 0, 0, 0.13, 0.35, 2);
  shaft.position.copy(KEY_POS);
  shaft.target.position.set(0, 1.68, 0);
  shaft.castShadow = true;
  shaft.shadow.mapSize.set(1024, 1024);
  shaft.shadow.camera.near = 4;
  shaft.shadow.camera.far = 10;
  shaft.shadow.bias = -0.0002;
  shaft.shadow.normalBias = 0.004;
  shaft.visible = false;
  scene.add(shaft, shaft.target);

  const rimCool = new THREE.DirectionalLight(0x9fb2ff, 0.75);
  rimCool.position.set(-4, 3.5, -5);
  const rimWarm = new THREE.DirectionalLight(0xffa860, 0.45);
  rimWarm.position.set(4.5, 1.5, -3.5);
  const hemi = new THREE.HemisphereLight(0xffd9b0, 0x120a06, 0.14);
  const inner = new THREE.PointLight(0xffb06a, 0, 1.8, 2);
  inner.position.set(0.05, 1.62, -0.02);
  scene.add(rimCool, rimWarm, hemi, inner);

  const beam = makeBeam();
  scene.add(beam.mesh);
  const dust = makeDust(lowPower ? 600 : mobile ? 1000 : 1800);
  scene.add(dust.pts);

  // post
  const size = new THREE.Vector2();
  renderer.getSize(size);
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: lowPower ? 0 : 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.26, 0.5, 0.84);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const film = new ShaderPass(FilmShader);
  composer.addPass(film);

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    composer.setPixelRatio(renderer.getPixelRatio());
    bloom.setSize(w / 2, h / 2);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    film.uniforms.uAspect.value = w / h;
    dust.uniforms.uPixel.value = renderer.getPixelRatio() * (h / 900);
  }
  resize();

  return {
    renderer, scene, camera, composer, key, shaft, inner, beam, dust, film, bloom, resize,
    lightDir: KEY_TARGET.clone().sub(KEY_POS).normalize(),
  };
}
