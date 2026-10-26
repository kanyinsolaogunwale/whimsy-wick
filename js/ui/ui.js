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
const TOOL_NAMES = { pantry: 'Pantry', pan: 'Trusty Pan', pin: 'Rolling Pin', whisk: 'Whisk', pot: 'Pot', wick: 'Golden Wick', jar: 'Sprinkle Jar' };

WW.UI = (() => {
  let audio = null, onAction = null, busy = false;
  const SCREENS = ['title', 'story', 'chars', 'howto', 'records', 'settings', 'signin', 'pause', 'result', 'ending', 'recipes', 'cooking', 'share'];
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
    /* drifting patches (x, y as viewport fractions). Compact keeps the
     * whole flock in the upper strip so the floating collectible chips
     * below it (title-deco, ~34% and down) never cover them. */
    const anchors = compact
      ? [[0.10, 0.16], [0.29, 0.22], [0.50, 0.14], [0.71, 0.22], [0.90, 0.16]]
      : [[0.30, 0.17], [0.33, 0.50], [0.50, 0.15], [0.70, 0.31], [0.70, 0.55]];
    const k = compact
      ? Math.max(0.6, Math.min(W * 0.12, (H * 0.15) / 80))
      : Math.max(0.8, Math.min(W * 0.06, (H * 0.13) / 80));
    const chars = WW.CHARACTERS;

    for (let i = 0; i < 5; i++) {
      const ch = chars[i] || chars[0];
      /* each patch wanders on a slow orbit with its own phase, bobbing on
       * a faster rhythm so the flock never looks locked together */
      const fx = anchors[i][0] + Math.sin(t * 0.11 + i * 2.1) * (compact ? 0.04 : 0.05);
      const fy = anchors[i][1] + Math.sin(t * 0.55 + i * 1.3) * 0.035;
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
    if (mode === 'story') {
      $('hud-gems').classList.remove('hidden');
      $('hud-coins').classList.remove('hidden');
      $('hud-ingredients').classList.remove('hidden');
    }
    if (mode === 'endless') {
      $('hud-score').classList.remove('hidden');
      $('hud-dist').classList.remove('hidden');
      $('hud-coins').classList.remove('hidden');
      $('hud-gems').classList.remove('hidden');
    }
  };
  /* Continue-after-crash offer: gem cost, owned count, afford state */
  const showRevive = ({ cost, gems, shield }) => {
    const yes = $('revive-yes');
    const ok = gems >= cost;
    $('revive-sub').innerHTML = ok
      ? `Ghee took the tumble. Spend gems to hop right back in${shield ? ', ' + shield + 's of get-out-of-jail free' : ''}.`
      : `Ghee took the tumble, but you don't have enough gems to revive: ${IC.gem}${fmtN(cost)} needed, ${IC.gem}${fmtN(gems)} banked.`;
    $('revive-cost').innerHTML = ok ? `${IC.gem}${fmtN(cost)}` : `${IC.gem}${fmtN(cost - gems)} more`;
    $('revive-count').textContent = '';
    yes.classList.toggle('disabled-cta', !ok);
    yes.disabled = !ok;
    $('revive-no').textContent = ok ? 'No thanks' : 'End the run';
    $('revive-overlay').classList.remove('hidden');
  };
  const reviveCountdown = (secs) => { const el = $('revive-count'); if (el) el.textContent = secs + 's'; };
  const hideRevive = () => { $('revive-overlay').classList.add('hidden'); };

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
    show(set) { if (set && hudCtx) $('hud').classList.remove('hidden'); else $('hud').classList.add('hidden'); },
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
  const renderStory = (levels, progress, sparks) => {
    progressIds = progress || [];
    const grid = $('story-grid');
    const detail = $('story-detail');
    grid.innerHTML = '';
    levels.forEach((L, i) => {
      const locked = i > 0 && !progress.includes(levels[i - 1].id);
      const done = progress.includes(L.id);
      const b = document.createElement('button');
      b.className = 'story-tile' + (done ? ' done' : '') + (locked ? ' locked' : '');
      b.textContent = String(i + 1);
      b.setAttribute('aria-label', (locked ? 'Locked: ' : '') + L.name);
      b.__act = locked ? 'noop' : 'select-story';
      b.__arg = i;
      b.addEventListener('click', guard);
      grid.appendChild(b);
    });
    // preselect the first unlocked-but-not-done level
    const pick = levels.findIndex((L, i) => !progress.includes(L.id) && (i === 0 || progress.includes(levels[i - 1].id)));
    selectStory(pick < 0 ? levels.length - 1 : pick);
  };
  const selectStory = (i) => {
    const detail = $('story-detail');
    const L = WW.STORY_LEVELS[i];
    const done = progressIds.includes(L.id);
    const rew = STORY_REWARDS[i] || STORY_REWARDS[STORY_REWARDS.length - 1];
    const recipe = WW.recipeForLevel ? WW.recipeForLevel(i) : null;
    const tiles = $('story-grid').querySelectorAll('.story-tile');
    tiles.forEach((t, k) => t.classList.toggle('sel', k === i));
    const daily = WW.dailySpecial ? WW.dailySpecial() : null;
    detail.innerHTML = `
      <div class="sd-name">${L.name}</div>
      <div class="sd-recipe">${recipe ? `Cook-along: ${recipe.emoji} ${recipe.name}` : ''}${daily && recipe && daily.id === recipe.id ? '<span class="sd-daily">daily ×2</span>' : ''}</div>
      <div class="sd-note">${L.note}</div>
      <div class="story-reward-chip sd-reward">${IC.coin} ${done ? rew.coins + ' coins again' : rew.coins + ' coins'} &nbsp;·&nbsp; ${IC.gem} ${rew.gems} gems${recipe ? ` &nbsp;·&nbsp; cooks ${recipe.realName}` : ''}</div>
      <button class="btn btn-primary btn-play" id="story-play">Play level ${i + 1}</button>`;
    const playBtn = $('story-play');
    playBtn.__act = 'play-level';
    playBtn.__arg = i;
    playBtn.addEventListener('click', guard);
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
    return `<button class="btn${tone} char-buy" data-id="${ch.id}"${pay.ok ? '' : ' disabled'}><span class="buy-label">Buy</span><span class="char-price">${price}</span></button>`;
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
  const showCooking = (recipe, strip) => {
    $('cook-overlay').classList.remove('hidden');
    $('cook-dish').innerHTML =
      `<span class="cook-dish-emoji">${recipe.emoji}</span>` +
      `<span class="cook-dish-name">${recipe.name}</span>` +
      `<span class="cook-dish-real">the real one: ${recipe.realName}</span>`;
    $('cook-ings').innerHTML = (strip || recipe.needs.map(n => ({
      k: n.k, n: n.n, emoji: (WW.INGREDIENTS[n.k] || {}).emoji || '', name: (WW.INGREDIENTS[n.k] || {}).name || n.k, have: n.n,
    }))).map((it) =>
      `<span class="hud-chip hud-ing${it.have >= it.n ? ' done' : ''}">${it.emoji}<b>${Math.min(it.have, it.n)}/${it.n}</b></span>`).join('');
    show('cooking');
  };

  const recipeCard = (recipe, entry, locked, toolNeeded, canCook) => {
    /* cooked/locked status notes dropped: the golden card background and the
     * lock line say enough; no prose under the title */
    const cooked = !!(entry && entry.cooked);
    const ink = recipe.needs.map(n =>
      `<span class="rs-ing">${(WW.INGREDIENTS[n.k] || {}).emoji || ''} ×${n.n}</span>`).join('');
    const steps = recipe.real.map((s, i) => `<li>${s}</li>`).join('');
    const head = locked
      ? `<div class="rc-lock">Needs ${IC.kitchen[toolNeeded.id] || ''} ${toolNeeded.name} from the level before.</div>`
      : '';
    return `<article class="recipe-card${locked ? ' locked' : ''}${cooked ? ' cooked' : ''}">` +
      `<div class="rc-title"><span class="rc-emoji">${recipe.emoji}</span><b>${recipe.name}</b></div>` +
      head +
      `<div class="rc-ing">${ink}</div>` +
      `<ol class="rc-steps">${steps}</ol>` +
      `<div class="rc-fact">Tip: ${recipe.fact}</div>` +
      /* reward chips all on one line: the amount, the gem, and the tool
       * it unlocks, without the fluff */
      (locked ? '' : `<div class="rc-reward rc-pays"><span class="rp-label">Cook pays:</span>` +
        `<span class="rp-chip">${IC.coin}75</span>` +
        `<span class="rp-chip">${IC.gem}1</span>` +
        (recipe.tool ? `<span class="rp-chip rp-tool">${IC.kitchen[recipe.tool.id] || ''}${TOOL_NAMES[recipe.tool.id] || recipe.tool.name}</span>` : '') +
        `</div>` +
        `<button class="btn btn-primary rc-cook" data-id="${recipe.id}">${canCook ? 'Cook it now' : 'Cook it (pantry short)'}</button>`) +
      `</article>`;
  };

  /* the Kitchen: pantry strip above the recipe cards; each card IS the
   * how-to (ingredients, real steps, tip) with its own Cook button */
  const renderRecipes = (data) => {
    data.recipes = data.recipes || {};
    data.tools = data.tools || [];
    data.pantry = data.pantry || {};
    const pantryBox = $('kitchen-pantry');
    if (pantryBox) {
      /* the strip ALWAYS shows: one chip per ingredient kind the recipes
       * use, owned kinds first. Zero-count chips stay visible (dimmed) so
       * players always know what they have and what is missing */
      const kinds = [...new Set(WW.RECIPES.flatMap(r => r.needs).map(n => n.k))]
        .sort((a, b) => (data.pantry[b] || 0) - (data.pantry[a] || 0));
      pantryBox.classList.remove('hidden');
      pantryBox.innerHTML =
        `<span class="kp-label">Ingredients</span>` +
        kinds.map(k => { const have = data.pantry[k] || 0;
          return `<span class="kp-chip${have ? '' : ' zero'}" title="${(WW.INGREDIENTS[k] || {}).name || k}">${(WW.INGREDIENTS[k] || {}).emoji || ''}<b>${have}</b></span>`; }).join('');
    }
    $('recipes-grid').innerHTML = WW.RECIPES.map((recipe, i) => {
      const toolNeeded = WW.toolNeeded(recipe);
      const locked = !!toolNeeded && !data.tools.includes(toolNeeded.id);
      const canCook = !locked && recipe.needs.every(n => (data.pantry[n.k] || 0) >= n.n);
      return recipeCard(recipe, data.recipes[recipe.id], locked, toolNeeded || {}, canCook);
    }).join('');
    for (const b of document.querySelectorAll('.rc-cook')) {
      b.addEventListener('click', () => {
        WW.Audio.play('tick');
        onAction && onAction({ action: 'kitchen-cook', arg: b.dataset.id });
      });
    }
    const daily = WW.dailySpecial();
    $('recipes-daily').innerHTML =
      `<span class="daily-chip" title="Today's dish cooks for double">Today's special: ${daily.emoji} ${daily.name}${data.dailyCooked === new Date().toISOString().slice(0, 10) ? ' (already doubled today)' : ', pays double today!'}</span>`;
  };

  /* Ghee's Kitchen Shelf: buy with banked coins or gems */
  /* shelf selection mirrors the Spirits grid: tap a card, its button leads */
  let shelfTemp = null;
  const renderShelf = (data) => {
    const grid = $('shelf-grid');
    if (!grid) return;
    data.kitchen = data.kitchen || [];
    if (shelfTemp === null) {
      const first = WW.KITCHEN_ITEMS.find(i => !data.kitchen.includes(i.id) &&
        (i.gems ? data.wallet.gems >= i.gems : data.wallet.coins >= (i.coins || 0)));
      shelfTemp = (first || {}).id || null;
    }
    grid.innerHTML = WW.KITCHEN_ITEMS.map((item) => {
      const owned = data.kitchen.includes(item.id);
      const afford = !(item.gems ? data.wallet.gems < item.gems : data.wallet.coins < (item.coins || 0));
        /* price lives in the buy button only; the badge + wallet line are gone.
         * primary for whatever is selected, affordable or not */
      const tone = shelfTemp === item.id ? ' btn-primary' : ' btn-soft';
      return `<div class="shelf-item${owned ? ' owned' : ''}${shelfTemp === item.id ? ' sel' : ''}" data-id="${item.id}">` +
        `<span class="shelf-icon-slot" data-id="${item.id}">${IC.kitchen[item.id] || ''}</span>` +
        `<b>${item.name}</b><small>${item.blurb}</small>` +
        (owned ? '<span class="cc-badge owned">In your kitchen</span>' :
          `<button class="btn${tone} shelf-buy" data-id="${item.id}" ${
            afford ? '' : 'data-short="1"'
          }><span class="buy-label">Buy</span><span class="char-price">${item.gems ? IC.gem + fmtN(item.gems) : IC.coin + fmtN(item.coins)}</span></button>`) +
        `</div>`;
    }).join('');
    for (const b of grid.querySelectorAll('.shelf-buy')) {
      b.addEventListener('click', () => {
        WW.Audio.play('tick');
        if (b.dataset.short) { showToast('Not banked enough yet!'); return; }
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
    { id: 'copy', label: 'Copy text' },
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

  /* Cook & Learn: “Ghee gathered”, one chip per ingredient brought home */
  const showCollected = (list) => {
    const box = $('result-collected');
    const items = list || [];
    if (!items.length) { box.innerHTML = ''; box.classList.add('hidden'); return; }
    box.innerHTML =
      `<span class="collected-label">Ghee gathered</span>` +
      items.map(it => `<span class="collected-chip" title="${it.name}">${it.emoji}<b>×${it.n}</b></span>`).join('');
    box.classList.remove('hidden');
  };

  const showResult = (kind, data) => {
    // kind: 'story-complete' | 'story-fail' | 'endless-over' | 'story-replay'
    cleanResultButtons();
    hideShare();
    $('result-settings')?.classList.remove('hidden');
    if (kind === 'endless-over') $('result-primary').setAttribute('aria-label', 'Run again');
    if (kind === 'endless-over') {
      $('result-title').textContent = data.newBest ? 'New record!' : 'Run over';
      /* one chip per stat: when a record was beaten the chip is labeled
       * with its record name ("Best score"), otherwise the plain stat */
      $('result-stats').innerHTML =
        stat(data.score, data.newBest ? 'Best score' : 'Score', data.newBest) +
        stat(data.dist + ' m', data.newBest ? 'Best distance' : 'Distance') +
        stat(data.timeStr, 'Time') +
        stat(`${IC.coin} +${data.coins}`) +
        (data.gems ? stat(`${IC.gem} +${data.gems}`) : '');
      showCollected([]);
      $('result-primary').classList.add('hidden');
      showShare(`I scored ${data.score} in Whimsy Wick (distance ${data.dist} m)!`);
    } else if (kind === 'story-fail') {
      $('result-title').textContent = 'Ghee tumbled!';
      showShare('Ghee just tumbled in Whimsy Wick! Come hop the counter yourself.');
      $('result-stats').innerHTML =
        stat(`${IC.coin} +${data.coins || 0}`) +
        (data.gems ? stat(`${IC.gem} +${data.gems}`) : '');
      showCollected(data.collected);
      $('result-primary').classList.add('hidden');
    } else if (kind === 'kitchen-done') {
      /* a dish cooked straight from Ghee's Kitchen (no level rewards here) */
      $('result-title').textContent = 'Dish served!';
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
      $('result-title').textContent = data.last ? 'All wicks lit!' : 'Wick lit!';
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
       * banner (in the game's butter palette) carries the chips itself */
      const gathers = (data.collected || [])
        .map(it => `<span class="collected-chip" title="${it.name}">${it.emoji}<b>×${it.n}</b></span>`).join('');
      const pantryLine = data.pantrip
        ? `<div class="tool-line pantry-nudge">🥣 Banked in the pantry, cook it in the Whimsical Kitchen!` +
          (gathers ? `<div class="pantry-chips">${gathers}</div>` : '') +
          `</div>` : '';
      $('result-dish').innerHTML = dishLine + pantryLine + toolLine + dailyLine;
      $('result-dish').classList.toggle('hidden', !(dishLine || pantryLine || toolLine || dailyLine));
      $('result-stats').innerHTML =
        stat(`${IC.coin} ${(data.coins || 0) + rewardCoins}`) +
        stat(`${IC.gem} ${rewardGems + (data.gemsPicked || 0)}`);
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
    window.addEventListener('resize', () => { placeShopInd(true); fitShopBody(); paintTitleScene(); });
    $('tab-spirits').addEventListener('click', () => { WW.Audio.play('tick'); setShopTab(false); });
    $('tab-shelf').addEventListener('click', () => {
      WW.Audio.play('tick'); setShopTab(true);
      onAction && onAction({ action: 'open-shelf' });
    });
    btn('pause-resume', 'resume');
    btn('pause-restart', 'restart');
    btn('cook-abort', 'cook-abort');
    btn('revive-yes', 'revive-accept');
    btn('revive-no', 'revive-decline');
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
      if (screen) screen.addEventListener('click', (e) => { if (e.target === screen) close(); });
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
    renderStory, selectStory, renderChars, renderShelf, renderRecipes, showCooking,
    renderSettings, renderProfile,
    setTutorial, setTutorialText, hideTutorial,
    showGestureHint, showToast, showResult, lockCharsTemp: () => charTemp,
    showRevive, reviveCountdown, hideRevive,
    set charsTemp(v) { charTemp = v; },
    get charsTemp() { return charTemp; },
    reshowRenderer() { /* screens hidden; canvas visible */ },
    stopHero: () => { if (heroRaf) { cancelAnimationFrame(heroRaf); heroRaf = null; } },
    startHero: () => { if (!heroRaf) paintHero(); },
  };
})();
})();