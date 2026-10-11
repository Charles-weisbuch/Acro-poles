var CACHE_NAME = "acro-poles-v3";
var ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
          .map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  var req = event.request;

  // Ne jamais mettre en cache les appels vers Google Apps Script (saisie + compteur).
  if (req.method !== "GET" || req.url.indexOf("script.google.com") !== -1) {
    return;
  }

  event.respondWith(
    caches.match(req).then(function (cached) {
      return (
        cached ||
        fetch(req)
          .then(function (res) {
            var resClone = res.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(req, resClone);
            });
            return res;
          })
          .catch(function () {
            return caches.match("./index.html");
          })
      );
    })
  );
});
