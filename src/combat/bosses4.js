// LEVEL 5 BOSS — THE SAWMILL BOSS (Nilambur)
// Phase 1: sits high in his log-loader and rolls teak logs down the yard. A red stripe shows where each
//   log will roll: JUMP the thin ones, DODGE-ROLL through or step around the fat ones. After a few logs
//   (or after 3 slingshot hits on the red steam valve) the machine overheats and he climbs down to fix it
//   — that's your chance to hit him.
// Phase 2 (below half health): the machine bursts, he grabs a giant mallet: ground-pound shockwave,
//   spinning sweep (jump or dodge), and kicks logs across the yard.
import { THREE, M, S, B, CY, std, TEX } from '../core/engine.js';
import { G, P, W } from '../core/state.js';
import { PI, TAU, clamp, damp, angDamp, lerp, rand, pick, DV, buzz } from '../core/utils.js';
import { sfx, panOf } from '../core/audio.js';
import { emit, ring } from '../world/particles.js';
import { makeHuman, animHuman } from '../actors/human.js';
import { ENEMIES, landHit, damagePlayer } from './combat.js';
import { bossBar, dialog } from '../core/ui.js';
import { BossBase } from './bosses2.js';

/* ---------- rolling logs ---------- */
class Logs {
  constructor(root, arena) { this.root = root; this.a = arena; this.L = []; this.warn = []; }
  // telegraph a log: red stripe on the ground for `delay` seconds, then it rolls from z0 toward +z
  launch(x, z0, len, r, speed, delay) {
    const a = this.a, stripe = new THREE.Mesh(new THREE.PlaneGeometry(len, a.r * 2).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: .25, depthWrite: false }));
    stripe.position.set(x, W.height(x, a.z) + .06, a.z); this.root.add(stripe);
    this.warn.push({ m: stripe, t: 0, delay, x, z0, len, r, speed });
  }
  update(dt, t) {
    for (let i = this.warn.length - 1; i >= 0; i--) {
      const w = this.warn[i]; w.t += dt; w.m.material.opacity = .15 + .2 * Math.abs(Math.sin(t * 9));
      if (w.t >= w.delay) { w.m.removeFromParent(); this.warn.splice(i, 1); this.spawn(w.x, w.z0, w.len, w.r, w.speed); }
    }
    for (let i = this.L.length - 1; i >= 0; i--) {
      const l = this.L[i]; l.z += l.speed * dt; const gy = W.height(l.x, l.z);
      l.g.position.set(l.x, gy + l.r, l.z); l.g.rotation.x += l.speed * dt / l.r;
      if (Math.random() < dt * 8) emit(TEX.puff, new THREE.Vector3(l.x + rand(-l.len / 2, l.len / 2), gy + .1, l.z), 1, { color: 0xc8a070, size: .5, speed: .6, g: 0, life: .6 });
      // hits Pichu unless he jumps over (thin logs) or dodge-rolls through
      const pg = W.height(P.pos.x, P.pos.z);
      if (!l.hit && Math.abs(P.pos.z - l.z) < l.r + .35 && Math.abs(P.pos.x - l.x) < l.len / 2 + .3 && P.pos.y - pg < l.r * 1.6) { if (damagePlayer(l.r > .45 ? 18 : 12, P.pos.x, l.z - 2, 9)) l.hit = true; }
      if (l.z > this.a.z + this.a.r - .5) { emit(TEX.puff, l.g.position, 10, { color: 0xc8a070, size: .7, speed: 2, g: -2, life: .7 }); l.g.removeFromParent(); this.L.splice(i, 1); }
    }
  }
  spawn(x, z, len, r, speed) {
    const g = new THREE.Group(), lg = M(CY(r, r, len, 12), std(0x7a5030, { roughness: .9 }), 0, 0, 0, g); lg.rotation.z = PI / 2;
    for (const s of [-1, 1]) M(CY(r * .96, r * .96, .02, 12), std(0xd8b070), s * (len / 2 + .01), 0, 0, g).rotation.z = PI / 2;
    g.rotation.order = 'YXZ'; this.root.add(g); this.L.push({ g, x, z, len, r, speed, hit: false }); sfx.smash();
  }
  clear() { for (const l of this.L) l.g.removeFromParent(); for (const w of this.warn) w.m.removeFromParent(); this.L = []; this.warn = []; }
}

