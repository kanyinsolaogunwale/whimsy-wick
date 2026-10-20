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

/* Inline icon snippets reused by dynamic HTML (HUD chips, rewards). */
const IC = {
  coin: `<svg class="hud-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#ffe08a" stroke="#b8791f" stroke-width="2.4"/><path d="M12 8.2l1.1 2.2 2.4.3-1.8 1.8.5 2.4-2.2-1.2-2.2 1.2.5-2.4-1.8-1.8 2.4-.3z" fill="#c98a1e" opacity=".85"/></svg>`,
  gem:  `<svg class="hud-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l7 5.2-2.4 10H7.4L5 7.8z" fill="#d5c6f5" stroke="#8f74c9" stroke-width="2.2" stroke-linejoin="round"/><path d="M9.6 7.8l2.4 10 2.4-10-2.4-3.4z" fill="#a98fd9" opacity=".6"/></svg>`,
  book: `<svg class="hud-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></svg>`,
};

WW.UI = (() => {
  let audio = null, onAction = null, busy = false;
  const SCREENS = ['title', 'story', 'chars', 'howto', 'records', 'settings', 'signin', 'pause', 'result', 'ending'];
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

  /* ---------------- title hero art ---------------- */
  let heroT = 0, heroRaf = null;
  const paintHero = () => {
    const cv = $('title-hero');
    if (!cv) return;
    heroT += 1 / 60;
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    // cozy night scene band: counter + moon + lantern + Ghee on the counter
    // backdrop wash
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#d7c3ee');
    sky.addColorStop(1, '#f6ead6');
    WW.rr(ctx, 0, 0, W, H, 26); ctx.fillStyle = sky; ctx.fill();
    // stars
    const R = WW.rng(4);
    ctx.fillStyle = '#fff8e0';
    for (let i = 0; i < 18; i++) {
      ctx.globalAlpha = 0.3 + R() * 0.5;
      ctx.fillRect(18 + R() * (W - 36), 14 + R() * (H * 0.42), 2.6, 2.6);
    }
    ctx.globalAlpha = 1;
    // moon
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath(); ctx.arc(W - 54, 44, 18, 0, 7); ctx.fill();
    ctx.fillStyle = '#d7c3ee';
    ctx.beginPath(); ctx.arc(W - 61, 39, 14.5, 0, 7); ctx.fill();
    // countertop slab (running surface) — matches the in-game counter
    ctx.fillStyle = '#f3dcb6';
    WW.rr(ctx, 0, H * 0.62, W, H * 0.38, 0); ctx.fill();
    ctx.fillStyle = '#fbebd0'; ctx.fillRect(0, H * 0.62, W, 5);
    ctx.fillStyle = 'rgba(122,87,55,.55)'; ctx.fillRect(0, H * 0.62 + 5, W, 2);
    // wood lip + cupboard hint below
    ctx.fillStyle = '#c98a4b'; ctx.fillRect(0, H * 0.62 + 36, W, 6);
    ctx.fillStyle = '#d9a066'; ctx.fillRect(0, H * 0.62 + 42, W, H);
    // lantern at right, warm glow
    const lx = W - 62, ly = H * 0.62 - 6;
    const glow = 0.25 + Math.sin(heroT * 3) * 0.08;
    ctx.fillStyle = '#ffe9a8'; ctx.globalAlpha = glow * 0.8;
    ctx.beginPath(); ctx.arc(lx, ly - 30, 34, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#8f74c9'; WW.rr(ctx, lx - 10, ly - 62, 20, 15, 5); ctx.fill();
    ctx.fillStyle = '#b8c4cc'; WW.rr(ctx, lx - 14, ly - 47, 28, 38, 8); ctx.fill();
    ctx.strokeStyle = '#7d8d97'; ctx.lineWidth = 2; WW.rr(ctx, lx - 14, ly - 47, 28, 38, 8); ctx.stroke();
    ctx.fillStyle = '#7fa3b8'; WW.rr(ctx, lx - 9, ly - 40, 18, 24, 4); ctx.fill();
    ctx.fillStyle = '#ffd66b'; WW.rr(ctx, lx - 18, ly - 9, 36, 9, 4); ctx.fill();
    // little magic sparks rising
    ctx.fillStyle = '#ffe9a8';
    for (let i = 0; i < 4; i++) {
      const t = (heroT * 0.8 + i * 0.25) % 1;
      ctx.globalAlpha = Math.sin(t * Math.PI);
      ctx.beginPath(); ctx.arc(60 + i * 26, ly - 10 - t * 54, 3, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Ghee, standing on the tiles at the left third
    ctx.save();
    ctx.translate(W * 0.34, H * 0.62 + 38);
    ctx.scale(1.35, 1.35);
    WW.paintSpirit(ctx, 60, 76, { char: WW.CHARACTERS[0], animT: heroT, pose: 'idle' });
    ctx.restore();
    heroRaf = requestAnimationFrame(paintHero);
  };

  /* ---------------- characters preview loop ---------------- */
  let previewT = 0, previewRaf = null;
  const PREVIEW_W = 110, PREVIEW_H = 100, PREVIEW_ZOOM = 1.4;
  const charCtxs = [];  // { canvas, def }
  const previewLoop = () => {
    previewT += 1 / 60;
    for (const { canvas, def } of charCtxs) {
      const ctx = canvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const k = (canvas.width / PREVIEW_W) * PREVIEW_ZOOM;   // DPR × zoom
      ctx.setTransform(k, 0, 0, k, 0, 0);
      /* act out the move set: run → jump (with flips for tier 3+) → idle */
      const ph = previewT % 3.2;
      let pose = 'idle', spin = 0, lift = 0;
      if (ph < 1.4) pose = 'run';
      else if (ph < 2.3) {
        const tau = (ph - 1.4) / 0.9, jv = WW.Physics.TUNE.jumpV, vy = jv * (1 - 2 * tau);
        pose = vy > 30 ? 'jump' : 'fall';
        spin = WW.flipAngle(def, vy, 1, 1);
        lift = Math.sin(Math.PI * tau) * 12;
      }
      ctx.translate(0, -lift);
      WW.paintSpirit(ctx, canvas.width / k, canvas.height / k, { char: def, animT: previewT, pose, spin, look: 'r' });
    }
    previewRaf = requestAnimationFrame(previewLoop);
  };
  const startPreviews = () => { if (!previewRaf) previewLoop(); };

  /* ---------------- screens ---------------- */
  const show = (name) => {
    /* modal overlays keep the base screen (title/story) visible behind them */
    const target = name && $('screen-' + name);
    const overlay = !!target && target.classList.contains('overlay-screen');
    for (const s of SCREENS) {
      const el = $('screen-' + s);
      if (!el) continue;
      if (overlay && s !== name && !el.classList.contains('overlay-screen')) continue;
      el.classList.toggle('hidden', s !== name);
    }
    if (name) $('screens').classList.remove('hidden'); else $('screens').classList.add('hidden');
    if (name === 'title') renderTitleStats();
  };
  const showNone = () => show(null);

  const setHUD = (mode, levelName) => {
    hudCtx = mode;
    $('hud').classList.toggle('hidden', !mode);
    if (!mode) return;
    $('hud-level').textContent = levelName || '';
    $('hud-gems').classList.add('hidden');
    $('hud-coins').classList.add('hidden');
    $('hud-score').classList.add('hidden');
    $('hud-dist').classList.add('hidden');
    if (mode === 'story') { $('hud-gems').classList.remove('hidden'); $('hud-coins').classList.remove('hidden'); }
    if (mode === 'endless') {
      $('hud-score').classList.remove('hidden');
      $('hud-dist').classList.remove('hidden');
      $('hud-coins').classList.remove('hidden');
      $('hud-gems').classList.remove('hidden');
    }
  };
  const hud = {
    coins(n) { $('hud-coin-n').textContent = n; },
    gems(n) { $('hud-gem-n').textContent = n; },
    score(n) { $('hud-score').textContent = String(n); },
    dist(n) { $('hud-dist').textContent = n + ' m'; },
    time(n) { /* optional HUD clock; no dedicated element yet */ },
    show(set) { if (set && hudCtx) $('hud').classList.remove('hidden'); else $('hud').classList.add('hidden'); },
  };

  /* ---------------- story map ---------------- */
  let progressIds = [];
  const STORY_REWARDS = [
    { coins: 60, gems: 3 },
    { coins: 80, gems: 4 },
    { coins: 100, gems: 5 },
    { coins: 120, gems: 6 },
    { coins: 150, gems: 8 },
  ];
  const renderStory = (levels, progress, sparks) => {
    progressIds = progress || [];
    const grid = $('story-grid');
    const detail = $('story-detail');
    grid.innerHTML = '';
    levels.forEach((L, i) => {
      const locked = i > 0 && !progress.includes(levels[i - 1].id);
      const done = progress.includes(L.id);
      const b = document.createElement('button');
      b.className = 'story-tile' + (done ? ' done' : '') + (locked ? ' locked' : '');
      b.textContent = String(i + 1);
      b.setAttribute('aria-label', (locked ? 'Locked: ' : '') + L.name);
      b.__act = locked ? 'noop' : 'select-story';
      b.__arg = i;
      b.addEventListener('click', guard);
      grid.appendChild(b);
    });
    // preselect the first unlocked-but-not-done level
    const pick = levels.findIndex((L, i) => !progress.includes(L.id) && (i === 0 || progress.includes(levels[i - 1].id)));
    selectStory(pick < 0 ? levels.length - 1 : pick);
  };
  const selectStory = (i) => {
    const detail = $('story-detail');
    const L = WW.STORY_LEVELS[i];
    const done = progressIds.includes(L.id);
    const rew = STORY_REWARDS[i] || STORY_REWARDS[STORY_REWARDS.length - 1];
    const tiles = $('story-grid').querySelectorAll('.story-tile');
    tiles.forEach((t, k) => t.classList.toggle('sel', k === i));
    detail.innerHTML = `
      <div class="sd-name">${L.name}</div>
      <div class="sd-note">Light all five wicks to relight the kitchen. ${L.note}</div>
      <div class="story-reward-chip sd-reward">${IC.coin} ${done ? rew.coins + ' coins again' : rew.coins + ' coins'} &nbsp;·&nbsp; ${IC.gem} ${rew.gems} gems</div>
      <button class="btn btn-primary btn-play" id="story-play">Play level ${i + 1}</button>`;
    const playBtn = $('story-play');
    playBtn.__act = 'play-level';
    playBtn.__arg = i;
    playBtn.addEventListener('click', guard);
  };

  /* ---------------- characters + shop ---------------- */
  let charTemp = null;
  let shop = { owned: ['ghee'], balance: 0, gems: 0, equipped: 'ghee' };
  const planFor = (d) => WW.payPlan(d.price, shop.balance, shop.gems);
  const updateCharsCta = () => {
    const d = WW.CHARACTERS.find(c => c.id === charTemp) || WW.CHARACTERS[0];
    const b = $('chars-confirm');
    b.disabled = false;
    const pay = planFor(d);
    if (shop.owned.includes(d.id)) b.textContent = `Play as ${d.name}`;
    else if (pay.ok && !pay.gems) b.innerHTML = `Buy ${d.name} · ${IC.coin} ${fmtN(pay.coins)}`;
    else if (pay.ok) b.innerHTML = `Buy ${d.name} · ${IC.coin} ${fmtN(pay.coins)} + ${IC.gem} ${fmtN(pay.gems)}`;
    else { b.innerHTML = `${IC.coin} ${fmtN(pay.short)} more to unlock ${d.name}`; b.disabled = true; }
    $('chars-balance').innerHTML =
      `<span class="hud-chip hud-coin" title="Coins" aria-label="Coins">${IC.coin}<b>${fmtN(shop.balance)}</b></span>` +
      `<span class="hud-chip hud-gem" title="Gems" aria-label="Gems">${IC.gem}<b>${fmtN(shop.gems)}</b></span>`;
  };
  const badgeFor = (ch) => {
    if (ch.id === shop.equipped) return '<span class="cc-badge playing">Playing</span>';
    if (shop.owned.includes(ch.id)) return '<span class="cc-badge owned">Owned</span>';
    return `<span class="cc-badge price${planFor(ch).ok ? '' : ' short'}">${IC.coin}${fmtN(ch.price)}</span>`;
  };
  const renderChars = (chars, selectedId, shopInfo, note = '') => {
    if (shopInfo) shop = shopInfo;
    if (selectedId) charTemp = selectedId;
    $('chars-note').textContent = note;
    renderTitleStats();
    const grid = $('char-grid');
    grid.innerHTML = '';
    charCtxs.length = 0;
    chars.forEach((ch) => {
      const card = document.createElement('button');
      card.className = 'char-card' + (ch.id === charTemp ? ' sel' : '');
      card.__act = 'pick-char'; card.__arg = ch.id;
      card.addEventListener('click', picker);
      const cv = document.createElement('canvas');
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = PREVIEW_W * dpr; cv.height = PREVIEW_H * dpr;
      cv.style.width = PREVIEW_W + 'px'; cv.style.height = PREVIEW_H + 'px';
      card.appendChild(cv);
      card.appendChild(Object.assign(document.createElement('b'), { textContent: ch.name }));
      card.appendChild(Object.assign(document.createElement('small'), { textContent: ch.tag }));
      card.appendChild(Object.assign(document.createElement('small'), { className: 'cc-moves', textContent: ch.moves }));
      card.insertAdjacentHTML('afterbegin', badgeFor(ch));
      card.setAttribute('aria-label', `${ch.name}, ${shop.owned.includes(ch.id) ? 'owned' : fmtN(ch.price) + ' coins'}. ${ch.moves}`);
      grid.appendChild(card);
      charCtxs.push({ canvas: cv, def: ch });
    });
    updateCharsCta();
    startPreviews();
  };
  const picker = (e) => {
    const now = performance.now();
    if (now - lastActionTs < 140) return;
    lastActionTs = now;
    WW.Audio.play('tick');
    charTemp = e.currentTarget.__arg;
    for (const el of document.querySelectorAll('.char-card')) {
      el.classList.toggle('sel', el.__arg === charTemp);
    }
    $('chars-note').textContent = '';
    updateCharsCta();
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

  /* ---------------- tutorial & hints ----------------
   * The guide rides along with the live run: each page clears when the
   * player performs its action, and the last page ends at the wick. */
  const setTutorial = (step, total) => {
    const el = $('tutorial');
    el.classList.remove('hidden');
    $('tut-step').textContent = `${step + 1} / ${total}`;
  };
  const setTutorialText = (title, text, prompt) => { $('tut-title').textContent = title; $('tut-text').textContent = text; if (prompt !== undefined) $('tut-tap').textContent = prompt; };
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
    // the sign-in flow lives behind the profile chip on the title screen
    const card = $('startng-card');
    card.hidden = false;
    const face = $('player-face');
    if (info.face) { face.style.display = ''; face.src = info.face; }
    else { face.style.display = 'none'; face.removeAttribute('src'); }
    card.classList.toggle('no-face', !info.face);
    $('player-name').textContent = info.name || 'Guest';
    const at = signedIn && info.account ? '@' + info.account : (signedIn ? '' : 'Not signed in');
    $('player-account').textContent = at;
    $('player-sign-in').hidden = !!signedIn;
  };

  /* ---------------- title records (top-centre of home) ---------------- */
  let statsSource = null;
  const fmtN = (n) => Math.round(n || 0).toLocaleString();
  const renderTitleStats = () => {
    const d = statsSource && statsSource();
    if (!d) return;
    $('ts-coins').textContent = fmtN(d.wallet.coins);
    $('ts-gems').textContent = fmtN(d.wallet.gems);
    $('ts-best').textContent = fmtN(d.endless.best);
    $('ts-dist').textContent = fmtN(d.endless.bestDistance) + ' m';
  };

  /* ---------------- result panels ---------------- */
  const stat = (v, label, hot) =>
    `<span class="rstat${hot ? ' hot' : ''}"><b>${v}</b><span>${label}</span></span>`;

  /* ---------------- records modal ---------------- */
  const fmtClock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const myName = () => (WW.player && WW.player.info && (WW.player.info.name || WW.player.info.nickname)) || 'Guest';
  const renderLeaderboard = (entries, opts) => {
    opts = opts || {};
    const mine = opts.myRank;                       // { rank, score } when off-page
    const list = entries.slice(0, 8);
    if (mine && mine.rank > list.length) {
      list.push({ name: myName(), score: mine.score, rank: mine.rank, me: true });
    }
    $('records-runs').innerHTML = list.map((e, i) => {
      const rank = e.rank ?? i + 1;
      const isMe = e.me || e.name === myName();
      return `<tr class="${isMe ? 'me' : e.rank === 1 || i === 0 ? 'top' : ''}">` +
        `<td>${rank}</td><td>${isMe ? '&#11088; ' : ''}${e.name || 'A spirit'}</td>` +
        `<td>${fmtN(e.score)}</td><td>${e.dist ? fmtN(e.dist) + ' m' : ''}</td></tr>`;
    }).join('');
    const has = list.length > 0;
    $('records-empty').classList.toggle('hidden', has);
    document.querySelector('.records-table').classList.toggle('hidden', !has);
  };
  const renderRecords = (d) => {
    const lit = d.story.completed.length, total = WW.STORY_LEVELS.length;
    $('records-summary').innerHTML =
      stat(`${IC.coin} ${fmtN(d.stats.coinsEarned)}`, 'Coins earned') +
      stat(`${IC.gem} ${fmtN(d.stats.gemsEarned)}`, 'Gems found') +
      stat(fmtN(d.endless.best), 'Best score') +
      stat(fmtN(d.endless.bestDistance) + ' m', 'Best distance') +
      stat(fmtN(d.stats.runs), 'Runs played') +
      stat(`${lit}/${total}`, 'Wicks lit');
    /* Leaderboard: live start.ng board when connected; personal bests as
     * the offline fallback so the screen never feels empty for guests. */
    $('records-empty').textContent = 'Loading the leaderboard…';
    $('records-empty').classList.remove('hidden');
    document.querySelector('.records-table').classList.add('hidden');
    const fallback = () => {
      $('records-empty').textContent = 'No scores on the board yet. Play Endless mode to set the first one!';
      const runs = d.endless.runs || [];
      renderLeaderboard(runs.map(r => ({ name: r.char && (WW.CHARACTERS.find(c => c.id === r.char) || { name: r.char }).name, score: r.score, dist: r.dist, me: true })), { myRank: null });
    };
    (WW.StartNG && WW.StartNG.leaderboard ? WW.StartNG.leaderboard(8) : Promise.resolve(null)).then((board) => {
      if (board && board.length) {
        /* append my row from my saved best when I'm not on the page */
        let mine = null;
        if (d.endless.best > 0) mine = { rank: (board[board.length - 1].rank ?? board.length) + 1, score: d.endless.best };
        renderLeaderboard(board, { myRank: mine });
      } else if (WW.StartNG && WW.StartNG.signedIn()) {
        $('records-empty').textContent = 'No scores on the board yet — your first Endless run sets the pace!';
      } else {
        fallback();
      }
    }).catch(fallback);
  };

  const cleanResultButtons = () => {
    // reset the result panel to a known state before each show
    $('result-primary').classList.remove('hidden');
    $('result-replay').classList.remove('hidden');
    $('result-primary').setAttribute('aria-label', 'Next level');
    $('result-replay').setAttribute('aria-label', 'Retry level');
  };

  /* start.ng game standard: every round ends with a chance to share the
   * result on X via a twitter.com/intent/tweet link. */
  const showShare = (text) => {
    const a = $('result-share');
    const url = 'https://whimsy-wick.start.ng';
    a.href = `https://twitter.com/intent/tweet?${new URLSearchParams({ text: `${text} ${url}` })}`;
    a.classList.remove('hidden');
  };
  const hideShare = () => $('result-share').classList.add('hidden');

  const showResult = (kind, data) => {
    // kind: 'story-complete' | 'story-fail' | 'endless-over' | 'story-replay'
    cleanResultButtons();
    hideShare();
    $('result-settings')?.classList.remove('hidden');
    if (kind === 'endless-over') $('result-primary').setAttribute('aria-label', 'Run again');
    if (kind === 'endless-over') {
      $('result-title').textContent = data.newBest ? 'New record!' : 'Run over';
      $('result-flavour').textContent = data.newBest
        ? 'Ghee skated further through the sleeping kitchen than ever before.'
        : 'The kitchen is patient: every run still gathers a few loose coins home.';
      /* one chip per stat: when a record was beaten the chip is labeled
       * with its record name ("Best score"), otherwise the plain stat */
      $('result-stats').innerHTML =
        stat(data.score, data.newBest ? 'Best score' : 'Score', data.newBest) +
        stat(data.dist + ' m', data.newBest ? 'Best distance' : 'Distance') +
        stat(data.timeStr, 'Time') +
        stat(`${IC.coin} +${data.coins}`, 'Coins earned') +
        (data.gems ? stat(`${IC.gem} +${data.gems}`, 'Gems found') : '');
      $('result-primary').classList.add('hidden');
      showShare(`I scored ${data.score} in Whimsy Wick (distance ${data.dist} m)!`);
    } else if (kind === 'story-fail') {
      $('result-title').textContent = 'Ghee tumbled!';
      $('result-flavour').textContent = data.flavour;
      showShare('Ghee just tumbled in Whimsy Wick! Come hop the counter yourself.');
      $('result-stats').innerHTML =
        stat(`${IC.coin} +${data.coins || 0}`, 'Coins earned') +
        (data.gems ? stat(`${IC.gem} +${data.gems}`, 'Gems found') : '');
      $('result-primary').classList.add('hidden');
    } else {
      data.coins = data.coins || 0; data.gems = data.gems || 0;
      $('result-title').textContent = data.last ? 'All wicks lit!' : 'Wick lit!';
      $('result-flavour').textContent = data.flavour;
      const rewardCoins = data.rewardCoins || 0, rewardGems = data.rewardGems || 0;
      $('result-stats').innerHTML =
        stat(`${IC.coin} ${(data.coins || 0) + rewardCoins}`, 'Coins earned') +
        stat(`${IC.gem} ${rewardGems + (data.gemsPicked || 0)}`, 'Gems earned');
      if (data.last) {
        $('result-primary').classList.add('hidden');
        showShare('All wicks lit! I finished the story of Whimsy Wick.');
      } else {
        $('result-primary').classList.remove('hidden');
        showShare(`Wick lit! I gathered ${(data.coins || 0) + (data.rewardCoins || 0)} coins in Whimsy Wick.`);
      }
    }
    show('result');
  };

  /* ---------------- binding ---------------- */
  /* How-to "Watch out" strip: the real in-game obstacle art */
  const paintHowtoHazards = () => {
    const box = $('howto-hazards');
    if (!box) return;
    box.innerHTML = '';
    const SPILL = [40, 4, 120, 42];           // wide puddles: show their middle
    for (const [key, label, crop] of [['hz-flour', 'Flour'], ['hz-pin', 'Rolling pin'], ['hz-butter', 'Butter', SPILL],
      ['hz-milk', 'Milk', SPILL], ['hz-jamdrop', 'Jam'], ['hz-fan-blades', 'Fan']]) {
      const src = WW.tex(key, 1, 1, () => {}).canvas;
      const [sx, sy, sw, sh] = crop || [0, 0, src.width, src.height];
      const cv = document.createElement('canvas');
      cv.width = 56; cv.height = 40;
      cv.title = label; cv.setAttribute('aria-label', label); cv.setAttribute('role', 'img');
      const k = Math.min(52 / sw, 36 / sh);
      const dw = sw * k, dh = sh * k;
      cv.getContext('2d').drawImage(src, sx, sy, sw, sh, (56 - dw) / 2, 38 - dh, dw, dh);
      box.appendChild(cv);
    }
  };

  const init = (actions) => {
    onAction = (a) => actions[a.action] && actions[a.action](a.arg);
    audio = WW.Audio;
    paintHero();
    paintHowtoHazards();

    btn('btn-story', 'open-story');
    btn('btn-endless', 'start-endless');
    btn('btn-chars', 'open-chars');
    btn('btn-howto', 'open-howto-title');
    btn('btn-settings', 'open-settings-title');
    btn('title-stats', 'open-records');
    btn('chars-confirm', 'chars-confirm');
    btn('pause-resume', 'resume');
    btn('pause-restart', 'restart');
    btn('pause-howto', 'open-howto-pause');
    btn('pause-settings', 'open-settings-pause');
    btn('pause-menu', 'back-title');
    btn('result-primary', 'result-primary');
    btn('result-replay', 'result-replay');
    btn('result-settings', 'open-settings-result');
    btn('result-menu', 'back-title');
    btn('ending-menu', 'back-title');
    btn('set-replay-tutorial', 'replay-tutorial');
    btn('set-reset', 'reset-progress');
    btn('hint-dismiss', 'dismiss-gesture-hint');
    $('btn-pause').addEventListener('click', () => { WW.Audio.play('tick'); onAction({ action: 'pause' }); });
    $('signin-go').addEventListener('click', () => { WW.Audio.play('tick'); onAction({ action: 'signin-go' }); });
    $('player-sign-in').addEventListener('click', () => { WW.Audio.play('tick'); onAction({ action: 'signin-go' }); });

    // X buttons on every modal; clicking the backdrop outside a modal does
    // the same as its X
    for (const b of document.querySelectorAll('.x-btn[data-close]')) {
      const target = b.getAttribute('data-close');
      const close = () => {
        WW.Audio.play('tick');
        onAction({ action: 'ui-close', arg: target });
      };
      b.addEventListener('click', close);
      const screen = b.closest('.screen');
      if (screen) screen.addEventListener('click', (e) => { if (e.target === screen) close(); });
    }

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
  };

  return {
    init, show, showNone, setHUD, hud,
    setStatsSource(fn) { statsSource = fn; renderTitleStats(); },
    renderRecords,
    renderStory, selectStory, renderChars, renderSettings, renderProfile,
    setTutorial, setTutorialText, hideTutorial,
    showGestureHint, showToast, showResult, lockCharsTemp: () => charTemp,
    set charsTemp(v) { charTemp = v; },
    get charsTemp() { return charTemp; },
    reshowRenderer() { /* screens hidden; canvas visible */ },
    stopHero: () => { if (heroRaf) { cancelAnimationFrame(heroRaf); heroRaf = null; } },
    startHero: () => { if (!heroRaf) paintHero(); },
  };
})();
})();
