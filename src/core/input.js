// Keyboard, mouse and touch controls.
// Desktop: WASD move, Shift run, Space jump, J / left-click attack, K (hold) smash, L dodge,
//          F / right-click slingshot, H Honey bark, E action, drag to look, wheel to zoom.
// Phones: left side = joystick, right side = look, buttons for each move.
import { renderer } from './engine.js';
import { G, K, JOY, DRAG, CAM } from './state.js';
import { $, clamp, MOBILE } from './utils.js';

export function initInput(A) {
  addEventListener('keydown', e => {
    const k = e.key.toLowerCase(); if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    K[k] = true; if (e.repeat) return;
    if (k === 'p' || (k === 'escape' && G.mode === 'play')) { A.pause(); return; }
    if (G.paused) { if (k === 'escape' || k === 'enter') A.pause(false); return; }
    if (k === ' ') A.jump(); if (k === 'j') A.light(); if (k === 'k') A.heavyStart(); if (k === 'l' || k === 'control') A.dodge();
    if (k === 'f') A.sling(); if (k === 'h') A.bark(); if (k === 'q') A.sniff(); if (k === 'e') A.action(); if (k === 'm') A.mute();
    if ((k === 'escape' || k === 'enter') && G.mode === 'cine') A.skip();
  });
  addEventListener('keyup', e => { const k = e.key.toLowerCase(); K[k] = false; if (k === 'k') A.heavyRelease(); });
  addEventListener('blur', () => { for (const k in K) K[k] = false; });
  addEventListener('contextmenu', e => e.preventDefault());

  const cv = renderer.domElement, joyEl = $('joy'), knob = $('knob');
  const TOUCHES = new Map(); let PINCH = null;
  const joyMove = e => { let dx = e.clientX - JOY.cx, dy = e.clientY - JOY.cy; const R = joyEl.offsetWidth * .38, l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; } JOY.x = dx / R; JOY.y = dy / R; knob.style.transform = `translate(${dx}px,${dy}px)`; };
  const joyStart = (e, cx, cy, float) => { JOY.cx = cx; JOY.cy = cy; JOY.active = true; JOY.id = e.pointerId; joyEl.classList.add('on'); if (float) { joyEl.classList.add('float'); joyEl.style.left = (cx - joyEl.offsetWidth / 2) + 'px'; joyEl.style.top = (cy - joyEl.offsetHeight / 2) + 'px'; joyEl.style.bottom = 'auto'; } joyMove(e); };
  const joyStop = () => { JOY.active = false; JOY.id = null; JOY.x = JOY.y = 0; knob.style.transform = ''; joyEl.classList.remove('on', 'float'); joyEl.style.left = joyEl.style.top = joyEl.style.bottom = ''; };
  A._joyStop = joyStop; A._clearTouches = () => { TOUCHES.clear(); PINCH = null; DRAG.on = false; };

  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId);
    if (e.pointerType === 'touch' && MOBILE && G.mode === 'play' && !JOY.active && e.clientX < innerWidth * .42) { joyStart(e, e.clientX, e.clientY, true); return; }
    if (e.pointerType === 'mouse' && e.button === 2) { A.sling(); return; }
    TOUCHES.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), mouse: e.pointerType === 'mouse' });
    DRAG.on = true;
    if (TOUCHES.size === 2) { const [a, b] = [...TOUCHES.values()]; PINCH = { d: Math.max(Math.hypot(a.x - b.x, a.y - b.y), 1), dist: CAM.dist }; }
  });
  cv.addEventListener('pointermove', e => {
    if (JOY.active && e.pointerId === JOY.id) { joyMove(e); return; }
    const t = TOUCHES.get(e.pointerId); if (!t) return;
    if (PINCH && TOUCHES.size >= 2) { t.x = e.clientX; t.y = e.clientY; const [a, b] = [...TOUCHES.values()]; const d = Math.max(Math.hypot(a.x - b.x, a.y - b.y), 1); CAM.dist = clamp(PINCH.dist * PINCH.d / d, 3, 11); DRAG.last = performance.now(); return; }
    const touch = e.pointerType === 'touch';
    CAM.yaw -= (e.clientX - t.x) * (touch ? .0078 : .0055); CAM.pitch = clamp(CAM.pitch + (e.clientY - t.y) * (touch ? .0052 : .004), .02, 1.15);
    t.x = e.clientX; t.y = e.clientY; DRAG.last = performance.now();
  });
  const dEnd = e => {
    if (JOY.active && e.pointerId === JOY.id) { joyStop(); return; }
    const t = TOUCHES.get(e.pointerId);
    // a quick mouse click (not a drag) = attack
    if (t && t.mouse && performance.now() - t.t < 260 && Math.hypot(e.clientX - t.sx, e.clientY - t.sy) < 8 && G.mode === 'play') A.light();
    TOUCHES.delete(e.pointerId); if (TOUCHES.size < 2) PINCH = null; DRAG.on = TOUCHES.size > 0;
  };
  cv.addEventListener('pointerup', dEnd); cv.addEventListener('pointercancel', dEnd);
  cv.addEventListener('wheel', e => { CAM.dist = clamp(CAM.dist + e.deltaY * .004, 3, 11); }, { passive: true });
  joyEl.addEventListener('pointerdown', e => { e.preventDefault(); if (JOY.active) return; const r = joyEl.getBoundingClientRect(); joyEl.setPointerCapture(e.pointerId); joyStart(e, r.left + r.width / 2, r.top + r.height / 2, false); });
  joyEl.addEventListener('pointermove', e => { if (JOY.active && e.pointerId === JOY.id) joyMove(e); });
  const joyEnd = e => { if (e.pointerId === JOY.id) joyStop(); }; joyEl.addEventListener('pointerup', joyEnd); joyEl.addEventListener('pointercancel', joyEnd);

  // touch buttons
  const tap = (id, down, up) => {
    const b = $(id); if (!b) return;
    b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); b.classList.add('press'); if (!G.paused) down(); });
    const u = () => { b.classList.remove('press'); if (up) up(); }; ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, u));
  };
  tap('bAtk', A.light); tap('bHeavy', A.heavyStart, A.heavyRelease); tap('bDodge', A.dodge); tap('bSling', A.sling);
  tap('bJump', A.jump); tap('bBark', A.bark); tap('bSniff', A.sniff); tap('bAct', A.action);
}
