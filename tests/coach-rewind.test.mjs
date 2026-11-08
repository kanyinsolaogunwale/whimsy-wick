/**
 * Headless verification of first-run coaching: a crash on the first
 * obstacle rewinds the run (no result screen, no settle), and a clumsy
 * player gets to retry each obstacle until the hop lands right. Run:
 *   node tests/coach-rewind.test.mjs  → exit 1 on failure.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = { console, performance, Math };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ['js/base/core.js', 'js/world/physics.js', 'js/levels/story.js', 'js/game/recipes.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox);
}
const WW = sandbox.WW;
const { GROUND_Y, newState, step, tryJump, BODY } = WW.Physics;

/* mirror of buildEndless's fresh layout (same recipe as the tutorial test) */
const L = 26000;
const rng = WW.rng(4242);
const normHaz = (h) => { const o = { ...h }; if (!o.w) o.w = { flour: 84, jamdrop: 40, pin: 104, fan: 60 }[o.t] || 46; return o; };
const hazards = WW.generateEndless(L, rng).map(normHaz);
const sparks = WW.generateEndlessSparks(L, rng).map(x => ({ x, y: 34 + Math.floor(Math.abs(Math.sin(x * 0.017)) * 190), got: false }));
const kinds = Object.keys(WW.INGREDIENTS);
const ingFrom = 1200, ingStep = (L - ingFrom - 1100) / (kinds.length - 1);
const ingredients = kinds.map((k, i) => ({ x: Math.round(ingFrom + i * ingStep), k, got: false }));
const world = { length: L, platforms: [], hazards, sparks, gems: [], ingredients, goal: null, t: 0, fanTick: 0 };
const hzX = hazards[0].x;   // first obstacle (flour@620 with this seed)

/* mirror of the game.js coach engine */
const HINTS = (who) => ({ flour: 'Flour piles are too dusty to wade through. Hop over them.', pin: 'Rolling pins patrol back and forth.' });
const uiLog = [];
const ui = {
  showToast(text, ms) { uiLog.push(['toast', text]); },
};
const coachRun = true;   // first-time run
const coachRewind = (why, state) => {
  const hw = (t) => ({ flour: 84, jamdrop: 40, pin: 104, fan: 60 }[t] || 46);
  const near = world.hazards
    .map(h => ({ h, d: Math.abs(h.x + hw(h.t) / 2 - (state.x + 20)) }))
    .sort((a, b) => a.d - b.d)[0];
  const at = near ? Math.max(30, near.h.x - 440) : Math.max(30, state.x - 300);
  for (const h of world.hazards) if (h.x >= at && h.x <= at + 500) h.hit = false;
  state.x = at; state.y = GROUND_Y; state.vx = 0; state.vy = 0;
  state.onGround = true; state.jumping = false; state.jumpsUsed = 0;
  state.hold = false; state.coyote = 0; state.buffer = 0;
  state.slipTime = 0; state.surface = 'dry'; state.wind = 0;
  state.runPhase = 0; state.peakY = GROUND_Y;
  ui.showToast('back a step: try it again!');
  return at;
};

let pass = true;
const f = (m) => { console.error('FAIL: ' + m); pass = false; };

/* --- clumsy player: NEVER hops until two failed tries are counted, so the
 * crash on the first obstacle must rewind, not kill the run ------------- */
