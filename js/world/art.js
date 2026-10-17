/**
 * Whimsy Wick — js/world/art.js
 * ---------------------------------------------------------------
 * All in-world art is drawn to canvas, then used as CanvasTextures on
 * THREE.Mesh planes. Everything procedural (assignment §14 licensing) and
 * pastel storybook (§7).
 *
 * Style rules (kept consistent everywhere so items READ clearly):
 *   — every prop gets a soft dark outline (rgba cocoa), never flat
 *   — items sit on a baseline with a small shadow
 *   — the counter runs all the way to the bottom of the screen with
 *     drawers/cupboards/oven, like the original prototype's countertop
 *
 * §1  Tileable background strips (wall, shelves, counters, window…)
 * §2  Character sprite painter — live redraw per animation state
 * §3  Hazard sprites + ground decals (butter/milk/jam puddles)
 * §4  Collectibles (magic spark, star gem) and the goal lantern
 * §5  Countertop clutter + end-scene vignette support
 */
(() => {
'use strict';
const WW = window.WW;
const P = WW.PALETTE;
const { rr, fillText } = WW;

/* Shared outline ink — softer than pure black, keeps objects readable. */
const OUT = 'rgba(122, 87, 55, .85)';       // cocoa outline
const OUT2 = 'rgba(122, 87, 55, .45)';      // faint outline
const WHITE = '#ffffff';
const strokeRR = (c, x, y, w, h, r, lw = 2.6) => {
  c.strokeStyle = OUT; c.lineWidth = lw; rr(c, x, y, w, h, r); c.stroke();
};

/* ================================================================
 * §1  Background / parallax strips (assignment §7.2)
 * ================================================================ */

/** Night window: WIDE and SHORT, perched high on the wall. 300x150. */
WW.tex('bg-window', 300, 150, (c, w, h) => {
  // frame
  c.fillStyle = '#e9d9ba'; rr(c, 0, 4, w, h - 8, 12); c.fill();
  c.strokeStyle = 'rgba(122,87,55,.8)'; c.lineWidth = 2.6; rr(c, 0, 4, w, h - 8, 12); c.stroke();
  // glass — deep night for strong contrast against pastel walls
  const sky = c.createLinearGradient(0, 12, 0, h - 20);
  sky.addColorStop(0, '#332b64'); sky.addColorStop(1, '#56447a');
  c.fillStyle = sky; rr(c, 10, 14, w - 20, h - 34, 8); c.fill();
  // moon + stars
  c.fillStyle = '#fff3c4';
  c.beginPath(); c.arc(w - 62, 46, 15, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#332b64';
  c.beginPath(); c.arc(w - 69, 41, 12.5, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fff8e0';
  const R = WW.rng(7);
  for (let i = 0; i < 14; i++) {
    const x = 26 + R() * (w - 80), y = 22 + R() * (h - 62), s = R() < .3 ? 3 : 2;
    c.globalAlpha = .55 + R() * .45;
    c.fillRect(x, y, s, s);
  }
  c.globalAlpha = 1;
  // panes
  c.fillStyle = '#e0d0b2';
  c.fillRect(w / 2 - 4, 14, 8, h - 36);
  c.fillRect(10, h / 2 - 4, w - 20, 8);
  // sill
  c.fillStyle = '#e0d0b2'; rr(c, 6, h - 18, w - 12, 12, 5); c.fill();
  c.strokeStyle = 'rgba(122,87,55,.8)'; c.lineWidth = 2; rr(c, 6, h - 18, w - 12, 12, 5); c.stroke();
});

/** Wall strip: cream + wallpaper dots, wainscot, framed recipe, hook rail. */
WW.tex('bg-wall', 640, 560, (c, w, h) => {
  c.fillStyle = '#f6ead6'; c.fillRect(0, 0, w, h);
  // wallpaper dots (subtle)
  c.fillStyle = '#ecdcc2';
  for (let y = 20; y < 380; y += 44) {
    for (let x = 20 + (y / 44 % 2) * 22; x < w; x += 44) {
      c.beginPath(); c.arc(x, y, 3, 0, 7); c.fill();
    }
  }
  // framed recipe card
  c.fillStyle = P.butterDeep; rr(c, 96, 88, 168, 128, 12); c.fill();
  strokeRR(c, 96, 88, 168, 128, 12, 3);
  c.fillStyle = '#fffaf0'; rr(c, 106, 98, 148, 108, 8); c.fill();
  c.fillStyle = P.butterDeep;
  rr(c, 122, 118, 44, 40, 6); c.fill();           // little toast icon
  strokeRR(c, 122, 118, 44, 40, 6, 2);
  c.fillStyle = WHITE; rr(c, 128, 124, 32, 22, 5); c.fill();
  c.strokeStyle = OUT2; c.lineWidth = 2;
  c.beginPath(); c.moveTo(132, 132); c.lineTo(156, 132); c.stroke();
  c.beginPath(); c.moveTo(132, 138); c.lineTo(150, 138); c.stroke();
  // text lines
  for (let i = 0; i < 3; i++) {
    c.strokeStyle = 'rgba(74,53,36,.35)';
    c.beginPath(); c.moveTo(180, 122 + i * 12); c.lineTo(244, 122 + i * 12); c.stroke();
    c.beginPath(); c.moveTo(180, 150 + i * 12); c.lineTo(238, 150 + i * 12); c.stroke();
  }
  // hook rail with hanging mitts
  c.fillStyle = P.woodDark; rr(c, 420, 96, 170, 12, 6); c.fill();
  strokeRR(c, 420, 96, 170, 12, 6, 2);
  const mitt = (x, col) => {
    c.strokeStyle = OUT; c.lineWidth = 2.4;
    c.beginPath(); c.arc(x, 122, 4, 0, 7); c.stroke();     // hook
    c.fillStyle = col; rr(c, x - 12, 126, 24, 30, 9); c.fill();
    strokeRR(c, x - 12, 126, 24, 30, 9, 2.2);
    c.fillStyle = 'rgba(255,255,255,.5)'; rr(c, x - 6, 132, 7, 12, 3); c.fill();
  };
  mitt(456, '#f6a6b2'); mitt(524, '#a8dcc3');
  // wainscot back-splash lower band
  c.fillStyle = '#e6d2a6'; c.fillRect(0, 430, w, h - 430);
  c.fillStyle = '#d3ba8b'; c.fillRect(0, 430, w, 8);
  // faint panels on the band
  c.strokeStyle = 'rgba(160,110,60,.45)'; c.lineWidth = 2.4;
  for (const [px2, pw] of [[30, 180], [250, 180], [470, 140]]) {
    rr(c, px2, 452, pw, 84, 10); c.stroke();
  }
});

/** Open shelves with outlined, readable props. */
WW.tex('bg-props', 640, 300, (c, w) => {
  // ---- rail with utensils (top) ----
  c.fillStyle = P.woodDark; rr(c, 40, 26, 360, 10, 5); c.fill();
  strokeRR(c, 40, 26, 360, 10, 5, 2);
  const utens = (x, kind) => {
    c.strokeStyle = OUT; c.lineWidth = 2.2;
    c.beginPath(); c.moveTo(x, 36); c.lineTo(x, 46); c.stroke();  // string
    c.strokeStyle = '#9fb3bd'; c.lineWidth = 5; c.lineCap = 'round';
    if (kind === 0) { // ladle
      c.beginPath(); c.moveTo(x, 46); c.lineTo(x, 92); c.stroke();
      c.fillStyle = '#b8c4cc'; c.beginPath(); c.arc(x, 100, 12, 0, 7); c.fill();
      c.strokeStyle = OUT; c.beginPath(); c.arc(x, 100, 12, 0, 7); c.stroke();
      c.fillStyle = '#f6ead6'; c.beginPath(); c.arc(x, 100, 7, 0, 7); c.fill();
    } else if (kind === 1) { // whisk
      c.beginPath(); c.moveTo(x, 46); c.lineTo(x, 74); c.stroke();
      c.strokeStyle = '#9fb3bd'; c.lineWidth = 2.6;
      for (let i = -2; i <= 2; i++) {
        c.beginPath(); c.moveTo(x + i * 2.4, 74);
        c.quadraticCurveTo(x + i * 6, 92, x + i * 1.5, 102); c.stroke();
      }
    } else { // spoon
      c.strokeStyle = P.woodDark; c.lineWidth = 6;
      c.beginPath(); c.moveTo(x, 46); c.lineTo(x, 88); c.stroke();
      c.fillStyle = P.woodDark; c.beginPath(); c.ellipse(x, 96, 9, 13, 0, 0, 7); c.fill();
      c.strokeStyle = OUT; c.beginPath(); c.ellipse(x, 96, 9, 13, 0, 0, 7); c.stroke();
    }
  };
  utens(84, 0); utens(128, 1); utens(166, 2);
  // ---- top shelf: stacked plates + teapot + jar ----
  c.fillStyle = P.woodDark; rr(c, 0, 148, w, 14, 7); c.fill();
  c.fillStyle = '#c98a4b'; rr(c, 0, 148, w, 5, 3); c.fill();
  const plates = (x) => {
    for (let i = 0; i < 3; i++) {
      c.fillStyle = i === 1 ? '#ffeef2' : '#fff4e0';
      rr(c, x, 118 - i * 12, 58, 34 - i * 2, 9); c.fill();
      strokeRR(c, x, 118 - i * 12, 58, 34 - i * 2, 9, 2.2);
      c.fillStyle = i === 1 ? P.pink : P.mintDeep;
      rr(c, x + 6, 130 - i * 12, 46, 14, 5); c.fill();
    }
  };
  plates(28); plates(108);
  // teapot
  c.fillStyle = '#9ec8ef';
  rr(c, 226, 96, 62, 52, 16); c.fill();
  strokeRR(c, 226, 96, 62, 52, 16, 2.6);
  c.beginPath(); c.moveTo(286, 112); c.quadraticCurveTo(304, 116, 300, 132); c.stroke(); // spout
  c.strokeStyle = OUT; c.lineWidth = 2.6;
  c.beginPath(); c.moveTo(288, 110); c.quadraticCurveTo(306, 116, 301, 132); c.stroke();
  c.strokeStyle = '#9ec8ef'; c.lineWidth = 5;
  c.beginPath(); c.arc(222, 116, 12, -Math.PI / 2, Math.PI / 2); c.stroke();
  c.strokeStyle = OUT; c.lineWidth = 2.2;
  c.beginPath(); c.arc(222, 116, 12, -Math.PI / 2, Math.PI / 2); c.stroke();
  c.fillStyle = '#9ec8ef'; rr(c, 244, 88, 26, 12, 5); c.fill();
  strokeRR(c, 244, 88, 26, 12, 5, 2.2);
  // jar with cookies
  c.fillStyle = '#e8f0f8'; rr(c, 336, 92, 44, 56, 10); c.fill();
  strokeRR(c, 336, 92, 44, 56, 10, 2.6);
  c.fillStyle = '#fff6e2'; rr(c, 333, 84, 50, 12, 5); c.fill();
  strokeRR(c, 333, 84, 50, 12, 5, 2);
  c.fillStyle = '#d99a3e';
  rr(c, 344, 122, 28, 14, 6); c.fill(); strokeRR(c, 344, 122, 28, 14, 6, 1.8);
  // cookbooks leaning
  const book = (x, col, lean) => {
    c.save(); c.translate(x, 148); c.rotate(lean);
    c.fillStyle = col; rr(c, -16, -46, 32, 46, 4); c.fill();
    strokeRR(c, -16, -46, 32, 46, 4, 2.2);
    c.fillStyle = 'rgba(255,255,255,.55)'; rr(c, -8, -38, 16, 26, 3); c.fill();
    c.restore();
  };
  book(432, P.pink, -0.16); book(462, P.mint, 0.12); book(494, P.lavender, 0.02);
  // plant trailing
  c.fillStyle = '#d1794f'; rr(c, 566, 108, 40, 40, 9); c.fill();
  strokeRR(c, 566, 108, 40, 40, 9, 2.6);
  c.fillStyle = '#5fae8d';
  c.beginPath(); c.ellipse(586, 94, 15, 12, 0, 0, 7); c.fill();
  c.strokeStyle = OUT2;
  c.beginPath(); c.moveTo(586, 104); c.quadraticCurveTo(600, 122, 596, 140); c.stroke();
  c.beginPath(); c.moveTo(580, 106); c.quadraticCurveTo(566, 124, 570, 142); c.stroke();
  // ---- lower shelf: mugs, honey, flour bag (smaller) ----
  c.fillStyle = P.wood; rr(c, 0, 272, w, 16, 7); c.fill();
  c.fillStyle = '#e9b878'; rr(c, 0, 272, w, 5, 3); c.fill();
  const mug = (x, col) => {
    c.fillStyle = col; rr(c, x, 222, 40, 50, 10); c.fill();
    strokeRR(c, x, 222, 40, 50, 10, 2.6);
    c.strokeStyle = col; c.lineWidth = 6;
    c.beginPath(); c.arc(x + 46, 242, 11, -Math.PI / 2, Math.PI / 2); c.stroke();
    c.strokeStyle = OUT; c.lineWidth = 2.2;
    c.beginPath(); c.arc(x + 46, 242, 11, -Math.PI / 2, Math.PI / 2); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.4)'; rr(c, x + 6, 228, 9, 30, 4); c.fill();
  };
  mug(44, P.peach); mug(116, P.mint);
  // honey pot with lid + dipper
  c.fillStyle = '#e9a63a'; rr(c, 208, 224, 46, 48, 12); c.fill();
  strokeRR(c, 208, 224, 46, 48, 12, 2.6);
  c.fillStyle = '#fffaf0'; rr(c, 204, 214, 54, 14, 6); c.fill();
  strokeRR(c, 204, 214, 54, 14, 6, 2.2);
  c.fillStyle = '#b8763a'; rr(c, 224, 240, 14, 20, 6); c.fill();
  // milk bottle
  c.fillStyle = '#eef6fb'; rr(c, 300, 218, 30, 54, 9); c.fill();
  strokeRR(c, 300, 218, 30, 54, 9, 2.4);
  c.fillStyle = '#cfe4f2'; rr(c, 306, 214, 18, 12, 4); c.fill();
  // small flour sack
  c.fillStyle = '#fff3dd'; rr(c, 380, 214, 56, 58, 10); c.fill();
  strokeRR(c, 380, 214, 56, 58, 10, 2.6);
  c.fillStyle = P.pinkDeep; rr(c, 388, 224, 40, 26, 6); c.fill();
  fillText(c, '★', 402, 230, 2, '#fff3dd');
});

/** The counter the player walks on — one plain countertop slab on top,
 *  cupboards below, filling the whole bottom of the screen. */
WW.tex('bg-counter', 640, 360, (c, w, h) => {
  // countertop slab (the walking surface) — continuous, no tiles
  c.fillStyle = '#f3dcb6'; c.fillRect(0, 0, w, 54);
  c.fillStyle = '#fbebd0'; c.fillRect(0, 0, w, 7);              // lit top edge
  c.fillStyle = 'rgba(122,87,55,.55)'; c.fillRect(0, 7, w, 2);  // top-face crease
  c.strokeStyle = 'rgba(122,87,55,.12)'; c.lineWidth = 2;       // soft grain
  for (const y of [20, 33, 44]) {
    c.beginPath(); c.moveTo(0, y);
    for (let x = 0; x <= w; x += 80) c.quadraticCurveTo(x + 40, y + (x / 80 % 2 ? 2 : -2), x + 80, y);
    c.stroke();
  }
  // wood lip under tiles
  c.fillStyle = '#c98a4b'; c.fillRect(0, 54, w, 10);
  c.fillStyle = 'rgba(74,53,36,.35)'; c.fillRect(0, 62, w, 3);
  // cupboard body
  c.fillStyle = P.wood; c.fillRect(0, 64, w, h - 64);
  // drawers + doors pattern
  const drawer = (x, wd) => {
    c.fillStyle = 'rgba(74,53,36,.13)'; rr(c, x, 86, wd, 74, 10); c.fill();
    c.strokeStyle = 'rgba(74,53,36,.5)'; c.lineWidth = 3; rr(c, x, 86, wd, 74, 10); c.stroke();
    c.fillStyle = P.butterDeep; rr(c, x + wd / 2 - 22, 116, 44, 9, 4.5); c.fill();
    c.strokeStyle = 'rgba(74,53,36,.55)'; c.lineWidth = 2; rr(c, x + wd / 2 - 22, 116, 44, 9, 4.5); c.stroke();
  };
  const door = (x, wd) => {
    c.fillStyle = 'rgba(74,53,36,.09)'; rr(c, x, 86, wd, 156, 10); c.fill();
    c.strokeStyle = 'rgba(74,53,36,.5)'; c.lineWidth = 3; rr(c, x, 86, wd, 156, 10); c.stroke();
    c.strokeStyle = 'rgba(74,53,36,.3)'; c.lineWidth = 2.4;
    rr(c, x + 14, 100, wd - 28, 128, 8); c.stroke();
    c.fillStyle = P.butterDeep;
    c.beginPath(); c.arc(x + wd - 30, 172, 7, 0, 7); c.fill();
    c.strokeStyle = 'rgba(74,53,36,.55)'; c.beginPath(); c.arc(x + wd - 30, 172, 7, 0, 7); c.stroke();
  };
  drawer(14, 196); door(226, 180); drawer(422, 196);
  // oven built into the run
  c.fillStyle = '#8f7ea0'; rr(c, 226, 170, 180, 150, 12); c.fill();
  c.strokeStyle = 'rgba(60,45,80,.6)'; c.lineWidth = 3; rr(c, 226, 170, 180, 150, 12); c.stroke();
  c.fillStyle = '#20192e'; rr(c, 244, 186, 144, 96, 8); c.fill();
  c.fillStyle = 'rgba(255,233,168,.18)'; rr(c, 252, 194, 128, 80, 6); c.fill();
  c.strokeStyle = 'rgba(255,233,168,.45)'; c.lineWidth = 2; rr(c, 252, 194, 128, 80, 6); c.stroke();
  c.fillStyle = '#cfc6dd'; rr(c, 280, 288, 72, 18, 6); c.fill();
  c.fillStyle = '#5d5375';
  for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(300 + i * 30, 322, 9, 0, 7); c.fill(); }
  // kickboard
  c.fillStyle = '#b87b43'; c.fillRect(0, h - 20, w, 20);
  c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, h - 20, w, 6);
});

/* ================================================================
 * §2  Character painter — prototype silhouette, five personalities
 * ================================================================ */
/* Based directly on the original #ghee: warm rounded body with a thin
 * darker border, pink blush, tiny arms and feet, subtle glow. Each spirit
 * has its own silhouette (ch.shape), eyes (ch.eyes), mouth (ch.mouth),
 * colour, accessory and idle rhythm — but all five share the same hitbox
 * and movement, so the choice is purely cosmetic (§3.2). */

/**
 * Paint a spirit into ctx, feet centred at (w/2, h-6).
 * state: { pose, animT, blink:0..1, look:'l'|'r'|'f', wind:0..1, char }
 */
WW.paintSpirit = (c, w, h, s) => {
  const ch = s.char;
  const body = ch.body, bodyD = ch.bodyDark;
  const tint = ch.tint;
  const cx = w / 2, gy = h - 6;
  const t = s.animT || 0;
  const sf = ch.sf || 1;

  c.save();
  c.translate(cx + (s.wind ? -s.wind * 5 : 0), gy);

  // ---- pose transforms ----
  let bx = 1, by = 1, dy = 0, rot = 0;
  const pose = s.pose || 'idle';
  if (pose === 'idle') { by = 1 + Math.sin(t * ch.bob) * 0.04; bx = 2 - by; dy = Math.sin(t * ch.bob) * -1.2; }
  if (pose === 'run') {
    const b = Math.sin(t * 14);
    by = 1 + b * 0.05; bx = 2 - by; rot = b * 0.05; dy = -Math.abs(Math.sin(t * 7)) * 2.4;
  }
  if (pose === 'jump') { bx = 0.88; by = 1.14; rot = 0.04; }
  if (pose === 'fall') { bx = 0.96; by = 1.06; rot = Math.sin(t * 6) * 0.05; }
  if (pose === 'land') { bx = 1.18; by = 0.84; }
  if (pose === 'slip') { rot = Math.sin(t * 18) * 0.18; }
  if (pose === 'win') { const b = Math.abs(Math.sin(t * 6)); dy = -12 * b; rot = Math.sin(t * 6) * 0.08; }
  if (pose === 'lose') { bx = 1.1; by = 0.9; rot = -0.1; }
  if (pose === 'collect') { bx = 0.92; by = 1.1; }

  // ---- move set per tier: pricier spirits move with more flair ----
  const tier = ch.anim || 0;
  const dir = s.look === 'l' ? -1 : 1;
  let spin = tier >= 3 ? (s.spin || 0) : 0;
  let swingK = 1;                         // arm + leg swing amplitude
  if (tier === 1) {                       // floaty: hover-sway, parachute fall
    if (pose === 'run') { by = 1 + Math.sin(t * 8) * 0.06; bx = 2 - by; rot = Math.sin(t * 4) * 0.09; dy = -3 - Math.abs(Math.sin(t * 4)) * 3; }
    if (pose === 'jump') { bx = 0.84; by = 1.18; rot = Math.sin(t * 6) * 0.07; }
    if (pose === 'fall') { bx = 1.1; by = 0.92; rot = Math.sin(t * 3.4) * 0.14; }
  } else if (tier === 2) {                // bouncy sprinter: hop-steps, tucked jump
    if (pose === 'run') {
      const ph = t * 15;
      dy = -Math.abs(Math.sin(ph / 2)) * 7; by = 1 + Math.sin(ph) * 0.09; bx = 2 - by;
      rot = Math.sin(ph / 2) * 0.1 * dir; swingK = 1.8;
    }
    if (pose === 'jump') { bx = 1.1; by = 0.88; rot = -0.12 * dir; }
    if (pose === 'fall') { bx = 0.88; by = 1.14; rot = 0.08 * dir; }
  } else if (tier === 3) {                // show-off: forward lean, front flip in the air
    if (pose === 'run') { by = 1 + Math.sin(t * 12) * 0.07; bx = 2 - by; rot = 0.17 * dir; dy = -Math.abs(Math.sin(t * 6)) * 5; swingK = 2; }
    if (pose === 'jump' || pose === 'fall') { bx = 0.94; by = 1.06; rot = 0; }
  } else if (tier === 4) {                // magic: hover-glide, double twirl in the air
    if (pose === 'run') { bx = 0.96; by = 1.04; rot = 0.1 * dir; dy = -5 - Math.sin(t * 5) * 2; swingK = 0; }
    if (pose === 'jump' || pose === 'fall') { bx = 0.9 + 0.12 * Math.abs(Math.cos(spin * 2)); by = 1.06; rot = 0; }
  }

  // chibi proportions: squatter, rounder, slightly wider than tall
  let W = 48 * bx * sf, H = 37 * by * sf;
  const shape = ch.shape || 'pat';
  if (shape === 'puff')  { W *= 0.9;  H *= 1.16; }
  if (shape === 'bean')  { W *= 0.88; H *= 1.06; }
  if (shape === 'peach') { W *= 1.04; H *= 1.06; }
  if (shape === 'drop')  { W *= 0.98; H *= 1.18; }
  c.rotate(rot); c.translate(0, dy);
  if (spin) { c.translate(0, -H * 0.5); c.rotate(spin); c.translate(0, H * 0.5); }   // flip about the body's middle
  const bodyPath = () => {
    if (shape === 'puff') { rr(c, -W / 2, -H, W, H * 0.97, W * 0.44); return; }
    c.beginPath();
    if (shape === 'bean') {
      c.ellipse(0, -H * 0.5, W / 2, H * 0.5, 0, 0, Math.PI * 2);
    } else if (shape === 'peach') {        // two soft lobes meeting at a cleft
      c.moveTo(0, -H * 0.88);
      c.bezierCurveTo(-W * 0.2, -H * 1.04, -W * 0.56, -H * 0.98, -W * 0.52, -H * 0.5);
      c.bezierCurveTo(-W * 0.5, -H * 0.08, -W * 0.22, 0, 0, 0);
      c.bezierCurveTo(W * 0.22, 0, W * 0.5, -H * 0.08, W * 0.52, -H * 0.5);
      c.bezierCurveTo(W * 0.56, -H * 0.98, W * 0.2, -H * 1.04, 0, -H * 0.88);
    } else if (shape === 'drop') {         // dewdrop, point up
      c.moveTo(0, -H);
      c.bezierCurveTo(W * 0.16, -H * 0.8, W * 0.52, -H * 0.64, W * 0.52, -H * 0.36);
      c.bezierCurveTo(W * 0.52, -H * 0.06, W * 0.26, 0, 0, 0);
      c.bezierCurveTo(-W * 0.26, 0, -W * 0.52, -H * 0.06, -W * 0.52, -H * 0.36);
      c.bezierCurveTo(-W * 0.52, -H * 0.64, -W * 0.16, -H * 0.8, 0, -H);
    } else {
      rr(c, -W / 2, -H, W, H * 0.96, Math.min(15 * bx, 17)); return;
    }
    c.closePath();
  };

  // ---- ground shadow (not while flipping — it would spin with the body) ----
  if (!spin) {
    c.fillStyle = 'rgba(74,53,36,.14)';
    c.beginPath(); c.ellipse(0, 1, W * 0.62, 5.5, 0, 0, 7); c.fill();
  }

  // ---- glow aura ----
  // soft radial falloff (no hard edge when the aura meets the canvas edge)
  const glowA = 0.32 + Math.sin(t * 3) * 0.1;
  c.save();
  c.translate(0, -H * 0.42); c.scale(1, (H * 0.8) / (W * 1.05));
  const gr = c.createRadialGradient(0, 0, 0, 0, 0, W * 1.05);
  gr.addColorStop(0, ch.glow); gr.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = gr; c.globalAlpha = glowA;
  c.beginPath(); c.arc(0, 0, W * 1.05, 0, Math.PI * 2); c.fill();
  c.restore();

  // ---- feet (visible stubs, animate while running) ----
  const step = pose === 'run' ? Math.sin(t * 14) * 4.5 * Math.min(swingK, 1.4) : 0;
  c.fillStyle = bodyD;
  rr(c, -14 + step, -6.5, 13, 8.5, 4.2); c.fill();
  rr(c, 1 - step, -6.5, 13, 8.5, 4.2); c.fill();

  // ---- arms (tiny nubs; raise on win/jump/collect) ----
  const armUp = pose === 'win' || pose === 'jump' || pose === 'collect';
  const swing = pose === 'run' ? Math.sin(t * 14) * 4 * swingK : Math.sin(t * 2.4) * 1.2;
  c.strokeStyle = body; c.lineWidth = 7.5; c.lineCap = 'round';
  c.beginPath();
  c.moveTo(-W / 2 + 1, -H * 0.55);
  c.lineTo(-W / 2 - 4 + (armUp ? -3 : swing), -H * (armUp ? 0.94 : 0.66));
  c.stroke();
  c.beginPath();
  c.moveTo(W / 2 - 1, -H * 0.55);
  c.lineTo(W / 2 + 4 - (armUp ? -3 : swing), -H * (armUp ? 0.94 : 0.66));
  c.stroke();

  // ---- body: per-spirit silhouette, thick darker border ----
  c.fillStyle = body; bodyPath(); c.fill();
  // soft top-light, clipped to the silhouette
  c.save(); bodyPath(); c.clip();
  c.fillStyle = 'rgba(255,255,255,.28)';
  rr(c, -W * 0.36, -H + 4, W * 0.5, H * 0.28, 8); c.fill();
  c.restore();
  c.strokeStyle = bodyD; c.lineWidth = 4.4; c.lineJoin = 'round';
  bodyPath(); c.stroke();
  if (shape === 'peach') {                 // the peach cleft
    c.strokeStyle = bodyD; c.lineWidth = 2.4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, -H * 0.86); c.quadraticCurveTo(-4, -H * 0.78, -3, -H * 0.7); c.stroke();
  }

  // ---- face ----
  const look = s.look === 'r' ? 1.4 : s.look === 'l' ? -1.4 : 0;
  const eyeY = -H * 0.66;
  const blink = s.blink > 0.93;
  const worried = pose === 'lose' || pose === 'slip';
  c.fillStyle = '#3a2c22';
  if (blink) {                       // closed: sleepy lines
    rr(c, -10 + look, eyeY, 7, 2.6, 1.3); c.fill();
    rr(c, 3 + look, eyeY, 7, 2.6, 1.3); c.fill();
  } else if (worried) {              // round worried eyes, wider
    c.beginPath(); c.arc(-6.5 + look, eyeY, 2.8, 0, 7); c.fill();
    c.beginPath(); c.arc(6.5 + look, eyeY, 2.8, 0, 7); c.fill();
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(-5.6 + look, eyeY - 1, 1, 0, 7); c.fill();
    c.beginPath(); c.arc(7.4 + look, eyeY - 1, 1, 0, 7); c.fill();
  } else if (ch.eyes === 'bright') {  // tall shiny ovals + brave little brows
    for (const ex of [-7, 7]) {
      c.fillStyle = '#3a2c22';
      c.beginPath(); c.ellipse(ex + look, eyeY, 3, 4.4, 0, 0, 7); c.fill();
      c.fillStyle = '#fff';
      c.beginPath(); c.ellipse(ex + look + 0.9, eyeY - 1.8, 1.2, 1.5, 0, 0, 7); c.fill();
    }
    c.strokeStyle = '#3a2c22'; c.lineWidth = 2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-10 + look, eyeY - 8.2); c.lineTo(-4.4 + look, eyeY - 6.8); c.stroke();
    c.beginPath(); c.moveTo(10 + look, eyeY - 8.2); c.lineTo(4.4 + look, eyeY - 6.8); c.stroke();
  } else if (ch.eyes === 'sleepy') {  // closed, contented arcs
    c.strokeStyle = '#3a2c22'; c.lineWidth = 2.4; c.lineCap = 'round';
    for (const ex of [-6.5, 6.5]) {
      c.beginPath(); c.arc(ex + look, eyeY - 1.5, 3.4, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
    }
  } else if (ch.eyes === 'big') {     // big shiny eyes
    for (const ex of [-7, 7]) {
      c.fillStyle = '#3a2c22'; c.beginPath(); c.arc(ex + look, eyeY, 4.8, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(ex + look + 1.4, eyeY - 1.6, 1.7, 0, 7); c.fill();
    }
  } else if (ch.eyes === 'sparkle') { // eyes with a twinkle
    for (const ex of [-6.5, 6.5]) {
      c.fillStyle = '#3a2c22'; c.beginPath(); c.arc(ex + look, eyeY, 3.9, 0, 7); c.fill();
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(ex + look + 1.2, eyeY - 1.3, 1.4, 0, 7); c.fill();
      c.beginPath(); c.arc(ex + look - 1.3, eyeY + 1.4, 0.8, 0, 7); c.fill();
    }
  } else if (ch.eyes === 'calm') {    // relaxed half-lidded eyes
    for (const ex of [-6.5, 6.5]) {
      c.beginPath(); c.arc(ex + look, eyeY - 1, 3.6, 0, Math.PI); c.closePath(); c.fill();
    }
  } else {                           // the classic small dot eyes
    c.beginPath(); c.arc(-6.5 + look, eyeY, 3.4, 0, 7); c.fill();
    c.beginPath(); c.arc(6.5 + look, eyeY, 3.4, 0, 7); c.fill();
  }
  // blush (prototype pink dashes)
  c.fillStyle = ch.cheek; c.globalAlpha = 0.85;
  c.beginPath(); c.ellipse(-11 + look, -H * 0.5, 4.2, 2.2, 0, 0, 7); c.fill();
  c.beginPath(); c.ellipse(11 + look, -H * 0.5, 4.2, 2.2, 0, 0, 7); c.fill();
  c.globalAlpha = 1;
  // mouth
  c.strokeStyle = '#3a2c22'; c.lineWidth = 2.2; c.lineCap = 'round';
  c.beginPath();
  if (pose === 'win' || pose === 'collect') {          // open joyful
    c.ellipse(look, -H * 0.42, 3.2, 4, 0, 0, Math.PI);
  } else if (worried) {
    c.ellipse(look, -H * 0.36, 2.4, 2.8, 0, 0, 7);      // little o
  } else if (ch.mouth === 'grin') {                     // big open grin
    c.moveTo(-4.6 + look, -H * 0.46);
    c.quadraticCurveTo(look, -H * 0.3, 4.6 + look, -H * 0.46); c.closePath();
    c.fillStyle = '#7a3a3a'; c.fill();
  } else if (ch.mouth === 'tiny') {                     // small sleepy smile
    c.moveTo(-2 + look, -H * 0.46);
    c.quadraticCurveTo(look, -H * 0.43, 2 + look, -H * 0.46);
  } else if (ch.mouth === 'flat') {                     // calm, barely-there line
    c.moveTo(-2.8 + look, -H * 0.45); c.lineTo(2.8 + look, -H * 0.45);
  } else {
    c.moveTo(-3.4 + look, -H * 0.47);
    c.quadraticCurveTo(look, -H * 0.43, 3.4 + look, -H * 0.47);
  }
  c.stroke();

  // ---- accessory (distinct per spirit; tinted by start.ng colours) ----
  const acc = tint?.primary || ch.accent;
  const ac = ch.accessory;
  if (ac === 'leaf') {
    c.fillStyle = acc;
    c.beginPath(); c.ellipse(3, -H - 5, 10.5, 5.6, 0.5, 0, 7); c.fill();
    c.strokeStyle = '#4e7a5b'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(-3, -H - 5.6); c.lineTo(9.5, -H - 3.6); c.stroke();
  }
  if (ac === 'nightcap') {
    c.fillStyle = tint?.primary || '#b79adf';
    c.beginPath(); c.moveTo(-13, -H - 2); c.quadraticCurveTo(2, -H - 24, 15, -H - 3); c.closePath(); c.fill();
    c.strokeStyle = tint?.primary; c.lineWidth = 2.4; c.stroke();
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(14, -H - 4, 3.2, 0, 7); c.fill();
  }
  if (ac === 'acorn') {
    c.fillStyle = '#96612f';
    c.beginPath(); c.arc(1, -H - 4, 9.5, Math.PI, 0); c.fill();
    c.strokeStyle = '#7a4a22'; c.lineWidth = 2; c.stroke();
    c.fillStyle = tint?.primary || '#c98a4b';
    rr(c, -10.5, -H - 6.5, 23, 5.4, 2.7); c.fill();
    c.fillStyle = '#96612f'; c.fillRect(-0.8, -H - 14, 3.6, 4.4);
  }
  if (ac === 'scarf') {
    c.fillStyle = tint?.primary || '#f9737f';
    rr(c, -W / 2 - 1, -H * 0.36, W + 2, 8, 4); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 2; rr(c, -W / 2 - 1, -H * 0.36, W + 2, 8, 4); c.stroke();
    c.fillStyle = tint?.hair || acc;
    rr(c, W / 2 - 5, -H * 0.36 + 5, 7, 13, 3.4); c.fill();
  }
  if (ac === 'flower') {
    const px = shape === 'drop' ? 11 : 9, py = shape === 'drop' ? -H * 0.8 : -H - 3;
    c.fillStyle = tint?.primary || '#f6a6b2';
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2 - 0.6;
      c.beginPath(); c.ellipse(px + Math.cos(a) * 4.4, py + Math.sin(a) * 4.4, 3, 3, 0, 0, 7); c.fill();
    }
    c.fillStyle = '#ffe9a8'; c.beginPath(); c.arc(px, py, 2.4, 0, 7); c.fill();
    c.strokeStyle = '#5fae8d'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(px - 1, py + 3); c.lineTo(px - 3, py + 9); c.stroke();
  }
  if (tint?.hair) {           // start.ng hair colour as a small tuft
    c.fillStyle = tint.hair; c.globalAlpha = 0.9;
    c.beginPath(); c.arc(-8, -H - 4, 2.8, 0, 7); c.fill();
    c.globalAlpha = 1;
  }

  // ---- glowing wick mark (the title's heartbeat) ----
  const mk = 0.55 + Math.sin(t * 2.2 + 1) * 0.45;
  c.fillStyle = ch.glow; c.globalAlpha = 0.85 * mk;
  c.beginPath(); c.ellipse(0, -H * 0.22, 3, 3.8, 0, 0, 7); c.fill();
  c.globalAlpha = 1;

  c.restore();
};

