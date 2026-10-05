/* sw.js / サービスワーカー（アプリ本体のキャッシュ） / 仕様書 v1.1 9.7章
 * CACHE_VERSION は js/config.js の APP_VERSION と同じ値にする。 */
'use strict';

var CACHE_VERSION = '1.4.1';
var CACHE_NAME = 're-cache-' + CACHE_VERSION;
var APP_SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/config.js',
  './js/utils.js',
  './js/state.js',
  './js/engine.js',
  './js/mediaSession.js',
  './js/ui.js',
  './js/main.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) { return cache.addAll(APP_SHELL_FILES); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req).then(function (hit) { return hit || fetch(req); })
  );
});
