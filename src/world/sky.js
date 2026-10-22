// Sky dome, clouds, sun/moon, lights and time-of-day blending (ported from v1).
import { THREE, scene, camera, renderer, TIME, TEX } from '../core/engine.js';
import { Q, PI, TAU, rand, lerp, smooth } from '../core/utils.js';

const skyU = { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() }, uSunVis: { value: 1 }, uStars: { value: 0 }, uTime: TIME };
const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vD;void main(){vD=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `uniform vec3 uTop,uHor,uSunCol,uSunDir;uniform float uSunVis,uStars,uTime;varying vec3 vD;
float h3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
void main(){vec3 d=normalize(vD);float y=d.y;
vec3 c=mix(uHor,uTop,pow(clamp(y,0.,1.),.5));
c=mix(c,uHor*.75,smoothstep(0.,-.3,y));
float s=max(dot(d,normalize(uSunDir)),0.);
c+=uSunCol*(pow(s,5.)*.28+pow(s,64.)*.6)*uSunVis;
c+=uSunCol*smoothstep(.9991,.9995,s)*7.*uSunVis;
if(uStars>.01){vec3 p=d*110.;vec3 id=floor(p);float r=h3(id);if(r>.982){vec3 f=fract(p)-.5;float st=smoothstep(.2,.0,length(f));float tw=.55+.45*sin(uTime*2.3+r*91.);c+=vec3(.92,.95,1.)*st*tw*uStars*smoothstep(0.,.12,y)*2.2;}}
gl_FragColor=vec4(c,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`
}));
sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky);
const clouds = [];
for (let i = 0; i < 26; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.cloud, transparent: true, depthWrite: false, fog: false, opacity: .9 }));
  s.userData = { a: rand(0, TAU), r: rand(260, 420), h: rand(70, 150), sp: rand(.004, .01) };
  const sc = rand(110, 190); s.scale.set(sc, sc * .5, 1); s.renderOrder = -9; scene.add(s); clouds.push(s);
}
const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.moon, transparent: true, depthWrite: false, fog: false, opacity: 0, blending: THREE.AdditiveBlending }));
moon.scale.set(150, 150, 1); moon.renderOrder = -8; scene.add(moon);
export const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x5a7a3a, 1.1); scene.add(hemi);
export const sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true; sun.shadow.mapSize.set(Q.shadow, Q.shadow);
{ const sc = sun.shadow.camera; sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 220; sun.shadow.bias = -.0005; sun.shadow.normalBias = .04; }
scene.add(sun, sun.target);

