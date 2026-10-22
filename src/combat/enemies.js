// Poacher enemies: grunts (club, melee) and slingers (throw stones from range).
// AI: patrol → alert → chase → wind-up (clear warning) → attack → recover. Hits cause stagger; 0 HP = knocked out.
import { THREE, std, TEX } from '../core/engine.js';
import { G, P, W } from '../core/state.js';
import { PI, TAU, clamp, damp, angDamp, rand, pick, DV } from '../core/utils.js';
import { sfx, panOf } from '../core/audio.js';
import { collide } from '../world/terrain.js';
import { emit, ring } from '../world/particles.js';
import { makeHuman, animHuman } from '../actors/human.js';
import { ENEMIES, HOOKS, landHit, damagePlayer, spawnProjectile } from './combat.js';
import { spawnPickup } from '../world/pickups.js';
import { dialog } from '../core/ui.js';
import { dmgNum } from '../world/particles.js';

export const TYPES = {
  grunt:   { hp: 58, speed: 3.3, reach: 1.9, dmg: 12, wind: .7, model: { shirt: 0x6b6a3a, pants: 0x2f3a2a, hat: 'cap', hatCol: 0x3a4a2a, weapon: 'club' } },
  brute:   { hp: 125, speed: 2.5, reach: 2.4, dmg: 20, wind: 1.0, guard: true, model: { scale: 1.28, belly: 1.3, shirt: 0x4a3a2a, vest: 0x6a2a1a, pants: 0x2a2420, hat: 'bandana', hatCol: 0x222222, weapon: 'club', shield: true, mask: true } },
  slinger: { hp: 38, speed: 3.0, dmg: 10, wind: .8, model: { shirt: 0x5a4a6a, pants: 0x2a2a3a, hat: 'bandana', hatCol: 0x8a1a1a, weapon: 'sling', bag: 0x5a4030 } },
};

// health bar sprites
export function makeBar() {
  const g = new THREE.Group();
  const bg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x000000, transparent: true, opacity: .55, depthTest: false })); bg.center.set(0, .5); bg.scale.set(.9, .09, 1);
  const fg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xff4a4a, depthTest: false })); fg.center.set(0, .5); fg.scale.set(.9, .07, 1);
  bg.renderOrder = 10; fg.renderOrder = 11; g.add(bg, fg); g.visible = false; return { g, bg, fg };
}
let tokens = 0; // how many enemies are attacking right now

