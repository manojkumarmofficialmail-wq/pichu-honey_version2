// FINAL BOSS — KAALA (Edakkal Caves, Wayanad)
// Phase 1 (staff master): staff combo, spinning sweep, dash strike, staff-slam shockwave; calls two poachers.
// Phase 2 (smoke & mirrors, below 2/3 health): vanishes in smoke and returns with two fake copies that
//   throw bolas. Fakes pop in one hit. Honey's BARK (or hitting the real one) breaks the trick; SNIFF
//   leads you to the real Kaala.
// Phase 3 (the cave shakes, below 1/3): rocks fall from the roof (red circles), Kaala is faster and
//   sends his last drones.
import { THREE, M, S, std, TEX } from '../core/engine.js';
import { G, P, W } from '../core/state.js';
import { PI, TAU, clamp, damp, angDamp, lerp, rand, pick, DV, buzz } from '../core/utils.js';
import { sfx, panOf } from '../core/audio.js';
import { emit, ring, dmgNum } from '../world/particles.js';
import { animHuman } from '../actors/human.js';
import { ENEMIES, landHit, damagePlayer, spawnProjectile } from './combat.js';
import { bossBar, dialog } from '../core/ui.js';
import { BossBase } from './bosses2.js';
import { Enemy } from './enemies.js';
import { Drone } from './drone.js';
import { makeKaala } from '../world/props3.js';

const smoke = p => { emit(TEX.puff, p.clone().setY(p.y + 1), 30, { color: 0x4a4a52, size: 1.3, speed: 2.5, g: .3, life: 1.4, spread: 1 }); sfx.smash(); };
function bola(from, to, slow = 1.4) {
  const d = to.clone().sub(from), dh = Math.hypot(d.x, d.z), tt = clamp(dh / 12, .35, 1.3), g = 6;
  spawnProjectile({ pos: from, vel: new THREE.Vector3(d.x / tt, (d.y + .5 * g * tt * tt) / tt, d.z / tt), owner: 'enemy', dmg: 10, r: .16, g, life: 3, kb: 3, glow: 0xff6060, onHit: () => { P.slowT = slow; } });
}

/* ---------- a smoke copy of Kaala: one hit and it's gone ---------- */
class KaalaClone {
  constructor(boss, x, z) {
    this.boss = boss; this.k = makeKaala(false); boss.root.add(this.k.root); this.x = x; this.z = z; this.y = W.height(x, z); this.yaw = 0;
    this.radius = .7; this.chest = 1.7; this.alive = true; this.awake = true; this.isClone = true; this.t = rand(0, 1); this.throwT = rand(1.2, 2.6);
    ENEMIES.push(this); smoke(new THREE.Vector3(x, this.y, z));
  }
  hit() { this.poof(true); }
  stunFor() { this.poof(false); }
  poof(byHit) {
    if (!this.alive) return; this.alive = false; this.dead = true; smoke(new THREE.Vector3(this.x, this.y, this.z)); this.k.root.removeFromParent();
    if (byHit && !this.boss.toldFake) { this.boss.toldFake = true; dialog('Pichu', 'A fake! It was just smoke! Honey can smell the real Kaala — BARK, Honey! (or SNIFF to find him)', 4.5); }
  }
  update(dt, t) {
    if (!this.alive) return; this.t += dt; this.throwT -= dt;
    this.yaw = angDamp(this.yaw, Math.atan2(P.pos.x - this.x, P.pos.z - this.z), 6, dt);
    let mode = 'taunt', k = 0;
    if (this.throwT < .7) { mode = 'throwWind'; k = 1 - this.throwT / .7; }
    if (this.throwT <= 0 && G.mode === 'play') { this.throwT = rand(2.4, 3.6) / DV.aggro; mode = 'throw'; sfx.throwS(); bola(new THREE.Vector3(this.x, this.y + 2.2, this.z), P.pos.clone().setY(P.pos.y + .6)); }
    this.k.root.position.set(this.x, this.y, this.z); this.k.root.rotation.y = this.yaw; animHuman(this.k, dt, 0, mode, t, k);
  }
}

