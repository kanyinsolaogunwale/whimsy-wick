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
  const FLIP_ZONE = 0.12;            // |marker-0.5| sizing for grades
  const FLIP_PERIOD = 2.8;           // calm sweep seconds there and back
  const FLIP_GRACE = 6;              // seconds before the pan flips itself
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
      /* no timer dash: the marker sweeps at an easy pace and the player
       * taps whenever they feel it, with no deadline. Still never stuck:
       * after a full grace the pan flips itself (a gentle carry, never
       * a fail). */
      s.mt += dt;
      s.marker = (Math.sin((s.mt / FLIP_PERIOD) * Math.PI * 2) + 1) / 2;
      if (s.mt >= FLIP_GRACE) ev.push({ k: 'step', grade: 1 });
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
      /* an earnest flip always earns something: dead-centre is perfect,
       * any other tap is a catch, never a miss */
      const d = Math.abs(s.marker - 0.5);
      const grade = d < FLIP_ZONE ? 2 : 1;
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

  return { newRun, tick, tap, result, thisStep, MIX_TAPS, POUR_BAND, FLIP_ZONE, FLIP_GRACE };
})();

/* ============================================================
 *  Canvas driver, owns the rAF loop, the drawing and its own
 *  gestures while the overlay is up: the cooking canvas takes
 *  pointer taps/holds directly, and window keys fall through to
 *  it because game input is disabled during cooking.
 * ============================================================ */
const STEP_EMOJI = { pour: '\u{1F958}' };
/* The one action the current step wants, spelled out big every frame:
 * the little tips stay as flavour, this is the instruction. */
const STEP_HOWTO = { mix: 'Tap, tap, tap!', pour: 'Hold, release at the gold band', flip: 'Tap when the marker is centred', serve: 'Hold to plate it up' };

