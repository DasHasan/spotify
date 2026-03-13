import { login, logout, isLoggedIn, exchangeCode } from './auth.js';
import { getShows, getShow, getRandomEpisode } from './api.js';


const app = document.getElementById('app');

// ── SVG icons (inline for zero dependencies) ─────────────────────────────────

const ICO = {
  back: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5"
         stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
         <path d="M19 12H5"/><path d="M12 5l-7 7 7 7"/></svg>`,

  logout: `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
           <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
           <polyline points="16 17 21 12 16 7"/>
           <line x1="21" y1="12" x2="9" y2="12"/></svg>`,

  shuffle: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
            <polyline points="16 3 21 3 21 8"/>
            <line x1="4" y1="20" x2="21" y2="3"/>
            <polyline points="21 16 21 21 16 21"/>
            <line x1="15" y1="15" x2="21" y2="21"/></svg>`,

  spotify: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521
            17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122
            -.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18
            .479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58
            -11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15
            10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16
            9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02
            15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>`,
};

// ── Utilities ─────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function stripHtml(s) {
  return String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function fmtDate(str) {
  if (!str) return '';
  return new Date(str).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function fmtDuration(ms) {
  const m = Math.round(ms / 60_000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

function spinner() {
  return '<div class="loading-wrap"><div class="spinner"></div></div>';
}

// ── Routing ───────────────────────────────────────────────────────────────────

function navigate(showId) {
  _preloaded = null;
  history.pushState({}, '', showId ? `?show=${showId}` : '/');
  route();
}

window.addEventListener('popstate', () => isLoggedIn() ? route() : login());

function route() {
  const showId = new URLSearchParams(location.search).get('show');
  showId ? renderShow(showId) : renderList();
}

// ── Podcast list ──────────────────────────────────────────────────────────────

async function renderList() {
  app.innerHTML = `
    <header class="header">
      <h1>My Podcasts</h1>
      <button class="btn-icon" id="out-btn" title="Log out">${ICO.logout}</button>
    </header>
    <main class="screen">${spinner()}</main>
  `;
  document.getElementById('out-btn').onclick = () => { logout(); login(); };
  updateManifest('Podcast Roulette', null);

  const main = app.querySelector('main');
  try {
    const shows = await getShows();
    if (shows.length === 0) {
      main.innerHTML = `<p class="empty-msg">No subscribed podcasts found.</p>`;
      return;
    }

    main.innerHTML = `
      <p class="section-title">${shows.length} Podcast${shows.length !== 1 ? 's' : ''}</p>
      <div class="podcast-grid">
        ${shows.map(s => `
          <a class="podcast-card" href="?show=${s.id}" data-id="${s.id}">
            <div class="card-img-wrap">
              ${s.images?.[0]?.url
                ? `<img src="${esc(s.images[0].url)}" alt="" loading="lazy">`
                : '<div class="img-placeholder"></div>'}
            </div>
            <div class="card-name">${esc(s.name)}</div>
            <div class="card-pub">${esc(s.publisher)}</div>
          </a>
        `).join('')}
      </div>
    `;

    main.querySelectorAll('.podcast-card').forEach(a => {
      a.onclick = e => { e.preventDefault(); navigate(a.dataset.id); };
    });
  } catch (err) {
    main.innerHTML = `<div class="error-box">${esc(err.message)}</div>`;
  }
}

// ── Show view ─────────────────────────────────────────────────────────────────

async function renderShow(showId) {
  app.innerHTML = `
    <header class="header">
      <button class="btn-icon" id="back-btn">${ICO.back}</button>
      <span class="header-title"></span>
      <button class="btn-icon" id="out-btn" title="Log out">${ICO.logout}</button>
    </header>
    <main class="screen">${spinner()}</main>
  `;
  document.getElementById('back-btn').onclick = () => navigate(null);
  document.getElementById('out-btn').onclick   = () => { logout(); login(); };

  const main = app.querySelector('main');
  try {
    const show    = await getShow(showId);
    const showImg = show.images?.[0]?.url ?? '';

    app.querySelector('.header-title').textContent = show.name;
    updateManifest(show.name, showId, show.images?.[0]?.url);

    main.innerHTML = `
      <div class="show-header">
        ${showImg
          ? `<img class="show-img" src="${esc(showImg)}" alt="">`
          : '<div class="show-img img-placeholder"></div>'}
        <div class="show-info">
          <div class="show-name">${esc(show.name)}</div>
          <div class="show-pub">${esc(show.publisher)}</div>
          <div class="show-count">${show.total_episodes} episodes</div>
        </div>
      </div>
      <div id="ep-section"></div>
    `;

    await loadEpisode(showId, show.total_episodes, showImg);
  } catch (err) {
    main.innerHTML = `<div class="error-box">${esc(err.message)}</div>`;
  }
}

// ── Page title (used as label when saving a homescreen bookmark) ─────────────

function updateManifest(name) {
  document.title = name;
}

// Preloaded next episode so Roll Again can open Spotify synchronously
// inside the click handler (user gesture still live, no async delay).
let _preloaded = null;

async function loadEpisode(showId, total, fallbackImg) {
  const sec = document.getElementById('ep-section');
  sec.innerHTML = `
    <div class="ep-loading">
      <div class="spinner"></div>
      <span>Finding a random episode…</span>
    </div>
  `;
  try {
    const ep = await getRandomEpisode(showId, total);
    openSpotify(ep.uri);
    _showEpisode(sec, ep, showId, total, fallbackImg);
  } catch (err) {
    sec.innerHTML = `<div class="error-box">${esc(err.message)}</div>`;
  }
}

function _showEpisode(sec, ep, showId, total, fallbackImg) {
  const img  = ep.images?.[0]?.url ?? fallbackImg;
  const desc = stripHtml(ep.description);
  const meta = [
    fmtDate(ep.release_date),
    ep.duration_ms ? fmtDuration(ep.duration_ms) : '',
  ].filter(Boolean).join(' · ');

  sec.innerHTML = `
    <div class="ep-label">Random Episode</div>
    <div class="ep-card">
      ${img ? `<img class="ep-img" src="${esc(img)}" alt="">` : ''}
      <div class="ep-name">${esc(ep.name)}</div>
      ${meta ? `<div class="ep-meta">${esc(meta)}</div>` : ''}
      ${desc ? `<div class="ep-desc">${esc(desc)}</div>` : ''}
      <div class="ep-actions">
        <button class="btn btn-primary" id="open-btn">${ICO.spotify} Open in Spotify</button>
        <button class="btn btn-secondary" id="roll-btn">${ICO.shuffle} Roll Again</button>
      </div>
    </div>
  `;

  // Preload next episode in the background while the user listens
  _preloaded = null;
  getRandomEpisode(showId, total)
    .then(next => { _preloaded = next; })
    .catch(() => {});

  document.getElementById('open-btn').onclick = () => openSpotify(ep.uri);

  document.getElementById('roll-btn').onclick = () => {
    const next = _preloaded;
    _preloaded = null;
    if (next) {
      // Episode already fetched — open Spotify immediately inside this
      // click handler while the user gesture is still active.
      openSpotify(next.uri);
      _showEpisode(sec, next, showId, total, fallbackImg);
    } else {
      // Preload not ready yet (slow network) — fall back to normal fetch.
      loadEpisode(showId, total, fallbackImg);
    }
  };
}

// Opens the episode in the Spotify app via its URI scheme (e.g. spotify:episode:ID).
// On mobile with Spotify installed this switches directly to the app.
function openSpotify(uri) {
  location.href = uri;
}

// ── Boot ──────────────────────────────────────────────────────────────────────

async function boot() {
  // Handle the OAuth callback landing on this page (edge case)
  const params = new URLSearchParams(location.search);
  if (params.has('code')) {
    app.innerHTML = `<div class="screen center">${spinner()}</div>`;
    try {
      await exchangeCode(params.get('code'));
      history.replaceState({}, '', '/');
      route();
    } catch {
      renderLogin();
    }
    return;
  }

  isLoggedIn() ? route() : login();
}

boot();
