// Player movement + combat: 3-hit stick combo, charged smash, dodge roll, slingshot,
// hit detection, projectiles, hit-stop and screen shake.
import { THREE, scene, std, S, TEX } from '../core/engine.js';
import { G, P, W, K, JOY, CAM } from '../core/state.js';
import { PI, TAU, clamp, damp, angDamp, angDiff, rand, pick, buzz, DV, MOBILE } from '../core/utils.js';
import { sfx, panOf } from '../core/audio.js';
import { collide } from '../world/terrain.js';
import { emit, ring, dmgNum } from '../world/particles.js';
import { hud, hurtFlash, dialog } from '../core/ui.js';
import { upg } from '../core/upgrades.js';

export const ENEMIES = [];          // filled by enemies.js / bosses.js
export const HOOKS = { onPlayerDown: null, onEnemyKO: null };

const LIGHT = [
  { dur: .34, hitAt: .13, dmg: 10, range: 1.75, cos: .3, kb: 3.5, lunge: 3 },
  { dur: .34, hitAt: .13, dmg: 12, range: 1.75, cos: .3, kb: 3.5, lunge: 3 },
  { dur: .52, hitAt: .22, dmg: 20, range: 2.0, cos: .2, kb: 7, lunge: 4.5 },
];
const STAM = { heavy: 30, dodge: 22 };

/* ---------- helpers ---------- */
const fwd = () => ({ x: Math.sin(P.yaw), z: Math.cos(P.yaw) });
function inputDir() {
  let ix = 0, iy = 0;
  if (K.w || K.arrowup) iy += 1; if (K.s || K.arrowdown) iy -= 1; if (K.d || K.arrowright) ix += 1; if (K.a || K.arrowleft) ix -= 1;
  if (JOY.active) { ix = JOY.x; iy = -JOY.y; }
  const mag = Math.min(1, Math.hypot(ix, iy));
  const fx = -Math.sin(CAM.yaw), fz = -Math.cos(CAM.yaw), rx = Math.cos(CAM.yaw), rz = -Math.sin(CAM.yaw);
  let mx = fx * iy + rx * ix, mz = fz * iy + rz * ix; const ml = Math.hypot(mx, mz); if (ml > 0) { mx /= ml; mz /= ml; }
  return { x: mx, z: mz, mag: ml > 0 ? mag : 0 };
}
// soft lock: turn toward the closest enemy roughly in front (helps a lot on phones)
function autoFace(maxD = 3.6) {
  const inp = inputDir(); const want = inp.mag > .2 ? Math.atan2(inp.x, inp.z) : P.yaw;
  let best = null, bd = 1e9;
  for (const e of ENEMIES) {
    if (!e.alive || e.friendly) continue; const dx = e.x - P.pos.x, dz = e.z - P.pos.z, d = Math.hypot(dx, dz);
    if (d > maxD + e.radius) continue; const a = Math.abs(angDiff(want, Math.atan2(dx, dz))); if (a > 2.0) continue;
    const score = d + a * 1.5; if (score < bd) { bd = score; best = e; }
  }
  if (best) P.yaw = Math.atan2(best.x - P.pos.x, best.z - P.pos.z); else if (inp.mag > .2) P.yaw = want;
}
const canAct = () => G.mode === 'play' && !G.busy && !G.paused && P.hp > 0 && !P.climb;