/* ---------- rocks falling from the cave roof ---------- */
class RockFall {
  constructor(root) { this.root = root; this.L = []; }
  drop(x, z, delay) {
    const warn = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.3, 24).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: .7, depthWrite: false }));
    const y = W.height(x, z); warn.position.set(x, y + .05, z); this.root.add(warn);
    const rock = M(new THREE.DodecahedronGeometry(.75, 0), std(0x4a4038, { flatShading: true }), x, y + 14, z, this.root); rock.visible = false;
    this.L.push({ x, z, y, warn, rock, t: 0, delay, hit: false });
  }
  update(dt, t) {
    for (let i = this.L.length - 1; i >= 0; i--) {
      const r = this.L[i]; r.t += dt; r.warn.material.opacity = .4 + .3 * Math.sin(t * 14);
      if (r.t > r.delay - .45) { r.rock.visible = true; const k = clamp((r.t - (r.delay - .45)) / .45, 0, 1); r.rock.position.y = r.y + 14 - k * k * 13.3; r.rock.rotation.x += dt * 5; }
      if (r.t >= r.delay && !r.hit) {
        r.hit = true; sfx.smash(); G.shake = Math.max(G.shake, .25); emit(TEX.puff, new THREE.Vector3(r.x, r.y + .3, r.z), 12, { color: 0x6a5a4a, size: .8, speed: 3, g: -2, life: .8 });
        if (Math.hypot(P.pos.x - r.x, P.pos.z - r.z) < 1.35) damagePlayer(15, r.x, r.z, 7);
      }
      if (r.t > r.delay + .6) { r.warn.removeFromParent(); r.rock.removeFromParent(); this.L.splice(i, 1); }
    }
  }
  clear() { for (const r of this.L) { r.warn.removeFromParent(); r.rock.removeFromParent(); } this.L = []; }
}

