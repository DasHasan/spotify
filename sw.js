self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname.endsWith('/manifest.json')) {
    event.respondWith(handleManifest(url));
  }
});

function handleManifest(url) {
  const p      = url.searchParams;
  const showId = p.get('show');
  const name   = p.get('name') || 'Podcast Roulette';
  const icon   = p.get('icon');
  const base   = url.origin + url.pathname.replace(/manifest\.json$/, '');

  const short = name.length > 15 ? name.slice(0, 14) + '\u2026' : name;

  const icons = icon
    ? [{ src: icon, sizes: '640x640', type: 'image/jpeg', purpose: 'any maskable' }]
    : [{ src: `${base}favicon.svg`, sizes: 'any', type: 'image/svg+xml' }];

  const manifest = {
    name,
    short_name: short,
    start_url: showId ? `${base}?show=${showId}` : base,
    scope: base,
    display: 'standalone',
    background_color: '#121212',
    theme_color: '#121212',
    icons,
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
