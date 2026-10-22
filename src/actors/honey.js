// Honey: follows Pichu, bites nearby poachers, and on command (H) barks to stun every enemy around her.
import { THREE, M, std, scene, TEX } from '../core/engine.js';
import { G, P, W } from '../core/state.js';
import { PI, clamp, damp, angDamp, rand, buzz } from '../core/utils.js';
import { sfx, panOf } from '../core/audio.js';
import { makeQuad, animQuad, QUADS } from './quad.js';
import { collide } from '../world/terrain.js';
import { ring, emit } from '../world/particles.js';
import { ENEMIES, setBarkPose } from '../combat/combat.js';
import { cooldownUI, dialog } from '../core/ui.js';

export const honey = makeQuad(QUADS.honey);
{ // red collar with heart tag (she got it back at the end of v1!)
  const col = M(new THREE.TorusGeometry(.105, .022, 8, 20), std(0xd62b2b, { roughness: .5 }), 0, .07, 0, honey.neck); col.rotation.x = PI / 2;
  const hs = new THREE.Shape(); hs.moveTo(0, -.03); hs.bezierCurveTo(-.04, 0, -.03, .03, 0, .015); hs.bezierCurveTo(.03, .03, .04, 0, 0, -.03);
  M(new THREE.ExtrudeGeometry(hs, { depth: .008, bevelEnabled: false }), std(0x6fb7ff, { metalness: .6, roughness: .3 }), 0, .02, .12, honey.neck);
}
scene.add(honey.root);
export const HN = { pos: new THREE.Vector3(), yaw: 0, speed: 0, mode: 'sit', wag: .8, headYaw: 0, bark: 0, pant: true, biteCD: 0, barkCD: 0, target: null, lunge: 0, script: false };
import { upg } from '../core/upgrades.js';

export function placeHoney(x, z, yaw = 0) { HN.pos.set(x, W.height(x, z), z); HN.yaw = yaw; HN.target = null; HN.speed = 0; }

export function doBark() {
  if (G.mode !== 'play' || G.busy || G.paused) return;
  if (HN.barkCD > 0) { return; }
  HN.barkCD = upg.barkCD(); HN.bark = 1; setBarkPose(); sfx.bigBark(); buzz([30, 30, 60]); G.shake = Math.max(G.shake, .2);
  ring(HN.pos, 13, 0xffd36a, .6); ring(HN.pos, 9, 0xffffff, .45);
  let n = 0;
  for (const e of ENEMIES) { if (!e.alive || e.friendly || e.prop) continue; const d = Math.hypot(e.x - HN.pos.x, e.z - HN.pos.z); if (d < upg.barkR()) { e.stunFor(e.boss ? 1.2 : 2.4); n++; } }
  if (n >= 2) dialog('Pichu', 'Good girl, Honey! They\'re dizzy! Get them!', 2);
}

export function updateHoney(dt, t) {
  HN.bark -= dt * 1.6; HN.biteCD -= dt; HN.barkCD -= dt; HN.lunge -= dt;
  cooldownUI('bBark', HN.barkCD / upg.barkCD());
  // riding the raft with Pichu: sit on the raft
  if (!HN.script && P.plat && P.plat.seat) { const s = P.plat.seat(); HN.pos.copy(s); HN.yaw = P.plat.yaw ?? HN.yaw; HN.speed = 0; HN.mode = 'sit'; HN.onRaft = true; }
  else if (!HN.script && G.mode === 'play') {
    if (HN.onRaft) { HN.onRaft = false; }
    // Pichu climbed a cliff or jumped off somewhere Honey cannot follow: hop up next to him
    if (P.ground && !P.climb && !P.plat && Math.abs(HN.pos.y - P.pos.y) > 2.2) placeHoney(P.pos.x - Math.sin(P.yaw) * 1.2, P.pos.z - Math.cos(P.yaw) * 1.2, P.yaw);
    // pick a target: the awake enemy closest to Pichu
    let tgt = null, bd = 9;
    for (const e of ENEMIES) { if (!e.alive || e.friendly || e.prop || e.flying || !e.awake) continue; const d = Math.hypot(e.x - P.pos.x, e.z - P.pos.z); if (d < bd) { bd = d; tgt = e; } }
    HN.target = tgt;
    let tx, tz, sp;
    if (tgt) {
      const dx = tgt.x - HN.pos.x, dz = tgt.z - HN.pos.z, d = Math.hypot(dx, dz);
      tx = tgt.x - dx / (d || 1) * (tgt.radius + .45); tz = tgt.z - dz / (d || 1) * (tgt.radius + .45); sp = d > 1.2 ? 7 : 0;
      HN.mode = 'walk';
      if (d < tgt.radius + .9 && HN.biteCD <= 0) {
        HN.biteCD = rand(1.2, 1.7); HN.bark = .6; HN.lunge = .2; sfx.bark(panOf(HN.pos.x, HN.pos.z), .25);
        tgt.hit(5, dx / (d || 1), dz / (d || 1), { kb: 1, ranged: true, honey: true });
      }
      if (d < 2) HN.yaw = angDamp(HN.yaw, Math.atan2(dx, dz), 12, dt);
    } else {
      // follow behind Pichu
      const bx = P.pos.x - Math.sin(P.yaw) * 1.4 + Math.cos(P.yaw) * .9, bz = P.pos.z - Math.cos(P.yaw) * 1.4 - Math.sin(P.yaw) * .9;
      const d = Math.hypot(bx - HN.pos.x, bz - HN.pos.z); tx = bx; tz = bz;
      sp = d > 6 ? 8 : d > 1.2 ? Math.max(P.speed * 1.1, 2.6) : 0;
      if (d > 30) { placeHoney(bx, bz, P.yaw); }
    }
    const dx = tx - HN.pos.x, dz = tz - HN.pos.z, l = Math.hypot(dx, dz);
    HN.speed = damp(HN.speed, l > .3 ? sp : 0, 6, dt);
    if (l > .3 && HN.speed > .3) HN.yaw = angDamp(HN.yaw, Math.atan2(dx, dz), 9, dt);
    const np = { x: HN.pos.x + Math.sin(HN.yaw) * HN.speed * dt, z: HN.pos.z + Math.cos(HN.yaw) * HN.speed * dt };
    if (HN.lunge > 0) { np.x += Math.sin(HN.yaw) * 4 * dt; np.z += Math.cos(HN.yaw) * 4 * dt; }
    collide(np, .25);
    if (W.walkable(np.x, np.z)) { HN.pos.x = np.x; HN.pos.z = np.z; }
    HN.pos.y = W.height(HN.pos.x, HN.pos.z);
    HN.mode = HN.speed > .3 ? 'walk' : tgt ? 'crouch' : (P.speed < .2 ? 'sit' : 'alert');
    if ((HN.sniffT || 0) > 0) { HN.sniffT -= dt; if (HN.speed < 1) HN.mode = 'sniff'; }
    HN.wag = tgt ? .05 : .7; HN.pant = !tgt;
  }
  honey.root.position.copy(HN.pos); honey.root.rotation.y = HN.yaw;
  animQuad(honey, dt, HN.speed, HN.mode, t, { wag: HN.wag, headYaw: HN.headYaw, bark: HN.bark, pant: HN.pant, leap: HN.speed > 5 });
  honey.tongue.visible = HN.pant;
}
