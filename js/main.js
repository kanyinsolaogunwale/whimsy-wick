/**
 * Whimsy Wick — js/main.js (entrypoint)
 * ---------------------------------------------------------------
 * Boot order: THREE (local module) → tools → art → game wiring.
 * Plain static ES modules — no build step needed (docs §rules).
 */
import * as THREE from '../lib/three.module.min.js';
window.THREE = THREE;

/* ?v=6 cache-bust: the browser must re-fetch the edited modules. */
import './base/core.js?v=6';
import './world/art.js?v=6';
import './characters/define.js?v=6';
import './world/physics.js?v=6';
import './levels/story.js?v=6';
import './game/input.js?v=6';
import './sound/audio.js?v=6';
import './game/persist.js?v=6';
import './game/startng.js?v=6';
import './render/engine.js?v=6';
import './ui/ui.js?v=6';
import './game/game.js?v=6';

window.__game = window.WW.createGame(document.getElementById('game'));
window.__booted = true;
