// SHADOW LEOPARD (Silent Valley): a black leopard wearing Kaala's anger collar.
// Phase 1: stalks Pichu in a circle, swipes (2 hits), pounces (red landing circle), and vanishes into the rain
//          to ambush from the side — Honey's BARK reveals it.
// Phase 2: also leaps into a tree; its shadow follows Pichu, turns red, then it drops — it is dizzy after landing.
// At zero health the collar breaks and the leopard is free and calm again.
import { THREE, M, std, TEX } from '../core/engine.js';
import { G, P, W } from '../core/state.js';
import { PI, TAU, clamp, damp, angDamp, lerp, rand, pick, DV, buzz } from '../core/utils.js';
import { sfx, panOf, tone, nz } from '../core/audio.js';
import { emit, ring, dmgNum } from '../world/particles.js';
import { makeQuad, animQuad, QUADS } from '../actors/quad.js';
import { landHit, damagePlayer, HOOKS } from './combat.js';
import { bossBar, dialog } from '../core/ui.js';
import { BossBase } from './bosses2.js';
import { angerCollar } from './beasts.js';

const snarl = pan => { tone({ type: 'sawtooth', f0: 180, f1: 90, dur: .5, a: .05, vol: .12, pan, vib: [20, 15], filter: ['lowpass', 900] }); nz({ dur: .4, vol: .1, pan, filter: ['bandpass', 600, 1] }); };
export const purr = () => { for (let i = 0; i < 6; i++) tone({ type: 'sawtooth', f0: 60, f1: 55, dur: .25, a: .05, vol: .06, delay: i * .3, filter: ['lowpass', 300] }); };

