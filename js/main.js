/**
 * Whimsy Wick — js/main.js (entrypoint)
 * ---------------------------------------------------------------
 * Boot order: THREE (local module) → tools → art → game wiring.
 * Plain static ES modules — no build step needed (docs §rules).
 */
import * as THREE from '../lib/three.module.min.js';
window.THREE = THREE;

import './base/core.js';
import './world/art.js';
import './characters/define.js';

import './world/art.js';           // (idempotent — cached textures)
import './world/physics.js';
import './levels/story.js';
import './game/input.js';
import './sound/audio.js';
import './game/persist.js';
import './game/startng.js';
import './render/engine.js';
import './ui/ui.js';
import './game/game.js';

window.__game = window.WW.createGame(document.getElementById('game'));
window.__booted = true;