/** Flip angle while airborne after a jump, for tier-3+ spirits: driven by
 *  vertical speed, so one full turn (two for tier 4) lands as the fall
 *  speeds up. `jumps` counts the double hop as a second set of turns. */
WW.flipAngle = (ch, vy, jumps, dir) => {
  const tier = ch.anim || 0;
  if (tier < 3 || !jumps) return 0;
  const jv = WW.Physics.TUNE.jumpV;
  const ph = Math.min(1, Math.max(0, (jv - vy) / (2 * jv)));
  return dir * (ph + jumps - 1) * (tier >= 4 ? 2 : 1) * Math.PI * 2;
};

/* ================================================================
 * §3  Hazards & surface decals — outlined so threats read fast
 * ================================================================ */
/* Hazards get the darkest outline in the scene (HZ) at a heavier weight
 * than background props, plus saturated fills, so they pop off the
 * pastel kitchen. Canvas sizes are unchanged so hitboxes still match. */
const HZ = 'rgba(78, 50, 28, .95)';
const HZW = 3.6;

WW.tex('hz-flour', 96, 40, (c) => {
  const puff = () => {
    c.beginPath();
    for (const [x, y, rx, ry] of [[48, 28, 42, 10], [25, 18, 15, 11], [66, 17, 18, 12], [45, 12, 14, 10]]) {
      c.moveTo(x + rx, y); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    }
  };
  // outline pass: stroke the whole silhouette, then fill over the inner lines
  c.strokeStyle = HZ; c.lineWidth = HZW * 1.6; c.lineJoin = 'round';
  puff(); c.stroke();
  c.fillStyle = '#ffffff'; puff(); c.fill();
  // shading so the pile has volume against the cream counter
  c.fillStyle = '#e3cfae';
  c.beginPath(); c.ellipse(48, 31, 38, 5, 0, 0, 7); c.fill();
  c.fillStyle = 'rgba(214,186,150,.6)';
  c.beginPath(); c.ellipse(70, 21, 10, 5, 0, 0, 7); c.fill();
  c.beginPath(); c.ellipse(30, 22, 8, 4, 0, 0, 7); c.fill();
  // drifting specks
  c.fillStyle = HZ;
  for (const [x, y] of [[10, 9], [86, 7], [80, 3]]) { c.beginPath(); c.arc(x, y, 1.8, 0, 7); c.fill(); }
});

