// Pichu & Honey 2 — Kerala Forest Quest. Boot, menu, level loading, main loop and camera.
import { THREE, scene, camera, renderer, render, onResize, FX, TIME, newLevelRoot } from './core/engine.js';
import { $, PI, clamp, lerp, damp, angDamp, smooth, MOBILE, Q, DIFFS, DV, SET, setDiff, store, buzz, fmtTime, params } from './core/utils.js';
import { G, P, CAM, CC, K, JOY, DRAG, W } from './core/state.js';
import { AU, auInit, setMuted, musicTick, MUS, sfx } from './core/audio.js';
import { UI, dialog, hideDialog, tickDialog, hud, hudTimer, setPrompt, fade, bossBar, popText } from './core/ui.js';
import { initInput } from './core/input.js';
import { updateCine, skipCine, cineActive } from './core/cine.js';
import { FLOW } from './core/flow.js';
import { updateSky, envForZ, CUR, waterMats } from './world/sky.js';
import { nearOb } from './world/terrain.js';
import { updParts, clearParts } from './world/particles.js';
import { updatePickups, clearPickups } from './world/pickups.js';
import { pichu, animPichu } from './actors/pichu.js';
import { honey, HN, updateHoney, doBark, placeHoney } from './actors/honey.js';
import { ENEMIES, HOOKS, updatePlayer, doLight, doHeavyStart, doHeavyRelease, doDodge, doSling, doJump, clearProjectiles } from './combat/combat.js';
import { updateEnemies, resetTokens } from './combat/enemies.js';
import { LEVELS } from './levels/index.js';
import { UPG, UPG_DEF, BANK, upg, buy, nextCost, depositPods } from './core/upgrades.js';
import { resetDroneTokens } from './combat/drone.js';
import { doSniff, updateSniff, resetStory } from './world/story.js';
import { updateWeather, resetWeather } from './world/weather.js';

window.__gameLoaded = true;
let LV = null;          // current level module
let menuBuilt = false;

/* ---------- saves ---------- */
const SAVE = { unlocked: store.get('v2_unlocked', 1), best: store.get('v2_best', {}) };
const saveBest = () => { store.set('v2_unlocked', SAVE.unlocked); store.set('v2_best', SAVE.best); };

/* ---------- level loading ---------- */
async function loadLevel(def, forMenu) {
  const mod = (await def.load()).default;
  if (LV && LV.dispose) LV.dispose();
  ENEMIES.length = 0; resetTokens(); resetDroneTokens(); resetStory(); resetWeather(); clearPickups(); clearParts(); clearProjectiles(); waterMats.length = 0;
  W.platforms = []; W.ladders = []; W.maxZ = null; W.onClimbTop = null; W.walkable = () => true; P.climb = null; P.plat = null;
  Object.assign(G, { stage: 0, time: 0, hits: 0, kos: 0, freed: 0, pods: 0, podsTotal: 0, downs: 0, hitStop: 0, shake: 0, celebrate: false, busy: false });
  P.maxHp = upg.maxHp(DV.hp); P.hp = P.maxHp; P.stamina = 100; P.ammo = upg.startAmmo(); P.act = null; P.invul = 0; P.kb.set(0, 0, 0); P.vy = 0; P.slowT = 0;
  const root = newLevelRoot(); G.level = mod; LV = mod; mod.build(root);
  $('stageLbl').textContent = `Level ${mod.id} · ${mod.name}`;
  HOOKS.onPlayerDown = () => { G.downs++; mod.onPlayerDown(); };
  HOOKS.onEnemyKO = e => mod.onEnemyKO(e);
  bossBar(null); hud();
  return mod;
}
async function startLevel(def, skipIntro) {
  auInit(); $('menu').style.display = 'none'; $('endcard').style.display = 'none'; $('loadScreen').style.display = 'flex';
  $('loadName').textContent = def.name; $('loadMl').textContent = def.ml; $('loadPlace').textContent = def.place;
  if (MOBILE && fsOK) goFS(true);
  await new Promise(r => setTimeout(r, 60));
  const mod = await loadLevel(def);
  $('loadScreen').style.display = 'none'; G.mode = 'cine'; MUS.mood = mod.music;
  mod.start(skipIntro);
}

