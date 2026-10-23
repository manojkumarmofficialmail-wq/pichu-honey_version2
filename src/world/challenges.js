// Challenge pieces that are not about fighting:
// stepping stones, crumbling planks, poacher searchlights (stealth), the Edakkal torch puzzle,
// a rolling boulder chase, and animal guides you follow through mist or trees.
import { THREE, M, S, B, CY, std, TEX, jitter } from '../core/engine.js';
import { G, P, W } from '../core/state.js';
import { PI, TAU, clamp, lerp, rand, smooth, angDiff, buzz, MOBILE } from '../core/utils.js';
import { sfx, tone, panOf } from '../core/audio.js';
import { emit, ring } from './particles.js';
import { dialog, popText } from '../core/ui.js';
import { FLOW } from '../core/flow.js';
import { damagePlayer } from '../combat/combat.js';

/* ---------- stepping stone / tree-stump top: a round platform you can stand on ---------- */
export class Stone {
  constructor(root, x, z, r = .8, top, look = 'rock') {
    this.x = x; this.z = z; this.r = r; this.top = top; this.dx = 0; this.dz = 0;
    const depth = top - (W.height(x, z) - .5);
    if (look === 'stump') { M(CY(r * .85, r, depth, 9), std(0x8a8478, { roughness: 1 }), x, top - depth / 2, z, root); M(CY(r * .82, r * .82, .04, 9), std(0xb8a888), x, top + .01, z, root); }
    else { M(jitter(new THREE.CylinderGeometry(r * .9, r * 1.2, depth, 9, 2), .12), std(0x8e9189, { flatShading: true, roughness: .8 }), x, top - depth / 2, z, root); M(S(r * .6, 6, 4), std(0x6f8a4f, { flatShading: true }), x, top - .02, z, root).scale.set(1, .15, 1); }
    W.platforms.push(this);
  }
  surface(x, z) { return (x - this.x) ** 2 + (z - this.z) ** 2 < this.r * this.r ? this.top : null; }
}

/* ---------- plank that gives way a moment after you step on it ---------- */
export class Crumble {
  constructor(root, x, z, w, l, top, ry = 0) {
    this.x = x; this.z = z; this.hw = w / 2; this.hl = l / 2; this.top0 = top; this.top = top; this.dx = 0; this.dz = 0; this.yaw = ry; this.t = -1; this.down = 0;
    this.m = M(B(w, .12, l), std(0x8a6440, { roughness: .9 }), x, top - .06, z, root); this.m.rotation.y = ry;
    W.platforms.push(this);
  }
  surface(x, z) { if (this.down > 0) return null; const dx = x - this.x, dz = z - this.z, c = Math.cos(-this.yaw), s = Math.sin(-this.yaw); return Math.abs(dx * c + dz * s) < this.hw && Math.abs(-dx * s + dz * c) < this.hl ? this.top : null; }
  update(dt) {
    if (this.down > 0) { this.down -= dt; this.m.position.y -= dt * 6; this.m.rotation.x += dt * 2; if (this.down <= 0) { this.m.position.y = this.top0 - .06; this.m.rotation.x = 0; this.t = -1; } return; }
    if (this.t < 0 && P.plat === this) { this.t = 0; sfx.step(true); }
    if (this.t >= 0) { this.t += dt; this.m.position.x = this.x + Math.sin(this.t * 60) * .03; if (this.t > .6) { this.down = 4; sfx.cage(); this.m.position.x = this.x; } }
  }
}

