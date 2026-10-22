// Four-legged animal builder + animator (ported from v1). Used for Honey, sambar deer, wild boar, etc.
import { THREE, M, S, C, std } from '../core/engine.js';
import { PI, clamp, damp } from '../core/utils.js';

const dr = (o, ax, v, dt, k = 12) => { o.rotation[ax] = damp(o.rotation[ax], v, k, dt); };

export function makeQuad(o) {
  const coat = o.coatTex ? new THREE.MeshStandardMaterial({ map: o.coatTex, roughness: .9 }) : std(o.color, { roughness: .95 }), belly = std(o.belly ?? o.color, { roughness: .95 }), dark = std(o.dark ?? 0x1b1410, { roughness: .35 });
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); const baseY = o.legLen + o.bodyR * .35; body.position.y = baseY;
  M(C(o.bodyR, o.bodyL, 6, 14), coat, 0, 0, 0, body).rotation.x = PI / 2;
  M(S(o.bodyR * 1.08, 14, 12), coat, 0, .02, o.bodyL * .42, body); M(S(o.bodyR * 1.03, 14, 12), coat, 0, .01, -o.bodyL * .42, body);
  M(S(o.bodyR, 12, 10), belly, 0, -o.bodyR * .3, o.bodyL * .12, body).scale.set(.84, .64, (o.bodyL * .5 + o.bodyR) / o.bodyR * .78);
  if (o.hump) M(S(o.bodyR * .8, 10, 8), coat, 0, o.bodyR * .7, o.bodyL * .3, body).scale.set(.8, .7, 1.2);
  const neck = new THREE.Group(); neck.position.set(0, o.bodyR * .35, o.bodyL * .5 + o.bodyR * .2); body.add(neck); neck.rotation.x = o.neckTilt;
  M(C(o.bodyR * .6, o.neckLen, 4, 10), coat, 0, o.neckLen * .5, 0, neck);
  if (o.chestFluff) M(S(o.bodyR * .78, 10, 8), belly, 0, o.neckLen * .12, o.bodyR * .3, neck).scale.set(1, 1.35, .75);
  const head = new THREE.Group(); head.position.y = o.neckLen + o.headR * .2; neck.add(head); const hr = o.headR;
  const headIn = new THREE.Group(); headIn.rotation.x = -o.neckTilt; head.add(headIn);
  M(S(hr, 16, 12), coat, 0, 0, 0, headIn).scale.set(1, .92, 1.05);
  const snZ = hr * .62 + o.snoutL * .5; M(C(hr * .47, o.snoutL, 4, 10), belly, 0, -hr * .3, snZ, headIn).rotation.x = PI / 2;
  const tip = snZ + o.snoutL / 2 + hr * .47; M(S(hr * .2, 10, 8), dark, 0, -hr * .17, tip - hr * .1, headIn).scale.set(1.25, .9, 1);
  if (o.tusks) for (const s of [-1, 1]) { const tk = M(new THREE.ConeGeometry(hr * .07, hr * .4, 5), std(0xf2ead0), s * hr * .3, -hr * .25, tip - hr * .35, headIn); tk.rotation.x = -.6; }
  const jaw = new THREE.Group(); jaw.position.set(0, -hr * .5, hr * .45); headIn.add(jaw); M(C(hr * .33, o.snoutL * .75, 3, 8), belly, 0, -hr * .03, snZ - hr * .45, jaw).rotation.x = PI / 2;
  const tongue = M(S(hr * .2, 8, 6), std(0xe8707e, { roughness: .5 }), 0, -hr * .05, snZ - hr * .15, jaw); tongue.scale.set(.75, .3, 1.4); tongue.visible = !!o.tongue;
  const eyeM = o.eyeGlow ? new THREE.MeshBasicMaterial({ color: o.eyeGlow }) : std(0x1a0f08, { roughness: .1 });
  for (const s of [-1, 1]) { M(S(hr * (o.eyeR ?? .17), 10, 8), eyeM, s * hr * .44, hr * .2, hr * .8, headIn); if (!o.eyeGlow) M(S(hr * .05, 6, 4), std(0xffffff, { roughness: .1 }), s * hr * .42 + hr * .05, hr * .27, hr * .95, headIn); }
  const ears = []; const earM = std(o.earColor ?? o.color, { roughness: .95 });
  for (const s of [-1, 1]) {
    const e = new THREE.Group();
    if (o.ears === 'flop') { e.position.set(s * hr * .72, hr * .42, -hr * .1); M(S(hr * .52, 10, 8), earM, s * hr * .08, -hr * .5, 0, e).scale.set(.32, 1, .66); e.rotation.z = s * .12; }
    else if (o.ears === 'up') { e.position.set(s * hr * .5, hr * .7, -hr * .15); M(new THREE.ConeGeometry(hr * .3, hr * .75, 6), earM, 0, hr * .3, 0, e); e.rotation.z = -s * .18; }
    else { e.position.set(s * hr * .7, hr * .55, -hr * .2); M(S(hr * .42, 8, 6), earM, s * hr * .4, hr * .12, 0, e).scale.set(1.3, .55, .35); e.rotation.z = s * .45; }
    headIn.add(e); ears.push(e);
  }
  if (o.horns) {
    const hm = std(0x2a2420, { roughness: .6 });
    for (const s of [-1, 1]) { let par = new THREE.Group(); par.position.set(s * hr * .3, hr * .75, -hr * .1); headIn.add(par); for (let k = 0; k < 4; k++) { M(new THREE.CylinderGeometry(hr * (.1 - k * .02), hr * (.12 - k * .02), hr * .5, 5), hm, 0, hr * .25, 0, par); const n = new THREE.Group(); n.position.y = hr * .45; n.rotation.x = -.45; par.add(n); par = n; } }
  }
  if (o.antlers) {
    const am = std(0x6a5038, { roughness: .7 });
    for (const s of [-1, 1]) { const a = new THREE.Group(); a.position.set(s * hr * .35, hr * .8, -hr * .1); a.rotation.z = -s * .4; headIn.add(a); M(new THREE.CylinderGeometry(.02, .03, .5, 5), am, 0, .25, 0, a); for (let k = 0; k < 2; k++) { const tt = M(new THREE.CylinderGeometry(.012, .02, .2, 4), am, 0, .18 + k * .16, .04, a); tt.rotation.x = .9; } }
  }
  const legs = []; const lz = o.bodyL * .46, lx = o.bodyR * .55, L = o.legLen / 2;
  [[lx, lz, 1], [-lx, lz, 1], [lx, -lz, 0], [-lx, -lz, 0]].forEach(([x, z, f]) => {
    const hip = new THREE.Group(); hip.position.set(x, -o.bodyR * .35, z); body.add(hip);
    M(C(o.legR * (f ? 1 : 1.3), L - o.legR, 4, 8), coat, 0, -L / 2, f ? 0 : -o.legR * .2, hip);
    const knee = new THREE.Group(); knee.position.y = -L; hip.add(knee);
    M(C(o.legR * .75, L - o.legR * .6, 4, 8), o.lowerBelly ? belly : coat, 0, -L / 2, 0, knee);
    const paw = M(S(o.legR * .95, 8, 6), o.hoof ? dark : belly, 0, -L + o.legR * .35, o.legR * .35, knee); paw.scale.set(1, .6, 1.35);
    legs.push({ hip, knee, f });
  });
  const tail = []; const tp = new THREE.Group(); tp.position.set(0, o.bodyR * .45, -o.bodyL * .5 - o.bodyR * .6); tp.rotation.x = o.tailX; body.add(tp); let parent = tp;
  for (let i = 0; i < o.tailN; i++) {
    const seg = i === 0 ? tp : new THREE.Group(); if (i > 0) { seg.position.y = o.tailSeg; parent.add(seg); }
    const r = o.tailR * (1 - i / (o.tailN + 1) * .45); M(C(r, o.tailSeg * .7, 3, 8), (o.tailTip && i === o.tailN - 1) ? belly : coat, 0, o.tailSeg * .5, 0, seg);
    if (o.fluffy) M(S(r * 1.25, 8, 6), belly, 0, o.tailSeg * .5, -r * .5, seg).scale.set(.9, 1.3, .7);
    tail.push(seg); parent = seg;
  }
  return { root, body, neck, head, headIn, jaw, tongue, ears, legs, tail, phase: 0, o, baseY };
}

