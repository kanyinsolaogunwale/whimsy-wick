/**
 * Whimsy Wick, js/game/input.js
 * ---------------------------------------------------------------
 * §9 of the assignment: mobile is gestures-only. Ghee trots forward on
 * their own, so hopping is the one control: tap = hop, hold = a higher
 * hop, tap again mid-air for the double hop. No movement buttons, no
 * drag. Desktop keeps keyboard: Space / ↑ / W to hop, Esc / P to pause.
 * Gesture state refreshes on pointer loss, tab switch, and pause so
 * nothing sticks.
 */
(() => {
'use strict';
const WW = window.WW;

WW.Input = (canvasEl) => {
  const st = { move: 0, jumpHeld: false };
  let enabled = false;
  let jumpDispatch = null;      // set by game
  let anyEvent = null;
  let keyHeld = false;          // keyboard hop currently held
  let pressId = null;           // touch/pointer currently held

  // the canvas must be focusable so keydowns land on the game even in
  // embedded/desktop panes that keep keyboard focus on the host page
  canvasEl.tabIndex = 0;
  canvasEl.style.outline = 'none';

  // ---- keyboard: hop + pause (Ghee moves on their own) ----
  let lastPauseSig = 0;
  const firePause = () => {
    /* one signal per keypress: the capture net and the bubble listener
     * both see the same key, so collapse anything within 150ms */
    const t = performance.now();
    if (t - lastPauseSig < 150) return;
    lastPauseSig = t;
    anyEvent && anyEvent('pause');
  };
  const handleKey = (e, canvasTargeted) => {
    const k = e.key;
    /* Esc / P must answer even while the input is off (the pause screen
     * itself disables gameplay keys), so the same key un-pauses too */
    if (k === 'Escape' || k === 'p' || k === 'P') { firePause(); return; }
    if (!enabled) return;
    if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W') {
      if (canvasTargeted) e.preventDefault();
      if (!keyHeld) { keyHeld = true; st.jumpHeld = true; jumpDispatch && jumpDispatch(); anyEvent && anyEvent('jump'); }
    }
  };
  /* capture-phase net for the pause key: it runs before anything else on
   * the page can swallow Esc/P (browser tooling, focus layers) */
  addEventListener('keydown', (e) => {
    const k = e.key;
    if (k === 'Escape' || k === 'p' || k === 'P') firePause();
  }, true);
  /* the same handler on the window AND on the canvas: whichever surface
   * actually holds keyboard focus gets the key. The keyHeld guard makes a
   * double delivery (canvas ⊂ window bubbling) harmless. */
  addEventListener('keydown', (e) => handleKey(e, false));
  canvasEl.addEventListener('keydown', (e) => handleKey(e, true));
  addEventListener('keyup', (e) => {
    const k = e.key;
    if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W') {
      keyHeld = false;
      st.jumpHeld = pressId !== null;   // a touch press may still be holding
    }
  });

  // ---- gestures on gameplay area only: tap or hold = hop ----
  const isGamepoint = (e) => enabled && !e.target.closest('.ui-block');

  canvasEl.addEventListener('pointerdown', (e) => {
    if (!isGamepoint(e) || pressId !== null) return;
    try { canvasEl.setPointerCapture(e.pointerId); } catch { /* synthetic/locked pointer */ }
    canvasEl.focus({ preventScroll: true });   // keys follow wherever the player just touched
    pressId = e.pointerId;
    st.jumpHeld = true;
    jumpDispatch && jumpDispatch();
    anyEvent && anyEvent('jump');
    e.preventDefault();
  });
  const endPress = (e) => {
    if (pressId === null || e.pointerId !== pressId) return;
    pressId = null;
    st.jumpHeld = keyHeld;
  };
  canvasEl.addEventListener('pointerup', endPress);
  canvasEl.addEventListener('pointercancel', (e) => { if (e.pointerId === pressId) { pressId = null; st.jumpHeld = false; } });
  canvasEl.addEventListener('contextmenu', (e) => e.preventDefault());
  // stop browser scroll/select on the canvas
  canvasEl.style.touchAction = 'none';

  // ---- context: pause on focus loss so nothing sticks ----
  addEventListener('blur', () => { pressId = null; keyHeld = false; st.jumpHeld = false; anyEvent && anyEvent('blur'); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pressId = null; keyHeld = false; st.jumpHeld = false; anyEvent && anyEvent('blur'); }
    else { anyEvent && anyEvent('focus'); }
  });

  return {
    st,
    setEnabled(v) { enabled = v; if (!v) { pressId = null; keyHeld = false; st.jumpHeld = false; } },
    onJump(fn) { jumpDispatch = fn; },
    onAny(fn) { anyEvent = fn; },
  };
};
})();
