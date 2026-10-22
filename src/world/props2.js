// Phase 2 props: bamboo raft, jetty deck, Periyar dead trees, elephants, tiger coat, vine ladders,
// signal antennas, rock pillars, watchtower and drifting mist.
import { THREE, M, S, C, B, CY, std, TEX, jitter, canvasTex, scene, camera } from '../core/engine.js';
import { G, P, W } from '../core/state.js';
import { PI, TAU, rand, sr, clamp, damp, angDamp, lerp, smooth } from '../core/utils.js';
import { sfx } from '../core/audio.js';
import { addOb } from './terrain.js';
import { emit } from './particles.js';
import { ENEMIES, landHit } from '../combat/combat.js';

const at = (root, x, z, ry = 0, y) => { const g = new THREE.Group(); g.position.set(x, y ?? W.height(x, z), z); g.rotation.y = ry; root.add(g); return g; };

/* ---------- bamboo raft that follows a route of waypoints ---------- */
export class Raft {
  constructor(root, route, opts = {}) {
    this.route = route; this.seg = 0; this.u = 0; this.target = 0; this.speed = opts.speed ?? 3.2; this.dx = 0; this.dz = 0;
    this.g = new THREE.Group(); root.add(this.g); this.hw = 1.3; this.hl = 1.8;
    const bam = std(0xc8b060, { roughness: .7 }), rope = std(0x7a5a30);
    for (let i = 0; i < 7; i++) { const l = M(CY(.17, .17, 3.6, 8), bam, -1.08 + i * .36, 0, 0, this.g); l.rotation.x = PI / 2; }
    for (const z of [-1.3, 0, 1.3]) M(B(2.6, .06, .14), rope, 0, .16, z, this.g);
    const pole = M(CY(.04, .04, 2.2, 6), std(0x6a4a2a), .95, 1.1, -1.4, this.g);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(.6, .4), new THREE.MeshStandardMaterial({ color: 0xff8a20, side: THREE.DoubleSide })); flag.position.set(1.25, 2, -1.4); this.g.add(flag); this.flag = flag;
    this.x = route[0].x; this.z = route[0].z; this.yaw = this.segYaw(0); this.place(0);
    W.platforms.push(this);
  }
  segYaw(i) { const a = this.route[i], b = this.route[Math.min(i + 1, this.route.length - 1)]; return Math.atan2(b.x - a.x, b.z - a.z); }
  goTo(i, onArrive) { this.target = i; this.onArrive = onArrive; }
  reset(seg) { this.seg = seg; this.u = 0; this.target = seg; this.onArrive = null; this.x = this.route[seg].x; this.z = this.route[seg].z; this.yaw = this.segYaw(seg); }
  get moving() { return this.seg < this.target; }
  surface(x, z) {
    const dx = x - this.x, dz = z - this.z, c = Math.cos(-this.yaw), s = Math.sin(-this.yaw);
    const lx = dx * c + dz * s, lz = -dx * s + dz * c;
    return Math.abs(lx) < this.hw && Math.abs(lz) < this.hl ? this.top : null;
  }
  seat() { return new THREE.Vector3(this.x - Math.sin(this.yaw) * 1.1 + Math.cos(this.yaw) * .6, this.top, this.z - Math.cos(this.yaw) * 1.1 - Math.sin(this.yaw) * .6); }
  place(t) { this.top = W.water + .28 + Math.sin(t * 1.6) * .03; this.g.position.set(this.x, this.top - .2, this.z); this.g.rotation.y = this.yaw; this.g.rotation.z = Math.sin(t * 1.2) * .02; }
  update(dt, t) {
    const ox = this.x, oz = this.z;
    if (this.seg < this.target) {
      const a = this.route[this.seg], b = this.route[this.seg + 1], L = Math.hypot(b.x - a.x, b.z - a.z);
      this.u += this.speed * dt / L;
      if (this.u >= 1) { this.u = 0; this.seg++; if (this.seg >= this.target) { const cb = this.onArrive; this.onArrive = null; cb && cb(this.seg); } }
      const A = this.route[this.seg], Bp = this.route[Math.min(this.seg + 1, this.route.length - 1)];
      this.x = lerp(A.x, Bp.x, this.u); this.z = lerp(A.z, Bp.z, this.u);
      this.yaw = angDamp(this.yaw, this.segYaw(this.seg), 1.5, dt);
      if (Math.random() < dt * 6) emit(TEX.puff, new THREE.Vector3(this.x - Math.sin(this.yaw) * 1.9, W.water + .05, this.z - Math.cos(this.yaw) * 1.9), 1, { color: 0xe8f6ff, size: .4, speed: .4, g: 0, life: .8 });
    }
    this.dx = this.x - ox; this.dz = this.z - oz; this.place(t); this.flag.rotation.y = Math.sin(t * 3) * .3;
  }
}
// a fixed wooden deck over the water (walkable)
export class Deck {
  constructor(root, x, z, w, l, ry = 0) {
    this.x = x; this.z = z; this.yaw = ry; this.hw = w / 2; this.hl = l / 2; this.dx = 0; this.dz = 0; this.top = W.water + .55;
    const g = at(root, x, z, ry, this.top - .08); const pl = std(0x8a6440, { roughness: .9 });
    for (let i = 0; i < Math.round(l / .5); i++) M(B(w, .1, .44), pl, 0, 0, -l / 2 + .25 + i * .5, g);
    for (const sx of [-1, 1]) for (let i = 0; i <= Math.round(l / 2.5); i++) M(CY(.1, .1, 2, 6), std(0x5a3a22), sx * (w / 2 - .1), -.9, -l / 2 + i * 2.5, g);
    W.platforms.push(this);
  }
  surface(x, z) { const dx = x - this.x, dz = z - this.z, c = Math.cos(-this.yaw), s = Math.sin(-this.yaw); const lx = dx * c + dz * s, lz = -dx * s + dz * c; return Math.abs(lx) < this.hw && Math.abs(lz) < this.hl ? this.top : null; }
}

