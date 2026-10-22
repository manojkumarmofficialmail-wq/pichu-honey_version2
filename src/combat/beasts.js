// Turned-wild animals. Kaala's men put glowing "anger collars" on them.
// Beat them gently: at zero health the collar breaks, the animal calms down and trots home (nobody is hurt).
// WILD BOAR: scrapes its feet (warning + red line), then charges in a straight line. Dodge sideways!
import { THREE, M, std, TEX } from '../core/engine.js';
import { G, P, W } from '../core/state.js';
import { PI, TAU, clamp, damp, angDamp, rand, DV } from '../core/utils.js';
import { sfx, panOf, tone } from '../core/audio.js';
import { collide } from '../world/terrain.js';
import { emit, dmgNum } from '../world/particles.js';
import { makeQuad, animQuad, QUADS } from '../actors/quad.js';
import { ENEMIES, HOOKS, landHit, damagePlayer } from './combat.js';
import { makeBar } from './enemies.js';
import { spawnPickup } from '../world/pickups.js';

export function angerCollar(q, r = .13) {
  const m = new THREE.MeshStandardMaterial({ color: 0x400808, emissive: 0xff2020, emissiveIntensity: 1.2, metalness: .5, roughness: .4 });
  const c = M(new THREE.TorusGeometry(r, r * .22, 6, 18), m, 0, .05, 0, q.neck); c.rotation.x = PI / 2;
  const tag = M(new THREE.BoxGeometry(r * .5, r * .5, r * .2), m, 0, -.02, r * 1.05, q.neck);
  return { c, tag, m };
}
export const boarSfx = { grunt(pan) { tone({ type: 'sawtooth', f0: rand(110, 150), f1: 70, dur: .25, vol: .08, pan, filter: ['lowpass', 700] }); }, squeal(pan) { tone({ type: 'sawtooth', f0: 700, f1: 1200, dur: .3, vol: .07, pan, filter: ['lowpass', 2500] }); } };

