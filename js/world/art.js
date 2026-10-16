/**
 * Whimsy Wick — js/world/art.js
 * ---------------------------------------------------------------
 * All in-world art is drawn to canvas, then used as CanvasTextures on
 * THREE.Mesh planes. Everything procedural (assignment §14 licensing) and
 * pastel storybook (§7).
 *
 * §1  Tileable background strips (wall, shelf line, counters, window…)
 * §2  Character sprite painter — live redraw per animation state
 * §3  Hazard sprites + ground decals (butter/milk/jam puddles)
 * §4  Collectibles (magic spark, star gem) and the goal lantern
 * §5  Kitchen props (jars, bags, utensils) + end-scene vignette
 */
(() => {
'use strict';
const WW = window.WW;
const P = WW.PALETTE;
const { rr, fillText } = WW;

/* ================================================================
 * §1  Background / parallax strips (assignment §7.2)
 * ================================================================ */

/** Soft night window with stars; tileable horizontally (w=repeat). */
WW.tex('bg-window', 480, 420, (c, w, h) => {
  c.fillStyle = P.lavender; rr(c, 20, 20, w - 40, h - 24, 26); c.fill();
  c.fillStyle = '#241f38';
  rr(c, 34, 34, w - 68, h - 52, 18); c.fill();
  // night sky gradient inside
  const sky = c.createLinearGradient(0, 34, 0, h - 18);
  sky.addColorStop(0, '#33295a'); sky.addColorStop(0.7, '#4a3a72'); sky.addColorStop(1, '#6a4f86');
  c.fillStyle = sky; rr(c, 40, 40, w - 80, h - 64, 14); c.fill();
  // crescent moon
  c.fillStyle = '#fff3c4';
  c.beginPath(); c.arc(w - 120, 110, 34, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#33295a';
  c.beginPath(); c.arc(w - 134, 98, 30, 0, Math.PI * 2); c.fill();
  // stars (static; twinkle handled by engine overlay only when motion allowed)
  c.fillStyle = '#fff8e0';
  const R = WW.rng(7);
  for (let i = 0; i < 26; i++) {
    const x = 50 + R() * (w - 100), y = 52 + R() * (h - 140), s = R() < .3 ? 4 : 2.4;
    c.globalAlpha = .5 + R() * .5;
    c.fillRect(x, y, s, s);
  }
  c.globalAlpha = 1;
  // window cross
  c.fillStyle = P.lavender;
  c.fillRect(w / 2 - 7, 34, 14, h - 58);
  c.fillRect(34, h / 2 - 2, w - 68, 14);
});

/** Cupboard/back-splash panel strip. w tiles horizontally. */
WW.tex('bg-wall', 640, 560, (c, w, h) => {
  c.fillStyle = '#f3e2cd'; c.fillRect(0, 0, w, h);
  // faint tile grid
  c.strokeStyle = 'rgba(214,186,150,.35)'; c.lineWidth = 2;
  for (let y = 0; y < h; y += 80) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  for (let x = 0; x <= w; x += 80) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
  // big cupboard
  c.fillStyle = P.wood; rr(c, 40, 60, 300, 400, 22); c.fill();
  c.fillStyle = P.woodDark; rr(c, 46, 66, 288, 388, 18); c.fill();
  c.fillStyle = '#e8c48c';
  rr(c, 60, 80, 128, 168, 12); c.fill();
  rr(c, 196, 80, 128, 168, 12); c.fill();
  rr(c, 60, 258, 264, 178, 12); c.fill();
  c.fillStyle = P.woodDark;
  c.fillRect(120, 158, 10, 4); c.fillRect(244, 158, 10, 4);  // knobs
  c.fillRect(160, 340, 10, 4); c.fillRect(224, 340, 10, 4);
  // spice jars on a little shelf beside the cupboard
  c.fillStyle = P.wood; rr(c, 360, 250, 250, 16, 8); c.fill();
  const jar = (x, col) => {
    c.fillStyle = col; rr(c, x, 212, 30, 38, 8); c.fill();
    c.fillStyle = '#fff6e2'; rr(c, x - 1, 206, 32, 10, 4); c.fill();
  };
  jar(376, '#e07d8b'); jar(416, '#5fae8d'); jar(456, '#9b74d2'); jar(496, '#c98a4b'); jar(536, '#e9a63a');
});

/** Counter-row strip: open shelves with plates, mugs, potted herbs. */
WW.tex('bg-props', 640, 300, (c, w) => {
  // shelf 1
  c.fillStyle = P.woodDark; rr(c, 0, 120, w, 14, 6); c.fill();
  const plate = (x, col, rim) => {
    c.fillStyle = rim; rr(c, x, 78, 56, 44, 10); c.fill();
    c.fillStyle = col; rr(c, x + 5, 83, 46, 34, 8); c.fill();
  };
  plate(30, '#fff4e0', P.pink); plate(100, '#ffeef2', P.lavender); plate(170, '#eaf6ef', P.mintDeep);
  // jug with sprigs
  c.fillStyle = '#9ec8ef'; rr(c, 250, 62, 34, 58, 10); c.fill();
  c.fillStyle = P.mintDeep;
  c.fillRect(258, 44, 5, 22); c.fillRect(268, 38, 5, 28);
  c.fillStyle = '#a8dcc3'; c.beginPath(); c.ellipse(260, 42, 9, 5, -.4, 0, 7); c.fill();
  // shelf 2
  c.fillStyle = P.wood; rr(c, 0, 268, w, 16, 6); c.fill();
  const mug = (x, col) => {
    c.fillStyle = col; rr(c, x, 216, 34, 52, 10); c.fill();
    c.strokeStyle = col; c.lineWidth = 6;
    c.beginPath(); c.arc(x + 40, 238, 11, -Math.PI / 2, Math.PI / 2); c.stroke();
  };
  mug(50, P.peach); mug(110, P.mint);
  // honey pot
  c.fillStyle = '#e9a63a'; rr(c, 200, 222, 40, 46, 12); c.fill();
  c.fillStyle = '#fffaf0'; rr(c, 196, 214, 48, 12, 6); c.fill();
  fillText(c, ':', 214, 238, 2, '#b87b43');
  // tiny flour bag
  c.fillStyle = '#fff3dd'; rr(c, 420, 206, 56, 62, 10); c.fill();
  c.fillStyle = P.pinkDeep; rr(c, 426, 214, 44, 30, 6); c.fill();
  c.fillStyle = '#fff3dd'; rr(c, 430, 222, 36, 14, 4); c.fill();
  fillText(c, '★', 444, 226, 2, '#e9a63a');
  // hanging utensils
  const utens = (x, kind) => {
    c.strokeStyle = P.metal; c.lineWidth = 5; c.lineCap = 'round';
    if (kind === 0) { // ladle
      c.beginPath(); c.moveTo(x, 148); c.lineTo(x, 246); c.stroke();
      c.fillStyle = P.metal; c.beginPath(); c.arc(x, 254, 12, 0, 7); c.fill();
      c.fillStyle = '#f3e2cd'; c.beginPath(); c.arc(x, 254, 8, 0, 7); c.fill();
    } else if (kind === 1) { // whisk
      c.beginPath(); c.moveTo(x, 148); c.lineTo(x, 210); c.stroke();
      c.strokeStyle = P.metal; c.lineWidth = 3;
      for (let i = -2; i <= 2; i++) {
        c.beginPath(); c.moveTo(x + i * 2.6, 210);
        c.quadraticCurveTo(x + i * 6, 238, x + i * 1.6, 256); c.stroke();
      }
    } else { // wooden spoon
      c.strokeStyle = P.woodDark; c.lineWidth = 6;
      c.beginPath(); c.moveTo(x, 148); c.lineTo(x, 238); c.stroke();
      c.fillStyle = P.woodDark; c.beginPath(); c.ellipse(x, 248, 10, 14, 0, 0, 7); c.fill();
    }
    c.fillStyle = P.butterDeep; c.fillRect(x - 5, 144, 10, 5);
  };
  utens(540, 0); utens(584, 1); utens(622, 2);
});

/** Foreground counter surface strip (tile top used under feet). */
WW.tex('bg-counter', 640, 260, (c, w) => {
  // body
  c.fillStyle = P.wood; c.fillRect(0, 56, w, 204);
  c.fillStyle = '#e8b575'; c.fillRect(0, 56, w, 10);
  // pastel tile top edge (the walking surface)
  c.fillStyle = '#efe0c8'; c.fillRect(0, 8, w, 50);
  const tiles = ['#f7d1cf', '#d8ead0', '#e4def2', '#fce9cc'];
  for (let i = 0; i * 64 < w; i++) {
    c.fillStyle = tiles[i % 4];
    rr(c, i * 64 + 4, 14, 56, 38, 8); c.fill();
  }
  c.fillStyle = P.woodDark; c.fillRect(0, 8, w, 4);
});

/* ================================================================
 * §2  Character painter — one canvas, redrawn live
 * ================================================================ */
/* Ghee design (assignment §3): rounded warm body, big eyes, blush,
 * leaf cap, tiny arms + feet, glowing mark. Squash/stretch + poses. */

/**
 * Paint a spirit into ctx centred at (w/2, h) standing on feet.
 * state:
 *  { pose:'idle'|'run'|'jump'|'fall'|'land'|'slip'|'win'|'lose'|'collect',
 *    animT, squash:{x,y}, blink:0..1, look:'l'|'r',
 *    wind:0..1, char }
 */
WW.paintSpirit = (c, w, h, s) => {
  const ch = s.char;
  const body = ch.body, bodyD = ch.bodyDark;
  const tint = ch.tint; // start.ng styling tints accessory + scarf band
  const cx = w / 2, gy = h - 8; // feet ground line
  const t = s.animT || 0;
  const wrapper = (dy = 0) => {
    c.save(); c.translate(cx + (s.wind ? -s.wind * 6 : 0), gy + dy); return () => c.restore();
  };

  // ---- idle bob + squash baseline ----
  let bx = 1, by = 1, dy = 0, lean = 0, rot = 0;
  const pose = s.pose || 'idle';
  if (pose === 'idle') { by = 1 + Math.sin(t * ch.bob) * 0.035; bx = 2 - by; }
  if (pose === 'run') {
    const b = Math.sin(t * 14);
    by = 1 + b * 0.06; bx = 2 - by; rot = b * 0.06;
  }
  if (pose === 'jump') { bx = 0.86; by = 1.18; }
  if (pose === 'fall') { bx = 0.94; by = 1.08; rot = Math.sin(t * 6) * 0.05; }
  if (pose === 'land') { bx = 1.22; by = 0.8; }
  if (pose === 'slip') { rot = Math.sin(t * 18) * 0.16; }
  if (pose === 'win') { const b = Math.abs(Math.sin(t * 6)); dy = -10 * b; by = 1 + b * .1; }
  if (pose === 'lose') { bx = 1.12; by = 0.9; rot = -0.12; }
  if (pose === 'collect') { bx = 0.9; by = 1.14; }

  const H = 54 * by, Wd = 43 * bx;
  const end = wrapper(dy);
  c.rotate(rot);

  // ---- glow aura (magical mark) ----
  const glowA = 0.22 + Math.sin(t * 3) * 0.07;
  c.fillStyle = ch.glow;
  c.globalAlpha = glowA;
  c.beginPath(); c.ellipse(0, -H * 0.5, Wd * 0.95, H * 0.62, 0, 0, 7); c.fill();
  c.globalAlpha = 1;

  // ---- feet ----
  const step = pose === 'run' ? Math.sin(t * 14) * 5 : 0;
  c.fillStyle = bodyD;
  rr(c, -14 + step, -7, 13, 9, 4.5); c.fill();
  rr(c, 2 - step, -7, 13, 9, 4.5); c.fill();

  // ---- little arms ----
  c.fillStyle = body;
  c.strokeStyle = body; c.lineWidth = 7; c.lineCap = 'round';
  const armUp = pose === 'win' || pose === 'jump' || pose === 'collect';
  const swing = pose === 'run' ? Math.sin(t * 14) * 6 : Math.sin(t * 2.4) * 1.5;
  c.beginPath(); c.moveTo(-Wd / 2 + 2, -H * 0.52); c.lineTo(-Wd / 2 - 5 + (armUp ? -6 : swing), -H * (armUp ? 0.85 : 0.62)); c.stroke();
  c.beginPath(); c.moveTo(Wd / 2 - 2, -H * 0.52); c.lineTo(Wd / 2 + 5 - (armUp ? -6 : swing), -H * (armUp ? 0.85 : 0.62)); c.stroke();

  // ---- body ----
  c.fillStyle = body;
  rr(c, -Wd / 2, -H, Wd, H * 0.92, 15 * bx); c.fill();
  // belly highlight
  c.fillStyle = 'rgba(255,255,255,.35)';
  c.beginPath(); c.ellipse(-Wd * 0.18, -H * 0.62, Wd * 0.3, H * 0.3, 0, 0, 7); c.fill();

  // ---- face ----
  const blink = s.blink > 0.93 ? 0.12 : 1;
  c.fillStyle = '#3a2c22';
  const eo = pose === 'lose' || pose === 'slip' ? 1.6 : 0;
  const lookX = s.look === 'r' ? 1.5 : s.look === 'l' ? -1.5 : 0;
  if (blink < 1) { // closed happy line
    c.fillRect(-9 + lookX, -H * 0.66, 7, 3 * blink);
    c.fillRect(4 + lookX, -H * 0.66, 7, 3 * blink);
  } else if (pose === 'lose' || pose === 'slip') { // worried
    c.fillRect(-9 + lookX, -H * 0.68, 5, 6);
    c.fillRect(4 + lookX, -H * 0.68, 5, 6);
  } else {
    c.beginPath(); c.ellipse(-6 + lookX + eo, -H * 0.64, 3.4, 4.6, 0, 0, 7); c.fill();
    c.beginPath(); c.ellipse(7 + lookX - eo, -H * 0.64, 3.4, 4.6, 0, 0, 7); c.fill();
    c.fillStyle = '#fff';
    c.beginPath(); c.ellipse(-5.2 + lookX, -H * 0.68, 1.1, 1.5, 0, 0, 7); c.fill();
    c.beginPath(); c.ellipse(7.8 + lookX, -H * 0.68, 1.1, 1.5, 0, 0, 7); c.fill();
  }
  // blush
  c.fillStyle = ch.cheek; c.globalAlpha = 0.75;
  c.beginPath(); c.ellipse(-11 + lookX, -H * 0.5, 4.4, 2.6, 0, 0, 7); c.fill();
  c.beginPath(); c.ellipse(12 + lookX, -H * 0.5, 4.4, 2.6, 0, 0, 7); c.fill();
  c.globalAlpha = 1;
  // smile / open mouth
  c.strokeStyle = '#3a2c22'; c.lineWidth = 2.4; c.lineCap = 'round';
  c.beginPath();
  if (pose === 'win' || pose === 'collect') { // open joyful
    c.ellipse(0 + lookX, -H * 0.47, 3.6, pose === 'win' ? 4.4 : 3, 0, Math.PI, 0);
  } else {
    c.moveTo(-3 + lookX, -H * 0.48); c.quadraticCurveTo(0 + lookX, -H * 0.44, 3 + lookX, -H * 0.48);
  }
  c.stroke();

  // ---- accessory (distinct silhouette per spirit) ----
  const ac = ch.accessory, acc = tint?.primary || ch.accent;
  if (ac === 'leaf') {
    c.fillStyle = acc;
    c.beginPath(); c.ellipse(4, -H - 6, 11, 6, 0.5, 0, 7); c.fill();
    c.strokeStyle = '#4e7a5b'; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(-3, -H - 6.6); c.lineTo(11, -H - 4); c.stroke();
  }
  if (ac === 'nightcap') {
    c.fillStyle = tint?.primary || '#b79adf';
    c.beginPath(); c.moveTo(-13, -H - 3); c.quadraticCurveTo(2, -H - 26, 16, -H - 4); c.closePath(); c.fill();
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(15, -H - 5, 3.4, 0, 7); c.fill();
  }
  if (ac === 'acorn') {
    c.fillStyle = '#96612f';
    c.beginPath(); c.arc(1, -H - 5, 10, Math.PI, 0); c.fill();
    c.fillStyle = tint?.primary || '#c98a4b';
    rr(c, -11, -H - 8, 24, 6, 3); c.fill();
    c.fillStyle = '#96612f'; c.fillRect(-1, -H - 16, 4, 5);
  }
  if (ac === 'scarf') {
    c.fillStyle = tint?.primary || '#f9737f';
    rr(c, -Wd / 2 - 2, -H * 0.34, Wd + 4, 9, 4.5); c.fill();
    c.fillStyle = tint?.hair || acc;
    rr(c, Wd / 2 - 6, -H * 0.34 + 6, 8, 14, 4); c.fill(); // trailing tail
  }
  if (ac === 'flower') {
    const px = 10, py = -H - 4;
    c.fillStyle = tint?.primary || '#f6a6b2';
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2;
      c.beginPath(); c.ellipse(px + Math.cos(a) * 5, py + Math.sin(a) * 5, 3.4, 3.4, 0, 0, 7); c.fill();
    }
    c.fillStyle = '#ffe9a8'; c.beginPath(); c.arc(px, py, 2.6, 0, 7); c.fill();
  }

  // start.ng hair-colour accent: tiny glowing tuft on the cap
  if (tint?.hair) {
    c.fillStyle = tint.hair; c.globalAlpha = 0.85;
    c.beginPath(); c.arc(-8, -H - 5, 3, 0, 7); c.fill();
    c.globalAlpha = 1;
  }

  // glowing belly mark (the "wick")
  const mk = 0.6 + Math.sin(t * 2.2 + 1) * 0.4;
  c.fillStyle = ch.glow; c.globalAlpha = 0.9 * mk;
  c.beginPath(); c.ellipse(0, -H * 0.36, 3.2, 4.4, 0, 0, 7); c.fill();
  c.globalAlpha = 1;
  end();
};

/* ================================================================
 * §3  Hazards & surface decals (classic婚纱 hints built in art)
 * ================================================================ */
WW.tex('hz-flour', 96, 40, (c, w, h) => {
  c.fillStyle = 'rgba(255,253,246,.97)';
  c.beginPath(); c.ellipse(48, 28, 44, 13, 0, 0, 7); c.fill();
  c.beginPath(); c.ellipse(24, 15, 15, 11, 0, 0, 7); c.fill();
  c.beginPath(); c.ellipse(66, 14, 18, 12, 0, 0, 7); c.fill();
  c.beginPath(); c.ellipse(45, 9, 13, 10, 0, 0, 7); c.fill();
  c.fillStyle = 'rgba(214,186,150,.5)';
  c.beginPath(); c.ellipse(48, 32, 40, 5, 0, 0, 7); c.fill();
});

WW.tex('hz-pin', 130, 62, (c) => {
  // side-view rolling pin with handles
  c.fillStyle = '#e8b575'; rr(c, 14, 20, 100, 24, 12); c.fill();
  c.fillStyle = '#e5966b'; rr(c, 18, 26, 92, 12, 6); c.fill(); // sheen
  c.fillStyle = '#96612f';
  rr(c, 0, 25, 20, 14, 7); c.fill(); rr(c, 108, 25, 20, 14, 7); c.fill();
  c.strokeStyle = 'rgba(150,97,47,.6)'; c.lineWidth = 2;
  for (const x of [40, 62, 84]) { c.beginPath(); c.moveTo(x, 22); c.lineTo(x, 42); c.stroke(); }
});
// top-down wheels on the side sprite? keep simple — one art file used.

const Puddle = (key, deep, mid, shine) => WW.tex(key, 200, 46, (c, w) => {
  c.fillStyle = deep;
  c.beginPath(); c.ellipse(100, 36, 92, 9, 0, 0, 7); c.fill();
  c.beginPath(); c.moveTo(12, 34);
  c.quadraticCurveTo(30, 16, 62, 24); c.quadraticCurveTo(96, 10, 136, 24);
  c.quadraticCurveTo(170, 15, 188, 34);
  c.quadraticCurveTo(100, 44, 12, 34); c.closePath();
  c.fillStyle = mid; c.fill();
  c.fillStyle = shine;
  c.beginPath(); c.ellipse(56, 24, 12, 3.4, -0.2, 0, 7); c.fill();
  c.beginPath(); c.ellipse(132, 26, 9, 2.6, 0.2, 0, 7); c.fill();
});
Puddle('hz-butter', '#d9b23a', '#ffd66b', '#fff3c4');
Puddle('hz-milk', '#cfe4f2', '#eef6fb', '#ffffff');
Puddle('hz-jam', '#8c2f47', '#b34a63', '#e08aa0');

WW.tex('hz-jamdrop', 60, 42, (c) => { // glob from a tipped jam jar (level 4)
  c.fillStyle = '#b34a63';
  c.beginPath(); c.ellipse(30, 26, 22, 13, 0, 0, 7); c.fill();
  c.beginPath(); c.ellipse(30, 16, 12, 11, 0, 0, 7); c.fill();
  c.fillStyle = '#e08aa0';
  c.beginPath(); c.ellipse(24, 15, 5, 3, -0.3, 0, 7); c.fill();
});

WW.tex('hz-fan', 74, 92, (c) => {
  c.fillStyle = P.metal; rr(c, 30, 62, 14, 28, 5); c.fill();
  c.fillStyle = '#8fa1ab'; rr(c, 20, 84, 34, 8, 4); c.fill();
  c.fillStyle = '#eef4f7'; rr(c, 10, 6, 54, 60, 20); c.fill();
  c.strokeStyle = '#9aacb7'; c.lineWidth = 4;
  c.beginPath(); c.ellipse(37, 36, 25, 27, 0, 0, 7); c.stroke();
  // cage bars
  for (const a of [0.35, 1.2, 2.1]) {
    c.globalAlpha = 0.5;
    c.beginPath(); c.ellipse(37, 36, 25 * a, 27, 0, 0, 7); c.stroke();
    c.globalAlpha = 1;
  }
});

/* ================================================================
 * §4  Collectibles + goal
 * ================================================================ */
WW.tex('co-spark', 44, 44, (c) => {
  c.fillStyle = '#ffe9a8';
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 17 : 7;
    const x = 22 + Math.cos(a) * r, y = 22 + Math.sin(a) * r;
    i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
  }
  c.closePath(); c.fill();
  c.fillStyle = '#fff';
  c.beginPath(); c.arc(19, 18, 3.4, 0, 7); c.fill();
});

WW.tex('co-gem', 40, 40, (c) => {
  c.fillStyle = '#c7b8e8';
  c.beginPath(); c.moveTo(20, 3); c.lineTo(35, 14); c.lineTo(29, 36); c.lineTo(11, 36); c.lineTo(5, 14);
  c.closePath(); c.fill();
  c.fillStyle = '#e8dcf7';
  c.beginPath(); c.moveTo(20, 3); c.lineTo(27, 14); c.lineTo(13, 14); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,.5)';
  c.beginPath(); c.ellipse(15, 22, 4, 2.4, .5, 0, 7); c.fill();
});