WW.tex('hz-pin', 130, 62, (c) => {
  c.lineJoin = 'round';
  c.fillStyle = '#e39a4f'; rr(c, 14, 18, 100, 28, 14); c.fill();
  c.strokeStyle = HZ; c.lineWidth = HZW; rr(c, 14, 18, 100, 28, 14); c.stroke();
  c.fillStyle = '#f2c48b'; rr(c, 22, 22, 84, 8, 4); c.fill();
  c.fillStyle = '#7a4a22';
  rr(c, 0, 24, 20, 16, 8); c.fill();
  c.strokeStyle = HZ; c.lineWidth = HZW * 0.8; rr(c, 0, 24, 20, 16, 8); c.stroke();
  c.fillStyle = '#7a4a22';
  rr(c, 108, 24, 20, 16, 8); c.fill();
  c.strokeStyle = HZ; rr(c, 108, 24, 20, 16, 8); c.stroke();
  c.strokeStyle = 'rgba(122,74,34,.75)'; c.lineWidth = 2.4;
  for (const x of [40, 62, 84]) { c.beginPath(); c.moveTo(x, 21); c.lineTo(x, 43); c.stroke(); }
});

const Puddle = (key, deep, mid, shine, rim) => WW.tex(key, 200, 46, (c) => {
  const blob = () => {
    c.beginPath(); c.moveTo(10, 34);
    c.quadraticCurveTo(28, 14, 62, 22); c.quadraticCurveTo(96, 8, 136, 22);
    c.quadraticCurveTo(172, 13, 190, 34);
    c.quadraticCurveTo(100, 46, 10, 34); c.closePath();
  };
  c.lineJoin = 'round';
  c.fillStyle = mid; blob(); c.fill();
  c.fillStyle = deep;
  c.beginPath(); c.ellipse(100, 36, 84, 6, 0, 0, 7); c.fill();
  c.strokeStyle = rim; c.lineWidth = HZW; blob(); c.stroke();
  c.fillStyle = shine;
  c.beginPath(); c.ellipse(56, 24, 14, 3.6, -0.2, 0, 7); c.fill();
  c.beginPath(); c.ellipse(132, 25, 10, 2.8, 0.2, 0, 7); c.fill();
});
Puddle('hz-butter', '#e0a91c', '#ffcf3f', '#fff6d2', '#9a6a0c');
Puddle('hz-milk', '#a9cbe6', '#e3f1fb', '#ffffff', '#4f7fa6');
Puddle('hz-jam', '#7a2238', '#b8405c', '#f0a0b4', '#5c1528');