FLOW.startPlay = () => {
  G.mode = 'play'; CC.active = false; CAM.yaw = P.yaw + PI; CAM.pitch = .32;
  $('hud').style.display = 'block'; $('pauseBtn').style.display = '';
  if (MOBILE) { $('joy').style.display = 'block'; $('abtns').style.display = 'block'; }
  hud();
};
FLOW.respawn = (cp, cb) => {
  G.busy = true; P.act = null; fade(true);
  setTimeout(() => {
    P.climb = null; P.pos.copy(cp); P.vy = 0; P.kb.set(0, 0, 0); P.speed = 0; P.hp = P.maxHp; P.stamina = 100; P.ammo = Math.max(P.ammo, 10); P.invul = 2; P.slowT = 0;
    placeHoney(cp.x + 1, cp.z + 1, P.yaw); CAM.yaw = P.yaw + PI; cb && cb(); hud();
    fade(false); G.busy = false;
  }, 900);
};
FLOW.complete = () => {
  G.mode = 'end'; joyStop(); const def = LEVELS.find(l => l.id === LV.id);
  const podK = G.podsTotal ? G.pods / G.podsTotal : 1, stars = 1 + (podK >= .5 ? 1 : 0) + (podK >= 1 ? 1 : 0);
  const B = [['🌿', 'Spice Hunter', 'all cardamom pods', podK >= 1], ['💪', 'Never Down', 'never knocked out', G.downs === 0], ['🛡️', 'Tough Hero', 'took 6 hits or fewer', G.hits <= 6], ['⚡', 'Speedy', 'under ' + fmtTime(DV.fast), G.time < DV.fast]];
  const got = B.filter(b => b[3]).length, key = 'L' + LV.id + '_' + SET.diff, old = SAVE.best[key];
  const isRec = !old || G.time < old.time;
  SAVE.best[key] = { time: old ? Math.min(old.time, G.time) : G.time, stars: Math.max(stars, old?.stars || 0), badges: Math.max(got, old?.badges || 0) };
  SAVE.unlocked = Math.max(SAVE.unlocked, LV.id + 1); saveBest();
  const gained = depositPods(LV.id, G.pods);
  const next = LEVELS.find(l => l.id === LV.id + 1);
  const fin = !!LV.final;
  $('endInner').innerHTML = `<h1>${fin ? 'The End 🐾' : 'Level Complete!'}</h1>${fin ? '<p class="soon">🏆 <b>You brought Mittu home and saved the forests of Kerala!</b><br>From Agasthyamala to Wayanad — thank you for playing Pichu &amp; Honey 2.</p>' : ''}<h2>${def.icon} ${def.name} · ${DV.icon} ${DV.name}</h2>
   <div class="stars">${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>${isRec && old ? '<div id="newRec">🎉 New best time!</div>' : ''}
   <div class="stats"><div><b>${fmtTime(G.time)}</b><span>Time</span></div><div><b>${G.kos}</b><span>Poachers beaten</span></div><div><b>${G.freed}</b><span>Animals freed</span></div><div><b>${G.pods}/${G.podsTotal}</b><span>Cardamom</span></div></div>
   <div class="badges">${B.map(b => `<span class="badge${b[3] ? ' got' : ''}" title="${b[2]}">${b[0]} ${b[1]}</span>`).join('')}</div>
   ${G.clueIcon ? `<p class="bank">${G.clueIcon} ${G.clue ? (fin ? 'You followed Mittu\'s trail all the way!' : 'Clue found — Mittu\'s trail leads further north!') : 'You missed the clue this time.'}</p>` : ''}
   <p class="bank">🌿 ${gained ? `+${gained} cardamom pods added to your bag! ` : ''}You have <b>${BANK.pods}</b> pods to spend.</p>
   ${next ? (next.load ? `<button class="btn" id="nextBtn">▶ Next: ${next.name}</button>` : `<p class="soon">${next.icon} <b>Next stop: ${next.name}</b> (${next.place}) arrives in the next update!</p>`) : ''}
   <button class="btn sec" id="shopBtn2">🛒 Upgrades</button> <button class="btn sec" id="againBtn">↻ Play Again</button> <button class="btn sec" id="mapBtn">🗺️ Level Map</button>`;
  $('endcard').style.display = 'flex'; ['hud', 'compass', 'joy', 'abtns', 'pauseBtn'].forEach(id => $(id).style.display = 'none'); bossBar(null);
  $('againBtn').onclick = () => startLevel(def, true); $('mapBtn').onclick = () => location.reload(); $('shopBtn2').onclick = openShop;
  if ($('nextBtn')) $('nextBtn').onclick = () => startLevel(next);
  if (got) setTimeout(() => { sfx.big(); buzz([30, 40, 30, 40, 60]); }, 400);
};

