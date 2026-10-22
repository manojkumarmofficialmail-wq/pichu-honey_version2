// Terrain mesh, water plane and collision grid. A level passes in its own height() and colour() functions.
import { THREE, M, waterNormal, std } from '../core/engine.js';
import { W } from '../core/state.js';
import { clamp, PI } from '../core/utils.js';
import { waterMats } from './sky.js';

/* ---------- collision grid (circles + boxes), rebuilt per level ---------- */
const CELL = 4; let OBS = new Map(); export let BOXES = [];
const ck = (i, j) => i * 10007 + j;
export function resetCollision() { OBS = new Map(); BOXES = []; }
export function addOb(x, z, r, fol = 0) { const k = ck(Math.floor(x / CELL), Math.floor(z / CELL)); let a = OBS.get(k); if (!a) { a = []; OBS.set(k, a); } a.push({ x, z, r, fol }); }
export function addBox(x0, z0, x1, z1) { BOXES.push({ x0, x1, z0, z1 }); }
export function nearOb(x, z, fn) {
  const i = Math.floor(x / CELL), j = Math.floor(z / CELL);
  for (let a = i - 1; a <= i + 1; a++) for (let b = j - 1; b <= j + 1; b++) { const L = OBS.get(ck(a, b)); if (L) for (const o of L) if (fn(o)) return true; }
  return false;
}
export const tooClose = (x, z, d) => nearOb(x, z, o => (o.x - x) ** 2 + (o.z - z) ** 2 < d * d);
export function collide(p, r) {
  nearOb(p.x, p.z, o => { const dx = p.x - o.x, dz = p.z - o.z, m = o.r + r, d2 = dx * dx + dz * dz; if (d2 < m * m && d2 > 1e-6) { const d = Math.sqrt(d2); p.x = o.x + dx / d * m; p.z = o.z + dz / d * m; } return false; });
  for (const b of BOXES) {
    const cx = clamp(p.x, b.x0, b.x1), cz = clamp(p.z, b.z0, b.z1), dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) { const d = Math.sqrt(d2); p.x = cx + dx / d * r; p.z = cz + dz / d * r; }
      else { const l = p.x - b.x0, rr = b.x1 - p.x, t = p.z - b.z0, bb = b.z1 - p.z, m = Math.min(l, rr, t, bb); if (m === l) p.x = b.x0 - r; else if (m === rr) p.x = b.x1 + r; else if (m === t) p.z = b.z0 - r; else p.z = b.z1 + r; }
    }
  }
  const bd = W.bounds; p.x = clamp(p.x, bd.x0, bd.x1); p.z = clamp(p.z, bd.z0, bd.z1);
}

/* ---------- terrain mesh ---------- */
export function buildTerrain(root, { w, l, cx = 0, cz = 0, nx, nz, height, colour }) {
  const cnt = (nx + 1) * (nz + 1), pos = new Float32Array(cnt * 3), col = new Float32Array(cnt * 3), idx = [], c = new THREE.Color();
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const x = cx - w / 2 + i * w / nx, z = cz - l / 2 + j * l / nz, y = height(x, z), k = j * (nx + 1) + i;
    pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
    const sl = Math.abs(height(x + .7, z) - height(x - .7, z)) + Math.abs(height(x, z + .7) - height(x, z - .7));
    colour(c, x, z, y, sl); col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, d = a + nx + 1, e = d + 1; idx.push(a, d, b, b, d, e); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  const t = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .97, metalness: 0 })); t.receiveShadow = true; root.add(t); return t;
}

export function buildWater(root, { x, z, w, l, y, repeat = [20, 20] }) {
  const tex = waterNormal.clone(); tex.needsUpdate = true; tex.repeat.set(repeat[0], repeat[1]);
  const mat = new THREE.MeshStandardMaterial({ color: 0x2f86b3, roughness: .12, metalness: .05, transparent: true, opacity: .86, normalMap: tex, normalScale: new THREE.Vector2(.55, .55) });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l, 1, 1), mat); m.rotation.x = -PI / 2; m.position.set(x, y, z); m.receiveShadow = true; root.add(m);
  waterMats.push(mat);
  m.userData.tick = dt => { tex.offset.x += dt * .012; tex.offset.y += dt * .004; };
  return m;
}
export { std, M };