export class WildBoar {
  constructor(x, z, root, opts = {}) {
    this.root = root; this.q = makeQuad(QUADS.boar); root.add(this.q.root);
    this.q.root.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.userData = {}; } });
    this.mats = []; this.q.root.traverse(m => { if (m.isMesh && m.material.emissive) this.mats.push(m.material); });
    this.collar = angerCollar(this.q, .17);
    this.x = x; this.z = z; this.hx = x; this.hz = z; this.y = W.height(x, z); this.yaw = rand(0, TAU); this.beast = true;
    this.maxHp = Math.round(70 * DV.enemyHp); this.hp = this.maxHp; this.alive = true; this.radius = .55; this.chest = .55;
    this.st = 'idle'; this.t = rand(0, 2); this.cd = rand(1, 2); this.speed = 0; this.vel = new THREE.Vector3(); this.flash = 0; this.stun = 0;
    this.group = opts.group ?? 0; this.awake = !!opts.awake; this.aggroR = opts.aggro ?? 11;
    this.bar = makeBar(); root.add(this.bar.g);
    this.line = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-PI / 2).translate(0, 0, .5), new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: .35, depthWrite: false })); this.line.visible = false; root.add(this.line);
    ENEMIES.push(this);
  }
  setState(s) { this.st = s; this.t = 0; if (s !== 'chargeWind') this.line.visible = false; }
  hit(dmg, dx, dz, o = {}) {
    if (!this.alive) return;
    if (this.stun > 0 || this.st === 'dizzy') dmg *= 1.4;
    this.hp -= dmg; this.flash = .12; this.bar.g.visible = true; landHit(this, dmg, !!o.heavy); this.awake = true;
    this.vel.set(dx * (o.kb ?? 3), 0, dz * (o.kb ?? 3));
    if (this.hp <= 0) { this.calm(); return; }
    boarSfx.grunt(panOf(this.x, this.z));
    if (this.st !== 'charge') { this.setState('stagger'); this.stagDur = o.heavy ? .7 : .3; }
  }
  // the collar breaks and the boar becomes friendly again
  calm() {
    this.alive = false; this.setState('calm'); this.bar.g.visible = false; this.calmed = true; G.kos++; G.calmed = (G.calmed || 0) + 1;
    this.collar.c.visible = false; this.collar.tag.visible = false;
    emit(TEX.spark, new THREE.Vector3(this.x, this.y + .7, this.z), 18, { add: true, color: 0xff6060, size: .3, speed: 3, g: -3, life: .6 });
    dmgNum(new THREE.Vector3(this.x, this.y + 1.4, this.z), 'CALMED 💚', '#7dffa0', true); sfx.collect();
    if (Math.random() < .6) spawnPickup('heal', this.x, this.z, this.root, { pop: true, amt: 15 });
    if (HOOKS.onEnemyKO) HOOKS.onEnemyKO(this);
  }
  stunFor(s) { if (!this.alive) return; this.stun = s; this.setState('stunned'); this.bar.g.visible = true; }
  update(dt, t) {
    this.t += dt; this.cd -= dt; this.flash -= dt; this.stun -= dt;
    const d = Math.hypot(P.pos.x - this.x, P.pos.z - this.z), toP = Math.atan2(P.pos.x - this.x, P.pos.z - this.z), f = { x: Math.sin(this.yaw), z: Math.cos(this.yaw) };
    const playing = G.mode === 'play' && !G.busy && P.hp > 0;
    let sp = 0, mode = 'walk', tx = this.x, tz = this.z;
    switch (this.st) {
      case 'idle': mode = 'graze'; if (this.t > 3) { this.t = 0; const a = rand(0, TAU); this.tx = this.hx + Math.sin(a) * 3; this.tz = this.hz + Math.cos(a) * 3; } if (this.tx !== undefined) { tx = this.tx; tz = this.tz; sp = 1; mode = 'walk'; }
        if (this.awake && playing && d < this.aggroR * DV.aggro) { this.setState('chase'); boarSfx.squeal(panOf(this.x, this.z)); } break;
      case 'chase': if (!playing) break; this.yaw = angDamp(this.yaw, toP, 6, dt); tx = P.pos.x; tz = P.pos.z; sp = d > 2.2 ? 3.6 : 0;
        if (this.cd <= 0 && d < 12) this.setState('chargeWind'); break;
      case 'chargeWind': {
        mode = 'crouch'; this.yaw = angDamp(this.yaw, toP, 7, dt); const dur = .95 * DV.tele;
        this.line.visible = true; this.line.position.set(this.x, this.y + .07, this.z); this.line.rotation.y = this.yaw; this.line.scale.set(1.1, 1, 10); this.line.material.opacity = .2 + .2 * Math.sin(t * 25);
        if (Math.random() < dt * 14) emit(TEX.puff, new THREE.Vector3(this.x - f.x * .6, this.y + .1, this.z - f.z * .6), 1, { color: 0x7a6040, size: .35, speed: .8, g: -2, life: .4 });
        if (this.t > dur) { this.setState('charge'); this.didHit = false; boarSfx.squeal(panOf(this.x, this.z)); } break;
      }
      case 'charge': {
        sp = 0; this.speed = 12; const nx = this.x + f.x * 12 * dt, nz = this.z + f.z * 12 * dt, p = { x: nx, z: nz }; collide(p, this.radius);
        const blocked = Math.hypot(p.x - nx, p.z - nz) > .05 || !W.walkable(p.x, p.z);
        if (!blocked) { this.x = p.x; this.z = p.z; }
        if (!this.didHit && d < 1.2) { this.didHit = damagePlayer(14, this.x, this.z, 9); }
        if (Math.random() < dt * 18) emit(TEX.puff, new THREE.Vector3(this.x, this.y + .15, this.z), 1, { color: 0x7a6040, size: .45, speed: .6, g: 0, life: .5 });
        if (blocked || this.t > .95) { this.setState('dizzy'); this.cd = rand(2.2, 3.5) / DV.aggro; if (blocked) { sfx.smash(); G.shake = Math.max(G.shake, .15); } } break;
      }
      case 'dizzy': mode = 'ko'; this.speed = 0; if (Math.random() < dt * 4) emit(TEX.spark, new THREE.Vector3(this.x, this.y + 1, this.z), 1, { add: true, color: 0xfff27a, size: .2, speed: .5, g: 0, life: .5, spread: .3 }); if (this.t > 1.3) this.setState('chase'); break;
      case 'stagger': mode = 'alert'; if (this.t > this.stagDur) this.setState('chase'); break;
      case 'stunned': mode = 'ko'; if (this.stun <= 0) this.setState('chase'); break;
      case 'calm': { // trot happily away, then disappear
        mode = 'walk'; const away = Math.atan2(this.x - P.pos.x, this.z - P.pos.z); this.yaw = angDamp(this.yaw, away, 3, dt); tx = this.x + Math.sin(this.yaw) * 3; tz = this.z + Math.cos(this.yaw) * 3; sp = this.t > .8 ? 3 : 0;
        if (this.t > 4) { this.q.root.visible = false; this.dead = true; } break;
      }
    }
    if (this.st !== 'charge') {
      const dx = tx - this.x, dz = tz - this.z, l = Math.hypot(dx, dz);
      this.speed = damp(this.speed, l > .3 ? sp : 0, 5, dt);
      if (l > .3 && sp > 0 && this.st !== 'chase') this.yaw = angDamp(this.yaw, Math.atan2(dx, dz), 5, dt);
      const p = { x: this.x + (l > .01 ? dx / l * this.speed * dt : 0) + this.vel.x * dt, z: this.z + (l > .01 ? dz / l * this.speed * dt : 0) + this.vel.z * dt };
      collide(p, this.radius); if (W.walkable(p.x, p.z)) { this.x = p.x; this.z = p.z; }
    }
    this.vel.multiplyScalar(Math.exp(-dt * 6));
    if (this.alive) { const ex = this.x - P.pos.x, ez = this.z - P.pos.z, ed = Math.hypot(ex, ez); if (ed < this.radius + .3 && ed > 1e-4) { this.x = P.pos.x + ex / ed * (this.radius + .3); this.z = P.pos.z + ez / ed * (this.radius + .3); } }
    this.y = W.height(this.x, this.z);
    this.q.root.position.set(this.x, this.y, this.z); this.q.root.rotation.y = this.yaw;
    animQuad(this.q, dt, this.speed, mode, t, { wag: this.calmed ? .8 : .1, leap: this.st === 'charge' });
    const fl = this.flash > 0 ? 1 : this.st === 'chargeWind' ? .3 + .3 * Math.sin(t * 30) : 0;
    for (const m of this.mats) m.emissive.setRGB(fl, fl * (this.flash > 0 ? 1 : .15), fl * (this.flash > 0 ? 1 : .1));
    this.collar.m.emissiveIntensity = .8 + Math.sin(t * 6) * .4;
    if (this.bar.g.visible) { this.bar.g.position.set(this.x - .45, this.y + 1.3, this.z); this.bar.fg.scale.x = .9 * Math.max(0, this.hp / this.maxHp); }
  }
}
