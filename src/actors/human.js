// Grown-up characters (poachers, the forest ranger, the boss) built from simple shapes.
import { THREE, M, S, C, B, std } from '../core/engine.js';
import { PI, TAU, damp, clamp, smooth } from '../core/utils.js';

const dr = (o, ax, v, dt, k = 12) => { o.rotation[ax] = damp(o.rotation[ax], v, k, dt); };

export function makeHuman(o = {}) {
  const sc = o.scale ?? 1;
  const skin = std(o.skin ?? 0x9a6a48, { roughness: .7 }), shirt = std(o.shirt ?? 0x6b6a3a, { roughness: .9 }), pants = std(o.pants ?? 0x2f3a2a, { roughness: .9 }),
    boot = std(o.boot ?? 0x2a1d14, { roughness: .6 }), hair = std(o.hair ?? 0x161010, { roughness: .6 }), dark = std(0x0a0a0a, { roughness: .2 });
  const root = new THREE.Group(), spin = new THREE.Group(); root.add(spin); root.scale.setScalar(sc);
  const hips = new THREE.Group(); hips.position.y = .82; spin.add(hips); const J = { spin, hips };
  M(S(.17, 12, 10), pants, 0, 0, 0, hips).scale.set(1.1, .7, .8);
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * .1, -.04, 0); hips.add(hip);
    M(C(.075, .28, 4, 8), pants, 0, -.2, 0, hip);
    const knee = new THREE.Group(); knee.position.y = -.4; hip.add(knee);
    M(C(.065, .26, 4, 8), pants, 0, -.17, 0, knee);
    const bt = M(B(.13, .1, .24), boot, 0, -.36, .04, knee);
    J[s < 0 ? 'lHip' : 'rHip'] = hip; J[s < 0 ? 'lKnee' : 'rKnee'] = knee;
  }
  const torso = new THREE.Group(); hips.add(torso); J.torso = torso;
  const tb = M(C(.19 * (o.belly ?? 1), .26, 6, 12), shirt, 0, .3, 0, torso); tb.scale.set(1.05, 1, .75);
  if (o.vest) M(C(.2 * (o.belly ?? 1), .2, 4, 10), std(o.vest, { roughness: .9 }), 0, .32, 0, torso).scale.set(1.08, 1, .8);
  if (o.belt !== false) M(new THREE.TorusGeometry(.18, .025, 6, 16), std(0x3a2414), 0, .1, 0, torso).rotation.x = PI / 2;
  if (o.bag) { M(B(.22, .26, .1), std(o.bag), 0, .32, -.17, torso); }
  M(new THREE.CylinderGeometry(.06, .07, .08, 8), skin, 0, .56, 0, torso);
  const head = new THREE.Group(); head.position.y = .6; torso.add(head); J.head = head;
  M(S(.15, 16, 12), skin, 0, .12, 0, head).scale.set(.95, 1.08, 1);
  for (const s of [-1, 1]) { M(S(.022, 8, 6), dark, s * .055, .14, .135, head); M(S(.04, 6, 5), skin, s * .148, .12, 0, head).scale.set(.5, 1, .8); }
  const brow = M(B(.15, .022, .03), hair, 0, .19, .135, head); brow.rotation.x = .2; J.brow = brow;
  if (o.moustache !== false) M(B(.1, .025, .03), hair, 0, .075, .145, head);
  M(new THREE.SphereGeometry(.155, 14, 8, 0, TAU, 0, PI * .5), hair, 0, .13, -.01, head);
  if (o.hat === 'cap') { M(new THREE.SphereGeometry(.16, 14, 8, 0, TAU, 0, PI * .5), std(o.hatCol ?? 0x3a4a2a), 0, .16, 0, head); const br = M(B(.18, .02, .14), std(o.hatCol ?? 0x3a4a2a), 0, .17, .14, head); br.rotation.x = .15; }
  else if (o.hat === 'bandana') { const bd = M(new THREE.TorusGeometry(.152, .03, 6, 18), std(o.hatCol ?? 0x8a1a1a), 0, .19, 0, head); bd.rotation.x = PI / 2 - .2; M(new THREE.SphereGeometry(.157, 14, 8, 0, TAU, 0, PI * .4), std(o.hatCol ?? 0x8a1a1a), 0, .16, 0, head); }
  else if (o.hat === 'ranger') { M(new THREE.CylinderGeometry(.14, .16, .1, 14), std(0x5a5030), 0, .27, 0, head); M(new THREE.CylinderGeometry(.27, .27, .02, 16), std(0x5a5030), 0, .22, 0, head); }
  if (o.mask) M(B(.22, .07, .05), std(0x111111), 0, .14, .14, head);
  J.head.userData.hatY = .2;
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * .24, .48, 0); torso.add(sh);
    M(S(.08, 10, 8), shirt, 0, 0, 0, sh); M(C(.058, .2, 4, 8), o.sleeves === false ? skin : shirt, 0, -.15, 0, sh);
    const el = new THREE.Group(); el.position.y = -.3; sh.add(el); M(C(.05, .2, 4, 8), skin, 0, -.13, 0, el); M(S(.06, 8, 6), skin, 0, -.28, .01, el);
    J[s < 0 ? 'lSh' : 'rSh'] = sh; J[s < 0 ? 'lEl' : 'rEl'] = el;
  }
  if (o.shield) { const sg = new THREE.Group(); sg.position.set(-.06, -.18, .1); J.lEl.add(sg); M(B(.08, .6, .46), std(0x7a5432, { roughness: .9 }), 0, 0, 0, sg); M(B(.1, .64, .06), std(0x8a8a8a, { metalness: .6, roughness: .4 }), 0, 0, .2, sg); M(B(.1, .64, .06), std(0x8a8a8a, { metalness: .6, roughness: .4 }), 0, 0, -.2, sg); }
  // weapon in right hand
  const wpn = new THREE.Group(); wpn.position.set(0, -.28, .02); J.rEl.add(wpn); J.wpn = wpn;
  if (o.weapon === 'club') { const c = M(new THREE.CylinderGeometry(.035, .06, .8, 7), std(0x5a3a1e), 0, 0, .35, wpn); c.rotation.x = PI / 2; M(S(.08, 8, 6), std(0x4a2e18), 0, 0, .72, wpn); }
  else if (o.weapon === 'sling') { const wm = std(0x5a3a1e); M(new THREE.CylinderGeometry(.015, .018, .14, 5), wm, 0, .04, 0, wpn); for (const s of [-1, 1]) { const f = M(new THREE.CylinderGeometry(.012, .014, .1, 5), wm, s * .03, .14, 0, wpn); f.rotation.z = -s * .4; } }
  else if (o.weapon === 'staff') { const c = M(new THREE.CylinderGeometry(.03, .035, 1.6, 7), std(0x3a2a1a), 0, 0, .2, wpn); c.rotation.x = PI / 2; M(new THREE.ConeGeometry(.06, .2, 6), std(0x9aa0a8, { metalness: .7, roughness: .3 }), 0, 0, 1.08, wpn).rotation.x = PI / 2; }
  else if (o.weapon === 'net') { const c = M(new THREE.CylinderGeometry(.02, .02, .6, 6), std(0x5a3a1e), 0, 0, .25, wpn); c.rotation.x = PI / 2; const n = M(new THREE.TorusGeometry(.2, .015, 4, 14), std(0xcab88a), 0, 0, .7, wpn); }
  root.traverse(m => { if (m.isMesh) m.castShadow = true; });
  // flash material list for hit-flash
  const mats = []; root.traverse(m => { if (m.isMesh) mats.push(m); });
  return { root, J, phase: 0, mats, o };
}

