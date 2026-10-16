/**
 * Whimsy Wick — js/levels/story.js
 * ---------------------------------------------------------------
 * §1  STORY: five handcrafted levels, fully data-driven (assignment §17).
 *     Coordinates are world-units: 1 u = 1 px at design height 540.
 *     Ground surface y=0; things sit on ground unless y given.
 * §2  Endless: chunk patterns + generator. Never impossible: every
 *     obstacle leaves ≥90u of clean runway before the next (§4.2).
 */
(() => {
'use strict';
const WW = window.WW;

/* Hazard kinds: flour(hop), pin(patrol), butter(slip), milk(slip-2),
 * jamdrop(slow), fan(wind). Anchors: x = left edge (ground-based). */

WW.STORY_LEVELS = [
  {
    id: 'sleepy-counter', name: 'The Sleepy Counter',
    note: 'Magic woke Ghee at midnight — and scattered. Follow the sparks.',
    length: 2600, theme: 'warm', parallax: 'window', platforms: true,
    goal: { x: 2520, caption: 'A little wick waits to be lit…' },
    decorations: ['window', 'shelf'],
    hazards: [ { t: 'flour', x: 760 }, { t: 'flour', x: 1140 }, { t: 'flour', x: 1580 } ],
    sparks: [420, 520, 620, 950, 1050, 1300, 1400, 1720, 1820, 1980, 2080],
    gems: [950, 1770],
    platforms: [ { x: 880, w: 150, y: 96 }, { x: 1250, w: 130, y: 96 }, { x: 2050, w: 170, y: 96 } ],
    tutorial: [
      { tag: 'move',  title: 'Wake up, Ghee!',        text: 'Drag right (or press →) to tiptoe along the counter.' },
      { tag: 'jump',  title: 'Hopping is easy',       text: 'Tap (or press Space) to hop. Flour is too messy to wade through — arc over it.' },
      { tag: 'spark', title: 'Follow the glow',       text: 'Brush against sparks to gather them. Every one rekindles a bit of the kitchen.' },
      { tag: 'goal',  title: 'Light the wick',        text: 'Reach the lantern at the end of the counter and give it your light.' },
    ],
  },
  {
    id: 'rolling-pin', name: 'The Rolling Pin Run',
    note: 'Someone left the pins out. They roll to a rhythm all their own.',
    length: 2800, theme: 'flour', parallax: 'shelf',
    goal: { x: 2740, caption: 'One more wick steadies the kitchen…' },
    decorations: ['shelf', 'pin-rack'],
    hazards: [
      { t: 'pin', x: 700, range: 120 }, { t: 'pin', x: 1200, range: 200 }, { t: 'flour', x: 1650 },
      { t: 'pin', x: 2050, range: 160 },
    ],
    sparks: [380, 480, 620, 1300, 1400, 1520, 1750, 1850, 2260, 2380, 2480],
    gems: [2280],
    platforms: [ { x: 1350, w: 160, y: 100 }, { x: 2150, w: 150, y: 100 } ],
    hints: { pin: 'Rolling pins patrol left-and-right — watch for the gap in their swing.' },
  },
  {
    id: 'butter-slide', name: 'The Butter Slide',
    note: 'A warm pat of butter melts across the tiles. Ghee skates!',
    length: 2600, theme: 'butter', parallax: 'shelf',
    goal: { x: 2540, caption: 'The lantern hums softly…' },
    decorations: ['shelf', 'butter-dish'],
    hazards: [
      { t: 'butter', x: 620, w: 190 }, { t: 'flour', x: 950 },
      { t: 'butter', x: 1250, w: 240 }, { t: 'butter', x: 1750, w: 170 }, { t: 'flour', x: 2120 },
    ],
    sparks: [400, 500, 600, 700, 800, 900, 1150, 1350, 1450, 1550, 1900, 2200, 2300],
    gems: [1350],
    platforms: [ { x: 1000, w: 150, y: 96 }, { x: 1550, w: 150, y: 96 } ],
    hints: { butter: 'Butter is slippery! Skid, feather your steering, and jump while sliding.' },
  },
  {
    id: 'sticky-situation', name: 'The Sticky Situation',
    note: 'A milk jug tipped; jam followed. The counter is a mess — a lovely one.',
    length: 2800, theme: 'milk', parallax: 'window',
    goal: { x: 2740, caption: 'Three wicks now burn warm…' },
    decorations: ['window', 'milk-crate'],
    hazards: [
      { t: 'milk', x: 620, w: 210 }, { t: 'jamdrop', x: 950 }, { t: 'milk', x: 1150, w: 170 },
      { t: 'jamdrop', x: 1600 }, { t: 'butter', x: 1850, w: 170 }, { t: 'flour', x: 2250 },
    ],
    sparks: [420, 520, 620, 720, 820, 920, 1400, 1500, 1600, 2000, 2100, 2400],
    gems: [1000, 2010],
    platforms: [ { x: 1050, w: 150, y: 100 }, { x: 2350, w: 140, y: 96 } ],
    hints: { milk: 'Milk grips less than butter — long, gentle skids.', jam: 'Jam is sticky! It slows Ghee down, so build up speed before it.' },
  },
  {
    id: 'last-spark', name: 'The Kitchen\u2019s Last Spark',
    note: 'All the magic the kitchen has left. One run to give it back.',
    length: 3200, theme: 'night', parallax: 'window',
    goal: { x: 3120, caption: 'The last wick. Everything depends on it…' },
    decorations: ['window', 'shelf', 'pin-rack'],
    hazards: [
      { t: 'fan', x: 700, w: 74 }, { t: 'flour', x: 1150 }, { t: 'pin', x: 1350, range: 150 },
      { t: 'butter', x: 1700, w: 210 }, { t: 'pin', x: 2100, range: 180 }, { t: 'milk', x: 2400, w: 170 },
      { t: 'flour', x: 2750 },
    ],
    sparks: [420, 520, 620, 720, 820, 1000, 1250, 1450, 1650, 1850, 2050, 2250, 2450, 2650, 2850],
    gems: [1000, 1850, 2850],
    platforms: [ { x: 980, w: 140, y: 96 }, { x: 1900, w: 160, y: 100 }, { x: 2600, w: 140, y: 96 } ],
    hints: { fan: 'A little fan breathes backwards! Lean into its breeze, or it carries Ghee away.' },
  },
];

/* ----------------------------------------------------------------
 * §2  Endless mode — designed chunk patterns, rising difficulty.
 * Each chunk starts with ≥140u runway and ≥380u between lethal
 * anchors; difficulty tiers gate heavier mixes (assignment §4.2).
 * ---------------------------------------------------------------- */
WW.ENDLESS_CHUNKS = [
  { min: 0, w: 640, build: [ { t: 'flour', x: 320 } ] },
  { min: 0, w: 760, build: [ { t: 'flour', x: 260 }, { t: 'flour', x: 560 } ] },
  { min: 0, w: 700, build: [ { t: 'butter', x: 300, w: 180 } ] },
  { min: 1, w: 820, build: [ { t: 'pin', x: 340, range: 90 } ] },
  { min: 1, w: 860, build: [ { t: 'butter', x: 240, w: 170 }, { t: 'flour', x: 640 } ] },
  { min: 1, w: 720, build: [ { t: 'jamdrop', x: 360 } ] },
  { min: 2, w: 900, build: [ { t: 'pin', x: 320, range: 120 }, { t: 'flour', x: 620 } ] },
  { min: 2, w: 940, build: [ { t: 'butter', x: 240, w: 200 }, { t: 'jamdrop', x: 620 } ] },
  { min: 2, w: 860, build: [ { t: 'milk', x: 280, w: 180 } ] },
  { min: 3, w: 1000, build: [ { t: 'fan', x: 320, w: 74 }, { t: 'flour', x: 700 } ] },
  { min: 3, w: 1040, build: [ { t: 'pin', x: 360, range: 140 }, { t: 'butter', x: 640, w: 170 } ] },
  { min: 3, w: 980, build: [ { t: 'milk', x: 300, w: 180 }, { t: 'flour', x: 680 } ] },
  { min: 4, w: 1120, build: [ { t: 'fan', x: 300, w: 74 }, { t: 'pin', x: 660, range: 130 } ] },
  { min: 4, w: 1080, build: [ { t: 'butter', x: 260, w: 190 }, { t: 'pin', x: 700, range: 120 } ] },
];

/** Generate obstacles for an endless run up to `targetX`. */
WW.generateEndless = (targetX, rng) => {
  const out = [];
  let x = 360;
  let tier;
  let lastPin = -999;
  while (x < targetX) {
    tier = Math.min(4, Math.floor(x / 1550));
    const pool = WW.ENDLESS_CHUNKS.filter(c => c.min <= tier);
    const c = pool[Math.floor(rng() * pool.length)];
    for (const b of c.build) {
      const item = { t: b.t, x: x + b.x };
      if (b.t === 'pin') {
        if (item.x - lastPin < 520) continue; // fairness gap between pins
        item.range = b.range; lastPin = item.x;
      }
      if (b.w) item.w = b.w;
      out.push(item);
    }
    x += c.w + 60 + rng() * 90;
  }
  return out;
};

/** Endless spark columns: rows of 3 every ~240u. */
WW.generateEndlessSparks = (targetX, rng) => {
  const out = [];
  for (let x = 420; x < targetX; x += 240 + Math.floor(rng() * 90)) {
    const hop = rng() < .35;
    out.push(x, x + 48, x + 24 + (hop ? 0 : 24));
  }
  return out;
};
})();
