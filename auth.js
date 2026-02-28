const CLIENT_ID    = '4459277a1bc84f1e818d72f0f2af2e82';
const REDIRECT_URI = `${location.origin}/callback`;
const SCOPES       = 'user-library-read';
const AUTH_URL     = 'https://accounts.spotify.com/authorize';
const TOKEN_URL    = 'https://accounts.spotify.com/api/token';

// ── PKCE helpers ────────────────────────────────────────────────────────────

function randomString(len) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const buf   = new Uint8Array(len);
  crypto.getRandomValues(buf);
  return Array.from(buf, b => chars[b % chars.length]).join('');
}

async function sha256base64url(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function login() {
  const verifier  = randomString(64);
  const challenge = await sha256base64url(verifier);
  sessionStorage.setItem('cv', verifier);
  sessionStorage.setItem('return_to', location.href);

  const params = new URLSearchParams({
    client_id:             CLIENT_ID,
    response_type:         'code',
    redirect_uri:          REDIRECT_URI,
    scope:                 SCOPES,
    code_challenge_method: 'S256',
    code_challenge:        challenge,
  });
  location.href = `${AUTH_URL}?${params}`;
}

export async function exchangeCode(code) {
  const verifier = sessionStorage.getItem('cv');
  if (!verifier) throw new Error('PKCE verifier missing — please log in again.');

  const res = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      client_id:     CLIENT_ID,
      grant_type:    'authorization_code',
      code,
      redirect_uri:  REDIRECT_URI,
      code_verifier: verifier,
    }),
  });

  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error_description ?? 'Token exchange failed');
  }

  _save(await res.json());
  sessionStorage.removeItem('cv');
}

export async function getToken() {
  const exp = Number(localStorage.getItem('exp'));
  if (exp && Date.now() < exp - 60_000) return localStorage.getItem('at');
  return _refresh();
}

export const isLoggedIn = () =>
  !!(localStorage.getItem('at') || localStorage.getItem('rt'));

export function logout() {
  ['at', 'rt', 'exp'].forEach(k => localStorage.removeItem(k));
}

// ── Internal ─────────────────────────────────────────────────────────────────

function _save({ access_token, refresh_token, expires_in }) {
  localStorage.setItem('at', access_token);
  if (refresh_token) localStorage.setItem('rt', refresh_token);
  localStorage.setItem('exp', String(Date.now() + expires_in * 1000));
}

async function _refresh() {
  const rt = localStorage.getItem('rt');
  if (!rt) return null;

  const res = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      client_id:     CLIENT_ID,
      grant_type:    'refresh_token',
      refresh_token: rt,
    }),
  });

  if (!res.ok) { logout(); return null; }
  const data = await res.json();
  _save(data);
  return data.access_token;
}