/* ---------- poacher searchlight: a sweeping cone on the ground. Get caught and you go back. ---------- */
export class Searchlight {
  // x,z post; a0 centre angle; sweep (radians either side); len; half = cone half-angle
  constructor(root, x, z, a0, sweep, len = 11, half = .32, speed = .6) {
    this.x = x; this.z = z; this.a0 = a0; this.sweep = sweep; this.len = len; this.half = half; this.speed = speed; this.ph = rand(0, TAU); this.a = a0; this.on = true;
    const y = W.height(x, z); M(CY(.08, .1, 3, 6), std(0x3a3a3a, { metalness: .5 }), x, y + 1.5, z, root);
    this.head = new THREE.Group(); this.head.position.set(x, y + 3.1, z); root.add(this.head);
    M(CY(.22, .16, .4, 10), std(0x2a2a2a, { metalness: .5 }), 0, 0, 0, this.head).rotation.x = PI / 2;
    const lamp = M(CY(.2, .2, .02, 10), new THREE.MeshBasicMaterial({ color: 0xfff6c0 }), 0, 0, .21, this.head); lamp.rotation.x = PI / 2;
    // the cone drawn on the ground
    const sh = new THREE.Shape(); sh.moveTo(0, 0); for (let i = 0; i <= 12; i++) { const a = -half + i * 2 * half / 12; sh.lineTo(Math.sin(a) * len, Math.cos(a) * len); } sh.closePath();
    this.cone = new THREE.Mesh(new THREE.ShapeGeometry(sh).rotateX(PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: .28, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    this.cone.position.set(x, y + .12, z); root.add(this.cone);
    this.light = new THREE.SpotLight(0xfff2c0, 30, len + 4, half * 1.1, .4, 1); this.light.position.set(x, y + 3.1, z); root.add(this.light, this.light.target);
  }
  sees(px, pz) {
    if (!this.on) return false; const dx = px - this.x, dz = pz - this.z, d = Math.hypot(dx, dz); if (d > this.len || d < .4) return false;
    return Math.abs(angDiff(this.a, Math.atan2(dx, dz))) < this.half;
  }
  update(dt, t) {
    this.a = this.a0 + Math.sin(t * this.speed + this.ph) * this.sweep;
    this.head.rotation.y = this.a; this.cone.rotation.y = this.a; this.cone.visible = this.on; this.light.visible = this.on;
    this.light.target.position.set(this.x + Math.sin(this.a) * this.len * .7, W.height(this.x, this.z), this.z + Math.cos(this.a) * this.len * .7);
    this.cone.material.opacity = .22 + .06 * Math.sin(t * 5);
  }
}
// a stealth zone: if any light sees Pichu, alarm and back to the start spot
export class StealthZone {
  // covers: [{x,z,r}] bushes where Pichu is hidden from the lights
  constructor(lights, start, active, covers = []) { this.lights = lights; this.start = start; this.active = active; this.caught = 0; this.cool = 0; this.covers = covers; }
  hidden() { return this.covers.some(c => Math.hypot(P.pos.x - c.x, P.pos.z - c.z) < c.r); }
  update(dt, t) {
    for (const l of this.lights) l.update(dt, t);
    this.cool -= dt; if (!this.active() || this.cool > 0 || G.mode !== 'play' || G.busy) return;
    // a short grace time: you are only caught if you stay in the light a moment
    if (!this.hidden() && this.lights.some(l => l.sees(P.pos.x, P.pos.z))) { this.inLight = (this.inLight || 0) + dt; if (!this.warned) { this.warned = true; popText('❗', 'rgba(255,220,90,.95)'); tone({ type: 'square', f0: 1200, dur: .06, vol: .05 }); } } else { this.inLight = 0; this.warned = false; }
    if (this.inLight > .4) {
      this.inLight = 0; this.warned = false; this.caught++; this.cool = 2.5; buzz([80, 40, 80]);
      tone({ type: 'square', f0: 880, f1: 660, dur: .25, vol: .1 }); tone({ type: 'square', f0: 880, f1: 660, dur: .25, vol: .1, delay: .3 });
      dialog('Poacher', 'Hey! Who\'s there?!', 1.6);
      setTimeout(() => FLOW.respawn(this.start, () => dialog('Pichu', this.caught < 2 ? 'They saw me! I\'ll wait until the light moves away, then sneak past.' : 'Watch the yellow light… move when it swings away!', 3.5)), 500);
    }
  }
}

/* ---------- Edakkal torch puzzle: light the torches in the order shown on the carving ---------- */
export class TorchPuzzle {
  // torches: [{x,z,sym}] ; order: list of indexes ; onSolve
  constructor(root, torches, order, onSolve) {
    this.order = order; this.onSolve = onSolve; this.step = 0; this.solved = false;
    this.T = torches.map((p, i) => {
      const y = W.height(p.x, p.z), g = new THREE.Group(); g.position.set(p.x, y, p.z); root.add(g);
      M(CY(.25, .35, 1.1, 8), std(0x5a4a3a, { flatShading: true }), 0, .55, 0, g); M(CY(.32, .22, .25, 10), std(0x3a3a3a, { metalness: .4 }), 0, 1.2, 0, g);
      const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: symTex(p.sym), transparent: true, depthWrite: false })); sign.position.y = 2.2; sign.scale.setScalar(.8); g.add(sign);
      const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xff9a40, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); fl.position.y = 1.5; fl.scale.setScalar(1.1); fl.visible = false; g.add(fl);
      const pl = new THREE.PointLight(0xff9a50, 0, 9, 1.5); pl.position.y = 1.8; g.add(pl);
      return { ...p, y, fl, pl, lit: false };
    });
  }
  near() { return this.solved ? null : this.T.find(t => !t.lit && Math.hypot(P.pos.x - t.x, P.pos.z - t.z) < 1.9) || null; }
  canUse() { return !!this.near(); }
  label() { return MOBILE ? 'Tap ✋ to light the torch' : 'Press E to light the torch'; }
  use() {
    const t = this.near(); if (!t) return false;
    const idx = this.T.indexOf(t);
    if (idx === this.order[this.step]) {
      t.lit = true; t.fl.visible = true; this.step++; sfx.collect(); tone({ f0: 440 * Math.pow(2, this.step / 4), dur: .4, vol: .08 });
      if (this.step >= this.order.length) { this.solved = true; sfx.big(); sfx.magic(); this.onSolve && this.onSolve(); }
    } else {
      sfx.hurt(); this.step = 0; for (const x of this.T) { x.lit = false; x.fl.visible = false; }
      dialog('Pichu', 'Whoosh — they all went out! I need the same order as the carving.', 3);
    }
    return true;
  }
  tick(dt, t) { for (const x of this.T) { const f = .85 + Math.sin(t * 12 + x.x) * .15; x.fl.scale.setScalar(1.1 * f); x.pl.intensity = x.lit ? 2.6 * f : 0; } }
}
const SYM = {};
export function symTex(sym) {
  if (SYM[sym]) return SYM[sym];
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = 'rgba(40,24,12,.75)'; g.beginPath(); g.arc(32, 32, 30, 0, TAU); g.fill(); g.strokeStyle = '#ffd8a0'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath();
  if (sym === 'sun') { g.arc(32, 32, 9, 0, TAU); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.moveTo(32 + Math.cos(a) * 13, 32 + Math.sin(a) * 13); g.lineTo(32 + Math.cos(a) * 20, 32 + Math.sin(a) * 20); } }
  else if (sym === 'man') { g.arc(32, 16, 5, 0, TAU); g.moveTo(32, 21); g.lineTo(32, 38); g.moveTo(20, 27); g.lineTo(44, 27); g.moveTo(32, 38); g.lineTo(24, 52); g.moveTo(32, 38); g.lineTo(40, 52); }
  else if (sym === 'elephant') { g.moveTo(14, 26); g.lineTo(46, 26); g.lineTo(52, 34); g.lineTo(52, 50); g.moveTo(14, 26); g.lineTo(14, 44); g.moveTo(22, 26); g.lineTo(22, 44); g.moveTo(40, 26); g.lineTo(40, 44); g.moveTo(46, 26); g.quadraticCurveTo(56, 22, 54, 14); }
  else { g.rect(16, 16, 32, 32); g.moveTo(16, 32); g.lineTo(48, 32); g.moveTo(32, 16); g.lineTo(32, 48); }
  g.stroke(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.userData.shared = true; SYM[sym] = t; return t;
}

