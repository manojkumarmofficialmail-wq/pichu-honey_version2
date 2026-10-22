// Phase 2 bosses.
// JEEP TRAPPER (Periyar): drives circles dropping bear traps, revs up and rams. Dodge so he crashes into a
//   rock pillar — then he is dazed and his jeep can be smashed. When the jeep is wrecked he fights on foot
//   with a spinning net-club, trap throws and nets.
// DRONE MASTER (Eravikulam): stands on a rock behind a shield powered by 3 antennas and sends drones.
//   Break the antennas, then fight him on the ground: baton combo, dash strike and an electric shockwave.
import { THREE, M, S, B, CY, std, TEX } from '../core/engine.js';
import { G, P, W } from '../core/state.js';
import { PI, TAU, clamp, damp, angDamp, lerp, rand, pick, DV, buzz, smooth } from '../core/utils.js';
import { sfx, panOf } from '../core/audio.js';
import { collide } from '../world/terrain.js';
import { emit, ring, dmgNum } from '../world/particles.js';
import { makeHuman, animHuman } from '../actors/human.js';
import { ENEMIES, HOOKS, landHit, damagePlayer, spawnProjectile } from './combat.js';
import { bossBar, dialog } from '../core/ui.js';
import { Drone } from './drone.js';

export class BossBase {
  constructor(root, x, z, o) {
    this.root = root; this.boss = true; this.x = x; this.z = z; this.y = W.height(x, z); this.yaw = o.yaw ?? 0;
    this.radius = .7; this.chest = 1.5; this.tall = .6; this.alive = true; this.awake = false; this.group = 99;
    this.st = 'idle'; this.t = 0; this.cd = 1.5; this.flash = 0; this.stun = 0; this.vel = new THREE.Vector3(); this.speed = 0; this.poise = 0;
    this.arena = o.arena; this.name = o.name; ENEMIES.push(this);
  }
  setState(s) { this.st = s; this.t = 0; }
  defeat() { this.alive = false; this.setState('defeated'); bossBar(null); sfx.ko(); G.shake = .5; buzz([80, 40, 120]); if (HOOKS.onEnemyKO) HOOKS.onEnemyKO(this); }
  clampArena(p, pad = 1) { const a = this.arena; if (!a) return; const ax = p.x - a.x, az = p.z - a.z, ad = Math.hypot(ax, az); if (ad > a.r - pad) { p.x = a.x + ax / ad * (a.r - pad); p.z = a.z + az / ad * (a.r - pad); return true; } return false; }
  moveTo(tx, tz, sp, dt, force) {
    const dx = tx - this.x, dz = tz - this.z, l = Math.hypot(dx, dz);
    this.speed = force ? sp : damp(this.speed, l > .3 ? sp : 0, 6, dt);
    const p = { x: this.x + (l > .01 ? dx / l * this.speed : 0) * dt + this.vel.x * dt, z: this.z + (l > .01 ? dz / l * this.speed : 0) * dt + this.vel.z * dt };
    this.vel.multiplyScalar(Math.exp(-dt * 6)); collide(p, this.radius); this.clampArena(p);
    const ex = p.x - P.pos.x, ez = p.z - P.pos.z, ed = Math.hypot(ex, ez); if (this.alive && ed < this.radius + .3 && ed > 1e-4) { p.x = P.pos.x + ex / ed * (this.radius + .3); p.z = P.pos.z + ez / ed * (this.radius + .3); }
    this.x = p.x; this.z = p.z;
  }
  flashMats(mats, warn) {
    const fl = this.flash > 0 ? 1 : warn ? .3 + .3 * Math.sin(performance.now() * .03) : 0;
    for (const m of mats) m.material.emissive.setRGB(fl, fl * (this.flash > 0 ? 1 : .2), fl * (this.flash > 0 ? 1 : .1));
  }
  // shared on-foot stagger rules: armoured while attacking, poise breaks after enough damage
  footHit(dmg, dx, dz, o, armoredStates) {
    this.poise += dmg;
    if (this.poise > this.footMax * .25) { this.poise = 0; this.setState('stagger'); this.stagDur = 1.4; sfx.grunt(); return; }
    if (!armoredStates.includes(this.st) && (o.heavy || Math.random() < .3)) { this.setState('stagger'); this.stagDur = o.heavy ? .6 : .3; this.vel.set(dx * 3, 0, dz * 3); }
  }
}

