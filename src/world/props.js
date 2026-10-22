// Level props: ranger hut, tents, campfire, crates, training dummy, animal cages, barricades,
// signs, jeep, Malabar giant squirrel and great hornbill.
import { THREE, M, S, C, B, CY, std, TEX, signTex, jitter, scene } from '../core/engine.js';
import { G, P, W } from '../core/state.js';
import { PI, TAU, rand, sr, clamp, damp, angDamp, smooth } from '../core/utils.js';
import { sfx, panOf } from '../core/audio.js';
import { addOb, addBox, BOXES } from './terrain.js';
import { emit, ring } from './particles.js';
import { ENEMIES, landHit } from '../combat/combat.js';
import { spawnPickup } from './pickups.js';
import { makeQuad, animQuad, QUADS } from '../actors/quad.js';
import { makeElephant, animElephant, tigerTex, makeMacaque } from './props2.js';

const at = (root, x, z, ry = 0) => { const g = new THREE.Group(); g.position.set(x, W.height(x, z), z); g.rotation.y = ry; root.add(g); return g; };

// Kerala-style forest watch hut: laterite base, white walls, sloped red-tile roof
export function makeHut(root, x, z, ry = 0) {
  const g = at(root, x, z, ry);
  M(B(5, .7, 4), std(0xa0523a, { roughness: .95 }), 0, .2, 0, g);
  M(B(4.4, 2.4, 3.4), std(0xf0e6d2), 0, 1.75, 0, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) M(B(.22, 2.6, .22), std(0x5a3a22), sx * 2.1, 1.75, sz * 1.6, g);
  const roof = new THREE.Shape(); roof.moveTo(-3.1, 0); roof.lineTo(3.1, 0); roof.lineTo(0, 1.6); roof.closePath();
  const rg = new THREE.ExtrudeGeometry(roof, { depth: 4.6, bevelEnabled: false }); rg.translate(0, 0, -2.3);
  M(rg, std(0xb4452f, { flatShading: true, roughness: .7 }), 0, 2.95, 0, g);
  M(B(1, 1.8, .1), std(0x6a3a1e), 0, 1.4, 1.72, g);
  M(B(1, .8, .08), new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffb54a, emissiveIntensity: .4 }), 1.4, 1.9, 1.72, g);
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.8, .78), new THREE.MeshStandardMaterial({ map: signTex('FOREST DEPT', 'Agasthyamala', '#2f5a2a') })); sg.position.set(0, 2.75, 1.75); g.add(sg);
  const c = Math.cos(ry), s = Math.sin(ry); addBox(x - 2.7, z - 2.3, x + 2.7, z + 2.3);
  return g;
}
export function makeSign(root, x, z, ry, title, sub, bg) {
  const g = at(root, x, z, ry); M(B(.12, 1.6, .12), std(0x5a3a22), -.5, .8, 0, g); M(B(.12, 1.6, .12), std(0x5a3a22), .5, .8, 0, g);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(1.6, .7), new THREE.MeshStandardMaterial({ map: signTex(title, sub, bg), side: THREE.DoubleSide })); p.position.y = 1.5; g.add(p); addOb(x, z, .5); return g;
}
export function makeTent(root, x, z, ry = 0, col = 0x5a6a3a) {
  const g = at(root, x, z, ry); const sh = new THREE.Shape(); sh.moveTo(-1.6, 0); sh.lineTo(1.6, 0); sh.lineTo(0, 2); sh.closePath();
  const tg = new THREE.ExtrudeGeometry(sh, { depth: 3, bevelEnabled: false }); tg.translate(0, 0, -1.5); M(tg, std(col, { roughness: 1, side: THREE.DoubleSide }), 0, 0, 0, g);
  M(B(1, 1.4, .05), std(0x1a1a14), 0, .7, 1.52, g); addOb(x, z, 1.7); return g;
}
export function makeCampfire(root, x, z) {
  const g = at(root, x, z);
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; M(jitter(new THREE.DodecahedronGeometry(.18, 0), .3), std(0x6a6a66, { flatShading: true }), Math.cos(a) * .55, .08, Math.sin(a) * .55, g); }
  for (let i = 0; i < 4; i++) { const l = M(CY(.06, .07, .9, 6), std(0x4a2e18), 0, .15, 0, g); l.rotation.set(PI / 2 - .5, i * PI / 2, 0); }
  const light = new THREE.PointLight(0xff8a3a, 3, 12, 1.6); light.position.y = .8; g.add(light);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xff9a40, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); glow.scale.setScalar(1.6); glow.position.y = .45; g.add(glow);
  addOb(x, z, .7);
  return { g, tick(dt, t) { light.intensity = 2.6 + Math.sin(t * 13) * .4 + Math.sin(t * 7.3) * .3; glow.material.opacity = .7 + Math.sin(t * 11) * .2; if (Math.random() < dt * 14) emit(TEX.glow, new THREE.Vector3(x + rand(-.2, .2), g.position.y + .3, z + rand(-.2, .2)), 1, { add: true, color: Math.random() < .5 ? 0xff7a20 : 0xffc040, size: .35, speed: .6, up0: 1.2, up1: 2, g: .5, life: .7, drag: .5 }); } };
}
export function makeJeep(root, x, z, ry = 0) {
  const g = at(root, x, z, ry); const body = std(0x3a4a2a, { roughness: .7 }), dark = std(0x111111, { roughness: .6 });
  M(B(1.8, .7, 3.4), body, 0, .85, 0, g); M(B(1.7, .6, 1.4), body, 0, 1.45, -.5, g); M(B(1.6, .5, .05), std(0x8ab0c0, { roughness: .1, metalness: .3 }), 0, 1.5, .23, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const w = M(CY(.38, .38, .3, 14), dark, sx * .92, .38, sz * 1.15, g); w.rotation.z = PI / 2; }
  M(CY(.36, .36, .25, 12), dark, 0, 1.0, -1.82, g).rotation.x = PI / 2;
  const c = Math.cos(ry), s = Math.sin(ry); addOb(x + s * 1, z + c * 1, 1.1); addOb(x - s * 1, z - c * 1, 1.1);
  return g;
}

