// Trap drone: hovers out of stick reach, flashes red, dives at Pichu, then stays low for a moment.
// Hit it with the slingshot any time, or with the stick (or a jump attack) when it is low.
import { THREE, std, TEX } from '../core/engine.js';
import { G, P, W } from '../core/state.js';
import { PI, TAU, damp, angDamp, rand, DV } from '../core/utils.js';
import { sfx, panOf } from '../core/audio.js';
import { emit } from '../world/particles.js';
import { ENEMIES, HOOKS, landHit, damagePlayer } from './combat.js';
import { spawnPickup } from '../world/pickups.js';
import { makeBar } from './enemies.js';

let droneTok = 0;
export function resetDroneTokens() { droneTok = 0; }

export function makeDroneModel(bodyMat, scale = 1) {
  const g = new THREE.Group(), dark = std(0x15181c, { roughness: .4 });
  const b = new THREE.Mesh(new THREE.BoxGeometry(.5, .16, .5), bodyMat); b.castShadow = true; g.add(b);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(.16, 10, 8, 0, TAU, 0, PI / 2), bodyMat); dome.position.y = .08; g.add(dome);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3030 })); eye.position.set(0, -.02, .26); g.add(eye);
  const rotors = [];
  for (let i = 0; i < 4; i++) {
    const a = PI / 4 + i * PI / 2, arm = new THREE.Mesh(new THREE.BoxGeometry(.06, .04, .45), dark); arm.position.set(Math.sin(a) * .32, 0, Math.cos(a) * .32); arm.rotation.y = a; g.add(arm);
    const r = new THREE.Mesh(new THREE.BoxGeometry(.42, .015, .05), std(0x777777)); r.position.set(Math.sin(a) * .52, .07, Math.cos(a) * .52); g.add(r); rotors.push(r);
  }
  const net = new THREE.Mesh(new THREE.SphereGeometry(.13, 8, 6), std(0xcab88a, { roughness: 1, wireframe: true })); net.position.y = -.2; g.add(net);
  g.scale.setScalar(scale);
  return { g, eye, rotors };
}

