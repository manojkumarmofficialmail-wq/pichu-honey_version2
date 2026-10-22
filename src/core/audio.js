// Synthesized audio (no sound files). Ported from v1, plus combat sounds and new music moods.
import { camera } from './engine.js';
import { CAM } from './state.js';
import { clamp, rand, SET } from './utils.js';

export const AU = { ctx: null, master: null, muted: false, ambT: 1 };
export function auInit() {
  if (AU.ctx) { AU.ctx.resume(); return; }
  const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return;
  const ctx = new Ctx(); AU.ctx = ctx;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 3; comp.connect(ctx.destination);
  AU.master = ctx.createGain(); AU.master.gain.value = AU.muted ? 0 : .9; AU.master.connect(comp);
  const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; AU.noise = buf;
  const loop = (type, f, q) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; s.connect(fl).connect(g).connect(AU.master); s.start(); return { g, fl }; };
  AU.wind = loop('lowpass', 380, .6); AU.water = loop('bandpass', 750, .5);
  AU.music = ctx.createGain(); AU.music.gain.value = .5; AU.music.connect(AU.master);
}
export function setMuted(m) { AU.muted = m; if (AU.master) AU.master.gain.value = m ? 0 : .9; if (m && 'speechSynthesis' in window) speechSynthesis.cancel(); }

export function tone(o) {
  const ctx = AU.ctx; if (!ctx) return;
  const t0 = ctx.currentTime + (o.delay || 0), a = o.a ?? .01, dur = o.dur ?? .2, v = o.vol ?? .2;
  const osc = ctx.createOscillator(); osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(o.f0, t0);
  if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t0 + a + dur);
  if (o.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = o.vib[0]; lg.gain.value = o.vib[1]; l.connect(lg).connect(osc.frequency); l.start(t0); l.stop(t0 + a + dur + .1); }
  const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + a); g.gain.exponentialRampToValueAtTime(.0001, t0 + a + dur);
  let n = osc; if (o.filter) { const f = ctx.createBiquadFilter(); f.type = o.filter[0]; f.frequency.value = o.filter[1]; f.Q.value = o.filter[2] ?? 1; n.connect(f); n = f; }
  n.connect(g); let out = g; if (o.pan) { const p = ctx.createStereoPanner(); p.pan.value = clamp(o.pan, -1, 1); g.connect(p); out = p; }
  out.connect(o.dest || AU.master); osc.start(t0); osc.stop(t0 + a + dur + .05);
}
export function nz(o) {
  const ctx = AU.ctx; if (!ctx) return;
  const t0 = ctx.currentTime + (o.delay || 0), a = o.a ?? .005, dur = o.dur ?? .1;
  const s = ctx.createBufferSource(); s.buffer = AU.noise; s.playbackRate.value = o.rate ?? 1;
  const f = ctx.createBiquadFilter(); f.type = o.filter?.[0] ?? 'lowpass'; f.frequency.setValueAtTime(o.filter?.[1] ?? 1000, t0);
  if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t0 + a + dur); f.Q.value = o.filter?.[2] ?? 1;
  const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(o.vol ?? .2, t0 + a); g.gain.exponentialRampToValueAtTime(.0001, t0 + a + dur);
  s.connect(f).connect(g); let out = g; if (o.pan) { const p = ctx.createStereoPanner(); p.pan.value = clamp(o.pan, -1, 1); g.connect(p); out = p; }
  out.connect(AU.master); s.start(t0, Math.random()); s.stop(t0 + a + dur + .05);
}
export function panOf(x, z) {
  const dx = x - camera.position.x, dz = z - camera.position.z;
  const rx = Math.cos(CAM.yaw), rz = -Math.sin(CAM.yaw); const l = Math.hypot(dx, dz) || 1;
  return clamp((dx * rx + dz * rz) / l, -1, 1) * .85;
}
export const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

