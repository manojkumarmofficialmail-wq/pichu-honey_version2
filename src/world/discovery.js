// "Kerala Nature Book": discovery spots for the animals, plants and places of each forest.
// Walking near one shows a small card (no pause) and Pichu says one short line in a soft voice.
// Only happens when no poachers are near and nobody else is talking. Finds are saved in the Nature Book.
import { THREE, TEX } from '../core/engine.js';
import { G, P } from '../core/state.js';
import { $, store, SET, clamp } from '../core/utils.js';
import { AU, tone } from '../core/audio.js';
import { UI, hud } from '../core/ui.js';
import { ENEMIES } from '../combat/combat.js';

// Facts are kept short and simple for kids.
export const NATURE_DATA = {
  1: [
    { id: 'hornbill', icon: '🦜', name: 'Great Hornbill', ml: 'മലമുഴക്കി വേഴാമ്പൽ', fact: "Kerala's state bird. Its big yellow casque helps its call boom through the forest.", say: "Look, Honey! A great hornbill — Kerala's state bird!" },
    { id: 'giantsquirrel', icon: '🐿️', name: 'Malabar Giant Squirrel', ml: 'മലയണ്ണാൻ', fact: 'A squirrel as long as your arm, with a maroon and cream coat. It leaps from treetop to treetop.', say: 'A giant squirrel! It can jump between the treetops.' },
    { id: 'sambar', icon: '🦌', name: 'Sambar Deer', ml: 'മ്ലാവ്', fact: "India's biggest deer. It gives a loud alarm call to warn other animals when a tiger is near.", say: 'Shh… a sambar deer. They warn the forest when a tiger comes.' },
    { id: 'arogyapacha', icon: '🌿', name: 'Arogyapacha', ml: 'ആരോഗ്യപ്പച്ച', fact: 'A rare herb of Agasthyamala. The Kani tribe found that its leaves give you energy.', say: 'This little plant is Arogyapacha — it gives people energy!' },
    { id: 'mugger', icon: '🐊', name: 'Mugger Crocodile', ml: 'മുതല', fact: 'Muggers live in lakes and rivers. Near the Neyyar dam there is a crocodile park that protects them.', say: 'Whoa, a crocodile sunbathing by the lake! Let\'s not get too close.' },
    { id: 'agasthyakoodam', icon: '⛰️', name: 'Agasthyakoodam', ml: 'അഗസ്ത്യകൂടം', fact: 'One of the tallest peaks in Kerala, about 1,868 m high. Thousands of medicinal plants grow on these hills.', say: 'That\'s Agasthyakoodam peak — full of healing plants!' },
  ],
  2: [
    { id: 'elephant', icon: '🐘', name: 'Asian Elephant', ml: 'ആന', fact: "Elephants live in family herds led by the oldest female. Periyar's herds come to the lake to drink and bathe.", say: 'An elephant family! The grandma elephant leads the way.' },
    { id: 'tiger', icon: '🐅', name: 'Bengal Tiger', ml: 'കടുവ', fact: "Periyar is a Tiger Reserve. Every tiger's stripes are different, like a fingerprint.", say: 'No two tigers have the same stripes!' },
    { id: 'gaur', icon: '🐃', name: 'Gaur (Indian Bison)', ml: 'കാട്ടുപോത്ത്', fact: "The biggest wild cattle in the world. Its white legs look like it's wearing socks!", say: 'A gaur! It looks like it\'s wearing white socks.' },
    { id: 'otter', icon: '🦦', name: 'Smooth-coated Otter', ml: 'നീർനായ', fact: 'Otters live in families and hunt fish together in Periyar Lake.', say: 'Otters! They catch fish together as a family.' },
    { id: 'deadtrees', icon: '🌳', name: 'The Drowned Trees', ml: 'മുല്ലപ്പെരിയാർ', fact: 'When the Mullaperiyar Dam was finished in 1895, the valley filled with water. These old trees are still standing in the lake.', say: 'These trees have stood in the water for more than a hundred years!' },
    { id: 'darter', icon: '🐦', name: 'Oriental Darter', ml: 'ചേരക്കോഴി', fact: "The 'snake bird' swims with just its long neck showing, then spreads its wings to dry.", say: 'A snake bird, drying its wings in the sun.' },
  ],
  3: [
    { id: 'tahr', icon: '🐐', name: 'Nilgiri Tahr', ml: 'വരയാട്', fact: 'A mountain goat found only in the Western Ghats. Eravikulam protects the biggest group of them.', say: 'Nilgiri tahr — they live only in these mountains!' },
    { id: 'kurinji', icon: '💜', name: 'Neelakurinji', ml: 'നീലക്കുറിഞ്ഞി', fact: 'This shrub flowers only once every 12 years, and then whole hills turn blue and purple.', say: 'Neelakurinji! It blooms only once in twelve years.' },
    { id: 'anamudi', icon: '🏔️', name: 'Anamudi', ml: 'ആനമുടി', fact: "The highest peak in South India, 2,695 m tall. Its name means 'elephant's head'.", say: 'Anamudi — the tallest mountain in South India!' },
    { id: 'tea', icon: '🍃', name: 'Tea Gardens', ml: 'തേയിലത്തോട്ടം', fact: 'Munnar\'s tea grows high in the hills. The bushes are kept trimmed so pickers can reach the fresh leaves.', say: 'Tea bushes everywhere — like a giant green carpet!' },
    { id: 'shola', icon: '🌲', name: 'Shola Forest', ml: 'ചോല', fact: 'Small patches of forest in the folds of grassy hills. They soak up rain like a sponge and feed the rivers.', say: 'Shola forests keep the rivers full of water.' },
  ],
  4: [
    { id: 'ltmacaque', icon: '🐒', name: 'Lion-tailed Macaque', ml: 'സിംഹവാലൻ കുരങ്ങ്', fact: 'Found only in the Western Ghats. Its silver mane and tufted tail make it look like a little lion.', say: 'A lion-tailed macaque — like a tiny lion!' },
    { id: 'thrush', icon: '🎶', name: 'Malabar Whistling Thrush', ml: 'ചൂളക്കാക്ക', fact: "Called the 'whistling schoolboy' because its song sounds like a boy whistling a tune.", say: 'Hear that whistle? That\'s the whistling schoolboy bird!' },
    { id: 'cobra', icon: '🐍', name: 'King Cobra', ml: 'രാജവെമ്പാല', fact: 'The longest venomous snake in the world. It is the only snake that builds a nest for its eggs.', say: 'A king cobra! Let\'s give it lots of space.' },
    { id: 'kunthi', icon: '🏞️', name: 'Kunthipuzha River', ml: 'കുന്തിപ്പുഴ', fact: 'Long ago people worked hard to stop a dam that would have flooded this valley. That is why Silent Valley is still wild.', say: 'People saved this river so the forest could stay wild.' },
    { id: 'silent', icon: '🤫', name: "Why 'Silent' Valley?", ml: 'സൈലന്റ് വാലി', fact: 'People say it got its name because there are very few cicadas here, the insects that buzz loudly in other forests.', say: 'It\'s called Silent Valley because the buzzing cicadas are missing!' },
  ],
  5: [
    { id: 'conolly', icon: '🌳', name: "Conolly's Plot", ml: 'കനോലി പ്ലോട്ട്', fact: 'Planted in the 1840s, it is one of the oldest teak plantations in the world.', say: 'These teak trees were planted almost two hundred years ago!' },
    { id: 'bigteak', icon: '🌲', name: 'The Giant Teak', ml: 'വലിയ തേക്ക്', fact: "One of the tallest teak trees in the world grows here in Conolly's Plot.", say: 'Look how tall this teak tree is — it touches the sky!' },
    { id: 'teak', icon: '🍂', name: 'Teak Tree', ml: 'തേക്ക്', fact: 'Teak leaves are bigger than your face! Teak wood is strong and lasts for a very long time.', say: 'Teak leaves are as big as my head!' },
    { id: 'chaliyar', icon: '🌊', name: 'Chaliyar River', ml: 'ചാലിയാർ', fact: 'Long ago, people searched the sands of this river for tiny flakes of gold.', say: 'People used to find gold in this river!' },
    { id: 'hangbridge', icon: '🌉', name: 'The Hanging Bridge', ml: 'തൂക്കുപാലം', fact: "A long swinging bridge over the Chaliyar takes visitors to Conolly's Plot.", say: 'The famous hanging bridge — the poachers cut it!' },
    { id: 'teakmuseum', icon: '🏛️', name: 'Teak Museum', ml: 'തേക്ക് മ്യൂസിയം', fact: 'Nilambur has a whole museum about teak, the famous wood of these forests.', say: 'Nilambur even has a museum just for teak trees!' },
  ],
  6: [
    { id: 'coffee', icon: '☕', name: 'Coffee & Pepper', ml: 'കാപ്പി, കുരുമുളക്', fact: "Wayanad grows lots of coffee. Black pepper — once called 'black gold' — climbs up the shade trees.", say: 'Coffee cherries! And pepper vines climbing the trees.' },
    { id: 'meenmutty', icon: '💦', name: 'Meenmutty Falls', ml: 'മീൻമുട്ടി', fact: 'A big waterfall that tumbles down the hills of Wayanad in steps.', say: 'Meenmutty Falls! Listen to it roar.' },
    { id: 'edakkal', icon: '🗿', name: 'Edakkal Caves', ml: 'എടക്കൽ ഗുഹ', fact: 'Thousands of years ago, people carved pictures of humans and animals on these cave walls.', say: 'These pictures were carved thousands of years ago!' },
    { id: 'wyelephant', icon: '🐘', name: 'Wayanad Elephants', ml: 'വയനാട് വന്യജീവി സങ്കേതം', fact: "Wayanad's forests join the forests of Karnataka and Tamil Nadu, so elephants can travel very far.", say: 'The elephants here can walk all the way to the next state!' },
    { id: 'chembra', icon: '💚', name: 'Chembra Peak', ml: 'ചെമ്പ്ര', fact: 'Near the top of Chembra Peak is a lake shaped like a heart.', say: 'Up on Chembra Peak there\'s a heart-shaped lake!' },
  ],
};
const ALL = {}; for (const lv in NATURE_DATA) for (const d of NATURE_DATA[lv]) ALL[d.id] = { ...d, level: +lv };

