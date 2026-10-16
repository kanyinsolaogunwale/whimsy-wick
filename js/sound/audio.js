/**
 * Whimsy Wick — js/sound/audio.js
 * ---------------------------------------------------------------
 * Fully procedural cozy audio (original by construction, §14):
 *  • music: warm 6-bar pad loop + music-box bells, seamless (loop node)
 *  • sfx: one-shot synth cues per gameplay event
 *  • volumes: music / sfx / master mute, persisted by WW.persist
 * Browsers gate audio until a gesture: we resume on first tap/key.
 */
(() => {
'use strict';
const WW = window.WW;

WW.Audio = (() => {
  let ctx = null, master = null, musicGain = null, sfxGain = null;
  let musicTimer = null, running = false, loopBeats = null;
  const st = { music: 0.7, sfx: 0.8, mute: false };

  const ready = () => {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      musicGain = ctx.createGain();
      sfxGain = ctx.createGain();
      musicGain.connect(master); sfxGain.connect(master); master.connect(ctx.destination);
      applyVolumes();
    } catch { return false; }
    return true;
  };

  const applyVolumes = () => {
    if (!ctx) return;
    master.gain.value = st.mute ? 0 : 1;
    musicGain.gain.value = st.music * 0.5;
    sfxGain.gain.value = st.sfx * 0.9;
  };

  /** Unlock after a user gesture (docs /§14). */
  const unlock = () => {
    if (!ready()) return;
    if (ctx.state === 'suspended') ctx.resume();
  };

  /* ---------------- music (seamless loop) ---------------- */
  const bpm = 84, beat = 60 / bpm;

  const note = (freq, when, dur, vol, type, dest, glide) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, when);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, when + dur);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vol, when + dur * 0.18);
    g.gain.exponentialRampToValueAtTime(0.0008, when + dur);
    o.connect(g); g.connect(dest || musicGain);
    o.start(when); o.stop(when + dur + 0.05);
  };

  // C–Am–F–G warm loop, one bar each; schedule 2 bars ahead forever
  const CHORDS = [
    [261.6, 329.6, 392.0],  // C
    [220.0, 261.6, 329.6],  // Am
    [174.6, 261.6, 349.2],  // F
    [196.0, 246.9, 392.0],  // G
  ];
  const BELLS = [ [523.3, 659.3], [440, 523.3], [349.2, 523.3], [392, 587.3] ];

  const scheduleBar = (barIdx, when) => {
    const ch = CHORDS[barIdx % 4];
    ch.forEach((f, i) => note(f / 2, when, beat * 3.6, 0.10 - i * 0.02, 'sine'));
    note(f2o(ch[0]), when, beat * 3.4, 0.03, 'triangle');
    const bells = BELLS[barIdx % 4];
    for (let b = 0; b < 4; b++) {
      if (b % 2 === 0 || (barIdx + b) % 3 === 0)
        note(bells[b % 2] * (b === 3 ? 1.5 : 1), when + b * beat, beat * 0.9, 0.05, 'sine');
    }
  };
  const f2o = (f) => f * 2;

  const startMusic = () => {
    if (!ready() || running) return;
    running = true;
    let bar = 0;
    let next = ctx.currentTime + 0.08;
    const tick = () => {
      if (!running) return;
      while (next < ctx.currentTime + 1.4) { scheduleBar(bar, next); next += beat * 4; bar = (bar + 1) % 4 * 1; bar = bar % 64; }
    };
    tick();
    musicTimer = setInterval(tick, 420);
  };
  const stopMusic = (duck = false) => {
    running = false;
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    if (duck && ctx) { // brief fade for menus? keep simple: silence pads are short-lived anyway
      musicGain.gain.setTargetAtTime(0.12 * st.music, ctx.currentTime, 0.3);
    } else if (ctx) musicGain.gain.setTargetAtTime(st.music * 0.5, ctx.currentTime, 0.3);
  };

  /* ---------------- SFX ---------------- */
  const S = {
    jump:   () => blip(500, 780, 0.14, 0.16, 'sine'),
    land:   () => thud(120, 0.09),
    collect:(n = 0) => { blip(880, 1180 + n * 60, 0.12, 0.12, 'sine'); blip(1320, 1760, 0.16, 0.06, 'triangle', 0.045); },
    gem:    () => { blip(1046, 1568, 0.18, 0.13); setTimeoutA(() => blip(1568, 2093, 0.22, 0.1), 70); },
    slip:   () => slidey(360, 180, 0.3),
    splat:  () => thud(90, 0.16, 0.2),
    wind:   () => windNoise(0.5),
    win:    () => arpeggio([523, 659, 784, 1046], 0.09, 0.18),
    lose:   () => arpeggio([392, 330, 262, 196], 0.13, 0.16, true),
    tick:   () => blip(660, 660, 0.05, 0.06, 'triangle'),
    hover:  () => blip(520, 545, 0.04, 0.03, 'sine'),
    light:  () => { blip(587, 1174, 0.3, 0.12); windNoise(0.35, 0.05); },
  };
  const blip = (f0, f1, dur, vol, type = 'sine', dt = 0) => {
    if (!ready() || st.mute) return;
    const t = ctx.currentTime + dt, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + dur + 0.02);
  };
  const thud = (f, dur, vol = 0.12) => {
    if (!ready() || st.mute) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.5, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + dur + 0.02);
  };
  const slidey = (f0, f1, dur) => {
    if (!ready() || st.mute) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.035, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 900;
    o.connect(fl); fl.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + dur + 0.02);
  };
  const windNoise = (dur, vol = 0.1) => {
    if (!ready() || st.mute) return;
    const n = ctx.sampleRate * dur, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 480; fl.Q.value = 0.7;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(fl); fl.connect(g); g.connect(sfxGain); src.start();
  };
  const arpeggio = (fs, step, vol, down = false) => {
    fs.forEach((f, i) => {
      const t = i * step;
      setTimeoutA(() => blip(f, down ? f * 0.94 : f * 1.02, 0.22, vol, 'triangle'), t * 1000);
    });
  };
  const setTimeoutA = (fn, ms) => setTimeout(fn, ms);

  return {
    st, unlock,
    play(name, arg) { S[name] && S[name](arg); },
    set(name, v) { st[name] = v; applyVolumes(); },
    setMute(v) { st.mute = v; applyVolumes(); },
    musicOn()  { if (ready() && ctx.state === 'running') startMusic(); },
    musicOff() { stopMusic(); },
    duckMusic(on) { if (running && ctx) musicGain.gain.setTargetAtTime((on ? 0.10 : 0.5) * st.music, ctx.currentTime, 0.25); },
    get running() { return running; },
    dbgCtx() { return ctx; },
  };
})();
})();
