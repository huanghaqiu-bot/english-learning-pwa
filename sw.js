/**
 * Service Worker — PWA 离线缓存
 * 首次加载后缓存所有资源，之后即使断网也能使用
 */

const CACHE_NAME = "eng-learn-v7";
const ASSETS = [
  "index.html",
  "styles.css",
  "app.js",
  "data.js",
  "manifest.json",
  "icon.svg",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png",
];

// 安装：缓存所有静态资源
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// 激活：清理旧缓存
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// 请求拦截：优先用缓存，缓存没有再请求网络
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        return response;
      }).catch(() => cached);
    })
  );
});