export function animQuad(q, dt, speed, mode, t, ex = {}) {
  const o = q.o; const gait = clamp(speed / (o.legLen * 7), 0, 1.3); q.phase += dt * speed / (o.legLen * 2.6) * PI; const ph = q.phase;
  let bodyY = q.baseY, bodyPitch = 0, neckX = o.neckTilt, headX = 0, headY = ex.headYaw || 0, jawX = 0; const LT = [[0, 0], [0, 0], [0, 0], [0, 0]];
  if (mode === 'walk') {
    const a = .62 * Math.min(gait, 1) + .05 * Math.min(gait * 10, 1);
    for (let i = 0; i < 4; i++) { const off = (i === 0 || i === 3) ? 0 : PI, s = Math.sin(ph + off), c = Math.cos(ph + off); const f = i < 2; LT[i][0] = -s * a; LT[i][1] = f ? -Math.max(0, -c) * a * 1.3 : Math.max(0, -c) * a * 1.25; }
    bodyY += Math.abs(Math.sin(ph)) * .08 * gait * o.legLen; bodyPitch = Math.sin(ph * 2) * .025 * gait; headX = Math.sin(ph * 2) * .06 * gait;
    if (ex.leap) bodyY += Math.max(0, Math.sin(ph)) * o.legLen * .35 * gait;
  }
  else if (mode === 'sit') { bodyPitch = -.62; bodyY = q.baseY * .86; LT[0] = [.62, 0]; LT[1] = [.62, 0]; LT[2] = [-.5, 1.6]; LT[3] = [-.5, 1.6]; neckX = o.neckTilt - .25; headX = .3; }
  else if (mode === 'lie') { bodyY = o.bodyR * 1.15; LT[0] = [-1.45, .1]; LT[1] = [-1.45, .1]; LT[2] = [-1.3, 1.9]; LT[3] = [-1.3, 1.9]; neckX = o.neckTilt + .35; headX = -.2; }
  else if (mode === 'rear') { bodyPitch = -1.05; bodyY = q.baseY * 1.25; LT[0] = [-.25 + Math.sin(t * 9) * .25, -.9]; LT[1] = [-.25 - Math.sin(t * 9) * .25, -.9]; LT[2] = [1.0, -.2]; LT[3] = [1.0, -.2]; neckX = o.neckTilt - .4; headX = .65; }
  else if (mode === 'graze') { neckX = o.neckTilt + 1.25; headX = .35 + Math.sin(t * 7) * .05; jawX = Math.max(0, Math.sin(t * 9)) * .12; }
  else if (mode === 'alert') { neckX = o.neckTilt - .25; headX = -.1; }
  else if (mode === 'sniff') { neckX = o.neckTilt + .8; headX = .4 + Math.sin(t * 14) * .05; }
  else if (mode === 'crouch') { bodyY = q.baseY * .75; bodyPitch = .15; LT[0] = [.5, -.8]; LT[1] = [.5, -.8]; LT[2] = [-.4, 1]; LT[3] = [-.4, 1]; neckX = o.neckTilt + .3; headX = -.3; jawX = .3; }
  else if (mode === 'ko') { bodyY = o.bodyR * 1.1; LT[0] = [-1, .3]; LT[1] = [-.6, .2]; LT[2] = [-.8, .6]; LT[3] = [-.4, .5]; neckX = o.neckTilt + .6; headX = .2; }
  if (ex.bark > 0) jawX = Math.max(jawX, Math.sin(ex.bark * PI * 2 * 3) * .5), headX -= .15;
  if (ex.pant) jawX = Math.max(jawX, .18 + Math.sin(t * 14) * .06);
  const k = 10;
  q.body.position.y = damp(q.body.position.y, bodyY, k, dt); dr(q.body, 'x', bodyPitch, dt, k); dr(q.neck, 'x', neckX, dt, k); dr(q.head, 'x', headX, dt, k); dr(q.head, 'y', headY, dt, k * .6); dr(q.jaw, 'x', jawX, dt, 20);
  q.body.rotation.z = damp(q.body.rotation.z, mode === 'ko' ? 1.4 : 0, 8, dt);
  for (let i = 0; i < 4; i++) { dr(q.legs[i].hip, 'x', LT[i][0], dt, mode === 'walk' ? 30 : k); dr(q.legs[i].knee, 'x', LT[i][1], dt, mode === 'walk' ? 30 : k); }
  const wag = ex.wag ?? .25;
  for (let i = 0; i < q.tail.length; i++) q.tail[i].rotation.z = Math.sin(t * (5 + wag * 12) + i * .5) * (.08 + wag * .4) * (i + 1) / q.tail.length;
  q.tail[0].rotation.x = damp(q.tail[0].rotation.x, o.tailX - wag * .45 + (mode === 'walk' ? .2 * gait : 0), 5, dt);
  for (let i = 0; i < q.ears.length; i++) { const e = q.ears[i]; if (o.ears === 'flop') e.rotation.x = damp(e.rotation.x, -gait * .5 + Math.sin(ph * 2) * .25 * gait + (mode === 'rear' ? -.5 : 0), 12, dt); else e.rotation.x = damp(e.rotation.x, mode === 'alert' ? -.2 : Math.sin(t * .7 + i) * .05, 6, dt); }
}