/* ---------- rolling boulder chase along a path ---------- */
export class Boulder {
  constructor(root, pts, speed = 5.2, r = 1.6) {
    this.pts = pts; this.speed = speed; this.r = r; this.on = false; this.i = 0; this.u = 0;
    this.m = M(jitter(new THREE.IcosahedronGeometry(r, 1), .15), std(0x6a5a4a, { flatShading: true, roughness: 1 }), pts[0].x, W.height(pts[0].x, pts[0].z) + r, pts[0].z, root); this.m.visible = false;
  }
  start() { this.on = true; this.i = 0; this.u = 0; this.m.visible = true; sfx.roar(); G.shake = .6; }
  stop() { this.on = false; this.m.visible = false; }
  update(dt, onCatch) {
    if (!this.on || G.mode !== 'play' || G.busy) return;
    const a = this.pts[this.i], b = this.pts[this.i + 1]; if (!b) { this.stop(); sfx.smash(); G.shake = .5; return; }
    const L = Math.hypot(b.x - a.x, b.z - a.z); this.u += this.speed * dt / L; if (this.u >= 1) { this.u = 0; this.i++; }
    const x = lerp(a.x, b.x, Math.min(this.u, 1)), z = lerp(a.z, b.z, Math.min(this.u, 1));
    this.m.position.set(x, W.height(x, z) + this.r, z); this.m.rotation.x -= this.speed * dt / this.r; this.m.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    G.shake = Math.max(G.shake, .08); if (Math.random() < dt * 10) emit(TEX.puff, new THREE.Vector3(x, W.height(x, z) + .2, z), 1, { color: 0x6a5a4a, size: .8, speed: 1, g: 0, life: .7 });
    if (Math.hypot(P.pos.x - x, P.pos.z - z) < this.r + .3) { damagePlayer(15, x, z, 12); onCatch && onCatch(); }
  }
}

