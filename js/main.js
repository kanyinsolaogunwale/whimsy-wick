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
import './world/art.js?v=20';
import './characters/define.js?v=17';
import './world/physics.js?v=17';
import './levels/story.js?v=20';
import './game/input.js?v=19';
import './sound/audio.js?v=17';
import './game/persist.js?v=18';
import './game/startng.js?v=17';
import './game/recipes.js?v=22';
import './mini/cook.js?v=30';
import './render/engine.js?v=19';
import './ui/ui.js?v=50';
import './game/game.js?v=38';

window.__game = window.WW.createGame(document.getElementById('game'));
window.__booted = true;
