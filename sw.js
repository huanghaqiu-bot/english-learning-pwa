/**
 * Service Worker — PWA 离线缓存
 * 缓存优先 + 后台更新策略：秒开 + 自动更新
 */

const CACHE_NAME = "eng-learn-v12";
const ASSETS = [
  "index.html",
  "styles.css",
  "app.js",
  "data.js",
  "manifest.json",
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

// 请求拦截：缓存优先（秒开），后台同时从网络更新
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      // 有缓存就先用缓存（秒开），同时后台从网络更新
      const networkFetch = fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      }).catch(() => cached);

      return cached || networkFetch;
    })
  );
});
