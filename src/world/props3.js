// Level 5 props: floating teak logs (rideable), broken hanging bridge, sawmill shed, log stacks,
// a big decorative saw blade, and Kaala himself.
import { THREE, M, S, B, CY, std, TEX } from '../core/engine.js';
import { G, P, W } from '../core/state.js';
import { PI, TAU, rand, sr, clamp, lerp } from '../core/utils.js';
import { addOb, addBox } from './terrain.js';
import { emit } from './particles.js';
import { makeHuman } from '../actors/human.js';
import { makePuppy } from './story.js';

const at = (root, x, z, ry = 0, y) => { const g = new THREE.Group(); g.position.set(x, y ?? W.height(x, z), z); g.rotation.y = ry; root.add(g); return g; };

/* ---------- a teak log drifting with the river (you can stand on it) ---------- */
// lane: z of the log's line; x0..x1: the stretch of river it drifts along; speed along +x
export class FloatLog {
  constructor(root, lane, x0, x1, x, speed, len = 3.4) {
    this.z = lane; this.x0 = x0; this.x1 = x1; this.x = x; this.speed = speed; this.len = len; this.hw = len / 2; this.hl = .5; this.dx = 0; this.dz = 0; this.yaw = PI / 2;
    this.sink = 0; this.ph = rand(0, TAU);
    this.g = new THREE.Group(); root.add(this.g);
    const lg = M(CY(.42, .46, len, 12), std(0x7a5432, { roughness: .9 }), 0, 0, 0, this.g); lg.rotation.z = PI / 2;
    for (const s of [-1, 1]) M(CY(.4, .4, .02, 12), std(0xd8b070), s * (len / 2 + .005), 0, 0, this.g).rotation.z = PI / 2;
    M(S(.14, 6, 5), std(0x5f7f3a, { flatShading: true }), .4, .38, .05, this.g).scale.set(2, .5, 1.4);
    W.platforms.push(this); this.top = W.water + .38;
  }
  surface(x, z) { return this.sink < .5 && Math.abs(x - this.x) < this.hw && Math.abs(z - this.z) < this.hl ? this.top : null; }
  update(dt, t) {
    const ox = this.x; this.x += this.speed * dt;
    // near the end of its stretch the log sinks under the rapids, then pops up again upstream
    const end = this.speed > 0 ? this.x > this.x1 : this.x < this.x0;
    if (end) { this.sink += dt * 1.2; if (this.sink > 1.6) { this.sink = 0; this.x = this.speed > 0 ? this.x0 : this.x1; } }
    this.dx = this.sink > 0 ? 0 : this.x - ox; this.dz = 0;
    const bob = Math.sin(t * 1.8 + this.ph) * .05;
    this.top = W.water + .38 + bob - this.sink * .9;
    this.g.position.set(this.x, W.water + .06 + bob - this.sink * .9, this.z); this.g.rotation.x = Math.sin(t * 1.3 + this.ph) * .05;
    // wobble as a warning just before the rapids pull it under
    const toEnd = this.speed > 0 ? this.x1 - this.x : this.x - this.x0; this.g.rotation.z = toEnd < 3 || this.sink > 0 ? Math.sin(t * 22) * .07 : 0;
    if (Math.random() < dt * 2) emit(TEX.puff, new THREE.Vector3(this.x - Math.sign(this.speed) * this.hw, W.water + .05, this.z), 1, { color: 0xe8f6ff, size: .35, speed: .3, g: 0, life: .7 });
  }
}

/* ---------- the famous Nilambur hanging bridge, cut in the middle by the poachers ---------- */
export function brokenBridge(root, x, zN, zS) {
  const wood = std(0x8a6440, { roughness: .9 }), rope = std(0xb8a070, { roughness: 1 }), steel = std(0x7a7a7a, { metalness: .6, roughness: .4 });
  for (const z of [zN, zS]) for (const s of [-1, 1]) { M(B(.3, 4, .3), steel, x + s * 1.3, W.height(x, z) + 2, z, root); }
  const mid = (zN + zS) / 2;
  for (const [z0, z1] of [[zS, mid + 2.5], [zN, mid - 2.5]]) {
    const n = Math.round(Math.abs(z1 - z0) / .45);
    for (let i = 0; i < n; i++) { const k = i / n, z = lerp(z0, z1, k), y = lerp(W.height(x, z0) + 1, W.water + .4, k * k); const p = M(B(2.2, .08, .35), wood, x, y, z, root); p.rotation.x = (z1 - z0) > 0 ? -.25 * k : .25 * k; }
    for (const s of [-1, 1]) { const len = Math.abs(z1 - z0); const r = M(CY(.025, .025, len, 4), rope, x + s * 1.2, W.height(x, z0) + 1.5 - .6, (z0 + z1) / 2, root); r.rotation.x = PI / 2 + ((z1 - z0) > 0 ? -.12 : .12); }
  }
  // dangling planks in the gap
  for (let i = 0; i < 3; i++) { const p = M(B(.35, .08, 1.2), wood, x + sr(-.8, .8), W.water + .2, mid + sr(-2, 2), root); p.rotation.set(1.2, sr(0, 1), 0); }
}

