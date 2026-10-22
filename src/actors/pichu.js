// Pichu (ported from v1) with a fighting stick, a slingshot and combat poses.
import { THREE, M, S, C, B, std, scene } from '../core/engine.js';
import { P, G } from '../core/state.js';
import { PI, TAU, clamp, damp, smooth, rand } from '../core/utils.js';
import { sfx } from '../core/audio.js';

const dr = (o, ax, v, dt, k = 12) => { o.rotation[ax] = damp(o.rotation[ax], v, k, dt); };

export function makePichu() {
  const skin = std(0xe0a67a, { roughness: .65 }), hair = std(0x24160f, { roughness: .5 }), shirt = std(0xffcc33, { roughness: .8 }), shorts = std(0x2c66c9, { roughness: .85 }), shoe = std(0xe23b3b, { roughness: .55 }), sole = std(0xf4f4f4), eyeW = std(0xffffff, { roughness: .2 }), iris = std(0x4a2a12, { roughness: .2 }), blk = std(0x0a0a0a, { roughness: .15 }), mouthM = std(0x8a2a2a), bag = std(0x3d9b52, { roughness: .7 }), boltM = std(0xff7b1c, { roughness: .6 });
  const root = new THREE.Group(), spin = new THREE.Group(); spin.position.y = .42; root.add(spin);
  const hips = new THREE.Group(); hips.position.y = .08; spin.add(hips); const J = { hips, spin };
  M(S(.12, 14, 10), shorts, 0, .02, 0, hips).scale.set(1, .72, .82);
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * .072, -.02, 0); hips.add(hip);
    M(C(.064, .07, 4, 10), shorts, 0, -.055, 0, hip); M(C(.047, .13, 4, 10), skin, 0, -.12, 0, hip);
    const knee = new THREE.Group(); knee.position.y = -.22; hip.add(knee);
    M(C(.043, .13, 4, 10), skin, 0, -.09, 0, knee); M(new THREE.CylinderGeometry(.047, .047, .06, 10), std(0xffffff), 0, -.19, 0, knee);
    const sh = M(S(.062, 12, 8), shoe, 0, -.235, .03, knee); sh.scale.set(1, .62, 1.55); M(B(.11, .026, .19), sole, 0, -.266, .03, knee);
    J[s < 0 ? 'lHip' : 'rHip'] = hip; J[s < 0 ? 'lKnee' : 'rKnee'] = knee;
  }
  const torso = new THREE.Group(); hips.add(torso); J.torso = torso;
  M(C(.125, .14, 6, 14), shirt, 0, .17, 0, torso).scale.set(1, 1, .8);
  const bolt = new THREE.Shape(); bolt.moveTo(.022, .075); bolt.lineTo(-.038, -.004); bolt.lineTo(-.002, -.004); bolt.lineTo(-.022, -.075); bolt.lineTo(.042, .012); bolt.lineTo(.006, .012); bolt.lineTo(.03, .075); bolt.closePath();
  M(new THREE.ExtrudeGeometry(bolt, { depth: .012, bevelEnabled: false }), boltM, 0, .19, .093, torso);
  const bp = M(C(.09, .1, 4, 10), bag, 0, .2, -.115, torso); bp.scale.set(1.25, 1, .62);
  for (const s of [-1, 1]) M(B(.026, .2, .016), bag, s * .075, .22, .097, torso);
  M(new THREE.CylinderGeometry(.045, .05, .07, 10), skin, 0, .36, 0, torso);
  const head = new THREE.Group(); head.position.y = .38; torso.add(head); J.head = head;
  M(S(.165, 22, 18), skin, 0, .15, 0, head).scale.set(1, 1.02, .97);
  // red headband = hero look for v2
  const band = M(new THREE.TorusGeometry(.168, .018, 6, 24), std(0xd62b2b, { roughness: .6 }), 0, .2, 0, head); band.rotation.x = PI / 2 - .25;
  const cap = M(new THREE.SphereGeometry(.177, 22, 12, 0, TAU, 0, PI * .5), hair, 0, .155, -.015, head); cap.rotation.x = -.34;
  [[0, .315, .03, .062], [.065, .3, .085, .05], [-.065, .3, .085, .05], [0, .29, .11, .052], [.11, .27, .04, .048], [-.11, .27, .04, .048], [.03, .33, -.05, .052], [-.05, .31, -.09, .05]].forEach(([x, y, z, r]) => M(S(r, 8, 6), hair, x, y, z, head));
  for (const s of [-1, 1]) { M(S(.05, 8, 6), hair, s * .152, .18, -.03, head).scale.set(.45, 1, 1); M(S(.036, 8, 6), skin, s * .164, .14, 0, head).scale.set(.55, 1, .8); }
  const eyes = [];
  for (const s of [-1, 1]) {
    const eg = new THREE.Group(); eg.position.set(s * .06, .152, .142); head.add(eg);
    M(S(.039, 14, 10), eyeW, 0, 0, 0, eg).scale.set(1, 1.18, .55); M(S(.026, 12, 8), iris, 0, -.004, .014, eg).scale.set(1, 1.12, .6); M(S(.013, 8, 6), blk, 0, -.004, .025, eg); M(S(.008, 6, 4), eyeW, .01, .011, .029, eg); eyes.push(eg);
    const br = M(C(.008, .036, 2, 6), hair, s * .06, .215, .149, head); br.rotation.z = PI / 2 + s * .15;
  }
  M(S(.017, 8, 6), skin, 0, .11, .163, head);
  const mouth = M(new THREE.TorusGeometry(.03, .008, 6, 14, PI), mouthM, 0, .074, .152, head); mouth.rotation.z = PI; J.mouth = mouth;
  const oMouth = M(S(.022, 10, 8), mouthM, 0, .068, .152, head); oMouth.scale.set(1, 1.2, .5); oMouth.visible = false; J.oMouth = oMouth;
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * .152, .28, 0); torso.add(sh);
    M(S(.057, 10, 8), shirt, 0, -.02, 0, sh); M(C(.035, .08, 4, 8), skin, 0, -.08, 0, sh);
    const el = new THREE.Group(); el.position.y = -.15; sh.add(el); M(C(.032, .08, 4, 8), skin, 0, -.06, 0, el); M(S(.041, 10, 8), skin, 0, -.13, .005, el);
    J[s < 0 ? 'lSh' : 'rSh'] = sh; J[s < 0 ? 'lEl' : 'rEl'] = el;
  }
  // fighting stick (right hand)
  const stick = new THREE.Group(); stick.position.set(0, -.13, .01); J.rEl.add(stick);
  const sm = std(0x7a5230, { roughness: .8 });
  const st = M(new THREE.CylinderGeometry(.016, .022, .78, 7), sm, 0, 0, .3, stick); st.rotation.x = PI / 2;
  M(new THREE.CylinderGeometry(.026, .026, .1, 7), std(0xd62b2b), 0, 0, -.02, stick).rotation.x = PI / 2;
  const tipGlow = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffd36a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  tipGlow.position.z = .68; tipGlow.scale.setScalar(.25); stick.add(tipGlow);
  stick.rotation.x = .4;
  // slingshot (left hand)
  const sling = new THREE.Group(); sling.position.set(0, -.14, .03); J.lEl.add(sling);
  const wm = std(0x8a5a32); M(new THREE.CylinderGeometry(.012, .014, .1, 5), wm, 0, -.03, 0, sling);
  for (const s of [-1, 1]) { const f = M(new THREE.CylinderGeometry(.009, .011, .08, 5), wm, s * .025, .045, 0, sling); f.rotation.z = -s * .45; }
  sling.visible = false;
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { root, J, eyes, stick, tipGlow, sling, phase: 0, blinkT: 2, blink: 0 };
}

