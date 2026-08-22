const CACHE_NAME = "medo-islamic-offline-v3";
const AUDIO_CACHE_NAME = "medo-reciter-audio-v1";
const KEEP_CACHES = [CACHE_NAME, AUDIO_CACHE_NAME];
const OFFLINE_ASSETS = [
  "./",
  "./index.html",
  "./offline-quran-data.js",
  "./bg.jpg",
  "./favicon.ico",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(OFFLINE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => !KEEP_CACHES.includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isEveryAyahAudio(url) {
  return url.hostname === "everyayah.com" && url.pathname.endsWith(".mp3");
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  if (isEveryAyahAudio(url)) {
    event.respondWith(
      caches.open(AUDIO_CACHE_NAME).then((cache) => (
        fetch(event.request).then((response) => {
          if (response.ok || response.type === "opaque") {
            cache.put(event.request, response.clone());
          }
          return response;
        }).catch(() => cache.match(event.request, { ignoreVary: true }).then((cached) => cached || Response.error()))
      ))
    );
    return;
  }

  event.respondWith(
    fetch(event.request).then((response) => {
      if (response.ok && url.origin === self.location.origin) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => {
      if (event.request.mode === "navigate") {
        return caches.match("./index.html");
      }
      return caches.match(event.request);
    })
  );
});