/* ---------- actions ---------- */
export function doLight() {
  if (!canAct()) return;
  const A = P.act;
  if (A && A.type === 'light') { A.buf = true; return; }   // queue the next combo hit
  if (A && A.type !== 'light') return;
  startLight(P.comboT > 0 ? (P.combo + 1) % 3 : 0);
}
function startLight(n) {
  const L = LIGHT[n]; P.combo = n; autoFace();
  P.act = { type: 'light', n, t: 0, dur: L.dur, hitAt: L.hitAt, done: false, buf: false };
  sfx.swing(n);
}
export function doHeavyStart() {
  if (!canAct() || P.act) return;
  if (P.stamina < STAM.heavy) { tired(); return; }
  P.act = { type: 'heavy', phase: 'charge', t: 0, dur: 9, chargeMax: .9, held: true };
  sfx.charge();
}
export function doHeavyRelease() { if (P.act && P.act.type === 'heavy' && P.act.phase === 'charge') P.act.held = false; }
function releaseHeavy(A) {
  const ck = clamp(A.t / A.chargeMax, 0, 1); autoFace(4);
  P.stamina -= STAM.heavy; P.act = { type: 'heavy', phase: 'smash', t: 0, dur: .55, hitAt: .17, ck, done: false };
}
export function doDodge() {
  if (!canAct()) return;
  if (P.act && P.act.type === 'dodge') return;
  if (P.act && P.act.type === 'heavy' && P.act.phase === 'smash') return;
  if (P.stamina < STAM.dodge) { tired(); return; }
  const inp = inputDir(); let dx = inp.x, dz = inp.z;
  if (inp.mag < .2) { const f = fwd(); dx = -f.x; dz = -f.z; } else P.yaw = Math.atan2(dx, dz);
  P.dodgeDir.set(dx, 0, dz); P.stamina -= STAM.dodge; P.act = { type: 'dodge', t: 0, dur: .42 }; sfx.dodge(); buzz(10);
}
export function doSling() {
  if (!canAct() || P.act) return;
  if (P.ammo <= 0) { dialog('Pichu', pick(["I'm out of pebbles! Let me find more.", 'No pebbles left! Break crates or beat poachers to find more.']), 2.4); return; }
  const tgt = slingTarget(); if (tgt) P.yaw = Math.atan2(tgt.x - P.pos.x, tgt.z - P.pos.z);
  P.act = { type: 'sling', t: 0, dur: .48, fireAt: .24, done: false, tgt };
}
export function doJump() {
  if (P.climb && G.mode === 'play') { const L = P.climb; P.climb = null; P.kb.set(L.nx * 5, 0, L.nz * 5); P.vy = 4; P.ground = false; sfx.jump(); return; }
  if (!canAct()) return;
  if (P.act && P.act.type !== 'light') return;
  if ((P.ground || (P.airT < .14 && P.vy <= 0))) { P.vy = 7.3; P.ground = false; P.airT = 1; P.jumpBuf = 0; sfx.jump(); buzz(12); }
  else P.jumpBuf = .18;
}
export function setBarkPose() { if (!P.act) P.act = { type: 'bark', t: 0, dur: .6 }; }
function tired() { if ((P.tiredT || 0) > 0) return; P.tiredT = 2; dialog('Pichu', pick(['Huff… puff… I need a second!', 'Too tired! Let me catch my breath.']), 1.6); }
function slingTarget() {
  // aim at the closest enemy in front of the camera / player
  const fx = -Math.sin(CAM.yaw), fz = -Math.cos(CAM.yaw), f = fwd(); let best = null, bs = 1e9;
  for (const e of ENEMIES) {
    if (!e.alive || e.friendly) continue; const dx = e.x - P.pos.x, dz = e.z - P.pos.z, d = Math.hypot(dx, dz);
    if (d > 24 || d < .5) continue; const c = Math.max((dx * fx + dz * fz) / d, (dx * f.x + dz * f.z) / d); if (c < .6) continue;
    const s = d * (1.6 - c); if (s < bs) { bs = s; best = e; }
  }
  return best;
}

