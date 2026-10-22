// LEVEL 1 — AGASTHYA HILLS (Agasthyamala / Neyyar, Thiruvananthapuram)
// South → north: ranger post by the Neyyar reservoir → rainforest trail → poacher camp →
// rocky shola climb → Captain Snare on the plateau below Agasthyakoodam peak.
import { THREE, std, M, B, CY, jitter, hsl, TEX } from '../core/engine.js';
import { G, P, W, CC, CAM } from '../core/state.js';
import { PI, TAU, clamp, lerp, smooth, fbm, vnoise, seed, sr, srnd, rand, pick, Q, DV, MOBILE } from '../core/utils.js';
import { sfx, AU, MUS, panOf } from '../core/audio.js';
import { dialog, setObjective, setPrompt, popText, showTitle, hud, bossBar } from '../core/ui.js';
import { runCine } from '../core/cine.js';
import { FLOW } from '../core/flow.js';
import { buildTerrain, buildWater, addOb, tooClose, resetCollision } from '../world/terrain.js';
import { Flora } from '../world/foliage.js';
import { emit, ring } from '../world/particles.js';
import { spawnPickup } from '../world/pickups.js';
import { makeHut, makeSign, makeTent, makeCampfire, makeJeep, Crate, Dummy, Cage, Barricade, hornbillFlyer, sambar } from '../world/props.js';
import { makeHuman, animHuman } from '../actors/human.js';
import { pichu } from '../actors/pichu.js';
import { HN, placeHoney } from '../actors/honey.js';
import { Enemy, groupAlive, wakeGroup } from '../combat/enemies.js';
import { CaptainSnare } from '../combat/bosses.js';
import { ENEMIES, clearProjectiles } from '../combat/combat.js';
import { animQuad } from '../actors/quad.js';
import { makePuppy, puppyWhine, Clue } from '../world/story.js';

/* ---------- world layout ---------- */
const pathX = z => Math.sin(z * .02) * 11 + Math.sin(z * .05 + 1.3) * 4;
const shoreX = z => -22 + Math.sin(z * .045) * 5;
const START = { x: pathX(118), z: 118 };
const HUT = { x: START.x + 7.5, z: 121 };
const DUMMY = { x: START.x - .4, z: START.z - 4.6 };   // right in front of Pichu: no walking needed to train
const CAMP = { x: pathX(8), z: 8 };
const AR = { x: pathX(-97), z: -97, r: 13 };
const PK = { x: AR.x + 2, z: AR.z - 25 };
const G1Z = 106, G2Z = 48, G3Z = -24, WALLZ = AR.z + 15;

function baseH(x, z) {
  let h = fbm(x * .02 + 5.3, z * .02 - 3.1) * 4 + vnoise(x * .1, z * .1) * .3;
  h += 14.5 * smooth(-24, -86, z);
  const lm = smooth(50, 64, z);
  if (lm > 0) { const d = x - shoreX(z); h = lerp(h, .3, smooth(12, 3, d) * lm * .7); h = lerp(h, -3.4, smooth(1, -7, d) * lm); }
  const ex = Math.max(0, Math.abs(x - pathX(z) * .4) - 44); h += ex * ex * .07;
  const es = Math.max(0, z - 124); h += es * es * .1;
  return h;
}
const H_START = baseH(START.x + 2, 116), H_CAMP = baseH(CAMP.x, CAMP.z), H_AR = baseH(AR.x, AR.z) + 1;
function height(x, z) {
  let h = baseH(x, z);
  h = lerp(h, H_START, smooth(15, 8, Math.hypot(x - START.x - 2, z - 116)));
  h = lerp(h, H_CAMP, smooth(17, 11, Math.hypot(x - CAMP.x, z - CAMP.z)));
  const da = Math.hypot(x - AR.x, z - AR.z);
  h = lerp(h, H_AR, smooth(17, 12, da));
  h += 30 * smooth(17, 3, Math.hypot(x - PK.x, z - PK.z)) * (1 - smooth(13, 9, da));
  const pd = Math.abs(x - pathX(z)); h -= smooth(2.6, .5, pd) * .12;
  return h;
}
const C = {
  grass: new THREE.Color(0x4f8f2f), grass2: new THREE.Color(0x7fb04a), floor: new THREE.Color(0x3f5226), floor2: new THREE.Color(0x5a4a30),
  laterite: new THREE.Color(0xa8553a), laterite2: new THREE.Color(0x8a4430), sand: new THREE.Color(0xcdb88d), mud: new THREE.Color(0x5b5040),
  rock: new THREE.Color(0x7d7a72), shola: new THREE.Color(0x8a9a4a), plateau: new THREE.Color(0x6a7a48)
};
function colour(c, x, z, y, sl) {
  const n = fbm(x * .05, z * .05) * .5 + .5, n2 = vnoise(x * .25, z * .25) * .5 + .5, t = new THREE.Color();
  c.copy(C.grass).lerp(C.grass2, clamp(n * 1.2 - .2, 0, 1));
  const forest = smooth(58, 46, z) * (1 - smooth(-22, -34, z)); t.copy(C.floor).lerp(C.floor2, n2 * .6); c.lerp(t, forest * .75);
  c.lerp(C.shola, smooth(-30, -50, z) * .7 * (.6 + n * .4));
  if (Math.hypot(x - CAMP.x, z - CAMP.z) < 14) c.lerp(C.floor2, .5);
  const pd = Math.abs(x - pathX(z)); t.copy(C.laterite).lerp(C.laterite2, n2); c.lerp(t, smooth(2.5, 1.2, pd + n2 * .6) * .95);
  const lm = smooth(50, 64, z); if (lm > 0) { const d = x - shoreX(z); c.lerp(C.sand, smooth(7, 2, d) * lm * .9); if (y < W.water + .1) c.lerp(C.mud, smooth(W.water + .1, W.water - .8, y)); }
  c.lerp(C.rock, smooth(1.2, 2.4, sl)); c.lerp(C.rock, smooth(16, 6, Math.hypot(x - PK.x, z - PK.z)) * .8);
  c.multiplyScalar(.92 + n2 * .16);
}