/* ---------- breakable things (they live in ENEMIES so attacks can hit them) ---------- */
export class Crate {
  constructor(root, x, z, loot = 'ammo') {
    this.prop = true; this.g = at(root, x, z, rand(0, TAU)); this.x = x; this.z = z; this.y = this.g.position.y; this.radius = .45; this.chest = .4; this.alive = true; this.awake = false; this.hp = 1; this.loot = loot; this.root = root;
    const wm = std(0x9a6a3a, { roughness: .9 }), dm = std(0x6a4422);
    M(B(.8, .8, .8), wm, 0, .4, 0, this.g); for (const s of [-1, 1]) { M(B(.84, .1, .1), dm, 0, .4 + s * .3, .42, this.g); M(B(.84, .1, .1), dm, 0, .4 + s * .3, -.42, this.g); }
    ENEMIES.push(this);
  }
  hit(dmg, dx, dz) {
    if (!this.alive) return; this.alive = false; this.g.visible = false; this.dead = true; sfx.cage();
    emit(TEX.puff, new THREE.Vector3(this.x, this.y + .4, this.z), 8, { color: 0xb08a5a, size: .4, speed: 2.5, g: -6, life: .6 });
    landHit(this, 0, false); spawnPickup(this.loot, this.x, this.z, this.root, { pop: true, amt: this.loot === 'heal' ? 20 : 5 });
  }
  stunFor() { } update() { }
}
export class Dummy {
  constructor(root, x, z, onHit) {
    this.prop = true; this.g = at(root, x, z, 0); this.x = x; this.z = z; this.y = this.g.position.y; this.radius = .35; this.chest = 1; this.alive = true; this.awake = false; this.onHit = onHit; this.wob = 0; this.wv = 0;
    this.pole = new THREE.Group(); this.g.add(this.pole);
    M(CY(.06, .07, 1.8, 6), std(0x6a4422), 0, .9, 0, this.pole);
    const straw = std(0xd8b85a, { roughness: 1 }); M(C(.24, .4, 4, 8), straw, 0, 1.15, 0, this.pole); M(S(.18, 10, 8), straw, 0, 1.68, 0, this.pole);
    M(B(.9, .12, .12), std(0x6a4422), 0, 1.3, 0, this.pole);
    const face = new THREE.Mesh(new THREE.CircleGeometry(.12, 12), new THREE.MeshBasicMaterial({ color: 0xc02a2a })); face.position.set(0, 1.7, .17); this.pole.add(face);
    addOb(x, z, .3); ENEMIES.push(this);
  }
  hit(dmg, dx, dz, o = {}) { this.wv += (o.heavy ? 6 : 3) * (dx >= 0 ? 1 : -1); landHit(this, dmg, !!o.heavy); if (this.onHit) this.onHit(dmg, o); }
  stunFor() { }
  update(dt) { this.wv -= this.wob * 40 * dt; this.wv *= Math.exp(-4 * dt); this.wob += this.wv * dt; this.pole.rotation.z = this.wob * .3; }
}

