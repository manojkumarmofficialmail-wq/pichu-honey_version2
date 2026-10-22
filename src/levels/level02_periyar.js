// LEVEL 2 — PERIYAR LAKE (Periyar Tiger Reserve, Thekkady, Idukki)
// South → north: boat landing → bamboo raft across the lake (drones!) → island rescue →
// north shore with an elephant herd and a tiger → poacher outpost → the Jeep Trapper's clearing.
import { THREE, std, M, jitter, hsl, TEX } from '../core/engine.js';
import { G, P, W, CC, CAM } from '../core/state.js';
import { PI, TAU, clamp, lerp, smooth, fbm, vnoise, seed, sr, srnd, rand, pick, Q } from '../core/utils.js';
import { sfx, AU, MUS } from '../core/audio.js';
import { dialog, setObjective, popText, showTitle, hud, bossBar } from '../core/ui.js';
import { runCine } from '../core/cine.js';
import { FLOW } from '../core/flow.js';
import { buildTerrain, buildWater, tooClose, resetCollision } from '../world/terrain.js';
import { Flora } from '../world/foliage.js';
import { emit } from '../world/particles.js';
import { spawnPickup } from '../world/pickups.js';
import { makeSign, makeTent, makeCampfire, Crate, Cage, Barricade, hornbillFlyer, sambar } from '../world/props.js';
import { Raft, Deck, deadTree, elephantWalker, tigerTex, rockPillar, watchtower } from '../world/props2.js';
import { makeHuman, animHuman } from '../actors/human.js';
import { makeQuad, animQuad, QUADS } from '../actors/quad.js';
import { HN, placeHoney } from '../actors/honey.js';
import { Enemy, wakeGroup } from '../combat/enemies.js';
import { Drone } from '../combat/drone.js';
import { JeepTrapper } from '../combat/bosses2.js';
import { ENEMIES } from '../combat/combat.js';
import { Clue, puppyWhine } from '../world/story.js';
import { newRuntime, tickCommon, tryFreeCage, nearCage, setCP, respawnReset, ambientBirds, alive } from './kit.js';

/* ---------- layout ---------- */
const pathX = z => Math.sin(z * .018 + 1) * 10 + Math.sin(z * .047) * 3;
const sZ = x => 93 + Math.sin(x * .08) * 2.5, nZ = x => 15 + Math.sin(x * .07 + 1) * 2.5;
const START = { x: pathX(118), z: 118 };
const ISL = { x: pathX(54) + 3, z: 54 };
const JET = { x: pathX(96), z: 96 };          // jetty on the south shore
const NDOCK = { x: pathX(13), z: 13 };        // landing on the north shore
const OUT = { x: pathX(-32), z: -32 };        // poacher outpost
const AR = { x: pathX(-84), z: -84, r: 17 };
const GZ = -54, WALLZ = AR.z + 19;
const TIG = { x: pathX(-16) + 8, z: -17 };     // the tiger's rock
// raft route: jetty → island dock (stop) → back out → round the east side → north landing
const ROUTE = [{ x: JET.x, z: 86.5 }, { x: ISL.x - .5, z: ISL.z + 7.2 }, { x: ISL.x + 2, z: ISL.z + 12.5 }, { x: ISL.x + 12.5, z: ISL.z + 3 }, { x: ISL.x + 10, z: ISL.z - 10.5 }, { x: NDOCK.x, z: 19.5 }];

