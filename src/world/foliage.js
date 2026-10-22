// Kerala plants built from simple shapes and drawn with instancing:
// coconut palm, areca palm, rainforest tree, bamboo, banana, granite rocks, ferns and grass.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { THREE, std, inst, jitter, windify, hsl } from '../core/engine.js';
import { PI, TAU, sr, srnd } from '../core/utils.js';
import { addOb } from './terrain.js';

const frond = (len, wid, droop) => {
  const p = new THREE.PlaneGeometry(wid, len, 4, 8), a = p.attributes.position;
  for (let i = 0; i < a.count; i++) {
    const t = a.getY(i) / len + .5, x = a.getX(i) * Math.sin(t * PI) * 1.2;
    const y = Math.sin(t * PI * .55) * len * .35 - t * t * droop, z = t * len;
    a.setXYZ(i, x, y + Math.abs(x) * .25, z);
  }
  p.computeVertexNormals(); return p;
};
const blob = (r, x, y, z) => jitter(new THREE.IcosahedronGeometry(r, 1), .28).translate(x, y, z);

function palmGeos(lean, h, nFronds, len, wid, droop) {
  const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(lean * .25, h * .35, 0), new THREE.Vector3(lean * .7, h * .7, 0), new THREE.Vector3(lean, h, 0)];
  const cur = new THREE.CatmullRomCurve3(pts); const trunk = new THREE.TubeGeometry(cur, 10, .13, 6);
  // taper the trunk
  const a = trunk.attributes.position; for (let i = 0; i < a.count; i++) { const y = a.getY(i) / h; const k = 1.25 - y * .45; const c = cur.getPoint(Math.min(Math.max(y, 0), 1)); a.setX(i, c.x + (a.getX(i) - c.x) * k); a.setZ(i, c.z + (a.getZ(i) - c.z) * k); }
  trunk.computeVertexNormals();
  const fr = []; for (let k = 0; k < nFronds; k++) { const f = frond(len, wid, droop); f.rotateX(-.25 + (k % 2) * .2); f.rotateY(k / nFronds * TAU + (k % 3) * .2); f.translate(lean, h, 0); fr.push(f); }
  const nuts = []; for (let k = 0; k < 5; k++) { const ang = k / 5 * TAU; nuts.push(new THREE.SphereGeometry(.11, 7, 6).translate(lean + Math.cos(ang) * .18, h - .18, Math.sin(ang) * .18)); }
  return { trunk, crown: mergeGeometries(fr), nuts: mergeGeometries(nuts) };
}

