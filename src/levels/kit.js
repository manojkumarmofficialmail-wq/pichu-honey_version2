// Shared helpers for levels: per-frame housekeeping, animal cages, battle music, respawn resets and gates.
import { THREE } from '../core/engine.js';
import { G, P, W } from '../core/state.js';
import { MOBILE, pick, rand, clamp } from '../core/utils.js';
import { sfx, AU, MUS } from '../core/audio.js';
import { dialog, setPrompt, popText, hud, bossBar } from '../core/ui.js';
import { FLOW } from '../core/flow.js';
import { ENEMIES, clearProjectiles } from '../combat/combat.js';
import { groupAlive } from '../combat/enemies.js';
import { resetDroneTokens } from '../combat/drone.js';

export function newRuntime(root, extra = {}) {
  W.platforms = []; W.ladders = []; W.onClimbTop = null; W.maxZ = null; resetDroneTokens();
  return Object.assign({ root, ticks: [], cages: [], gates: {}, cp: new THREE.Vector3(), msgT: 0, bossOn: false, boss: null, walled: false }, extra);
}
export const near = (a, r) => Math.hypot(P.pos.x - a.x, P.pos.z - a.z) < r;
export function nearCage(L) { for (const c of L.cages) if (!c.free && near(c, 2.8)) return c; return null; }
// try to free the closest cage; busy(c) says whether its guards are still around
export function tryFreeCage(L, busy) {
  const c = nearCage(L); if (!c) return false;
  if (busy(c)) { dialog('Pichu', 'The poachers are still watching! I have to beat them first.', 2.5); return true; }
  c.open(); hud();
  popText({ squirrel: '🐿️ Giant squirrel freed!', tahr: '🐐 Nilgiri tahr freed!', calf: '🐘 Baby elephant freed!', macaque: '🐒 Lion-tailed macaque freed!' }[c.kind] || '🦌 Deer freed!');
  dialog('Pichu', pick(["Run, little one! You're free!", 'Go home to your family!', 'Nobody will trap you again!']), 2.5);
  return true;
}
export function setCP(L, x, z) { L.cp.set(x, W.height(x, z), z); }
// every frame: ticks, cages, gates, battle music, prompts
export function tickCommon(L, dt, t, calmMood) {
  L.msgT -= dt;
  for (const k of L.ticks) k.tick(dt, t);
  for (const c of L.cages) c.update(dt, t);
  for (const k in L.gates) L.gates[k].update(dt);
  if (G.mode !== 'play' || G.busy) return false;
  if (!L.bossOn) { let fighting = false; for (const e of ENEMIES) if (e.alive && e.awake && !e.prop && Math.hypot(e.x - P.pos.x, e.z - P.pos.z) < 16) { fighting = true; break; } MUS.mood = fighting ? 'battle' : calmMood; }
  const c = nearCage(L); setPrompt(c ? (MOBILE ? 'Tap ✋ to free the animal' : 'Press E to free the animal') : '');
  return true;
}
export function ambientBirds(dt, kinds = ['chirp', 'koel']) {
  if (!AU.ctx) return; AU.ambT -= dt;
  if (AU.ambT < 0) { AU.ambT = rand(.6, 2.4); sfx[pick(kinds)](rand(-.9, .9)); }
}
// after Pichu is knocked out: move him to the checkpoint and reset nearby fights
export function respawnReset(L, onBoss) {
  FLOW.respawn(L.cp, () => {
    clearProjectiles();
    for (const e of ENEMIES) {
      if (e.prop || !e.alive) continue;
      if (e.group === 98) { e.alive = false; e.dead = true; (e.h?.root || e.g).visible = false; e.bar && (e.bar.g.visible = false); continue; }
      if (e.boss) { onBoss && onBoss(e); if (L.bossOn) bossBar(e.name, e.hp / e.maxHp); continue; }
      if (e.flying !== undefined) { e.x = e.hx; e.z = e.hz; e.hp = e.maxHp; e.setState('idle'); e.curAlt = e.alt; e.bar.g.visible = false; continue; }
      e.x = e.hx; e.z = e.hz; e.hp = e.maxHp; e.setState('idle'); e.bar.g.visible = false;
    }
    dialog('Narrator', pick(['Pichu dusted himself off. Watch for the red glow, then dodge!', 'Ouch! Try again — use Honey\'s bark when they surround you.', 'Heroes never give up! Remember: dodge, then strike back.']), 4);
  });
}
export const alive = groupAlive;