export class ShadowLeopard extends BossBase {
  constructor(root, x, z, o = {}) {
    super(root, x, z, { ...o, name: 'The Shadow Leopard' });
    this.q = makeQuad(QUADS.leopard); this.q.root.scale.setScalar(1.5); root.add(this.q.root);
    this.coat = []; this.q.root.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.userData = {}; if (m.material.emissive) { m.material.transparent = true; this.coat.push(m.material); } } });
    this.collar = angerCollar(this.q, .15);
    this.trees = o.trees || []; this.radius = .8; this.chest = .8;
    this.maxHp = Math.round(380 * DV.enemyHp); this.hp = this.maxHp; this.footMax = this.maxHp; this.phase = 1; this.op = 1; this.orbit = 0; this.dir = 1;
    this.mark = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.5, 32).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: .6, depthWrite: false })); this.mark.visible = false; root.add(this.mark);
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(1.6, 28).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .45, depthWrite: false })); this.shadow.visible = false; root.add(this.shadow);
    this.vanishN = 0; this.revealable = true;
  }
  hit(dmg, dx, dz, o = {}) {
    if (!this.alive || !this.awake || this.friendly || this.st === 'perch' || this.st === 'roar') return;
    if (this.stun > 0 || this.st === 'dizzy' || this.st === 'land') dmg *= 1.35;
    this.hp -= dmg; this.flash = .12; landHit(this, dmg, !!o.heavy); bossBar(this.name, this.hp / this.maxHp);
    if (this.hp <= 0) { this.calm(); return; }
    if (this.phase === 1 && this.hp < this.maxHp * .5) { this.phase = 2; this.setState('roar'); return; }
    if (Math.random() < .3) snarl(panOf(this.x, this.z));
    this.footHit(dmg, dx, dz, o, ['swipeWind', 'swipe', 'pounceWind', 'pounce', 'treeLeap', 'drop']);
  }
  stunFor(s) {
    if (!this.alive) return;
    if (this.st === 'hidden' || this.st === 'vanish') { this.reveal(); dialog('Pichu', 'Honey found it! There it is!', 2); }
    if (this.st === 'perch' || this.st === 'treeLeap' || this.st === 'drop') return;
    this.stun = Math.min(s, 1.4); this.setState('stunned');
  }
  reveal() { this.friendly = false; this.op = 1; this.setState('stunned'); this.stun = 1.4; snarl(panOf(this.x, this.z)); emit(TEX.spark, new THREE.Vector3(this.x, this.y + 1, this.z), 12, { add: true, color: 0xe8e040, size: .3, speed: 2, g: 0, life: .6 }); }
  calm() {
    this.alive = false; this.friendly = false; this.op = 1; this.setState('defeated'); bossBar(null); this.mark.visible = false; this.shadow.visible = false;
    this.collar.c.visible = false; this.collar.tag.visible = false; this.jy = 0;
    emit(TEX.spark, new THREE.Vector3(this.x, this.y + 1, this.z), 30, { add: true, color: 0xff6060, size: .4, speed: 4, g: -3, life: .8 });
    G.shake = .4; buzz([60, 40, 100]); purr(); if (HOOKS.onEnemyKO) HOOKS.onEnemyKO(this);
  }
  pickAttack(d) {
    const o = d < 3.2 ? ['swipeWind', 'swipeWind', 'pounceWind'] : ['pounceWind', 'pounceWind'];
    if (this.vanishN <= 0) o.push('vanish', 'vanish');
    if (this.phase === 2 && this.trees.length) o.push('treeLeap', 'treeLeap');
    return pick(o);
  }
  update(dt, t) {
    this.t += dt; this.cd -= dt; this.flash -= dt; this.stun -= dt; this.vanishN -= dt;
    const playing = G.mode === 'play' && !G.busy && P.hp > 0 && this.awake;
    const d = Math.hypot(P.pos.x - this.x, P.pos.z - this.z), toP = Math.atan2(P.pos.x - this.x, P.pos.z - this.z), f = { x: Math.sin(this.yaw), z: Math.cos(this.yaw) };
    let sp = 0, mode = 'alert', tx = this.x, tz = this.z;
    switch (this.st) {
      case 'idle': mode = 'lie'; if (playing) { this.setState('stalk'); snarl(panOf(this.x, this.z)); } break;
      case 'stalk': {
        if (!playing) break; this.orbit += dt * .6 * this.dir; const a = Math.atan2(this.x - P.pos.x, this.z - P.pos.z) + this.dir * .5;
        tx = P.pos.x + Math.sin(a) * 6.5; tz = P.pos.z + Math.cos(a) * 6.5; sp = 4.2; mode = 'walk';
        if (this.t > 3) { this.t = 0; this.dir *= -1; }
        if (this.cd <= 0) this.setState(this.pickAttack(d)); break;
      }
      case 'swipeWind': { mode = 'crouch'; this.yaw = angDamp(this.yaw, toP, 8, dt); const dur = .6 * DV.tele; if (this.t < dt * 1.5) ring(new THREE.Vector3(this.x, this.y, this.z), 5, 0xff3030, dur); if (this.t > dur) { this.setState('swipe'); this.hits = 0; } break; }
      case 'swipe': {
        mode = 'walk'; this.speed = 0; tx = this.x + f.x; tz = this.z + f.z; sp = this.t < .5 ? 5 : 0; this.yaw = angDamp(this.yaw, toP, 4, dt);
        const swing = (n, at) => { if (this.hits === n && this.t > at) { this.hits++; sfx.swing(2); snarl(panOf(this.x, this.z)); const dx = P.pos.x - this.x, dz = P.pos.z - this.z, dd = Math.hypot(dx, dz) || 1; if (dd < 2.4 && (dx * f.x + dz * f.z) / dd > 0) damagePlayer(12, this.x, this.z, 6); emit(TEX.spark, new THREE.Vector3(this.x + f.x * 1.3, this.y + .7, this.z + f.z * 1.3), 6, { add: true, color: 0xffe0a0, size: .3, speed: 3, g: -3, life: .25 }); } };
        swing(0, .12); swing(1, .45); if (this.t > .8) { this.setState('stalk'); this.cd = rand(1.2, 2) / DV.aggro; } break;
      }
      case 'pounceWind': {
        mode = 'crouch'; this.yaw = angDamp(this.yaw, toP, 8, dt); const dur = (this.ambush ? .6 : .9) * DV.tele;
        this.tgt = { x: P.pos.x + P.dir.x * P.speed * .3, z: P.pos.z + P.dir.z * P.speed * .3 };
        this.mark.visible = true; this.mark.position.set(this.tgt.x, W.height(this.tgt.x, this.tgt.z) + .06, this.tgt.z); this.mark.material.opacity = .3 + .3 * Math.sin(t * 20);
        if (this.t > dur) { this.setState('pounce'); this.from = { x: this.x, z: this.z }; this.ambush = false; snarl(panOf(this.x, this.z)); } break;
      }
      case 'pounce': {
        mode = 'walk'; const k = Math.min(1, this.t / .55); this.x = lerp(this.from.x, this.tgt.x, k); this.z = lerp(this.from.z, this.tgt.z, k); this.jy = Math.sin(k * PI) * 2.2; this.speed = 8;
        this.yaw = Math.atan2(this.tgt.x - this.from.x, this.tgt.z - this.from.z);
        if (k >= 1) { this.jy = 0; this.mark.visible = false; this.setState('land'); G.shake = Math.max(G.shake, .25); emit(TEX.puff, new THREE.Vector3(this.x, this.y + .2, this.z), 10, { color: 0x6a6050, size: .6, speed: 2.5, g: -2, life: .6 }); if (Math.hypot(P.pos.x - this.x, P.pos.z - this.z) < 1.8) damagePlayer(18, this.x - f.x, this.z - f.z, 10); } break;
      }
      case 'land': mode = 'crouch'; this.speed = 0; if (this.t > .9) { this.setState('stalk'); this.cd = rand(1, 1.8) / DV.aggro; } break;
      case 'vanish': { // melt into the rain
        mode = 'walk'; this.op = Math.max(.07, 1 - this.t * 2); this.friendly = this.t > .3; sp = 5; const a = Math.atan2(this.x - P.pos.x, this.z - P.pos.z) + 1.4 * this.dir; tx = P.pos.x + Math.sin(a) * 9; tz = P.pos.z + Math.cos(a) * 9;
        if (this.t < dt * 1.5) { snarl(panOf(this.x, this.z)); dialog('Pichu', 'Where did it go?! Honey, BARK to find it!', 2.5); }
        if (this.t > .5) this.setState('hidden'); break;
      }
      case 'hidden': {
        mode = 'walk'; this.friendly = true; sp = 5.5; const a = Math.atan2(this.x - P.pos.x, this.z - P.pos.z) + dt * 1.5 * this.dir; tx = P.pos.x + Math.sin(a) * 8; tz = P.pos.z + Math.cos(a) * 8;
        if (this.t > 2.6) { this.friendly = false; this.op = 1; this.vanishN = 9; this.ambush = true; this.setState('pounceWind'); } break;
      }
      case 'treeLeap': {
        if (this.t < dt * 1.5) { this.tree = this.trees.reduce((a, b) => Math.hypot(b.x - this.x, b.z - this.z) < Math.hypot(a.x - this.x, a.z - this.z) ? b : a); this.from = { x: this.x, z: this.z }; snarl(panOf(this.x, this.z)); }
        mode = 'walk'; const k = Math.min(1, this.t / 1); this.x = lerp(this.from.x, this.tree.x, k); this.z = lerp(this.from.z, this.tree.z, k); this.jy = k * this.tree.h + Math.sin(k * PI) * 1.5;
        if (k >= 1) { this.setState('perch'); this.shadow.visible = true; this.sx = P.pos.x; this.sz = P.pos.z; } break;
      }
      case 'perch': {
        mode = 'crouch'; this.yaw = angDamp(this.yaw, toP, 5, dt); this.jy = this.tree.h; const locked = this.t > 1.8;
        if (!locked) { this.sx = damp(this.sx, P.pos.x, 3, dt); this.sz = damp(this.sz, P.pos.z, 3, dt); }
        this.shadow.position.set(this.sx, W.height(this.sx, this.sz) + .05, this.sz); this.shadow.material.color.set(locked ? 0xff2020 : 0x000000); this.shadow.material.opacity = locked ? .35 + .25 * Math.sin(t * 25) : .45;
        if (this.t > 1.8 + .55 * DV.tele) { this.setState('drop'); this.from = { x: this.x, z: this.z }; } break;
      }
      case 'drop': {
        mode = 'walk'; const k = Math.min(1, this.t / .4); this.x = lerp(this.from.x, this.sx, k); this.z = lerp(this.from.z, this.sz, k); this.jy = this.tree.h * (1 - k * k);
        if (k >= 1) { this.jy = 0; this.shadow.visible = false; this.setState('dizzy'); sfx.smash(); G.shake = .5; buzz(70); ring(new THREE.Vector3(this.x, this.y, this.z), 6, 0xffc060, .4); if (Math.hypot(P.pos.x - this.x, P.pos.z - this.z) < 2.3) damagePlayer(22, this.x, this.z + .01, 11); dialog('Pichu', 'It\'s dizzy! Now, Honey!', 1.6); } break;
      }
      case 'dizzy': mode = 'ko'; if (Math.random() < dt * 5) emit(TEX.spark, new THREE.Vector3(this.x, this.y + 1.4, this.z), 1, { add: true, color: 0xfff27a, size: .3, speed: .5, g: 0, life: .6, spread: .4 }); if (this.t > 2) { this.setState('stalk'); this.cd = 1; } break;
      case 'roar': mode = 'alert'; this.yaw = angDamp(this.yaw, toP, 5, dt); if (this.t < dt * 1.5) { sfx.roar(); G.shake = .5; ring(new THREE.Vector3(this.x, this.y, this.z), 12, 0xff3030, .8); dialog('Pichu', 'The collar is sparking — it\'s getting angrier! Watch the trees!', 3); } if (this.t > 1.5) { this.setState('stalk'); this.cd = .6; } break;
      case 'stagger': mode = 'alert'; if (this.t > this.stagDur) { this.setState('stalk'); this.cd = Math.min(this.cd, .8); } break;
      case 'stunned': mode = 'ko'; if (this.stun <= 0) this.setState('stalk'); break;
      case 'defeated': mode = 'sit'; this.speed = 0; break;
    }
    if (!['pounce', 'treeLeap', 'perch', 'drop'].includes(this.st)) {
      this.moveTo(tx, tz, sp, dt);
      if (sp > 0 && this.st !== 'swipe') this.yaw = angDamp(this.yaw, this.st === 'stalk' ? toP : Math.atan2(tx - this.x, tz - this.z), 6, dt);
    }
    if (this.st !== 'vanish' && this.st !== 'hidden') this.op = damp(this.op, 1, 6, dt);
    this.y = W.height(this.x, this.z);
    this.q.root.position.set(this.x, this.y + (this.jy || 0), this.z); this.q.root.rotation.y = this.yaw;
    animQuad(this.q, dt, this.speed, mode, t, { wag: .2, leap: this.speed > 6 });
    const fl = this.flash > 0 ? 1 : this.st.includes('Wind') ? .25 + .25 * Math.sin(t * 30) : 0;
    for (const m of this.coat) { m.opacity = this.op; m.depthWrite = this.op > .5; m.emissive.setRGB(fl, fl * (this.flash > 0 ? 1 : .2), fl * (this.flash > 0 ? 1 : .1)); }
    this.collar.m.emissiveIntensity = (this.phase === 2 ? 1.4 : .9) + Math.sin(t * (this.phase === 2 ? 14 : 6)) * .4;
    if (this.phase === 2 && Math.random() < dt * 3 && this.alive) emit(TEX.spark, new THREE.Vector3(this.x, this.y + (this.jy || 0) + .9, this.z), 1, { add: true, color: 0xff4040, size: .2, speed: 1.5, g: -3, life: .3 });
  }
  resetFight(a) { this.hp = this.maxHp; this.phase = 1; this.friendly = false; this.op = 1; this.jy = 0; this.mark.visible = false; this.shadow.visible = false; this.x = a.x; this.z = a.z - 6; this.setState('stalk'); this.cd = 2; this.poise = 0; this.vanishN = 4; }
}
