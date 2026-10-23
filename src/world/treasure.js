// Treasure hunting: golden keys, locked gates, treasure chests and torn map pieces.
import { THREE, M, S, B, CY, std, TEX } from '../core/engine.js';
import { G, P, W } from '../core/state.js';
import { PI, TAU, rand, smooth, buzz, MOBILE } from '../core/utils.js';
import { sfx } from '../core/audio.js';
import { emit } from './particles.js';
import { popText, hud, dialog } from '../core/ui.js';
import { spawnPickup } from './pickups.js';
import { addBox } from './terrain.js';

const at = (root, x, z, ry = 0, y) => { const g = new THREE.Group(); g.position.set(x, y ?? W.height(x, z), z); g.rotation.y = ry; root.add(g); return g; };
const glow = (c, s) => { const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .7 })); g.scale.setScalar(s); return g; };

/* ---------- golden key ---------- */
export class KeyItem {
  constructor(root, x, z, opts = {}) {
    this.x = x; this.z = z; this.got = false; this.hidden = !!opts.hidden; this.onGet = opts.onGet; this.name = opts.name || 'Golden Key';
    this.base = opts.y ?? W.height(x, z); this.g = new THREE.Group(); root.add(this.g);
    const gold = std(0xf2c230, { metalness: .85, roughness: .25, emissive: 0x5a3a00, emissiveIntensity: .4 });
    M(new THREE.TorusGeometry(.13, .035, 8, 18), gold, 0, .22, 0, this.g); M(B(.05, .38, .05), gold, 0, -.06, 0, this.g);
    M(B(.14, .05, .05), gold, .06, -.18, 0, this.g); M(B(.1, .05, .05), gold, .05, -.08, 0, this.g);
    this.g.add(glow(0xffe08a, 1.4)); this.g.visible = !this.hidden;
  }
  reveal() { this.hidden = false; this.g.visible = true; emit(TEX.spark, new THREE.Vector3(this.x, this.base + 1, this.z), 24, { add: true, color: 0xffe08a, size: .35, speed: 3, g: -1, life: 1 }); sfx.magic(); }
  tick(dt, t) {
    if (this.got || this.hidden) return;
    this.g.position.set(this.x, this.base + .8 + Math.sin(t * 2.2) * .12, this.z); this.g.rotation.y += dt * 2;
    if (G.mode === 'play' && Math.hypot(P.pos.x - this.x, P.pos.z - this.z) < 1.3 && Math.abs(P.pos.y - this.base) < 1.6) {
      this.got = true; this.g.visible = false; G.keys = (G.keys || 0) + 1; sfx.big(); buzz([40, 30, 80]); hud();
      emit(TEX.spark, this.g.position, 30, { add: true, color: 0xffe08a, size: .35, speed: 3, g: -1, life: 1 }); popText(`🔑 ${this.name}!`, 'rgba(255,220,120,.95)');
      this.onGet && this.onGet(this);
    }
  }
}

/* ---------- locked wooden gate ---------- */
export class KeyGate {
  constructor(root, x, z, width = 8) {
    this.x = x; this.z = z; this.open = false; this.t = 0; this.g = at(root, x, z, 0); this.w = width;
    const wood = std(0x7a5432, { roughness: .9 }), dark = std(0x4a3220), iron = std(0x6a6a6a, { metalness: .6, roughness: .4 });
    for (const s of [-1, 1]) M(B(.4, 3.2, .4), dark, s * width / 2, 1.6, 0, this.g);
    M(B(width + .6, .4, .5), dark, 0, 3.2, 0, this.g);
    this.doors = [-1, 1].map(s => {
      const d = new THREE.Group(); d.position.set(s * width / 2, 0, 0); this.g.add(d);
      for (let i = 0; i < 5; i++) M(B(width / 10 - .04, 2.6, .12), wood, -s * (width / 20 + i * width / 10), 1.4, 0, d);
      for (const y of [.6, 2.2]) M(B(width / 2 - .1, .16, .16), dark, -s * width / 4, y, .08, d);
      return { d, s };
    });
    this.lock = M(B(.4, .45, .2), iron, 0, 1.4, .2, this.g); M(new THREE.TorusGeometry(.13, .04, 6, 12, PI), iron, 0, 1.66, .2, this.g);
    this.mark = glow(0xffe08a, 1); this.mark.position.set(0, 1.5, .4); this.g.add(this.mark);
  }
  canUse() { return !this.open && Math.hypot(P.pos.x - this.x, P.pos.z - this.z) < 3.4; }
  label() { return (G.keys || 0) > 0 ? (MOBILE ? 'Tap ✋ to unlock the gate' : 'Press E to unlock the gate') : 'Locked! Find the key 🔑'; }
  use() {
    if (this.open) return false;
    if (!(G.keys > 0)) { dialog('Pichu', 'It\'s locked! There must be a key somewhere around here…', 2.6); return true; }
    G.keys--; this.openUp(); hud(); popText('🔓 Unlocked!'); return true;
  }
  openUp() { if (this.open) return; this.open = true; this.t = 0; sfx.cage(); sfx.big(); this.lock.visible = false; this.mark.visible = false; }
  update(dt) { if (!this.open || this.t > 1.2) return; this.t += dt; const k = smooth(0, 1, this.t); for (const { d, s } of this.doors) d.rotation.y = -s * k * 1.7; }
}