export const QUADS = {
  honey: { color: 0xdb9b4f, belly: 0xf1d29b, earColor: 0xc77f3a, dark: 0x1a0f0b, legLen: .33, legR: .052, bodyR: .17, bodyL: .42, neckLen: .17, neckTilt: .55, headR: .135, snoutL: .1, ears: 'flop', tailX: -1.0, tailN: 4, tailSeg: .1, tailR: .045, fluffy: true, chestFluff: true, lowerBelly: true, tongue: true, eyeR: .2 },
  sambar: { color: 0x5a4030, belly: 0x8a7058, dark: 0x1a120c, legLen: .85, legR: .05, bodyR: .27, bodyL: .7, neckLen: .4, neckTilt: .35, headR: .13, snoutL: .15, ears: 'deer', tailX: -.9, tailN: 1, tailSeg: .09, tailR: .05, hoof: true, antlers: true, eyeR: .2 },
  spotted: { color: 0xb5713a, belly: 0xf0e0c8, dark: 0x2a1a12, legLen: .7, legR: .04, bodyR: .2, bodyL: .55, neckLen: .32, neckTilt: .32, headR: .11, snoutL: .12, ears: 'deer', tailX: -.9, tailN: 1, tailSeg: .08, tailR: .05, tailTip: true, hoof: true, eyeR: .2 },
  tahr: { color: 0x5a4a3c, belly: 0x9a8a78, dark: 0x1a120c, legLen: .55, legR: .045, bodyR: .22, bodyL: .5, neckLen: .22, neckTilt: .45, headR: .11, snoutL: .1, ears: 'deer', tailX: -1.2, tailN: 1, tailSeg: .06, tailR: .03, hoof: true, horns: true, eyeR: .2 },
  tiger: { color: 0xe08a2a, belly: 0xf4e8d8, earColor: 0x2a1a10, dark: 0x111111, legLen: .55, legR: .08, bodyR: .3, bodyL: .95, neckLen: .2, neckTilt: .9, headR: .22, snoutL: .12, ears: 'up', tailX: -1.6, tailN: 5, tailSeg: .16, tailR: .05, eyeR: .14, eyeGlow: 0xd8e840 },
  boar: { color: 0x3a302a, belly: 0x5a4a40, dark: 0x111111, legLen: .32, legR: .06, bodyR: .3, bodyL: .55, neckLen: .12, neckTilt: 1.2, headR: .19, snoutL: .2, ears: 'up', tailX: -2.4, tailN: 2, tailSeg: .08, tailR: .025, hoof: true, hump: true, tusks: true, eyeGlow: 0xff5533, eyeR: .12 },
};
