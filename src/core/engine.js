// Renderer, scene, camera and small mesh/texture helpers (ported from v1).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Q, TAU, PI, hash2 } from './utils.js';

export { THREE };
export const renderer = new THREE.WebGLRenderer({ antialias: !Q.bloom, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, Q.pr));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

export const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcfe6f0, 45, 180);
export const fovFor = () => innerHeight > innerWidth ? 72 : 58;
export const camera = new THREE.PerspectiveCamera(fovFor(), innerWidth / innerHeight, .1, 900);
export const TIME = { value: 0 };

export const FX = { composer: null };
if (Q.bloom) {
  const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 });
  FX.composer = new EffectComposer(renderer, rt);
  FX.composer.setSize(innerWidth, innerHeight);
  FX.composer.addPass(new RenderPass(scene, camera));
  FX.composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), .4, .55, .92));
  FX.composer.addPass(new OutputPass());
}
export function render() { if (FX.composer) FX.composer.render(); else renderer.render(scene, camera); }
export function onResize() {
  camera.aspect = innerWidth / innerHeight; camera.fov = fovFor(); camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); if (FX.composer) FX.composer.setSize(innerWidth, innerHeight);
}

/* ---------- level root: everything a level builds goes here so it can be disposed ---------- */
export const LVROOT = { g: null };
export function newLevelRoot() {
  if (LVROOT.g) disposeTree(LVROOT.g);
  LVROOT.g = new THREE.Group(); scene.add(LVROOT.g); return LVROOT.g;
}
export function disposeTree(root) {
  root.traverse(o => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    if (o.material) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of ms) { if (m.userData.shared) continue; if (m.map && !m.map.userData.shared) m.map.dispose(); m.dispose(); }
    }
  });
  root.removeFromParent();
}

