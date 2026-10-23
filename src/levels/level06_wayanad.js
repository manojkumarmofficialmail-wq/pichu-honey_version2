// LEVEL 6 — WAYANAD CAVES (the finale)
// South → north: Wayanad coffee estate → Meenmutty Falls (climb the vines beside the waterfall) →
// rocky plateau → the ancient Edakkal Caves (lantern, carvings, last rescues, Mittu's paw prints) →
// Kaala's lair: the final battle, and Mittu comes home.
import { THREE, std, M, B, CY, jitter, hsl, TEX, signTex } from '../core/engine.js';
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
import { makeSign, makeTent, Crate, Cage, Barricade, hornbillFlyer } from '../world/props.js';
import { vineLadder, rockPillar } from '../world/props2.js';
import { waterfall, coffeeRows, carvings, torch, caveRoof, lightBeam, mittuCage } from '../world/props4.js';
import { WX } from '../world/weather.js';
import { makeHuman, animHuman } from '../actors/human.js';
import { animQuad } from '../actors/quad.js';
import { HN, placeHoney } from '../actors/honey.js';
import { Enemy, wakeGroup } from '../combat/enemies.js';
import { Drone } from '../combat/drone.js';
import { Kaala } from '../combat/bosses5.js';
import { ENEMIES } from '../combat/combat.js';
import { Clue, puppyWhine, makePuppy } from '../world/story.js';
import { newRuntime, tickCommon, tryFreeCage, tryInteract, setCP, respawnReset, ambientBirds, alive } from './kit.js';
import { Stone, TorchPuzzle, Boulder, symTex } from '../world/challenges.js';
import { KeyItem, KeyGate, Chest } from '../world/treasure.js';
import { Discovery } from '../world/discovery.js';
import { viewpoint } from '../world/wildlife.js';
import { elephantWalker } from '../world/props2.js';

/* ---------- layout ---------- */
const pathX = z => Math.sin(z * .02 + .8) * 9 + Math.sin(z * .05 + 2.5) * 3.5;
const START = { x: pathX(118), z: 118 };
const C1 = 88, C2 = 72;                              // the two cliffs at Meenmutty
const FALLX = z => pathX(z) - 10;                    // the waterfall runs down beside the path
const CAVE = 19;                                     // Edakkal cave mouth (z)
const AR = { x: pathX(-86), z: -86, r: 17 };
const MITTU = { x: AR.x, z: AR.z - 14.5 };
const GZ = -54, WALLZ = AR.z + 19;

function baseH(x, z) {
  let h = fbm(x * .022 + 1.3, z * .022 + 8.8) * 3.2 + vnoise(x * .1, z * .1) * .35;
  h += 5 * smooth(C1 + .6, C1 - .6, z) + 6 * smooth(C2 + .6, C2 - .6, z) + 3 * smooth(50, 25, z);
  // waterfall pools at the foot of each cliff
  for (const c of [C1, C2]) { const d = Math.hypot(x - FALLX(c), z - (c + 3)); h = lerp(h, h - 2.6, smooth(3.6, 2, d)); }
  const pd = Math.abs(x - pathX(z));
  // inside the cave: steep rock walls close in
  const cave = smooth(CAVE + 3, CAVE - 2, z); h += cave * Math.max(0, pd - 7.5) ** 2 * .7;
  const ex = Math.max(0, Math.abs(x - pathX(z) * .4) - 42); h += ex * ex * .08 * (1 - cave);
  const es = Math.max(0, z - 124); h += es * es * .1;
  return h;
}
const H_START = baseH(START.x, START.z), H_AR = baseH(AR.x, AR.z) + .3;
function height(x, z) {
  let h = baseH(x, z);
  h = lerp(h, H_START, smooth(12, 6, Math.hypot(x - START.x, z - START.z)));
  const da = Math.hypot(x - AR.x, z - AR.z), inAr = smooth(19, 15, da);
  h = lerp(h, H_AR, inAr); h += Math.max(0, da - 17.5) ** 2 * .5 * smooth(AR.z + 24, AR.z + 14, z);
  h += 2.6 * smooth(3, 2.2, Math.hypot(x - MITTU.x, z - MITTU.z));     // Mittu's rock
  const pd = Math.abs(x - pathX(z)); h -= smooth(2.4, .5, pd) * .1;
  return h;
}
const C = { grass: new THREE.Color(0x4f8a2f), grass2: new THREE.Color(0x7aa848), soil: new THREE.Color(0x7a4a2a), rock: new THREE.Color(0x6a625a), cave: new THREE.Color(0x3a3028), cave2: new THREE.Color(0x4a3e32), path: new THREE.Color(0x8a5a38) };
function colour(c, x, z, y, sl) {
  const n = fbm(x * .05, z * .05) * .5 + .5, n2 = vnoise(x * .25, z * .25) * .5 + .5;
  c.copy(C.grass).lerp(C.grass2, clamp(n * 1.2 - .2, 0, 1)); if (z > 96) c.lerp(C.soil, .35);
  c.lerp(C.rock, smooth(55, 30, z) * .5);
  const cave = smooth(CAVE + 2, CAVE - 2, z); c.lerp(C.cave, cave * .9).lerp(C.cave2, cave * n2 * .4);
  const pd = Math.abs(x - pathX(z)); c.lerp(C.path, smooth(2.4, 1.1, pd + n2 * .5) * .85 * (1 - cave * .6));
  c.lerp(C.rock, smooth(1.1, 2.2, sl) * (1 - cave * .3)); c.multiplyScalar(.9 + n2 * .14);
}
const ladder = z => { const x = pathX(z); return { x, z: z + .75, nx: 0, nz: 1, y0: height(x, z + 1.2), y1: height(x, z - 1.3), w: 1.4 }; };

