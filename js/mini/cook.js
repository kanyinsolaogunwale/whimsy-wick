/**
 * Whimsy Wick, js/mini/cook.js
 * ---------------------------------------------------------------
 * Level-end Cook-Along: the dish Ghee just earned the ingredients for
 * gets made on screen, in the real recipe's order. One control the
 * whole game already has: tap and hold. Steps:
 *   mix , TAP to work the bowl (a set number of taps)
 *   pour, HOLD to fill, release inside the target band
 *   flip, a marker sweeps; TAP while it is in the gold zone
 *   serve, HOLD to plate up
 * Missing ingredients (left on the counter) make that step show its
 * grey placeholder and cap the step's grade.
 *
 * Two halves:
 *   WW.CookLogic, pure state machine (no DOM, headless-testable)
 *   WW.CookDom  , canvas driver that owns the rAF loop + drawing
 */
(() => {
'use strict';
const WW = window.WW;

/* ============================================================
 *  Pure controller
 * ============================================================ */
WW.CookLogic = (() => {
  const MIX_TAPS = 6;
  const POUR_BAND = [0.56, 0.7];     // release inside for a perfect pour
  const FLIP_ZONE = 0.1;             // |marker-0.5| sizing for grades
  const FLIP_PERIOD = 1.9;           // sweep seconds there and back
  const FLIP_MAX = 1.6;              // seconds before the flip auto-fumbles
  const HOLD_RATE = 0.62;            // fill per second while held

  const newRun = (recipe, gathered = {}) => {
    const steps = recipe.cookSteps.map((cs) => ({
      kind: cs.kind, label: cs.label, tip: cs.tip, ing: cs.ing,
      missing: !((gathered[cs.ing] || 0) > 0),
      taps: 0, fill: 0, marker: 0, mt: 0,
    }));
    return { steps, i: 0, grades: [], missing: 0, done: false, t: 0 };
  };

  const thisStep = (r) => r.steps[r.i] || null;

  /** Judge + close the current step, open the next. */
  const closeStep = (r, grade) => {
    const s = r.steps[r.i];
    const capped = s.missing ? Math.min(1, grade) : grade;
    r.grades.push(capped);
    if (s.missing) r.missing += 1;
    r.i += 1;
    if (r.i >= r.steps.length) r.done = true;
  };

  /** Advance time. `held` is the current press state. Returns events[]. */
  const tick = (r, dt, held) => {
    const ev = [];
    if (r.done) return ev;
    const s = r.steps[r.i];
    r.t += dt;

    if (s.kind === 'mix') {
      s.fill = s.taps / MIX_TAPS;
      if (s.taps >= MIX_TAPS) ev.push({ k: 'step', grade: 2 });
    } else if (s.kind === 'pour' || s.kind === 'serve') {
      if (held) s.fill = Math.min(1, s.fill + HOLD_RATE * dt);
      else if (s.fill > 0) {
        // release: judge by how close the fill came to the sweet spot
        if (s.kind === 'pour') {
          const d = Math.min(Math.abs(s.fill - POUR_BAND[0]), Math.abs(s.fill - POUR_BAND[1]));
          ev.push({ k: 'step', grade: s.fill >= POUR_BAND[0] && s.fill <= POUR_BAND[1] ? 2 : d < 0.12 ? 1 : 0 });
        } else {
          ev.push({ k: 'step', grade: s.fill >= 0.7 ? 2 : s.fill >= 0.4 ? 1 : 0 });
        }
      }
      if (s.fill >= 1) ev.push({ k: 'step', grade: 2 });
    } else if (s.kind === 'flip') {
      s.mt += dt;
      s.marker = (Math.sin((s.mt / FLIP_PERIOD) * Math.PI * 2) + 1) / 2;
      s.fill = Math.max(0, 1 - s.mt / FLIP_MAX);
      if (s.mt >= FLIP_MAX) ev.push({ k: 'step', grade: 0 });
    }

    for (const e of ev) if (e.k === 'step') closeStep(r, e.grade);
    return ev;
  };

  /** A tap from the player (kind-sensitive). */
  const tap = (r) => {
    if (r.done) return [];
    const s = r.steps[r.i];
    if (s.kind === 'mix') { s.taps += 1; return [{ k: 'tapwork' }]; }
    if (s.kind === 'flip') {
      const d = Math.abs(s.marker - 0.5);
      const grade = d < FLIP_ZONE ? 2 : d < FLIP_ZONE * 2.4 ? 1 : 0;
      closeStep(r, grade);
      return [{ k: 'step', grade }];
    }
    return [{ k: 'tapwork' }];    // holds react to press state, taps are free
  };

  /** Final tally. */
  const result = (r) => {
    const tally = WW.dishScore({ grades: r.grades, missing: r.missing });
    return { ...tally, grades: r.grades.slice(), missing: r.missing };
  };

  return { newRun, tick, tap, result, thisStep, MIX_TAPS, POUR_BAND, FLIP_ZONE };
})();

/* ============================================================
 *  Canvas driver, owns the rAF loop, the drawing and its own
 *  gestures while the overlay is up: the cooking canvas takes
 *  pointer taps/holds directly, and window keys fall through to
 *  it because game input is disabled during cooking.
 * ============================================================ */
const STEP_EMOJI = { mix: '\u{1F9C1}', pour: '\u{1F958}', flip: '\u{1F373}', serve: '\u{1F37D}\u{FE0F}' };

WW.CookDom = (() => {
  let raf = null, run = null, opts = null, last = 0, el = null, ctx = null, craft = null;
  let banner = '', bannerT = 0;

  const stop = () => { if (raf) cancelAnimationFrame(raf); raf = null; };
  const say = (txt) => { banner = txt; bannerT = 1.1; };

  /* gestures: press = hold; a fresh press also counts as a tap */
  let press = false, pressId = null;
  const down = (e) => {
    if (pressId !== null) return;
    pressId = e.pointerId ?? 0;
    try { el.setPointerCapture(e.pointerId); } catch { /* detached */ }
    press = true;
    WW.CookLogic.tap(run).forEach((ev) => { if (ev.k === 'tapwork') WW.Audio.play('tick'); });
  };
  const up = (e) => { if (pressId !== null && e.pointerId !== undefined && e.pointerId !== pressId) return; pressId = null; press = false; };
  const keyDown = (e) => {
    if (el.classList.contains('hidden')) return;
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      e.preventDefault();
      if (!press) { press = true; WW.CookLogic.tap(run).forEach((ev) => { if (ev.k === 'tapwork') WW.Audio.play('tick'); }); }
    }
  };
  const keyUp = (e) => {
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') press = false;
  };
  const bind = () => {
    el.tabIndex = 0; el.style.outline = 'none';
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
    el.style.touchAction = 'none';
    /* keys on BOTH the window and the canvas so whichever holds focus works;
     * the press guard makes a bubbled double delivery harmless */
    addEventListener('keydown', keyDown);
    addEventListener('keyup', keyUp);
    el.addEventListener('keydown', keyDown);
  };
  const unbind = () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', up);
    el.removeEventListener('pointerleave', up);
    removeEventListener('keydown', keyDown);
    removeEventListener('keyup', keyUp);
    el.removeEventListener('keydown', keyDown);
  };

  const frame = (ts) => {
    raf = requestAnimationFrame(frame);
    if (!last) last = ts;
    const dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;
    if (bannerT > 0) bannerT -= dt;

    const held = press;
    WW.CookLogic.tick(run, dt, held).forEach((e) => {
      if (e.k === 'step') {
        if (e.grade === 2) { WW.Audio.play('win'); say('Perfect!'); }
        else if (e.grade === 1) { WW.Audio.play('collect', 2); say('Good enough!'); }
        else { WW.Audio.play('slip'); say('Oop, next time!'); }
      }
    });
    if (run.done) { stop(); finish(); return; }

    draw(dt);
  };

  const finish = () => {
    unbind();
    const res = WW.CookLogic.result(run);
    if (opts.jars && res.stars === 3) opts.jars();     // sprinkle-jar cosmetic
    draw(0, true);
    setTimeout(() => { el.classList.add('hidden'); opts.onDone(res); }, 950);
  };

  const W = 340, H = 430;
  const draw = (dt, final = false) => {
    const c = ctx;
    c.clearRect(0, 0, W, H);
    /* framed card */
    c.fillStyle = '#fffaf0';
    WW.rr(c, 8, 8, W - 16, H - 16, 22); c.fill();
    c.strokeStyle = '#efdcb8'; c.lineWidth = 3; WW.rr(c, 8, 8, W - 16, H - 16, 22); c.stroke();

    const s = WW.CookLogic.thisStep(run) || { kind: 'serve', label: 'All done!' };

    /* step dots */
    run.steps.forEach((_, i) => {
      c.beginPath(); c.arc(W / 2 - (run.steps.length - 1) * 10 + i * 20, 38, 5.5, 0, 7);
      c.fillStyle = i < run.i ? '#a8dcc3' : i === run.i ? '#ffd66b' : '#eadfc6';
      c.fill();
      if (i === run.i) { c.strokeStyle = '#b8791f'; c.lineWidth = 2; c.stroke(); }
    });

    /* the step scene: big emoji + craft fill/pour meter */
    const kind = s.kind || 'mix';
    c.font = '96px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const glow = (!WW.settings.reducedMotion) ? 0.75 + Math.sin(run.t * 4) * 0.1 : 0.8;
    c.globalAlpha = run.i >= run.steps.length ? 1 : 0.96;
    if (craft.pan) {
      c.globalAlpha = glow * 0.5;
      c.fillStyle = '#ffe9a8'; c.beginPath(); c.arc(W / 2, 170, 74, 0, 7); c.fill();
      c.globalAlpha = 1;
    }
    c.fillText(STEP_EMOJI[kind] || '\u{1F373}', W / 2, 170);
    c.globalAlpha = 1;

    /* progress: taps / fill meters */
    const prog = s.kind === 'mix' ? s.taps / WW.CookLogic.MIX_TAPS : s.fill;
    c.fillStyle = '#f3e4c6'; WW.rr(c, 40, 276, W - 80, 22, 11); c.fill();
    if (prog > 0) {
      c.fillStyle = '#a8dcc3'; WW.rr(c, 40, 276, (W - 80) * Math.max(0.03, prog), 22, 11); c.fill();
    }
    if (s.kind === 'pour') {
      c.strokeStyle = '#b8791f'; c.lineWidth = 2.4;
      const b = WW.CookLogic.POUR_BAND;
      const x0 = 40 + (W - 80) * b[0], x1 = 40 + (W - 80) * b[1];
      c.beginPath(); c.moveTo(x0, 270); c.lineTo(x0, 304); c.moveTo(x1, 270); c.lineTo(x1, 304); c.stroke();
    }

    /* flip marker sweep */
    if (s.kind === 'flip') {
      const mx = 40 + (W - 80) * s.marker;
      c.fillStyle = '#ffd66b'; c.beginPath(); c.ellipse(mx, 293, 9, 26, 0, 0, 7); c.fill();
      c.strokeStyle = '#b8791f'; c.lineWidth = 2; c.stroke();
    }

    /* labels */
    c.textAlign = 'center';
    c.fillStyle = '#4a3524'; c.font = 'bold 21px "Baloo 2", sans-serif';
    c.fillText(s.label, W / 2, 78);
    if (s.missing) {
      c.fillStyle = '#e07d8b'; c.font = '14px "Baloo 2", sans-serif';
      c.fillText('missing the ' + (WW.INGREDIENTS[s.ing] || { name: s.ing }).name.toLowerCase() + '!', W / 2, 242);
    } else {
      c.fillStyle = '#7c5236'; c.font = '15px "Baloo 2", sans-serif';
      if (!final) c.fillText(s.tip || '', W / 2, 242);
    }

    /* praise banner */
    if (banner && bannerT > 0 && !final) {
      c.globalAlpha = Math.min(1, bannerT * 1.6);
      c.fillStyle = 'rgba(255,233,168,.92)'; WW.rr(c, 70, 340, W - 140, 40, 18); c.fill();
      c.strokeStyle = '#b8791f'; c.lineWidth = 2; WW.rr(c, 70, 340, W - 140, 40, 18); c.stroke();
      c.fillStyle = '#4a3524'; c.font = 'bold 19px "Baloo 2", sans-serif';
      c.fillText(banner, W / 2, 361);
      c.globalAlpha = 1;
    }
    if (final) {
      const res = WW.CookLogic.result(run);
      c.fillStyle = '#4a3524'; c.font = 'bold 26px "Baloo 2", sans-serif';
      c.fillText('\u2605'.repeat(res.stars) + '\u2606'.repeat(3 - res.stars), W / 2, 366);
    }
  };

  return {
    /* begin({ recipe, canvas, gold, onDone(res) }), gestures are bound
     * to the canvas itself, and Space/↑/W slot in on window keys. */
    begin(o) {
      opts = o; craft = { pan: !!o.gold };
    el = o.canvas; el.classList.remove('hidden');
    el.width = W; el.height = H;
    el.focus?.({ preventScroll: true });
      ctx = el.getContext('2d');
      run = WW.CookLogic.newRun(o.recipe, o.gathered);
      press = pressId = null; last = 0; banner = ''; bannerT = 0;
      bind();
      stop();
      raf = requestAnimationFrame(frame);
    },
    /** Escape/leave: settle with whatever is cooked so far. */
    abort() {
      if (!run) return null;
      stop(); unbind();
      el.classList.add('hidden');
      const res = WW.CookLogic.result(run);
      return res;
    },
    stop,
    get active() { return !!raf; },
    W, H,
  };
})();
})();
