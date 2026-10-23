// HUD, dialog box, pop-up text, titles and boss bar.
import { $, fmtTime } from './utils.js';
import { G, P } from './state.js';
import { speak } from './audio.js';

export const UI = { dlgT: 0 };
export function dialog(who, text, dur) {
  const el = $('dialog'); el.innerHTML = `<div class="who">${who}</div><div>${text}</div>`; el.style.display = 'block';
  UI.dlgT = dur ?? Math.max(3, text.length * .07);
  if (who !== 'Honey') speak(text, /pichu/i.test(who) ? 'pichu' : /ranger/i.test(who) ? 'ranger' : /captain|kaala|poacher/i.test(who) ? 'villain' : 'narrator');
}
export function hideDialog() { $('dialog').style.display = 'none'; UI.dlgT = 0; }
export function tickDialog(dt) { if (UI.dlgT > 0) { UI.dlgT -= dt; if (UI.dlgT <= 0) hideDialog(); } }

export function popText(t, color) {
  const el = document.createElement('div'); el.className = 'pop'; el.textContent = t;
  if (color) el.style.textShadow = `0 3px 0 rgba(0,0,0,.35),0 0 18px ${color}`;
  document.body.appendChild(el); setTimeout(() => el.remove(), 1300);
}
export function showTitle(small, big, sub, ml) {
  $('title').innerHTML = `<div class="n">${small}</div>${ml ? `<div class="ml">${ml}</div>` : ''}<div class="t">${big}</div><div class="o">${sub || ''}</div>`;
  $('title').style.opacity = 1; clearTimeout(showTitle.t); showTitle.t = setTimeout(() => $('title').style.opacity = 0, 4200);
}
export function fade(on) { $('fade').style.opacity = on ? 1 : 0; }
let promptOn = '';
// showAct: also show the ✋ action button (only when there is something to free / talk to)
export function setPrompt(t, showAct = true) { $('bAct').classList.toggle('show', !!t && showAct); if (t === promptOn) return; promptOn = t; $('prompt').style.display = t ? 'block' : 'none'; $('prompt').textContent = t; }

let objText = '';
export function setObjective(t) { if (t === objText) return; objText = t; $('objective').textContent = t; }
export function hud() {
  $('hpFill').style.width = (P.hp / P.maxHp * 100) + '%';
  $('hpFill').classList.toggle('low', P.hp / P.maxHp < .3);
  $('stFill').style.width = P.stamina + '%';
  $('ammo').textContent = P.ammo; $('pods').textContent = G.pods; $('podsT').textContent = G.podsTotal;
  $('freed').textContent = G.freed; $('freedT').textContent = G.level?.cages ?? 0;
  $('keyBox').style.display = G.keys > 0 ? '' : 'none'; $('keyBox').textContent = '🔑 ' + (G.keys || 0) + (G.mapTotal ? ` · 🗺️ ${G.mapPieces || 0}/${G.mapTotal}` : '');
  if (G.mapTotal && !(G.keys > 0)) { $('keyBox').style.display = ''; $('keyBox').textContent = `🗺️ ${G.mapPieces || 0}/${G.mapTotal}`; }
  $('discBox').style.display = G.discTotal ? '' : 'none'; $('discBox').textContent = `📖 ${G.disc || 0}/${G.discTotal || 0}`;
  $('clueBox').style.display = G.clueIcon ? '' : 'none'; $('clueBox').textContent = G.clueIcon ? `${G.clueIcon} ${G.clue ? '✓' : '?'}` : ''; $('clueBox').classList.toggle('got', !!G.clue);
}
let lastSec = -1;
export function hudTimer() { const s = Math.floor(G.time); if (s !== lastSec) { lastSec = s; $('timer').textContent = fmtTime(s); } }
export function bossBar(name, k) {
  const el = $('bossbar'); if (name === null) { el.style.display = 'none'; return; }
  el.style.display = 'block'; if (name) $('bossName').textContent = name; $('bossFill').style.width = Math.max(0, k * 100) + '%';
}
export function hurtFlash() { $('hurt').style.boxShadow = 'inset 0 0 140px rgba(255,40,60,.75)'; setTimeout(() => $('hurt').style.boxShadow = 'inset 0 0 0 rgba(255,40,60,0)', 300); }
export function cooldownUI(id, k) { const el = $(id); if (el) el.style.setProperty('--cd', Math.max(0, Math.min(1, k))); }