/** The goal: a little candle lantern whose wick Ghee lights (title!). */
WW.tex('goal-lantern', 92, 130, (c, w) => {
  c.fillStyle = '#8f74c9'; rr(c, 30, 0, 32, 26, 8); c.fill(); // loop handle
  c.fillStyle = P.metal;
  rr(c, 22, 26, 50, 84, 12); c.fill();
  c.fillStyle = '#aebfc9'; rr(c, 27, 31, 40, 74, 9); c.fill();
  c.fillStyle = '#7fa3b8'; rr(c, 33, 38, 28, 60, 6); c.fill(); // glass
  c.fillStyle = P.metal; rr(c, 18, 106, 58, 18, 8); c.fill();
  c.fillStyle = '#fff'; // wick placeholder (lit version drawn over by FX)
  c.fillRect(44, 96, 4, 6);
});
WW.tex('goal-flame', 40, 52, (c, w, h) => {
  const g = c.createRadialGradient(20, 34, 2, 20, 34, 22);
  g.addColorStop(0, '#fff6c9'); g.addColorStop(.45, '#ffd66b'); g.addColorStop(1, 'rgba(255,214,107,0)');
  c.fillStyle = g;
  c.beginPath(); c.moveTo(20, 2); c.quadraticCurveTo(34, 22, 30, 36);
  c.quadraticCurveTo(27, 46, 20, 46); c.quadraticCurveTo(13, 46, 10, 36);
  c.quadraticCurveTo(6, 22, 20, 2); c.fill();
  c.fillStyle = '#fff';
  c.beginPath(); c.ellipse(20, 34, 4, 7, 0, 0, 7); c.fill();
});