/* ---------- upgrade shop ---------- */
function openShop() { renderShop(); $('shop').style.display = 'flex'; }
function renderShop() {
  $('shopBank').textContent = BANK.pods;
  $('shopList').innerHTML = UPG_DEF.map(u => { const lv = UPG[u.id], c = nextCost(u.id); return `<div class="upg"><span class="ic">${u.icon}</span><span class="nm">${u.name}<small>${u.desc}</small><span class="pips">${[0, 1, 2].map(i => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</span></span>${c === null ? '<span class="max">MAX</span>' : `<button class="chip buy" data-u="${u.id}" ${BANK.pods < c ? 'disabled' : ''}>🌿 ${c}</button>`}</div>`; }).join('');
  document.querySelectorAll('#shopList .buy').forEach(b => b.onclick = () => { if (buy(b.dataset.u)) { auInit(); sfx.big(); popText('Upgraded! ⭐'); renderShop(); } });
}
$('shopClose').onclick = () => $('shop').style.display = 'none'; $('shopBtn').onclick = openShop;

/* ---------- menu ---------- */
function buildMenu() {
  const box = $('levelMap'); box.innerHTML = '';
  for (const l of LEVELS) {
    const open = l.load && l.id <= SAVE.unlocked, b = document.createElement('button'); b.className = 'lvl' + (open ? '' : ' locked');
    const best = SAVE.best['L' + l.id + '_' + SET.diff];
    b.innerHTML = `<span class="num">${l.id}</span><span class="ic">${l.icon}</span><span class="nm">${l.name}<small>${l.ml} · ${l.place}</small></span><span class="st">${best ? '⭐'.repeat(best.stars) : open ? 'Play ▶' : l.load ? '🔒' : 'Soon'}</span>`;
    if (open) b.onclick = () => startLevel(l); else b.onclick = () => popText(l.load ? '🔒 Beat the level before!' : `${l.icon} ${l.name} — coming in the next update!`);
    box.appendChild(b);
  }
}
function pickDiff(d) { setDiff(d); document.querySelectorAll('#diffBox button').forEach(b => b.classList.toggle('on', b.dataset.d === d)); buildMenu(); }
document.querySelectorAll('#diffBox button').forEach(b => b.onclick = () => pickDiff(b.dataset.d));

