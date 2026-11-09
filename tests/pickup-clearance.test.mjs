/**
 * Pickup clearance test: no coin, gem or ingredient may sit on a hazard.
 *
 * Property-checks the real guard (WW.storyPickupX) at every x/y a built level
 * can ask for, using the drawn size of each pickup, and does the same against
 * generated endless layouts. Also proves the guard actually engages, so a
 * no-op guard cannot pass silently.
 *
 * Run: node tests/pickup-clearance.test.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const sandbox = { console, performance, Math };
sandbox.window = sandbox;          // bare `WW` and `window.WW` must both resolve
vm.createContext(sandbox);
for (const f of ['js/base/core.js', 'js/world/physics.js', 'js/levels/story.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox);
}

const WW = sandbox.WW;

/* Danger zones, mirroring the art's height and the physics hit widths. */
const HAZ_TOP = { flour: 40, pin: 34, fan: 90 };
const HAZ_W = { flour: 84, jamdrop: 40, pin: 104, fan: 60 };

const footprint = (h) => {
  const w = h.w || HAZ_W[h.t] || 46;
  const reach = h.t === 'fan' ? WW.Physics.WIND.reach : 0;   // breeze blows back
  const patrol = h.t === 'pin' ? (h.range || 0) : 0;         // pin sweeps its range
  return [h.x - reach, h.x + w + patrol];
};
const sunk = (x, y, r, h) => {
  const top = HAZ_TOP[h.t];
  if (top === undefined) return false;          // butter/milk/jam are slips, not walls
  if (!(y - r < top)) return false;
  const [a, b] = footprint(h);
  return x + r > a && x - r < b;
};
const norm = (h) => ({ ...h, w: h.w || HAZ_W[h.t] || 46 });

let failures = 0;
let moved = 0;
const fail = (msg) => { failures++; console.log('FAIL ' + msg); };

/** Sweep one guard across x/y, asserting the result is never inside a hazard. */
const sweep = (label, hazards, length, xStep) => {
  for (const r of [15, 17, 22]) {               // coin, gem, ingredient art
    for (let y = 30; y <= 240; y += 10) {
      for (let x = 0; x <= length; x += xStep) {
        const gx = WW.storyPickupX(x, hazards, y, length, r);
        if (gx !== x) moved++;
        for (const h of hazards) {
          if (sunk(gx, y, r, h)) fail(`${label}: pickup ${gx},${y} r${r} on ${h.t}@${h.x}`);
        }
      }
    }
  }
};

/* ---- story levels ---- */
for (const lvl of WW.STORY_LEVELS) {
  const hazards = lvl.hazards.map(norm);
  sweep(lvl.id, hazards, lvl.length, 7);
}

/* ---- endless layouts (several seeds, the real generator) ---- */
for (const seed of [1, 7, 42, 2024]) {
  const L = 26000;
  const hazards = WW.generateEndless(L, WW.rng(seed)).map(norm);
  if (!hazards.length) fail(`endless seed ${seed}: no hazards generated`);
  sweep(`endless seed ${seed}`, hazards, L, 41);
}

if (!moved) fail('guard never moved a pickup, the sweep proves nothing');

if (failures) {
  console.log(`\n${failures} pickup clearance failure(s)`);
  process.exit(1);
}
console.log(`pickup clearance: 0 overlaps, ${moved.toLocaleString()} placements cleared`);
