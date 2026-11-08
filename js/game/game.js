/**
 * Whimsy Wick, js/game/game.js
 * ---------------------------------------------------------------
 * Orchestrator: state machine across title/story/endless/pause/results,
 * first-run tutorial (once, persisted), per-hazard hints, story saves,
 * endless scoring (sparks ×10 + metres), pause semantics, start.ng saving.
 */
(() => {
'use strict';
const WW = window.WW;
const $ = (id) => document.getElementById(id);
const G = WW.Physics.GROUND_Y;

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

WW.createGame = (canvas) => {
  const data = WW.persist.load();
  WW.settings = data.settings;

  const engine = WW.Engine(canvas);
  const input = WW.Input(canvas);
  const ui = WW.UI;

  let mode = 'title';             // title | story | characters | howto | settings | pause | play | result | ending
  let playMode = null;            // 'story' | 'endless'
  let state = null, world = null, levelIdx = 0, levelCfg = null;
  let charDef = WW.CHARACTERS.find(c => c.id === data.character) || WW.CHARACTERS[0];
  /* reactions name whichever spirit is actually hopping, never a hard-coded one */
  const charName = () => (WW.CHARACTERS.find(c => c.id === data.character) || WW.CHARACTERS[0]).name;
  let animT = 0, running = false, paused = false, raf = null, lastTs = 0;
  let runStats = null;            // endless: {score, sparks, time}
  let tutorial = null;            // active tutorial script
  let tutorialForced = false;  let coachRun = false;   // first-run rewind: crashes coach, never kill
  let coachState = null;       // per-run rewind ledger (tries per obstacle)
  let flash = null, flashT = 0;
  let collectChain = 0, collectChainT = 0;
  /* ingredient combo (Cook & Learn): quick same-kind sweeps pay extra */
  let ingCombo = 0, ingComboKind = '', ingComboT = 0;
  let factsQueue = null;            //Cook & Learn: tip toasts queued across the run
  let uiReturn = 'title';           // where howto/settings go back to
  let charsReturn = 'title';        // where the shop goes back to (kitchen tab → the kitchen)

  /* -------------------------------------------------------
   *  world builders
   * ------------------------------------------------------- */
  /* Spark/gem positions are offsets ABOVE the ground line (engine adds G). */
  const sparkY = (x, platforms) => {
    for (const p of platforms) if (x >= p.x - 6 && x <= p.x + p.w + 6) return p.y + 52;
    return 34 + Math.floor(Math.abs(Math.sin(x * 0.021)) * 150);
  };
  const gemY = (x, platforms) => {
    for (const p of platforms) if (x >= p.x - 6 && x <= p.x + p.w + 6) return p.y + 58;
    return 150;
  };

  /* fair hit-widths matching the drawn art (§5.1 collisions match visuals) */
  const normHaz = (h) => {
    const o = { ...h };
    if (!o.w) o.w = { flour: 84, jamdrop: 40, pin: 104, fan: 60 }[o.t] || 46;
    return o;
  };

  const buildStory = (idx) => {
    const cfg = WW.STORY_LEVELS[idx];
    const plat = (cfg.platforms || []).map(p => ({ ...p }));
    const hazards = cfg.hazards.map(normHaz);
    /* coins and ingredients never sit inside a hazard: a pickup in a flour
     * cloud or a pin's patrol asks the player to run through the thing the
     * level told them to avoid */
    const sparks = cfg.sparks.map(x => {
      const y = sparkY(x, plat);
      return { x: WW.storyPickupX(x, hazards, y, cfg.length, 13), y, got: false };
    });
    const gems = (cfg.gems || []).map(x => ({ x, y: gemY(x, plat), got: false, kind: 'gem' }));
    /* Cook & Learn: the level's recipe + typed ingredient pickups */
    const recipe = WW.recipeForLevel(idx);
    const ingredients = (cfg.ingredients || []).map(it => ({
      ...it, got: false, x: WW.storyPickupX(it.x, hazards, it.y, cfg.length, 20),
    }));
    world = {
      length: cfg.length,
      platforms: plat, hazards, sparks, gems, ingredients,
      /* the story pages stand on the counter where their card will open;
       * parts already read stay off the shelf */
      story: (cfg.story || []).map((p, i) => ({
        /* a page never sits on an obstacle: its x is nudged to clean counter */
        x: WW.storyPageX(p.at, hazards, cfg.length), y: 46, i,
        got: ((data.story.parts || {})[cfg.id] || []).includes(i),
      })),
      goal: { x: cfg.goal.x, done: false },
      t: 0,
    };
    engine.build({
      world, theme: cfg.theme, charDef, rows: cfg.decorations || [],
      startX: 140, apply: (e) => e,
    });
    applyCharTint();
    levelIdx = idx; levelCfg = cfg;
    runStats = {
      sparks: 0, coins: 0, gems: 0, sparksGround: cfg.sparks.length,
      recipe: recipe ? recipe.id : null, recipeNeeds: recipe || null,
      ingredients: {}, ingredientsGround: ingredients.length,
    };
    resetState();
    ui.setHUD('story', cfg.name);
    /* story fragments: replaying a level stops only for the parts this
     * save has not read yet, in counter order */
    data.story.parts = data.story.parts || {};        // older saves predate fragments
    const foundParts = data.story.parts[cfg.id] || (data.story.parts[cfg.id] = []);
    runStats.partsTotal = (cfg.story || []).length;
    runStats.partsFound = foundParts.length;
    runStats.partsLeft = (cfg.story || []).map((p, i) => ({ ...p, i }))
      .filter(p => !foundParts.includes(p.i));
    ui.hud.parts(runStats.partsFound, runStats.partsTotal);
    ui.showNone(); ui.hud.show(true);
    ui.hud.coins(0); ui.hud.gems(0);
    ui.hud.ingredients(ingredientStrip());
    /* Half-Prepped Pantry (Kitchen Shelf): the first ingredient waits
     * in the bowl before the run even starts */
    if (recipe && data.kitchen.includes('pantry')) {
      const first = world.ingredients.find(i => !i.got);
      if (first) {
        first.got = true;
        runStats.ingredients[first.k] = (runStats.ingredients[first.k] || 0) + 1;
        ui.showToast('Pantry prepped: the ' + (WW.INGREDIENTS[first.k] || {}).name?.toLowerCase() + ' started in the bowl!', 3600);
        ui.hud.ingredients(ingredientStrip());
      }
    }
    buildFacts(cfg);
    coachRun = tutorialForced || !data.tutorialDone;
    coachState = { byObstacle: {} };
    maybeTutorial(cfg);
  };

  /* HUD chip row: one chip per recipe ingredient (Collected 1/2 …), or a
   * single gatherer basket in endless (every kind spawns once out there) */
  const ingredientStrip = () => {
    if (!(runStats && runStats.ingredients)) return null;
    if (!runStats.recipeNeeds) {
      const total = (world && world.ingredients ? world.ingredients.length : Object.keys(WW.INGREDIENTS).length);
      const have = Object.keys(runStats.ingredients).length;
      return [{ k: 'basket', n: total, emoji: '\u{1F9FA}', name: 'Ingredients', have }];
    }
    const recipe = runStats.recipeNeeds;
    return recipe.needs.map(({ k, n }) => ({
      k, n,
      emoji: (WW.INGREDIENTS[k] || {}).emoji || '\u{1F34E}',
      name: (WW.INGREDIENTS[k] || {}).name || k,
      have: (runStats.ingredients && runStats.ingredients[k]) || 0,
    }));
  };

  /* result-panel strip: what Ghee actually gathered this run (Cook & Learn) */
  const gatheredStrip = () => {
    const t = runStats && runStats.ingredients || {};
    return Object.entries(t).map(([k, n]) => ({
      k, n,
      emoji: (WW.INGREDIENTS[k] || {}).emoji || '\u{1F34E}',
      name: (WW.INGREDIENTS[k] || {}).name || k,
    }));
  };

  /* cooking fact toasts: one per level, first time only */
  const buildFacts = (cfg) => {
    data.factsSeen = data.factsSeen || {};
    factsQueue = (cfg.facts || [])
      .map((f, i) => ({ at: 420 + i * 950, fact: f, i }))
      .filter((f) => !data.factsSeen[cfg.id + ':' + f.i]);
  };

  /* Reward scale per level, mirrored from ui.js (what a clear pays). */
  const STORY_REWARDS = [
    { coins: 60, gems: 3 }, { coins: 80, gems: 4 }, { coins: 100, gems: 5 },
    { coins: 120, gems: 6 }, { coins: 150, gems: 8 },
  ];

  const buildEndless = () => {
    tutorial = null;
    ui.hideTutorial();                 // the first card only shows at the first gate
    factsQueue = null;
    const rng = WW.rng((Date.now() >>> 10) % 99991);
    const L = 26000;    const hazards = WW.generateEndless(L, rng).map(normHaz);
    const sparks = WW.generateEndlessSparks(L, rng).map(x => ({ x, y: 34 + Math.floor(Math.abs(Math.sin(x * 0.017)) * 190), got: false }));
    const gems = WW.generateEndlessGems(L, rng).map(x => ({ x, y: gemY(x, []), got: false, kind: 'gem' }));
    /* every ingredient kind takes one ride in the endless run: all 13 kinds
     * laid on an even ladder from the start so a full run can bank the set */
    const kinds = Object.keys(WW.INGREDIENTS);
    const ingFrom = 1200, ingStep = (L - ingFrom - 1100) / (kinds.length - 1);
    const ingredients = kinds.map((k, i) => ({
      x: Math.round(ingFrom + i * ingStep),
      k,
      y: 60 + Math.round(Math.abs(Math.sin((ingFrom + i * ingStep) * 0.005)) * 130),
      got: false,
    }));
    world = {
      length: L, platforms: [], hazards, sparks, gems, ingredients,
      goal: null, t: 0,
    };
    engine.build({ world, theme: rng() < 0.5 ? 'night' : 'flour', charDef, rows: ['window'], startX: 140 });
    applyCharTint();
    runStats = { sparks: 0, coins: 0, gems: 0, time: 0, dist: 0, score: 0, ingredients: {} };
    resetState();
    playMode = 'endless';
    ui.setHUD('endless', 'Endless Challenge');
    ui.hud.coins(0); ui.hud.gems(0); ui.hud.score(0); ui.hud.dist(0); ui.hud.time(0);
    ui.hud.ingredients(ingredientStrip());
    ui.showNone(); ui.hud.show(true);
    maybeHint('butter');
    /* First-run tutorial works in Endless too: the gates hang off the
     * freshly generated layout (first ingredient, first hazard, first
     * coins) so each card names an action that is really up ahead. */
    coachRun = tutorialForced || !data.tutorialDone;
    coachState = { byObstacle: {} };
    if (coachRun) {
      const who = charName();
      const hzX = (hazards[0] || { x: 700 }).x;                 // first thing to pass: the hop card
      const ingX = (ingredients.find(i => !i.got) || { x: 1200 }).x;
      const spX = (sparks.find(s => s.x > ingX + 220) || { x: ingX + 420 }).x;
      startTutorial([
        { tag: 'jump',  title: 'Hop the hazards!',  prompt: 'Tap (or Space) to hop over what lies ahead', gate: Math.max(260, hzX - 160),
          text: `Tap to hop. Tap the screen (or press Space). ${who} can jump again mid-air to clear anything ahead.` },
        { tag: 'ingredient', title: 'Sweep up the ingredients!', prompt: 'Run on: the ingredients wait in the pantry', gate: Math.max(hzX + 60, ingX - 140),
          text: 'Every ingredient you sweep up waits in the pantry for the Whimsical Kitchen. Hop for the high ones!' },
        { tag: 'spark', title: 'Grab the coins',    prompt: 'Sweep through the floating coins', gate: Math.max(ingX + 100, spX - 140),
          text: 'Sweep through the floating coins to gather them.' },
      ]);
    }
  };

  const florless = (t, rng) => (rng() < 0.5 ? 'night' : t); /* keeps theme variety */

  const resetState = () => {
    state = WW.Physics.newState(140);
    engine.setPose(null);
    poseFreezeT = 0;
    paused = false;
    if (world) { world.t = 0; world.goalDone = false; for (const h of world.hazards) { h.hit = false; h.cleared = false; h.px = h.px ?? undefined; } }
  };

  const shopInfo = () => ({ owned: data.owned, balance: data.wallet.coins, gems: data.wallet.gems, equipped: data.character });

  const applyCharTint = () => {
    const fresh = WW.CHARACTERS.find(c => c.id === data.character) || WW.CHARACTERS[0];
    delete fresh.tint;
    const style = (WW.player && WW.player.info && WW.player.info.style) || null;
    if (style) WW.applyStartNgStyle(fresh, style);
    charDef = fresh;
    if (world && state) {
      engine.build({ world, theme: levelCfgTheme(), charDef, rows: currentRows(), startX: state.x });
    }
  };
  const levelCfgTheme = () => levelCfg ? levelCfg.theme : 'night';
  const currentRows = () => levelCfg ? (levelCfg.decorations || []) : ['window'];  /* -------------------------------------------------------
   *  tutorial + hints, gate-driven: the guide card only appears when
   *  Ghee reaches the next obstacle, names the action to pass it, and
   *  vanishes the instant she performs it (hop / coin / wick). Between
   *  gates she still trots on her own, but at each gate the tutorial
   *  holds her in place so the run waits for the player's action.
   *  (tester feedback: no auto-run through unhinted risks, and the
   *  old "Wake up, Ghee!" card made no sense, she's already awake.) */
  const startTutorial = (steps) => {
    tutorial = { steps, i: 0, active: true, gateShown: new Set(), cardUp: false };
    tutorialForced = false;
  };
  const maybeTutorial = (cfg) => {
    tutorial = null;
    ui.hideTutorial();                 // the first card only shows at the first gate
    if (tutorialForced || (!data.tutorialDone && playMode === 'story' && levelIdx === 0)) {
      startTutorial(cfg.tutorial);
    }
  };
  /* Each tick while the tutorial runs: when Ghee arrives at the active
   * page's gate she pauses there and the card for that action shows. */
  const tutGateCheck = () => {
    if (!tutorial || !tutorial.active || !state || state.hold || !state.onGround) return;
    const step = tutorial.steps[tutorial.i];
    if (step && step.gate && state.x >= step.gate && !tutorial.gateShown.has(tutorial.i)) {
      tutorial.gateShown.add(tutorial.i);
      state.hold = true;
      tutorial.cardUp = true;          // only THIS card's action counts while it shows
      ui.setTutorialText(step.title, step.text, step.prompt);
      ui.setTutorial(tutorial.i, tutorial.steps.length);
    }
  };
  /* One action at a time: a step completes only when its named action is
   * performed while that step's card is showing. Stray hops/coins picked
   * up between gates never advance or skip a card. */
  const stepTutorial = (ev) => {
    if (!tutorial || !tutorial.active || !tutorial.cardUp) return;
    const tagMap = { jump: 'jump', collect: 'spark', goal: 'goal', ingredient: 'ingredient' };
    const step = tutorial.steps[tutorial.i];
    if (tagMap[ev] === step.tag) {
      tutorial.cardUp = false;
      ui.hideTutorial();               // popup leaves the moment the action is done
      tutorial.i += 1;
      if (tutorial.i >= tutorial.steps.length) {
        tutorial.active = false;
        data.tutorialDone = true; WW.persist.save();
      }
    }
  };

  const HINTS = (who) => ({
    foo: '',
    pin: 'Rolling pins patrol back and forth. Watch their swing, then hop at the right moment!',
    butter: `Butter is slippery! ${who} glides through it. Hop over what lies ahead in the slide.`,
    milk: `Milk is even slicker than butter. ${who} zooms through, so hop early when trouble shows.`,
    jam: 'Jam is sticky! It clings and slows the hop right down.',
    jamdrop: 'Jam is sticky! It clings and slows the hop right down.',
    fan: `A little fan holds ${who} to a crawl. Hop over its breeze!`,
    flour: 'Flour piles are too dusty to wade through. Hop over them.',
  });
  const maybeHint = (kind) => {
    if (!HINTS(charName())[kind]) return;
    data.hintSeen = data.hintSeen || {};
    if (data.hintSeen[kind]) return;
    data.hintSeen[kind] = true; WW.persist.save();
    if (WW.settings.gestureHints !== false) ui.showToast(HINTS(charName())[kind]);
  };
  const proximityHints = () => {
    const px = state.x;
    for (const h of world.hazards) {
      const kind = h.t;
      if (HINTS[kind] && !data.hintSeen[kind] && h.x < px + 320 && h.x > px - 60) { maybeHint(kind); return; }
    }
  };

  /* -------------------------------------------------------
   *  run control
   * ------------------------------------------------------- */
  const beginPlay = () => {
    mode = 'play'; running = true; paused = false;
    input.setEnabled(true);
    WW.Audio.musicOn();
    if (WW.settings.gestureHints !== false && !data.gestureHintDone && !(tutorial && tutorial.active)) {
      ui.showGestureHint(true);
    }
  };
  const dismissGestureHint = () => {
    ui.showGestureHint(false);
    data.gestureHintDone = true; WW.persist.save();
  };

  const pause = (byUser = true) => {
    if (mode !== 'play') return;
    mode = 'pause'; paused = true;
    input.setEnabled(false);
    ui.show('pause');
    WW.Audio.duckMusic(true);
    clearKeys();
  };
  const resume = () => {
    if (mode !== 'pause') return;
    mode = 'play'; paused = false;
    input.setEnabled(true);
    ui.showNone(); ui.hud.show(true);
    WW.Audio.duckMusic(false);
    lastTs = performance.now();
  };
  const clearKeys = () => input.setEnabled(false);

  /* Story Mode pauses on each unread fragment: the frame freezes under the
   * card, Continue hands the run straight back. The index is banked the
   * moment it is reached, so a crash after reading keeps the part. */
  const storyPartCheck = () => {
    if (playMode !== 'story' || mode !== 'play' || !runStats || !runStats.partsLeft || !state) return;
    /* never stack the fragment card on top of a teaching card; between
     * tutorial steps the story can still pause the run */
    if (tutorial && tutorial.active && tutorial.cardUp) return;
    const part = runStats.partsLeft[0];
    if (!part || state.x < part.at) return;
    runStats.partsLeft.shift();
    const list = data.story.parts[levelCfg.id] || (data.story.parts[levelCfg.id] = []);
    if (!list.includes(part.i)) { list.push(part.i); list.sort((a, b) => a - b); }
    runStats.partsFound = list.length;
    const mark = world.story && world.story.find(m => m.i === part.i);
    if (mark) mark.got = true;                  // the page leaves the counter
    WW.persist.save();
    ui.hud.parts(runStats.partsFound, runStats.partsTotal);
    mode = 'story-part';
    input.setEnabled(false);
    WW.Audio.duckMusic(true);
    WW.Audio.play('gem');
    ui.showStoryPart({
      level: levelCfg.name, index: part.i, total: runStats.partsTotal,
      title: part.title, text: part.text,
    });
  };
  const closeStoryPart = () => {
    if (mode !== 'story-part') return;
    ui.hideStoryPart();
    mode = 'play'; paused = false;
    input.setEnabled(true);
    WW.Audio.duckMusic(false);
    lastTs = performance.now();
  };

  /* First-run coaching: while the player has not learned the actions yet,
   * a crash is not the end of the run. The run rewinds just before the
   * obstacle that stopped it, with a reminder naming that action, so every
   * obstacle can be retried with no rush until the hop lands right. */
  const coachRewind = (why) => {
    /* the coaching cap: three tries on the obstacle that keeps stopping
     * the run, then coaching hands over, the crash goes through for real
     * (revive offer included) and the game can always end. The tutorial
     * is marked learned so later laps never coach again either. */
    coachState = coachState || { byObstacle: {} };
    const hw = (t) => ({ flour: 84, jamdrop: 40, pin: 104, fan: 60 }[t] || 46);
    const near = (world.hazards || [])
      .map(h => ({ h, d: Math.abs(h.x + hw(h.t) / 2 - (state.x + 20)) }))
      .sort((a, b) => a.d - b.d)[0];
    const stallKey = near ? 'h' + Math.round(near.h.x) : 'free' + Math.round(state.x);
    const tried = (coachState.byObstacle[stallKey] || 0) + 1;
    coachState.byObstacle[stallKey] = tried;
    if (!near || tried > 3) {
      coachRun = false;
      if (tutorial && tutorial.active) { tutorial.active = false; ui.hideTutorial(); }
      data.tutorialDone = true; WW.persist.save();
      setCrash(why);
      ui.showToast(`Three tries on this one. ${charName()} is playing for real now, luck!`, 3000);
      return false;
    }
    const at = near ? Math.max(30, near.h.x - 440) : Math.max(30, state.x - 300);
    engine.burst(state.x + 20, state.y + 20, 'crash');
    WW.Audio.play('slip');
    /* back up and retry: feet reset on the counter, no penalty, no rush */
    state.x = at;
    state.y = G; state.vx = 0; state.vy = 0;
    state.onGround = true; state.jumping = false; state.jumpsUsed = 0;
    state.hold = false; state.coyote = 0; state.buffer = 0;
    state.slipTime = 0; state.surface = 'dry'; state.wind = 0;
    state.runPhase = 0; state.peakY = G;
    for (const h of world.hazards) if (h.x >= at && h.x <= at + 500) h.hit = false;
    engine.setPose(null);
    engine.burst(at + 20, G + 4, 'puff');
    const tip = HINTS(charName())[why] || '';
    const left = 3 - tried;                    // the cap is public: they count down
    const triesNote = left > 0 ? ` (${left} try${left === 1 ? '' : 'ies'} left on this one)` : '';
    ui.showToast(tip
      ? `${tip} ${charName()} is back a step, try it again!${triesNote}`
      : `${charName()} is okay! Back up a step and try that action again.${triesNote}`, 3000);
  };

  /* crash: freeze the frame, then either offer a gem revive or settle the
   * run as a normal loss */
  const setCrash = (why) => {
    mode = 'losing';
    WW.Audio.play('splat');
    engine.burst(state.x + 20, state.y + 20, 'crash');
    input.setEnabled(false);
    /* the revive offer decides what happens next: continue for gems, or
     * settle this run as a normal loss */
    offerRevive(why);
  };

  /* Every run settles exactly once, win, lose, restart or quit: its coins
   * and gems go into the ever-growing balances, story runs bank their
   * gathered ingredients into the pantry, and endless runs update the
   * bests and the saved top-10 runs. */
  const settleRun = (extraCoins = 0, extraGems = 0) => {
    const s = runStats;
    if (!s || s.settled) return null;
    s.settled = true;
    const earned = s.coins + s.sparks + extraCoins;
    const gems = (s.gems || 0) + extraGems;
    data.wallet.coins += earned;
    data.wallet.gems += gems;
    data.stats.coinsEarned += earned;
    data.stats.gemsEarned += gems;
    data.stats.runs += 1;
    /* Cook & Learn: everything gathered on a run waits in the pantry for
     * the Kitchen, win or lose, story or endless */
    if (s.ingredients) {
      data.pantry = data.pantry || {};
      for (const [k, n] of Object.entries(s.ingredients)) {
        data.pantry[k] = (data.pantry[k] || 0) + n;
      }
    }
    let newBest = false;
    if (playMode === 'endless') {
      newBest = s.score > (data.endless.best || 0);
      data.endless.best = Math.max(data.endless.best || 0, s.score);
      data.endless.bestDistance = Math.max(data.endless.bestDistance || 0, s.dist);
      data.endless.runs.push({
        score: s.score, dist: s.dist, coins: s.coins + s.sparks, gems: s.gems || 0,
        time: Math.round(s.time), char: data.character, at: Date.now(),
      });
      data.endless.runs.sort((a, b) => b.score - a.score);
      data.endless.runs.length = Math.min(data.endless.runs.length, 10);
    }
    WW.persist.save();
    return { earned, gems, newBest };
  };

  const finishStoryWin = () => {
    engine.setPose('win');
    WW.Audio.play('win');
    input.setEnabled(false);
    /* no more auto-cooking at the finish line: everything gathered banks
     * in the pantry (settleRun) and cooking happens from the Kitchen menu */
    setTimeout(() => presentStoryResult(WW.recipeForLevel(levelIdx), null), 1300);
  };

  /* -------------------------------------------------------
   *  Cook-Along, from Ghee's Kitchen: pick a recipe, look at how it's
   *  made, cook it with what the pantry holds, nothing auto-starts
   *  after a run anymore (Naylo's kitchen idea).
   * ------------------------------------------------------- */
  /* pantry chips for the cook overlay: have = what's banked now */
  const pantryStrip = (recipe) => recipe.needs.map(({ k, n }) => ({
    k, n,
    emoji: (WW.INGREDIENTS[k] || {}).emoji || '\u{1F34E}',
    name: (WW.INGREDIENTS[k] || {}).name || k,
    have: Math.min(data.pantry[k] || 0, n),
  }));
  /* what each cook-along step sees as `gathered` (missing → grey step) */
  const pantryGathered = (recipe) => {
    const t = {};
    for (const n of recipe.needs) t[n.k] = Math.min(data.pantry[n.k] || 0, n.n);
    return t;
  };
  /* Cooking happens on the kitchen page itself: this lays the dish out at the
   * counter with its method, and the player starts when they are ready. */
  let prepRecipe = null;
  const beginKitchenCooking = (recipe) => {
    prepRecipe = recipe;
    mode = 'recipes';
    ui.showCooking(recipe, pantryStrip(recipe));
  };
  const startKitchenCooking = () => {
    const recipe = prepRecipe;
    if (!recipe || mode !== 'recipes') return;
    const fullIngredients = recipe.needs.every(n => (data.pantry[n.k] || 0) >= n.n);
    mode = 'cooking';
    ui.cookStartUi();
    WW.Audio.duckMusic(false);
    WW.CookDom.begin({
      recipe,
      canvas: $('cook-canvas'),
      gold: data.kitchen.includes('pan'),
      gathered: pantryGathered(recipe),
      onDone: (res) => settleKitchenCook(recipe, { ...res, fullIngredients }),
    });
  };

  /* the dish is served: consume the pantry, pay out, stamp the recipe,
   * grant the tool (first time), then show the result panel */
  const settleKitchenCook = (recipe, res) => {
    for (const n of recipe.needs) {
      data.pantry[n.k] = Math.max(0, (data.pantry[n.k] || 0) - n.n);
    }
    data.recipes = data.recipes || {};
    const rec = data.recipes[recipe.id] || (data.recipes[recipe.id] = {});
    let unlockedTool = null, dailyCooked = false;
    if (!rec.cooked && !data.tools.includes(recipe.tool.id)) {
      data.tools.push(recipe.tool.id);
      unlockedTool = recipe.tool;
    }
    rec.cooked = true;
    rec.stars = Math.max(rec.stars || 0, res.stars);
    rec.fullIngredients = !!res.fullIngredients;
    data.stats.dishesCooked = (data.stats.dishesCooked || 0) + 1;
    let dishCoins = res.bonusCoins, dishGems = res.bonusGems, paidGems = res.bonusGems;
    /* daily special: the day's dish pays double, once per UTC day */
    const todayKey = new Date().toISOString().slice(0, 10);
    if (WW.dailySpecial().id === recipe.id && data.dailyCooked !== todayKey) {
      data.dailyCooked = todayKey;
      dailyCooked = true;
      dishCoins *= 2;
    }
    data.wallet.coins += dishCoins;
    data.wallet.gems += paidGems;
    data.stats.coinsEarned += dishCoins;
    data.stats.gemsEarned += paidGems;
    WW.persist.save();
    ui.renderRecipes(data);
    mode = 'recipes';
    WW.Audio.duckMusic(false);
    WW.Audio.play('win');
    /* the plate lands on the same counter: no modal, just the dish and the
     * two ways on (next recipe, or back to the shelf) */
    ui.showCooked({
      recipe, stars: res.stars, coins: dishCoins, gems: paidGems,
      tool: unlockedTool, daily: dailyCooked, missing: res.missing,
    });
  };

  const presentStoryResult = (levelRecipe, dish) => {
    const isLast = levelIdx === WW.STORY_LEVELS.length - 1;
    const cfg = WW.STORY_LEVELS[levelIdx];
    const firstClear = !data.story.completed.includes(cfg.id);
    if (firstClear) data.story.completed.push(cfg.id);
    data.story.sparks[cfg.id] = Math.max(data.story.sparks[cfg.id] || 0, runStats.sparks);
    data.story.gems[cfg.id] = Math.max(data.story.gems[cfg.id] || 0, runStats.gems);
    /* rewards: a fixed per-level clear bonus on top of the coins picked up */
    const rew = STORY_REWARDS[levelIdx] || { coins: 100, gems: 5 };
    const bonus = firstClear ? 1 : 0.4;           // replays pay 40%
    const rewardCoins = Math.round(rew.coins * bonus);
    const rewardGems = Math.round(rew.gems * bonus);
    /* dish payout + recipe book + the vital tool for the next recipe */
    let dishCoins = 0, dishGems = 0, unlockedTool = null, dailyCooked = false;
    if (levelRecipe && dish) {
      dishCoins = dish.bonusCoins;
      dishGems = dish.bonusGems;
      data.recipes = data.recipes || {};
      const rec = data.recipes[levelRecipe.id] || (data.recipes[levelRecipe.id] = {});
      if (!rec.cooked && !data.tools.includes(levelRecipe.tool.id)) {
        data.tools.push(levelRecipe.tool.id);
        unlockedTool = levelRecipe.tool;
      }
      rec.cooked = true;
      rec.stars = Math.max(rec.stars || 0, dish.stars);
      rec.fullIngredients = !!dish.fullIngredients;  // marked cooked-complete in the book
      data.stats.dishesCooked = (data.stats.dishesCooked || 0) + 1;
      /* daily special: the day's dish pays double, once per UTC day */
      const todayKey = new Date().toISOString().slice(0, 10);
      if (WW.dailySpecial().id === levelRecipe.id && data.dailyCooked !== todayKey) {
        data.dailyCooked = todayKey;
        dailyCooked = true;
        dishCoins += rewardCoins;
      }
    }
    settleRun(rewardCoins + dishCoins, rewardGems + dishGems);
    ui.renderStory(WW.STORY_LEVELS, data.story.completed, data.story.sparks, data.story.parts);
    mode = 'result';
    WW.Audio.duckMusic(true);
    ui.hud.show(false);
    ui.showResult('story-complete', {
      sparks: runStats.sparks,
      coins: runStats.coins + runStats.sparks,
      collected: gatheredStrip(),
      rewardCoins: rewardCoins + dishCoins,
      rewardGems: rewardGems + dishGems,
      gemsPicked: runStats.gems,
      balance: data.wallet.coins,
      gemBalance: data.wallet.gems,
      flavour: cfg.goal.caption,
      last: isLast,
      /* Cook & Learn lines */
      dish: levelRecipe && dish ? { emoji: levelRecipe.emoji, name: levelRecipe.name, stars: dish.stars, missing: dish.missing } : null,
      tool: unlockedTool,
      daily: dailyCooked,
      recipeName: levelRecipe ? levelRecipe.name : null,
      /* after a run the dish is NOT cooked automatically: nudge the player
       * to the Kitchen, where the recipe is chosen, shown, and cooked */
      pantrip: !!levelRecipe && !dish,
    });
  };

  /* ---------------------------------------------------------------
   *  Continue after losing (revive): pay gems to pick the run back up
   *  at the crash spot with a short grace shield. First revive is 3
   *  gems, then it doubles, max 3 per run: 3, 6, 12. No gems banked
   *  or offers used up means straight to the usual fail screen.
   * --------------------------------------------------------------- */
  const REVIVE_COSTS = [3, 6, 12];
  let reviveOffer = null;                 // { why, cost, timeLeft, timer }

  const offerRevive = (why) => {
    const idx = Math.min(runStats.revives || 0, REVIVE_COSTS.length - 1);
    const noMore = (runStats.revives || 0) >= REVIVE_COSTS.length;
    const cost = REVIVE_COSTS[idx];
    /* low gems STILL shows the card, but with a plain "can't afford"
     * message and a dead Continue; only offers run out short-circuits */
    if (mode !== 'losing' || noMore) {
      finishCrash(why);
      return;
    }
    reviveOffer = { why, cost, timeLeft: 5, timer: null };
    ui.showRevive({ cost, gems: data.wallet.gems, shield: 2.5, who: charName() });
    ui.reviveCountdown(5);
    reviveOffer.timer = setInterval(() => {
      reviveOffer.timeLeft -= 1;
      if (reviveOffer.timeLeft > 0) { ui.reviveCountdown(reviveOffer.timeLeft); return; }
      reviveCountdownEnd();
    }, 1000);
  };

  const stopOffer = () => {
    if (reviveOffer && reviveOffer.timer) clearInterval(reviveOffer.timer);
    reviveOffer = null;
    ui.hideRevive();
  };

  /* the offer expired unaccepted: the run settles as a normal loss */
  const reviveCountdownEnd = () => {
    const why = reviveOffer ? reviveOffer.why : null;
    stopOffer();
    finishCrash(why);
  };

  /* pay, hand Ghee a 2s grace shield, and re-thaw the run right there */
  const reviveNow = () => {
    if (mode !== 'losing' || !reviveOffer || !state) return;
    const { cost } = reviveOffer;
    /* hard lock: no wallet check, no revive, whatever called us */
    if ((data.wallet.gems || 0) < cost) {
      ui.showToast('Not enough gems to revive!');
      ui.reviveCountdown(0);
      reviveCountdownEnd();
      return;
    }
    data.wallet.gems -= cost;
    runStats.revives = (runStats.revives || 0) + 1;
    runStats.gemsSpent = (runStats.gemsSpent || 0) + cost;
    WW.persist.save();
    stopOffer();
    mode = 'play';
    poseFreezeT = 0;
    state.invuln = 2.5;
    state.vy = 0; state.vx = 0; state.onGround = true;
    state.jumping = false; state.jumpsUsed = 0; state.peakY = state.y;
    engine.setPose(null);
    input.setEnabled(true);
    ui.hud.show(true);
    WW.Audio.duckMusic(false);
    WW.Audio.play('gem');
    engine.burst(state.x + 20, state.y + 20, 'gem');
    ui.showToast('Back in the run for ' + cost + ' gems!');
  };

  /* the unchanged lose flow, used by decline and by a too-poor offer */
  const finishCrash = (why) => {
    if (!why) { finishEndless(); return; }   // safety: no reason stored means endless
    if (playMode === 'story') finishStoryFail(why); else finishEndless();
  };

  const finishStoryFail = (why) => {
    WW.Audio.play('lose');
    engine.setPose('lose');
    WW.Audio.duckMusic(true);
    setTimeout(() => {
      mode = 'result';
      ui.hud.show(false);
      const who = charName();
      const flavour = {
        flour: `A pillow-soft mountain of flour. ${who} sneezed sparks everywhere! Hop over it next time.`,
        pin: `A rolling pin rolled right into ${who}. They roll to a rhythm, so watch the swing and hop at the right moment.`,
        butter: `The butter took ${who} for a skate. It glides through butter, so watch what lies ahead and hop in time.`,
        milk: `A long slide in the milk. ${who} zooms through it, so hop early when trouble shows.`,
        jamdrop: `Stuck in the jam. It is sticky in there! ${who} slows right down inside, so keep the hops coming.`,
        fan: `The breeze held ${who} to a crawl. Hop over the fan next time!`,
      }[why] || `${who} got a little lost.`;
      settleRun();
      ui.showResult('story-fail', {
        who, flavour, coins: runStats ? runStats.coins + runStats.sparks : 0, balance: data.wallet.coins,
        gems: runStats ? runStats.gems || 0 : 0, gemBalance: data.wallet.gems,
        collected: runStats ? gatheredStrip() : [],
      });
    }, 1000);
  };

  const finishEndless = () => {
    WW.Audio.play('lose');
    engine.setPose('lose');
    WW.Audio.duckMusic(true);
    const s = runStats;
    // the crash lands before this frame's tally, so finalise it first
    s.dist = WW.Physics.metres(state.x);
    s.score = s.sparks * 10 + s.coins + s.dist;
    const { newBest } = settleRun() || { newBest: false };
    const best = data.endless.best;
    if (WW.StartNG.signedIn()) {
      WW.StartNG.saveRun({
        score: s.score, sparks: s.sparks, distance: s.dist, time: Math.round(s.time),
      }).then((r) => {
        if (r && r.improved) { s.newBestRank = r.rank; }
        present();
      });
    } else present();

    function present() {
      setTimeout(() => {
        mode = 'result';
        ui.hud.show(false);
        ui.showResult('endless-over', {
          score: s.score, best, dist: s.dist, newBest,
          bestDist: data.endless.bestDistance,
          coins: s.coins + s.sparks,
          gems: s.gems || 0,
          balance: data.wallet.coins,
          who: charName(),
          collected: gatheredStrip(),
          timeStr: fmtTime(s.time),
        });
      }, 1000);
    }
  };

  /* -------------------------------------------------------
   *  main loop
   * ------------------------------------------------------- */
  let poseFreezeT = 0;
  const tick = (ts) => {
    raf = requestAnimationFrame(tick);
    if (!lastTs) lastTs = ts;
    const dtReal = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;
    animT += dtReal;

    if (mode === 'play' && !paused && state) {
      world.t += dtReal;
      if (runStats && playMode === 'endless') runStats.time += dtReal;

      tutGateCheck();
      const evs = WW.Physics.step(state, input.st, world, dtReal);
      for (const e of evs) {
        switch (e.k) {
          case 'jump':
            WW.Audio.play('jump');
            stepTutorial('jump');
            break;
          case 'land': WW.Audio.play('land'); engine.burst(state.x + 20, G + 4, 'puff'); break;
          case 'collect': {
            if (e.what === 'spark') {
              runStats.sparks += 1;
              collectChainT = 0.9; collectChain = Math.min(collectChain + 1, 5);
              WW.Audio.play('collect', collectChain);
              ui.hud.coins(runStats.coins + runStats.sparks);
              engine.burst(e.at.x, G + e.at.y, 'collect');
              if (playMode === 'endless') runStats.score = runStats.sparks * 10 + runStats.dist;
              stepTutorial('collect');
            } else if (e.what === 'ingredient') {
              const need = runStats.recipeNeeds ?
                (runStats.recipeNeeds.needs.find(n => n.k === e.kind) || { n: 0 }).n : 0;
              const had = runStats.ingredients[e.kind] || 0;
              runStats.ingredients[e.kind] = had + 1;
              if (had >= need) runStats.coins += 5;      // beyond the recipe = simple coins
              WW.Audio.play('collect', 2);
              ui.hud.coins(runStats.coins + runStats.sparks);
              ui.hud.ingredients(ingredientStrip());
              engine.burst(e.at.x, G + e.at.y, 'collect');
              /* combo: steady same-kind sweeps pay a small bonus */
              if (ingComboKind === e.kind && ingComboT > 0) {
                ingCombo += 1;
                if (ingCombo % 2 === 0) { runStats.coins += 5; ui.hud.coins(runStats.coins + runStats.sparks); }
              } else { ingCombo = 1; ingComboKind = e.kind; }
              ingComboT = 1.8;
              stepTutorial('ingredient');
            } else {
              runStats.gems += 1;
              WW.Audio.play('gem');
              ui.hud.gems(runStats.gems);
              engine.burst(e.at.x, G + e.at.y, 'gem');
            }
            break;
          }
          case 'clear':
            runStats.coins += 10;                       // +10 coins per obstacle passed (§5.3)
            ui.hud.coins(runStats.coins + runStats.sparks);
            WW.Audio.play('collect', 2);
            break;
          case 'slip': WW.Audio.play('slip'); break;
          case 'jamSplat': if (!e.repeated) WW.Audio.play('splat'); break;
          case 'windTick': WW.Audio.play('wind'); break;
          case 'crash': {
            if (mode !== 'play') break;
            if (coachRun) { coachRewind(e.why); break; }   // first run: rewind, not a loss
            setCrash(e.why);
            break;
          }
          case 'goal': {
            if (tutorial && tutorial.active) { tutorial.active = false; ui.hideTutorial(); data.tutorialDone = true; WW.persist.save(); }
            if (state) state.hold = false;
            if (mode !== 'play') break;
            mode = 'winning';
            engine.lightGoal();
            WW.Audio.play('light');
            finishStoryWin();
            break;
          }
        }
        if (e.k !== 'moved') proximityHints();
      }
      storyPartCheck();

      if (collectChainT > 0) {
        collectChainT -= dtReal;
        if (collectChainT <= 0) collectChain = 0;
      }
      if (ingComboT > 0) ingComboT -= dtReal;
      /* Cook & Learn fact toasts, one per spot, first time only */
      if (factsQueue && factsQueue.length && state.x > factsQueue[0].at) {
        const f = factsQueue.shift();
        data.factsSeen[levelCfg.id + ':' + f.i] = true; WW.persist.save();
        ui.showToast('\u{1F4A1} ' + f.fact, 5600);
      }
      if (playMode === 'endless') {
        runStats.dist = WW.Physics.metres(state.x);
        runStats.score = runStats.sparks * 10 + runStats.coins + runStats.dist;
        ui.hud.dist(runStats.dist);
        ui.hud.score(runStats.score);
        ui.hud.time(runStats.time);
        ui.hud.coins(runStats.coins + runStats.sparks);
      }
    }

    engine.sync(state || { x: 0, y: 0, vx: 0, vy: 0, onGround: true, squash: { x: 1, y: 1 }, blink: 0, wind: 0, poseState: 'none' }, dtReal, { animT, snap: mode !== 'play', poseFreeze: poseFreezeT });
    if (poseFreezeT > 0) poseFreezeT -= dtReal;
  };

  /* -------------------------------------------------------
   *  wiring
   * ------------------------------------------------------- */
  input.onJump(() => {
    WW.Audio.unlock();
    if (mode !== 'play' || paused || !state) return;
    if (state.hold) { state.hold = false; return; }   // tap at a gate: resume the run, the action comes next
    if (WW.Physics.tryJump(state)) stepTutorial('jump');
  });
  input.onAny((what) => {
    /* the pause key both pauses and un-pauses: the pause screen disables
     * gameplay input, so Esc/P come through and toggle from there */
    if (what === 'pause') {
      if (mode === 'play') pause(true);
      else if (mode === 'pause') resume();
      return;
    }
    if (what === 'blur' && mode === 'play') pause(false);
    if (what === 'focus') {
      if (!WW.Audio.running && mode === 'play') WW.Audio.musicOn();
    }
  });

  /* Which screen each modal should return to when its X is pressed. */
  const modalOwner = {
    chars: () => charsReturn, howto: () => uiReturn, settings: () => uiReturn,
    signin: () => 'title', story: () => 'title', records: () => 'title', result: () => 'title',
    recipes: () => 'title',
  };

  const actions = {
    'open-story': () => { ui.renderStory(WW.STORY_LEVELS, data.story.completed, data.story.sparks, data.story.parts); ui.show('story'); mode = 'story-select'; },
    /* the reread page: every fragment found so far, back to the map */
    'open-fragments': () => {
      if (mode !== 'story-select') return;
      ui.renderFragments(WW.STORY_LEVELS, data.story.parts);
      ui.show('fragments');
      mode = 'fragments';
    },
    'close-fragments': () => {
      if (mode !== 'fragments') return;
      ui.renderStory(WW.STORY_LEVELS, data.story.completed, data.story.sparks, data.story.parts);
      ui.show('story');
      mode = 'story-select';
    },
    'start-endless': () => { playMode = 'endless'; buildEndless(); beginPlay(); },
    'play-level': (i) => { playMode = 'story'; buildStory(i); beginPlay(); },
    'open-chars': () => { charsReturn = 'title'; ui.renderChars(WW.CHARACTERS, data.character, shopInfo()); ui.renderShelf(data); ui.show('chars'); ui.setShopTab(false); ui.snapShopInd(); mode = 'chars'; },
    /* the Kitchen's Ingredients tab reaches the same shop; its X returns
     * there instead of the title */
    'open-kitchen-shop': () => {
      if (mode !== 'recipes') return;
      charsReturn = 'recipes';
      ui.renderChars(WW.CHARACTERS, data.character, shopInfo());
      ui.renderShelf(data);
      ui.show('chars'); ui.setShopTab(true); ui.snapShopInd();
      mode = 'chars';
    },
    /* shop tab 2: the Kitchen Shelf */
    'open-shelf': () => ui.renderShelf(data),
    /* each spirit card carries its own Play / Buy button (no confirm row) */
    'char-play': (id) => {
      if (mode !== 'chars') return;
      const def = WW.CHARACTERS.find(c => c.id === id);
      if (!def || !data.owned.includes(id)) return;
      data.character = id; WW.persist.save();
      charDef = def;
      WW.Audio.play('gem');
      ui.renderChars(WW.CHARACTERS, id, shopInfo());
      ui.showToast(def.name + ' hops tonight!');
    },
    'char-buy': (id) => {
      if (mode !== 'chars') return;
      const def = WW.CHARACTERS.find(c => c.id === id);
      if (!def) return;
      if (data.owned.includes(id)) { actions['char-play'](id); return; }
      /* coins first, gems top up any gap; unlock + equip, stay in the shop */
      const pay = WW.payPlan(def.price, data.wallet.coins, data.wallet.gems);
      if (!pay.ok) {
        /* a tapped Buy is always answered: say what is still missing, in
         * the currency the wallet is actually short of */
        const gemsShort = Math.ceil(pay.short / WW.GEM_VALUE);
        /* the wallet chip that is short nudges too: the toast can be missed */
        if (data.wallet.coins < def.price) ui.flashWallet('coins');
        if (data.wallet.gems > 0 && data.wallet.gems < gemsShort) ui.flashWallet('gems');
        ui.showToast(`Not enough for ${def.name} yet: ${pay.short} more coins, or ${gemsShort} gems.`);
        return;
      }
      data.wallet.coins -= pay.coins;
      data.wallet.gems -= pay.gems;
      data.owned.push(id);
      data.character = id; WW.persist.save();
      charDef = def;
      WW.Audio.play('win');
      ui.renderChars(WW.CHARACTERS, id, shopInfo(), `${def.name} unlocked!`);
      ui.renderShelf(data);
    },
    'open-records': () => { ui.renderRecords(data); ui.show('records'); mode = 'records'; },
    /* Cook & Learn: the Kitchen (recipe list + how-to + cook-along) */
    'open-recipes': () => { ui.renderRecipes(data); ui.show('recipes'); mode = 'recipes'; },
    'kitchen-cook': (id) => {
      if (mode !== 'recipes') return;
      const recipe = WW.RECIPES.find(r => r.id === id);
      if (!recipe) return;
      const need = WW.toolNeeded(recipe);
      if (need && !data.tools.includes(need.id)) {
        ui.showToast('Locked: cook the dish before this one first!');
        return;
      }
      beginKitchenCooking(recipe);
    },
    'shelf-buy': (id) => {
      const item = WW.kitchenItem(id);
      if (!item) return;
      /* ingredient restocks repeat: pay, bank one more in the pantry,
       * stay in the shop so a dish can be topped up item after item */
      if (item.ing) {
        const def = WW.INGREDIENTS[item.ing] || {};
        if (item.coins) {
          if (data.wallet.coins < item.coins) {
            ui.flashWallet('coins');
            ui.showToast(`Not enough coins for ${item.name}: ${item.coins - data.wallet.coins} more needed.`);
            return;
          }
          data.wallet.coins -= item.coins;
        } else if (item.gems) {
          if (data.wallet.gems < item.gems) {
            ui.flashWallet('gems');
            ui.showToast(`Not enough gems for ${item.name}: ${item.gems - data.wallet.gems} more needed.`);
            return;
          }
          data.wallet.gems -= item.gems;
        }
        data.pantry[item.ing] = (data.pantry[item.ing] || 0) + 1;
        WW.persist.save();
        WW.Audio.play('collect');
        ui.renderChars(WW.CHARACTERS, data.character, shopInfo());
        ui.renderShelf(data);
        /* bought from the Kitchen's own shop: the pantry counts behind it
         * refresh on the spot, not when the X is finally pressed */
        if (charsReturn === 'recipes') ui.renderPantry(data);
        ui.showToast(`One ${def.name} banked in the pantry!`);
        return;
      }
      if (data.kitchen.includes(id)) return;
      if (item.coins) {
        if (data.wallet.coins < item.coins) {
          ui.flashWallet('coins');
          ui.showToast(`Not enough coins for ${item.name}: ${item.coins - data.wallet.coins} more needed.`);
          return;
        }
        data.wallet.coins -= item.coins;
      } else if (item.gems) {
        if (data.wallet.gems < item.gems) {
          ui.flashWallet('gems');
          ui.showToast(`Not enough gems for ${item.name}: ${item.gems - data.wallet.gems} more needed.`);
          return;
        }
        data.wallet.gems -= item.gems;
      }
      data.kitchen.push(id);
      WW.persist.save();
      WW.Audio.play('win');
      ui.renderChars(WW.CHARACTERS, data.character, shopInfo());
      ui.renderShelf(data);
      /* a new tool can unlock the next dish: keep the kitchen page live too */
      if (charsReturn === 'recipes') ui.renderRecipes(data);
      ui.showToast(item.name + ' is yours!');
    },
    'cook-abort': () => {
      if (mode === 'cooking') WW.CookDom.abort();     // mid-cook: drop the pan
      else if (mode !== 'recipes') return;
      prepRecipe = null;
      mode = 'recipes';
      ui.renderRecipes(data);
      WW.Audio.duckMusic(false);
    },
    /* the counter: read first, then start when ready */
    'kitchen-cook-start': () => startKitchenCooking(),
    'kitchen-cook-next': () => {
      if (mode !== 'recipes') return;
      const from = prepRecipe ? WW.RECIPES.indexOf(prepRecipe) : -1;
      const next = WW.RECIPES.slice(from + 1).find((r) => {
        const t = WW.toolNeeded(r);
        return !t || data.tools.includes(t.id);
      });
      if (!next) {
        prepRecipe = null;
        ui.renderRecipes(data);
        ui.showToast('Every dish is cooked. The kitchen is very proud!');
        return;
      }
      beginKitchenCooking(next);
    },
    'kitchen-back-dishes': () => {
      if (mode !== 'recipes') return;
      prepRecipe = null;
      ui.renderRecipes(data);
    },
    'open-howto-title': () => { uiReturn = 'title'; ui.show('howto'); mode = 'howto'; },
    'open-howto-pause': () => { uiReturn = 'pause'; ui.show('howto'); mode = 'howto'; },
    'open-settings-title': () => { uiReturn = 'title'; ui.renderSettings(WW.settings); ui.show('settings'); mode = 'settings'; },
    'open-settings-pause': () => { uiReturn = 'pause'; ui.renderSettings(WW.settings); ui.show('settings'); mode = 'settings'; },
    'open-settings-result': () => { uiReturn = 'result'; ui.renderSettings(WW.settings); ui.show('settings'); mode = 'settings'; },
    'signin-go': () => { WW.StartNG.signIn(); },
    'ui-close': (target) => {
      /* X/Back button / backdrop click: return to wherever the modal was
       * opened from. Closing the pause menu itself means "carry on playing". */
      if (target === 'pause') { if (mode === 'pause') resume(); return; }
      const back = (target === 'pause')
        ? 'pause'
        : (target === 'result') ? 'title'
        : (target === 'ending') ? 'title'
        : (modalOwner[target] ? modalOwner[target]() : 'title');
      /* reopening pause: state intact, and the mode is pause again so
       * later Esc presses still toggle the pause screen */
      if (back === 'pause' && mode !== 'pause') { mode = 'pause'; ui.show('pause'); return; }
      if (back === 'result') mode = 'result';
      if (back === 'recipes') { mode = 'recipes'; ui.renderRecipes(data); }   /* ingredient buys changed the pantry counts */
      if (back === 'title' || back === 'ending') mode = (back === 'ending') ? 'ending' : 'title';
      if (target === 'settings') WW.persist.save();
      ui.show(back);
      if (back !== 'pause') mode = back === 'title' ? 'title' : mode;
    },
    'set-setting': (kv) => {
      Object.assign(WW.settings, kv);
      if ('mute' in kv) WW.Audio.setMute(!!kv.mute);
      if ('music' in kv || 'sfx' in kv) { WW.Audio.set('music', WW.settings.music); WW.Audio.set('sfx', WW.settings.sfx); }
      if ('reducedMotion' in kv) document.body.classList.toggle('rm', !!kv.reducedMotion);
      WW.persist.save();
    },
    'replay-tutorial': () => {
      ui.showNone();
      playMode = 'story';
      tutorialForced = true;
      buildStory(0);
      beginPlay();
    },
    'reset-progress': () => {
      WW.persist.reset();
      Object.assign(data, WW.persist.data);
      WW.settings = data.settings;
      ui.renderSettings(WW.settings);
      ui.showToast('Progress reset. Nice and tidy!');
    },
    'resume': resume,
    'revive-accept': reviveNow,
    'revive-decline': reviveCountdownEnd,
    'restart': () => {
      settleRun();
      ui.showNone(); ui.hud.show(true);
      if (playMode === 'story') buildStory(levelIdx); else buildEndless();
      beginPlay();
      WW.Audio.duckMusic(false);
    },
    'back-title': () => {
      settleRun();
      mode = 'title'; playMode = null;
      state = null; paused = false;
      ui.stopHero();
      input.setEnabled(false);
      ui.hideTutorial(); ui.showGestureHint(false);
      ui.setHUD(null);
      input.setEnabled(false);
      WW.Audio.duckMusic(false);
      ui.show('title');
      ui.startHero();
    },
    'pause': () => { if (mode === 'play') pause(true); },
    'story-part-continue': () => closeStoryPart(),
    'result-primary': () => {
      if (playMode === 'story') {
        if (levelIdx === WW.STORY_LEVELS.length - 1) {
          ui.show('ending');
          mode = 'ending';
          paintEnding();
        } else {
          buildStory(levelIdx + 1); beginPlay(); WW.Audio.duckMusic(false);
        }
      } else { buildEndless(); beginPlay(); WW.Audio.duckMusic(false); }
    },
    'result-replay': () => {
      if (playMode === 'story') buildStory(levelIdx); else buildEndless();
      beginPlay(); WW.Audio.duckMusic(false);
    },
    'dismiss-gesture-hint': dismissGestureHint,
  };

  const paintEnding = () => {
    const c = $('ending-art'), ctx = c.getContext('2d');
    // a night kitchen with five lit lanterns and all five spirits
    ctx.fillStyle = '#2e2a44'; WW.rr(ctx, 0, 0, 360, 240, 20); ctx.fill();
    const R = WW.rng(5);
    ctx.fillStyle = '#fff8e0';
    for (let i = 0; i < 30; i++) ctx.fillRect(20 + R() * 320, 16 + R() * 90, 2.4, 2.4);
    // shelf of glowing jars
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = WW.CHARACTERS[i].glow;
      WW.rr(ctx, 40 + i * 58, 92, 34, 44, 10); ctx.fill();
      ctx.globalAlpha = 0.4 + Math.sin(animT * 3 + i) * 0.1 + 0.1;
      ctx.beginPath(); ctx.arc(57 + i * 58, 114, 26, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = '#c7b8e8'; WW.rr(ctx, 20, 150, 320, 90, 12); ctx.fill();
    window.__endingPaint = ctx; // playful re-paint handled by tick → below
    const tox = [...Array(5)].map((_, i) => 66 + i * 56);
    tox.forEach((x, i) => {
      ctx.save(); ctx.translate(x, 196);
      WW.paintSpirit(ctx, 1, 1, { char: WW.CHARACTERS[i], animT: animT * (1 + i * 0.2), pose: 'win' });
      ctx.restore();
    });
  };

  ui.init(actions);
  ui.setStatsSource(() => data);
  ui.renderSettings(WW.settings);
  ui.show('title');
  mode = 'title';
  raf = requestAnimationFrame(tick);

  /* keyboard pause + audio unlock */
  /* first tap or key anywhere (home included) wakes audio and starts the
   * music, browsers block sound until the player interacts */
  const wakeAudio = () => { WW.Audio.unlock(); if (!WW.Audio.running) WW.Audio.musicOn(); };
  /* Escape is the desktop back gesture: while a modal or overlay screen
   * is up it acts as that screen's Back button (never on the title or a
   * live run, where the pause key already owns Esc). */
  const ESC_CLOSE = {
    'story-select': 'story', chars: 'chars', howto: 'howto', records: 'records',
    settings: 'settings', recipes: 'recipes', result: 'result', ending: 'ending',
  };
  addEventListener('keydown', (e) => {
    wakeAudio();
    /* pause keys are wired in input.js (capture net → onAny 'pause');
     * Esc here closes the screen stack surfaces and aborts the cooking
     * mini-game, another surface */
    if (e.key !== 'Escape') return;
    if (mode === 'cooking') { actions['cook-abort'](); return; }
    if (mode === 'play' || mode === 'pause') return;
    if (mode === 'story-part') { actions['story-part-continue'](); return; }
    if (mode === 'fragments') { actions['close-fragments'](); return; }
    /* the share destination list floats over a result: it closes first */
    const share = $('screen-share');
    if (mode === 'result' && share && !share.classList.contains('hidden')) {
      share.classList.add('hidden');
      return;
    }
    const target = ESC_CLOSE[mode];
    if (target) actions['ui-close'](target);
  }, { capture: true });
  /* the fragment card reads with the same key as the hop: Continue */
  addEventListener('keydown', (e) => {
    if (mode !== 'story-part') return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); actions['story-part-continue'](); }
  }, { capture: true });
  addEventListener('pointerdown', wakeAudio, { capture: true });

  /* profile card */
  const refreshPlayer = async () => {
    try {
      const p = await WW.StartNG.whoami();
      WW.player = p;
      if (p) {
        ui.renderProfile(p.info, p.signedIn);
        const style = p.info.style || null;
        const fresh = WW.CHARACTERS.find(c => c.id === data.character);
        if (style) { WW.applyStartNgStyle(fresh, style); }
        if (state && state.x != null) {/* tint applies on next build */}
      } else {
        ui.renderProfile({ name: 'Guest', face: '' }, false);
      }
    } catch { /* offline, hide card? docs: guests look the same */ }
  };
  refreshPlayer();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshPlayer(); });

  /* force a first build so the title has a scene behind it? canvas stays cream, fine */

  return {
    /* debug/test surface */
    get state() { return mode; },
    jump: () => { if (state) WW.Physics.tryJump(state); },
    dbg: { get input() { return input.st; }, get player() { return state; }, get world() { return world; }, get playMode() { return playMode; } },
  };
};
})();
