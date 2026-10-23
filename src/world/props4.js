// Level 6 props: Meenmutty waterfall, coffee bushes, Edakkal cave carvings, torches,
// cave roof slabs and Mittu's cage on Kaala's rock.
import { THREE, M, S, B, CY, std, TEX, canvasTex, inst, jitter, hsl } from '../core/engine.js';
import { G, P, W } from '../core/state.js';
import { PI, TAU, rand, sr, srnd, clamp } from '../core/utils.js';
import { addOb } from './terrain.js';
import { emit } from './particles.js';
import { makePuppy } from './story.js';

/* ---------- waterfall: a sheet of falling water with foam and spray ---------- */
const fallTex = canvasTex(64, 256, g => {
  g.fillStyle = 'rgba(200,230,255,.55)'; g.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(255,255,255,${rand(.25, .7)})`; g.fillRect(rand(0, 64), rand(0, 256), rand(1, 3), rand(20, 70)); }
});
fallTex.wrapS = fallTex.wrapT = THREE.RepeatWrapping; fallTex.userData.shared = true;
export function waterfall(root, x, z, yTop, yBot, w = 4, ry = 0) {
  const h = yTop - yBot, tex = fallTex.clone(); tex.needsUpdate = true; tex.repeat.set(w / 3, h / 6);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true }));
  m.position.set(x, yBot + h / 2, z); m.rotation.y = ry; root.add(m);
  const foam = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.puff, color: 0xffffff, transparent: true, opacity: .8, depthWrite: false })); foam.scale.set(w * 1.6, 1.6, 1); foam.position.set(x, yBot + .4, z + .3); root.add(foam);
  return { tick(dt, t) { tex.offset.y += dt * 1.6; foam.material.opacity = .65 + Math.sin(t * 7) * .1; if (Math.random() < dt * 6) emit(TEX.puff, new THREE.Vector3(x + rand(-w / 2, w / 2), yBot + .3, z + .5), 1, { color: 0xeaf6ff, size: .7, speed: 1.2, up0: .5, up1: 1.2, g: -.5, life: 1.2, grow: 1 }); } };
}

/* ---------- coffee bushes (glossy dark leaves, red coffee cherries) in rows ---------- */
export function coffeeRows(root, pts) {
  const bush = jitter(new THREE.IcosahedronGeometry(1, 1), .3), cherry = new THREE.SphereGeometry(.05, 6, 5);
  const Bs = [], Cs = [];
  for (const p of pts) {
    const s = sr(.55, .8), y = W.height(p.x, p.z);
    Bs.push({ x: p.x, y: y + s * .7, z: p.z, ry: sr(0, TAU), sx: s * .9, sy: s * 1.2, sz: s * .9, c: hsl(sr(.27, .33), sr(.45, .6), sr(.16, .22)) });
    for (let k = 0; k < 6; k++) { const a = sr(0, TAU), e = sr(-.2, .6); Cs.push({ x: p.x + Math.cos(a) * s * .85, y: y + s * .7 + e * s, z: p.z + Math.sin(a) * s * .85, s: 1, c: srnd() < .7 ? hsl(.0, .8, .38) : hsl(.33, .6, .35) }); }
  }
  inst(bush, std(0xffffff, { flatShading: true, roughness: .5 }), Bs, root, true, true);
  inst(cherry, std(0xffffff, { roughness: .35 }), Cs, root, false, false);
}

/* ---------- Edakkal petroglyphs: carved people, animals and sun signs, glowing faintly ---------- */
const glyphTex = canvasTex(256, 160, g => {
  g.fillStyle = 'rgba(0,0,0,0)'; g.fillRect(0, 0, 256, 160); g.strokeStyle = 'rgba(255,220,160,.95)'; g.lineWidth = 4; g.lineCap = 'round';
  const man = (x, y, s) => { g.beginPath(); g.arc(x, y - 18 * s, 6 * s, 0, TAU); g.moveTo(x, y - 12 * s); g.lineTo(x, y + 8 * s); g.moveTo(x - 12 * s, y - 6 * s); g.lineTo(x + 12 * s, y - 6 * s); g.moveTo(x, y + 8 * s); g.lineTo(x - 8 * s, y + 22 * s); g.moveTo(x, y + 8 * s); g.lineTo(x + 8 * s, y + 22 * s); g.stroke(); };
  man(40, 70, 1.2); man(90, 80, 1); man(210, 75, 1.1);
  g.beginPath(); g.arc(150, 50, 18, 0, TAU); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.moveTo(150 + Math.cos(a) * 22, 50 + Math.sin(a) * 22); g.lineTo(150 + Math.cos(a) * 32, 50 + Math.sin(a) * 32); } g.stroke();
  g.beginPath(); g.moveTo(110, 130); g.lineTo(170, 130); g.lineTo(180, 115); g.moveTo(120, 130); g.lineTo(115, 150); g.moveTo(160, 130); g.lineTo(165, 150); g.moveTo(170, 130); g.lineTo(190, 125); g.stroke();   // an animal
  g.beginPath(); g.rect(20, 120, 40, 28); g.moveTo(20, 134); g.lineTo(60, 134); g.moveTo(40, 120); g.lineTo(40, 148); g.stroke();   // grid sign
});
glyphTex.userData.shared = true;
export function carvings(root, x, z, ry, s = 1) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2 * s, 2 * s), new THREE.MeshBasicMaterial({ map: glyphTex, transparent: true, depthWrite: false, opacity: .8, side: THREE.DoubleSide }));
  m.position.set(x, W.height(x, z) + 1.8 * s, z); m.rotation.y = ry; root.add(m);
  return { tick(dt, t) { m.material.opacity = .55 + .25 * Math.sin(t * 1.2 + x); } };
}

/* ---------- torch on a pole (only some carry a real light, to stay fast on phones) ---------- */
export function torch(root, x, z, light = false) {
  const y = W.height(x, z), g = new THREE.Group(); g.position.set(x, y, z); root.add(g);
  M(CY(.05, .07, 1.6, 6), std(0x4a2e18), 0, .8, 0, g); M(CY(.12, .08, .2, 8), std(0x3a3a3a, { metalness: .5 }), 0, 1.65, 0, g);
  const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xff9a40, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); fl.position.y = 1.85; fl.scale.setScalar(.9); g.add(fl);
  let pl = null; if (light) { pl = new THREE.PointLight(0xff9a50, 2.4, 13, 1.5); pl.position.y = 2; g.add(pl); }
  addOb(x, z, .15);
  return { tick(dt, t) { const f = .8 + Math.sin(t * 13 + x) * .12 + Math.sin(t * 7.7 + z) * .08; fl.scale.setScalar(.8 * f + .2); if (pl) pl.intensity = 2.4 * f; if (Math.random() < dt * 3) emit(TEX.glow, new THREE.Vector3(x, y + 1.9, z), 1, { add: true, color: 0xffa040, size: .2, speed: .3, up0: 1, up1: 1.6, g: .4, life: .6 }); } };
}

/* ---------- big rock slabs overhead, so the gorge feels like a cave ---------- */
export function caveRoof(root, pathX, z0, z1, h = 9) {
  const m = std(0x2a221c, { flatShading: true, roughness: 1 });
  for (let z = z0; z > z1; z -= sr(4, 6.5)) {
    if (srnd() < .22) continue;                   // gaps let thin beams of light in
    const x = pathX(z), y = W.height(x, z) + h + sr(-1, 1.5);
    const r = M(jitter(new THREE.BoxGeometry(sr(16, 22), sr(1.5, 2.5), sr(4, 6.5), 3, 1, 2), .2), m, x + sr(-2, 2), y, z, root, false);
    r.rotation.set(sr(-.08, .08), sr(-.2, .2), sr(-.08, .08));
    if (srnd() < .5) for (let k = 0; k < 3; k++) M(new THREE.ConeGeometry(sr(.2, .4), sr(1, 2.2), 6), m, x + sr(-5, 5), y - 1.6, z + sr(-2, 2), root, false).rotation.x = PI;   // stalactites
  }
}
export function lightBeam(root, x, z, h = 10) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(.35, .9, h, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe0b0, transparent: true, opacity: .04, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  m.position.set(x, W.height(x, z) + h / 2, z); root.add(m); return m;
}

/* ---------- Mittu locked in Kaala's cage, high on a rock ---------- */
export function mittuCage(root, x, z) {
  const y = W.height(x, z), g = new THREE.Group(); g.position.set(x, y, z); root.add(g);
  const bm = std(0x5a4a3a, { roughness: .7, metalness: .3 }); const bars = [];
  M(B(1.1, .08, 1.1), bm, 0, .04, 0, g); const top = M(B(1.1, .08, 1.1), bm, 0, 1, 0, g); bars.push(top);
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) { bars.push(M(CY(.02, .02, 1, 5), bm, -.5 + i * .2, .5, s * .5, g)); bars.push(M(CY(.02, .02, 1, 5), bm, s * .5, .5, -.5 + i * .2, g)); }
  const lock = M(B(.16, .2, .08), std(0xc9a020, { metalness: .7, roughness: .3 }), 0, .55, .55, g); bars.push(lock);
  const pup = makePuppy(0x3a8ad8); pup.root.position.y = .08; g.add(pup.root);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0x8ad0ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .5 })); glow.position.y = .5; glow.scale.setScalar(2); g.add(glow);
  return { g, pup, bars, open: false, vel: bars.map(() => new THREE.Vector3(rand(-3, 3), rand(3, 6), rand(-3, 3))) };
}