/* ---------- Periyar's famous dead trees standing in the lake ---------- */
export function deadTree(root, x, z, h = 4) {
  const g = at(root, x, z, sr(0, TAU), W.water - 1.5); const m = std(0x8a8478, { roughness: 1 });
  M(CY(.12, .3, h + 1.5, 7), m, 0, (h + 1.5) / 2, 0, g);
  for (let i = 0; i < 3; i++) { const b = M(CY(.04, .09, sr(1, 2), 5), m, 0, h * sr(.6, 1.05) + 1, 0, g); b.rotation.set(sr(-.3, .3), sr(0, TAU), sr(.6, 1.1) * (i % 2 ? 1 : -1)); }
  return g;
}

/* ---------- elephant ---------- */
export function makeElephant(scale = 1) {
  const skin = std(0x6e6862, { roughness: .95 }), dark = std(0x4a4540, { roughness: .9 }), ivory = std(0xf0e8d0, { roughness: .5 });
  const root = new THREE.Group(), body = new THREE.Group(); body.position.y = 1.55; root.add(body);
  M(S(1, 14, 12), skin, 0, 0, 0, body).scale.set(.95, .9, 1.35);
  const head = new THREE.Group(); head.position.set(0, .35, 1.35); body.add(head);
  M(S(.62, 12, 10), skin, 0, 0, 0, head);
  const ears = []; for (const s of [-1, 1]) { const e = new THREE.Group(); e.position.set(s * .5, .1, -.1); head.add(e); M(S(.55, 10, 8), dark, s * .25, -.1, 0, e).scale.set(.12, 1, .9); ears.push(e); }
  for (const s of [-1, 1]) { M(S(.07, 6, 5), std(0x111111), s * .38, .15, .45, head); const tk = M(new THREE.ConeGeometry(.07, .7, 6), ivory, s * .25, -.45, .5, head); tk.rotation.x = 2.2; }
  const trunk = []; let par = new THREE.Group(); par.position.set(0, -.15, .55); head.add(par); trunk.push(par);
  for (let i = 0; i < 6; i++) { M(C(.17 - i * .02, .2, 3, 8), skin, 0, -.14, 0, par); const n = new THREE.Group(); n.position.y = -.28; par.add(n); par = n; trunk.push(n); }
  trunk[0].rotation.x = .3;
  const legs = []; for (const [x, z] of [[.5, .8], [-.5, .8], [.5, -.8], [-.5, -.8]]) { const l = new THREE.Group(); l.position.set(x, -.4, z); body.add(l); M(CY(.26, .24, 1.3, 9), skin, 0, -.6, 0, l); M(CY(.27, .27, .1, 9), std(0xb8b0a0), 0, -1.22, 0, l); legs.push(l); }
  const tail = M(CY(.03, .05, .9, 5), skin, 0, .1, -1.4, body); tail.rotation.x = -.3;
  root.scale.setScalar(scale); root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { root, body, head, ears, trunk, legs, ph: rand(0, TAU) };
}
export function animElephant(e, dt, speed, t) {
  e.ph += dt * speed * 1.6; const s = Math.sin(e.ph);
  e.legs.forEach((l, i) => l.rotation.x = Math.sin(e.ph + (i === 0 || i === 3 ? 0 : PI)) * .35 * clamp(speed, 0, 1));
  e.body.position.y = 1.55 + Math.abs(s) * .04 * speed;
  e.ears.forEach((ea, i) => ea.rotation.y = (i ? -1 : 1) * (.2 + Math.sin(t * 2 + i) * .25));
  e.trunk.forEach((tk, i) => { if (i) tk.rotation.x = .12 + Math.sin(t * 1.3 + i * .5) * .1; tk.rotation.z = Math.sin(t * .9 + i * .3) * .06; });
}
// an elephant walking a loop of points (gentle giants: they push Pichu aside but never hurt him)
export function elephantWalker(root, pts, scale = 1, speed = 1.1) {
  const e = makeElephant(scale); root.add(e.root); let i = 0, x = pts[0].x, z = pts[0].z, yaw = 0, wait = 0;
  return {
    e, get x() { return x; }, get z() { return z; },
    tick(dt, t) {
      const p = pts[(i + 1) % pts.length], dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz); let sp = 0;
      if (wait > 0) wait -= dt; else if (d < .5) { i = (i + 1) % pts.length; if (pts[i].wait) wait = pts[i].wait; } else { sp = speed; yaw = angDamp(yaw, Math.atan2(dx, dz), 1.5, dt); x += Math.sin(yaw) * sp * dt; z += Math.cos(yaw) * sp * dt; }
      e.root.position.set(x, W.height(x, z), z); e.root.rotation.y = yaw; animElephant(e, dt, sp, t);
      const px = P.pos.x - x, pz = P.pos.z - z, pd = Math.hypot(px, pz), r = 1.6 * scale; if (pd < r && pd > .01) { P.pos.x = x + px / pd * r; P.pos.z = z + pz / pd * r; }
    }
  };
}