/* ---------- Malabar giant squirrel ---------- */
export function makeSquirrel() {
  const g = new THREE.Group(), maroon = std(0x7a2a1a, { roughness: .9 }), black = std(0x1a1210, { roughness: .9 }), cream = std(0xe8c890, { roughness: .9 });
  M(S(.16, 10, 8), maroon, 0, .2, 0, g).scale.set(.9, .85, 1.3); M(S(.12, 10, 8), cream, 0, .15, .05, g).scale.set(.8, .8, 1.2);
  const head = new THREE.Group(); head.position.set(0, .3, .18); g.add(head); M(S(.09, 10, 8), maroon, 0, 0, 0, head); M(S(.05, 8, 6), cream, 0, -.03, .06, head);
  for (const s of [-1, 1]) { M(S(.018, 6, 5), black, s * .045, .02, .07, head); M(new THREE.ConeGeometry(.03, .07, 5), maroon, s * .05, .08, -.02, head); }
  const tail = new THREE.Group(); tail.position.set(0, .22, -.2); g.add(tail);
  for (let i = 0; i < 5; i++) M(S(.09 + i * .01, 8, 6), i % 2 ? black : maroon, 0, i * .09, -i * .05, tail).scale.set(.9, .9, 1.2);
  tail.rotation.x = -.4; return { root: g, head, tail };
}

/* ---------- animal cage ---------- */
export class Cage {
  constructor(root, x, z, kind = 'spotted', ry = 0) {
    this.x = x; this.z = z; this.kind = kind; this.free = false; this.t = 0; this.g = at(root, x, z, ry); this.root = root;
    const small = kind === 'squirrel' || kind === 'macaque', bm = std(0x4a3a2a, { roughness: .8 }), w = small ? 1.1 : 1.9, d = small ? 1.1 : 2.2, h = kind === 'squirrel' ? .9 : kind === 'calf' ? 1.6 : 1.7;
    this.bars = [];
    M(B(w + .1, .1, d + .1), bm, 0, .05, 0, this.g); const top = M(B(w + .1, .1, d + .1), bm, 0, h, 0, this.g); this.bars.push(top);
    for (let i = 0; i <= 6; i++) for (const s of [-1, 1]) { const b = M(CY(.025, .025, h, 5), bm, -w / 2 + i * w / 6, h / 2, s * d / 2, this.g); this.bars.push(b); }
    for (let i = 1; i < 6; i++) for (const s of [-1, 1]) { const b = M(CY(.025, .025, h, 5), bm, s * w / 2, h / 2, -d / 2 + i * d / 6, this.g); this.bars.push(b); }
    const lock = M(B(.14, .18, .08), std(0xc9a020, { metalness: .7, roughness: .3 }), 0, h * .55, d / 2 + .05, this.g); this.bars.push(lock);
    if (kind === 'squirrel') { this.animal = makeSquirrel(); this.animal.root.position.y = .1; this.g.add(this.animal.root); }
    else if (kind === 'calf') { this.ele = makeElephant(.4); this.g.add(this.ele.root); this.animal = this.ele; }
    else if (kind === 'macaque') { this.mac = makeMacaque(1.1); this.g.add(this.mac.root); this.animal = this.mac; }
    else { this.q = makeQuad(QUADS[kind]); if (kind === 'sambar') this.q.root.scale.setScalar(.75); this.g.add(this.q.root); this.animal = this.q; }
    this.vel = this.bars.map(() => new THREE.Vector3(rand(-3, 3), rand(3, 6), rand(-3, 3)));
    addBox(x - w / 2 - .1, z - d / 2 - .1, x + w / 2 + .1, z + d / 2 + .1); this.box = { w, d };
    this.marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.spark, color: 0xa0ffb0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); this.marker.scale.setScalar(.9); this.marker.position.y = h + .7; this.g.add(this.marker);
  }
  open() {
    this.free = true; this.t = 0; sfx.cage(); sfx.big(); G.freed++; this.marker.visible = false;
    emit(TEX.spark, this.g.position.clone().setY(this.g.position.y + 1), 26, { add: true, color: 0xa0ffb0, size: .35, speed: 3, g: -1, life: 1 });
    // remove the cage's collision box
    const i = BOXES.findIndex(b => Math.abs((b.x0 + b.x1) / 2 - this.x) < .01 && Math.abs((b.z0 + b.z1) / 2 - this.z) < .01); if (i >= 0) BOXES.splice(i, 1);
  }
  update(dt, t) {
    this.marker.material.rotation = t; this.marker.position.y = (this.kind === 'squirrel' ? .9 : 1.7) + .7 + Math.sin(t * 3) * .1;
    if (!this.free) {
      if (this.q) animQuad(this.q, dt, 0, Math.sin(t * .5 + this.x) > .6 ? 'alert' : 'lie', t, { wag: .1 });
      else if (this.ele) animElephant(this.ele, dt, 0, t);
      else if (this.mac) { this.mac.arms.forEach((a, i) => a.rotation.x = -2.6 + Math.sin(t * 6 + i * 3) * .3); this.mac.head.rotation.y = Math.sin(t * 2) * .5; }
      else this.animal.tail.rotation.x = -.4 + Math.sin(t * 2) * .1;
      return;
    }
    this.t += dt;
    if (this.t < 1.6) this.bars.forEach((b, i) => { const v = this.vel[i]; v.y -= 14 * dt; b.position.addScaledVector(v, dt); b.rotation.x += v.z * dt; b.rotation.z += v.x * dt; if (this.t > 1.2) b.scale.multiplyScalar(.9); });
    else this.bars.forEach(b => b.visible = false);
    // the animal runs away into the forest
    const a = this.animal.root; const run = clamp((this.t - .5) * 1, 0, 1);
    if (this.t > .5 && this.t < 6) {
      const sp = this.kind === 'squirrel' ? 4 : 6; a.position.z += sp * dt; a.position.x += Math.sin(this.t * 2) * dt;
      const wx = this.g.position.x + a.position.x, wz = this.g.position.z + a.position.z;
      a.position.y = W.height(wx, wz) - this.g.position.y + (this.kind === 'squirrel' ? Math.abs(Math.sin(this.t * 12)) * .15 : 0);
      if (this.q) animQuad(this.q, dt, sp, 'walk', t, { leap: true, wag: .6 });
      if (this.ele) animElephant(this.ele, dt, 2, t);
      if (this.mac) { a.position.y += Math.abs(Math.sin(this.t * 10)) * .3; this.mac.arms.forEach(ar => ar.rotation.x = -2.8); }
      if (this.t > 5) a.visible = false;
    }
  }
}

