// Hooks that main.js fills in, so level modules can call back without circular imports.
export const FLOW = {
  startPlay: null,   // () => void : hand control to the player
  complete: null,    // (stats) => void : show the level-complete card
  respawn: null,     // (pos, cb) => void : fade out, move player, fade in
};