WW.tex('hz-jamdrop', 60, 42, (c) => {
  const drop = () => {
    c.beginPath();
    c.moveTo(53, 27); c.ellipse(30, 27, 23, 12, 0, 0, Math.PI * 2);
    c.moveTo(42, 17); c.ellipse(30, 17, 12, 11, 0, 0, Math.PI * 2);
  };
  c.strokeStyle = '#5c1528'; c.lineWidth = HZW * 1.5; drop(); c.stroke();
  c.fillStyle = '#b8405c'; drop(); c.fill();
  c.fillStyle = '#8c2f47';
  c.beginPath(); c.ellipse(30, 32, 18, 4, 0, 0, 7); c.fill();
  c.fillStyle = '#f0a0b4';
  c.beginPath(); c.ellipse(24, 14, 5, 3, -0.3, 0, 7); c.fill();
});

/* The fan is just its spinning blades (drawn at 2x for a crisp spin). */
const paintFanBlades = (c, cx, cy) => {
  for (const a of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) {
    c.save(); c.translate(cx, cy); c.rotate(a);
    c.fillStyle = '#8ec3de';
    c.beginPath(); c.ellipse(0, -13, 5.5, 11, 0, 0, 7); c.fill();
    c.strokeStyle = '#3f525c'; c.lineWidth = 2;
    c.beginPath(); c.ellipse(0, -13, 5.5, 11, 0, 0, 7); c.stroke();
    c.restore();
  }
  c.fillStyle = '#3f525c'; c.beginPath(); c.arc(cx, cy, 4.5, 0, 7); c.fill();
};
WW.tex('hz-fan-blades', 104, 104, (c) => { c.scale(2, 2); paintFanBlades(c, 26, 26); });