/* ---------- hitting enemies ---------- */
function hitArc(range, cosMin, dmg, kb, opts = {}) {
  const f = fwd(); let n = 0;
  for (const e of ENEMIES) {
    if (!e.alive || e.friendly) continue; const dx = e.x - P.pos.x, dz = e.z - P.pos.z, d = Math.hypot(dx, dz) || .001;
    if (d > range + e.radius) continue; if ((dx * f.x + dz * f.z) / d < cosMin && d > e.radius + .3) continue;
    if (Math.abs((e.y ?? 0) - P.pos.y) > 1.6 + (e.tall ?? 0)) continue;
    e.hit(dmg, dx / d, dz / d, { kb, ...opts }); n++;
  }
  return n;
}
export function landHit(e, dmg, heavy, blocked) {
  G.hitStop = heavy ? .09 : .05; G.shake = Math.max(G.shake, heavy ? .35 : .12);
  const p = new THREE.Vector3(e.x, (e.y ?? 0) + (e.chest ?? 1.1), e.z);
  if (blocked) { sfx.block(); emit(TEX.spark, p, 6, { add: true, color: 0xaad4ff, size: .25, speed: 3, g: -4, life: .3 }); dmgNum(p, 'BLOCK', '#9fd0ff'); return; }
  sfx.hit(heavy); buzz(heavy ? 40 : 15);
  emit(TEX.spark, p, heavy ? 16 : 8, { add: true, color: heavy ? 0xffb347 : 0xfff0b0, size: heavy ? .4 : .28, speed: heavy ? 5 : 3.2, g: -5, life: .35 });
  dmgNum(p, String(Math.round(dmg)), heavy ? '#ffb347' : '#ffffff', heavy);
}

/* ---------- player takes damage ---------- */
export function damagePlayer(amount, fx, fz, kb = 6) {
  if (P.invul > 0 || G.mode !== 'play' || G.busy || P.hp <= 0) return false;
  if (P.act && P.act.type === 'dodge' && P.act.t < .32) { // perfect dodge
    if (!P.act.perfect) { P.act.perfect = true; dmgNum(P.pos.clone().setY(P.pos.y + 1.3), 'DODGE!', '#7dffa0'); }
    return false;
  }
  const dmg = Math.round(amount * DV.enemyDmg);
  P.hp = Math.max(0, P.hp - dmg); P.invul = .7; P.hurtT = .35; P.hurtFlash = true; G.hits++;
  if (P.act && P.act.type !== 'dodge') P.act = null;
  const dx = P.pos.x - fx, dz = P.pos.z - fz, l = Math.hypot(dx, dz) || 1; P.kb.set(dx / l * kb, 0, dz / l * kb);
  if (kb > 7) { P.vy = 4; P.ground = false; }
  sfx.hurt(); buzz([60, 30, 60]); hurtFlash(); G.shake = Math.max(G.shake, .25); hud();
  dmgNum(P.pos.clone().setY(P.pos.y + 1.2), '-' + dmg, '#ff6070');
  if (P.hp <= 0 && HOOKS.onPlayerDown) HOOKS.onPlayerDown();
  return true;
}
export function healPlayer(n) { P.hp = Math.min(P.maxHp, P.hp + n); hud(); dmgNum(P.pos.clone().setY(P.pos.y + 1.2), '+' + n, '#7dffa0'); }

/* ---------- slash trail effect ---------- */
const slashMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
const slash = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.55, 24, 1, -1.1, 2.2), slashMat); slash.visible = false; scene.add(slash);
let slashT = 0;
function showSlash(n, heavy) {
  slash.visible = true; slashT = heavy ? .22 : .14; slashMat.color.set(heavy ? 0xffb347 : 0xfff2c0);
  slash.position.set(P.pos.x, P.pos.y + (n === 2 || heavy ? .6 : .65), P.pos.z);
  // the arc is centred on local +X: turn +X toward Pichu's facing, then lay it flat (sideways swings)
  // or keep it upright (overhead swings)
  slash.rotation.order = 'YXZ';
  slash.rotation.set(n === 2 || heavy ? 0 : -PI / 2, P.yaw - PI / 2, 0);
  slash.scale.setScalar(heavy ? 1.5 : 1.1);
}

