/**
 * Whimsy Wick — js/game/game.js
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
  let animT = 0, running = false, paused = false, raf = null, lastTs = 0;
  let runStats = null;            // endless: {score, sparks, time}
  let tutorial = null;            // active tutorial script
  let tutorialForced = false;
  let flash = null, flashT = 0;
  let collectChain = 0, collectChainT = 0;
  let uiReturn = 'title';         // where howto/settings go back to

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
    const sparks = cfg.sparks.map(x => ({ x, y: sparkY(x, plat), got: false }));
    const gems = (cfg.gems || []).map(x => ({ x, y: gemY(x, plat), got: false, kind: 'gem' }));
    world = {
      length: cfg.length,
      platforms: plat, hazards, sparks, gems,
      goal: { x: cfg.goal.x, done: false },
      t: 0,
    };
    engine.build({
      world, theme: cfg.theme, charDef, rows: cfg.decorations || [],
      startX: 140, apply: (e) => e,
    });
    applyCharTint();
    levelIdx = idx; levelCfg = cfg;
    runStats = { sparks: 0, coins: 0, gems: 0, sparksGround: cfg.sparks.length };
    resetState();
    ui.setHUD('story', cfg.name);
    ui.hud.sparks(0); ui.hud.gems(0);
    ui.showNone(); ui.hud.show(true);
    ui.hud.coins(0); ui.hud.gems(0); ui.hud.sparks(0);
    maybeTutorial(cfg);
  };

  const buildEndless = () => {
    tutorial = null;
    ui.hideTutorial();
    const rng = WW.rng((Date.now() >>> 10) % 99991);
    const L = 26000;
    const hazards = WW.generateEndless(L, rng).map(normHaz);
    const sparks = WW.generateEndlessSparks(L, rng).map(x => ({ x, y: 34 + Math.floor(Math.abs(Math.sin(x * 0.017)) * 190), got: false }));
    world = {
      length: L, platforms: [], hazards, sparks, gems: [],
      goal: null, t: 0,
    };
    engine.build({ world, theme: rng() < 0.5 ? 'night' : 'flour', charDef, rows: ['window'], startX: 140 });
    applyCharTint();
    runStats = { sparks: 0, coins: 0, time: 0, dist: 0, score: 0 };
    resetState();
    playMode = 'endless';
    ui.setHUD('endless', 'Endless Challenge');
    ui.hud.sparks(0); ui.hud.coins(0); ui.hud.score(0); ui.hud.dist(0); ui.hud.time(0);
    ui.showNone(); ui.hud.show(true);
    maybeHint('butter');
  };

  const florless = (t, rng) => (rng() < 0.5 ? 'night' : t); /* keeps theme variety */

  const resetState = () => {
    state = WW.Physics.newState(140);
    engine.setPose(null);
    poseFreezeT = 0;
    paused = false;
    if (world) { world.t = 0; world.goalDone = false; for (const h of world.hazards) { h.hit = false; h.cleared = false; h.px = h.px ?? undefined; } }
  };

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
  const currentRows = () => levelCfg ? (levelCfg.decorations || []) : ['window'];

  /* -------------------------------------------------------
   *  tutorial + hints
   * ------------------------------------------------------- */
  const maybeTutorial = (cfg) => {
    tutorial = null;
    if (playMode === 'endless' || playMode === 'story' && levelIdx !== 0 && !tutorialForced) { /* only first story level */ }
    if (tutorialForced || (!data.tutorialDone && playMode === 'story' && levelIdx === 0)) {
      tutorial = { steps: cfg.tutorial, i: 0, active: true };
      tutorialForced = false;
      ui.setTutorialText(cfg.tutorial[0].title, cfg.tutorial[0].text);
      ui.setTutorial(0, cfg.tutorial.length);
    }
  };
  const stepTutorial = (ev) => {
    if (!tutorial || !tutorial.active) return;
    const tagMap = { moved: 'move', jump: 'jump', collect: 'spark', goal: 'goal' };
    const step = tutorial.steps[tutorial.i];
    if (tagMap[ev] === step.tag) {
      tutorial.i += 1;
      if (tutorial.i >= tutorial.steps.length) {
        tutorial.active = false;
        ui.hideTutorial();
        data.tutorialDone = true; WW.persist.save();
      } else {
        const nx = tutorial.steps[tutorial.i];
        ui.setTutorialText(nx.title, nx.text);
        ui.setTutorial(tutorial.i, tutorial.steps.length);
      }
    }
  };

  const HINTS = {
    foo: '',
    pin: 'Rolling pins patrol back and forth — watch their swing, then dash!',
    butter: 'Butter is slippery: light touches on the drag, and you can still hop mid-slide.',
    milk: 'Milk is even slicker than butter — long, gentle slides.',
    jam: 'Jam is sticky! It clings and slows Ghee down.',
    jamdrop: 'Jam is sticky! It clings and slows Ghee down.',
    fan: 'A little fan breathes against you — keep leaning into it.',
    flour: 'Flour piles are too fluffy to wade through — hop over them.',
  };
  const maybeHint = (kind) => {
    if (!HINTS[kind]) return;
    data.hintSeen = data.hintSeen || {};
    if (data.hintSeen[kind]) return;
    data.hintSeen[kind] = true; WW.persist.save();
    if (WW.settings.gestureHints !== false) ui.showToast(HINTS[kind]);
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
    if (WW.settings.gestureHints !== false && playMode === 'endless' && !data.gestureHintDone) {
      ui.showGestureHint(true);
    } else if (WW.settings.gestureHints !== false && playMode === 'story' && levelIdx === 0 && !data.gestureHintDone) {
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

  const finishStoryWin = () => {
    engine.setPose('win');
    WW.Audio.play('win');
    input.setEnabled(false);
    setTimeout(() => {
      const isLast = levelIdx === WW.STORY_LEVELS.length - 1;
      const cfg = WW.STORY_LEVELS[levelIdx];
      if (!data.story.completed.includes(cfg.id)) {
        data.story.completed.push(cfg.id);
        data.story.sparks[cfg.id] = Math.max(data.story.sparks[cfg.id] || 0, runStats.sparks);
        data.story.gems[cfg.id] = Math.max(data.story.gems[cfg.id] || 0, runStats.gems);
      }
      /* rewards: +5 gems per lit wick · coins banked · sparks ×1 as coins */
      runStats.gems += 5;
      data.wallet.coins += runStats.coins + runStats.sparks;
      data.wallet.gems += 5;
      WW.persist.save();
      ui.renderStory(WW.STORY_LEVELS, data.story.completed, data.story.sparks);
      mode = 'result';
      WW.Audio.duckMusic(true);
      ui.hud.show(false);
      ui.showResult('story-complete', {
        sparks: runStats.sparks,
        sparksGround: runStats.sparksGround,
        coins: runStats.coins,
        gems: runStats.gems,
        gemsTotal: data.wallet.gems,
        flavour: cfg.goal.caption,
        last: isLast,
      });
    }, 1300);
  };

  const finishStoryFail = (why) => {
    WW.Audio.play('lose');
    engine.setPose('lose');
    WW.Audio.duckMusic(true);
    setTimeout(() => {
      mode = 'result';
      ui.hud.show(false);
      const flavour = {
        flour: 'A pillow-soft mountain of flour — Ghee sneezed sparks everywhere. Hop OVER it next time.',
        pin: 'A rolling pin! They roll to a rhythm — watch for the gap in the swing.',
        butter: 'The butter took Ghee for a skate. Steer gently while sliding.',
        milk: 'A long slide in the milk. Feather your movement next time.',
        jamdrop: 'Stuck. Stickier than expected — build speed first!',
        fan: 'The breeze carried Ghee far, far back…',
      }[why] || 'Ghee got a little lost.';
      ui.showResult('story-fail', { flavour });
    }, 1000);
  };

  const finishEndless = () => {
    WW.Audio.play('lose');
    engine.setPose('lose');
    WW.Audio.duckMusic(true);
    const s = runStats;
    const best = Math.max(data.endless.best || 0, s.score);
    const newBest = s.score > (data.endless.best || 0);
    data.endless.best = best;
    data.endless.bestDistance = Math.max(data.endless.bestDistance || 0, s.dist);
    WW.persist.save();
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
          coins: s.coins,
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
              ui.hud.sparks(playMode === 'story' ? runStats.sparks : runStats.sparks);
              engine.burst(e.at.x, e.at.y, 'collect');
              if (playMode === 'endless') runStats.score = runStats.sparks * 10 + runStats.dist;
              stepTutorial('collect');
            } else {
              runStats.gems += 1;
              WW.Audio.play('gem');
              ui.hud.gems(runStats.gems);
              engine.burst(e.at.x, e.at.y, 'gem');
            }
            break;
          }
          case 'clear':
            runStats.coins += 10;                       // +10 coins per obstacle passed (§5.3)
            ui.hud.coins(runStats.coins);
            WW.Audio.play('collect', 2);
            break;
          case 'slip': WW.Audio.play('slip'); break;
          case 'jamSplat': if (!e.repeated) WW.Audio.play('splat'); break;
          case 'windTick': WW.Audio.play('wind'); break;
          case 'crash': {
            if (mode !== 'play') break;
            mode = 'losing';
            WW.Audio.play('splat');
            engine.burst(state.x + 20, state.y + 20, 'crash');
            input.setEnabled(false);
            if (playMode === 'story') finishStoryFail(e.why); else finishEndless();
            break;
          }
          case 'goal': {
            if (tutorial && tutorial.active) { tutorial.active = false; ui.hideTutorial(); data.tutorialDone = true; WW.persist.save(); }
            if (mode !== 'play') break;
            mode = 'winning';
            engine.lightGoal();
            WW.Audio.play('light');
            finishStoryWin();
            break;
          }
        }
        if (e.k === 'moved') { stepTutorial('moved'); continue; }
        if (e.k !== 'moved') proximityHints();
      }

      if (collectChainT > 0) {
        collectChainT -= dtReal;
        if (collectChainT <= 0) collectChain = 0;
      }
      if (playMode === 'endless') {
        runStats.dist = WW.Physics.metres(state.x);
        runStats.score = runStats.sparks * 10 + runStats.coins + runStats.dist;
        ui.hud.dist(runStats.dist);
        ui.hud.score(runStats.score);
        ui.hud.time(runStats.time);
        ui.hud.sparks(runStats.sparks);
        ui.hud.coins(runStats.coins);
      } else {
        const total = world.sparks.length;
        ui.hud.progress(runStats.sparks, total);
      }
    }

    engine.sync(state || { x: 0, y: 0, vx: 0, vy: 0, onGround: true, squash: { x: 1, y: 1 }, blink: 0, wind: 0, poseState: 'none' }, dtReal, { animT, snap: mode !== 'play', poseFreeze: poseFreezeT });
    if (poseFreezeT > 0) poseFreezeT -= dtReal;
  };

  /* -------------------------------------------------------
   *  wiring
   * ------------------------------------------------------- */
  input.onJump(() => { WW.Audio.unlock(); if (mode === 'play' && !paused) WW.Physics.tryJump(state); });
  input.onAny((what) => {
    if (what === 'blur' && mode === 'play') pause(false);
    if (what === 'focus') {
      if (!WW.Audio.running && mode === 'play') WW.Audio.musicOn();
    }
  });

  const actions = {
    'open-story': () => { ui.renderStory(WW.STORY_LEVELS, data.story.completed, data.story.sparks); ui.show('story'); mode = 'title'; },
    'start-endless': () => { playMode = 'endless'; buildEndless(); beginPlay(); },
    'play-level': (i) => { playMode = 'story'; buildStory(i); beginPlay(); },
    'open-chars': () => { ui.charsTemp = data.character; ui.renderChars(WW.CHARACTERS, data.character); ui.show('chars'); mode = 'chars'; },
    'pick-char': () => { ui.renderChars(WW.CHARACTERS, ui.charsTemp); },
    'chars-confirm': () => {
      data.character = ui.charsTemp; WW.persist.save();
      charDef = WW.CHARACTERS.find(c => c.id === data.character);
      WW.Audio.play('gem');
      ui.show('title'); mode = 'title';
    },
    'open-howto-title': () => { uiReturn = 'title'; ui.show('howto'); mode = 'howto'; },
    'open-howto-pause': () => { uiReturn = 'pause'; ui.show('howto'); mode = 'howto'; },
    'howto-back': () => { ui.show(uiReturn); mode = uiReturn === 'pause' ? 'pause' : 'title'; },
    'open-settings-title': () => { uiReturn = 'title'; ui.renderSettings(WW.settings); ui.show('settings'); mode = 'settings'; },
    'open-settings-pause': () => { uiReturn = 'pause'; ui.renderSettings(WW.settings); ui.show('settings'); mode = 'settings'; },
    'settings-back': () => {
      ui.show(uiReturn); mode = uiReturn === 'pause' ? 'pause' : 'title';
      WW.persist.save();
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
    'restart': () => {
      ui.showNone(); ui.hud.show(true);
      if (playMode === 'story') buildStory(levelIdx); else buildEndless();
      beginPlay();
      WW.Audio.duckMusic(false);
    },
    'back-title': () => {
      mode = 'title'; playMode = null;
      running = false; state = null; paused = false;
      ui.hideTutorial(); ui.showGestureHint(false);
      ui.setHUD(null);
      input.setEnabled(false);
      WW.Audio.duckMusic(false);
      ui.show('title');
    },
    'pause': () => { if (mode === 'play') pause(true); },
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
  ui.renderSettings(WW.settings);
  ui.show('title');
  mode = 'title';
  raf = requestAnimationFrame(tick);

  /* keyboard pause + audio unlock */
  addEventListener('keydown', (e) => {
    WW.Audio.unlock();
    if ((e.key === 'Escape' || e.key === 'p' || e.key === 'P') && (mode === 'play' || mode === 'pause')) {
      mode === 'play' ? pause(true) : resume();
    }
  }, { capture: true });
  addEventListener('pointerdown', () => WW.Audio.unlock(), { capture: true });

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
    } catch { /* offline — hide card? docs: guests look the same */ }
  };
  refreshPlayer();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshPlayer(); });

  /* force a first build so the title has a scene behind it? canvas stays cream — fine */

  return {
    /* debug/test surface */
    get state() { return mode; },
    jump: () => { if (state) WW.Physics.tryJump(state); },
    dbg: { get input() { return input.st; }, get player() { return state; }, get world() { return world; }, get playMode() { return playMode; } },
  };
};
})();