/* Breeze FX: a tapered gust (head on the left, the way it blows) and a
 * chevron arrow. Blue with a white core so it reads on the cream kitchen. */
WW.tex('fx-gust', 128, 24, (c) => {
  const streak = (lw, col) => {
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(124, 12);
    c.quadraticCurveTo(60, 12 - lw * 0.35, 14, 12 - lw / 2);
    c.arc(14, 12, lw / 2, -Math.PI / 2, Math.PI / 2, true);
    c.quadraticCurveTo(60, 12 + lw * 0.35, 124, 12);
    c.closePath(); c.fill();
  };
  streak(15, 'rgba(63,110,150,.95)');
  streak(7, 'rgba(255,255,255,.95)');
  // little curl at the head
  c.strokeStyle = 'rgba(63,110,150,.95)'; c.lineWidth = 3.4; c.lineCap = 'round';
  c.beginPath(); c.arc(14, 6, 6, Math.PI * 0.5, Math.PI * 1.6); c.stroke();
});
WW.tex('fx-chevron', 32, 32, (c) => {
  c.lineCap = 'round'; c.lineJoin = 'round';
  const chev = (lw, col) => {
    c.strokeStyle = col; c.lineWidth = lw;
    c.beginPath(); c.moveTo(22, 6); c.lineTo(9, 16); c.lineTo(22, 26); c.stroke();
  };
  chev(9, 'rgba(63,110,150,.95)');
  chev(4, '#ffffff');
});

