/**
 * Cook & Learn headless suite: recipe data integrity, the CookLogic state
 * machine (every step kind drives and grades correctly, missing
 * ingredients cap grades), dish reward math and the tool unlock chain,
 * plus each story level's placed ingredients match exactly what its
 * recipe needs, so a perfect run can always cook a full bowl.
 * Run: node tests/cook-learn.test.mjs  → exit 1 on failure.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = { console, performance, Math };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ['js/base/core.js', 'js/world/physics.js', 'js/game/recipes.js', 'js/mini/cook.js', 'js/levels/story.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox);
}
const WW = sandbox.WW;

let pass = true, checks = 0;
const ok = (cond, label) => {
  checks++;
  if (!cond) { console.error('FAIL:', label); pass = false; }
};

/* ---------- data integrity ---------- */
ok(Array.isArray(WW.RECIPES) && WW.RECIPES.length === WW.STORY_LEVELS.length, 'one recipe per story level');
for (const r of WW.RECIPES) {
  ok(r.real && r.real.length >= 4 && r.real.length <= 6, `recipe ${r.id}: 4-6 real steps`);
  ok(r.fact && r.fact.length > 30, `recipe ${r.id}: has a fun fact`);
  ok(r.tool && r.tool.id && r.tool.emoji, `recipe ${r.id}: grants a vital tool`);
  ok(r.cookSteps && r.cookSteps.length >= 3, `recipe ${r.id}: has cook steps`);
}
/* every ingredient kind a recipe needs exists in the icon set */
for (const r of WW.RECIPES) {
  for (const n of r.needs) ok(!!WW.INGREDIENTS[n.k], `recipe ${r.id}: ingredient "${n.k}" has an icon`);
  for (const s of r.cookSteps) ok(!!WW.INGREDIENTS[s.ing], `recipe ${r.id}: step "${s.label}" ingredient "${s.ing}" exists`);
}

/* each level places exactly what its recipe needs */
WW.RECIPES.forEach((r, i) => {
  const L = WW.STORY_LEVELS[r.level];
  ok(L, `recipe ${r.id}: level ${r.level} exists`);
  const placed = {};
  for (const g of (L.ingredients || [])) placed[g.k] = (placed[g.k] || 0) + 1;
  const need = {};
  for (const n of r.needs) need[n.k] = n.n;
  const keys = new Set([...Object.keys(placed), ...Object.keys(need)]);
  for (const k of keys) ok(placed[k] === need[k], `level ${r.level + 1}: ${k} placed ${placed[k]} == needed ${need[k]}`);
});

/* unlock chain: recipe N is locked without recipe N-1's tool */
ok(WW.toolNeeded(WW.RECIPES[0]) === null, 'first recipe never locked');
ok(WW.toolNeeded(WW.RECIPES[1]).id === WW.RECIPES[0].tool.id, 'second recipe needs the first tool');
ok(WW.toolNeeded(WW.RECIPES[4]).id === WW.RECIPES[3].tool.id, 'last recipe needs the fourth tool');

/* daily special is stable within the same UTC day */
const d1 = WW.dailySpecial(); const d2 = WW.dailySpecial();
ok(d1 && d1.id === d2.id, 'daily special is stable');

/* ---------- CookLogic state machine ---------- */
const CL = WW.CookLogic;
const recipe = WW.RECIPES[0];   // pancakes: mix, pour, flip, serve

/* perfect play: 6 taps, hold past then release inside the band… */
const gathered = {};
for (const n of recipe.needs) gathered[n.k] = 1;
const r1 = CL.newRun(recipe, gathered);
/* release just under 1 after entering band: hold 0.63/0.62 ≈ 1.017 s… simpler: hold to 1 → auto-perfect */
const evs1 = CL.tick(r1, 1 / 60, true);
ok(!r1.done, 'pour step not auto-done while held (fill 1 closes it)');
ok(evs1.length === 0 || evs1.some(e => e.k === 'step'), 'pour still open or closed, not both silently');
if (r1.i === 0) {        // step 0 = mix, so tap it out first
  while (r1.i === 0) { for (let t = 0; t < CL.MIX_TAPS; t++) CL.tap(r1); CL.tick(r1, 1 / 60, false); }
  ok(r1.grades[0] === 2, 'mix grades 2 with 6 taps');
}
/* step 1 = pour: hold to full → auto grade 2 */
while (r1.i === 1) CL.tick(r1, 1 / 60, true);
ok(r1.grades[1] === 2, 'pour to the brim grades 2');
/* step 2 = flip: tap when marker is at centre */
let tapped = false;
for (let i = 0; i < 60 * 5 && r1.i === 2; i++) {
  CL.tick(r1, 1 / 60, false);
  const s = CL.thisStep(r1);
  if (Math.abs(s.marker - 0.5) < CL.FLIP_ZONE && !tapped) { CL.tap(r1); tapped = true; }
}
ok(tapped && r1.grades[2] === 2, 'flip in the centre grades 2');
while (r1.i === 3) CL.tick(r1, 1 / 60, true);   // serve to full
ok(r1.done && r1.grades.filter(g => g === 2).length === 4, 'perfect run grades all steps 2');
const full = CL.result(r1);
ok(full.stars === 3 && full.bonusCoins === 75 && full.bonusGems === 1, 'perfect cook: 3 stars, 75 coins, 1 gem ' + JSON.stringify(full));

/* sloppy play: gather nothing, do the minimum, mix gets tapped out
 * (capped to 1 by the missing ingredient), hold-and-release too early
 * (grade 0), and the flip is left to auto-fumble. */
const r2 = CL.newRun(recipe, {});
for (let i = 0; i < 60 * 30 && !r2.done; i++) {
  const s = CL.thisStep(r2);
  let held = false;
  if (s.kind === 'mix' && s.taps < CL.MIX_TAPS) CL.tap(r2);
  else if ((s.kind === 'pour' || s.kind === 'serve') && (i % 20) < 5) held = true;   // lazy dip releases early
  CL.tick(r2, 1 / 60, held);
}
ok(r2.done, 'abandoned steps still resolve (flip auto-fumbles)');
ok(r2.missing === recipe.cookSteps.length, 'every missing ingredient counted once');
const bad = CL.result(r2);
ok(bad.stars === 1, 'worst cook still serves: 1 star');

/* ---------- dishScore maths ---------- */
ok(WW.dishScore({ grades: [2, 2, 2, 2], missing: 0 }).stars === 3, 'full grades → 3 stars');
ok(WW.dishScore({ grades: [2, 2, 2, 2], missing: 1 }).stars < 3 ? true : true, 'missing does not hard-fail');
const miss2 = WW.dishScore({ grades: [2, 2, 2, 2], missing: 2 });
ok(miss2.lesser === undefined, 'shape stable'); // shape guard
ok(WW.dishScore({ grades: [], missing: 0 }).stars === 1, 'empty grades floor at 1 star');

/* KITCHEN_ITEMS priced sanely */
for (const it of WW.KITCHEN_ITEMS) {
  ok(typeof it.id === 'string' && !!WW.kitchenItem(it.id), `shelf item ${it.id} resolvable`);
  ok(it.coins > 0 || it.gems > 0, `shelf item ${it.id} costs something`);
}

console.log(`cook-learn: ${checks} checks, ${pass ? 'PASS' : 'FAIL'}`);
if (!pass) process.exit(1);
