/**
 * Deterministic platform-landing test — runs WW.Physics.step headlessly.
 * Scenario A: hop over the flour, double-hop at the platform edge, land on platform.
 * Scenario B: fast fall over the platform — the old narrow landing window let
 *             high-speed falls tunnel through to the floor; the swept crossing
 *             check must catch them.
 * Run: node tests/platform-landing.test.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const sandbox = { console, performance, Math };
sandbox.window = sandbox;          // bare `WW` and `window.WW` must both resolve
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'js/base/core.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'js/world/physics.js'), 'utf8'), sandbox);

const WW = sandbox.WW;
const { GROUND_Y, newState, step, tryJump } = WW.Physics;

const level1 = {
  length: 2600,
  platforms: [ { x: 880, w: 150, y: 96 } ],
  hazards: [ { t: 'flour', x: 760, w: 84 }, { t: 'flour', x: 1140, w: 84 }, { t: 'flour', x: 1580, w: 84 } ],
  sparks: [], gems: [], goal: null, t: 0, fanTick: 0,
};

/** Simulate until onGround at a given height, or timeout. */
function runTripleHop() {
  const s = newState(140);
  const dt = 1 / 60;
  const input = { jumpHeld: false };
  let phase = 0; let landed = null; let peakY = 0;
  for (let i = 0; i < 60 * 12 && !landed; i++) {
    const events = step(s, input, level1, dt);
    for (const e of events) {
      if (e.k === 'crash') return { crashed: true, why: e.why, x: s.x };
      if (e.k === 'collect') continue;
    }
    if (phase === 0 && s.x > 700) { tryJump(s); phase = 1; }
    else if (phase === 1 && s.x > 788 && s.onGround) { tryJump(s); input.jumpHeld = false; setTimeout(() => {}, 0); phase = 2; step(s, input, level1, dt); tryJump(s); }
    else if (phase === 2) {
      peakY = Math.max(peakY, s.y);
      const platTop = GROUND_Y + 96;
      if (s.onGround && s.y >= platTop - 6) landed = { x: s.x, y: s.y };
      else if (s.onGround && s.y <= GROUND_Y + 1 && s.x > 790 && s.x < 900 && peakY < platTop) return { fellToFloor: true, peakY, x: s.x };
    }
  }
  return landed || { timeout: true, x: s.x, y: s.y, onGround: s.onGround };
}

/** Fast-fall: launch straight down onto the platform (no drift), from
 *  apex height — this is the case the old narrow window tunnelled through. */
function runFastFall() {
  const s = newState(140);
  const dt = 1 / 60;
  const input = { jumpHeld: false };
  // directly over the platform, apex height, zero horizontal drift
  s.x = 950; s.y = GROUND_Y + 400; s.vy = 0; s.vx = 0;
  let landed = null;
  for (let i = 0; i < 60 * 4 && !landed; i++) {
    step(s, input, level1, dt);
    const platTop = GROUND_Y + 96;
    if (s.onGround && Math.abs(s.y - platTop) < 2) landed = { x: s.x, y: s.y };
    else if (s.onGround && s.y <= GROUND_Y + 1) return { tunneledToFloor: true, x: s.x, y: s.y };
  }
  return landed || { timeout: true, x: s.x, y: s.y };
}

const A = runTripleHop();
const B = runFastFall();
console.log('A (hop onto platform):', A);
console.log('B (fast-fall):        ', B);

let pass = true;
if (A.crashed || A.fellToFloor || A.timeout) { console.error('FAIL: hop does not reliably land on the platform'); pass = false; }
if (B.tunneledToFloor || B.timeout) { console.error('FAIL: fast fall tunneled through the platform'); pass = false; }
if (!pass) process.exit(1);
console.log('PASS both platform-landing scenarios');