export class Flora {
  constructor() { this.L = {}; }
  push(k, t) { (this.L[k] ||= []).push(t); }
  coconut(x, y, z, s = 1) { const v = srnd() * 3 | 0; const ry = sr(0, TAU); const t = { x, y: y - .1, z, ry, s }; this.push('coco' + v, t); this.push('cocoF' + v, { ...t, c: hsl(sr(.22, .28), sr(.5, .65), sr(.28, .36)) }); this.push('cocoN' + v, t); addOb(x, z, .25 * s, 0); }
  areca(x, y, z, s = 1) { const ry = sr(0, TAU); const t = { x, y: y - .1, z, ry, s }; this.push('areca', t); this.push('arecaF', { ...t, c: hsl(sr(.24, .3), .55, sr(.26, .34)) }); addOb(x, z, .18 * s, 0); }
  rain(x, y, z, s = 1, c) { const ry = sr(0, TAU); this.push('rainT', { x, y: y - .1, z, ry, s, c: hsl(.08, .2, sr(.32, .42)) }); this.push('rainF', { x, y: y - .1, z, ry, s, c: c || hsl(sr(.25, .33), sr(.4, .6), sr(.16, .26)) }); addOb(x, z, .45 * s, 2.6 * s); }
  bamboo(x, y, z, s = 1) { const ry = sr(0, TAU); this.push('bambooS', { x, y: y - .1, z, ry, s, c: hsl(sr(.17, .22), .5, sr(.38, .48)) }); this.push('bambooL', { x, y: y - .1, z, ry, s, c: hsl(sr(.2, .26), .55, sr(.3, .4)) }); addOb(x, z, .6 * s, 1.5 * s); }
  banana(x, y, z, s = 1) { const ry = sr(0, TAU); this.push('banT', { x, y, z, ry, s }); this.push('banL', { x, y, z, ry, s, c: hsl(sr(.22, .27), .6, sr(.32, .4)) }); addOb(x, z, .2 * s); }
  rock(x, y, z, s, solid = true) { this.push('rock', { x, y: y + s * .15, z, ry: sr(0, TAU), rx: sr(-.3, .3), sx: s * sr(.9, 1.3), sy: s * sr(.55, .9), sz: s * sr(.9, 1.3), c: srnd() < .25 ? hsl(.22, .2, sr(.32, .42)) : hsl(.08, .06, sr(.4, .55)) }); if (solid && s > .5) addOb(x, z, s * .85, s > 1 ? s * 1.3 : 0); }
  fern(x, y, z, s = 1) { this.push('fern', { x, y, z, ry: sr(0, TAU), s, c: hsl(sr(.25, .32), .5, sr(.2, .3)) }); }
  bush(x, y, z, s = 1, c) { this.push('bush', { x, y: y + s * .3, z, ry: sr(0, TAU), sx: s * 1.2, sy: s * .75, sz: s * 1.1, c: c || hsl(sr(.24, .32), .45, sr(.18, .28)) }); }
  tea(x, y, z, s = 1, ry = 0) { this.push('tea', { x, y: y + .15 * s, z, ry, sx: s * 1.1, sy: s * .55, sz: s * .7, c: hsl(sr(.25, .3), sr(.55, .7), sr(.3, .4)) }); }
  silverOak(x, y, z, s = 1) { const ry = sr(0, TAU); this.push('oakT', { x, y: y - .1, z, ry, s, c: hsl(.08, .15, sr(.35, .45)) }); this.push('oakF', { x, y: y - .1, z, ry, s, c: hsl(sr(.2, .26), .35, sr(.28, .36)) }); addOb(x, z, .2 * s, 1.6 * s); }
  kurinji(x, y, z, s = 1) { this.push('kur', { x, y: y + .25 * s, z, ry: sr(0, TAU), sx: s * .7, sy: s * .45, sz: s * .7, c: hsl(sr(.72, .78), sr(.45, .65), sr(.5, .62)) }); }
  grass(x, y, z, h, c) { this.push('grass', { x, y: y - .02, z, ry: sr(0, PI), rx: sr(-.2, .2), rz: sr(-.2, .2), sx: sr(.55, .95), sy: h, sz: 1, c }); }
  flush(root) {
    const L = this.L, G = Flora.geos();
    const white = std(0xffffff, { roughness: .9 });
    for (let v = 0; v < 3; v++) {
      if (L['coco' + v]) { inst(G.palm[v].trunk, std(0x8a7560, { roughness: 1 }), L['coco' + v], root); inst(G.palm[v].crown, G.frondMat, L['cocoF' + v], root, true, true); inst(G.palm[v].nuts, std(0x7a5a24, { roughness: .7 }), L['cocoN' + v], root, false); }
    }
    if (L.areca) { inst(G.areca.trunk, std(0x9a9a88, { roughness: .9 }), L.areca, root); inst(G.areca.crown, G.frondMat, L.arecaF, root); }
    if (L.rainT) { inst(G.rainT, white, L.rainT, root); inst(G.rainF, G.leafMat, L.rainF, root); }
    if (L.bambooS) { inst(G.bambooS, G.bambooMat, L.bambooS, root); inst(G.bambooL, G.leafMat2, L.bambooL, root); }
    if (L.banT) { inst(G.banT, std(0x7f9a4a, { roughness: .8 }), L.banT, root); inst(G.banL, G.frondMat, L.banL, root); }
    if (L.rock) inst(G.rock, std(0xffffff, { flatShading: true, roughness: .9 }), L.rock, root);
    if (L.fern) inst(G.fern, G.fernMat, L.fern, root, false, true);
    if (L.bush) inst(G.bush, G.bushMat, L.bush, root);
    if (L.grass) inst(G.grass, G.grassMat, L.grass, root, false, true);
    if (L.tea) inst(G.bush, G.teaMat, L.tea, root, true, true);
    if (L.oakT) { inst(G.oakT, white, L.oakT, root); inst(G.oakF, G.leafMat, L.oakF, root); }
    if (L.kur) inst(G.bush, G.kurMat, L.kur, root, false, true);
    this.L = {};
  }
  static geos() {
    if (Flora._g) return Flora._g;
    const shared = g => { g.userData.shared = true; return g; };
    const palm = [0, 1, 2].map(i => { const p = palmGeos([.6, 1.4, 2.4][i], [7, 8.5, 9.5][i], 12, 2.6, .55, 1.4); for (const k in p) shared(p[k]); return p; });
    const ar = palmGeos(.15, 9, 8, 1.7, .4, .9); for (const k in ar) shared(ar[k]);
    const rainT = shared(mergeGeometries([new THREE.CylinderGeometry(.28, .5, 9, 8).translate(0, 4.5, 0), ...[0, 1, 2, 3].map(k => new THREE.BoxGeometry(.12, 1.4, 1).translate(0, .6, .55).rotateY(k * PI / 2 + .4)), new THREE.CylinderGeometry(.08, .14, 3, 5).rotateZ(-.8).translate(1, 8, 0), new THREE.CylinderGeometry(.08, .14, 3, 5).rotateZ(.8).translate(-1, 8.3, .2)]));
    const rainF = shared(mergeGeometries([blob(2.6, 0, 10, 0), blob(2, 1.9, 9.2, .5), blob(2, -1.8, 9.5, -.5), blob(1.8, .3, 11.6, .2), blob(1.7, -.4, 9, 1.6), blob(1.6, .5, 9.2, -1.6), blob(1.4, 2.6, 8.4, -1)]));
    const canes = []; const lv = [];
    for (let k = 0; k < 9; k++) { const a = k / 9 * TAU, r = .25 + (k % 3) * .12, h = 6 + (k % 4); const c = new THREE.CylinderGeometry(.05, .07, h, 5).translate(0, h / 2, 0); c.rotateZ(Math.cos(a) * .18); c.rotateX(Math.sin(a) * .18); c.translate(Math.cos(a) * r, 0, Math.sin(a) * r); canes.push(c); lv.push(blob(.8, Math.cos(a) * (r + 1.1), h - .3, Math.sin(a) * (r + 1.1)).scale(1, .55, 1)); }
    const bambooS = shared(mergeGeometries(canes)), bambooL = shared(mergeGeometries(lv));
    const banT = shared(new THREE.CylinderGeometry(.12, .16, 1.8, 7).translate(0, .9, 0));
    const bl = []; for (let k = 0; k < 7; k++) { const f = frond(1.5, .55, .6); f.rotateX(-.6); f.rotateY(k / 7 * TAU); f.translate(0, 1.7, 0); bl.push(f); } const banL = shared(mergeGeometries(bl));
    const rock = shared(jitter(new THREE.DodecahedronGeometry(1, 1), .35));
    const fr = []; for (let k = 0; k < 7; k++) { const p = new THREE.PlaneGeometry(.22, 1, 1, 5), a = p.attributes.position; for (let i = 0; i < a.count; i++) { const t = a.getY(i) + .5, x = a.getX(i) * (1 - t * .8); a.setXYZ(i, x, Math.sin(t * PI * .75) * .42, t * .85); } p.rotateY(k / 7 * TAU + .2); fr.push(p); }
    const fern = shared(mergeGeometries(fr)); fern.computeVertexNormals();
    const bush = shared(jitter(new THREE.IcosahedronGeometry(1, 1), .3));
    const grass = new THREE.BufferGeometry();
    grass.setAttribute('position', new THREE.Float32BufferAttribute([-.05, 0, 0, .05, 0, 0, -.034, .4, 0, .034, .4, 0, -.014, .75, 0, .014, .75, 0, 0, 1, 0], 3));
    grass.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    grass.setAttribute('color', new THREE.Float32BufferAttribute([.55, .55, .55, .55, .55, .55, .82, .78, .78, .78, .78, .78, 1.05, 1.05, 1.05, 1.05, 1.05, 1.05, 1.25, 1.25, 1.25], 3));
    grass.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5, 4, 5, 6]); shared(grass);
    const oakT = shared(new THREE.CylinderGeometry(.12, .2, 11, 6).translate(0, 5.5, 0));
    const oakF = shared(mergeGeometries([blob(1.2, 0, 10, 0), blob(1, .5, 8.8, .3), blob(1, -.4, 9, -.3), blob(.9, 0, 11.2, 0), blob(.8, .3, 7.6, -.4)]).scale(1, 1.1, 1));
    const sm = m => { m.userData.shared = true; return m; };
    Flora._g = {
      oakT, oakF, palm, areca: ar, rainT, rainF, bambooS, bambooL, banT, banL, rock, fern, bush, grass,
      frondMat: sm(windify(new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: .8 }), .004, 5)),
      leafMat: sm(windify(new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: .85 }), .002, 7)),
      leafMat2: sm(windify(new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: .85 }), .006, 2)),
      bambooMat: sm(windify(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .6 }), .003, 1)),
      fernMat: sm(windify(new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: .8 }), .06, 0)),
      bushMat: sm(windify(new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: .85 }), .02, 0)),
      teaMat: sm(new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: .8 })),
      kurMat: sm(windify(new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: .7 }), .03, 0)),
      grassMat: sm(windify(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), .2, 0)),
    };
    return Flora._g;
  }
}