// Time-of-day presets. Kerala versions are a little more humid and hazy than v1.
const ENV_RAW = {
  dawn:      { top: 0x5578c4, hor: 0xffbe94, sun: 0xffc493, sunI: 2.6, hs: 0xffd9c0, hg: 0x4f5a48, hI: 1.0,  fog: 0xf0b9a0, fn: 30, ff: 160, el: 9,  az: 175, stars: .05, night: 0, exp: 1.05, cloud: 0xffc7b0, co: .9, water: 0x6a7fae },
  morning:   { top: 0x4a95dc, hor: 0xdcefe8, sun: 0xfff0d4, sunI: 3.1, hs: 0xd4ecff, hg: 0x5f7f3a, hI: 1.15, fog: 0xd6eae4, fn: 45, ff: 180, el: 30, az: 130, stars: 0, night: 0, exp: 1.0, cloud: 0xffffff, co: .9, water: 0x2f86a3 },
  noon:      { top: 0x2c7fdc, hor: 0xc3e3f4, sun: 0xffffff, sunI: 3.5, hs: 0xd8efff, hg: 0x5f7f3a, hI: 1.2,  fog: 0xc8e4f2, fn: 45, ff: 185, el: 62, az: 160, stars: 0, night: 0, exp: 1.0, cloud: 0xffffff, co: .85, water: 0x2a8ab8 },
  canopy:    { top: 0x3b86c8, hor: 0xb9d9c4, sun: 0xfff3c0, sunI: 2.4, hs: 0xc2e6c8, hg: 0x3f5a2a, hI: 1.0,  fog: 0x9fc6a4, fn: 20, ff: 120, el: 55, az: 150, stars: 0, night: 0, exp: 1.05, cloud: 0xffffff, co: .8, water: 0x2f7a6a },
  golden:    { top: 0x4a64a8, hor: 0xffc58a, sun: 0xffb46a, sunI: 2.9, hs: 0xffd8b0, hg: 0x5a5a3a, hI: 1.05, fog: 0xe0b58f, fn: 28, ff: 150, el: 14, az: 200, stars: 0, night: 0, exp: 1.05, cloud: 0xffcfa0, co: .9, water: 0x5a7a9a },
  peakMist:  { top: 0x6a7fa8, hor: 0xe8c9b8, sun: 0xffa070, sunI: 2.2, hs: 0xe8d8e8, hg: 0x55506a, hI: 1.1,  fog: 0xcab8c0, fn: 14, ff: 95,  el: 6,  az: 205, stars: 0, night: .1, exp: 1.08, cloud: 0xffc0a8, co: .9, water: 0x6a6a8a },
  lake:      { top: 0x3a8ae0, hor: 0xd8ecf4, sun: 0xfff6e0, sunI: 3.3, hs: 0xd8efff, hg: 0x5a7a40, hI: 1.2,  fog: 0xd0e6ee, fn: 50, ff: 210, el: 40, az: 140, stars: 0, night: 0, exp: 1.0, cloud: 0xffffff, co: .9, water: 0x2a7aa8 },
  sunsetGold:{ top: 0x3a4d8f, hor: 0xffa66e, sun: 0xffa560, sunI: 2.6, hs: 0xffc8a2, hg: 0x50456a, hI: 1.05, fog: 0xc48a7a, fn: 24, ff: 130, el: 8,  az: 195, stars: 0, night: 0, exp: 1.05, cloud: 0xffb08a, co: .9, water: 0x5a6a8a },
  teaMorning:{ top: 0x6aa0d8, hor: 0xf0e8d8, sun: 0xffeccc, sunI: 2.9, hs: 0xe8f0ff, hg: 0x5a7a3a, hI: 1.15, fog: 0xe6e8e0, fn: 28, ff: 150, el: 22, az: 120, stars: 0, night: 0, exp: 1.02, cloud: 0xffffff, co: .9, water: 0x4a8aa8 },
  mist:      { top: 0x9ab0c4, hor: 0xe4eaee, sun: 0xf4f0e8, sunI: 1.6, hs: 0xeef2f6, hg: 0x5a6a4a, hI: 1.35, fog: 0xdfe5e8, fn: 6,  ff: 58,  el: 35, az: 150, stars: 0, night: 0, exp: 1.05, cloud: 0xeef2f6, co: .5, water: 0x7a909e },
  highMist:  { top: 0x8aa0b8, hor: 0xd8dee4, sun: 0xffe8d0, sunI: 1.9, hs: 0xe6eaf0, hg: 0x5a5a4a, hI: 1.3,  fog: 0xcfd6dc, fn: 4,  ff: 44,  el: 20, az: 180, stars: 0, night: 0, exp: 1.06, cloud: 0xe6eaf0, co: .4, water: 0x7a909e },
  summit:    { top: 0x2a5aa8, hor: 0xf4d8c0, sun: 0xffc890, sunI: 3.0, hs: 0xf0e0f0, hg: 0x55506a, hI: 1.1,  fog: 0xe8d4cc, fn: 30, ff: 160, el: 10, az: 210, stars: 0, night: 0, exp: 1.04, cloud: 0xffe0c8, co: .95, water: 0x6a7a9a },
  night:     { top: 0x040817, hor: 0x1a2850, sun: 0xa9c0ff, sunI: .95, hs: 0x5a6cb0, hg: 0x1a2030, hI: .6,  fog: 0x131c38, fn: 16, ff: 105, el: 24, az: 182, stars: 1, night: 1, exp: 1.18, cloud: 0x2a3550, co: .35, water: 0x162040 },
};
const COLK = ['top', 'hor', 'sun', 'hs', 'hg', 'fog', 'cloud', 'water'];
export const ENV = {};
for (const n in ENV_RAW) { ENV[n] = {}; for (const k in ENV_RAW[n]) ENV[n][k] = COLK.includes(k) ? new THREE.Color(ENV_RAW[n][k]) : ENV_RAW[n][k]; }
export const CUR = {}; for (const k in ENV.morning) CUR[k] = COLK.includes(k) ? new THREE.Color() : 0;
function blendEnv(a, b, t) { for (const k in CUR) { if (COLK.includes(k)) CUR[k].copy(a[k]).lerp(b[k], t); else CUR[k] = lerp(a[k], b[k], t); } }
// keys: [[z, presetName], ...] from +z (start) to -z (end)
export function envForZ(keys, z) {
  for (let i = 0; i < keys.length - 1; i++) { const [z0, a] = keys[i], [z1, b] = keys[i + 1]; if (z <= z0 && z >= z1) return [ENV[a], ENV[b], smooth(z0, z1, z)]; }
  const lastK = keys[keys.length - 1][1]; return z > keys[0][0] ? [ENV[keys[0][1]], ENV[keys[0][1]], 0] : [ENV[lastK], ENV[lastK], 0];
}
const sunDir = new THREE.Vector3(), _v = new THREE.Vector3();
export const waterMats = [];
export function updateSky(dt, a, b, k, focus) {
  blendEnv(a, b, k);
  const el = CUR.el * PI / 180, az = CUR.az * PI / 180; sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  skyU.uTop.value.copy(CUR.top); skyU.uHor.value.copy(CUR.hor); skyU.uSunCol.value.copy(CUR.sun); skyU.uSunDir.value.copy(sunDir); skyU.uSunVis.value = 1 - CUR.night; skyU.uStars.value = CUR.stars;
  scene.fog.color.copy(CUR.fog); scene.fog.near = CUR.fn; scene.fog.far = CUR.ff;
  sun.color.copy(CUR.sun); sun.intensity = CUR.sunI; hemi.color.copy(CUR.hs); hemi.groundColor.copy(CUR.hg); hemi.intensity = CUR.hI; renderer.toneMappingExposure = CUR.exp;
  sun.position.set(focus.x + sunDir.x * 90, focus.y + sunDir.y * 90, focus.z + sunDir.z * 90); sun.target.position.copy(focus);
  sky.position.copy(camera.position);
  const n = ENV.night; _v.set(Math.cos(n.el * PI / 180) * Math.sin(n.az * PI / 180), Math.sin(n.el * PI / 180), Math.cos(n.el * PI / 180) * Math.cos(n.az * PI / 180));
  moon.position.copy(camera.position).addScaledVector(_v, 500); moon.material.opacity = CUR.night;
  for (const c of clouds) { const u = c.userData; u.a += u.sp * dt; c.position.set(camera.position.x + Math.cos(u.a) * u.r, u.h, camera.position.z + Math.sin(u.a) * u.r); c.material.color.copy(CUR.cloud); c.material.opacity = CUR.co; }
  for (const m of waterMats) m.color.copy(CUR.water);
}
