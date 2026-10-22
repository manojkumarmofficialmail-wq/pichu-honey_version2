// Simple cutscene runner (ported from v1): a list of timed steps that move the camera and characters.
import { $ } from './utils.js';
import { G, CC } from './state.js';
import { hideDialog } from './ui.js';

let cine = null;
export const cineActive = () => !!cine;
export function runCine(steps, done, skipFn) {
  G.mode = 'cine'; CC.active = true; cine = { steps, i: -1, t: 0, done, skipFn };
  $('skip').style.display = 'block'; document.body.classList.add('cine'); nextStep();
}
function nextStep() {
  cine.i++; cine.t = 0; const s = cine.steps[cine.i];
  if (!s) { const d = cine.done; end(); d && d(); return; }
  s.start && s.start();
}
function end() { cine = null; $('skip').style.display = 'none'; document.body.classList.remove('cine'); }
export function updateCine(dt) {
  if (!cine) return; cine.t += dt; const s = cine.steps[cine.i];
  s.update && s.update(Math.min(cine.t / s.d, 1), dt);
  if (cine && cine.t >= s.d) { s.end && s.end(); nextStep(); }
}
export function skipCine() {
  if (!cine) return; const c = cine; end(); hideDialog();
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  c.skipFn && c.skipFn(); c.done && c.done();
}