/* ---------- projectiles ---------- */
const PROJ = [];
const pelletMat = std(0xd8d0c0, { roughness: .6 }), stoneMat = std(0x6a6058, { roughness: .9 });
export function spawnProjectile(o) {
  const m = new THREE.Mesh(S(o.r ?? .07, 8, 6), o.owner === 'player' ? pelletMat : stoneMat); m.castShadow = true; m.position.copy(o.pos); scene.add(m);
  if (o.glow) { const gs = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: o.glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); gs.scale.setScalar(.5); m.add(gs); }
  if (o.scale) m.scale.setScalar(o.scale);
  PROJ.push({ m, v: o.vel.clone(), owner: o.owner, dmg: o.dmg, g: o.g ?? 0, life: o.life ?? 2.5, r: o.r ?? .07, kb: o.kb ?? 3, onHit: o.onHit });
}
export function clearProjectiles() { for (const p of PROJ) { p.m.removeFromParent(); } PROJ.length = 0; }
function updProjectiles(dt) {
  for (let i = PROJ.length - 1; i >= 0; i--) {
    const p = PROJ[i]; p.life -= dt; p.v.y -= p.g * dt; p.m.position.addScaledVector(p.v, dt); const pos = p.m.position;
    let dead = p.life <= 0 || pos.y < W.height(pos.x, pos.z) - .05;
    if (!dead && p.owner === 'player') {
      for (const e of ENEMIES) {
        if (!e.alive || e.friendly) continue; const dx = e.x - pos.x, dz = e.z - pos.z;
        if (dx * dx + dz * dz < (e.radius + .25) ** 2 && pos.y > (e.y ?? 0) && pos.y < (e.y ?? 0) + 1.9 * (e.scale ?? 1)) {
          const l = Math.hypot(p.v.x, p.v.z) || 1; e.hit(p.dmg, p.v.x / l, p.v.z / l, { kb: p.kb, ranged: true }); dead = true; break;
        }
      }
    } else if (!dead && p.owner === 'enemy') {
      const dx = P.pos.x - pos.x, dz = P.pos.z - pos.z;
      if (dx * dx + dz * dz < .35 && pos.y > P.pos.y - .1 && pos.y < P.pos.y + 1.2) { damagePlayer(p.dmg, pos.x - p.v.x, pos.z - p.v.z, p.kb); if (p.onHit) p.onHit(); dead = true; }
    }
    if (dead) { emit(TEX.puff, pos, 4, { color: 0xcfc6b8, size: .25, speed: 1.2, g: -3, life: .4 }); p.m.removeFromParent(); PROJ.splice(i, 1); }
  }
}

/* ---------- platforms (rafts) and ladders (vines) ---------- */
// a platform has surface(x,z) -> top height or null, and dx/dz = how far it moved this frame
export function groundAt(x, z, y) {
  let h = W.height(x, z), plat = null;
  for (const p of W.platforms) { const top = p.surface(x, z); if (top !== null && top > h - .01 && (y === undefined || y >= top - .6)) { h = top; plat = p; } }
  return { h, plat };
}
// a ladder: x,z at the foot of the wall, (nx,nz) = wall normal pointing away from the cliff, y0 bottom, y1 top, w width
function tryLadder(inp) {
  if (P.act || !P.ground) return false;
  for (const L of W.ladders) {
    const dx = P.pos.x - L.x, dz = P.pos.z - L.z, along = dx * L.nx + dz * L.nz, side = dx * L.nz - dz * L.nx;
    if (along > -.3 && along < 1.1 && Math.abs(side) < L.w / 2 && Math.abs(P.pos.y - L.y0) < 1.3 && inp.mag > .3 && (-inp.x * L.nx - inp.z * L.nz) > .5) {
      if (L.locked) { if (W.onGate) W.onGate(L); return false; }
      P.climb = L; P.climbSide = side; P.speed = 0; P.vy = 0; P.climbPhase = 0; return true;
    }
  }
  return false;
}
function updateClimb(dt, inp) {
  const L = P.climb, up = G.mode === 'play' && !G.busy && inp.mag > .2 ? (-inp.x * L.nx - inp.z * L.nz) : 0;
  P.pos.y += up * 2.6 * dt; P.climbPhase += up * dt * 7; P.yaw = Math.atan2(-L.nx, -L.nz); P.speed = 0; P.vy = 0;
  P.pos.x = L.x + L.nx * .42 + L.nz * P.climbSide; P.pos.z = L.z + L.nz * .42 - L.nx * P.climbSide;
  if (up > .1 && Math.random() < dt * 4) sfx.step(true);
  if (P.pos.y >= L.y1 - .15) { // pull up onto the ledge
    P.climb = null; P.pos.x = L.x - L.nx * 1.8 + L.nz * P.climbSide; P.pos.z = L.z - L.nz * 1.8 - L.nx * P.climbSide; P.pos.y = W.height(P.pos.x, P.pos.z); P.ground = true; sfx.land();
    if (W.onClimbTop) W.onClimbTop(L);
  } else if (P.pos.y <= L.y0 && up < 0) P.climb = null;
}

