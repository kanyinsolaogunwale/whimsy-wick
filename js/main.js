/**
 * Whimsy Wick, js/main.js (entrypoint)
 * ---------------------------------------------------------------
 * Boot order: THREE (local module) → tools → art → game wiring.
 * Plain static ES modules, no build step needed (docs §rules).
 */
import * as THREE from '../lib/three.module.min.js';
window.THREE = THREE;

/* ?v=17 cache-bust: the browser must re-fetch the edited modules. */
import './base/core.js?v=17';
import './world/art.js?v=17';
import './characters/define.js?v=17';
import './world/physics.js?v=17';
import './levels/story.js?v=17';
import './game/input.js?v=17';
import './sound/audio.js?v=17';
import './game/persist.js?v=17';
import './game/startng.js?v=17';
import './game/recipes.js?v=17';
import './mini/cook.js?v=17';
import './render/engine.js?v=17';
import './ui/ui.js?v=25';
import './game/game.js?v=18';

window.__game = window.WW.createGame(document.getElementById('game'));
window.__booted = true;
