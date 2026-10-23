// All levels, south → north. Levels without `load` are shown as "coming soon" on the map.
export const LEVELS = [
  { id: 1, name: 'Agasthya Hills', ml: 'അഗസ്ത്യമല', place: 'Agasthyamala · Thiruvananthapuram', icon: '⛰️', boss: 'Captain Snare', load: () => import('./level01_agasthya.js') },
  { id: 2, name: 'Periyar Lake', ml: 'പെരിയാർ', place: 'Periyar Tiger Reserve · Idukki', icon: '🐘', boss: 'Jeep Trapper', load: () => import('./level02_periyar.js') },
  { id: 3, name: 'Misty Shola', ml: 'ഇരവികുളം', place: 'Eravikulam · Munnar', icon: '🌫️', boss: 'Drone Master', load: () => import('./level03_shola.js') },
  { id: 4, name: 'Silent Valley', ml: 'സൈലന്റ് വാലി', place: 'Silent Valley · Palakkad', icon: '🐒', boss: 'Shadow Leopard', load: () => import('./level04_silentvalley.js') },
  { id: 5, name: 'Teak River', ml: 'നിലമ്പൂർ', place: 'Nilambur · Malappuram', icon: '🪵', boss: 'Sawmill Boss', load: () => import('./level05_teak.js') },
  { id: 6, name: 'Wayanad Caves', ml: 'വയനാട്', place: 'Edakkal & Meenmutty · Wayanad', icon: '🕯️', boss: 'Kaala', load: () => import('./level06_wayanad.js') },
];