/* ---------- bear traps ---------- */
class Traps {
  constructor(root) { this.root = root; this.L = []; }
  drop(x, z, delay = .4) {
    const g = new THREE.Group(); g.position.set(x, W.height(x, z) + .03, z); this.root.add(g); const m = std(0x8a8a8a, { metalness: .7, roughness: .4 });
    M(new THREE.TorusGeometry(.32, .04, 6, 16), m, 0, .03, 0, g).rotation.x = PI / 2;
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, tth = M(new THREE.ConeGeometry(.04, .14, 4), m, Math.cos(a) * .3, .08, Math.sin(a) * .3, g); }
    const warn = new THREE.Mesh(new THREE.RingGeometry(.4, .5, 20).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: .6, depthWrite: false })); warn.position.y = .02; g.add(warn);
    this.L.push({ g, x, z, t: 0, delay, warn, gone: false });
  }
  update(dt, t) {
    for (const tr of this.L) {
      if (tr.gone) continue; tr.t += dt; tr.warn.material.opacity = .3 + .3 * Math.sin(t * 10);
      if (tr.t > 14) { tr.gone = true; tr.g.removeFromParent(); continue; }
      if (tr.t > tr.delay && Math.hypot(P.pos.x - tr.x, P.pos.z - tr.z) < .6 && P.ground && damagePlayer(12, tr.x, tr.z + .01, 2)) {
        P.slowT = 1.6; tr.gone = true; sfx.block(); emit(TEX.spark, tr.g.position, 8, { add: true, color: 0xffffff, size: .2, speed: 2, g: -4, life: .3 }); tr.g.removeFromParent();
        dialog('Pichu', 'Ow! A trap! Watch the red circles!', 2);
      }
    }
  }
  clear() { for (const tr of this.L) tr.g.removeFromParent(); this.L = []; }
}

function jeepModel() {
  const g = new THREE.Group(), body = new THREE.MeshStandardMaterial({ color: 0x4a5a2a, roughness: .7 }), dark = std(0x111111, { roughness: .6 });
  M(B(1.8, .7, 3.4), body, 0, .85, 0, g); M(B(1.8, .25, 1.2), body, 0, 1.3, 1.1, g);
  M(B(1.6, .5, .05), std(0x8ab0c0, { roughness: .1, metalness: .3 }), 0, 1.55, .45, g);
  const wheels = []; for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const w = M(CY(.4, .4, .32, 14), dark, sx * .95, .4, sz * 1.15, g); w.rotation.z = PI / 2; wheels.push(w); }
  M(B(1.9, .2, .3), std(0x777777, { metalness: .6 }), 0, .7, 1.75, g); // bumper
  for (const s of [-1, 1]) M(S(.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }), s * .6, .95, 1.72, g);
  M(B(1.6, .9, .9), std(0x6a5030, { roughness: 1 }), 0, 1.35, -1.1, g); // cage in the back
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { g, body, wheels };
}

