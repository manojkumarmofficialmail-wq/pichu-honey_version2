// LEVEL 3 — MISTY SHOLA (Eravikulam National Park & the tea hills of Munnar, Idukki)
// South → north: tea estate → vine cliff → misty shola grassland (Nilgiri tahr) → second cliff →
// Neelakurinji slopes → the Drone Master on the summit rocks below Anamudi.
import { THREE, std, M, jitter, hsl, TEX } from '../core/engine.js';
import { G, P, W, CC } from '../core/state.js';
import { PI, TAU, clamp, lerp, smooth, fbm, vnoise, seed, sr, srnd, rand, pick, Q } from '../core/utils.js';
import { sfx, AU, MUS } from '../core/audio.js';
import { dialog, setObjective, popText, showTitle, bossBar } from '../core/ui.js';
import { runCine } from '../core/cine.js';
import { FLOW } from '../core/flow.js';
import { buildTerrain, tooClose, resetCollision } from '../world/terrain.js';
import { Flora } from '../world/foliage.js';
import { emit } from '../world/particles.js';
import { spawnPickup } from '../world/pickups.js';
import { makeSign, makeTent, makeCampfire, Crate, Cage, hornbillFlyer, sambar } from '../world/props.js';
import { vineLadder, Antenna, mistField, rockPillar } from '../world/props2.js';
import { makeHuman, animHuman } from '../actors/human.js';
import { HN, placeHoney } from '../actors/honey.js';
import { Enemy, wakeGroup } from '../combat/enemies.js';
import { Drone } from '../combat/drone.js';
import { DroneMaster } from '../combat/bosses2.js';
import { ENEMIES } from '../combat/combat.js';
import { Clue, puppyWhine } from '../world/story.js';
import { newRuntime, tickCommon, tryFreeCage, setCP, respawnReset, ambientBirds, alive } from './kit.js';

/* ---------- layout ---------- */
const pathX = z => Math.sin(z * .021 + .5) * 9 + Math.sin(z * .06 + 2) * 3;
const START = { x: pathX(118), z: 118 };
const C1 = 70, C2 = 6;                       // the two cliffs (z)
const AR = { x: pathX(-84), z: -84, r: 16 };
const WALLZ = AR.z + 18;
const ANT = [-2.2, 0, 2.2].map(a => ({ x: AR.x + Math.sin(a + PI) * 10, z: AR.z + Math.cos(a + PI) * 10 }));

function baseH(x, z) {
  let h = fbm(x * .02 + 9.1, z * .02 + 1.7) * 3 + vnoise(x * .08, z * .08) * .4;
  h += Math.sin(x * .07) * Math.cos(z * .05) * 1.2 * smooth(80, 100, z);     // rolling tea hills
  h += 5 * smooth(C1 + .6, C1 - .6, z) + 6 * smooth(C2 + .6, C2 - .6, z);    // cliffs
  h += 3 * smooth(0, -60, z);
  const ex = Math.max(0, Math.abs(x - pathX(z) * .4) - 42); h += ex * ex * .09;
  const es = Math.max(0, z - 124); h += es * es * .1;
  return h;
}
const H_START = baseH(START.x, START.z), H_AR = baseH(AR.x, AR.z) + .3;
function height(x, z) {
  let h = baseH(x, z);
  h = lerp(h, H_START, smooth(12, 6, Math.hypot(x - START.x, z - START.z)));
  const da = Math.hypot(x - AR.x, z - AR.z); h = lerp(h, H_AR, smooth(19, 14, da)); h += Math.max(0, da - 18) ** 2 * .25 * smooth(AR.z + 24, AR.z + 14, z);
  h += 3.4 * smooth(3.4, 2.6, da);           // the Drone Master's rock
  const pd = Math.abs(x - pathX(z)); h -= smooth(2.4, .5, pd) * .1;
  return h;
}
const C = { tea: new THREE.Color(0x3f7a2a), soil: new THREE.Color(0x8a5a3a), shola: new THREE.Color(0x8a9a4a), shola2: new THREE.Color(0x6a8a3a), rock: new THREE.Color(0x7d7a72), path: new THREE.Color(0x9a7050), high: new THREE.Color(0x7a8a5a) };
function colour(c, x, z, y, sl) {
  const n = fbm(x * .05, z * .05) * .5 + .5, n2 = vnoise(x * .25, z * .25) * .5 + .5;
  if (z > C1) c.copy(C.tea).lerp(C.soil, .25 + n2 * .15); else c.copy(C.shola).lerp(C.shola2, n);
  if (z < C2) c.lerp(C.high, .5);
  const pd = Math.abs(x - pathX(z)); c.lerp(C.path, smooth(2.4, 1.1, pd + n2 * .5) * .9);
  c.lerp(C.rock, smooth(1, 2.2, sl)); c.multiplyScalar(.92 + n2 * .16);
}
const ladder = (z, y0z, y1z) => { const x = pathX(z); return { x, z: z + .75, nx: 0, nz: 1, y0: height(x, z + 1.2), y1: height(x, z - 1.3), w: 1.4 }; };