/* ---------- pause / settings ---------- */
const DE = document.documentElement, fsOK = !!(DE.requestFullscreen || DE.webkitRequestFullscreen);
const isFS = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
function goFS(on = !isFS()) { try { if (!on) { if (isFS()) (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; } if (isFS()) return; const p = (DE.requestFullscreen || DE.webkitRequestFullscreen).call(DE, { navigationUI: 'hide' }); if (p && p.then) p.then(() => { try { screen.orientation?.lock?.('landscape').catch(() => { }); } catch (e) { } }).catch(() => { }); } catch (e) { } }
if (MOBILE && fsOK) $('fsBtn').style.display = ''; $('fsBtn').onclick = () => goFS();
function syncChips() {
  $('voiceChip').textContent = '🗣 Story voice: ' + (SET.voice ? 'On' : 'Off'); $('voiceChip').classList.toggle('off', !SET.voice);
  $('pVoice').classList.toggle('off', !SET.voice); $('pMute').textContent = AU.muted ? '🔇 Sound' : '🔊 Sound'; $('pMute').classList.toggle('off', AU.muted); $('muteBtn').textContent = AU.muted ? '🔇' : '🔊';
}
function toggleMute() { setMuted(!AU.muted); syncChips(); }
function toggleVoice() { SET.voice = !SET.voice; store.set('voice', SET.voice); if (!SET.voice && 'speechSynthesis' in window) speechSynthesis.cancel(); syncChips(); }
$('muteBtn').onclick = toggleMute; $('pMute').onclick = toggleMute; $('voiceChip').onclick = toggleVoice; $('pVoice').onclick = toggleVoice;
const HELP_DESK = '<kbd>W A S D</kbd> walk · <kbd>Shift</kbd> run · <kbd>Space</kbd> jump · drag mouse to look<br><kbd>J</kbd> or <b>click</b> — stick attack (press 3× for a combo)<br><kbd>K</kbd> hold &amp; release — power smash<br><kbd>L</kbd> — dodge roll · <kbd>F</kbd> or <b>right-click</b> — slingshot<br><kbd>H</kbd> — Honey BARK (stuns enemies) · <kbd>Q</kbd> — Honey SNIFF (find Mittu&rsquo;s trail)<br><kbd>E</kbd> — free animals / talk<br><kbd>P</kbd> pause · <kbd>M</kbd> sound · <kbd>Esc</kbd> skip scenes';
const HELP_MOB = '👈 Left side: walk (push far to run) · 👉 right side: look · 🤏 pinch: zoom<br>⚔️ Attack (tap 3× for a combo) · 💥 hold for a power smash<br>🌀 Dodge roll · 🎯 Slingshot · ⤒ Jump<br>🐶 Honey BARK stuns enemies · 👃 SNIFF finds Mittu&rsquo;s trail · ✋ free animals';
$('helpTxt').innerHTML = MOBILE ? HELP_MOB : HELP_DESK; $('keysTxt').innerHTML = MOBILE ? '👈 walk · 👉 look · buttons to fight' : HELP_DESK.split('<br>').slice(0, 3).join('<br>');
$('helpBtn').onclick = () => $('help').style.display = 'flex'; $('helpClose').onclick = () => $('help').style.display = 'none'; $('pHelp').onclick = () => $('help').style.display = 'flex';
function togglePause(force) {
  const want = force ?? !G.paused; if (want && !(G.mode === 'play' || G.mode === 'cine')) return; if (want === G.paused) return;
  G.paused = want; $('pause').style.display = want ? 'flex' : 'none';
  if (want) { joyStop(); IN._clearTouches(); for (const k in K) K[k] = false; $('pauseInfo').textContent = `${DV.icon} ${DV.name} · ⏱ ${fmtTime(G.time)} · 🌿 ${G.pods}/${G.podsTotal}`; if ('speechSynthesis' in window) speechSynthesis.cancel(); if (AU.ctx) AU.ctx.suspend(); }
  else { if (AU.ctx) AU.ctx.resume(); last = performance.now(); }
  syncChips();
}
$('pauseBtn').onclick = () => togglePause(); $('resumeBtn').onclick = () => togglePause(false); $('restartBtn').onclick = () => location.reload();
const joyStop = () => IN._joyStop && IN._joyStop();
let rotHidden = false; const checkRot = () => { $('rotHint').style.display = (MOBILE && !rotHidden && innerHeight > innerWidth * 1.1 && G.mode !== 'end') ? 'block' : 'none'; };
$('rotHint').onclick = () => { rotHidden = true; checkRot(); }; checkRot();

/* ---------- input ---------- */
const IN = {
  sniff: () => doSniff(LV?.sniffTarget ? LV.sniffTarget() : LV?.objectiveTarget()),
  light: doLight, heavyStart: doHeavyStart, heavyRelease: doHeavyRelease, dodge: doDodge, sling: doSling, jump: doJump, bark: doBark,
  action: () => { if (G.mode === 'play' && !G.busy && LV?.action) LV.action(); }, pause: f => togglePause(f), mute: toggleMute, skip: skipCine,
};
initInput(IN);
$('skip').onclick = skipCine;

/* ---------- camera ---------- */
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), CCL = CC.lookCur;
function updateCamera(dt, t) {
  if (G.mode === 'menu') { const a = t * .05; CC.pos.set(P.pos.x + Math.sin(a) * 9, P.pos.y + 3.2, P.pos.z + Math.cos(a) * 9); CC.look.set(P.pos.x, P.pos.y + 1, P.pos.z); CC.rate = 2; }
  if (CC.active || G.mode === 'end') { camera.position.lerp(CC.pos, 1 - Math.exp(-dt * CC.rate)); CCL.lerp(CC.look, 1 - Math.exp(-dt * CC.rate)); camera.lookAt(CCL); }
  else {
    const tgt = _v.set(P.pos.x, P.pos.y + 1.0, P.pos.z);
    // auto-follow behind when running and not fighting
    if (!DRAG.on && P.speed > 1.2 && !P.fight && performance.now() - DRAG.last > 1600) CAM.yaw = angDamp(CAM.yaw, Math.atan2(-P.dir.x, -P.dir.z), .55 * (P.speed / 5), dt);
    const dist = CAM.dist + (P.fight ? 1.1 : 0) + (G.level && G.stage === 4 ? 1.5 : 0);
    const cp = Math.cos(CAM.pitch), want = _w.set(tgt.x + Math.sin(CAM.yaw) * cp * dist, tgt.y + Math.sin(CAM.pitch) * dist, tgt.z + Math.cos(CAM.yaw) * cp * dist);
    // pull in when trees block the view
    let lim = 1; for (let i = 1; i <= 8; i++) { const k = i / 8, px = lerp(tgt.x, want.x, k), pz = lerp(tgt.z, want.z, k), py = lerp(tgt.y, want.y, k); if (py - W.height(px, pz) > 9) continue; if (nearOb(px, pz, o => o.fol && (o.x - px) ** 2 + (o.z - pz) ** 2 < (o.fol * .8) ** 2)) { lim = Math.max(.35, (i - 1) / 8); break; } }
    CAM.lim = damp(CAM.lim, lim, lim < CAM.lim ? 14 : 2, dt); want.lerpVectors(tgt, want, CAM.lim);
    const gh = W.height(want.x, want.z) + .45; if (want.y < gh) want.y = gh;
    camera.position.lerp(want, 1 - Math.exp(-dt * 9)); CCL.lerp(tgt, 1 - Math.exp(-dt * 14)); camera.lookAt(CCL);
  }
  if (G.shake > 0) { const s = G.shake * .25; camera.position.x += (Math.random() - .5) * s; camera.position.y += (Math.random() - .5) * s; G.shake = Math.max(0, G.shake - dt * 1.8); }
}
function updateCompass() {
  const tg = G.mode === 'play' && LV ? LV.objectiveTarget() : null; const el = $('compass');
  if (!tg) { el.style.display = 'none'; return; } el.style.display = 'flex';
  const dx = tg.x - P.pos.x, dz = tg.z - P.pos.z; const fx = -Math.sin(CAM.yaw), fz = -Math.cos(CAM.yaw), rx = Math.cos(CAM.yaw), rz = -Math.sin(CAM.yaw);
  $('arrow').style.transform = `rotate(${Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz)}rad)`; $('cdist').textContent = Math.round(Math.hypot(dx, dz)) + ' m';
}

