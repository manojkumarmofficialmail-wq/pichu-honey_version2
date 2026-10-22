// Shared math, noise, settings and storage helpers (ported from v1).
export const $ = id => document.getElementById(id);
export const PI = Math.PI, TAU = PI * 2;
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
export const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));
export const angDamp = (a, b, l, dt) => { let d = (b - a) % TAU; if (d > PI) d -= TAU; if (d < -PI) d += TAU; return a + d * (1 - Math.exp(-l * dt)); };
export const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > PI) d -= TAU; if (d < -PI) d += TAU; return d; };
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = a => a[Math.random() * a.length | 0];

// seeded random so every level looks the same each time
let _s = 1;
export const seed = n => { _s = n | 0; };
export const srnd = () => { _s |= 0; _s = _s + 0x6D2B79F5 | 0; let t = Math.imul(_s ^ _s >>> 15, 1 | _s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
export const sr = (a, b) => a + srnd() * (b - a);

export function hash2(x, y) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
export function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v) * 2 - 1; }
export function fbm(x, y) { let s = 0, a = .5, f = 1; for (let i = 0; i < 4; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= .5; } return s; }

export const params = new URLSearchParams(location.search);
export const MOBILE = params.has('mobile') || matchMedia('(pointer:coarse)').matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
export const Q = MOBILE
  ? { grass: 14000, trees: .6, shadow: 1024, bloom: false, pr: 1.35, cull: 60 }
  : { grass: 36000, trees: 1, shadow: 2048, bloom: true, pr: 1.6, cull: 85 };
if (params.get('lowfx')) Q.bloom = false;

export const store = {
  get(k, d) { try { const v = localStorage.getItem('pichu_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('pichu_' + k, JSON.stringify(v)); } catch (e) { } }
};

// Difficulty: v1 fields plus the new combat fields
export const DIFFS = {
  kids:   { name: 'Little Explorer', icon: '🧸', hp: 160, enemyDmg: .5, enemyHp: .7, aggro: .75, tele: 1.6, maxAttackers: 1, fast: 900 },
  normal: { name: 'Adventurer',      icon: '🌲', hp: 100, enemyDmg: 1,  enemyHp: 1,  aggro: 1,   tele: 1,   maxAttackers: 2, fast: 600 },
  hard:   { name: 'Brave Hero',      icon: '🐯', hp: 80,  enemyDmg: 1.4, enemyHp: 1.3, aggro: 1.3, tele: .75, maxAttackers: 3, fast: 450 }
};
export const SET = { diff: store.get('diff', 'normal'), voice: store.get('voice', true), vibe: store.get('vibe', true) };
if (!DIFFS[SET.diff]) SET.diff = 'normal';
export const DV = { ...DIFFS[SET.diff] };
export function setDiff(d) { if (!DIFFS[d]) return; SET.diff = d; Object.assign(DV, DIFFS[d]); store.set('diff', d); }

export const buzz = p => { if (SET.vibe && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) { } } };
export const fmtTime = s => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
