/**
 * Whimsy Wick — js/game/input.js
 * ---------------------------------------------------------------
 * §9 of the assignment: mobile is gestures-only — tap = jump,
 * horizontal drag = move. No visible movement buttons.
 * Desktop keeps keyboard. Gesture state refreshes on pointer loss,
 * tab switch, and pause so nothing sticks.
 */
(() => {
'use strict';
const WW = window.WW;

WW.Input = (canvasEl) => {
  const st = { move: 0, jumpHeld: false };
  const keys = new Set();
  let enabled = false;
  let jumpDispatch = null;      // set by game
  let anyEvent = null;

  // ---- keyboard ----
  addEventListener('keydown', (e) => {
    if (!enabled) return;
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.add('L');
    if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.add('R');
    if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W') {
      e.preventDefault();
      if (!keys.has('J')) { keys.add('J'); st.jumpHeld = true; jumpDispatch && jumpDispatch(); anyEvent && anyEvent('jump'); }
    }
    if (k === 'Escape' || k === 'p' || k === 'P') { anyEvent && anyEvent('pause'); }
    sync();
  });
  addEventListener('keyup', (e) => {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.delete('L');
    if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.delete('R');
    if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W') { keys.delete('J'); st.jumpHeld = keys.has('J'); }
    sync();
  });
  const sync = () => { st.move = (keys.has('R') ? 1 : 0) - (keys.has('L') ? 1 : 0); };

  // ---- gestures on gameplay area only ----
  let dragId = null, dragX0 = 0, dragT0 = 0, dragMoved = false;

  const isGamepoint = (e) => enabled && !e.target.closest('.ui-block');

  canvasEl.addEventListener('pointerdown', (e) => {
    if (!isGamepoint(e)) return;
    try { canvasEl.setPointerCapture(e.pointerId); } catch { /* synthetic/locked pointer */ }
    dragId = e.pointerId; dragX0 = e.clientX; dragT0 = performance.now(); dragMoved = false;
    e.preventDefault();
  });
  canvasEl.addEventListener('pointermove', (e) => {
    if (dragId !== e.pointerId) return;
    const dx = e.clientX - dragX0;
    if (!dragMoved && Math.abs(dx) > WW.GESTURE_THRESHOLD) dragMoved = true;
    if (dragMoved) {
      st.move = WW.math.clamp(dx / 70, -1, 1);
      anyEvent && anyEvent('move');
    }
    e.preventDefault();
  });
  const endDrag = (e) => {
    if (dragId === null || e.pointerId !== dragId) return;
    if (!dragMoved && performance.now() - dragT0 < 260) {   // clean tap
      st.jumpHeld = true;
      jumpDispatch && jumpDispatch();
      anyEvent && anyEvent('jump');
      setTimeout(() => { st.jumpHeld = keys.has('J'); }, 90);
    }
    dragId = null; st.move = 0; sync();
  };
  canvasEl.addEventListener('pointerup', endDrag);
  canvasEl.addEventListener('pointercancel', (e) => { if (dragId === e.pointerId) { dragId = null; st.move = 0; st.jumpHeld = keys.has('J'); } });
  canvasEl.addEventListener('contextmenu', (e) => e.preventDefault());
  // stop browser scroll/select on the canvas
  canvasEl.style.touchAction = 'none';

  // ---- context: pause on focus loss so nothing sticks ----
  addEventListener('blur', () => { st.move = 0; st.jumpHeld = false; keys.clear(); anyEvent && anyEvent('blur'); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { st.move = 0; st.jumpHeld = false; keys.clear(); anyEvent && anyEvent('blur'); }
    else { anyEvent && anyEvent('focus'); }
  });

  return {
    st,
    setEnabled(v) { enabled = v; if (!v) { st.move = 0; st.jumpHeld = false; keys.clear(); } },
    onJump(fn) { jumpDispatch = fn; },
    onAny(fn) { anyEvent = fn; },
  };
};
})();