// mode: idle | walk | windup | strike | throwWind | throw | stagger | stun | ko | taunt | slam
export function animHuman(h, dt, speed, mode, t, k = 0) {
  const J = h.J; const g = clamp(speed / 3, 0, 1.6);
  if (speed > .2) h.phase += dt * (speed * 2.2 + 1);
  const ph = h.phase, sw = Math.sin(ph), cw = Math.cos(ph);
  let lh = 0, rh = 0, lk = .05, rk = .05, ls = 0, rs = 0, le = -.2, re = -.3, lz = -.08, rz = .08, tor = 0, twist = 0, hx = 0, hy = .82, spinX = 0, wx = .2;
  if (speed > .2) { const a = Math.min(g, 1.2); lh = -sw * .8 * a; rh = sw * .8 * a; lk = Math.max(0, cw) * 1.1 * a + .08; rk = Math.max(0, -cw) * 1.1 * a + .08; ls = sw * .7 * a; rs = -sw * .4 * a - .4; le = -.5; re = -.8; tor = .1 * a; hy = .82 + Math.abs(cw) * .03 * a; }
  else { tor = Math.sin(t * 1.8) * .02; rs = -.4; re = -.7; }
  if (mode === 'windup') { const e = smooth(0, 1, k); rs = -.4 - e * 2.4; re = -.3; rz = .2; ls = -.6 * e; tor = -.2 * e; twist = .4 * e; lh = -.3; rh = .3; lk = rk = .25; wx = -.3 * e; }
  else if (mode === 'strike') { const e = smooth(0, .4, k); rs = -2.8 + e * 2.9; re = -.2; rz = .1; tor = -.2 + e * .5; twist = .4 - e * .9; lh = -.5; rh = .4; lk = rk = .4; hy = .78; wx = .2; }
  else if (mode === 'slamWind') { const e = smooth(0, 1, k); rs = ls = -.4 - e * 2.5; re = le = -.3; tor = -.3 * e; hy = .82; lh = -.3; rh = .3; lk = rk = .3; }
  else if (mode === 'slam') { const e = smooth(0, .35, k); rs = ls = -2.9 + e * 2.7; re = le = -.2; tor = -.3 + e * .8; hy = .8 - e * .12; lk = rk = .6; lh = -.6; rh = .5; }
  else if (mode === 'throwWind') { const e = smooth(0, 1, k); ls = -1.5; le = 0; rs = -1.4; re = -2 * e; rz = -.3; twist = -.4 * e; }
  else if (mode === 'throw') { const e = smooth(0, .3, k); ls = -1.5; le = 0; rs = -1.4 + e * .6; re = -2 + e * 2; twist = -.4 + e * .6; }
  else if (mode === 'stagger') { tor = -.45; hx = .3; ls = rs = -.9; le = re = -.6; lz = -.6; rz = .6; lh = .3; rh = -.2; hy = .8; }
  else if (mode === 'stun') { tor = Math.sin(t * 6) * .15; twist = Math.sin(t * 3.3) * .3; hx = .2 + Math.sin(t * 5) * .1; ls = rs = .1; le = re = -.2; lz = -.3; rz = .3; lk = rk = .2; hy = .78; }
  else if (mode === 'ko') { spinX = -1.45 * smooth(0, .5, k); ls = rs = -2.6; lz = -.8; rz = .8; lh = rh = -.3; hy = .8; }
  else if (mode === 'taunt') { ls = -2.6 + Math.sin(t * 9) * .3; le = -.4; lz = -.5; rs = -.6; tor = -.1; hx = -.2; }
  const kk = mode === 'strike' || mode === 'slam' || mode === 'throw' ? 30 : 14;
  dr(J.lHip, 'x', lh, dt, kk); dr(J.rHip, 'x', rh, dt, kk); dr(J.lKnee, 'x', lk, dt, kk); dr(J.rKnee, 'x', rk, dt, kk);
  dr(J.lSh, 'x', ls, dt, kk); dr(J.rSh, 'x', rs, dt, kk); dr(J.lEl, 'x', le, dt, kk); dr(J.rEl, 'x', re, dt, kk); dr(J.lSh, 'z', lz, dt, kk); dr(J.rSh, 'z', rz, dt, kk);
  dr(J.torso, 'x', tor, dt, kk); dr(J.torso, 'y', twist, dt, kk); dr(J.head, 'x', hx, dt, 10); dr(J.wpn, 'x', wx, dt, 16);
  J.hips.position.y = damp(J.hips.position.y, hy, 16, dt);
  J.spin.rotation.x = damp(J.spin.rotation.x, spinX, mode === 'ko' ? 6 : 14, dt);
}
