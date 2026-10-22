// Sprite particles, ground rings and floating damage numbers.
import { THREE, scene, camera, TEX } from '../core/engine.js';
import { rand } from '../core/utils.js';

const PARTS = [], RINGS = [];
export function emit(tex, pos, n, o = {}) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.SpriteMaterial({ map: tex, color: o.color ?? 0xffffff, transparent: true, depthWrite: false, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false });
    const s = new THREE.Sprite(m); s.position.copy(pos);
    if (o.spread) s.position.add(new THREE.Vector3(rand(-1, 1), rand(-.3, 1), rand(-1, 1)).multiplyScalar(o.spread));
    const sz = (o.size ?? .3) * rand(.7, 1.2); s.scale.setScalar(sz); scene.add(s); const sp = o.speed ?? 2;
    PARTS.push({ s, v: new THREE.Vector3(rand(-1, 1) * sp * (o.hz ?? 1), rand(o.up0 ?? .5, o.up1 ?? 1.5) * sp, rand(-1, 1) * sp * (o.hz ?? 1)), life: 0, max: rand(.7, 1) * (o.life ?? 1.2), g: o.g ?? -2, sz, grow: o.grow ?? 0, op: o.op ?? 1, drag: o.drag ?? 1.2 });
  }
}
const ringGeo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
// expanding ground ring: used for shockwaves and Honey's bark
export function ring(pos, size, color = 0xffffff, life = .6) {
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ map: TEX.ring, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  m.position.copy(pos); m.position.y += .06; scene.add(m); RINGS.push({ m, t: 0, size, life });
}
export function updParts(dt) {
  for (let i = PARTS.length - 1; i >= 0; i--) {
    const p = PARTS[i]; p.life += dt; const k = p.life / p.max;
    if (k >= 1) { scene.remove(p.s); p.s.material.dispose(); PARTS.splice(i, 1); continue; }
    p.v.y += p.g * dt; p.v.multiplyScalar(Math.exp(-p.drag * dt)); p.s.position.addScaledVector(p.v, dt);
    p.s.material.opacity = p.op * (1 - k * k); p.s.scale.setScalar(p.sz * (1 + p.grow * k));
  }
  for (let i = RINGS.length - 1; i >= 0; i--) {
    const r = RINGS[i]; r.t += dt; const k = r.t / r.life;
    if (k >= 1) { scene.remove(r.m); r.m.material.dispose(); RINGS.splice(i, 1); continue; }
    r.m.scale.setScalar(.2 + k * r.size); r.m.material.opacity = 1 - k;
  }
  updNums(dt);
}
export function clearParts() { for (const p of PARTS) { scene.remove(p.s); p.s.material.dispose(); } PARTS.length = 0; for (const r of RINGS) { scene.remove(r.m); r.m.material.dispose(); } RINGS.length = 0; for (const n of NUMS) n.el.remove(); NUMS.length = 0; }

/* ---------- floating damage numbers (DOM) ---------- */
const NUMS = []; const _p = new THREE.Vector3();
export function dmgNum(pos, text, color = '#fff', big = false) {
  const el = document.createElement('div'); el.className = 'dmg' + (big ? ' big' : ''); el.textContent = text; el.style.color = color;
  document.body.appendChild(el); NUMS.push({ el, pos: pos.clone(), t: 0, vx: rand(-.6, .6) });
}
function updNums(dt) {
  for (let i = NUMS.length - 1; i >= 0; i--) {
    const n = NUMS[i]; n.t += dt; if (n.t > .9) { n.el.remove(); NUMS.splice(i, 1); continue; }
    n.pos.y += dt * 1.4; n.pos.x += n.vx * dt; _p.copy(n.pos).project(camera);
    if (_p.z > 1) { n.el.style.opacity = 0; continue; }
    n.el.style.left = ((_p.x * .5 + .5) * innerWidth) + 'px'; n.el.style.top = ((-_p.y * .5 + .5) * innerHeight) + 'px';
    n.el.style.opacity = 1 - Math.max(0, n.t - .5) / .4;
  }
}
