/**
 * Whimsy Wick — js/ui/ui.js
 * ---------------------------------------------------------------
 * Every screen, HUD element, bubble and binder. All buttons use
 * pointer events with repeat-click guards (assignment §8, §13).
 */
(() => {
'use strict';
const WW = window.WW;
const $ = (id) => document.getElementById(id);

WW.UI = (() => {
  let audio = null, onAction = null, busy = false;
  const SCREENS = ['title', 'story', 'chars', 'howto', 'settings', 'pause', 'result', 'ending'];
  let hudCtx = null; // 'story' | 'endless'
  let lastActionTs = 0;
  /* Click guard: debounces repeat clicks on the SAME control (§8). */
  let lastTarget = null;
  const guard = (e) => {
    const now = performance.now();
    if (e.currentTarget === lastTarget && now - lastActionTs < 250) return;
    lastTarget = e.currentTarget; lastActionTs = now;
    WW.Audio.play('tick');
    if (onAction && e.currentTarget.__act && e.currentTarget.__act !== 'noop') {
      onAction({ action: e.currentTarget.__act, arg: e.currentTarget.__arg });
    }
  };
  const btn = (id, action, arg) => {
    const el = $(id);
    el.__act = action; el.__arg = arg;
    el.addEventListener('click', guard);
    el.addEventListener('pointerenter', () => WW.Audio.play('hover'));
  };

  /* ---------------- wordmark ---------------- */
  const drawWordmark = () => {
    const c = $('title-wordmark'), ctx = c.getContext('2d');
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const W = 640, H = 140;
    c.width = W * dpr; c.height = H * dpr;
    ctx.scale(dpr, dpr);
    // banner
    WW.rr(ctx, 10, 34, W - 20, 76, 26); ctx.fillStyle = '#fffdf6'; ctx.fill();
    ctx.strokeStyle = 'rgba(74,53,36,.16)'; ctx.lineWidth = 3; ctx.stroke();
    // candle motif
    ctx.fillStyle = '#e9eef2'; WW.rr(ctx, 22, 52, 30, 42, 10); ctx.fill();
    ctx.fillStyle = '#ffd66b';
    ctx.beginPath(); ctx.moveTo(37, 40); ctx.quadraticCurveTo(46, 58, 41, 66);
    ctx.quadraticCurveTo(37, 73, 33, 66); ctx.quadraticCurveTo(28, 58, 37, 40); ctx.fill();
    const text = 'WHIMSY WICK';
    const px = 6;
    const tw = WW.textWidth(text, px);
    WW.fillText(ctx, text, (W - tw) / 2 + 8, 62, px, '#4a3524');
    // little sparks around
    ctx.fillStyle = '#e9a63a';
    const sp = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); };
    sp(84, 46, 3); sp(560, 50, 3); sp(514, 100, 2.4); sp(120, 98, 2.4);
  };

  /* ---------------- title ghee preview ---------------- */
  let previewT = 0, previewRaf = null;
  const charCtxs = [];  // { canvas, def }
  const previewLoop = () => {
    previewT += 1 / 60;
    for (const { canvas, def } of charCtxs) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      WW.paintSpirit(ctx, canvas.width, canvas.height, { char: def, animT: previewT, pose: 'idle' });
    }
    previewRaf = requestAnimationFrame(previewLoop);
  };
  const startPreviews = () => { charCtxs.length || previewLoop(); };

  /* ---------------- screens ---------------- */
  const show = (name) => {
    for (const s of SCREENS) {
      const el = $('screen-' + s);
      if (el) el.classList.toggle('hidden', s !== name);
    }
    if (name) $('screens').classList.remove('hidden'); else $('screens').classList.add('hidden');
  };
  const showNone = () => show(null);

  const setHUD = (mode, levelName) => {
    hudCtx = mode;
    $('hud').classList.toggle('hidden', !mode);
    if (!mode) return;
    $('hud-level').textContent = levelName || '';
    $('hud-progress').textContent = '';
    $('hud-gems').classList.add('hidden');
    $('hud-coins').classList.add('hidden');
    $('hud-score').classList.add('hidden');
    $('hud-dist').classList.add('hidden');
    $('hud-time').classList.add('hidden');
    if (mode === 'story') { $('hud-gems').classList.remove('hidden'); $('hud-coins').classList.remove('hidden'); }
    if (mode === 'endless') {
      $('hud-score').classList.remove('hidden');
      $('hud-dist').classList.remove('hidden');
      $('hud-time').classList.remove('hidden');
    }
  };
  const hud = {
    progress(sparksTotal, sparksGround) {
      if (sparksTotal > 0) $('hud-progress').textContent = `✦ ${sparksTotal}/${sparksGround}`;
    },
    sparks(n) { $('hud-sparks').textContent = '✦ ' + n; },
    coins(n) { $('hud-coins').textContent = '● ' + n; },
    gems(n) { $('hud-gems').textContent = '◆ ' + n; },
    score(n) { $('hud-score').textContent = String(n); },
    dist(n) { $('hud-dist').textContent = n + ' m'; },
    time(s) {
      const m = Math.floor(s / 60), r = Math.floor(s % 60);
      $('hud-time').textContent = `${m}:${String(r).padStart(2, '0')}`;
    },
    show(set) { if (set && hudCtx) $('hud').classList.remove('hidden'); else $('hud').classList.add('hidden'); },
  };

  /* ---------------- story map ---------------- */
  const renderStory = (levels, progress, bests) => {
    const box = $('story-list');
    box.innerHTML = '';
    levels.forEach((L, i) => {
      const locked = i > 0 && !progress.includes(levels[i - 1].id);
      const done = progress.includes(L.id);
      const b = document.createElement('button');
      b.className = 'story-item' + (done ? ' done' : '') + (locked ? ' locked' : '');
      b.__act = locked ? 'noop' : 'play-level';
      b.__arg = i;
      b.addEventListener('click', guard);
      b.innerHTML = `
        <span class="num">${done ? '★' : i + 1}</span>
        <span class="meta"><b>${L.name}</b><span>${locked ? 'Finish the last counter to open this one.' : (done ? 'Relight any time.' : L.note)}</span></span>
        <span class="score">${bests[L.id] ? ('✦ best ' + bests[L.id]) : ''}</span>`;
      box.appendChild(b);
    });
  };

  /* ---------------- characters ---------------- */
  let charTemp = null;
  const renderChars = (chars, selectedId) => {
    const grid = $('char-grid');
    grid.innerHTML = '';
    charCtxs.length = 0;
    chars.forEach((ch) => {
      const card = document.createElement('button');
      card.className = 'char-card' + (ch.id === charTemp ? ' sel' : '');
      card.__act = 'pick-char'; card.__arg = ch.id;
      card.addEventListener('click', picker);
      const cv = document.createElement('canvas');
      cv.width = 110; cv.height = 130;
      card.appendChild(cv);
      card.appendChild(Object.assign(document.createElement('b'), { textContent: ch.name }));
      card.appendChild(Object.assign(document.createElement('small'), { textContent: ch.tag }));
      grid.appendChild(card);
      charCtxs.push({ canvas: cv, def: ch });
    });
    $('chars-name').textContent = (chars.find(c => c.id === charTemp) || chars[0]).name;
    startPreviews();
  };
  const picker = (e) => {
    const now = performance.now();
    if (now - lastActionTs < 140) return;
    lastActionTs = now;
    WW.Audio.play('tick');
    charTemp = e.currentTarget.__arg;
    for (const el of document.querySelectorAll('.char-card')) {
      const cardIndex = el.__arg === charTemp;
      el.classList.toggle('sel', cardIndex);
    }
    onAction && onAction({ action: 'pick-char', arg: charTemp });
  };

  /* ---------------- settings ---------------- */
  const renderSettings = (s) => {
    $('set-music').value = Math.round(s.music * 100); $('set-music-val').textContent = Math.round(s.music * 100);
    $('set-sfx').value = Math.round(s.sfx * 100); $('set-sfx-val').textContent = Math.round(s.sfx * 100);
    $('set-mute').checked = !!s.mute;
    $('set-gestures').checked = s.gestureHints !== false;
    $('set-rm').checked = !!s.reducedMotion;
    document.body.classList.toggle('rm', !!s.reducedMotion);
  };

  /* ---------------- tutorial & hints ---------------- */
  const setTutorial = (step, total) => {
    $('tutorial').classList.remove('hidden');
    $('tut-step').textContent = `${step + 1} / ${total}`;
  };
  const setTutorialText = (title, text) => { $('tut-title').textContent = title; $('tut-text').textContent = text; };
  const hideTutorial = () => $('tutorial').classList.add('hidden');

  const showGestureHint = (v) => $('gesture-hint').classList.toggle('hidden', !v);
  const showToast = (text, ms = 4200) => {
    const t = $('hint-toast');
    $('hint-toast-text').textContent = text;
    t.classList.remove('hidden');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => t.classList.add('hidden'), ms);
  };

  /* ---------------- profile card ---------------- */
  const renderProfile = (info, signedIn) => {
    const card = $('startng-card');
    card.hidden = false;
    const face = $('player-face');
    if (info.face) { face.style.display = ''; face.src = info.face; }
    else { face.style.display = 'none'; face.removeAttribute('src'); }
    $('player-name').textContent = info.name || 'Guest';
    const at = signedIn && info.account ? '@' + info.account : (signedIn ? '' : 'Not signed in');
    $('player-account').textContent = at;
    $('player-sign-in').hidden = !!signedIn;
  };

  /* ---------------- result panels ---------------- */
  const stat = (v, label, hot) =>
    `<span class="rstat${hot ? ' hot' : ''}"><b>${v}</b><span>${label}</span></span>`;

  const showResult = (kind, data) => {
    // kind: 'story-complete' | 'story-fail' | 'endless-over' | 'story-replay'
    const p = $('result-panel');
    if (kind === 'endless-over') {
      $('result-title').textContent = data.newBest ? 'New record!' : 'Nightly tumble!';
      $('result-flavour').textContent = data.newBest
        ? 'Ghee went further into the sleeping kitchen than ever.'
        : 'The kitchen is patient — every run gathers a few loose sparks home.';
      $('result-stats').innerHTML =
        stat(data.score, 'Score', data.newBest) +
        stat(data.best, 'Best') +
        stat(`● ${data.coins}`, 'Coins') +
        stat(data.dist + ' m', 'Distance') +
        stat(data.timeStr, 'Time');
      $('result-replay').textContent = 'Retry run';
      $('result-primary').textContent = 'Retry run';
      $('result-primary').classList.remove('hidden');
    } else {
      data.coins = data.coins || 0; data.gems = data.gems || 0;
      data.sparks = data.sparks || 0; data.sparksGround = data.sparksGround || 0;
      const win = kind === 'story-complete';
      $('result-title').textContent = win ? 'Wick lit!' : 'Oh dear…';
      $('result-flavour').textContent = data.flavour;
      $('result-stats').innerHTML =
        stat(`✦ ${data.sparks}/${data.sparksGround}`, 'Sparks') +
        stat(`● ${data.coins}`, 'Coins earned') +
        stat(`◆ ${data.gems}`, data.last ? 'Gems' : (win ? 'Gems +5' : 'Gems')) +
        (data.gemsTotal ? stat(`◆ total ${data.gemsTotal}`, 'Stored') : '');
      $('result-replay').textContent = win ? 'Replay level' : 'Try again';
      $('result-primary').classList.toggle('hidden', !win);
      $('result-primary').textContent = data.last ? 'Finish story' : 'Next level';
    }
    show('result');
  };

  /* ---------------- binding ---------------- */
  const init = (actions) => {
    onAction = (a) => actions[a.action] && actions[a.action](a.arg);
    audio = WW.Audio;
    drawWordmark();
    // title ghee preview
    charCtxs.push({ canvas: $('title-ghee'), def: WW.CHARACTERS[0] });

    btn('btn-story', 'open-story');
    btn('btn-endless', 'start-endless');
    btn('btn-chars', 'open-chars');
    btn('btn-howto', 'open-howto-title');
    btn('btn-settings', 'open-settings-title');
    btn('story-back', 'back-title');
    btn('chars-back', 'back-title');
    btn('chars-confirm', 'chars-confirm');
    btn('howto-back', 'howto-back');
    btn('settings-back', 'settings-back');
    btn('pause-resume', 'resume');
    btn('pause-restart', 'restart');
    btn('pause-howto', 'open-howto-pause');
    btn('pause-settings', 'open-settings-pause');
    btn('pause-menu', 'back-title');
    btn('result-primary', 'result-primary');
    btn('result-replay', 'result-replay');
    btn('result-menu', 'back-title');
    btn('ending-menu', 'back-title');
    btn('set-replay-tutorial', 'replay-tutorial');
    btn('set-reset', 'reset-progress');
    btn('hint-dismiss', 'dismiss-gesture-hint');
    $('btn-pause').addEventListener('click', () => { WW.Audio.play('tick'); onAction({ action: 'pause' }); });

    // settings inputs
    const bindRange = (id, valId, key) => {
      const r = $(id);
      r.addEventListener('input', () => {
        const v = +r.value;
        $(valId).textContent = v;
        audio.set(key, v / 100);
        onAction({ action: 'set-setting', arg: { [key]: v / 100 } });
      });
    };
    bindRange('set-music', 'set-music-val', 'music');
    bindRange('set-sfx', 'set-sfx-val', 'sfx');
    for (const [id, key] of [['set-mute', 'mute'], ['set-gestures', 'gestureHints'], ['set-rm', 'reducedMotion']]) {
      $(id).addEventListener('change', (e) => {
        onAction({ action: 'set-setting', arg: { [key]: e.target.checked } });
      });
    }
    $('howto-hazards'); // decorative canvases added by howto painter below
  };

  return {
    init, show, showNone, setHUD, hud,
    renderStory, renderChars, renderSettings, renderProfile,
    setTutorial, setTutorialText, hideTutorial,
    showGestureHint, showToast, showResult, lockCharsTemp: () => charTemp,
    set charsTemp(v) { charTemp = v; },
    get charsTemp() { return charTemp; },
    reshowRenderer() { /* screens hidden; canvas visible */ },
  };
})();
})();