/* ---------- treasure chest (open with E, or hit it) ---------- */
export class Chest {
  constructor(root, x, z, opts = {}) {
    this.x = x; this.z = z; this.opened = false; this.pods = opts.pods ?? 2; this.root = root;
    G.podsTotal += this.pods; G.treasureTotal = (G.treasureTotal || 0) + 1;
    this.g = at(root, x, z, opts.ry ?? rand(0, TAU)); const wood = std(0x8a5a2a, { roughness: .8 }), gold = std(0xd8a830, { metalness: .8, roughness: .3 });
    M(B(.9, .5, .6), wood, 0, .25, 0, this.g); for (const s of [-1, 1]) M(B(.06, .52, .62), gold, s * .3, .26, 0, this.g);
    this.lid = new THREE.Group(); this.lid.position.set(0, .5, -.3); this.g.add(this.lid);
    M(new THREE.CylinderGeometry(.3, .3, .9, 10, 1, false, 0, PI).rotateZ(PI / 2).rotateY(PI / 2).translate(0, 0, .3), wood, 0, 0, 0, this.lid);
    M(B(.12, .14, .06), gold, 0, -.02, .62, this.lid);
    this.spark = glow(0xffe08a, .9); this.spark.position.y = 1; this.g.add(this.spark);
    addBox(x - .5, z - .4, x + .5, z + .4);
  }
  canUse() { return !this.opened && Math.hypot(P.pos.x - this.x, P.pos.z - this.z) < 2; }
  label() { return MOBILE ? 'Tap ✋ to open the treasure chest' : 'Press E to open the treasure chest'; }
  use() {
    if (this.opened) return false; this.opened = true; this.t = 0; G.treasure = (G.treasure || 0) + 1; sfx.collect(); sfx.big(); this.spark.visible = false;
    emit(TEX.spark, new THREE.Vector3(this.x, this.g.position.y + .7, this.z), 26, { add: true, color: 0xffe08a, size: .3, speed: 3, g: -2, life: 1 });
    for (let i = 0; i < this.pods; i++) setTimeout(() => { const p = spawnPickup('pod', this.x, this.z, this.root, { pop: true }); G.podsTotal--; }, 150 + i * 120);
    setTimeout(() => spawnPickup(Math.random() < .5 ? 'heal' : 'ammo', this.x, this.z, this.root, { pop: true, amt: 20 }), 450);
    popText(`💰 Treasure ${G.treasure}/${G.treasureTotal}`, 'rgba(255,220,120,.95)'); hud(); return true;
  }
  tick(dt, t) { if (this.opened) { this.t += dt; this.lid.rotation.x = -Math.min(1.9, this.t * 5); } else this.spark.material.opacity = .4 + .3 * Math.sin(t * 3 + this.x); }
}

/* ---------- torn pieces of the ranger's map ---------- */
export class MapPiece {
  constructor(root, x, z, onGet, opts = {}) {
    this.x = x; this.z = z; this.got = false; this.onGet = onGet; this.base = opts.y ?? W.height(x, z);
    this.g = new THREE.Group(); root.add(this.g);
    const tex = new THREE.CanvasTexture((() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#e8d8a8'; g.beginPath(); g.moveTo(4, 8); g.lineTo(58, 4); g.lineTo(62, 50); g.lineTo(30, 60); g.lineTo(6, 56); g.closePath(); g.fill(); g.strokeStyle = '#8a5a2a'; g.lineWidth = 3; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(10, 50); g.bezierCurveTo(25, 30, 40, 40, 52, 14); g.stroke(); g.fillStyle = '#c02a2a'; g.font = 'bold 18px Arial'; g.fillText('X', 44, 22); return c; })());
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(.55, .55), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide })); this.g.add(m); this.g.add(glow(0xfff0b0, 1.1));
  }
  tick(dt, t) {
    if (this.got) return; this.g.position.set(this.x, this.base + .8 + Math.sin(t * 2) * .1, this.z); this.g.rotation.y += dt * 1.6;
    if (G.mode === 'play' && Math.hypot(P.pos.x - this.x, P.pos.z - this.z) < 1.3 && Math.abs(P.pos.y - this.base) < 1.6) {
      this.got = true; this.g.visible = false; G.mapPieces = (G.mapPieces || 0) + 1; sfx.collect(); hud();
      popText(`🗺️ Map piece ${G.mapPieces}/${G.mapTotal || 3}`, 'rgba(255,240,180,.95)'); this.onGet && this.onGet(this);
    }
  }
}
export function resetTreasure() { G.keys = 0; G.treasure = 0; G.treasureTotal = 0; G.mapPieces = 0; G.mapTotal = 0; }