/** Soft contact shadow placed under standing hazards so they sit on the
 *  counter instead of floating over it. */
WW.tex('hz-shadow', 100, 20, (c) => {
  c.fillStyle = 'rgba(78,50,28,.28)';
  c.beginPath(); c.ellipse(50, 10, 48, 8, 0, 0, 7); c.fill();
});

/* ================================================================
 * §4  Collectibles + goal
 * ================================================================ */
/** Coin pickup — same look as the HUD coin so players connect the two. */
WW.tex('co-spark', 44, 44, (c) => {
  c.fillStyle = '#ffd25e';
  c.beginPath(); c.arc(22, 22, 19, 0, 7); c.fill();
  c.strokeStyle = '#b8791f'; c.lineWidth = 3; c.stroke();
  c.strokeStyle = 'rgba(184,121,31,.55)'; c.lineWidth = 2;
  c.beginPath(); c.arc(22, 22, 13.5, 0, 7); c.stroke();
  c.fillStyle = '#c98a1e';
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 8 : 3.6;
    const x = 22 + Math.cos(a) * r, y = 22 + Math.sin(a) * r;
    i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
  }
  c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,.75)';
  c.beginPath(); c.ellipse(14, 13, 4.5, 2.6, -0.7, 0, 7); c.fill();
});

