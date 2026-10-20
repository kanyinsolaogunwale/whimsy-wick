/**
 * Headless verification of the gate-driven tutorial flow: each gate stops
 * Ghee, the card shows, the action releases her, and the popup hides until
 * the next gate. Run: node tests/tut-flow.test.mjs  → exit 1 on failure.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = { console, performance, Math };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ['js/base/core.js', 'js/world/physics.js', 'js/levels/story.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox);
}
const WW = sandbox.WW;
const { GROUND_Y, newState, step, tryJump } = WW.Physics;

const cfg = WW.STORY_LEVELS[0];
const plat = (cfg.platforms || []).map(p => ({ ...p }));
const world = {
  length: cfg.length,
  platforms: plat,
  hazards: cfg.hazards.map(h => ({ ...h })),
  sparks: cfg.sparks.map(x => {
    const p = plat.find(pp => x >= pp.x - 6 && x <= pp.x + pp.w + 6);
    return { x, y: p ? p.y + 52 : 34 + Math.floor(Math.abs(Math.sin(x * 0.021)) * 150), got: false };
  }),
  gems: [], goal: { x: cfg.goal.x, done: false }, t: 0, fanTick: 0,
};

/* minimal replica of the game.js gate engine */
const tutorial = { steps: cfg.tutorial, i: 0, active: true, gateShown: new Set(), cardUp: false };
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
  const tagMap = { jump: 'jump', collect: 'spark', goal: 'goal' };
  if (tagMap[ev] === tutorial.steps[tutorial.i].tag) {
    tutorial.cardUp = false;
    uiLog.push(['hide', tutorial.i]);
    tutorial.i += 1;
    if (tutorial.i >= tutorial.steps.length) tutorial.active = false;
  }
};

const s = newState(140);
const input = { jumpHeld: false };
const dt = 1 / 60;
let moved = 0, holdT = 0;
for (let i = 0; i < 60 * 90 && tutorial.active; i++) {
  tutGateCheck(s);
  if (s.hold) { holdT += dt; }   // player reading the card…
  if (s.hold && holdT > 0.45) { s.hold = false; holdT = 0; continue; }   // …then taps: first tap resumes the run
  // hop over each flour as it nears (a competent player)
  if (s.onGround) {
    for (const h of world.hazards) {
      if (h.t === 'flour' && s.x > h.x - 90 && s.x < h.x + 10) { tryJump(s); stepTutorial('jump'); break; }
    }
  }
  if (tutorial.i === 1 && s.onGround && s.x > 830 && s.x < 885) { tryJump(s); }    // hop up to the shelf coins
  const evs = step(s, input, world, dt);
  for (const e of evs) {
    if (e.k === 'hold') continue;                       // waiting on the player
    if (e.k === 'crash') { console.error('FAIL: crashed at', Math.round(s.x), 'why', e.why); process.exit(1); }
    if (e.k === 'jump') stepTutorial('jump');
    if (e.k === 'collect' && e.what === 'spark') stepTutorial('collect');
    if (e.k === 'goal') stepTutorial('goal');
  }
  if (evs.some(e => e.k === 'moved')) moved++;
}

console.log('uiLog:', JSON.stringify(uiLog));
console.log('final x', Math.round(s.x), 'steps done:', tutorial.i, '/', tutorial.steps.length);

let pass = true;
/* expected card sequence: show@0(hold) hide → show@1 hide → show@2 hide */
const want = [ ['show', 0, 'jump'], ['hide', 0], ['show', 1, 'spark'], ['hide', 1], ['show', 2, 'goal'], ['hide', 2] ];
if (JSON.stringify(uiLog) !== JSON.stringify(want)) {
  console.error('FAIL: gate/card sequence mismatch — expected', JSON.stringify(want));
  pass = false;
}
if (moved === 0) { console.error('FAIL: Ghee never moved after gates cleared'); pass = false; }
if (s.x < 2500) { console.error('FAIL: never reached the wick (x=' + Math.round(s.x) + ')'); pass = false; }

if (!pass) process.exit(1);
console.log('PASS gate-driven tutorial flow (gates stop, card shows, action releases, hides after)');