/* ---------- tiger stripes ---------- */
export const tigerTex = canvasTex(256, 256, g => {
  g.fillStyle = '#e08a2a'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#1a120a';
  for (let i = 0; i < 18; i++) { const x = i * 15 + rand(-4, 4); g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + rand(-12, 12), 80, x + rand(-12, 12), 170, x + rand(-6, 6), 256); g.lineWidth = rand(3, 7); g.strokeStyle = '#1a120a'; g.stroke(); }
});
tigerTex.wrapS = tigerTex.wrapT = THREE.RepeatWrapping; tigerTex.userData.shared = true;

/* ---------- vine ladder on a cliff ---------- */
export function vineLadder(root, L) {
  const g = new THREE.Group(); g.position.set(L.x + L.nx * .12, L.y0, L.z + L.nz * .12); g.rotation.y = Math.atan2(L.nx, L.nz); root.add(g);
  const h = L.y1 - L.y0 + .3, vine = std(0x3f6a2a, { roughness: .9 }), rung = std(0xa88a50, { roughness: .8 });
  for (const s of [-1, 1]) M(CY(.05, .05, h, 6), vine, s * .45, h / 2, 0, g);
  for (let y = .3; y < h; y += .4) { const r = M(CY(.035, .035, 1, 5), rung, 0, y, .02, g); r.rotation.z = PI / 2; }
  for (let i = 0; i < 14; i++) { const lf = M(S(.12, 6, 5), std(0x4f8a3a, { roughness: .9 }), sr(-.7, .7), sr(0, h), .05, g); lf.scale.set(1.2, .6, .4); }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.spark, color: 0xa0ffb0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); glow.position.set(0, 1, .4); glow.scale.setScalar(.8); g.add(glow);
  W.ladders.push(L); return { tick(dt, t) { glow.material.rotation = t; glow.visible = Math.hypot(P.pos.x - L.x, P.pos.z - L.z) < 12 && P.pos.y < L.y0 + 1; } };
}

