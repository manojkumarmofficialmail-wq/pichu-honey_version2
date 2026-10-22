// Bosses. Level 1: Captain Snare, Kaala's scout captain.
// Phase 1: club combo, net throw, charge (he is winded after a charge — free hits!).
// Phase 2 (below half health): roars, calls helpers, adds a ground-slam shockwave (jump or dodge it).
import { THREE, scene, std, TEX, M, S } from '../core/engine.js';
import { G, P, W } from '../core/state.js';
import { PI, TAU, clamp, damp, angDamp, rand, pick, DV, buzz } from '../core/utils.js';
import { sfx, panOf } from '../core/audio.js';
import { collide } from '../world/terrain.js';
import { emit, ring } from '../world/particles.js';
import { makeHuman, animHuman } from '../actors/human.js';
import { ENEMIES, HOOKS, landHit, damagePlayer, spawnProjectile } from './combat.js';
import { bossBar, dialog } from '../core/ui.js';

export class CaptainSnare {
  constructor(x, z, root, opts = {}) {
    this.h = makeHuman({ scale: 1.32, skin: 0x8a5a3a, shirt: 0x4a3a2a, vest: 0x2a3a22, pants: 0x1f241c, hat: 'bandana', hatCol: 0x1a1a1a, weapon: 'club', belly: 1.25, bag: 0x3a2a1a });
    this.h.root.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.userData = {}; } });
    root.add(this.h.root); this.root = root;
    this.name = 'Captain Snare'; this.boss = true; this.scale = 1.32;
    this.x = x; this.z = z; this.y = W.height(x, z); this.yaw = opts.yaw ?? 0; this.radius = .65; this.chest = 1.5; this.tall = .6;
    this.maxHp = Math.round(420 * DV.enemyHp); this.hp = this.maxHp; this.alive = true; this.awake = false; this.group = opts.group ?? 99;
    this.st = 'idle'; this.t = 0; this.cd = 1.5; this.speed = 0; this.vel = new THREE.Vector3(); this.flash = 0; this.stun = 0;
    this.phase = 1; this.poise = 0; this.last = ''; this.arena = opts.arena; this.onPhase2 = opts.onPhase2;
    // shockwave visual
    this.wave = new THREE.Mesh(new THREE.RingGeometry(.92, 1, 48).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: 0xff7a30, transparent: true, opacity: .9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.wave.visible = false; root.add(this.wave); this.waveR = -1;
    // charge warning line
    this.line = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1).rotateX(-PI / 2).translate(0, 0, .5), new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: .35, depthWrite: false }));
    this.line.visible = false; root.add(this.line);
    ENEMIES.push(this);
  }
  setState(s) { this.st = s; this.t = 0; }
  hit(dmg, dx, dz, o = {}) {
    if (!this.alive || this.st === 'roar' || !this.awake) return;
    const vulnerable = this.st === 'winded' || this.stun > 0;
    if (vulnerable) dmg *= 1.4;
    this.hp -= dmg; this.flash = .12; landHit(this, dmg, !!o.heavy); this.poise += dmg;
    bossBar(this.name, this.hp / this.maxHp);
    if (this.hp <= 0) { this.defeat(); return; }
    if (this.phase === 1 && this.hp < this.maxHp * .5) { this.phase = 2; this.setState('roar'); return; }
    const armored = ['windup', 'strike', 'charge', 'netWind', 'slamJump', 'slam', 'combo2'].includes(this.st);
    if (this.poise > this.maxHp * .22) { this.poise = 0; this.setState('stagger'); this.stagDur = 1.4; sfx.grunt(); return; } // poise break
    if (!armored && (o.heavy || !vulnerable && Math.random() < .3)) { this.setState('stagger'); this.stagDur = o.heavy ? .6 : .3; this.vel.set(dx * 3, 0, dz * 3); }
    if (Math.random() < .25) sfx.grunt(panOf(this.x, this.z));
  }
  stunFor(s) { if (!this.alive || this.st === 'roar') return; this.stun = s; this.setState('stunned'); }
  defeat() {
    this.alive = false; this.setState('defeated'); bossBar(null); this.wave.visible = false; this.line.visible = false;
    sfx.ko(); G.shake = .5; buzz([80, 40, 120]); if (HOOKS.onEnemyKO) HOOKS.onEnemyKO(this);
  }
  pickAttack(d) {
    const opts = [];
    if (d < 3.4) opts.push('combo', 'combo');
    if (d > 4) opts.push('net', 'charge');
    if (d > 2.5 && d < 12) opts.push('charge');
    if (this.phase === 2) opts.push('slam', d < 5 ? 'slam' : 'net');
    let a = pick(opts.length ? opts : ['charge']); if (a === this.last && opts.length > 1) a = pick(opts); this.last = a; return a;
  }
  update(dt, t) {
    this.t += dt; this.cd -= dt; this.flash -= dt; this.stun -= dt;
    const d = Math.hypot(P.pos.x - this.x, P.pos.z - this.z), toP = Math.atan2(P.pos.x - this.x, P.pos.z - this.z);
    const f = { x: Math.sin(this.yaw), z: Math.cos(this.yaw) };
    const playing = G.mode === 'play' && !G.busy && P.hp > 0 && this.awake;
    const tele = DV.tele;
    let sp = 0, mode = 'idle', k = 0, tx = this.x, tz = this.z;
    switch (this.st) {
      case 'idle': mode = 'taunt'; if (playing) this.setState('chase'); break;
      case 'chase': {
        if (!playing) break;
        this.yaw = angDamp(this.yaw, toP, 6, dt); tx = P.pos.x; tz = P.pos.z; sp = d > 2.6 ? (this.phase === 2 ? 3.6 : 3) : 0; mode = 'walk';
        if (this.cd <= 0) { const a = this.pickAttack(d); this.atk = a; this.setState(a === 'combo' ? 'windup' : a === 'net' ? 'netWind' : a === 'charge' ? 'chargeWind' : 'slamWind'); this.combo = 0; }
        break;
      }
      case 'windup': { mode = 'windup'; const dur = (this.combo ? .45 : .8) * tele; k = this.t / dur; this.yaw = angDamp(this.yaw, toP, 4, dt); if (this.t === dt || this.t < dt * 1.5) ring(new THREE.Vector3(this.x, this.y, this.z), 5, 0xff3030, dur); if (k >= 1) { this.setState('strike'); this.didHit = false; sfx.swing(2); } break; }
      case 'strike': {
        mode = 'strike'; k = this.t / .5; if (this.t < .15) { tx = this.x + f.x; tz = this.z + f.z; sp = 5; }
        if (!this.didHit && this.t > .14) { this.didHit = true; G.shake = Math.max(G.shake, .15); const dx = P.pos.x - this.x, dz = P.pos.z - this.z, dd = Math.hypot(dx, dz) || 1; if (dd < 2.9 && (dx * f.x + dz * f.z) / dd > .1) damagePlayer(16, this.x, this.z, 8); }
        if (this.t > .5) { if (this.combo === 0 && this.phase >= 1 && Math.random() < (this.phase === 2 ? .9 : .6)) { this.combo = 1; this.setState('windup'); } else { this.setState('recover'); this.cd = rand(1.2, 2) / (this.phase === 2 ? 1.3 : 1); } }
        break;
      }
      case 'netWind': { mode = 'throwWind'; k = this.t / (.9 * tele); this.yaw = angDamp(this.yaw, toP, 8, dt); if (k >= 1) { this.setState('netThrow'); } break; }
      case 'netThrow': {
        mode = 'throw'; k = this.t / .4;
        if (this.t <= dt * 1.5) {
          sfx.throwS(); const from = new THREE.Vector3(this.x + f.x, this.y + 1.8, this.z + f.z);
          const shots = this.phase === 2 ? [-.25, 0, .25] : [0];
          for (const off of shots) {
            const a = toP + off, tgt = new THREE.Vector3(this.x + Math.sin(a) * d, P.pos.y + .6, this.z + Math.cos(a) * d);
            const dir = tgt.sub(from); const tt = clamp(d / 11, .3, 1.4); const g = 5;
            const vel = new THREE.Vector3(dir.x / tt, (dir.y + .5 * g * tt * tt) / tt, dir.z / tt);
            spawnProjectile({ pos: from, vel, owner: 'enemy', dmg: 8, r: .28, g, life: 3, kb: 2, glow: 0xffe0a0, onHit: () => { P.slowT = 1.6; dialog('Pichu', 'Ugh, a net! I can barely move!', 1.6); } });
          }
        }
        if (this.t > .45) { this.setState('recover'); this.cd = rand(1, 1.8); }
        break;
      }
      case 'chargeWind': {
        mode = 'windup'; const dur = 1.0 * tele; k = this.t / dur; this.yaw = angDamp(this.yaw, toP, 7, dt);
        this.line.visible = true; this.line.position.set(this.x, this.y + .08, this.z); this.line.rotation.y = this.yaw; this.line.scale.set(1, 1, 11); this.line.material.opacity = .2 + .25 * Math.sin(t * 25);
        if (k >= 1) { this.line.visible = false; this.setState('charge'); this.didHit = false; sfx.roar(); }
        break;
      }
      case 'charge': {
        mode = 'walk'; tx = this.x + f.x * 3; tz = this.z + f.z * 3; sp = 13; this.speed = 13;
        if (Math.random() < dt * 30) emit(TEX.puff, new THREE.Vector3(this.x, this.y + .2, this.z), 1, { color: 0xb8a080, size: .6, speed: .8, g: 0, life: .6 });
        if (!this.didHit && d < 1.4) { this.didHit = true; damagePlayer(20, this.x, this.z, 12); }
        const ox = this.x, oz = this.z; this.moveTo(tx, tz, 13, dt, true);
        const blocked = Math.hypot(this.x - ox, this.z - oz) < 13 * dt * .4;
        if (this.t > .85 || blocked) { this.setState('winded'); G.shake = blocked ? .35 : .1; if (blocked) { sfx.smash(); emit(TEX.spark, new THREE.Vector3(this.x, this.y + 1.6, this.z), 8, { add: true, color: 0xfff27a, size: .3, speed: 1.5, g: 0, life: .8 }); } }
        break;
      }
      case 'winded': { mode = 'stun'; if (Math.random() < dt * 4) emit(TEX.spark, new THREE.Vector3(this.x, this.y + 2.6, this.z), 1, { add: true, color: 0xfff27a, size: .25, speed: .5, g: 0, life: .6, spread: .4 }); if (this.t > 1.5) { this.setState('chase'); this.cd = .6; } break; }
      case 'slamWind': { mode = 'windup'; k = this.t / (1.0 * tele); this.yaw = angDamp(this.yaw, toP, 6, dt); if (this.t < dt * 1.5) ring(new THREE.Vector3(this.x, this.y, this.z), 15, 0xff7a30, 1.0 * tele); if (k >= 1) { this.setState('slamJump'); this.vy = 8; this.baseY = this.y; } break; }
      case 'slamJump': {
        mode = 'slam'; k = 0; this.vy -= 26 * dt; this.jy = (this.jy || 0) + this.vy * dt;
        if (this.jy <= 0 && this.t > .1) { this.jy = 0; this.setState('slam'); sfx.smash(); G.shake = .6; buzz(80); this.waveR = 0; this.waveHit = false; this.wave.visible = true; emit(TEX.puff, new THREE.Vector3(this.x, this.y + .3, this.z), 18, { color: 0xb8a080, size: .8, speed: 4, g: -1, life: .8, hz: 1.6 }); }
        break;
      }
      case 'slam': { mode = 'slam'; k = .5 + this.t; if (this.t > .9) { this.setState('recover'); this.cd = rand(1.4, 2.2); } break; }
      case 'recover': { mode = 'walk'; this.yaw = angDamp(this.yaw, toP, 4, dt); if (this.t > .7) this.setState('chase'); break; }
      case 'stagger': { mode = 'stagger'; if (this.t > this.stagDur) { this.setState('chase'); this.cd = Math.min(this.cd, .8); } break; }
      case 'stunned': { mode = 'stun'; if (this.stun <= 0) this.setState('chase'); break; }
      case 'roar': {
        mode = 'taunt'; this.yaw = angDamp(this.yaw, toP, 6, dt);
        if (this.t < dt * 1.5) { sfx.roar(); G.shake = .5; ring(new THREE.Vector3(this.x, this.y, this.z), 12, 0xff3030, .8); dialog('Captain Snare', "Enough games, kid! Boys — get out here!", 3); if (this.onPhase2) this.onPhase2(); }
        if (this.t > 1.6) { this.setState('chase'); this.cd = .5; }
        break;
      }
      case 'defeated': { mode = 'stun'; break; }
    }
    // shockwave
    if (this.waveR >= 0) {
      this.waveR += dt * 10; const r = this.waveR; this.wave.visible = true; this.wave.position.set(this.x, this.y + .15, this.z); this.wave.scale.setScalar(Math.max(r, .01)); this.wave.material.opacity = Math.max(0, 1 - r / 9);
      if (!this.waveHit && Math.abs(d - r) < .7 && P.pos.y - W.height(P.pos.x, P.pos.z) < .35) { this.waveHit = true; damagePlayer(18, this.x, this.z, 9); }
      if (r > 9) { this.waveR = -1; this.wave.visible = false; }
    }
    if (this.st !== 'charge') this.moveTo(tx, tz, sp, dt, false);
    this.y = W.height(this.x, this.z);
    this.h.root.position.set(this.x, this.y + (this.jy || 0), this.z); this.h.root.rotation.y = this.yaw;
    animHuman(this.h, dt, this.speed, mode, t, k);
    const fl = this.flash > 0 ? 1 : (this.st.includes('Wind') || this.st === 'windup') ? .3 + .3 * Math.sin(t * 30) : this.st === 'winded' ? .15 : 0;
    for (const m of this.h.mats) m.material.emissive.setRGB(fl, fl * (this.flash > 0 ? 1 : .2), fl * (this.flash > 0 ? 1 : .1));
  }
  moveTo(tx, tz, sp, dt, force) {
    const dx = tx - this.x, dz = tz - this.z, l = Math.hypot(dx, dz);
    this.speed = force ? sp : damp(this.speed, l > .3 ? sp : 0, 6, dt);
    const p = { x: this.x + (l > .01 ? dx / l * this.speed : 0) * dt + this.vel.x * dt, z: this.z + (l > .01 ? dz / l * this.speed : 0) * dt + this.vel.z * dt };
    this.vel.multiplyScalar(Math.exp(-dt * 6)); collide(p, this.radius);
    if (this.arena) { const a = this.arena, ax = p.x - a.x, az = p.z - a.z, ad = Math.hypot(ax, az); if (ad > a.r - 1) { p.x = a.x + ax / ad * (a.r - 1); p.z = a.z + az / ad * (a.r - 1); } }
    const ex = p.x - P.pos.x, ez = p.z - P.pos.z, ed = Math.hypot(ex, ez); if (this.alive && ed < this.radius + .3 && ed > 1e-4 && this.st !== 'charge') { p.x = P.pos.x + ex / ed * (this.radius + .3); p.z = P.pos.z + ez / ed * (this.radius + .3); }
    this.x = p.x; this.z = p.z;
  }
}