WW.tex('co-gem', 40, 40, (c) => {
  c.fillStyle = '#c7b8e8';
  c.beginPath(); c.moveTo(20, 3); c.lineTo(35, 14); c.lineTo(29, 36); c.lineTo(11, 36); c.lineTo(5, 14);
  c.closePath(); c.fill();
  c.strokeStyle = '#8f74c9'; c.lineWidth = 2.2; c.stroke();
  c.fillStyle = '#e8dcf7';
  c.beginPath(); c.moveTo(20, 3); c.lineTo(27, 14); c.lineTo(13, 14); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,.5)';
  c.beginPath(); c.ellipse(15, 22, 4, 2.4, .5, 0, 7); c.fill();
});

WW.tex('goal-lantern', 92, 130, (c) => {
  c.fillStyle = '#8f74c9'; rr(c, 30, 0, 32, 26, 8); c.fill();
  c.strokeStyle = '#6c55a6'; c.lineWidth = 2.4; rr(c, 30, 0, 32, 26, 8); c.stroke();
  c.fillStyle = P.metal;
  rr(c, 22, 26, 50, 84, 12); c.fill();
  c.strokeStyle = '#7d8d97'; c.lineWidth = 2.6; rr(c, 22, 26, 50, 84, 12); c.stroke();
  c.fillStyle = '#aebfc9'; rr(c, 27, 31, 40, 74, 9); c.fill();
  c.fillStyle = '#7fa3b8'; rr(c, 33, 38, 28, 60, 6); c.fill();
  c.strokeStyle = 'rgba(80,110,140,.5)'; c.lineWidth = 2; rr(c, 33, 38, 28, 60, 6); c.stroke();
  c.fillStyle = P.metal; rr(c, 18, 106, 58, 18, 8); c.fill();
  c.strokeStyle = '#7d8d97'; c.lineWidth = 2.4; rr(c, 18, 106, 58, 18, 8); c.stroke();
});
WW.tex('goal-flame', 40, 52, (c) => {
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
 * §5  Countertop clutter on the back edge (outlined, smallish)
 * ================================================================ */
WW.tex('props-mini', 560, 120, (c, w) => {
  const R = WW.rng(99);
  let x = 10;
  while (x < w - 74) {
    const k = R();
    if (k < .28) {        // outline jam/preserves jar
      const col = R() < .5 ? '#e07d8b' : '#c96f3d';
      c.fillStyle = col; rr(c, x, 66, 32, 46, 9); c.fill();
      c.strokeStyle = 'rgba(90,60,35,.8)'; c.lineWidth = 2.4; rr(c, x, 66, 32, 46, 9); c.stroke();
      c.fillStyle = '#fff6e2'; rr(c, x - 2, 58, 36, 12, 5); c.fill();
      c.strokeStyle = 'rgba(90,60,35,.8)'; rr(c, x - 2, 58, 36, 12, 5); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.4)'; rr(c, x + 5, 74, 6, 18, 3); c.fill();
      x += 46;
    } else if (k < .55) {  // potted herb with outline
      c.fillStyle = '#d1794f'; rr(c, x, 84, 26, 28, 6); c.fill();
      c.strokeStyle = 'rgba(90,60,35,.8)'; rr(c, x, 84, 26, 28, 6); c.stroke();
      c.fillStyle = '#5fae8d';
      c.beginPath(); c.ellipse(x + 13, 68, 11, 14, 0, 0, 7); c.fill();
      c.strokeStyle = 'rgba(60,110,85,.85)'; c.lineWidth = 2;
      c.beginPath(); c.ellipse(x + 13, 68, 11, 14, 0, 0, 7); c.stroke();
      c.fillRect(x + 11, 76, 4, 8);
      x += 40;
    } else if (k < .78) {  // stacked cups
      c.fillStyle = '#fff4e0'; rr(c, x, 92, 30, 20, 6); c.fill();
      c.strokeStyle = 'rgba(90,60,35,.8)'; rr(c, x, 92, 30, 20, 6); c.stroke();
      c.fillStyle = P.peach; rr(c, x + 2, 76, 26, 17, 6); c.fill();
      c.strokeStyle = 'rgba(90,60,35,.8)'; rr(c, x + 2, 76, 26, 17, 6); c.stroke();
      x += 44;
    } else {               // little sugar bowl
      c.fillStyle = '#9ec8ef'; rr(c, x, 84, 30, 30, 8); c.fill();
      c.strokeStyle = 'rgba(70,90,120,.85)'; rr(c, x, 84, 30, 30, 8); c.stroke();
      c.fillStyle = '#fff'; rr(c, x - 2, 78, 34, 10, 5); c.fill();
      c.strokeStyle = 'rgba(70,90,120,.85)'; rr(c, x - 2, 78, 34, 10, 5); c.stroke();
      x += 46;
    }
    x += 12 + R() * 26;
  }
});
})();
