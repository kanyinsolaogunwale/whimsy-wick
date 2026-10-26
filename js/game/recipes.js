/**
 * Whimsy Wick, js/game/recipes.js
 * ---------------------------------------------------------------
 * The "Cook & Learn" layer: every story level now ends in a simple,
 * real recipe. Ghee gathers typed INGREDIENTS on the run (like coins),
 * then the level-end Cook-Along turns them into the level's dish, and
 * the Recipe Book keeps the real recipe for after the game.
 *
 * This module is deliberately pure-data + painter closures: the
 * headless tests load it without a DOM, only calling WW.tex lazily
 * through WW.ingTex (never inside the plain data).
 */
(() => {
'use strict';
const WW = window.WW;

/* ---------------------------------------------------------------
 *  Ingredient registry, name, HUD emoji, and a small procedural
 *  40×40 counter icon matching the pastel kitchen art style.
 * --------------------------------------------------------------- */
const C = () => WW.PALETTE;
WW.INGREDIENTS = {
  flour: {
    name: 'Flour', emoji: '\u{1F33E}',
    draw(c, w, h) {
      const P = C();
      c.fillStyle = P.wood; WW.rr(c, 10, 8, 20, 24, 5); c.fill();          // sack body
      c.fillStyle = P.flour; WW.rr(c, 13, 12, 14, 16, 3); c.fill();        // label
      WW.fillText(c, 'F', 18, 16, 1.6, '#c98a1e');
      c.strokeStyle = P.woodDark; c.lineWidth = 2; WW.rr(c, 10, 8, 20, 24, 5); c.stroke();
      c.fillStyle = P.woodDark; c.fillRect(15, 4, 10, 4);                  // tied top
    },
  },
  egg: {
    name: 'Egg', emoji: '\u{1F95A}',
    draw(c) {
      c.fillStyle = '#fffaf0'; c.beginPath(); c.ellipse(20, 22, 10, 13, 0, 0, 7); c.fill();
      c.strokeStyle = '#d9c99d'; c.lineWidth = 2; c.stroke();
      c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.ellipse(17, 17, 3, 4.4, -0.5, 0, 7); c.fill();
    },
  },
  milk: {
    name: 'Milk', emoji: '\u{1F95B}',
    draw(c) {
      const P = C();
      c.fillStyle = P.milk; WW.rr(c, 12, 12, 16, 22, 4); c.fill();
      c.fillStyle = '#dce9f3'; WW.rr(c, 16, 4, 8, 10, 2); c.fill();        // spout neck
      c.strokeStyle = P.milkDeep; c.lineWidth = 2; WW.rr(c, 12, 12, 16, 22, 4); c.stroke();
      c.fillStyle = '#cfe4f2'; c.fillRect(12, 24, 16, 6);                  // wave band
    },
  },
  sugar: {
    name: 'Sugar', emoji: '\u{1F36C}',
    draw(c) {
      c.fillStyle = '#f2ecff'; WW.rr(c, 11, 14, 18, 18, 6); c.fill();
      c.strokeStyle = '#c7b8e8'; c.lineWidth = 2; WW.rr(c, 11, 14, 18, 18, 6); c.stroke();
      WW.fillText(c, 'S', 17, 20, 1.8, '#8f74c9');
      c.fillStyle = '#c7b8e8'; c.beginPath(); c.arc(20, 10, 4, 0, 7); c.fill();  // knob
      c.fillStyle = '#fff'; c.fillRect(14, 17, 3, 3); c.fillRect(21, 24, 3, 3);  // grains
    },
  },
  butter: {
    name: 'Butter', emoji: '\u{1F9C8}',
    draw(c) {
      const P = C();
      c.fillStyle = P.butter; WW.rr(c, 8, 16, 24, 12, 3); c.fill();
      c.fillStyle = P.butterDeep; c.fillRect(8, 20, 24, 8);
      c.strokeStyle = '#c98a1e'; c.lineWidth = 2; WW.rr(c, 8, 16, 24, 12, 3); c.stroke();
      c.fillStyle = '#fff3c4'; WW.rr(c, 12, 13, 16, 6, 2); c.fill();        // curl on top
    },
  },
  salt: {
    name: 'Salt', emoji: '\u{1F9C2}',
    draw(c) {
      c.fillStyle = '#f4f6f8'; WW.rr(c, 13, 12, 14, 20, 3); c.fill();
      c.strokeStyle = '#b8c4cc'; c.lineWidth = 2; WW.rr(c, 13, 12, 14, 20, 3); c.stroke();
      c.fillStyle = '#b8c4cc'; c.fillRect(16, 6, 8, 6);                    // shaker top
      c.fillStyle = '#8fa3ad'; c.fillRect(18, 8, 1.4, 2); c.fillRect(21, 8, 1.4, 2);
      c.fillStyle = '#d9a066'; c.beginPath(); c.arc(20, 22, 3, 0, 7); c.fill();  // brand dot
    },
  },
  nutmeg: {
    name: 'Nutmeg', emoji: '\u{1F330}',
    draw(c) {
      c.fillStyle = '#8a5a33'; c.beginPath(); c.arc(20, 21, 12, 0.2, 6.9); c.fill();
      c.strokeStyle = '#6b4322'; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#a97448'; c.beginPath(); c.arc(16, 17, 4.5, 0, 7); c.fill();  // hilum
      c.strokeStyle = '#d9a066'; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(20, 21); c.lineTo(26, 24); c.stroke();
    },
  },
  rice: {
    name: 'Rice', emoji: '\u{1F35A}',
    draw(c) {
      const P = C();
      c.fillStyle = P.metal; WW.rr(c, 8, 16, 24, 14, 6); c.fill();         // bowl
      c.fillStyle = '#fffdf6'; c.beginPath(); c.ellipse(20, 17, 12, 6, 0, 0, 7); c.fill();  // mound
      c.strokeStyle = '#c8ccd1'; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#f4ecd8'; c.fillRect(14, 12, 3, 5); c.fillRect(22, 11, 3, 5);  // pillow grains
    },
  },
  tomato: {
    name: 'Tomato', emoji: '\u{1F345}',
    draw(c) {
      c.fillStyle = '#e0563c'; c.beginPath(); c.arc(20, 23, 12, 0, 7); c.fill();
      c.strokeStyle = '#b23a24'; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#5fae8d'; c.fillRect(18, 6, 4, 6);                    // stem
      c.fillStyle = '#a8dcc3'; c.ellipse(20, 11, 8, 3, 0, 0, 7); c.fill(); // leaf pair
      c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.ellipse(15, 18, 3, 4, -0.6, 0, 7); c.fill();
    },
  },
  pepper: {
    name: 'Pepper', emoji: '\u{1F336}\u{FE0F}',
    draw(c) {
      c.fillStyle = '#d9482f'; c.beginPath();
      c.moveTo(14, 10); c.quadraticCurveTo(30, 12, 26, 20);
      c.quadraticCurveTo(23, 34, 16, 32); c.quadraticCurveTo(18, 16, 14, 10); c.fill();
      c.strokeStyle = '#a83720'; c.lineWidth = 2; c.stroke();
      c.strokeStyle = '#5fae8d'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(14, 9); c.quadraticCurveTo(10, 5, 14, 3); c.stroke();
    },
  },
  onion: {
    name: 'Onion', emoji: '\u{1F955}',
    draw(c) {
      c.fillStyle = '#c9a7e0'; c.beginPath(); c.ellipse(20, 23, 12, 12, 0, 0, 7); c.fill();
      c.strokeStyle = '#a07cc9'; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#a07cc9'; c.fillRect(19, 4, 4, 8);                    // sheath tip
      c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(20, 14); c.lineTo(20, 32); c.stroke();
    },
  },
  oil: {
    name: 'Cooking oil', emoji: '\u{1FAD2}',
    draw(c) {
      c.fillStyle = '#e9dd7a'; WW.rr(c, 13, 10, 14, 26, 6); c.fill();      // bottle
      c.strokeStyle = '#c2b446'; c.lineWidth = 2; WW.rr(c, 13, 10, 14, 26, 6); c.stroke();
      c.fillStyle = '#a8b84a'; c.fillRect(17, 3, 6, 8);                    // cap
      c.fillStyle = '#fff8d6'; c.fillRect(16, 16, 8, 12);                  // label
      WW.fillText(c, 'O', 18.4, 19, 1.6, '#9b8f2e');
    },
  },
  beans: {
    name: 'Beans', emoji: '\u{1FAD8}',
    draw(c) {
      const bean = (x, y, r) => {
        c.fillStyle = '#d98a5f'; c.beginPath(); c.ellipse(x, y, 9, 6, r, 0, 7); c.fill();
        c.strokeStyle = '#b06a41'; c.lineWidth = 2; c.stroke();
        c.beginPath(); c.moveTo(x - 8 * Math.cos(r), y - 8 * Math.sin(r));
        c.quadraticCurveTo(x, y + 5, x + 8 * Math.cos(r), y + 8 * Math.sin(r)); c.stroke();
      };
      bean(16, 15, -0.4); bean(25, 20, 0.3); bean(17, 27, 0.15);
    },
  },
};

/** Counter sprite texture for an ingredient kind (memoised by WW.tex). */
WW.ingTex = (kind) => {
  const def = WW.INGREDIENTS[kind];
  return WW.tex('ing-' + kind, 40, 40, def ? def.draw : undefined);
};

/* ---------------------------------------------------------------
 *  Recipes, one dish per story level. `tool` is the vital item a
 *  level's cook hands to the next: the Recipe Book shows a recipe
 *  locked until the previous level's tool is banked.
 * --------------------------------------------------------------- */
WW.RECIPES = [
  {
    id: 'pancakes', level: 0, emoji: '\u{1F95E}', name: 'Night-Shift Pancakes', realName: 'Simple pancakes',
    tagline: 'The wake-up dish: fluffy pancakes from the midnight counter.',
    needs: [ { k: 'flour', n: 1 }, { k: 'egg', n: 1 }, { k: 'milk', n: 1 }, { k: 'sugar', n: 1 } ],
    real: [
      'Mix 1 cup flour, 1 egg, 1 cup milk and 1 tbsp sugar until smooth.',
      'Heat a pan on medium-low and pour in a small circle of batter.',
      'Cook 1-2 minutes, until bubbles pop all over the top.',
      'Flip once. Cook the second side until golden.',
      'Stack them up and eat warm with butter or honey.',
    ],
    fact: 'Let the batter rest 10 minutes before it hits the pan. The flour drinks the milk and the pancakes rise fluffier.',
    tool: { id: 'pan', name: 'Ghee\u2019s trusty pan', emoji: '\u{1F373}' },
    cookSteps: [
      { kind: 'mix',  label: 'Mix the batter',            ing: 'flour', tip: 'TAP to stir it round!' },
      { kind: 'pour', label: 'Pour into the warm pan',    ing: 'milk',  tip: 'HOLD to pour, release in the gold band!' },
      { kind: 'flip', label: 'Wait for the bubbles\u2026 flip!', ing: 'egg', tip: 'TAP while the band sweeps the middle!' },
      { kind: 'serve', label: 'Stack and serve',          ing: 'sugar', tip: 'HOLD to plate, release near the top!' },
    ],
  },
  {
    id: 'chinchin', level: 1, emoji: '\u{1F36A}', name: 'Midnight Chin Chin', realName: 'Chin chin',
    tagline: 'The rolling pin\u2019s favourite: crunchy little fried biscuits.',
    needs: [ { k: 'flour', n: 2 }, { k: 'sugar', n: 1 }, { k: 'butter', n: 1 }, { k: 'milk', n: 1 }, { k: 'nutmeg', n: 1 } ],
    real: [
      'Mix 2 cups flour, half a cup sugar, a pinch of nutmeg and a knob of butter into crumbs.',
      'Pour in milk a little at a time and knead to a stiff dough (5 minutes).',
      'Rest the dough 15 minutes, then roll it out flat, about the width of a finger.',
      'Cut into small squares or diamonds.',
      'Deep-fry small batches on medium heat until golden, stirring so they brown evenly.',
    ],
    fact: 'Small batches of chin chin fry better than one big batch. Crowded oil drops the temperature and makes them soggy.',
    tool: { id: 'pin', name: 'The quiet rolling pin', emoji: '\u{1F95F}' },
    cookSteps: [
      { kind: 'mix',  label: 'Rub in the butter',         ing: 'butter', tip: 'TAP to crumb it!' },
      { kind: 'mix',  label: 'Knead the dough',           ing: 'flour',  tip: 'TAP to knead!' },
      { kind: 'pour', label: 'Roll out to a finger width', ing: 'milk',  tip: 'HOLD to roll, release in the gold band!' },
      { kind: 'flip', label: 'Fry till golden, turn!',    ing: 'nutmeg', tip: 'TAP while the band sweeps the middle!' },
      { kind: 'serve', label: 'Drain and pour into the jar', ing: 'sugar', tip: 'HOLD to serve!' },
    ],
  },
  {
    id: 'scrambledeggs', level: 2, emoji: '\u{1F373}', name: 'Butter-Slide Scramble', realName: 'Scrambled eggs',
    tagline: 'Learned on the butter slides: soft, slow, glossy eggs.',
    needs: [ { k: 'egg', n: 2 }, { k: 'butter', n: 1 }, { k: 'milk', n: 1 }, { k: 'salt', n: 1 } ],
    real: [
      'Whisk 2 eggs with a splash of milk and a small pinch of salt.',
      'Melt a knob of butter in a pan on LOW heat.',
      'Pour in the eggs. Stir slowly and keep every part of the pan moving.',
      'Take the pan off the heat while the eggs still look a little wet. They finish cooking themselves.',
      'Serve on toast right away.',
    ],
    fact: 'Salt draws out water, so salt the eggs just before serving, not before cooking: they stay creamy instead of weepy.',
    tool: { id: 'whisk', name: 'The tireless whisk', emoji: '\u{1F944}' },
    cookSteps: [
      { kind: 'mix',  label: 'Whisk the eggs',            ing: 'egg',    tip: 'TAP to whisk!' },
      { kind: 'pour', label: 'Slide in the butter',       ing: 'butter', tip: 'HOLD to melt, release in the gold band!' },
      { kind: 'mix',  label: 'Stir slow on low heat', ing: 'milk', tip: 'TAP slow and steady!' },
      { kind: 'flip', label: 'Catch the wobble, plate!',  ing: 'salt',  tip: 'TAP while the band sweeps the middle!' },
      { kind: 'serve', label: 'Salt and serve on toast',  ing: 'salt',  tip: 'HOLD to serve!' },
    ],
  },
  {
    id: 'jollof', level: 3, emoji: '\u{1F35B}', name: 'Sticky-Pot Jollof Base', realName: 'Jollof rice',
    tagline: 'Tamed on the sticky tiles: the base of a great one-pot rice.',
    needs: [ { k: 'rice', n: 1 }, { k: 'tomato', n: 2 }, { k: 'pepper', n: 1 }, { k: 'onion', n: 1 }, { k: 'oil', n: 1 } ],
    real: [
      'Blend 2 ripe tomatoes, 1 pepper and 1 onion until smooth.',
      'Heat 2 tbsp oil in a pot and fry the blend 10 minutes, until it darkens and the oil floats on top.',
      'Add washed rice and 1 cup of water or stock.',
      'Cover with foil or paper, lid on tight, and steam on LOW without opening.',
      'After 20 minutes check: rice soft? Fold and serve.',
    ],
    fact: 'The fried tomato blend smells powerful but tastes deeper: that darkening stage is where jollof rice gets its colour, so do not rush it.',
    tool: { id: 'pot', name: 'The little big pot', emoji: '\u{1F372}' },
    cookSteps: [
      { kind: 'mix',  label: 'Blend tomato, pepper, onion', ing: 'tomato', tip: 'TAP to blend!' },
      { kind: 'pour', label: 'Fry the blend in oil',      ing: 'oil',    tip: 'HOLD to fry, release in the gold band!' },
      { kind: 'mix',  label: 'Fold in the washed rice',   ing: 'rice',   tip: 'TAP to fold!' },
      { kind: 'flip', label: 'Steam on low - check once', ing: 'pepper', tip: 'TAP while the band sweeps the middle!' },
      { kind: 'serve', label: 'Fluff and serve',          ing: 'onion',  tip: 'HOLD to plate!' },
    ],
  },
  {
    id: 'moimoi', level: 4, emoji: '\u{1FAD8}', name: 'The Last-Spark Moi Moi', realName: 'Moi moi',
    tagline: 'The finale dish: soft steamed bean pudding, shared with the whole kitchen.',
    needs: [ { k: 'beans', n: 2 }, { k: 'pepper', n: 1 }, { k: 'onion', n: 1 }, { k: 'oil', n: 1 }, { k: 'egg', n: 1 } ],
    real: [
      'Soak 2 cups beans in water 1 hour, then rub off the skins.',
      'Blend the beans with 1 pepper and 1 onion, using just enough water to turn.',
      'Whisk the pudding 1 full minute so it traps air (that is what makes it soft).',
      'Stir in 1 tbsp oil. Pour into bowls or wraps.',
      'Steam in a covered pot with 2 cm of water, 1-1\u00bd hours, till a knife comes out clean.',
    ],
    fact: 'Whisking moi moi batter is the whole secret: the trapped air is real steam that lifts the pudding, so whisk, then pour gently.',
    tool: { id: 'wick', name: 'The golden wick', emoji: '\u{1F56F}\u{FE0F}' },
    cookSteps: [
      { kind: 'mix',  label: 'Blend beans, pepper, onion', ing: 'beans', tip: 'TAP to blend!' },
      { kind: 'mix',  label: 'Whisk a full minute',       ing: 'egg',   tip: 'TAP to whisk air in!' },
      { kind: 'pour', label: 'Stir in the oil, pour wraps', ing: 'oil', tip: 'HOLD to pour, release in the gold band!' },
      { kind: 'flip', label: 'Steam till the knife is clean', ing: 'pepper', tip: 'TAP while the band sweeps the middle!' },
      { kind: 'serve', label: 'Serve the whole kitchen',  ing: 'onion', tip: 'HOLD to plate!' },
    ],
  },
];

/** Recipe for a story level index (or null on endless). */
WW.recipeForLevel = (idx) => WW.RECIPES.find(r => r.level === idx) || null;

/** The previous recipe's tool is needed before this recipe opens. */
WW.toolNeeded = (recipe) => {
  const i = WW.RECIPES.indexOf(recipe);
  return i <= 0 ? null : WW.RECIPES[i - 1].tool;
};

/* ---------------------------------------------------------------
 *  Daily special, deterministic per UTC calendar day, so every
 *  player (and every rerun) sees the same dish.
 * --------------------------------------------------------------- */
WW.dailySpecial = () => WW.RECIPES[Math.floor(Date.now() / 86400000) % WW.RECIPES.length];

/* ---------------------------------------------------------------
 *  Dish scoring, pure, headless-testable.
 *   grades: 2 per well-executed cook step, 1 fumbled, 0 missed
 *   missing: how many recipe ingredients were never gathered on the run
 *  Stars 1..3 always (you always serve something) + coin/gem bonus.
 * --------------------------------------------------------------- */
WW.dishScore = ({ grades = [], missing = 0 }) => {
  const n = Math.max(1, grades.length);
  let s = (grades.reduce((a, b) => a + Math.max(0, Math.min(2, b)), 0) / (2 * n)) * 3;
  if (!missing) s = Math.min(3, s + 0.5);
  const stars = Math.max(1, Math.min(3, Math.round(s)));
  return { stars, bonusCoins: stars * 25, bonusGems: stars === 3 ? 1 : 0 };
};

/* ---------------------------------------------------------------
 *  Ghee's Kitchen Shelf, buyable with banked coins/gems.
 *   pantry : every story run starts with its first ingredient banked
 *   pan    : golden pan in the Cook-Along
 *   jar    : sprinkle FX in the Cook-Along
 * --------------------------------------------------------------- */
WW.KITCHEN_ITEMS = [
  { id: 'pantry', name: 'Starter Pantry', emoji: '\u{1F9C5}', coins: 250, gems: 0,
    blurb: 'Every story run starts with its first ingredient already gathered.' },
  { id: 'pan', name: 'Golden Pan', emoji: '\u{1F31F}', coins: 0, gems: 4,
    blurb: 'A gilded pan for the Cook-Along. Pure sparkle, zero effect on taste.' },
  { id: 'jar', name: 'Sprinkle Jar', emoji: '\u{2728}', coins: 0, gems: 2,
    blurb: 'Extra confetti when a dish comes out right. Cooking is a party.' },
];
WW.kitchenItem = (id) => WW.KITCHEN_ITEMS.find(i => i.id === id) || null;
})();