export class JeepTrapper extends BossBase {
  constructor(root, x, z, o = {}) {
    super(root, x, z, { ...o, name: 'The Jeep Trapper' });
    this.jeep = jeepModel(); root.add(this.jeep.g);
    this.h = makeHuman({ scale: 1.25, skin: 0x8a5a3a, shirt: 0x7a3a2a, vest: 0x3a2a1a, pants: 0x2a2a20, hat: 'cap', hatCol: 0xc0a040, weapon: 'net', belly: 1.2 });
    this.h.root.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.userData = {}; } }); root.add(this.h.root);
    this.jeepMax = Math.round(260 * DV.enemyHp); this.jeepHp = this.jeepMax; this.footMax = Math.round(240 * DV.enemyHp); this.footHp = this.footMax;
    this.maxHp = this.jeepMax + this.footMax; this.hp = this.maxHp; this.phase = 1; this.radius = 1.5; this.chest = 1.2;
    this.pillars = o.pillars || []; this.traps = new Traps(root); this.ang = 0; this.trapT = 2;
    this.line = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1).rotateX(-PI / 2).translate(0, 0, .5), new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: .35, depthWrite: false })); this.line.visible = false; root.add(this.line);
    this.smokeT = 0;
  }
  hit(dmg, dx, dz, o = {}) {
    if (!this.alive || !this.awake || this.st === 'bail') return;
    if (this.phase === 1) {
      const dazed = this.st === 'crashed';
      if (!dazed) { if (o.ranged) { dmg = 3; } else { landHit(this, 0, false, true); if (!this.told) { this.told = true; dialog('Pichu', "My stick just bounces off the jeep! I need to make him crash into a rock pillar!", 4); } return; } }
      else dmg *= 1.5;
      this.jeepHp -= dmg; this.flash = .12; landHit(this, dmg, !!o.heavy); this.hp = Math.max(0, this.jeepHp) + this.footHp; bossBar(this.name, this.hp / this.maxHp);
      if (this.jeepHp <= 0) this.wreck();
      return;
    }
    if (this.stun > 0 || this.st === 'stagger') dmg *= 1.3;
    this.footHp -= dmg; this.hp = Math.max(0, this.footHp); this.flash = .12; landHit(this, dmg, !!o.heavy); bossBar(this.name, this.hp / this.maxHp);
    if (this.footHp <= 0) { this.defeat(); return; }
    this.footHit(dmg, dx, dz, o, ['spinWind', 'spin', 'throwWind', 'throw', 'trapWind']);
  }
  stunFor(s) { if (!this.alive) return; if (this.phase === 1) { if (this.st === 'circle') { this.setState('aim'); this.cd = 0; } return; } this.stun = s; this.setState('stunned'); }
  wreck() {
    this.phase = 2; this.setState('bail'); this.line.visible = false; sfx.smash(); sfx.roar(); G.shake = .7; this.radius = .7; this.chest = 1.5;
    emit(TEX.puff, new THREE.Vector3(this.x, this.y + 1.5, this.z), 40, { color: 0x333333, size: 1.4, speed: 3, g: .5, life: 2, spread: 1 });
    emit(TEX.spark, new THREE.Vector3(this.x, this.y + 1.2, this.z), 30, { add: true, color: 0xff8a20, size: .5, speed: 5, g: -4, life: .8 });
    this.jeep.body.color.set(0x2a2a20); this.wreckPos = { x: this.x, z: this.z, yaw: this.yaw };
    dialog('The Jeep Trapper', 'MY JEEP! You little pest — now I\'ll catch you myself!', 3.5);
    this.collideJeep = { x: this.x, z: this.z };
  }
  update(dt, t) {
    this.t += dt; this.cd -= dt; this.flash -= dt; this.stun -= dt; this.trapT -= dt;
    const playing = G.mode === 'play' && !G.busy && P.hp > 0 && this.awake, a = this.arena;
    const d = Math.hypot(P.pos.x - this.x, P.pos.z - this.z), toP = Math.atan2(P.pos.x - this.x, P.pos.z - this.z), f = { x: Math.sin(this.yaw), z: Math.cos(this.yaw) };
    this.traps.update(dt, t);
    if (this.phase === 1) this.updJeep(dt, t, playing, d, toP, f, a); else this.updFoot(dt, t, playing, d, toP, f);
    if (this.jeepHp <= 0 && Math.random() < dt * 6) emit(TEX.puff, new THREE.Vector3(this.wreckPos.x, W.height(this.wreckPos.x, this.wreckPos.z) + 1.8, this.wreckPos.z), 1, { color: 0x333333, size: 1, speed: .8, up0: 1, up1: 2, g: .5, life: 2.5, grow: 1.5 });
  }
  updJeep(dt, t, playing, d, toP, f, a) {
    let sp = 0, mode = 'idle';
    switch (this.st) {
      case 'idle': if (playing) this.setState('circle'); break;
      case 'circle': {
        this.ang += dt * .45; const r = a.r * .62, tx = a.x + Math.sin(this.ang) * r, tz = a.z + Math.cos(this.ang) * r;
        const want = Math.atan2(tx - this.x, tz - this.z); this.yaw = angDamp(this.yaw, want, 3, dt); sp = 7;
        this.x += Math.sin(this.yaw) * sp * dt; this.z += Math.cos(this.yaw) * sp * dt;
        if (this.trapT <= 0) { this.trapT = rand(1.6, 2.6); this.traps.drop(this.x - f.x * 2.2, this.z - f.z * 2.2, .3); sfx.block(); }
        if (this.cd <= 0 && playing) this.setState('aim');
        break;
      }
      case 'aim': {
        this.yaw = angDamp(this.yaw, toP, 5, dt); const dur = 1.2 * DV.tele;
        this.line.visible = true; this.line.position.set(this.x, this.y + .08, this.z); this.line.rotation.y = this.yaw; this.line.scale.set(1, 1, 16); this.line.material.opacity = .2 + .25 * Math.sin(t * 25);
        if (Math.random() < dt * 12) emit(TEX.puff, new THREE.Vector3(this.x - f.x * 1.9, this.y + .4, this.z - f.z * 1.9), 1, { color: 0x555555, size: .5, speed: 1, g: .3, life: .6 });
        if (this.t < dt * 1.5) { sfx.roar(); dialog('The Jeep Trapper', pick(['Out of my way, kid!', 'VROOOM! Ha ha!', 'Here I come!']), 1.6); }
        if (this.t > dur) { this.line.visible = false; this.setState('ram'); this.didHit = false; }
        break;
      }
      case 'ram': {
        sp = 16; const nx = this.x + f.x * sp * dt, nz = this.z + f.z * sp * dt; let crash = null;
        for (const p of this.pillars) if (Math.hypot(nx - p.x, nz - p.z) < p.r + 1.3) crash = 'pillar';
        if (!crash && Math.hypot(nx - a.x, nz - a.z) > a.r - 1.6) crash = 'edge';
        if (!this.didHit && d < 2) { this.didHit = true; damagePlayer(22, this.x - f.x, this.z - f.z, 13); }
        if (crash) {
          this.setState('crashed'); this.crashKind = crash; sfx.smash(); G.shake = .55; buzz(60);
          emit(TEX.spark, new THREE.Vector3(nx, this.y + 1, nz), 16, { add: true, color: 0xfff27a, size: .35, speed: 4, g: -4, life: .6 });
          dialog('Pichu', crash === 'pillar' ? 'He crashed! Smash the jeep now!' : 'He hit the rocks! Quick, attack!', 2);
        } else { this.x = nx; this.z = nz; }
        if (this.t > 2) { this.setState('circle'); this.cd = rand(2.5, 4); }
        if (Math.random() < dt * 20) emit(TEX.puff, new THREE.Vector3(this.x, this.y + .3, this.z), 1, { color: 0xb8a080, size: .7, speed: 1, g: 0, life: .7 });
        break;
      }
      case 'crashed': {
        const dur = (this.crashKind === 'pillar' ? 4 : 2.6) / Math.max(.8, DV.aggro);
        if (Math.random() < dt * 5) emit(TEX.spark, new THREE.Vector3(this.x, this.y + 2.3, this.z), 1, { add: true, color: 0xfff27a, size: .3, speed: .5, g: 0, life: .7, spread: .5 });
        if (this.t > dur) { this.setState('reverse'); }
        break;
      }
      case 'reverse': this.x -= f.x * 4 * dt; this.z -= f.z * 4 * dt; if (this.t > .8) { this.setState('circle'); this.cd = rand(3, 5) / DV.aggro; this.ang = Math.atan2(this.x - a.x, this.z - a.z); } break;
      case 'defeated': break;
    }
    const p = { x: this.x, z: this.z }; this.clampArena(p, 1.2); this.x = p.x; this.z = p.z;
    // the jeep pushes Pichu aside
    const ex = P.pos.x - this.x, ez = P.pos.z - this.z, ed = Math.hypot(ex, ez); if (ed < 1.7 && ed > .01) { P.pos.x = this.x + ex / ed * 1.7; P.pos.z = this.z + ez / ed * 1.7; }
    this.y = W.height(this.x, this.z);
    const jg = this.jeep.g; jg.position.set(this.x, this.y, this.z); jg.rotation.y = this.yaw; jg.rotation.z = this.st === 'crashed' ? Math.sin(this.t * 20) * .02 * Math.max(0, 1 - this.t) : 0;
    for (const w of this.jeep.wheels) w.rotation.x += (this.st === 'ram' ? 30 : this.st === 'circle' ? 15 : 0) * dt;
    // driver sits in the jeep
    this.h.root.position.set(this.x + Math.sin(this.yaw) * .1 - Math.cos(this.yaw) * .4, this.y + .45, this.z + Math.cos(this.yaw) * .1 + Math.sin(this.yaw) * .4); this.h.root.rotation.y = this.yaw;
    animHuman(this.h, dt, 0, this.st === 'crashed' ? 'stun' : this.st === 'aim' ? 'taunt' : 'idle', t);
    const fl = this.flash > 0 ? 1 : this.st === 'aim' ? .3 + .3 * Math.sin(t * 30) : 0; this.jeep.body.emissive.setRGB(fl, fl * (this.flash > 0 ? 1 : .2), fl * (this.flash > 0 ? 1 : .1));
  }
  updFoot(dt, t, playing, d, toP, f) {
    let sp = 0, mode = 'idle', k = 0, tx = this.x, tz = this.z;
    switch (this.st) {
      case 'bail': { // jumps out of the wreck
        mode = 'stagger'; const k2 = Math.min(1, this.t / .8); const side = { x: Math.cos(this.wreckPos.yaw) * 2.5, z: -Math.sin(this.wreckPos.yaw) * 2.5 };
        this.x = this.wreckPos.x + side.x * k2; this.z = this.wreckPos.z + side.z * k2; this.jy = Math.sin(k2 * PI) * 1.5;
        if (this.t > 1.2) { this.jy = 0; this.setState('chase'); this.cd = 1; } break;
      }
      case 'chase': if (!playing) break; mode = 'walk'; this.yaw = angDamp(this.yaw, toP, 6, dt); tx = P.pos.x; tz = P.pos.z; sp = d > 2.4 ? 3.4 : 0;
        if (this.cd <= 0) { const opts = d < 3.5 ? ['spinWind', 'spinWind', 'trapWind'] : ['throwWind', 'trapWind', 'spinWind']; this.setState(pick(opts)); } break;
      case 'spinWind': mode = 'windup'; k = this.t / (.8 * DV.tele); this.yaw = angDamp(this.yaw, toP, 5, dt); if (this.t < dt * 1.5) ring(new THREE.Vector3(this.x, this.y, this.z), 6, 0xff3030, .8 * DV.tele); if (k >= 1) { this.setState('spin'); this.didHit = false; } break;
      case 'spin': {
        mode = 'strike'; k = (this.t * 3) % 1; tx = P.pos.x; tz = P.pos.z; sp = 4; this.spinA = (this.spinA || 0) + dt * 18;
        if (Math.random() < dt * 10) sfx.swing(1);
        if (!this.didHit && d < 2.3) { this.didHit = damagePlayer(14, this.x, this.z, 8); }
        if (this.t > 1.4) { this.setState('dizzy'); } break;
      }
      case 'dizzy': mode = 'stun'; if (this.t > 1.2) { this.setState('chase'); this.cd = rand(1, 1.8); } break;
      case 'throwWind': mode = 'throwWind'; k = this.t / (.8 * DV.tele); this.yaw = angDamp(this.yaw, toP, 8, dt); if (k >= 1) this.setState('throw'); break;
      case 'throw':
        mode = 'throw'; k = this.t / .4;
        if (this.t <= dt * 1.5) {
          sfx.throwS(); const from = new THREE.Vector3(this.x + f.x, this.y + 2, this.z + f.z);
          for (const off of [-.3, 0, .3]) { const ang = toP + off, tg = new THREE.Vector3(this.x + Math.sin(ang) * d, P.pos.y + .6, this.z + Math.cos(ang) * d); const dir = tg.sub(from), tt = clamp(d / 11, .3, 1.4), g = 5; spawnProjectile({ pos: from, vel: new THREE.Vector3(dir.x / tt, (dir.y + .5 * g * tt * tt) / tt, dir.z / tt), owner: 'enemy', dmg: 8, r: .28, g, life: 3, kb: 2, glow: 0xffe0a0, onHit: () => { P.slowT = 1.6; } }); }
        }
        if (this.t > .45) { this.setState('chase'); this.cd = rand(1, 1.8); } break;
      case 'trapWind': mode = 'taunt'; if (this.t < dt * 1.5) { dialog('The Jeep Trapper', 'Mind your step!', 1.4); for (let i = 0; i < 4; i++) { const ang = rand(0, TAU), r = rand(1.5, 4); this.traps.drop(P.pos.x + Math.sin(ang) * r, P.pos.z + Math.cos(ang) * r, .9); } } if (this.t > .9) { this.setState('chase'); this.cd = rand(1.2, 2); } break;
      case 'stagger': mode = 'stagger'; if (this.t > this.stagDur) { this.setState('chase'); this.cd = Math.min(this.cd, .8); } break;
      case 'stunned': mode = 'stun'; if (this.stun <= 0) this.setState('chase'); break;
      case 'defeated': mode = 'stun'; break;
    }
    this.moveTo(tx, tz, sp, dt);
    // don't walk through the wreck
    if (this.collideJeep) { const ex = this.x - this.collideJeep.x, ez = this.z - this.collideJeep.z, ed = Math.hypot(ex, ez); if (ed < 2) { this.x = this.collideJeep.x + ex / ed * 2; this.z = this.collideJeep.z + ez / ed * 2; } const px = P.pos.x - this.collideJeep.x, pz = P.pos.z - this.collideJeep.z, pd = Math.hypot(px, pz); if (pd < 1.9 && pd > .01) { P.pos.x = this.collideJeep.x + px / pd * 1.9; P.pos.z = this.collideJeep.z + pz / pd * 1.9; } }
    this.y = W.height(this.x, this.z);
    this.h.root.position.set(this.x, this.y + (this.jy || 0), this.z); this.h.root.rotation.y = this.yaw + (this.st === 'spin' ? this.spinA : 0);
    animHuman(this.h, dt, this.speed, mode, t, k); this.flashMats(this.h.mats, this.st.includes('Wind'));
  }
  resetFight(a) {
    this.traps.clear(); this.line.visible = false;
    if (this.phase === 1) { this.jeepHp = this.jeepMax; this.x = a.x; this.z = a.z + a.r * .6; }
    else { this.footHp = this.footMax; this.x = a.x; this.z = a.z - 3; }
    this.hp = Math.max(0, this.jeepHp) + this.footHp; this.setState(this.phase === 1 ? 'idle' : 'chase'); this.cd = 2; this.poise = 0;
  }
}

