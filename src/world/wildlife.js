// Animals and plants for the Nature Book: mugger crocodile, gaur, otters, king cobra, Arogyapacha herb,
// oriental darter, whistling thrush, giant squirrel on a branch, and a viewpoint telescope.
import { THREE, M, S, C, B, CY, std, TEX } from '../core/engine.js';
import { G, P, W } from '../core/state.js';
import { PI, TAU, rand, sr, damp, angDamp, clamp } from '../core/utils.js';
import { tone } from '../core/audio.js';
import { makeQuad, animQuad, QUADS } from '../actors/quad.js';
import { makeSquirrel } from './props.js';

const at = (root, x, z, ry = 0, y) => { const g = new THREE.Group(); g.position.set(x, y ?? W.height(x, z), z); g.rotation.y = ry; root.add(g); return g; };

/* ---------- mugger crocodile basking on the shore ---------- */
export function crocodile(root, x, z, ry = 0) {
  const g = at(root, x, z, ry), skin = std(0x4a5a34, { roughness: .9, flatShading: true }), belly = std(0x8a8a5a, { roughness: .9 });
  M(C(.32, 1.4, 4, 10), skin, 0, .28, 0, g).rotation.x = PI / 2;
  const jaw = new THREE.Group(); jaw.position.set(0, .26, .95); g.add(jaw);
  M(B(.36, .14, .9), skin, 0, .05, .4, jaw); const lower = M(B(.32, .08, .85), belly, 0, -.06, .38, jaw);
  for (const s of [-1, 1]) { M(S(.06, 6, 5), std(0xc8a020), s * .14, .16, .05, jaw); }
  for (let i = 0; i < 8; i++) M(new THREE.ConeGeometry(.04, .1, 4), std(0x3a4a28), 0, .44, -.6 + i * .18, g);
  const tail = new THREE.Group(); tail.position.set(0, .26, -.95); g.add(tail); M(new THREE.ConeGeometry(.26, 1.6, 6), skin, 0, 0, -.8, tail).rotation.x = -PI / 2;
  for (const [lx, lz] of [[.3, .5], [-.3, .5], [.3, -.5], [-.3, -.5]]) { const l = M(C(.07, .2, 3, 6), skin, lx, .1, lz, g); l.rotation.z = lx > 0 ? -1 : 1; }
  return { tick(dt, t) { jaw.rotation.x = -Math.max(0, Math.sin(t * .4)) * .35; tail.rotation.y = Math.sin(t * .6) * .15; lower.rotation.x = 0; } };
}

/* ---------- gaur (Indian bison) grazing ---------- */
export const GAUR = { color: 0x2a1e18, belly: 0x3a2c22, dark: 0x111111, legLen: .8, legR: .08, bodyR: .42, bodyL: 1.0, neckLen: .25, neckTilt: .9, headR: .2, snoutL: .18, ears: 'deer', tailX: -1.4, tailN: 2, tailSeg: .2, tailR: .05, hoof: true, horns: true, hump: true, lowerBelly: false, eyeR: .16 };
export function gaur(root, x, z, ry = 0) {
  const q = makeQuad(GAUR); q.root.position.set(x, W.height(x, z), z); q.root.rotation.y = ry; root.add(q.root);
  // white socks
  for (const l of q.legs) M(C(GAUR.legR * .8, .18, 3, 6), std(0xf0ead8), 0, -GAUR.legLen / 2 + .12, 0, l.knee);
  return { q, tick(dt, t) { animQuad(q, dt, 0, Math.sin(t * .3 + x) > -.3 ? 'graze' : 'alert', t, { wag: .2 }); } };
}

/* ---------- otters swimming in circles near the shore, popping up and diving ---------- */
export function otters(root, cx, cz, waterY, n = 3) {
  const L = []; for (let i = 0; i < n; i++) {
    const q = makeQuad({ color: 0x5a4030, belly: 0x9a8060, dark: 0x111111, legLen: .1, legR: .03, bodyR: .1, bodyL: .45, neckLen: .08, neckTilt: .3, headR: .09, snoutL: .05, ears: 'deer', tailX: -1.5, tailN: 3, tailSeg: .12, tailR: .04, eyeR: .2 });
    root.add(q.root); L.push({ q, ph: i * 2.1, r: 2 + i * .6 });
  }
  return { tick(dt, t) { for (const o of L) { const a = t * .5 + o.ph, x = cx + Math.cos(a) * o.r, z = cz + Math.sin(a) * o.r; const bob = Math.sin(t * 2 + o.ph); o.q.root.position.set(x, waterY - .12 + (bob > .7 ? .12 : 0), z); o.q.root.rotation.y = a + PI; animQuad(o.q, dt, 1, 'walk', t, { wag: .5 }); } } };
}