function baseH(x, z) {
  let h = fbm(x * .022 + 2.1, z * .022 + 7.7) * 3.6 + vnoise(x * .1, z * .1) * .3;
  h += 7 * smooth(5, -45, z) * (.5 + .5 * smooth(30, 50, Math.abs(x - pathX(z))));
  const dL = Math.min(sZ(x) - z, z - nZ(x));         // > 0 inside the lake
  h = lerp(h, .35, smooth(-9, -1, dL) * (1 - smooth(-1, 4, dL)));
  h = lerp(h, -3.3, smooth(-.5, 5, dL));
  const di = Math.hypot(x - ISL.x, z - ISL.z); h = lerp(h, .75 - di * .02, smooth(9, 5.5, di));
  const ex = Math.max(0, Math.abs(x - pathX(z) * .4) - 46); h += ex * ex * .07;
  const es = Math.max(0, z - 124); h += es * es * .1;
  return h;
}
const H_START = baseH(START.x, START.z), H_OUT = baseH(OUT.x, OUT.z), H_AR = baseH(AR.x, AR.z) + .5;
function height(x, z) {
  let h = baseH(x, z);
  h = lerp(h, H_START, smooth(12, 6, Math.hypot(x - START.x, z - START.z)));
  h = lerp(h, H_OUT, smooth(16, 11, Math.hypot(x - OUT.x, z - OUT.z)));
  const da = Math.hypot(x - AR.x, z - AR.z); h = lerp(h, H_AR, smooth(20, 15, da)); h += Math.max(0, da - 19) ** 2 * .25 * smooth(AR.z + 25, AR.z + 15, z);
  if (z > 8 && z < 100) { const pd = Math.abs(x - pathX(z)); h -= smooth(2.4, .5, pd) * .1 * (h > 0 ? 1 : 0); } else { const pd = Math.abs(x - pathX(z)); h -= smooth(2.6, .5, pd) * .12; }
  return h;
}
const C = { grass: new THREE.Color(0x4f8f2f), grass2: new THREE.Color(0x86b04a), floor: new THREE.Color(0x3f5226), dirt: new THREE.Color(0x9a6a40), dirt2: new THREE.Color(0x7a5434), sand: new THREE.Color(0xb8a27a), mud: new THREE.Color(0x4a4434), rock: new THREE.Color(0x7d7a72), dry: new THREE.Color(0xa8a050) };
function colour(c, x, z, y, sl) {
  const n = fbm(x * .05, z * .05) * .5 + .5, n2 = vnoise(x * .25, z * .25) * .5 + .5, t = new THREE.Color();
  c.copy(C.grass).lerp(C.grass2, clamp(n * 1.2 - .2, 0, 1));
  c.lerp(C.floor, smooth(30, 10, Math.abs(x - pathX(z))) * .3 * (z > 100 || (z < 8 && z > -60) ? 1 : 0));
  c.lerp(C.dry, smooth(-60, -80, z) * .5);
  const pd = Math.abs(x - pathX(z)); t.copy(C.dirt).lerp(C.dirt2, n2); if (z > 98 || z < 10) c.lerp(t, smooth(2.5, 1.2, pd + n2 * .6) * .9);
  if (y < .9 && y > W.water - .2) c.lerp(C.sand, .7); if (y < W.water + .05) c.lerp(C.mud, smooth(W.water + .05, W.water - 1, y));
  c.lerp(C.rock, smooth(1.2, 2.4, sl)); c.multiplyScalar(.92 + n2 * .16);
}