/* ---------- the red steam valve on the machine (slingshot target) ---------- */
class Valve {
  constructor(root, x, y, z, onBreak) {
    this.prop = true; this.x = x; this.z = z; this.y = y - 1; this.chest = 1; this.radius = .55; this.alive = true; this.awake = false; this.onBreak = onBreak; this.hits = 0;
    this.g = new THREE.Group(); this.g.position.set(x, y, z); root.add(this.g);
    this.mat = new THREE.MeshStandardMaterial({ color: 0xd02020, roughness: .5, metalness: .4 });
    const w = new THREE.Mesh(new THREE.TorusGeometry(.32, .07, 8, 18), this.mat); this.g.add(w);
    for (let i = 0; i < 3; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(.6, .05, .05), this.mat); sp.rotation.z = i * PI / 3; this.g.add(sp); }
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xff5030, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); this.glow.scale.setScalar(1.3); this.g.add(this.glow);
    ENEMIES.push(this);
  }
  hit(dmg, dx, dz, o = {}) {
    if (!this.alive || !this.armed) return;
    this.hits++; this.flash = .15; landHit(this, 0, false); sfx.block(); this.g.rotation.z += .8;
    if (this.hits >= 3) { this.armed = false; this.hits = 0; emit(TEX.puff, this.g.position, 16, { color: 0xffffff, size: .7, speed: 3, up0: 1, up1: 2, g: .5, life: 1.2 }); this.onBreak && this.onBreak(); }
  }
  stunFor() { } update() { }
  tick(dt, t) { this.flash = (this.flash || 0) - dt; this.mat.emissive.setRGB(this.flash > 0 ? 1 : .2, this.flash > 0 ? 1 : 0, this.flash > 0 ? 1 : 0); this.glow.visible = !!this.armed; this.glow.material.opacity = .5 + .3 * Math.sin(t * 6); }
}