let L = null;
const level = {
  id: 6, name: 'Wayanad Caves', ml: 'വയനാട്', region: 'Edakkal & Meenmutty · Wayanad', music: 'forest', cages: 3, final: true,
  envKeys: [[999, 'coffee'], [92, 'coffee'], [70, 'morning'], [32, 'golden'], [22, 'golden'], [15, 'cave'], [-500, 'cave']],
  objectiveTarget() { return L?.target?.() ?? null; },
  sniffTarget() {
    if (!L) return null;
    if (L.bossOn && L.boss.st === 'trick') return { x: L.boss.x, z: L.boss.z };    // Honey sniffs out the real Kaala
    if (!L.clue.found) return { x: L.clue.x, z: L.clue.z, clue: true };
    if (!L.key.hidden && !L.key.got) return L.key;
    return this.objectiveTarget();
  },

  build(root) {
    resetCollision(); seed(9696);
    W.height = height; W.water = -100; W.bounds = { x0: -52, x1: 52, z0: AR.z - 15, z1: 127 };
    W.walkable = () => true;
    WX.rain = 0; WX.night = 0;
    L = newRuntime(root, { stage: 0 }); setCP(L, START.x, START.z - 2);
    W.minZ = () => !L.doorOpen ? CAVE + 1.2 : !L.gates.g.open ? GZ + .7 : -1e9;
    W.maxZ = () => L.walled ? WALLZ - .6 : 1e9;
    W.onGate = () => {
      if (L.msgT > 0) return; L.msgT = 4;
      if (L.l1.locked) dialog('Pichu', 'Kaala\'s men are guarding the coffee estate. Let\'s clear them first!', 3);
      else if (L.l2.locked) dialog('Pichu', 'Drones by the waterfall! I can\'t climb with them buzzing around.', 3);
      else if (!L.doorOpen) dialog('Pichu', 'A stone door blocks the cave! The carving shows four signs… maybe the torches must be lit in that order.', 4);
      else dialog('Pichu', 'A locked gate! Kaala must have the key hidden somewhere in this cave.', 3);
    };
    W.onClimbTop = l => { setCP(L, l.x, l.z - 3); sfx.collect(); if (l === L.l2) { G.stage = Math.max(G.stage, 1); dialog('Pichu', 'Up and over Meenmutty! The Edakkal caves are just ahead.', 3.5); } this.objective(); };
    buildTerrain(root, { w: 108, l: 255, cx: 0, cz: (W.bounds.z0 + 128) / 2, nx: 108, nz: 245, height, colour });
    // the waterfall pools
    for (const c of [C1, C2]) { const m = new THREE.Mesh(new THREE.CircleGeometry(3.2, 24).rotateX(-PI / 2), new THREE.MeshStandardMaterial({ color: 0x3a8ab0, roughness: .1, transparent: true, opacity: .8 })); m.position.set(FALLX(c), height(FALLX(c), c + 3) + 1.6, c + 3); root.add(m); }
    this.plants(root); this.props(root); this.actors(root);
  },

  plants(root) {
    const F = new Flora();
    const inCave = z => z < CAVE + 2;
    const clear = (x, z) => Math.hypot(x - START.x, z - START.z) < 9 || Math.hypot(x - AR.x, z - AR.z) < 20 || Math.hypot(x - FALLX(C1), z - C1 - 3) < 5 || Math.hypot(x - FALLX(C2), z - C2 - 3) < 5;
    // coffee estate rows with silver oaks for shade
    const cof = [];
    for (let z = 124; z > 96; z -= 2.1) for (let x = -48; x < 48; x += 1.35) { const tx = x + sr(-.2, .2), tz = z + Math.sin(x * .1) * .8; if (Math.abs(tx - pathX(tz)) < 2.6 || clear(tx, tz)) continue; cof.push({ x: tx, z: tz }); }
    coffeeRows(root, cof);
    for (let i = 0; i < 60; i++) { const x = sr(-48, 48), z = sr(96, 124); if (Math.abs(x - pathX(z)) < 4 || tooClose(x, z, 6) || clear(x, z)) continue; F.silverOak(x, height(x, z), z, sr(.85, 1.1)); }
    // forest around the falls and on the plateau
    const tries = 9000 * Q.trees;
    for (let i = 0; i < tries; i++) {
      const x = sr(-50, 50), z = sr(CAVE + 4, 95), y = height(x, z), pd = Math.abs(x - pathX(z));
      if (pd < 4 || clear(x, z) || Math.abs(z - C1) < 2.5 || Math.abs(z - C2) < 2.5) continue;
      if (srnd() > (z < 55 ? .35 : .85)) continue; if (tooClose(x, z, 2.7)) continue;
      const r = srnd(); if (r < .55) F.rain(x, y, z, sr(.8, 1.2)); else if (r < .75) F.bamboo(x, y, z, sr(.8, 1.1)); else if (r < .88) F.silverOak(x, y, z, sr(.8, 1)); else F.rock(x, y, z, sr(.8, 1.8));
    }
    for (let i = 0; i < 600; i++) { const x = sr(-50, 50), z = sr(AR.z - 10, 124), y = height(x, z); const pd = Math.abs(x - pathX(z)); if (pd < 2.6 || clear(x, z)) continue; const w = inCave(z) ? (pd > 5 ? .5 : 0) : z < 55 ? .5 : .2; if (srnd() > w) continue; F.rock(x, y, z, srnd() < .2 ? sr(.8, 1.6) : sr(.2, .6)); }
    for (let i = 0; i < 1800; i++) { const x = sr(-50, 50), z = sr(CAVE + 3, 124), y = height(x, z); if (Math.abs(x - pathX(z)) < 2.2 || clear(x, z)) continue; if (srnd() < .75) F.fern(x, y, z, sr(.7, 1.4)); else F.bush(x, y, z, sr(.25, .5)); }
    let gs = 0, tr = 0; while (gs < Q.grass && tr < Q.grass) {
      tr++; const cx = sr(-50, 50), cz = sr(CAVE + 3, 124), n = 7 + (srnd() * 10 | 0);
      for (let k = 0; k < n; k++) { const x = cx + sr(-.8, .8), z = cz + sr(-.8, .8), y = height(x, z); const pd = Math.abs(x - pathX(z)); if (pd < 1.3 && srnd() < .85) continue; if (clear(x, z)) continue; F.grass(x, y, z, sr(.25, .6) * (pd < 2 ? .6 : 1), hsl(sr(.2, .28), sr(.4, .58), sr(.26, .38))); gs++; }
    }
    F.flush(root);
  },

  props(root) {
    makeSign(root, START.x - 3.5, START.z + 2, 0, 'വയനാട്', 'Wayanad Coffee Estate', '#2f5a2a');
    makeSign(root, pathX(C1 + 6) + 4, C1 + 6, 0, 'MEENMUTTY', 'Waterfalls', '#2f4a6a');
    // Meenmutty falls: top fall (C2) and lower fall (C1)
    for (const c of [C1, C2]) { const x = FALLX(c); L.ticks.push(waterfall(root, x, c + .3, height(x, c - 1.5) + .3, height(x, c + 3) + 1.5, 4.5, 0)); }
    L.l1 = Object.assign(ladder(C1), { locked: true }); L.l2 = Object.assign(ladder(C2), { locked: true });
    L.ticks.push(vineLadder(root, L.l1), vineLadder(root, L.l2));
    // Edakkal cave mouth
    for (const s of [-1, 1]) rockPillar(root, pathX(CAVE) + s * 4.2, CAVE, 1.8, 8);
    const lint = M(jitter(new THREE.BoxGeometry(11, 2.4, 3.4, 3, 1, 2), .2), std(0x4a4038, { flatShading: true }), pathX(CAVE), height(pathX(CAVE), CAVE) + 7.6, CAVE, root);
    makeSign(root, pathX(CAVE + 4) + 3.5, CAVE + 4, 0, 'EDAKKAL', 'Caves · 6000 years old', '#4a3a2a');
    caveRoof(root, pathX, CAVE - 2, AR.z + 22, 9.5);
    for (const z of [6, -18, -40]) L.beams = (L.beams || []).concat(lightBeam(root, pathX(z) + (z % 2 ? 3.8 : -3.8), z, 11));
    // torches and carvings along the cave
    let n = 0; for (let z = CAVE - 4; z > AR.z + 20; z -= 7) { const s = n % 2 ? 1 : -1; L.ticks.push(torch(root, pathX(z) + s * 4.6, z, n % 2 === 0)); n++; }
    [[10, -1], [-6, 1], [-26, -1], [-46, 1]].forEach(([z, s]) => L.ticks.push(carvings(root, pathX(z) + s * 7.4, z, s > 0 ? -PI / 2 : PI / 2, 1.2)));
    for (let i = 0; i < 6; i++) { const a = PI / 6 + i * PI / 3; L.ticks.push(torch(root, AR.x + Math.sin(a) * (AR.r - 1.5), AR.z + Math.cos(a) * (AR.r - 1.5), i % 2 === 0)); }
    // cages + clue
    L.cages.push(Object.assign(new Cage(root, pathX(50) + 7, 50, 'tahr', 0), { guard: 3 }));
    L.cages.push(Object.assign(new Cage(root, pathX(-4) - 3.5, -4, 'macaque', 0), { guard: 4 }));
    L.cages.push(Object.assign(new Cage(root, pathX(-34) + 3.5, -34, 'spotted', 0), { guard: 5 }));
    L.clue = new Clue(root, pathX(-46), -46, 'print', () => { puppyWhine(.3); dialog('Pichu', "Tiny paw prints — Mittu's! And they're fresh… listen! I can hear her crying up ahead!", 5); HN.bark = 1; this.checkGate(); this.objective(); });
    L.ticks.push(L.clue);
    L.gates.g = new KeyGate(root, pathX(GZ), GZ, 7); L.inter.push(L.gates.g);
    // Edakkal stone door + torch puzzle: light the torches in the order shown on the carving
    { const px = pathX(CAVE); L.door = M(jitter(new THREE.BoxGeometry(6.6, 6.4, 1, 3, 3, 1), .12), std(0x5a5048, { flatShading: true }), px, height(px, CAVE) + 3.1, CAVE - .2, root);
      const syms = ['sun', 'elephant', 'man', 'grid'], order = [2, 0, 3, 1];
      const tp = [[-6, 8], [-2.4, 10.5], [2.4, 10.5], [6, 8]].map(([dx, dz], i) => ({ x: pathX(CAVE + dz) + dx, z: CAVE + dz, sym: syms[i] }));
      L.puzzle = new TorchPuzzle(root, tp, order, () => { L.doorOpen = true; L.doorT = 0; sfx.smash(); G.shake = .5; setCP(L, px, CAVE + 4); dialog('Pichu', 'The stone door is opening! Just like the carving said!', 3); this.objective(); });
      L.inter.push(L.puzzle); L.ticks.push(L.puzzle);
      // the carving that shows the order
      const c = document.createElement('canvas'); c.width = 256; c.height = 72; const g = c.getContext('2d'); g.fillStyle = '#3a2e24'; g.fillRect(0, 0, 256, 72);
      order.forEach((k, i) => { g.drawImage(symTex(syms[k]).image, 6 + i * 64, 8, 52, 52); if (i < 3) { g.fillStyle = '#ffd8a0'; g.font = 'bold 22px Arial'; g.fillText('›', 56 + i * 64, 42); } });
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const pan = new THREE.Mesh(new THREE.PlaneGeometry(3.4, .96), new THREE.MeshBasicMaterial({ map: tex })); pan.position.set(px, height(px, CAVE) + 4.6, CAVE + .45); root.add(pan); }
    // Kaala's key on a stone altar — appears when the cave tasks are done, and wakes a rolling boulder
    { const ax = pathX(-24) - 3.5, az = -24; new Stone(root, ax, az, .8, height(ax, az) + .9);
      L.key = new KeyItem(root, ax, az, { hidden: true, y: height(ax, az) + .9, name: "Kaala's gate key", onGet: () => { dialog('Pichu', 'Got it! Uh oh… the ground is shaking — RUN to the gate!', 3); setTimeout(() => L.boulder.start(), 900); this.objective(); } }); L.ticks.push(L.key);
      L.keySpot = new THREE.Vector3(pathX(-26), height(pathX(-26), -26), -26);
      const bp = []; for (let z = -12; z >= -50; z -= 2) bp.push({ x: pathX(z), z }); L.boulder = new Boulder(root, bp, 5.2, 1.7); }
    // treasure
    [[pathX(116) + 13, 116], [FALLX(C1) + 7, C1 + 7], [pathX(-14) + 4, -14]].forEach(([x, z]) => { const c = new Chest(root, x, z); L.inter.push(c); L.ticks.push(c); });
    // Nature Book
    L.ticks.push(new Discovery(root, 'coffee', pathX(112) + 3, 112, { r: 5, y: H_START }));
    L.ticks.push(new Discovery(root, 'meenmutty', FALLX(C1) + 3, C1 + 5, { r: 9, y: height(FALLX(C1), C1 + 5) + 2 }));
    { const ex = pathX(45), pts = [{ x: ex - 18, z: 46, wait: 5 }, { x: ex - 6, z: 43 }, { x: ex + 14, z: 47, wait: 6 }, { x: ex + 2, z: 50 }]; L.ticks.push(elephantWalker(root, pts, 1, 1)); L.ticks.push(new Discovery(root, 'wyelephant', ex - 4, 46, { r: 14, y: height(ex, 46) + 2 })); }
    { const vx = pathX(30) - 5, vz = 30; viewpoint(root, vx, vz, -PI / 2); L.ticks.push(new Discovery(root, 'chembra', vx, vz, { r: 5, y: height(vx, vz) }));
      const peak = new THREE.Mesh(new THREE.ConeGeometry(60, 45, 7), new THREE.MeshBasicMaterial({ color: 0x7a9a7a, fog: false })); peak.position.set(vx - 170, height(vx, vz) + 4, vz - 20); root.add(peak); }
    L.ticks.push(new Discovery(root, 'edakkal', pathX(10) - 6, 10, { r: 6, y: height(pathX(10), 10) + 1 }));
    // Mittu's cage high on Kaala's rock
    L.mittu = mittuCage(root, MITTU.x, MITTU.z);
    // light the lair so Kaala and his red warnings are easy to see
    const top = new THREE.SpotLight(0xffd0a0, 70, 70, .75, .6, 1); top.position.set(AR.x + 3, H_AR + 30, AR.z + 6); top.target.position.set(AR.x, H_AR, AR.z); root.add(top, top.target);
    const fill = new THREE.PointLight(0xffa060, 8, 30, 1.2); fill.position.set(AR.x, H_AR + 6, AR.z + 5); root.add(fill);
    const blue = new THREE.PointLight(0x8ad0ff, 3, 8, 1.5); blue.position.set(MITTU.x, height(MITTU.x, MITTU.z) + 2, MITTU.z + 1.5); root.add(blue);
    [[START.x + 4, 112, 'ammo'], [pathX(98) - 5, 98, 'heal'], [pathX(80) + 4, 80, 'ammo'], [pathX(60) - 5, 60, 'heal'], [pathX(36) + 5, 36, 'ammo'], [pathX(8) - 3.5, 8, 'ammo'], [pathX(-20) + 3.5, -20, 'heal'], [pathX(-50) - 3.5, -50, 'ammo'], [pathX(-64) + 3, -64, 'heal']].forEach(([x, z, l]) => new Crate(root, x, z, l));
    [[START.x + 6, 122], [pathX(108) - 9, 108], [pathX(100) + 10, 100], [pathX(84) + 5, 84], [FALLX(C1) + 4, C1 + 6], [pathX(64) - 8, 64], [pathX(44) + 9, 44], [pathX(28) - 9, 28], [pathX(2) + 3, 2], [pathX(-12) - 3, -12], [pathX(-28) + 3, -28], [AR.x - 10, AR.z + 5]].forEach(([x, z]) => spawnPickup('pod', x, z, root));
    for (let i = 0; i < 3; i++) L.ticks.push(hornbillFlyer(root, pathX(90) + sr(-15, 15), sr(60, 115), sr(18, 28), sr(12, 18), sr(.05, .09) * (i % 2 ? 1 : -1), sr(0, TAU)));
  },

  actors(root) {
    L.ranger = makeHuman({ skin: 0x8a5a3a, shirt: 0xb8a070, pants: 0x9a8a5a, hat: 'ranger', moustache: false, boot: 0x1a1410 });
    L.ranger.root.position.set(START.x + 2.4, H_START, START.z - 3); root.add(L.ranger.root);
    L.pups = [makePuppy(0xd84a8a), makePuppy(0x4ac86a)]; L.pups.forEach(p => root.add(p.root));
    L.guards = [0, 1].map(() => { const g = makeHuman({ skin: 0x7a5034, shirt: 0x6a7a4a, pants: 0x5a6a3a, hat: 'ranger', boot: 0x1a1410, weapon: 'staff' }); g.root.visible = false; root.add(g.root); return g; });
    [[-3, 108, 'grunt'], [3, 105, 'grunt'], [0, 100, 'brute']].forEach(([dx, z, t]) => new Enemy(t, pathX(z) + dx, z, root, { group: 1 }));
    [[-6, 82], [6, 78]].forEach(([dx, z]) => new Drone(pathX(z) + dx, z, root, { group: 2 })); new Enemy('slinger', pathX(80) + 5, 80, root, { group: 2 });
    [[0, 48, 'brute'], [-6, 44, 'grunt'], [7, 40, 'slinger']].forEach(([dx, z, t]) => new Enemy(t, pathX(z) + dx, z, root, { group: 3 })); new Drone(pathX(46) - 8, 46, root, { group: 3 });
    [[0, -28, 'brute'], [-2, -36, 'grunt']].forEach(([dx, z, t]) => new Enemy(t, pathX(z) + dx, z, root, { group: 5, aggro: 9 })); [[-3, -30], [3, -38]].forEach(([dx, z]) => new Drone(pathX(z) + dx, z, root, { group: 5 }));
    L.boss = new Kaala(root, AR, AR.x, AR.z - 6, { yaw: 0, onPhase: n => this.onPhase(n) });
    L.target = () => {
      if (G.stage === 0) { if (alive(1)) return { x: pathX(104), z: 104 }; if (alive(2)) return { x: pathX(80), z: 80 }; return L.l2.locked ? L.l1 : L.l2; }
      if (G.stage === 1) { for (const [g, c] of [[3, 0], [4, 1], [5, 2]]) if (alive(g) || !L.cages[c].free) return L.cages[c]; if (!L.clue.found) return L.clue; if (!L.key.got && !(G.keys > 0)) return L.key; return { x: pathX(GZ), z: GZ }; }
      if (G.stage === 2) return AR;
      return null;
    };
  },

  start(skipIntro) {
    P.pos.set(START.x, H_START, START.z - 2); P.yaw = PI; placeHoney(START.x + 1.2, START.z - 1.5, PI); G.stage = 0;
    const r = L.ranger.root.position;
    const go = () => { FLOW.startPlay(); showTitle('Final Level', 'Wayanad Caves', 'Climb Meenmutty Falls, enter the Edakkal Caves — and bring Mittu home', 'വയനാട്'); this.objective(); };
    if (skipIntro) { go(); return; }
    runCine([
      { d: 5.2, start() { CC.rate = 1.2; CC.pos.set(START.x + 10, H_START + 7, 112); CC.look.set(pathX(80), height(pathX(80), 80) + 4, 80); dialog('Narrator', 'Wayanad — misty hills of coffee and pepper, roaring waterfalls, and caves where people carved pictures six thousand years ago.'); }, update(k) { CC.pos.x = START.x + 10 - k * 8; } },
      { d: 5.4, start() { CC.rate = 2; CC.pos.set(r.x - 2.4, r.y + 1.7, r.z - 2.6); CC.look.set(r.x, r.y + 1.2, r.z); dialog('Ranger Ammini', "Kaala's hideout is inside the Edakkal caves, above Meenmutty Falls. And look who came to cheer for you — Mittu's brother and sister!"); } },
      { d: 4, start() { CC.pos.set(START.x - 1.5, H_START + 1.3, START.z - 4.6); CC.look.set(START.x, H_START + .8, START.z - 2); HN.bark = 1; sfx.bark(0, .5); dialog('Pichu', 'This is it, Honey. The last forest. Let\'s bring Mittu home!'); } },
    ], go);
  },

  objective() {
    const s = G.stage;
    setObjective(
      s === 0 ? (alive(1) ? `Clear Kaala's men from the coffee estate (${3 - alive(1)}/3)` : L.l1.locked ? 'Climb the vines beside Meenmutty Falls' : alive(2) ? 'Knock down the drones by the waterfall 🎯' : 'Climb the second vine up the falls') :
      s === 1 ? (G.freed < 3 || alive(3) || alive(4) || alive(5) ? `Enter the Edakkal caves — free the last animals (${G.freed}/3) 🏮` : !L.clue.found ? 'Find Mittu\'s trail in the cave (Q / 👃 SNIFF)' : !L.key.got && !(G.keys > 0) ? 'Kaala\'s key is on the stone altar — grab it! 🔑' : L.boulder.on ? 'RUN to the gate! 🪨💨' : 'Unlock the gate to Kaala\'s lair 🔑') :
      s === 2 ? 'Kaala\'s lair is ahead. Mittu is waiting! 🐾' : 'FINAL BATTLE: Defeat Kaala!');
  },

  onEnemyKO(e) {
    if (e.boss) { this.bossDefeated(); return; }
    setTimeout(() => { this.unlock(); this.checkGate(); this.objective(); }, 400);
  },
  unlock() {
    if (L.l1.locked && !alive(1)) { L.l1.locked = false; sfx.big(); popText('Coffee estate cleared! ☕'); dialog('Pichu', 'The way to Meenmutty Falls is clear. Up the vines!', 3); }
    if (L.l2.locked && !alive(2) && !L.l1.locked && P.pos.z < C1) { L.l2.locked = false; sfx.big(); popText('Drones down! 💦'); }
  },
  checkGate() {
    if (G.stage === 1 && L.key.hidden && G.freed >= 3 && L.clue.found && !alive(3) && !alive(5)) { L.key.reveal(); dialog('Pichu', 'Look — a key on that stone altar! That must open Kaala\'s gate.', 3.5); this.objective(); }
    if (G.stage === 1 && L.gates.g.open) {
      L.boulder.stop(); G.stage = 2; setCP(L, pathX(GZ - 2), GZ - 2); sfx.big(); popText('Every animal is safe! 🐾');
      dialog('Pichu', 'That\'s Mittu crying! She\'s right through there. Hold on, Mittu — we\'re coming!', 4); puppyWhine(.2); this.objective();
    }
  },
  action() { if (tryInteract(L)) { this.checkGate(); this.objective(); return; } tryFreeCage(L, c => alive(c.guard) > 0); this.checkGate(); this.objective(); },

  onPhase(n) {
    if (n === 2) setTimeout(() => dialog('Ranger Ammini (radio)', MOBILE ? 'Pichu! Only one Kaala is real. Tap 🐶 BARK — Honey will scare away the fakes!' : 'Pichu! Only one Kaala is real. Press H — Honey\'s BARK will scare away the fakes!', 5), 2500);
    if (n === 3) { G.shake = .8; setTimeout(() => dialog('Pichu', 'The cave is falling apart! Watch for the red circles!', 3), 3500); }
  },

  startBoss() {
    L.walled = true; P.pos.set(AR.x, W.height(AR.x, AR.z + 8), AR.z + 8); P.yaw = PI; CAM.yaw = 0; G.stage = 3; setCP(L, AR.x, AR.z + 11); this.objective();
    const g = new THREE.Group(); g.position.set(pathX(WALLZ), height(pathX(WALLZ), WALLZ), WALLZ); L.root.add(g);
    for (let i = 0; i < 12; i++) M(jitter(new THREE.DodecahedronGeometry(sr(.9, 1.6), 1), .3), std(0x3a3028, { flatShading: true }), sr(-6, 6), sr(0, 1.4), sr(-1, 1), g);
    sfx.smash(); G.shake = .4;
    const b = L.boss, mg = L.mittu.g.position;
    runCine([
      { d: 3.4, start() { MUS.mood = 'boss'; CC.rate = 2; CC.pos.set(mg.x + 2.5, mg.y + 1.6, mg.z + 4); CC.look.set(mg.x, mg.y + .5, mg.z); puppyWhine(.35); dialog('Pichu', 'MITTU!!! She\'s in that cage!'); } },
      { d: 3.6, start() { CC.pos.set(b.x + 3, b.y + 2, b.z + 5); CC.look.set(b.x, b.y + 1.8, b.z); sfx.roar(); dialog('Kaala', 'You came all this way… for ONE little puppy?'); } },
      { d: 3.4, start() { CC.pos.set(P.pos.x + 2.5, P.pos.y + 1.6, P.pos.z + 3); CC.look.set(P.pos.x, P.pos.y + .9, P.pos.z - 2); HN.bark = 1; sfx.bark(0, .8); dialog('Pichu', 'She\'s not just a puppy. She\'s FAMILY!'); } },
      { d: 2.8, start() { CC.pos.set(b.x - 3, b.y + 1.6, b.z + 4); CC.look.set(b.x, b.y + 1.6, b.z); dialog('Kaala', 'Then come, little hero. Let\'s finish this.'); } },
    ], () => { FLOW.startPlay(); b.awake = true; L.bossOn = true; bossBar(b.name, 1); showTitle('Final Boss', 'KAALA', 'Watch the red warnings · dodge · strike back!'); });
  },
  bossDefeated() {
    L.bossOn = false; const b = L.boss, kr = b.h.root, mc = L.mittu, mg = mc.g.position, ranger = L.ranger.root;
    const pupPos = new THREE.Vector3();
    setTimeout(() => runCine([
      { d: 3.4, start() { MUS.mood = 'forest'; CC.rate = 2.5; CC.pos.set(b.x + 3, b.y + 1.8, b.z + 4); CC.look.set(b.x, b.y + 1.2, b.z); dialog('Kaala', 'No… NO! Beaten by a boy and his dog?!'); } },
      { d: 3, start() { HN.script = true; HN.mode = 'walk'; HN.speed = 9; dialog('Narrator', 'Kaala raised his staff one last time — but Honey was faster!'); }, update(k, dt) { const tx = b.x + .9, tz = b.z + .9; HN.pos.x = lerp(HN.pos.x, tx, Math.min(1, dt * 4)); HN.pos.z = lerp(HN.pos.z, tz, Math.min(1, dt * 4)); HN.pos.y = W.height(HN.pos.x, HN.pos.z) + Math.sin(k * PI) * .8; HN.yaw = Math.atan2(b.x - HN.pos.x, b.z - HN.pos.z); }, end() { HN.mode = 'rear'; HN.speed = 0; HN.bark = 1; sfx.bigBark(); b.h.J.wpn.visible = false; emit(TEX.spark, new THREE.Vector3(b.x, b.y + 2, b.z), 30, { add: true, color: 0xffd36a, size: .4, speed: 4, g: -4, life: .8 }); sfx.smash(); } },
      { d: 3.4, start() { dialog('Narrator', 'CRACK! Honey snapped Kaala\'s staff right in two!'); G.shake = .4; }, update(k, dt) { animHuman(b.h, dt, 0, 'stun', performance.now() / 1000); } },
      { d: 4.2, start() { ranger.position.set(AR.x - 2, H_AR, AR.z + 12); L.guards.forEach((g, i) => { g.root.visible = true; g.root.position.set(AR.x + (i ? 2 : -3), H_AR, AR.z + 13); }); CC.pos.set(AR.x + 4, H_AR + 2.5, AR.z + 4); CC.look.set(AR.x, H_AR + 1.2, AR.z + 8); dialog('Ranger Ammini', 'Kaala! You are under arrest for poaching in every forest of Kerala!'); },
        update(k, dt) { const t = performance.now() / 1000; L.guards.forEach((g, i) => { const tx = b.x + (i ? 1.2 : -1.2), tz = b.z + .5; g.root.position.x = lerp(g.root.position.x, tx, dt * 1.5); g.root.position.z = lerp(g.root.position.z, tz, dt * 1.5); g.root.position.y = W.height(g.root.position.x, g.root.position.z); g.root.rotation.y = Math.atan2(b.x - g.root.position.x, b.z - g.root.position.z); animHuman(g, dt, 2, 'walk', t); }); ranger.position.z = lerp(ranger.position.z, AR.z + 4, dt); ranger.position.y = W.height(ranger.position.x, ranger.position.z); animHuman(L.ranger, dt, 1.5, 'walk', t); } },
      { d: 3, start() { P.pos.set(mg.x, W.height(mg.x, mg.z + 1.6), mg.z + 1.6); P.yaw = PI; CC.pos.set(mg.x + 2.5, mg.y + 1.8, mg.z + 4.5); CC.look.set(mg.x, mg.y + .6, mg.z); dialog('Pichu', 'Mittu, I\'m here! Let me open this cage…'); } },
      { d: 3.6, start() { mc.open = true; sfx.cage(); sfx.big(); emit(TEX.spark, mg.clone().setY(mg.y + .6), 40, { add: true, color: 0x8ad0ff, size: .4, speed: 3, g: -1, life: 1.2 }); HN.pos.set(mg.x + 1.4, W.height(mg.x + 1.4, mg.z + 2.6), mg.z + 2.6); dialog('Pichu', 'MITTU!!!'); },
        update(k, dt) { const t = performance.now() / 1000; mc.bars.forEach((bb, i) => { const v = mc.vel[i]; v.y -= 14 * dt; bb.position.addScaledVector(v, dt); bb.rotation.x += v.z * dt; if (k > .6) bb.visible = false; });
          // Mittu runs and jumps to her mama
          const p = mc.pup.root; if (k > .25) { p.getWorldPosition(pupPos); const tx = HN.pos.x, tz = HN.pos.z; const nx = lerp(pupPos.x, tx, dt * 3), nz = lerp(pupPos.z, tz, dt * 3); L.root.attach(p); p.position.set(nx, W.height(nx, nz) + Math.abs(Math.sin(t * 10)) * .2, nz); p.rotation.y = Math.atan2(tx - nx, tz - nz); animQuad(mc.pup, dt, 4, 'walk', t, { wag: 1 }); } } },
      { d: 5, start() { HN.mode = 'sit'; HN.wag = 1; HN.pant = true; G.celebrate = true; puppyWhine(.25); sfx.bark(0, .5); CC.pos.set(HN.pos.x + 2.6, HN.pos.y + 1.3, HN.pos.z + 2.6); CC.look.set(HN.pos.x, HN.pos.y + .4, HN.pos.z); dialog('Narrator', 'Honey licked Mittu\'s face again and again. Mama and puppy were together at last.'); },
        update(k, dt) { const t = performance.now() / 1000; const p = mc.pup.root; p.position.set(HN.pos.x + .5, W.height(HN.pos.x + .5, HN.pos.z + .3), HN.pos.z + .3); p.rotation.y = Math.atan2(HN.pos.x - p.position.x, HN.pos.z - p.position.z); animQuad(mc.pup, dt, 0, Math.sin(t * 3) > 0 ? 'rear' : 'sit', t, { wag: 1 }); if (Math.random() < dt * 8) emit(TEX.heart, new THREE.Vector3(HN.pos.x + .25, HN.pos.y + 1, HN.pos.z + .15), 1, { size: .28, speed: 1, g: .3, life: 1.6, spread: .4 }); } },
      { d: 5.4, start() { CC.rate = 1; CC.pos.set(AR.x, H_AR + 12, AR.z + 14); CC.look.set(AR.x, H_AR, AR.z); dialog('Narrator', 'From Agasthyamala to Wayanad, every animal Pichu freed was safe again. Kaala would never trap another one.'); }, update(k, dt) { const t = performance.now() / 1000; const p = mc.pup.root; animQuad(mc.pup, dt, 0, 'sit', t, { wag: 1 }); } },
      { d: 6, start() { dialog('Narrator', 'And Pichu, Honey and little Mittu went home together — the bravest family in all the Western Ghats. 🐾', 6); sfx.big(); }, update(k, dt) { CC.pos.y += dt * 1.2; } },
    ], () => { G.celebrate = false; HN.script = false; G.stage = 5; FLOW.complete(); }, () => { G.celebrate = false; HN.script = false; b.h.J.wpn.visible = false; mc.bars.forEach(bb => bb.visible = false); }), 1500);
  },
  onPlayerDown() { respawnReset(L, b => b.resetFight()); },

  update(dt, t) {
    { const r = L.ranger.root; if (G.mode === 'play') { const dx = P.pos.x - r.position.x, dz = P.pos.z - r.position.z; r.rotation.y = Math.atan2(dx, dz); animHuman(L.ranger, dt, 0, 'idle', t); } }
    if (G.mode !== 'cine') L.pups.forEach((p, i) => { p.root.position.set(L.ranger.root.position.x - .4 + i * .8, H_START, L.ranger.root.position.z + .8); p.root.rotation.y = L.ranger.root.rotation.y; animQuad(p, dt, 0, 'sit', t, { wag: .6 }); });
    // Mittu in her cage: whimpers when Pichu is near
    if (!L.mittu.open) { animQuad(L.mittu.pup, dt, 0, Math.sin(t * .8) > .3 ? 'rear' : 'sit', t, { wag: .4 }); if (P.pos.z < -60 && Math.random() < dt * .25) puppyWhine(.1); }
    WX.night = smooth(CAVE + 3, CAVE - 3, P.pos.z); WX.rain = 0;
    for (const bm of L.beams || []) bm.material.opacity = .035 + Math.sin(t * .5) * .012;
    if (!tickCommon(L, dt, t, 'forest')) return;
    if (P.pos.z < 114) wakeGroup(1);
    if (P.pos.z < C1) { wakeGroup(2); this.unlock(); }
    if (P.pos.z < 56) wakeGroup(3);
    if (!L.puzzleMsg && G.stage >= 1 && P.pos.z < CAVE + 14) { L.puzzleMsg = true; dialog('Pichu', 'A stone door, and four old torches with signs on them… The carving above the door shows an order!', 4.5); }
    if (L.doorOpen && L.doorT < 2) { L.doorT += dt; L.door.position.y -= dt * 3.4; if (L.doorT >= 2) L.door.visible = false; }
    // rolling boulder chase; reach the gate with the key and it unlocks by itself
    L.boulder.update(dt, () => { L.boulder.stop(); FLOW.respawn(L.keySpot, () => { dialog('Pichu', 'Too slow! Run as soon as it starts rolling!', 2.5); setTimeout(() => L.boulder.start(), 1500); }); });
    if (G.keys > 0 && Math.hypot(P.pos.x - pathX(GZ), P.pos.z - GZ) < 4 && !L.gates.g.open) { L.gates.g.use(); this.checkGate(); }
    if (P.pos.z < -20) wakeGroup(5);
    if (G.stage === 0 && !L.l2.locked && P.pos.z < C2 - 2) { G.stage = 1; }
    if (!L.caveMsg && P.pos.z < CAVE) { L.caveMsg = true; dialog('Pichu', 'It\'s so dark in here… good thing I have my lantern. Look at those old carvings on the walls!', 4); }
    if (!L.walled && G.stage === 2 && P.pos.z < WALLZ - 1.5) this.startBoss();
    if (L.bossOn) { const dx = P.pos.x - AR.x, dz = P.pos.z - AR.z, d = Math.hypot(dx, dz); if (d > AR.r - .5) { P.pos.x = AR.x + dx / d * (AR.r - .5); P.pos.z = AR.z + dz / d * (AR.r - .5); } }
    this.objective();
    if (AU.ctx) { const fd = Math.min(Math.hypot(P.pos.x - FALLX(C1), P.pos.z - C1), Math.hypot(P.pos.x - FALLX(C2), P.pos.z - C2)); AU.water.g.gain.value += (clamp(1 - fd / 30, 0, 1) * .25 - AU.water.g.gain.value) * Math.min(1, dt * 2); AU.wind.g.gain.value = .03 + WX.night * .04; }
    if (P.pos.z > CAVE) ambientBirds(dt);
  },
  dispose() { L = null; },
};
export default level;