export class Enemy {
  constructor(type, x, z, root, opts = {}) {
    const T = TYPES[type]; this.type = type; this.T = T;
    this.h = makeHuman({ ...T.model, ...(opts.model || {}) }); root.add(this.h.root);
    // own copies of materials so the hit flash only affects this enemy
    this.h.root.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.userData = {}; } });
    this.x = x; this.z = z; this.y = W.height(x, z); this.hx = x; this.hz = z; this.yaw = opts.yaw ?? rand(0, TAU);
    this.maxHp = Math.round(T.hp * DV.enemyHp); this.hp = this.maxHp; this.alive = true; this.radius = .42 * (T.model.scale || 1); this.chest = 1.15 * (T.model.scale || 1); this.scale = T.model.scale || 1;
    this.st = 'idle'; this.t = rand(1, 3); this.cd = rand(.5, 1.5); this.speed = 0; this.vel = new THREE.Vector3();
    this.group = opts.group ?? 0; this.aggroR = opts.aggro ?? 11; this.awake = !!opts.awake; this.flash = 0; this.stun = 0; this.token = false;
    this.bar = makeBar(); root.add(this.bar.g); this.strafe = Math.random() < .5 ? 1 : -1; this.drops = opts.drops ?? true;
    ENEMIES.push(this);
  }
  setState(s) { if (this.token && s !== 'windup' && s !== 'strike' && s !== 'throwWind' && s !== 'throw') { this.token = false; tokens--; } this.st = s; this.t = 0; }
  hit(dmg, dx, dz, o = {}) {
    if (!this.alive) return;
    // brutes block hits from the front, unless it is a smash, Honey's bite, or they are stunned
    if (this.T.guard && this.stun <= 0 && this.st !== 'stagger' && this.st !== 'strike') {
      const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), front = fx * dx + fz * dz < -.2;
      if (front && !o.heavy && !o.honey) {
        landHit(this, 0, false, true); this.vel.set(dx, 0, dz); this.awake = true;
        if (!Enemy.toldBlock) { Enemy.toldBlock = true; dialog('Pichu', "His shield blocks my stick! I need a power SMASH, Honey's BARK, or hit him from behind!", 4.5); }
        return;
      }
      if (front && o.heavy) { dmgNum(new THREE.Vector3(this.x, this.y + 2.6, this.z), 'GUARD BREAK!', '#ffb347', true); this.stagExtra = .6; }
    }
    if (this.stun > 0) dmg *= 1.3;
    this.hp -= dmg; this.flash = .12; this.bar.g.visible = true; landHit(this, dmg, !!o.heavy);
    this.vel.set(dx * (o.kb ?? 3), 0, dz * (o.kb ?? 3)); this.awake = true;
    if (this.hp <= 0) { this.knockOut(dx, dz); return; }
    sfx.grunt(panOf(this.x, this.z));
    // after a stagger they get a short 'tough' window so they can fight back (heavy hits still break it)
    const tough = (this.toughT || 0) > 0 && (this.st === 'windup' || this.st === 'strike' || this.st === 'throwWind' || this.st === 'throw');
    if ((this.stun <= 0 && !tough) || o.heavy) { this.setState('stagger'); this.stagDur = (o.heavy ? .7 : o.ranged ? .2 : .38) + (this.stagExtra || 0); this.stagExtra = 0; this.stagN = (this.stagN || 0) + 1; if (this.stagN >= 3) { this.stagN = 0; this.toughT = 2.2; this.cd = 0; } }
    this.yaw = Math.atan2(-dx, -dz);
  }
  knockOut(dx, dz) {
    this.alive = false; this.setState('ko'); this.bar.g.visible = false; this.vel.set(dx * 6, 0, dz * 6); this.yaw = Math.atan2(-dx, -dz);
    sfx.ko(panOf(this.x, this.z)); G.kos++;
    if (this.drops) { const r = Math.random(); spawnPickup(r < .5 ? 'ammo' : r < .8 ? 'heal' : 'ammo', this.x, this.z, this.h.root.parent, { pop: true, amt: r < .5 ? 3 : 15 }); }
    if (HOOKS.onEnemyKO) HOOKS.onEnemyKO(this);
  }
  stunFor(s) { if (!this.alive) return; this.stun = s; this.setState('stun'); this.bar.g.visible = true; }
  update(dt, t) {
    const T = this.T, d = Math.hypot(P.pos.x - this.x, P.pos.z - this.z), toP = Math.atan2(P.pos.x - this.x, P.pos.z - this.z);
    this.t += dt; this.cd -= dt; this.flash -= dt; this.stun -= dt; this.toughT = (this.toughT || 0) - dt;
    let tx = this.x, tz = this.z, sp = 0, mode = 'idle', k = 0;
    const playing = G.mode === 'play' && !G.busy && P.hp > 0;
    if (!this.alive) {
      mode = 'ko'; k = this.t;
      if (this.t > 2.2) { this.h.root.position.y -= dt * .6; if (this.t > 3.5) { this.h.root.visible = false; this.dead = true; } }
    } else if (this.st === 'stagger') { mode = 'stagger'; if (this.t > this.stagDur) { this.setState('chase'); if (this.toughT > 0) this.cd = 0; } }
    else if (this.st === 'stun') { mode = 'stun'; if (Math.random() < dt * 6) emit(TEX.spark, new THREE.Vector3(this.x, this.y + 2, this.z), 1, { add: true, color: 0xfff27a, size: .2, speed: .6, g: 0, life: .5, spread: .3 }); if (this.stun <= 0) this.setState('chase'); }
    else if (this.st === 'idle' || this.st === 'patrol') {
      if (this.awake && playing && d < this.aggroR * DV.aggro) { this.setState('alert'); sfx.alert(panOf(this.x, this.z)); emit(TEX.spark, new THREE.Vector3(this.x, this.y + 2.1, this.z), 1, { add: true, color: 0xff4040, size: .6, speed: 0, g: 0, life: .6 }); }
      else { if (this.t > 3) { this.t = 0; const a = rand(0, TAU), r = rand(0, 3); this.tx = this.hx + Math.sin(a) * r; this.tz = this.hz + Math.cos(a) * r; } if (this.tx !== undefined) { tx = this.tx; tz = this.tz; sp = 1.1; } }
    } else if (this.st === 'alert') { this.yaw = angDamp(this.yaw, toP, 10, dt); mode = 'taunt'; if (this.t > .55) this.setState('chase'); }
    else if (!playing) { /* stand still during cutscenes */ }
    else if (this.type === 'grunt' || this.type === 'brute') this.gruntAI(dt, d, toP, o => { tx = o.tx; tz = o.tz; sp = o.sp; mode = o.mode; k = o.k; });
    else this.slingerAI(dt, d, toP, o => { tx = o.tx; tz = o.tz; sp = o.sp; mode = o.mode; k = o.k; });
    // movement
    const dx = tx - this.x, dz = tz - this.z, l = Math.hypot(dx, dz);
    if (this.alive && this.st !== 'stagger' && this.st !== 'stun') { if (this.st === 'chase' || this.st === 'circle' || this.st === 'recover') this.yaw = angDamp(this.yaw, toP, 8, dt); else if (l > .2) this.yaw = angDamp(this.yaw, Math.atan2(dx, dz), 6, dt); }
    this.speed = damp(this.speed, l > .25 ? sp : 0, 6, dt);
    const mvx = l > .01 ? dx / l * this.speed : 0, mvz = l > .01 ? dz / l * this.speed : 0;
    const p = { x: this.x + (mvx + this.vel.x) * dt, z: this.z + (mvz + this.vel.z) * dt }; this.vel.multiplyScalar(Math.exp(-dt * 7));
    collide(p, this.radius);
    // don't overlap other enemies or the player
    for (const o of ENEMIES) { if (o === this || !o.alive || !this.alive) continue; const ex = p.x - o.x, ez = p.z - o.z, ed = Math.hypot(ex, ez), m = this.radius + o.radius; if (ed < m && ed > 1e-4) { p.x = o.x + ex / ed * m; p.z = o.z + ez / ed * m; } }
    if (this.alive) { const ex = p.x - P.pos.x, ez = p.z - P.pos.z, ed = Math.hypot(ex, ez); if (ed < this.radius + .3 && ed > 1e-4) { p.x = P.pos.x + ex / ed * (this.radius + .3); p.z = P.pos.z + ez / ed * (this.radius + .3); } }
    { const st = Math.hypot(p.x - this.x, p.z - this.z), rise = W.height(p.x, p.z) - this.y; if (W.walkable(p.x, p.z) && !(st > 1e-5 && rise > .05 && rise / st > 1.5)) { this.x = p.x; this.z = p.z; } }
    this.y = W.height(this.x, this.z);
    const r = this.h.root; if (this.alive || this.t < 2.2) r.position.set(this.x, this.y, this.z); r.rotation.y = this.yaw;
    animHuman(this.h, dt, this.speed, mode === 'idle' && this.speed > .2 ? 'walk' : mode, t, k);
    // hit flash
    const fl = this.flash > 0 ? 1 : this.st === 'windup' || this.st === 'throwWind' ? .25 + .25 * Math.sin(t * 30) : 0;
    for (const m of this.h.mats) { m.material.emissive.setRGB(fl, fl * (this.flash > 0 ? 1 : .15), fl * (this.flash > 0 ? 1 : .1)); }
    // health bar
    if (this.bar.g.visible) { this.bar.g.position.set(this.x - .45, this.y + 2.05 * (this.h.o.scale ?? 1), this.z); this.bar.fg.scale.x = .9 * Math.max(0, this.hp / this.maxHp); }
  }
  gruntAI(dt, d, toP, out) {
    const T = this.T; let tx = this.x, tz = this.z, sp = 0, mode = 'walk', k = 0;
    if (this.st === 'chase' || this.st === 'circle') {
      if (d < T.reach + .2 && this.cd <= 0 && (this.token || tokens < DV.maxAttackers)) { if (!this.token) { this.token = true; tokens++; } this.st = 'windup'; this.t = 0; ring(new THREE.Vector3(this.x, this.y, this.z), 3.2, 0xff3030, T.wind * DV.tele); }
      else if (d > 2.6 || (this.token || tokens < DV.maxAttackers)) { this.st = 'chase'; tx = P.pos.x; tz = P.pos.z; sp = d > 1.4 ? T.speed : 0; if (d > 10) sp *= 1.25; }
      else { // wait your turn: circle around the player
        this.st = 'circle'; const a = Math.atan2(this.x - P.pos.x, this.z - P.pos.z) + this.strafe * .6; tx = P.pos.x + Math.sin(a) * 3.2; tz = P.pos.z + Math.cos(a) * 3.2; sp = 1.8;
        if (this.t > 2.5) { this.t = 0; this.strafe *= -1; }
      }
    } else if (this.st === 'windup') { mode = T.guard ? 'slamWind' : 'windup'; k = this.t / (T.wind * DV.tele); this.yaw = angDamp(this.yaw, toP, 5, dt); if (k >= 1) { this.st = 'strike'; this.t = 0; this.didHit = false; sfx.swing(0); } }
    else if (this.st === 'strike') {
      mode = T.guard ? 'slam' : 'strike'; k = this.t / .45; const f = { x: Math.sin(this.yaw), z: Math.cos(this.yaw) };
      if (this.t < .12) { tx = this.x + f.x; tz = this.z + f.z; sp = 4; }
      if (!this.didHit && this.t > .12) {
        this.didHit = true; const dx = P.pos.x - this.x, dz = P.pos.z - this.z, dd = Math.hypot(dx, dz) || 1;
        if (T.guard) { const p = new THREE.Vector3(this.x + f.x * 1.3, this.y, this.z + f.z * 1.3); ring(p, 4.5, 0xff8a3a, .4); emit(TEX.puff, p, 8, { color: 0xb8a080, size: .6, speed: 2.5, g: -2, life: .6 }); G.shake = Math.max(G.shake, .2); sfx.smash(); }
        if (dd < T.reach + .3 && (dx * f.x + dz * f.z) / dd > (T.guard ? -.3 : .2) && Math.abs(P.pos.y - this.y) < 1.2) damagePlayer(T.dmg, this.x, this.z, T.guard ? 9 : 6);
      }
      if (this.t > .45) { this.setState('recover'); this.cd = rand(1.1, 2.2) / DV.aggro; }
    } else if (this.st === 'recover') { mode = 'walk'; if (this.t > .5) this.setState('chase'); }
    out({ tx, tz, sp, mode, k });
  }
  slingerAI(dt, d, toP, out) {
    const T = this.T; let tx = this.x, tz = this.z, sp = 0, mode = 'walk', k = 0;
    if (this.st === 'chase' || this.st === 'circle') {
      this.st = 'chase';
      const away = Math.atan2(this.x - P.pos.x, this.z - P.pos.z);
      if (d < 5.5) { tx = this.x + Math.sin(away) * 3; tz = this.z + Math.cos(away) * 3; sp = T.speed; }
      else if (d > 12) { tx = P.pos.x; tz = P.pos.z; sp = T.speed; }
      else { const a = away + this.strafe * .5; tx = P.pos.x + Math.sin(a) * 8.5; tz = P.pos.z + Math.cos(a) * 8.5; sp = 1.6; if (this.t > 2.2) { this.t = 0; this.strafe *= -1; } }
      if (this.cd <= 0 && d < 15 && (this.token || tokens < DV.maxAttackers + 1)) { if (!this.token) { this.token = true; tokens++; } this.st = 'throwWind'; this.t = 0; }
    } else if (this.st === 'throwWind') { mode = 'throwWind'; k = this.t / (T.wind * DV.tele); this.yaw = angDamp(this.yaw, toP, 10, dt); if (k >= 1) { this.st = 'throw'; this.t = 0; this.fired = false; } }
    else if (this.st === 'throw') {
      mode = 'throw'; k = this.t / .4;
      if (!this.fired) {
        this.fired = true; sfx.throwS(panOf(this.x, this.z));
        // lob a stone at where Pichu will be
        const from = new THREE.Vector3(this.x, this.y + 1.6, this.z); const tgt = P.pos.clone().addScaledVector(P.dir, P.speed * .5); tgt.y += .6;
        const dx = tgt.x - from.x, dz = tgt.z - from.z, dh = Math.hypot(dx, dz), tt = clamp(dh / 13, .35, 1.2), g = 9;
        const vel = new THREE.Vector3(dx / tt, (tgt.y - from.y + .5 * g * tt * tt) / tt, dz / tt);
        spawnProjectile({ pos: from, vel, owner: 'enemy', dmg: T.dmg, r: .09, g, life: 3, kb: 4 });
      }
      if (this.t > .4) { this.setState('recover'); this.cd = rand(2.2, 3.6) / DV.aggro; }
    } else if (this.st === 'recover') { if (this.t > .4) this.setState('chase'); }
    out({ tx, tz, sp, mode, k });
  }
}
export function resetTokens() { tokens = 0; }
export function updateEnemies(dt, t) {
  for (let i = ENEMIES.length - 1; i >= 0; i--) { const e = ENEMIES[i]; e.update(dt, t); if (e.dead) ENEMIES.splice(i, 1); }
}
export function groupAlive(g) { return ENEMIES.filter(e => e.group === g && e.alive).length; }
export function wakeGroup(g) { for (const e of ENEMIES) if (e.group === g) e.awake = true; }
