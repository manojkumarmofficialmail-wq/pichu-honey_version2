// LEVEL 4 — SILENT VALLEY (Silent Valley National Park, Palakkad)
// The oldest rainforest in Kerala, in a monsoon storm. South → north: park entrance → rainforest
// (angry collared boars) → rope bridge over the Kunthipuzha river → night falls: lion-tailed macaque
// rescue + Mittu's chew toy → firefly path → the Shadow Leopard's den.
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
import { makeSign, makeTent, Crate, Cage, Barricade } from '../world/props.js';
import { Deck, watchtower, macaqueTroop } from '../world/props2.js';
import { WX, addFireflies, thunder } from '../world/weather.js';
import { makeHuman, animHuman } from '../actors/human.js';
import { HN, placeHoney } from '../actors/honey.js';
import { Enemy, wakeGroup } from '../combat/enemies.js';
import { Drone, makeDroneModel } from '../combat/drone.js';
import { WildBoar } from '../combat/beasts.js';
import { ShadowLeopard, purr } from '../combat/bosses3.js';
import { ENEMIES } from '../combat/combat.js';
import { Clue, puppyWhine } from '../world/story.js';
import { newRuntime, tickCommon, tryFreeCage, setCP, respawnReset, alive } from './kit.js';

/* ---------- layout ---------- */
const pathX = z => Math.sin(z * .019 + 2) * 10 + Math.sin(z * .052 + .5) * 3.5;
const riverZ = x => 52 + Math.sin(x * .05) * 3;
const START = { x: pathX(118), z: 118 };
const BR = { x: pathX(52), z: 52 };                // rope bridge
const AR = { x: pathX(-84), z: -84, r: 15 };
const GZ = -26, WALLZ = AR.z + 17;
const ARTREES = [0, 1, 2, 3].map(i => { const a = PI / 4 + i * PI / 2; return { x: AR.x + Math.sin(a) * 9.5, z: AR.z + Math.cos(a) * 9.5, h: 5.2 }; });

function baseH(x, z) {
  let h = fbm(x * .024 + 4.4, z * .024 + 2.2) * 3.6 + vnoise(x * .11, z * .11) * .35;
  h += 4 * smooth(30, -40, z);
  const rd = Math.abs(z - riverZ(x)); h = lerp(h, .3, smooth(14, 7, rd) * .8); h = lerp(h, -2.6, smooth(6, 3.5, rd));
  const ex = Math.max(0, Math.abs(x - pathX(z) * .4) - 42); h += ex * ex * .08;
  const es = Math.max(0, z - 124); h += es * es * .1;
  return h;
}
const H_START = baseH(START.x, START.z), H_AR = baseH(AR.x, AR.z) + .4;
function height(x, z) {
  let h = baseH(x, z);
  h = lerp(h, H_START, smooth(12, 6, Math.hypot(x - START.x, z - START.z)));
  const da = Math.hypot(x - AR.x, z - AR.z); h = lerp(h, H_AR, smooth(18, 13, da)); h += Math.max(0, da - 17) ** 2 * .25 * smooth(AR.z + 23, AR.z + 13, z);
  const pd = Math.abs(x - pathX(z)); h -= smooth(2.4, .5, pd) * .1;
  return h;
}
const C = { floor: new THREE.Color(0x2f4a22), floor2: new THREE.Color(0x3f3a24), moss: new THREE.Color(0x3a6a2a), mud: new THREE.Color(0x4a3424), mud2: new THREE.Color(0x3a2a1c), bank: new THREE.Color(0x5a5038), rock: new THREE.Color(0x5a5a54) };
function colour(c, x, z, y, sl) {
  const n = fbm(x * .05, z * .05) * .5 + .5, n2 = vnoise(x * .25, z * .25) * .5 + .5, t = new THREE.Color();
  c.copy(C.floor).lerp(C.moss, n).lerp(C.floor2, n2 * .3);
  const pd = Math.abs(x - pathX(z)); t.copy(C.mud).lerp(C.mud2, n2); c.lerp(t, smooth(2.4, 1.1, pd + n2 * .5) * .9);
  if (Math.abs(z - riverZ(x)) < 9) c.lerp(C.bank, .6);
  c.lerp(C.rock, smooth(1.1, 2.2, sl)); c.multiplyScalar(.9 + n2 * .14);
}