let L = null;
const level = {
  id: 2, name: 'Periyar Lake', ml: 'പെരിയാർ', region: 'Periyar Tiger Reserve · Idukki', music: 'forest', cages: 3,
  envKeys: [[999, 'morning'], [104, 'morning'], [84, 'lake'], [20, 'lake'], [-12, 'noon'], [-45, 'golden'], [-72, 'sunsetGold']],
  objectiveTarget() { return L?.target?.() ?? null; },
  sniffTarget() { if (!L) return null; if (!L.clue.found) return { x: L.clue.x, z: L.clue.z, clue: true }; return this.objectiveTarget(); },

  build(root) {
    resetCollision(); seed(5151);
    W.height = height; W.water = -.6; W.bounds = { x0: -56, x1: 56, z0: AR.z - 16, z1: 127 };
    W.walkable = (x, z) => !(z < 100 && z > 8 && height(x, z) < W.water - .35);
    L = newRuntime(root, { stage: 0, leg: 0 }); setCP(L, START.x, START.z - 2);
    W.minZ = () => G.stage === 0 ? 98 : G.stage < 5 ? -1e9 : !L.gates.g.open ? GZ + .7 : -1e9;
    W.maxZ = () => L.walled ? WALLZ - .6 : 1e9;
    W.onGate = () => {
      if (L.msgT > 0) return; L.msgT = 5;
      if (G.stage === 0) dialog('Pichu', 'Those poachers are guarding the boat landing. Let\'s deal with them first!', 3);
      else if (G.stage < 5) dialog('Pichu', 'The water is too deep to walk. I\'ll take the bamboo raft at the jetty!', 3);
      else dialog('Pichu', 'A barricade! We must clear the outpost and free all the animals.', 3);
    };
    buildTerrain(root, { w: 120, l: 255, cx: 0, cz: (W.bounds.z0 + 128) / 2, nx: 120, nz: 245, height, colour });
    buildWater(root, { x: 0, z: 54, w: 124, l: 92, y: W.water, repeat: [24, 18] });
    this.plants(root); this.props(root); this.actors(root);
  },

  plants(root) {
    const F = new Flora(), tries = 15000 * Q.trees;
    const clear = (x, z) => Math.hypot(x - START.x, z - START.z) < 9 || Math.hypot(x - OUT.x, z - OUT.z) < 15 || Math.hypot(x - AR.x, z - AR.z) < 19 || Math.hypot(x - NDOCK.x, z - NDOCK.z) < 6 || Math.hypot(x - JET.x, z - JET.z) < 6 || Math.hypot(x - TIG.x, z - TIG.z) < 7 || Math.hypot(x - (TIG.x + pathX(-16)) / 2, z - TIG.z) < 4;
    for (let i = 0; i < tries; i++) {
      const x = sr(-54, 54), z = sr(AR.z - 14, 127), y = height(x, z); if (y < W.water + .6) continue;
      const pd = Math.abs(x - pathX(z)); if (pd < 4 || clear(x, z)) continue; if (Math.abs(z - GZ) < 2 && pd < 7) continue;
      const north = z < 8, grassland = z < -60;
      if (srnd() > (grassland ? .15 : .8)) continue; if (tooClose(x, z, 2.7)) continue;
      const r = srnd();
      if (y < 1.6 && r < .3) F.areca(x, y, z, sr(.8, 1.1));
      else if (r < .55) F.rain(x, y, z, sr(.75, 1.25)); else if (r < .85) F.bamboo(x, y, z, sr(.8, 1.3)); else F.banana(x, y, z, sr(.8, 1.1));
    }
    for (let i = 0; i < 400; i++) { const x = sr(-54, 54), z = sr(AR.z - 14, 126); const y = height(x, z); if (y < W.water + .2 || Math.abs(x - pathX(z)) < 2.8 || clear(x, z)) continue; if (srnd() > .35) continue; F.rock(x, y, z, srnd() < .15 ? sr(.9, 1.6) : sr(.2, .6)); }
    for (let i = 0; i < 1800; i++) { const x = sr(-54, 54), z = sr(AR.z - 10, 126), y = height(x, z); if (y < W.water + .5 || Math.abs(x - pathX(z)) < 2.2 || clear(x, z)) continue; if (srnd() < .8) F.fern(x, y, z, sr(.7, 1.4)); else F.bush(x, y, z, sr(.25, .5)); }
    let gs = 0, tr = 0; while (gs < Q.grass && tr < Q.grass) {
      tr++; const cx = sr(-54, 54), cz = sr(AR.z - 14, 126), n = 8 + (srnd() * 12 | 0);
      for (let k = 0; k < n; k++) { const x = cx + sr(-.8, .8), z = cz + sr(-.8, .8), y = height(x, z); if (y < W.water + .1) continue; const pd = Math.abs(x - pathX(z)); if (pd < 1.2 && srnd() < .85 && (z > 98 || z < 10)) continue; const dry = z < -55; F.grass(x, y, z, (dry ? sr(.4, .8) : sr(.25, .6)) * (pd < 2 ? .6 : 1), dry ? hsl(sr(.13, .19), sr(.4, .55), sr(.38, .48)) : hsl(sr(.22, .29), sr(.45, .62), sr(.26, .38))); gs++; }
    }
    F.flush(root);
  },

  props(root) {
    makeSign(root, START.x - 3.5, START.z + 2, 0, 'പെരിയാർ', 'Periyar Tiger Reserve', '#2f5a2a');
    new Deck(root, JET.x, 91.5, 2.6, 10, 0); new Deck(root, NDOCK.x, 17, 2.6, 6, 0);
    L.raft = new Raft(root, ROUTE, { speed: 3.4 }); L.ticks.push({ tick: (dt, t) => L.raft.update(dt, t) });
    // dead trees in the lake, away from the raft's route
    const segD = (x, z) => { let m = 1e9; for (let i = 0; i < ROUTE.length - 1; i++) { const a = ROUTE[i], b = ROUTE[i + 1], vx = b.x - a.x, vz = b.z - a.z, l2 = vx * vx + vz * vz, k = clamp(((x - a.x) * vx + (z - a.z) * vz) / l2, 0, 1); m = Math.min(m, Math.hypot(x - a.x - vx * k, z - a.z - vz * k)); } return m; };
    for (let i = 0, n = 0; i < 300 && n < 34; i++) { const x = sr(-55, 55), z = sr(22, 88); if (height(x, z) > W.water - 1 || segD(x, z) < 4.5 || Math.hypot(x - ISL.x, z - ISL.z) < 10) continue; deadTree(root, x, z, sr(2.5, 5.5)); n++; }
    // island: cage + crate
    L.cages.push(Object.assign(new Cage(root, ISL.x - 1, ISL.z - 2, 'spotted', 0), { guard: 12 }));
    new Crate(root, ISL.x + 2.5, ISL.z + 1, 'ammo');
    // shore crates
    [[START.x + 4, 112, 'heal'], [START.x - 4, 104, 'ammo'], [NDOCK.x + 4, 8, 'ammo']].forEach(([x, z, l]) => new Crate(root, x, z, l));
    // outpost
    watchtower(root, OUT.x + 9, OUT.z - 5, .4); makeTent(root, OUT.x - 8, OUT.z + 2, .7, 0x6a5a3a); makeTent(root, OUT.x + 4, OUT.z + 8, -.3, 0x4a5a4a);
    L.ticks.push(makeCampfire(root, OUT.x, OUT.z));
    [[3, -6, 'ammo'], [-5, -7, 'heal'], [7, 4, 'ammo'], [-10, -2, 'ammo']].forEach(([dx, dz, l]) => new Crate(root, OUT.x + dx, OUT.z + dz, l));
    L.cages.push(Object.assign(new Cage(root, OUT.x - 6, OUT.z - 5, 'calf', 0), { guard: 21 }));
    L.cages.push(Object.assign(new Cage(root, OUT.x + 6, OUT.z - 8, 'sambar', 0), { guard: 21 }));
    L.gates.g = new Barricade(root, pathX(GZ), GZ, 9, 'logs');
    L.clue = new Clue(root, OUT.x - 1, OUT.z - 12, 'blanket', () => { dialog('Pichu', "Mittu's little blanket! It still smells of her — Honey's tail is wagging like crazy!", 4.5); HN.bark = 1; this.checkOutpost(); this.objective(); }); L.ticks.push(L.clue);
    // arena pillars
    L.pillars = []; for (let i = 0; i < 4; i++) { const a = PI / 4 + i * PI / 2, x = AR.x + Math.sin(a) * 8, z = AR.z + Math.cos(a) * 8; rockPillar(root, x, z, 1.4, 5); L.pillars.push({ x, z, r: 1.4 }); }
    for (let i = 0; i < 26; i++) { const a = i / 26 * TAU; if (Math.cos(a) > .85) continue; const x = AR.x + Math.sin(a) * (AR.r + 2.5), z = AR.z + Math.cos(a) * (AR.r + 2.5); rockPillar(root, x, z, sr(1, 1.6), sr(2, 3.5)); }
    // pods (12)
    [[START.x + 5, 121], [START.x - 7, 110], [JET.x - 3, 101], [ISL.x + 3, ISL.z - 3], [ISL.x - 4, ISL.z + 3], [NDOCK.x - 6, 6], [pathX(-4) + 9, -4], [pathX(-14) - 8, -14], [OUT.x + 12, OUT.z + 4], [OUT.x - 3, OUT.z - 12], [pathX(-64) + 7, -64], [AR.x - 10, AR.z - 6]].forEach(([x, z]) => spawnPickup('pod', x, z, root));
    // wildlife
    for (let i = 0; i < 4; i++) L.ticks.push(hornbillFlyer(root, sr(-20, 20), sr(20, 90), sr(20, 34), sr(12, 20), sr(.05, .09) * (i % 2 ? 1 : -1), sr(0, TAU)));
    [[pathX(110) + 12, 110, 0], [pathX(-8) - 14, -8, 1], [pathX(-66) + 13, -66, 0]].forEach(([x, z, f]) => L.ticks.push(sambar(root, x, z, !!f)));
    // elephant herd crossing the north trail
    const ex = pathX(0); const loop = [{ x: ex - 22, z: 2, wait: 4 }, { x: ex - 4, z: -1 }, { x: ex + 18, z: 3, wait: 5 }, { x: ex + 4, z: 6 }];
    L.elephants = [elephantWalker(root, loop, 1.1, 1.1), elephantWalker(root, loop.map(p => ({ ...p, x: p.x + 2.5, z: p.z + 2.6 })), .55, 1.1), elephantWalker(root, loop.map(p => ({ ...p, x: p.x - 3, z: p.z + 1.5 })), .95, 1.1)];
    L.ticks.push(...L.elephants);
    // the tiger (seen once, on a rock)
    rockPillar(root, TIG.x, TIG.z, 1.6, 1.4); L.tiger = makeQuad({ ...QUADS.tiger, coatTex: tigerTex }); L.tiger.root.position.set(TIG.x, height(TIG.x, TIG.z) + 1.05, TIG.z); L.tiger.root.rotation.y = -PI / 2; L.tiger.root.visible = false; root.add(L.tiger.root);
  },

  actors(root) {
    L.ranger = makeHuman({ skin: 0x8a5a3a, shirt: 0xb8a070, pants: 0x9a8a5a, hat: 'ranger', moustache: false, boot: 0x1a1410 });
    L.ranger.root.position.set(START.x + 2.4, H_START, START.z - 4); root.add(L.ranger.root);
    [[-3, 106, 'grunt'], [3, 104, 'grunt'], [0, 101, 'brute']].forEach(([dx, z, t]) => new Enemy(t, pathX(z) + dx, z, root, { group: 1 }));
    // island guards
    new Enemy('slinger', ISL.x + 2, ISL.z - 3.5, root, { group: 12 }); [[-4, 2], [4, 3]].forEach(([dx, dz]) => new Drone(ISL.x + dx, ISL.z + dz, root, { group: 12 }));
    // outpost
    [[-3, 3, 'grunt'], [4, 1, 'grunt'], [0, -2, 'brute'], [-9, -3, 'slinger'], [10, -1, 'slinger']].forEach(([dx, dz, t]) => new Enemy(t, OUT.x + dx, OUT.z + dz, root, { group: 21 }));
    L.boss = new JeepTrapper(root, AR.x, AR.z - 8, { arena: AR, pillars: L.pillars, yaw: PI });
    L.target = () => {
      if (G.stage === 0) return { x: pathX(104), z: 104 };
      if (G.stage === 1) return L.raft;
      if (G.stage === 2 || G.stage === 4) return null;
      if (G.stage === 3) { const c = L.cages[0]; if (alive(12)) return ISL; if (!c.free) return c; return L.raft; }
      if (G.stage === 5) { if (alive(21) || alive(22)) return OUT; const c = L.cages.find(c => !c.free); if (c) return c; if (!L.clue.found) return L.clue; return { x: pathX(GZ), z: GZ }; }
      if (G.stage === 6) return AR;
      return null;
    };
  },

  start(skipIntro) {
    P.pos.set(START.x, H_START, START.z - 2); P.yaw = PI; placeHoney(START.x + 1.2, START.z - 1.5, PI); G.stage = 0;
    const r = L.ranger.root.position;
    const go = () => { FLOW.startPlay(); showTitle('Level 2', 'Periyar Lake', 'Cross the lake and catch the Jeep Trapper', 'പെരിയാർ'); this.objective(); };
    if (skipIntro) { go(); return; }
    runCine([
      { d: 5, start() { CC.rate = 1.2; CC.pos.set(START.x + 10, H_START + 14, 80); CC.look.set(ISL.x, 0, ISL.z); dialog('Narrator', 'The trail led Pichu and Honey to Periyar — a great lake full of old tree stumps, where elephants come to drink.'); }, update(k) { CC.pos.z = 80 - k * 8; } },
      { d: 5, start() { CC.rate = 2; CC.pos.set(r.x - 2.4, r.y + 1.7, r.z - 2.6); CC.look.set(r.x, r.y + 1.4, r.z); dialog('Ranger Ammini', "The boatmen saw poachers rowing across with a puppy in a basket! Their boss, the Jeep Trapper, hides over there. Take the bamboo raft — and watch out for his drones!"); } },
      { d: 4.2, start() { CC.pos.set(START.x - 1.5, H_START + 1.3, START.z - 4.6); CC.look.set(START.x, H_START + .8, START.z - 2); HN.bark = 1; sfx.bark(0, .4); dialog('Pichu', 'A puppy in a basket — that\'s Mittu! Come on, Honey!'); } },
    ], go);
  },

  objective() {
    const s = G.stage;
    setObjective(
      s === 0 ? `Beat the poachers at the boat landing (${3 - alive(1)}/3)` :
      s === 1 ? 'Walk onto the bamboo raft at the end of the jetty' :
      s === 2 ? 'Drones! Knock them down with your slingshot 🎯 (or hit them when they swoop low)' :
      s === 3 ? (alive(12) ? 'Clear the island and free the trapped deer' : !L.cages[0].free ? 'Free the trapped deer on the island (press E / ✋)' : 'Back on the raft!') :
      s === 4 ? 'Keep the drones off the raft!' :
      s === 5 ? (alive(21) || alive(22) ? `Raid the poacher outpost · animals freed ${G.freed}/3` : G.freed < 3 ? `Free the trapped animals (${G.freed}/3)` : !L.clue.found ? 'Search the outpost for a clue about Mittu (Q / 👃 SNIFF)' : 'The way north is open!') :
      s === 6 ? 'Find the Jeep Trapper in the grassland clearing' : 'Defeat the Jeep Trapper!');
  },

  onEnemyKO(e) {
    if (e.boss) { this.bossDefeated(); return; }
    const g = e.group;
    setTimeout(() => {
      if (g === 1 && !alive(1) && G.stage === 0) { G.stage = 1; sfx.big(); popText('Landing cleared! ⚔️'); setCP(L, JET.x, 99); dialog('Pichu', 'The way to the jetty is clear. All aboard the raft, Honey!', 3.5); }
      if (g === 21 && !alive(21) && !L.wave2) { L.wave2 = true; dialog('Poacher', 'Intruders! Send the drones!', 2.5); [[-6, -12], [6, -14]].forEach(([dx, dz]) => new Drone(OUT.x + dx, OUT.z + dz, L.root, { group: 22, awake: true })); new Enemy('brute', OUT.x, OUT.z - 16, L.root, { group: 22, awake: true }); }
      this.checkOutpost(); this.objective();
    }, 400);
  },
  checkOutpost() {
    if (G.stage === 5 && L.wave2 && !alive(21) && !alive(22) && G.freed >= 3 && L.clue.found && !L.gates.g.open) {
      L.gates.g.openUp(); G.stage = 6; setCP(L, pathX(GZ - 2), GZ - 2); sfx.big(); popText('Outpost cleared! 🏕️');
      dialog('Pichu', 'All the animals are safe! I can hear a jeep engine up ahead…', 4); this.objective();
    }
  },
  action() {
    tryFreeCage(L, c => c.guard === 12 ? alive(12) > 0 : alive(21) > 0 || (!L.wave2) || alive(22) > 0);
    if (G.stage === 3 && L.cages[0].free && !alive(12) && !L.toldBack) { L.toldBack = true; dialog('Pichu', 'The deer is free! Back to the raft!', 2.5); }
    this.checkOutpost(); this.objective();
  },

  startLeg(n) {
    L.leg = n; L.legStart = n === 1 ? 0 : 1; G.stage = n === 1 ? 2 : 4; this.objective();
    if (n === 1) {
      dialog('Pichu', 'We\'re off! Hold on, Honey!', 2.5);
      L.raft.goTo(1, () => { G.stage = 3; L.leg = 0; setCP(L, ISL.x, ISL.z + 5); dialog('Pichu', 'An island! Someone\'s calling for help over there!', 3); wakeGroup(12); this.objective(); });
      setTimeout(() => { if (L.leg === 1) [[-8, 3], [8, 6]].forEach(([dx, dz]) => new Drone(L.raft.x + dx, L.raft.z - 12 + dz, L.root, { group: 11, awake: true })); }, 2500);
    } else {
      dialog('Pichu', 'Next stop — the north shore!', 2.2);
      L.raft.goTo(ROUTE.length - 1, () => { G.stage = 5; L.leg = 0; setCP(L, NDOCK.x, 10); dialog('Pichu', 'Dry land! The poacher outpost must be up this trail.', 3); this.objective(); });
      setTimeout(() => { if (L.leg === 2) [[-9, 0], [9, -2], [0, -6]].forEach(([dx, dz]) => new Drone(L.raft.x + dx, L.raft.z - 10 + dz, L.root, { group: 13, awake: true })); }, 3000);
    }
  },

  tigerScene() {
    L.tigerSeen = true; const tg = L.tiger.root; tg.visible = true; const tp = tg.position.clone();
    runCine([
      { d: 2.8, start() { CC.rate = 2.5; CC.pos.set(tp.x - 5, tp.y + 1.6, tp.z + 2.5); CC.look.set(tp.x, tp.y + .6, tp.z); tg.rotation.y = -PI / 2; sfx.roar(); dialog('Pichu', 'Honey, look! A tiger!', 2.6); }, update(k, dt) { animQuad(L.tiger, dt, 0, 'alert', performance.now() / 1000, { wag: .3 }); } },
      { d: 3.2, start() { dialog('Pichu', 'She\'s beautiful… Kaala wants to trap her too. We have to stop him!', 3.2); }, update(k, dt) { tg.position.x += dt * 2; tg.rotation.y = PI / 2; animQuad(L.tiger, dt, 2, 'walk', performance.now() / 1000, { wag: .2 }); } },
    ], () => { tg.visible = false; FLOW.startPlay(); }, () => { tg.visible = false; });
  },

  startBoss() {
    L.walled = true; P.pos.set(AR.x, W.height(AR.x, AR.z + 5), AR.z + 5); P.yaw = PI; CAM.yaw = 0; G.stage = 7; setCP(L, AR.x, AR.z + 12); this.objective();
    const g = new THREE.Group(); g.position.set(pathX(WALLZ), height(pathX(WALLZ), WALLZ), WALLZ); L.root.add(g);
    for (let i = 0; i < 12; i++) M(jitter(new THREE.DodecahedronGeometry(sr(.9, 1.6), 1), .3), std(0x6a4a30, { flatShading: true }), sr(-6, 6), sr(0, 1.2), sr(-1, 1), g);
    sfx.smash(); G.shake = .4;
    const b = L.boss;
    runCine([
      { d: 3, start() { MUS.mood = 'boss'; CC.rate = 2.5; CC.pos.set(b.x + 6, b.y + 3, b.z + 7); CC.look.set(b.x, b.y + 1.2, b.z); sfx.roar(); dialog('The Jeep Trapper', 'So YOU\'re the kid chasing that puppy? Ha! She\'s long gone!'); } },
      { d: 3.4, start() { CC.pos.set(b.x - 4, b.y + 2, b.z + 5); dialog('The Jeep Trapper', 'Nobody outruns my jeep! VROOM VROOM!'); } },
      { d: 2.8, start() { CC.pos.set(P.pos.x + 2.5, P.pos.y + 1.6, P.pos.z + 3); CC.look.set(P.pos.x, P.pos.y + .9, P.pos.z - 2); dialog('Pichu', 'Honey, let\'s trick him into crashing into those rocks!'); } },
    ], () => { FLOW.startPlay(); b.awake = true; L.bossOn = true; bossBar(b.name, 1); showTitle('Boss', 'The Jeep Trapper', 'Dodge his ram so he crashes into a rock pillar — then strike!'); });
  },
  bossDefeated() {
    L.bossOn = false; for (const e of ENEMIES) if (e.group === 98 && e.alive) e.knockOut?.(0, 1);
    const b = L.boss;
    setTimeout(() => runCine([
      { d: 3.4, start() { MUS.mood = 'forest'; CC.rate = 2.5; CC.pos.set(b.x + 3, b.y + 2, b.z + 4); CC.look.set(b.x, b.y + 1.2, b.z); dialog('The Jeep Trapper', 'My jeep… my traps… you wrecked everything!'); } },
      { d: 3.6, start() { dialog('The Jeep Trapper', 'The Drone Master flew your puppy up to the misty hills of Munnar. Good luck finding her in THAT fog!'); } },
      { d: 1.6, start() { sfx.smash(); emit(TEX.puff, new THREE.Vector3(b.x, b.y + 1, b.z), 40, { color: 0x888888, size: 1.4, speed: 3, g: 0, life: 1.6, spread: 1.2 }); }, end() { b.h.root.visible = false; } },
      { d: 4.5, start() { G.celebrate = true; HN.script = true; HN.mode = 'rear'; HN.speed = 0; HN.wag = 1; CC.pos.set(P.pos.x + 3, P.pos.y + 1.8, P.pos.z + 3.5); CC.look.set(P.pos.x, P.pos.y + .8, P.pos.z); sfx.big(); dialog('Pichu', 'Munnar! We\'re getting closer, Mittu — hold on!'); }, update(k, dt) { if (Math.random() < dt * 8) emit(TEX.heart, new THREE.Vector3(P.pos.x, P.pos.y + 1.2, P.pos.z), 1, { size: .25, speed: 1, g: .3, life: 1.6, spread: .4 }); } },
    ], () => { G.celebrate = false; HN.script = false; G.stage = 8; FLOW.complete(); }, () => { b.h.root.visible = false; G.celebrate = false; HN.script = false; }), 1200);
  },

  onPlayerDown() {
    // knocked out during a raft ride: put the raft back at the start of that leg
    if (L.leg) { const seg = L.legStart, wp = ROUTE[seg]; L.cp.set(wp.x, W.water + .3, wp.z); for (const e of ENEMIES) if ((e.group === 11 || e.group === 13) && e.alive) { e.alive = false; e.dead = true; e.g.removeFromParent(); e.bar.g.visible = false; } }
    const leg = L.leg;
    respawnReset(L, b => b.resetFight(AR));
    if (leg) setTimeout(() => { L.raft.reset(L.legStart); P.pos.set(L.raft.x, L.raft.top, L.raft.z); setTimeout(() => this.startLeg(leg), 1200); }, 950);
  },

  update(dt, t) {
    { const r = L.ranger.root, dx = P.pos.x - r.position.x, dz = P.pos.z - r.position.z; r.rotation.y = Math.atan2(dx, dz); animHuman(L.ranger, dt, 0, 'idle', t); }
    if (!tickCommon(L, dt, t, 'forest')) return;
    if (P.pos.z < 112) wakeGroup(1);
    if (G.stage === 0 && alive(1)) { /* fight */ }
    if (G.stage === 1 && P.plat === L.raft && !L.leg) this.startLeg(1);
    if (G.stage === 3 && P.plat === L.raft && !L.leg && L.cages[0].free && !alive(12)) this.startLeg(2);
    if (G.stage === 3 && P.plat === L.raft && !L.leg && (!L.cages[0].free || alive(12)) && L.msgT <= 0) { L.msgT = 5; dialog('Pichu', 'Wait — the deer on the island still needs help!', 2.5); }
    if (G.stage >= 5 && P.pos.z < -6 && !L.tigerSeen) this.tigerScene();
    if (P.pos.z < -18) wakeGroup(21);
    if (!L.walled && G.stage === 6 && P.pos.z < WALLZ - 1.5) this.startBoss();
    if (L.bossOn) { const dx = P.pos.x - AR.x, dz = P.pos.z - AR.z, d = Math.hypot(dx, dz); if (d > AR.r - .5) { P.pos.x = AR.x + dx / d * (AR.r - .5); P.pos.z = AR.z + dz / d * (AR.r - .5); } }
    if (G.stage <= 6) this.objective();
    if (AU.ctx) { const lake = z => z > 10 && z < 98; AU.water.g.gain.value += ((lake(P.pos.z) ? .14 : Math.max(0, .14 - Math.min(Math.abs(P.pos.z - 95), Math.abs(P.pos.z - 14)) / 60)) - AU.water.g.gain.value) * Math.min(1, dt * 2); AU.wind.g.gain.value = .03 + Math.sin(t * .2) * .01; }
    ambientBirds(dt);
  },
  dispose() { L = null; },
};
export default level;