export const BOOK = { found: new Set(store.get('v2_book', [])), voice: store.get('natvoice', true) };
export function setNatureVoice(v) { BOOK.voice = v; store.set('natvoice', v); }

// a soft, quiet line from Pichu (does not cut off other speech)
function softSay(text) {
  if (!BOOK.voice || AU.muted || !SET.voice || !('speechSynthesis' in window)) return;
  try {
    if (speechSynthesis.speaking) return;
    const u = new SpeechSynthesisUtterance(text.replace(/[^\w\s.,!?'’\-]/g, ''));
    const en = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang));
    const pref = en.find(v => /india|en-in|heera|ravi/i.test(v.name + v.lang)) || en.find(v => /female|zira|samantha|aria|jenny|google us english/i.test(v.name)) || en[0];
    if (pref) u.voice = pref; u.pitch = 1.6; u.rate = 1.0; u.volume = .55; speechSynthesis.speak(u);
  } catch (e) { }
}
const chime = () => { tone({ type: 'sine', f0: 1320, dur: .25, a: .01, vol: .05 }); tone({ type: 'sine', f0: 1760, dur: .35, a: .01, vol: .04, delay: .12 }); };

let cardT = 0;
function showCard(d) {
  const el = $('discover'); if (!el) return;
  el.innerHTML = `<div class="dIcon">${d.icon}</div><div><div class="dHead">📖 New discovery</div><div class="dName">${d.name} <span class="ml">${d.ml}</span></div><div class="dFact">${d.fact}</div></div>`;
  el.classList.add('show'); cardT = 8;
}
export function tickDiscoveryCard(dt) { if (cardT > 0) { cardT -= dt; if (cardT <= 0) $('discover')?.classList.remove('show'); } }
const calm = () => G.mode === 'play' && !G.busy && UI.dlgT <= 0 && !ENEMIES.some(e => e.alive && e.awake && !e.prop && Math.hypot(e.x - P.pos.x, e.z - P.pos.z) < 16);

export class Discovery {
  // where = {x, z} of the thing; r = how close you need to be; root gets a small sparkle marker
  constructor(root, id, x, z, opts = {}) {
    this.d = ALL[id]; this.x = x; this.z = z; this.r = opts.r ?? 8; this.found = false; this.y = opts.y;
    G.discTotal = (G.discTotal || 0) + 1;
    this.mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.spark, color: 0x9ae86a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .7 }));
    this.mark.scale.setScalar(.7); this.mark.position.set(x, (opts.y ?? 0) + (opts.my ?? 2.2), z); root.add(this.mark); this.getY = opts.getY;
  }
  tick(dt, t) {
    if (this.found) return;
    if (this.getY) this.mark.position.y = this.getY() + 2.2;
    this.mark.material.rotation = t * .8; this.mark.material.opacity = .45 + .25 * Math.sin(t * 3 + this.x);
    if (Math.hypot(P.pos.x - this.x, P.pos.z - this.z) < this.r && calm()) {
      this.found = true; this.mark.visible = false; G.disc = (G.disc || 0) + 1;
      BOOK.found.add(this.d.id); store.set('v2_book', [...BOOK.found]);
      chime(); showCard(this.d); softSay(this.d.say); hud();
    }
  }
}
export function resetDiscovery() { G.disc = 0; G.discTotal = 0; cardT = 0; $('discover')?.classList.remove('show'); }

// Nature Book page for the menu
export function renderBook() {
  const names = { 1: 'Agasthya Hills', 2: 'Periyar Lake', 3: 'Misty Shola', 4: 'Silent Valley', 5: 'Teak River', 6: 'Wayanad Caves' };
  let n = 0, tot = 0, html = '';
  for (const lv in NATURE_DATA) {
    html += `<div class="bookLv">${names[lv]}</div><div class="bookGrid">`;
    for (const d of NATURE_DATA[lv]) {
      tot++; const got = BOOK.found.has(d.id); if (got) n++;
      html += got ? `<div class="bookItem"><span class="bi">${d.icon}</span><b>${d.name}</b><span class="ml">${d.ml}</span><small>${d.fact}</small></div>` : `<div class="bookItem locked"><span class="bi">❔</span><b>???</b><small>Explore ${names[lv]} to find it</small></div>`;
    }
    html += '</div>';
  }
  return { html, n, tot };
}