let L = null;
const level = {
  id: 3, name: 'Misty Shola', ml: 'ഇരവികുളം', region: 'Eravikulam · Munnar', music: 'forest', cages: 3,
  envKeys: [[999, 'teaMorning'], [78, 'teaMorning'], [64, 'mist'], [12, 'mist'], [2, 'highMist'], [-34, 'highMist'], [-62, 'summit']],
  objectiveTarget() { return L?.target?.() ?? null; },
  sniffTarget() { if (!L) return null; if (!L.clue.found) return { x: L.clue.x, z: L.clue.z, clue: true }; return this.objectiveTarget(); },

  build(root) {
    resetCollision(); seed(6363);
    W.height = height; W.water = -100; W.bounds = { x0: -54, x1: 54, z0: AR.z - 15, z1: 127 };
    W.walkable = () => true;
    L = newRuntime(root, { stage: 0 }); setCP(L, START.x, START.z - 2);
    W.minZ = () => -1e9; W.maxZ = () => L.walled ? WALLZ - .6 : 1e9;
    W.onGate = () => {
      if (L.msgT > 0) return; L.msgT = 4;
      if (L.l1.locked) dialog('Pichu', 'Poachers are hiding in the tea bushes. I can\'t leave the tahr behind!', 3);
      else dialog('Pichu', 'The tahr in the mist still need help before we climb higher!', 3);
    };
    W.onClimbTop = l => { setCP(L, l.x, l.z - 3); sfx.collect(); if (l === L.l1) { dialog('Pichu', 'Wow, the mist is so thick up here… stay close, Honey!', 3.5); G.stage = Math.max(G.stage, 1); } else { G.stage = Math.max(G.stage, 2); dialog('Pichu', 'Look — purple Neelakurinji flowers! They bloom only once every twelve years!', 4); } this.objective(); };
    buildTerrain(root, { w: 116, l: 255, cx: 0, cz: (W.bounds.z0 + 128) / 2, nx: 116, nz: 250, height, colour });
    this.plants(root); this.props(root); this.actors(root);
  },

  plants(root) {
    const F = new Flora();
    // tea rows following the hills (the classic Munnar look)
    for (let r = 0; r < 34; r++) {
      const z0 = 76 + r * 1.55;
      for (let x = -50; x < 50; x += .95) {
        const z = z0 + Math.sin(x * .09 + r * .2) * 2.5; if (z > 124 || z < C1 + 2.5) continue;
        if (Math.abs(x - pathX(z)) < 2.4 || Math.hypot(x - START.x, z - START.z) < 8) continue;
        F.tea(x, height(x, z), z, sr(.8, 1), Math.atan2(1, Math.cos(x * .09 + r * .2) * .225));
      }
    }
    for (let i = 0; i < 70; i++) { const x = sr(-48, 48), z = sr(C1 + 3, 122); if (Math.abs(x - pathX(z)) < 4 || tooClose(x, z, 6)) continue; F.silverOak(x, height(x, z), z, sr(.8, 1.1)); }
    // shola forest patches in the folds of the grassland
    const tries = 9000 * Q.trees;
    for (let i = 0; i < tries; i++) {
      const x = sr(-52, 52), z = sr(AR.z - 12, C1 - 1.5), y = height(x, z); const pd = Math.abs(x - pathX(z));
      if (pd < 4.5 || Math.abs(z - C2) < 2.5 || Math.hypot(x - AR.x, z - AR.z) < 19) continue;
      const patch = fbm(x * .04 + 3, z * .04) > .12; if (!patch && srnd() > .03) continue; if (tooClose(x, z, 2.6)) continue;
      F.rain(x, y, z, sr(.45, .75), hsl(sr(.27, .34), .45, sr(.12, .18)));
    }
    for (let i = 0; i < 500; i++) { const x = sr(-52, 52), z = sr(AR.z - 12, C1 - 1), y = height(x, z); if (Math.abs(x - pathX(z)) < 2.8 || Math.hypot(x - AR.x, z - AR.z) < 4) continue; if (srnd() > .45) continue; F.rock(x, y, z, srnd() < .2 ? sr(.9, 2) : sr(.2, .6)); }
    // Neelakurinji (purple) on the high slopes
    for (let i = 0; i < 2200; i++) { const x = sr(-50, 50), z = sr(AR.z + 8, C2 - 2), y = height(x, z); if (Math.abs(x - pathX(z)) < 2 || Math.hypot(x - AR.x, z - AR.z) < 17) continue; const c = fbm(x * .06, z * .06 + 5) > 0; if (!c && srnd() > .2) continue; F.kurinji(x, y, z, sr(.3, .6)); }
    let gs = 0, tr = 0; while (gs < Q.grass && tr < Q.grass) {
      tr++; const cx = sr(-52, 52), cz = sr(AR.z - 12, C1 - 1), n = 8 + (srnd() * 12 | 0);
      for (let k = 0; k < n; k++) { const x = cx + sr(-.8, .8), z = cz + sr(-.8, .8), y = height(x, z); const pd = Math.abs(x - pathX(z)); if (pd < 1.2 && srnd() < .85) continue; F.grass(x, y, z, sr(.4, .9) * (pd < 2 ? .6 : 1), hsl(sr(.14, .22), sr(.35, .5), sr(.36, .48))); gs++; }
    }
    F.flush(root);
  },

  props(root) {
    makeSign(root, START.x - 3.5, START.z + 2, 0, 'ഇരവികുളം', 'Eravikulam National Park', '#2f5a2a');
    makeSign(root, START.x + 4, START.z - 6, 0, 'TEA ESTATE', 'Munnar · since 1880', '#5a3a1a');
    L.l1 = Object.assign(ladder(C1), { locked: true }); L.l2 = Object.assign(ladder(C2), { locked: true });
    L.ticks.push(vineLadder(root, L.l1), vineLadder(root, L.l2));
    L.cages.push(Object.assign(new Cage(root, pathX(88) + 6, 88, 'tahr', 0), { guard: 1 }));
    L.cages.push(Object.assign(new Cage(root, pathX(42) - 7, 42, 'tahr', 0), { guard: 2 }));
    L.cages.push(Object.assign(new Cage(root, pathX(22) + 7, 22, 'tahr', 0), { guard: 3 }));
    makeTent(root, pathX(46) + 8, 47, -.5, 0x4a5a4a); L.ticks.push(makeCampfire(root, pathX(45) + 4, 44));
    [[START.x + 4, 110, 'ammo'], [pathX(80) - 5, 80, 'heal'], [pathX(50) + 5, 52, 'ammo'], [pathX(30) - 5, 30, 'ammo'], [pathX(-20) + 5, -20, 'heal'], [pathX(-40) - 5, -40, 'ammo'], [pathX(-58) + 6, -58, 'ammo']].forEach(([x, z, l]) => new Crate(root, x, z, l));
    // the arena: antennas around the Drone Master's rock
    L.antennas = ANT.map(a => new Antenna(root, a.x, a.z, () => L.boss.antennaDown()));
    L.antennas.forEach(a => { a.link(() => new THREE.Vector3(AR.x, H_AR + 5.2, AR.z)); L.ticks.push(a); });
    for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; if (Math.cos(a) > .85) continue; const x = AR.x + Math.sin(a) * (AR.r + 2.5), z = AR.z + Math.cos(a) * (AR.r + 2.5); rockPillar(root, x, z, sr(1, 1.6), sr(2, 3.5)); }
    [[START.x + 6, 122], [pathX(104) - 9, 104], [pathX(92) + 11, 92], [pathX(74) - 8, 74], [pathX(60) + 9, 60], [pathX(35) - 10, 35], [pathX(16) + 9, 16], [pathX(-6) - 8, -6], [pathX(-28) + 10, -28], [pathX(-48) - 9, -48], [AR.x + 11, AR.z + 6], [AR.x - 7, AR.z - 9]].forEach(([x, z]) => spawnPickup('pod', x, z, root));
    // Nilgiri tahr grazing on the grassland
    [[pathX(56) + 14, 56, 0], [pathX(54) + 16, 53, 1], [pathX(30) - 15, 30, 0], [pathX(-14) + 14, -14, 0], [pathX(-16) + 16, -17, 1]].forEach(([x, z, f]) => L.ticks.push(sambar(root, x, z, !!f, 'tahr')));
    for (let i = 0; i < 2; i++) L.ticks.push(hornbillFlyer(root, pathX(100) + sr(-15, 15), sr(85, 115), sr(18, 26), sr(10, 16), sr(.05, .09) * (i % 2 ? 1 : -1), sr(0, TAU)));
    L.mist = mistField(root, 28); L.ticks.push(L.mist);
    L.clue = new Clue(root, pathX(46) + 5, 50, 'radio', () => {
      puppyWhine(.25); dialog('Radio', "*crackle* …Kaala here. Bring the puppy to Silent Valley. Nobody will hear her bark there… *crackle*", 5.5);
      setTimeout(() => { dialog('Pichu', 'That was Mittu whimpering on the radio! She\'s alive! Silent Valley — we have to hurry!', 4.5); HN.bark = 1; }, 5600);
      this.unlock(); this.objective();
    }); L.ticks.push(L.clue);
  },

  actors(root) {
    L.ranger = makeHuman({ skin: 0x8a5a3a, shirt: 0xb8a070, pants: 0x9a8a5a, hat: 'ranger', moustache: false, boot: 0x1a1410 });
    L.ranger.root.position.set(START.x + 2.4, H_START, START.z - 4); root.add(L.ranger.root);
    [[-3, 96, 'grunt'], [4, 93, 'grunt']].forEach(([dx, z, t]) => new Enemy(t, pathX(z) + dx, z, root, { group: 1 }));
    [[-6, 98], [7, 90]].forEach(([dx, z]) => new Drone(pathX(z) + dx, z, root, { group: 1 }));
    [[0, 48, 'brute'], [-8, 44, 'slinger'], [8, 41, 'slinger']].forEach(([dx, z, t]) => new Enemy(t, pathX(z) + dx, z, root, { group: 2, aggro: 9 }));
    new Enemy('grunt', pathX(25), 25, root, { group: 3, aggro: 9 }); [[-7, 27], [7, 24], [0, 19]].forEach(([dx, z]) => new Drone(pathX(z) + dx, z, root, { group: 3 }));
    [[0, -36, 'brute'], [-8, -42, 'slinger']].forEach(([dx, z, t]) => new Enemy(t, pathX(z) + dx, z, root, { group: 4 })); [[6, -30], [-6, -46]].forEach(([dx, z]) => new Drone(pathX(z) + dx, z, root, { group: 4 }));
    L.boss = new DroneMaster(root, AR.x, AR.z, { arena: AR, yaw: 0 });
    L.target = () => {
      if (G.stage === 0) { if (alive(1)) return { x: pathX(95), z: 95 }; if (!L.cages[0].free) return L.cages[0]; return L.l1; }
      if (G.stage === 1) { if (alive(2)) return { x: pathX(45), z: 45 }; if (!L.cages[1].free) return L.cages[1]; if (alive(3)) return { x: pathX(24), z: 24 }; if (!L.cages[2].free) return L.cages[2]; if (!L.clue.found) return L.clue; return L.l2; }
      if (G.stage === 2) return AR;
      if (G.stage === 3) return L.antennas.find(a => a.alive) || null;
      return null;
    };
  },

  start(skipIntro) {
    P.pos.set(START.x, H_START, START.z - 2); P.yaw = PI; placeHoney(START.x + 1.2, START.z - 1.5, PI); G.stage = 0;
    const r = L.ranger.root.position;
    const go = () => { FLOW.startPlay(); showTitle('Level 3', 'Misty Shola', 'Climb through the tea hills and the mist to the summit', 'ഇരവികുളം'); this.objective(); };
    if (skipIntro) { go(); return; }
    runCine([
      { d: 5, start() { CC.rate = 1.2; CC.pos.set(START.x - 12, H_START + 10, 104); CC.look.set(START.x, H_START, 80); dialog('Narrator', 'High in the hills of Munnar, the tea gardens roll like green waves — and above them, the mist never sleeps.'); }, update(k) { CC.pos.x = START.x - 12 + k * 10; } },
      { d: 5.2, start() { CC.rate = 2; CC.pos.set(r.x - 2.4, r.y + 1.7, r.z - 2.6); CC.look.set(r.x, r.y + 1.4, r.z); dialog('Ranger Ammini', "The Drone Master is trapping Nilgiri tahr up here — and his men have a radio that talks to Kaala. Find it, and you'll find Mittu's trail!"); } },
      { d: 3.8, start() { CC.pos.set(START.x - 1.5, H_START + 1.3, START.z - 4.6); CC.look.set(START.x, H_START + .8, START.z - 2); HN.bark = 1; sfx.bark(0, .4); dialog('Pichu', 'Honey, your nose can find them in the mist! Let\'s go!'); } },
    ], go);
  },

  objective() {
    const s = G.stage, f = G.freed;
    setObjective(
      s === 0 ? (alive(1) ? 'Poachers in the tea! Beat them (drones too 🎯)' : !L.cages[0].free ? 'Free the baby tahr (press E / ✋)' : 'Climb the vines up the cliff (walk into them)') :
      s === 1 ? (alive(2) || alive(3) || f < 3 ? `Find the trapped tahr in the mist · freed ${f}/3` : !L.clue.found ? 'Something is crackling in the poachers\' camp… find it (Q / 👃 SNIFF)' : 'Climb the second cliff') :
      s === 2 ? 'Climb to the summit rocks below Anamudi ⛰️' :
      s === 3 ? `Break the antennas that power his shield (${3 - L.antennas.filter(a => a.alive).length}/3)` : 'Defeat the Drone Master!');
  },

  onEnemyKO(e) {
    if (e.boss) { this.bossDefeated(); return; }
    setTimeout(() => { this.unlock(); this.objective(); }, 400);
  },
  unlock() {
    if (L.l1.locked && !alive(1) && L.cages[0].free) { L.l1.locked = false; sfx.big(); popText('Tea estate cleared! 🍃'); dialog('Pichu', 'The way is clear. Let\'s climb those vines!', 3); }
    if (L.l2.locked && !alive(2) && !alive(3) && G.freed >= 3 && L.clue.found) { L.l2.locked = false; sfx.big(); popText('All tahr rescued! 🐐'); dialog('Pichu', 'Every tahr is free! Up the next cliff, Honey!', 3); }
  },
  action() { tryFreeCage(L, c => alive(c.guard) > 0); this.unlock(); this.objective(); },

  startBoss() {
    L.walled = true; G.stage = 3; setCP(L, AR.x, AR.z + 12); this.objective();
    const g = new THREE.Group(); g.position.set(pathX(WALLZ), height(pathX(WALLZ), WALLZ), WALLZ); L.root.add(g);
    for (let i = 0; i < 12; i++) M(jitter(new THREE.DodecahedronGeometry(sr(.9, 1.6), 1), .3), std(0x7a7670, { flatShading: true }), sr(-6, 6), sr(0, 1.2), sr(-1, 1), g);
    sfx.smash(); G.shake = .4;
    const b = L.boss;
    runCine([
      { d: 3.2, start() { MUS.mood = 'boss'; CC.rate = 2.5; CC.pos.set(b.x + 5, b.y + 3, b.z + 8); CC.look.set(b.x, b.y + 1.5, b.z); dialog('The Drone Master', 'Welcome to my mountain, little boy. My drones see EVERYTHING.'); } },
      { d: 3.4, start() { CC.pos.set(ANT[0].x + 3, H_AR + 3, ANT[0].z + 4); CC.look.set(ANT[0].x, H_AR + 3, ANT[0].z); dialog('The Drone Master', 'And my antennas keep my shield up. You can\'t touch me!'); } },
      { d: 2.8, start() { CC.pos.set(P.pos.x + 2.5, P.pos.y + 1.6, P.pos.z + 3); CC.look.set(P.pos.x, P.pos.y + .9, P.pos.z - 2); dialog('Pichu', 'Then we break the antennas first! Ready, Honey?'); } },
    ], () => { FLOW.startPlay(); b.awake = true; L.bossOn = true; bossBar(b.name, 1); showTitle('Boss', 'The Drone Master', 'Break the 3 antennas to drop his shield!'); });
  },
  bossDefeated() {
    L.bossOn = false; for (const e of ENEMIES) if (e.group === 98 && e.alive) e.knockOut?.(0, 1);
    const b = L.boss;
    setTimeout(() => runCine([
      { d: 3.4, start() { MUS.mood = 'forest'; CC.rate = 2.5; CC.pos.set(b.x + 3, b.y + 2, b.z + 4); CC.look.set(b.x, b.y + 1.2, b.z); dialog('The Drone Master', 'My drones… all broken… by a kid and a DOG?!'); } },
      { d: 3.6, start() { dialog('The Drone Master', 'Fine! Kaala has the puppy in Silent Valley. But nobody makes a sound there… you\'ll never hear him coming!'); } },
      { d: 1.6, start() { sfx.smash(); emit(TEX.puff, new THREE.Vector3(b.x, b.y + 1, b.z), 40, { color: 0x888888, size: 1.4, speed: 3, g: 0, life: 1.6, spread: 1.2 }); }, end() { b.h.root.visible = false; } },
      { d: 4.5, start() { G.celebrate = true; HN.script = true; HN.mode = 'rear'; HN.speed = 0; HN.wag = 1; CC.pos.set(P.pos.x + 3, P.pos.y + 1.8, P.pos.z + 3.5); CC.look.set(P.pos.x, P.pos.y + .8, P.pos.z); sfx.big(); dialog('Pichu', 'Silent Valley… we\'re coming, Mittu. Shhh, Honey — let\'s be brave and quiet.'); }, update(k, dt) { if (Math.random() < dt * 8) emit(TEX.heart, new THREE.Vector3(P.pos.x, P.pos.y + 1.2, P.pos.z), 1, { size: .25, speed: 1, g: .3, life: 1.6, spread: .4 }); } },
    ], () => { G.celebrate = false; HN.script = false; G.stage = 5; FLOW.complete(); }, () => { b.h.root.visible = false; G.celebrate = false; HN.script = false; }), 1200);
  },
  onPlayerDown() { respawnReset(L, b => b.resetFight()); },

  update(dt, t) {
    { const r = L.ranger.root, dx = P.pos.x - r.position.x, dz = P.pos.z - r.position.z; r.rotation.y = Math.atan2(dx, dz); animHuman(L.ranger, dt, 0, 'idle', t); }
    L.mist.amount = smooth(76, 64, P.pos.z) * (1 - smooth(-50, -64, P.pos.z) * .7);
    L.boss.flying = L.boss.shielded;   // Honey won't try to bite him up on his rock
    if (!tickCommon(L, dt, t, 'forest')) return;
    if (P.pos.z < 104) wakeGroup(1);
    if (P.pos.z < 56) wakeGroup(2);
    if (P.pos.z < 34) wakeGroup(3);
    if (P.pos.z < -24) wakeGroup(4);
    if (!L.walled && G.stage === 2 && P.pos.z < WALLZ - 1.5) this.startBoss();
    if (L.bossOn) { const dx = P.pos.x - AR.x, dz = P.pos.z - AR.z, d = Math.hypot(dx, dz); if (d > AR.r - .5) { P.pos.x = AR.x + dx / d * (AR.r - .5); P.pos.z = AR.z + dz / d * (AR.r - .5); } }
    if (G.stage === 3 && !L.boss.shielded) G.stage = 4;
    this.objective();
    if (AU.ctx) AU.wind.g.gain.value = .04 + smooth(70, 0, P.pos.z) * .06 + Math.sin(t * .2) * .015;
    ambientBirds(dt, P.pos.z > C1 ? ['chirp', 'koel'] : ['chirp']);
  },
  dispose() { L = null; },
};
export default level;
