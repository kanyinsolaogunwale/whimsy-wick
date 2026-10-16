/**
 * Whimsy Wick — js/characters/define.js
 * Five magical kitchen spirits. Drawn in art.js §2; palettes + quirks here.
 * All five share identical hitbox + movement, so selection never unbalances
 * gameplay — only looks (assignment §3.2).
 */
window.WW = window.WW || {};

WW.CHARACTERS = [
  {
    id: 'ghee', name: 'Ghee',
    tag: 'Curious · Brave · A little clumsy',
    flavour: 'First to wake when the kitchen falls asleep.',
    body: '#ffd66b', bodyDark: '#e9a63a', cheek: '#f6a6b2',
    accessory: 'leaf',            // tiny mint leaf cap
    accent: '#8fce9e', accentDark: '#5fae8d',
    glow: '#ffe9a8',
    bob: 2.6,                     // idle bob speed factor
  },
  {
    id: 'mallow', name: 'Mallow',
    tag: 'Dreamy · Gentle · Softly glowing',
    flavour: 'Naps inside the teacup, hums to the kettle.',
    body: '#c7a6e8', bodyDark: '#9b74d2', cheek: '#f6a6b2',
    accessory: 'nightcap',        // sleepy lavender night cap
    accent: '#e8dcf7', accentDark: '#b79adf',
    glow: '#ded1ff',
    bob: 1.7,
  },
  {
    id: 'pip', name: 'Pip',
    tag: 'Energetic · Curious · Quick feet',
    flavour: 'Counted every floor tile twice. Got a different number.',
    body: '#a8dcc3', bodyDark: '#5fae8d', cheek: '#f6a6b2',
    accessory: 'acorn',           // tiny acorn beret
    accent: '#c98a4b', accentDark: '#96612f',
    glow: '#cfffdf',
    bob: 3.8,
  },
  {
    id: 'peaches', name: 'Peaches',
    tag: 'Cheerful · Playful · Least a smidge funny',
    flavour: 'Laughed so hard the honey fell over.',
    body: '#ffb98a', bodyDark: '#e89868', cheek: '#ff8f7d',
    accessory: 'scarf',           // miniature chef scarf
    accent: '#f9737f', accentDark: '#d15660',
    glow: '#ffd9bf',
    bob: 3.0,
  },
  {
    id: 'clover', name: 'Clover',
    tag: 'Calm · Observant · Notices everything',
    flavour: 'Saw the magic scatter first — said nothing, then pointed.',
    body: '#d4e0a5', bodyDark: '#a3b26b', cheek: '#f6a6b2',
    accessory: 'flower',          // pastel clover blossom pin
    accent: '#f6a6b2', accentDark: '#e07d8b',
    glow: '#f0f7c8',
    bob: 2.0,
  },
].map(c => ({ ...c, bodyDark2: c.bodyDark }));

/* start.ng central styling (docs "character rule" / "style fields"):
 * tints the character's SCARF / accessory band and emits a personal glow
 * while body colour + accessory silhouette keep the spirit recognisable. */
WW.applyStartNgStyle = (spirit, style) => {
  if (!spirit || !style) return;
  const safe = (c, fallback) =>
    (typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c)) ? c : fallback;
  spirit.tint = {
    // primaryColor → scarf/cap band; hairColor → tiny hair-tuft hue on tufted spirits
    primary:  safe(style.primaryColor),
    hair:     safe(style.hairColor),
    accessory: style.accessory || null,
    hat: style.hat || null,
  };
};
