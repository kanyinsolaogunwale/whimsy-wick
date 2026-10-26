/**
 * Whimsy Wick, js/render/engine.js
 * ---------------------------------------------------------------
 * THREE (local ./lib/three.module.min.js) as the actual renderer (§17):
 * orthographic camera, canvas-art planes, layered parallax kitchen (§7.2),
 * camera keeps Ghee near the left third (§6), particle FX, per-frame sync.
 *
 * World coordinates: y is height above the world floor line. The counter
 * surface (where Ghee walks) sits at y = 0; below it the counter body
 * hangs into the bottom margin of the view. Camera spans y ∈ [-150, 390]
 * when camY = 0 (VH = 540).
 */
(() => {
'use strict';
const WW = window.WW;

const VH = 540;

WW.Engine = (canvas) => {
  const THREE = window.THREE;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(WW.PALETTE.cream);
  const camera = new THREE.OrthographicCamera(0, 100, 100, 0, -10, 10);
  let vw = 960;
  let camX = 0, camY = 0;

  /* Groups: three parallax depths + gameplay world. */
  const gFar = new THREE.Group();   // wall + windows     (factor .18)
  const gMid = new THREE.Group();   // shelves + props    (factor .55)
  const gDeco = new THREE.Group();  // back-counter minis (factor .85)
  const gWorld = new THREE.Group(); // gameplay (factor 1)
  scene.add(gFar, gMid, gDeco, gWorld);

  /* ---------------- texture/mesh helpers ---------------- */
  const matFor = (texEntry) => {
    if (!texEntry.texture) {
      const t = new THREE.CanvasTexture(texEntry.canvas);
      t.minFilter = THREE.LinearFilter;
      texEntry.texture = t;
    }
    return new THREE.MeshBasicMaterial({ map: texEntry.texture, transparent: true, depthWrite: false });
  };
  const quad = (texEntry, wUnits, hUnits) =>
    new THREE.Mesh(new THREE.PlaneGeometry(wUnits, hUnits), matFor(texEntry));

  /** Create a plane using a cached texture; parent decides parallax. */
  const sprite = (texEntry, w, h, x, y, z, parent) => {
    const m = quad(texEntry, w, h);
    m.position.set(x, y, z);
    (parent || gWorld).add(m);
    return m;
  };

  /* ---------------- particles ---------------- */
  WW.tex('pt-spark', 14, 14, (c) => {
    c.fillStyle = '#ffe9a8'; c.beginPath(); c.arc(7, 7, 3.4, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.fillRect(6.2, 1.4, 1.6, 3.4);
  });
  WW.tex('pt-puff', 20, 20, (c) => { c.fillStyle = 'rgba(255,251,240,.9)'; c.beginPath(); c.arc(10, 10, 8, 0, 7); c.fill(); });
  WW.tex('pt-star', 16, 16, (c) => { c.fillStyle = '#fff'; c.fillRect(7, 1, 2, 14); c.fillRect(1, 7, 14, 2); });
  WW.tex('pt-petal', 14, 14, (c) => {
    c.fillStyle = '#f6a6b2'; c.beginPath(); c.ellipse(7, 7, 3.4, 6, 0.6, 0, 7); c.fill();
    c.strokeStyle = '#e07d8b'; c.lineWidth = 1.2; c.stroke();
  });

  const PARTS = [];
  const partGeo = new THREE.PlaneGeometry(1, 1);
  const spawnParticle = (x, y, texKey, size, vel, life, z = 2) => {
    if (PARTS.length > 160) return;                 // keep trails cheap
    const e = WW.tex(texKey, 14, 14, () => {});
    const m = new THREE.Mesh(partGeo, new THREE.MeshBasicMaterial({
      map: e.texture, transparent: true, depthWrite: false, opacity: 1,
    }));
    m.position.set(x, y, z);
    m.scale.setScalar(size);
    gWorld.add(m);
    PARTS.push({ m, vel, life, age: 0 });
  };

  /** n particles fanning upward from (x, y). */
  const puffs = (x, y, tex, n, spd, size, life) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      spawnParticle(x, y, tex, size * (0.7 + Math.random() * 0.6),
        { x: Math.cos(a) * spd * (0.4 + Math.random() * 0.6),
          y: Math.abs(Math.sin(a)) * spd * (0.4 + Math.random() * 0.6) + spd * 0.25 },
        life * (0.7 + Math.random() * 0.6));
    }
  };

  const burst = (x, y, kind) => {
    const reduced = WW.settings && WW.settings.reducedMotion;
    if (reduced && kind !== 'collect') return;
    const mk = (tex, n, spd, size, life) => puffs(x, y, tex, n, spd, size, life);
    if (kind === 'collect') mk('pt-spark', 6, 130, 12, 0.55);
    if (kind === 'gem')     { mk('pt-spark', 5, 150, 13, 0.65); mk('pt-star', 4, 110, 15, 0.8); }
    if (kind === 'puff')    mk('pt-puff', 4, 55, 17, 0.65);
    if (kind === 'crash')   mk('pt-puff', 8, 90, 18, 0.6);
    if (kind === 'goal') { mk('pt-spark', 14, 190, 13, 1.05); mk('pt-star', 8, 160, 15, 1.15); }
  };

  const stepParts = (dt) => {
    for (let i = PARTS.length - 1; i >= 0; i--) {
      const p = PARTS[i];
      p.age += dt;
      if (p.age >= p.life) { gWorld.remove(p.m); p.m.material.dispose(); PARTS.splice(i, 1); continue; }
      p.m.position.x += p.vel.x * dt;
      p.m.position.y += p.vel.y * dt;
      p.vel.y -= 130 * dt;
      p.m.material.opacity = 1 - p.age / p.life;
    }
  };

  /* ---------------- world build ---------------- */
  const THEMES = {
    warm:  { wall: '#f6ead6' },
    flour: { wall: '#f2e6d2' },
    butter:{ wall: '#f6e8ca' },
    milk:  { wall: '#eaf0f4' },
    night: { wall: '#39325a' },
  };

  /** Node refs we re-position per frame (moving hazards etc.). */
  let pins = [], fans = [], sparkPairs = [], gemPairs = [], ingPairs = [];
  let goalFlame = null, goalBody = null, charHolder = null, charDef = null;
  let charMesh = null, charTex = null, worldRef = null, windStreaks = [];
  /* per-spirit move FX state: smoothed flip angle, facing, trail timers,
   * jump/land edge detection and tier-4 afterimage meshes */
  let flipA = 0, lastDir = 1, prevGround = true, prevVy = 0, fxRun = 0, fxAir = 0;
  let ghosts = [];
  const trail = [];

  const repeatStrip = (texKey, pxW, pxH, hUnits, from, to, z, y, parent) => {
    const e = WW.tex(texKey, pxW, pxH, (c, w, h) => { void c; void w; void h; });
    const unitsPer = hUnits * (pxW / pxH);
    const meshes = [];
    for (let x = from; x < to; x += unitsPer) {
      meshes.push(sprite(e, unitsPer, hUnits, x + unitsPer / 2, y, z, parent));
    }
    return unitsPer;
  };

  const build = (cfg) => {
    for (const g of [gFar, gMid, gDeco, gWorld]) {
      while (g.children.length) g.remove(g.children[0]);
    }
    pins = []; fans = []; sparkPairs = []; gemPairs = []; ingPairs = []; windStreaks = [];
    PARTS.forEach(p => p.m.material.dispose()); PARTS.length = 0;
    goalFlame = goalBody = charHolder = null;
    worldRef = cfg.world; charDef = cfg.charDef;

    const t = THEMES[cfg.theme] || THEMES.warm;
    scene.background = new THREE.Color(t.wall);
    const L = cfg.world.length;
    const rows = cfg.rows || [];

    /* far wall, strips tile horizontally, full screen height */
    repeatStrip('bg-wall', 640, 560, 540, -1000, L + 1000, -6, 120, gFar);
    if (rows.includes('window')) {
      const e = WW.tex('bg-window', 300, 150, () => {});
      for (let x = 300; x < L; x += 1150) sprite(e, 250, 125, x, 330, -5.5, gFar);
    }
    /* mid shelves: open shelves on the wall above the counter */
    repeatStrip('bg-props', 640, 300, 190, -800, L + 800, -4, 240, gMid);
    /* deco minis standing on the counter's back edge */
    repeatStrip('props-mini', 560, 120, 56, -600, L + 600, -2.5, 118, gDeco);
    /* faded so background clutter never reads as an obstacle */
    for (const m of gDeco.children) m.material.opacity = 0.55;
    /* the counter itself: countertop exactly at the ground line */
    repeatStrip('bg-counter', 640, 360, 300, -700, L + 700, -1.5, WW.Physics.GROUND_Y - 150, gWorld);

    /* platforms, draw each with its own mini canvas */
    for (const p of cfg.world.platforms) {
      const e = WW.tex('plat' + Math.round(p.w), Math.max(8, Math.round(p.w)), 26, (c, w, h) => {
        c.fillStyle = WW.PALETTE.wood; WW.rr(c, 0, 0, w, h, 12); c.fill();
        c.fillStyle = '#eccf9d'; WW.rr(c, 3, 3, w - 6, 7, 5); c.fill();
        c.fillStyle = WW.PALETTE.woodDark; c.fillRect(12, h - 4, w - 24, 4);
      });
      sprite(e, p.w, 26, p.x + p.w / 2, WW.Physics.GROUND_Y + p.y - 13, -0.5);
    }

    /* hazards */
    const G = WW.Physics.GROUND_Y;
    const shadowE = WW.tex('hz-shadow', 100, 20, () => {});
    const shadow = (x, w) => sprite(shadowE, w, 12, x, G + 1, -0.3);
    for (const h of cfg.world.hazards) {
      if (h.t === 'flour') {
        shadow(h.x + 46, 96);
        sprite(WW.tex('hz-flour', 96, 40, () => {}), 92, 40, h.x + 46, G + 20, -0.2);
      } else if (h.t === 'pin') {
        h.px = h.px ?? h.x + h.range / 2;
        const sh = shadow(h.px, 110);
        const m = sprite(WW.tex('hz-pin', 130, 62, () => {}), 128, 61, h.px, G + 41, 0.4);
        pins.push({ h, m, sh });
      } else if (h.t === 'butter') {
        sprite(WW.tex('hz-butter', 200, 46, () => {}), h.w, h.w * 0.23, h.x + h.w / 2, G + 5, 0.1);
      } else if (h.t === 'milk') {
        sprite(WW.tex('hz-milk', 200, 46, () => {}), h.w, h.w * 0.23, h.x + h.w / 2, G + 5, 0.1);
      } else if (h.t === 'jam') {
        sprite(WW.tex('hz-jam', 200, 46, () => {}), h.w, h.w * 0.23, h.x + h.w / 2, G + 5, 0.15);
      } else if (h.t === 'jamdrop') {
        shadow(h.x + 26, 48);
        sprite(WW.tex('hz-jamdrop', 60, 42, () => {}), 44, 31, h.x + 26, G + 15.5, 0.15);
      } else if (h.t === 'fan') {
        /* just the spinning blades, floating over the counter */
        shadow(h.x + 26, 46);
        const m = sprite(WW.tex('hz-fan-blades', 104, 104, () => {}), 54, 54, h.x + 26, G + 46, 0.32);
        fans.push({ h, m });
        /* breeze: fast gusts + chevrons racing out of the blades toward the
         * player across the whole push zone, in front of Ghee (z > 1) */
        const W = WW.Physics.WIND;
        const gustE = WW.tex('fx-gust', 128, 24, () => {});
        const chevE = WW.tex('fx-chevron', 32, 32, () => {});
        for (let i = 0; i < 10; i++) {
          const len = 64 + (i * 37 % 5) * 12;
          windStreaks.push({
            m: sprite(gustE, len, len * 24 / 128, h.x + 4, G, 1.1),
            baseX: h.x + 4, baseY: G + 10 + (i % 5) * ((W.height - 14) / 4),
            reach: W.reach + 30, period: 0.62, phase: i * 0.29, wob: 3,
          });
        }
        for (let i = 0; i < 3; i++) {
          windStreaks.push({
            m: sprite(chevE, 28, 28, h.x, G, 1.1),
            baseX: h.x, baseY: G + 26 + i * 20,
            reach: W.reach, period: 0.9, phase: i * 0.3, wob: 0,
          });
        }
      }
    }

    /* collectibles */
    const sparkE = WW.tex('co-spark', 44, 44, () => {});
    const gemE = WW.tex('co-gem', 40, 40, () => {});
    for (const s of cfg.world.sparks) sparkPairs.push({ s, m: sprite(sparkE, 30, 30, s.x, G + s.y, 0.6) });
    for (const g of cfg.world.gems) gemPairs.push({ g, m: sprite(gemE, 32, 32, g.x, G + g.y, 0.6) });
    /* recipe ingredients (Cook & Learn), counter food art per kind */
    for (const g of (cfg.world.ingredients || [])) {
      ingPairs.push({ g, m: sprite(WW.ingTex(g.k), 34, 34, g.x, G + g.y, 0.62) });
    }

    /* goal lantern + flame (story only, endless runs have none) */
    if (cfg.world.goal) {
      goalBody = sprite(WW.tex('goal-lantern', 92, 130, () => {}), 76, 107, cfg.world.goal.x + 38, G + 53.5, 0.7);
      goalFlame = sprite(WW.tex('goal-flame', 40, 52, () => {}), 34, 44, cfg.world.goal.x + 38, G + 104, 0.8);
      goalFlame.visible = false;
    }

    /* character, live-sketched plane */
    charCanvas.width = 120; charCanvas.height = 148;
    charTex = new THREE.CanvasTexture(charCanvas);
    charTex.minFilter = THREE.LinearFilter;
    charMesh = new THREE.Mesh(new THREE.PlaneGeometry(88, 108), new THREE.MeshBasicMaterial({ map: charTex, transparent: true, depthWrite: false }));
    /* painter draws the feet at canvas y≈142; centre is 74 → feet sit
     * (142−74)/148 of the plane below centre ≈ 50u. Lift the mesh so the
     * feet land exactly on the holder origin (the physics ground line). */
    charMesh.position.y = 50;
    charHolder = new THREE.Group();
    charHolder.add(charMesh);
    gWorld.add(charHolder);
    charHolder.position.z = 1;

    /* tier-4 spirits leave fading afterimages (same live texture, lagged) */
    flipA = 0; prevGround = true; prevVy = 0; fxRun = fxAir = 0; trail.length = 0;
    ghosts = [];
    if (charDef && charDef.anim >= 4) {
      for (const [i, op] of [0.34, 0.2, 0.1].entries()) {
        const g = new THREE.Mesh(charMesh.geometry, new THREE.MeshBasicMaterial({ map: charTex, transparent: true, depthWrite: false, opacity: op }));
        g.position.z = 0.9 - i * 0.01; g.visible = false;
        gWorld.add(g); ghosts.push(g);
      }
    }
  };

  const charCanvas = WW.canvas(1, 1); /* resized at build */

  /* Per-spirit move FX, the pricier the spirit, the more it shows off:
   *  1 floaty puffs · 2 dust kicks · 3 sparkle trail · 4 petals + afterimages */
  const moveFx = (state, dt, off) => {
    const tier = (charDef && charDef.anim) || 0;
    const x = charHolder.position.x, y = state.y, d = lastDir;
    const running = state.onGround && Math.abs(state.vx) > 90;
    const jumped = (prevGround && !state.onGround && state.vy > 200) ||
                   (!state.onGround && state.vy > prevVy + 200);       // double hop
    const landed = !prevGround && state.onGround;
    prevGround = state.onGround; prevVy = state.vy;

    trail.unshift({ x, y: y + 50 });
    if (trail.length > 13) trail.length = 13;
    ghosts.forEach((g, i) => {
      const p = trail[(i + 1) * 4];
      g.visible = !off && !!p && (Math.abs(state.vx) > 40 || !state.onGround);
      if (p) { g.position.x = p.x; g.position.y = p.y; g.scale.copy(charMesh.scale); }
    });
    if (off || tier === 0) return;

    if (jumped) {
      if (tier === 1) puffs(x, y + 6, 'pt-puff', 4, 45, 13, 0.6);
      if (tier === 2) puffs(x, y + 4, 'pt-puff', 6, 80, 14, 0.5);
      if (tier === 3) { puffs(x, y + 4, 'pt-puff', 4, 70, 13, 0.45); puffs(x, y + 22, 'pt-spark', 8, 120, 11, 0.6); }
      if (tier >= 4) { puffs(x, y + 24, 'pt-petal', 10, 110, 13, 1); puffs(x, y + 24, 'pt-spark', 6, 140, 11, 0.6); puffs(x, y + 24, 'pt-star', 3, 120, 14, 0.7); }
    }
    if (landed && tier >= 2) {
      puffs(x, y + 4, 'pt-puff', tier >= 3 ? 7 : 5, 90, 15, 0.5);
      if (tier >= 4) puffs(x, y + 8, 'pt-petal', 6, 80, 12, 0.9);
    }
    fxRun += dt; fxAir += dt;
    if (running) {
      const every = [0, 0.3, 0.12, 0.1, 0.09][tier];
      if (fxRun > every) {
        fxRun = 0;
        if (tier === 1) spawnParticle(x, y + 2, 'pt-puff', 10, { x: 0, y: 18 }, 0.5);
        if (tier === 2 || tier === 3) spawnParticle(x - d * 14, y + 4, 'pt-puff', 11, { x: -d * 60, y: 30 }, 0.45);
        if (tier === 3 && Math.random() < 0.5) spawnParticle(x - d * 18, y + 24, 'pt-spark', 9, { x: -d * 30, y: 20 }, 0.5);
        if (tier >= 4) spawnParticle(x - d * 16, y + 20, 'pt-petal', 11, { x: -d * 40, y: 40 }, 0.9);
      }
    }
    if (!state.onGround && tier >= 3 && fxAir > 0.05) {
      fxAir = 0;
      spawnParticle(x, y + 25, 'pt-spark', 9, { x: -d * 20, y: 10 }, 0.45);
      if (tier >= 4) spawnParticle(x - d * 8, y + 30, 'pt-petal', 10, { x: -d * 30, y: 30 }, 0.8);
    }
  };

  const lightGoal = () => {
    if (!goalFlame) return;
    goalFlame.visible = true;
    burst(goalBody.position.x, 110, 'goal');
  };

  /* ---------------- per-frame sync ---------------- */
  let poseOverride = null;
  const sync = (state, dt, o) => {
    if (!worldRef || !charTex) return;
    const now = o.animT;
    /* flips (tier 3+): follow the jump, then finish the turn on landing */
    const reduced = WW.settings && WW.settings.reducedMotion;
    if (state.vx > 20) lastDir = 1; else if (state.vx < -20) lastDir = -1;
    if (reduced) flipA = 0;
    else if (!state.onGround && (state.jumpsUsed || 0) > 0) {
      flipA = WW.math.damp(flipA, WW.flipAngle(charDef, state.vy, state.jumpsUsed, lastDir), 22, dt);
    } else {
      const full = Math.round(flipA / (Math.PI * 2)) * Math.PI * 2;
      flipA = Math.abs(flipA - full) < 0.03 ? 0 : WW.math.damp(flipA, full, 26, dt);
    }

    /* draw the spirit */
    const c = charCanvas.getContext('2d');
    c.clearRect(0, 0, charCanvas.width, charCanvas.height);
    WW.paintSpirit(c, charCanvas.width, charCanvas.height, {
      char: charDef, animT: now,
      pose: poseOverride ||
        (state.poseState && state.poseState !== 'none' ? state.poseState
          : state.onGround ? (Math.abs(state.vx) > 26 ? 'run' : 'idle')
          : (state.vy > 30 ? 'jump' : 'fall')),
      blink: state.blink, look: state.vx > 20 ? 'r' : state.vx < -20 ? 'l' : 'f',
      wind: state.wind, squash: state.squash, spin: flipA,
    });
    charTex.needsUpdate = true;

    charHolder.position.x = state.x + WW.Physics.BODY.w / 2;
    charHolder.position.y = state.y;
    charHolder.rotation.z = state.wind * -0.1;
    charMesh.scale.set(state.squash.x, state.squash.y, 1);
    moveFx(state, dt, reduced || o.snap);

    /* moving hazards */
    for (const { h, m, sh } of pins) m.position.x = sh.position.x = h.px;
    for (const f of fans) f.m.rotation.z = -now * 8;   // blades only

    /* breeze: gusts/chevrons shoot out of the fan toward the player
     * (leftwards), fading in and out across the push zone */
    for (const w of windStreaks) {
      const t = ((now + w.phase) % w.period) / w.period;
      w.m.position.x = w.baseX - w.reach * t;
      w.m.position.y = w.baseY + Math.sin(now * 9 + w.phase * 7) * w.wob;
      w.m.material.opacity = 0.95 * Math.sin(Math.PI * t);
    }

    /* collectibles idle motion, bob + slight sway, always face-on */
    const G = WW.Physics.GROUND_Y;
    for (const { s, m } of sparkPairs) {
      if (s.got) { m.visible = false; continue; }
      m.rotation.z = Math.sin(now * 2.4 + s.x * 0.01) * 0.18;
      m.position.y = G + s.y + Math.sin(now * 3 + s.x * 0.01) * 5;
    }
    for (const { g, m } of gemPairs) {
      if (g.got) { m.visible = false; continue; }
      m.rotation.z = Math.sin(now * 2 + g.x * 0.012) * 0.14;
      m.position.y = G + g.y + Math.sin(now * 2.2 + g.x * 0.012) * 6;
    }
    /* ingredients: same idle bob, a touch slower so food feels cosy */
    for (const { g, m } of ingPairs) {
      if (g.got) { m.visible = false; continue; }
      m.rotation.z = Math.sin(now * 1.7 + g.x * 0.011) * 0.16;
      m.position.y = G + g.y + Math.sin(now * 2.6 + g.x * 0.011) * 5;
    }
    if (goalFlame && goalFlame.visible) {
      const pulse = WW.settings && WW.settings.reducedMotion ? 1 : 0.9 + Math.sin(now * 9) * 0.12;
      goalFlame.scale.setScalar(pulse);
    }

    stepParts(dt);

    /* ---------- camera: Ghee at the left third (assignment §6) ---------- */
    const halfW = vw / 2;
    const target = WW.math.clamp(state.x - halfW * 0.32, -60, Math.max(-60, worldRef.length - vw + 60));
    camX = o.snap ? target : WW.math.damp(camX, target, 6, dt);
    const targetY = !state.onGround && state.y > 200 ? state.y - 200 : 0;
    camY = o.snap ? targetY : WW.math.damp(camY, targetY, 3.4, dt);

    camera.left = camX; camera.right = camX + vw;
    camera.bottom = camY - 150; camera.top = camY - 150 + VH;
    camera.updateProjectionMatrix();

    /* parallax offsets (§7.2 restrained) */
    const rm = WW.settings && WW.settings.reducedMotion ? 1 : 1;
    gFar.position.x = camX * 0.82 * rm;
    gFar.position.y = camY * 0.1 * rm;
    gMid.position.x = camX * 0.45 * rm;
    gMid.position.y = camY * 0.2 * rm;
    gDeco.position.x = camX * 0.15 * rm;
    gDeco.position.y = camY * 0.45 * rm;

    renderer.render(scene, camera);
  };

  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    vw = Math.max(320, Math.round(VH * (w / h)));
    camera.left = camX; camera.right = camX + vw;
    camera.bottom = camY - 150; camera.top = camY - 150 + VH;
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize);
  resize();

  return {
    build, sync, resize, burst, lightGoal,
    setPose(p) { poseOverride = p; },
    get vw() { return vw; },
    get camX() { return camX; },
  };
};
})();
