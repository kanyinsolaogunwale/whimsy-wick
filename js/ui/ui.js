/**
 * Whimsy Wick, js/ui/ui.js
 * ---------------------------------------------------------------
 * Every screen, HUD element, bubble and binder. All buttons use
 * pointer events with repeat-click guards (assignment §8, §13).
 */
(() => {
'use strict';
const WW = window.WW;
const $ = (id) => document.getElementById(id);

/* Inline icon snippets reused by dynamic HTML (HUD chips, rewards). */
const IC = {
  coin: `<svg class="hud-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#ffe08a" stroke="#b8791f" stroke-width="2.4"/><path d="M12 8.2l1.1 2.2 2.4.3-1.8 1.8.5 2.4-2.2-1.2-2.2 1.2.5-2.4-1.8-1.8 2.4-.3z" fill="#c98a1e" opacity=".85"/></svg>`,
  gem:  `<svg class="hud-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l7 5.2-2.4 10H7.4L5 7.8z" fill="#d5c6f5" stroke="#8f74c9" stroke-width="2.2" stroke-linejoin="round"/><path d="M9.6 7.8l2.4 10 2.4-10-2.4-3.4z" fill="#a98fd9" opacity=".6"/></svg>`,
  /* the Who-hops modal wallet badge: a little storefront leads the strip */
  shop: `<svg class="hud-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7h15l1.4 3.4c0 1.2-1 2.2-2.2 2.2-1 0-1.9-.7-2.1-1.7-.2 1-1.1 1.7-2.1 1.7-.6 0-1.2-.2-1.6-.6-.4.4-1 .6-1.6.6-1 0-1.9-.7-2.1-1.7-.2 1-1.1 1.7-2.1 1.7-1.2 0-2.2-1-2.2-2.2z" fill="#ffd66b" stroke="#b8791f" stroke-width="1.8" stroke-linejoin="round"/><rect x="5" y="13.2" width="14" height="7.3" rx="1.6" fill="#f3e4c6" stroke="#b8791f" stroke-width="1.8"/><rect x="10.4" y="14.6" width="3.2" height="5.9" rx="1" fill="#c7b8e8" stroke="#b8791f" stroke-width="1.4"/></svg>`,
  /* Kitchen Shelf items, drawn in the game's pastel flat style (no emojis) */
  kitchen: {
    pantry: `<svg class="shelf-icon" viewBox="0 0 48 48" aria-hidden="true"><path d="M14.5 17h19c3.4 9.6 3.2 18.4-1.2 24.4A3.8 3.8 0 0 1 29 43.5H19a3.8 3.8 0 0 1-3.3-2.1c-4.4-6-4.6-14.8-1.2-24.4z" fill="#f3e4c6" stroke="#b8791f" stroke-width="2.4" stroke-linejoin="round"/><path d="M13.8 17.5q10.2-7.5 20.4 0" fill="#fffaf0" stroke="#b8791f" stroke-width="2.4" stroke-linejoin="round"/><circle cx="24" cy="15.5" r="2.1" fill="#c98a4b"/><path d="M25.5 15.5c2.5-4.5 7-5 9.5-4.5-1 3.5-5 6.5-9.5 6z" fill="#a8dcc3" stroke="#5fae8d" stroke-width="2" stroke-linejoin="round"/></svg>`,
    pan: `<svg class="shelf-icon" viewBox="0 0 48 48" aria-hidden="true"><circle cx="19" cy="29" r="13.5" fill="#ffd66b" stroke="#b8791f" stroke-width="2.4"/><circle cx="19" cy="29" r="8" fill="#ffedb0"/><rect x="31.5" y="25.8" width="14" height="6.4" rx="3.2" fill="#e9a63a" stroke="#b8791f" stroke-width="2.2"/></svg>`,
    pin: `<svg class="shelf-icon" viewBox="0 0 48 48" aria-hidden="true"><rect x="10" y="18" width="28" height="12" rx="6" fill="#f3e4c6" stroke="#b8791f" stroke-width="2.4" stroke-linejoin="round"/><rect x="12.8" y="20.8" width="22.4" height="6.4" rx="3.2" fill="#fffaf0"/><rect x="1.8" y="21" width="9" height="6" rx="3" fill="#e9a63a" stroke="#b8791f" stroke-width="2.2"/><rect x="37.2" y="21" width="9" height="6" rx="3" fill="#e9a63a" stroke="#b8791f" stroke-width="2.2"/></svg>`,
    jar: `<svg class="shelf-icon" viewBox="0 0 48 48" aria-hidden="true"><rect x="14" y="14" width="20" height="27" rx="6" fill="#f7efe2" stroke="#8f74c9" stroke-width="2.4"/><rect x="12.5" y="7.5" width="23" height="8" rx="4" fill="#c7b8e8" stroke="#8f74c9" stroke-width="2.2"/><circle cx="20" cy="31" r="2" fill="#e07d8b"/><circle cx="26.5" cy="27.5" r="2" fill="#a8dcc3"/><circle cx="22.5" cy="36.5" r="2" fill="#8f74c9"/><circle cx="28.5" cy="34.5" r="1.6" fill="#e9a63a"/><circle cx="17.5" cy="25.5" r="1.6" fill="#e9a63a"/></svg>`,
  },
};

/* Kitchen Shelf tools, clean display names for the reward chips */
WW.UI = (() => {
  let audio = null, onAction = null, busy = false;
  const SCREENS = ['title', 'story', 'chars', 'howto', 'records', 'settings', 'signin', 'pause', 'result', 'ending', 'recipes', 'cooking', 'share', 'fragments'];
  let hudCtx = null; // 'story' | 'endless'
  let lastActionTs = 0;
  /* Click guard: debounces repeat clicks on the SAME control (§8). */
  let lastTarget = null;
  const guard = (e) => {
    const now = performance.now();
    if (e.currentTarget === lastTarget && now - lastActionTs < 250) return;
    lastTarget = e.currentTarget; lastActionTs = now;
    WW.Audio.play('tick');
    if (onAction && e.currentTarget.__act && e.currentTarget.__act !== 'noop') {
      onAction({ action: e.currentTarget.__act, arg: e.currentTarget.__arg });
    }
  };
  const btn = (id, action, arg) => {
    const el = $(id);
    el.__act = action; el.__arg = arg;
    el.addEventListener('click', guard);
    el.addEventListener('pointerenter', () => WW.Audio.play('hover'));
  };

  /* ---------------- title hero art ---------------- */
  let heroT = 0, heroRaf = null;
  /* Pointer tracked over the title screen (canvas-local px): the drifting
   * flock notices it, glances over, and startles with a hop when it gets
   * close. -999 keeps it parked until the first pointermove. */
  const ptr = { x: -999, y: -999 };
  const startle = [ -9, -9, -9, -9, -9 ];
  /* The five spirits drift through the night sky above the kitchen: one
   * floating patch each, kept clear of the windows, the HUD chips and the
   * menu card. They bob, wander, react to the cursor, and every so often
   * show off their own trick mid-air (Peaches flips, Clover twirls, Mallow
   * parachute-glides). No ground, no shadows: sky sprites. */
  const paintHero = () => {
    const cv = $('title-spirits');
    if (!cv) return;
    heroT += 1 / 60;
    if (!cv.offsetParent) { heroRaf = requestAnimationFrame(paintHero); return; }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth, H = cv.clientHeight;
    if (W < 10 || H < 10) { heroRaf = requestAnimationFrame(paintHero); return; }
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    }
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    const t = heroT;

    const compact = window.innerWidth < 860;
    /* drifting patches (x, y as viewport fractions). Compact lays the
     * flock out on an even, gentle arc across the upper strip so it reads
     * as a tidy group (not a scatter), clear of the chips row below. */
    const anchors = compact
      ? [[0.12, 0.17], [0.31, 0.21], [0.50, 0.15], [0.69, 0.21], [0.88, 0.17]]
      : [[0.30, 0.17], [0.33, 0.50], [0.50, 0.15], [0.70, 0.31], [0.70, 0.55]];
    const k = compact
      ? Math.max(0.6, Math.min(W * 0.12, (H * 0.15) / 80))
      : Math.max(0.8, Math.min(W * 0.06, (H * 0.13) / 80));
    const chars = WW.CHARACTERS;

    for (let i = 0; i < 5; i++) {
      const ch = chars[i] || chars[0];
      /* each patch wanders on a slow orbit with its own phase, bobbing on
       * a faster rhythm so the flock never looks locked together */
      const fx = anchors[i][0] + Math.sin(t * 0.11 + i * 2.1) * (compact ? 0.035 : 0.05);
      const fy = anchors[i][1] + Math.sin(t * 0.55 + i * 1.3) * (compact ? 0.022 : 0.035);
      /* they face where they drift, unless the cursor gives a reason */
      const driftLook = Math.cos(t * 0.11 + i * 2.1) >= 0 ? 'r' : 'l';
      let look = driftLook;
      let pose = 'idle', spin = 0;
      if (i === 0) {                        // Ghee: a happy little hop now and then
        const p = t % 5.2;
        if (p > 3.6 && p < 3.9) pose = 'jump';
        else if (p >= 3.9 && p < 4.25) pose = 'fall';
        else if (p >= 4.25 && p < 4.5) pose = 'land';
      } else if (i === 1) {                 // Pip: dashing bursts, leaning into the air
        pose = (t % 4.6) > 2.7 ? 'run' : 'idle';
      } else if (i === 2) {                 // Mallow: parachute float, tier-1 sway
        pose = 'fall';
      } else if (i === 3) {                 // Peaches: front flips while drifting
        const p = t % 5.4;
        if (p > 2.4 && p < 3.05) { pose = 'jump'; spin = Math.PI * 2 * (p - 2.4) / 0.65; }
        else if (p >= 3.05 && p < 3.7) { pose = 'fall'; spin = Math.PI * 4 * (p - 3.05) / 0.65; }
        else if (p >= 3.7 && p < 3.95) pose = 'land';
      } else {                              // Clover: big slow twirls
        const p = t % 6.4;
        if (p > 3.0 && p < 4.0) { pose = 'jump'; spin = Math.PI * 4 * (p - 3.0) / 1.0; }
        else if (p >= 4.0 && p < 5.0) { pose = 'fall'; spin = Math.PI * 8 * (p - 4.0) / 1.0; }
        else if (p >= 5.0 && p < 5.25) pose = 'land';
      }
      let cx = W * fx, cy = H * fy;
      /* ---- sky interaction: notice the cursor ----
       * glance at it, ease a shy few px away from it, and when it closes
       * right in, a short startled hop (jump + land pose on a timer). */
      if (ptr.x > -99) {
        const dx = cx - ptr.x, dy = cy - ptr.y;
        const d = Math.hypot(dx, dy) || 1;
        const near = Math.max(0, 1 - d / 170);
        if (near > 0) {
          if (d > 30) look = dx > 0 ? 'r' : 'l';
          cx += (dx / d) * 12 * near;
          cy += (dy / d) * 9 * near;
          if (near > 0.55 && t - startle[i] > 1.5) startle[i] = t;
        }
      }
      const since = t - startle[i];
      if (since >= 0 && since < 0.5) {
        pose = 'jump'; look = cx >= ptr.x ? 'r' : 'l';
      } else if (since >= 0.5 && since < 0.9) pose = 'land';
      c.save();
      /* hand paintSpirit a k-scaled rect centred on the drift point */
      c.translate(cx - 28 * k, cy - 40 * k);
      WW.paintSpirit(c, 56 * k, 80 * k, { char: ch, animT: t + i * 0.9, pose, spin, look });
      c.restore();
    }
    heroRaf = requestAnimationFrame(paintHero);
  };

  /* ---------------- title backdrop: painted night kitchen ---------------- */
  /* #title-scene is a full-screen one-shot painting that reuses the game's
   * real textures (night windows, utensil shelves, the counter) laid out
   * for the *actual* viewport: landscape spreads two corner windows and
   * side shelves, portrait keeps the middle clear for the menu card.
   * Static after paint (no RAF): the floating deco chips animate in CSS. */
  const paintTitleScene = () => {
    const cv = $('title-scene');
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth || window.innerWidth;
    const H = cv.clientHeight || window.innerHeight;
    if (!W || !H) return;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const portrait = H > W * 1.05;

    /* night sky melting into the cream kitchen wall */
    const sky = c.createLinearGradient(0, 0, 0, H * 0.72);
    sky.addColorStop(0, '#2f2758');
    sky.addColorStop(0.34, '#5f4b86');
    sky.addColorStop(0.62, '#a98ec2');
    sky.addColorStop(1, '#f6ead6');
    c.fillStyle = sky; c.fillRect(0, 0, W, H * 0.72);
    c.fillStyle = '#f6ead6'; c.fillRect(0, H * 0.72, W, H);

    /* stars + one soft moon glow, seeded so it never flickers on repaint */
    const R = WW.rng(11);
    for (let i = 0; i < 46; i++) {
      const y = R() * (portrait ? H * 0.3 : H * 0.34);
      const x = R() * W;
      c.globalAlpha = 0.25 + R() * 0.55;
      c.fillStyle = R() < 0.3 ? '#ffd66b' : '#fff8e0';
      const s = R() < 0.25 ? 3 : 2;
      c.fillRect(x, y, s, s);
    }
    c.globalAlpha = 1;
    const mg = c.createRadialGradient(W * (portrait ? 0.78 : 0.85), H * 0.1, 8, W * (portrait ? 0.78 : 0.85), H * 0.1, H * 0.3);
    mg.addColorStop(0, 'rgba(255,243,196,.5)');
    mg.addColorStop(1, 'rgba(255,243,196,0)');
    c.fillStyle = mg; c.fillRect(0, 0, W, H * 0.5);

    /* warm light bloom behind the title card so text reads like a sign */
    const bloom = c.createRadialGradient(W / 2, H * 0.42, 20, W / 2, H * 0.42, Math.min(W, H) * 0.55);
    bloom.addColorStop(0, 'rgba(255,236,180,.34)');
    bloom.addColorStop(1, 'rgba(255,236,180,0)');
    c.fillStyle = bloom; c.fillRect(0, 0, W, H * 0.8);

    /* the counter band, straight from the game's own floor texture */
    const floorH = Math.max(150, H * 0.27);
    const counter = WW.tex('bg-counter', 1, 1, () => {}).canvas;
    const srcH = 190;                                     // slab + cupboard heads
    c.drawImage(counter, 0, 0, counter.width, srcH, 0, H - floorH, W, floorH);
    c.fillStyle = 'rgba(74,53,36,.14)'; c.fillRect(0, H - floorH, W, 3);

    /* shelves + windows, cropped from the real backdrop textures */
    if (portrait) {
      const windowE = WW.tex('bg-window', 1, 1, () => {}).canvas;
      const wW = Math.min(W * 0.42, 240), wH = wW * 0.55;
      c.drawImage(windowE, 0, 0, windowE.width, windowE.height,
        W * 0.62, H * 0.05, wW, wH);
      /* the complete shelf art, nothing cropped mid-item */
      const propsE = WW.tex('bg-props', 1, 1, () => {}).canvas;
      const pw = Math.min(W * 0.52, 320), ph = pw * (300 / 640);
      c.drawImage(propsE, 0, 0, 640, 300, W * 0.03, H - floorH - ph + 4, pw, ph);
    } else {
      const windowE = WW.tex('bg-window', 1, 1, () => {}).canvas;
      c.drawImage(windowE, 0, 0, windowE.width, windowE.height,
        W * 0.04, H * 0.075, Math.min(W * 0.22, 330), Math.min(W * 0.22, 330) * 0.55);
      c.drawImage(windowE, 0, 0, windowE.width, windowE.height,
        W * 0.78, H * 0.05, Math.min(W * 0.19, 290), Math.min(W * 0.19, 290) * 0.55);
      /* both sides show the COMPLETE shelf art (no mid-item crops, the old
       * cut-off look); the right one is mirrored so the twins don't clone */
      const propsE = WW.tex('bg-props', 1, 1, () => {}).canvas;
      const lw = Math.min(W * 0.32, 520), lh = lw * (300 / 640);
      c.drawImage(propsE, 0, 0, 640, 300, W * 0.02, H - floorH - lh + 4, lw, lh);
      const rw = Math.min(W * 0.27, 430), rh = rw * (300 / 640);
      c.save(); c.translate(W - W * 0.02, 0); c.scale(-1, 1);
      c.drawImage(propsE, 0, 0, 640, 300, 0, H - floorH - rh + 4, rw, rh);
      c.restore();
    }

    /* window light pooling onto the counter: soft warm trapezoids under
     * each pane so the night windows light the kitchen */
    const pool = (px, pw2) => {
      const g3 = c.createLinearGradient(0, H - floorH, 0, H);
      g3.addColorStop(0, 'rgba(255,243,196,.30)');
      g3.addColorStop(1, 'rgba(255,243,196,0)');
      c.fillStyle = g3;
      c.beginPath();
      c.moveTo(px, H - floorH); c.lineTo(px + pw2, H - floorH);
      c.lineTo(px + pw2 + floorH * 0.3, H); c.lineTo(px - floorH * 0.3, H);
      c.closePath(); c.fill();
    };
    if (portrait) pool(W * 0.62, Math.min(W * 0.42, 240));
    else { pool(W * 0.04, Math.min(W * 0.22, 330)); pool(W * 0.78, Math.min(W * 0.19, 290)); }

    /* firefly sparks drifting up from the counter warmth */
    for (let i = 0; i < 9; i++) {
      c.fillStyle = '#ffe9a8'; c.globalAlpha = 0.30 + R() * 0.35;
      c.beginPath(); c.arc(R() * W, H - floorH * 0.2 - R() * floorH * 0.95, 2 + R() * 2.2, 0, 7); c.fill();
    }
    c.globalAlpha = 1;

    /* gentle vignette to seat the vignette of the modal-heavy look */
    const vg = c.createLinearGradient(0, H - floorH, 0, H);
    vg.addColorStop(0, 'rgba(74,53,36,0)');
    vg.addColorStop(1, 'rgba(46,32,18,.28)');
    c.fillStyle = vg; c.fillRect(0, H - floorH, W, floorH);
  };
  /* floating collectibles baked from the game's own sprites */
  const paintTitleDeco = () => {
    for (const cv of document.querySelectorAll('.title-deco canvas[data-tex]')) {
      const key = cv.getAttribute('data-tex');
      /* ing-* sprites are created lazily by WW.ingTex: register the real
       * draw here instead of caching an empty 1x1 texture over it */
      const kind = key.startsWith('ing-') ? key.slice(4) : null;
      const el = kind ? WW.ingTex(kind).canvas : WW.tex(key, 1, 1, () => {}).canvas;
      if (!el) continue;
      cv.getContext('2d').drawImage(el, 0, 0, el.width, el.height, 0, 0, cv.width, cv.height);
    }
  };

  /* ---------------- characters preview loop ---------------- */
  let previewT = 0, previewRaf = null;
  const PREVIEW_W = 110, PREVIEW_H = 100, PREVIEW_ZOOM = 1.4;
  const charCtxs = [];  // { canvas, def }
  const previewLoop = () => {
    previewT += 1 / 60;
    for (const { canvas, def } of charCtxs) {
      const ctx = canvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const k = (canvas.width / PREVIEW_W) * PREVIEW_ZOOM;   // DPR × zoom
      ctx.setTransform(k, 0, 0, k, 0, 0);
      /* act out the move set: run → jump (with flips for tier 3+) → idle */
      const ph = previewT % 3.2;
      let pose = 'idle', spin = 0, lift = 0;
      if (ph < 1.4) pose = 'run';
      else if (ph < 2.3) {
        const tau = (ph - 1.4) / 0.9, jv = WW.Physics.TUNE.jumpV, vy = jv * (1 - 2 * tau);
        pose = vy > 30 ? 'jump' : 'fall';
        spin = WW.flipAngle(def, vy, 1, 1);
        lift = Math.sin(Math.PI * tau) * 12;
      }
      ctx.translate(0, -lift);
      WW.paintSpirit(ctx, canvas.width / k, canvas.height / k, { char: def, animT: previewT, pose, spin, look: 'r' });
    }
    previewRaf = requestAnimationFrame(previewLoop);
  };
  const startPreviews = () => { if (!previewRaf) previewLoop(); };

  /* ---------------- screens ---------------- */
  const show = (name) => {
    /* modal overlays keep the base screen (title/story) visible behind them */
    const target = name && $('screen-' + name);
    const overlay = !!target && target.classList.contains('overlay-screen');
    for (const s of SCREENS) {
      const el = $('screen-' + s);
      if (!el) continue;
      if (overlay && s !== name && !el.classList.contains('overlay-screen')) continue;
      el.classList.toggle('hidden', s !== name);
    }
    if (name) $('screens').classList.remove('hidden'); else $('screens').classList.add('hidden');
    if (name === 'title') renderTitleStats();
    /* the tab pill is sized from live layout, so it can only be placed once
     * the page is visible: opening the kitchen renders while it is still
     * hidden, which left the pill at its default width until a tab was tapped */
    if (name === 'recipes') placeKitchenInd(true);
  };
  const showNone = () => show(null);

  const setHUD = (mode, levelName) => {
    hudCtx = mode;
    $('hud').classList.toggle('hidden', !mode);
    if (!mode) return;
    $('hud-level').textContent = levelName || '';
    $('hud-gems').classList.add('hidden');
    $('hud-coins').classList.add('hidden');
    $('hud-score').classList.add('hidden');
    $('hud-dist').classList.add('hidden');
    $('hud-ingredients').classList.add('hidden');
    $('hud-story-parts').classList.add('hidden');
    if (mode === 'story') {
      $('hud-gems').classList.remove('hidden');
      $('hud-coins').classList.remove('hidden');
      $('hud-ingredients').classList.remove('hidden');
      $('hud-story-parts').classList.remove('hidden');
    }
    if (mode === 'endless') {
      $('hud-score').classList.remove('hidden');
      $('hud-dist').classList.remove('hidden');
      $('hud-coins').classList.remove('hidden');
      $('hud-gems').classList.remove('hidden');
    }
  };
  /* Continue-after-crash offer: gem cost, owned count, afford state */
  const showRevive = ({ cost, gems, shield, who }) => {
    const yes = $('revive-yes');
    const ok = gems >= cost;
    const hopper = who || 'Ghee';
    $('revive-sub').innerHTML = ok
      ? `${hopper} took the tumble. Spend gems to hop right back in${shield ? ', ' + shield + 's of get-out-of-jail free' : ''}.`
      : `${hopper} took the tumble, but you don't have enough gems to revive: ${IC.gem}${fmtN(cost)} needed, ${IC.gem}${fmtN(gems)} banked.`;
    $('revive-cost').innerHTML = ok ? `${IC.gem}${fmtN(cost)}` : `${IC.gem}${fmtN(cost - gems)} more`;
    $('revive-count').textContent = '';
    yes.classList.toggle('disabled-cta', !ok);
    yes.disabled = !ok;
    $('revive-no').textContent = ok ? 'No Thanks' : 'End The Run';
    $('revive-overlay').classList.remove('hidden');
  };
  const reviveCountdown = (secs) => { const el = $('revive-count'); if (el) el.textContent = secs + 's'; };
  const hideRevive = () => { $('revive-overlay').classList.add('hidden'); };

  /* Story fragment found: the run freezes behind this card until the
   * player has read it and taps Continue. */
  const showStoryPart = ({ level, index, total, title, text }) => {
    $('storypart-kicker').textContent = `${level || 'Story'} \u00b7 Story Page Found`;
    $('storypart-title').textContent = title || '';
    $('storypart-text').textContent = text || '';
    $('storypart-count').textContent = `Part ${index + 1} of ${total}`;
    $('storypart-overlay').classList.remove('hidden');
  };
  const hideStoryPart = () => $('storypart-overlay').classList.add('hidden');

  /* Recipe ingredient chips under the level name: 🥚1/2 … dim when done */
  const hud = {
    coins(n) { $('hud-coin-n').textContent = n; },
    gems(n) { $('hud-gem-n').textContent = n; },
    ingredients(list) {
      const box = $('hud-ingredients');
      if (!list || !list.length) { box.classList.add('hidden'); box.innerHTML = ''; return; }
      box.innerHTML = list.map((it) =>
        `<span class="hud-chip hud-ing${it.have >= it.n ? ' done' : ''}" title="Collect the ${it.name.toLowerCase()}">${it.emoji}<b>${Math.min(it.have, it.n)}/${it.n}</b></span>`
      ).join('');
      box.classList.remove('hidden');
    },
    score(n) { $('hud-score').textContent = String(n); },
    dist(n) { $('hud-dist').textContent = n + ' m'; },
    time(n) { /* optional HUD clock; no dedicated element yet */ },
    /* story fragments read on this level, as "2/3" */
    parts(have, total) {
      const el = $('hud-story-parts-n');
      if (el) el.textContent = `${have || 0}/${total || 0}`;
    },
    show(set) { if (set && hudCtx) $('hud').classList.remove('hidden'); else $('hud').classList.add('hidden'); },
  };

  /* the shop's wallet strip: the coin + gem chips sit right above the
   * goods, and the one that is short flashes when a purchase is refused,
   * so the shortfall reads even if the toast has already faded */
  const renderShopWallet = (coins, gems) => {
    if ($('shop-coins')) $('shop-coins').textContent = fmtN(coins || 0);
    if ($('shop-gems')) $('shop-gems').textContent = fmtN(gems || 0);
  };
  const flashWallet = (kind) => {
    const el = kind === 'gems' ? $('shop-gems') : $('shop-coins');
    const chip = el && el.closest('.hud-chip');
    if (!chip) return;
    chip.classList.remove('flash');
    void chip.offsetWidth;                 // restart the nudge on repeat taps
    chip.classList.add('flash');
    clearTimeout(chip.__flashT);
    chip.__flashT = setTimeout(() => chip.classList.remove('flash'), 640);
  };

  /* ---------------- story map ---------------- */
  let progressIds = [];
  const STORY_REWARDS = [
    { coins: 60, gems: 3 },
    { coins: 80, gems: 4 },
    { coins: 100, gems: 5 },
    { coins: 120, gems: 6 },
    { coins: 150, gems: 8 },
  ];
  const renderStory = (levels, progress, sparks, parts = {}) => {
    progressIds = progress || [];
    const grid = $('story-grid');
    grid.innerHTML = '';
    levels.forEach((L, i) => {
      const locked = i > 0 && !progress.includes(levels[i - 1].id);
      const done = progress.includes(L.id);
      const recipe = WW.recipeForLevel ? WW.recipeForLevel(i) : null;
      const rew = STORY_REWARDS[i] || STORY_REWARDS[STORY_REWARDS.length - 1];
      const partsHave = (parts[L.id] || []).length;
      const partsTotal = (L.story || []).length;
      /* level number over its dish: the tile hints what cooking is ahead,
       * with a name + state chip so each card reads like a little plate */
      const chip = done ? '<span class="st-chip done">Cooked</span>'
        : locked ? '<span class="st-chip lock">Locked</span>'
        : '<span class="st-chip">New</span>';
      /* every card carries its own level: dish, name, its one-line story,
       * the coins + gems it pays and the Play button itself, so nobody has
       * to scroll down to a separate panel to start a level */
      const b = document.createElement('div');
      b.className = 'story-tile' + (done ? ' done' : '') + (locked ? ' locked' : '');
      b.setAttribute('role', 'button');
      b.setAttribute('aria-label', (locked ? 'Locked: ' : 'Play: ') + L.name);
      b.innerHTML = `<span class="st-num">${i + 1}</span>` +
        (locked
          ? `<span class="st-dish"><svg class="st-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="9.5" rx="3"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></svg></span>`
          : `<span class="st-dish">${recipe.emoji}</span>`) +
        `<span class="st-name">${L.name}</span>` + chip +
        `<p class="st-note">${L.note}</p>` +
        `<span class="st-reward">` +
          `<span class="story-reward-chip">${IC.coin} ${rew.coins}</span>` +
          `<span class="rdot">·</span>` +
          `<span class="story-reward-chip">${IC.gem} ${rew.gems} gems</span>` +
        `</span>` +
        `<span class="st-parts">${partsHave}/${partsTotal} story parts</span>` +
        (locked
          ? '<button class="btn btn-soft st-play" type="button" disabled>Locked</button>'
          : `<button class="btn btn-primary st-play" type="button">${done ? 'Play Again' : 'Play Level ' + (i + 1)}</button>`);
      /* the card and its own button are one control: the tap bubbles up
       * to the card, so a single guarded play action fires */
      b.__act = locked ? 'noop' : 'play-level';
      b.__arg = i;
      b.addEventListener('click', guard);
      grid.appendChild(b);
    });
  };

  /* ---------------- story parts page ----------------
   * A read-only reread of the collection: each level keeps its fragments in
   * order, and the ones still waiting out on the counter stay as quiet
   * placeholders so the page reads like a set being filled in. */
  const renderFragments = (levels, parts = {}) => {
    const list = $('frag-list');
    if (!list) return;
    const have = levels.reduce((n, L) => n + (parts[L.id] || []).length, 0);
    const all = levels.reduce((n, L) => n + (L.story || []).length, 0);
    const sub = $('frag-sub');
    if (sub) sub.textContent = 'Every part of the story you have found so far.';
    /* the running total lives on this page now: here is where the collection
     * is actually counted, so the map stays focused on the levels themselves */
    const tot = $('frag-total');
    if (tot) tot.innerHTML = all
      ? `<span class="story-parts-chip">Story parts found: <b>${have}</b> of ${all}</span>`
      : '';
    list.innerHTML = levels.map((L) => {
      const found = parts[L.id] || [];
      const total = (L.story || []).length;
      const rows = (L.story || []).map((p, i) => {
        const got = found.includes(i);
        const title = got ? p.title : 'Not found yet';
        const text = got ? p.text : `Part ${i + 1} is still waiting out on the counter.`;
        return `<article class="frag-part${got ? '' : ' locked'}">` +
          `<span class="frag-num">${i + 1}</span>` +
          `<div class="frag-body"><b class="frag-title">${title}</b><p class="frag-text">${text}</p></div>` +
          `</article>`;
      }).join('');
      return `<section class="frag-level${found.length ? '' : ' empty'}">` +
        `<header class="frag-level-head"><b>${L.name}</b>` +
        `<span class="frag-count">${found.length}/${total}</span></header>` +
        `<div class="frag-parts">${rows}</div>` +
        `</section>`;
    }).join('');
  };

  /* ---------------- characters + shop ----------------
   * Every spirit is a self-serve shelf item now: no bottom confirm row,
   * each card carries its own Play / Buy button with the exact price,
   * showing the coin + gem split when plain coins don't cover it. */
  let charTemp = null;
  let shop = { owned: ['ghee'], balance: 0, gems: 0, equipped: 'ghee' };
  const planFor = (d) => WW.payPlan(d.price, shop.balance, shop.gems);
  const charCtaFor = (ch) => {
    /* primary tint belongs to the selected card only; the rest stay soft.
     * Selection fills the button even when it can't be paid yet (disabled) */
    const tone = ch.id === charTemp ? ' btn-primary' : ' btn-soft';
    if (ch.id === shop.equipped) {
      return `<button class="btn${tone} char-buy" data-id="${ch.id}" disabled>In Use</button>`;
    }
    if (shop.owned.includes(ch.id)) {
      return `<button class="btn${tone} char-buy" data-id="${ch.id}">Use</button>`;
    }
    const pay = planFor(ch);
    /* price in the button always shows the coin + gem split the payment
     * takes: gems top up coins, so even when the wallet can't cover it yet
     * the button states what the top-up would use, never a bare shortfall */
    let price;
    if (pay.ok) {
      price = pay.gems
        ? `${IC.coin}${fmtN(pay.coins)} + ${IC.gem}${fmtN(pay.gems)}`
        : `${IC.coin}${fmtN(pay.coins)}`;
    } else if (shop.gems > 0) {
      const gTop = shop.gems;                        // all gems go in
      const coinsPart = Math.max(0, ch.price - gTop * WW.GEM_VALUE);
      price = `${IC.coin}${fmtN(coinsPart)} + ${IC.gem}${fmtN(gTop)}`;
    } else {
      price = `${IC.coin}${fmtN(ch.price)}`;
    }
    /* unaffordable cards stay tappable on purpose: tapping one is how the
     * player finds out exactly how far off they are (see 'char-buy') */
    return `<button class="btn${tone} char-buy" data-id="${ch.id}"${pay.ok ? '' : ' data-short="1"'}><span class="buy-label">Buy</span><span class="char-price">${price}</span></button>`;
  };
  /* selection is just the visual highlight + button tone: re-render so
   * the tapped card is the only one with the primary action */
  const pickCharCard = (id) => {
    charTemp = id;
    renderChars(WW.CHARACTERS, id, shop);
  };
  const renderChars = (chars, selectedId, shopInfo, note = '') => {
    if (shopInfo) shop = shopInfo;
    if (selectedId) charTemp = selectedId;
    $('chars-note').textContent = note;
    renderTitleStats();
    renderShopWallet(shop.balance, shop.gems);
    const grid = $('char-grid');
    grid.innerHTML = chars.map((ch) => {
      const badge = shop.owned.includes(ch.id)
        ? '<span class="cc-badge owned">Owned</span>'
        : `<span class="cc-badge price${planFor(ch).ok ? '' : ' short'}">${IC.coin}${fmtN(ch.price)}</span>`;
      return `<div class="char-card${ch.id === charTemp ? ' sel' : ''}" data-id="${ch.id}">` +
        badge +
        `<button class="char-pick" data-id="${ch.id}" aria-label="Show ${ch.name}">` +
        `<canvas class="char-canvas"></canvas><b>${ch.name}</b></button>` +
        `<small class="cc-moves">${ch.moves}</small>` +
        charCtaFor(ch) +
        `</div>`;
    }).join('');
    charCtxs.length = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const cv of grid.querySelectorAll('.char-canvas')) {
      cv.width = PREVIEW_W * dpr; cv.height = PREVIEW_H * dpr;
      cv.style.width = PREVIEW_W + 'px'; cv.style.height = PREVIEW_H + 'px';
    }
    for (const card of grid.querySelectorAll('.char-card')) {
      const ch = chars.find(c => c.id === card.dataset.id);
      charCtxs.push({ canvas: card.querySelector('.char-canvas'), def: ch });
    }
    /* the whole card selects, like the shelf; the action button acts */
    for (const card of grid.querySelectorAll('.char-card')) {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.char-buy')) return;
        WW.Audio.play('tick');
        pickCharCard(card.dataset.id);
      });
    }
    for (const b of grid.querySelectorAll('.char-buy')) {
      if (b.disabled) continue;
      const ch = chars.find(c => c.id === b.dataset.id);
      const action = shop.owned.includes(b.dataset.id) ? 'char-play' : 'char-buy';
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        WW.Audio.play('tick');
        onAction && onAction({ action, arg: ch.id });
      });
    }
    startPreviews();
  };

  /* ---------------- settings ---------------- */
  const renderSettings = (s) => {
    $('set-music').value = Math.round(s.music * 100); $('set-music-val').textContent = Math.round(s.music * 100);
    $('set-sfx').value = Math.round(s.sfx * 100); $('set-sfx-val').textContent = Math.round(s.sfx * 100);
    $('set-mute').checked = !!s.mute;
    $('set-gestures').checked = s.gestureHints !== false;
    $('set-rm').checked = !!s.reducedMotion;
    document.body.classList.toggle('rm', !!s.reducedMotion);
  };

  /* ---------------- tutorial & hints ----------------
   * The guide rides along with the live run: each page clears when the
   * player performs its action, and the last page ends at the wick. */
  const setTutorial = (step, total) => {
    const el = $('tutorial');
    el.classList.remove('hidden');
    $('tut-step').textContent = `${step + 1} / ${total}`;
  };
  const setTutorialText = (title, text, prompt) => { $('tut-title').textContent = title; $('tut-text').textContent = text; if (prompt !== undefined) $('tut-tap').textContent = prompt; };
  const hideTutorial = () => $('tutorial').classList.add('hidden');

  const showGestureHint = (v) => $('gesture-hint').classList.toggle('hidden', !v);
  const showToast = (text, ms = 4200) => {
    const t = $('hint-toast');
    $('hint-toast-text').textContent = text;
    t.classList.remove('hidden');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => t.classList.add('hidden'), ms);
  };

  /* ---------------- profile card ---------------- */
  const renderProfile = (info, signedIn) => {
    // the sign-in flow lives behind the profile chip on the title screen
    const card = $('startng-card');
    card.hidden = false;
    const face = $('player-face');
    if (info.face) { face.style.display = ''; face.src = info.face; }
    else { face.style.display = 'none'; face.removeAttribute('src'); }
    card.classList.toggle('no-face', !info.face);
    $('player-name').textContent = info.name || 'Guest';
    const at = signedIn && info.account ? '@' + info.account : (signedIn ? '' : 'Not signed in');
    $('player-account').textContent = at;
    $('player-sign-in').hidden = !!signedIn;
  };

  /* ---------------- title records (top-centre of home) ---------------- */
  let statsSource = null;
  const fmtN = (n) => Math.round(n || 0).toLocaleString();
  const renderTitleStats = () => {
    const d = statsSource && statsSource();
    if (!d) return;
    $('ts-coins').textContent = fmtN(d.wallet.coins);
    $('ts-gems').textContent = fmtN(d.wallet.gems);
    $('ts-best').textContent = fmtN(d.endless.best);
    $('ts-dist').textContent = fmtN(d.endless.bestDistance) + ' m';
  };

  /* ---------------- result panels ---------------- */
  const stat = (v, label, hot) =>
    `<span class="rstat${hot ? ' hot' : ''}"><b>${v}</b>${label ? `<span>${label}</span>` : ''}</span>`;

  /* ---------------- records modal ---------------- */
  const fmtClock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const myName = () => (WW.player && WW.player.info && (WW.player.info.name || WW.player.info.nickname)) || 'Guest';
  const renderLeaderboard = (entries, opts) => {
    opts = opts || {};
    const mine = opts.myRank;                       // { rank, score } when off-page
    const list = entries.slice(0, 8);
    if (mine && mine.rank > list.length) {
      list.push({ name: myName(), score: mine.score, rank: mine.rank, me: true });
    }
    $('records-runs').innerHTML = list.map((e, i) => {
      const rank = e.rank ?? i + 1;
      const isMe = e.me || e.name === myName();
      return `<tr class="${isMe ? 'me' : e.rank === 1 || i === 0 ? 'top' : ''}">` +
        `<td>${rank}</td><td>${isMe ? '&#11088; ' : ''}${e.name || 'A spirit'}</td>` +
        `<td>${fmtN(e.score)}</td><td>${e.dist ? fmtN(e.dist) + ' m' : ''}</td></tr>`;
    }).join('');
    const has = list.length > 0;
    $('records-empty').classList.toggle('hidden', has);
    document.querySelector('.records-table').classList.toggle('hidden', !has);
  };
  const renderRecords = (d) => {
    const lit = d.story.completed.length, total = WW.STORY_LEVELS.length;
    $('records-summary').innerHTML =
      stat(`${IC.coin} ${fmtN(d.stats.coinsEarned)}`, 'Coins earned') +
      stat(`${IC.gem} ${fmtN(d.stats.gemsEarned)}`, 'Gems found') +
      stat(fmtN(d.endless.best), 'Best score') +
      stat(fmtN(d.endless.bestDistance) + ' m', 'Best distance') +
      stat(fmtN(d.stats.runs), 'Runs played') +
      stat(`${lit}/${total}`, 'Wicks lit') +
      stat('\u{1F373} ' + fmtN(d.stats.dishesCooked || 0), 'Dishes cooked');
    /* Leaderboard: live start.ng board when connected; personal bests as
     * the offline fallback so the screen never feels empty for guests. */
    $('records-empty').textContent = 'Loading the leaderboard…';
    $('records-empty').classList.remove('hidden');
    document.querySelector('.records-table').classList.add('hidden');
    const fallback = () => {
      $('records-empty').textContent = 'No scores on the board yet. Play Endless mode to set the first one!';
      const runs = d.endless.runs || [];
      renderLeaderboard(runs.map(r => ({ name: r.char && (WW.CHARACTERS.find(c => c.id === r.char) || { name: r.char }).name, score: r.score, dist: r.dist, me: true })), { myRank: null });
    };
    (WW.StartNG && WW.StartNG.leaderboard ? WW.StartNG.leaderboard(8) : Promise.resolve(null)).then((board) => {
      if (board && board.length) {
        /* append my row from my saved best when I'm not on the page */
        let mine = null;
        if (d.endless.best > 0) mine = { rank: (board[board.length - 1].rank ?? board.length) + 1, score: d.endless.best };
        renderLeaderboard(board, { myRank: mine });
      } else if (WW.StartNG && WW.StartNG.signedIn()) {
        $('records-empty').textContent = 'No scores on the board yet, your first Endless run sets the pace!';
      } else {
        fallback();
      }
    }).catch(fallback);
  };

  const cleanResultButtons = () => {
    // reset the result panel to a known state before each show
    $('result-primary').classList.remove('hidden');
    $('result-replay').classList.remove('hidden');
    $('result-primary').setAttribute('aria-label', 'Next level');
    $('result-replay').setAttribute('aria-label', 'Retry level');
    const dish = $('result-dish');
    if (dish) { dish.innerHTML = ''; dish.classList.add('hidden'); }
  };

  /* ---------------- Cook & Learn ---------------- */
  /* The cook-along is part of the kitchen page now, not a modal: dish,
   * pantry chips and the real method sit on the counter, the pan only
   * appears once the player presses Start. */
  const showCooking = (recipe, strip) => {
    const station = $('cook-station');
    if (!station) return;
    $('recipes-daily').classList.add('hidden');
    $('recipe-list').classList.add('hidden');
    station.classList.remove('hidden');
    $('cook-dish').innerHTML =
      `<span class="cook-dish-emoji">${recipe.emoji}</span>` +
      `<span class="cook-dish-name">${recipe.name}</span>` +
      `<span class="cook-dish-real">the real one: ${recipe.realName}</span>`;
    $('cook-ings').innerHTML = (strip || recipe.needs.map(n => ({
      k: n.k, n: n.n, emoji: (WW.INGREDIENTS[n.k] || {}).emoji || '', name: (WW.INGREDIENTS[n.k] || {}).name || n.k, have: n.n,
    }))).map((it) =>
      `<span class="hud-chip hud-ing${it.have >= it.n ? ' done' : ''}">${it.emoji}<b>${Math.min(it.have, it.n)}/${it.n}</b></span>`).join('');
    $('cook-ings').classList.remove('hidden');
    $('cook-steps-list').innerHTML = recipe.real.map(s => `<li>${s}</li>`).join('');
    $('cook-tip').textContent = 'Tip: ' + recipe.fact;
    $('cook-steps').classList.remove('hidden');       // the method is read first
    $('cook-canvas').classList.add('hidden');
    $('cook-actions').classList.remove('hidden');
    $('cook-start').classList.remove('hidden');
    $('cook-abort').classList.remove('hidden');
    $('cook-done').classList.add('hidden');
    $('cook-help').classList.remove('hidden');
  };
  const cookStartUi = () => {
    $('cook-steps').classList.add('hidden');
    $('cook-start').classList.add('hidden');
    $('cook-canvas').classList.remove('hidden');
  };
  /* served on the same counter: the plate, its stars and pay, then the two
   * ways on. No modal, so the kitchen never leaves the page. */
  const showCooked = ({ recipe, stars, coins, gems, tool, daily, missing }) => {
    const station = $('cook-station');
    if (!station) return;
    $('recipes-daily').classList.add('hidden');
    $('recipe-list').classList.add('hidden');
    station.classList.remove('hidden');
    $('cook-canvas').classList.add('hidden');
    $('cook-ings').classList.add('hidden');
    $('cook-actions').classList.add('hidden');
    $('cook-help').classList.add('hidden');
    $('cook-done').classList.remove('hidden');
    /* the counter's own head already names the dish, so the result line does
     * not repeat it, matching the other "Dish Served!" result panel */
    $('cook-done-title').textContent = 'Dish Served!';
    $('cook-done-stars').textContent = `${'\u2605'.repeat(stars)}${'\u2606'.repeat(3 - stars)}`;
    $('cook-done-pay').innerHTML = `${IC.coin} +${coins}${gems ? ` <span class="rdot">\u00b7</span> ${IC.gem} +${gems}` : ''}`;
    const bits = [];
    if (tool) bits.push(`${tool.name} unlocked, the next recipe needs it!`);
    if (daily) bits.push('Special of the day: cooked double!');
    if (missing) bits.push(`${missing} ingredient${missing > 1 ? 's' : ''} ran out mid-cook.`);
    $('cook-done-note').textContent = bits.join(' ');
  };

  /* ---------------- Whimsical Kitchen (dedicated page) ----------------
   * Not a modal: a base page the menu opens into, with two tabs.
   *   Recipes     : dish list, tap a dish for its how-to + Cook It
   *   Ingredients : everything banked, gathered in runs or bought in the
   *                 Shop (a shortcut for Today's Special racers)
   * Tab state, the sliding butter pill and list-vs-detail state live
   * here; the game only re-renders with fresh save data. */
  let kitchenTab = 'recipes';
  function placeKitchenInd(snap) {
    const ind = document.querySelector('.kitchen-ind');
    const sel = document.querySelector('.kitchen-tab.sel');
    if (!ind || !sel || !sel.offsetParent) return;
    if (snap) ind.classList.add('snap-only');
    ind.style.width = sel.offsetWidth + 'px';
    ind.style.transform = `translateX(${sel.offsetLeft - ind.offsetLeft}px)`;
    if (snap) requestAnimationFrame(() => ind.classList.remove('snap-only'));
  }
  const setKitchenTab = (tab, snap) => {
    kitchenTab = tab;
    $('ktab-recipes')?.classList.toggle('sel', tab === 'recipes');
    $('ktab-ing')?.classList.toggle('sel', tab === 'ing');
    $('ktab-recipes')?.setAttribute('aria-selected', String(tab === 'recipes'));
    $('ktab-ing')?.setAttribute('aria-selected', String(tab === 'ing'));
    $('kitchen-view-recipes')?.classList.toggle('hidden', tab !== 'recipes');
    $('kitchen-view-ing')?.classList.toggle('hidden', tab !== 'ing');
    placeKitchenInd(snap);
  };

  const rrStatus = (recipe, data, locked) => {
    if (locked) return '<span class="rr-chip lock">Locked</span>';
    const entry = data.recipes[recipe.id];
    if (entry && entry.cooked) {
      const stars = Math.max(1, Math.min(3, entry.stars || 1));
      return `<span class="rr-chip stars">${'\u2605'.repeat(stars)}${'\u2606'.repeat(3 - stars)}</span>`;
    }
    return '<span class="rr-chip new">New</span>';
  };

  const renderRecipeList = (data) => {
    const daily = WW.dailySpecial();
    $('recipes-daily').innerHTML =
      `<span class="daily-chip" title="This dish pays double coins today">Today's Special: ${daily.emoji} ${daily.name}</span>`;
    $('recipes-daily').classList.remove('hidden');
    $('cook-station').classList.add('hidden');
    $('cook-done').classList.add('hidden');
    $('cook-ings').classList.remove('hidden');
    $('cook-actions').classList.remove('hidden');
    $('recipe-list').classList.remove('hidden');
    /* the dish shelf mirrors the story map: one card per recipe with the
     * dish, a one-line taste of it, what cooking pays and its own action,
     * so a dish is readable and startable without a trip to the detail */
    $('recipe-list').innerHTML = WW.RECIPES.map((recipe) => {
      const toolNeeded = WW.toolNeeded(recipe);
      const locked = !!toolNeeded && !data.tools.includes(toolNeeded.id);
      const entry = data.recipes[recipe.id];
      const cooked = !!(entry && entry.cooked);
      const dailyMark = daily.id === recipe.id ? '<span class="rr-chip daily">Pays Double</span>' : '';
      const cta = locked
        ? '<button class="btn btn-soft rc-cta" type="button" disabled>Locked</button>'
        : `<button class="btn btn-primary rc-cta" type="button" data-cook="${recipe.id}">${cooked ? 'Cook Again' : 'Cook It'}</button>`;
      return `<div class="recipe-card${locked ? ' locked' : ''}${cooked ? ' done' : ''}" data-id="${recipe.id}">` +
        `<span class="rc-emoji">${recipe.emoji}</span>` +
        `<b class="rc-name">${recipe.name}</b>` +
        `<span class="rc-status">${rrStatus(recipe, data, locked)}${dailyMark}</span>` +
        `<p class="rc-tagline">${recipe.tagline}</p>` +
        `<span class="rc-rewards">` +
          `<span class="story-reward-chip">${IC.coin}75</span>` +
          `<span class="rdot">·</span>` +
          `<span class="story-reward-chip">${IC.gem}1</span>` +
        `</span>` + cta +
        `</div>`;
    }).join('');
    /* a card is the door to the counter: tapping anywhere on it sets that
     * dish out with its method and the Start button, no in-between page */
    for (const card of $('recipe-list').querySelectorAll('.recipe-card')) {
      card.addEventListener('click', () => {
        WW.Audio.play('tick');
        onAction && onAction({ action: 'kitchen-cook', arg: card.dataset.id });
      });
    }
  };

  /* Ingredients tab: one row per ingredient kind, drawn with the game's
   * own counter art (never stock emojis), with what you have banked */
  const renderIngredients = (data) => {
    const kinds = [...new Set(WW.RECIPES.flatMap(r => r.needs).map(n => n.k))];
    /* the most of one ingredient any dish asks for: below that the pantry
     * cannot cover at least one dish, so the row offers a restock */
    const needOf = (k) => Math.max(0, ...WW.RECIPES.map(r => (r.needs.find(n => n.k === k) || {}).n || 0));
    $('ingredients-list').innerHTML = kinds.map((k) => {
      const def = WW.INGREDIENTS[k] || {};
      const have = data.pantry[k] || 0;
      const low = have < needOf(k);
      const item = WW.kitchenItem('ing-' + k);
      const price = item ? item.coins : 60;
      return `<div class="ing-row${have ? '' : ' empty'}${low ? ' low' : ''}" data-k="${k}">` +
        `<canvas class="ing-art" width="44" height="44" aria-hidden="true"></canvas>` +
        `<b>${def.name || k}</b>` +
        (have
          ? `<span class="ing-count">Have <b>${have}</b></span>`
          : `<span class="ing-count none">none yet, run a level or buy it</span>`) +
        (low
          ? `<button class="ing-restock" type="button" data-k="${k}" aria-label="Restock ${def.name || k} in the shop">` +
            `${IC.coin}<span>Restock</span><b>${price}</b></button>`
          : '') +
        `</div>`;
    }).join('');
    for (const cv of $('ingredients-list').querySelectorAll('.ing-art')) {
      const rowEl = cv.closest('.ing-row');
      if (!rowEl) continue;
      cv.getContext('2d').drawImage(WW.ingTex(rowEl.dataset.k).canvas, 0, 0, 44, 44);
    }
    /* the hint leads to the same Kitchen Shelf the Shop button opens, where
     * the one-tap buy already lives */
    for (const b of $('ingredients-list').querySelectorAll('.ing-restock')) {
      b.addEventListener('click', () => {
        WW.Audio.play('tick');
        onAction && onAction({ action: 'open-kitchen-shop' });
      });
    }
  };

  /* entry point used by the game: fresh save data in, list first */
  const renderRecipes = (data) => {
    renderRecipeList(data);
    renderIngredients(data);
    setKitchenTab(kitchenTab, true);
  };

  /* Ghee's Kitchen Shelf: buy with banked coins or gems */
  /* shelf selection mirrors the Spirits grid: tap a card, its button leads */
  let shelfTemp = null;
  const renderShelf = (data) => {
    const grid = $('shelf-grid');
    if (!grid) return;
    renderShopWallet(data.wallet.coins, data.wallet.gems);
    data.kitchen = data.kitchen || [];
    if (shelfTemp === null) {
      const first = WW.KITCHEN_ITEMS.find(i => !data.kitchen.includes(i.id) &&
        (i.gems ? data.wallet.gems >= i.gems : data.wallet.coins >= (i.coins || 0)));
      shelfTemp = (first || {}).id || null;
    }
    grid.innerHTML = WW.KITCHEN_ITEMS.map((item) => {
      /* ing-* rows never own out: they restock the pantry, buy any number */
      const ingK = item.ing || null;
      const owned = !ingK && data.kitchen.includes(item.id);
      const afford = !(item.gems ? data.wallet.gems < item.gems : data.wallet.coins < (item.coins || 0));
        /* price lives in the buy button only; the badge + wallet line are gone.
         * primary for whatever is selected, affordable or not */
      const tone = shelfTemp === item.id ? ' btn-primary' : ' btn-soft';
      return `<div class="shelf-item${owned ? ' owned' : ''}${shelfTemp === item.id ? ' sel' : ''}" data-id="${item.id}">` +
        `<span class="shelf-icon-slot" data-id="${item.id}">${ingK ? ingArt(ingK, 'ing-art', 40) : (IC.kitchen[item.id] || '')}</span>` +
        `<b>${item.name}</b>` +
        (ingK ? `<small class="shelf-pantry">In pantry: ${data.pantry[ingK] || 0}</small>` : '') +
        `<small>${item.blurb}</small>` +
        (owned ? '<span class="cc-badge owned">In your kitchen</span>' :
          `<button class="btn${tone} shelf-buy" data-id="${item.id}" ${
            afford ? '' : 'data-short="1"'
          }><span class="buy-label">Buy</span><span class="char-price">${item.gems ? IC.gem + fmtN(item.gems) : IC.coin + fmtN(item.coins)}</span></button>`) +
        `</div>`;
    }).join('');
    paintIngArt(grid);
    for (const b of grid.querySelectorAll('.shelf-buy')) {
      b.addEventListener('click', () => {
        WW.Audio.play('tick');
        /* unaffordable taps go through too: the game answers with the
         * exact coin or gem shortfall instead of a dead button */
        onAction && onAction({ action: 'shelf-buy', arg: b.dataset.id });
      });
    }
    for (const card of grid.querySelectorAll('.shelf-item')) {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.shelf-buy')) return;   /* the button acts, not selects */
        if (card.classList.contains('owned')) return; /* owned needs no buy intent */
        WW.Audio.play('tick');
        shelfTemp = card.dataset.id;
        renderShelf(data);
      });
    }
  };

  /* Sharing: the result owns a share ICON in the button row. Tapping it
   * opens a small destination menu (X, WhatsApp, Facebook, Instagram,
   * Copy), every chip carries the run's text along where the app allows */
  const SHARE_URL = 'https://whimsy-wick.start.ng';
  let shareText = '';
  const SHARE_ICONS = {
    x: (v) => `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.2" fill="#f3e4c6" stroke="#b8791f" stroke-width="1.8"/><path d="M8.2 8.2l7.6 7.6M15.8 8.2l-7.6 7.6" stroke="${v ? '#8a5a10' : '#b8791f'}" stroke-width="2.4" stroke-linecap="round"/></svg>`,
    whatsapp: () => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.7 12.2a7.5 7.5 0 1 1 2.8 5.9l-4.1 1.6 1.5-4A7.4 7.4 0 0 1 4.7 12.2Z" fill="#f3e4c6" stroke="#b8791f" stroke-width="1.8" stroke-linejoin="round"/><path d="M9.3 9.8c.6 1.6 1.7 2.9 3.2 3.8l1-1.1c.3-.4.9-.5 1.3-.2l1 .6" fill="none" stroke="#b8791f" stroke-width="1.5" stroke-linecap="round"/></svg>`,
    facebook: () => `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5.4" fill="#f3e4c6" stroke="#b8791f" stroke-width="1.8"/><path d="M13.9 19.5v-6.2h2.3l.5-2.8h-2.8V9.2c0-.9.4-1.5 1.6-1.5h1.2V5.3c-.6-.1-1.4-.2-2.2-.2-2.4 0-4 1.5-4 4.1v1.3H8.2v2.8h2.3v6.2" fill="none" stroke="${'#b8791f'}" stroke-width="1.9" stroke-linecap="round"/></svg>`,
    instagram: () => `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.4" y="3.4" width="17.2" height="17.2" rx="5.4" fill="#f3e4c6" stroke="#b8791f" stroke-width="1.8"/><circle cx="12" cy="12" r="3.9" fill="#ffd66b" stroke="#b8791f" stroke-width="1.7"/><circle cx="16.5" cy="7.7" r="1.15" fill="#b8791f"/></svg>`,
    copy: () => `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.2" y="4.2" width="11" height="11" rx="3.2" fill="#c7b8e8" stroke="#b8791f" stroke-width="1.6"/><rect x="8.8" y="8.8" width="11" height="11" rx="3.2" fill="#f3e4c6" stroke="#b8791f" stroke-width="1.8"/><path d="M12.6 12.4h3.4v3.4" fill="none" stroke="#b8791f" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  };
  const SHARE_TARGETS = [
    { id: 'whatsapp', label: 'WhatsApp' },
    { id: 'facebook', label: 'Facebook' },
    { id: 'instagram', label: 'Instagram' },
    { id: 'x', label: 'X' },
    { id: 'copy', label: 'Copy Text' },
  ];
  const renderShareMenu = () => {
    const grid = $('share-grid');
    if (!grid) return;
    grid.innerHTML = SHARE_TARGETS.map(t =>
      `<button class="share-chip" data-id="${t.id}">${SHARE_ICONS[t.id]()}<span>${t.label}</span></button>`).join('');
    for (const chip of grid.querySelectorAll('.share-chip')) {
      chip.addEventListener('click', () => {
        WW.Audio.play('tick');
        const id = chip.dataset.id;
        const blurb = `${shareText} ${SHARE_URL}`;
        const copyCaption = async () => {
          try { await navigator.clipboard.writeText(blurb); showToast('Copied! Paste it in the app.'); }
          catch { showToast('Copy is blocked here'); }
        };
        const open = (url) => window.open(url, '_blank', 'noopener,noreferrer');
        if (id === 'x') { open(`https://twitter.com/intent/tweet?${new URLSearchParams({ text: blurb })}`); }
        else if (id === 'whatsapp') { open(`https://wa.me/?text=${encodeURIComponent(blurb)}`); }
        else if (id === 'facebook') { open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SHARE_URL)}`); }
        else if (id === 'instagram') { copyCaption(); open('https://www.instagram.com/'); /* IG has no web share intent: caption is in the clipboard */ }
        else if (id === 'copy') { copyCaption(); }
        if (id !== 'copy') $('screen-share').classList.add('hidden');
      });
    }
  };
  const showShare = (text) => {
    shareText = text;
    const b = $('result-share');
    if (b) b.classList.remove('hidden');
  };
  const hideShare = () => { const b = $('result-share'); if (b) b.classList.add('hidden'); };

  /* Cook & Learn: ingredients brought home, drawn with the game's own
   * counter art (the same sprite the runner grabbed, never a stock emoji) */
  const ingArt = (k, cls, w = 30) => `<canvas class="${cls}" width="${w}" height="${w}" data-k="${k}" aria-hidden="true"></canvas>`;
  const paintIngArt = (root) => {
    for (const cv of root.querySelectorAll('canvas[data-k]')) {
      const tex = WW.ingTex && WW.ingTex(cv.dataset.k);
      if (tex) cv.getContext('2d').drawImage(tex.canvas, 0, 0, cv.width, cv.height);
    }
  };  /* the butter banner every result panel uses for gathered loot: the same
   * styling on wins and losses, chips of the exact sprites the run grabbed */
  const pantryBanner = (list) => {
    const chips = (list || [])
      .map(it => `<span class="collected-chip" title="${it.name}">${ingArt(it.k, 'collected-art')}<b>×${it.n}</b></span>`).join('');
    if (!chips) return '';
    return `<div class="tool-line pantry-nudge">🥣 Banked in the pantry, cook it in the Whimsical Kitchen!` +
      `<div class="pantry-chips">${chips}</div></div>`;
  };
  const showCollected = (list, who) => {
    const box = $('result-collected');
    const html = pantryBanner(list);
    box.classList.toggle('hidden', !html);
    box.innerHTML = '';
    if (html) { box.innerHTML = html; paintIngArt(box); }
  };

  const showResult = (kind, data) => {
    // kind: 'story-complete' | 'story-fail' | 'endless-over' | 'story-replay'
    cleanResultButtons();
    hideShare();
    $('result-settings')?.classList.remove('hidden');
    if (kind === 'endless-over') $('result-primary').setAttribute('aria-label', 'Run again');
    if (kind === 'endless-over') {
      $('result-title').textContent = data.newBest ? 'New Record!' : 'Run Over';
      /* one chip per stat: when a record was beaten the chip is labeled
       * with its record name ("Best score"), otherwise the plain stat */
      $('result-stats').innerHTML =
        stat(data.score, data.newBest ? 'Best score' : 'Score', data.newBest) +
        stat(data.dist + ' m', data.newBest ? 'Best distance' : 'Distance') +
        stat(data.timeStr, 'Time') +
        stat(`${IC.coin} +${data.coins}`, 'Coins') +
        (data.gems ? stat(`${IC.gem} +${data.gems}`, 'Gems') : '');
      showCollected(data.collected);
      $('result-primary').classList.add('hidden');
      showShare(`I scored ${data.score} in Whimsy Wick (distance ${data.dist} m)!`);
    } else if (kind === 'story-fail') {
      $('result-title').textContent = `${data.who || 'Ghee'} tumbled!`;
      showShare(`${data.who || 'Ghee'} just tumbled in Whimsy Wick! Come hop the counter yourself.`);
      $('result-stats').innerHTML =
        stat(`${IC.coin} +${data.coins || 0}`, 'Coins') +
        (data.gems ? stat(`${IC.gem} +${data.gems}`, 'Gems') : '');
      showCollected(data.collected);
      $('result-primary').classList.add('hidden');
    } else if (kind === 'kitchen-done') {
      /* a dish cooked straight from Ghee's Kitchen (no level rewards here) */
      $('result-title').textContent = 'Dish Served!';
      const dishLine = (data.dish)
        ? `<div class="dish-line"><span class="dish-emoji">${data.dish.emoji}</span>` +
          `<span class="dish-name">Cooked ${data.dish.name}</span>` +
          `<span class="dish-stars">${'★'.repeat(data.dish.stars)}${'☆'.repeat(3 - data.dish.stars)}</span>` +
          (data.dish.missing ? `<span class="dish-missing">${data.dish.missing} ingredient${data.dish.missing > 1 ? 's' : ''} ran out mid-cook</span>` : '') +
          `</div>` : '';
      const toolLine = (data.tool)
        ? `<div class="tool-line">${IC.kitchen[data.tool.id] || ''} ${data.tool.name} unlocked, the next recipe needs it!</div>` : '';
      const dailyLine = data.daily
        ? `<div class="daily-line">Special of the day: cooked double!</div>` : '';
      $('result-dish').innerHTML = dishLine + toolLine + dailyLine;
      $('result-dish').classList.toggle('hidden', !(dishLine || toolLine || dailyLine));
      $('result-stats').innerHTML =
        stat(`${IC.coin} +${data.coins || 0}`, 'Cook pays:') +
        (data.gems ? stat(`${IC.gem} +${data.gems}`, 'Gems') : '');
      showCollected([]);
      $('result-primary').classList.add('hidden');
      $('result-replay').classList.add('hidden');
      showShare(data.dish
        ? `I just cooked ${data.dish.name} ${'★'.repeat(data.dish.stars)} in Whimsy Wick's kitchen!`
        : `Dish served in Whimsy Wick's kitchen!`);
    } else {
      data.coins = data.coins || 0; data.gems = data.gems || 0;
      $('result-title').textContent = data.last ? 'All Wicks Lit!' : 'Wick Lit!';
      const rewardCoins = data.rewardCoins || 0, rewardGems = data.rewardGems || 0;
      /* Cook & Learn: the dish line + tool unlock + daily banner */
      const dishLine = (data.dish)
        ? `<div class="dish-line"><span class="dish-emoji">${data.dish.emoji}</span>` +
          `<span class="dish-name">Cooked ${data.dish.name}</span>` +
          `<span class="dish-stars">${'★'.repeat(data.dish.stars)}${'☆'.repeat(3 - data.dish.stars)}</span>` +
          (data.dish.missing ? `<span class="dish-missing">${data.dish.missing} ingredient${data.dish.missing > 1 ? 's' : ''} stayed on the shelf</span>` : '') +
          `</div>` : '';
      const toolLine = (data.tool)
        ? `<div class="tool-line">${IC.kitchen[data.tool.id] || ''} ${data.tool.name} unlocked - the next recipe needs it!</div>` : '';
      const dailyLine = data.daily
        ? `<div class="daily-line">Special of the day: cooked double!</div>` : '';
      /* runs never auto-cook: the gathered bits went to the pantry, and the
       * butter banner carries the chips itself, built by the shared helper */
      const pantryLine = data.pantrip ? pantryBanner(data.collected) : '';
      $('result-dish').innerHTML = dishLine + pantryLine + toolLine + dailyLine;
      paintIngArt($('result-dish'));
      $('result-dish').classList.toggle('hidden', !(dishLine || pantryLine || toolLine || dailyLine));
      $('result-stats').innerHTML =
        stat(`${IC.coin} ${(data.coins || 0) + rewardCoins}`, 'Coins') +
        stat(`${IC.gem} ${rewardGems + (data.gemsPicked || 0)}`, 'Gems');
      showCollected([]);
      if (data.last) {
        $('result-primary').classList.add('hidden');
        showShare('All wicks lit!' + (data.dish ? ` Just cooked ${data.dish.name} ${'★'.repeat(data.dish.stars)} too.` : ''));
      } else {
        $('result-primary').classList.remove('hidden');
        showShare(data.dish
          ? `I just cooked ${data.dish.name} ${'★'.repeat(data.dish.stars)} in Whimsy Wick's kitchen run!`
          : `Wick lit! I gathered ${(data.coins || 0) + (data.rewardCoins || 0)} coins in Whimsy Wick.`);
      }
    }
    show('result');
  };

  /* Kitchen Shelf tab: same modal, second grid (bound in init).
   * The butter pill (.shop-ind) slides under the selected tab so switching
   * reads as the button itself moving across, not two spots repainting. */
  const placeShopInd = (snap) => {
    const ind = document.querySelector('.shop-ind');
    const btn = document.querySelector('.shop-tab.sel');
    if (!ind || !btn || !btn.offsetParent) return;
    if (snap) ind.classList.add('snap-only');
    ind.style.width = btn.offsetWidth + 'px';
    ind.style.transform = `translateX(${btn.offsetLeft - ind.offsetLeft}px)`;
    if (snap) requestAnimationFrame(() => ind.classList.remove('snap-only'));
  };
  /* modal frame: one constant height for both tabs. The body is sized to
   * the shelf list's natural height, the taller spirits list scrolls
   * inside the same frame, so the bottom padding reads like every
   * other modal's on both tabs instead of a dead cream band */
  const fitShopBody = () => {
    const body = document.querySelector('.shop-body');
    if (!body || !body.offsetHeight) return;           /* hidden modal: CSS default */
    const chars = $('char-grid'), shelf = $('shelf-grid');
    const onSpirits = shelf.classList.contains('hidden');
    if (onSpirits) { chars.style.display = 'none'; shelf.classList.remove('hidden'); }
    const nat = body.scrollHeight;
    if (onSpirits) { shelf.classList.add('hidden'); chars.style.display = ''; }
    body.style.height = Math.min(nat, Math.round(window.innerHeight * 0.86)) + 'px';
  };
  const setShopTab = (shelf, snap) => {
    $('tab-spirits').classList.toggle('sel', !shelf);
    $('tab-shelf').classList.toggle('sel', shelf);
    $('char-grid').classList.toggle('hidden', shelf);
    $('shelf-grid').classList.toggle('hidden', !shelf);
    placeShopInd(snap);
    fitShopBody();
  };

  /* ---------------- binding ---------------- */
  /* How-to "Watch out" strip: the real in-game obstacle art */
  const paintHowtoHazards = () => {
    const box = $('howto-hazards');
    if (!box) return;
    box.innerHTML = '';
    const SPILL = [40, 4, 120, 42];           // wide puddles: show their middle
    for (const [key, label, crop] of [['hz-flour', 'Flour'], ['hz-pin', 'Rolling pin'], ['hz-butter', 'Butter', SPILL],
      ['hz-milk', 'Milk', SPILL], ['hz-jamdrop', 'Jam'], ['hz-fan-blades', 'Fan']]) {
      const src = WW.tex(key, 1, 1, () => {}).canvas;
      const [sx, sy, sw, sh] = crop || [0, 0, src.width, src.height];
      const cv = document.createElement('canvas');
      cv.width = 56; cv.height = 40;
      cv.title = label; cv.setAttribute('aria-label', label); cv.setAttribute('role', 'img');
      const k = Math.min(52 / sw, 36 / sh);
      const dw = sw * k, dh = sh * k;
      cv.getContext('2d').drawImage(src, sx, sy, sw, sh, (56 - dw) / 2, 38 - dh, dw, dh);
      box.appendChild(cv);
    }
  };

  const init = (actions) => {
    onAction = (a) => actions[a.action] && actions[a.action](a.arg);
    audio = WW.Audio;
    paintHero();
    paintTitleScene();
    paintTitleDeco();
    paintHowtoHazards();

    btn('btn-story', 'open-story');
    btn('btn-fragments', 'open-fragments');
    btn('frag-back', 'close-fragments');
    btn('btn-endless', 'start-endless');      btn('btn-chars', 'open-chars');
      btn('btn-recipes', 'open-recipes');
      btn('btn-howto', 'open-howto-title');
    btn('btn-settings', 'open-settings-title');
    btn('title-stats', 'open-records');
    /* Title pointer services: CSS-var parallax on the backdrop + deco chips
     * (transitioned, disabled under reduced motion), and cursor coordinates
     * feeding the flock's sky interactions in paintHero. */
    const title = $('screen-title');
    let plxRaf = 0, plxPx = 0, plxPy = 0;
    window.addEventListener('pointermove', (e) => {
      const r = title.getBoundingClientRect();
      ptr.x = e.clientX - r.left;
      ptr.y = e.clientY - r.top;
      plxPx = Math.max(-1, Math.min(1, ((e.clientX / r.width) - 0.5) * 2));
      plxPy = Math.max(-1, Math.min(1, ((e.clientY / r.height) - 0.5) * 2));
      if (!plxRaf) plxRaf = requestAnimationFrame(() => {
        plxRaf = 0;
        if (!document.body.classList.contains('rm')) {
          title.style.setProperty('--plx', plxPx.toFixed(3));
          title.style.setProperty('--ply', plxPy.toFixed(3));
        }
      });
    });
    window.addEventListener('pointerout', (e) => {
      if (e.relatedTarget) return;                 // only a real leave
      ptr.x = -999; ptr.y = -999;
      title.style.removeProperty('--plx');
      title.style.removeProperty('--ply');
    });
    /* Kitchen Shelf tab: same modal, second grid (snap=false → the pill slides) */
    setShopTab(false, true);
    window.addEventListener('resize', () => { placeShopInd(true); fitShopBody(); placeKitchenInd(true); paintTitleScene(); });
    /* Whimsical Kitchen page tabs + its Shop shortcut */
    $('ktab-recipes')?.addEventListener('click', () => { WW.Audio.play('tick'); setKitchenTab('recipes'); });
    $('ktab-ing')?.addEventListener('click', () => { WW.Audio.play('tick'); setKitchenTab('ing'); });
    $('kitchen-shop')?.addEventListener('click', () => { WW.Audio.play('tick'); onAction({ action: 'open-kitchen-shop' }); });
    $('tab-spirits').addEventListener('click', () => { WW.Audio.play('tick'); setShopTab(false); });
    $('tab-shelf').addEventListener('click', () => {
      WW.Audio.play('tick'); setShopTab(true);
      onAction && onAction({ action: 'open-shelf' });
    });
    btn('pause-resume', 'resume');
    btn('pause-restart', 'restart');
    btn('cook-abort', 'cook-abort');
    btn('cook-start', 'kitchen-cook-start');
    btn('cook-next', 'kitchen-cook-next');
    btn('cook-back', 'kitchen-back-dishes');
    /* the little ? on the counter: re-read the method any time */
    $('cook-help')?.addEventListener('click', () => {
      WW.Audio.play('tick');
      $('cook-steps').classList.toggle('hidden');
    });
    btn('revive-yes', 'revive-accept');
    btn('revive-no', 'revive-decline');
    btn('storypart-go', 'story-part-continue');
    btn('pause-howto', 'open-howto-pause');
    btn('pause-settings', 'open-settings-pause');
    btn('pause-menu', 'back-title');
    /* share ICON row: tap opens the destination menu built above */
    const shareBtn = $('result-share');
    if (shareBtn) shareBtn.addEventListener('click', () => {
      WW.Audio.play('tick');
      renderShareMenu();
      show('share');
    });
    const shareClose = document.querySelector('#screen-share .x-btn');
    if (shareClose) shareClose.addEventListener('click', () => $('screen-share').classList.add('hidden'));
    btn('result-primary', 'result-primary');
    btn('result-replay', 'result-replay');
    btn('result-settings', 'open-settings-result');
    btn('result-menu', 'back-title');
    btn('ending-menu', 'back-title');
    btn('set-replay-tutorial', 'replay-tutorial');
    btn('set-reset', 'reset-progress');
    btn('hint-dismiss', 'dismiss-gesture-hint');
    $('btn-pause').addEventListener('click', () => { WW.Audio.play('tick'); onAction({ action: 'pause' }); });
    $('signin-go').addEventListener('click', () => { WW.Audio.play('tick'); onAction({ action: 'signin-go' }); });
    $('player-sign-in').addEventListener('click', () => { WW.Audio.play('tick'); onAction({ action: 'signin-go' }); });

    // X buttons on every modal; clicking the backdrop outside a modal does
    // the same as its X
    for (const b of document.querySelectorAll('.x-btn[data-close]')) {
      const target = b.getAttribute('data-close');
      const close = () => {
        WW.Audio.play('tick');
        onAction({ action: 'ui-close', arg: target });
      };
      b.addEventListener('click', close);
      const screen = b.closest('.screen');
      /* backdrop-click-to-close is modal behaviour; full pages like the
       * kitchen and the story map must not exit on taps in empty space */
      if (screen && !screen.matches('.kitchen-page, .story-page')) screen.addEventListener('click', (e) => { if (e.target === screen) close(); });
    }

    // settings inputs
    const bindRange = (id, valId, key) => {
      const r = $(id);
      r.addEventListener('input', () => {
        const v = +r.value;
        $(valId).textContent = v;
        audio.set(key, v / 100);
        onAction({ action: 'set-setting', arg: { [key]: v / 100 } });
      });
    };
    bindRange('set-music', 'set-music-val', 'music');
    bindRange('set-sfx', 'set-sfx-val', 'sfx');
    for (const [id, key] of [['set-mute', 'mute'], ['set-gestures', 'gestureHints'], ['set-rm', 'reducedMotion']]) {
      $(id).addEventListener('change', (e) => {
        onAction({ action: 'set-setting', arg: { [key]: e.target.checked } });
      });
    }
  };

  return {
    init, show, showNone, setHUD, hud, setShopTab, snapShopInd: () => placeShopInd(true),
    setStatsSource(fn) { statsSource = fn; renderTitleStats(); },
    renderRecords,
    renderStory, renderFragments, renderChars, renderShelf, renderRecipes, showCooking, cookStartUi, showCooked, setKitchenTab,
    /* the pantry rows alone, for a purchase made while the shop is open */
    renderPantry: (data) => renderIngredients(data),
    flashWallet,
    renderSettings, renderProfile,
    setTutorial, setTutorialText, hideTutorial,
    showGestureHint, showToast, showResult, lockCharsTemp: () => charTemp,
    showRevive, reviveCountdown, hideRevive,
    showStoryPart, hideStoryPart,
    set charsTemp(v) { charTemp = v; },
    get charsTemp() { return charTemp; },
    reshowRenderer() { /* screens hidden; canvas visible */ },
    stopHero: () => { if (heroRaf) { cancelAnimationFrame(heroRaf); heroRaf = null; } },
    startHero: () => { if (!heroRaf) paintHero(); },
  };
})();
})();