/* ---------- barricades that open when an objective is done ---------- */
export class Barricade {
  constructor(root, x, z, width = 9, kind = 'logs') {
    this.z = z; this.x = x; this.open = false; this.t = 0; this.g = at(root, x, z, 0);
    if (kind === 'bamboo') {
      for (const s of [-1, 1]) M(CY(.12, .14, 1.6, 7), std(0x6a4422), s * width / 2, .8, 0, this.g);
      this.pole = new THREE.Group(); this.pole.position.set(-width / 2, 1.3, 0); this.g.add(this.pole);
      const p = M(CY(.07, .07, width, 7), std(0xd8c070), width / 2, 0, 0, this.pole); p.rotation.z = PI / 2;
      for (let i = 0; i < 5; i++) M(CY(.075, .075, .5, 7), std(0xc02a2a), width * (i + .5) / 5, 0, 0, this.pole).rotation.z = PI / 2;
    } else {
      const lm = std(0x6a4a30, { roughness: .95 });
      for (let r = 0; r < 3; r++) for (let i = 0; i < 2; i++) { const l = M(CY(.32, .36, width - r * 1.2, 9), lm, (i - .5) * .3 * r, .32 + r * .55, (i - .5) * .5, this.g); l.rotation.z = PI / 2 + (r - 1) * .03; }
      for (let i = 0; i < 6; i++) { const sp = M(new THREE.ConeGeometry(.08, 1.2, 5), std(0x8a6a4a), -width / 2 + i * width / 5, .9, .5, this.g); sp.rotation.x = .6; }
    }
    this.kind = kind;
  }
  openUp() { if (this.open) return; this.open = true; this.t = 0; sfx.cage(); emit(TEX.puff, this.g.position.clone().setY(this.g.position.y + .8), 16, { color: 0xb8a080, size: .8, speed: 2, g: -1, life: .9, spread: 2 }); }
  update(dt) {
    if (!this.open || this.t > 1.5) return; this.t += dt;
    if (this.kind === 'bamboo') this.pole.rotation.z = smooth(0, 1, this.t) * 1.45;
    else { this.g.position.y -= dt * 2.2; if (this.t > 1.4) this.g.visible = false; }
  }
}

