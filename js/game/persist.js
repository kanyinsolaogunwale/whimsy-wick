/**
 * Whimsy Wick — js/game/persist.js
 * ---------------------------------------------------------------
 * Local save (docs "Good to know": personal data lives in localStorage).
 * Versioned + corruption-safe: an unreadable save is discarded once and
 * rebuilt fresh rather than crashing anything.
 */
(() => {
'use strict';
const WW = window.WW;

const KEY = 'whimsy-wick-save-v1';
const fresh = () => ({
  v: 1,
  settings: { music: 0.7, sfx: 0.8, mute: false, gestureHints: true, reducedMotion: false },
  character: 'ghee',
  story: { completed: [], sparks: {}, gems: {} },   // by level id
  wallet: { coins: 0, gems: 0 },                    // earned currencies (future shop)
  tutorialDone: false,
  gestureHintDone: false,
  endless: { best: 0, bestDistance: 0 },
  hintSeen: {},                                    // per-hazard hints learned
});

let cur = null;

const read = () => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object' || !o.v) return null;
    return o;
  } catch { return null; }
};

WW.persist = {
  load() {
    cur = read() || fresh();
    // merge-forward defaults for any missing keys
    const f = fresh();
    cur.settings = { ...f.settings, ...cur.settings };
    cur.story = { ...f.story, ...cur.story };
    cur.endless = { ...f.endless, ...cur.endless };
    cur.hintSeen = { ...f.hintSeen, ...(cur.hintSeen || {}) };
    cur.wallet = { coins: (cur.wallet && cur.wallet.coins) || 0, gems: (cur.wallet && cur.wallet.gems) || 0 };
    cur.tutorialDone = !!cur.tutorialDone;
    cur.gestureHintDone = !!cur.gestureHintDone;
    cur.character = typeof cur.character === 'string' ? cur.character : f.character;
    return cur;
  },
  save() { try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch { /* storage off — game still fully playable */ } },
  get data() { return cur; },
  reset() { cur = fresh(); WW.persist.save(); return cur; },
};
})();
