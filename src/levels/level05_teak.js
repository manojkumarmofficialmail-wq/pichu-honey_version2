// LEVEL 5 — TEAK RIVER (Nilambur, Malappuram)
// South → north: Conolly's Plot (one of the world's oldest teak plantations, with its giant teak) →
// the Chaliyar river, where the poachers cut the hanging bridge: hop across floating teak logs →
// logging camp (animals + Mittu's food bowl) → Kaala's sawmill → the Sawmill Boss → Kaala himself!
import { THREE, std, M, jitter, hsl, TEX, signTex } from '../core/engine.js';
import { G, P, W, CC, CAM } from '../core/state.js';
import { PI, TAU, clamp, lerp, smooth, fbm, vnoise, seed, sr, srnd, rand, pick, Q, MOBILE } from '../core/utils.js';
import { sfx, AU, MUS } from '../core/audio.js';
import { dialog, setObjective, popText, showTitle, bossBar } from '../core/ui.js';
import { runCine } from '../core/cine.js';
import { FLOW } from '../core/flow.js';
import { buildTerrain, buildWater, tooClose, resetCollision, addOb } from '../world/terrain.js';
import { Flora } from '../world/foliage.js';
import { emit } from '../world/particles.js';
import { spawnPickup } from '../world/pickups.js';
import { makeSign, makeTent, makeCampfire, makeJeep, Crate, Cage, Barricade, hornbillFlyer } from '../world/props.js';
import { FloatLog, brokenBridge, logStack, sawmillShed, makeKaala } from '../world/props3.js';
import { WX } from '../world/weather.js';
import { makeHuman, animHuman } from '../actors/human.js';
import { animQuad } from '../actors/quad.js';
import { HN, placeHoney } from '../actors/honey.js';
import { Enemy, wakeGroup } from '../combat/enemies.js';
import { Drone } from '../combat/drone.js';
import { SawmillBoss } from '../combat/bosses4.js';
import { ENEMIES } from '../combat/combat.js';
import { Clue, puppyWhine } from '../world/story.js';
import { newRuntime, tickCommon, tryFreeCage, tryInteract, setCP, respawnReset, ambientBirds, alive } from './kit.js';
import { Stone, Crumble } from '../world/challenges.js';
import { KeyItem, KeyGate, Chest } from '../world/treasure.js';
import { Discovery } from '../world/discovery.js';

/* ---------- layout ---------- */
const pathX = z => Math.sin(z * .02 + 1.5) * 10 + Math.sin(z * .055) * 3;
const riverZ = x => 58 + Math.sin(x * .04) * 2;
const START = { x: pathX(118), z: 118 };
const GIANT = { x: START.x - 9, z: 106 };             // the giant teak of Conolly's Plot
const XR = pathX(58), RZ = riverZ(XR);                 // where Pichu crosses the river
const CAMP = { x: pathX(16), z: 16 };
const AR = { x: pathX(-86), z: -86, r: 16 };
const MACH = { x: AR.x, z: AR.z - 11.5 };
const GZ = -22, WALLZ = AR.z + 18;
const RVZ = -40;                                       // a rocky gorge on the way to the sawmill (rotten walkway)
const MUSEUM = { x: START.x + 9, z: 112 };