WW.CookDom = (() => {
  let raf = null, run = null, opts = null, last = 0, el = null, ctx = null, craft = null;
  let banner = '', bannerT = 0;

  const stop = () => { if (raf) cancelAnimationFrame(raf); raf = null; };
  const say = (txt) => { banner = txt; bannerT = 1.1; };

  /* gestures: press = hold; a fresh press also counts as a tap */
  let press = false, pressId = null;
  /* A press that closes a step (the tap that finishes the mixing) is still
   * down when the next step opens. Without this, that leftover press pours
   * the next step through in a blink, before the player can even read it:
   * the hold only counts once the finger or key is fresh on the new step. */
  let suppressHold = false;
  const down = (e) => {
    if (pressId !== null) return;
    pressId = e.pointerId ?? 0;
    try { el.setPointerCapture(e.pointerId); } catch { /* detached */ }
    press = true;
    suppressHold = false;
    const from = run.i;
    WW.CookLogic.tap(run).forEach((ev) => { if (ev.k === 'tapwork') WW.Audio.play('tick'); });
    if (run.i !== from) suppressHold = true;
  };
  const up = (e) => { if (pressId !== null && e.pointerId !== undefined && e.pointerId !== pressId) return; pressId = null; press = false; suppressHold = false; };
  const keyDown = (e) => {
    if (el.classList.contains('hidden')) return;
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      e.preventDefault();
      if (!press) {
        press = true; suppressHold = false;
        const from = run.i;
        WW.CookLogic.tap(run).forEach((ev) => { if (ev.k === 'tapwork') WW.Audio.play('tick'); });
        if (run.i !== from) suppressHold = true;
      }
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

    WW.CookLogic.tick(run, dt, press && !suppressHold).forEach((e) => {
      if (e.k === 'step') {
        /* this step closed while the pointer was still down: the rest of
         * that press must not also pour or plate the next one */
        if (press) suppressHold = true;
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

  /* The mix step's scene: a mixing bowl with batter in it and a spoon
   * standing in the bowl, leaning further as the taps land so the stirring
   * is visible before the progress bar catches up. The spoon is still until
   * the player taps: only their taps move it. */
  const drawMixScene = (c, cx, cy, prog) => {
    const stir = 0.3 + prog * 0.5;
    /* bowl body, a wide U under the rim */
    c.fillStyle = '#fffdf7';
    c.beginPath();
    c.moveTo(cx - 74, cy);
    c.quadraticCurveTo(cx - 66, cy + 96, cx, cy + 96);
    c.quadraticCurveTo(cx + 66, cy + 96, cx + 74, cy);
    c.closePath(); c.fill();
    c.strokeStyle = '#e3c9a0'; c.lineWidth = 3.4; c.stroke();
    /* the batter, seen from above inside the rim */
    c.fillStyle = '#f8e2b4';
    c.beginPath(); c.ellipse(cx, cy - 2, 74, 26, 0, 0, 7); c.fill();
    c.strokeStyle = '#e3c9a0'; c.lineWidth = 3.4; c.stroke();
    /* a couple of swirl rings so the batter reads as something stirred */
    c.strokeStyle = 'rgba(196,148,84,.45)'; c.lineWidth = 2.2;
    c.beginPath(); c.ellipse(cx - 4, cy - 3, 50, 14, 0, 0.4, 4.6); c.stroke();
    c.beginPath(); c.ellipse(cx + 10, cy + 1, 23, 7, 0, 2.6, 6.1); c.stroke();
    /* wooden spoon: head down in the batter, handle up and out to the right */
    c.save();
    c.translate(cx + 10, cy - 6);
    c.rotate(-0.05 + stir * 0.35);
    c.lineCap = 'round';
    c.strokeStyle = '#c98f52'; c.lineWidth = 10;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(46, -44); c.stroke();
    c.strokeStyle = '#e7b475'; c.lineWidth = 6;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(46, -44); c.stroke();
    c.fillStyle = '#e7b475';
    c.beginPath(); c.ellipse(-2, 5, 16, 11, 0, 0, 7); c.fill();
    c.restore();
  };

  /* The flip step's scene: a pancake in the pan, golden and bubbled. It is
   * drawn still: nothing in this card moves unless the player acts. */
  const drawFlipScene = (c, cx, cy) => {
    /* pan: dark disc, lighter cooking surface, then the handle */
    c.fillStyle = '#6b5f80';
    c.beginPath(); c.arc(cx, cy, 64, 0, 7); c.fill();
    c.fillStyle = '#8b7ea6';
    c.beginPath(); c.arc(cx, cy, 55, 0, 7); c.fill();
    c.lineCap = 'round';
    c.strokeStyle = '#6b5f80'; c.lineWidth = 14;
    c.beginPath(); c.moveTo(cx + 56, cy + 14); c.lineTo(cx + 96, cy + 38); c.stroke();
    c.strokeStyle = '#8b7ea6'; c.lineWidth = 8;
    c.beginPath(); c.moveTo(cx + 58, cy + 15); c.lineTo(cx + 94, cy + 37); c.stroke();
    /* the pancake: a gold disc with the bubbles that mean it is ready */
    c.fillStyle = '#f3c877';
    c.beginPath(); c.arc(cx - 2, cy - 2, 44, 0, 7); c.fill();
    c.strokeStyle = '#dda74f'; c.lineWidth = 3; c.stroke();
    c.fillStyle = 'rgba(206,150,66,.55)';
    [[-14,-12,4.5],[10,-19,3.6],[17,6,4.4],[-4,16,3.4],[24,-2,2.6],[-25,7,3]].forEach(([dx, dy, r]) => {
      c.beginPath(); c.ellipse(cx - 2 + dx, cy - 2 + dy, r, r * 0.75, 0, 0, 7); c.fill();
    });
    /* a warm shine along the far edge */
    c.strokeStyle = 'rgba(255,247,214,.8)'; c.lineWidth = 3;
    c.beginPath(); c.arc(cx - 2, cy - 2, 30, 3.5, 5.1); c.stroke();
  };

  const W = 340, H = 430;
  /* One vertical rhythm for the whole card: every block sits 26px from the
   * one above it, from the step dots down to the instruction chip, so the
   * card reads evenly instead of clustering in the middle. */
  const LAY = {
    dots: 40,      // centre of the step-dot row
    title: 82,     // centre of the step label
    scene: 183,    // centre of the drawn scene (bowl, pan)
    tip: 281,      // centre of the flavour tip / missing-ingredient line
    bar: 314,      // top of the progress rail
    chip: 362,     // top of the tap/hold instruction chip
    banner: 250,   // praise toast, dropped into the tip slot
  };
  /* The instruction chip ("Tap, tap, tap!"). One line, always inside the
   * card: the label is measured at the card's own size and steps down in
   * half-points until the chip fits the safe width, so the long pour line
   * shrinks instead of running off the edge. Every step gets the same chip
   * shape, and its text stays centred in the chip. */
  const drawHowtoChip = (c, text) => {
    const maxW = W - 56;
    let size = 17, tw = 0;
    for (;;) {
      c.font = `bold ${size}px "Baloo 2", sans-serif`;
      tw = c.measureText(text).width;
      if (tw + 30 <= maxW || size <= 13) break;
      size -= 0.5;
    }
    const w = Math.min(maxW, tw + 30);
    const x = Math.round((W - w) / 2);
    c.textAlign = 'center';
    c.fillStyle = 'rgba(255, 214, 107, .92)';
    WW.rr(c, x, LAY.chip, w, 32, 16); c.fill();
    c.strokeStyle = '#b8791f'; c.lineWidth = 2; WW.rr(c, x, LAY.chip, w, 32, 16); c.stroke();
    c.fillStyle = '#4a3524';
    c.fillText(text, W / 2, LAY.chip + 16, w - 20);
  };

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
      c.beginPath(); c.arc(W / 2 - (run.steps.length - 1) * 10 + i * 20, LAY.dots, 5.5, 0, 7);
      c.fillStyle = i < run.i ? '#a8dcc3' : i === run.i ? '#ffd66b' : '#eadfc6';
      c.fill();
      if (i === run.i) { c.strokeStyle = '#b8791f'; c.lineWidth = 2; c.stroke(); }
    });

    /* the step scene: mixing is drawn (bowl, batter, spoon), the rest keep
     * their big emoji */
    const kind = s.kind || 'mix';
    /* progress: taps / fill meters */
    const prog = s.kind === 'mix' ? s.taps / WW.CookLogic.MIX_TAPS : (s.kind === 'flip' ? 0 : s.fill);
    c.font = '96px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const glow = (!WW.settings.reducedMotion) ? 0.75 + Math.sin(run.t * 4) * 0.1 : 0.8;
    c.globalAlpha = run.i >= run.steps.length ? 1 : 0.96;
    if (craft.pan) {
      c.globalAlpha = glow * 0.5;
      c.fillStyle = '#ffe9a8'; c.beginPath(); c.arc(W / 2, 170, 74, 0, 7); c.fill();
      c.globalAlpha = 1;
    }
    /* the bowl drawing is 124 tall against the scene's 130 slot; it sits a
     * touch high so the spoon's wire up top and the bowl's base below it
     * leave the same breathing room as the rest of the card's blocks */
    if (kind === 'mix') drawMixScene(c, W / 2, LAY.scene - 26, prog);
    else if (kind === 'flip') drawFlipScene(c, W / 2, LAY.scene);
    /* serving shows the finished dish itself, the same art the recipe pad
     * uses for this dish, rather than a generic plate */
    else if (kind === 'serve') c.fillText((opts.recipe && opts.recipe.emoji) || '\u{1F37D}\u{FE0F}', W / 2, LAY.scene);
    else c.fillText(STEP_EMOJI[kind] || '\u{1F373}', W / 2, LAY.scene);
    c.globalAlpha = 1;
    c.fillStyle = '#f3e4c6'; WW.rr(c, 40, LAY.bar, W - 80, 22, 11); c.fill();
    if (prog > 0) {
      c.fillStyle = '#a8dcc3'; WW.rr(c, 40, LAY.bar, (W - 80) * Math.max(0.03, prog), 22, 11); c.fill();
    }
    if (s.kind === 'pour') {
      c.strokeStyle = '#b8791f'; c.lineWidth = 2.4;
      const b = WW.CookLogic.POUR_BAND;
      const x0 = 40 + (W - 80) * b[0], x1 = 40 + (W - 80) * b[1];
      c.beginPath(); c.moveTo(x0, LAY.bar - 6); c.lineTo(x0, LAY.bar + 28);
      c.moveTo(x1, LAY.bar - 6); c.lineTo(x1, LAY.bar + 28); c.stroke();
    }

    /* flip: an always-visible gold centre zone to aim at, no timer */
    if (s.kind === 'flip') {
      const z = WW.CookLogic.FLIP_ZONE;
      const zx0 = 40 + (W - 80) * (0.5 - z), zx1 = 40 + (W - 80) * (0.5 + z);
      c.fillStyle = 'rgba(255, 214, 107, .4)';
      WW.rr(c, zx0, LAY.bar - 4, zx1 - zx0, 30, 8); c.fill();
      const mx = 40 + (W - 80) * s.marker;
      c.fillStyle = '#b8791f'; c.beginPath(); c.ellipse(mx, LAY.bar + 11, 8, 22, 0, 0, 7); c.fill();
      c.fillStyle = '#ffd66b'; c.beginPath(); c.ellipse(mx, LAY.bar + 11, 6, 18, 0, 0, 7); c.fill();
    }

    /* the instruction chip: the one action this step wants, always up */
    if (!final && s.kind) {
      const howto = STEP_HOWTO[s.kind] || '';
      if (howto) drawHowtoChip(c, howto);
    }

    /* labels */
    c.textAlign = 'center';
    c.fillStyle = '#4a3524'; c.font = 'bold 21px "Baloo 2", sans-serif';
    c.fillText(s.label, W / 2, LAY.title);
    if (s.missing) {
      c.fillStyle = '#e07d8b'; c.font = '14px "Baloo 2", sans-serif';
      c.fillText('missing the ' + (WW.INGREDIENTS[s.ing] || { name: s.ing }).name.toLowerCase() + '!', W / 2, LAY.tip);
    } else {
      c.fillStyle = '#7c5236'; c.font = '13px "Baloo 2", sans-serif';
      /* the praise toast takes the tip slot while it is up */
      if (!final && !(banner && bannerT > 0)) c.fillText(s.tip || '', W / 2, LAY.tip);
    }

    /* praise banner */
    if (banner && bannerT > 0 && !final) {
      c.globalAlpha = Math.min(1, bannerT * 1.6);
      c.fillStyle = 'rgba(255,233,168,.92)'; WW.rr(c, 70, LAY.banner, W - 140, 40, 18); c.fill();
      c.strokeStyle = '#b8791f'; c.lineWidth = 2; WW.rr(c, 70, LAY.banner, W - 140, 40, 18); c.stroke();
      c.fillStyle = '#4a3524'; c.font = 'bold 19px "Baloo 2", sans-serif';
      c.fillText(banner, W / 2, LAY.banner + 20);
      c.globalAlpha = 1;
    }
    if (final) {
      const res = WW.CookLogic.result(run);
      c.fillStyle = '#4a3524'; c.font = 'bold 26px "Baloo 2", sans-serif';
      c.fillText('\u2605'.repeat(res.stars) + '\u2606'.repeat(3 - res.stars), W / 2, LAY.chip + 16);
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
      press = pressId = null; suppressHold = false; last = 0; banner = ''; bannerT = 0;
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
