// Monsoon weather: falling rain around the camera, lightning flashes with thunder,
// Pichu's lantern for night sections, and floating fireflies.
import { THREE, scene, camera, renderer, TEX } from '../core/engine.js';
import { G, P, W } from '../core/state.js';
import { rand, clamp, damp, MOBILE } from '../core/utils.js';
import { AU, tone, nz } from '../core/audio.js';
import { hemi } from './sky.js';
import { pichu } from '../actors/pichu.js';

/* ---------- rain: short vertical streaks that wrap around the camera ---------- */
const N = MOBILE ? 1400 : 3200, BOX = 26, H = 16;
const pos = new Float32Array(N * 6), spd = new Float32Array(N);
for (let i = 0; i < N; i++) { const x = rand(-BOX, BOX), y = rand(0, H), z = rand(-BOX, BOX); pos.set([x, y, z, x, y - .5, z], i * 6); spd[i] = rand(16, 22); }
const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
const mat = new THREE.LineBasicMaterial({ color: 0xaac4dd, transparent: true, opacity: .45, depthWrite: false, fog: false });
const rain = new THREE.LineSegments(geo, mat); rain.frustumCulled = false; rain.visible = false; scene.add(rain);

/* ---------- lantern light carried by Pichu ---------- */
export const lantern = new THREE.PointLight(0xffc86a, 0, 15, 1.2); lantern.position.set(.2, 1.1, .3); pichu.root.add(lantern);
const lanGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xffd080, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 })); lanGlow.position.set(.2, 1.05, .25); lanGlow.scale.setScalar(.5); pichu.root.add(lanGlow);

/* ---------- fireflies (sprites placed by the level) ---------- */
const FLIES = [];
export function addFireflies(root, pts) {
  for (const p of pts) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xfff27a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); s.scale.setScalar(.35); root.add(s); FLIES.push({ s, x: p.x, z: p.z, ph: rand(0, 6.3) }); }
}

export const WX = { rain: 0, night: 0, lightning: true, flash: 0, nextBolt: 8, thunderAt: -1 };
let rainSnd = null;
function rainSound() {
  if (rainSnd || !AU.ctx) return; const ctx = AU.ctx, s = ctx.createBufferSource(); s.buffer = AU.noise; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1200; const g = ctx.createGain(); g.gain.value = 0; s.connect(f).connect(g).connect(AU.master); s.start(); rainSnd = g;
}
export function thunder(delay = 0, big = 1) { nz({ dur: 2.2 * big, vol: .35 * big, filter: ['lowpass', 260], f1: 60, delay, a: .05 }); tone({ f0: 55, f1: 35, dur: 1.6, vol: .12 * big, delay: delay + .05 }); }
export function resetWeather() { WX.rain = 0; WX.night = 0; WX.flash = 0; rain.visible = false; lantern.intensity = 0; lanGlow.material.opacity = 0; FLIES.length = 0; if (rainSnd) rainSnd.gain.value = 0; }

export function updateWeather(dt, t) {
  // rain streaks follow the camera
  rain.visible = WX.rain > .02; mat.opacity = .45 * WX.rain;
  if (rain.visible) {
    const c = camera.position, a = geo.attributes.position.array;
    for (let i = 0; i < N; i++) {
      const o = i * 6; let y = a[o + 1] - spd[i] * dt;
      if (y < -2) { y = H; a[o] = a[o + 3] = rand(-BOX, BOX); a[o + 2] = a[o + 5] = rand(-BOX, BOX); }
      a[o + 1] = y; a[o + 4] = y - .55;
    }
    geo.attributes.position.needsUpdate = true; rain.position.set(c.x, c.y - 6, c.z);
  }
  rainSound(); if (rainSnd) rainSnd.gain.value = damp(rainSnd.gain.value, WX.rain * .09, 2, dt);
  // lightning: bright flash, thunder a moment later
  if (WX.rain > .5 && WX.lightning && G.mode !== 'menu') {
    WX.nextBolt -= dt;
    if (WX.nextBolt < 0) { WX.nextBolt = rand(7, 16); WX.flash = 1; thunder(rand(.4, 1.4), rand(.7, 1.1)); }
  }
  if (WX.flash > 0) { WX.flash -= dt * 2.6; const k = Math.max(0, WX.flash) * (Math.random() < .3 ? .3 : 1); hemi.intensity += k * 2.2; renderer.toneMappingExposure += k * .5; }
  // lantern glows at night
  const li = WX.night * (2.6 + Math.sin(t * 9) * .15); lantern.intensity = damp(lantern.intensity, li, 3, dt); lanGlow.material.opacity = WX.night * .8;
  for (const f of FLIES) { const vis = WX.night > .3; f.s.visible = vis; if (!vis) continue; f.s.position.set(f.x + Math.sin(t * .7 + f.ph) * .6, W.height(f.x, f.z) + 1 + Math.sin(t * 1.3 + f.ph) * .4, f.z + Math.cos(t * .6 + f.ph) * .6); f.s.material.opacity = .5 + .5 * Math.sin(t * 4 + f.ph * 3); }
}
