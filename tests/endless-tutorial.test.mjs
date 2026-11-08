/**
 * Headless verification of the FIRST-RUN tutorial in Endless mode (the
 * tutorial is no longer story-only): gates hang off the freshly generated
 * layout, each card names an action that is really up ahead, and a
 * competent tap-tap-tap player completes every step. Run:
 *   node tests/endless-tutorial.test.mjs  → exit 1 on failure.
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
const { GROUND_Y, newState, step, tryJump } = WW.Physics;

/* --- mirror of buildEndless: generate one endless run ------------------- */
const L = 26000;
const rng = WW.rng(4242);
const normHaz = (h) => { const o = { ...h }; if (!o.w) o.w = { flour: 84, jamdrop: 40, pin: 104, fan: 60 }[o.t] || 46; return o; };
const hazards = WW.generateEndless(L, rng).map(normHaz);
const sparks = WW.generateEndlessSparks(L, rng).map(x => ({ x, y: 34 + Math.floor(Math.abs(Math.sin(x * 0.017)) * 190), got: false }));
const kinds = Object.keys(WW.INGREDIENTS);
const ingFrom = 1200, ingStep = (L - ingFrom - 1100) / (kinds.length - 1);
const ingredients = kinds.map((k, i) => ({
  x: Math.round(ingFrom + i * ingStep),
  k, got: false,
  y: 60 + Math.round(Math.abs(Math.sin((ingFrom + i * ingStep) * 0.005)) * 130),
}));
const gems = WW.generateEndlessGems(L, rng).map(x => ({ x, y: 150, got: false, kind: 'gem' }));
const world = { length: L, platforms: [], hazards, sparks, gems, ingredients, goal: null, t: 0, fanTick: 0 };

/* --- mirror of the new endless first-run tutorial script ---------------- */
const who = 'Ghee';
const hzX = (hazards[0] || { x: 700 }).x;
const ingX = (ingredients.find(i => !i.got) || { x: 1200 }).x;
const spX = (sparks.find(s => s.x > ingX + 220) || { x: ingX + 420 }).x;
const steps = [
  { tag: 'jump',       gate: Math.max(260, hzX - 160) },
  { tag: 'ingredient', gate: Math.max(hzX + 60, ingX - 140) },
  { tag: 'spark',      gate: Math.max(ingX + 100, spX - 140) },
];

let pass = true;
const f = (m) => { console.error('FAIL: ' + m); pass = false; };

/* gate sanity: strictly ordered, and each gate stops the player BEFORE the
 * thing it teaches about */
if (hazards.length === 0) f('endless run has no hazards');
if (!(steps[0].gate < hzX)) f('hop gate must precede the first hazard');
if (!(steps[1].gate <= ingX)) f('ingredient gate must precede the first ingredient');
if (!(steps[2].gate <= spX)) f('coin gate must precede its first coin');
if (!(steps[0].gate < steps[1].gate && steps[1].gate < steps[2].gate)) {
  f('gates must be strictly ordered, got ' + steps.map(s => s.gate).join(' < '));
}

/* --- gate engine replica (same rules as game.js) ------------------------ */
const tutorial = { steps, i: 0, active: true, gateShown: new Set(), cardUp: false };
const uiLog = [];
const tutGateCheck = (s) => {
  if (!tutorial.active || s.hold || !s.onGround) return;
  const stp = tutorial.steps[tutorial.i];
  if (stp && stp.gate && s.x >= stp.gate && !tutorial.gateShown.has(tutorial.i)) {
    tutorial.gateShown.add(tutorial.i);
    s.hold = true;
    tutorial.cardUp = true;
    uiLog.push(['show', tutorial.i, stp.tag]);
  }
};
const stepTutorial = (ev) => {
  if (!tutorial.active || !tutorial.cardUp) return;
  const tagMap = { jump: 'jump', collect: 'spark', goal: 'goal', ingredient: 'ingredient' };
  if (tagMap[ev] === tutorial.steps[tutorial.i].tag) {
    tutorial.cardUp = false;
    uiLog.push(['hide', tutorial.i]);
    tutorial.i += 1;
    if (tutorial.i >= tutorial.steps.length) tutorial.active = false;
  }
};

/* --- a competent player: reads each card, then hops hazards and collects --- */
const s = newState(140);
const input = { jumpHeld: false };
const dt = 1 / 60;
let holdT = 0, gotStuff = { spark: 0, ingredient: 0 }, doubleOk = false, crashed = null;
for (let i = 0; i < 60 * 200 && tutorial.active && !crashed; i++) {
  tutGateCheck(s);
  if (s.hold) { holdT += dt; if (holdT > 0.45) { s.hold = false; holdT = 0; } continue; }   // read the card, then tap
  const stp = tutorial.steps[tutorial.i];
  if (s.onGround) {
    /* a competent player always hops the next ground hazard, whether or
     * not the current card names it */
    const hz = hazards.find(h => !h.hit && s.x > h.x - 100 && s.x < h.x - 10);
    if (hz) {
      // pause only at the money gates: the coin card releases on a sweep-up
      if (!stp || stp.tag !== 'spark') tryJump(s);
      if (stp && stp.tag === 'jump') stepTutorial('jump');
      doubleOk = true;
      continue;
    }
    if (stp && stp.tag === 'ingredient') {
      const ing = ingredients.find(p => !p.got && p.x > s.x + 12 && p.x < s.x + 150);
      if (ing) { tryJump(s); continue; }
    }
    if (stp && stp.tag === 'spark') {
      const coin = sparks.find(p => !p.got && p.x > s.x + 12 && p.x < s.x + 150);
      if (coin) { tryJump(s); continue; }
    }
  } else if (doubleOk && Math.abs(s.vy) < 40) { tryJump(s); doubleOk = false; continue; }   // second tap at the peak
  const evs = step(s, input, world, dt);
  for (const e of evs) {
    if (e.k === 'crash') { crashed = { at: Math.round(s.x), why: e.why }; break; }
    if (e.k === 'jump') stepTutorial('jump');
    if (e.k === 'collect') {
      if (e.what === 'spark') { gotStuff.spark++; stepTutorial('collect'); }
      if (e.what === 'ingredient') { gotStuff.ingredient++; stepTutorial('ingredient'); }
    }
  }
}

console.log('hazards:', hazards.length, 'firstHz x:', hzX, 'ingX:', ingX, 'spX:', spX);
console.log('gates:', steps.map(st => st.gate).join(', '));
console.log('uiLog:', JSON.stringify(uiLog), '| steps done:', tutorial.i + '/', steps.length,
  '| x:', Math.round(s.x), '| collected:', JSON.stringify(gotStuff));

const want = [['show', 0, 'jump'], ['hide', 0], ['show', 1, 'ingredient'], ['hide', 1], ['show', 2, 'spark'], ['hide', 2]];
if (JSON.stringify(uiLog) !== JSON.stringify(want)) {
  f('gate/card sequence mismatch, expected ' + JSON.stringify(want));
}
if (crashed) f('crashed at ' + crashed.at + ' why ' + crashed.why + ' (uiLog ' + uiLog.length + ' entries)');
if (tutorial.active) f('tutorial never completed in a competent run');
if (gotStuff.ingredient === 0) f('ingredient step never completed by sweeping one up');
if (gotStuff.spark === 0) f('coin step never completed by sweeping one up');
if (s.x <= 140) f('player never moved');

console.log(pass ? 'PASS' : 'FAIL');
process.exit(pass ? 0 : 1);