/* ---------- an animal guide: walks along waypoints, waits for Pichu, makes a sound so you can follow ---------- */
export class Guide {
  // model: {root, anim(dt, speed, t)}, pts [{x,z,y?}], sound(pan,vol)
  constructor(model, pts, opts = {}) {
    this.m = model; this.pts = pts; this.i = 0; this.x = pts[0].x; this.z = pts[0].z; this.speed = opts.speed ?? 3.2; this.wait = opts.wait ?? 6; this.sound = opts.sound; this.sndT = 0; this.done = false; this.onDone = opts.onDone; this.yOff = opts.yOff ?? 0; this.active = false;
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: opts.glow ?? 0xffe08a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .6 })); this.glow.scale.setScalar(1.6); model.root.add(this.glow); this.glow.position.y = 1;
  }
  tick(dt, t) {
    let sp = 0; const target = this.pts[this.i + 1];
    if (this.active && !this.done && target) {
      const dp = Math.hypot(P.pos.x - this.x, P.pos.z - this.z);
      if (dp < this.wait) { const dx = target.x - this.x, dz = target.z - this.z, d = Math.hypot(dx, dz); sp = this.speed; if (d < .3) this.i++; else { this.x += dx / d * Math.min(d, sp * dt); this.z += dz / d * Math.min(d, sp * dt); this.yaw = Math.atan2(dx, dz); } }
      else this.yaw = Math.atan2(P.pos.x - this.x, P.pos.z - this.z);
      this.sndT -= dt; if (this.sndT < 0 && this.sound) { this.sndT = 1.4; this.sound(panOf(this.x, this.z), clamp(1 - dp / 30, .15, 1)); }
    } else if (this.active && !this.done && !target) { this.done = true; this.onDone && this.onDone(this); }
    const p = this.pts[Math.min(this.i, this.pts.length - 1)], y = p.y ?? W.height(this.x, this.z);
    this.m.root.position.set(this.x, y + this.yOff, this.z); if (this.yaw !== undefined) this.m.root.rotation.y = this.yaw;
    this.m.anim && this.m.anim(dt, sp, t); this.glow.material.opacity = this.active && !this.done ? .45 + .25 * Math.sin(t * 4) : 0;
  }
}
export const bell = (pan, vol) => { tone({ type: 'triangle', f0: 1568, dur: .5, a: .005, vol: .07 * vol, pan }); tone({ type: 'triangle', f0: 2093, dur: .4, a: .005, vol: .04 * vol, pan, delay: .05 }); };

/* ---------- a leafy bush you can hide inside (no collision) ---------- */
export function hideBush(root, x, z, r = 1.15) {
  const g = new THREE.Group(); g.position.set(x, W.height(x, z), z); root.add(g); const m = std(0x2f5a2a, { flatShading: true, roughness: .9 });
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; M(jitter(new THREE.IcosahedronGeometry(.62, 1), .3), m, Math.cos(a) * r * .7, .45 + (i % 2) * .25, Math.sin(a) * r * .7, g, false).scale.set(1, 1.2, 1); }
  const tip = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.spark, color: 0x9ae86a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .5 })); tip.position.y = 2; tip.scale.setScalar(.6); g.add(tip);
  return { x, z, r, tick(dt, t) { tip.material.rotation = t; tip.visible = Math.hypot(P.pos.x - x, P.pos.z - z) > r; } };
}
