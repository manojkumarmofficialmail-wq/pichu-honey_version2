// Shared game state used by every module.
import * as THREE from 'three';

export const G = {
  mode: 'menu',        // menu | cine | play | end
  paused: false, busy: false,
  level: null,         // current level module
  stage: 0,            // objective index inside the level
  time: 0, hits: 0, kos: 0, freed: 0, pods: 0, podsTotal: 0,
  hitStop: 0, shake: 0,
};

// Player
export const P = {
  pos: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, -1), kb: new THREE.Vector3(),
  lastSafe: new THREE.Vector3(), vy: 0, yaw: Math.PI, ground: true, speed: 0, airT: 0, jumpBuf: 0,
  hp: 100, maxHp: 100, stamina: 100, ammo: 15, invul: 0, hurtT: 0, landT: 0, callT: 0,
  // combat state
  act: null,       // current action: {type, t, ...}
  combo: 0, comboBuf: false, charge: 0, dodgeDir: new THREE.Vector3(),
};

export const CAM = { yaw: 0, pitch: .32, dist: 5.6, lim: 1 };
export const CC = { active: true, pos: new THREE.Vector3(), look: new THREE.Vector3(), rate: 3, lookCur: new THREE.Vector3() };
export const K = {};
export const JOY = { active: false, id: null, x: 0, y: 0, cx: 0, cy: 0 };
export const DRAG = { on: false, last: 0 };

// Runtime info about the loaded level's world (filled by the level loader)
export const W = {
  height: () => 0, water: -100, bounds: { x0: -60, x1: 60, z0: -130, z1: 130 },
  minZ: () => -1e9,       // progress gate
  onGate: null,
  maxZ: null,
  walkable: () => true,   // false where the water is too deep to walk
  platforms: [],          // moving rafts
  ladders: [],            // climbable vines
  onClimbTop: null,
};