/* ---------- signal antenna (powers the Drone Master's shield) ---------- */
export class Antenna {
  constructor(root, x, z, onBreak) {
    this.prop = true; this.x = x; this.z = z; this.y = W.height(x, z); this.radius = .5; this.chest = 1.2; this.alive = true; this.awake = false; this.onBreak = onBreak;
    this.maxHp = 45; this.hp = 45; this.g = at(root, x, z); this.mat = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: .6, roughness: .35 });
    M(CY(.07, .12, 4, 7), this.mat, 0, 2, 0, this.g); M(B(.9, .5, .9), std(0x3a3f46, { metalness: .4 }), 0, .25, 0, this.g);
    const dish = M(new THREE.SphereGeometry(.45, 12, 8, 0, TAU, 0, PI / 3), this.mat, 0, 3.3, .1, this.g); dish.rotation.x = PI / 2;
    this.light = new THREE.Mesh(S(.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3030 })); this.light.position.y = 4.1; this.g.add(this.light);
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 1, 5), new THREE.MeshBasicMaterial({ color: 0x7ad0ff, transparent: true, opacity: .6, blending: THREE.AdditiveBlending, depthWrite: false })); root.add(this.beam);
    addOb(x, z, .55); ENEMIES.push(this);
  }
  link(p) { this.linkTo = p; }
  hit(dmg) {
    if (!this.alive) return; this.hp -= dmg; landHit(this, dmg, false); this.flash = .12;
    if (this.hp <= 0) { this.alive = false; this.dead = true; this.beam.visible = false; this.fall = 0; sfx.smash(); G.shake = .3; emit(TEX.spark, new THREE.Vector3(this.x, this.y + 3, this.z), 20, { add: true, color: 0x7ad0ff, size: .4, speed: 4, g: -5, life: .7 }); this.onBreak && this.onBreak(this); }
  }
  stunFor() { } update() { }
  tick(dt, t) {
    this.flash = (this.flash || 0) - dt; this.mat.emissive.setRGB(this.flash > 0 ? 1 : 0, this.flash > 0 ? 1 : 0, this.flash > 0 ? 1 : 0);
    this.light.visible = this.alive && Math.floor(t * 2) % 2 === 0;
    if (this.fall !== undefined && this.fall < 1) { this.fall = Math.min(1, this.fall + dt * 1.5); this.g.rotation.z = this.fall * 1.45; }
    if (this.alive && this.linkTo) { const a = new THREE.Vector3(this.x, this.y + 3.4, this.z), b = this.linkTo(); const m = a.clone().add(b).multiplyScalar(.5); this.beam.position.copy(m); this.beam.scale.set(1, a.distanceTo(b), 1); this.beam.lookAt(b); this.beam.rotateX(PI / 2); this.beam.material.opacity = .4 + Math.sin(t * 8) * .2; }
  }
}

export function rockPillar(root, x, z, r = 1.4, h = 5) {
  const g = at(root, x, z, sr(0, TAU)); M(jitter(new THREE.CylinderGeometry(r * .8, r, h, 9, 3), .25), std(0x7a7670, { flatShading: true, roughness: .95 }), 0, h / 2 - .3, 0, g);
  M(jitter(new THREE.DodecahedronGeometry(r * .7, 0), .3), std(0x6a7a48, { flatShading: true }), 0, h - .1, 0, g).scale.set(1, .4, 1);
  addOb(x, z, r * .95, r * 1.5); return g;
}
export function watchtower(root, x, z, ry = 0) {
  const g = at(root, x, z, ry), wd = std(0x6a4a2a, { roughness: .9 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const p = M(CY(.1, .12, 5, 6), wd, sx * .9, 2.5, sz * .9, g); p.rotation.z = -sx * .06; p.rotation.x = sz * .06; }
  M(B(2.2, .15, 2.2), wd, 0, 4.4, 0, g); for (const s of [-1, 1]) { M(B(2.2, .5, .08), wd, 0, 4.7, s * 1.08, g); M(B(.08, .5, 2.2), wd, s * 1.08, 4.7, 0, g); }
  const rf = new THREE.Shape(); rf.moveTo(-1.5, 0); rf.lineTo(1.5, 0); rf.lineTo(0, 1); rf.closePath(); const rg = new THREE.ExtrudeGeometry(rf, { depth: 2.6, bevelEnabled: false }); rg.translate(0, 0, -1.3);
  M(rg, std(0x8a7a50, { roughness: 1 }), 0, 5.9, 0, g); for (const sx of [-1, 1]) for (const sz of [-1, 1]) M(CY(.06, .06, 1.2, 5), wd, sx * 1, 5.3, sz * 1, g);
  addOb(x, z, 1.3); return g;
}

/* ---------- low mist drifting around Pichu (shola grasslands) ---------- */
export function mistField(root, n = 26, col = 0xe8eef2) {
  const S2 = []; for (let i = 0; i < n; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.cloud, color: col, transparent: true, depthWrite: false, opacity: 0 })); const sc = rand(10, 18); s.scale.set(sc, sc * .45, 1); s.userData = { a: rand(0, TAU), r: rand(6, 30), h: rand(.3, 3), sp: rand(.02, .06), ph: rand(0, TAU) }; root.add(s); S2.push(s); }
  return { amount: 1, tick(dt, t) { for (const s of S2) { const u = s.userData; u.a += u.sp * dt; const x = P.pos.x + Math.cos(u.a) * u.r, z = P.pos.z + Math.sin(u.a) * u.r; s.position.set(x, W.height(x, z) + u.h + Math.sin(t * .3 + u.ph) * .3, z); s.material.opacity = (.32 + Math.sin(t * .2 + u.ph) * .1) * this.amount; } } };
}
