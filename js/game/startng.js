/**
 * Whimsy Wick — js/game/startng.js
 * ---------------------------------------------------------------
 * start.ng platform integration per the docs (connect page + HTTP API):
 *  • hidden /connect frame + postMessage, always checking e.origin
 *  • startng:whoami → player or guest → profile card + spirit tinting
 *  • endless-run scores through the session API (startng.json stats)
 *  • sign-in redirect with return_to; re-ask whoami on refocus
 */
(() => {
'use strict';
const WW = window.WW;
const START_NG = 'https://start.ng';
const API = 'https://api.start.ng';
const GAME = (location.hostname.split('.')[0] || 'whimsy-wick').slice(0, 40);

let frame = null;
const connectFrame = () => {
  frame ??= new Promise((resolve) => {
    const el = document.createElement('iframe');
    el.src = `${START_NG}/connect`;
    el.hidden = true;
    el.onload = () => resolve(el);
    document.body.append(el);
    setTimeout(() => resolve(el), 6000); // never hard-block the game
  });
  return frame;
};

/** askStartNg — straight from the docs, origin-checked. */
const askStartNg = (message, replyType, timeoutMs = 5000) =>
  connectFrame().then((el) => new Promise((resolve) => {
    const requestId = Math.random().toString(36).slice(2);
    const done = (reply) => { clearTimeout(timer); removeEventListener('message', onMessage); resolve(reply); };
    const timer = setTimeout(() => done(null), timeoutMs);
    const onMessage = (e) => {
      if (e.origin !== START_NG || e.source !== el.contentWindow) return;
      if (e.data?.type === replyType && e.data.requestId === requestId) done(e.data);
    };
    addEventListener('message', onMessage);
    try { el.contentWindow.postMessage({ ...message, requestId }, START_NG); } catch { done(null); }
  }));

/* ---- game session from the URL hash (docs §HTTP API) ---- */
let session = null;
{
  const params = new URLSearchParams(location.hash.slice(1));
  if (params.get('startng_session')) {
    try {
      sessionStorage.setItem('startng_session', params.get('startng_session'));
      history.replaceState(null, '', location.pathname + location.search);
    } catch { /* private mode */ }
  }
  try { session = sessionStorage.getItem('startng_session'); } catch { session = null; }
}

WW.StartNG = {
  GAME,
  askStartNg,
  get session() { return session; },
  signedIn: () => !!session,

  /** Player via the connect page; falls back to the HTTP API. */
  async whoami() {
    const reply = await askStartNg({ type: 'startng:whoami' }, 'startng:user', 6000);
    if (reply && (reply.user ?? reply.guest)) {
      return { info: reply.user ?? reply.guest, signedIn: !!reply.user, via: 'connect', raw: reply };
    }
    if (session) {
      try {
        const res = await fetch(`${API}/games/${GAME}/player`, { headers: { Authorization: `Bearer ${session}` } });
        if (res.ok) {
          const p = await res.json();
          return { info: { name: p.name, style: p.style, account: p.account }, signedIn: true, via: 'api', raw: p };
        }
        if (res.status === 401) { session = null; try { sessionStorage.removeItem('startng_session'); } catch {} }
      } catch { /* offline/localhost — game still runs playerless */ }
    }
    return null;
  },

  signIn() {
    location.href = `https://start.ng/?return_to=${encodeURIComponent(location.origin + location.pathname)}`;
  },

  /** Save an endless run (used for signed-in players only). */
  async saveRun(stats) {
    if (session) {
      try {
        const res = await fetch(`${API}/games/${GAME}/scores`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session}` },
          body: JSON.stringify({ stats }),
        });
        if (res.ok) return await res.json();       // { best, improved, rank, stats }
        if (res.status === 401) { session = null; try { sessionStorage.removeItem('startng_session'); } catch {} }
        return null;
      } catch { return null; }
    }
    try {
      const saved = await askStartNg({ type: 'startng:score', stats }, 'startng:scoreSaved', 6000);
      if (saved && saved.ok) return saved.result;
    } catch { /* unavailable */ }
    return null;
  },

  async leaderboard(limit = 10) {
    if (session) {
      try {
        const res = await fetch(`${API}/games/${GAME}/leaderboard?limit=${limit}`);
        if (res.ok) return await res.json();
      } catch { /* fallthrough */ }
    }
    const reply = await askStartNg({ type: 'startng:leaderboard', limit }, 'startng:leaderboardData', 6000);
    return reply?.ok ? reply.entries : null;
  },
};
})();