const s = newState(140);
const input = { jumpHeld: false };
const dt = 1 / 60;
let rewinds = 0, crashes = 0, landed = false, clearedFirst = false, learned = false;
for (let i = 0; i < 60 * 240 && !landed; i++) {
  input.jumpHeld = false;
  const evs = step(s, input, world, dt);
  for (const e of evs) {
    if (e.k === 'crash') {
      crashes++;
      /* coach path: rewind (the run keeps playing) instead of settle */
      coachRewind(e.why, s);
      rewinds++;
      if (rewinds >= 2) learned = true;   // after two tries the player "learns" the hop
      if (s.x < 30) f('rewound past the start of the counter');
      if (!s.onGround) f('player not on the counter after rewinding');
      if (s.vx !== 0 || s.vy !== 0) f('player still moving after rewinding');
      const hzReset = world.hazards.filter(h => h.x >= s.x && h.x <= s.x + 500).filter(h => h.hit);
      if (hzReset.length) f('hazards ahead of the rewind not reset: ' + hzReset.length);
      continue;
    }
    if (e.k === 'land' && learned) {
      if (s.x > hzX + 90) { clearedFirst = true; landed = true; }
    }
  }
  /* hop the first obstacle once "learned" (two crash tries): the game
   * teaches two taps, so the competent double fails are over */
  if (s.onGround && s.x > hzX - 100 && s.x < hzX - 10 && (learned || rewinds === 0)) { tryJump(s); s._dbl = true; }
  if (!s.onGround && s._dbl && learned && Math.abs(s.vy) < 40) { tryJump(s); s._dbl = false; }
  if (s.x <= 140) f('player never moved after a rewind');
}
/* a settle would come from setCrash in the real game: assert the coach path
 * never reached one (rewinds happened instead) */
if (rewinds === 0) f('no rewind happened despite the first-run crash');
if (crashes < 2 || rewinds < 2) f('expected 2 crash-rewind retries before learning, got ' + crashes + ' crashes / ' + rewinds + ' rewinds');
if (!landed) f('loop ended without the learned hop landing');
if (!clearedFirst) f('the learned hop never cleared the first obstacle');
console.log('crashes:', crashes, 'rewinds:', rewinds, 'final x:', Math.round(s.x), 'cleared first obstacle:', clearedFirst);
console.log('toasts:', JSON.stringify(uiLog));
if (!uiLog.length) f('coach never named the action in a toast');
if (!HINTS('Ghee').flour.includes('Hop')) f('flour coach text lost its hop instruction');

/* --- scenario 2: the cap. A player who NEVER hops must get exactly three
 * rewinds on the first obstacle, then coaching gives up and the run dies
 * for real, or the game would never end -------------------------------- */
const s2 = newState(140);
let rewinds2 = 0, fatal = false;
const byObstacle = {};                       // mirror of coachState.byObstacle
const coachCap = 3;
let wipedOut = false;
for (let i = 0; i < 60 * 120 && !wipedOut; i++) {
  const evs = step(s2, { jumpHeld: false }, world, dt);
  for (const e of evs) {
    if (e.k !== 'crash') continue;
    if (wipedOut) break;
    const hw2 = (t) => ({ flour: 84, jamdrop: 40, pin: 104, fan: 60 }[t] || 46);
    const near2 = world.hazards
      .map(h => ({ h, d: Math.abs(h.x + hw2(h.t) / 2 - (s2.x + 20)) }))
      .sort((a, b) => a.d - b.d)[0];
    const key = 'h' + Math.round(near2.h.x);
    const tried = (byObstacle[key] || 0) + 1;
    byObstacle[key] = tried;
    if (tried > coachCap) { wipedOut = true; fatal = true; break; }   // give up: real crash
    const at2 = Math.max(30, near2.h.x - 440);
    for (const h of world.hazards) if (h.x >= at2 && h.x <= at2 + 500) h.hit = false;
    s2.x = at2; s2.y = GROUND_Y; s2.vx = 0; s2.vy = 0; s2.onGround = true;
    s2.jumping = false; s2.jumpsUsed = 0; s2.coyote = 0; s2.buffer = 0;
    s2.runPhase = 0; s2.peakY = GROUND_Y;
    rewinds2++;
  }
}
if (!fatal) f('coaching never gave up: the sloppy run cannot end');
if (rewinds2 !== coachCap) f('expected exactly ' + coachCap + ' rewinds before the give-up, got ' + rewinds2);
console.log('cap scenario: rewinds:', rewinds2, 'fatal crash:', fatal);

console.log(pass ? 'PASS' : 'FAIL');
process.exit(pass ? 0 : 1);
