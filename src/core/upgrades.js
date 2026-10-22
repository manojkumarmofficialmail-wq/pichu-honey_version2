// Upgrade shop: cardamom pods are saved in a bank and spent on permanent upgrades.
import { store } from './utils.js';

export const UPG_DEF = [
  { id: 'stick',  icon: '🪵', name: 'Stick Power',   desc: 'Stick hits +20% damage',            cost: [3, 5, 8] },
  { id: 'heart',  icon: '❤️', name: 'Big Heart',     desc: '+20 max health',                    cost: [3, 5, 8] },
  { id: 'sling',  icon: '🎯', name: 'Sharp Shooter', desc: '+4 pebble damage, +5 pebbles, +10 bag size', cost: [2, 4, 6] },
  { id: 'bark',   icon: '🐶', name: 'Super Bark',    desc: 'Bark recharges 2s faster, reaches 1m further', cost: [3, 5, 8] },
];
export const UPG = Object.assign({ stick: 0, heart: 0, sling: 0, bark: 0 }, store.get('v2_upg', {}));
export const BANK = { pods: store.get('v2_bank', 0), best: store.get('v2_podbest', {}) };

export const upg = {
  stickMul: () => 1 + .2 * UPG.stick,
  maxHp: base => base + 20 * UPG.heart,
  slingDmg: () => 9 + 4 * UPG.sling,
  startAmmo: () => 15 + 5 * UPG.sling,
  ammoCap: () => 30 + 10 * UPG.sling,
  barkCD: () => 10 - 2 * UPG.bark,
  barkR: () => 6.5 + UPG.bark,
};
export function nextCost(id) { const d = UPG_DEF.find(u => u.id === id); return d.cost[UPG[id]] ?? null; }
export function buy(id) {
  const c = nextCost(id); if (c === null || BANK.pods < c) return false;
  BANK.pods -= c; UPG[id]++; save(); return true;
}
// only pods beyond your previous best for that level go into the bank (no farming)
export function depositPods(levelId, pods) {
  const prev = BANK.best[levelId] || 0, gain = Math.max(0, pods - prev);
  if (pods > prev) BANK.best[levelId] = pods; BANK.pods += gain; save(); return gain;
}
function save() { store.set('v2_upg', UPG); store.set('v2_bank', BANK.pods); store.set('v2_podbest', BANK.best); }