/* ---------- DRONE MASTER ---------- */
export class DroneMaster extends BossBase {
  constructor(root, x, z, o = {}) {
    super(root, x, z, { ...o, name: 'The Drone Master' });
    this.h = makeHuman({ scale: 1.22, skin: 0x9a6a48, shirt: 0x2a2f3a, vest: 0x1a1d24, pants: 0x1a1a1a, hat: 'cap', hatCol: 0x111111, weapon: 'staff', mask: true, bag: 0x3a3f46 });
    this.h.root.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.userData = {}; } }); root.add(this.h.root);
    const ant = new THREE.Mesh(CY(.02, .02, .8, 5), std(0x9aa0a8, { metalness: .6 })); ant.position.set(.1, 1.1, -.25); this.h.J.torso.add(ant);
    this.shield = new THREE.Mesh(new THREE.SphereGeometry(1.8, 24, 16), new THREE.MeshBasicMaterial({ color: 0x7ad0ff, transparent: true, opacity: .22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); root.add(this.shield);
    this.footMax = Math.round(320 * DV.enemyHp); this.maxHp = this.footMax; this.hp = this.footMax; this.phase = 1; this.shielded = true;
    this.home = { x, z }; this.droneT = 3; this.orbT = 2.5; this.drones = []; this.antennas = 3; this.calledHelp = false;
    this.wave = new THREE.Mesh(new THREE.RingGeometry(.9, 1, 48).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: 0x7ad0ff, transparent: true, opacity: .9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); this.wave.visible = false; root.add(this.wave); this.waveR = -1;
    this.line = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-PI / 2).translate(0, 0, .5), new THREE.MeshBasicMaterial({ color: 0x40a0ff, transparent: true, opacity: .35, depthWrite: false })); this.line.visible = false; root.add(this.line);
  }
  antennaDown() {
    this.antennas--; sfx.magic();
    if (this.antennas > 0) dialog('The Drone Master', this.antennas === 2 ? 'Hey! Leave my antennas alone!' : 'One left?! Drones, protect it!', 2.6);
    else { this.shielded = false; this.setState('drop'); this.shield.visible = false; sfx.smash(); G.shake = .5; dialog('The Drone Master', 'My shield! Fine — I\'ll deal with you myself!', 3); bossBar(this.name, 1); }
  }
  hit(dmg, dx, dz, o = {}) {
    if (!this.alive || !this.awake) return;
    if (this.shielded || this.st === 'drop') { landHit(this, 0, false, true); if (!this.told) { this.told = true; dialog('Pichu', 'A force field! Those antennas must be powering it. Let\'s break them!', 3.5); } return; }
    if (this.stun > 0 || this.st === 'stagger') dmg *= 1.3;
    this.hp -= dmg; this.flash = .12; landHit(this, dmg, !!o.heavy); bossBar(this.name, this.hp / this.maxHp);
    if (this.hp <= 0) { this.defeat(); this.wave.visible = false; this.line.visible = false; for (const dr of this.drones) if (dr.alive) dr.knockOut(); return; }
    if (!this.calledHelp && this.hp < this.maxHp * .5) { this.calledHelp = true; this.setState('call'); return; }
    this.footHit(dmg, dx, dz, o, ['windup', 'strike', 'dashWind', 'dash', 'empWind', 'emp']);
  }
  stunFor(s) { if (!this.alive || this.shielded || this.st === 'drop') return; this.stun = s; this.setState('stunned'); }
  spawnDrone(x, z) { const dr = new Drone(x, z, this.root, { group: 98, awake: true, drops: Math.random() < .5 }); dr.curAlt = 5; this.drones.push(dr); emit(TEX.spark, new THREE.Vector3(x, this.y + 4, z), 10, { add: true, color: 0x7ad0ff, size: .3, speed: 2, g: 0, life: .6 }); }
  update(dt, t) {
    this.t += dt; this.cd -= dt; this.flash -= dt; this.stun -= dt; this.droneT -= dt; this.orbT -= dt;
    const playing = G.mode === 'play' && !G.busy && P.hp > 0 && this.awake;
    const d = Math.hypot(P.pos.x - this.x, P.pos.z - this.z), toP = Math.atan2(P.pos.x - this.x, P.pos.z - this.z), f = { x: Math.sin(this.yaw), z: Math.cos(this.yaw) };
    this.drones = this.drones.filter(dr => !dr.dead);
    let sp = 0, mode = 'idle', k = 0, tx = this.x, tz = this.z;
    if (this.phase === 1 && this.st !== 'drop') {
      this.yaw = angDamp(this.yaw, toP, 4, dt); mode = 'taunt';
      if (playing) {
        const alive = this.drones.filter(dr => dr.alive).length;
        if (this.droneT <= 0 && alive < (DV.maxAttackers >= 2 ? 3 : 2)) { this.droneT = 6 / DV.aggro; const a = rand(0, TAU); this.spawnDrone(this.x + Math.sin(a) * 2, this.z + Math.cos(a) * 2); }
        if (this.orbT <= 0) { // lob an electric orb at Pichu
          this.orbT = rand(2.2, 3.4) / DV.aggro; mode = 'throw'; sfx.throwS();
          const from = new THREE.Vector3(this.x, this.y + 2.6, this.z), tgt = P.pos.clone().addScaledVector(P.dir, P.speed * .6); tgt.y += .5;
          const dx = tgt.x - from.x, dz = tgt.z - from.z, dh = Math.hypot(dx, dz), tt = clamp(dh / 10, .5, 1.6), g = 7;
          spawnProjectile({ pos: from, vel: new THREE.Vector3(dx / tt, (tgt.y - from.y + .5 * g * tt * tt) / tt, dz / tt), owner: 'enemy', dmg: 12, r: .2, g, life: 3, kb: 5, glow: 0x7ad0ff });
        }
      }
      this.shield.position.set(this.x, this.y + 1.4, this.z); this.shield.material.opacity = .16 + .08 * Math.sin(t * 4);
    } else {
      switch (this.st) {
        case 'drop': { // jumps down from his rock
          const k2 = Math.min(1, this.t / 1.1), to = { x: this.home.x, z: this.home.z + 5 };
          this.x = lerp(this.home.x, to.x, k2); this.z = lerp(this.home.z, to.z, k2); this.jy = Math.sin(k2 * PI) * 2.5; mode = 'slam';
          if (this.t > 1.1) { this.phase = 2; this.jy = 0; this.setState('chase'); this.cd = 1; sfx.smash(); ring(new THREE.Vector3(this.x, W.height(this.x, this.z), this.z), 8, 0x7ad0ff, .6); G.shake = .4; }
          break;
        }
        case 'chase': if (!playing) break; mode = 'walk'; this.yaw = angDamp(this.yaw, toP, 6, dt); tx = P.pos.x; tz = P.pos.z; sp = d > 2.4 ? 3.6 : 0;
          if (this.cd <= 0) this.setState(d < 3.2 ? pick(['windup', 'windup', 'empWind']) : pick(['dashWind', 'empWind', 'dashWind'])); break;
        case 'windup': { mode = 'windup'; const dur = (this.combo ? .45 : .75) * DV.tele; k = this.t / dur; this.yaw = angDamp(this.yaw, toP, 5, dt); if (this.t < dt * 1.5) ring(new THREE.Vector3(this.x, this.y, this.z), 5, 0x40a0ff, dur); if (k >= 1) { this.setState('strike'); this.didHit = false; sfx.swing(2); } break; }
        case 'strike':
          mode = 'strike'; k = this.t / .45; if (this.t < .14) { tx = this.x + f.x; tz = this.z + f.z; sp = 5; }
          if (!this.didHit && this.t > .14) { this.didHit = true; emit(TEX.spark, new THREE.Vector3(this.x + f.x * 1.5, this.y + 1, this.z + f.z * 1.5), 8, { add: true, color: 0x7ad0ff, size: .3, speed: 3, g: -3, life: .3 }); const dx = P.pos.x - this.x, dz = P.pos.z - this.z, dd = Math.hypot(dx, dz) || 1; if (dd < 2.9 && (dx * f.x + dz * f.z) / dd > .1) damagePlayer(15, this.x, this.z, 8); }
          if (this.t > .45) { if (!this.combo && Math.random() < .7) { this.combo = 1; this.setState('windup'); } else { this.combo = 0; this.setState('chase'); this.cd = rand(1, 1.8); } }
          break;
        case 'dashWind': { mode = 'windup'; const dur = .9 * DV.tele; k = this.t / dur; this.yaw = angDamp(this.yaw, toP, 7, dt); this.line.visible = true; this.line.position.set(this.x, this.y + .08, this.z); this.line.rotation.y = this.yaw; this.line.scale.set(1.2, 1, 9); this.line.material.opacity = .2 + .25 * Math.sin(t * 25); if (k >= 1) { this.line.visible = false; this.setState('dash'); this.didHit = false; sfx.dodge(); } break; }
        case 'dash': mode = 'strike'; k = .3; tx = this.x + f.x * 3; tz = this.z + f.z * 3; this.speed = 15; this.moveTo(tx, tz, 15, dt, true); if (!this.didHit && d < 1.5) { this.didHit = true; damagePlayer(16, this.x, this.z, 10); } if (Math.random() < dt * 30) emit(TEX.spark, new THREE.Vector3(this.x, this.y + 1, this.z), 1, { add: true, color: 0x7ad0ff, size: .3, speed: .4, g: 0, life: .3 }); if (this.t > .5) { this.setState('chase'); this.cd = rand(1.2, 2); } break;
        case 'empWind': mode = 'slamWind'; k = this.t / (1 * DV.tele); if (this.t < dt * 1.5) ring(new THREE.Vector3(this.x, this.y, this.z), 16, 0x40a0ff, 1 * DV.tele); if (k >= 1) { this.setState('emp'); sfx.smash(); G.shake = .5; this.waveR = 0; this.waveHit = false; } break;
        case 'emp': mode = 'slam'; k = .5 + this.t; if (this.t > .9) { this.setState('chase'); this.cd = rand(1.4, 2.2); } break;
        case 'call': mode = 'taunt'; if (this.t < dt * 1.5) { sfx.roar(); dialog('The Drone Master', 'Drones! Swarm!', 2); for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; this.spawnDrone(this.x + Math.sin(a) * 3, this.z + Math.cos(a) * 3); } } if (this.t > 1.3) { this.setState('chase'); this.cd = 1; } break;
        case 'stagger': mode = 'stagger'; if (this.t > this.stagDur) { this.setState('chase'); this.cd = Math.min(this.cd, .8); } break;
        case 'stunned': mode = 'stun'; if (this.stun <= 0) this.setState('chase'); break;
        case 'defeated': mode = 'stun'; break;
      }
      if (this.st !== 'dash' && this.st !== 'drop') this.moveTo(tx, tz, sp, dt);
    }
    if (this.waveR >= 0) {
      this.waveR += dt * 11; const r = this.waveR; this.wave.visible = true; this.wave.position.set(this.x, this.y + .15, this.z); this.wave.scale.setScalar(Math.max(r, .01)); this.wave.material.opacity = Math.max(0, 1 - r / 10);
      if (!this.waveHit && Math.abs(d - r) < .7 && P.pos.y - W.height(P.pos.x, P.pos.z) < .35) { this.waveHit = true; damagePlayer(18, this.x, this.z, 9); P.slowT = .8; }
      if (r > 10) { this.waveR = -1; this.wave.visible = false; }
    }
    this.y = W.height(this.x, this.z);
    this.h.root.position.set(this.x, this.y + (this.jy || 0), this.z); this.h.root.rotation.y = this.yaw;
    animHuman(this.h, dt, this.speed, mode, t, k); this.flashMats(this.h.mats, this.st.includes('Wind') || this.st === 'windup');
  }
  resetFight() {
    for (const dr of this.drones) if (dr.alive) { dr.alive = false; dr.dead = true; dr.g.removeFromParent(); dr.bar.g.visible = false; }
    this.drones = []; this.wave.visible = false; this.waveR = -1; this.line.visible = false; this.poise = 0;
    if (this.phase === 2) { this.hp = this.maxHp; this.calledHelp = false; this.x = this.home.x; this.z = this.home.z + 5; this.setState('chase'); this.cd = 2; }
    else { this.droneT = 3; this.orbT = 3; }
  }
}