/* ---------- main player update ---------- */
export function updatePlayer(dt) {
  const inp = inputDir(); let mag = inp.mag; const sprint = K.shift || (JOY.active && mag > .95);
  if (P.climb) { updateClimb(dt, inp); P.invul -= dt; P.hurtT -= dt; updProjectiles(dt); P.stamina = Math.min(100, P.stamina + dt * 20); return; }
  if (G.mode !== 'play' || G.busy || P.hp <= 0) mag = 0;
  const A = P.act;
  // movement speed is reduced while attacking
  let spdMul = 1; if (A) spdMul = A.type === 'sling' ? .25 : A.type === 'light' ? .15 : A.type === 'heavy' ? (A.phase === 'charge' ? .3 : 0) : A.type === 'bark' ? .4 : 0;
  if (P.slowT > 0) { P.slowT -= dt; spdMul *= .4; }
  const wantSpd = mag * (sprint && !A ? 6.6 : 4.3) * spdMul;
  P.speed = damp(P.speed, wantSpd, mag > 0 ? 8 : 12, dt);
  if (mag > 0 && (!A || A.type === 'heavy' && A.phase === 'charge' || A.type === 'bark')) { P.dir.set(inp.x, 0, inp.z); P.yaw = angDamp(P.yaw, Math.atan2(inp.x, inp.z), 12, dt); }
  let vx = P.dir.x * P.speed + P.kb.x, vz = P.dir.z * P.speed + P.kb.z; P.kb.multiplyScalar(Math.exp(-dt * 6));
  // action timeline
  if (A) {
    A.t += dt; const f = fwd();
    if (A.type === 'light') {
      const L = LIGHT[A.n]; if (A.t < A.hitAt) { vx += f.x * L.lunge; vz += f.z * L.lunge; }
      if (!A.done && A.t >= A.hitAt) { A.done = true; showSlash(A.n, false); hitArc(L.range, L.cos, L.dmg * upg.stickMul(), L.kb, { combo: A.n }); }
      if (A.t >= A.dur) { P.act = null; P.comboT = .35; if (A.buf) startLight((A.n + 1) % 3); }
    } else if (A.type === 'heavy') {
      if (A.phase === 'charge') {
        if (!A.held && A.t > .2) releaseHeavy(A); else if (A.t > A.chargeMax + 1.2) releaseHeavy(A);
        if (Math.random() < dt * 20) emit(TEX.spark, P.pos.clone().setY(P.pos.y + 1.1), 1, { add: true, color: 0xffd36a, size: .15, speed: .8, g: 0, life: .3, spread: .3 });
      } else {
        if (!A.done && A.t >= A.hitAt) {
          A.done = true; showSlash(2, true); sfx.smash(); G.shake = .45; buzz(50);
          const p = P.pos.clone().addScaledVector(new THREE.Vector3(f.x, 0, f.z), 1.2); ring(p, 5 + A.ck * 2, 0xffc060, .5);
          emit(TEX.puff, p, 14, { color: 0xc8b090, size: .6, speed: 3, g: -2, life: .7, hz: 1.4 });
          hitArc(2.6 + A.ck * .8, -.1, (26 + A.ck * 26) * upg.stickMul(), 9 + A.ck * 4, { heavy: true, breakGuard: true });
        }
        if (A.t >= A.dur) P.act = null;
      }
    } else if (A.type === 'dodge') {
      const sp = 9.5 * (1 - A.t / A.dur * .6); vx = P.dodgeDir.x * sp + P.kb.x; vz = P.dodgeDir.z * sp + P.kb.z;
      if (A.t >= A.dur) P.act = null;
    } else if (A.type === 'sling') {
      if (!A.done && A.t >= A.fireAt) {
        A.done = true; P.ammo--; hud(); sfx.sling();
        const from = P.pos.clone().add(new THREE.Vector3(f.x * .4, 1.0, f.z * .4)); let dir;
        if (A.tgt && A.tgt.alive) { const to = new THREE.Vector3(A.tgt.x, (A.tgt.y ?? 0) + (A.tgt.chest ?? 1.1), A.tgt.z); dir = to.sub(from).normalize(); }
        else dir = new THREE.Vector3(f.x, .04, f.z).normalize();
        spawnProjectile({ pos: from, vel: dir.multiplyScalar(28), owner: 'player', dmg: upg.slingDmg(), r: .06, glow: 0xfff0b0, life: 1.4, kb: 2.5 });
      }
      if (A.t >= A.dur) P.act = null;
    } else if (A.type === 'bark') { if (A.t >= A.dur) P.act = null; }
  }
  P.comboT = (P.comboT || 0) - dt;
  const ox = P.pos.x, oz = P.pos.z; const np = { x: ox + vx * dt, z: oz + vz * dt }; collide(np, .28);
  const gz = W.minZ(); if (np.z < gz) { np.z = gz; if (G.mode === 'play' && W.onGate) W.onGate(); }
  const mz = W.maxZ ? W.maxZ() : 1e9; if (np.z > mz) np.z = mz;
  const gN = groundAt(np.x, np.z, P.pos.y), step = Math.hypot(np.x - ox, np.z - oz);
  // too high or too steep to walk up (cliffs): stop, and grab a vine if there is one
  const rise = gN.h - P.pos.y;
  if (P.ground && step > 1e-5 && rise > .05 && (rise > .45 || rise / step > 1.5)) { np.x = ox; np.z = oz; tryLadder(inp); }
  // keep out of deep water (unless standing on a raft)
  if (!gN.plat && !W.walkable(np.x, np.z)) { np.x = ox; np.z = oz; }
  P.pos.x = np.x; P.pos.z = np.z;
  if (P.ground && P.plat) { P.pos.x += P.plat.dx; P.pos.z += P.plat.dz; }
  P.vy -= 20 * dt; P.pos.y += P.vy * dt;
  const g = groundAt(P.pos.x, P.pos.z, P.pos.y), h = g.h;
  if (P.pos.y <= h) { if (!P.ground && P.vy < -4) { sfx.land(); P.landT = .15; } P.pos.y = h; P.vy = 0; P.ground = true; P.plat = g.plat; }
  else if (P.vy <= 0 && P.ground && P.pos.y - h < .35) { P.pos.y = h; P.vy = 0; P.plat = g.plat; } else { P.ground = false; P.plat = null; }
  if (P.ground) { P.airT = 0; if (!P.plat) P.lastSafe.copy(P.pos); } else P.airT += dt;
  if (P.jumpBuf > 0) { P.jumpBuf -= dt; if (P.ground) doJump(); }
  // stamina regen
  if (!A || A.type === 'sling') P.stamina = Math.min(100, P.stamina + dt * (P.speed > 5 ? 8 : 30));
  P.invul -= dt; P.hurtT -= dt; P.landT -= dt; P.tiredT = (P.tiredT || 0) - dt; if (P.invul <= 0) P.hurtFlash = false;
  // fight stance if an enemy is close
  let near = false; for (const e of ENEMIES) if (e.alive && !e.friendly && !e.prop && (e.x - P.pos.x) ** 2 + (e.z - P.pos.z) ** 2 < 64) { near = true; break; }
  P.fight = near ? 1 : 0;
  updProjectiles(dt);
  if (slashT > 0) { slashT -= dt; slashMat.opacity = Math.max(0, slashT * 5); if (slashT <= 0) slash.visible = false; }
}
export function updateProjectilesOnly(dt) { updProjectiles(dt); }