/* ---------- material + geometry caches (shared, never disposed) ---------- */
const _mc = new Map();
export function std(c, o = {}) {
  const k = c + JSON.stringify(o); let m = _mc.get(k);
  if (!m) { m = new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .85, metalness: 0 }, o)); m.userData.shared = true; _mc.set(k, m); }
  return m;
}
const _gc = new Map();
export const memo = (k, f) => { let g = _gc.get(k); if (!g) { g = f(); g.userData.shared = true; _gc.set(k, g); } return g; };
export const S = (r, w = 12, h = 10) => memo('s' + r + '_' + w + '_' + h, () => new THREE.SphereGeometry(r, w, h));
export const C = (r, l, a = 4, b = 10) => memo('c' + r + '_' + l + '_' + a + '_' + b, () => new THREE.CapsuleGeometry(r, l, a, b));
export const B = (x, y, z) => memo('b' + x + '_' + y + '_' + z, () => new THREE.BoxGeometry(x, y, z));
export const CY = (a, b, h, n = 8) => memo('y' + a + '_' + b + '_' + h + '_' + n, () => new THREE.CylinderGeometry(a, b, h, n));
export function M(geo, mat, x = 0, y = 0, z = 0, parent, shadow = true) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true;
  if (parent) parent.add(m); return m;
}
export function jitter(geo, amt) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = hash2(Math.round(x * 97) + Math.round(z * 131) * 7, Math.round(y * 113)); const f = 1 + (n - .5) * amt;
    p.setXYZ(i, x * f, y * (1 + (n - .5) * amt * .6), z * f);
  }
  geo.computeVertexNormals(); return geo;
}
// gentle wind sway in the vertex shader (trees, grass)
export function windify(mat, amp, base = 0) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = TIME;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
vec3 ip=vec3(0.);
#ifdef USE_INSTANCING
ip=instanceMatrix[3].xyz;
#endif
float wh=max(position.y-${base.toFixed(2)},0.);
float wv=sin(uTime*1.6+ip.x*.31+ip.z*.23)*.65+sin(uTime*2.7+ip.z*.47+ip.x*.11)*.35;
transformed.x+=wv*${amp.toFixed(4)}*wh*wh;
transformed.z+=wv*${(amp * .6).toFixed(4)}*wh*wh;`);
  };
  mat.customProgramCacheKey = () => 'w' + amp + '_' + base; return mat;
}
const dummy = new THREE.Object3D();
export function inst(geo, mat, arr, parent, cast = true, recv = true) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(arr.length, 1)); m.count = arr.length;
  arr.forEach((t, i) => {
    dummy.position.set(t.x, t.y, t.z); dummy.rotation.set(t.rx || 0, t.ry || 0, t.rz || 0);
    if (t.sx !== undefined) dummy.scale.set(t.sx, t.sy, t.sz); else dummy.scale.setScalar(t.s || 1);
    dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); if (t.c) m.setColorAt(i, t.c);
  });
  m.castShadow = cast; m.receiveShadow = recv; m.frustumCulled = false;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  parent.add(m); return m;
}
export const hsl = (h, s, l) => new THREE.Color().setHSL(h, s, l);

/* ---------- canvas textures ---------- */
export function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const radial = (g, w, h, stops) => { const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); stops.forEach(([o, c]) => r.addColorStop(o, c)); g.fillStyle = r; g.fillRect(0, 0, w, h); };
const shared = t => { t.userData.shared = true; return t; };
export const TEX = {
  glow: shared(canvasTex(64, 64, (g, w, h) => radial(g, w, h, [[0, 'rgba(255,255,255,1)'], [.22, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']]))),
  puff: shared(canvasTex(64, 64, (g, w, h) => radial(g, w, h, [[0, 'rgba(255,255,255,.85)'], [.5, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']]))),
  spark: shared(canvasTex(64, 64, (g, w, h) => {
    radial(g, w, h, [[0, '#fff'], [.18, 'rgba(255,240,190,.8)'], [1, 'rgba(255,220,120,0)']]); g.fillStyle = '#fff'; g.beginPath();
    g.moveTo(32, 2); g.lineTo(35, 29); g.lineTo(62, 32); g.lineTo(35, 35); g.lineTo(32, 62); g.lineTo(29, 35); g.lineTo(2, 32); g.lineTo(29, 29); g.closePath(); g.fill();
  })),
  heart: shared(canvasTex(64, 64, g => { g.fillStyle = '#ff4d6d'; g.beginPath(); g.moveTo(32, 56); g.bezierCurveTo(4, 36, 6, 10, 22, 10); g.bezierCurveTo(28, 10, 32, 16, 32, 20); g.bezierCurveTo(32, 16, 36, 10, 42, 10); g.bezierCurveTo(58, 10, 60, 36, 32, 56); g.fill(); })),
  ring: shared(canvasTex(128, 128, g => { g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = 10; g.beginPath(); g.arc(64, 64, 56, 0, TAU); g.stroke(); const r = g.createRadialGradient(64, 64, 0, 64, 64, 60); r.addColorStop(0, 'rgba(255,255,255,.0)'); r.addColorStop(.8, 'rgba(255,255,255,.25)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); })),
  cloud: shared(canvasTex(256, 128, g => { for (let i = 0; i < 26; i++) { const x = 40 + Math.random() * 176, y = 64 + Math.random() * 30 - (Math.abs(x - 128) < 60 ? 14 : 0), r = 16 + Math.random() * 30; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); } })),
  moon: shared(canvasTex(256, 256, (g, w, h) => { radial(g, w, h, [[0, 'rgba(210,222,255,.75)'], [.2, 'rgba(170,190,255,.35)'], [1, 'rgba(120,150,255,0)']]); g.fillStyle = '#fdf7e6'; g.beginPath(); g.arc(128, 128, 30, 0, TAU); g.fill(); })),
};
export const waterNormal = shared((() => {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), img = g.createImageData(N, N), hg = new Float32Array(N * N), W = [];
  for (let i = 0; i < 16; i++) { const kx = Math.round(Math.random() * 14 - 7) || 1, ky = Math.round(Math.random() * 10 - 5); W.push([kx, ky, Math.random() * TAU, .4 + Math.random() * .6]); }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let s = 0; for (const [kx, ky, p, a] of W) s += Math.sin(TAU * (kx * x + ky * y) / N + p) * a / Math.hypot(kx, ky); hg[y * N + x] = s; }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = hg[y * N + (x + 1) % N] - hg[y * N + (x - 1 + N) % N], dy = hg[((y + 1) % N) * N + x] - hg[((y - 1 + N) % N) * N + x];
    const nx = -dx * 10, ny = -dy * 10, l = Math.hypot(nx, ny, 1), i = (y * N + x) * 4;
    img.data[i] = (nx / l * .5 + .5) * 255; img.data[i + 1] = (ny / l * .5 + .5) * 255; img.data[i + 2] = (1 / l * .5 + .5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
})());
export function signTex(text, sub, bg = '#8a5a32') {
  return canvasTex(256, 110, g => {
    g.fillStyle = bg; g.fillRect(0, 0, 256, 110); g.strokeStyle = '#3a2410'; g.lineWidth = 10; g.strokeRect(5, 5, 246, 100);
    g.fillStyle = '#fff3d6'; g.textAlign = 'center'; g.font = 'bold 40px Fredoka, Arial'; g.fillText(text, 128, 56);
    if (sub) { g.font = '22px Fredoka, Arial'; g.fillText(sub, 128, 92); }
  });
}
export { PI, TAU };