function loaderModel() {
  const g = new THREE.Group(), body = new THREE.MeshStandardMaterial({ color: 0xd8a020, roughness: .6, metalness: .2 }), dark = std(0x2a2a2a, { metalness: .5, roughness: .5 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) M(B(.4, 2.6, .4), dark, sx * 2.2, 1.3, sz * 1.3, g);
  M(B(5, .5, 3.2), body, 0, 2.7, 0, g);                                   // deck
  M(B(1.8, 1.6, 1.6), body, -1.3, 3.75, -.4, g);                            // cab
  M(B(1.6, .9, .05), std(0x8ab0c0, { roughness: .1, metalness: .3 }), -1.3, 3.95, .41, g);
  const arm = new THREE.Group(); arm.position.set(1.2, 3.2, 0); g.add(arm); M(B(.3, .3, 2.6), dark, 0, 0, 1.2, arm);
  M(CY(.35, .35, 1.4, 6), dark, 1.2, 3.6, -1, g);                           // chimney
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { g, body, arm, chimney: new THREE.Vector3(1.2, 4.4, -1) };
}

export class SawmillBoss extends BossBase {
  constructor(root, arena, mach, o = {}) {
    super(root, mach.x, mach.z, { ...o, name: 'The Sawmill Boss', arena });
    this.mach = mach; this.loader = loaderModel(); this.loader.g.position.set(mach.x, W.height(mach.x, mach.z), mach.z); root.add(this.loader.g);
    this.h = makeHuman({ scale: 1.45, skin: 0x8a5a3a, shirt: 0x9a3a1a, vest: 0x3a3a5a, pants: 0x2a3040, hat: 'cap', hatCol: 0xf2c230, weapon: 'club', belly: 1.4, boot: 0x2a1a10 });
    this.h.root.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.userData = {}; } }); root.add(this.h.root);
    this.malletHead = M(B(.5, .5, .8), std(0x6a4a2a, { roughness: .9 }), 0, 0, .9, this.h.J.wpn); this.malletHead.visible = false;
    this.footMax = Math.round(420 * DV.enemyHp); this.maxHp = this.footMax; this.hp = this.maxHp; this.phase = 1; this.radius = .8; this.chest = 1.7; this.tall = 1;
    this.logs = new Logs(root, arena); this.fired = 0; this.logT = 2;
    this.valve = new Valve(root, mach.x + 1.6, W.height(mach.x, mach.z) + 3.2, mach.z + 1.7, () => { if (this.st === 'operate') { this.setState('overheat'); dialog('Pichu', 'Bullseye! The valve burst — his machine is overheating!', 2.5); } });
    this.seat = () => new THREE.Vector3(mach.x - 1.3, W.height(mach.x, mach.z) + 2.95, mach.z - .4);
    this.ground = { x: mach.x, z: mach.z + 4.5 };
    this.wave = new THREE.Mesh(new THREE.RingGeometry(.9, 1, 48).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: .9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); this.wave.visible = false; root.add(this.wave); this.waveR = -1;
    const s = this.seat(); this.x = s.x; this.z = s.z;
  }
  get inMachine() { return this.phase === 1 && (this.st === 'idle' || this.st === 'operate' || this.st === 'overheat' || this.st === 'climbUp'); }
  hit(dmg, dx, dz, o = {}) {
    if (!this.alive || !this.awake) return;
    if (this.inMachine) { landHit(this, 0, false, true); if (!this.told) { this.told = true; dialog('Pichu', "He's too high up in that machine! Hit the red valve with my slingshot, or wait for it to overheat.", 4); } return; }
    if (this.st === 'fix' || this.stun > 0 || this.st === 'stagger') dmg *= 1.35;
    this.hp -= dmg; this.flash = .12; landHit(this, dmg, !!o.heavy); bossBar(this.name, this.hp / this.maxHp);
    if (this.hp <= 0) { this.defeat(); this.logs.clear(); this.wave.visible = false; return; }
    if (this.phase === 1 && this.hp < this.maxHp * .5) { this.toPhase2(); return; }
    if (this.phase === 2) this.footHit(dmg, dx, dz, o, ['slamWind', 'slam', 'sweepWind', 'sweep', 'kick']);
  }
  stunFor(s) { if (!this.alive || this.inMachine || this.st === 'rage') return; this.stun = s; this.setState('stunned'); }
  toPhase2() {
    this.phase = 2; this.setState('rage'); this.valve.armed = false; this.malletHead.visible = true; sfx.roar(); G.shake = .7;
    const p = this.loader.g.position.clone(); p.y += 3; emit(TEX.puff, p, 50, { color: 0x333333, size: 1.6, speed: 3, g: .5, life: 2.2, spread: 1.5 }); emit(TEX.spark, p, 30, { add: true, color: 0xffa030, size: .5, speed: 5, g: -4, life: .8 });
    this.loader.body.color.set(0x5a4a2a); dialog('The Sawmill Boss', 'MY LOADER! That\'s it — time for the big mallet!', 3);
  }
  update(dt, t) {
    this.t += dt; this.cd -= dt; this.flash -= dt; this.stun -= dt; this.logT -= dt;
    const playing = G.mode === 'play' && !G.busy && P.hp > 0 && this.awake, a = this.arena;
    const d = Math.hypot(P.pos.x - this.x, P.pos.z - this.z), toP = Math.atan2(P.pos.x - this.x, P.pos.z - this.z), f = { x: Math.sin(this.yaw), z: Math.cos(this.yaw) };
    this.logs.update(dt, t); this.valve.tick(dt, t);
    let sp = 0, mode = 'idle', k = 0, tx = this.x, tz = this.z, seated = false;
    const launchLog = (n2 = 1) => {
      for (let i = 0; i < n2; i++) {
        const fat = Math.random() < (this.phase === 2 ? .3 : .45), len = fat ? rand(3.5, 5) : rand(5, 8), x = a.x + rand(-a.r * .55, a.r * .55);
        this.logs.launch(x, this.mach.z + 3, len, fat ? .58 : .32, (fat ? 5.5 : 7) * (DV.aggro > 1 ? 1.15 : 1), .9 * DV.tele);
      }
    };
    switch (this.st) {
      case 'idle': seated = true; mode = 'taunt'; if (playing) { this.setState('operate'); this.valve.armed = true; this.fired = 0; } break;
      case 'operate':
        seated = true; this.yaw = angDamp(this.yaw, toP, 4, dt); mode = 'throwWind'; k = .3;
        if (playing && this.logT <= 0) { this.logT = (this.fired % 3 === 2 ? 3.2 : 2.1) / DV.aggro; launchLog(this.fired >= 3 && Math.random() < .4 ? 2 : 1); this.fired++; this.loader.arm.rotation.x = -.8; }
        this.loader.arm.rotation.x = damp(this.loader.arm.rotation.x, 0, 3, dt);
        if (this.fired >= 6) this.setState('overheat');
        break;
      case 'overheat':
        seated = true; mode = 'stun';
        if (Math.random() < dt * 25) { const c = this.loader.chimney.clone().add(this.loader.g.position); emit(TEX.puff, c, 1, { color: 0xffffff, size: .8, speed: 1.5, up0: 1, up1: 2, g: .8, life: 1.2, grow: 1 }); }
        if (this.t < dt * 1.5) { sfx.alert(0); dialog('The Sawmill Boss', 'Argh! Overheating AGAIN?!', 2); }
        if (this.t > 1.2) { this.setState('climbDown'); }
        break;
      case 'climbDown': { const s = this.seat(), k2 = Math.min(1, this.t / .8), gy = W.height(this.ground.x, this.ground.z); this.x = lerp(s.x, this.ground.x, k2); this.z = lerp(s.z, this.ground.z, k2); this.jy = lerp(s.y - W.height(this.x, this.z), 0, k2) + Math.sin(k2 * PI) * 1.2; mode = 'slam'; if (k2 >= 1) { this.jy = 0; this.setState('fix'); } break; }
      case 'fix': mode = 'stun'; this.yaw = angDamp(this.yaw, PI, 3, dt); if (Math.random() < dt * 3) emit(TEX.spark, new THREE.Vector3(this.x, this.y + 2.8, this.z), 1, { add: true, color: 0xfff27a, size: .3, speed: .5, g: 0, life: .7, spread: .5 }); if (this.t > 5.5 / Math.max(.8, DV.aggro)) this.setState('climbUp'); break;
      case 'climbUp': { const s = this.seat(), k2 = Math.min(1, this.t / .8); this.x = lerp(this.ground.x, s.x, k2); this.z = lerp(this.ground.z, s.z, k2); this.jy = lerp(0, s.y - W.height(this.x, this.z), k2) + Math.sin(k2 * PI) * 1.2; if (k2 >= 1) { this.setState('operate'); this.valve.armed = true; this.fired = 0; this.logT = 1.5; } break; }
      case 'rage': mode = 'taunt'; this.jy = Math.max(0, (this.jy || 0) - dt * 4); if (this.t > 1.6) { this.setState('chase'); this.cd = .8; } break;
      // ---- phase 2: on foot with the mallet ----
      case 'chase': if (!playing) break; mode = 'walk'; this.yaw = angDamp(this.yaw, toP, 5, dt); tx = P.pos.x; tz = P.pos.z; sp = d > 2.8 ? 3.2 : 0;
        if (this.cd <= 0) this.setState(d < 3.5 ? pick(['sweepWind', 'slamWind', 'sweepWind']) : pick(['slamWind', 'kick', 'kick'])); break;
      case 'slamWind': mode = 'slamWind'; k = this.t / (1 * DV.tele); this.yaw = angDamp(this.yaw, toP, 5, dt); if (this.t < dt * 1.5) ring(new THREE.Vector3(this.x, this.y, this.z), 16, 0xff8030, 1 * DV.tele); if (k >= 1) { this.setState('slam'); sfx.smash(); G.shake = .6; buzz(70); this.waveR = 0; this.waveHit = false; emit(TEX.puff, new THREE.Vector3(this.x + f.x * 1.5, this.y + .2, this.z + f.z * 1.5), 16, { color: 0xc8a070, size: .8, speed: 4, g: -1, life: .8, hz: 1.6 }); } break;
      case 'slam': mode = 'slam'; k = .5 + this.t; if (this.t > .9) { this.setState('chase'); this.cd = rand(1.2, 2); } break;
      case 'sweepWind': mode = 'windup'; k = this.t / (.9 * DV.tele); this.yaw = angDamp(this.yaw, toP, 5, dt); if (this.t < dt * 1.5) ring(new THREE.Vector3(this.x, this.y, this.z), 7, 0xff3030, .9 * DV.tele); if (k >= 1) { this.setState('sweep'); this.didHit = false; this.spin = 0; } break;
      case 'sweep': mode = 'strike'; k = (this.t * 2.5) % 1; this.spin = (this.spin || 0) + dt * 14; if (Math.random() < dt * 8) sfx.swing(2);
        if (!this.didHit && d < 3.4 && P.pos.y - W.height(P.pos.x, P.pos.z) < .5) this.didHit = damagePlayer(16, this.x, this.z, 10);
        if (this.t > .9) { this.setState('dizzy'); } break;
      case 'dizzy': mode = 'stun'; if (this.t > 1.3) { this.setState('chase'); this.cd = rand(.8, 1.5); } break;
      case 'kick': mode = 'taunt'; if (this.t < dt * 1.5) { dialog('The Sawmill Boss', pick(['Timber!', 'Watch your toes!', 'Here comes the teak!']), 1.4); launchLog(2); } if (this.t > .8) { this.setState('chase'); this.cd = rand(1.4, 2.2); } break;
      case 'stagger': mode = 'stagger'; if (this.t > this.stagDur) { this.setState(this.phase === 1 ? 'fix' : 'chase'); this.cd = Math.min(this.cd, .8); } break;
      case 'stunned': mode = 'stun'; if (this.stun <= 0) this.setState(this.phase === 1 ? 'fix' : 'chase'); break;
      case 'defeated': mode = 'stun'; break;
    }
    if (this.phase === 2 && this.st !== 'rage') this.moveTo(tx, tz, sp, dt);
    if (seated) { const s = this.seat(); this.x = s.x; this.z = s.z; this.jy = s.y - W.height(s.x, s.z); }
    if (this.waveR >= 0) {
      this.waveR += dt * 11; const r = this.waveR; this.wave.visible = true; this.wave.position.set(this.x, this.y + .15, this.z); this.wave.scale.setScalar(Math.max(r, .01)); this.wave.material.opacity = Math.max(0, 1 - r / 10);
      if (!this.waveHit && Math.abs(d - r) < .7 && P.pos.y - W.height(P.pos.x, P.pos.z) < .35) { this.waveHit = true; damagePlayer(18, this.x, this.z, 9); }
      if (r > 10) { this.waveR = -1; this.wave.visible = false; }
    }
    this.y = W.height(this.x, this.z) + (this.inMachine ? (this.jy || 0) : 0); this.noAim = this.inMachine;
    this.h.root.position.set(this.x, W.height(this.x, this.z) + (this.jy || 0), this.z); this.h.root.rotation.y = this.yaw + (this.st === 'sweep' ? this.spin : 0);
    animHuman(this.h, dt, this.speed, mode, t, k); this.flashMats(this.h.mats, this.st.includes('Wind'));
    const hot = this.st === 'overheat' ? .6 + .4 * Math.sin(t * 20) : 0; this.loader.body.emissive.setRGB(hot, hot * .3, 0);
  }
  resetFight() {
    this.logs.clear(); this.wave.visible = false; this.waveR = -1; this.poise = 0;
    if (this.phase === 1) { this.hp = this.maxHp; this.setState('idle'); this.valve.armed = false; this.fired = 0; this.logT = 2; }
    else { this.hp = Math.max(this.hp, this.maxHp * .5); this.x = this.ground.x; this.z = this.ground.z; this.setState('chase'); this.cd = 2; }
  }
}
