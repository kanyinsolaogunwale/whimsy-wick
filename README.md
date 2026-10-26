# Whimsy Wick

A cozy magical platformer for start.ng. When the kitchen falls asleep, tiny
kitchen spirits keep its hidden magic alive, tonight, all the magic has
scattered, and Ghee sets out across the counters to gather sparks and light
every wick again.

Play: **https://whimsy-wick.start.ng** (after publishing)

## Features

- **Story mode**, five handcrafted levels: The Sleepy Counter, The Rolling
  Pin Run, The Butter Slide, The Sticky Situation, and The Kitchen's Last
  Spark. Each introduces new hazards (flour piles, patrolling rolling pins,
  slippery butter and milk, sticky jam, and a pushy little fan).
- **Endless Challenge**, procedurally generated obstacle sections with
  rising difficulty, score, distance and run-time tracking, plus your best run.
- **Five playable spirits**, Ghee, Mallow, Pip, Peaches and Clover. Same
  hops, different hearts.
- **Two currencies**, ● coins reward moment-to-moment skill (+10 per hazard
  passed), ◆ gems mark real progress (+5 for every wick lit). Banked in your
  save for future features.
- **Cook and Learn (Whimsical Kitchen)**, every story level hides real
  recipe ingredients (eggs, tomatoes, rice, milk and more) along the
  route. Collect them, then cook the dish at the Kitchen, a recipe book
  with simple real steps you can follow in real life. Finishes unlock
  trusty tools (the Trusty Pan, the Rolling Pin) that gate the next
  recipe.
- **Shop**, spend coins and gems on extra spirits and kitchen tools.
- **First-run tutorial** with replay from settings, per-hazard hints,
  gesture hints, reduced-motion support.
- **Auto-runner controls**, Ghee runs forward on their own, so hopping is
  the one skill: **Keyboard** Space / ↑ / W (Esc / P pause) and **touch**
  tap to hop, hold for a higher hop, tap again mid-air for a double hop,
  no on-screen movement buttons and no dragging.
- **Audio**, a looping CC0 lullaby for music (see Credits), procedural
  one-shot sound cues, music/SFX volume + mute.
- **start.ng integration**, player profile card, your start.ng character's
  colours tint your spirit's scarf/cap, and endless-mode bests save to the
  shared leaderboard.

## Tech

Plain HTML/CSS/JS + **Three.js** (r172, bundled locally) doing the actual
rendering: orthographic camera, canvas-texture sprites, layered parallax
kitchen. All art and sound effects are generated procedurally at runtime;
the only asset file is the music track. No build step: serve the folder
(e.g. `python3 -m http.server`) and open it. Opening `index.html` straight
from disk also runs, with procedural fallback music.

## Leaderboard columns (startng.json)

Score (highest) · Sparks gathered (highest) · Distance m (highest) ·
Run time (lowest, time format). Signed-in players only; guests can look.

## Repo layout

    index.html          entry
    css/main.css        pastel UI system
    js/lib/…            three.js module build
    js/base/core.js     palette, pixel font, helpers
    js/world/           art + physics
    js/characters/      the five spirits
    js/levels/story.js  story configs + endless generator
    js/render/engine.js three.js scene/camera
    js/ui/ui.js         all screens
    js/game/            game controller, input, audio wiring, saves, start.ng
    tools/make_cover.py generates cover.png
    assets/song17.mp3   background music (CC0)

## Credits

Music: "Happy Lullaby (song17)" by cynicmusic, The Cynic Project /
cynicmusic.com / pixelsphere.org, released under CC0 on OpenGameArt:
https://opengameart.org/content/happy-lullaby-song17