/* ---------- great hornbill (flies in big circles overhead) ---------- */
export function makeHornbill() {
  const g = new THREE.Group(), blk = std(0x161616, { roughness: .8 }), wht = std(0xf2efe6, { roughness: .8 }), yel = std(0xf2c230, { roughness: .5 });
  M(S(.3, 10, 8), blk, 0, 0, 0, g).scale.set(.9, .8, 1.6);
  M(S(.2, 10, 8), wht, 0, .05, .45, g); M(S(.16, 10, 8), blk, 0, .1, .62, g);
  const bill = M(new THREE.ConeGeometry(.08, .55, 7), yel, 0, .05, .98, g); bill.rotation.x = PI / 2.2; M(B(.08, .1, .3), yel, 0, .18, .82, g);
  const tail = M(B(.32, .04, .7), wht, 0, 0, -.75, g); M(B(.33, .045, .18), blk, 0, 0, -.62, g);
  const wings = []; for (const s of [-1, 1]) { const w = new THREE.Group(); w.position.set(s * .2, .05, 0); g.add(w); M(B(1.1, .04, .55), blk, s * .55, 0, 0, w); M(B(.5, .045, .5), wht, s * 1.05, 0, -.02, w); wings.push(w); }
  return { root: g, wings };
}
export function hornbillFlyer(root, cx, cz, r, h, w, ph) {
  const b = makeHornbill(); root.add(b.root); b.root.scale.setScalar(1.2);
  return { tick(dt, t) { const a = t * w + ph; const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r * .8; b.root.position.set(x, W.height(x, z) + h + Math.sin(a * 2) * 2, z); b.root.rotation.y = Math.atan2(-Math.sin(a) * Math.sign(w), Math.cos(a) * .8 * Math.sign(w)); b.root.rotation.z = -Math.sign(w) * .3; const f = Math.sin(t * 5 + ph) * .5; b.wings[0].rotation.z = -f; b.wings[1].rotation.z = f; } };
}

/* ---------- sambar deer that wander and flee ---------- */
export function sambar(root, x, z, fawn, kind) {
  const q = makeQuad(kind ? QUADS[kind] : fawn ? QUADS.spotted : QUADS.sambar); if (fawn) q.root.scale.setScalar(.7); root.add(q.root);
  const a = { x, z, hx: x, hz: z, yaw: rand(0, TAU), st: 'graze', t: rand(2, 5), speed: 0, tx: x, tz: z };
  return {
    tick(dt, t) {
      const d = Math.hypot(a.x - P.pos.x, a.z - P.pos.z); q.root.visible = d < 80; if (!q.root.visible) return;
      if (d < 9 && a.st !== 'flee') { a.st = 'flee'; a.t = rand(2.5, 4); const ang = Math.atan2(a.x - P.pos.x, a.z - P.pos.z) + rand(-.5, .5); a.tx = a.x + Math.sin(ang) * 20; a.tz = a.z + Math.cos(ang) * 20; }
      a.t -= dt;
      if (a.st === 'graze' || a.st === 'look') { a.speed = damp(a.speed, 0, 4, dt); if (a.t < 0) { const r = Math.random(); if (r < .35) { a.st = 'look'; a.t = rand(1.5, 3); } else if (r < .7) { a.st = 'walk'; a.t = rand(3, 6); const an = rand(0, TAU), rr = rand(2, 6); a.tx = a.hx + Math.sin(an) * rr; a.tz = a.hz + Math.cos(an) * rr; } else { a.st = 'graze'; a.t = rand(3, 6); } } }
      else { const dx = a.tx - a.x, dz = a.tz - a.z, l = Math.hypot(dx, dz), sp = a.st === 'flee' ? 6.5 : 1.1; a.speed = damp(a.speed, l > .5 ? sp : 0, 3, dt); if (l > .3) a.yaw = angDamp(a.yaw, Math.atan2(dx, dz), 4, dt); if (l < .6 || a.t < 0) { if (a.st === 'flee') { a.hx = a.x; a.hz = a.z; } a.st = 'look'; a.t = rand(1.5, 3); } }
      const nx = a.x + Math.sin(a.yaw) * a.speed * dt, nz = a.z + Math.cos(a.yaw) * a.speed * dt;
      if (W.walkable(nx, nz) && W.height(nx, nz) > W.water + .1 && Math.abs(nx) < 50 && nz < W.bounds.z1 && nz > W.bounds.z0) { a.x = nx; a.z = nz; } else { a.tx = a.hx; a.tz = a.hz; }
      q.root.position.set(a.x, W.height(a.x, a.z), a.z); q.root.rotation.y = a.yaw;
      animQuad(q, dt, a.speed, a.st === 'graze' ? 'graze' : a.st === 'look' ? 'alert' : 'walk', t, { leap: a.st === 'flee', wag: .1 });
    }
  };
}