export const sfx = {
  step(hard) { nz({ dur: .05, vol: hard ? .05 : .035, filter: [hard ? 'bandpass' : 'lowpass', hard ? 2400 : 900, 1.2] }); },
  jump() { tone({ f0: 300, f1: 520, dur: .12, vol: .06 }); },
  land() { nz({ dur: .09, vol: .08, filter: ['lowpass', 500] }); },
  chirp(pan) { const n = 2 + (Math.random() * 4 | 0), f = rand(2600, 4300), v = rand(.02, .045); for (let i = 0; i < n; i++) tone({ f0: f * rand(.9, 1.1), f1: f * rand(1.15, 1.5), dur: rand(.04, .08), a: .008, vol: v, pan, delay: i * rand(.07, .12) }); },
  koel(pan) { tone({ f0: 700, f1: 1100, dur: .25, a: .03, vol: .05, pan }); tone({ f0: 800, f1: 1250, dur: .3, a: .03, vol: .05, pan, delay: .45 }); },
  cricket(pan) { for (let i = 0; i < 3; i++) tone({ type: 'triangle', f0: 4300, dur: .018, a: .004, vol: .018, pan, delay: i * .045 }); },
  bark(pan = 0, vol = .5) { for (let k = 0; k < 2; k++) { const t = k * .22; tone({ type: 'sawtooth', f0: 620, f1: 230, dur: .11, a: .008, vol: vol * .5, pan, delay: t, filter: ['lowpass', 4500, .8] }); nz({ dur: .06, vol: vol * .3, pan, delay: t, filter: ['bandpass', 1500, 1.3] }); } },
  bigBark() { this.bark(0, .8); nz({ dur: .5, vol: .25, filter: ['lowpass', 600], f1: 120 }); tone({ f0: 160, f1: 60, dur: .4, vol: .2 }); },
  collect() { [72, 76, 79, 84].forEach((m, i) => tone({ type: 'triangle', f0: mtof(m), dur: .25, a: .005, vol: .12, delay: i * .07 })); },
  big() { [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => tone({ type: 'triangle', f0: mtof(m), dur: .5, a: .005, vol: .11, delay: i * .09 })); },
  hurt() { tone({ type: 'square', f0: 220, f1: 90, dur: .25, vol: .1, filter: ['lowpass', 800] }); },
  magic() { for (let i = 0; i < 10; i++) tone({ f0: mtof(84 + [0, 4, 7, 11, 14][i % 5]), dur: .4, vol: .05, delay: i * .06 }); },
  // ---- combat ----
  swing(n = 0) { nz({ dur: .12, vol: .1, filter: ['bandpass', 900 + n * 300, 1.4], f1: 3000 + n * 500 }); },
  hit(heavy) { nz({ dur: heavy ? .2 : .1, vol: heavy ? .35 : .22, filter: ['lowpass', heavy ? 700 : 1400] }); tone({ type: 'square', f0: heavy ? 140 : 220, f1: 60, dur: heavy ? .2 : .1, vol: heavy ? .14 : .08, filter: ['lowpass', 900] }); },
  block() { tone({ type: 'triangle', f0: 1200, f1: 900, dur: .12, vol: .1 }); nz({ dur: .06, vol: .1, filter: ['highpass', 3000] }); },
  sling() { tone({ type: 'triangle', f0: 500, f1: 180, dur: .12, vol: .09 }); nz({ dur: .08, vol: .06, filter: ['bandpass', 2500, 2] }); },
  dodge() { nz({ dur: .22, vol: .08, filter: ['bandpass', 600, .8], f1: 1800 }); },
  charge() { tone({ f0: 300, f1: 900, dur: .5, vol: .05, type: 'sawtooth', filter: ['lowpass', 1500] }); },
  smash() { nz({ dur: .5, vol: .4, filter: ['lowpass', 500], f1: 80 }); tone({ f0: 120, f1: 40, dur: .45, vol: .25 }); },
  alert(pan) { tone({ type: 'square', f0: 880, f1: 1320, dur: .08, vol: .05, pan }); },
  grunt(pan) { tone({ type: 'sawtooth', f0: rand(140, 190), f1: 90, dur: .18, vol: .07, pan, filter: ['lowpass', 900] }); },
  ko(pan) { tone({ type: 'sawtooth', f0: 260, f1: 70, dur: .5, vol: .08, pan, filter: ['lowpass', 800] }); nz({ dur: .3, vol: .12, pan, delay: .35, filter: ['lowpass', 400] }); },
  throwS(pan) { nz({ dur: .15, vol: .07, pan, filter: ['bandpass', 1200, 1], f1: 400 }); },
  roar() { tone({ type: 'sawtooth', f0: 110, f1: 70, dur: 1, a: .1, vol: .18, vib: [7, 12], filter: ['lowpass', 700] }); nz({ dur: 1, vol: .15, filter: ['lowpass', 500] }); },
  cage() { nz({ dur: .35, vol: .25, filter: ['lowpass', 1200] }); tone({ f0: 300, f1: 120, dur: .25, vol: .08, type: 'triangle' }); },
  splash() { nz({ dur: .7, vol: .35, filter: ['lowpass', 2400], f1: 400 }); },
};

