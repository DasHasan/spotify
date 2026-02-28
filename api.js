import { getToken } from './auth.js';

const BASE = 'https://api.spotify.com/v1';

async function get(path) {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error?.message ?? `Spotify API error ${res.status}`);
  }
  return res.json();
}

// Returns all saved shows (podcasts) from the user's library.
export async function getShows() {
  const all = [];
  let path = '/me/shows?limit=50';
  while (path) {
    const d = await get(path);
    all.push(...d.items.map(i => i.show).filter(Boolean));
    path = d.next ? d.next.replace(BASE, '') : null;
  }
  return all;
}

// Returns full show object including total_episodes.
export async function getShow(id) {
  return get(`/shows/${id}`);
}

// Selects a truly random episode by:
//   1. Using the known total (from show data) to avoid an extra API call.
//   2. Picking a random offset in [0, total).
//   3. Fetching exactly that one episode.
export async function getRandomEpisode(showId, total) {
  if (!total) {
    // Fallback: fetch total from the episodes endpoint
    const d = await get(`/shows/${showId}/episodes?limit=1`);
    total = d.total;
  }
  if (total === 0) throw new Error('This podcast has no episodes.');

  const offset = Math.floor(Math.random() * total);
  const d = await get(`/shows/${showId}/episodes?limit=1&offset=${offset}`);
  const ep = d.items[0];
  if (!ep) throw new Error('Could not retrieve episode. Please try again.');
  return ep;
}