function baseH(x, z) {
  let h = fbm(x * .02 + 6.6, z * .02 + 3.3) * 3.2 + vnoise(x * .1, z * .1) * .3;
  h += 3 * smooth(40, -30, z);
  const rd = Math.abs(z - riverZ(x)); h = lerp(h, .4, smooth(15, 8.5, rd) * .85); h = lerp(h, -2.9, smooth(7.6, 6.7, rd));
  h = lerp(h, -3.2, smooth(4.4, 3.7, Math.abs(z - RVZ)));
  const ex = Math.max(0, Math.abs(x - pathX(z) * .4) - 43); h += ex * ex * .08;
  const es = Math.max(0, z - 124); h += es * es * .1;
  return h;
}
const H_START = baseH(START.x, START.z), H_CAMP = baseH(CAMP.x, CAMP.z), H_AR = baseH(AR.x, AR.z) + .4;
function height(x, z) {
  let h = baseH(x, z);
  h = lerp(h, H_START, smooth(12, 6, Math.hypot(x - START.x, z - START.z)));
  h = lerp(h, H_CAMP, smooth(16, 11, Math.hypot(x - CAMP.x, z - CAMP.z)));
  const da = Math.hypot(x - AR.x, z - AR.z); h = lerp(h, H_AR, smooth(19, 14, da)); h += Math.max(0, da - 18) ** 2 * .25 * smooth(AR.z + 24, AR.z + 14, z);
  const pd = Math.abs(x - pathX(z)); h -= smooth(2.4, .5, pd) * .1;
  return h;
}
const C = { grass: new THREE.Color(0x5a8a32), grass2: new THREE.Color(0x8aa848), leaf: new THREE.Color(0x7a6a3a), path: new THREE.Color(0x9a6a42), path2: new THREE.Color(0x7a5434), bank: new THREE.Color(0xa89068), mud: new THREE.Color(0x4a4434), rock: new THREE.Color(0x7d7a72), yard: new THREE.Color(0xa88a5a) };
function colour(c, x, z, y, sl) {
  const n = fbm(x * .05, z * .05) * .5 + .5, n2 = vnoise(x * .25, z * .25) * .5 + .5, t = new THREE.Color();
  c.copy(C.grass).lerp(C.grass2, clamp(n * 1.2 - .2, 0, 1)).lerp(C.leaf, n2 * .35);   // dry teak leaves on the ground
  if (Math.hypot(x - AR.x, z - AR.z) < 17 || Math.hypot(x - CAMP.x, z - CAMP.z) < 13) c.lerp(C.yard, .75);
  const pd = Math.abs(x - pathX(z)); t.copy(C.path).lerp(C.path2, n2); c.lerp(t, smooth(2.5, 1.2, pd + n2 * .5) * .9);
  const rd = Math.abs(z - riverZ(x)); if (rd < 10) c.lerp(C.bank, .7); if (y < W.water + .05) c.lerp(C.mud, smooth(W.water + .05, W.water - 1, y));
  c.lerp(C.rock, smooth(1.2, 2.4, sl)); c.multiplyScalar(.92 + n2 * .14);
}