export class Kaala extends BossBase {
  constructor(root, arena, x, z, o = {}) {
    super(root, x, z, { ...o, name: 'KAALA', arena });
    this.h = makeKaala(false); this.h.root.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.userData = {}; } }); root.add(this.h.root);
    this.footMax = Math.round(640 * DV.enemyHp); this.maxHp = this.footMax; this.hp = this.maxHp; this.phase = 1; this.radius = .75; this.chest = 1.8; this.tall = 1;
    this.clones = []; this.rocks = new RockFall(root); this.summonT = 10; this.rockT = 3; this.trickT = 0; this.droneWave = 0;
    this.wave = new THREE.Mesh(new THREE.RingGeometry(.9, 1, 48).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: 0xff4040, transparent: true, opacity: .9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); this.wave.visible = false; root.add(this.wave); this.waveR = -1;
    this.line = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1).rotateX(-PI / 2).translate(0, 0, .5), new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: .35, depthWrite: false })); this.line.visible = false; root.add(this.line);
    this.onPhase = o.onPhase;
  }
  get hidden() { return this.st === 'vanish'; }
  hit(dmg, dx, dz, o = {}) {
    if (!this.alive || !this.awake || this.hidden || this.st === 'shift') return;
    if (this.st === 'trick') { this.endTrick(true); }
    if (this.stun > 0 || this.st === 'stagger') dmg *= 1.3;
    this.hp -= dmg; this.flash = .12; landHit(this, dmg, !!o.heavy); bossBar(this.name, this.hp / this.maxHp);
    if (this.hp <= 0) { this.hp = 0; this.cleanup(); this.defeat(); return; }
    if (this.phase === 1 && this.hp < this.maxHp * .66) { this.shift(2); return; }
    if (this.phase === 2 && this.hp < this.maxHp * .33) { this.shift(3); return; }
    if (this.st !== 'trick') this.footHit(dmg, dx, dz, o, ['comboWind', 'strike', 'spinWind', 'spin', 'dashWind', 'dash', 'slamWind', 'slam']);
  }
  stunFor(s) {
    if (!this.alive || this.hidden || this.st === 'shift') return;
    if (this.st === 'trick') { this.endTrick(true); dialog('Pichu', 'Good girl, Honey! You found the real Kaala!', 2.5); }
    this.stun = Math.min(s, 1.6); this.setState('stunned');
  }
  shift(n) {
    this.phase = n; this.setState('shift'); this.endTrick(false); sfx.roar(); G.shake = .6; ring(new THREE.Vector3(this.x, this.y, this.z), 14, 0xff3030, .8);
    if (n === 2) dialog('Kaala', 'Enough! Let\'s see if you can catch a shadow…', 3);
    else { dialog('Kaala', 'You want your puppy? Then come and get her — if the cave doesn\'t fall on you first!', 4); }
    this.onPhase && this.onPhase(n);
  }
  endTrick(reveal) {
    for (const c of this.clones) c.poof(false); this.clones = [];
    if (reveal && this.st === 'trick') { this.setState('stagger'); this.stagDur = 1.6; this.trickT = 8; }
  }
  cleanup() { this.endTrick(false); this.rocks.clear(); this.wave.visible = false; this.waveR = -1; this.line.visible = false; for (const e of ENEMIES) if (e.group === 98 && e.alive) e.knockOut ? e.knockOut(0, 1) : (e.alive = false); }
  startTrick() {
    // vanish, then reappear at one of three spots around Pichu; the other two are fakes
    smoke(new THREE.Vector3(this.x, this.y, this.z)); this.setState('vanish'); this.h.root.visible = false;
  }
  update(dt, t) {
    this.t += dt; this.cd -= dt; this.flash -= dt; this.stun -= dt; this.summonT -= dt; this.rockT -= dt; this.trickT -= dt;
    const playing = G.mode === 'play' && !G.busy && P.hp > 0 && this.awake;
    const d = Math.hypot(P.pos.x - this.x, P.pos.z - this.z), toP = Math.atan2(P.pos.x - this.x, P.pos.z - this.z), f = { x: Math.sin(this.yaw), z: Math.cos(this.yaw) };
    const tele = DV.tele * (this.phase === 3 ? .85 : 1), spd = this.phase === 3 ? 3.9 : 3.3;
    this.clones = this.clones.filter(c => c.alive); this.rocks.update(dt, t);
    let sp = 0, mode = 'idle', k = 0, tx = this.x, tz = this.z;
    if (playing && this.phase >= 1 && this.summonT <= 0 && this.st === 'chase') {
      const helpers = ENEMIES.filter(e => e.group === 98 && e.alive).length;
      this.summonT = this.phase === 3 ? 16 : 20;
      if (helpers < 2) {
        if (this.phase === 3 && this.droneWave < 2) { this.droneWave++; [[-5, 3], [5, 3]].forEach(([dx, dz]) => { const dr = new Drone(this.x + dx, this.z + dz, this.root, { group: 98, awake: true }); dr.curAlt = 5; }); dialog('Kaala', 'Drones! Get him!', 1.8); }
        else if (this.phase !== 2) { [[-6, 4], [6, 4]].forEach(([dx, dz]) => { const e = new Enemy(pick(['grunt', 'slinger']), clamp(this.x + dx, this.arena.x - 12, this.arena.x + 12), this.z + dz, this.root, { group: 98, awake: true }); smoke(new THREE.Vector3(e.x, e.y, e.z)); }); dialog('Kaala', pick(['Men! Take care of this boy!', 'Get him!']), 1.8); }
      }
    }
    if (playing && this.phase === 3 && this.rockT <= 0) { this.rockT = rand(1.8, 2.6); for (let i = 0; i < 2; i++) { const a = rand(0, TAU), r = i ? rand(0, 1.2) : rand(2, 4); this.rocks.drop(P.pos.x + Math.sin(a) * r, P.pos.z + Math.cos(a) * r, 1.1 * DV.tele + .2); } }
    switch (this.st) {
      case 'idle': mode = 'taunt'; if (playing) { this.setState('chase'); this.cd = 1.2; } break;
      case 'shift': mode = 'taunt'; if (this.t > 1.8) { this.setState('chase'); this.cd = .4; if (this.phase === 2) this.trickT = 0; } break;
      case 'chase':
        if (!playing) break; mode = 'walk'; this.yaw = angDamp(this.yaw, toP, 6, dt); tx = P.pos.x; tz = P.pos.z; sp = d > 2.6 ? spd : 0;
        if (this.phase === 2 && this.trickT <= 0) { this.startTrick(); break; }
        if (this.cd <= 0) this.setState(d < 3.2 ? pick(['comboWind', 'comboWind', 'spinWind', 'slamWind']) : pick(['dashWind', 'slamWind', 'dashWind', 'throw']));
        break;
      case 'comboWind': { mode = 'windup'; const dur = (this.combo ? .4 : .7) * tele; k = this.t / dur; this.yaw = angDamp(this.yaw, toP, 5, dt); if (this.t < dt * 1.5) ring(new THREE.Vector3(this.x, this.y, this.z), 5.5, 0xff3030, dur); if (k >= 1) { this.setState('strike'); this.didHit = false; sfx.swing(2); } break; }
      case 'strike':
        mode = 'strike'; k = this.t / .42; if (this.t < .14) { tx = this.x + f.x; tz = this.z + f.z; sp = 6; }
        if (!this.didHit && this.t > .14) { this.didHit = true; const dx = P.pos.x - this.x, dz = P.pos.z - this.z, dd = Math.hypot(dx, dz) || 1; if (dd < 3 && (dx * f.x + dz * f.z) / dd > .1) damagePlayer(16, this.x, this.z, 8); }
        if (this.t > .42) { this.combo = (this.combo || 0) + 1; if (this.combo < (this.phase === 3 ? 3 : 2)) this.setState('comboWind'); else { this.combo = 0; this.setState('chase'); this.cd = rand(.9, 1.6); } }
        break;
      case 'spinWind': mode = 'windup'; k = this.t / (.85 * tele); if (this.t < dt * 1.5) ring(new THREE.Vector3(this.x, this.y, this.z), 7, 0xff3030, .85 * tele); if (k >= 1) { this.setState('spin'); this.didHit = false; this.spin = 0; } break;
      case 'spin': mode = 'strike'; k = (this.t * 2.5) % 1; this.spin = (this.spin || 0) + dt * 15; tx = P.pos.x; tz = P.pos.z; sp = 3; if (Math.random() < dt * 8) sfx.swing(1);
        if (!this.didHit && d < 3 && P.pos.y - W.height(P.pos.x, P.pos.z) < .5) this.didHit = damagePlayer(15, this.x, this.z, 9);
        if (this.t > 1.1) { this.setState('chase'); this.cd = rand(1, 1.6); } break;
      case 'dashWind': { mode = 'windup'; const dur = .85 * tele; k = this.t / dur; this.yaw = angDamp(this.yaw, toP, 7, dt); this.line.visible = true; this.line.position.set(this.x, this.y + .08, this.z); this.line.rotation.y = this.yaw; this.line.scale.set(1, 1, 10); this.line.material.opacity = .2 + .25 * Math.sin(t * 25); if (k >= 1) { this.line.visible = false; this.setState('dash'); this.didHit = false; sfx.dodge(); } break; }
      case 'dash': mode = 'strike'; k = .3; this.moveTo(this.x + f.x * 3, this.z + f.z * 3, 16, dt, true); if (!this.didHit && d < 1.6) { this.didHit = true; damagePlayer(17, this.x, this.z, 10); } if (Math.random() < dt * 30) emit(TEX.puff, new THREE.Vector3(this.x, this.y + .3, this.z), 1, { color: 0x3a3a42, size: .6, speed: .5, g: 0, life: .5 }); if (this.t > .5) { this.setState('chase'); this.cd = rand(1, 1.8); } break;
      case 'slamWind': mode = 'slamWind'; k = this.t / (1 * tele); if (this.t < dt * 1.5) ring(new THREE.Vector3(this.x, this.y, this.z), 16, 0xff4040, 1 * tele); if (k >= 1) { this.setState('slam'); sfx.smash(); G.shake = .55; buzz(70); this.waveR = 0; this.waveHit = false; } break;
      case 'slam': mode = 'slam'; k = .5 + this.t; if (this.t > .9) { this.setState('chase'); this.cd = rand(1.2, 2); } break;
      case 'throw': mode = 'throw'; k = this.t / .4; if (this.t < dt * 1.5) { sfx.throwS(); bola(new THREE.Vector3(this.x, this.y + 2.3, this.z), P.pos.clone().setY(P.pos.y + .6), 1.6); } if (this.t > .5) { this.setState('chase'); this.cd = rand(.8, 1.4); } break;
      case 'vanish':
        if (this.t > .9) {
          const base = rand(0, TAU), spots = [0, 1, 2].map(i => { const a = base + i * TAU / 3; return { x: clamp(P.pos.x + Math.sin(a) * 6.5, this.arena.x - 13, this.arena.x + 13), z: clamp(P.pos.z + Math.cos(a) * 6.5, this.arena.z - 13, this.arena.z + 13) }; });
          const real = Math.random() * 3 | 0;
          spots.forEach((s, i) => { if (i === real) { this.x = s.x; this.z = s.z; smoke(new THREE.Vector3(s.x, W.height(s.x, s.z), s.z)); } else this.clones.push(new KaalaClone(this, s.x, s.z)); });
          this.h.root.visible = true; this.setState('trick'); this.throwT = rand(1, 2);
          if (!this.toldTrick) { this.toldTrick = true; dialog('Pichu', 'Three Kaalas?! Only one is real… Honey, sniff him out!', 3.5); }
        }
        break;
      case 'trick':
        mode = 'taunt'; this.yaw = angDamp(this.yaw, toP, 6, dt); this.throwT -= dt;
        if (this.throwT < .7) { mode = 'throwWind'; k = 1 - this.throwT / .7; }
        if (this.throwT <= 0 && playing) { this.throwT = rand(2.2, 3.2) / DV.aggro; sfx.throwS(); bola(new THREE.Vector3(this.x, this.y + 2.2, this.z), P.pos.clone().setY(P.pos.y + .6)); }
        if (this.t > 9) { this.endTrick(false); this.setState('chase'); this.trickT = 5; this.cd = .5; }
        break;
      case 'stagger': mode = 'stagger'; if (this.t > this.stagDur) { this.setState('chase'); this.cd = Math.min(this.cd, .8); if (this.trickT < 4) this.trickT = 7; } break;
      case 'stunned': mode = 'stun'; if (this.stun <= 0) { this.setState('chase'); if (this.trickT < 4) this.trickT = 7; } break;
      case 'defeated': mode = 'stun'; break;
    }
    if (this.st !== 'dash' && this.st !== 'vanish' && this.st !== 'trick') this.moveTo(tx, tz, sp, dt);
    if (this.waveR >= 0) {
      this.waveR += dt * 11; const r = this.waveR; this.wave.visible = true; this.wave.position.set(this.x, this.y + .15, this.z); this.wave.scale.setScalar(Math.max(r, .01)); this.wave.material.opacity = Math.max(0, 1 - r / 10);
      if (!this.waveHit && Math.abs(d - r) < .7 && P.pos.y - W.height(P.pos.x, P.pos.z) < .35) { this.waveHit = true; damagePlayer(18, this.x, this.z, 9); }
      if (r > 10) { this.waveR = -1; this.wave.visible = false; }
    }
    this.y = W.height(this.x, this.z); this.noAim = this.hidden;
    this.h.root.position.set(this.x, this.y, this.z); this.h.root.rotation.y = this.yaw + (this.st === 'spin' ? this.spin : 0);
    animHuman(this.h, dt, this.speed, mode, t, k); this.flashMats(this.h.mats, this.st.includes('Wind'));
  }
  resetFight() {
    this.cleanup(); this.poise = 0; this.h.root.visible = true;
    this.hp = Math.max(this.hp, this.maxHp * (this.phase === 1 ? 1 : this.phase === 2 ? .66 : .33)); bossBar(this.name, this.hp / this.maxHp);
    this.x = this.arena.x; this.z = this.arena.z - 5; this.setState('chase'); this.cd = 2; this.trickT = 3; this.summonT = 12; this.rockT = 3;
  }
}
