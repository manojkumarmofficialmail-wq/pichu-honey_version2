// Things Pichu can pick up: pebble pouches (slingshot ammo), bananas (health) and cardamom pods (collectibles).
import { THREE, M, S, C, std, TEX } from '../core/engine.js';
import { G, P, W } from '../core/state.js';
import { PI, rand } from '../core/utils.js';
import { sfx } from '../core/audio.js';
import { emit } from './particles.js';
import { hud, popText, dialog } from '../core/ui.js';
import { healPlayer } from '../combat/combat.js';
import { upg } from '../core/upgrades.js';

const PICK = [];
function model(type) {
  const g = new THREE.Group();
  if (type === 'pod') {
    // green cardamom pod with a golden glow
    M(S(.09, 10, 8), std(0x7fae3a, { roughness: .5, emissive: 0x2a4a10, emissiveIntensity: .5 }), 0, 0, 0, g).scale.set(.75, .75, 1.4);
    M(new THREE.ConeGeometry(.02, .06, 5), std(0x6a8a2a), 0, 0, .14, g).rotation.x = PI / 2;
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xc8ff6a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .6 })); gl.scale.setScalar(.8); g.add(gl);
  } else if (type === 'heal') {
    const bm = std(0xf5d23a, { roughness: .5 }); for (let i = 0; i < 3; i++) { const b = M(C(.035, .16, 3, 6), bm, (i - 1) * .05, 0, 0, g); b.rotation.z = (i - 1) * .3 + .2; }
    M(C(.02, .04, 2, 5), std(0x5a4a20), .0, .12, 0, g);
  } else {
    M(S(.12, 8, 6), std(0x8a6a44, { roughness: .9 }), 0, 0, 0, g).scale.set(1, .8, 1);
    for (let i = 0; i < 3; i++) M(S(.04, 6, 5), std(0xbab2a4), (i - 1) * .05, .09, .02, g);
  }
  return g;
}
export function spawnPickup(type, x, z, root, opts = {}) {
  const g = model(type); const base = W.height(x, z); g.position.set(x, base + .55, z); root.add(g);
  const p = { type, x, z, base, g, got: false, vy: opts.pop ? 4 : 0, y: opts.pop ? base + .9 : base + .55, amt: opts.amt };
  if (opts.pop) { p.vx = rand(-1.5, 1.5); p.vz = rand(-1.5, 1.5); }
  PICK.push(p); if (type === 'pod') G.podsTotal++; return p;
}
export function clearPickups() { PICK.length = 0; }
export function updatePickups(dt, t) {
  for (const p of PICK) {
    if (p.got) continue;
    if (p.vx !== undefined) { p.x += p.vx * dt; p.z += p.vz * dt; p.vx *= Math.exp(-3 * dt); p.vz *= Math.exp(-3 * dt); p.base = W.height(p.x, p.z); }
    if (p.vy || p.y > p.base + .56) { p.vy -= 14 * dt; p.y += p.vy * dt; if (p.y < p.base + .4) { p.y = p.base + .4; p.vy = 0; } }
    else p.y = p.base + .5 + Math.sin(t * 2.5 + p.x) * .1;
    p.g.position.set(p.x, p.y, p.z); p.g.rotation.y += dt * 2;
    const dx = P.pos.x - p.x, dz = P.pos.z - p.z, d = Math.hypot(dx, dz);
    if (G.mode !== 'play') continue;
    if (d < 2.2 && d > .3 && p.type !== 'pod') { p.x += dx / d * dt * 6; p.z += dz / d * dt * 6; } // magnet
    if (d < 1.1 && Math.abs(P.pos.y + .5 - p.y) < 1.3) collect(p);
  }
}
function collect(p) {
  p.got = true; p.g.visible = false;
  if (p.type === 'pod') {
    G.pods++; sfx.collect(); popText(`🌿 ${G.pods}/${G.podsTotal}`, 'rgba(180,255,120,.9)');
    emit(TEX.spark, p.g.position, 14, { add: true, color: 0xc8ff6a, size: .3, speed: 2.2, g: -1, life: .8 });
    if (G.pods === 1) dialog('Pichu', 'A cardamom pod! Kerala spices — the ranger said to collect them all. 🌿', 3);
  } else if (p.type === 'heal') { healPlayer(p.amt ?? 20); sfx.collect(); }
  else { P.ammo = Math.min(upg.ammoCap(), P.ammo + (p.amt ?? 4)); sfx.collect(); popText(`🪨 +${p.amt ?? 4} pebbles`); }
  hud();
}
