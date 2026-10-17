/**
 * Whimsy Wick — js/world/physics.js
 * ---------------------------------------------------------------
 * Live gameplay state + frame-rate independent simulation (assignment §5).
 * World-units; design height 540, ground top at GROUND_Y (from bottom).
 *
 * Exposed as WW.Physics.newState / step / helpers used by game.js.
 */
(() => {
'use strict';
const WW = window.WW;
const M = WW.math;

const GROUND_Y = 96;          // standing height of feet above world bottom mark
const BODY = { w: 40, h: 50 };
/* fan breeze: how far in front of the fan it reaches, how high it blows,
 * and the speed range (fraction of top speed) while leaning into it */
const WIND = { reach: 220, height: 90, lean: [0.4, 0.5] };

/* Tuning — dt in seconds. */
const TUNE = {
  run: 235,           // u/s
  air: 210,
  jumpV: 560,         // u/s initial
  grav: 1450,         // u/s^2
  gravHold: 900,      // while jump held & rising
  gravFall: 1750,
  maxFall: 900,
  coyote: 0.09,
  buffer: 0.12,
  slipFriction: { dry: 26, butter: 2.4, milk: 1.6, jam: 9 },
  slipPush: { butter: 150, milk: 190 },   // idle drift u/s
  jamMax: 0.45,       // speed multiplier inside jam
  wind: 170,
  windHeld: 150,
};

WW.Physics = { GROUND_Y, BODY, TUNE, M, WIND };

/* ---------------------------------------------------------------- */
WW.Physics.newState = (startX = 140) => ({
  x: startX, y: GROUND_Y, vx: 0, vy: 0,
  onGround: true, jumping: false, jumpHeld: false, jumpsUsed: 0,
  coyote: 0, buffer: 0,
  facing: 'r', runPhase: 0,
  surface: 'dry',            // dry | butter | milk | jam
  slipTime: 0,               // wobble seconds remaining
  squash: { x: 1, y: 1 },    // dynamic spring
  wind: 0,                   // wind exposure 0..1 (visual)
  blink: 0, blinkTimer: 1.5 + Math.random() * 2,
});

/** Apply a jump request (from input). Returns true if it fired. */
WW.Physics.tryJump = (s) => {
  if (s.onGround || s.coyote > 0) {
    s.vy = TUNE.jumpV; s.jumping = true; s.onGround = false; s.coyote = 0;
    s.jumpsUsed = 1;
    s.squash.x = 0.78; s.squash.y = 1.26;
    return true;
  }
  // double hop: one extra mid-air jump, slightly softer than the first
  if ((s.jumpsUsed || 0) < 2) {
    s.jumpsUsed = (s.jumpsUsed || 0) + 1;
    s.vy = TUNE.jumpV * 0.92; s.onGround = false; s.coyote = 0;
    s.squash.x = 0.82; s.squash.y = 1.2;
    return true;
  }
  s.buffer = TUNE.buffer;      // buffered for landing
  return false;
};

/**
 * One physics step. Input snapshot: { move:-1..1 (analog-ish), jumpHeld }.
 *Hazards+world: { hazards, sparks, gems, platforms, length, goal }
 * Returns events array: jump/land/collect/slip/crash/windTick/hitGoal…
 */
WW.Physics.step = (s, input, world, dt) => {
  const ev = [];
  const wasGround = s.onGround;

  /* ---- surface detection (under feet) ---- */
  const feetY = s.y;
  const on = (h) => s.y <= GROUND_Y + 1 && s.x + BODY.w * 0.7 > h.x && s.x + BODY.w * 0.3 < h.x + h.w;
  const puddle = world.hazards.find(h => (h.t === 'butter' || h.t === 'milk') && on(h));
  const jam = world.hazards.find(h => h.t === 'jamdrop' && on(h));
  const prevSurf = s.surface;
  s.surface = puddle ? puddle.t === 'butter' ? 'butter' : 'milk'
            : jam ? 'jam' : 'dry';
  if (s.surface !== 'dry' && prevSurf === 'dry') ev.push({ k: 'slip', s: s.surface });

  /* ---- horizontal intent ---- */
  const f = TUNE.slipFriction[s.surface] ?? TUNE.slipFriction.dry;
  let want = input.move;                                  // -1..1
  if (s.surface === 'jam') want *= TUNE.jamMax;
  const top = (s.onGround ? TUNE.run : TUNE.air) * (s.surface === 'jam' ? TUNE.jamMax : 1);
  const acc = want !== 0 ? (s.onGround ? f * 30 : 90) : 0;
  if (want !== 0) s.vx += want * acc * dt;
  const boost = s.surface === 'butter' && want !== 0 ? 1.12
              : s.surface === 'milk' && want !== 0 ? 1.2 : 1;
  s.vx = M.clamp(s.vx, -top * boost, top * boost);

  // idle drift on slick surfaces
  if (s.onGround && s.surface === 'butter' && want === 0) s.vx += TUNE.slipPush.butter * dt;
  if (s.onGround && s.surface === 'milk' && want === 0) s.vx += TUNE.slipPush.milk * dt;

  // ground friction toward zero
  if (want === 0 && s.onGround) {
    const fr = f * dt * 8;
    s.vx = Math.abs(s.vx) <= fr ? 0 : s.vx - Math.sign(s.vx) * fr;
  }

  /* ---- fan wind (assignment §5.2) ----
   * Each fan blows back toward the player across the stretch in front of it,
   * up to a little above fan height. It slows rather than blocks: hold
   * forward to lean in and crawl through, or hop over the breeze. */
  let inWind = 0;
  for (const h of world.hazards) {
    if (h.t !== 'fan') continue;
    const zl = h.x - WIND.reach, zr = h.x + (h.w ?? 60);
    if (s.x + BODY.w > zl && s.x < zr && s.y < GROUND_Y + WIND.height) inWind = 1;
  }
  s.wind = M.damp(s.wind, inWind ? 1 : 0, 6, dt);
  if (inWind) {
    if (input.move > 0) s.vx = M.clamp(s.vx, top * WIND.lean[0], top * WIND.lean[1]);
    else s.vx = Math.max(s.vx - TUNE.wind * 3 * dt, -TUNE.wind);   // drift back on the breeze
    if ((world.fanTick = (world.fanTick || 0) + dt) > 0.4) { world.fanTick = 0; ev.push({ k: 'windTick' }); }
  }

  /* ---- forward integration ---- */
  s.x += s.vx * dt;
  s.x = M.clamp(s.x, 20, world.length - BODY.w - 20);

  /* ---- vertical: gravity + jump-hold floatiness ---- */
  if (s.vy > 0 && s.jumpHeld && !s.onGround) s.vy -= TUNE.gravHold * dt;
  else s.vy -= (s.vy > 0 ? TUNE.grav : TUNE.gravFall) * dt;
  s.vy = Math.max(s.vy, -TUNE.maxFall);
  s.y += s.vy * dt;

  /* ---- platform landings (solid tops; walls too) ---- */
  for (const p of world.platforms) {
    const topX2 = p.x + p.w, topY = GROUND_Y + p.y;
    const overlapX = s.x + BODY.w * 0.75 > p.x && s.x + BODY.w * 0.25 < topX2;
    const falling = s.vy <= 0;
    if (overlapX && falling && s.y >= topY - 6 && s.y - s.vy * dt <= topY + 2) {
      s.y = topY; s.vy = 0; s.onGround = true; s.jumping = false; s.jumpsUsed = 0;
    } else if (s.vy <= 0 && s.onGround && overlapX && Math.abs(s.y - topY) < 12) {
      s.y = topY; // ride the platform
    }
  }
  if (s.y <= GROUND_Y) {
    // resolve to ground regardless of prior grounded state — never sink below (§5.1)
    s.jumpsUsed = 0;                       // reset double hop on landing
    if (!wasGround && s.vy < -60) {
      s.squash.x = 1.24; s.squash.y = 0.78;   // landing squash
    }
    if (!wasGround) ev.push({ k: 'land' });
    s.y = GROUND_Y;
    if (s.vy < 0) s.vy = 0;
    s.onGround = true; s.jumping = false;
  } else {
    // airborne unless riding a platform top
    let riding = false;
    for (const p of world.platforms) {
      const topY = GROUND_Y + p.y;
      const overlapX = s.x + BODY.w * 0.75 > p.x && s.x + BODY.w * 0.25 < p.x + p.w;
      if (overlapX && Math.abs(s.y - topY) < 3) riding = true;
    }
    if (!riding) s.onGround = false;
  }

  /* ---- coyote + buffered jump ---- */
  if (s.onGround) s.coyote = TUNE.coyote; else s.coyote = Math.max(0, s.coyote - dt);
  if (s.buffer > 0) {
    s.buffer -= dt;
    if (s.onGround) { WW.Physics.tryJump(s); s.buffer = 0; ev.push({ k: 'jump' }); }
  }

  /* ---- squash spring back to neutral ---- */
  s.squash.x += (1 - s.squash.x) * Math.min(1, dt * 9);
  s.squash.y += (1 - s.squash.y) * Math.min(1, dt * 9);

  /* ---- run phase + slip wobble timer + blink ---- */
  if (s.onGround && Math.abs(s.vx) > 12) s.runPhase += dt * (Math.abs(s.vx) / TUNE.run) * 10;
  if (s.slipTime > 0) s.slipTime -= dt;
  s.blinkTimer -= dt;
  if (s.blinkTimer <= 0) { s.blink = 0.12; s.blinkTimer = 1.6 + Math.random() * 2.4; }
  if (s.blink > 0) s.blink = Math.max(0, s.blink - dt * 2);

  /* ---- hazards (§5.2 clarity: read the threat before it bites) ---- */
  for (const h of world.hazards) {
    const hwidth = h.w ?? 46;
    const hx2 = h.x + hwidth;
    const overlap = s.x + BODY.w * 0.7 > h.x && s.x + BODY.w * 0.3 < hx2;

    if (h.t === 'flour') {
      // cloud rises ~40u above the counter; feet must clear it
      if (overlap && s.y < GROUND_Y + 40) { ev.push({ k: 'crash', why: 'flour' }); return ev; }
    }
    /* every hazard pays a coin the first time Ghee fully passes it (§5.3) */
    const passX = h.x + (h.range || 0) + hwidth + 30;
    if (!h.cleared && s.x > passX) {
      h.cleared = true;
      ev.push({ k: 'clear', what: h.t });
    }
    if (h.t === 'pin') {
      // patrol: cx = anchor mid; position oscillates
      const mid = h.x + h.range / 2;
      h.px = h.px ?? mid;
      const ph = (world.t || 0);
      const target = mid - h.range / 2 + (Math.sin(ph * (1.15 + (h.speed ?? 0))) * 0.5 + 0.5) * h.range;
      h.px = M.damp(h.px ?? target, target, 3.4, dt);
      if (overlap && s.y < GROUND_Y + 34 && Math.abs(s.x + BODY.w * 0.5 - h.px) < 58) {
        ev.push({ k: 'crash', why: 'pin' }); return ev;
      }
    }
    if (h.t === 'jamdrop') {
      if (overlap && s.y <= GROUND_Y + 1) {
        if (!h.hit) { h.hit = true; ev.push({ k: 'jamSplat' }); }
      } else if (!overlap) h.hit = false;
    }
  }

  /* ---- collectibles ---- */
  // (flour/pin/butter/milk/jam/fan clear events emitted above)
  const cR = 46; // magnet radius
  for (let i = world.sparks.length - 1; i >= 0; i--) {
    const p = world.sparks[i];
    if (!p.got && Math.hypot(p.x - (s.x + BODY.w / 2), GROUND_Y + p.y - (s.y + BODY.h / 2)) < cR) {
      p.got = true; ev.push({ k: 'collect', what: 'spark', at: p });
    }
  }
  for (const g of world.gems) {
    if (!g.got && Math.hypot(g.x - (s.x + BODY.w / 2), GROUND_Y + g.y - (s.y + BODY.h / 2)) < cR) {
      g.got = true; ev.push({ k: 'collect', what: 'gem', at: g });
    }
  }

  /* ---- goal ---- */
  if (world.goal && s.x + BODY.w * 0.5 > world.goal.x && !world.goalDone) {
    world.goalDone = true;
    ev.push({ k: 'goal' });
  }

  if (ev.length) ev.push({ k: 'moved' });
  return ev;
};

/** Distance metric for endless scoring: metres (10u = 1 m). */
WW.Physics.metres = (x) => Math.max(0, Math.round((x - 140) / 10));
})();