/* ---------- king cobra, hood raised, swaying ---------- */
export function kingCobra(root, x, z, ry = 0) {
  const g = at(root, x, z, ry), skin = std(0x3a3a22, { roughness: .6 }), band = std(0xc8b878, { roughness: .6 });
  for (let i = 0; i < 9; i++) { const a = i / 9 * TAU * 1.3; M(S(.09, 8, 6), i % 3 ? skin : band, Math.cos(a) * (.5 - i * .03), .08, Math.sin(a) * (.5 - i * .03), g).scale.set(1.3, .8, 1.3); }
  const neck = new THREE.Group(); neck.position.set(.45, .1, 0); g.add(neck);
  for (let i = 0; i < 6; i++) M(S(.085 - i * .004, 8, 6), skin, 0, .1 + i * .13, 0, neck);
  const hood = M(S(.2, 10, 8), skin, 0, .78, -.02, neck); hood.scale.set(1.3, 1.1, .3);
  const head = M(S(.08, 8, 6), skin, 0, .92, .08, neck); head.scale.set(1, .7, 1.4);
  for (const s of [-1, 1]) M(S(.015, 5, 4), std(0x111111), s * .04, .95, .16, neck);
  const tongue = M(B(.01, .01, .1), std(0xc02020), 0, .9, .2, neck);
  return { tick(dt, t) { neck.rotation.z = Math.sin(t * 1.4) * .15; neck.rotation.x = Math.sin(t * 1.1) * .08; tongue.visible = Math.sin(t * 6) > .3; } };
}

/* ---------- Arogyapacha: a small herb with a soft glow ---------- */
export function herb(root, x, z) {
  const g = at(root, x, z), lf = std(0x3a8a3a, { roughness: .6, side: THREE.DoubleSide });
  for (let i = 0; i < 7; i++) { const l = M(new THREE.CircleGeometry(.12, 8), lf, 0, .18 + i * .02, 0, g); l.rotation.set(-1.1, i / 7 * TAU, 0); l.translateZ(.12); }
  M(CY(.01, .015, .25, 4), std(0x2a5a2a), 0, .12, 0, g);
  const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0x9aff8a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .5 })); gl.position.y = .3; gl.scale.setScalar(.9); g.add(gl);
  return { tick(dt, t) { gl.material.opacity = .35 + .2 * Math.sin(t * 2 + x); } };
}

/* ---------- oriental darter drying its wings on a perch ---------- */
export function darter(root, x, y, z, ry = 0) {
  const g = at(root, x, z, ry, y), blk = std(0x1a1a1a, { roughness: .8 }), pale = std(0xd8d0c0);
  M(S(.14, 8, 6), blk, 0, .25, 0, g).scale.set(.8, 1.2, 1); const neck = M(CY(.025, .03, .35, 5), pale, 0, .48, .05, g); neck.rotation.x = .3;
  M(S(.05, 6, 5), blk, 0, .65, .1, g); M(new THREE.ConeGeometry(.015, .16, 4), std(0xc8a020), 0, .65, .2, g).rotation.x = PI / 2;
  const wings = [-1, 1].map(s => { const w = new THREE.Group(); w.position.set(s * .1, .32, 0); g.add(w); M(B(.45, .03, .22), blk, s * .22, 0, 0, w); return w; });
  return { tick(dt, t) { wings.forEach((w, i) => w.rotation.z = (i ? -1 : 1) * (.1 + Math.sin(t * 1.5) * .08)); } };
}

/* ---------- Malabar whistling thrush: dark blue bird that whistles ---------- */
export function thrush(root, x, y, z) {
  const g = at(root, x, z, 0, y), blue = std(0x1a2a5a, { roughness: .4, metalness: .2 });
  M(S(.08, 8, 6), blue, 0, .1, 0, g).scale.set(1, .9, 1.4); M(S(.05, 8, 6), blue, 0, .18, .08, g); M(new THREE.ConeGeometry(.012, .05, 4), std(0x111111), 0, .17, .14, g).rotation.x = PI / 2;
  M(B(.05, .01, .12), blue, 0, .1, -.13, g);
  let next = 2;
  return { tick(dt, t) { g.rotation.y = Math.sin(t * .7) * .6; next -= dt; if (next < 0 && Math.hypot(P.pos.x - x, P.pos.z - z) < 25) { next = rand(4, 7); [0, .18, .32, .5].forEach((d, i) => tone({ f0: [1400, 1800, 1600, 2100][i], f1: [1600, 1700, 1900, 1800][i], dur: .14, a: .02, vol: .04, delay: d })); } } };
}

/* ---------- giant squirrel sitting on a high branch ---------- */
export function treeSquirrel(root, x, z, h = 5) {
  const g = at(root, x, z); M(CY(.18, .28, h + 1, 7), std(0x6a4a30), 0, (h + 1) / 2, 0, g);
  const br = M(CY(.06, .1, 1.6, 5), std(0x6a4a30), .7, h, 0, g); br.rotation.z = PI / 2 - .2;
  const s = makeSquirrel(); s.root.position.set(1.1, h + .1, 0); s.root.rotation.y = -PI / 2; g.add(s.root);
  return { y: () => W.height(x, z) + h, tick(dt, t) { s.tail.rotation.x = -.4 + Math.sin(t * 2) * .15; s.head.rotation.y = Math.sin(t * .8) * .5; } };
}

/* ---------- a little viewpoint telescope pointing at a famous peak ---------- */
export function viewpoint(root, x, z, ry) {
  const g = at(root, x, z, ry); M(CY(.05, .07, 1.1, 6), std(0x3a3a3a, { metalness: .5 }), 0, .55, 0, g);
  const scope = M(CY(.07, .1, .5, 10), std(0x2a5a8a, { metalness: .6, roughness: .3 }), 0, 1.15, .1, g); scope.rotation.x = PI / 2 - .2;
  return g;
}
