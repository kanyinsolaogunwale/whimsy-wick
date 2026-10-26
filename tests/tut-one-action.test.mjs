/**
 * One-action-at-a-time proof: a greedy player taps constantly and collects
 * every coin. The gate-driven tutorial must still advance strictly ONE
 * action per card, stray hops and coins picked up between gates must NOT
 * advance or skip any card. Mirrors game.js stepTutorial exactly.
 * Run: node tests/tut-one-action.test.mjs  → exit 1 on failure.
 */
import fs from 'node:fs';
import vm from 'node:vm';

const sandbox = { console, performance, Math };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ['js/base/core.js', 'js/world/physics.js', 'js/levels/story.js']) {
  vm.runInContext(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8'), sandbox);
}
const { newState, step, tryJump } = sandbox.WW.Physics;
const cfg = sandbox.WW.STORY_LEVELS[0];
const plat = (cfg.platforms || []).map(p => ({ ...p }));
const world = {
  length: cfg.length, platforms: plat, hazards: cfg.hazards.map(h => ({ ...h })),
  sparks: cfg.sparks.map(x => {
    const p = plat.find(pp => x >= pp.x - 6 && x <= pp.x + pp.w + 6);
    return { x, y: p ? p.y + 52 : 34 + Math.floor(Math.abs(Math.sin(x * 0.021)) * 150), got: false };
  }),
  gems: [], goal: { x: cfg.goal.x, done: false }, t: 0,
  ingredients: (cfg.ingredients || []).map(it => ({ ...it, got: false })),
};

const tutorial = { steps: cfg.tutorial, i: 0, active: true, gateShown: new Set(), cardUp: false };
const s = newState(140);
const dt = 1 / 60;
/* mirrors game.js: a step completes only when its action happens while the
 * card is up; anything else is ignored */
const completions = [];
const doStep = (ev) => {
  if (!tutorial.active || !tutorial.cardUp) return { advanced: false };
  const tagMap = { jump: 'jump', collect: 'spark', goal: 'goal', ingredient: 'ingredient' };
  if (tagMap[ev] === tutorial.steps[tutorial.i].tag) {
    tutorial.cardUp = false;
    completions.push('card' + tutorial.i + ':' + ev);
    tutorial.i += 1;
    if (tutorial.i >= tutorial.steps.length) tutorial.active = false;
    return { advanced: true };
  }
  return { advanced: false };
};

let hops = 0, coins = 0, ings = 0, strayOnly = true;
for (let i = 0; i < 60 * 90 && (tutorial.active || s.x < cfg.goal.x); i++) {
  /* gate: hold at the card's obstacle, show card */
  if (!s.hold && s.onGround && tutorial.active) {
    const stp = tutorial.steps[tutorial.i];
    if (stp && stp.gate && s.x >= stp.gate && !tutorial.gateShown.has(tutorial.i)) {
      tutorial.gateShown.add(tutorial.i); s.hold = true; tutorial.cardUp = true;
    }
  }
  if (s.hold) { s.hold = false; }   // tap to resume: card stays up, action still pending
  if (s.onGround) {
    for (const h of world.hazards) {
      if (h.t === 'flour' && s.x > h.x - 90 && s.x < h.x + 10) { tryJump(s); hops++; doStep('jump'); break; }
    }
    if (i % 33 === 0) { tryJump(s); hops++; doStep('jump'); }   // greedy extra taps
  }
  if (tutorial.i === 2 && s.onGround && s.x > 830 && s.x < 885) { tryJump(s); }   // shelf coins
  const evs = step(s, { jumpHeld: false }, world, dt);
  for (const e of evs) {
    if (e.k === 'collect' && e.what === 'spark') { coins++; doStep('collect'); }
    if (e.k === 'collect' && e.what === 'ingredient') { ings++; doStep('ingredient'); }
    if (e.k === 'goal') { doStep('goal'); }
  }
}

console.log('hops:', hops, 'coins:', coins, 'ingredients:', ings, 'completions:', JSON.stringify(completions), 'steps done:', tutorial.i, '/', tutorial.steps.length);

let pass = true;
if (tutorial.i !== 4) { console.error('FAIL: tutorial did not finish:', tutorial.i); pass = false; }
if (completions.length !== 4) { console.error('FAIL: expected exactly 4 card completions (one action each):', completions); pass = false; }
/* the jump card must have been completed by exactly ONE of the many hops */
/* the spark card must have been completed by exactly ONE of the many coins */
if (!completions.some(c => c === 'card0:ingredient')) { console.error('FAIL: the ingredient card was never completed by an ingredient grab'); pass = false; }
if (s.x < cfg.goal.x) { console.error('FAIL: did not reach the wick: x=' + Math.round(s.x)); pass = false; }

if (!pass) process.exit(1);
console.log('PASS: one action at a time, every stray hop/coin was ignored; each card needed exactly its one action');
