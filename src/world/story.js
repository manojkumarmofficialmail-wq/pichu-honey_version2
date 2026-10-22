// The v2 story thread: Kaala's gang stole Honey's smallest puppy, Mittu.
// Each level hides one clue; Honey's SNIFF shows a glowing paw trail to the clue (or the next goal).
import { THREE, M, S, std, TEX, canvasTex, scene } from '../core/engine.js';
import { G, P, W } from '../core/state.js';
import { PI, TAU, clamp, rand, buzz } from '../core/utils.js';
import { sfx, tone } from '../core/audio.js';
import { emit } from './particles.js';
import { dialog, popText, hud, cooldownUI } from '../core/ui.js';
import { makeQuad, animQuad, QUADS } from '../actors/quad.js';
import { HN } from '../actors/honey.js';

/* ---------- puppies ---------- */
export function makePuppy(bandana = 0x3a8ad8) {
  const q = makeQuad({ ...QUADS.honey, color: 0xe8b060, belly: 0xf8e0b0, earColor: 0xd09048, legLen: .2, legR: .04, bodyR: .11, bodyL: .2, neckLen: .08, headR: .11, snoutL: .06, tailN: 3, tailSeg: .06, tailR: .03 });
  const b = M(new THREE.TorusGeometry(.07, .022, 6, 14), std(bandana, { roughness: .6 }), 0, .03, 0, q.neck); b.rotation.x = PI / 2;
  q.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return q;
}
export function puppyWhine(vol = .2) { tone({ f0: 1300, f1: 1800, dur: .3, a: .04, vol, vib: [10, 60] }); tone({ f0: 1700, f1: 1200, dur: .35, a: .04, vol: vol * .8, delay: .38, vib: [9, 60] }); }

/* ---------- clue items ---------- */
const CLUES = {
  bell:    { icon: '🔔', name: "Mittu's bell" },
  blanket: { icon: '🧣', name: "Mittu's blanket" },
  radio:   { icon: '📻', name: "A poacher's radio" },
  bowl:    { icon: '🥣', name: "Mittu's food bowl" },
  toy:     { icon: '🧸', name: "Mittu's chew toy" },
  print:   { icon: '🐾', name: 'Tiny paw prints' },
};
function clueModel(kind) {
  const g = new THREE.Group();
  if (kind === 'bell') { M(new THREE.SphereGeometry(.12, 12, 8, 0, TAU, 0, PI * .6), std(0xf2c230, { metalness: .8, roughness: .25 }), 0, .05, 0, g); M(new THREE.TorusGeometry(.13, .02, 6, 16), std(0x3a8ad8), 0, .14, 0, g).rotation.x = PI / 2; }
  else if (kind === 'blanket') { const m = M(new THREE.BoxGeometry(.45, .04, .35), std(0x3a8ad8, { roughness: 1 }), 0, 0, 0, g); m.rotation.z = .2; M(new THREE.BoxGeometry(.46, .045, .06), std(0xffffff), 0, .005, .08, g); }
  else { M(new THREE.BoxGeometry(.16, .26, .08), std(0x222222, { roughness: .5 }), 0, .13, 0, g); M(new THREE.CylinderGeometry(.012, .012, .2, 5), std(0x444444), .05, .34, 0, g); M(S(.025, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff3030 }), -.04, .22, .045, g); }
  const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0x8ad0ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .8 })); gl.scale.setScalar(1.4); gl.position.y = .15; g.add(gl);
  return g;
}
export class Clue {
  constructor(root, x, z, kind, onFind) {
    this.x = x; this.z = z; this.kind = kind; this.found = false; this.onFind = onFind; this.info = CLUES[kind];
    this.g = clueModel(kind); this.base = W.height(x, z); this.g.position.set(x, this.base + .4, z); root.add(this.g);
    G.clueIcon = this.info.icon; G.clue = false; hud();
  }
  tick(dt, t) {
    if (this.found) return;
    this.g.rotation.y += dt * 1.5; this.g.position.y = this.base + .45 + Math.sin(t * 2) * .08;
    if (G.mode === 'play' && Math.hypot(P.pos.x - this.x, P.pos.z - this.z) < 1.4) {
      this.found = true; G.clue = true; this.g.visible = false; sfx.big(); buzz([40, 30, 80]); puppyWhine(.12);
      emit(TEX.spark, this.g.position, 30, { add: true, color: 0x8ad0ff, size: .35, speed: 3, g: -1, life: 1.1 });
      popText(`${this.info.icon} Clue found: ${this.info.name}!`, 'rgba(140,210,255,.9)'); hud();
      this.onFind && this.onFind(this);
    }
  }
}

/* ---------- SNIFF: Honey follows Mittu's scent and leaves glowing paw prints ---------- */
const pawTex = canvasTex(64, 64, g => { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(32, 42, 13, 11, 0, 0, TAU); g.fill(); [[15, 25, 6, 8, -.4], [26, 14, 6, 8, -.15], [38, 14, 6, 8, .15], [49, 25, 6, 8, .4]].forEach(([x, y, a, b, r]) => { g.beginPath(); g.ellipse(x, y, a, b, r, 0, TAU); g.fill(); }); });
pawTex.userData.shared = true;
const PAW = [], pawGeo = new THREE.PlaneGeometry(.32, .32).rotateX(-PI / 2); pawGeo.userData.shared = true;
let sniffCD = 0, trail = null;
export function doSniff(target) {
  if (G.mode !== 'play' || G.busy || G.paused || sniffCD > 0) return;
  sniffCD = 5; HN.sniffT = 1.6; sfx.bark(0, .15);
  if (!target) { dialog('Pichu', 'Honey can\'t smell anything new here.', 2); return; }
  // lay a paw trail from Pichu toward the target (up to 45 m)
  clearTrail(); const dx = target.x - P.pos.x, dz = target.z - P.pos.z, d = Math.hypot(dx, dz), n = Math.min(45, Math.floor(d / 1.1));
  trail = { t: 0, pts: [] }; const ang = Math.atan2(dx, dz);
  for (let i = 1; i <= n; i++) {
    const k = i * 1.1, side = (i % 2 ? .14 : -.14), x = P.pos.x + dx / d * k + Math.cos(ang) * side, z = P.pos.z + dz / d * k - Math.sin(ang) * side;
    const m = new THREE.Mesh(pawGeo, new THREE.MeshBasicMaterial({ map: pawTex, color: 0x8ad0ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    m.position.set(x, W.height(x, z) + .05, z); m.rotation.y = ang + PI; scene.add(m); PAW.push(m); trail.pts.push(m);
  }
  dialog('Pichu', d < 4 ? 'Honey says it\'s right here!' : target.clue ? 'Honey smells Mittu! Follow the blue paw prints!' : 'Honey smells the way forward — follow the paw prints!', 2.6);
}
function clearTrail() { for (const m of PAW) { m.removeFromParent(); m.material.dispose(); } PAW.length = 0; trail = null; }
export function updateSniff(dt) {
  sniffCD -= dt; cooldownUI('bSniff', sniffCD / 5);
  if (!trail) return; trail.t += dt;
  trail.pts.forEach((m, i) => { const appear = trail.t * 14 - i, fade = trail.t > 7 ? 1 - (trail.t - 7) / 1.5 : 1; m.material.opacity = clamp(appear, 0, 1) * fade * (.6 + .3 * Math.sin(trail.t * 6 + i * .5)); });
  if (trail.t > 8.5) clearTrail();
}
export function resetStory() { clearTrail(); sniffCD = 0; G.clue = false; G.clueIcon = null; }