export const pichu = makePichu(); scene.add(pichu.root);

// Pose the body every frame from the player state (movement + combat action)
export function animPichu(dt, t) {
  const p = pichu, J = p.J, s = P.speed, air = !P.ground, g = clamp(s / 4.3, 0, 1.6);
  if (!air && s > .25 && !P.act) { const prev = p.phase; p.phase += dt * (s * 2.4 + 1.4); if (Math.floor(prev / PI) !== Math.floor(p.phase / PI)) sfx.step(false); }
  const ph = p.phase, sw = Math.sin(ph), cw = Math.cos(ph);
  let lh = 0, rh = 0, lk = .05, rk = .05, ls = 0, rs = 0, le = -.15, re = -.15, lz = -.1, rz = .1, ry = 0, tor = 0, twist = 0, hy = .08, hx = 0, hyw = 0, spinX = 0, stickX = .4, stickY = 0;
  if (air) { lh = -.9; rh = .35; lk = 1.1; rk = .45; ls = -2.2; rs = -1.2; le = re = -.3; lz = -.35; rz = .35; tor = .08; }
  else if (s > .25) { const a = Math.min(g, 1.25); lh = -sw * .85 * a; rh = sw * .85 * a; lk = Math.max(0, cw) * 1.25 * a + .08; rk = Math.max(0, -cw) * 1.25 * a + .08; ls = sw * .95 * a; rs = -sw * .6 * a - .3; le = -.35 - .55 * a; re = -.9; tor = .06 + .14 * Math.max(0, g - 1); hy = .08 + Math.abs(cw) * .035 * a; hx = -tor * .5; }
  else { tor = Math.sin(t * 2.2) * .015; ls = Math.sin(t * 1.6) * .05; rs = -.35; re = -.8; hyw = Math.sin(t * .45) * .3; }
  // combat ready stance when enemies are near
  if (P.fight > 0 && !air && s < 2.5 && !P.act) { lh = -.25; rh = .3; lk = rk = .35; hy = .03; rs = -.9; re = -1.1; rz = .25; ls = -.5; le = -1.4; lz = -.3; tor = .12; }
  const A = P.act;
  if (A) {
    const k = A.t / A.dur;
    if (A.type === 'light') {
      // three different swings: right-to-left, left-to-right, overhead
      const wind = smooth(0, A.hitAt / A.dur, k), fol = smooth(A.hitAt / A.dur * .7, 1, k);
      lh = -.35; rh = .35; lk = rk = .3; hy = .04;
      if (A.n === 0) { rs = -1.4 + fol * .3; rz = .2 + (1.3 - wind * 2.2); re = -.3; twist = .6 - wind * 1.3; ry = 0; stickY = 0; }
      else if (A.n === 1) { rs = -1.3; rz = -.6 + wind * 1.8; re = -.4; twist = -.6 + wind * 1.2; }
      else { rs = -2.9 + wind * 2.6; rz = .1; re = -.2; tor = -.2 + wind * .6; hy = .04 - wind * .05; twist = 0; }
      stickX = 0; ls = -.4; le = -1.2; lz = -.4;
    } else if (A.type === 'heavy') {
      if (A.phase === 'charge') { rs = -2.9; re = -.4; rz = .1; ls = -2.7; le = -.4; lz = -.1; tor = -.25; hy = 0; lk = rk = .6; lh = -.5; rh = .4; stickX = -.2; }
      else { const f = smooth(0, .35, k); rs = -2.9 + f * 2.9; ls = -2.7 + f * 2.5; re = le = -.2; tor = -.25 + f * .75; hy = .02 - f * .06; lk = rk = .7; lh = -.6; rh = .5; stickX = 0; }
    } else if (A.type === 'dodge') {
      spinX = k * TAU; lk = rk = 1.6; lh = rh = -1.4; ls = rs = -1.2; le = re = -1.8; hy = .02;
    } else if (A.type === 'sling') {
      ls = -1.55; le = 0; lz = .15; rs = -1.45; re = -1.9 + smooth(.4, .55, k) * 1.6; rz = -.25; twist = -.35; tor = 0;
    } else if (A.type === 'bark') {
      ls = rs = -1.35; le = re = -2.05; lz = .42; rz = -.42; hx = -.32; tor = -.06;
    }
  }
  if (P.climb) { const c = P.climbPhase || 0, s1 = Math.sin(c); ls = -2.7 + s1 * .4; rs = -2.7 - s1 * .4; le = re = -.5; lz = -.2; rz = .2; lh = -.9 + s1 * .5; rh = -.9 - s1 * .5; lk = rk = 1.2; tor = .15; hx = -.4; hy = .1; }
  if (P.hurtT > 0) { tor = -.3; ls = rs = -.8; hx = .2; }
  if (G.celebrate) { ls = rs = -2.7 + Math.sin(t * 10) * .2; le = re = -.3; lz = -.5; rz = .5; hy = .08 + Math.abs(Math.sin(t * 7)) * .08; hx = -.2; }
  if (P.landT > 0) hy -= .05;
  const k = A && A.type !== 'dodge' ? 28 : 16;
  dr(J.lHip, 'x', lh, dt, k); dr(J.rHip, 'x', rh, dt, k); dr(J.lKnee, 'x', lk, dt, k); dr(J.rKnee, 'x', rk, dt, k);
  dr(J.lSh, 'x', ls, dt, k); dr(J.rSh, 'x', rs, dt, k); dr(J.lEl, 'x', le, dt, k); dr(J.rEl, 'x', re, dt, k); dr(J.lSh, 'z', lz, dt, k); dr(J.rSh, 'z', rz, dt, k); dr(J.rSh, 'y', ry, dt, k);
  dr(J.torso, 'x', tor, dt, k); dr(J.torso, 'y', twist, dt, k); dr(J.head, 'x', hx, dt, 8); dr(J.head, 'y', hyw - twist * .6, dt, 6);
  J.hips.position.y = damp(J.hips.position.y, hy, 20, dt);
  J.spin.rotation.x = A && A.type === 'dodge' ? spinX : damp(J.spin.rotation.x, 0, 20, dt);
  dr(p.stick, 'x', stickX, dt, 20); dr(p.stick, 'y', stickY, dt, 20);
  p.sling.visible = !!(A && A.type === 'sling');
  p.tipGlow.material.opacity = A && A.type === 'heavy' ? (A.phase === 'charge' ? clamp(A.t / A.chargeMax, 0, 1) : .9) : (A && A.type === 'light' ? .35 : 0);
  J.oMouth.visible = P.hurtT > 0 || (A && (A.type === 'bark' || A.type === 'heavy')); J.mouth.visible = !J.oMouth.visible;
  p.blinkT -= dt; if (p.blinkT < 0) { p.blink = .13; p.blinkT = rand(2, 5); } p.blink -= dt; const ey = p.blink > 0 ? .12 : 1; p.eyes.forEach(e => e.scale.y = ey);
  p.root.position.copy(P.pos); p.root.rotation.y = P.yaw;
  p.root.visible = !(P.invul > 0 && G.mode === 'play' && P.hurtFlash && Math.floor(t * 14) % 2 === 0);
}