let L = null;
const level = {
  id: 5, name: 'Teak River', ml: 'നിലമ്പൂർ', region: 'Nilambur · Malappuram', music: 'forest', cages: 3,
  envKeys: [[999, 'morning'], [84, 'morning'], [52, 'noon'], [0, 'golden'], [-52, 'golden'], [-72, 'sunsetGold']],
  objectiveTarget() { return L?.target?.() ?? null; },
  sniffTarget() { if (!L) return null; if (!L.clue.found) return { x: L.clue.x, z: L.clue.z, clue: true }; return this.objectiveTarget(); },

  build(root) {
    resetCollision(); seed(8585);
    W.height = height; W.water = -.6; W.bounds = { x0: -54, x1: 54, z0: AR.z - 14, z1: 127 };
    W.walkable = (x, z) => !((Math.abs(z - riverZ(x)) < 7.6 || Math.abs(z - RVZ) < 4.5) && height(x, z) < W.water - .35);
    WX.rain = 0; WX.night = 0;
    L = newRuntime(root, { stage: 0 }); setCP(L, START.x, START.z - 2);
    W.minZ = () => G.stage < 1 && alive(1) ? RZ + 13 : !L.gates.g.open ? GZ + .7 : -1e9;
    W.maxZ = () => L.walled ? WALLZ - .6 : 1e9;
    W.onGate = () => {
      if (L.msgT > 0) return; L.msgT = 5;
      if (G.stage < 1) dialog('Pichu', 'The poachers are watching the plantation. Let\'s deal with them first!', 3);
      else dialog('Pichu', 'A log barricade! We need to free the animals and find a clue about Mittu.', 3);
    };
    buildTerrain(root, { w: 112, l: 255, cx: 0, cz: (W.bounds.z0 + 128) / 2, nx: 112, nz: 245, height, colour });
    buildWater(root, { x: 0, z: 58, w: 116, l: 20, y: W.water, repeat: [24, 5] });
    this.plants(root); this.props(root); this.actors(root);
  },

  plants(root) {
    const F = new Flora();
    const clear = (x, z) => Math.hypot(x - START.x, z - START.z) < 9 || Math.hypot(x - CAMP.x, z - CAMP.z) < 14 || Math.hypot(x - AR.x, z - AR.z) < 20 || Math.abs(z - riverZ(x)) < 9.5 || Math.hypot(x - GIANT.x, z - GIANT.z) < 5 || Math.abs(z - RVZ) < 6 || Math.hypot(x - MUSEUM.x, z - MUSEUM.z) < 6 || Math.hypot(x - CAMP.x - 13, z - CAMP.z - 4) < 4;
    // Conolly's Plot: teak planted in neat rows
    for (let z = 124; z > 70; z -= 5.2) for (let x = -50; x < 50; x += 5.2) {
      const tx = x + sr(-.6, .6), tz = z + sr(-.6, .6); if (Math.abs(tx - pathX(tz)) < 4.5 || clear(tx, tz)) continue;
      F.teak(tx, height(tx, tz), tz, sr(.85, 1.15));
    }
    F.teak(GIANT.x, height(GIANT.x, GIANT.z), GIANT.z, 2.3);
    // wild teak and rainforest north of the river
    const tries = 12000 * Q.trees;
    for (let i = 0; i < tries; i++) {
      const x = sr(-52, 52), z = sr(AR.z - 12, 68), y = height(x, z); const pd = Math.abs(x - pathX(z));
      if (pd < 4.2 || clear(x, z) || (Math.abs(z - GZ) < 2 && pd < 7)) continue;
      if (srnd() > .7) continue; if (tooClose(x, z, 2.8)) continue;
      const r = srnd(); if (r < .55) F.teak(x, y, z, sr(.8, 1.2)); else if (r < .8) F.rain(x, y, z, sr(.8, 1.2)); else if (r < .92) F.bamboo(x, y, z, sr(.8, 1.1)); else F.areca(x, y, z, sr(.8, 1));
    }
    for (let i = 0; i < 30; i++) { const z = riverZ(0) + (srnd() < .5 ? -1 : 1) * sr(8.5, 11), x = sr(-50, 50); if (Math.abs(x - XR) < 6 || tooClose(x, z, 3)) continue; F.coconut(x, height(x, z), z, sr(.9, 1.15)); }
    for (let i = 0; i < 380; i++) { const x = sr(-52, 52), z = sr(AR.z - 10, 124), y = height(x, z); if (Math.abs(x - pathX(z)) < 2.6 || y < W.water + .3 || clear(x, z)) continue; if (srnd() > .4) continue; F.rock(x, y, z, srnd() < .15 ? sr(.8, 1.5) : sr(.2, .5)); }
    for (let i = 0; i < 1800; i++) { const x = sr(-52, 52), z = sr(AR.z - 10, 124), y = height(x, z); if (Math.abs(x - pathX(z)) < 2.2 || y < W.water + .4 || clear(x, z)) continue; if (srnd() < .7) F.fern(x, y, z, sr(.7, 1.3)); else F.bush(x, y, z, sr(.25, .5)); }
    let gs = 0, tr = 0; while (gs < Q.grass && tr < Q.grass) {
      tr++; const cx = sr(-52, 52), cz = sr(AR.z - 12, 124), n = 7 + (srnd() * 10 | 0);
      for (let k = 0; k < n; k++) { const x = cx + sr(-.8, .8), z = cz + sr(-.8, .8), y = height(x, z); if (y < W.water + .15) continue; const pd = Math.abs(x - pathX(z)); if (pd < 1.3 && srnd() < .85) continue; F.grass(x, y, z, sr(.25, .6) * (pd < 2 ? .6 : 1), hsl(sr(.16, .26), sr(.4, .55), sr(.3, .42))); gs++; }
    }
    F.flush(root);
  },

  props(root) {
    makeSign(root, START.x - 3.5, START.z + 2, 0, 'നിലമ്പൂർ', "Conolly's Plot · Nilambur", '#2f5a2a');
    makeSign(root, GIANT.x + 3.5, GIANT.z + 2.5, -.4, 'GIANT TEAK', "Conolly's Plot", '#5a3a1a');
    makeSign(root, XR + 3, RZ + 10.5, 0, '⚠ BRIDGE CUT', 'by poachers!', '#8a2a1a');
    brokenBridge(root, XR + 7, RZ - 8.5, RZ + 8.5);
    // floating teak logs: 5 lanes across the river, all drifting east with the current
    L.logs = [];
    [4.8, 2.4, 0, -2.4, -4.8].forEach((dz, i) => {
      // neighbouring lanes drift at very different speeds, so a log lines up every few seconds
      const sp = [1.1, 2.5, 1.0, 2.3, 1.3][i] * (MOBILE ? .9 : 1), n = 4;
      for (let k = 0; k < n; k++) L.logs.push(new FloatLog(root, RZ + dz, XR - 24, XR + 24, XR - 24 + k * 48 / n + i * 3, sp, i % 2 ? 3.8 : 4.4));
    });
    L.ticks.push({ tick: (dt, t) => { for (const l of L.logs) l.update(dt, t); } });
    // logging camp
    makeTent(root, CAMP.x - 9, CAMP.z + 3, .5, 0x5a5a3a); makeTent(root, CAMP.x + 9, CAMP.z + 5, -.5, 0x4a4a3a);
    L.ticks.push(makeCampfire(root, CAMP.x + 1, CAMP.z + 2)); makeJeep(root, CAMP.x - 8, CAMP.z - 7, .6);
    logStack(root, CAMP.x + 7, CAMP.z - 5, .2, 3, 5); logStack(root, CAMP.x - 3, CAMP.z + 10, 1.4, 2, 4);
    L.cages.push(Object.assign(new Cage(root, pathX(40) + 7, 40, 'squirrel', 0), { guard: 2 }));
    L.cages.push(Object.assign(new Cage(root, CAMP.x - 6, CAMP.z - 2, 'spotted', 0), { guard: 3 }));
    L.cages.push(Object.assign(new Cage(root, CAMP.x + 4, CAMP.z - 9, 'macaque', 0), { guard: 3 }));
    L.clue = new Clue(root, CAMP.x - 2, CAMP.z - 11, 'bowl', () => { puppyWhine(.15); dialog('Pichu', "Mittu's little food bowl — and it still has rice in it! Kaala must be taking her to the sawmill right now!", 5); HN.bark = 1; this.checkGate(); this.objective(); });
    L.ticks.push(L.clue);
    L.gates.g = new KeyGate(root, pathX(GZ), GZ, 8);
    const campDone = () => L.wave4 && !alive(2) && !alive(3) && !alive(4) && G.freed >= 3 && L.clue.found;
    L.inter.push({ canUse: () => L.gates.g.canUse(), label: () => L.gates.g.label(), use: () => { if (!campDone()) { dialog('Pichu', 'First let\'s clear the camp, free the animals and find Mittu\'s clue.', 3); return true; } const ok = L.gates.g.use(); this.checkGate(); return ok; } });
    // climb the cut teak stumps by the camp: the gate key is on the tallest one
    const st = [[11, 2, 1.0], [13.6, 4.2, 1.9], [11.8, 6.6, 2.8], [14.2, 8.4, 3.6]];
    st.forEach(([dx, dz, h]) => new Stone(root, CAMP.x + dx, CAMP.z + dz, .75, height(CAMP.x + dx, CAMP.z + dz) + h, 'stump'));
    { const [dx, dz, h] = st[st.length - 1]; L.key = new KeyItem(root, CAMP.x + dx, CAMP.z + dz, { y: height(CAMP.x + dx, CAMP.z + dz) + h, name: 'Sawmill gate key', onGet: () => { dialog('Pichu', 'The sawmill gate key! Now nothing can stop us.', 3); this.objective(); } }); L.ticks.push(L.key); }
    // the rotten walkway over the gorge: planks crumble a moment after you step on them — RUN!
    buildWater(root, { x: 0, z: RVZ, w: 116, l: 9, y: W.water, repeat: [24, 2] });
    { const px = pathX(RVZ), topY = height(px, RVZ + 4.8) + .02; L.planks = []; for (let i = 0; i < 9; i++) { const z = RVZ + 4.2 - i * 1.05; L.planks.push(new Crumble(root, px, z, 2.2, 1.12, topY)); }
      for (const s of [-1, 1]) for (const z of [RVZ + 4.6, RVZ - 4.6]) M(new THREE.CylinderGeometry(.1, .12, 1.6, 6), std(0x5a3a22), px + s * 1.15, topY + .5, z, root);
      L.ticks.push({ tick: dt => { for (const p of L.planks) p.update(dt); } }); }
    makeSign(root, pathX(RVZ + 7) + 3.5, RVZ + 7, 0, '⚠ ROTTEN', 'walkway — run!', '#8a2a1a');
    // treasure
    [[pathX(110) + 14, 110], [CAMP.x - 14, CAMP.z + 9], [pathX(-56) - 10, -56]].forEach(([x, z]) => { const c = new Chest(root, x, z); L.inter.push(c); L.ticks.push(c); });
    // the teak museum + Nature Book
    { const g = new THREE.Group(); g.position.set(MUSEUM.x, height(MUSEUM.x, MUSEUM.z), MUSEUM.z); g.rotation.y = -PI / 2; root.add(g); M(new THREE.BoxGeometry(6, 3, 4), std(0xe8dcc0), 0, 1.5, 0, g); const rf = M(new THREE.ConeGeometry(4.4, 1.6, 4), std(0x8a4a2a, { flatShading: true }), 0, 3.8, 0, g); rf.rotation.y = PI / 4; rf.scale.set(1, 1, .75); for (const s of [-1, 1]) M(new THREE.CylinderGeometry(.16, .16, 3, 8), std(0x7a5030), s * 1.6, 1.5, 2.1, g); addOb(MUSEUM.x, MUSEUM.z, 3.2); makeSign(root, MUSEUM.x - 3.8, MUSEUM.z + 2.5, 0, 'TEAK MUSEUM', 'Nilambur', '#5a3a1a'); }
    L.ticks.push(new Discovery(root, 'teakmuseum', MUSEUM.x - 3, MUSEUM.z, { r: 6, y: height(MUSEUM.x, MUSEUM.z) + 2 }));
    L.ticks.push(new Discovery(root, 'conolly', pathX(114), 114, { r: 5, y: H_START }));
    L.ticks.push(new Discovery(root, 'bigteak', GIANT.x, GIANT.z, { r: 8, y: height(GIANT.x, GIANT.z) + 6 }));
    L.ticks.push(new Discovery(root, 'teak', pathX(86) + 4, 86, { r: 5, y: height(pathX(86) + 4, 86) + 2 }));
    L.ticks.push(new Discovery(root, 'chaliyar', XR - 2, RZ + 9.5, { r: 6, y: height(XR - 2, RZ + 9.5) }));
    L.ticks.push(new Discovery(root, 'hangbridge', XR + 7, RZ + 10, { r: 6, y: height(XR + 7, RZ + 10) + 2 }));
    makeSign(root, pathX(-58) + 4, -58, 0, 'SAWMILL', 'KEEP OUT!', '#8a2a1a');
    // the sawmill yard
    L.ticks.push(sawmillShed(root, AR.x + 4, AR.z - 25, 12, 7, 0)); addOb(MACH.x, MACH.z, 2.8);
    [[-14, 4, .3], [14, 8, -.4], [-12, -10, 1.2], [12, -12, .9], [-17, -3, 1.6]].forEach(([dx, dz, ry]) => logStack(root, AR.x + dx * 1.15, AR.z + dz, ry, 3, 5));
    [[START.x + 4, 112, 'ammo'], [pathX(96) - 5, 96, 'heal'], [pathX(76) + 4, 76, 'ammo'], [pathX(44) - 5, 44, 'ammo'], [CAMP.x + 10, CAMP.z - 2, 'heal'], [CAMP.x - 11, CAMP.z - 4, 'ammo'], [pathX(-36) + 5, -36, 'ammo'], [pathX(-60) - 5, -60, 'heal']].forEach(([x, z, l]) => new Crate(root, x, z, l));
    [[START.x + 6, 122], [GIANT.x - 3, GIANT.z - 3], [pathX(100) + 10, 100], [pathX(82) - 9, 82], [XR - 4, RZ + 9.5], [pathX(46) + 9, 46], [CAMP.x + 12, CAMP.z + 8], [CAMP.x - 1, CAMP.z - 13], [pathX(-8) - 9, -8], [pathX(-34) + 8, -34], [pathX(-56) - 8, -56], [AR.x + 11, AR.z + 7]].forEach(([x, z]) => spawnPickup('pod', x, z, root));
    for (let i = 0; i < 3; i++) L.ticks.push(hornbillFlyer(root, pathX(70) + sr(-15, 15), sr(30, 110), sr(18, 30), sr(12, 20), sr(.05, .09) * (i % 2 ? 1 : -1), sr(0, TAU)));
  },

  actors(root) {
    L.ranger = makeHuman({ skin: 0x8a5a3a, shirt: 0xb8a070, pants: 0x9a8a5a, hat: 'ranger', moustache: false, boot: 0x1a1410 });
    L.ranger.root.position.set(START.x + 2.4, H_START, START.z - 3); root.add(L.ranger.root);
    [[-3, 96, 'grunt'], [3, 93, 'grunt'], [0, 88, 'slinger']].forEach(([dx, z, t]) => new Enemy(t, pathX(z) + dx, z, root, { group: 1 }));
    [[0, 42, 'brute'], [-5, 38, 'grunt'], [5, 36, 'grunt']].forEach(([dx, z, t]) => new Enemy(t, pathX(z) + dx, z, root, { group: 2 }));
    [[-4, 4, 'grunt'], [4, 2, 'grunt'], [-10, -4, 'slinger'], [10, -6, 'slinger']].forEach(([dx, dz, t]) => new Enemy(t, CAMP.x + dx, CAMP.z + dz, root, { group: 3 })); new Drone(CAMP.x, CAMP.z - 6, root, { group: 3 });
    L.boss = new SawmillBoss(root, AR, MACH, { yaw: 0 });
    L.target = () => {
      if (G.stage === 0) return alive(1) ? { x: pathX(93), z: 93 } : { x: XR, z: RZ + 8 };
      if (G.stage === 1) { if (alive(2) || !L.cages[0].free) return L.cages[0]; if (alive(3) || alive(4)) return CAMP; const c = L.cages.find(c => !c.free); if (c) return c; if (!L.clue.found) return L.clue; if (!L.key.got && !(G.keys > 0)) return L.key; return { x: pathX(GZ), z: GZ }; }
      if (G.stage === 2) return AR;
      return null;
    };
  },

  start(skipIntro) {
    P.pos.set(START.x, H_START, START.z - 2); P.yaw = PI; placeHoney(START.x + 1.2, START.z - 1.5, PI); G.stage = 0;
    const r = L.ranger.root.position;
    const go = () => { FLOW.startPlay(); showTitle('Level 5', 'Teak River', 'Cross the Chaliyar and stop Kaala\'s sawmill', 'നിലമ്പൂർ'); this.objective(); };
    if (skipIntro) { go(); return; }
    runCine([
      { d: 5.2, start() { CC.rate = 1.2; CC.pos.set(GIANT.x + 8, H_START + 4, GIANT.z + 9); CC.look.set(GIANT.x, height(GIANT.x, GIANT.z) + 14, GIANT.z); dialog('Narrator', "Nilambur — home of Conolly's Plot, the oldest teak plantation in the world. One of the tallest teak trees in the world grows right here."); }, update(k) { CC.look.y = height(GIANT.x, GIANT.z) + 14 - k * 10; } },
      { d: 5.2, start() { CC.rate = 2; CC.pos.set(r.x - 2.4, r.y + 1.7, r.z - 2.6); CC.look.set(r.x, r.y + 1.4, r.z); dialog('Ranger Ammini', "Kaala's sawmill is across the Chaliyar river. But his men cut the hanging bridge! The river is full of teak logs floating downstream…"); } },
      { d: 4, start() { CC.pos.set(START.x - 1.5, H_START + 1.3, START.z - 4.6); CC.look.set(START.x, H_START + .8, START.z - 2); HN.bark = 1; sfx.bark(0, .4); dialog('Pichu', 'Then we\'ll hop across the logs! Mittu, we\'re almost there!'); } },
    ], go);
  },

  objective() {
    const s = G.stage;
    setObjective(
      s === 0 ? (alive(1) ? `Stop the poachers in the teak plantation (${3 - alive(1)}/3)` : `Cross the Chaliyar — JUMP from log to log (${MOBILE ? '⤒' : 'Space'})`) :
      s === 1 ? (G.freed < 3 || alive(2) || alive(3) || alive(4) ? `Raid the logging camp and free the animals (${G.freed}/3)` : !L.clue.found ? 'Search the camp for a clue about Mittu (Q / 👃 SNIFF)' : !L.key.got && !(G.keys > 0) ? 'Jump up the cut teak stumps by the camp to reach the key 🔑' : L.gates.g.open ? 'The way to the sawmill is open!' : 'Unlock the gate with the key 🔑') :
      s === 2 ? 'Go to Kaala\'s sawmill 🪚' : 'Defeat the Sawmill Boss!');
  },

  onEnemyKO(e) {
    if (e.boss) { this.bossDefeated(); return; }
    setTimeout(() => {
      if (G.stage === 0 && !alive(1) && !L.toldRiver) { L.toldRiver = true; sfx.big(); popText('Plantation cleared! 🌳'); dialog('Pichu', 'Now, to the river. Wait for a log to come close, then JUMP!', 4); }
      if (!alive(3) && !L.wave4 && L.campOn) { L.wave4 = true; dialog('Poacher', 'Boss! Somebody\'s smashing up the camp!', 2.5); new Enemy('brute', CAMP.x, CAMP.z - 18, L.root, { group: 4, awake: true }); [[-7, -16], [7, -18]].forEach(([dx, dz]) => new Drone(CAMP.x + dx, CAMP.z + dz, L.root, { group: 4, awake: true })); }
      this.checkGate(); this.objective();
    }, 400);
  },
  checkGate() {
    if (G.stage === 1 && L.gates.g.open) {
      G.stage = 2; setCP(L, pathX(GZ - 2), GZ - 2); sfx.big(); popText('Camp cleared! 🪵');
      dialog('Pichu', 'I can hear saws screaming up ahead… that must be Kaala\'s sawmill!', 4); this.objective();
    }
  },
  action() { if (tryInteract(L)) { this.objective(); return; } tryFreeCage(L, c => c.guard === 2 ? alive(2) > 0 : alive(3) > 0 || alive(4) > 0 || !L.wave4); this.checkGate(); this.objective(); },

  startBoss() {
    L.walled = true; P.pos.set(AR.x, W.height(AR.x, AR.z + 8), AR.z + 8); P.yaw = PI; CAM.yaw = 0; G.stage = 3; setCP(L, AR.x, AR.z + 11); this.objective();
    const g = new THREE.Group(); g.position.set(pathX(WALLZ), height(pathX(WALLZ), WALLZ), WALLZ); L.root.add(g);
    for (let i = 0; i < 6; i++) { const l = M(new THREE.CylinderGeometry(.4, .42, 7, 10), std(0x7a5030, { roughness: .9 }), sr(-1, 1), .4 + i * .3, sr(-.6, .6), g); l.rotation.z = PI / 2; l.rotation.y = sr(-.15, .15); }
    sfx.smash(); G.shake = .4;
    const b = L.boss, s = b.seat();
    runCine([
      { d: 3.4, start() { MUS.mood = 'boss'; CC.rate = 2.5; CC.pos.set(MACH.x + 5, s.y + 1.5, MACH.z + 7); CC.look.set(s.x, s.y + 1.5, s.z); sfx.roar(); dialog('The Sawmill Boss', 'Who let a CHILD into my sawmill?! This is a work zone!'); } },
      { d: 3.4, start() { CC.pos.set(MACH.x - 4, s.y, MACH.z + 9); dialog('The Sawmill Boss', 'Kaala pays me to keep busybodies out. Let\'s see you dodge my teak logs!'); } },
      { d: 3, start() { CC.pos.set(P.pos.x + 2.5, P.pos.y + 1.6, P.pos.z + 3); CC.look.set(P.pos.x, P.pos.y + .9, P.pos.z - 2); dialog('Pichu', 'Jump the thin logs, roll past the fat ones, and hit that red valve! Ready, Honey?'); } },
    ], () => { FLOW.startPlay(); b.awake = true; L.bossOn = true; bossBar(b.name, 1); showTitle('Boss', 'The Sawmill Boss', 'Jump the logs · slingshot the red valve · hit him when he climbs down!'); });
  },
  bossDefeated() {
    L.bossOn = false; const b = L.boss, s = b.seat();
    const k = makeKaala(true); k.root.visible = false; L.root.add(k.root);
    setTimeout(() => runCine([
      { d: 3.4, start() { MUS.mood = 'forest'; CC.rate = 2.5; CC.pos.set(b.x + 3, b.y + 2, b.z + 4); CC.look.set(b.x, b.y + 1.2, b.z); dialog('The Sawmill Boss', 'Ooof… alright, kid, you win! But I\'m not the one with your puppy…'); } },
      { d: 4.2, start() { k.root.visible = true; k.root.position.copy(s); k.root.position.y -= .2; k.root.rotation.y = 0; sfx.roar(); puppyWhine(.3); CC.pos.set(s.x + 3, s.y + 1.2, s.z + 6); CC.look.set(s.x, s.y + 1.8, s.z); dialog('Kaala', 'So THIS is the famous Pichu. You fight well… for a little boy.'); }, update(k2, dt) { animHuman(k, dt, 0, 'taunt', performance.now() / 1000); if (k.pup) animQuad(k.pup, dt, 0, 'alert', performance.now() / 1000, { wag: .1 }); } },
      { d: 3, start() { CC.pos.set(P.pos.x + 2, P.pos.y + 1.5, P.pos.z + 3); CC.look.set(P.pos.x, P.pos.y + 1, P.pos.z - 2); HN.bark = 1; sfx.bark(0, .7); dialog('Pichu', 'MITTU! Give her back, Kaala!'); } },
      { d: 4.4, start() { CC.pos.set(s.x + 3, s.y + 1.2, s.z + 6); CC.look.set(s.x, s.y + 1.8, s.z); dialog('Kaala', 'Come and take her — in my caves at Wayanad. If you can find them. Ha ha ha!'); }, update(k2, dt) { animHuman(k, dt, 0, 'taunt', performance.now() / 1000); } },
      { d: 1.6, start() { sfx.smash(); emit(TEX.puff, k.root.position.clone().setY(s.y + 1), 50, { color: 0x555555, size: 1.5, speed: 3, g: 0, life: 1.8, spread: 1.3 }); }, end() { k.root.visible = false; b.h.root.visible = false; } },
      { d: 5, start() { HN.script = true; HN.mode = 'lie'; HN.speed = 0; HN.wag = 0; HN.pant = false; CC.pos.set(P.pos.x + 2.6, P.pos.y + 1.4, P.pos.z + 2.8); CC.look.set(P.pos.x, P.pos.y + .6, P.pos.z); puppyWhine(.15); dialog('Pichu', 'Don\'t cry, Honey. Wayanad is the very last forest. We\'ll bring Mittu home — I promise.'); } },
    ], () => { HN.script = false; HN.pant = true; G.stage = 4; FLOW.complete(); }, () => { k.root.visible = false; b.h.root.visible = false; HN.script = false; HN.pant = true; }), 1300);
  },
  onPlayerDown() { respawnReset(L, b => b.resetFight()); },

  update(dt, t) {
    { const r = L.ranger.root, dx = P.pos.x - r.position.x, dz = P.pos.z - r.position.z; r.rotation.y = Math.atan2(dx, dz); animHuman(L.ranger, dt, 0, 'idle', t); }
    if (!tickCommon(L, dt, t, 'forest')) return;
    if (P.pos.z < 104) wakeGroup(1);
    if (G.stage === 0 && !alive(1) && P.pos.z < RZ - 7.6 && W.walkable(P.pos.x, P.pos.z) && P.ground) { G.stage = 1; setCP(L, P.pos.x, P.pos.z); sfx.big(); popText('Across the Chaliyar! 🌊'); dialog('Pichu', 'We made it across! Honey, come on — the camp must be close.', 3); this.objective(); }
    if (P.pos.z < 50) wakeGroup(2);
    if (P.pos.z < 30) { wakeGroup(3); if (!L.campOn) { L.campOn = true; MUS.mood = 'battle'; dialog('Pichu', 'A logging camp — with animals in cages!', 3); } }
    if (!L.gorgeMsg && P.pos.z < RVZ + 9 && G.stage >= 2) { L.gorgeMsg = true; dialog('Pichu', 'A rotten walkway over the gorge! The planks will break — I have to run across fast!', 4); }
    if (!L.walled && G.stage === 2 && P.pos.z < WALLZ - 1.5) this.startBoss();
    if (L.bossOn) { const dx = P.pos.x - AR.x, dz = P.pos.z - AR.z, d = Math.hypot(dx, dz); if (d > AR.r - .5) { P.pos.x = AR.x + dx / d * (AR.r - .5); P.pos.z = AR.z + dz / d * (AR.r - .5); } }
    this.objective();
    if (AU.ctx) { const rd = Math.abs(P.pos.z - riverZ(P.pos.x)); AU.water.g.gain.value += (clamp(1 - rd / 30, 0, 1) * .18 - AU.water.g.gain.value) * Math.min(1, dt * 2); AU.wind.g.gain.value = .03 + Math.sin(t * .2) * .01; }
    ambientBirds(dt);
  },
  dispose() { L = null; },
};
export default level;