let L = null;
const level = {
  id: 4, name: 'Silent Valley', ml: 'സൈലന്റ് വാലി', region: 'Silent Valley · Palakkad', music: 'forest', cages: 3,
  envKeys: [[999, 'monsoon'], [62, 'monsoon'], [40, 'rainNight'], [-60, 'rainNight'], [-72, 'night']],
  objectiveTarget() { return L?.target?.() ?? null; },
  sniffTarget() { if (!L) return null; if (!L.clue.found) return { x: L.clue.x, z: L.clue.z, clue: true }; return this.objectiveTarget(); },

  build(root) {
    resetCollision(); seed(7474);
    W.height = height; W.water = -.6; W.bounds = { x0: -54, x1: 54, z0: AR.z - 14, z1: 127 };
    W.walkable = (x, z) => !(Math.abs(z - riverZ(x)) < 7 && height(x, z) < W.water - .35);
    L = newRuntime(root, { stage: 0 }); setCP(L, START.x, START.z - 2);
    W.minZ = () => G.stage < 1 ? 62 : !L.gates.g.open ? GZ + .7 : -1e9;
    W.maxZ = () => L.walled ? WALLZ - .6 : 1e9;
    W.onGate = () => {
      if (L.msgT > 0) return; L.msgT = 5;
      if (G.stage < 1) dialog('Pichu', 'The rope bridge is guarded! Let\'s calm those angry boars first.', 3);
      else dialog('Pichu', 'A barricade! We need to free the macaques and find a clue about Mittu.', 3);
    };
    buildTerrain(root, { w: 112, l: 255, cx: 0, cz: (W.bounds.z0 + 128) / 2, nx: 112, nz: 245, height, colour });
    buildWater(root, { x: 0, z: 52, w: 116, l: 16, y: W.water, repeat: [24, 4] });
    WX.rain = 1; WX.night = 0;
    this.plants(root); this.props(root); this.actors(root);
  },

  plants(root) {
    const F = new Flora(), tries = 17000 * Q.trees;
    const clear = (x, z) => Math.hypot(x - START.x, z - START.z) < 9 || Math.hypot(x - AR.x, z - AR.z) < 17 || Math.abs(z - riverZ(x)) < 7.5;
    L.canopy = [];
    for (let i = 0; i < tries; i++) {
      const x = sr(-52, 52), z = sr(AR.z - 12, 126), y = height(x, z); const pd = Math.abs(x - pathX(z));
      if (pd < 4.2 || clear(x, z) || (Math.abs(z - GZ) < 2 && pd < 7)) continue;
      if (srnd() > .92) continue; if (tooClose(x, z, 2.4)) continue;
      const r = srnd(), s = sr(.9, 1.5);
      if (r < .78) { F.rain(x, y, z, s, hsl(sr(.27, .34), sr(.4, .55), sr(.12, .2))); if (pd < 12 && z < 45 && z > -24 && L.canopy.length < 9 && srnd() < .2) L.canopy.push({ x, z, h: 8.5 * s }); }
      else if (r < .9) F.bamboo(x, y, z, sr(.8, 1.1)); else F.areca(x, y, z, sr(.8, 1));
    }
    for (const t of ARTREES) F.rain(t.x, height(t.x, t.z), t.z, .62, hsl(.3, .45, .15));
    for (let i = 0; i < 3400; i++) { const x = sr(-52, 52), z = sr(AR.z - 10, 124), y = height(x, z); if (Math.abs(x - pathX(z)) < 2 || y < W.water + .3 || Math.hypot(x - AR.x, z - AR.z) < 13) continue; if (srnd() < .85) F.fern(x, y, z, sr(.8, 1.7)); else F.bush(x, y, z, sr(.3, .6)); }
    for (let i = 0; i < 300; i++) { const x = sr(-52, 52), z = sr(AR.z - 10, 124), y = height(x, z); if (Math.abs(x - pathX(z)) < 2.6 || y < W.water + .2) continue; if (srnd() > .4) continue; F.rock(x, y, z, srnd() < .15 ? sr(.8, 1.5) : sr(.2, .5)); }
    let gs = 0, tr = 0; while (gs < Q.grass * .6 && tr < Q.grass) { tr++; const cx = sr(-52, 52), cz = sr(AR.z - 12, 124), n = 6 + (srnd() * 8 | 0); for (let k = 0; k < n; k++) { const x = cx + sr(-.8, .8), z = cz + sr(-.8, .8), y = height(x, z); if (y < W.water + .1 || Math.abs(x - pathX(z)) < 1.4) continue; F.grass(x, y, z, sr(.25, .55), hsl(sr(.25, .31), .45, sr(.18, .28))); gs++; } }
    F.flush(root);
    // glowing mushrooms near the den
    const mg = new THREE.Group(); root.add(mg);
    for (let i = 0; i < 90; i++) { const z = sr(-75, -28), x = pathX(z) + (srnd() < .5 ? -1 : 1) * sr(2.2, 7), y = height(x, z); const col = pick([0x60ffd0, 0xb080ff, 0x60c0ff]); M(CY(.03, .04, .14, 6), std(0xd8d0c0), x, y + .07, z, mg, false); M(new THREE.SphereGeometry(.09, 10, 6, 0, TAU, 0, PI / 2), new THREE.MeshBasicMaterial({ color: col }), x, y + .14, z, mg, false); }
  },

  props(root) {
    // park entrance arch
    const ag = new THREE.Group(); ag.position.set(START.x, H_START, START.z - 6); root.add(ag);
    for (const s of [-1, 1]) { M(CY(.18, .2, 4, 8), std(0x5a3a22), s * 2.4, 2, 0, ag); addOb(START.x + s * 2.4, START.z - 6, .25); }
    const bd = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.1), new THREE.MeshStandardMaterial({ map: signTex('സൈലന്റ് വാലി', 'Silent Valley National Park', '#2f4a2a'), side: THREE.DoubleSide })); bd.position.y = 3.7; ag.add(bd);
    watchtower(root, START.x + 9, START.z - 2, .3);
    // rope bridge over the Kunthipuzha
    new Deck(root, BR.x, BR.z, 2.4, 16, 0);
    const rope = std(0xb8a070, { roughness: 1 });
    for (const s of [-1, 1]) { for (let i = 0; i <= 6; i++) M(CY(.06, .06, 1.4, 5), std(0x5a3a22), BR.x + s * 1.25, W.water + 1.1, BR.z - 8 + i * 16 / 6, root); const r = M(CY(.025, .025, 16, 4), rope, BR.x + s * 1.25, W.water + 1.6, BR.z, root); r.rotation.x = PI / 2; }
    L.gates.g = new Barricade(root, pathX(GZ), GZ, 9, 'logs');
    // moonlight breaking through the clouds over the leopard's den (so the black leopard can be seen)
    const moon = new THREE.SpotLight(0xc8d4ff, 60, 70, .62, .6, 1); moon.position.set(AR.x + 4, H_AR + 34, AR.z + 8); moon.target.position.set(AR.x, H_AR, AR.z); root.add(moon, moon.target);
    const fill = new THREE.PointLight(0x9ab0ff, 6, 26, 1.2); fill.position.set(AR.x, H_AR + 5, AR.z + 4); root.add(fill);
    // poacher camp in the dark forest
    makeTent(root, pathX(14) + 9, 15, -.4, 0x2a3a2a); makeTent(root, pathX(-4) - 9, -3, .6, 0x3a3a2a);
    L.cages.push(Object.assign(new Cage(root, pathX(30) + 6, 30, 'macaque', 0), { guard: 3 }));
    L.cages.push(Object.assign(new Cage(root, pathX(10) - 7, 10, 'macaque', 0), { guard: 4 }));
    L.cages.push(Object.assign(new Cage(root, pathX(-10) + 7, -10, 'macaque', 0), { guard: 5 }));
    L.clue = new Clue(root, pathX(18) - 9, 18, 'toy', () => { puppyWhine(.15); dialog('Pichu', "Mittu's chew toy! It's still wet — she was here only a little while ago! Honey, we're so close!", 5); HN.bark = 1; this.checkGate(); this.objective(); });
    L.ticks.push(L.clue);
    [[START.x + 4, 112, 'ammo'], [pathX(84) - 5, 84, 'heal'], [pathX(58) + 4, 58, 'ammo'], [pathX(36) - 5, 36, 'ammo'], [pathX(4) + 5, 4, 'heal'], [pathX(-16) - 5, -16, 'ammo'], [pathX(-46) + 5, -46, 'heal'], [pathX(-62) - 4, -62, 'ammo']].forEach(([x, z, l]) => new Crate(root, x, z, l));
    [[START.x + 6, 122], [pathX(104) - 9, 104], [pathX(90) + 10, 90], [pathX(70) - 8, 70], [BR.x + 6, 58], [pathX(40) + 9, 40], [pathX(22) + 10, 22], [pathX(0) - 9, 0], [pathX(-18) - 8, -18], [pathX(-40) + 8, -40], [pathX(-56) - 7, -56], [AR.x + 10, AR.z + 5]].forEach(([x, z]) => spawnPickup('pod', x, z, root));
    // fireflies light the path once night falls
    const ff = []; for (let z = 44; z > AR.z + 14; z -= 4.5) ff.push({ x: pathX(z) + (ff.length % 2 ? 2.2 : -2.2), z });
    addFireflies(root, ff);
    L.ticks.push(macaqueTroop(root, L.canopy.length >= 3 ? L.canopy : [{ x: pathX(20) + 7, z: 20, h: 9 }, { x: pathX(10) - 7, z: 8, h: 9 }, { x: pathX(0) + 7, z: 0, h: 9 }]));
  },

  actors(root) {
    L.ranger = makeHuman({ skin: 0x8a5a3a, shirt: 0xb8a070, pants: 0x9a8a5a, hat: 'ranger', moustache: false, boot: 0x1a1410 });
    L.ranger.root.position.set(START.x + 2.4, H_START, START.z - 3); root.add(L.ranger.root);
    [[-3, 100, 'grunt'], [3, 98, 'grunt'], [0, 94, 'slinger']].forEach(([dx, z, t]) => new Enemy(t, pathX(z) + dx, z, root, { group: 1 }));
    [[-4, 76], [4, 72]].forEach(([dx, z]) => new WildBoar(pathX(z) + dx, z, root, { group: 2 }));
    [[-2, 33, 'grunt'], [5, 26, 'slinger']].forEach(([dx, z, t]) => new Enemy(t, pathX(z) + dx, z, root, { group: 3 })); new Drone(pathX(30) + 9, 30, root, { group: 3 });
    [[-4, 13], [4, 7]].forEach(([dx, z]) => new WildBoar(pathX(z) + dx, z, root, { group: 4 })); new Enemy('grunt', pathX(10) - 3, 10, root, { group: 4 });
    [[2, -7, 'brute'], [-6, -13, 'slinger']].forEach(([dx, z, t]) => new Enemy(t, pathX(z) + dx, z, root, { group: 5 }));
    [[-4, -44], [5, -52]].forEach(([dx, z]) => new WildBoar(pathX(z) + dx, z, root, { group: 6 }));
    L.boss = new ShadowLeopard(root, AR.x, AR.z - 6, { arena: AR, trees: ARTREES, yaw: 0 });
    L.target = () => {
      if (G.stage === 0) return alive(1) ? { x: pathX(98), z: 98 } : { x: pathX(74), z: 74 };
      if (G.stage === 1) { for (const [g, c] of [[3, 0], [4, 1], [5, 2]]) { if (alive(g) || !L.cages[c].free) return alive(g) ? L.cages[c] : L.cages[c]; } if (!L.clue.found) return L.clue; return { x: pathX(GZ), z: GZ }; }
      if (G.stage === 2) return AR;
      return null;
    };
  },

  start(skipIntro) {
    P.pos.set(START.x, H_START, START.z - 2); P.yaw = PI; placeHoney(START.x + 1.2, START.z - 1.5, PI); G.stage = 0;
    const r = L.ranger.root.position;
    const go = () => { FLOW.startPlay(); showTitle('Level 4', 'Silent Valley', 'Brave the monsoon and follow Mittu into the oldest rainforest', 'സൈലന്റ് വാലി'); this.objective(); };
    if (skipIntro) { go(); return; }
    runCine([
      { d: 5, start() { CC.rate = 1.2; CC.pos.set(START.x - 10, H_START + 9, 108); CC.look.set(START.x, H_START + 2, 80); thunder(.3, 1.2); WX.flash = 1; dialog('Narrator', 'Silent Valley — the oldest rainforest in Kerala. So quiet that not even the cicadas sing… except tonight, there is a storm.'); }, update(k) { CC.pos.x = START.x - 10 + k * 8; } },
      { d: 5.2, start() { CC.rate = 2; CC.pos.set(r.x - 2.4, r.y + 1.7, r.z - 2.6); CC.look.set(r.x, r.y + 1.4, r.z); dialog('Ranger Ammini', "Kaala's men brought a puppy through here last night! And look — they've put glowing anger collars on the wild boars. Don't hurt them, Pichu. Just break the collars and they'll calm down."); } },
      { d: 3.8, start() { CC.pos.set(START.x - 1.5, H_START + 1.3, START.z - 4.6); CC.look.set(START.x, H_START + .8, START.z - 2); HN.bark = 1; sfx.bark(0, .4); dialog('Pichu', 'We\'re not scared of a little rain, are we, Honey? Mittu, we\'re coming!'); } },
    ], go);
  },

  objective() {
    const s = G.stage;
    setObjective(
      s === 0 ? (alive(1) ? `Stop the poachers at the entrance (${3 - alive(1)}/3)` : alive(2) ? 'Calm the angry boars — break their glowing collars 💚' : 'Cross the rope bridge over the river') :
      s === 1 ? (G.freed < 3 || alive(3) || alive(4) || alive(5) ? `Free the lion-tailed macaques in the dark forest (${G.freed}/3)` : !L.clue.found ? 'Search for a clue about Mittu (Q / 👃 SNIFF)' : 'Follow the fireflies north') :
      s === 2 ? 'Follow the fireflies to the leopard\'s den 🌙' : 'Calm the Shadow Leopard — break its collar!');
  },

  onEnemyKO(e) {
    if (e.boss) { this.bossDefeated(); return; }
    setTimeout(() => {
      if (G.stage === 0 && !alive(1) && !alive(2)) { G.stage = 1; setCP(L, BR.x, BR.z + 9); sfx.big(); popText('Path cleared! 🌧️'); dialog('Pichu', 'The boars are calm again. Over the bridge, Honey — the sun is going down…', 3.5); }
      this.checkGate(); this.objective();
    }, 400);
  },
  checkGate() {
    if (G.stage === 1 && G.freed >= 3 && L.clue.found && !alive(3) && !alive(4) && !alive(5) && !L.gates.g.open) {
      L.gates.g.openUp(); G.stage = 2; setCP(L, pathX(GZ - 2), GZ - 2); sfx.big(); popText('Macaques saved! 🐒');
      dialog('Pichu', 'The fireflies are showing us the way… something big is growling up ahead.', 4); this.objective();
    }
  },
  action() { tryFreeCage(L, c => alive(c.guard) > 0); this.checkGate(); this.objective(); },

  startBoss() {
    L.walled = true; P.pos.set(AR.x, W.height(AR.x, AR.z + 5), AR.z + 5); P.yaw = PI; CAM.yaw = 0; G.stage = 3; setCP(L, AR.x, AR.z + 11); this.objective();
    const g = new THREE.Group(); g.position.set(pathX(WALLZ), height(pathX(WALLZ), WALLZ), WALLZ); L.root.add(g);
    for (let i = 0; i < 12; i++) M(jitter(new THREE.DodecahedronGeometry(sr(.9, 1.6), 1), .3), std(0x4a4a44, { flatShading: true }), sr(-6, 6), sr(0, 1.2), sr(-1, 1), g);
    const b = L.boss;
    runCine([
      { d: 3.4, start() { MUS.mood = 'boss'; CC.rate = 2.5; CC.pos.set(b.x + 4, b.y + 2, b.z + 6); CC.look.set(b.x, b.y + .8, b.z); thunder(0, 1.3); WX.flash = 1; dialog('Pichu', 'A black leopard… with one of Kaala\'s angry collars!'); } },
      { d: 3.2, start() { sfx.roar(); CC.pos.set(b.x - 3, b.y + 1.2, b.z + 3.5); dialog('Pichu', 'It\'s not bad — it\'s scared and angry. Let\'s break that collar, Honey!'); } },
    ], () => { FLOW.startPlay(); b.awake = true; L.bossOn = true; bossBar(b.name, 1); showTitle('Boss', 'The Shadow Leopard', 'If it vanishes into the rain, BARK to find it. Dodge the red circle!'); });
  },
  bossDefeated() {
    L.bossOn = false; const b = L.boss;
    const drone = makeDroneModel(new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: .5 }), 1.4); L.root.add(drone.g); drone.g.visible = false;
    setTimeout(() => runCine([
      { d: 3.6, start() { MUS.mood = 'forest'; CC.rate = 2.5; CC.pos.set(b.x + 3, b.y + 1.6, b.z + 3.5); CC.look.set(b.x, b.y + .7, b.z); purr(); dialog('Pichu', 'The collar broke! Listen, Honey — it\'s purring. You\'re free now, big cat.'); } },
      { d: 4.6, start() { drone.g.visible = true; drone.g.position.set(b.x + 2, b.y + 4, b.z - 2); CC.look.set(b.x + 2, b.y + 3.5, b.z - 2); dialog('Kaala (speaker)', "Hmph. Impressive, boy. But your precious puppy is already on a boat, floating down the river to my sawmill in Nilambur."); }, update(k, dt) { drone.rotors.forEach(r => r.rotation.y += dt * 40); } },
      { d: 3.4, start() { dialog('Kaala (speaker)', 'Come and get her… if you dare. Ha ha ha!'); }, update(k, dt) { drone.rotors.forEach(r => r.rotation.y += dt * 40); drone.g.position.y += dt * 4; drone.g.position.z -= dt * 6; }, end() { drone.g.visible = false; } },
      { d: 4.5, start() { G.celebrate = true; HN.script = true; HN.mode = 'rear'; HN.speed = 0; HN.wag = 1; CC.pos.set(P.pos.x + 3, P.pos.y + 1.8, P.pos.z + 3.5); CC.look.set(P.pos.x, P.pos.y + .8, P.pos.z); sfx.big(); dialog('Pichu', 'Nilambur! We\'ll follow that river all the way. Hold on, Mittu!'); }, update(k, dt) { b.q.root.position.z -= dt * 2; if (Math.random() < dt * 8) emit(TEX.heart, new THREE.Vector3(P.pos.x, P.pos.y + 1.2, P.pos.z), 1, { size: .25, speed: 1, g: .3, life: 1.6, spread: .4 }); } },
    ], () => { G.celebrate = false; HN.script = false; G.stage = 4; b.q.root.visible = false; FLOW.complete(); }, () => { drone.g.visible = false; b.q.root.visible = false; G.celebrate = false; HN.script = false; }), 1500);
  },
  onPlayerDown() { respawnReset(L, b => b.resetFight(AR)); },

  update(dt, t) {
    { const r = L.ranger.root, dx = P.pos.x - r.position.x, dz = P.pos.z - r.position.z; r.rotation.y = Math.atan2(dx, dz); animHuman(L.ranger, dt, 0, 'idle', t); }
    WX.night = smooth(48, 34, P.pos.z); WX.rain = 1 - smooth(-60, -76, P.pos.z) * .4;
    if (!tickCommon(L, dt, t, 'forest')) return;
    if (P.pos.z < 108) wakeGroup(1);
    if (P.pos.z < 86) { wakeGroup(2); if (!L.boarTip) { L.boarTip = true; dialog('Ranger Ammini (radio)', MOBILE ? 'Careful! When a boar scrapes its feet and a red line appears, tap 🌀 to roll aside — then hit it while it\'s dizzy!' : 'Careful! When a boar scrapes its feet and a red line appears, press L to roll aside — then hit it while it\'s dizzy!', 6); } }
    if (P.pos.z < 40) wakeGroup(3); if (P.pos.z < 20) wakeGroup(4); if (P.pos.z < 2) wakeGroup(5); if (P.pos.z < -34) wakeGroup(6);
    if (!L.nightMsg && P.pos.z < 40) { L.nightMsg = true; dialog('Pichu', 'It\'s getting dark… good thing I have my lantern! 🏮', 3); }
    if (!L.walled && G.stage === 2 && P.pos.z < WALLZ - 1.5) this.startBoss();
    if (L.bossOn) { const dx = P.pos.x - AR.x, dz = P.pos.z - AR.z, d = Math.hypot(dx, dz); if (d > AR.r - .5) { P.pos.x = AR.x + dx / d * (AR.r - .5); P.pos.z = AR.z + dz / d * (AR.r - .5); } }
    this.objective();
    if (AU.ctx) { const rd = Math.abs(P.pos.z - riverZ(P.pos.x)); AU.water.g.gain.value += (clamp(1 - rd / 30, 0, 1) * .15 - AU.water.g.gain.value) * Math.min(1, dt * 2); AU.wind.g.gain.value = .05 + Math.sin(t * .2) * .02; }
  },
  dispose() { L = null; },
};
export default level;