/* ---------- main loop ---------- */
let last = performance.now(), T = 0; const PERF = { t: -3, n: 0, lv: 0 };
const focus = new THREE.Vector3();
function frame(now) {
  requestAnimationFrame(frame); let dt = Math.min((now - last) / 1000, .05); last = now;
  if (G.paused) { render(); return; }
  // hit-stop: freeze the action for a few frames on a solid hit
  let gdt = dt; if (G.hitStop > 0) { G.hitStop -= dt; gdt = dt * .06; }
  T += gdt; TIME.value = T;
  if (G.mode === 'play' && !G.busy) { G.time += dt; hudTimer(); }
  tickDialog(dt); updateCine(dt);
  if (G.mode === 'play') updatePlayer(gdt); else if (W.height) P.pos.y = Math.max(P.pos.y, W.height(P.pos.x, P.pos.z));
  if (G.mode === 'play' || G.mode === 'cine') updateEnemies(gdt, T);
  animPichu(gdt, T); updateHoney(gdt, T);
  if (LV) LV.update(gdt, T);
  updatePickups(gdt, T); updParts(gdt); updateSniff(dt);
  if (G.mode === 'play') { if (Math.random() < dt * 3) hud(); else { $('stFill').style.width = P.stamina + '%'; } updateCompass(); }
  // sky follows how far north Pichu has travelled
  if (LV) { const [a, b, k] = envForZ(LV.envKeys, P.pos.z); focus.copy(P.pos); updateSky(dt, a, b, k, focus); updateWeather(dt, T); }
  for (const m of waterMats) { if (m.normalMap) { m.normalMap.offset.x += dt * .012; m.normalMap.offset.y += dt * .004; } }
  if (AU.ctx) musicTick();
  updateCamera(dt, T);
  PERF.t += dt; PERF.n = PERF.t < 0 ? 0 : PERF.n + 1;
  if (PERF.t > 2.5) { const fps = PERF.n / PERF.t; PERF.t = 0; PERF.n = 0; if (fps < 36 && PERF.lv < 2) { PERF.lv++; if (FX.composer) FX.composer = null; else { renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight); } } }
  render();
}
addEventListener('resize', () => { onResize(); checkRot(); joyStop(); });
addEventListener('orientationchange', () => setTimeout(() => { onResize(); checkRot(); }, 250));
document.addEventListener('visibilitychange', () => { if (document.hidden && (G.mode === 'play' || G.mode === 'cine')) togglePause(true); if (!AU.ctx) return; if (document.hidden) AU.ctx.suspend(); else if (!G.paused) AU.ctx.resume(); });