export class Drone {
  constructor(x, z, root, opts = {}) {
    this.root = root; this.body = new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: .5, metalness: .4 });
    const m = makeDroneModel(this.body); this.g = m.g; this.eye = m.eye; this.rotors = m.rotors; root.add(this.g);
    this.x = x; this.z = z; this.hx = x; this.hz = z; this.alt = 3.2; this.curAlt = 3.2; this.yaw = 0;
    this.maxHp = Math.round(26 * DV.enemyHp); this.hp = this.maxHp; this.alive = true; this.radius = .5; this.chest = 1; this.flying = true;
    this.st = 'idle'; this.t = 0; this.cd = rand(1.5, 3); this.flash = 0; this.stun = 0; this.vel = new THREE.Vector3(); this.orbit = rand(0, TAU); this.dir = Math.random() < .5 ? 1 : -1;
    this.group = opts.group ?? 0; this.awake = !!opts.awake; this.aggroR = opts.aggro ?? 16; this.drops = opts.drops ?? true; this.tok = false;
    this.bar = makeBar(); root.add(this.bar.g); this.y = W.height(x, z) + this.alt - 1;
    ENEMIES.push(this);
  }
  setState(s) { if (this.tok && s !== 'windup' && s !== 'dive') { this.tok = false; droneTok--; } this.st = s; this.t = 0; }
  hit(dmg, dx, dz, o = {}) {
    if (!this.alive) return;
    if (this.stun > 0) dmg *= 1.3;
    this.hp -= dmg; this.flash = .12; this.bar.g.visible = true; landHit(this, dmg, !!o.heavy); this.awake = true;
    this.vel.set(dx * (o.kb ?? 3), 0, dz * (o.kb ?? 3));
    if (this.hp <= 0) { this.knockOut(); return; }
    if (this.st === 'windup' || this.st === 'dive') this.setState('low');
  }
  knockOut() {
    this.alive = false; this.setState('ko'); this.bar.g.visible = false; this.vy = 0; G.kos++; sfx.ko(panOf(this.x, this.z));
    if (this.drops) spawnPickup(Math.random() < .6 ? 'ammo' : 'heal', this.x, this.z, this.root, { pop: true, amt: Math.random() < .6 ? 3 : 12 });
    if (HOOKS.onEnemyKO) HOOKS.onEnemyKO(this);
  }
  stunFor(s) { if (!this.alive) return; this.stun = s; this.setState('stunned'); this.bar.g.visible = true; }
  update(dt, t) {
    this.t += dt; this.cd -= dt; this.flash -= dt; this.stun -= dt;
    const gh = W.height(this.x, this.z), dx = P.pos.x - this.x, dz = P.pos.z - this.z, d = Math.hypot(dx, dz);
    const playing = G.mode === 'play' && !G.busy && P.hp > 0;
    let tx = this.x, tz = this.z, sp = 0, alt = this.alt;
    const base = Math.max(gh, W.water, P.plat && d < 8 ? P.pos.y : -1e9);
    switch (this.st) {
      case 'idle': tx = this.hx + Math.sin(t * .4 + this.orbit) * 2; tz = this.hz + Math.cos(t * .3 + this.orbit) * 2; sp = 1.5; if (this.awake && playing && d < this.aggroR) { this.setState('hover'); sfx.alert(panOf(this.x, this.z)); } break;
      case 'hover':
        this.orbit += dt * .5 * this.dir; tx = P.pos.x + Math.sin(this.orbit) * 5.5; tz = P.pos.z + Math.cos(this.orbit) * 5.5; sp = 6;
        if (!playing) break;
        if (this.cd <= 0 && (this.tok || droneTok < 2)) { if (!this.tok) { this.tok = true; droneTok++; } this.setState('windup'); sfx.alert(panOf(this.x, this.z)); }
        break;
      case 'windup': if (this.t > .85 * DV.tele) { this.setState('dive'); this.tgt = new THREE.Vector3(P.pos.x, P.pos.y + .9, P.pos.z); this.didHit = false; } break;
      case 'dive': {
        const v = new THREE.Vector3(this.tgt.x - this.x, this.tgt.y - (base + this.curAlt), this.tgt.z - this.z), l = v.length();
        if (l > .3) { v.multiplyScalar(Math.min(1, 12 * dt / l)); this.x += v.x; this.z += v.z; this.curAlt += v.y; }
        if (!this.didHit && d < .9 && Math.abs(P.pos.y + .8 - (base + this.curAlt)) < 1) { this.didHit = true; damagePlayer(10, this.x, this.z, 6); }
        if (l < .4 || this.t > 1.3) { this.setState('low'); this.cd = rand(2.5, 4) / DV.aggro; }
        break;
      }
      case 'low': alt = 1.4; if (this.t > 1.8) this.setState('hover'); break;
      case 'stunned': alt = 1.1; if (Math.random() < dt * 8) emit(TEX.spark, new THREE.Vector3(this.x, base + this.curAlt, this.z), 1, { add: true, color: 0x9fd0ff, size: .25, speed: 1.5, g: -2, life: .4 }); if (this.stun <= 0) this.setState('hover'); break;
      case 'ko':
        this.vy = (this.vy || 0) - 14 * dt; this.curAlt += this.vy * dt; this.g.rotation.z += dt * 8;
        if (this.curAlt <= .1 && !this.boom) { this.boom = true; this.g.visible = false; emit(TEX.puff, new THREE.Vector3(this.x, base + .3, this.z), 14, { color: 0x666666, size: .6, speed: 2.5, g: 0, life: .8 }); emit(TEX.spark, new THREE.Vector3(this.x, base + .3, this.z), 10, { add: true, color: 0xffa040, size: .3, speed: 4, g: -6, life: .5 }); sfx.smash(); }
        if (this.t > 1.5) { this.dead = true; this.g.removeFromParent(); }
        break;
    }
    if (this.st !== 'dive' && this.st !== 'ko') {
      this.flying = this.st !== 'low' && this.st !== 'stunned';
      this.curAlt = damp(this.curAlt, alt, this.st === 'low' || this.st === 'stunned' ? 6 : 2.5, dt);
      const mx = tx - this.x, mz = tz - this.z, ml = Math.hypot(mx, mz); if (ml > .1) { const s = Math.min(ml, sp * dt); this.x += mx / ml * s; this.z += mz / ml * s; }
    } else this.flying = this.st === 'dive';
    this.x += this.vel.x * dt; this.z += this.vel.z * dt; this.vel.multiplyScalar(Math.exp(-dt * 5));
    this.yaw = angDamp(this.yaw, Math.atan2(dx, dz), 5, dt);
    const wy = base + this.curAlt + (this.st === 'ko' ? 0 : Math.sin(t * 3 + this.orbit) * .08);
    this.g.position.set(this.x, wy, this.z); this.g.rotation.y = this.yaw; if (this.st !== 'ko') this.g.rotation.x = this.st === 'dive' ? .5 : 0;
    this.y = wy - 1;
    for (const r of this.rotors) r.rotation.y += dt * 40;
    const fl = this.flash > 0 ? 1 : this.st === 'windup' ? (Math.floor(t * 14) % 2 ? .8 : 0) : 0;
    this.body.emissive.setRGB(fl, fl * (this.flash > 0 ? 1 : .1), fl * (this.flash > 0 ? 1 : .1));
    this.eye.material.color.setHex(this.st === 'windup' || this.st === 'dive' ? 0xff2020 : this.st === 'stunned' ? 0x60a0ff : 0xff9090);
    if (this.bar.g.visible) { this.bar.g.position.set(this.x - .45, wy + .6, this.z); this.bar.fg.scale.x = .9 * Math.max(0, this.hp / this.maxHp); }
  }
}
