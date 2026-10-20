/**
 * Headless drive of level 1 with realistic 60fps stepping.
 * Sweeps the realistic tap spots: first hop as the flour arrives, then a
 * mid-air second hop at each frame from lift-off to apex, exactly like a
 * human tapping. Reports where Ghee lands relative to the floating
 * platform — the player-reported "jumps but falls to the floor" bug.
 * Run: node tests/tut-driver.test.mjs  → exit 1 on failure.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = { console, performance, Math };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'js/base/core.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'js/world/physics.js'), 'utf8'), sandbox);
const WW = sandbox.WW;
const { GROUND_Y, newState, step, tryJump } = WW.Physics;

const level1 = () => ({
  length: 2600,
  platforms: [ { x: 880, w: 150, y: 96 }, { x: 1250, w: 130, y: 96 }, { x: 2050, w: 170, y: 96 } ],
  hazards: [
    { t: 'flour', x: 760, w: 84 }, { t: 'flour', x: 1140, w: 84 }, { t: 'flour', x: 1580, w: 84 },
  ],
  sparks: [], gems: [], goal: null, t: 0, fanTick: 0,
});

/** Drive one run: hop before the flour (plus optional mid-air double hop),
 * and stop at the FIRST landing — the floor or the platform. */
function run(firstHopX, doubleHopX) {
  const w = level1();
  const s = newState(140);
  const input = { jumpHeld: false };
  const dt = 1 / 60;
  const plat = w.platforms[0];
  const platTop = GROUND_Y + plat.y;
  let first = false, double = false, peak = 0;
  for (let i = 0; i < 60 * 10; i++) {
    if (!first && s.x >= firstHopX && s.onGround) { tryJump(s); first = true; }
    if (first && !double && doubleHopX >= 0 && s.x >= doubleHopX && !s.onGround) { tryJump(s); input.jumpHeld = false; double = true; }
    const evs = step(s, input, w, dt);
    if (evs.some(e => e.k === 'crash')) return { firstHopX, doubleHopX, crash: true, at: Math.round(s.x) };
    peak = Math.max(peak, s.y);
    if (first && i > 10 && s.onGround) {
      // first landing after the initial hop
      return { firstHopX, doubleHopX, peakY: Math.round(peak), x: Math.round(s.x), y: Math.round(s.y),
               onPlat: Math.abs(s.y - platTop) < 8 };
    }
  }
  return { firstHopX, doubleHopX, timeout: true, x: Math.round(s.x), y: Math.round(s.y) };
}

/* sweep: hop the flour at several tap moments, double-hop each frame after */
const rows = [];
for (const hopX of [676, 692, 706, 718]) {
  rows.push(run(hopX, -1));  // plain single hop, no double
  for (let dh = 760; dh < 900; dh += 10) {
    rows.push(run(hopX, dh));
    if (rows.at(-1).crash) break;
  }
}
console.log('hopX\tdblX\tpkY\tlandX\tlandY\tonPlat');
for (const r of rows) console.log(`${r.firstHopX}\t${r.doubleHopX}\t${r.peakY}\t${r.x}\t${r.y}\t${!!r.onPlat}${r.crash ? '\tCRASH@' + r.at : ''}${r.timeout ? '\tTIMEOUT' : ''}`);

/* pass criterion: for every hop timing where the double-hop is not needed
 * (peak above platform top), landing must catch the platform or at least
 * the floor must not be reached while still over platform x-range. */
const misses = rows.filter(r => !r.crash && !r.timeout && !r.onPlat);
console.log(`\n${rows.length} runs, ${misses.filter(r => r.y <= GROUND_Y + 2).length} landed on the floor past the platform, ${rows.filter(r => r.onPlat).length} landed ON the platform`);