/* ---------- boot: build level 1 as the menu backdrop ---------- */
(async () => {
  pickDiff(SET.diff); syncChips();
  $('loading').textContent = 'Planting the Kerala forest…';
  await new Promise(r => setTimeout(r, 30));
  await loadLevel(LEVELS[0], true);
  LV.start && (P.pos.set(0, 0, 0));
  // stand Pichu & Honey at the start for the title screen
  LV.start.call({ ...LV, beginTutorial() { } }, true);
  G.mode = 'menu'; $('hud').style.display = 'none'; $('joy').style.display = 'none'; $('abtns').style.display = 'none'; $('pauseBtn').style.display = 'none';
  camera.position.set(P.pos.x + 8, P.pos.y + 4, P.pos.z + 8);
  $('loading').textContent = '🌴 Forest ready!'; $('menuBtns').style.visibility = 'visible';
  requestAnimationFrame(frame);
  const q = +params.get('level'); const lv = LEVELS.find(l => l.id === q && l.load); if (lv) startLevel(lv, params.has('skip'));
})();
$('startBtn').onclick = () => { const lv = LEVELS.filter(l => l.load && l.id <= SAVE.unlocked).pop() || LEVELS[0]; startLevel(lv); };
$('classicBtn').onclick = () => location.href = 'classic.html';

window.__G = { G, P, W, CAM, HN, ENEMIES, LEVELS, startLevel, get LV() { return LV; } };