/* ================================================================
 * §5  Kitchen props (theme variety per level) + vignette support
 * ================================================================ */
/** Rows of small countertop props sprinkled as decoration behind play. */
WW.tex('props-mini', 560, 120, (c, w) => {
  const R = WW.rng(99);
  let x = 8;
  while (x < w - 70) {
    const k = R();
    if (k < .3) {        // jar with fruits
      c.fillStyle = R() < .5 ? '#e07d8b' : '#c98a4b';
      rr(c, x, 66, 34, 40, 10); c.fill();
      c.fillStyle = '#fff6e2'; rr(c, x - 2, 58, 38, 10, 5); c.fill();
      c.fillStyle = 'rgba(255,255,255,.35)'; rr(c, x + 5, 74, 7, 18, 4); c.fill();
      x += 44;
    } else if (k < .6) {  // potted herb
      c.fillStyle = '#d98a5f'; rr(c, x, 82, 26, 24, 6); c.fill();
      c.fillStyle = '#5fae8d';
      c.beginPath(); c.ellipse(x + 13, 66, 12, 15, 0, 0, 7); c.fill();
      c.fillRect(x + 11, 74, 4, 10);
      x += 36;
    } else {              // cups stack
      c.fillStyle = '#fff4e0'; rr(c, x, 92, 30, 14, 6); c.fill();
      c.fillStyle = P.peach; rr(c, x + 2, 78, 26, 14, 6); c.fill();
      x += 42;
    }
    x += 10 + R() * 30;
  }
});
})();
