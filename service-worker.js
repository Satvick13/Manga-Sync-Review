'use strict';

const CACHE = 'manga-sync-review-v6';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg', './webtoon-history.js'];

function patchApp(html) {
  let output = String(html)
    .replace(
      "      ['comick', 'ComicK'],",
      "      ['comick_dev', 'Comick.dev'],\n      ['comick_live', 'Comick.live'],\n      ['webtoon', 'WEBTOON'],"
    )
    .replace(
      "        if (source === 'mangadex') return 'Check the MangaDex credentials and personal API client.';",
      "        if (source === 'mangadex') return 'Check the MangaDex credentials and personal API client.';\n        if (source === 'comick_dev') return 'Sign in to Comick.dev in the dedicated Manga Sync Brave profile; the browser agent will refresh its snapshot automatically.';\n        if (source === 'comick_live') return 'Sign in to Comick.live in the dedicated Manga Sync Brave profile; the browser agent will refresh its snapshot automatically.';\n        if (source === 'webtoon') return 'Connect the Android phone, open WEBTOON → MY → RECENT and run npm run collect-webtoon in the private bridge repository.';"
    )
    .replace(
      "      if (status === 'blocked') {\n        return 'Refresh the cookie once. If HTTP 403 continues, Cloudflare may be rejecting GitHub-hosted runners.';\n      }",
      "      if (status === 'blocked') {\n        if (source === 'comick_dev' || source === 'comick_live') return 'Open the dedicated Manga Sync Brave profile and verify the site still works there; the browser agent owns these sessions.';\n        return 'Refresh the cookie once. If HTTP 403 continues, Cloudflare may be rejecting the current automated session.';\n      }"
    )
    .replace(
      "script-src 'unsafe-inline' https://cdn.jsdelivr.net",
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net"
    )
    .replace(
      "img-src 'self' data: https://s4.anilist.co https://*.anilist.co",
      "img-src 'self' data: https://s4.anilist.co https://*.anilist.co https://*.pstatic.net https://*.webtoons.com"
    );

  if (!output.includes('webtoon-history.js')) {
    output = output.replace('</body>', '  <script src="./webtoon-history.js"></script>\n</body>');
  }
  return output;
}

async function prepareResponse(request, response) {
  const url = new URL(request.url);
  const isEntryPage =
    response.ok &&
    (url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')) &&
    String(response.headers.get('content-type') || '').includes('text/html');
  if (!isEntryPage) return response;

  const html = patchApp(await response.text());
  const headers = new Headers(response.headers);
  headers.set('cache-control', 'no-store');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then((response) => prepareResponse(event.request, response))
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(async (cached) => {
          if (cached) return prepareResponse(event.request, cached);
          const fallback = await caches.match('./index.html');
          return fallback ? prepareResponse(event.request, fallback) : fallback;
        })
      )
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