// Music: Kerala-flavoured pentatonic patterns (Mohanam = 0 2 4 7 9, Hindolam = 0 3 5 8 10)
export const MOODS = {
  menu:   { bpm: 84,  root: 62, scale: [0, 2, 4, 7, 9],  ch: [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]], dens: .35 },
  forest: { bpm: 92,  root: 60, scale: [0, 2, 4, 7, 9],  ch: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], dens: .38, drum: .3 },
  battle: { bpm: 132, root: 57, scale: [0, 3, 5, 8, 10], ch: [[0, 3, 7], [8, 12, 15], [5, 8, 12], [7, 10, 14]], dens: .5, drum: 1 },
  boss:   { bpm: 144, root: 55, scale: [0, 1, 5, 7, 8],  ch: [[0, 3, 7], [1, 5, 8], [8, 12, 15], [7, 10, 14]], dens: .55, drum: 1.3 },
  joy:    { bpm: 112, root: 65, scale: [0, 2, 4, 7, 9],  ch: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]], dens: .55, drum: .5 },
};
export const MUS = { next: 0, step: 0, mood: 'menu' };
export function musicTick() {
  const ctx = AU.ctx; if (!ctx || AU.muted) return;
  const Md = MOODS[MUS.mood], e = 60 / Md.bpm / 2;
  if (MUS.next < ctx.currentTime) MUS.next = ctx.currentTime + .05;
  while (MUS.next < ctx.currentTime + .3) {
    const dl = MUS.next - ctx.currentTime, st = MUS.step, ch = Md.ch[(st / 16 | 0) % Md.ch.length];
    if (st % 16 === 0) ch.forEach(n => tone({ type: 'triangle', f0: mtof(Md.root - 12 + n), dur: e * 15, a: e * 4, vol: .026, delay: dl, filter: ['lowpass', 900, .5], dest: AU.music }));
    if (st % 2 === 0 && Math.random() < Md.dens) { const n = Md.scale[Math.random() * Md.scale.length | 0] + (Math.random() < .3 ? 12 : 0); tone({ f0: mtof(Md.root + n), dur: e * 3, a: .01, vol: .042, delay: dl, dest: AU.music }); }
    if (st % 8 === 0) tone({ f0: mtof(Md.root - 24 + ch[0]), dur: e * 5, a: .03, vol: .05, delay: dl, dest: AU.music });
    // chenda-like drum pattern for battle moods
    if (Md.drum) {
      const pat = [1, 0, .5, 0, .8, .4, .5, 0];
      const v = pat[st % 8] * Md.drum;
      if (v > 0) { tone({ f0: 150, f1: 55, dur: .12, a: .003, vol: .07 * v, delay: dl, dest: AU.music }); if (st % 4 === 2) nz({ dur: .05, vol: .04 * v, delay: dl, filter: ['highpass', 3000] }); }
    }
    MUS.step++; MUS.next += e;
  }
}

let VOICES = [];
if ('speechSynthesis' in window) { VOICES = speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => VOICES = speechSynthesis.getVoices(); }
export function speak(text, who) {
  if (!('speechSynthesis' in window) || AU.muted || !SET.voice) return;
  try {
    const u = new SpeechSynthesisUtterance(text.replace(/<[^>]+>/g, '').replace(/[^\w\s.,!?'’\-]/g, ''));
    const en = VOICES.filter(v => /^en/i.test(v.lang));
    const pref = en.find(v => /india|en-in|heera|ravi/i.test(v.name + v.lang)) || en.find(v => /female|zira|samantha|aria|jenny|google us english/i.test(v.name)) || en[0];
    if (pref) u.voice = pref;
    const pp = { pichu: [1.7, 1.05], narrator: [1.05, .95], ranger: [1.1, 1], villain: [.6, .9] }[who] || [1, 1];
    u.pitch = pp[0]; u.rate = pp[1]; speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch (e) { }
}