/* ---------- sawmill pieces ---------- */
export function logStack(root, x, z, ry = 0, rows = 3, len = 5) {
  const g = at(root, x, z, ry), m = std(0x8a5a32, { roughness: .9 }), endM = std(0xd8b070, { roughness: .8 });
  for (let r = 0; r < rows; r++) for (let i = 0; i < rows - r + 1; i++) {
    const lx = (i - (rows - r) / 2) * .78, ly = .38 + r * .66;
    const l = M(CY(.38, .4, len, 10), m, lx, ly, 0, g); l.rotation.x = PI / 2;
    for (const s of [-1, 1]) M(CY(.36, .36, .02, 10), endM, lx, ly, s * (len / 2 + .01), g).rotation.x = PI / 2;
  }
  const c = Math.cos(ry), s2 = Math.sin(ry), hw = (rows + 1) * .4, hl = len / 2;
  addOb(x, z, Math.max(hw, hl) * .8); return g;
}
export function sawmillShed(root, x, z, w = 14, l = 8, ry = 0) {
  const g = at(root, x, z, ry), post = std(0x5a3a22), roof = std(0x8a8a86, { metalness: .5, roughness: .5, side: THREE.DoubleSide });
  for (const sx of [-1, 1]) for (let i = 0; i <= 3; i++) M(B(.3, 5, .3), post, sx * w / 2, 2.5, -l / 2 + i * l / 3, g);
  for (const s of [-1, 1]) { const r = M(B(w + 1, .08, l / 2 + .8), roof, 0, 5.4 + .6, s * (l / 4 + .2), g); r.rotation.x = s * .28; }
  M(B(w, .5, 1.4), std(0x3a3a3a, { metalness: .4 }), 0, .9, 0, g);                              // conveyor table
  for (let i = 0; i < 8; i++) M(CY(.1, .1, 1.4, 8), std(0x777777, { metalness: .6 }), -w / 2 + 1 + i * (w - 2) / 7, 1.18, 0, g).rotation.x = PI / 2;
  const blade = new THREE.Group(); blade.position.set(0, 1.6, 0); g.add(blade);
  M(CY(1.1, 1.1, .06, 32), std(0xb8bcc4, { metalness: .9, roughness: .25 }), 0, 0, 0, blade).rotation.x = PI / 2;
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; const tth = M(new THREE.ConeGeometry(.08, .2, 3), std(0xb8bcc4, { metalness: .9 }), Math.cos(a) * 1.15, Math.sin(a) * 1.15, 0, blade); tth.rotation.z = a - PI / 2; }
  M(B(1.6, 1.2, 1.6), std(0x3a5a8a, { roughness: .6 }), 0, 2.9, 0, g);                         // motor housing (blade guard)
  addBox(x - w / 2 - .2, z - .9, x + w / 2 + .2, z + .9);
  return { g, tick(dt) { blade.rotation.z -= dt * 6; } };
}

/* ---------- Kaala: tall, black coat, red scarf, a long staff ---------- */
export function makeKaala(withPuppy = true) {
  const k = makeHuman({ scale: 1.38, skin: 0x7a5034, shirt: 0x1a1a1e, vest: 0x2a1018, pants: 0x121214, hat: 'bandana', hatCol: 0xa01a1a, weapon: 'staff', belly: 1.05, boot: 0x0a0a0a });
  // long coat tails
  M(B(.5, .7, .06), std(0x1a1a1e, { roughness: .9 }), 0, -.1, -.16, k.J.torso);
  let pup = null, basket = null;
  if (withPuppy) {
    basket = new THREE.Group(); basket.position.set(0, -.32, .12); k.J.lEl.add(basket);
    M(CY(.2, .16, .22, 12), std(0xa8803a, { roughness: 1 }), 0, 0, 0, basket);
    M(new THREE.TorusGeometry(.2, .02, 5, 14, PI), std(0x8a6a2a), 0, .1, 0, basket);
    pup = makePuppy(0x3a8ad8); pup.root.scale.setScalar(.75); pup.root.position.y = .02; pup.root.rotation.y = PI / 2; basket.add(pup.root);
  }
  return { ...k, pup, basket };
}