/* ---------- level runtime ---------- */
let L = null;
const level = {
  id: 1, name: 'Agasthya Hills', ml: 'അഗസ്ത്യമല', region: 'Agasthyamala · Thiruvananthapuram', music: 'forest', cages: 3,
  envKeys: [[999, 'morning'], [100, 'morning'], [60, 'noon'], [30, 'canopy'], [-15, 'canopy'], [-35, 'golden'], [-80, 'peakMist']],
  objectiveTarget() { return L?.target?.() ?? null; },
  sniffTarget() { if (!L) return null; if (!L.clue.found) return { x: L.clue.x, z: L.clue.z, clue: true }; return this.objectiveTarget(); },

  build(root) {
    resetCollision(); seed(4242);
    W.height = height; W.water = -.6; W.walkable = (x, z) => !(z > 50 && x < -8 && height(x, z) < W.water - .4); W.bounds = { x0: -56, x1: 56, z0: AR.z - 12.5, z1: 127 };
    L = { root, ticks: [], cages: [], gates: {}, step: 0, tut: 0, cp: new THREE.Vector3(START.x, H_START, START.z - 2), bossOn: false, boss: null, wave3: false, walled: false, msgT: 0 };
    W.minZ = () => G.stage < 1 ? G1Z + .6 : !L.gates.g2.open ? G2Z + .7 : !L.gates.g3.open ? G3Z + .7 : -1e9;
    W.maxZ = () => L.walled ? WALLZ - .6 : 1e9;
    W.onGate = () => {
      if (L.msgT > 0) return; L.msgT = 5;
      if (G.stage < 1) dialog('Ranger Ammini', 'Not yet, Pichu! Practise on the training dummy first.', 3);
      else if (!L.gates.g2.open) dialog('Pichu', 'The poachers blocked the trail with logs! I have to beat them first.', 3);
      else dialog('Pichu', 'Another barricade! We need to clear the camp and free every animal.', 3);
    };
    buildTerrain(root, { w: 120, l: 260, cx: 0, cz: (W.bounds.z0 + 128) / 2, nx: 120, nz: 250, height, colour });
    buildWater(root, { x: -36, z: 96, w: 50, l: 80, y: W.water, repeat: [10, 16] });
    this.plants(root); this.props(root); this.actors(root);
  },

  plants(root) {
    const F = new Flora(), tries = 16000 * Q.trees;
    const clear = (x, z) => Math.hypot(x - START.x - 2, z - 116) < 13 || Math.hypot(x - CAMP.x, z - CAMP.z) < 14 || Math.hypot(x - AR.x, z - AR.z) < 15 || Math.hypot(x - HUT.x, z - HUT.z) < 6;
    for (let i = 0; i < tries; i++) {
      const x = sr(-54, 54), z = sr(AR.z - 10, 128), y = height(x, z);
      if (y < W.water + .35) continue; const pd = Math.abs(x - pathX(z)); if (pd < 4.2) continue; if (clear(x, z)) continue;
      if (Math.abs(z - G2Z) < 2 && pd < 7 || Math.abs(z - G3Z) < 2 && pd < 7) continue;
      if (Math.hypot(x - PK.x, z - PK.z) < 14) continue;
      const lake = z > 55 && x - shoreX(z) < 14, climb = z < -26;
      let p = lake ? .5 : climb ? .22 : .9; if (srnd() > p) continue;
      if (tooClose(x, z, climb ? 4 : 2.6)) continue;
      const r = srnd();
      if (lake) { if (r < .5) F.coconut(x, y, z, sr(.85, 1.15)); else if (r < .7) F.areca(x, y, z, sr(.8, 1.1)); else if (r < .82) F.banana(x, y, z, sr(.8, 1.2)); else F.rain(x, y, z, sr(.7, 1)); }
      else if (climb) { if (r < .6) F.rain(x, y, z, sr(.55, .85), hsl(sr(.27, .33), .45, sr(.13, .2))); else F.rock(x, y, z, sr(.8, 2.2)); }
      else { if (r < .58) F.rain(x, y, z, sr(.8, 1.3)); else if (r < .8) F.bamboo(x, y, z, sr(.8, 1.2)); else if (r < .9) F.areca(x, y, z, sr(.8, 1.1)); else F.banana(x, y, z, sr(.8, 1.1)); }
    }
    // coconut palms lining the ranger post and lake shore
    for (let i = 0; i < 26; i++) { const z = sr(66, 124), x = shoreX(z) + sr(2, 7); if (!tooClose(x, z, 2.5) && !clear(x, z)) F.coconut(x, height(x, z), z, sr(.9, 1.2)); }
    // granite boulders
    for (let i = 0; i < 520; i++) {
      const x = sr(-54, 54), z = sr(AR.z - 10, 126), pd = Math.abs(x - pathX(z)); if (pd < 2.8 || clear(x, z)) continue;
      const w = z < -26 ? .9 : z < 50 ? .45 : .3; if (srnd() > w) continue; const y = height(x, z); if (y < W.water + .2) continue;
      const s = srnd() < .15 ? sr(.9, 1.9) : sr(.2, .6); F.rock(x, y, z, s);
    }
    // rocks ringing the arena
    for (let i = 0; i < 22; i++) { const a = i / 22 * TAU; if (Math.abs(Math.sin(a)) < .3 && Math.cos(a) > 0) continue; const x = AR.x + Math.sin(a) * (AR.r + 3), z = AR.z + Math.cos(a) * (AR.r + 3); if (z > AR.z + 10) continue; F.rock(x, height(x, z), z, sr(.9, 1.5)); }
    // undergrowth: ferns, bushes, grass
    for (let i = 0; i < 2400; i++) { const x = sr(-54, 54), z = sr(-30, 60), pd = Math.abs(x - pathX(z)); if (pd < 2.2 || clear(x, z)) continue; const y = height(x, z); if (srnd() < .85) F.fern(x, y, z, sr(.7, 1.5)); else F.bush(x, y, z, sr(.25, .55)); }
    let gs = 0, tr = 0; while (gs < Q.grass && tr < Q.grass) {
      tr++; const cx = sr(-54, 54), cz = sr(AR.z - 10, 126); const forest = cz < 50 && cz > -24; if (forest && srnd() > .25) continue;
      const n = 8 + (srnd() * 12 | 0); for (let k = 0; k < n; k++) {
        const x = cx + sr(-.8, .8), z = cz + sr(-.8, .8), y = height(x, z); if (y < W.water + .15) continue; const pd = Math.abs(x - pathX(z)); if (pd < 1.2 && srnd() < .85) continue;
        const climb = z < -28; const h = climb ? sr(.4, .85) : sr(.25, .6);
        F.grass(x, y, z, h * (pd < 2 ? .6 : 1), climb ? hsl(sr(.14, .2), sr(.4, .55), sr(.36, .46)) : hsl(sr(.22, .29), sr(.45, .62), sr(.26, .38))); gs++;
      }
    }
    F.flush(root);
  },

  props(root) {
    makeHut(root, HUT.x, HUT.z, PI);
    makeSign(root, START.x - 3.5, START.z + 3, PI * .9, 'അഗസ്ത്യമല', 'Agasthyamala Reserve', '#2f5a2a');
    makeSign(root, pathX(G1Z + 3) + 4, G1Z + 3, 0, '⚠ POACHERS', 'seen on trail!', '#8a2a1a');
    L.dummy = new Dummy(root, DUMMY.x, DUMMY.z, (dmg, o) => this.tutorialHit(o));
    new Crate(root, HUT.x - 3.5, HUT.z - 3, 'ammo'); new Crate(root, HUT.x - 4.4, HUT.z - 2.2, 'heal');
    L.gates.g1 = new Barricade(root, pathX(G1Z), G1Z, 8, 'bamboo');
    L.gates.g2 = new Barricade(root, pathX(G2Z), G2Z, 9, 'logs');
    L.gates.g3 = new Barricade(root, pathX(G3Z), G3Z, 9, 'logs');
    // poacher camp
    makeTent(root, CAMP.x - 7, CAMP.z + 4, .5, 0x5a6a3a); makeTent(root, CAMP.x + 7.5, CAMP.z + 3, -.6, 0x6a5a3a); makeTent(root, CAMP.x + 2, CAMP.z - 9, PI, 0x4a5a4a);
    L.ticks.push(makeCampfire(root, CAMP.x, CAMP.z)); makeJeep(root, CAMP.x - 9, CAMP.z - 6, .8);
    [[3, 6, 'ammo'], [4, 5.2, 'ammo'], [-4, -9, 'heal'], [9, -3, 'ammo'], [-10, 1, 'heal']].forEach(([dx, dz, l]) => new Crate(root, CAMP.x + dx, CAMP.z + dz, l));
    [[-3, -47, 'ammo'], [4, -62, 'heal'], [-5, -70, 'ammo']].forEach(([dx, z, l]) => new Crate(root, pathX(z) + dx, z, l));
    // cages
    L.cages.push(Object.assign(new Cage(root, pathX(63) + 6, 63, 'spotted', 0), { guard: 1 }));
    L.cages.push(Object.assign(new Cage(root, CAMP.x - 7, CAMP.z - 5, 'squirrel', 0), { guard: 2 }));
    L.cages.push(Object.assign(new Cage(root, CAMP.x + 6, CAMP.z - 6, 'sambar', 0), { guard: 2 }));
    // cardamom pods (12)
    [[HUT.x + 3.5, HUT.z + 2], [START.x - 8, 100], [shoreX(88) + 3, 88], [pathX(76) - 9, 76], [pathX(58) + 10, 58], [pathX(36) - 7, 36], [CAMP.x + 11, CAMP.z + 7], [CAMP.x - 1, CAMP.z - 12],
     [pathX(-34) + 9, -34], [pathX(-50) - 8, -50], [pathX(-66) + 6, -66], [AR.x - 9, AR.z + 4]].forEach(([x, z]) => spawnPickup('pod', x, z, root));
    // wildlife
    for (let i = 0; i < 3; i++) L.ticks.push(hornbillFlyer(root, pathX(60) + sr(-15, 15), sr(10, 100), sr(18, 30), sr(14, 22), sr(.05, .09) * (i % 2 ? 1 : -1), sr(0, TAU)));
    [[shoreX(100) + 6, 100, 0], [shoreX(96) + 8, 94, 1], [shoreX(80) + 5, 80, 0], [pathX(-40) - 14, -40, 0], [pathX(-58) + 15, -58, 1]].forEach(([x, z, f]) => L.ticks.push(sambar(root, x, z, !!f)));
  },

  actors(root) {
    // Ranger Ammini at the post
    L.ranger = makeHuman({ skin: 0x8a5a3a, shirt: 0xb8a070, pants: 0x9a8a5a, hat: 'ranger', moustache: false, belt: true, boot: 0x1a1410 });
    L.ranger.root.position.set(START.x + 2.6, H_START, START.z - 4.5); L.ranger.root.rotation.y = -PI * .7; root.add(L.ranger.root);
    // Honey's puppies at the post: Mittu (blue bandana) and her brother & sister
    L.pups = [makePuppy(0x3a8ad8), makePuppy(0xd84a8a), makePuppy(0x4ac86a)];
    L.pups.forEach((p, i) => { p.root.position.set(START.x - 3.2 + i * .9, H_START, START.z - 4.5 - (i % 2) * .5); p.root.rotation.y = rand(0, TAU); root.add(p.root); });
    L.thief = makeHuman({ shirt: 0x6b6a3a, pants: 0x2f3a2a, hat: 'cap', hatCol: 0x3a4a2a, weapon: 'none' }); L.thief.root.visible = false; root.add(L.thief.root);
    L.clue = new Clue(root, CAMP.x + 2, CAMP.z - 12.5, 'bell', () => { dialog('Pichu', "Mittu's bell! She WAS here! Honey, they must have taken her further north…", 4.5); HN.bark = 1; this.checkCamp(); this.objective(); });
    L.ticks.push(L.clue);
    // group 1: trail ambush (3 grunts)
    [[-3, 71], [3, 69], [0, 74]].forEach(([dx, z]) => new Enemy('grunt', pathX(z) + dx, z, root, { group: 1, yaw: 0 }));
    // group 2: camp guards
    [[-4, 4, 'grunt'], [5, 2, 'grunt'], [0, -3, 'grunt'], [-9, -2, 'slinger'], [10, -8, 'slinger']].forEach(([dx, dz, t]) => new Enemy(t, CAMP.x + dx, CAMP.z + dz, root, { group: 2 }));
    // group 4: rocky climb
    [[0, -50, 'grunt'], [-8, -56, 'slinger'], [8, -60, 'slinger']].forEach(([dx, z, t]) => new Enemy(t, pathX(z) + dx, z, root, { group: 4 }));
    // the boss waits on the plateau
    L.boss = new CaptainSnare(AR.x, AR.z - 5, root, { yaw: 0, group: 99, arena: AR, onPhase2: () => this.bossHelpers() });
    L.target = () => {
      if (G.stage === 0) return DUMMY;
      if (G.stage === 1) { if (groupAlive(1)) return { x: pathX(71), z: 71 }; const c = L.cages[0]; if (!c.free) return c; return { x: pathX(G2Z), z: G2Z }; }
      if (G.stage === 2) { if (groupAlive(2) || groupAlive(3)) return CAMP; const c = L.cages.find(c => !c.free); if (c) return c; if (!L.clue.found) return L.clue; return { x: pathX(G3Z), z: G3Z }; }
      if (G.stage === 3) return AR;
      return null;
    };
  },

  start(skipIntro) {
    P.pos.set(START.x, H_START, START.z - 2); P.yaw = PI; placeHoney(START.x + 1.2, START.z - 1.5, PI);
    G.stage = 0; L.tut = 0;
    const r = L.ranger.root.position;
    const mittu = L.pups[0], th = L.thief.root, tStart = new THREE.Vector3(START.x - 14, H_START, START.z - 8);
    const stolen = () => { mittu.root.visible = false; th.visible = false; };
    if (skipIntro) { stolen(); FLOW.startPlay(); this.beginTutorial(); return; }
    runCine([
      { d: 5, start() { CC.rate = 1.5; CC.pos.set(START.x + 1, H_START + 1.3, START.z - 8.5); CC.look.set(START.x - .5, H_START + .2, START.z - 4.6); dialog('Narrator', 'Honey had three tiny puppies. The smallest one, Mittu, was the bravest — and the naughtiest!'); }, update(k, dt) { const t = performance.now() / 1000; L.pups.forEach((p, i) => { p.root.position.x += Math.sin(t * 2 + i) * dt * .6; animQuad(p, dt, 1.2, 'walk', t, { wag: 1 }); }); } },
      { d: 3.4, start() { th.visible = true; th.position.copy(tStart); sfx.alert(0); dialog('Narrator', 'But someone was watching from the trees…'); CC.pos.set(START.x - 4, H_START + 2, START.z - 1); CC.look.set(START.x - 8, H_START + .8, START.z - 6); }, update(k, dt) { const tgt = mittu.root.position; th.position.lerpVectors(tStart, tgt, Math.min(1, k * 1.15)); th.position.y = W.height(th.position.x, th.position.z); th.rotation.y = Math.atan2(tgt.x - tStart.x, tgt.z - tStart.z); animHuman(L.thief, dt, 5, 'walk', performance.now() / 1000); } },
      { d: 3, start() { puppyWhine(.3); HN.bark = 1; sfx.bark(0, .6); dialog('Honey', 'WOOF! WOOF! WOOF!', 2.5); }, update(k, dt) { const run = new THREE.Vector3(pathX(98), 0, 98); th.rotation.y = Math.atan2(run.x - th.position.x, run.z - th.position.z); th.position.x += Math.sin(th.rotation.y) * 7 * dt; th.position.z += Math.cos(th.rotation.y) * 7 * dt; th.position.y = W.height(th.position.x, th.position.z); mittu.root.position.set(th.position.x, th.position.y + 1, th.position.z); animHuman(L.thief, dt, 7, 'walk', performance.now() / 1000); CC.look.copy(th.position); }, end() { stolen(); } },
      { d: 3.4, start() { CC.pos.set(START.x - 1.5, H_START + 1.3, START.z - 4.6); CC.look.set(START.x, H_START + .8, START.z - 2); dialog('Pichu', 'MITTU! Come back! Give her back!!'); } },
      { d: 5, start() { CC.rate = 1.2; CC.pos.set(START.x - 14, H_START + 18, START.z + 10); CC.look.set(START.x - 26, H_START - 2, START.z - 30); dialog('Narrator', 'The poacher ran up the trail into the great hills of Agasthyamala, at the very south of Kerala…'); }, update(k) { CC.pos.x = START.x - 14 + k * 6; } },
      { d: 5, start() { CC.rate = 2; CC.pos.set(START.x + 3.5, H_START + 1.8, START.z - 6.5); CC.look.set(START.x + 1, H_START + .9, START.z - 3); dialog('Ranger Ammini', "That was one of Kaala's poachers! His gang is trapping animals all over the Western Ghats — and now they've taken Mittu!"); } },
      { d: 5.2, start() { CC.pos.set(r.x - 2.5, r.y + 1.7, r.z - 2.5); CC.look.set(r.x, r.y + 1.4, r.z); dialog('Ranger Ammini', 'Their scout, Captain Snare, has a camp up this trail. Take this fighting stick and slingshot. Practise on the dummy, then go after them!'); } },
      { d: 3.6, start() { CC.pos.set(START.x - 1.5, H_START + 1.3, START.z - 4.6); CC.look.set(START.x, H_START + .8, START.z - 2); HN.bark = 1; sfx.bark(0, .4); G.celebrate = true; dialog('Pichu', "Don't cry, Honey. We'll find Mittu — and free every animal on the way!"); }, end() { G.celebrate = false; } },
    ], () => { G.celebrate = false; stolen(); FLOW.startPlay(); this.beginTutorial(); }, () => { G.celebrate = false; stolen(); });
  },

  beginTutorial() {
    showTitle('Level 1', 'Agasthya Hills', 'Train with Ranger Ammini, then chase the poachers up the mountain', 'അഗസ്ത്യമല');
    L.tut = 0; L.tutHits = 0; L.tutT = 0; L.tips = {}; this.tutObjective();
    document.body.classList.add('tutorial');
  },
  tutObjective() { setObjective(`Walk to the straw dummy and HIT it! (${L.tutHits}/3)`); },
  // simple training: any 3 hits on the dummy (stick, smash or slingshot)
  tutorialHit(o) {
    if (G.stage !== 0) return;
    if (L.curAct) L.curAct.counted = true;
    L.tutHits++; sfx.collect(); popText(`⚔️ ${L.tutHits}/3`); this.tutObjective();
    if (L.tutHits === 1) dialog('Ranger Ammini', 'Yes! Just like that! Hit it again!', 2.5);
    if (L.tutHits >= 3) {
      G.stage = 1; sfx.big(); L.gates.g1.openUp(); L.cp.set(pathX(G1Z - 2), height(pathX(G1Z - 2), G1Z - 2), G1Z - 2);
      document.body.classList.remove('tutorial'); setPrompt('');
      dialog('Ranger Ammini', 'Well done, little hero! The gate is open. Go and find Mittu — I\'ll call you on the radio with tips!', 5);
      setObjective('Follow the red trail north and stop the poachers');
    }
  },
  // one-time tips that appear when a move becomes useful
  tip(id, text) { if (L.tips[id]) return; L.tips[id] = true; dialog('Ranger Ammini (radio)', text, 5.5); },

  bossHelpers() { [[-6, 4, 'grunt'], [6, 4, 'grunt'], [0, 9, 'slinger']].forEach(([dx, dz, t]) => { const e = new Enemy(t, AR.x + dx, AR.z + dz, L.root, { group: 98, awake: true, drops: true }); emit(TEX.puff, new THREE.Vector3(e.x, e.y + .5, e.z), 10, { color: 0x999999, size: .8, speed: 2, g: 0, life: .8 }); }); },

  onEnemyKO(e) {
    if (e.boss) { this.bossDefeated(); return; }
    const g = e.group;
    setTimeout(() => {
      if (g === 1 && !groupAlive(1) && !L.gates.g2.open) { L.gates.g2.openUp(); L.cp.set(pathX(G2Z - 2), 0, G2Z - 2); L.cp.y = height(L.cp.x, L.cp.z); G.stage = 2; sfx.big(); popText('Trail cleared! ⚔️'); dialog('Pichu', L.cages[0].free ? 'We did it, Honey! The logs are gone. On to the camp!' : 'They ran off and the logs are gone! But first — that poor deer in the cage!', 4); this.objective(); }
      if (g === 2 && !groupAlive(2) && !L.wave3) { L.wave3 = true; dialog('Poacher', 'Hey! Someone is wrecking the camp! Get them!', 3); [[-3, 'grunt'], [3, 'grunt'], [0, 'slinger']].forEach(([dx, t], i) => new Enemy(t, CAMP.x + dx, CAMP.z - 18 - i, L.root, { group: 3, awake: true })); }
      this.checkCamp(); this.objective();
    }, 400);
  },
  checkCamp() {
    if (G.stage === 2 && L.wave3 && !groupAlive(2) && !groupAlive(3) && G.freed >= 3 && L.clue.found && !L.gates.g3.open) {
      L.gates.g3.openUp(); G.stage = 3; L.cp.set(pathX(G3Z - 2), 0, G3Z - 2); L.cp.y = height(L.cp.x, L.cp.z); sfx.big(); popText('Camp cleared! 🏕️');
      dialog('Pichu', 'All the animals are free! Captain Snare must know where Mittu is. Up to the peak, Honey!', 4); this.objective();
    }
  },
  objective() {
    if (G.stage === 1) setObjective(groupAlive(1) ? `Beat the poachers on the trail (${3 - groupAlive(1)}/3)` : L.cages[0].free ? 'The trail is open — head to the poacher camp' : 'Free the trapped deer! (walk up to the cage, press E / ✋)');
    else if (G.stage === 2) { const left = groupAlive(2) + groupAlive(3); setObjective(left || !L.wave3 ? `Raid the poacher camp! Poachers left: ${left || '?'} · Animals freed ${G.freed}/3` : G.freed < 3 ? `Free the trapped animals (${G.freed}/3)` : !L.clue.found ? 'Search the camp for a clue about Mittu (press Q / 👃 to SNIFF)' : 'Camp cleared!'); }
    else if (G.stage === 3) setObjective('Climb to the plateau below Agasthyakoodam peak ⛰️');
    else if (G.stage === 4) setObjective('Defeat Captain Snare!');
  },

  action() {
    const c = this.nearCage(); if (!c) return;
    if (groupAlive(c.guard) || (c.guard === 2 && (!L.wave3 || groupAlive(3)))) { dialog('Pichu', 'The poachers are still watching! I have to beat them first.', 2.5); return; }
    c.open(); popText(c.kind === 'squirrel' ? '🐿️ Giant squirrel freed!' : '🦌 Deer freed!'); hud();
    dialog('Pichu', pick(['Run, little one! You\'re free!', 'Go home to your family!', 'Nobody will trap you again!']), 2.5);
    this.checkCamp(); this.objective();
  },
  nearCage() { for (const c of L.cages) if (!c.free && Math.hypot(P.pos.x - c.x, P.pos.z - c.z) < 2.8) return c; return null; },

  startBoss() {
    L.walled = true; G.stage = 4; L.cp.set(AR.x, H_AR, AR.z + 9); this.objective();
    // a rock slide closes the way back
    const g = new THREE.Group(); g.position.set(pathX(WALLZ), height(pathX(WALLZ), WALLZ), WALLZ); L.root.add(g);
    for (let i = 0; i < 12; i++) M(jitter(new THREE.DodecahedronGeometry(sr(.9, 1.6), 1), .3), std(0x7a7670, { flatShading: true }), sr(-6, 6), sr(0, 1.5), sr(-1, 1), g);
    sfx.smash(); G.shake = .5; emit(TEX.puff, g.position.clone().setY(g.position.y + 1), 20, { color: 0xa09080, size: 1, speed: 3, g: -1, life: 1.2, spread: 4 });
    const b = L.boss;
    runCine([
      { d: 3.2, start() { MUS.mood = 'boss'; CC.rate = 2.5; CC.pos.set(b.x + 4, b.y + 2.6, b.z + 6); CC.look.set(b.x, b.y + 1.8, b.z); dialog('Captain Snare', "Well, well. A little boy and his dog, wrecking MY camp? Looking for a lost puppy, are we?"); } },
      { d: 3.4, start() { CC.pos.set(b.x - 3, b.y + 1.9, b.z + 3.4); dialog('Captain Snare', "Kaala pays me good money for every animal. Let's see how brave you are!"); } },
      { d: 2.6, start() { CC.pos.set(P.pos.x + 2.5, P.pos.y + 1.6, P.pos.z + 3); CC.look.set(P.pos.x, P.pos.y + .9, P.pos.z - 2); HN.bark = 1; sfx.bark(0, .5); dialog('Pichu', 'Ready, Honey? Let\'s get him!'); } },
    ], () => { FLOW.startPlay(); b.awake = true; L.bossOn = true; bossBar('Captain Snare', 1); showTitle('Boss', 'Captain Snare', 'Watch for the red warning, dodge, then strike back!'); });
  },
  bossDefeated() {
    L.bossOn = false; for (const e of ENEMIES) if (e.group === 98 && e.alive) e.knockOut(0, 1);
    const b = L.boss;
    setTimeout(() => runCine([
      { d: 3.5, start() { MUS.mood = 'forest'; CC.rate = 2.5; CC.pos.set(b.x + 3, b.y + 2, b.z + 4); CC.look.set(b.x, b.y + 1.2, b.z); dialog('Captain Snare', "Ugh… alright, alright! The puppy isn't here!"); } },
      { d: 3.4, start() { dialog('Captain Snare', "Kaala's men took her across the lake at Periyar. You'll never catch them! Ha!"); } },
      { d: 1.6, start() { sfx.smash(); emit(TEX.puff, new THREE.Vector3(b.x, b.y + 1, b.z), 40, { color: 0x888888, size: 1.4, speed: 3, g: 0, life: 1.6, spread: 1.2 }); }, end() { b.h.root.visible = false; } },
      { d: 4.5, start() { G.celebrate = true; HN.script = true; HN.mode = 'rear'; HN.speed = 0; HN.wag = 1; CC.pos.set(P.pos.x + 3, P.pos.y + 1.8, P.pos.z + 3.5); CC.look.set(P.pos.x, P.pos.y + .8, P.pos.z); sfx.big(); dialog('Pichu', 'Hold on, Mittu! Honey and I are coming to Periyar!'); }, update(k, dt) { if (Math.random() < dt * 8) emit(TEX.heart, new THREE.Vector3(P.pos.x, P.pos.y + 1.2, P.pos.z), 1, { size: .25, speed: 1, g: .3, life: 1.6, spread: .4 }); } },
    ], () => { G.celebrate = false; HN.script = false; G.stage = 5; FLOW.complete(); }, () => { b.h.root.visible = false; G.celebrate = false; HN.script = false; }), 1200);
  },

  onPlayerDown() {
    FLOW.respawn(L.cp, () => {
      clearProjectiles();
      for (const e of ENEMIES) {
        if (e.prop || !e.alive) continue;
        if (e.group === 98) { e.alive = false; e.dead = true; e.h.root.visible = false; e.bar.g.visible = false; continue; }
        if (e.boss) { e.hp = e.maxHp; e.phase = 1; e.setState('idle'); e.x = AR.x; e.z = AR.z - 5; e.poise = 0; e.waveR = -1; e.wave.visible = false; e.line.visible = false; if (L.bossOn) bossBar('Captain Snare', 1); continue; }
        e.x = e.hx; e.z = e.hz; e.hp = e.maxHp; e.setState('idle'); e.bar.g.visible = false;
      }
      dialog('Narrator', pick(['Pichu dusted himself off. Be brave — watch for the red glow and dodge!', 'Ouch! Try again — use Honey\'s bark when they surround you.', 'Heroes never give up! Remember: dodge, then strike back.']), 4);
    });
  },

  update(dt, t) {
    L.msgT -= dt;
    for (const k of L.ticks) k.tick(dt, t);
    for (const c of L.cages) c.update(dt, t);
    for (const k in L.gates) L.gates[k].update(dt);
    // ranger looks at Pichu and waves
    { const r = L.ranger.root, dx = P.pos.x - r.position.x, dz = P.pos.z - r.position.z; r.rotation.y = Math.atan2(dx, dz); animHuman(L.ranger, dt, 0, G.stage === 0 && G.mode === 'play' ? 'taunt' : 'idle', t); }
    if (G.mode !== 'cine') for (let i = 1; i < 3; i++) { const p = L.pups[i]; p.root.position.set(L.ranger.root.position.x - .6 + i * .5, H_START, L.ranger.root.position.z + .7); p.root.rotation.y = L.ranger.root.rotation.y; animQuad(p, dt, 0, 'sit', t, { wag: .2 }); }
    if (G.mode !== 'play' || G.busy) return;
    // triggers
    if (P.pos.z < 84) wakeGroup(1);
    if (P.pos.z < 26) { if (!L.campMsg) { L.campMsg = true; dialog('Pichu', 'There\'s the poacher camp! I can see animals in cages!', 3); MUS.mood = 'battle'; } wakeGroup(2); }
    if (P.pos.z < -38) wakeGroup(4);
    if (!L.walled && G.stage === 3 && P.pos.z < WALLZ - 1.5) this.startBoss();
    if (L.bossOn) { const dx = P.pos.x - AR.x, dz = P.pos.z - AR.z, d = Math.hypot(dx, dz); if (d > AR.r + 1) { P.pos.x = AR.x + dx / d * (AR.r + 1); P.pos.z = AR.z + dz / d * (AR.r + 1); } }
    // music follows the action
    if (!L.bossOn && G.stage < 4) { let fighting = false; for (const e of ENEMIES) if (e.alive && e.awake && !e.prop && Math.hypot(e.x - P.pos.x, e.z - P.pos.z) < 16) { fighting = true; break; } MUS.mood = fighting ? 'battle' : 'forest'; }
    // prompts
    const mob = MOBILE;
    if (G.stage === 0) {
      const dd = Math.hypot(P.pos.x - DUMMY.x, P.pos.z - DUMMY.z); L.tutT += dt;
      setPrompt(dd < 4.5 ? (mob ? 'Tap the big red ⚔️ button ↘ to hit the dummy!' : 'Press J or CLICK the mouse to hit! ⚔️') : (mob ? 'Walk back to the straw dummy (drag on the left side)' : 'Walk to the straw dummy with W A S D'), false);
      // forgiving training: any attack near the dummy counts, even if the swing missed
      const A = P.act && ['light', 'heavy', 'sling'].includes(P.act.type) ? P.act : null;
      if (A !== L.curAct) {
        const prev = L.curAct; L.curAct = A;
        if (prev && !prev.counted && prev.phase !== 'charge') {
          if (prev.near) { const d = L.dummy; d.wv += 3; this.tutorialHit({ assist: true }); }
          else if (!L.farMsgT || L.farMsgT < 0) { L.farMsgT = 4; dialog('Ranger Ammini', 'Too far away! Walk right up to the straw dummy, then hit it.', 3); }
        }
        if (A) A.near = dd < 4.5;
      }
      L.farMsgT = (L.farMsgT || 0) - dt;
      if (L.tutT > 25 && L.tutHits === 0 && !L.tutHelp) { L.tutHelp = true; dialog('Ranger Ammini', mob ? 'Walk up close to the straw dummy, then tap the big red ⚔️ button!' : 'Walk up close to the straw dummy with W A S D, then press J or click!', 5); }
    } else {
      const c = this.nearCage(); setPrompt(c ? (mob ? 'Tap ✋ to free the animal' : 'Press E to free the animal') : '');
      // just-in-time tips
      let near = 0, sling = false, brute = false; for (const e of ENEMIES) if (e.alive && e.awake && !e.prop && Math.hypot(e.x - P.pos.x, e.z - P.pos.z) < 10) { near++; if (e.type === 'slinger') sling = true; }
      if (near >= 1) this.tip('smash', mob ? 'Tip: HOLD the orange 💥 button and let go for a POWER SMASH!' : 'Tip: HOLD K and let go for a POWER SMASH!');
      else if (L.tips.smash && near === 0 && G.kos >= 2) this.tip('combo', 'Tip: hit three times quickly — the third hit is the strongest!');
      if (near >= 3) this.tip('bark', mob ? 'Tip: lots of poachers? Tap 🐶 BARK — Honey makes them dizzy!' : 'Tip: lots of poachers? Press H — Honey BARKS and makes them dizzy!');
      if (sling) this.tip('sling', mob ? 'Tip: that one throws stones! Tap 🎯 to hit him with your slingshot!' : 'Tip: that one throws stones! Press F or RIGHT-click for your slingshot!');
      if (P.hp < P.maxHp * .6 && near) this.tip('dodge', mob ? 'Tip: when a poacher glows RED, tap 🌀 to roll away!' : 'Tip: when a poacher glows RED, press L to roll away!');
    }
    if (G.stage <= 3) this.objective();
    // lake sounds + birds
    if (AU.ctx) {
      const lakeD = Math.abs(P.pos.x - shoreX(P.pos.z)) + Math.max(0, 60 - P.pos.z);
      AU.water.g.gain.value += (clamp(1 - lakeD / 35, 0, 1) * .12 - AU.water.g.gain.value) * Math.min(1, dt * 2);
      AU.wind.g.gain.value = .03 + smooth(-20, -80, P.pos.z) * .05 + Math.sin(t * .2) * .01;
      AU.ambT -= dt; if (AU.ambT < 0) { AU.ambT = rand(.6, 2.4); if (Math.random() < .25) sfx.koel(rand(-.9, .9)); else sfx.chirp(rand(-.9, .9)); }
    }
  },
  dispose() { L = null; },
};
export default level;
